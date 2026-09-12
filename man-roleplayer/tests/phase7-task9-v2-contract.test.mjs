import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deriveSubmitDiagnostics, deriveOutputObservation, phase7Task9HistoricalReportSchema, validatePhase7Task9HistoricalReport, replayPhase7Task9HistoricalReport } from '../lib/phase7-task9-report.js'

const thirdBatch = JSON.parse(readFileSync(new URL('./fixtures/phase7-task9-third-batch-events.json', import.meta.url), 'utf8'))
const historical = JSON.parse(readFileSync(new URL('./fixtures/phase7-task9-historical-v1-summaries.json', import.meta.url), 'utf8'))

test('third-batch submit diagnostics are paired, redacted, and count second failure as one repair', () => {
  const events = [1,2].flatMap((n) => [{ type: 'tool/call', data: { name: 'submit_actor_reply', callId: `s${n}` } }, { type: 'tool/result', data: { message: { source: { callId: `s${n}` }, content: [{ type: 'text', text: JSON.stringify({ diagnostics: { attempt: n, errorCode: n === 1 ? 'missing-evidence-ids' : 'evidence-gate-rejected', repairable: n === 1, fallback: n === 2, concluded: n === 2, violations: [] } }) }] } } }])
  const d = deriveSubmitDiagnostics(events)
  assert.equal(d.length, 2); assert.equal(d[1].attempt, 2); assert.equal(d[1].fallback, true)
  assert.deepEqual(Object.keys(d[0]).sort(), ['accepted','attempt','concluded','errorCode','fallback','repairable','violations'])
  assert.equal(JSON.stringify(d).includes('REDACTED'), false)
})

test('text plus tool-call is preamble; text-only is observable but not projection', () => {
  assert.deepEqual(deriveOutputObservation([{ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '准备提交。' }, { type: 'tool-call', name: 'submit_actor_reply' }] } } }], 0), { projectedReplyCount: 0, rawAssistantTextOnlyCount: 0, toolCallPreambleCount: 1 })
  assert.deepEqual(deriveOutputObservation([{ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'raw' }] } } }], 0), { projectedReplyCount: 0, rawAssistantTextOnlyCount: 1, toolCallPreambleCount: 0 })
})

test('v1 historical reports use a separate strict entry and v2 rejects them', () => {
  const legacy = { schemaVersion: 1, runMode: 'real', runId: 'legacy-1', profile: 'historical', attemptMarkerPath: 'D:/marker', attemptMarkerSha256: 'a'.repeat(64), provider: 'old', model: 'old', expectedScenarios: [], scenarios: [], requests: [], fullTotal: 0, tokenLimit: 20000, providerNetworkUsed: true, passed: false }
  assert.deepEqual(validatePhase7Task9HistoricalReport(legacy), [])
  assert.deepEqual(replayPhase7Task9HistoricalReport(legacy), { runId: 'legacy-1', recordedPassed: false, failures: [] })
  assert.throws(() => phase7Task9HistoricalReportSchema.parse({ ...legacy, extra: true }))
})

test('stable third-batch event replay preserves repair and policy facts without answer text', () => {
  const diagnostics = deriveSubmitDiagnostics(thirdBatch.knowledgeEvents)
  assert.deepEqual(diagnostics.map((item) => item.errorCode), ['missing-evidence-ids', 'fixed-fallback'])
  assert.equal(diagnostics.length - 1, 1)
  assert.deepEqual(deriveOutputObservation(thirdBatch.knowledgeEvents, 0), { projectedReplyCount: 0, rawAssistantTextOnlyCount: 0, toolCallPreambleCount: 1 })
  assert.equal(thirdBatch.dilemma.observed, 2168); assert.equal(thirdBatch.dilemma.providerCallsAfterBlock, 0)
  assert.equal(thirdBatch.review.turnPolicy.maxQuestions, thirdBatch.review.questions)
  assert.equal(JSON.stringify(thirdBatch).includes('知行合一'), false)
})

test('three historical v1 summaries remain replay-failed and hash-addressable', () => {
  assert.deepEqual(historical.map((item) => item.runId), ['20260828-125619030','20260828-164102042','20260828-172725027'])
  assert.deepEqual(historical.map((item) => item.tokens), [19228,10366,15342])
  assert.deepEqual(historical.map((item) => item.recordedPassed), [true,false,false])
  assert.deepEqual(historical.map((item) => item.correctedFailureCount), [6,4,5])
  assert.ok(historical.every((item) => item.correctedFailureCount > 0 && /^[A-F0-9]{64}$/.test(item.reportSha256)))
})
