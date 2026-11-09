[CmdletBinding()]
param(
  [ValidateRange(1, 65535)][int]$Port = 3085,
  [string]$Provider,
  [string]$Model,
  [string]$DshHome,
  [string]$CredentialPatch,
  [switch]$Update,
  [switch]$NoOpen,
  [switch]$DumpConfig
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)

# 本机路径集中在忽略的配置中；发布源码不携带个人数据目录或凭据位置。
$settings = @{
  Port = 3085
  Provider = 'deepseek-official'
  Model = 'deepseek-v4-flash'
  DshHome = '.local\dsh-home'
  CredentialPatch = ''
}
$localConfig = Join-Path $projectRoot '.local\launch.json'
if (Test-Path -LiteralPath $localConfig) {
  try { $config = Get-Content -LiteralPath $localConfig -Raw -Encoding UTF8 | ConvertFrom-Json }
  catch { throw '无法解析 .local/launch.json；请使用 JSON 对象，仅保存启动选项和路径。' }
  if ($null -eq $config -or $config -isnot [System.Management.Automation.PSCustomObject]) {
    throw '.local/launch.json 必须是 JSON 对象。'
  }
  foreach ($property in $config.PSObject.Properties) {
    if (-not $settings.ContainsKey($property.Name)) { throw "未知启动配置项：$($property.Name)" }
    if ($property.Name -eq 'Port') {
      if (($property.Value -isnot [int] -and $property.Value -isnot [long]) -or $property.Value -lt 1 -or $property.Value -gt 65535) {
        throw 'launch.json 的 Port 必须是 1 到 65535 的整数。'
      }
    } elseif ($property.Value -isnot [string]) {
      throw "launch.json 的 $($property.Name) 必须是字符串。"
    }
    $settings[$property.Name] = $property.Value
  }
}
foreach ($name in @('Port', 'Provider', 'Model', 'DshHome', 'CredentialPatch')) {
  if ($PSBoundParameters.ContainsKey($name)) { $settings[$name] = $PSBoundParameters[$name] }
}
foreach ($name in @('Provider', 'Model', 'DshHome')) {
  if ([string]::IsNullOrWhiteSpace($settings[$name])) { throw "$name 不能为空。" }
}
$Port = [int]$settings.Port
$Provider = $settings.Provider
$Model = $settings.Model
$DshHome = $settings.DshHome
$CredentialPatch = $settings.CredentialPatch
foreach ($name in @('DshHome', 'CredentialPatch')) {
  $value = Get-Variable -Name $name -ValueOnly
  if (-not [string]::IsNullOrWhiteSpace($value)) {
    if (-not [System.IO.Path]::IsPathRooted($value)) { $value = Join-Path $projectRoot $value }
    Set-Variable -Name $name -Value ([System.IO.Path]::GetFullPath($value))
  }
}
if ($Update -and $DumpConfig) { throw '-Update 与 -DumpConfig 不能同时使用。' }

$cli = Join-Path $projectRoot 'apps\cli\src\bin.ts'
$presetRoot = Join-Path $projectRoot 'packages\extensions\man-roleplayer\presets'
$personas = @(
  [ordered]@{ id = 'wang-yangming'; researchPath = (Join-Path $projectRoot 'research\调研成果-王阳明.md'); presetId = 'wang-yangming' }
  [ordered]@{ id = 'zeng-guofan'; researchPath = (Join-Path $projectRoot 'research\调研成果-曾国藩.md'); presetId = 'zeng-guofan' }
  [ordered]@{ id = 'zhuangzi'; researchPath = (Join-Path $projectRoot 'research\调研成果-庄子.md'); presetId = 'zhuangzi' }
  [ordered]@{ id = 'su-shi'; researchPath = (Join-Path $projectRoot 'research\调研成果-苏轼.md'); presetId = 'su-shi' }
  [ordered]@{ id = 'zhu-xi'; researchPath = (Join-Path $projectRoot 'research\调研成果-朱熹.md'); presetId = 'zhu-xi' }
)
$requiredPaths = @($cli, $presetRoot, (Join-Path $projectRoot 'node_modules\tsx')) + @($personas.researchPath)
if (-not [string]::IsNullOrWhiteSpace($CredentialPatch)) { $requiredPaths += $CredentialPatch }
foreach ($requiredPath in $requiredPaths) {
  if (-not (Test-Path -LiteralPath $requiredPath)) { throw "缺少启动文件：$requiredPath。请检查依赖安装、构建步骤和本机配置。" }
}
$node = Get-Command node -ErrorAction Stop

function Get-PortListeners {
  # 检查所有绑定地址，避免通配地址监听被误认为端口空闲。
  @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Get-OwnedProductProcess([int]$ProcessId) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if ($null -eq $process -or [string]::IsNullOrWhiteSpace($process.ExecutablePath) -or
      [System.IO.Path]::GetFileName($process.ExecutablePath) -ine 'node.exe') { return $null }
  $commandLine = $process.CommandLine
  if ([string]::IsNullOrWhiteSpace($commandLine) -or $commandLine -notmatch '--profile(?:=|\s+)"?man-roles-mvp-web"?(?=\s|$)') { return $null }
  # 仅认可本工程入口；旧路径只用于安全识别根目录提升前仍在运行的本产品。
  foreach ($ownedCli in @($cli, (Join-Path $projectRoot '.delivery\Man-roles\apps\cli\src\bin.ts'))) {
    if ($commandLine -match ('(?:^|\s)"?' + [regex]::Escape($ownedCli) + '"?(?=\s|$)')) { return $process }
  }
  return $null
}

$runningProduct = $null
if (-not $DumpConfig) {
  $listeners = @(Get-PortListeners)
  $owners = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
  if ($owners.Count -gt 0) {
    if ($owners.Count -eq 1) { $runningProduct = Get-OwnedProductProcess $owners[0] }
    if ($null -eq $runningProduct) { throw "端口 $Port 已被其他程序占用，未停止任何进程。" }
    if (-not $Update) {
      Write-Host "向古人问惑已经在运行：http://127.0.0.1:$Port/（PID $($runningProduct.ProcessId)）"
      return
    }
  }
}

if ($Update) {
  $pnpm = Get-Command pnpm -ErrorAction Stop
  Push-Location $projectRoot
  try {
    Write-Host '正在构建：build'
    & $pnpm.Source run build
    if ($LASTEXITCODE -ne 0) { throw "构建失败，退出码：$LASTEXITCODE。旧服务保持运行。" }
  } finally { Pop-Location }
  if ($null -ne $runningProduct) {
    # 构建可能耗时；停止前重新核验 PID、创建时间及入口，防止 PID 复用或端口换主。
    $currentListeners = @(Get-PortListeners)
    $currentOwners = @($currentListeners | Select-Object -ExpandProperty OwningProcess -Unique)
    $currentProcess = Get-OwnedProductProcess $runningProduct.ProcessId
    if ($currentOwners.Count -ne 1 -or $currentOwners[0] -ne $runningProduct.ProcessId -or
        $null -eq $currentProcess -or $currentProcess.CreationDate -ne $runningProduct.CreationDate) {
      throw '构建后端口或进程归属发生变化，未停止任何进程；请检查后重新启动。'
    }
    $waitProcess = Get-Process -Id $runningProduct.ProcessId -ErrorAction Stop
    try {
      # 固定系统进程句柄后再比对实例，停止时沿用同一对象，避免按裸 PID 再次解析到新进程。
      $null = $waitProcess.Handle
      $pinnedStartTicks = $waitProcess.StartTime.ToUniversalTime().Ticks
      $verifiedStartTicks = ([DateTime]$currentProcess.CreationDate).ToUniversalTime().Ticks
      # CIM 创建时间只有微秒精度；Process.StartTime 的额外 100ns 位不参与比较。
      if (($pinnedStartTicks - ($pinnedStartTicks % 10)) -ne ($verifiedStartTicks - ($verifiedStartTicks % 10))) {
        throw '停止前进程实例发生变化，未停止任何进程；请检查后重新启动。'
      }
      Stop-Process -InputObject $waitProcess -ErrorAction Stop
      if (-not $waitProcess.WaitForExit(10000)) { throw '旧产品进程未在 10 秒内停止，未启动新进程。' }
    } finally { $waitProcess.Dispose() }
  }
  if (@(Get-PortListeners).Count -gt 0) { throw "构建后端口 $Port 仍被占用，未启动新进程。" }
}

New-Item -ItemType Directory -Path $DshHome -Force | Out-Null
$bindings = @{
  DSH_HOME = $DshHome
  DSH_MAN_ROLEPLAYER_PRESET_ROOT = $presetRoot
  DSH_MAN_ROLEPLAYER_PERSONAS_JSON = ($personas | ConvertTo-Json -Compress)
  DSH_MAN_ROLEPLAYER_PROVIDER = $Provider
  DSH_MAN_ROLEPLAYER_MODEL = $Model
}
$previousEnvironment = @{}
foreach ($key in $bindings.Keys) { $previousEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
try {
  foreach ($key in $bindings.Keys) { [Environment]::SetEnvironmentVariable($key, $bindings[$key], 'Process') }
  $cliArguments = @('--import', 'tsx/esm', $cli, '--profile', 'man-roles-mvp-web')
  if (-not [string]::IsNullOrWhiteSpace($CredentialPatch)) { $cliArguments += @('--patch', $CredentialPatch) }
  if ($DumpConfig) { $cliArguments += '--dump-config' }
  else {
    $cliArguments += @('--host', '127.0.0.1', '--port', [string]$Port)
    if ($NoOpen) { $cliArguments += '--no-open' }
    Write-Host "正在启动向古人问惑：http://127.0.0.1:$Port/"
    Write-Host "模型：$Provider / $Model"
  }
  # 凭据由应用已有环境/受管凭据提供方解析；启动器只传递可选补丁路径。
  Push-Location $projectRoot
  try {
    & $node.Source @cliArguments
    if ($LASTEXITCODE -ne 0) { throw "DSH 退出码：$LASTEXITCODE" }
  } finally { Pop-Location }
} finally {
  foreach ($key in $bindings.Keys) { [Environment]::SetEnvironmentVariable($key, $previousEnvironment[$key], 'Process') }
}
