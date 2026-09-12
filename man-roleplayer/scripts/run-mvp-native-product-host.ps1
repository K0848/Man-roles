[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$pluginDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$repoDir = (Resolve-Path -LiteralPath (Join-Path $pluginDir '..')).Path
$dshRoot = (Resolve-Path -LiteralPath (Join-Path $repoDir '..\deepseek-harness')).Path
$dshLauncher = (Get-Command dsh -ErrorAction Stop).Source
if (!(Select-String -LiteralPath 'D:\npm-global\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai\dsh-agent-loop\lib\index.js' -Pattern 'wakePending' -Quiet)) { throw 'Active DSH runtime does not contain wakePending' }
$runRoot = Join-Path $repoDir ('.validation\mvp-native-product-host-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
$profileDir = Join-Path $runRoot 'profiles\mvp-native-product'
$pluginInstall = Join-Path $runRoot 'profiles\node_modules\man-roles-roleplayer'
New-Item -ItemType Directory -Force -Path $profileDir, (Split-Path $pluginInstall) | Out-Null
Push-Location $pluginDir
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'build failed' }
} finally { Pop-Location }
Copy-Item (Join-Path $pluginDir 'lib') (Join-Path $pluginInstall 'lib') -Recurse -Force
Copy-Item (Join-Path $pluginDir 'src') (Join-Path $pluginInstall 'src') -Recurse -Force
Copy-Item (Join-Path $pluginDir 'package.json'), (Join-Path $pluginDir 'cordis.patch.yml') $pluginInstall -Force
$manifest = Get-Content (Join-Path $pluginDir 'profile\mvp-web\package.json') -Raw
$manifest = $manifest -replace 'file:\.\./\.', ('file:' + $pluginDir.Replace('\','/'))
[IO.File]::WriteAllText((Join-Path $profileDir 'package.json'), $manifest, [Text.UTF8Encoding]::new($false))
Copy-Item (Join-Path $pluginDir 'profile\mvp-web\cordis.patch.yml') (Join-Path $profileDir 'cordis.patch.yml') -Force
New-Item -ItemType Junction -Path (Join-Path $runRoot 'profiles\node_modules\@deepseek-ai') -Target (Join-Path $dshRoot 'apps\cli\node_modules\@deepseek-ai') -Force | Out-Null
$env:DSH_HOME = $runRoot
$env:MAN_ROLES_RP_E2E = 'mvp-native-product-host'
$stdout = Join-Path $runRoot 'host.stdout.log'
$stderr = Join-Path $runRoot 'host.stderr.log'
$process = Start-Process -FilePath 'powershell.exe' -WorkingDirectory $dshRoot -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$dshLauncher,'--profile','mvp-native-product','--no-open') -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
try {
  if (!$process.WaitForExit(30000)) { throw 'native product Host did not exit after E2E' }
  $process.Refresh()
  $out = if (Test-Path $stdout) { Get-Content $stdout -Raw } else { '' }
  $err = if (Test-Path $stderr) { Get-Content $stderr -Raw } else { '' }
  # Start-Process can expose the wrapper exit code as null after the Node
  # child has already completed.  The signed product report below is the
  # authoritative E2E result; only an observed non-zero wrapper code fails.
  if ($null -ne $process.ExitCode -and $process.ExitCode -ne 0) { throw "native product Host failed (exit=$($process.ExitCode)): $err$out" }
  $reportLine = ($out -split "`r?`n" | Where-Object { $_ -match '"nativeProductHost"\s*:\s*true' } | Select-Object -Last 1)
  if ([string]::IsNullOrWhiteSpace($reportLine)) { throw "native product Host emitted no report: $err$out" }
  $report = $reportLine | ConvertFrom-Json
  if (!$report.passed -or $report.providerNetworkUsed -or $report.tokenCost -ne 0) { throw "native product Host report failed: $reportLine" }
  $reportLine
} finally {
  if (!$process.HasExited) { & taskkill.exe /PID $process.Id /T /F | Out-Null }
}
