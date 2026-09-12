const registry = makePersonaRegistry(mkdtempSync(join(tmpdir(), 'shared-personas-')))
import { makePersonaRegistry } from './persona-fixture.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConversationAggregate } from '../lib/aggregate.js'
import { deliverCurrentUserMessage } from '../lib/message-delivery.js'

function setup() {
  const aggregate = ConversationAggregate.create('delivery-test', mkdtempSync(join(tmpdir(), 'delivery-')), 'alpha', registry)
  const events = []
  const session = {
    append(type, data) { events.push({ type, data }) },
  }
  aggregate.indexBranch('alpha', 'session-alpha')
  return { aggregate, session, events }
}

test('accepted → branch append/flush → committed，且提交前 generation gate 为 false', async () => {
  const { aggregate, session, events } = setup()
  const statuses = []
  const result = await deliverCurrentUserMessage({
    trunk: aggregate.trunk, persona: 'alpha', session, sessionId: 'session-alpha', messageId: 'm-1', text: '原话',
    flush: async () => { statuses.push({ flush: true, committed: aggregate.trunk.state.deliveryCommitted.length }) },
    onStatus: snapshot => statuses.push(snapshot),
  })
  assert.equal(result.status, 'committed')
  assert.equal(result.canStartGeneration, true)
  assert.equal(aggregate.trunk.state.deliveryCommitted.length, 1)
  assert.equal(events[0].type, 'user/message')
  assert.equal(events[0].data.content[0].text, '原话')
  assert.deepEqual(events[0].data.source, { kind: 'user' })
  assert.deepEqual(events[0].data.extra, {
    man_roles_branch_delivery: { conversation_id: 'delivery-test', message_id: 'm-1', raw_ref: 'raw-delivery-test-0', persona_id: 'alpha' },
  })
  assert.equal(statuses.find(s => s.status === 'saved-delivering').canStartGeneration, false)
  assert.equal(statuses.find(s => s.flush)?.committed, 0)
})

test('flush 失败保留 accepted/pending，不写 committed，且不触发 generation', async () => {
  const { aggregate, session } = setup()
  const statuses = []
  const result = await deliverCurrentUserMessage({
    trunk: aggregate.trunk, persona: 'alpha', session, sessionId: 'session-alpha', messageId: 'm-2', text: '保留',
    flush: async () => { throw new Error('flush failed') }, onStatus: snapshot => statuses.push(snapshot),
  })
  assert.equal(result.status, 'failed')
  assert.equal(result.canStartGeneration, false)
  assert.equal(aggregate.trunk.state.userRaws.length, 1)
  assert.equal(aggregate.trunk.state.deliveryCommitted.length, 0)
  assert.equal(statuses.at(-1).status, 'failed')
  assert.equal(statuses.some(s => s.canStartGeneration), false)
})

test('append 同步失败保留 accepted，不调用 flush、不写 committed、不可生成', async () => {
  const { aggregate } = setup()
  let flushCalls = 0
  const statuses = []
  const result = await deliverCurrentUserMessage({
    trunk: aggregate.trunk, persona: 'alpha', session: { append() { throw new Error('append failed') } },
    sessionId: 'session-alpha', messageId: 'm-append-fail', text: '保留原话',
    flush: () => { flushCalls += 1 }, onStatus: snapshot => statuses.push(snapshot),
  })
  assert.equal(result.status, 'failed')
  assert.equal(result.canStartGeneration, false)
  assert.equal(flushCalls, 0)
  assert.equal(aggregate.trunk.state.userRaws.length, 1)
  assert.equal(aggregate.trunk.state.deliveryCommitted.length, 0)
  assert.equal(statuses.at(-1).status, 'failed')
})

test('来源字段不完整时在 branch append 前失败，不写 committed', async () => {
  const { aggregate, session, events } = setup()
  const original = aggregate.trunk.state.conversationId
  aggregate.trunk.state.conversationId = ''
  await assert.rejects(() => deliverCurrentUserMessage({
    trunk: aggregate.trunk, persona: 'alpha', session, sessionId: 'session-alpha', messageId: 'm-3', text: 'x', flush: () => {},
  }))
  aggregate.trunk.state.conversationId = original
  assert.equal(events.length, 0)
  assert.equal(aggregate.trunk.state.deliveryCommitted.length, 0)
})

test('三人物各自只写入目标 session', async () => {
  const { aggregate } = setup()
  aggregate.indexBranch('beta', 'session-zeng')
  aggregate.indexBranch('gamma', 'session-gamma')
  const alpha = []; const beta = []; const gamma = []
  await deliverCurrentUserMessage({ trunk: aggregate.trunk, persona: 'alpha', session: { append: (_, d) => alpha.push(d) }, sessionId: 'session-alpha', messageId: 'm-4', text: '同一原话', flush: () => {} })
  aggregate.switchPersona('beta')
  await deliverCurrentUserMessage({ trunk: aggregate.trunk, persona: 'beta', session: { append: (_, d) => beta.push(d) }, sessionId: 'session-zeng', messageId: 'm-5', text: '同一原话', flush: () => {} })
  aggregate.switchPersona('gamma')
  await deliverCurrentUserMessage({ trunk: aggregate.trunk, persona: 'gamma', session: { append: (_, d) => gamma.push(d) }, sessionId: 'session-gamma', messageId: 'm-6', text: '同一原话', flush: () => {} })
  assert.equal(alpha.length, 1); assert.equal(beta.length, 1); assert.equal(gamma.length, 1)
  assert.equal(alpha[0].source.kind, 'user'); assert.equal(beta[0].source.kind, 'user'); assert.equal(gamma[0].source.kind, 'user')
  assert.equal(alpha[0].extra.man_roles_branch_delivery.persona_id, 'alpha')
  assert.equal(beta[0].extra.man_roles_branch_delivery.persona_id, 'beta')
  assert.equal(gamma[0].extra.man_roles_branch_delivery.persona_id, 'gamma')
})
