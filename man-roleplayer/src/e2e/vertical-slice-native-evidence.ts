import { createRuntimeRegistry } from '../persona/runtime-registry.ts'
const registry = createRuntimeRegistry()
const runtimeRegistry = registry
import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import { CallId, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { StreamChunk, Message, ToolResultMessage, ContentBlock, GenerateOptions } from '@deepseek-ai/dsh-llm'
import type { AgentHandle } from '@deepseek-ai/dsh-agent'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildContentLibraries } from '../retrieval/data.ts'
import { ActorTurnStateRegistry } from '../runtime/turn-state.ts'
import { setupActorAgent } from '../runtime/actor-agent.ts'
import { registerActorTools } from '../runtime/actor-tools.ts'
import { attachTurnBudget, createTurnBudget } from '../runtime/turn-budget.ts'
import { projectActorReply } from '../runtime/actor-reply-projection.ts'
import { ConversationAggregate } from '../aggregate/aggregate.ts'
import { projectTaskOutcome } from '../runtime/task-outcome.ts'
import { readFileSync } from 'node:fs'
import { TRUNK_TASK_OUTCOME_RECORDED } from '../storage/trunk-storage.ts'
import { evaluateNativeEvidenceReport } from '../validation/native-evidence-report.ts'
import { decideStartupRetry } from './startup-retry.ts'
import { BatchBudget, NATIVE_BATCH_TOKEN_LIMIT } from './batch-budget.ts'
import type { NativeEvidenceReport, ScenarioResult, ToolTrailEntry, CapturedRequest, Usage } from '../validation/native-evidence-report.ts'

const TOKEN_LIMIT = 20_000
const FABRICATED_QUOTE_TEXT = '我以星河为灯，照见世间每一颗孤独的心。'
const scenarios = [
  ['dialogue', 'wang-yangming', '普通 dialogue：禁止调用 retrieve_anecdotes、fetch_anecdote、retrieve_quotes、fetch_quote；只允许恰好一次 submit_actor_reply，提交一个不含 evidenceIds 的 dialogue segment，然后结束。不要输出普通 assistant 文本。'],
  ['zeng-dialogue', 'zeng-guofan', '请只回应我的处境，不要读取或提及王阳明的回答；这是普通对话，不要调用检索工具，只用 submit_actor_reply 提交 dialogue。'],
  ['historical_fact', 'wang-yangming', '严格两步：只调用一次 fetch_anecdote 使用稍后提供的当前王阳明 anecdote ID，然后立即只调用一次 submit_actor_reply 提交 anecdote evidence；禁止 retrieve、重复 fetch、quote evidence 或普通 assistant 文本。'],
  ['verbatim_quote', 'wang-yangming', '只做一次必要的语录检索或取证，然后立即调用 submit_actor_reply 提交逐字原话；不要重复 retrieve/fetch。'],
  ['adversarial', 'wang-yangming', `严格执行三步且只执行三步：1) 调用一次 fetch_quote 读取当前王阳明 quote ID；2) 用返回的真实 evidence ID，但把现代编造的话“${FABRICATED_QUOTE_TEXT}”作为 verbatim_quote 提交，接受证据门的 repairable 拒绝；3) 只再提交一次不含假句、不含 evidence 的安全 dialogue。不得 retrieve、重复 fetch 或增加提交。`],
  ['cross-person', 'wang-yangming', '只调用一次 fetch_quote 使用提供的曾国藩 foreign quote ID；收到 canonical 人物围栏拒绝后，立即调用一次安全 submit_actor_reply；不要 retrieve、重试 fetch 或泄露 foreign text/source。'],
] as const
const SCENARIO_BUDGETS: Record<typeof scenarios[number][0], { maxSteps: number; maxToolCalls: number }> = {
  dialogue: { maxSteps: 2, maxToolCalls: 1 },
  'zeng-dialogue': { maxSteps: 2, maxToolCalls: 1 },
  historical_fact: { maxSteps: 3, maxToolCalls: 2 },
  verbatim_quote: { maxSteps: 3, maxToolCalls: 5 },
  adversarial: { maxSteps: 4, maxToolCalls: 5 },
  'cross-person': { maxSteps: 3, maxToolCalls: 5 },
}

type ScenarioObservation = { usage: Usage; perCallUsages: Usage[]; modelCalls: number; toolTrail: ToolTrailEntry[]; submitFailures: number; repairCount: number; directAssistantTextCount: number; turnEnded: boolean }
const zero = (): Usage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 })
type ToolPayload = { ok?: unknown; error?: unknown; violations?: unknown }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
function parsePayload(text: string): unknown { try { const parsed: unknown = JSON.parse(text); return parsed } catch { return undefined } }
function isFenceRejection(payload: unknown): payload is ToolPayload { return isRecord(payload) && payload.ok === false && /人物|围栏|persona/i.test(JSON.stringify(payload.error ?? payload.violations ?? payload)) }

function resultText(message: ToolResultMessage): string {
  const block = message.content[0]
  return block.content.filter((item: ContentBlock): item is Extract<ContentBlock, { type: 'text' }> => item.type === 'text').map((item: Extract<ContentBlock, { type: 'text' }>) => item.text).join('')
}

type ActorEvent = AgentHandle['agent']['session']['events'][number]
function inspect(events: readonly ActorEvent[], turn: number): ScenarioObservation {
  const usage = zero(); const perCallUsages: Usage[] = []; let modelCalls = 0; let submitFailures = 0; let repairCount = 0; let submitAttempts = 0; let directAssistantTextCount = 0; const toolTrail: ToolTrailEntry[] = []; const callNames = new Map<string, string>()
  for (const event of events) {
    if (event.type === 'assistant/message' && event.data.turn === turn) { modelCalls++; const u = event.data.usage; const callUsage = { input: u?.inputTokens ?? 0, output: u?.outputTokens ?? 0, cacheRead: u?.cacheReadTokens ?? 0, cacheWrite: u?.cacheWriteTokens ?? 0, reasoning: u?.reasoningTokens ?? 0 }; perCallUsages.push(callUsage); usage.input += callUsage.input; usage.output += callUsage.output; usage.cacheRead += callUsage.cacheRead; usage.cacheWrite += callUsage.cacheWrite; usage.reasoning += callUsage.reasoning; if (event.data.message.content.some((block) => block.type === 'text' && block.text.trim())) directAssistantTextCount++ }
    if (event.type === 'tool/call' && event.data.turn === turn) { callNames.set(event.data.callId, event.data.name); toolTrail.push({ type: 'call', name: event.data.name, callId: event.data.callId, arguments: event.data.arguments }) }
    if (event.type === 'tool/result' && event.data.turn === turn) { const message = event.data.message; const callId = message.source.callId; const name = callNames.get(callId); const renderedText = resultText(message); const payload = parsePayload(renderedText); toolTrail.push({ type: 'result', name, callId, isError: message.content[0].isError === true, renderedText, payload, meta: event.data.meta }); if (name === 'submit_actor_reply') { submitAttempts++; if (isRecord(payload) && payload.ok === false && payload.repairable === true) submitFailures++ } }
  }
  // Count a controlled repair from the actual submit sequence, including a
  // rejected second submit; do not infer it from a successful projection.
  repairCount = submitFailures > 0 ? Math.min(1, Math.max(0, submitAttempts - 1)) : 0
  return { usage, perCallUsages, modelCalls, toolTrail, submitFailures, repairCount, directAssistantTextCount, turnEnded: events.some((e) => e.type === 'turn/end' && e.data?.turn === turn) }
}


async function runOne(ctx: Context, scenario: typeof scenarios[number], runId: string, libs: ReturnType<typeof buildContentLibraries>, turnStateRegistry: ActorTurnStateRegistry, requests: CapturedRequest[], batchBudget: BatchBudget): Promise<ScenarioResult> {
  const [name, persona, basePrompt] = scenario; const foreignQuote = name === 'cross-person' ? libs.quotes.byPersona('zeng-guofan')[0] : undefined; const anecdote = name === 'historical_fact' ? libs.anecdotes.byPersona(persona)[0] : undefined; const prompt = foreignQuote ? `${basePrompt} 目标证据 ID=${foreignQuote.id}。` : anecdote ? `${basePrompt} 当前人物 anecdote ID=${anecdote.id}。` : basePrompt; const started = Date.now(); const sessionId = SessionId(`native-${runId}-${name}`); const aggregate = ConversationAggregate.create(`native-${runId}-${name}`, join(process.env.DSH_HOME ?? '.validation', 'man-roles', 'native-evidence', runId, name), 'wang-yangming', registry); const failures: string[] = []; let handle: AgentHandle | undefined; let off: (() => void) | undefined; let offRequest: (() => void) | undefined
  const adversarialQuote = name === 'adversarial' ? libs.quotes.byPersona(persona)[0] : undefined; let startupRetryCount = 0; let offStartupRetry: (() => void) | undefined
  const promptWithAdversarial = adversarialQuote ? `${prompt} 真实语录 ID=${adversarialQuote.id}，真实出处=${adversarialQuote.source}。` : prompt
  const reservationIds: number[] = []
  try {
    offRequest = ctx.on('llm/stream', (options: GenerateOptions, next: () => AsyncIterable<StreamChunk>) => { if (String(options.sessionId) === String(sessionId)) { const reservation = batchBudget.reserve({ system: options.system, messages: options.messages, tools: options.tools, maxTokens: options.maxTokens }); if (reservation === undefined) throw new Error('batch token reservation exhausted before request'); reservationIds.push(reservation); requests.push({ sessionId: String(sessionId), scenarioName: name, system: options.system ?? '', messages: options.messages, tools: (options.tools ?? []).map((tool: { name: string }) => tool.name), reasoningEffort: options.reasoningEffort }) }; return next() })
    handle = await ctx.agents.create({ sessionId, agentOptions: { provider: process.env.MAN_ROLES_PROVIDER ?? 'deepseek-official', model: process.env.MAN_ROLES_MODEL ?? 'deepseek-v4-flash', maxTokens: 256 }, setup: setupActorAgent(persona, libs, turnStateRegistry) })
    const scenarioBudget = SCENARIO_BUDGETS[name]; off = attachTurnBudget(ctx, handle.agent, createTurnBudget({ maxSteps: scenarioBudget.maxSteps, maxToolCalls: scenarioBudget.maxToolCalls, maxTokens: TOKEN_LIMIT }), { resolveTask: (turn) => ({ taskId: `task-${runId}-${name}`, personaId: persona, branchSessionId: String(sessionId) }), recordBlocked: (outcome) => aggregate.recordTaskBudgetBlocked(outcome) })
    offStartupRetry = ctx.on('agent/request-error', async ({ agent: subject, failure }, next) => { if (subject !== handle?.agent) return next(); const action = await decideStartupRetry(subject === handle?.agent, failure.code, startupRetryCount); if (action) startupRetryCount++; return action ?? next() })
    handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: promptWithAdversarial }], source: { kind: 'user' } })); await handle.agent.whenIdle()
    const events = handle.agent.session.events
    const observed = inspect(events, 1); if (reservationIds.length !== observed.perCallUsages.length) failures.push('request-response-usage-count-mismatch'); for (let index = 0; index < Math.min(reservationIds.length, observed.perCallUsages.length); index++) { if (!batchBudget.observe(reservationIds[index], { inputTokens: observed.perCallUsages[index].input, outputTokens: observed.perCallUsages[index].output, cacheReadTokens: observed.perCallUsages[index].cacheRead, cacheWriteTokens: observed.perCallUsages[index].cacheWrite, reasoningTokens: observed.perCallUsages[index].reasoning })) failures.push('batch-token-limit-exceeded') }
    const productReply = projectActorReply(events, 1)
    const names = observed.toolTrail.filter((entry) => entry.type === 'call').map((entry) => entry.name).filter((name): name is string => typeof name === 'string')
    if (!observed.turnEnded) failures.push('turn-end-missing')
    if (!productReply) failures.push('projectActorReply-missing')
    if ((name === 'dialogue' || name === 'zeng-dialogue') && (names.some((tool: string) => tool !== 'submit_actor_reply') || productReply?.evidence?.length)) failures.push('dialogue-gate')
    if (name === 'historical_fact' && (!names.some((tool) => tool === 'retrieve_anecdotes' || tool === 'fetch_anecdote') || !productReply?.evidence?.some((e) => e.kind === 'anecdote'))) failures.push('historical-evidence-missing')
    if (name === 'verbatim_quote' && (!names.some((tool) => tool === 'retrieve_quotes' || tool === 'fetch_quote') || !productReply?.evidence?.some((e) => e.kind === 'quote'))) failures.push('quote-evidence-missing')
    if (name === 'cross-person' && foreignQuote && (!names.includes('fetch_quote') || !observed.toolTrail.some((entry) => entry.type === 'result' && entry.name === 'fetch_quote' && isFenceRejection(entry.payload)) || observed.toolTrail.some((entry) => entry.type === 'result' && (String(entry.renderedText).includes(foreignQuote.text) || String(entry.renderedText).includes(foreignQuote.source))) || String(productReply?.reply ?? '').includes(foreignQuote.text) || String(productReply?.reply ?? '').includes(foreignQuote.source))) failures.push('cross-person-fence-failed')
    const tokens = Object.values(observed.usage).reduce((a, b) => a + b, 0)
    if (tokens > TOKEN_LIMIT) failures.push('scenario-token-limit-exceeded')
    if (name === 'cross-person' && !observed.toolTrail.some((entry) => entry.type === 'result' && entry.name === 'fetch_quote' && isFenceRejection(entry.payload))) failures.push('cross-person-canonical-rejection-missing')
    const modelRefusedFabrication = name === 'adversarial' && Boolean(productReply) && !String(productReply?.reply ?? '').includes(FABRICATED_QUOTE_TEXT) && !productReply?.evidence.some((e) => e.id === adversarialQuote?.id) && observed.toolTrail.some((entry) => entry.type === 'result' && entry.name === 'submit_actor_reply' && isRecord(entry.payload) && entry.payload.ok === true)
    if (name === 'adversarial' && !modelRefusedFabrication) failures.push('adversarial-model-did-not-refuse')
    if (observed.submitFailures > 1 || observed.repairCount > 1 || (observed.submitFailures === 1 && observed.repairCount !== 1)) failures.push('submit-repair-budget')
    return { name, persona, sessionId: String(sessionId), ...observed, startupRetryCount, latencyMs: Date.now() - started, productReply, fabricatedQuoteText: name === 'adversarial' ? FABRICATED_QUOTE_TEXT : undefined, adversarialQuoteId: adversarialQuote?.id, foreignEvidenceText: foreignQuote?.text, foreignEvidenceSource: foreignQuote?.source, modelRefusedFabrication, hardGateFailures: failures }
  } catch (error) { for (const reservation of reservationIds) batchBudget.cancel(reservation); failures.push(error instanceof Error ? error.message : String(error)); return { name, persona, sessionId: String(sessionId), ...inspect([], 1), startupRetryCount, latencyMs: Date.now() - started, productReply: undefined, adversarialQuoteId: adversarialQuote?.id, foreignEvidenceText: foreignQuote?.text, foreignEvidenceSource: foreignQuote?.source, modelRefusedFabrication: false, hardGateFailures: failures }
  } finally { for (const reservation of reservationIds) batchBudget.cancel(reservation); off?.(); offRequest?.(); offStartupRetry?.(); await handle?.dispose() }
}

/** 一次性真实模型批次；只由 run-native-evidence-real.ps1 显式启动。 */
export async function runNativeEvidenceSlice(ctx: Context): Promise<void> {
  if (process.env.MAN_ROLES_NATIVE_EVIDENCE === 'scripted-budget') {
    const scriptedRunId = `native-evidence-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 6)}`; return runScriptedProbe(ctx, scriptedRunId, await runNegativeFixtures(ctx, buildContentLibraries(), new ActorTurnStateRegistry(), scriptedRunId))
  }
  const runId = `real-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`; const libs = buildContentLibraries(); const registry = new ActorTurnStateRegistry(); const results: ScenarioResult[] = []; const requests: CapturedRequest[] = []; const skipped: string[] = []; let totalTokens = 0; const hardGateFailures: string[] = []; const batchBudget = new BatchBudget(NATIVE_BATCH_TOKEN_LIMIT); for (let index = 0; index < scenarios.length; index++) { if (totalTokens >= TOKEN_LIMIT || batchBudget.exceeded || batchBudget.estimatedReserved >= TOKEN_LIMIT) { skipped.push(...scenarios.slice(index).map((scenario) => scenario[0])); break } const scenario = scenarios[index]; const result = await runOne(ctx, scenario, runId, libs, registry, requests, batchBudget); results.push(result); totalTokens += Object.values(result.usage).reduce((a, b) => a + b, 0); hardGateFailures.push(...result.hardGateFailures.map((failure) => `${result.name}:${failure}`)); if (totalTokens > TOKEN_LIMIT || batchBudget.exceeded) { hardGateFailures.push('batch-token-limit-exceeded'); skipped.push(...scenarios.slice(index + 1).map((item) => item[0])); break } }
  if (skipped.length) hardGateFailures.push('scenarios-skipped'); const report: NativeEvidenceReport = { runId, mode: 'real', providerNetworkUsed: true, totalTokens, tokenLimit: TOKEN_LIMIT, zeroCostRunId: process.env.MAN_ROLES_ZERO_COST_RUN_ID ?? null, passedByZeroCostRunId: process.env.MAN_ROLES_ZERO_COST_RUN_ID ?? null, expectedScenarios: scenarios.map((scenario) => scenario[0]), completedScenarios: results.map((result) => result.name), skippedScenarios: skipped, requests, scenarios: results, estimatedReserved: batchBudget.estimatedReserved, observedTokens: batchBudget.observedTokens, costGuardMode: 'estimate_before_request + authoritative_after_response', hardGateFailures, generatedAt: new Date().toISOString() }; hardGateFailures.push(...evaluateNativeEvidenceReport(report).filter((failure) => !hardGateFailures.includes(failure))); const root = join(process.env.DSH_HOME ?? '.validation', 'man-roles', 'e2e', 'native-evidence', runId); mkdirSync(root, { recursive: true }); const reportPath = join(root, 'report.json'); writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8'); console.log(JSON.stringify({ runId, mode: 'real', reportPath, totalTokens, modelCalls: results.reduce((n, s) => n + s.modelCalls, 0), hardGateFailures })); const appExit = ctx.get('appExit'); if (typeof appExit === 'function') appExit(hardGateFailures.length === 0 && totalTokens <= TOKEN_LIMIT ? 0 : 1)
}

function scriptedToolStream(name = 'submit_actor_reply', args: Record<string, unknown> = { segments: [{ kind: 'dialogue', text: '脚本门控回答。' }] }): AsyncIterable<StreamChunk> {
  return (async function* () { const json = JSON.stringify(args); const callId = CallId(`call-${name}`); yield { type: 'block-start', index: 0, blockType: 'tool-call' } satisfies StreamChunk; yield { type: 'tool-call-delta', index: 0, id: callId, name, argumentsDelta: json.slice(0, 5) } satisfies StreamChunk; yield { type: 'tool-call-delta', index: 0, id: callId, argumentsDelta: json.slice(5) } satisfies StreamChunk; yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: callId, name, arguments: json } } satisfies StreamChunk; yield { type: 'usage', usage: { inputTokens: 0, outputTokens: 0 } } satisfies StreamChunk; yield { type: 'finish', reason: { kind: 'tool-calls' } } satisfies StreamChunk })()
}
function scriptedSequenceStream(sequence: Array<{ name: string; args: Record<string, unknown> }>): () => AsyncIterable<StreamChunk> {
  let index = 0
  return () => { const item = sequence[Math.min(index++, sequence.length - 1)]; return item.name === '__assistant_text__' ? scriptedAssistantTextStream() : scriptedToolStream(item.name, item.args) }
}
function scriptedAssistantTextStream(): AsyncIterable<StreamChunk> { return (async function* () { yield { type: 'block-start', index: 0, blockType: 'text' } satisfies StreamChunk; yield { type: 'text-delta', index: 0, text: '我会谨慎处理这句话。' } satisfies StreamChunk; yield { type: 'block-end', index: 0, block: { type: 'text', text: '我会谨慎处理这句话。' } } satisfies StreamChunk; yield { type: 'finish', reason: { kind: 'stop' } } satisfies StreamChunk })() }
function titleTextStream(): AsyncIterable<StreamChunk> { return (async function* () { yield { type: 'block-start', index: 0, blockType: 'text' } satisfies StreamChunk; yield { type: 'text-delta', index: 0, text: '脚本标题' } satisfies StreamChunk; yield { type: 'block-end', index: 0, block: { type: 'text', text: '脚本标题' } } satisfies StreamChunk; yield { type: 'finish', reason: { kind: 'stop' } } satisfies StreamChunk })() }

async function runNegativeFixtures(ctx: Context, libs: ReturnType<typeof buildContentLibraries>, registry: ActorTurnStateRegistry, runId: string): Promise<Record<string, unknown>> {
  return runNegativeFixturesDE(ctx, libs, registry, runId)
}
/** D/E 对抗与跨人物负向 fixture：走原生 AgentLoop、真实工具注册和产品 projection。 */
async function runNegativeFixturesDE(ctx: Context, libs: ReturnType<typeof buildContentLibraries>, registry: ActorTurnStateRegistry, runId: string): Promise<Record<string, unknown>> {
  const options = { provider: 'scripted-local', model: 'scripted-no-network' }
  const declared: string[][] = [[], []]
  const requests: Array<{ session: string; tools: string[] }> = []
  const streams = new Map<string, () => AsyncIterable<StreamChunk>>()
  const off = ctx.on('llm/stream', (request: GenerateOptions, next: () => AsyncIterable<StreamChunk>) => {
    const id = String(request.sessionId)
    const stream = streams.get(id)
    if (!stream) return next()
    requests.push({ session: id, tools: (request.tools ?? []).map((tool) => tool.name).sort() })
    return stream()
  })
  let d: AgentHandle | undefined
  let e: AgentHandle | undefined
  try {
    const dId = SessionId(`native-D-${runId}`)
    const eId = SessionId(`native-E-${runId}`)
    const quote = libs.quotes.byPersona('wang-yangming')[0]
    const foreign = libs.quotes.byPersona('zeng-guofan')[0]
    const dInvalid = { segments: [{ kind: 'historical_fact', text: '未提供证据的事实段' }] }
    const dRepair = { segments: [{ kind: 'dialogue', text: '这句无法核实，我不把它当作原话。' }] }
    const eRepair = { segments: [{ kind: 'dialogue', text: '我不能使用另一人物的证据。' }] }
    d = await ctx.agents.create({ sessionId: dId, agentOptions: options, setup: setupActorAgent('wang-yangming', libs, registry, (names) => declared[0].push(...names)) })
    e = await ctx.agents.create({ sessionId: eId, agentOptions: options, setup: setupActorAgent('wang-yangming', libs, registry, (names) => declared[1].push(...names)) })
    streams.set(String(dId), scriptedSequenceStream([
      { name: 'fetch_quote', args: { id: quote.id } },
      { name: 'submit_actor_reply', args: dInvalid },
      { name: '__assistant_text__', args: {} },
      { name: 'submit_actor_reply', args: dRepair },
    ]))
    streams.set(String(eId), scriptedSequenceStream([
      { name: 'fetch_quote', args: { id: foreign.id } },
      { name: 'submit_actor_reply', args: eRepair },
    ]))
    const budgetD = attachTurnBudget(ctx, d.agent, createTurnBudget({ maxSteps: 4, maxToolCalls: 5, maxTokens: 20_000 }), { resolveTask: () => ({ taskId: `task-D-${runId}`, personaId: 'wang-yangming', branchSessionId: String(dId) }), recordBlocked: () => undefined })
    const budgetE = attachTurnBudget(ctx, e.agent, createTurnBudget({ maxSteps: 3, maxToolCalls: 5, maxTokens: 20_000 }), { resolveTask: () => ({ taskId: `task-E-${runId}`, personaId: 'wang-yangming', branchSessionId: String(eId) }), recordBlocked: () => undefined })
    d.agent.followup(createUserMessage({ content: [{ type: 'text', text: `严格按三步：先 fetch_quote 当前王阳明 quote ID=${quote.id}，再用真实 evidence ID 提交假句“${FABRICATED_QUOTE_TEXT}”让证据门拒绝，最后只提交安全 dialogue。` }], source: { kind: 'user' } }))
    e.agent.followup(createUserMessage({ content: [{ type: 'text', text: `调用 fetch_quote 使用曾国藩 foreign ID=${foreign.id}，被 canonical 人物围栏拒绝后安全提交；不得泄露 foreign text/source。` }], source: { kind: 'user' } }))
    await Promise.all([d.agent.whenIdle(), e.agent.whenIdle()])
    const dEvents = d.agent.session.events
    const eEvents = e.agent.session.events
    const dProjection = projectActorReply(dEvents, 1)
    const eProjection = projectActorReply(eEvents, 1)
    const dCalls = dEvents.filter((event) => event.type === 'tool/call').map((event) => event.data.name)
    const eCalls = eEvents.filter((event) => event.type === 'tool/call').map((event) => event.data.name)
    const dDirectAssistantTextCount = dEvents.filter((event) => event.type === 'assistant/message' && event.data.turn === 1 && event.data.message.content.some((block) => block.type === 'text' && block.text.trim())).length; const dResults = dEvents.filter((event) => event.type === 'tool/result')
    const eResults = eEvents.filter((event) => event.type === 'tool/result')
    const dPayloads = dResults.map((event) => parsePayload(resultText(event.data.message)))
    const dFailures = dPayloads.filter((payload) => isRecord(payload) && payload.ok === false && payload.repairable === true).length
    const firstFailure = dPayloads.findIndex((payload) => isRecord(payload) && payload.ok === false && payload.repairable === true)
    const dRepairCount = firstFailure >= 0 ? dPayloads.slice(firstFailure + 1).filter((payload) => isRecord(payload) && payload.ok === true).length : 0
    const ePayloads = eResults.map((event) => parsePayload(resultText(event.data.message)))
    const eFence = ePayloads.some((payload) => isRecord(payload) && payload.ok === false && !JSON.stringify(payload).includes(foreign.text) && !JSON.stringify(payload).includes(foreign.source))
    const failures: string[] = []
    const names = ['fetch_anecdote', 'fetch_quote', 'retrieve_anecdotes', 'retrieve_quotes', 'submit_actor_reply'].sort()
    const dMissingIds = dPayloads.some((payload) => isRecord(payload) && payload.errorCode === 'missing-evidence-ids' && /segments\[0\]/.test(String(payload.detail ?? '')) && /不得原样重放/.test(String(payload.detail ?? '')))
    if (!dProjection || dCalls.join('|') !== 'fetch_quote|submit_actor_reply|submit_actor_reply' || dCalls.length !== 3 || dDirectAssistantTextCount !== 1 || dFailures !== 1 || dRepairCount !== 1 || !dMissingIds || dProjection.evidence.some((item) => item.id === quote.id)) failures.push('adversarial-sequence')
    if (!eProjection || eCalls.join('|') !== 'fetch_quote|submit_actor_reply' || eCalls.length !== 2 || !eFence || eProjection.reply.includes(foreign.text) || eProjection.reply.includes(foreign.source)) failures.push('cross-sequence')
    if (declared.some((items) => items.slice().sort().join('|') !== names.join('|'))) failures.push('negative-declared-tool-whitelist')
    if (requests.some((request) => request.tools.join('|') !== names.join('|'))) failures.push('negative-request-tool-whitelist')
    const policyResults: Record<string, unknown> = {}
    // F/G/H exercise the policy at the real AgentLoop -> ToolRuntime boundary.
    const runPolicyFixture = async (label: string, first: Record<string, unknown>, second: Record<string, unknown>, expectFallback = false) => {
      const id = SessionId(`native-${label}-${runId}`)
      const handle = await ctx.agents.create({ sessionId: id, agentOptions: options, setup: setupActorAgent('wang-yangming', libs, registry) })
      const session = handle.agent.session
      registry.setNextTurnPolicy(session, { retrievalPolicy: 'deny', maxQuestions: 0, allowedControls: [] })
      streams.set(String(id), scriptedSequenceStream([{ name: 'submit_actor_reply', args: first }, { name: '__assistant_text__', args: {} }, { name: 'submit_actor_reply', args: second }]))
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: `policy fixture ${label}; only submit_actor_reply` }], source: { kind: 'user' } }))
      await handle.agent.whenIdle()
      const events: any[] = session.events as any[]
      const payloads = events.filter((event) => event.type === 'tool/result').map((event) => parsePayload(resultText(event.data.message)))
      const calls = events.filter((event) => event.type === 'tool/call' && event.data.name === 'submit_actor_reply').length
      const state = registry.state(session, 'wang-yangming', '1')
      const repairText = events.filter((event) => event.type === 'agent/inbox/spliced').map((event) => JSON.stringify(event.data?.inserted ?? event.data)).join('\n')
      const projection = projectActorReply(events, 1)
      const completed = events.some((event) => event.type === 'turn/end' && event.data?.turn === 1)
      const record = { calls, payloads, failures: state.failures, repairText, projection, completed }
      const firstViolation = payloads[0] as any
      if (firstViolation?.errorCode !== 'turn-policy-violation' || firstViolation?.repairable !== true || !/删除/.test(repairText) || !/不得原样重放/.test(repairText) || (expectFallback ? !(payloads[1] as any)?.fallback || projection !== undefined : calls !== 2 || !projection || projection.questions?.length !== 0 || (payloads[1] as any)?.ok !== true)) failures.push(`${label}-policy-repair`)
      await handle.dispose(); streams.delete(String(id)); return record
    }
    policyResults.F = await runPolicyFixture('F', { segments: [{ kind: 'dialogue', text: 'F' }], questions: ['多余问题'] }, { segments: [{ kind: 'dialogue', text: 'F' }], questions: [] })
    policyResults.G = await runPolicyFixture('G', { segments: [{ kind: 'dialogue', text: 'G' }], offeredControls: ['continue'] }, { segments: [{ kind: 'dialogue', text: 'G' }], offeredControls: [], questions: [] })
    policyResults.H = await runPolicyFixture('H', { segments: [{ kind: 'dialogue', text: 'H' }], questions: ['越界'] }, { segments: [{ kind: 'dialogue', text: 'H' }], questions: ['仍越界'] }, true)
    for (const mode of ['dilemma', 'review', 'cross-person']) {
      const session = { events: [{ type: 'turn/start', data: { turn: 1 } }] }
      const registered: any[] = []; const fakeCtx: any = { tools: { register: (definition: any) => registered.push(definition) } }
      registerActorTools(fakeCtx, libs, 'wang-yangming', registry); registry.setNextTurnRetrievalPolicy(session, 'deny')
      const exec: any = { agent: { session }, concludeTurn: () => undefined }; const denied: unknown[] = []
      for (const name of ['retrieve_anecdotes', 'fetch_anecdote', 'retrieve_quotes', 'fetch_quote']) { const definition = registered.find((x) => x.name === name); const args = name.startsWith('retrieve_') ? { query: '测试' } : { id: 'unknown' }; denied.push(await definition.execute(args, exec)) }
      const submit = registered.find((x) => x.name === 'submit_actor_reply'); const submitted = await submit.execute({ segments: [{ kind: 'dialogue', text: `${mode} safe dialogue` }] }, exec)
      policyResults[mode] = { denied, submitted, ledgerEntries: registry.stateForExecution(exec, 'wang-yangming').ledger.entries().length }
      if (denied.some((result: any) => result?.errorCode !== 'retrieval-not-authorized') || (policyResults[mode] as any).ledgerEntries !== 0 || (submitted as any)?.ok !== true) failures.push(`${mode}-retrieval-policy`)
    }
    const repeatedSession = { events: [{ type: 'turn/start', data: { turn: 1 } }] }
    const repeatedTools: any[] = []; const repeatedCtx: any = { tools: { register: (definition: any) => repeatedTools.push(definition) } }
    registerActorTools(repeatedCtx, libs, 'wang-yangming', registry)
    let repeatedConcludes = 0; const repeatedExec: any = { agent: { session: repeatedSession }, concludeTurn: () => { repeatedConcludes++ } }
    const repeatedSubmit = repeatedTools.find((definition) => definition.name === 'submit_actor_reply'); const repeatedArgs = { segments: [{ kind: 'historical_fact', text: '同一无证据参数' }] }
    const repeatedFirst: any = await repeatedSubmit.execute(repeatedArgs, repeatedExec); const repeatedSecond: any = await repeatedSubmit.execute(repeatedArgs, repeatedExec)
    const repeatedMeta = repeatedSubmit.output.presentationMeta(repeatedArgs, repeatedSecond)
    policyResults.repeatInvalid = { first: repeatedFirst, second: repeatedSecond, concluded: repeatedConcludes, publicMetaKeys: Object.keys(repeatedMeta) }
    if (repeatedFirst?.errorCode !== 'missing-evidence-ids' || repeatedFirst?.repairable !== true || repeatedSecond?.fallback !== true || repeatedSecond?.concluded !== true || repeatedSecond?.reply !== undefined || repeatedConcludes !== 1 || Object.keys(repeatedMeta).length !== 0) failures.push('repeat-invalid-fallback')
    budgetD(); budgetE();
    return { D: { projection: dProjection, calls: dCalls, resultCount: dResults.length, directAssistantTextCount: dDirectAssistantTextCount, submitFailures: dFailures, repairCount: dRepairCount, missingEvidenceIds: dMissingIds, resultPayloads: dPayloads }, E: { projection: eProjection, calls: eCalls, resultCount: eResults.length, fenceRejectedWithoutForeignText: eFence, resultPayloads: ePayloads }, policyResults, failures, requests, declared }
  } catch (error) {
    return { D: undefined, E: undefined, failures: [error instanceof Error ? error.message : String(error)], requests, declared }
  } finally { off(); await d?.dispose(); await e?.dispose() }
}

async function runScriptedProbe(ctx: Context, runId: string, negativeFixtures: Record<string, unknown>): Promise<void> {
  const trunkRoot = join(process.env.DSH_HOME ?? '.validation', 'man-roles', 'native-evidence', runId); const aggregateA = ConversationAggregate.create(`conversation-A-${runId}`, join(trunkRoot, 'A'), 'wang-yangming', runtimeRegistry); const aggregateB = ConversationAggregate.create(`conversation-B-${runId}`, join(trunkRoot, 'B'), 'wang-yangming', runtimeRegistry); const taskA = `task-A-${runId}`; const taskB = `task-B-${runId}`; const failures: string[] = []; const calls: Record<string, number> = {}; const requests: Array<{ session: string; system: string; tools: string[]; messages: Array<{ source: Message['source']; text: string }> }> = []; const streams = new Map<string, () => AsyncIterable<StreamChunk>>(); const dispose = ctx.on('llm/stream', (options: GenerateOptions, next: () => AsyncIterable<StreamChunk>) => { const id = String(options.sessionId); const stream = streams.get(id); if (!stream) return next(); const isActorRequest = options.messages.some((message: Message) => message.role === 'user' && message.source.kind === 'user'); if (!isActorRequest) return titleTextStream(); calls[id] = (calls[id] ?? 0) + 1; requests.push({ session: id, system: options.system ?? '', tools: (options.tools ?? []).map((tool) => tool.name).sort(), messages: options.messages.map((message) => ({ source: message.source, text: JSON.stringify(message.content) })) }); return stream() })
  const libs = buildContentLibraries(); const stateRegistry = new ActorTurnStateRegistry(); const declared: string[][] = [[], [], [], [], []]; const setup = (slot: number) => setupActorAgent('wang-yangming', libs, stateRegistry, (names) => declared[slot].push(...names)); const options = { provider: 'scripted-local', model: 'scripted-no-network' }; let a: AgentHandle | undefined; let b: AgentHandle | undefined; let c: AgentHandle | undefined; let d: AgentHandle | undefined; let e: AgentHandle | undefined; let resumed: AgentHandle | undefined; let aOff: (() => void) | undefined; let bOff: (() => void) | undefined; let cOff: (() => void) | undefined; let dOff: (() => void) | undefined; let eOff: (() => void) | undefined
  // Only A/B/C are owned by this probe; D/E validate their own active slots in negativeFixtures.
  declared.splice(3)
  try {
    const aId = SessionId(`native-A-${runId}`); const bId = SessionId(`native-B-${runId}`); const cId = SessionId(`native-C-${runId}`); const anecdoteId = libs.anecdotes.byPersona('wang-yangming')[0].id; const cSubmit = { segments: [{ kind: 'historical_fact', text: '脚本事迹回答。', evidenceIds: [anecdoteId] }] }; a = await ctx.agents.create({ sessionId: aId, agentOptions: options, setup: setup(0) }); b = await ctx.agents.create({ sessionId: bId, agentOptions: options, setup: setup(1) }); c = await ctx.agents.create({ sessionId: cId, agentOptions: options, setup: setup(2) }); aOff = attachTurnBudget(ctx, a.agent, createTurnBudget({ maxSteps: 8, maxToolCalls: 5, maxTokens: 20000 }), { resolveTask: (turn) => ({ taskId: taskA, personaId: 'wang-yangming', branchSessionId: String(aId) }), recordBlocked: (outcome) => aggregateA.recordTaskBudgetBlocked(outcome) }); bOff = attachTurnBudget(ctx, b.agent, createTurnBudget({ maxSteps: 8, maxToolCalls: 0, maxTokens: 20000 }), { resolveTask: (turn) => ({ taskId: taskB, personaId: 'wang-yangming', branchSessionId: String(bId) }), recordBlocked: (outcome) => aggregateB.recordTaskBudgetBlocked(outcome) }); cOff = attachTurnBudget(ctx, c.agent, createTurnBudget({ maxSteps: 4, maxToolCalls: 5, maxTokens: 20000 }), { resolveTask: (turn) => ({ taskId: `task-C-${runId}`, personaId: 'wang-yangming', branchSessionId: String(cId) }), recordBlocked: () => undefined }); streams.set(String(aId), () => scriptedToolStream()); streams.set(String(bId), () => scriptedToolStream('fetch_quote', { id: 'unknown' })); streams.set(String(cId), scriptedSequenceStream([{ name: 'fetch_anecdote', args: { id: anecdoteId } }, { name: '__assistant_text__', args: {} }, { name: 'submit_actor_reply', args: cSubmit }])); a.agent.followup(createUserMessage({ content: [{ type: 'text', text: '提交' }], source: { kind: 'user' } })); b.agent.followup(createUserMessage({ content: [{ type: 'text', text: '预算' }], source: { kind: 'user' } })); c.agent.followup(createUserMessage({ content: [{ type: 'text', text: '检索并提交' }], source: { kind: 'user' } })); await Promise.all([a.agent.whenIdle(), b.agent.whenIdle(), c.agent.whenIdle()])
    const ae = a.agent.session.events; const aCalls = ae.filter((event) => event.type === 'tool/call').map((event) => event.data.name); const be = b.agent.session.events; const ar = projectActorReply(ae, 1); const br = projectActorReply(be, 1); const outcomeB = aggregateB.taskOutcomes[taskB]; const systemProjection = outcomeB ? projectTaskOutcome(outcomeB) : undefined; const replayedB = ConversationAggregate.load(aggregateB.conversationId, join(trunkRoot, 'B'), registry); const replayedOutcome = replayedB.taskOutcomes[taskB]; const outcomeEventCount = readFileSync(aggregateB.trunk.filePath, 'utf8').split(/\r?\n/).filter(Boolean).filter((line: string) => JSON.parse(line).type === TRUNK_TASK_OUTCOME_RECORDED).length; const names = ['fetch_anecdote', 'fetch_quote', 'retrieve_anecdotes', 'retrieve_quotes', 'submit_actor_reply'].sort(); const budgetBlockedStateSupported = Boolean(outcomeB && systemProjection && replayedOutcome && outcomeEventCount === 1)
    const bEnd = [...be].reverse().find((event) => event.type === 'turn/end'); const unsafeSystem = requests.some((request) => !request.system.includes('MAN_ROLES_PERSONA') || !request.system.includes('submit_actor_reply') || /AGENTS\.md|sandbox|terminal|coding agent|file editing|代码搜索|文件编辑/i.test(request.system)); const dilemmaClean = aggregateA.sharedLayer.dilemma.phase === 'pending' && aggregateB.sharedLayer.dilemma.phase === 'pending' && aggregateA.sharedLayer.dilemma.candidateText === null && aggregateB.sharedLayer.dilemma.candidateText === null
    if (Object.keys(aggregateA.taskOutcomes).length !== 0) failures.push('a-outcome-nonempty'); if (!outcomeB || outcomeB.taskId !== taskB || outcomeB.personaId !== 'wang-yangming' || outcomeB.branchSessionId !== String(bId) || outcomeB.branchTurn !== 1 || outcomeB.status !== 'blocked' || outcomeB.reason !== 'budget_exceeded' || outcomeB.retryable !== true) failures.push('budget-outcome-fields'); if (!systemProjection || systemProjection.message !== '本轮执行已停止，可重试' || systemProjection.retryable !== true) failures.push('budget-system-projection'); if (!replayedOutcome || JSON.stringify(replayedOutcome) !== JSON.stringify(outcomeB)) failures.push('budget-replay'); if (outcomeEventCount !== 1) failures.push('budget-event-count'); if (!dilemmaClean) failures.push('budget-dilemma-contamination'); if (!ar || br || !budgetBlockedStateSupported) failures.push('projection-or-blocked-state'); if (!bEnd || bEnd.data.reason.kind !== 'blocked') failures.push('b-turn-not-blocked'); if (declared.some((items) => items.slice().sort().join('|') !== names.join('|'))) failures.push('declared-tool-whitelist'); if ((calls[String(aId)] ?? 0) !== 1 || (calls[String(bId)] ?? 0) !== 1) failures.push('model-call-count'); if (unsafeSystem) failures.push('unsafe-system'); if (requests.some((request) => request.tools.join('|') !== names.join('|'))) failures.push('request-tool-whitelist')
    await ctx.sessions.flush(a.agent.session); aOff?.(); aOff = undefined; await a.dispose(); a = undefined; const resumedDeclared: string[] = []; resumed = await ctx.agents.resume({ resumeSessionId: aId, agentOptions: options, setup: setupActorAgent('wang-yangming', libs, registry, (names) => resumedDeclared.push(...names)) }); const resumedEvents = resumed.agent.session.events; const resumedEventTypes = resumedEvents.map((event) => event.type); const resumedProjection = projectActorReply(resumedEvents, 1); if (JSON.stringify(resumedProjection) !== JSON.stringify(ar) || resumedDeclared.length !== 5 || !resumedEventTypes.includes('turn/start')) failures.push('resume-projection-or-tools'); await resumed.dispose(); resumed = undefined
    const cEvents = c.agent.session.events; const cDirectAssistantTextCount = cEvents.filter((event) => event.type === 'assistant/message' && event.data.turn === 1 && event.data.message.content.some((block) => block.type === 'text' && block.text.trim())).length; const cProjection = projectActorReply(cEvents, 1); const cCalls = cEvents.filter((event) => event.type === 'tool/call').map((event) => event.data.name); const cSequenceFailed = !cProjection || cDirectAssistantTextCount !== 1 || cCalls[0] !== 'fetch_anecdote' || cCalls[1] !== 'submit_actor_reply' || cCalls.length !== 2 || !cProjection.evidence.some((e) => e.id === anecdoteId && e.kind === 'anecdote') || declared[2].slice().sort().join('|') !== names.join('|') || requests.filter((request) => request.session === String(cId)).some((request) => request.tools.join('|') !== names.join('|')); if (cSequenceFailed) failures.push('retrieval-submit-sequence')
    const allFailures = [...failures, ...((negativeFixtures.failures as string[] | undefined) ?? [])]; const summary = { runId, providerNetworkUsed: false, tokenCost: 0, scriptedProbeCompleted: allFailures.length === 0, budgetBlockedStateSupported, outcomeEventCount, taskOutcome: outcomeB, systemProjection, replayedOutcome, hardGateFailures: allFailures, calls, requests, declaredTools: declared, resumedDeclared, resumedEventTypes, resumeProjectionMatches: JSON.stringify(resumedProjection) === JSON.stringify(ar), cProjection, cCalls, cEventCount: cEvents.length, negativeFixtures, projections: { A: ar, B: br, C: cProjection }, events: { A: ae, B: be, C: cEvents } }; mkdirSync(trunkRoot, { recursive: true }); writeFileSync(join(trunkRoot, 'report.json'), JSON.stringify(summary, null, 2), 'utf8'); console.log(JSON.stringify(summary)); if (allFailures.length) throw new Error('scripted probe hard gate failed')
  } catch (error) { failures.push('probe-exception'); throw error
  } finally { aOff?.(); bOff?.(); cOff?.(); dispose(); await a?.dispose(); await b?.dispose(); await c?.dispose(); await resumed?.dispose(); const exit = ctx.get('appExit'); if (typeof exit === 'function') exit(failures.length === 0 ? 0 : 1) }
}
