[CmdletBinding()]
param(
  [switch]$Final
)

$ErrorActionPreference = 'Stop'
$pluginDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $pluginDir '..')).Path
$dshRoot = (Resolve-Path -LiteralPath (Join-Path $repoRoot '..\deepseek-harness')).Path
$summary = [ordered]@{
  schemaVersion = 1
  success = $false
  finalGate = [bool]$Final
  providerNetworkUsed = $false
  tokenCost = 0
  stages = @()
  failure = $null
}
$exitCode = 0

function Invoke-ValidationStage {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][string]$Program,
    [Parameter(Mandatory)][string[]]$Arguments,
    [Parameter(Mandatory)][string]$WorkingDirectory
  )

  $startedAt = Get-Date
  Push-Location $WorkingDirectory
  try {
    & $Program @Arguments
    $stageExitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  $summary.stages += [ordered]@{
    name = $Name
    exitCode = $stageExitCode
    durationMs = [int]((Get-Date) - $startedAt).TotalMilliseconds
  }
  if ($stageExitCode -ne 0) { throw "stage '$Name' failed with exit code $stageExitCode" }
}

try {
  Invoke-ValidationStage -Name 'v2-contract' -Program 'npm' -Arguments @('run', 'test:mvp-v2') -WorkingDirectory $pluginDir
  Invoke-ValidationStage -Name 'legacy-contract' -Program 'npm' -Arguments @('run', 'test:legacy-contract') -WorkingDirectory $pluginDir
  Invoke-ValidationStage -Name 'build' -Program 'npm' -Arguments @('run', 'build') -WorkingDirectory $pluginDir
  if ($Final) {
    Invoke-ValidationStage -Name 'web-zero-cost-smoke' -Program 'powershell' -Arguments @('-ExecutionPolicy', 'Bypass', '-File', (Join-Path $pluginDir 'scripts\run-mvp-web-isolated.ps1')) -WorkingDirectory $repoRoot
  }
  Invoke-ValidationStage -Name 'all-tests' -Program 'npm' -Arguments @('test') -WorkingDirectory $pluginDir
  Invoke-ValidationStage -Name 'diff-check' -Program 'git' -Arguments @('-C', $repoRoot, 'diff', '--check') -WorkingDirectory $repoRoot

  # This batch has one explicitly approved Core seam.  Compare the complete
  # working-tree diff when the seam is still uncommitted, or the complete
  # HEAD^..HEAD diff when Phase 1 has frozen it in a dedicated local commit.
  # In both modes an extra edit inside an allowlisted file cannot be hidden by
  # the exception, and unrelated Core history is never accepted implicitly.
  $approvedDshPaths = @(
    'packages/core/agent/src/runtime-types.ts',
    'packages/core/agent-loop/src/agent.ts',
    'packages/core/agent-loop/tests/agent.spec.ts'
  )
  $actualDshPaths = @(& git -C $dshRoot diff HEAD --name-only)
  if ($LASTEXITCODE -ne 0) { throw 'failed to inspect adjacent DSH Core diff' }
  $untrackedDshPaths = @(& git -C $dshRoot ls-files --others --exclude-standard)
  if ($LASTEXITCODE -ne 0) { throw 'failed to inspect adjacent DSH Core untracked files' }
  $dshComparison = @('diff', 'HEAD')
  $dshSeamSource = 'working-tree'
  if ($actualDshPaths.Count -eq 0 -and $untrackedDshPaths.Count -eq 0) {
    $dshHeadParent = (& git -C $dshRoot rev-parse 'HEAD^').Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($dshHeadParent)) { throw 'failed to resolve adjacent DSH Core seam commit parent' }
    $committedDshPaths = @(& git -C $dshRoot diff $dshHeadParent HEAD --name-only)
    if ($LASTEXITCODE -ne 0) { throw 'failed to inspect adjacent DSH Core seam commit' }
    $expectedDshPathKey = [string]::Join("`n", @($approvedDshPaths | Sort-Object))
    $committedDshPathKey = [string]::Join("`n", @($committedDshPaths | Sort-Object))
    if ($committedDshPathKey -eq $expectedDshPathKey) {
      $actualDshPaths = $committedDshPaths
      $dshComparison = @('diff', $dshHeadParent, 'HEAD')
      $dshSeamSource = "commit:$((& git -C $dshRoot rev-parse HEAD).Trim())"
    }
    # The compatibility closeout keeps the production seam and test fixtures
    # in separate commits, followed by a generated catalog/documentation
    # propagation commit. Inspect the seam commit directly so later approved
    # propagation history cannot hide or invalidate the exact Core seam.
    if ($dshSeamSource -eq 'working-tree') {
      $seamCommit = (& git -C $dshRoot rev-parse 'HEAD~2').Trim()
      $seamParent = (& git -C $dshRoot rev-parse 'HEAD~3').Trim()
      $seamPaths = @(& git -C $dshRoot diff $seamParent $seamCommit --name-only)
      $seamPathKey = [string]::Join("`n", @($seamPaths | Sort-Object))
      if ($seamPathKey -eq $expectedDshPathKey) {
        $dshComparison = @('diff', $seamParent, $seamCommit)
        $actualDshPaths = $seamPaths
        $dshSeamSource = "commit:$seamCommit"
      }
    }
  }
  $unexpectedDshPaths = @($actualDshPaths + $untrackedDshPaths | Where-Object { $_ -and $_ -notin $approvedDshPaths })
  $missingDshPaths = @($approvedDshPaths | Where-Object { $_ -notin $actualDshPaths })
  if ($unexpectedDshPaths -or $missingDshPaths -or $actualDshPaths.Count -ne $approvedDshPaths.Count -or $untrackedDshPaths.Count -ne 0) {
    throw "adjacent DSH Core seam paths do not match approval (unexpected=$($unexpectedDshPaths -join ', '); missing=$($missingDshPaths -join ', '); untracked=$($untrackedDshPaths -join ', '))"
  }
  $expectedDshNumstat = @(
    '7 0 packages/core/agent-loop/src/agent.ts',
    '15 0 packages/core/agent-loop/tests/agent.spec.ts',
    '3 0 packages/core/agent/src/runtime-types.ts'
  )
  $actualDshNumstat = @(& git -C $dshRoot @dshComparison --numstat -- $approvedDshPaths | ForEach-Object { ($_ -replace "`t", ' ').Trim() })
  if (($actualDshNumstat -join "`n") -ne ($expectedDshNumstat -join "`n")) { throw "adjacent DSH Core seam line counts do not match approval: $($actualDshNumstat -join '; ')" }

  $expectedDshAdditions = @{
    'packages/core/agent/src/runtime-types.ts' = @(
      '  /** Wake already queued input without inserting another message. */',
      '  wakePending(): boolean',
      ''
    )
    'packages/core/agent-loop/src/agent.ts' = @(
      '  wakePending(): boolean {',
      '    if (!this.inbox.hasPending) return false',
      "    const wasIdle = this.phase.kind === 'idle'",
      '    this.wakeDriver()',
      '    return wasIdle',
      '  }',
      ''
    )
    'packages/core/agent-loop/tests/agent.spec.ts' = @(
      "  it('wakePending() starts one durable queued input without inserting a second user message', async () => {",
      "    const adapter = new MockAdapter([textResponse('ok')])",
      '    const ctx = await harness(adapter)',
      "    const agent = ctx.agentLoop.create(SessionId('wake-pending'), { provider: 'mock', model: 'mock' })",
      "    const message = createUserMessage({ content: [{ type: 'text', text: 'durable once' }], source: { kind: 'user' } })",
      "    agent.send(message, 'next-turn', false)",
      "    expect(agent.status).toBe('idle')",
      "    expect(agent.session.events.filter(event => event.type === 'user/message')).toHaveLength(0)",
      '    expect(agent.wakePending()).toBe(true)',
      '    await agent.whenIdle()',
      "    expect(agent.session.events.filter(event => event.type === 'user/message')).toHaveLength(1)",
      "    expect(adapter.requests).toHaveLength(1)",
      '    expect(agent.wakePending()).toBe(false)',
      '  })',
      ''
    )
  }
  $dshDiffLines = @(& git -C $dshRoot @dshComparison --no-ext-diff --unified=0 -- $approvedDshPaths)
  if ($LASTEXITCODE -ne 0) { throw 'failed to inspect adjacent DSH Core seam content' }
  $addedByDshPath = @{}
  $removedDshLines = @()
  $currentDshPath = $null
  foreach ($line in $dshDiffLines) {
    if ($line -match '^diff --git a/(.+) b/(.+)$') { $currentDshPath = $matches[2]; if (!$addedByDshPath.ContainsKey($currentDshPath)) { $addedByDshPath[$currentDshPath] = @() }; continue }
    if ($line.StartsWith('+++') -or $line.StartsWith('---') -or $null -eq $currentDshPath) { continue }
    if ($line.StartsWith('+')) { $addedByDshPath[$currentDshPath] += $line.Substring(1); continue }
    if ($line.StartsWith('-')) { $removedDshLines += "${currentDshPath}:$($line.Substring(1))" }
  }
  if ($removedDshLines.Count -ne 0) { throw "approved DSH Core seam unexpectedly removes lines: $($removedDshLines -join '; ')" }
  foreach ($path in $approvedDshPaths) {
    if (($addedByDshPath[$path] -join "`n") -ne ($expectedDshAdditions[$path] -join "`n")) { throw "approved DSH Core seam content mismatch in $path" }
  }
  $summary.stages += [ordered]@{ name = 'dsh-core-approved-seam-exact'; exitCode = 0; durationMs = 0; source = $dshSeamSource }

  if ($Final) {
    $todoMatches = Get-ChildItem -LiteralPath (Join-Path $pluginDir 'tests') -Filter '*.test.mjs' -File |
      Select-String -Pattern 'test\.todo\s*\('
    if ($todoMatches) { throw "final gate still contains $($todoMatches.Count) test.todo entries" }
    $summary.stages += [ordered]@{ name = 'todo-zero'; exitCode = 0; durationMs = 0 }
  }

  $summary.success = $true
} catch {
  $exitCode = 1
  $summary.failure = $_.Exception.Message
} finally {
  $summary | ConvertTo-Json -Depth 6 | Write-Output
}

exit $exitCode
