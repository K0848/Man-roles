const registry = makePersonaRegistry(mkdtempSync(join(tmpdir(), 'shared-personas-')))
import { makePersonaRegistry } from './persona-fixture.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { attachTurnBudget } from '../lib/turn-budget.js'
import { TrunkStorage } from '../lib/storage.js'

function harness() {
  let preStep
  let guard
  const ctx = {
    on(_event, handler) { preStep = handler; return () => {} },
    tools: { guard(handler) { guard = handler; return () => {} } },
  }
  const agent = { session: { events: [{ type: 'turn/start', data: { turn: 1 } }] }, ctx }
  return { ctx, agent, get preStep() { return preStep }, get guard() { return guard } }
}

const task = { taskId: 'budget-task', personaId: 'alpha', branchSessionId: 'branch-1' }

test('预算 guard→pre-step 真实写入单个 Trunk event，重复记录幂等', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'turn-budget-'))
  const trunk = TrunkStorage.create('conversation', dir, 'alpha', registry)
  const h = harness()
  attachTurnBudget(h.ctx, h.agent, { maxSteps: 8, maxToolCalls: 0, maxTokens: 20000 }, {
    resolveTask: () => task,
    recordBlocked: (outcome) => trunk.recordTaskBudgetBlocked({ ...outcome, branchTurn: 1, status: 'blocked', reason: 'budget_exceeded', retryable: true }),
  })
  assert.equal(h.guard({ name: 'retrieve_anecdotes', agent: h.agent }), '本回合已达到工具调用预算')
  const decision = await h.preStep({ agent: h.agent, step: 1, turn: 1 }, () => ({ kind: 'continue' }))
  assert.deepEqual(decision, { kind: 'reject' })
  const lines = readFileSync(trunk.filePath, 'utf8').trim().split(/\r?\n/).filter(Boolean)
  assert.equal(lines.filter((line) => JSON.parse(line).type === 'trunk/task-outcome-recorded').length, 1)
})

test('budget recorder 抛错时 guard/pre-step 均传播，且不伪造持久化结果', async () => {
  const h = harness()
  const failure = new Error('recorder failed')
  const off = attachTurnBudget(h.ctx, h.agent, { maxSteps: 8, maxToolCalls: 0, maxTokens: 0 }, { resolveTask: () => task, recordBlocked: () => { throw failure } })
  assert.throws(() => h.guard({ name: 'retrieve_anecdotes', agent: h.agent }), failure)
  await assert.rejects(() => h.preStep({ agent: h.agent, step: 1, turn: 1 }, () => ({ kind: 'continue' })), failure)
  off()
})
