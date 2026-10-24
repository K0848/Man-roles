[CmdletBinding()]
param(
  [ValidateRange(1, 65535)][int]$Port = 3085,
  [string]$Model = 'deepseek-v4-flash',
  [string]$DshHome,
  [switch]$NoOpen,
  [switch]$DumpConfig
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$dshSource = $projectRoot
$cli = Join-Path $dshSource 'apps\cli\src\bin.ts'
$presetRoot = Join-Path $dshSource 'packages\extensions\man-roleplayer\presets'
if ([string]::IsNullOrWhiteSpace($DshHome)) {
  $DshHome = Join-Path $projectRoot '.local\dsh-home'
}
$DshHome = [System.IO.Path]::GetFullPath($DshHome)
$personas = @(
  [ordered]@{ id = 'wang-yangming'; researchPath = (Join-Path $projectRoot 'research\调研成果-王阳明.md'); presetId = 'wang-yangming' }
  [ordered]@{ id = 'zeng-guofan'; researchPath = (Join-Path $projectRoot 'research\调研成果-曾国藩.md'); presetId = 'zeng-guofan' }
  [ordered]@{ id = 'zhuangzi'; researchPath = (Join-Path $projectRoot 'research\调研成果-庄子.md'); presetId = 'zhuangzi' }
  [ordered]@{ id = 'su-shi'; researchPath = (Join-Path $projectRoot 'research\调研成果-苏轼.md'); presetId = 'su-shi' }
  [ordered]@{ id = 'zhu-xi'; researchPath = (Join-Path $projectRoot 'research\调研成果-朱熹.md'); presetId = 'zhu-xi' }
)
foreach ($requiredPath in @($cli, $presetRoot) + @($personas.researchPath)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) { throw "缺少交付文件：$requiredPath" }
}
$node = Get-Command node -ErrorAction Stop
if (-not (Test-Path -LiteralPath (Join-Path $dshSource 'node_modules\tsx'))) {
  throw '请先在仓库根目录运行 pnpm install --frozen-lockfile，并完成 README 中的构建步骤。'
}
if (-not $DumpConfig) {
  if ([string]::IsNullOrWhiteSpace($env:DEEPSEEK_API_KEY)) {
    throw '请先在当前 PowerShell 设置 $env:DEEPSEEK_API_KEY。启动器不会把密钥写入文件。'
  }
  # 不停止占用端口的进程，避免影响同机已有服务；需要并行运行时显式指定其他端口。
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -ne $listener) { throw "端口 $Port 已被占用（PID $($listener.OwningProcess)）。请关闭对应服务或使用 -Port。" }
}
New-Item -ItemType Directory -Path $DshHome -Force | Out-Null
$bindings = @{
  DSH_HOME = $DshHome
  DSH_MAN_ROLEPLAYER_PRESET_ROOT = $presetRoot
  DSH_MAN_ROLEPLAYER_PERSONAS_JSON = ($personas | ConvertTo-Json -Compress)
  DSH_MAN_ROLEPLAYER_PROVIDER = 'deepseek-official'
  DSH_MAN_ROLEPLAYER_MODEL = $Model
}
$previousEnvironment = @{}
foreach ($key in $bindings.Keys) { $previousEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
try {
  foreach ($key in $bindings.Keys) { [Environment]::SetEnvironmentVariable($key, $bindings[$key], 'Process') }
  $cliArguments = @('--import', 'tsx/esm', $cli, '--profile', 'man-roles-mvp-web')
  if ($DumpConfig) {
    $cliArguments += '--dump-config'
  } else {
    $cliArguments += @('--host', '127.0.0.1', '--port', [string]$Port)
    if ($NoOpen) { $cliArguments += '--no-open' }
    Write-Host "正在启动向古人问惑：http://127.0.0.1:$Port/"
    Write-Host "模型：deepseek-official / $Model；数据目录：$DshHome"
  }
  Push-Location $dshSource
  try {
    & $node.Source @cliArguments
    if ($LASTEXITCODE -ne 0) { throw "DSH 退出码：$LASTEXITCODE" }
  } finally { Pop-Location }
} finally {
  foreach ($key in $bindings.Keys) { [Environment]::SetEnvironmentVariable($key, $previousEnvironment[$key], 'Process') }
}
