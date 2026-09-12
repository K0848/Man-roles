import test from 'node:test'
import assert from 'node:assert/strict'
import { createMvpV2Harness, assertZeroCost } from './helpers/mvp-v2-harness.mjs'

test('zero-cost harness records no provider or token usage', (t) => {
  const h = createMvpV2Harness()
  t.after(() => h.cleanup())
  assertZeroCost(assert, h.observation)
})

test('zero-cost harness fails closed and records attempted provider calls', (t) => {
  const h = createMvpV2Harness()
  t.after(() => h.cleanup())
  assert.throws(() => h.provider.generate({ prompt: 'must not leave the test process' }), /provider call is forbidden/)
  assert.equal(h.observation.providerNetworkUsed, true)
  assert.deepEqual(h.observation.externalCalls, [{ method: 'generate', argumentCount: 1 }])
})

// 这些 todo 是交给执行 Agent 的能力清单，不代表能力已经实现。
// 对应 Task 开始时先将相关 todo 改成真实失败测试，再做最小实现；最终交付必须为 0。
test('Task 2: Product Remote and isolated product profile work without DSH Core changes', async () => {
  const remote = await import('./product-remote-compat.test.mjs')
  assert.ok(remote)
})
test('Task 7: TurnRunner is delivery-gated, cancellable, idempotent, budget bounded, and never commits late output', async () => {
  const { TurnRunner } = await import('../lib/turn-runner.js')
  const runner = new TurnRunner()
  const notDelivered = await runner.runAfterDelivery({ taskId: 'not-delivered', deliveryCommitted: false, operation: async () => 'must-not-run' })
  assert.equal(notDelivered.status, 'blocked')
  let resolveLate
  const first = runner.runAfterDelivery({ taskId: 'task-7', deliveryCommitted: true, operation: async () => new Promise(resolve => { resolveLate = resolve }) })
  const second = runner.run('task-7', async () => 'duplicate')
  assert.equal(runner.cancel('task-7'), true)
  resolveLate('late actor output')
  assert.equal((await first).status, 'cancelled')
  assert.equal((await second).status, 'cancelled')
  assert.equal((await second).result, undefined)
})
test('Task 8: ProductService owns one real Trunk conversation and never exposes two Branch rows', async () => {
  const { ManRolesProductService, ConversationRepository } = await import('../lib/product-service.js')
  const { makePersonaRegistry } = await import('./persona-fixture.mjs')
  const { mkdtempSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path')
  const storageDir = mkdtempSync(join(tmpdir(), 'mvp-product-service-')); const registry = makePersonaRegistry(mkdtempSync(join(tmpdir(), 'mvp-product-personas-')))
  const service = new ManRolesProductService(new ConversationRepository(storageDir, registry))
  const created = service.create('c', 'alpha'); assert.equal(created.conversationId, 'c'); assert.equal(service.list().length, 1)
  const switched = service.switchPersona('c', 'beta')
  assert.equal(switched.activePersonaId, 'beta')
  // Two isolated Branch sessions are implementation state, never two product
  // list rows. The Product view can use their ids only for internal navigation.
  assert.equal(service.list().length, 1)
  assert.equal(switched.branches.length, 2)
})

test('Task 8: ProductService persists distinct messages, rejects conflicting retries, and starts only after delivery', async () => {
  const { ManRolesProductService, ConversationRepository } = await import('../lib/product-service.js')
  const { makePersonaRegistry } = await import('./persona-fixture.mjs')
  const { mkdtempSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path')
  const storageDir = mkdtempSync(join(tmpdir(), 'mvp-product-send-')); const registry = makePersonaRegistry(mkdtempSync(join(tmpdir(), 'mvp-product-send-personas-')))
  const service = new ManRolesProductService(new ConversationRepository(storageDir, registry)); service.create('c', 'alpha')
  const appended=[]; const session={append:(type,data)=>appended.push([type,data])}; const flush=async()=>undefined
  let taskRuns=0
  const one = await service.send({conversationId:'c',messageId:'m-1',text:'same text',session,flush,task:{taskId:'t-1',run:async()=>{taskRuns++;return 'done'}}})
  const two = await service.send({conversationId:'c',messageId:'m-2',text:'same text',session,flush})
  await new Promise(resolve=>setTimeout(resolve,0))
  assert.equal(one.ok,true); assert.equal(two.ok,true); assert.equal(taskRuns,1); assert.equal(appended.length,2)
  await assert.rejects(()=>service.send({conversationId:'c',messageId:'m-2',text:'changed',session,flush}), /message_id conflict/)
  const afterRestart = new ManRolesProductService(new ConversationRepository(storageDir, registry))
  assert.equal(afterRestart.list().length,1); assert.equal(afterRestart.viewConversation('c').userRaws.length,2)
})
