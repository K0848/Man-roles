const registry = makePersonaRegistry(mkdtempSync(join(tmpdir(), 'shared-personas-')))
import { makePersonaRegistry } from './persona-fixture.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ConversationAggregate } from '../lib/aggregate.js'
import { recoverPendingDeliveries, compensateDerivedState, runRecoveryStartup } from '../lib/recovery.js'
import { deliverCurrentUserMessage } from '../lib/message-delivery.js'

function setup() {
  const aggregate = ConversationAggregate.create(`recovery-${Math.random()}`, mkdtempSync(join(tmpdir(), 'recovery-')), 'alpha', registry)
  aggregate.indexBranch('alpha', 'alpha'); aggregate.indexBranch('beta', 'beta')
  return aggregate
}

test('accepted target persona survives JSON stringify, structuredClone, and load', async () => {
  const aggregate = setup(); aggregate.trunk.addUserRaw('target-1', '原话', 'beta')
  assert.equal(JSON.parse(JSON.stringify(aggregate.trunk.state.userRaws))[0].targetPersonaId, 'beta')
  assert.equal(structuredClone(aggregate.trunk.state).userRaws[0].targetPersonaId, 'beta')
  const { TrunkStorage } = await import('../lib/storage.js')
  const loaded = TrunkStorage.load(aggregate.conversationId, aggregate.trunk.storageDir, registry)
  assert.equal(loaded.state.userRaws[0].targetPersonaId, 'beta')
})

test('delivery persona/session mismatch is rejected before acceptance', async () => {
  const aggregate = setup(); const { deliverCurrentUserMessage } = await import('../lib/message-delivery.js')
  const result = await deliverCurrentUserMessage({ trunk: aggregate.trunk, persona: 'beta', sessionId: 'alpha', session: { append() { throw Error('must not append') } }, messageId: 'bad-target', text: '不得接受', flush: () => {} })
  assert.equal(result.status, 'failed'); assert.equal(aggregate.trunk.state.userRaws.length, 0); assert.equal(result.error.code, 'branch_target_mismatch')
})

test('crash after accepted before branch append: one recovery pass delivers and commits', async () => {
  const aggregate = setup(); aggregate.trunk.addUserRaw('m1', '原话', 'alpha'); const events = []
  const result = await recoverPendingDeliveries({ trunk: aggregate.trunk, branches: { 'alpha': { sessionId: 'alpha', restoredEvents: [], append: (t, d) => events.push({ t, d }), flush: async () => {} } } })
  assert.equal(result[0].status, 'recovered'); assert.equal(events.length, 1); assert.equal(aggregate.trunk.state.deliveryCommitted.length, 1)
})

test('crash after branch append before committed: existing raw_ref only repairs committed', async () => {
  const aggregate = setup(); aggregate.trunk.addUserRaw('m2', '原话', 'alpha'); const events = [{ type: 'user/message', data: { source: { kind: 'plugin', plugin: 'man-roles-roleplayer', conversation_id: aggregate.conversationId, message_id: 'm2', raw_ref: 'raw-' + aggregate.conversationId + '-0', persona_id: 'alpha' } } }]
  const result = await recoverPendingDeliveries({ trunk: aggregate.trunk, branches: { 'alpha': { sessionId: 'alpha', restoredEvents: events, append: () => { throw Error('must not append') } } } })
  assert.equal(result[0].status, 'recovered'); assert.equal(aggregate.trunk.state.deliveryCommitted.length, 1)
})

test('legacy pending has stable failure and is never delivered', async () => {
  const aggregate = setup(); aggregate.trunk.append('trunk/user-raw-added', { ref: 0, text: '旧原话' }); let calls = 0
  const result = await recoverPendingDeliveries({ trunk: aggregate.trunk, branches: { 'alpha': { sessionId: 'alpha', restoredEvents: [], append: () => { calls++ } } } })
  assert.equal(result[0].failureCode, 'legacy_target_missing'); assert.equal(calls, 0)
})

test('failed recovery remains pending and a pass is bounded', async () => {
  const aggregate = setup(); aggregate.trunk.addUserRaw('m3', '原话', 'alpha'); let calls = 0
  const result = await recoverPendingDeliveries({ trunk: aggregate.trunk, branches: { 'alpha': { sessionId: 'alpha', findUserMessageByRawRef: () => false, append: () => { calls++; throw Error('down') }, flush: async () => {} } } })
  assert.equal(result[0].failureCode, 'branch_write_failed'); assert.equal(calls, 1); assert.equal(aggregate.trunk.state.deliveryCommitted.length, 0)
})

test('recovery uses target persona, never active persona, and keeps branches isolated', async () => {
  const aggregate = setup(); aggregate.trunk.addUserRaw('m4', '只给beta', 'beta'); const alpha = []; const beta = []
  await recoverPendingDeliveries({ trunk: aggregate.trunk, branches: { 'alpha': { sessionId: 'alpha', restoredEvents: [], append: (_, d) => alpha.push(d), flush: async () => {} }, 'beta': { sessionId: 'beta', restoredEvents: [], append: (_, d) => beta.push(d), flush: async () => {} } } })
  assert.equal(alpha.length, 0); assert.equal(beta.length, 1); assert.equal(beta[0].source.kind, 'user'); assert.equal(beta[0].extra.man_roles_branch_delivery.persona_id, 'beta')
})

test('answer exists/state missing compensates by callback only, never generation', async () => {
  let callback
  const result = await compensateDerivedState({ taskId: 'task-1', messageId: 'm5', answerExists: () => true, stateExists: () => false, compensate: key => { callback = key } })
  assert.equal(result.status, 'compensated'); assert.deepEqual(callback, { taskId: 'task-1', messageId: 'm5' })
})

test('missing flush fails closed without append or committed', async () => {
  const aggregate = setup(); aggregate.trunk.addUserRaw('no-flush', '原话', 'alpha'); let appends = 0
  const [result] = await recoverPendingDeliveries({ trunk: aggregate.trunk, branches: { 'alpha': { sessionId: 'alpha', append: () => { appends++ } } } })
  assert.equal(result.failureCode, 'flush_missing'); assert.equal(appends, 0); assert.equal(aggregate.trunk.state.deliveryCommitted.length, 0)
})

test('failed flush cannot be promoted from live events on a later pass', async () => {
  const aggregate = setup(); aggregate.trunk.addUserRaw('flush-retry', '原话', 'alpha'); const live = []; let flushCalls = 0
  const branch = { sessionId: 'alpha', events: live, restoredEvents: [], append: (type, data) => live.push({ type, data }), flush: async () => { flushCalls++; throw Error('down') } }
  const first = await recoverPendingDeliveries({ trunk: aggregate.trunk, branches: { 'alpha': branch } }); assert.equal(first[0].failureCode, 'flush_failed')
  const second = await recoverPendingDeliveries({ trunk: aggregate.trunk, branches: { 'alpha': { ...branch, flush: async () => { throw Error('still down') } } } }); assert.equal(second[0].failureCode, 'flush_failed'); assert.equal(aggregate.trunk.state.deliveryCommitted.length, 0); assert.equal(flushCalls, 1)
})

test('query failure is isolated and later pending raw continues', async () => {
  const aggregate = setup(); aggregate.trunk.addUserRaw('query-bad', '一', 'alpha'); aggregate.trunk.addUserRaw('query-good', '二', 'alpha'); const delivered = []; let queries = 0
  const result = await recoverPendingDeliveries({ trunk: aggregate.trunk, branches: { 'alpha': { sessionId: 'alpha', findUserMessageByRawRef: () => { if (++queries === 1) throw Error('query'); return false }, append: (_, data) => delivered.push(data), flush: async () => {} } } })
  assert.equal(result[0].failureCode, 'query_failed'); assert.equal(result[1].status, 'recovered'); assert.equal(delivered.length, 1); assert.equal(aggregate.trunk.state.deliveryCommitted.length, 1)
})

test('commit failure is classified separately', async () => {
  const aggregate = setup(); aggregate.trunk.addUserRaw('commit-bad', '原话', 'alpha'); const original = aggregate.trunk.commitBranchDelivery.bind(aggregate.trunk); aggregate.trunk.commitBranchDelivery = () => { throw Error('commit') }
  const [result] = await recoverPendingDeliveries({ trunk: aggregate.trunk, branches: { 'alpha': { sessionId: 'alpha', findUserMessageByRawRef: () => false, append: () => {}, flush: async () => {} } } })
  aggregate.trunk.commitBranchDelivery = original; assert.equal(result.failureCode, 'commit_failed')
})

test('same-ID retry after commit failure queries durable Branch before append', async () => {
  const aggregate = setup(); const projected = []; let commits = 0
  const session = { append: (_, data) => projected.push(data), flush: async () => {} }
  const original = aggregate.trunk.commitBranchDelivery.bind(aggregate.trunk); aggregate.trunk.commitBranchDelivery = data => { commits++; if (commits === 1) throw Error('commit') ; return original(data) }
  const input = { trunk: aggregate.trunk, persona: 'alpha', sessionId: 'alpha', session, messageId: 'same', text: '原话', flush: session.flush, findUserMessageByRawRef: raw => projected.some(item => item.extra.man_roles_branch_delivery.raw_ref === raw) }
  assert.equal((await deliverCurrentUserMessage(input)).status, 'failed'); assert.equal((await deliverCurrentUserMessage(input)).status, 'committed'); assert.equal(projected.length, 1)
  aggregate.trunk.commitBranchDelivery = original; assert.equal(aggregate.trunk.state.deliveryCommitted.length, 1)
})

test('same message ID with different target is rejected without trunk or Branch mutation', async () => {
  const aggregate = setup(); const alpha = []; const beta = []
  await deliverCurrentUserMessage({ trunk: aggregate.trunk, persona: 'alpha', session: { append: (_, data) => alpha.push(data) }, sessionId: 'alpha', messageId: 'target-conflict', text: '原话', flush: async () => {} })
  aggregate.switchPersona('beta')
  const before = readFileSync(aggregate.trunk.filePath, 'utf8')
  await assert.rejects(() => deliverCurrentUserMessage({ trunk: aggregate.trunk, persona: 'beta', session: { append: (_, data) => beta.push(data) }, sessionId: 'beta', messageId: 'target-conflict', text: '原话', flush: async () => {}, findUserMessageByRawRef: () => false }), error => error.code === 'message_id_conflict')
  assert.equal(beta.length, 0); assert.equal(readFileSync(aggregate.trunk.filePath, 'utf8'), before); assert.equal(alpha.length, 1)
})

test('startup coordinator invokes concrete recovery and compensation exactly once', async () => {
  const aggregate = setup(); aggregate.trunk.addUserRaw('startup', '原话', 'alpha'); let compensationCalls = 0
  const result = await runRecoveryStartup({ delivery: { trunk: aggregate.trunk, branches: { 'alpha': { sessionId: 'alpha', findUserMessageByRawRef: () => false, append: () => {}, flush: async () => {} } } }, compensation: { taskId: 't', messageId: 'm', answerExists: () => true, stateExists: () => false, compensate: () => { compensationCalls++ } } })
  assert.equal(result.deliveries[0].status, 'recovered'); assert.equal(result.compensation.status, 'compensated'); assert.equal(compensationCalls, 1)
})
