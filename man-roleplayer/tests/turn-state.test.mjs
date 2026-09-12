import test from 'node:test'
import assert from 'node:assert/strict'
import { ActorTurnStateRegistry, openTurnId } from '../lib/turn-state.js'
test('turn registry isolates grants and failure counters by session turn', () => {
  const r = new ActorTurnStateRegistry(); const session = {}; const a = r.state(session, 'alpha', 't1'); a.failures = 2
  const b = r.state(session, 'alpha', 't2'); assert.notEqual(a, b); assert.equal(b.failures, 0); assert.equal(b.ledger.hasCurrentGrant('x'), false)
  assert.equal(r.state(session, 'alpha', 't1'), a)
})
test('open turn follows turn number and closes on turn/end', () => {
  const session = { events: [{ type: 'turn/start', data: { turn: 1 } }, { type: 'turn/end', data: { turn: 1 } }, { type: 'turn/start', data: { turn: 2 } }] }
  assert.equal(openTurnId(session), '2'); session.events.push({ type: 'turn/end', data: { turn: 2 } }); assert.equal(openTurnId(session), undefined)
})
test('next-turn retrieval policy is consumed at tool execution boundary', () => {
  const r = new ActorTurnStateRegistry(); const session = { events: [{ type: 'turn/start', data: { turn: 1 } }] }
  r.setNextTurnRetrievalPolicy(session, 'deny')
  assert.equal(r.stateForExecution({ agent: { session } }, 'alpha').retrievalPolicy, 'deny')
})
test('next-turn policy is atomically bound and deduplicates closed controls', () => {
  const r = new ActorTurnStateRegistry(); const session = { events: [{ type: 'turn/start', data: { turn: 1 } }] }
  r.setNextTurnPolicy(session, { retrievalPolicy: 'deny', maxQuestions: 0, allowedControls: ['end', 'end'] })
  const state = r.stateForExecution({ agent: { session } }, 'alpha')
  assert.equal(state.retrievalPolicy, 'deny'); assert.equal(state.maxQuestions, 0); assert.deepEqual(state.allowedControls, ['end'])
})
test('turn policy does not leak across turns and an omitted question limit remains uncapped', () => {
  const r = new ActorTurnStateRegistry(); const session = { events: [{ type: 'turn/start', data: { turn: 1 } }] }
  r.setNextTurnPolicy(session, { retrievalPolicy: 'deny', maxQuestions: 0, allowedControls: [] })
  const first = r.stateForExecution({ agent: { session } }, 'alpha'); assert.equal(first.maxQuestions, 0)
  session.events.push({ type: 'turn/end', data: { turn: 1 } }, { type: 'turn/start', data: { turn: 2 } })
  const second = r.stateForExecution({ agent: { session } }, 'alpha'); assert.equal(second.maxQuestions, undefined); assert.equal(second.policyConfigured, false)
  r.setNextTurnRetrievalPolicy(session, 'deny'); assert.equal(r.stateForExecution({ agent: { session } }, 'alpha').retrievalPolicy, 'deny')
})
