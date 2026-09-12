param(
  [switch]$PreflightOnly,
  [ValidateSet('attempt.json', 'attempt-2.json', 'attempt-3.json', 'attempt-4.json')]
  [string]$Attempt = 'attempt.json'
)
$ErrorActionPreference = 'Stop'
$pluginDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRoot = (Resolve-Path (Join-Path $pluginDir '..')).Path
$markerDir = Join-Path $projectRoot '.validation\phase7-task9-real'
$marker = Join-Path $markerDir $Attempt
$markerExistedBefore = Test-Path -LiteralPath $marker
$firstMarker = Join-Path $markerDir 'attempt.json'
$firstRunId = '20260828-125619030'
$firstMarkerSha256 = '885C1F77EFB70C6AB3B9BF387A2E0056F6D3DB8FEEA59964E15CFDB6D490A9B5'
$secondMarkerSha256 = '6265DF0A6151A0E8E007C3F8FEF20E6241F39CA8533B5E8F9C0EA2C5DFF3BE30'
$thirdMarkerSha256 = 'A5DF36DE03161AAB69B075D98ED1E2E5ED6EB870D4ED7FEEE2D6A7983C5EB5B3'
function Get-Sha256([string]$Path) {
  $bytes = [IO.File]::ReadAllBytes($Path)
  return (([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($bytes)) -replace '-', '').ToUpperInvariant())
}
function Assert-ExistingAttempt([string]$Path, [string]$ExpectedHash, [string]$ExpectedRunId, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "$Label marker missing: $Path" }
  if ((Get-Sha256 $Path) -ne $ExpectedHash) { throw "$Label marker hash changed: expected $ExpectedHash actual $(Get-Sha256 $Path)" }
  $value = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  if ($value.attempts -ne 1 -or $value.runId -ne $ExpectedRunId) { throw "$Label marker identity mismatch" }
}
if ($Attempt -in @('attempt-2.json', 'attempt-3.json', 'attempt-4.json')) {
  Assert-ExistingAttempt $firstMarker $firstMarkerSha256 $firstRunId 'first Task9'
}
if ($Attempt -in @('attempt-3.json', 'attempt-4.json')) {
  Assert-ExistingAttempt (Join-Path $markerDir 'attempt-2.json') $secondMarkerSha256 '20260828-164102042' 'second Task9'
}
if ($Attempt -eq 'attempt-4.json') {
  Assert-ExistingAttempt (Join-Path $markerDir 'attempt-3.json') $thirdMarkerSha256 '20260828-172725027' 'third Task9'
}
if ($Attempt -eq 'attempt-2.json') {
  if ((Test-Path -LiteralPath $marker) -and -not $PreflightOnly) { throw "attempt-2 marker already exists: $marker" }
  if ($PreflightOnly -and (Test-Path -LiteralPath $marker)) {
    $secondBytes = [IO.File]::ReadAllBytes($marker)
    $secondHash = ([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($secondBytes)) -replace '-', '').ToUpperInvariant()
    if ($secondHash -ne $secondMarkerSha256) { throw "attempt-2 marker hash changed: expected $secondMarkerSha256 actual $secondHash" }
  }
}
if ((Test-Path -LiteralPath $marker) -and -not $PreflightOnly) { throw "Task9 real batch already claimed: $marker" }
$runId = Get-Date -Format 'yyyyMMdd-HHmmssfff'
$dshHome = Join-Path $projectRoot ".validation\phase7-task9-real-$runId"
$profile = "man-roles-phase7-task9-real-$runId"
$harnessRoot = (Resolve-Path (Join-Path $projectRoot '..\deepseek-harness')).Path
$patch = Join-Path $dshHome 'cordis.patch.yml'
New-Item -ItemType Directory -Path $dshHome -Force | Out-Null
$env:DSH_HOME = $dshHome
@"
- id: credentials
  config:
    path: 'D:\\dsh-home\\.credentials.yaml'
    watch: false
- id: session-title-llm
  disabled: true
  config:
    targetWords: 5
    targetCjkCharacters: 10
    maxInputBytes: 4096
    maxOutputTokens: 64
    timeoutMs: 60000
- id: agent-instructions
  disabled: true
  config:
    maxBytes: 65536
"@ | Set-Content -LiteralPath $patch -Encoding utf8
if (-not (Test-Path -LiteralPath 'D:\dsh-home\.credentials.yaml')) { throw 'credential file missing (content not read)' }
if ((Get-Content -LiteralPath $patch -Raw) -notmatch "path: 'D:\\\\dsh-home\\\\\.credentials.yaml'") { throw 'credential path patch missing' }
if ((Get-Content -LiteralPath $patch -Raw) -notmatch 'watch: false') { throw 'credential watch patch missing' }
Push-Location $pluginDir
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'build failed' }
  Push-Location $harnessRoot
  try {
    node --import tsx/esm (Join-Path $harnessRoot 'apps/cli/src/bin.ts') plugin --profile $profile add "file:$pluginDir" --config.package-import-method=copy "--config.store-dir=$(Join-Path $dshHome 'pnpm-store')"
    if ($LASTEXITCODE -ne 0) { throw 'isolated profile plugin install failed' }
  } finally { Pop-Location }
  if ($PreflightOnly) {
    $budgetSource = Get-Content -LiteralPath (Join-Path $pluginDir 'src\validation\phase7-task9-budget.ts') -Raw
    if ($budgetSource -notmatch "knowledge', allocated: 7000, minimumStart: 2500, repairReserve: 1800" -or $budgetSource -notmatch "dilemma', allocated: 5000, minimumStart: 1800, repairReserve: 1800" -or $budgetSource -notmatch "review', allocated: 4500, minimumStart: 2500, repairReserve: 1800" -or $budgetSource -notmatch "high-risk', allocated: 0, minimumStart: 0, repairReserve: 0" -or $budgetSource -notmatch "cross-person', allocated: 3500, minimumStart: 2200, repairReserve: 1500") { throw 'scenario budget configuration mismatch' }
    $reportSource = Get-Content -LiteralPath (Join-Path $pluginDir 'src\validation\phase7-task9-report.ts') -Raw
    if ($reportSource -notmatch "knowledge', 'dilemma', 'review', 'high-risk', 'cross-person" -or $reportSource -notmatch 'schemaVersion: z\.literal\(2\)' -or $reportSource -notmatch 'tokenLimit: z\.literal\(20000\)') { throw 'scenario, report-version, or token-stop configuration mismatch' }
    $realSource = Get-Content -LiteralPath (Join-Path $pluginDir 'src\e2e\phase7-task9-real.ts') -Raw
    if ($realSource -notmatch "deepseek-official" -or $realSource -notmatch "deepseek-v4-flash") { throw 'provider/model configuration mismatch' }
    $env:MAN_ROLES_RP_E2E = 'phase7-task9-scripted'; $env:MAN_ROLES_TASK9_OUTPUT = (Join-Path $dshHome 'preflight-report')
    Push-Location $harnessRoot
    node --import tsx/esm (Join-Path $harnessRoot 'apps/cli/src/bin.ts') --profile $profile --patch $patch ok
    Pop-Location
    if ($LASTEXITCODE -ne 0) { throw 'safe scripted host preflight failed' }
    $preflightReport = Join-Path $dshHome 'preflight-report\report.json'
    if (-not (Test-Path -LiteralPath $preflightReport)) { throw 'preflight report missing' }
    $pr = Get-Content -LiteralPath $preflightReport -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($pr.providerNetworkUsed -ne $false -or $pr.fullTotal -ne 0) { throw 'preflight was not zero-cost' }
    Remove-Item Env:MAN_ROLES_RP_E2E -ErrorAction SilentlyContinue; Remove-Item Env:MAN_ROLES_TASK9_OUTPUT -ErrorAction SilentlyContinue
    if ($Attempt -in @('attempt-2.json', 'attempt-3.json', 'attempt-4.json')) {
      $afterHash = Get-Sha256 $firstMarker
      if ($afterHash -ne $firstMarkerSha256) { throw "first Task9 marker changed during preflight: $afterHash" }
    }
    if ($Attempt -in @('attempt-3.json', 'attempt-4.json')) {
      $afterSecondHash = Get-Sha256 (Join-Path $markerDir 'attempt-2.json')
      if ($afterSecondHash -ne $secondMarkerSha256) { throw "second Task9 marker changed during preflight: $afterSecondHash" }
    }
    if ($Attempt -eq 'attempt-4.json') {
      $afterThirdHash = Get-Sha256 (Join-Path $markerDir 'attempt-3.json')
      if ($afterThirdHash -ne $thirdMarkerSha256) { throw "third Task9 marker changed during preflight: $afterThirdHash" }
    }
    if ($Attempt -eq 'attempt-2.json') {
      if ((Test-Path -LiteralPath $marker) -ne $markerExistedBefore) { throw "attempt-2 marker presence changed during preflight" }
      $attempt2State = if ($markerExistedBefore) { 'present-and-unchanged' } else { 'absent' }
      Write-Host "preflight: build/install/patch/host ok; first-marker $firstMarkerSha256 before/after; attempt-2 $attempt2State; real calls: 0; command-count=1"; exit 0
    }
    if ($Attempt -eq 'attempt-3.json') {
      $attempt3State = if (Test-Path -LiteralPath $marker) { 'present-and-unchanged' } else { 'absent' }
      if ($attempt3State -ne 'absent') { throw 'attempt-3 marker unexpectedly present during preflight' }
      Write-Host "preflight: build/install/patch/host ok; first-marker $firstMarkerSha256 unchanged; second-marker $secondMarkerSha256 unchanged; attempt-3 absent; budget 7000/5000/4500/0/3500=20000 with repair reserves; model deepseek-official/deepseek-v4-flash; scenarios knowledge,dilemma,review,high-risk,cross-person; token-limit 20000; real calls: 0; command-count=1"; exit 0
    }
    if ($Attempt -eq 'attempt-4.json') {
      if (Test-Path -LiteralPath $marker) { throw 'attempt-4 marker unexpectedly present during preflight' }
      Write-Host "preflight: build/install/patch/host ok; first/second/third markers unchanged; attempt-4 absent; report schema v2; budget 7000/5000/4500/0/3500=20000 with repair reserves; model deepseek-official/deepseek-v4-flash; scenarios knowledge,dilemma,review,high-risk,cross-person; token-limit 20000; real calls: 0; command-count=1"; exit 0
    }
    $markerState = if (Test-Path -LiteralPath $marker) { 'present-and-unchanged' } else { 'absent' }
    Write-Host "preflight: build/install/patch/host ok; marker $markerState (read-only); real calls: 0; command-count=1"; exit 0
  }
  if (Test-Path -LiteralPath $marker) { throw "Task9 real batch already claimed: $marker" }
  $claim = node --input-type=module -e "import {claimSingleAttempt} from './lib/phase7-task9-report.js'; console.log(JSON.stringify(claimSingleAttempt(process.argv[1], process.argv[2])))" $marker $runId
  if ($LASTEXITCODE -ne 0) { throw 'attempt claim failed' }
  $markerHash = ($claim | ConvertFrom-Json).sha256
  $env:MAN_ROLES_RP_E2E = 'phase7-task9-real'; $env:MAN_ROLES_TASK9_OUTPUT = (Join-Path $dshHome 'report'); $env:MAN_ROLES_TASK9_MARKER = $marker; $env:MAN_ROLES_TASK9_MARKER_SHA256 = $markerHash; $env:MAN_ROLES_TASK9_RUN_ID = $runId; $env:DSH_PROFILE = $profile; $env:DSH_HOME = $dshHome
  Push-Location $harnessRoot
  node --import tsx/esm (Join-Path $harnessRoot 'apps/cli/src/bin.ts') --profile $profile --patch $patch ok
  $realExit = $LASTEXITCODE
  Pop-Location
  if ($realExit -ne 0) { throw "real Task9 failed: exit=$realExit" }
  $report = Join-Path $dshHome 'report\report.json'
  if (-not (Test-Path -LiteralPath $report)) { throw "real report missing: $report" }
  node --input-type=module -e "import fs from 'node:fs'; import {validatePhase7Task9Report,readAttemptMarker,sha256} from './lib/phase7-task9-report.js'; const p=process.argv[1],m=process.argv[2],runId=process.argv[3],profile=process.argv[4]; const r=JSON.parse(fs.readFileSync(p,'utf8')), b=fs.readFileSync(m), x=readAttemptMarker(m); if(r.attemptMarkerPath!==m||r.attemptMarkerSha256!==sha256(b)||x.attempts!==1||r.runId!==x.runId||x.runId!==runId||r.profile!==profile) process.exit(2); const f=validatePhase7Task9Report(r,r.scenarios.map(s=>s.personaId),r.provider,r.model); if(f.length){console.error(JSON.stringify(f));process.exit(1)}" $report $marker $runId $profile
  $validatorExit = $LASTEXITCODE
  if ($validatorExit -ne 0) { throw "real Task9 validator failed: exit=$validatorExit" }
} finally { Pop-Location }
