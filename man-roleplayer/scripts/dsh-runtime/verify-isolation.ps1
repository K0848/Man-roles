[CmdletBinding()]
param(
  [string]$OutputPath,
  [string]$PreflightPath,
  [string]$GlobalRestoreLogPath,
  [string]$RegistryRootComparisonPath,
  [string]$RegistryDependencyComparisonPath
)

$ErrorActionPreference = 'Stop'

$scriptRoot = (Resolve-Path -LiteralPath (Split-Path -Parent $MyInvocation.MyCommand.Definition)).Path
$pluginRoot = (Resolve-Path -LiteralPath (Join-Path $scriptRoot '..\..')).Path
$workspaceRoot = (Resolve-Path -LiteralPath (Join-Path $pluginRoot '..')).Path
$lockPath = Join-Path $pluginRoot 'dsh-runtime.lock.json'

function Resolve-ConfiguredPath {
  param([Parameter(Mandatory = $true)][string]$Value, [Parameter(Mandatory = $true)][string]$Label)
  if ([string]::IsNullOrWhiteSpace($Value)) { throw "$Label must not be empty" }
  try { return [IO.Path]::GetFullPath($Value) } catch { throw "$Label is not a valid path: $Value" }
}

function Get-DefaultLocalApplicationPath {
  $base = [Environment]::GetFolderPath('LocalApplicationData')
  if ([string]::IsNullOrWhiteSpace($base)) { throw 'LocalApplicationData is unavailable' }
  return $base
}

function Get-ConfiguredPathOrDefault {
  param([Parameter(Mandatory = $true)][string]$EnvironmentName, [Parameter(Mandatory = $true)][string]$DefaultPath)
  $value = [Environment]::GetEnvironmentVariable($EnvironmentName, 'Process')
  if ([string]::IsNullOrWhiteSpace($value)) { return $DefaultPath }
  return (Resolve-ConfiguredPath $value $EnvironmentName)
}

function Get-GlobalNpmRoot {
  $raw = @(& npm root -g 2>&1 | ForEach-Object { [string]$_ }) -join "`n"
  if ($LASTEXITCODE -ne 0) { throw "cannot resolve global npm root: $raw" }
  return (Resolve-ConfiguredPath $raw.Trim() 'global npm root')
}

function Get-FileHashOrNull {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-JunctionTargetOrNull {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $item = Get-Item -LiteralPath $Path -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) { return $null }
  return [IO.Path]::GetFullPath([string]@($item.Target)[0]).TrimEnd('\')
}

function Invoke-Version {
  param([Parameter(Mandatory = $true)][string]$Executable, [Parameter(Mandatory = $true)][string[]]$Arguments, [Parameter(Mandatory = $true)][hashtable]$Environment)
  $original = @{}
  foreach ($name in $Environment.Keys) { $original[$name] = [Environment]::GetEnvironmentVariable($name, 'Process'); Set-Item -LiteralPath "Env:$name" -Value $Environment[$name] }
  try { $output = @(& node $Executable @Arguments 2>&1 | ForEach-Object { [string]$_ }); $exitCode = $LASTEXITCODE } finally {
    foreach ($name in $original.Keys) {
      if ($null -eq $original[$name]) { Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue }
      else { Set-Item -LiteralPath "Env:$name" -Value $original[$name] }
    }
  }
  return [ordered]@{ exitCode = $exitCode; output = $output }
}

if (-not (Test-Path -LiteralPath $lockPath -PathType Leaf)) { throw "runtime lock is missing: $lockPath" }
$lock = Get-Content -Raw -Encoding UTF8 -LiteralPath $lockPath | ConvertFrom-Json
$runtimeRootDefault = Join-Path $pluginRoot '.runtime\dsh'
$runtimeRoot = Get-ConfiguredPathOrDefault 'MAN_ROLES_DSH_RUNTIME' $runtimeRootDefault
$dshHome = Get-ConfiguredPathOrDefault 'MAN_ROLES_DSH_HOME' (Join-Path (Get-DefaultLocalApplicationPath) 'ManRoles\dsh-home')
$agentsHome = Get-ConfiguredPathOrDefault 'MAN_ROLES_DSH_AGENTS_HOME' (Join-Path (Get-DefaultLocalApplicationPath) 'ManRoles\agents-home')
$globalNpmRoot = Get-GlobalNpmRoot
$manifestPath = Join-Path $pluginRoot '.runtime\dsh-runtime-manifest.json'
$lockHash = Get-FileHashOrNull $lockPath
$manifestHash = Get-FileHashOrNull $manifestPath
$manifest = $null
if (Test-Path -LiteralPath $manifestPath -PathType Leaf) { $manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json }
$manRolesCommit = @(& git -C $workspaceRoot rev-parse HEAD 2>&1 | ForEach-Object { [string]$_ }) -join "`n"
if ($LASTEXITCODE -ne 0) { $manRolesCommit = $null }

$globalCommand = @(Get-Command dsh -All -ErrorAction SilentlyContinue | Select-Object -First 1)
$globalCommandPath = if ($globalCommand.Count -gt 0) { [string]$globalCommand[0].Source } else { $null }
$globalPackageRoot = if ($globalCommandPath) { Join-Path ([IO.Path]::GetDirectoryName($globalCommandPath)) 'node_modules\@deepseek-ai\dsh' } else { Join-Path $globalNpmRoot '@deepseek-ai\dsh' }
$globalLoopRoot = Join-Path $globalPackageRoot 'node_modules\@deepseek-ai\dsh-agent-loop'
$globalAgentRoot = Join-Path $globalPackageRoot 'node_modules\@deepseek-ai\dsh-agent'
$globalCliEntry = Join-Path $globalPackageRoot 'lib\bin.js'
$globalVersion = $null
if (Test-Path -LiteralPath $globalCliEntry -PathType Leaf) {
  $globalVersionResult = Invoke-Version $globalCliEntry @('--version') @{}
  $globalVersion = ($globalVersionResult.output -join ' ').Trim()
}
$globalWakePath = Join-Path $globalLoopRoot 'lib\index.js'
$globalWakePending = $false
if (Test-Path -LiteralPath $globalWakePath -PathType Leaf) { $globalWakePending = [bool](Select-String -LiteralPath $globalWakePath -Pattern 'wakePending' -Quiet) }

$globalRestore = [ordered]@{
  executed = $false
  success = $false
  log = $null
  registry = 'https://registry.npmjs.org/'
  package = '@deepseek-ai/dsh@0.1.1-rc.2'
  rootPackageComparison = $null
  dependencyComparison = $null
}
if (-not [string]::IsNullOrWhiteSpace($GlobalRestoreLogPath)) {
  $restoreLogFullPath = Resolve-ConfiguredPath $GlobalRestoreLogPath 'GlobalRestoreLogPath'
  if (Test-Path -LiteralPath $restoreLogFullPath -PathType Leaf) {
    $restoreLogText = Get-Content -Raw -Encoding UTF8 -LiteralPath $restoreLogFullPath
    $globalRestore.executed = $true
    $globalRestore.success = $restoreLogText -match '(?m)^exitCode=0\s*$'
    $globalRestore.log = $restoreLogFullPath
  }
}
if (-not [string]::IsNullOrWhiteSpace($RegistryRootComparisonPath)) {
  $rootComparisonFullPath = Resolve-ConfiguredPath $RegistryRootComparisonPath 'RegistryRootComparisonPath'
  if (Test-Path -LiteralPath $rootComparisonFullPath -PathType Leaf) {
    $globalRestore.rootPackageComparison = Get-Content -Raw -Encoding UTF8 -LiteralPath $rootComparisonFullPath | ConvertFrom-Json
  }
}
if (-not [string]::IsNullOrWhiteSpace($RegistryDependencyComparisonPath)) {
  $dependencyComparisonFullPath = Resolve-ConfiguredPath $RegistryDependencyComparisonPath 'RegistryDependencyComparisonPath'
  if (Test-Path -LiteralPath $dependencyComparisonFullPath -PathType Leaf) {
    $globalRestore.dependencyComparison = Get-Content -Raw -Encoding UTF8 -LiteralPath $dependencyComparisonFullPath | ConvertFrom-Json
  }
}

$localCliEntry = Join-Path $runtimeRoot ($lock.dsh.cliEntry.Replace('/', '\'))
$localCore = @()
foreach ($required in @($lock.dsh.requiredPackages)) {
  $entryPath = Join-Path $runtimeRoot ([string]$required.entry).Replace('/', '\')
  $entryExists = Test-Path -LiteralPath $entryPath -PathType Leaf
  $localCore += [ordered]@{
    name = [string]$required.name
    entry = $entryPath
    exists = $entryExists
    resolvedInsideRuntime = if ($entryExists) { ((Resolve-Path -LiteralPath $entryPath).Path).StartsWith($runtimeRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) } else { $false }
    requiredTextPresent = if ($entryExists -and -not [string]::IsNullOrWhiteSpace($required.requiredText)) { [bool](Select-String -LiteralPath $entryPath -Pattern ([regex]::Escape([string]$required.requiredText)) -Quiet) } elseif ($entryExists) { $true } else { $false }
  }
}
$localResolveResult = $null
if (Test-Path -LiteralPath $localCliEntry -PathType Leaf) {
  Push-Location $runtimeRoot
  try {
    $script = "const names=['@deepseek-ai/dsh-agent-loop','@deepseek-ai/dsh-agent']; const values=names.map(name=>({name,resolved:import.meta.resolve(name)})); console.log(JSON.stringify(values)); if(values.some(value=>/npm-global/i.test(decodeURIComponent(value.resolved))))process.exit(1);"
    $output = @(& node --input-type=module -e $script 2>&1 | ForEach-Object { [string]$_ })
    $exitCode = $LASTEXITCODE
  } finally { Pop-Location }
  $localResolveResult = [ordered]@{ exitCode = $exitCode; output = $output }
}

$profileName = [string]$lock.profile.name
$profileManifestPath = Join-Path $dshHome "profiles\$profileName\package.json"
$profileExists = Test-Path -LiteralPath $profileManifestPath -PathType Leaf
$profileBundles = @()
$profilePluginDependency = $null
if ($profileExists) {
  $profile = Get-Content -Raw -Encoding UTF8 -LiteralPath $profileManifestPath | ConvertFrom-Json
  $profileBundles = @($profile.dsh.profile.bundles | ForEach-Object { [string]$_ })
  $profilePluginDependency = [string]$profile.dependencies.'man-roles-roleplayer'
}
$profilePluginLinkPath = Join-Path $dshHome "profiles\$profileName\node_modules\man-roles-roleplayer"
$profilePluginLinkTarget = Get-JunctionTargetOrNull $profilePluginLinkPath
$dependencyBridgePath = Join-Path $pluginRoot 'node_modules\@deepseek-ai'
$dependencyBridgeTarget = Get-JunctionTargetOrNull $dependencyBridgePath
$expectedDependencyBridgeTarget = [IO.Path]::GetFullPath((Join-Path $runtimeRoot 'node_modules\@deepseek-ai')).TrimEnd('\')
$fallbackPluginPath = Join-Path $dshHome 'profiles\node_modules\man-roles-roleplayer'
$profileLinkReady = $profilePluginDependency -like 'link:*' -and $profilePluginLinkTarget -ieq $pluginRoot.TrimEnd('\') -and $dependencyBridgeTarget -ieq $expectedDependencyBridgeTarget -and -not (Test-Path -LiteralPath $fallbackPluginPath)

$globalBaseline = [ordered]@{ available = $false; unchanged = $null; comparisons = @() }
if (-not [string]::IsNullOrWhiteSpace($PreflightPath)) {
  $preflightFullPath = Resolve-ConfiguredPath $PreflightPath 'PreflightPath'
  if (-not (Test-Path -LiteralPath $preflightFullPath -PathType Leaf)) { throw "preflight report is missing: $preflightFullPath" }
  $preflight = Get-Content -Raw -Encoding UTF8 -LiteralPath $preflightFullPath | ConvertFrom-Json
  $baselineRecords = @($preflight.runtime.globalArtifacts | ForEach-Object { $_.records } | ForEach-Object { $_ })
  $trackedGlobalFiles = @(
    [ordered]@{ role = 'dsh-cli'; path = $globalCliEntry },
    [ordered]@{ role = 'dsh-agent-loop'; path = (Join-Path $globalLoopRoot 'lib\index.js') },
    [ordered]@{ role = 'dsh-agent'; path = (Join-Path $globalAgentRoot 'lib\index.js') }
  )
  $comparisons = @()
  foreach ($tracked in $trackedGlobalFiles) {
    $baseline = $baselineRecords | Where-Object { [string]$_.path -ieq [string]$tracked.path } | Select-Object -First 1
    $currentHash = Get-FileHashOrNull $tracked.path
    $same = $null -ne $baseline -and [string]$baseline.sha256 -eq [string]$currentHash
    $comparisons += [ordered]@{ role = $tracked.role; path = $tracked.path; baselineSha256 = if ($null -ne $baseline) { [string]$baseline.sha256 } else { $null }; currentSha256 = $currentHash; unchanged = $same }
  }
  $globalBaseline = [ordered]@{ available = $true; path = $preflightFullPath; unchanged = (@($comparisons | Where-Object { -not $_.unchanged }).Count -eq 0 -and $comparisons.Count -eq $trackedGlobalFiles.Count); comparisons = $comparisons }
}

$webSmoke = [ordered]@{ available = $false; path = $null; success = $false }
$validationRoot = Join-Path $workspaceRoot '.validation'
if (Test-Path -LiteralPath $validationRoot -PathType Container) {
  $webReportDirectory = Get-ChildItem -LiteralPath $validationRoot -Directory -Filter 'dsh-runtime-isolation-web-*' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($null -ne $webReportDirectory) {
    $webReportPath = Join-Path $webReportDirectory.FullName 'report.json'
    if (Test-Path -LiteralPath $webReportPath -PathType Leaf) {
      $webReport = Get-Content -Raw -Encoding UTF8 -LiteralPath $webReportPath | ConvertFrom-Json
      $webSmoke = [ordered]@{ available = $true; path = $webReportPath; success = [bool]$webReport.success; httpStatus = [int]$webReport.httpStatus; clientStatus = [int]$webReport.clientStatus; durableFeedbackPassed = [bool]$webReport.durableFeedbackPassed; consoleErrors = @($webReport.consoleErrors); pageErrors = @($webReport.pageErrors); providerNetworkUsed = [bool]$webReport.providerNetworkUsed; tokenCost = [int]$webReport.tokenCost }
    }
  }
}
$finalGate = [ordered]@{ latestIsolatedLog = $null; passed = $false }
if (Test-Path -LiteralPath $validationRoot -PathType Container) {
  $finalGateLog = Get-ChildItem -LiteralPath $validationRoot -Recurse -File -Filter 'man-roles-final-gate*.log' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($null -ne $finalGateLog) {
    $finalGateText = Get-Content -Raw -Encoding UTF8 -LiteralPath $finalGateLog.FullName
    $finalGate = [ordered]@{ latestIsolatedLog = $finalGateLog.FullName; passed = [bool]($finalGateText -match '"success"\s*:\s*true') }
  }
}

$crossWrite = [ordered]@{
  localRuntimeOutsideGlobal = -not $runtimeRoot.StartsWith($globalNpmRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -and $runtimeRoot -ine $globalNpmRoot
  dshHomeOutsideGlobal = -not $dshHome.StartsWith($globalNpmRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -and $dshHome -ine $globalNpmRoot
  agentsHomeOutsideGlobal = -not $agentsHome.StartsWith($globalNpmRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -and $agentsHome -ine $globalNpmRoot
  localRuntimeNotRepoRoot = $runtimeRoot -ine $workspaceRoot -and $runtimeRoot -ine $pluginRoot
  profileOutsideLegacyParent = $dshHome -ine ([Environment]::GetEnvironmentVariable('DSH_HOME', 'Process'))
}
$localReady = (Test-Path -LiteralPath $localCliEntry -PathType Leaf) -and ($null -ne $manifest) -and ([string]$manifest.lockSha256 -eq $lockHash) -and ($localCore | Where-Object { -not $_.exists -or -not $_.resolvedInsideRuntime -or -not $_.requiredTextPresent }).Count -eq 0 -and $null -ne $localResolveResult -and $localResolveResult.exitCode -eq 0 -and $profileExists -and $profileLinkReady -and $crossWrite.localRuntimeOutsideGlobal -and $crossWrite.dshHomeOutsideGlobal -and $crossWrite.agentsHomeOutsideGlobal
$rootArtifactMatches = $null -eq $globalRestore.rootPackageComparison -or [bool]$globalRestore.rootPackageComparison.success
$dependencyArtifactsMatch = $null -eq $globalRestore.dependencyComparison -or (@($globalRestore.dependencyComparison | Where-Object { -not $_.success -or $_.wakePending }).Count -eq 0)
$globalOfficialReady = -not $globalWakePending -and $rootArtifactMatches -and $dependencyArtifactsMatch
$isolationComplete = $localReady -and $globalOfficialReady -and $globalRestore.executed -and $globalRestore.success
$report = [ordered]@{
  schemaVersion = 1
  createdAt = (Get-Date).ToUniversalTime().ToString('o')
  success = [bool]$isolationComplete
  status = if ($isolationComplete) { 'DSH_RUNTIME_ISOLATION_COMPLETE' } elseif ($localReady) { 'LOCAL_MAN_ROLES_RUNTIME_READY' } else { 'LOCAL_RUNTIME_CHECK_FAILED' }
  local = [ordered]@{
    runtimeRoot = $runtimeRoot
    manifestPath = $manifestPath
    manifestExists = ($null -ne $manifest)
    lockSha256 = $lockHash
    manifestSha256 = $manifestHash
    manifestLockMatches = ($null -ne $manifest -and [string]$manifest.lockSha256 -eq $lockHash)
    cliEntry = $localCliEntry
    cliExists = (Test-Path -LiteralPath $localCliEntry -PathType Leaf)
    corePackages = $localCore
    dependencyResolution = $localResolveResult
    dshHome = $dshHome
    agentsHome = $agentsHome
    profile = [ordered]@{ name = $profileName; manifest = $profileManifestPath; exists = $profileExists; bundles = $profileBundles; pluginDependency = $profilePluginDependency; pluginLinkPath = $profilePluginLinkPath; pluginLinkTarget = $profilePluginLinkTarget; dependencyBridgePath = $dependencyBridgePath; dependencyBridgeTarget = $dependencyBridgeTarget; fallbackPluginAbsent = -not (Test-Path -LiteralPath $fallbackPluginPath); linkReady = $profileLinkReady }
    source = if ($null -ne $manifest) { $manifest.source } else { $null }
    seamRuntime = [bool]$localReady
  }
  global = [ordered]@{
    command = $globalCommandPath
    packageRoot = $globalPackageRoot
    version = $globalVersion
    cliEntry = $globalCliEntry
    agentLoopRoot = $globalLoopRoot
    agentRoot = $globalAgentRoot
    wakePendingPresent = $globalWakePending
    officialIntegrity = $globalOfficialReady
    baseline = $globalBaseline
    restore = $globalRestore
  }
  launchers = [ordered]@{ global = $globalCommandPath; local = (Join-Path $pluginRoot 'scripts\start-man-roles.ps1'); localCliEntry = $localCliEntry }
  commits = [ordered]@{ dsh = if ($null -ne $manifest) { [string]$manifest.source.commit } else { [string]$lock.dsh.sourceCommit }; manRoles = $manRolesCommit }
  webSmoke = $webSmoke
  finalGate = $finalGate
  crossWrite = $crossWrite
  providerNetworkUsed = $false
  tokenCost = 0
  notExecuted = @('credential migration', 'data migration', 'Task 11 real provider/network run')
}
if ([string]::IsNullOrWhiteSpace($OutputPath)) { $OutputPath = Join-Path $workspaceRoot (".validation\dsh-runtime-isolation-local-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json') }
$outputFullPath = Resolve-ConfiguredPath $OutputPath 'OutputPath'
New-Item -ItemType Directory -Path (Split-Path -Parent $outputFullPath) -Force | Out-Null
$report | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $outputFullPath -Encoding utf8
$report.outputPath = $outputFullPath
$report | ConvertTo-Json -Depth 30
