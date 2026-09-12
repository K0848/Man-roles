import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { interpretTurn, turnInterpretationSchema } from '../lib/turn-interpreter.js'
import { selectHistory } from '../lib/select-history.js'
import { collectWebEvidence, evidenceForTurn, searchWithFallback } from '../lib/web-collector.js'
import { FINAL_ACTOR_TOOL_NAMES } from '../lib/actor-tool-contract.js'
import { validateSubmitArgsDetailed } from '../lib/actor-tool-contract.js'
import { TrunkStorage } from '../lib/storage.js'
import { makePersonaRegistry } from './persona-fixture.mjs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EvidenceLedger } from '../lib/evidence-ledger.js'
import { validateActorReply } from '../lib/evidence-policy.js'
import { buildContentLibraries } from '../lib/retrieval.js'
import { runDialogueTurnV2 } from '../lib/dialogue-coordinator.js'
import { runWebSearchSeam } from '../lib/web-tool-seam.js'
import { renderVerifiedReply } from '../lib/evidence-render.js'

test('Task 3 v2 product events persist and replay without legacy route/phase writes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mvp-v2-events-')); const registry = makePersonaRegistry(mkdtempSync(join(tmpdir(), 'mvp-v2-personas-')))
  const trunk = TrunkStorage.create('v2-events', dir, 'alpha', registry)
  trunk.appendProductEvent('trunk/v2/product-lifecycle', { version: 2, conversationId: 'v2-events', lifecycle: 'paused', operationId: 'op-1' })
  trunk.appendProductEvent('trunk/v2/product-result', { version: 2, operationId: 'op-2', status: 'reply', rawRef: 'raw-v2-events-0' })
  const bytes = readFileSync(trunk.filePath, 'utf8'); assert.doesNotMatch(bytes, /trunk\/(task-routed|dialogue-phase-set)/)
  assert.throws(() => trunk.appendProductEvent('trunk/v2/product-result', { version: 1, operationId: 'bad', status: 'reply', rawRef: 'x' }))
})

test('Task 4 interpretation coexists knowledge, emotion, clarification and candidate', () => {
  const value = interpretTurn('我想知道知行合一，但辞职让我害怕，不知道是否该走')
  assert.deepEqual(value, { responseNeeds: { answerKnowledge: true, acknowledgeEmotion: true, clarify: true, proposeCandidate: true }, safetyEscalation: 'none', feedback: 'none' })
  assert.equal(value.responseNeeds.answerKnowledge, true)
  assert.equal(turnInterpretationSchema.safeParse(value).success, true)
  assert.equal('taskMode' in value, false)
})

test('Task 4 submit accepts 0/1/2/3/4 distinct questions and rejects blank/duplicate', () => {
  const base = { segments: [{ kind: 'dialogue', text: '回应' }] }
  for (const n of [0, 1, 2, 3, 4]) assert.equal(validateSubmitArgsDetailed({ ...base, questions: Array.from({ length: n }, (_, i) => `问题${i}`) }).ok, true)
  assert.equal(validateSubmitArgsDetailed({ ...base, questions: [''] }).code, 'invalid_questions')
  assert.equal(validateSubmitArgsDetailed({ ...base, questions: ['重复', '重复'] }).code, 'invalid_questions')
})

test('Task 5 history selection keeps current and confirmed source refs under budget', () => {
  const result = selectHistory({ currentRaw: { rawRef: 'current', text: '当前原话' }, candidates: [{ rawRef: 'confirmed', text: '确认原话' }, { rawRef: 'other', text: '低优先级历史很长很长', priority: 0 }], confirmedRawRefs: ['confirmed'], personaId: 'wang-yangming', budgetTokens: 5 })
  assert.deepEqual(result.selectedRawRefs.slice(0, 2), ['current', 'confirmed'])
  assert.ok(result.dropped.some(x => x.rawRef === 'other'))
})

test('Task 6 actor scope is exact and web evidence is current-persona/current-turn only', () => {
  assert.deepEqual(FINAL_ACTOR_TOOL_NAMES, ['retrieve_anecdotes', 'fetch_anecdote', 'retrieve_quotes', 'fetch_quote', 'web_search', 'submit_actor_reply'])
  const evidence = collectWebEvidence({ personaId: 'wang-yangming', turnId: 'turn-1', results: [{ url: 'https://example.test/a', title: 'A' }, { url: 'not-a-url' }] })
  assert.equal(evidence.length, 1)
  assert.equal(evidenceForTurn(evidence, 'wang-yangming', 'turn-1').length, 1)
  assert.equal(evidenceForTurn(evidence, 'zeng-guofan', 'turn-1').length, 0)
  assert.equal(evidenceForTurn(evidence, 'wang-yangming', 'turn-2').length, 0)
})

test('Task 6 web timeout degrades without evidence', async () => {
  assert.deepEqual(await searchWithFallback(() => new Promise(resolve => setTimeout(() => resolve('late'), 20)), 1), { ok: false, reason: 'timeout' })
})

test('Task 6 modern external fact requires web grant and rejects historical use', () => {
  const ledger = new EvidenceLedger('alpha', 'turn-web'); const libs = buildContentLibraries()
  ledger.grant({ evidenceId: 'web-turn-web-0', kind: 'web', personaId: 'alpha', turnId: 'turn-web' })
  assert.equal(validateActorReply([{ kind: 'modern_external_fact', text: '现代事实', evidenceIds: ['web-turn-web-0'] }], ledger, libs, 'alpha').ok, true)
  assert.equal(validateActorReply([{ kind: 'historical_fact', text: '史实', evidenceIds: ['web-turn-web-0'] }], ledger, libs, 'alpha').ok, false)
})

test('v2 coordinator real path writes delivery/progress without legacy route or phase', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mvp-v2-coordinator-')); const registry = makePersonaRegistry(mkdtempSync(join(tmpdir(), 'mvp-v2-coordinator-personas-')))
  const trunk = TrunkStorage.create('coordinator-v2', dir, 'alpha', registry); trunk.indexBranch('alpha', 'alpha-session')
  let actorContext; let actorPolicy; let interpreterCalls = 0; let directorCalls = 0
  const result = await runDialogueTurnV2({ raw: '我在理想与现实之间犹豫', taskId: 'task-v2', personaId: 'alpha', messageId: 'message-v2', eventPurposePrefix: 'v2' }, {
    registry, trunk,
    delivery: { sessionId: 'alpha-session', session: { append() {} }, flush: async () => true },
    interpreter: (raw) => { interpreterCalls++; return { responseNeeds: { answerKnowledge: false, acknowledgeEmotion: true, clarify: true, proposeCandidate: true }, safetyEscalation: 'none', feedback: 'none' } },
    director: async ({ currentRawRef }) => { directorCalls++; trunk.proposeDilemmaItem({ id: 'candidate-v2', kind: 'core-conflict', text: '理想与现实的冲突', status: 'candidate', sourceRawRefs: [currentRawRef], proposedByPersona: 'alpha', visibility: 'origin-persona-only', revision: 1 }) },
    actor: { answerExists: () => false, loadExisting: () => ({ reply: '' }), run: async ({ context, policy }) => { actorContext = context; actorPolicy = policy; return { reply: '回应', progressSummary: '进展' } } },
    loadCurrentBranchHistory: () => ['foreign-like branch text'], contextBudgetTokens: 20,
  })
  assert.equal(result.status, 'ok'); assert.equal(interpreterCalls, 1); assert.equal(directorCalls, 1); assert.equal(result.calls.actor, 1)
  const bytes = readFileSync(trunk.filePath, 'utf8'); assert.doesNotMatch(bytes, /trunk\/(task-routed|dialogue-phase-set)/)
  assert.equal(actorContext.currentRaw, '我在理想与现实之间犹豫')
  assert.deepEqual(actorPolicy, { intent: 'clarify', allowedControls: ['continue', 'skip', 'pause', 'end'], shouldRunDirector: false, shouldOfferNewConversation: false })
  assert.equal(trunk.state.branchProgress.alpha.summary, '进展')
})

test('v2 coordinator reuses an existing actor reply before interpretation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mvp-v2-existing-')); const registry = makePersonaRegistry(mkdtempSync(join(tmpdir(), 'mvp-v2-existing-personas-')))
  const trunk = TrunkStorage.create('existing-v2', dir, 'alpha', registry); trunk.indexBranch('alpha', 'alpha-session')
  let interpreter = 0; let director = 0; let actor = 0
  const result = await runDialogueTurnV2({ raw: '重试同一问题', taskId: 'task-existing', personaId: 'alpha', messageId: 'message-existing', eventPurposePrefix: 'v2' }, {
    registry, trunk, delivery: { sessionId: 'alpha-session', session: { append() {} }, flush: async () => true },
    interpreter: () => { interpreter++; throw new Error('must not interpret') }, director: async () => { director++ },
    actor: { answerExists: () => true, loadExisting: () => ({ reply: '已持久化人物回答', evidence: [] }), run: async () => { actor++; return { reply: '重复生成' } } }, loadCurrentBranchHistory: () => [],
  })
  assert.equal(result.status, 'ok'); assert.equal(result.reply.reply, '已持久化人物回答'); assert.deepEqual({ interpreter, director, actor }, { interpreter: 0, director: 0, actor: 0 })
})

test('v2 coordinator safety short-circuits interpreter/director/actor', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mvp-v2-safety-')); const registry = makePersonaRegistry(mkdtempSync(join(tmpdir(), 'mvp-v2-safety-personas-')))
  const trunk = TrunkStorage.create('safety-v2', dir, 'alpha', registry); trunk.indexBranch('alpha', 'alpha-session')
  let calls = 0
  const result = await runDialogueTurnV2({ raw: '我想结束生命', taskId: 'task-safety', personaId: 'alpha', messageId: 'message-safety', eventPurposePrefix: 'v2' }, {
    registry, trunk, delivery: { sessionId: 'alpha-session', session: { append() {} }, flush: async () => true },
    interpreter: () => { calls++; throw new Error('must not run') }, director: async () => { calls++ }, actor: { answerExists: () => false, loadExisting: () => ({ reply: '' }), run: async () => { calls++; return { reply: 'bad' } } }, loadCurrentBranchHistory: () => [],
  })
  assert.equal(result.status, 'urgent-help'); assert.equal(calls, 0); assert.equal(result.calls.interpreter, 0); assert.equal(result.calls.director, 0); assert.equal(result.calls.actor, 0)
})

test('Task 6 actor web_search seam grants current web evidence', async () => {
  const ledger = new EvidenceLedger('alpha', 'turn-web'); const result = await runWebSearchSeam(async () => [{ url: 'https://example.test/current', title: 'Current', snippet: 'fact' }], 'current', 'alpha', 'turn-web', ledger)
  assert.equal(result.ok, true); if (result.ok) assert.equal(ledger.hasCurrentGrant(result.results[0].id, 'web'), true)
})
