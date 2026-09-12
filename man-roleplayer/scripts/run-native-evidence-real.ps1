param([string]$DshHome = 'D:\dsh-home', [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ZeroCostRunId)
$ErrorActionPreference = 'Stop'
if ($ZeroCostRunId -match 'placeholder|required|^0$') { throw 'ZeroCostRunId must identify a completed zero-cost run' }
$pluginDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRoot = (Resolve-Path (Join-Path $pluginDir '..')).Path
$harnessRoot = (Resolve-Path (Join-Path $projectRoot '..\deepseek-harness')).Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$profile = "man-roles-native-evidence-real-$stamp-$PID"
$env:DSH_HOME = $DshHome
$profileDir = Join-Path $DshHome "profiles\$profile"
New-Item -ItemType Directory -Path $DshHome -Force | Out-Null
Push-Location $pluginDir
try { npm run build; if ($LASTEXITCODE -ne 0) { throw "build failed: $LASTEXITCODE" } } finally { Pop-Location }
Push-Location $harnessRoot
try {
  node --import tsx/esm (Join-Path $harnessRoot 'apps/cli/src/bin.ts') plugin --profile $profile add "file:$pluginDir" --config.package-import-method=copy "--config.store-dir=$(Join-Path $DshHome 'pnpm-store')"
  if ($LASTEXITCODE -ne 0) { throw "profile install failed: $LASTEXITCODE" }
  $patchPath = Join-Path $profileDir 'cordis.patch.yml'
  $patch = "- id: agent-instructions`n  disabled: true`n- id: session-title-llm`n  disabled: true`n"
  [System.IO.File]::WriteAllText($patchPath, $patch, [System.Text.UTF8Encoding]::new($false))
  $env:MAN_ROLES_RP_E2E = 'native-evidence'; $env:MAN_ROLES_ZERO_COST_RUN_ID = $ZeroCostRunId
  $runtimeLog = Join-Path $profileDir 'native-evidence-runtime.log'; Write-Host "[native-evidence-real] launching runtime profile=$profile"
  $previousErrorAction = $ErrorActionPreference; $ErrorActionPreference = 'Continue'; try { $lines = @(& node --import tsx/esm (Join-Path $harnessRoot 'apps/cli/src/bin.ts') --profile $profile 'native-evidence' 2>&1) } catch { $lines = @($_); throw } finally { $ErrorActionPreference = $previousErrorAction }
  $runtimeExit = $LASTEXITCODE; $lines | ForEach-Object { Write-Host $_ }; $lines | ForEach-Object { [string]$_ } | Set-Content -LiteralPath $runtimeLog -Encoding UTF8; Write-Host "[native-evidence-real] runtime exited code=$runtimeExit log=$runtimeLog lines=$($lines.Count)"
} finally { Pop-Location }
$summary = $null
foreach ($line in $lines) { try { $candidate = [string]$line | ConvertFrom-Json -ErrorAction Stop; if ($candidate.reportPath) { $summary = $candidate; break } } catch { continue } }
if ($null -eq $summary) { throw "native evidence reportPath JSON not emitted; runtime exit=$runtimeExit; runtime log=$runtimeLog" }
$report = Get-Item -LiteralPath ([string]$summary.reportPath) -ErrorAction Stop
$summary = Get-Content -LiteralPath $report.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
if ($summary.mode -ne 'real' -or $summary.providerNetworkUsed -ne $true -or $summary.passedByZeroCostRunId -ne $ZeroCostRunId -or @($summary.expectedScenarios).Count -ne 6 -or (@($summary.expectedScenarios) -join '|') -ne 'dialogue|zeng-dialogue|historical_fact|verbatim_quote|adversarial|cross-person' -or @($summary.completedScenarios).Count -ne 6 -or (@($summary.completedScenarios) -join '|') -ne 'dialogue|zeng-dialogue|historical_fact|verbatim_quote|adversarial|cross-person' -or @($summary.skippedScenarios).Count -ne 0 -or @($summary.hardGateFailures).Count -ne 0 -or [int]$summary.totalTokens -gt 20000) { throw 'real report contract failed' }
Write-Host "[native-evidence-real] profile=$profile report=$($report.FullName) runtimeExit=$runtimeExit totalTokens=$($summary.totalTokens)"
if ($runtimeExit -ne 0) { exit $runtimeExit }
