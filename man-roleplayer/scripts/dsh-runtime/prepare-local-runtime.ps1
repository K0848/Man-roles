[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$scriptRoot = (Resolve-Path -LiteralPath (Split-Path -Parent $MyInvocation.MyCommand.Definition)).Path
$pluginRoot = (Resolve-Path -LiteralPath (Join-Path $scriptRoot '..\..')).Path
$workspaceRoot = (Resolve-Path -LiteralPath (Join-Path $pluginRoot '..')).Path
$lockPath = Join-Path $pluginRoot 'dsh-runtime.lock.json'
$manifestPath = Join-Path $pluginRoot '.runtime\dsh-runtime-manifest.json'

function Resolve-ConfiguredPath {
  param(
    [Parameter(Mandatory = $true)][string]$Value,
    [Parameter(Mandatory = $true)][string]$Label
  )
  if ([string]::IsNullOrWhiteSpace($Value)) { throw "$Label must not be empty" }
  try { return [IO.Path]::GetFullPath($Value) } catch { throw "$Label is not an absolute path: $Value" }
}

function Get-DefaultLocalApplicationPath {
  $base = [Environment]::GetFolderPath('LocalApplicationData')
  if ([string]::IsNullOrWhiteSpace($base)) { throw 'LocalApplicationData is unavailable; set MAN_ROLES_DSH_HOME and MAN_ROLES_DSH_AGENTS_HOME explicitly' }
  return $base
}

function Get-ConfiguredRuntimeRoot {
  if ([string]::IsNullOrWhiteSpace($env:MAN_ROLES_DSH_RUNTIME)) { return (Join-Path $pluginRoot '.runtime\dsh') }
  return (Resolve-ConfiguredPath $env:MAN_ROLES_DSH_RUNTIME 'MAN_ROLES_DSH_RUNTIME')
}

function Get-ConfiguredDshHome {
  if ([string]::IsNullOrWhiteSpace($env:MAN_ROLES_DSH_HOME)) { return (Join-Path (Get-DefaultLocalApplicationPath) 'ManRoles\dsh-home') }
  return (Resolve-ConfiguredPath $env:MAN_ROLES_DSH_HOME 'MAN_ROLES_DSH_HOME')
}

function Get-ConfiguredAgentsHome {
  if ([string]::IsNullOrWhiteSpace($env:MAN_ROLES_DSH_AGENTS_HOME)) { return (Join-Path (Get-DefaultLocalApplicationPath) 'ManRoles\agents-home') }
  return (Resolve-ConfiguredPath $env:MAN_ROLES_DSH_AGENTS_HOME 'MAN_ROLES_DSH_AGENTS_HOME')
}

function Assert-SafePath {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string[]]$Forbidden
  )
  $full = Resolve-ConfiguredPath $Path $Label
  $normalized = $full.TrimEnd('\')
  if ([string]::IsNullOrWhiteSpace($normalized)) { throw "$Label resolves to a filesystem root" }
  $root = ([IO.Path]::GetPathRoot($full)).TrimEnd('\')
  if ($normalized -ieq $root) { throw "$Label must not be a disk root: $full" }
  foreach ($candidate in $Forbidden) {
    if (-not [string]::IsNullOrWhiteSpace($candidate) -and $normalized -ieq ([IO.Path]::GetFullPath($candidate)).TrimEnd('\')) {
      throw "${Label} must not be ${candidate}: $full"
    }
  }
  return $full
}

function Get-GlobalNpmRoot {
  $value = @(& npm root -g 2>&1 | ForEach-Object { [string]$_ }) -join "`n"
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($value)) { throw "cannot resolve the global npm root: $value" }
  return (Resolve-ConfiguredPath $value.Trim() 'global npm root')
}

function Get-TarballManifest {
  param([Parameter(Mandatory = $true)][string]$Tarball)
  $raw = @(& tar -xOzf $Tarball 'package/package.json' 2>&1 | ForEach-Object { [string]$_ }) -join "`n"
  if ($LASTEXITCODE -ne 0) { throw "cannot read package manifest from tarball ${Tarball}: $raw" }
  try { $manifest = $raw | ConvertFrom-Json } catch { throw "invalid package manifest in tarball $Tarball`: $($_.Exception.Message)" }
  if ([string]::IsNullOrWhiteSpace($manifest.name) -or [string]::IsNullOrWhiteSpace($manifest.version)) {
    throw "tarball $Tarball has no package name/version"
  }
  return $manifest
}

function Get-RelativeFileSpec {
  param(
    [Parameter(Mandatory = $true)][string]$From,
    [Parameter(Mandatory = $true)][string]$To
  )
  $fromFull = [IO.Path]::GetFullPath($From).TrimEnd('\') + '\'
  $toFull = [IO.Path]::GetFullPath($To)
  $fromUri = New-Object -TypeName System.Uri -ArgumentList $fromFull
  $toUri = New-Object -TypeName System.Uri -ArgumentList $toFull
  $relative = $fromUri.MakeRelativeUri($toUri).ToString().Replace('\', '/')
  if ($relative.StartsWith('../', [StringComparison]::Ordinal) -eq $false -and $relative.StartsWith('./', [StringComparison]::Ordinal) -eq $false) {
    $relative = "./$relative"
  }
  return "file:$relative"
}

function Set-ChildEnvironment {
  param([Parameter(Mandatory = $true)][string]$DshHome, [Parameter(Mandatory = $true)][string]$AgentsHome)
  $env:DSH_HOME = $DshHome
  $env:DSH_AGENTS_HOME = $AgentsHome
  $env:DSH_TELEMETRY_DISABLED = '1'
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
$lockHash = (Get-FileHash -LiteralPath $lockPath -Algorithm SHA256).Hash.ToLowerInvariant()

$runtimeRoot = Assert-SafePath (Get-ConfiguredRuntimeRoot) 'local runtime root' @($pluginRoot, $workspaceRoot, (Get-DefaultLocalApplicationPath), (Get-GlobalNpmRoot))
$dshHome = Assert-SafePath (Get-ConfiguredDshHome) 'Man-roles DSH_HOME' @($pluginRoot, $workspaceRoot, (Get-DefaultLocalApplicationPath), (Get-GlobalNpmRoot))
$agentsHome = Assert-SafePath (Get-ConfiguredAgentsHome) 'Man-roles Agents Home' @($pluginRoot, $workspaceRoot, (Get-DefaultLocalApplicationPath), (Get-GlobalNpmRoot))
$sourceRootValue = if ([string]::IsNullOrWhiteSpace($env:MAN_ROLES_DSH_SOURCE)) { Join-Path $pluginRoot '..\..\deepseek-harness' } else { $env:MAN_ROLES_DSH_SOURCE }
$sourceRoot = (Resolve-Path -LiteralPath (Resolve-ConfiguredPath $sourceRootValue 'MAN_ROLES_DSH_SOURCE')).Path
if ($sourceRoot -ieq (Get-GlobalNpmRoot)) { throw 'MAN_ROLES_DSH_SOURCE must not be the global npm root' }

if (Test-Path -LiteralPath $runtimeRoot) {
  $existing = @(Get-ChildItem -LiteralPath $runtimeRoot -Force)
  $existingPackagePath = Join-Path $runtimeRoot 'package.json'
  $existingManifestPath = Join-Path $runtimeRoot 'dsh-runtime-manifest.json'
  if ($existing.Count -gt 0) {
    if (-not (Test-Path -LiteralPath $existingPackagePath -PathType Leaf)) { throw "local runtime already exists and is not a resumable prepare output: $runtimeRoot" }
    $existingPackage = Get-Content -Raw -Encoding UTF8 -LiteralPath $existingPackagePath | ConvertFrom-Json
    if ([string]$existingPackage.name -ne 'man-roles-dsh-local-runtime') { throw "local runtime already exists and is not owned by Man-roles prepare: $runtimeRoot" }
    if (Test-Path -LiteralPath $existingManifestPath -PathType Leaf) {
      $existingManifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $existingManifestPath | ConvertFrom-Json
      if ([string]$existingManifest.lockSha256 -ne $lockHash) { throw "local runtime manifest belongs to a different lock and will not be overwritten: $runtimeRoot" }
    }
  }
}

$families = @('vendor', 'dsh')
$tarballRecords = @()
$dependencySpecs = [ordered]@{}
foreach ($family in $families) {
  $packDirectory = Join-Path $sourceRoot "dist\man-roles\$family"
  if (-not (Test-Path -LiteralPath $packDirectory -PathType Container)) { throw "packed $family directory is missing: $packDirectory" }
  $tarballs = @(Get-ChildItem -LiteralPath $packDirectory -Filter '*.tgz' -File | Sort-Object Name)
  if ($tarballs.Count -eq 0) { throw "packed $family directory has no tarballs: $packDirectory" }
  foreach ($tarball in $tarballs) {
    $package = Get-TarballManifest $tarball.FullName
    if ($dependencySpecs.Contains($package.name)) { throw "duplicate package in packed families: $($package.name)" }
    $dependencySpecs[$package.name] = Get-RelativeFileSpec $runtimeRoot $tarball.FullName
    $tarHash = (Get-FileHash -LiteralPath $tarball.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $tarballRecords += [ordered]@{
      family = $family
      name = [string]$package.name
      version = [string]$package.version
      fileName = $tarball.Name
      sourcePath = $tarball.FullName
      sha256 = $tarHash
    }
  }
}

New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
New-Item -ItemType Directory -Path $dshHome, $agentsHome -Force | Out-Null
$consumerPackage = [ordered]@{
  name = 'man-roles-dsh-local-runtime'
  version = '0.0.0'
  private = $true
  dependencies = $dependencySpecs
}
$consumerPackagePath = Join-Path $runtimeRoot 'package.json'
$consumerPackage | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $consumerPackagePath -Encoding utf8

$installLog = Join-Path $runtimeRoot 'npm-install.log'
Push-Location $runtimeRoot
try {
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & npm install --no-audit --no-fund --package-lock=false --ignore-scripts *> $installLog
    $installExit = $LASTEXITCODE
  } finally { $ErrorActionPreference = $previousErrorAction }
} finally { Pop-Location }
if ($installExit -ne 0) { throw "local runtime npm install failed with exit $installExit; see $installLog" }

$coreRecords = @()
foreach ($required in @($lock.dsh.requiredPackages)) {
  $relative = [string]$required.entry
  $entryPath = Join-Path $runtimeRoot ($relative.Replace('/', '\'))
  if (-not (Test-Path -LiteralPath $entryPath -PathType Leaf)) { throw "required local DSH entry is missing: $entryPath" }
  $realEntry = (Resolve-Path -LiteralPath $entryPath).Path
  if (-not $realEntry.StartsWith($runtimeRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "required DSH entry escapes local runtime: $realEntry" }
  if (-not [string]::IsNullOrWhiteSpace($required.requiredText) -and -not (Select-String -LiteralPath $entryPath -Pattern ([regex]::Escape([string]$required.requiredText)) -Quiet)) {
    throw "required text $($required.requiredText) is missing from $entryPath"
  }
  $packageRoot = Join-Path $runtimeRoot "node_modules\$(([string]$required.name).Replace('/', '\'))"
  if (-not (Test-Path -LiteralPath $packageRoot -PathType Container)) { throw "required local DSH package is missing: $packageRoot" }
  $realPackageRoot = (Resolve-Path -LiteralPath $packageRoot).Path
  if (-not $realPackageRoot.StartsWith($runtimeRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "DSH package escapes local runtime: $realPackageRoot" }
  $coreRecords += [ordered]@{
    name = [string]$required.name
    entry = $relative
    entryPath = $realEntry
    entrySha256 = (Get-FileHash -LiteralPath $entryPath -Algorithm SHA256).Hash.ToLowerInvariant()
    packageRoot = $realPackageRoot
  }
}

$cliEntry = Join-Path $runtimeRoot ($lock.dsh.cliEntry.Replace('/', '\'))
$originalEnvironment = @{}
foreach ($name in @('DSH_HOME', 'DSH_AGENTS_HOME', 'DSH_TELEMETRY_DISABLED')) { $originalEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
  Set-ChildEnvironment $dshHome $agentsHome
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $versionOutput = @(& node $cliEntry --version 2>&1 | ForEach-Object { [string]$_ })
    $versionExit = $LASTEXITCODE
  } finally { $ErrorActionPreference = $previousErrorAction }
  if ($versionExit -ne 0) { throw "local DSH CLI --version failed with exit ${versionExit}: $($versionOutput -join ' ')" }
  $localVersion = ($versionOutput -join ' ').Trim()

  $profileName = [string]$lock.profile.name
  $profileDirectory = Join-Path $dshHome "profiles\$profileName"
  $sourceProfileDirectory = Join-Path $pluginRoot ([string]$lock.profile.sourceRelativePath)
  $sourceProfileManifestPath = Join-Path $sourceProfileDirectory 'package.json'
  $sourceProfilePatchPath = Join-Path $sourceProfileDirectory 'cordis.patch.yml'
  if (-not (Test-Path -LiteralPath $sourceProfileManifestPath -PathType Leaf) -or -not (Test-Path -LiteralPath $sourceProfilePatchPath -PathType Leaf)) {
    throw "Man-roles source profile definition is incomplete: $sourceProfileDirectory"
  }
  $sourceProfile = Get-Content -Raw -Encoding UTF8 -LiteralPath $sourceProfileManifestPath | ConvertFrom-Json
  $expectedBundles = @($lock.profile.bundles | ForEach-Object { [string]$_ })
  $sourceBundles = @($sourceProfile.dsh.profile.bundles | ForEach-Object { [string]$_ })
  $expectedBundleKey = [string]::Join('|', @($expectedBundles | Sort-Object))
  $sourceBundleKey = [string]::Join('|', @($sourceBundles | Sort-Object))
  if ($sourceBundleKey -cne $expectedBundleKey) { throw "source profile bundles differ from dsh-runtime.lock.json: $sourceProfileManifestPath" }

  Push-Location $pluginRoot
  try {
    & npm run build
    $pluginBuildExit = $LASTEXITCODE
  } finally { Pop-Location }
  if ($pluginBuildExit -ne 0) { throw "Man-roles plugin build failed with exit $pluginBuildExit" }

  $dependencyScopeTarget = Join-Path $runtimeRoot 'node_modules\@deepseek-ai'
  $dependencyScopeBridge = Join-Path $pluginRoot 'node_modules\@deepseek-ai'
  if (-not (Test-Path -LiteralPath $dependencyScopeTarget -PathType Container)) { throw "local DSH dependency scope is missing: $dependencyScopeTarget" }
  New-Item -ItemType Directory -Path (Split-Path -Parent $dependencyScopeBridge) -Force | Out-Null
  if (Test-Path -LiteralPath $dependencyScopeBridge) {
    Assert-JunctionTarget $dependencyScopeBridge $dependencyScopeTarget 'Man-roles local DSH dependency bridge'
  } else {
    New-Item -ItemType Junction -Path $dependencyScopeBridge -Target $dependencyScopeTarget | Out-Null
  }

  if (Test-Path -LiteralPath $profileDirectory -PathType Container) {
    $profileManifestPath = Join-Path $profileDirectory 'package.json'
    if (-not (Test-Path -LiteralPath $profileManifestPath -PathType Leaf)) { throw "existing profile has no manifest and will not be overwritten: $profileDirectory" }
    $existingProfile = Get-Content -Raw -Encoding UTF8 -LiteralPath $profileManifestPath | ConvertFrom-Json
    $existingDependency = [string]$existingProfile.dependencies.'man-roles-roleplayer'
    $existingDependencyPath = if ($existingDependency.StartsWith('file:', [StringComparison]::OrdinalIgnoreCase) -or $existingDependency.StartsWith('link:', [StringComparison]::OrdinalIgnoreCase)) { $existingDependency.Substring(5) } else { '' }
    $normalizedExistingDependencyPath = $existingDependencyPath.Replace('/', '\').TrimEnd('\')
    $normalizedPluginRoot = $pluginRoot.Replace('/', '\').TrimEnd('\')
    if ([string]::IsNullOrWhiteSpace($existingDependencyPath) -or $normalizedExistingDependencyPath -ine $normalizedPluginRoot) {
      throw "existing profile is not owned by this Man-roles project and will not be overwritten: $profileDirectory"
    }
  } else {
    New-Item -ItemType Directory -Path $profileDirectory -Force | Out-Null
    $template = Get-Content -Raw -Encoding UTF8 -LiteralPath $sourceProfileManifestPath | ConvertFrom-Json
    $template.dependencies.'man-roles-roleplayer' = "link:$($pluginRoot.Replace('\', '/'))"
    $template | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $profileDirectory 'package.json') -Encoding utf8
    Copy-Item -LiteralPath $sourceProfilePatchPath -Destination (Join-Path $profileDirectory 'cordis.patch.yml')
  }
  $profileLog = Join-Path $runtimeRoot 'profile-install.log'
  $pluginSpec = "link:$($pluginRoot.Replace('\', '/'))"
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & node $cliEntry plugin --profile $profileName add $pluginSpec "--config.store-dir=$(Join-Path $dshHome 'pnpm-store')" *> $profileLog
    $profileExit = $LASTEXITCODE
  } finally { $ErrorActionPreference = $previousErrorAction }
  if ($profileExit -ne 0) { throw "Man-roles profile installation failed with exit $profileExit; see $profileLog" }
  $installedProfileManifestPath = Join-Path $profileDirectory 'package.json'
  if (-not (Test-Path -LiteralPath $installedProfileManifestPath -PathType Leaf)) { throw "profile installation produced no manifest: $profileDirectory" }
  $installedProfile = Get-Content -Raw -Encoding UTF8 -LiteralPath $installedProfileManifestPath | ConvertFrom-Json
  $installedBundles = @($installedProfile.dsh.profile.bundles | ForEach-Object { [string]$_ })
  $installedBundleKey = [string]::Join('|', @($installedBundles | Sort-Object))
  if ($installedBundleKey -cne $expectedBundleKey) {
    $installedProfile.dsh.profile.bundles = $expectedBundles
    $installedProfile | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $installedProfileManifestPath -Encoding utf8
    $installedProfile = Get-Content -Raw -Encoding UTF8 -LiteralPath $installedProfileManifestPath | ConvertFrom-Json
    $installedBundles = @($installedProfile.dsh.profile.bundles | ForEach-Object { [string]$_ })
  }
  $installedBundleKey = [string]::Join('|', @($installedBundles | Sort-Object))
  if ($installedBundleKey -cne $expectedBundleKey) { throw "installed profile bundles differ from lock: $profileDirectory" }
  Copy-Item -LiteralPath $sourceProfilePatchPath -Destination (Join-Path $profileDirectory 'cordis.patch.yml') -Force
  $installedPluginLink = Join-Path $profileDirectory 'node_modules\man-roles-roleplayer'
  Assert-JunctionTarget $installedPluginLink $pluginRoot 'Man-roles profile plugin link'

  $fallbackDirectory = Join-Path $dshHome 'profiles\node_modules'
  $fallbackPluginDirectory = Join-Path $fallbackDirectory 'man-roles-roleplayer'
  if (Test-Path -LiteralPath $fallbackPluginDirectory) {
    $fallbackFullPath = [IO.Path]::GetFullPath($fallbackPluginDirectory)
    $fallbackRoot = [IO.Path]::GetFullPath($fallbackDirectory).TrimEnd('\') + '\'
    if (-not $fallbackFullPath.StartsWith($fallbackRoot, [StringComparison]::OrdinalIgnoreCase)) { throw "fallback plugin path escapes dedicated DSH_HOME: $fallbackFullPath" }
    $fallbackPackagePath = Join-Path $fallbackPluginDirectory 'package.json'
    if (-not (Test-Path -LiteralPath $fallbackPackagePath -PathType Leaf)) { throw "existing DSH fallback entry has no manifest and will not be removed: $fallbackPluginDirectory" }
    $fallbackPackage = Get-Content -Raw -Encoding UTF8 -LiteralPath $fallbackPackagePath | ConvertFrom-Json
    if ([string]$fallbackPackage.name -ne 'man-roles-roleplayer') { throw "existing DSH fallback entry is not owned by Man-roles: $fallbackPluginDirectory" }
    Remove-Item -LiteralPath $fallbackPluginDirectory -Recurse -Force
  }
} finally {
  foreach ($name in $originalEnvironment.Keys) {
    if ($null -eq $originalEnvironment[$name]) { Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue }
    else { Set-Item -LiteralPath "Env:$name" -Value $originalEnvironment[$name] }
  }
}

$manifest = [ordered]@{
  schemaVersion = 1
  runtimeId = [string]$lock.runtimeId
  createdAt = (Get-Date).ToUniversalTime().ToString('o')
  lockSha256 = $lockHash
  source = [ordered]@{ root = $sourceRoot; commit = [string]$lock.dsh.sourceCommit; packageVersion = [string]$lock.dsh.packageVersion }
  runtimeRoot = $runtimeRoot
  dshHome = $dshHome
  agentsHome = $agentsHome
  install = [ordered]@{ packageManager = 'npm'; ignoreScripts = $true; omitOptional = $false; packageCount = $dependencySpecs.Count; families = $families }
  cli = [ordered]@{ package = [string]$lock.dsh.cliPackage; entry = $cliEntry; version = $localVersion }
  tarballs = $tarballRecords
  corePackages = $coreRecords
  profile = [ordered]@{ name = [string]$lock.profile.name; directory = $profileDirectory; manifest = $installedProfileManifestPath; pluginMode = 'link'; pluginRoot = $pluginRoot }
}
$manifest | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $manifestPath -Encoding utf8
Write-Output "local runtime prepared: runtime=$runtimeRoot packages=$($dependencySpecs.Count) cliVersion=$localVersion profile=$($lock.profile.name) manifest=$manifestPath"
