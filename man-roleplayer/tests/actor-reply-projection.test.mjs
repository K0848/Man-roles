import test from 'node:test'
import assert from 'node:assert/strict'
import { projectActorReply } from '../lib/actor-reply-projection.js'
import { branchHistory, verifiedReplyForMessage } from '../lib/branch-history.js'
const meta = { kind: 'actor-reply', reply: '门控回答', evidence: [{ id: 'q1', kind: 'quote', source: '库内' }] }
test('projection roundtrips questions without a product count gate',()=>{const rich={...meta,turnIntent:'clarify',questions:['一问','二问','三问'],controls:['continue','end']}; const events=[{type:'turn/start',data:{turn:1}},{type:'tool/call',data:{name:'submit_actor_reply',callId:'r'}},{type:'tool/result',data:{message:{source:{callId:'r'}},meta:rich}}]; assert.deepEqual(projectActorReply(events,1),rich); assert.deepEqual(projectActorReply([...events.slice(0,2),{...events[2],data:{...events[2].data,meta:{...rich,questions:Array.from({length:17},(_,i)=>String(i))}}}],1).questions,Array.from({length:17},(_,i)=>String(i))); assert.equal(projectActorReply([...events.slice(0,2),{...events[2],data:{...events[2].data,meta:{...rich,questions:['valid',2]}}}],1),undefined); assert.equal(projectActorReply([...events.slice(0,2),{...events[2],data:{...events[2].data,meta:{...rich,controls:['invalid-control']}}}],1),undefined)})
test('projection ignores direct assistant and non-submit tool results', () => {
  assert.equal(projectActorReply([{ type: 'turn/start', data: { turn: 1 } }, { type: 'assistant/message', data: { text: '直接回答' } }, { type: 'tool/call', data: { name: 'fetch_quote', callId: 'x' } }, { type: 'tool/result', data: { message: { source: { callId: 'x' } }, meta } }], 1), undefined)
})
test('projection accepts submit meta only in its turn and rejects duplicate same-turn results', () => {
  const one = [{ type: 'turn/start', data: { turn: 1 } }, { type: 'tool/call', data: { name: 'submit_actor_reply', callId: 's1' } }, { type: 'tool/result', data: { message: { source: { callId: 's1' } }, meta } }]
  assert.deepEqual(projectActorReply(one, 1), meta); assert.equal(projectActorReply([...one, { type: 'tool/call', data: { name: 'submit_actor_reply', callId: 's2' } }, { type: 'tool/result', data: { message: { source: { callId: 's2' } }, meta } }], 1), undefined)
  assert.deepEqual(projectActorReply([...one, { type: 'turn/end', data: { turn: 1 } }, { type: 'turn/start', data: { turn: 2 } }, { type: 'tool/call', data: { name: 'submit_actor_reply', callId: 's3' } }, { type: 'tool/result', data: { message: { source: { callId: 's3' } }, meta } }], 1), meta)
})

test('history and recovery bind a user message to its enclosing turn in start→user order', () => {
  const meta = { kind: 'actor-reply', reply: '本轮人物回答', evidence: [] }
  const later = { kind: 'actor-reply', reply: '未来回合回答', evidence: [] }
  const events = [
    { type: 'turn/start', seq: 1, data: { turn: 1 } },
    { type: 'user/message', seq: 2, data: { id: 'm1', content: [{ type: 'text', text: '第一轮用户话' }], source: { kind: 'user' }, extra: { man_roles_branch_delivery: { message_id: 'm1', raw_ref: 'r1', conversation_id: 'c', persona_id: 'alpha' } } } },
    { type: 'tool/call', seq: 3, data: { turn: 1, name: 'submit_actor_reply', callId: 'c1' } },
    { type: 'tool/result', seq: 4, data: { turn: 1, message: { source: { callId: 'c1' } }, meta } },
    { type: 'turn/end', seq: 5, data: { turn: 1 } },
    { type: 'turn/start', seq: 6, data: { turn: 2 } },
    { type: 'user/message', seq: 7, data: { id: 'm2', content: [{ type: 'text', text: '第二轮用户话' }], source: { kind: 'user' }, extra: { man_roles_branch_delivery: { message_id: 'm2', raw_ref: 'r2', conversation_id: 'c', persona_id: 'alpha' } } } },
    { type: 'tool/call', seq: 8, data: { turn: 2, name: 'submit_actor_reply', callId: 'c2' } },
    { type: 'tool/result', seq: 9, data: { turn: 2, message: { source: { callId: 'c2' } }, meta: later } },
    { type: 'turn/end', seq: 10, data: { turn: 2 } },
  ]
  assert.deepEqual(verifiedReplyForMessage(events, 'm1'), meta)
  assert.deepEqual(branchHistory(events), ['第一轮用户话', '本轮人物回答', '第二轮用户话', '未来回合回答'])
})
