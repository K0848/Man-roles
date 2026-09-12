param([string]$Profile = 'man-roles-task5-restart')
$ErrorActionPreference = 'Stop'
$pluginDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRoot = (Resolve-Path (Join-Path $pluginDir '..')).Path
$harnessRoot = (Resolve-Path (Join-Path $projectRoot '..\deepseek-harness')).Path
$dshHome = if ($env:MAN_ROLES_TASK5_DSH_HOME) { $env:MAN_ROLES_TASK5_DSH_HOME } else { Join-Path $projectRoot ".validation\task5-dsh-$PID" }
$env:DSH_HOME = $dshHome
$store = Join-Path $dshHome 'pnpm-store'
Push-Location $pluginDir
try { npm run build | Out-Host; if ($LASTEXITCODE -ne 0) { throw 'build failed' } } finally { Pop-Location }
Push-Location $harnessRoo
try {
  node --import tsx/esm (Join-Path $harnessRoot 'apps/cli/src/bin.ts') plugin --profile $Profile add "file:$pluginDir" --config.package-import-method=copy "--config.store-dir=$store"
  if ($LASTEXITCODE -ne 0) { throw 'profile install failed' }
  $env:MAN_ROLES_RP_E2E = 'task5-restart-stage1'; node --import tsx/esm (Join-Path $harnessRoot 'apps/cli/src/bin.ts') --profile $Profile ok; if ($LASTEXITCODE -ne 0) { throw 'stage1 failed' }
  Remove-Item Env:MAN_ROLES_RP_E2E -ErrorAction SilentlyContinue
  $env:MAN_ROLES_RP_E2E = 'task5-restart-stage2'; node --import tsx/esm (Join-Path $harnessRoot 'apps/cli/src/bin.ts') --profile $Profile ok; if ($LASTEXITCODE -ne 0) { throw 'stage2 failed' }
  $report = Get-Content -Raw -Encoding UTF8 (Join-Path $dshHome 'man-roles\task5-restart\stage2.json') | ConvertFrom-Json
  $validation = node (Join-Path $pluginDir 'scripts\task5-validate-report.mjs') (Join-Path $dshHome 'man-roles\task5-restart\stage2.json') alpha beta gamma
  if ($LASTEXITCODE -ne 0) { throw 'task5 report validator failed' }
  $validationResult = $validation | ConvertFrom-Json
  if (!$validationResult.passed -or $validationResult.hardGateFailures.Count -ne 0) { throw "task5 validator hard gate failed: $($validationResult.hardGateFailures -join ',')" }
  if (!$report.processRestart -or !$report.dshPersistence -or !$report.derivedState.persisted -or $report.derivedState.generationCalls -ne 0) { throw 'stage2 recovery hard gate failed' }
  if (($report.expectedPersonaIds -join ',') -ne 'alpha,beta,gamma' -or @($report.isolation.PSObject.Properties).Count -ne 3 -or (@($report.isolation.PSObject.Properties | ? { -not $_.Value }).Count -ne 0)) { throw 'persona isolation hard gate failed' }
  if (!$report.cancel.aborted -or $report.cancel.lateAssistant -ne 0 -or $report.cancel.derivedResult.status -ne 'skipped' -or $report.cancel.persistedDerived -ne 0 -or $report.cancel.requests.Count -lt 1) { throw 'cancel hard gate failed' }
  $observedTokenCost = ($report.providerObservation.requests | Measure-Object -Property usageTokens -Sum).Sum
  if ($report.providerObservation.recoveryStreamCalls -ne 0 -or !$report.providerObservation.scriptedOnly -or $report.providerObservation.providerNetworkUsed -or $report.providerObservation.tokenCost -ne 0 -or @($report.providerObservation.requests | ? { $_.usageTokens -ne 0 }).Count -ne 0 -or $report.cancel.usageTokens -ne 0) { throw 'provider/network hard gate failed' }
  Write-Host "[task5] PASS 8 scenarios providerNetworkUsed=false tokenCost=$($report.providerObservation.tokenCost) hardGateFailures=0"
} finally { Remove-Item Env:MAN_ROLES_RP_E2E -ErrorAction SilentlyContinue; Pop-Location }
