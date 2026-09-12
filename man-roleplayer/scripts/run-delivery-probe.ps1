param([string]$Profile = 'man-roles-delivery-probe')
$ErrorActionPreference = 'Stop'
$pluginDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRoot = (Resolve-Path (Join-Path $pluginDir '..')).Path
$harnessRoot = (Resolve-Path (Join-Path $projectRoot '..\deepseek-harness')).Path
$dshHome = if ($env:MAN_ROLES_VALIDATE_DSH_HOME) { $env:MAN_ROLES_VALIDATE_DSH_HOME } else { Join-Path $projectRoot ".validation\delivery-probe-dsh-$PID" }
$env:DSH_HOME = $dshHome
$installed = Join-Path $dshHome "profiles\$Profile\node_modules\man-roles-roleplayer"
$store = Join-Path $dshHome 'pnpm-store'
Push-Location $pluginDir
try { npm run build; if ($LASTEXITCODE -ne 0) { throw 'build failed' } } finally { Pop-Location }
Push-Location $harnessRoot
try {
  if (-not (Test-Path -LiteralPath $installed)) {
    node --import tsx/esm (Join-Path $harnessRoot 'apps/cli/src/bin.ts') plugin --profile $Profile add "file:$pluginDir" --config.package-import-method=copy "--config.store-dir=$store"
    if ($LASTEXITCODE -ne 0) { throw 'profile install failed' }
  } else {
    $lib = Join-Path $installed 'lib'; New-Item -ItemType Directory -Path $lib -Force | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $pluginDir 'lib') -File | ForEach-Object { [IO.File]::WriteAllBytes((Join-Path $lib $_.Name), [IO.File]::ReadAllBytes($_.FullName)) }
  }
  $env:MAN_ROLES_RP_E2E = 'delivery-probe'
  node --import tsx/esm (Join-Path $harnessRoot 'apps/cli/src/bin.ts') --profile $Profile ok
  if ($LASTEXITCODE -ne 0) { throw "probe failed: $LASTEXITCODE" }
} finally { Remove-Item Env:MAN_ROLES_RP_E2E -ErrorAction SilentlyContinue; Pop-Location }
Write-Host '[delivery-probe] PASS providerNetworkUsed=false tokenCost=0'
