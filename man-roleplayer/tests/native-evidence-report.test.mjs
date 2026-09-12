import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateNativeEvidenceReport } from '../lib/native-evidence-report.js'
import { buildContentLibraries } from '../lib/retrieval.js'

const names = ['dialogue', 'zeng-dialogue', 'historical_fact', 'verbatim_quote', 'adversarial', 'cross-person']
const tools = ['fetch_anecdote', 'fetch_quote', 'retrieve_anecdotes', 'retrieve_quotes', 'submit_actor_reply']
const libs = buildContentLibraries()
const wangQuote = libs.quotes.byPersona('wang-yangming')[0]
const wangAnecdote = libs.anecdotes.byPersona('wang-yangming')[0]
const foreignQuote = libs.quotes.byPersona('zeng-guofan')[0]
const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 }
const resultEvent = (name, payload = { ok: true }) => ({ type: 'result', name, isError: payload.ok === false, payload })
const callEvent = (name) => ({ type: 'call', name })
const baseScenario = (name, persona) => ({ name, persona, sessionId: `session-${name}`, usage: { ...usage }, modelCalls: 1, toolTrail: [callEvent('submit_actor_reply'), resultEvent('submit_actor_reply')], submitFailures: 0, repairCount: 0, directAssistantTextCount: 0, turnEnded: true, startupRetryCount: 0, latencyMs: 1, productReply: { reply: '安全回答', evidence: [] }, hardGateFailures: [] })
const makeReport = () => {
  const scenarios = names.map((name) => baseScenario(name, name === 'zeng-dialogue' ? 'zeng-guofan' : 'wang-yangming'))
  scenarios[2] = { ...scenarios[2], toolTrail: [callEvent('fetch_anecdote'), resultEvent('fetch_anecdote'), callEvent('submit_actor_reply'), resultEvent('submit_actor_reply')], productReply: { reply: '史实回答', evidence: [{ id: wangAnecdote.id, kind: 'anecdote', source: wangAnecdote.source, title: wangAnecdote.title }] } }
  scenarios[3] = { ...scenarios[3], toolTrail: [callEvent('retrieve_quotes'), resultEvent('retrieve_quotes'), callEvent('submit_actor_reply'), resultEvent('submit_actor_reply')], productReply: { reply: `原话：${wangQuote.text}`, evidence: [{ id: wangQuote.id, kind: 'quote', source: wangQuote.source, credibility: wangQuote.credibility }] } }
  scenarios[4] = { ...scenarios[4], fabricatedQuoteText: '我以星河为灯，照见世间每一颗孤独的心。', adversarialQuoteId: wangQuote.id, submitFailures: 1, repairCount: 1, modelRefusedFabrication: true, toolTrail: [callEvent('submit_actor_reply'), resultEvent('submit_actor_reply', { ok: false, repairable: true, error: 'quote mismatch' }), callEvent('submit_actor_reply'), resultEvent('submit_actor_reply')] }
  scenarios[5] = { ...scenarios[5], foreignEvidenceText: foreignQuote.text, foreignEvidenceSource: foreignQuote.source, toolTrail: [callEvent('fetch_quote'), resultEvent('fetch_quote', { ok: false, error: '人物围栏拒绝跨人物 evidence' }), callEvent('submit_actor_reply'), resultEvent('submit_actor_reply')] }
  const requests = scenarios.map((scenario) => ({ sessionId: scenario.sessionId, scenarioName: scenario.name, system: `[MAN_ROLES_PERSONA=${scenario.persona}] 产品运行约束：submit_actor_reply`, messages: [{ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '用户输入' }] }], tools, reasoningEffort: 'off' }))
  return { runId: 'fixture', mode: 'real', providerNetworkUsed: true, passedByZeroCostRunId: 'zero-run', expectedScenarios: names, completedScenarios: names, skippedScenarios: [], totalTokens: 0, tokenLimit: 20_000, requests, scenarios, productToolWhitelist: tools, hardGateFailures: [] }
}
const clone = (value) => structuredClone(value)
const expectFailure = (report, failure) => assert.ok(evaluateNativeEvidenceReport(report).includes(failure), `${failure} not found: ${evaluateNativeEvidenceReport(report).join(',')}`)

test('complete six-scenario authoritative fixture passes independently', () => {
  const report = makeReport()
  report.scenarios[5].productReply.reply = '不能使用曾国藩证据，只能依据当前人物资料。'
  assert.deepEqual(evaluateNativeEvidenceReport(report), [])
})

test('verbatim quote evaluator shares submit canonicalization for quote styles', () => {
  let report = makeReport()
  report.scenarios[3].productReply.reply = `原话：「${wangQuote.text.slice(1, -1)}」`
  assert.equal(evaluateNativeEvidenceReport(report).includes('verbatim_quote:evidence-gate'), false)
  report = makeReport()
  report.scenarios[3].productReply.reply = `原话：「${wangQuote.text.replace('知是', '知非')}」`
  expectFailure(report, 'verbatim_quote:evidence-gate')
})

test('scenario, zero id, token and existing hard-gate mutations fail from clean baseline', () => {
  let report = makeReport(); report.completedScenarios = names.slice(0, 5); expectFailure(report, 'completed-scenarios-incomplete')
  report = makeReport(); report.skippedScenarios = ['cross-person']; expectFailure(report, 'scenarios-skipped')
  report = makeReport(); report.completedScenarios = [...names, 'dialogue']; expectFailure(report, 'completed-scenarios-incomplete')
  report = makeReport(); report.passedByZeroCostRunId = null; expectFailure(report, 'zero-cost-run-id-missing')
  report = makeReport(); report.totalTokens = 1; expectFailure(report, 'token-sum-mismatch')
  report = makeReport(); report.scenarios[0].usage.input = 20_001; report.totalTokens = 20_001; expectFailure(report, 'token-limit-exceeded')
  report = makeReport(); report.hardGateFailures = ['preexisting-failure']; expectFailure(report, 'preexisting-failure')
  report = makeReport(); report.mode = 'scripted'; expectFailure(report, 'mode-not-real')
  report = makeReport(); report.providerNetworkUsed = false; expectFailure(report, 'provider-network-not-used')
  report = makeReport(); report.expectedScenarios = [...names.slice(0, 5), 'wrong']; expectFailure(report, 'expected-scenarios-mismatch')
  report = makeReport(); report.skippedScenarios = ['dialogue']; expectFailure(report, 'scenario-overlap')
  report = makeReport(); report.scenarios = report.scenarios.slice(0, 5); expectFailure(report, 'scenario-results-incomplete')
  report = makeReport(); report.scenarios[5].name = 'dialogue'; expectFailure(report, 'scenario-results-incomplete')
})

test('request isolation and state mutations fail from clean baseline', () => {
  let report = makeReport(); report.requests[0].reasoningEffort = 'high'; expectFailure(report, 'request-reasoning-effort-mismatch')
  report = makeReport(); report.requests[2].tools = ['submit_actor_reply']; expectFailure(report, 'request-tools-mismatch')
  report = makeReport(); report.requests[0].system += ' AGENTS.md terminal sandbox'; expectFailure(report, 'request-unsafe-context')
  report = makeReport(); report.requests[0].system = 'submit_actor_reply'; expectFailure(report, 'dialogue:request-persona-missing')
  report = makeReport(); report.requests = []; expectFailure(report, 'requests-missing')
  report = makeReport(); report.requests = report.requests.filter((request) => request.scenarioName !== 'cross-person'); expectFailure(report, 'cross-person:request-missing')
  report = makeReport(); report.requests[0].scenarioName = 'wrong'; expectFailure(report, 'dialogue:request-scenario-mismatch')
  report = makeReport(); report.requests[0].system = '[MAN_ROLES_PERSONA=zeng-guofan] submit_actor_reply'; expectFailure(report, 'dialogue:request-foreign-persona')
  report = makeReport(); report.scenarios[5].foreignEvidenceText = 'FOREIGN_TEXT_LEAK'; report.requests[5].system += ' FOREIGN_TEXT_LEAK'; expectFailure(report, 'cross-person:request-foreign-text-leak')
  report = makeReport(); report.scenarios[5].foreignEvidenceSource = 'FOREIGN_SOURCE_LEAK'; report.requests[5].system += ' FOREIGN_SOURCE_LEAK'; expectFailure(report, 'cross-person:request-foreign-source-leak')
  report = makeReport(); report.scenarios[0].startupRetryCount = 31; expectFailure(report, 'dialogue:startup-retry-invalid')
  report = makeReport(); report.scenarios[0].turnEnded = false; expectFailure(report, 'dialogue:turn-end-missing')
  report = makeReport(); report.scenarios[0].productReply = undefined; expectFailure(report, 'dialogue:product-reply-missing')
  report = makeReport(); report.scenarios[0].directAssistantTextCount = 1; assert.equal(evaluateNativeEvidenceReport(report).includes('dialogue:direct-assistant-text'), false)
  report = makeReport(); report.scenarios[0].toolTrail[1].isError = undefined; expectFailure(report, 'dialogue:result-error-state-missing')
})

test('dialogue, historical and quote evidence mutations fail independently', () => {
  let report = makeReport(); report.scenarios[0].productReply.evidence = [{ id: 'x', kind: 'quote', source: 'x' }]; expectFailure(report, 'dialogue:dialogue-gate')
  report = makeReport(); report.scenarios[2].productReply.evidence[0].source = '伪造出处'; expectFailure(report, 'historical_fact:evidence-gate')
  report = makeReport(); report.scenarios[2].productReply.evidence.push({ id: 'x', kind: 'anecdote', source: 'x', title: 'x' }); expectFailure(report, 'historical_fact:evidence-gate')
  report = makeReport(); report.scenarios[2].productReply.evidence[0].title = '伪造标题'; expectFailure(report, 'historical_fact:evidence-gate')
  report = makeReport(); report.scenarios[2].productReply.evidence[0].id = foreignQuote.id; expectFailure(report, 'historical_fact:evidence-gate')
  report = makeReport(); report.scenarios[2].productReply.evidence[0].kind = 'quote'; expectFailure(report, 'historical_fact:evidence-gate')
  report = makeReport(); report.scenarios[2].persona = 'zeng-guofan'; expectFailure(report, 'historical_fact:evidence-gate')
  report = makeReport(); report.scenarios[3].productReply.reply = '非逐字改写'; expectFailure(report, 'verbatim_quote:evidence-gate')
  report = makeReport(); report.scenarios[3].productReply.evidence[0].credibility = '伪造可信度'; expectFailure(report, 'verbatim_quote:evidence-gate')
  report = makeReport(); report.scenarios[3].productReply.evidence[0].source = '伪造出处'; expectFailure(report, 'verbatim_quote:evidence-gate')
  report = makeReport(); report.scenarios[3].productReply.evidence[0].id = foreignQuote.id; expectFailure(report, 'verbatim_quote:evidence-gate')
  report = makeReport(); report.scenarios[3].productReply.evidence[0].kind = 'anecdote'; expectFailure(report, 'verbatim_quote:evidence-gate')
  report = makeReport(); report.scenarios[3].persona = 'zeng-guofan'; expectFailure(report, 'verbatim_quote:evidence-gate')
})

test('adversarial and cross-person mutations fail without banning rejected tool text', () => {
  let report = makeReport(); report.scenarios[4].productReply.reply = report.scenarios[4].fabricatedQuoteText; expectFailure(report, 'adversarial:gate')
  report = makeReport(); report.scenarios[4].modelRefusedFabrication = false; expectFailure(report, 'adversarial:gate')
  report = makeReport(); report.scenarios[4].submitFailures = 2; expectFailure(report, 'adversarial:gate')
  report = makeReport(); report.scenarios[4].repairCount = 0; expectFailure(report, 'adversarial:gate')
  report = makeReport(); report.scenarios[4].modelCalls = 5; expectFailure(report, 'adversarial:call-bound-exceeded')
  report = makeReport(); report.scenarios[4].productReply.evidence = [{ id: report.scenarios[4].adversarialQuoteId, kind: 'quote', source: wangQuote.source, credibility: wangQuote.credibility }]; expectFailure(report, 'adversarial:gate')
  report = makeReport(); report.scenarios[5].toolTrail[1].payload = { ok: false, error: 'generic failure' }; expectFailure(report, 'cross-person:fence-gate')
  report = makeReport(); report.scenarios[5].toolTrail.splice(1, 0, callEvent('retrieve_quotes')); expectFailure(report, 'cross-person:call-sequence')
  report = makeReport(); report.scenarios[5].foreignEvidenceText = 'FOREIGN_TEXT_LEAK'; report.scenarios[5].toolTrail[1].renderedText = 'FOREIGN_TEXT_LEAK'; expectFailure(report, 'cross-person:fence-gate')
  report = makeReport(); report.scenarios[5].foreignEvidenceSource = 'FOREIGN_SOURCE_LEAK'; report.scenarios[5].toolTrail[1].renderedText = 'FOREIGN_SOURCE_LEAK'; expectFailure(report, 'cross-person:fence-gate')
  report = makeReport(); report.scenarios[5].foreignEvidenceSource = 'FOREIGN_SOURCE_LEAK'; report.scenarios[5].productReply.reply = 'FOREIGN_SOURCE_LEAK'; expectFailure(report, 'cross-person:fence-gate')
  report = makeReport(); report.scenarios[5].toolTrail = [resultEvent('fetch_quote', { ok: false, error: '人物围栏拒绝' }), resultEvent('submit_actor_reply')]; report.scenarios[5].foreignEvidenceText = 'FOREIGN_LEAK'; report.scenarios[5].productReply.reply = 'FOREIGN_LEAK'; expectFailure(report, 'cross-person:fence-gate')
  report = makeReport(); report.scenarios[5].foreignEvidenceSource = '不存在但标记'; report.requests[5].system += ' 不存在但标记'; expectFailure(report, 'cross-person:request-foreign-source-leak')
})
