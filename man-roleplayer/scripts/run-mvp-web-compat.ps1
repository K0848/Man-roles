[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$pluginDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$repoDir = (Resolve-Path -LiteralPath (Join-Path $pluginDir '..')).Path
$dshRoot = (Resolve-Path -LiteralPath (Join-Path $repoDir '..\deepseek-harness')).Path
$dshLauncher = (Get-Command dsh -ErrorAction Stop).Source
$browserPath = $env:MAN_ROLES_BROWSER_PATH
if ([string]::IsNullOrWhiteSpace($browserPath)) {
  foreach ($candidate in @('C:\Program Files\Google\Chrome\Application\chrome.exe', 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')) {
    if (Test-Path -LiteralPath $candidate) { $browserPath = $candidate; break }
  }
}
if ([string]::IsNullOrWhiteSpace($browserPath) -or !(Test-Path -LiteralPath $browserPath)) { throw 'No configured Chromium-compatible browser executable; set MAN_ROLES_BROWSER_PATH' }
$smokeRoot = Join-Path $repoDir ('.validation\task2-web-runtime-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
$profileDir = Join-Path $smokeRoot 'profiles\mvp-web'
$pluginInstall = Join-Path $smokeRoot 'profiles\node_modules\man-roles-roleplayer'
New-Item -ItemType Directory -Force -Path $profileDir, (Split-Path $pluginInstall) | Out-Null
Push-Location $pluginDir
try {
  # Windows can retain the just-read client source map briefly after a prior
  # browser smoke. Retry only this known transient file-map condition before
  # proceeding; any persistent build error still fails the gate.
  Start-Sleep -Seconds 5
  $built = $false
  for ($attempt = 0; $attempt -lt 3 -and !$built; $attempt++) {
    npm run build
    if ($LASTEXITCODE -eq 0) { $built = $true; break }
    Start-Sleep -Milliseconds 800
  }
  if (!$built) { throw 'build failed' }
  node --test tests/product-remote-compat.test.mjs tests/web-profile-composition.test.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Web compatibility tests failed' }
} finally { Pop-Location }
# Install only into the fresh project-owned validation home; the user DSH_HOME
# and all existing profiles remain outside this smoke's write set.
Copy-Item (Join-Path $pluginDir 'lib') (Join-Path $pluginInstall 'lib') -Recurse -Force
Copy-Item (Join-Path $pluginDir 'src') (Join-Path $pluginInstall 'src') -Recurse -Force
Copy-Item (Join-Path $pluginDir 'package.json'), (Join-Path $pluginDir 'cordis.patch.yml') $pluginInstall -Force
Copy-Item (Join-Path $pluginDir 'profile\mvp-web\cordis.patch.yml') (Join-Path $profileDir 'cordis.patch.yml') -Force
$manifest = Get-Content (Join-Path $pluginDir 'profile\mvp-web\package.json') -Raw
$manifest = $manifest -replace 'file:\.\./\.', ('file:' + $pluginDir.Replace('\','/'))
[IO.File]::WriteAllText((Join-Path $profileDir 'package.json'), $manifest, [Text.UTF8Encoding]::new($false))
New-Item -ItemType Junction -Path (Join-Path $smokeRoot 'profiles\node_modules\@deepseek-ai') -Target (Join-Path $dshRoot 'apps\cli\node_modules\@deepseek-ai') -Force | Out-Null
$env:DSH_HOME = $smokeRoot
$env:MAN_ROLES_STORAGE_DIR = Join-Path $smokeRoot 'product-store'
$env:MAN_ROLES_PRODUCT_SCRIPTED = '1'
$env:MAN_ROLES_PRODUCT_SCRIPTED_CANDIDATE = '1'
$port = Get-Random -Minimum 39100 -Maximum 39900
$stdout = Join-Path $smokeRoot 'web.stdout.log'
$stderr = Join-Path $smokeRoot 'web.stderr.log'
$process = Start-Process -FilePath 'powershell.exe' -WorkingDirectory $dshRoot -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$dshLauncher,'--profile','mvp-web','--no-open','--host','127.0.0.1','--port', $port) -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
try {
  $response = $null
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 500
    $process.Refresh()
    if ($process.HasExited) {
      $out = if (Test-Path $stdout) { Get-Content $stdout -Raw } else { '' }
      $err = if (Test-Path $stderr) { Get-Content $stderr -Raw } else { '' }
      throw "Web Host exited before readiness (exit=$($process.ExitCode)): $err$out"
    }
    try { $response = Invoke-WebRequest -Uri ("http://127.0.0.1:$port/") -UseBasicParsing -TimeoutSec 2; break } catch { }
  }
  if ($null -eq $response) { throw 'Web server did not become ready' }
  $client = Invoke-WebRequest -Uri ("http://127.0.0.1:$port/plugins/man-roles-roleplayer/client.js") -UseBasicParsing -TimeoutSec 5
  $browserProbe = Join-Path $smokeRoot 'browser-probe.mjs'
  $playwright = ([Uri](Join-Path $dshRoot 'apps\web\node_modules\playwright\index.js')).AbsoluteUri
  $probeSource = @"
import playwright from '$playwright'
import { writeFile } from 'node:fs/promises'
const { chromium } = playwright
const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] })
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()
page.setDefaultTimeout(5000)
const consoleErrors = []; const pageErrors = []
const remoteTraffic = []
const feedbackRemoteCalls = []
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
page.on('pageerror', error => pageErrors.push(String(error)))
page.on('response', response => { if (response.url().includes('/remote')) remoteTraffic.push({ url: response.url(), status: response.status() }) })
page.on('request', request => { if (request.url().toLowerCase().includes('feedback')) feedbackRemoteCalls.push(request.url()) })
await page.goto(process.argv[2], { waitUntil: 'domcontentloaded', timeout: 10000 })
await page.waitForTimeout(1000)
await page.screenshot({ path: process.argv[4], fullPage: true })
const title = await page.title()
const productPanelCount = await page.locator('[data-man-roles-product-panel="true"]').count()
const productMutation = { created: false, switched: false, sent: false, reply: false, feedback: false, feedbackActions: { confirm: false, 'partial-confirm': false, correct: false, reject: false, skip: false } }
const disclosure = page.locator('[role="presentation"] button')
const refresh = page.locator('[data-man-roles-refresh="true"]')
const composer = page.locator('[data-man-roles-product-composer="true"]')
const feedbackButton = action => page.locator('[data-man-roles-feedback="' + action + '"]').first()
async function closeDisclosure() {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (!(await disclosure.count())) return
    await disclosure.first().click()
    await page.waitForTimeout(500)
  }
}
async function waitForCandidate() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await feedbackButton('confirm').count()) return true
    if (await refresh.count()) { await refresh.click(); await page.waitForTimeout(150) }
  }
  return false
}
async function waitForCandidateGone() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (!(await feedbackButton('confirm').count())) return true
    if (await refresh.count()) { await refresh.click(); await page.waitForTimeout(150) }
  }
  return false
}
async function createAndReview(action, index) {
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  await closeDisclosure()
  await page.locator('[data-man-roles-create="true"]').click()
  await composer.waitFor({ state: 'visible' })
  await page.waitForTimeout(1000)
  await closeDisclosure()
  await composer.locator('textarea').fill('scripted candidate feedback ' + action + ' ' + index)
  await page.waitForTimeout(250)
  await page.locator('[data-man-roles-product-composer="true"] [data-man-roles-product-send="true"]').click()
  const available = await waitForCandidate()
  if (!available) return false
  if (action === 'correct') {
    const replacement = page.locator('[data-man-roles-candidate-replacement]').first()
    await replacement.fill('\u6d4f\u89c8\u5668\u7ea0\u6b63\u540e\u7684\u56f0\u60d1')
    await page.waitForTimeout(250)
  }
  await feedbackButton(action).click()
  const result = action === 'skip' ? await waitForCandidate() : await waitForCandidateGone()
  return result
}
if (productPanelCount === 1) {
  // Accept the stock Web shell's beta disclosure through its real Continue
  // control before exercising the product panel.
  await closeDisclosure()
  await page.locator('[data-man-roles-create="true"]').click()
  await composer.waitFor({ state: 'visible' })
  await page.waitForTimeout(1000)
  if (await composer.count()) {
    productMutation.created = true
    await closeDisclosure()
    const switcher = page.locator('[data-man-roles-switch="zeng-guofan"]')
    if (await switcher.count()) {
      await switcher.click()
      await page.waitForTimeout(1000)
      productMutation.switched = (await page.locator('[data-man-roles-product-panel="true"]').innerText()).includes('zeng-guofan')
    }
  await closeDisclosure()
    await composer.locator('textarea').fill('scripted product path request')
    await page.waitForTimeout(250)
    await composer.locator('[data-man-roles-product-send="true"]').click()
    const candidateAvailable = await waitForCandidate()
    productMutation.sent = true
    productMutation.reply = (await page.locator('body').innerText()).includes('\u811a\u672c\u5316\u4ea7\u54c1\u56de\u7b54\u3002')
    if (candidateAvailable) {
      await feedbackButton('confirm').click()
      productMutation.feedbackActions.confirm = await waitForCandidateGone()
    }
    productMutation.feedback = productMutation.feedbackActions.confirm
    for (const [index, action] of ['partial-confirm', 'correct', 'reject', 'skip'].entries()) productMutation.feedbackActions[action] = await createAndReview(action, index + 1)
  }
  productMutation.panelText = await page.locator('[data-man-roles-product-panel="true"]').innerText()
}
const report = { title, productPanelCount, productMutation, feedbackRemoteCalls, remoteTraffic, consoleErrors, pageErrors }
await writeFile(process.argv[5], JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report))
await browser.close()
"@
  [IO.File]::WriteAllText($browserProbe, $probeSource, [Text.UTF8Encoding]::new($false))
  $screenshot = Join-Path $smokeRoot 'browser.png'
  $browserReport = Join-Path $smokeRoot 'browser-report.json'
  $probeJson = & node $browserProbe ("http://127.0.0.1:$port/") $browserPath $screenshot $browserReport
  if ($LASTEXITCODE -ne 0) { throw 'Playwright browser probe failed' }
  $probe = $probeJson | ConvertFrom-Json
  $out = if (Test-Path $stdout) { Get-Content $stdout -Raw } else { '' }
  $err = if (Test-Path $stderr) { Get-Content $stderr -Raw } else { '' }
  $process.Refresh()
  if ($process.HasExited) { throw "Web Host exited during smoke (exit=$($process.ExitCode)): $err$out" }
  if ($out -match '(?i)error|exception|failed' -or $err -match '(?i)error|exception|failed') { throw "Host/client smoke emitted an error: $err$out" }
  $feedbackEvents = @()
  Get-ChildItem (Join-Path $smokeRoot 'product-store') -Filter '*.jsonl' -File -ErrorAction SilentlyContinue | ForEach-Object {
    Get-Content -Encoding utf8 $_.FullName | ForEach-Object {
      if ([string]::IsNullOrWhiteSpace($_)) { return }
      $event = $_ | ConvertFrom-Json
      if ($event.type -eq 'trunk/dilemma-item-reviewed') { $feedbackEvents += [ordered]@{ action = [string]$event.data.action; itemId = [string]$event.data.itemId } }
    }
  }
  $expectedFeedbackActions = @('confirm', 'partial-confirm', 'correct', 'reject', 'skip')
  $feedbackActionsPassed = @('confirm', 'partial-confirm', 'correct', 'reject', 'skip') | ForEach-Object { [bool]$probe.productMutation.feedbackActions.$_ } | Where-Object { !$_ }
  $durableFeedbackActions = @($feedbackEvents | ForEach-Object { $_.action } | Sort-Object -Unique)
  $durableFeedbackPassed = ($feedbackEvents.Count -eq $expectedFeedbackActions.Count -and @($expectedFeedbackActions | Where-Object { $durableFeedbackActions -notcontains $_ }).Count -eq 0)
  $success = ($probe.productPanelCount -eq 1 -and $probe.productMutation.created -and $probe.productMutation.switched -and $probe.productMutation.sent -and $probe.productMutation.reply -and $probe.productMutation.feedback -and @($feedbackActionsPassed).Count -eq 0 -and $durableFeedbackPassed -and $probe.consoleErrors.Count -eq 0 -and $probe.pageErrors.Count -eq 0)
  $finalReportPath = Join-Path $smokeRoot 'report.json'
  $finalReport = [ordered]@{ schemaVersion = 1; success = $success; httpStatus = [int]$response.StatusCode; clientStatus = [int]$client.StatusCode; productPanelCount = [int]$probe.productPanelCount; productMutation = $probe.productMutation; feedbackRemoteCalls = @($probe.feedbackRemoteCalls); durableFeedbackEvents = @($feedbackEvents); durableFeedbackPassed = $durableFeedbackPassed; remoteTraffic = @($probe.remoteTraffic); consoleErrors = @($probe.consoleErrors); pageErrors = @($probe.pageErrors); providerNetworkUsed = $false; tokenCost = 0; dshHome = $smokeRoot; browserReport = $browserReport; reportPath = $finalReportPath }
  [IO.File]::WriteAllText($finalReportPath, ($finalReport | ConvertTo-Json -Depth 10) + "`n", [Text.UTF8Encoding]::new($false))
  if (!$success) { throw "Web product mutation failed: $($finalReport | ConvertTo-Json -Compress)" }
  $finalReport | ConvertTo-Json -Compress | Write-Output
} finally {
  if (!$process.HasExited) { & taskkill.exe /PID $process.Id /T /F | Out-Null }
}
