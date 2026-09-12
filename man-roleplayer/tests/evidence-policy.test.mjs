import test from 'node:test'
import assert from 'node:assert/strict'
import { buildContentLibraries, QUOTES, BLACKLIST_ENTRIES } from '../lib/retrieval.js'
import { EvidenceLedger } from '../lib/evidence-ledger.js'
import { validateActorReply } from '../lib/evidence-policy.js'
import { renderVerifiedReply } from '../lib/evidence-render.js'

const libs = buildContentLibraries(); const q = QUOTES.find((x) => x.personaId === 'wang-yangming')
test('dialogue and modern inference need no evidence; inference has marker', () => {
  const ledger = new EvidenceLedger('wang-yangming', 't1')
  assert.equal(validateActorReply([{ kind: 'dialogue', text: '先把事情说清楚。' }, { kind: 'modern_inference', text: '可以先做一个小实验。' }], ledger, libs, 'wang-yangming').ok, true)
  assert.match(renderVerifiedReply([{ kind: 'modern_inference', text: '可以先做一个小实验。' }], libs), /今译\/推演/)
})
test('thought attribution needs an explicitly granted current-person evidence id', () => {
  const ledger = new EvidenceLedger('wang-yangming', 't3')
  assert.equal(validateActorReply([{ kind: 'thought_attribution', text: '他认为应当先做后知。', evidenceIds: ['not-granted'] }], ledger, libs, 'wang-yangming').ok, false)
})
test('quote source is preserved in the verified reply', () => {
  assert.ok(q)
  const ledger = new EvidenceLedger('wang-yangming', 't4')
  ledger.grant({ evidenceId: q.id, kind: 'quote', personaId: 'wang-yangming', turnId: 't4' })
  const rendered = renderVerifiedReply([{ kind: 'verbatim_quote', text: q.text, evidenceIds: [q.id] }], libs)
  assert.ok(rendered.includes(q.source))
  assert.equal(q.credibility, '✅')
})
test('historical and quote segments require current grants; quote text is canonicalized', () => {
  assert.ok(q)
  const ledger = new EvidenceLedger('wang-yangming', 't1'); ledger.grant({ evidenceId: q.id, kind: 'quote', personaId: 'wang-yangming', turnId: 't1' })
  assert.equal(validateActorReply([{ kind: 'historical_fact', text: '他做过某事。' }], ledger, libs, 'wang-yangming').ok, false)
  assert.equal(validateActorReply([{ kind: 'verbatim_quote', text: q.text, evidenceIds: [q.id] }], ledger, libs, 'wang-yangming').ok, true)
  const canonical = validateActorReply([{ kind: 'verbatim_quote', text: '这是一句伪造的话。', evidenceIds: [q.id] }], ledger, libs, 'wang-yangming')
  assert.equal(canonical.ok, true); assert.equal(canonical.segments[0].text, q.text)
})
test('historical fact renders only library-controlled anecdote fields, never model prose', () => {
  const anecdote = libs.anecdotes.byPersona('wang-yangming')[0]
  const ledger = new EvidenceLedger('wang-yangming', 'history-turn')
  ledger.grant({ evidenceId: anecdote.id, kind: 'anecdote', personaId: 'wang-yangming', turnId: 'history-turn' })
  const submitted = [{ kind: 'historical_fact', text: '模型凭空补写的细节：从未入库。', evidenceIds: [anecdote.id] }]
  assert.equal(validateActorReply(submitted, ledger, libs, 'wang-yangming').ok, true)
  const rendered = renderVerifiedReply(submitted, libs)
  assert.match(rendered, new RegExp(anecdote.summary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(rendered, /模型凭空补写的细节/)
})
test('cross-person, previous-turn, unknown and blacklist evidence are rejected', () => {
  const qz = QUOTES.find((x) => x.personaId === 'zeng-guofan'); const ledger = new EvidenceLedger('wang-yangming', 't2')
  ledger.grant({ evidenceId: qz.id, kind: 'quote', personaId: 'zeng-guofan', turnId: 't2' }); ledger.grant({ evidenceId: q.id, kind: 'quote', personaId: 'wang-yangming', turnId: 't1' })
  assert.equal(validateActorReply([{ kind: 'verbatim_quote', text: qz.text, evidenceIds: [qz.id] }], ledger, libs, 'wang-yangming').ok, false)
  assert.equal(validateActorReply([{ kind: 'verbatim_quote', text: q.text, evidenceIds: [q.id] }], ledger, libs, 'wang-yangming').ok, false)
  assert.equal(validateActorReply([{ kind: 'historical_fact', text: '史实。', evidenceIds: ['unknown'] }], ledger, libs, 'wang-yangming').ok, false)
  assert.equal(validateActorReply([{ kind: 'thought_attribution', text: '他主张某事。' }], new EvidenceLedger('wang-yangming', 't2'), libs, 'wang-yangming').ok, false)
  const blacklisted = BLACKLIST_ENTRIES.find((entry) => entry.kind === 'quote' && entry.mode === 'always')
  if (blacklisted) assert.equal(validateActorReply([{ kind: 'dialogue', text: blacklisted.text }], new EvidenceLedger('wang-yangming', 't2'), libs, 'wang-yangming').ok, false)
})
