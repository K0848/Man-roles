import type { Message } from '@deepseek-ai/dsh-llm'
import { buildContentLibraries } from '../retrieval/data.ts'
import { normalizeText } from '../retrieval/blacklist.ts'
export const NATIVE_SCENARIOS = ['dialogue', 'zeng-dialogue', 'historical_fact', 'verbatim_quote', 'adversarial', 'cross-person'] as const
export type ScenarioName = typeof NATIVE_SCENARIOS[number]
export interface Usage { input: number; output: number; cacheRead: number; cacheWrite: number; reasoning: number }
export interface ToolTrailEntry { type: 'call' | 'result'; name?: string; callId?: string; arguments?: string; isError?: boolean; renderedText?: string; payload?: unknown; meta?: unknown }
export interface CapturedRequest { sessionId: string; scenarioName?: string; system: string; messages: Message[]; tools: string[]; reasoningEffort?: string }
export interface ScenarioResult { name: string; persona: string; sessionId: string; usage: Usage; modelCalls: number; toolTrail: ToolTrailEntry[]; submitFailures: number; repairCount: number; directAssistantTextCount: number; turnEnded: boolean; startupRetryCount: number; latencyMs: number; productReply?: { reply: string; evidence: Array<{ id: string; kind: string; source: string; credibility?: string; title?: string }>; fallback?: boolean }; fabricatedQuoteText?: string; adversarialQuoteId?: string; foreignEvidenceText?: string; foreignEvidenceSource?: string; modelRefusedFabrication?: boolean; hardGateFailures: string[] }
export interface NativeEvidenceReport { runId: string; mode: 'real' | string; providerNetworkUsed: boolean; zeroCostRunId?: string | null; passedByZeroCostRunId?: string | null; expectedScenarios: string[]; completedScenarios: string[]; skippedScenarios: string[]; totalTokens: number; tokenLimit: number; requests: CapturedRequest[]; scenarios: ScenarioResult[]; estimatedReserved?: number; observedTokens?: number; costGuardMode?: string; hardGateFailures: string[]; generatedAt?: string }
const TOOLS = ['fetch_anecdote', 'fetch_quote', 'retrieve_anecdotes', 'retrieve_quotes', 'submit_actor_reply']
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const contains = (value: unknown, pattern: RegExp): boolean => pattern.test(JSON.stringify(value))
export function evaluateNativeEvidenceReport(report: NativeEvidenceReport): string[] {
  const failures: string[] = []
  const expectedScenarios = report.expectedScenarios ?? []
  const completedScenarios = report.completedScenarios ?? []
  const skippedScenarios = report.skippedScenarios ?? []
  const requests = report.requests ?? []
  const scenarios = report.scenarios ?? []
  const libraries = buildContentLibraries()
  if (report.mode !== 'real') failures.push('mode-not-real')
  if (!report.providerNetworkUsed) failures.push('provider-network-not-used')
  if (!(report.zeroCostRunId ?? report.passedByZeroCostRunId)) failures.push('zero-cost-run-id-missing')
  if (expectedScenarios.join('|') !== NATIVE_SCENARIOS.join('|')) failures.push('expected-scenarios-mismatch')
  const combined = [...completedScenarios, ...skippedScenarios]
  if (new Set(combined).size !== NATIVE_SCENARIOS.length || combined.some((name) => !NATIVE_SCENARIOS.includes(name as ScenarioName))) failures.push('scenario-set-incomplete')
  if (skippedScenarios.length > 0) failures.push('scenarios-skipped')
  if (completedScenarios.length !== NATIVE_SCENARIOS.length || new Set(completedScenarios).size !== completedScenarios.length) failures.push('completed-scenarios-incomplete')
  if (scenarios.length !== NATIVE_SCENARIOS.length || new Set(scenarios.map((scenario) => scenario.name)).size !== scenarios.length) failures.push('scenario-results-incomplete')
  failures.push(...(report.hardGateFailures ?? []).filter((failure) => !failures.includes(failure)))
  if (completedScenarios.some((name) => skippedScenarios.includes(name))) failures.push('scenario-overlap')
  const total = scenarios.reduce((sum, scenario) => sum + Object.values(scenario.usage).reduce((a, b) => a + b, 0), 0)
  if (total !== report.totalTokens) failures.push('token-sum-mismatch')
  if (report.totalTokens > report.tokenLimit || report.totalTokens > 20_000) failures.push('token-limit-exceeded')
  if (!requests.length) failures.push('requests-missing')
  for (const request of requests) {
    if ([...request.tools].sort().join('|') !== [...TOOLS].sort().join('|')) failures.push('request-tools-mismatch')
    if (request.reasoningEffort !== 'off') failures.push('request-reasoning-effort-mismatch')
    if (contains(request, /agent-instructions|AGENTS\.md|sandbox|terminal|coding agent|file editing/i)) failures.push('request-unsafe-context')
    const scenario = scenarios.find((item) => item.sessionId === request.sessionId)
    if (scenario) {
      if (!(request.system ?? '').includes(`[MAN_ROLES_PERSONA=${scenario.persona}]`)) failures.push(`${scenario.name}:request-persona-missing`)
      const marker = /\[MAN_ROLES_PERSONA=([^\]]+)\]/.exec(request.system ?? '')?.[1]
      if (marker !== undefined && marker !== scenario.persona) failures.push(`${scenario.name}:request-foreign-persona`)
      if (scenario.foreignEvidenceText && contains(request, new RegExp(scenario.foreignEvidenceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))) failures.push(`${scenario.name}:request-foreign-text-leak`)
      if (scenario.foreignEvidenceSource && contains(request, new RegExp(scenario.foreignEvidenceSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))) failures.push(`${scenario.name}:request-foreign-source-leak`)
    }
  }
  const byName = new Map(scenarios.map((scenario) => [scenario.name, scenario]))
  for (const name of NATIVE_SCENARIOS) {
    const scenario = byName.get(name)
    if (!scenario) { failures.push(`${name}:missing`); continue }
    if (!scenario.turnEnded) failures.push(`${name}:turn-end-missing`)
    if (!scenario.productReply) failures.push(`${name}:product-reply-missing`)
    const scenarioRequests = requests.filter((request) => request.sessionId === scenario.sessionId)
    if (scenarioRequests.length === 0) failures.push(`${name}:request-missing`)
    if (scenarioRequests.some((request) => request.scenarioName !== name)) failures.push(`${name}:request-scenario-mismatch`)
    if (!Number.isInteger(scenario.startupRetryCount) || scenario.startupRetryCount < 0 || scenario.startupRetryCount > 30) failures.push(`${name}:startup-retry-invalid`)
    if (scenario.toolTrail.some((entry) => entry.type === 'result' && typeof entry.isError !== 'boolean')) failures.push(`${name}:result-error-state-missing`)
    const calls = scenario.toolTrail.filter((entry) => entry.type === 'call').map((entry) => entry.name)
    const expectedMaxCalls = name === 'dialogue' || name === 'zeng-dialogue' ? 1 : name === 'adversarial' ? 4 : 3
    if (scenario.modelCalls > expectedMaxCalls) failures.push(`${name}:call-bound-exceeded`)
    if ((name === 'dialogue' || name === 'zeng-dialogue') && (calls.some((tool) => tool !== 'submit_actor_reply') || (scenario.productReply?.evidence.length ?? 0) > 0)) failures.push(`${name}:dialogue-gate`)
    if (name === 'historical_fact' && (!(calls.join('|') === 'fetch_anecdote|submit_actor_reply') || !scenario.productReply?.evidence.length || scenario.productReply.evidence.some((e) => { const item = libraries.anecdotes.byPersona(scenario.persona).find((candidate) => candidate.id === e.id); return e.kind !== 'anecdote' || !item || item.personaId !== scenario.persona || item.source !== e.source || item.title !== e.title }))) failures.push('historical_fact:evidence-gate')
    if (name === 'verbatim_quote' && (!calls.some((tool) => tool === 'retrieve_quotes' || tool === 'fetch_quote') || !scenario.productReply?.evidence.length || scenario.productReply.evidence.some((e) => { const item = libraries.quotes.byPersona(scenario.persona).find((candidate) => candidate.id === e.id); return e.kind !== 'quote' || !item || item.personaId !== scenario.persona || item.source !== e.source || item.credibility !== e.credibility || typeof scenario.productReply?.reply !== 'string' || !normalizeText(scenario.productReply.reply).includes(normalizeText(item.text)) }))) failures.push('verbatim_quote:evidence-gate')
    if (name === 'adversarial' && (!scenario.modelRefusedFabrication || scenario.submitFailures > 1 || scenario.repairCount > 1 || (scenario.submitFailures === 1 && scenario.repairCount !== 1) || (scenario.fabricatedQuoteText && scenario.productReply?.reply.includes(scenario.fabricatedQuoteText)) || (scenario.adversarialQuoteId && scenario.productReply?.evidence.some((e) => e.id === scenario.adversarialQuoteId)))) failures.push('adversarial:gate')
    if (name === 'adversarial' && (!calls.includes('submit_actor_reply') || scenario.submitFailures !== 1 || scenario.repairCount !== 1)) failures.push('adversarial:repair-sequence')
    if (name === 'cross-person' && (!scenario.toolTrail.some((entry) => entry.type === 'result' && entry.name === 'fetch_quote' && isRecord(entry.payload) && entry.payload.ok === false && /人物|围栏|persona/i.test(JSON.stringify(entry.payload.error ?? entry.payload.violations ?? entry.payload))) || (scenario.foreignEvidenceText ? contains(scenario.toolTrail, new RegExp(scenario.foreignEvidenceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))) || contains(scenario.productReply, new RegExp(scenario.foreignEvidenceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))) : false) || (scenario.foreignEvidenceSource ? contains(scenario.toolTrail, new RegExp(scenario.foreignEvidenceSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))) || contains(scenario.productReply, new RegExp(scenario.foreignEvidenceSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))) : false))) failures.push('cross-person:fence-gate')
    if (name === 'cross-person' && (calls.filter((tool) => tool === 'fetch_quote').length !== 1 || calls.some((tool) => tool === 'retrieve_quotes' || tool === 'retrieve_anecdotes'))) failures.push('cross-person:call-sequence')
  }
  return failures
}
