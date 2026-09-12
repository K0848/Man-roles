[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ForwardedArgs
)

$ErrorActionPreference = 'Stop'

$scriptRoot = (Resolve-Path -LiteralPath (Split-Path -Parent $MyInvocation.MyCommand.Definition)).Path
$pluginRoot = (Resolve-Path -LiteralPath (Join-Path $scriptRoot '..')).Path
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

function Get-RuntimeRoot {
  if ([string]::IsNullOrWhiteSpace($env:MAN_ROLES_DSH_RUNTIME)) { return (Join-Path $pluginRoot '.runtime\dsh') }
  return (Resolve-ConfiguredPath $env:MAN_ROLES_DSH_RUNTIME 'MAN_ROLES_DSH_RUNTIME')
}

function Get-DshHome {
  if ([string]::IsNullOrWhiteSpace($env:MAN_ROLES_DSH_HOME)) { return (Join-Path (Get-DefaultLocalApplicationPath) 'ManRoles\dsh-home') }
  return (Resolve-ConfiguredPath $env:MAN_ROLES_DSH_HOME 'MAN_ROLES_DSH_HOME')
}

function Get-AgentsHome {
  if ([string]::IsNullOrWhiteSpace($env:MAN_ROLES_DSH_AGENTS_HOME)) { return (Join-Path (Get-DefaultLocalApplicationPath) 'ManRoles\agents-home') }
  return (Resolve-ConfiguredPath $env:MAN_ROLES_DSH_AGENTS_HOME 'MAN_ROLES_DSH_AGENTS_HOME')
}

function Assert-NotForbiddenPath {
  param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$Label, [Parameter(Mandatory = $true)][string[]]$Forbidden)
  $full = Resolve-ConfiguredPath $Path $Label
  $normalized = $full.TrimEnd('\')
  $root = ([IO.Path]::GetPathRoot($full)).TrimEnd('\')
  if ([string]::IsNullOrWhiteSpace($normalized) -or $normalized -ieq $root) { throw "$Label must not be a disk root: $full" }
  foreach ($candidate in $Forbidden) {
    if (-not [string]::IsNullOrWhiteSpace($candidate) -and $normalized -ieq ([IO.Path]::GetFullPath($candidate)).TrimEnd('\')) { throw "$Label is forbidden: $full" }
  }
  return $full
}

function Test-PathInside {
  param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$Root)
  $pathValue = (Resolve-Path -LiteralPath $Path).Path
  $rootValue = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
  return $pathValue.StartsWith($rootValue, [StringComparison]::OrdinalIgnoreCase)
}

function Assert-JunctionTarget {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$ExpectedTarget,
    [Parameter(Mandatory = $true)][string]$Label
  )
  if (-not (Test-Path -LiteralPath $Path)) { throw "$Label is missing: $Path" }
  $item = Get-Item -LiteralPath $Path -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) { throw "$Label must be a junction: $Path" }
  $actualTarget = [IO.Path]::GetFullPath([string]@($item.Target)[0]).TrimEnd('\')
  $expected = [IO.Path]::GetFullPath($ExpectedTarget).TrimEnd('\')
  if ($actualTarget -ine $expected) { throw "$Label points to an unexpected target: $actualTarget (expected $expected)" }
}

if (-not (Test-Path -LiteralPath $lockPath -PathType Leaf)) { throw "runtime lock is missing: $lockPath" }
$lock = Get-Content -Raw -Encoding UTF8 -LiteralPath $lockPath | ConvertFrom-Json
if ($lock.schemaVersion -ne 1) { throw "unsupported runtime lock schema: $($lock.schemaVersion)" }
$runtimeRoot = Get-RuntimeRoot
$dshHome = Get-DshHome
$agentsHome = Get-AgentsHome
$workspaceRoot = (Resolve-Path -LiteralPath (Join-Path $pluginRoot '..')).Path
$globalNpmRoot = @(& npm root -g 2>&1 | ForEach-Object { [string]$_ }) -join "`n"
if ($LASTEXITCODE -ne 0) { throw "cannot resolve global npm root: $globalNpmRoot" }
$globalNpmRoot = (Resolve-ConfiguredPath $globalNpmRoot.Trim() 'global npm root')
$runtimeRoot = Assert-NotForbiddenPath $runtimeRoot 'local runtime root' @($pluginRoot, $workspaceRoot, (Get-DefaultLocalApplicationPath), $globalNpmRoot)
$dshHome = Assert-NotForbiddenPath $dshHome 'Man-roles DSH_HOME' @($pluginRoot, $workspaceRoot, (Get-DefaultLocalApplicationPath), $globalNpmRoot)
$agentsHome = Assert-NotForbiddenPath $agentsHome 'Man-roles Agents Home' @($pluginRoot, $workspaceRoot, (Get-DefaultLocalApplicationPath), $globalNpmRoot)
$manifestPath = Join-Path $pluginRoot '.runtime\dsh-runtime-manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "local runtime manifest is missing; run prepare-local-runtime.ps1: $manifestPath" }
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
$expectedLockHash = (Get-FileHash -LiteralPath $lockPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ([string]$manifest.lockSha256 -ne $expectedLockHash) { throw 'runtime manifest does not match dsh-runtime.lock.json; run prepare-local-runtime.ps1' }
if ([IO.Path]::GetFullPath([string]$manifest.runtimeRoot).TrimEnd('\') -ine $runtimeRoot.TrimEnd('\')) { throw 'runtime manifest root differs from the configured local runtime root' }
if ([string]$manifest.source.commit -ne [string]$lock.dsh.sourceCommit) { throw 'runtime manifest source commit differs from lock' }

$cliEntry = Join-Path $runtimeRoot ($lock.dsh.cliEntry.Replace('/', '\'))
if (-not (Test-Path -LiteralPath $cliEntry -PathType Leaf)) { throw "local DSH CLI entry is missing: $cliEntry" }
if (-not (Test-PathInside $cliEntry $runtimeRoot)) { throw "local DSH CLI entry escapes local runtime: $cliEntry" }
foreach ($required in @($lock.dsh.requiredPackages)) {
  $entryPath = Join-Path $runtimeRoot ([string]$required.entry).Replace('/', '\')
  if (-not (Test-Path -LiteralPath $entryPath -PathType Leaf)) { throw "required local DSH entry is missing: $entryPath" }
  if (-not (Test-PathInside $entryPath $runtimeRoot)) { throw "required DSH entry escapes local runtime: $entryPath" }
  if (-not [string]::IsNullOrWhiteSpace($required.requiredText) -and -not (Select-String -LiteralPath $entryPath -Pattern ([regex]::Escape([string]$required.requiredText)) -Quiet)) { throw "required text is missing from local DSH entry: $entryPath" }
}

Push-Location $runtimeRoot
try {
  $resolveScript = "const names=['@deepseek-ai/dsh-agent-loop','@deepseek-ai/dsh-agent']; const values=names.map(name=>({name,resolved:import.meta.resolve(name)})); console.log(JSON.stringify(values)); if(values.some(value=>/npm-global/i.test(decodeURIComponent(value.resolved))))process.exit(1);"
  $resolutionOutput = @(& node --input-type=module -e $resolveScript 2>&1 | ForEach-Object { [string]$_ })
  $resolutionExit = $LASTEXITCODE
} finally { Pop-Location }
if ($resolutionExit -ne 0) { throw "local DSH dependency resolution failed or escaped to global: $($resolutionOutput -join ' ')" }

Push-Location $pluginRoot
try {
  & npm run build
  $pluginBuildExit = $LASTEXITCODE
} finally { Pop-Location }
if ($pluginBuildExit -ne 0) { throw "Man-roles plugin build failed with exit $pluginBuildExit" }
foreach ($relativeArtifact in @('cordis.patch.yml', 'lib\index.js', 'lib\client.js')) {
  $artifact = Join-Path $pluginRoot $relativeArtifact
  if (-not (Test-Path -LiteralPath $artifact -PathType Leaf)) { throw "built Man-roles artifact is missing: $artifact" }
}

$dependencyScopeTarget = Join-Path $runtimeRoot 'node_modules\@deepseek-ai'
$dependencyScopeBridge = Join-Path $pluginRoot 'node_modules\@deepseek-ai'
if (-not (Test-Path -LiteralPath $dependencyScopeTarget -PathType Container)) { throw "local DSH dependency scope is missing: $dependencyScopeTarget" }
New-Item -ItemType Directory -Path (Split-Path -Parent $dependencyScopeBridge) -Force | Out-Null
if (Test-Path -LiteralPath $dependencyScopeBridge) {
  Assert-JunctionTarget $dependencyScopeBridge $dependencyScopeTarget 'Man-roles local DSH dependency bridge'
} else {
  New-Item -ItemType Junction -Path $dependencyScopeBridge -Target $dependencyScopeTarget | Out-Null
}

$profileName = [string]$lock.profile.name
$profileDirectory = Join-Path $dshHome "profiles\$profileName"
if (-not (Test-Path -LiteralPath (Join-Path $profileDirectory 'package.json') -PathType Leaf)) { throw "Man-roles profile is missing from dedicated DSH_HOME: $profileDirectory" }
$profileManifest = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $profileDirectory 'package.json') | ConvertFrom-Json
$pluginDependency = [string]$profileManifest.dependencies.'man-roles-roleplayer'
if (-not $pluginDependency.StartsWith('link:', [StringComparison]::OrdinalIgnoreCase)) { throw 'Man-roles profile plugin is not linked to the Git checkout; run prepare-local-runtime.ps1' }
$linkedDependencyPath = [IO.Path]::GetFullPath($pluginDependency.Substring(5)).TrimEnd('\')
if ($linkedDependencyPath -ine $pluginRoot.TrimEnd('\')) { throw "Man-roles profile links a different checkout: $linkedDependencyPath" }
$profilePluginLink = Join-Path $profileDirectory 'node_modules\man-roles-roleplayer'
Assert-JunctionTarget $profilePluginLink $pluginRoot 'Man-roles profile plugin link'
New-Item -ItemType Directory -Path $dshHome, $agentsHome -Force | Out-Null

$originalEnvironment = @{}
foreach ($name in @('DSH_HOME', 'DSH_AGENTS_HOME', 'DSH_TELEMETRY_DISABLED')) { $originalEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
  $env:DSH_HOME = $dshHome
  $env:DSH_AGENTS_HOME = $agentsHome
  $env:DSH_TELEMETRY_DISABLED = '1'
  $forwarded = @($ForwardedArgs)
  $hasProfile = $false
  for ($index = 0; $index -lt $forwarded.Count; $index++) {
    if ([string]$forwarded[$index] -eq '--profile' -or ([string]$forwarded[$index]).StartsWith('--profile=', [StringComparison]::Ordinal)) { $hasProfile = $true; break }
  }
  $cliArgs = if ($hasProfile) { $forwarded } else { @('--profile', $profileName) + $forwarded }
  $shortCommit = ([string]$lock.dsh.sourceCommit).Substring(0, 7)
  Write-Host "[man-roles] dshCommit=$shortCommit packageVersion=$($lock.dsh.packageVersion) cliEntry=$cliEntry DSH_HOME=$dshHome profile=$profileName"
  & node $cliEntry @cliArgs
  $exitCode = $LASTEXITCODE
} finally {
  foreach ($name in $originalEnvironment.Keys) {
    if ($null -eq $originalEnvironment[$name]) { Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue }
    else { Set-Item -LiteralPath "Env:$name" -Value $originalEnvironment[$name] }
  }
}
exit $exitCode
