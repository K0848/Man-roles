import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const launcher = fileURLToPath(new URL('./start-man-roles.ps1', import.meta.url))
const commandLauncher = fileURLToPath(new URL('../start-man-roles.cmd', import.meta.url))
const names = ['王阳明', '曾国藩', '庄子', '苏轼', '朱熹']
const quote = value => "'" + value.replaceAll("'", "''") + "'"

// 使用真实 PowerShell 入口、隔离文件与受控进程边界；测试不会停止本机真实进程或调用模型。
function run({ config, options = {}, scenario = 'idle', buildCode = 0 } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'man-roles-launch-'))
  const write = (relative, content) => {
    const path = join(root, relative)
    mkdirSync(dirname(path), { recursive: true })
    // Windows PowerShell 5 的中文脚本读取需要 UTF-8 BOM。
    writeFileSync(path, '\ufeff' + content)
  }
  try {
    mkdirSync(join(root, 'scripts'), { recursive: true })
    copyFileSync(launcher, join(root, 'scripts/start-man-roles.ps1'))
    write('apps/cli/src/bin.ts', '')
    mkdirSync(join(root, 'packages/extensions/man-roleplayer/presets'), { recursive: true })
    mkdirSync(join(root, 'node_modules/tsx'), { recursive: true })
    for (const name of names) write('research/调研成果-' + name + '.md', '# fixture')
    if (config !== undefined) write('.local/launch.json', typeof config === 'string' ? config : JSON.stringify(config))
    write('patch.yml', '# keyless fixture')
    write('options.json', JSON.stringify(options))
    write('fake-node.ps1', [
      '$global:events += "start"',
      '$global:captured = @{ Arguments = @($args); Home = $env:DSH_HOME; Provider = $env:DSH_MAN_ROLEPLAYER_PROVIDER; Model = $env:DSH_MAN_ROLEPLAYER_MODEL; PersonasJson = $env:DSH_MAN_ROLEPLAYER_PERSONAS_JSON; PresetRoot = $env:DSH_MAN_ROLEPLAYER_PRESET_ROOT; Cwd = (Get-Location).Path }',
      '$global:LASTEXITCODE = 0',
    ].join('\n'))
    write('fake-pnpm.ps1', [
      '$global:events += "build"',
      '$global:built = $true',
      '$global:LASTEXITCODE = ' + buildCode,
    ].join('\n'))
    write('harness.ps1', [
      '$ErrorActionPreference = "Stop"',
      '$global:events = @(); $global:captured = $null; $global:built = $false; $global:stopped = $false',
      '$global:fixture = ' + quote(root),
      '$global:scenario = ' + quote(scenario),
      '$env:DSH_HOME = "parent-home"',
      'function Get-Command { param($Name) @{ Source = (Join-Path $global:fixture ("fake-" + $Name + ".ps1")) } }',
      'function Get-NetTCPConnection {',
      '  if ($global:scenario -eq "idle" -or $global:stopped) { return }',
      '  $owner = 7001',
      '  if ($global:scenario -eq "foreign" -or ($global:scenario -eq "moved-pid" -and $global:built)) { $owner = 9001 }',
      '  [pscustomobject]@{ OwningProcess = $owner }',
      '}',
      'function Get-CimInstance {',
      '  $cliPath = Join-Path $global:fixture "apps\\cli\\src\\bin.ts"',
      '  if ($global:scenario -eq "legacy") { $cliPath = Join-Path $global:fixture ".delivery\\Man-roles\\apps\\cli\\src\\bin.ts" }',
      '  if ($global:scenario -eq "foreign") { $cliPath = "C:\\another-product\\apps\\cli\\src\\bin.ts" }',
      '  $created = [DateTime]::SpecifyKind([DateTime]::new(2026, 1, 1), [DateTimeKind]::Utc); if ($global:scenario -eq "reused" -and $global:built) { $created = $created.AddSeconds(1) }',
      '  [pscustomobject]@{ ProcessId = 7001; ExecutablePath = "C:\\node\\node.exe"; CommandLine = (\'node.exe --import tsx/esm "\' + $cliPath + \'" --profile man-roles-mvp-web --port 3085\'); CreationDate = $created }',
      '}',
      'function Get-Process {',
      '  $result = [pscustomobject]@{ Pinned = $false }',
      '  $result | Add-Member ScriptProperty Handle { $this.Pinned = $true; $global:events += "pin"; return [IntPtr]1234 }',
      '  $result | Add-Member ScriptProperty StartTime { if (-not $this.Pinned) { throw "Handle must be pinned first" }; $created = [DateTime]::SpecifyKind([DateTime]::new(2026, 1, 1), [DateTimeKind]::Utc); if ($global:scenario -eq "late-reused") { $created = $created.AddSeconds(1) }; return $created }',
      '  $result | Add-Member ScriptMethod WaitForExit { param($Timeout) $global:events += "wait"; return $true }',
      '  $result | Add-Member ScriptMethod Dispose { $global:events += "dispose" }',
      '  $global:pinnedProcess = $result',
      '  $result',
      '}',
      'function Stop-Process { [CmdletBinding()] param([object]$InputObject) if (-not [object]::ReferenceEquals($InputObject, $global:pinnedProcess) -or -not $InputObject.Pinned) { throw "Only the pinned process object may be stopped" }; $global:events += "stop"; $global:stopped = $true }',
      '$launchOptions = @{}',
      '(Get-Content -LiteralPath (Join-Path $global:fixture "options.json") -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $launchOptions[$_.Name] = $_.Value }',
      'try { & (Join-Path $global:fixture "scripts/start-man-roles.ps1") @launchOptions }',
      'finally { @{ Events = @($global:events); Captured = $global:captured; RestoredHome = $env:DSH_HOME } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $global:fixture "result.json") -Encoding UTF8 }',
    ].join('\n'))
    const child = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'harness.ps1')], {
      cwd: tmpdir(),
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...process.env, DEEPSEEK_API_KEY: '' },
    })
    let state
    try { state = JSON.parse(readFileSync(join(root, 'result.json'), 'utf8').replace(/^\ufeff/, '')) }
    catch { state = undefined }
    return { root, status: child.status, stdout: child.stdout, stderr: child.stderr, state }
  } finally {
    // 此目录仅由本测试新建，没有任何 junction 或用户数据。
    rmSync(root, { recursive: true, force: true })
  }
}

const windows = { skip: process.platform !== 'win32' }

test('root command forwards options and exit status through a repository path with spaces', windows, () => {
  const scratch = mkdtempSync(join(tmpdir(), 'man-roles-command-'))
  const root = join(scratch, '含 空格的工程')
  const output = join(scratch, 'forwarded.json')
  mkdirSync(join(root, 'scripts'), { recursive: true })
  try {
    copyFileSync(commandLauncher, join(root, 'start-man-roles.cmd'))
    // 受控终端入口只回读参数，不加载凭据、模型、端口或真实运行数据。
    writeFileSync(join(root, 'scripts/start-man-roles.ps1'), '\ufeff' + [
      '[CmdletBinding()]',
      'param([int]$Port, [string]$DshHome, [switch]$DumpConfig, [switch]$NoOpen)',
      '@{ Port = $Port; Home = $DshHome; Dump = [bool]$DumpConfig; NoOpen = [bool]$NoOpen; ScriptRoot = $PSScriptRoot } | ConvertTo-Json | Set-Content -LiteralPath $env:MAN_ROLES_CMD_TEST_OUTPUT -Encoding UTF8',
      'exit 23',
    ].join('\n'))
    const child = spawnSync('cmd.exe', [
      '/d', '/c', 'call', join(root, 'start-man-roles.cmd'),
      '-Port', '4012', '-DshHome', 'home with spaces', '-DumpConfig', '-NoOpen',
    ], {
      cwd: tmpdir(), encoding: 'utf8', timeout: 30_000,
      env: { ...process.env, DEEPSEEK_API_KEY: '', MAN_ROLES_CMD_TEST_OUTPUT: output },
    })
    assert.equal(child.status, 23, child.stderr || child.stdout)
    const state = JSON.parse(readFileSync(output, 'utf8').replace(/^\ufeff/, ''))
    assert.deepEqual(state, {
      Port: 4012, Home: 'home with spaces', Dump: true, NoOpen: true,
      ScriptRoot: join(root, 'scripts'),
    })
  } finally {
    // 仅清理本测试新建且不含目录链接的隔离目录。
    rmSync(scratch, { recursive: true, force: true })
  }
})

test('public launch uses isolated home, five root research files and inherited credential providers', windows, () => {
  const result = run({ options: { NoOpen: true } })
  assert.equal(result.status, 0, result.stderr)
  const captured = result.state.Captured
  assert.equal(captured.Home, join(result.root, '.local', 'dsh-home'))
  assert.equal(captured.Provider, 'deepseek-official')
  assert.equal(captured.Model, 'deepseek-v4-flash')
  const personas = JSON.parse(captured.PersonasJson)
  assert.equal(personas.length, 5)
  assert.ok(personas.every(persona => persona.researchPath.startsWith(join(result.root, 'research'))))
  assert.deepEqual(captured.Arguments.slice(-5), ['--host', '127.0.0.1', '--port', '3085', '--no-open'])
  assert.ok(!captured.Arguments.includes('--patch'))
  assert.equal(captured.Cwd, result.root)
  assert.equal(result.state.RestoredHome, 'parent-home')
})

test('explicit parameters override local bindings and resolve local relative paths at the root', windows, () => {
  const result = run({
    config: { Port: 4011, DshHome: 'local-home', Provider: 'local-provider', Model: 'local-model', CredentialPatch: 'patch.yml' },
    options: { Port: 4012, Model: 'explicit-model', DshHome: 'explicit-home', NoOpen: true },
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.state.Captured.Home, join(result.root, 'explicit-home'))
  assert.equal(result.state.Captured.Provider, 'local-provider')
  assert.equal(result.state.Captured.Model, 'explicit-model')
  assert.ok(result.state.Captured.Arguments.includes(join(result.root, 'patch.yml')))
  assert.ok(result.state.Captured.Arguments.includes('4012'))
})

test('explicit empty credential patch disables a local patch', windows, () => {
  const result = run({ config: { CredentialPatch: 'patch.yml' }, options: { CredentialPatch: '' } })
  assert.equal(result.status, 0, result.stderr)
  assert.ok(!result.state.Captured.Arguments.includes('--patch'))
})

test('invalid or unknown local config fails before launching a process', windows, () => {
  for (const config of [{ Port: 1.5 }, { Port: 65536 }, { Model: null }, { ApiKey: 'fixture-only' }, '[]']) {
    const result = run({ config })
    assert.notEqual(result.status, 0)
    assert.deepEqual(result.state.Events, [])
  }
})

test('dump stays keyless and does not pass web arguments or inspect a busy port', windows, () => {
  const result = run({ options: { DumpConfig: true, NoOpen: true }, scenario: 'foreign' })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.state.Captured.Arguments.at(-1), '--dump-config')
  assert.ok(!result.state.Captured.Arguments.includes('--port'))
  assert.ok(!result.state.Captured.Arguments.includes('--no-open'))
})

test('an existing owned service is reused while a different checkout is never stopped', windows, () => {
  const existing = run({ scenario: 'own' })
  assert.equal(existing.status, 0, existing.stderr)
  assert.deepEqual(existing.state.Events, [])
  const foreign = run({ scenario: 'foreign', options: { Update: true } })
  assert.notEqual(foreign.status, 0)
  assert.deepEqual(foreign.state.Events, [])
})

test('failed update build keeps the owned service running', windows, () => {
  const result = run({ scenario: 'own', buildCode: 2, options: { Update: true } })
  assert.notEqual(result.status, 0)
  assert.deepEqual(result.state.Events, ['build'])
})

test('update builds successfully before stopping and awaiting this product, including its old root path', windows, () => {
  for (const scenario of ['own', 'legacy']) {
    const result = run({ scenario, options: { Update: true } })
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(result.state.Events, ['build', 'pin', 'stop', 'wait', 'dispose', 'start'])
  }
})

test('update refuses a new port owner or recycled PID after building', windows, () => {
  for (const scenario of ['moved-pid', 'reused']) {
    const result = run({ scenario, options: { Update: true } })
    assert.notEqual(result.status, 0)
    assert.deepEqual(result.state.Events, ['build'])
  }
})

test('update refuses a recycled PID returned by Get-Process after CIM verification and releases the pinned handle', windows, () => {
  const result = run({ scenario: 'late-reused', options: { Update: true } })
  assert.notEqual(result.status, 0)
  assert.deepEqual(result.state.Events, ['build', 'pin', 'dispose'])
})

test('update and dump are rejected together before build or launch', windows, () => {
  const result = run({ options: { Update: true, DumpConfig: true } })
  assert.notEqual(result.status, 0)
  assert.deepEqual(result.state.Events, [])
})
