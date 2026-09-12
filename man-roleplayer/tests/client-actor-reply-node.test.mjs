import test from 'node:test'
import assert from 'node:assert/strict'
import { actorReplyConversationNodeDefinition } from '../lib/actor-reply-definition.js'

test('client node materializes only verified actor-reply meta as one visible node', () => {
  const meta = { kind: 'actor-reply', reply: '{"reply":"literal text"}', evidence: [{ id: 'q', kind: 'quote', source: '库内' }] }
  const call = { type: 'tool/call', seq: 7, data: { turn: 1, step: 2, callId: 'call-1', name: 'submit_actor_reply', arguments: '{}' } }
  const result = { type: 'tool/result', seq: 8, surfaceOp: 'append', data: { turn: 1, step: 2, message: { source: { callId: 'call-1' }, content: [{ type: 'text', text: '{"ok":true}' }] }, meta } }
  const startMatch = actorReplyConversationNodeDefinition.match(call)
  const updateMatch = actorReplyConversationNodeDefinition.match(result)
  assert.deepEqual(startMatch, { id: 'call-1', role: 'start' })
  assert.deepEqual(updateMatch, { id: 'call-1', role: 'update' })
  const start = actorReplyConversationNodeDefinition.start({}, { ...startMatch, event: call, view: undefined })
  const pendingContext = { key: 'man-roles-actor-reply:call-1', kind: 'man-roles-actor-reply', id: 'call-1', matches: [], start: { event: call, location: { kind: 'unresolved' } }, state: start, current: new Map() }
  assert.equal(actorReplyConversationNodeDefinition.buildViewNode(pendingContext), null)
  const settled = actorReplyConversationNodeDefinition.update(pendingContext, { ...updateMatch, event: result, view: undefined })
  const node = actorReplyConversationNodeDefinition.buildViewNode({ ...pendingContext, state: settled })
  assert.equal(node.visibility, 'visible')
  assert.equal(node.kind, 'man-roles-actor-reply')
  assert.equal(node.data.reply, meta.reply)
  assert.equal(actorReplyConversationNodeDefinition.match({ ...result, data: { ...result.data, meta: { kind: 'other', reply: meta.reply, evidence: meta.evidence } } }), null)
  assert.equal(actorReplyConversationNodeDefinition.match({ ...call, data: { ...call.data, name: 'fetch_quote' } }), null)
})
