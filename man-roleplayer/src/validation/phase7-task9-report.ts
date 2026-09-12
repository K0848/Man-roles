import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs'
import { dirname } from 'node:path'
import { z } from 'zod'
import { PHASE7_TASK9_SCENARIO_BUDGETS } from './phase7-task9-budget.ts'
import { decideTurn } from '../dialogue/turn-policy.ts'

/** Strict, sanitized evidence contract for the one-shot Phase 7 Task 9 batch. */
export const PHASE7_TASK9_SCENARIOS = ['knowledge', 'dilemma', 'review', 'high-risk', 'cross-person'] as cons
export type Phase7Task9Scenario = typeof PHASE7_TASK9_SCENARIOS[number]

const usageSchema = z.object({ input: z.number().int().nonnegative(), output: z.number().int().nonnegative(), cache: z.number().int().nonnegative(), reasoning: z.number().int().nonnegative(), total: z.number().int().nonnegative() }).strict()
const callSchema = z.object({ role: z.enum(['control', 'director', 'actor', 'retrieval']), requestId: z.string().min(1), provider: z.string().min(1), model: z.string().min(1), usage: usageSchema, latencyMs: z.number().nonnegative(), retries: z.number().int().nonnegative(), systemHash: z.string().regex(/^[a-f0-9]{64}$/), messageHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)), tools: z.array(z.string()) }).strict()
const leakSchema = z.object({ context: z.boolean(), request: z.boolean(), wake: z.boolean() }).strict()
const blockerSchema = z.object({ remainingScenario: z.number().int().nonnegative(), estimated: z.number().int().nonnegative(), laterReserve: z.number().int().nonnegative(), repairReserve: z.number().int().nonnegative(), reason: z.string().min(1) }).strict()
const scenarioBudgetSchema = z.object({ allocated: z.number().int().nonnegative(), minimumStart: z.number().int().nonnegative(), repairReserve: z.number().int().nonnegative(), observed: z.number().int().nonnegative(), blocked: z.boolean(), blocker: blockerSchema.nullable() }).strict()
const diagnosticSchema = z.object({ attempt: z.number().int().positive(), accepted: z.boolean(), errorCode: z.string().min(1), repairable: z.boolean(), fallback: z.boolean(), concluded: z.boolean(), violations: z.array(z.object({ code: z.string().min(1), segmentIndex: z.number().int().nonnegative().optional() }).strict()) }).strict()
const outputObservationSchema = z.object({ projectedReplyCount: z.number().int().nonnegative(), rawAssistantTextOnlyCount: z.number().int().nonnegative(), toolCallPreambleCount: z.number().int().nonnegative() }).strict()
const scenarioSchema = z.object({ name: z.enum(PHASE7_TASK9_SCENARIOS), personaId: z.string().min(1), scenarioBudget: scenarioBudgetSchema, turnPolicy: z.object({ intent: z.string().min(1), maxQuestions: z.number().int().min(0).max(2), allowedControls: z.array(z.string()) }).strict().nullable(), outputObservation: outputObservationSchema, submitDiagnostics: z.array(diagnosticSchema), promptHash: z.string().regex(/^[a-f0-9]{64}$/), calls: z.array(callSchema), controlCalls: z.number().int().nonnegative(), directorCalls: z.number().int().nonnegative(), actorCalls: z.number().int().nonnegative(), retrievalCalls: z.number().int().nonnegative(), usage: usageSchema, retries: z.number().int().nonnegative(), candidateStatuses: z.array(z.enum(['candidate', 'confirmed', 'rejected', 'superseded'])), questions: z.array(z.string()).max(2), safety: z.object({ disposition: z.enum(['allow', 'professional-boundary', 'urgent-help', 'refuse']), downstreamCalls: z.number().int().nonnegative(), messageHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(), submitEvidence: z.object({ attempted: z.number().int().nonnegative(), accepted: z.number().int().nonnegative(), rejected: z.number().int().nonnegative(), repairCount: z.number().int().nonnegative() }).strict(), eventOrder: z.array(z.string()), isolation: z.object({ actorContextContainsForeignReply: z.boolean(), actorContextContainsForeignProgress: z.boolean(), actorContextContainsForeignCandidate: z.boolean(), candidateBeforeActor: z.boolean() }).strict(), foreignLeaks: z.object({ reply: leakSchema, progress: leakSchema, candidate: leakSchema }).strict(), rawRefCount: z.literal(1), rawTextCount: z.literal(1), trunkRawCount: z.literal(1), wakeCount: z.number().int().nonnegative(), wakeSource: z.object({ kind: z.literal('plugin'), plugin: z.literal('man-roles-roleplayer') }).strict().nullable(), wakeContainsIdentity: z.boolean(), wakeContainsForeign: z.boolean(), foreignFixtureEstablished: z.boolean(), foreignPersona: z.string().nullable(), foreignMarkerHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)), resultStatus: z.string().min(1) }).strict()

export const phase7Task9ReportSchema = z.object({ schemaVersion: z.literal(2), runMode: z.enum(['scripted', 'real']), runId: z.string().min(1), profile: z.string().min(1), attemptMarkerPath: z.string().min(1), attemptMarkerSha256: z.string().regex(/^[a-f0-9]{64}$/), provider: z.string().min(1), model: z.string().min(1), expectedScenarios: z.array(z.enum(PHASE7_TASK9_SCENARIOS)), scenarios: z.array(scenarioSchema), requests: z.array(callSchema), fullTotal: z.number().int().nonnegative(), tokenLimit: z.literal(20000), providerNetworkUsed: z.boolean(), passed: z.boolean() }).strict()
export type Phase7Task9Report = z.infer<typeof phase7Task9ReportSchema>

/** v1 is intentionally a separate historical contract; it is never accepted by the v2 validator. */
const legacyScenarioBudgetSchema = z.object({ allocated: z.number().int().nonnegative(), minimumStart: z.number().int().nonnegative(), observed: z.number().int().nonnegative(), blocked: z.boolean() }).strict()
const legacyScenarioShape = { name: z.enum(PHASE7_TASK9_SCENARIOS), personaId: z.string().min(1), promptHash: z.string().regex(/^[a-f0-9]{64}$/), calls: z.array(callSchema), controlCalls: z.number().int().nonnegative(), directorCalls: z.number().int().nonnegative(), actorCalls: z.number().int().nonnegative(), retrievalCalls: z.number().int().nonnegative(), usage: usageSchema, retries: z.number().int().nonnegative(), candidateStatuses: z.array(z.enum(['candidate', 'confirmed', 'rejected', 'superseded'])), questions: z.array(z.string()).max(2), directAssistantProductOutputs: z.number().int().nonnegative(), safety: z.object({ disposition: z.enum(['allow', 'professional-boundary', 'urgent-help', 'refuse']), downstreamCalls: z.number().int().nonnegative(), messageHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(), submitEvidence: z.object({ attempted: z.number().int().nonnegative(), accepted: z.number().int().nonnegative(), rejected: z.number().int().nonnegative(), repairCount: z.number().int().nonnegative() }).strict(), eventOrder: z.array(z.string()), isolation: z.object({ actorContextContainsForeignReply: z.boolean(), actorContextContainsForeignProgress: z.boolean(), actorContextContainsForeignCandidate: z.boolean(), candidateBeforeActor: z.boolean() }).strict(), foreignLeaks: z.object({ reply: leakSchema, progress: leakSchema, candidate: leakSchema }).strict(), rawRefCount: z.literal(1), rawTextCount: z.literal(1), trunkRawCount: z.literal(1), wakeCount: z.number().int().nonnegative(), wakeSource: z.object({ kind: z.literal('plugin'), plugin: z.literal('man-roles-roleplayer') }).strict().optional(), wakeContainsIdentity: z.boolean(), wakeContainsForeign: z.boolean(), foreignFixtureEstablished: z.boolean(), foreignPersona: z.string().optional(), foreignMarkerHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)), resultStatus: z.string().min(1) }
const legacyScenarioSchema = z.union([z.object({ ...legacyScenarioShape, scenarioBudget: legacyScenarioBudgetSchema }).strict(), z.object(legacyScenarioShape).strict()])
export const phase7Task9HistoricalReportSchema = z.object({ schemaVersion: z.literal(1), runMode: z.enum(['scripted', 'real']), runId: z.string().min(1), profile: z.string().min(1), attemptMarkerPath: z.string().min(1), attemptMarkerSha256: z.string().regex(/^[a-f0-9]{64}$/), provider: z.string().min(1), model: z.string().min(1), expectedScenarios: z.array(z.enum(PHASE7_TASK9_SCENARIOS)), scenarios: z.array(legacyScenarioSchema), requests: z.array(callSchema), fullTotal: z.number().int().nonnegative(), tokenLimit: z.literal(20000), providerNetworkUsed: z.boolean(), passed: z.boolean() }).strict()
export function validatePhase7Task9HistoricalReport(value: unknown): string[] { return phase7Task9HistoricalReportSchema.safeParse(value).success ? [] : ['legacy-schema-invalid'] }

/** Replay immutable v1 facts under the corrected product policy without pretending they are v2 evidence. */
export function replayPhase7Task9HistoricalReport(value: unknown): { runId?: string; recordedPassed?: boolean; failures: string[] } {
  const parsed = phase7Task9HistoricalReportSchema.safeParse(value)
  if (!parsed.success) return { failures: ['legacy-schema-invalid'] }
  const failures: string[] = []
  for (const scenario of parsed.data.scenarios) {
    if ('scenarioBudget' in scenario && scenario.scenarioBudget.blocked) failures.push(`${scenario.name}:real-scenario-budget-blocked`)
    if (scenario.name === 'high-risk') {
      if (scenario.calls.length !== 0 || scenario.submitEvidence.attempted !== 0) failures.push('high-risk-downstream')
      continue
    }
    if (scenario.submitEvidence.accepted !== 1) failures.push(`${scenario.name}:submit-output`)
    if (scenario.controlCalls < 1 || scenario.controlCalls > 2 || scenario.actorCalls < 1 || scenario.actorCalls > 3 || scenario.submitEvidence.accepted !== 1) failures.push(`${scenario.name}:real-call-bounds`)
    const policy = expectedPhase7Task9TurnPolicy(scenario.name)
    if (policy && scenario.questions.length > policy.maxQuestions) failures.push(`${scenario.name}:policy-max-questions`)
  }
  return { runId: parsed.data.runId, recordedPassed: parsed.data.passed, failures }
}

export type Phase7Task9TurnPolicySnapshot = { intent: string; maxQuestions: number; allowedControls: string[] }
export function snapshotTurnPolicy(policy: { intent: string; maxQuestions: number; allowedControls: readonly string[] }): Phase7Task9TurnPolicySnapshot { return { intent: policy.intent, maxQuestions: policy.maxQuestions, allowedControls: [...policy.allowedControls] } }
export function expectedPhase7Task9TurnPolicy(name: Phase7Task9Scenario): Phase7Task9TurnPolicySnapshot | null {
  if (name === 'high-risk') return null
  const taskMode = name === 'dilemma' ? 'dilemma' : name === 'review' ? 'review' : 'knowledge'
  return snapshotTurnPolicy(decideTurn({ taskMode, feedbackKind: 'none', phase: 'responding' }))
}

function resultText(event: any): string {
  const blocks = event?.data?.message?.content ?? []
  return blocks.flatMap((block: any) => block?.type === 'text' ? [String(block.text ?? '')] : block?.type === 'tool-result' && Array.isArray(block.content) ? block.content.filter((item: any) => item?.type === 'text').map((item: any) => String(item.text ?? '')) : []).join('')
}

export function deriveSubmitDiagnostics(events: readonly any[]): Array<z.infer<typeof diagnosticSchema>> {
  const submitIds = new Set(events.filter((e) => e?.type === 'tool/call' && e.data?.name === 'submit_actor_reply').map((e) => e.data?.callId ?? e.data?.id ?? e.data?.message?.source?.callId).filter(Boolean))
  return events.filter((e) => e?.type === 'tool/result' && submitIds.has(e.data?.message?.source?.callId ?? e.data?.callId)).map((e, index) => {
    let value: any = {}; try { value = JSON.parse(resultText(e) || '{}') } catch { /* redacted diagnostics tolerate malformed provider result */ }
    value = value?.diagnostics ?? value
    const accepted = value.accepted === true || value.ok === true && value.concluded === true
    return { attempt: index + 1, accepted, errorCode: String(value.errorCode ?? (accepted ? 'ok' : value.fallback === true ? 'fixed-fallback' : value.violations?.[0]?.code ?? 'invalid-submit')), repairable: value.repairable === true, fallback: value.fallback === true, concluded: value.concluded === true, violations: Array.isArray(value.violations) ? value.violations.map((v: any) => ({ code: String(v.code ?? 'invalid-submit'), ...(Number.isInteger(v.segmentIndex) ? { segmentIndex: v.segmentIndex } : {}) })) : [] }
  })
}

export function deriveOutputObservation(events: readonly any[], projectedReplyCount: number): { projectedReplyCount: number; rawAssistantTextOnlyCount: number; toolCallPreambleCount: number } {
  const assistants = events.filter((e) => e?.type === 'assistant/message')
  const rawAssistantTextOnlyCount = assistants.filter((e) => { const blocks = e.data?.message?.content ?? e.data?.content ?? []; return blocks.some((b: any) => b.type === 'text' && String(b.text ?? '').trim()) && !blocks.some((b: any) => b.type === 'tool-call') }).length
  const toolCallPreambleCount = assistants.filter((e) => { const blocks = e.data?.message?.content ?? e.data?.content ?? []; return blocks.some((b: any) => b.type === 'tool-call') && blocks.some((b: any) => b.type === 'text' && String(b.text ?? '').trim()) }).length
  return { projectedReplyCount, rawAssistantTextOnlyCount, toolCallPreambleCount }
}

export function sha256(value: string | Uint8Array): string { return createHash('sha256').update(value).digest('hex') }
export function usageFullTotal(usage: z.infer<typeof usageSchema>): number { return usage.input + usage.output + usage.cache + usage.reasoning }

/**
 * Validate facts, not the report's self-asserted `passed` bit. The caller may
 * persist a report with `passed=false`; this function only returns violations.
 */
export function validatePhase7Task9Report(value: unknown, expectedPersonas: readonly string[], expectedProvider: string, expectedModel: string): string[] {
  const parsed = phase7Task9ReportSchema.safeParse(value)
  if (!parsed.success) return ['schema-invalid']
  const report = parsed.data; const failures: string[] = []
  const expectedBudget = new Map(PHASE7_TASK9_SCENARIO_BUDGETS.map((budget) => [budget.name, budget]))
  const budgetSum = PHASE7_TASK9_SCENARIO_BUDGETS.reduce((sum, budget) => sum + budget.allocated, 0)
  if (budgetSum > report.tokenLimit) failures.push('scenario-budget-total')
  for (const scenario of report.scenarios) {
    const budget = expectedBudget.get(scenario.name); const b = scenario.scenarioBudget as Record<string, unknown>
    if (!budget) { failures.push(`${scenario.name}:scenario-budget-missing`); continue }
    if (b.allocated !== budget.allocated || b.minimumStart !== budget.minimumStart || b.repairReserve !== budget.repairReserve || typeof b.observed !== 'number' || b.observed < 0 || typeof b.blocked !== 'boolean' || (!b.blocked && b.blocker !== null) || (b.blocked && (!b.blocker || typeof b.blocker !== 'object'))) failures.push(`${String(scenario.name)}:scenario-budget-fields`)
    const parsedScenario = report.scenarios.find((item) => item.name === scenario.name)
    if (!parsedScenario || b.observed !== usageFullTotal(parsedScenario.usage)) failures.push(`${String(scenario.name)}:scenario-budget-observed`)
    if (b.blocked === true && parsedScenario && parsedScenario.resultStatus !== 'failed' && report.passed === true) failures.push(`${String(scenario.name)}:scenario-budget-blocked-status`)
    if (report.runMode === 'real' && b.blocked === true) failures.push(`${String(scenario.name)}:real-scenario-budget-blocked`)
  }
  if (report.runMode === 'scripted' && report.passed === true && report.providerNetworkUsed) failures.push('passed-network')
  if (report.runMode === 'scripted' && report.attemptMarkerPath !== 'absent') failures.push('scripted-marker-present')
  if (report.runMode === 'real' && !report.providerNetworkUsed) failures.push('real-network-missing')
  if (report.runMode === 'real' && report.attemptMarkerPath === 'absent') failures.push('real-marker-missing')
  if (report.expectedScenarios.length !== PHASE7_TASK9_SCENARIOS.length || [...report.expectedScenarios].sort().join('|') !== [...PHASE7_TASK9_SCENARIOS].sort().join('|')) failures.push('expected-scenarios')
  const flattened = report.scenarios.flatMap((scenario) => scenario.calls)
  if (new Set(report.requests.map((call) => call.requestId)).size !== report.requests.length) failures.push('request-duplicate-id')
  if (JSON.stringify(report.requests) !== JSON.stringify(flattened)) failures.push('requests-not-canonical-flat')
  if (report.scenarios.length !== PHASE7_TASK9_SCENARIOS.length || new Set(report.scenarios.map((s) => s.name)).size !== PHASE7_TASK9_SCENARIOS.length) failures.push('scenario-set')
  if (report.provider !== expectedProvider || report.model !== expectedModel) failures.push('provider-model')
  for (const call of report.requests) if (call.usage.total !== usageFullTotal(call.usage)) failures.push(`${call.requestId}:usage-total`)
  if (report.requests.some((c) => c.provider !== expectedProvider || c.model !== expectedModel) || report.scenarios.some((s) => s.calls.some((c) => c.provider !== expectedProvider || c.model !== expectedModel))) failures.push('request-provider-model')
  const recomputed = report.requests.reduce((sum, c) => sum + usageFullTotal(c.usage), 0)
  if (recomputed !== report.fullTotal || report.fullTotal > report.tokenLimit) failures.push('token-total')
  for (const scenario of report.scenarios) {
    if (scenario.rawRefCount !== 1 || scenario.rawTextCount !== 1 || scenario.trunkRawCount !== 1) failures.push(`${scenario.name}:raw-seam`)
    if (scenario.name === 'high-risk' && scenario.wakeCount !== 0) failures.push('high-risk:wake-count')
    if (scenario.name !== 'high-risk' && (scenario.wakeCount !== 1 || !scenario.wakeSource)) failures.push(`${scenario.name}:wake-source`)
    if (scenario.wakeContainsIdentity || scenario.wakeContainsForeign) failures.push(`${scenario.name}:wake-content`)
    const counts = { control: scenario.calls.filter((c) => c.role === 'control').length, director: scenario.calls.filter((c) => c.role === 'director').length, actor: scenario.calls.filter((c) => c.role === 'actor').length, retrieval: scenario.calls.filter((c) => c.role === 'retrieval').length }
    const expectedActorTools = scenario.name === 'knowledge' ? ['retrieve_quotes', 'fetch_quote', 'submit_actor_reply'] : ['submit_actor_reply']
    const actorCalls = scenario.calls.filter((c) => c.role === 'actor')
    if (scenario.name === 'high-risk' ? actorCalls.length !== 0 : actorCalls.some((call) => JSON.stringify([...call.tools].sort()) !== JSON.stringify([...expectedActorTools].sort()))) failures.push(`${scenario.name}:actor-tool-exposure`)
    if (counts.control !== scenario.controlCalls || counts.director !== scenario.directorCalls || counts.actor !== scenario.actorCalls) failures.push(`${scenario.name}:call-count-fields`)
    const scenarioTotal = scenario.calls.reduce((sum, call) => sum + usageFullTotal(call.usage), 0)
    if (scenarioTotal !== usageFullTotal(scenario.usage)) failures.push(`${scenario.name}:usage-not-sum`)
    if (scenario.calls.some((call) => !report.requests.some((request) => request.requestId === call.requestId && JSON.stringify(request) === JSON.stringify(call)))) failures.push(`${scenario.name}:calls-not-in-requests`)
    if (scenario.outputObservation.projectedReplyCount !== scenario.submitEvidence.accepted) failures.push(`${scenario.name}:projection-accepted`)
    if (scenario.name !== 'high-risk' && scenario.outputObservation.projectedReplyCount !== 1) failures.push(`${scenario.name}:projection-count`)
    if (scenario.name === 'high-risk' && (scenario.safety.disposition === 'allow' || scenario.safety.downstreamCalls !== 0 || scenario.calls.length !== 0)) failures.push('high-risk-downstream')
    if (scenario.name === 'high-risk' && scenario.eventOrder.some((e) => ['turn/start', 'step/start', 'tool/call', 'tool/result', 'assistant/message', 'assistant/chunk'].includes(e))) failures.push('high-risk-events')
    if (scenario.name === 'high-risk' && (scenario.submitEvidence.attempted !== 0 || scenario.submitEvidence.accepted !== 0 || scenario.outputObservation.projectedReplyCount !== 0)) failures.push('high-risk-submit-output')
    if (scenario.name === 'dilemma' && scenario.candidateStatuses.some((s) => s === 'confirmed')) failures.push('dilemma-auto-confirmed')
    if (scenario.name === 'cross-person' && (scenario.isolation.actorContextContainsForeignReply || scenario.isolation.actorContextContainsForeignProgress || scenario.isolation.actorContextContainsForeignCandidate || !scenario.isolation.candidateBeforeActor)) failures.push('cross-person-isolation')
    if (scenario.name === 'cross-person' && (!scenario.foreignFixtureEstablished || !scenario.foreignPersona || scenario.foreignPersona === scenario.personaId || scenario.foreignMarkerHashes.length !== 3)) failures.push('cross-person-fixture')
    if (scenario.name === 'cross-person' && Object.values(scenario.foreignLeaks).some((group) => Object.values(group).some(Boolean))) failures.push('cross-person-leak')
    if (scenario.name !== 'high-risk' && (scenario.submitEvidence.attempted < 1 || scenario.submitEvidence.accepted !== 1)) failures.push(`${scenario.name}:submit-output`)
    if (scenario.submitEvidence.rejected !== scenario.submitEvidence.attempted - scenario.submitEvidence.accepted) failures.push(`${scenario.name}:submit-correlation`)
    if (scenario.submitDiagnostics.length !== scenario.submitEvidence.attempted || scenario.submitDiagnostics.some((item, index) => item.attempt !== index + 1) || scenario.submitDiagnostics.filter((item) => item.accepted).length !== scenario.submitEvidence.accepted || scenario.submitDiagnostics.filter((item) => !item.accepted).length !== scenario.submitEvidence.rejected) failures.push(`${scenario.name}:submit-diagnostics`)
    const expectedRepairCount = scenario.submitEvidence.attempted > 1 ? 1 : 0
    if (scenario.submitEvidence.repairCount !== expectedRepairCount || scenario.submitEvidence.repairCount > 1 || scenario.questions.length > 2) failures.push(`${scenario.name}:submit-boundary`)
    if (scenario.turnPolicy === null && scenario.name !== 'high-risk') failures.push(`${scenario.name}:policy-missing`)
    if (scenario.turnPolicy && scenario.questions.length > scenario.turnPolicy.maxQuestions) failures.push(`${scenario.name}:policy-max-questions`)
    if (JSON.stringify(scenario.turnPolicy) !== JSON.stringify(expectedPhase7Task9TurnPolicy(scenario.name))) failures.push(`${scenario.name}:policy-snapshot`)
  }
  if (report.runMode === 'real') for (const scenario of report.scenarios) {
    if (scenario.name === 'high-risk' && scenario.calls.length !== 0) failures.push('real:high-risk-calls')
    if (scenario.name !== 'high-risk' && (scenario.controlCalls < 1 || scenario.controlCalls > 2 || scenario.actorCalls < 1 || scenario.actorCalls > 3 || scenario.submitEvidence.accepted !== 1)) failures.push(`${scenario.name}:real-call-bounds`)
    if (scenario.name === 'dilemma' && (scenario.directorCalls < 1 || scenario.directorCalls > 2 || !scenario.candidateStatuses.includes('candidate'))) failures.push('dilemma:real-director-candidate')
    if (scenario.retries > 2) failures.push(`${scenario.name}:real-retries`)
  }
  const personas = report.scenarios.map((s) => s.personaId)
  if (expectedPersonas.length > 0 && !personas.every((id) => expectedPersonas.includes(id))) failures.push('persona-set')
  return failures
}

export function readAttemptMarker(path: string): { attempts: number; runId: string } {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8')); const result = z.object({ schemaVersion: z.literal(1), attempts: z.number().int().nonnegative(), runId: z.string().min(1) }).strict().parse(parsed)
  return resul
}

/** Atomically claim the sole real batch. Existing markers are never replaced. */
export function claimSingleAttempt(path: string, runId: string): { attempts: 1; runId: string; sha256: string } {
  mkdirSync(dirname(path), { recursive: true })
  const payload = JSON.stringify({ schemaVersion: 1, runId, attempts: 1 }) + '\n'
  let fd: number
  try { fd = openSync(path, 'wx') } catch (error) {
    const existing = readAttemptMarker(path)
    throw new Error(`real batch already claimed: ${existing.runId} attempts=${existing.attempts}`)
  }
  try { writeFileSync(fd, payload, 'utf8') } finally { closeSync(fd) }
  return { attempts: 1, runId, sha256: sha256(payload) }
}
