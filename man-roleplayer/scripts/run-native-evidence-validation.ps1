param([string]$ValidationHome = '')
$ErrorActionPreference = 'Stop'
$pluginDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRoot = (Resolve-Path (Join-Path $pluginDir '..')).Path
$harnessRoot = (Resolve-Path (Join-Path $projectRoot '..\deepseek-harness')).Path
$suffix = "$(Get-Date -Format 'yyyyMMdd-HHmmss')-$PID"
$dshHome = if ([string]::IsNullOrWhiteSpace($ValidationHome)) { Join-Path $projectRoot ".validation\native-evidence-dsh-$suffix" } else { $ValidationHome }
New-Item -ItemType Directory -Path $dshHome -Force | Out-Null
$env:DSH_HOME = $dshHome
$profile = 'man-roles-native-evidence'; $store = Join-Path $dshHome 'pnpm-store'; $installed = Join-Path $dshHome "profiles\$profile\node_modules\man-roles-roleplayer"
Push-Location $pluginDir
try { npm run build; if ($LASTEXITCODE -ne 0) { throw "build failed: $LASTEXITCODE" } } finally { Pop-Location }
Push-Location $harnessRoot
try {
  node --import tsx/esm (Join-Path $harnessRoot 'apps/cli/src/bin.ts') plugin --profile $profile add "file:$pluginDir" --config.package-import-method=copy "--config.store-dir=$store"
  if ($LASTEXITCODE -ne 0) { throw "profile install failed: $LASTEXITCODE" }
  $patchPath = Join-Path $dshHome "profiles\$profile\cordis.patch.yml"
  $patchText = "- id: agent-instructions`n  disabled: true`n- id: session-title-llm`n  disabled: true`n"
  [System.IO.File]::WriteAllText($patchPath, $patchText, [System.Text.UTF8Encoding]::new($false))
  $env:MAN_ROLES_RP_E2E = 'native-evidence'; $env:MAN_ROLES_NATIVE_EVIDENCE = 'scripted-budget'
  $previousErrorAction = $ErrorActionPreference
  try { $ErrorActionPreference = 'Continue'; $lines = @(& node --import tsx/esm (Join-Path $harnessRoot 'apps/cli/src/bin.ts') --profile $profile 'native-evidence' 2>&1) } finally { $ErrorActionPreference = $previousErrorAction }
  $runtimeExit = $LASTEXITCODE; $lines | ForEach-Object { Write-Host $_ }
} finally { Pop-Location }
$json = $lines | Where-Object { $_ -match '"providerNetworkUsed"' } | Select-Object -Last 1
if ([string]::IsNullOrWhiteSpace($json)) { throw "native scripted probe 未输出 summary JSON；runtime exit=$runtimeExit" }
$summary = $json | ConvertFrom-Json
$expected = @()
$ok = ($summary.providerNetworkUsed -eq $false -and $summary.tokenCost -eq 0 -and $summary.scriptedProbeCompleted -eq $true -and $summary.resumeProjectionMatches -eq $true -and $summary.budgetBlockedStateSupported -eq $true -and (Compare-Object @($summary.hardGateFailures) $expected).Count -eq 0 -and $runtimeExit -eq 0)
$report = Join-Path $dshHome 'native-evidence-report.json'; $summary | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $report -Encoding utf8
Write-Host "[native-evidence] summary=$report runtimeExit=$runtimeExit expectedProbeExit=0 scriptExit=$([int](-not $ok))"
if (-not $ok) { throw 'native scripted probe summary did not match expected single budget gap' }
