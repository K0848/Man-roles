import test from 'node:test'
import assert from 'node:assert/strict'
import { buildContentLibraries, QUOTES } from '../lib/retrieval.js'
import { EvidenceLedger } from '../lib/evidence-ledger.js'
import { submitActorReply, submitWithOneRepair } from '../lib/submit-actor-reply.js'
import { validateSubmitArgs, validateSubmitArgsDetailed } from '../lib/actor-tool-contract.js'
import { missingEvidenceDetails } from '../lib/actor-tool-contract.js'
const libs = buildContentLibraries(); const q = QUOTES.find((x) => x.personaId === 'wang-yangming')
test('valid submit concludes once; failed repair never fabricates a system character reply', () => {
  let concludes = 0; const ledger = new EvidenceLedger('wang-yangming', 't1'); ledger.grant({ evidenceId: q.id, kind: 'quote', personaId: 'wang-yangming', turnId: 't1' })
  const ok = submitActorReply({ segments: [{ kind: 'verbatim_quote', text: q.text, evidenceIds: [q.id] }] }, { ledger, libs, personaId: 'wang-yangming', concludeTurn: () => concludes++ })
  assert.equal(ok.ok, true); assert.equal(concludes, 1); assert.match(ok.reply, /出处/)
  const fallback = submitWithOneRepair({ segments: [{ kind: 'historical_fact', text: '伪造', evidenceIds: ['bad'] }] }, () => ({ segments: [{ kind: 'historical_fact', text: '仍伪造', evidenceIds: ['bad'] }] }), { ledger: new EvidenceLedger('wang-yangming', 't2'), libs, personaId: 'wang-yangming', concludeTurn: () => concludes++ })
  assert.equal(fallback.ok, false); assert.equal(fallback.fallback, true); assert.equal(fallback.reply, undefined); assert.equal(concludes, 2)
})
test('submit contract rejects free-form source fields', () => {
  assert.equal(validateSubmitArgs({ segments: [{ kind: 'dialogue', text: '回答', source: '《伪书》' }] }), false)
})
test('fabricated quote text is never public; canonical library text is rendered', () => {
  assert.ok(q)
  const ledger = new EvidenceLedger('wang-yangming', 't5')
  ledger.grant({ evidenceId: q.id, kind: 'quote', personaId: 'wang-yangming', turnId: 't5' })
  const result = submitActorReply({ segments: [{ kind: 'verbatim_quote', text: `这句并非原文〔${q.source}〕`, evidenceIds: [q.id] }] }, { ledger, libs, personaId: 'wang-yangming' })
  assert.equal(result.ok, true)
  assert.match(result.reply, new RegExp(q.text.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&')))
  assert.doesNotMatch(result.reply, /这句并非原文/)
})
const dialogue = (extra={}) => ({segments:[{kind:'dialogue',text:'回答'}],...extra})
test('submit accepts zero questions',()=>assert.equal(validateSubmitArgs(dialogue({questions:[]})),true))
test('submit success preserves trimmed questions intent and controls',()=>{const ledger=new EvidenceLedger('wang-yangming','meta'); const r=submitActorReply(dialogue({turnIntent:'clarify',questions:['  一问  ','二问 '],offeredControls:['continue','end']}),{ledger,libs,personaId:'wang-yangming'}); assert.equal(r.ok,true); assert.deepEqual(r.questions,['一问','二问']); assert.equal(r.turnIntent,'clarify'); assert.deepEqual(r.controls,['continue','end'])})
test('submit accepts one or two trimmed questions',()=>assert.equal(validateSubmitArgs(dialogue({questions:['  一问  ','二问']})),true))
test('three distinct questions are accepted without a numeric hard maximum',()=>assert.equal(validateSubmitArgsDetailed(dialogue({questions:['1','2','3']})).ok,true))
test('empty/nonstring question has stable invalid_questions code',()=>assert.equal(validateSubmitArgsDetailed(dialogue({questions:[' ']})).code,'invalid_questions'))
test('invalid intent and controls have distinct codes',()=>{assert.equal(validateSubmitArgsDetailed(dialogue({turnIntent:'bad'})).code,'invalid_intent');assert.equal(validateSubmitArgsDetailed(dialogue({offeredControls:['end','end']})).code,'invalid_controls')})
test('extra source is rejected by closed schema',()=>assert.equal(validateSubmitArgs(dialogue({source:'x'})),false))
test('question marks do not determine question count',()=>assert.equal(validateSubmitArgs(dialogue({questions:['一句没有问号']})),true))
const duplicateQuestions = ['重复问题', '重复问题']
test('undefined repair safely concludes exactly once',()=>{let n=0;const r=submitWithOneRepair(dialogue({questions:duplicateQuestions}),()=>undefined,{ledger:new EvidenceLedger('wang-yangming','tu'),libs,personaId:'wang-yangming',concludeTurn:()=>n++});assert.equal(r.fallback,true);assert.equal(r.concluded,true);assert.equal(n,1)})
test('repair success concludes once and marks repaired',()=>{let n=0;const r=submitWithOneRepair(dialogue({questions:duplicateQuestions}),()=>dialogue({questions:[' fixed ']}),{ledger:new EvidenceLedger('wang-yangming','tr'),libs,personaId:'wang-yangming',concludeTurn:()=>n++});assert.equal(r.ok,true);assert.equal(r.repaired,true);assert.equal(n,1);assert.match(r.reply,/fixed/)})
test('second invalid repair falls back and concludes once',()=>{let n=0;const r=submitWithOneRepair(dialogue({questions:duplicateQuestions}),()=>dialogue({questions:duplicateQuestions}),{ledger:new EvidenceLedger('wang-yangming','tf'),libs,personaId:'wang-yangming',concludeTurn:()=>n++});assert.equal(r.fallback,true);assert.equal(n,1)})
test('missing evidence detail names segments and offers bounded repairs without answer text', () => {
  const detail = missingEvidenceDetails({ segments: [{ kind: 'historical_fact', text: 'secret answer' }, { kind: 'dialogue', text: 'ok' }] })
  assert.match(detail, /segments\[0\]\(historical_fact\)/); assert.match(detail, /真实 evidence ID/); assert.match(detail, /不得原样重放/); assert.doesNotMatch(detail, /secret answer/)
})
