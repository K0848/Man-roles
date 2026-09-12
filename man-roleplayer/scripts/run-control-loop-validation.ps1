param(
  [string]$Profile = 'man-roles-loop-compat'
)

$ErrorActionPreference = 'Stop'

$pluginDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRoot = (Resolve-Path (Join-Path $pluginDir '..')).Path
$harnessRoot = (Resolve-Path (Join-Path $projectRoot '..\deepseek-harness')).Path
$userProfilePath = [Environment]::GetFolderPath('UserProfile')
# 验证需要创建 profile 和 DSH 的本地数据库。不要复用运行环境的
# DSH_HOME（它可能指向只读目录或带有用户状态）；如需固定位置，使用
# MAN_ROLES_VALIDATE_DSH_HOME 显式指定验证专用目录。
$dshHomePath = if ([string]::IsNullOrWhiteSpace($env:MAN_ROLES_VALIDATE_DSH_HOME)) {
  Join-Path $projectRoot ".validation\control-loop-dsh-$PID"
} else {
  $env:MAN_ROLES_VALIDATE_DSH_HOME
}
if (-not (Test-Path -LiteralPath $dshHomePath)) {
  New-Item -ItemType Directory -Path $dshHomePath -Force | Out-Null
}
$env:DSH_HOME = $dshHomePath
Write-Host "[loop-compat] 使用验证专用 DSH_HOME: $dshHomePath"
$installedPlugin = Join-Path $dshHomePath "profiles\$Profile\node_modules\man-roles-roleplayer"
$pnpmStorePath = Join-Path $dshHomePath 'pnpm-store'
$runtimeExit = 1

Write-Host '[loop-compat] 1/4 构建插件'
Push-Location $pluginDir
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build 失败，exit=$LASTEXITCODE" }

  Write-Host '[loop-compat] 2/4 运行插件领域循环基线 + 报告判定器测试'
  npm run validate:loop:unit
  if ($LASTEXITCODE -ne 0) { throw "validate:loop:unit 失败，exit=$LASTEXITCODE" }
} finally {
  Pop-Location
}

Write-Host "[loop-compat] 3/4 准备独立 DSH profile: $Profile"
Push-Location $harnessRoot
try {
  if (-not (Test-Path -LiteralPath $installedPlugin)) {
    node --import tsx/esm (Join-Path $harnessRoot 'apps/cli/src/bin.ts') plugin --profile $Profile add "file:$pluginDir" --config.package-import-method=copy "--config.store-dir=$pnpmStorePath"
    if ($LASTEXITCODE -ne 0) { throw "创建/安装 profile 失败，exit=$LASTEXITCODE" }
  } else {
    $installedLib = Join-Path $installedPlugin 'lib'
    if (-not (Test-Path -LiteralPath $installedLib)) {
      New-Item -ItemType Directory -Path $installedLib | Out-Null
    }
    # DSH 进程可能以共享读方式持有 bundle；逐文件 WriteAllBytes 在该情况下比 Copy-Item 稳定。
    Get-ChildItem -LiteralPath (Join-Path $pluginDir 'lib') -File | ForEach-Object {
      $destination = Join-Path $installedLib $_.Name
      [System.IO.File]::WriteAllBytes($destination, [System.IO.File]::ReadAllBytes($_.FullName))
    }
    Write-Host "[loop-compat] 已同步最新构建到 profile 插件副本: $installedLib"
  }

  Write-Host '[loop-compat] 4/4 运行真实 DSH AgentLoop（本地脚本流，零 Provider 请求/零 token）'
  $previousMode = $env:MAN_ROLES_RP_E2E
  try {
    $env:MAN_ROLES_RP_E2E = 'loop-compat'
    node --import tsx/esm (Join-Path $harnessRoot 'apps/cli/src/bin.ts') --profile $Profile 'ok'
    $runtimeExit = $LASTEXITCODE
  } finally {
    if ($null -eq $previousMode) {
      Remove-Item Env:MAN_ROLES_RP_E2E -ErrorAction SilentlyContinue
    } else {
      $env:MAN_ROLES_RP_E2E = $previousMode
    }
  }
} finally {
  Pop-Location
}

$reportRoot = Join-Path $dshHomePath 'man-roles\control-loop-validation'
$latestReport = if (Test-Path -LiteralPath $reportRoot) {
  Get-ChildItem -LiteralPath $reportRoot -Filter 'report.json' -Recurse -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
} else {
  $null
}

if ($null -ne $latestReport) {
  Write-Host "[loop-compat] 最新报告: $($latestReport.FullName)"
}

if ($runtimeExit -ne 0) {
  throw "DSH AgentLoop 兼容性切片失败，exit=$runtimeExit；请把上面的报告文件发回来。"
}

Write-Host '[loop-compat] ✅ 验证完成。请把最新 report.json 发回，继续做两条控制循环的工程决策。'
