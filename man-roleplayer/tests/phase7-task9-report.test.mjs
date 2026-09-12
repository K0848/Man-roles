import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePhase7Task9Report } from '../lib/phase7-task9-report.js'
import { phase7Task9ReportSchema } from '../lib/phase7-task9-report.js'

const scenarios = ['knowledge', 'dilemma', 'review', 'high-risk', 'cross-person']
const hash = 'a'.repeat(64)
const usage = { input: 0, output: 0, cache: 0, reasoning: 0, total: 0 }
const call = (role, requestId, tools = []) => ({ role, requestId, provider: 'scripted-local', model: 'scripted-no-network', usage: { ...usage }, latencyMs: 0, retries: 0, systemHash: hash, messageHashes: [hash], tools })

function makeScenario(name) {
  const highRisk = name === 'high-risk'
  const calls = highRisk ? [] : [call('control', `${name}:control`), call('actor', `${name}:actor`, name === 'knowledge' ? ['retrieve_quotes', 'fetch_quote', 'submit_actor_reply'] : ['submit_actor_reply'])]
  const turnPolicy = highRisk ? null : name === 'dilemma' ? { intent: 'clarify', maxQuestions: 2, allowedControls: ['continue','skip','pause','end'] } : name === 'review' ? { intent: 'reflect', maxQuestions: 1, allowedControls: ['continue','correct','end'] } : { intent: 'answer', maxQuestions: 0, allowedControls: ['continue','end'] }
  const submitDiagnostics = highRisk ? [] : [{ attempt: 1, accepted: true, errorCode: 'ok', repairable: false, fallback: false, concluded: true, violations: [] }]
  return { name, personaId: 'alpha', promptHash: hash, calls, controlCalls: highRisk ? 0 : 1, directorCalls: 0, actorCalls: highRisk ? 0 : 1, retrievalCalls: 0, usage: { ...usage }, retries: 0, candidateStatuses: name === 'dilemma' ? ['candidate'] : [], questions: [], turnPolicy, outputObservation: { projectedReplyCount: highRisk ? 0 : 1, rawAssistantTextOnlyCount: 0, toolCallPreambleCount: 0 }, submitDiagnostics, safety: { disposition: highRisk ? 'urgent-help' : 'allow', downstreamCalls: highRisk ? 0 : 1, messageHash: hash }, submitEvidence: { attempted: highRisk ? 0 : 1, accepted: highRisk ? 0 : 1, rejected: 0, repairCount: 0 }, eventOrder: highRisk ? ['user/message'] : ['user/message', 'turn/start', 'tool/call', 'tool/result'], isolation: { actorContextContainsForeignReply: false, actorContextContainsForeignProgress: false, actorContextContainsForeignCandidate: false, candidateBeforeActor: true }, foreignLeaks: { reply: { context: false, request: false, wake: false }, progress: { context: false, request: false, wake: false }, candidate: { context: false, request: false, wake: false } }, rawRefCount: 1, rawTextCount: 1, trunkRawCount: 1, wakeCount: highRisk ? 0 : 1, wakeSource: highRisk ? null : { kind: 'plugin', plugin: 'man-roles-roleplayer' }, wakeContainsIdentity: false, wakeContainsForeign: false, foreignFixtureEstablished: name === 'cross-person', foreignPersona: name === 'cross-person' ? 'beta' : null, foreignMarkerHashes: name === 'cross-person' ? [hash, hash, hash] : [], resultStatus: highRisk ? 'urgent-help' : 'allow' }
}
const baseScenarios = scenarios.map(makeScenario)
baseScenarios.forEach((scenario) => { const allocated = { knowledge: 7000, dilemma: 5000, review: 4500, 'high-risk': 0, 'cross-person': 3500 }[scenario.name]; const minimumStart = { knowledge: 2500, dilemma: 1800, review: 2500, 'high-risk': 0, 'cross-person': 2200 }[scenario.name]; const repairReserve = { knowledge: 1800, dilemma: 1800, review: 1800, 'high-risk': 0, 'cross-person': 1500 }[scenario.name]; scenario.scenarioBudget = { allocated, minimumStart, repairReserve, observed: 0, blocked: false, blocker: null } })
const base = { schemaVersion: 2, runMode: 'scripted', runId: 'self-contained-fixture', profile: 'scripted-local', attemptMarkerPath: 'absent', attemptMarkerSha256: hash, provider: 'scripted-local', model: 'scripted-no-network', expectedScenarios: [...scenarios], scenarios: baseScenarios, requests: baseScenarios.flatMap((s) => s.calls), fullTotal: 0, tokenLimit: 20000, providerNetworkUsed: false, passed: true }
const personas = base.scenarios.map((s) => s.personaId)
const check = (mutate, needle) => { const value = structuredClone(base); mutate(value); const failures = validatePhase7Task9Report(value, personas, base.provider, base.model); assert.ok(failures.includes(needle), `${needle}: ${failures.join(',')}`) }

test('Task9 report validator accepts self-contained scripted evidence', () => assert.deepEqual(validatePhase7Task9Report(base, personas, base.provider, base.model), []))
test('Task9 report schema strictly carries scenario budget', () => { assert.doesNotThrow(() => phase7Task9ReportSchema.parse(base)); const missing = structuredClone(base); delete missing.scenarios[0].scenarioBudget; assert.throws(() => phase7Task9ReportSchema.parse(missing)); const extra = structuredClone(base); extra.scenarios[0].scenarioBudget.extra = true; assert.throws(() => phase7Task9ReportSchema.parse(extra)) })
test('Task9 v2 requires policy output observation and submit diagnostics', () => {
  for (const key of ['turnPolicy','outputObservation','submitDiagnostics']) { const value=structuredClone(base); delete value.scenarios[0][key]; assert.throws(() => phase7Task9ReportSchema.parse(value), key) }
  check((v) => { v.scenarios[0].outputObservation.projectedReplyCount = 0 }, 'knowledge:projection-accepted')
  check((v) => { v.scenarios[0].submitDiagnostics[0].attempt = 2 }, 'knowledge:submit-diagnostics')
})
test('rejects scenario budget fact mutations', () => {
  check((v) => { v.scenarios[0].scenarioBudget.allocated = 6999 }, 'knowledge:scenario-budget-fields')
  check((v) => { v.scenarios[0].scenarioBudget.minimumStart = 2499 }, 'knowledge:scenario-budget-fields')
  check((v) => { v.scenarios[0].scenarioBudget.observed = 1 }, 'knowledge:scenario-budget-observed')
  check((v) => { v.scenarios[0].scenarioBudget.blocked = true }, 'knowledge:scenario-budget-blocked-status')
})
test('rejects extra top-level request', () => check((v) => v.requests.push(structuredClone(v.requests[0])), 'request-duplicate-id'))
test('rejects omitted top-level request', () => check((v) => v.requests.pop(), 'requests-not-canonical-flat'))
test('rejects duplicate request id', () => check((v) => { v.requests[1].requestId = v.requests[0].requestId }, 'request-duplicate-id'))
test('rejects request role mutation', () => check((v) => { v.requests[0].role = 'actor' }, 'knowledge:call-count-fields'))
test('rejects usage total mutation', () => check((v) => { v.requests[0].usage.total = 1 }, 'knowledge:control:usage-total'))
test('rejects full token mutation', () => check((v) => { v.fullTotal = 1 }, 'token-total'))
test('rejects high-risk turn event', () => check((v) => v.scenarios.find((s) => s.name === 'high-risk').eventOrder.push('turn/start'), 'high-risk-events'))
test('rejects high-risk submit attempt', () => check((v) => v.scenarios.find((s) => s.name === 'high-risk').submitEvidence.attempted = 1, 'high-risk-submit-output'))
test('rejects wake count zero and two', () => { check((v) => v.scenarios[0].wakeCount = 0, 'knowledge:wake-source'); check((v) => v.scenarios[0].wakeCount = 2, 'knowledge:wake-source') })
test('rejects raw ref count', () => check((v) => v.scenarios[0].rawRefCount = 0, 'schema-invalid'))
test('rejects raw text count', () => check((v) => v.scenarios[0].rawTextCount = 0, 'schema-invalid'))
test('rejects trunk raw count', () => check((v) => v.scenarios[0].trunkRawCount = 0, 'schema-invalid'))
test('rejects wake identity', () => check((v) => v.scenarios[0].wakeContainsIdentity = true, 'knowledge:wake-content'))
test('rejects wake source', () => check((v) => { v.scenarios[0].wakeSource = { kind: 'plugin', plugin: 'wrong' } }, 'schema-invalid'))
test('rejects cross fixture false', () => check((v) => v.scenarios.find((s) => s.name === 'cross-person').foreignFixtureEstablished = false, 'cross-person-fixture'))
test('rejects cross same persona', () => check((v) => { const s=v.scenarios.find((x)=>x.name==='cross-person'); s.foreignPersona=s.personaId }, 'cross-person-fixture'))
test('rejects missing marker hash', () => check((v) => v.scenarios.find((s) => s.name === 'cross-person').foreignMarkerHashes.pop(), 'cross-person-fixture'))
test('rejects each foreign leak dimension', () => { for (const group of ['reply','progress','candidate']) for (const side of ['context','request','wake']) check((v) => { v.scenarios.find((s)=>s.name==='cross-person').foreignLeaks[group][side]=true }, 'cross-person-leak') })
test('rejects submit accepted mutation', () => check((v) => v.scenarios[0].submitEvidence.accepted = 0, 'knowledge:submit-output'))
test('rejects submit attempted mutation', () => check((v) => v.scenarios[0].submitEvidence.attempted = 0, 'knowledge:submit-output'))
test('rejects submit result correlation mutation', () => check((v) => v.scenarios[0].submitEvidence.rejected = 1, 'knowledge:submit-correlation'))
test('passed bit cannot mask network use', () => check((v) => v.providerNetworkUsed = true, 'passed-network'))
test('passed false remains fact-valid', () => { const v=structuredClone(base); v.passed=false; assert.deepEqual(validatePhase7Task9Report(v, personas, base.provider, base.model), []) })
test('real mode requires network and a claimed marker', () => {
  const v = structuredClone(base); v.runMode = 'real'; v.provider = 'deepseek-official'; v.model = 'deepseek-v4-flash'; v.profile = 'isolated-real'; v.attemptMarkerPath = 'D:/marker'; v.providerNetworkUsed = true
  for (const s of v.scenarios) for (const c of s.calls) { c.provider = v.provider; c.model = v.model }
  const dilemma = v.scenarios.find((s) => s.name === 'dilemma'); dilemma.calls.splice(1, 0, call('director', 'dilemma:director')); dilemma.calls[1].provider = v.provider; dilemma.calls[1].model = v.model; dilemma.directorCalls = 1
  v.requests = v.scenarios.flatMap((s) => s.calls)
  assert.deepEqual(validatePhase7Task9Report(v, personas, v.provider, v.model), [])
  v.providerNetworkUsed = false; assert.ok(validatePhase7Task9Report(v, personas, v.provider, v.model).includes('real-network-missing'))
  v.providerNetworkUsed = true; v.attemptMarkerPath = 'absent'; assert.ok(validatePhase7Task9Report(v, personas, v.provider, v.model).includes('real-marker-missing'))
})
test('real questions follow the captured policy snapshot', () => {
  for (const name of ['knowledge', 'cross-person']) {
    const v = structuredClone(base); v.runMode = 'real'; v.provider = 'deepseek-official'; v.model = 'deepseek-v4-flash'; v.profile = 'isolated-real'; v.attemptMarkerPath = 'D:/marker'; v.providerNetworkUsed = true
    for (const s of v.scenarios) for (const c of s.calls) { c.provider = v.provider; c.model = v.model }
    v.requests = v.scenarios.flatMap((s) => s.calls); v.scenarios.find((s) => s.name === name).questions = ['不应追问']
    assert.ok(validatePhase7Task9Report(v, personas, v.provider, v.model).includes(`${name}:policy-max-questions`))
  }
  const review = structuredClone(base); review.scenarios.find((s) => s.name === 'review').questions = ['允许的一问']; assert.deepEqual(validatePhase7Task9Report(review, personas, review.provider, review.model), [])
  review.scenarios.find((s) => s.name === 'review').questions.push('第二问'); assert.ok(validatePhase7Task9Report(review, personas, review.provider, review.model).includes('review:policy-max-questions'))
})
test('rejects a mutated policy snapshot', () => check((v) => { v.scenarios[0].turnPolicy.maxQuestions = 1 }, 'knowledge:policy-snapshot'))
test('rejects submit diagnostics that disagree with submit facts', () => check((v) => { v.scenarios[0].submitDiagnostics[0].accepted = false }, 'knowledge:submit-diagnostics'))
