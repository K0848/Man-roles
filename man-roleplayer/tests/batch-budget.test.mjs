import test from 'node:test'
import assert from 'node:assert/strict'
import { BatchBudget, ScenarioAllocator, PHASE7_TASK9_SCENARIO_BUDGETS, estimateRequestReservation, usageTotal } from '../lib/batch-budget.js'

test('batch budget reserves conservative request estimate and blocks next request', () => {
  const budget = new BatchBudget(120)
  const request = { system: 'x'.repeat(40), messages: [], tools: [], maxTokens: 40 }
  assert.equal(estimateRequestReservation(request), 60)
  const first = budget.reserve(request); const second = budget.reserve(request); const third = budget.reserve(request)
  assert.equal(typeof first, 'number'); assert.equal(typeof second, 'number'); assert.equal(third, undefined)
  assert.equal(budget.estimatedReserved, 120)
})

test('batch budget adds all five observed usage fields and stops after observed overflow', () => {
  const budget = new BatchBudget(100)
  assert.equal(usageTotal({ inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 4, reasoningTokens: 6 }), 70)
  const pending = budget.reserve({ system: '', messages: [], maxTokens: 1 }); assert.equal(typeof pending, 'number')
  assert.equal(budget.observe(pending, { inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 4, reasoningTokens: 6 }), true)
  const overflow = budget.reserve({ system: '', messages: [], maxTokens: 1 }); assert.equal(typeof overflow, 'number')
  assert.equal(budget.observe(overflow, { inputTokens: 11, outputTokens: 10, cacheReadTokens: 10 }), false)
  assert.equal(budget.exceeded, true)
  assert.equal(budget.reserve({ system: '', messages: [], maxTokens: 1 }), undefined)
})

test('batch budget settles two pending reservations one-to-one and rejects double/unknown observe', () => {
  const budget = new BatchBudget(500)
  const first = budget.reserve({ system: 'a', messages: [], maxTokens: 10 })
  const second = budget.reserve({ system: 'b', messages: [], maxTokens: 10 })
  assert.equal(typeof first, 'number'); assert.equal(typeof second, 'number')
  assert.equal(budget.observe(first, { inputTokens: 10, outputTokens: 1 }), true)
  assert.equal(budget.estimatedReserved > 0, true)
  assert.equal(budget.observe(second, { inputTokens: 20, outputTokens: 2 }), true)
  assert.equal(budget.estimatedReserved, 0)
  assert.equal(budget.observedTokens, 33)
  assert.throws(() => budget.observe(first, { inputTokens: 1, outputTokens: 1 }), /unknown or already-settled/)
  assert.throws(() => budget.observe(999, { inputTokens: 1, outputTokens: 1 }), /unknown or already-settled/)
})
test('Task9 explicit allocator protects later scenarios after noisy knowledge', () => {
  const allocator = new ScenarioAllocator(PHASE7_TASK9_SCENARIO_BUDGETS)
  allocator.observe('knowledge', 6500)
  assert.equal(allocator.canStart('knowledge', 600), false); allocator.markBlocked('knowledge')
  for (const name of ['dilemma', 'review', 'cross-person']) { assert.equal(allocator.canStart(name, 100), true); allocator.observe(name, 100) }
  assert.equal(allocator.observedFor('knowledge'), 6500); assert.equal(allocator.isBlocked('knowledge'), true); assert.ok(allocator.observed <= 20000)
})
test('Task9 revised knowledge budget admits repair and preserves later starts', () => {
  const allocator = new ScenarioAllocator(PHASE7_TASK9_SCENARIO_BUDGETS)
  allocator.observe('knowledge', 3780)
  assert.equal(allocator.canStart('knowledge', 3000, true), true); allocator.consumeRepairReserve('knowledge')
  allocator.observe('knowledge', 2904)
  assert.equal(allocator.observedFor('knowledge'), 6684)
  assert.equal(allocator.canStart('knowledge', 400), false)
  for (const [name, reservation] of [['dilemma', 1800], ['review', 1500], ['cross-person', 1800]]) assert.equal(allocator.canStart(name, reservation), true)
  assert.ok(allocator.observed <= 20000)
})
test('Task9 allocator rejects invalid explicit plans', () => {
  assert.throws(() => new ScenarioAllocator([{ name: 'knowledge', allocated: -1, minimumStart: 0 }]), /invalid/)
  assert.throws(() => new ScenarioAllocator([{ name: 'knowledge', allocated: 1, minimumStart: 2 }]), /invalid/)
  assert.throws(() => new ScenarioAllocator([{ name: 'knowledge', allocated: 1, minimumStart: 0 }, { name: 'knowledge', allocated: 1, minimumStart: 0 }]), /invalid/)
  assert.throws(() => new ScenarioAllocator([{ name: 'knowledge', allocated: 100, minimumStart: 0 }], 50), /exceeds/)
})
test('Task9 review reservation admits one repair after 1611 observed', () => {
  const allocator = new ScenarioAllocator(PHASE7_TASK9_SCENARIO_BUDGETS)
  allocator.observe('review', 1611); assert.equal(allocator.canStart('review', 2200, true), true); allocator.consumeRepairReserve('review'); allocator.observe('review', 2200)
  assert.equal(allocator.observedFor('review'), 3811); assert.ok(allocator.observed <= 4500)
  assert.equal(allocator.canStart('cross-person', 1800), true)
})
test('Task9 cross-person reservation admits one policy repair after 1443 observed', () => {
  const allocator = new ScenarioAllocator(PHASE7_TASK9_SCENARIO_BUDGETS)
  allocator.observe('cross-person', 1443); assert.equal(allocator.canStart('cross-person', 1800, true), true); allocator.consumeRepairReserve('cross-person'); allocator.observe('cross-person', 1800)
  assert.equal(allocator.observedFor('cross-person'), 3243); assert.ok(allocator.observed <= 3500)
})
test('Task9 dilemma third-batch path preserves and then consumes one repair reserve', () => {
  const allocator = new ScenarioAllocator(PHASE7_TASK9_SCENARIO_BUDGETS)
  assert.equal(allocator.admission('dilemma', 2000).repairReserve, 1800)
  allocator.observe('dilemma', 2168)
  assert.equal(allocator.canStart('dilemma', 2600), false)
  const repair = allocator.admission('dilemma', 2600, true); assert.equal(repair.allowed, true); assert.equal(repair.repairReserve, 0)
  allocator.consumeRepairReserve('dilemma'); allocator.observe('dilemma', 2600)
  assert.equal(allocator.observedFor('dilemma'), 4768)
  let providerCalls = 0; const blocked = allocator.admission('dilemma', 300); if (blocked.allowed) providerCalls++
  assert.equal(blocked.allowed, false); assert.equal(providerCalls, 0)
})
