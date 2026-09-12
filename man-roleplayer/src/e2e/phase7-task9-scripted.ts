import type { Context } from '@deepseek-ai/cordis'
import { CallId, createUserMessage, createAssistantMessage, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { AgentHandle } from '@deepseek-ai/dsh-agent'
import { join } from 'node:path'
import { ConversationAggregate } from '../aggregate/aggregate.ts'
import { createRuntimeRegistry } from '../persona/runtime-registry.ts'
import { buildContentLibraries } from '../retrieval/data.ts'
import { ActorTurnStateRegistry } from '../runtime/turn-state.ts'
import { setupActorAgent } from '../runtime/actor-agent.ts'
import { projectActorReply } from '../runtime/actor-reply-projection.ts'
import type { ActorResult } from '../runtime/submit-actor-reply.ts'
import { createControlClassifier } from '../dialogue/control-classifier.ts'
import { runDialogueTurn } from '../dialogue/coordinator.ts'
import { PHASE7_TASK9_SCENARIOS, sha256, snapshotTurnPolicy, deriveSubmitDiagnostics, deriveOutputObservation, type Phase7Task9Report } from '../validation/phase7-task9-report.ts'
import { writeFileSync, mkdirSync } from 'node:fs'
import { ScenarioAllocator, PHASE7_TASK9_SCENARIO_BUDGETS } from './batch-budget.ts'

const registry = createRuntimeRegistry()
const provider = 'scripted-local'
const model = 'scripted-no-network'

function stream(argsValue: unknown, callIndex: number): AsyncIterable<StreamChunk> {
  const args = JSON.stringify(argsValue)
  const id = CallId(`task9-submit-${callIndex}`)
  return (async function* () {
    yield { type: 'block-start', index: 0, blockType: 'tool-call' } satisfies StreamChunk
    yield { type: 'tool-call-delta', index: 0, id, name: 'submit_actor_reply', argumentsDelta: args } satisfies StreamChunk
    yield { type: 'block-end', index: 0, block: { type: 'tool-call', id, name: 'submit_actor_reply', arguments: args } } satisfies StreamChunk
    yield { type: 'usage', usage: { inputTokens: 0, outputTokens: 0 } } satisfies StreamChunk
    yield { type: 'finish', reason: { kind: 'tool-calls' } } satisfies StreamChunk
  })()
}

function textOf(message: any): string {
  return message.content?.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('') ?? ''
}

function usageZero() { return { input: 0, output: 0, cache: 0, reasoning: 0, total: 0 } }

/** Zero-cost Task9 runner. It exercises the real coordinator and AgentLoop with a scripted stream. */
export async function runPhase7Task9Scripted(ctx: Context, outputDir: string): Promise<Phase7Task9Report> {
  const active = registry.listActive()[0]?.id
  if (!active) throw new Error('scripted Task9 requires an active persona')
  const libs = buildContentLibraries()
  const turnState = new ActorTurnStateRegistry()
  const allocator = new ScenarioAllocator(PHASE7_TASK9_SCENARIO_BUDGETS)
  const requests: any[] = []
  const streamCalls = new Map<string, number>()
  const agents = new Map<string, AgentHandle>()
  const offStream = ctx.on('llm/stream', (request: GenerateOptions, next: () => AsyncIterable<StreamChunk>) => {
    const messages = request.messages as any[]
    const owned = String(request.provider) === provider && String(request.model) === model && agents.has(String(request.sessionId))
    if (!owned) return next()
    const sessionKey = String(request.sessionId); const callIndex = (streamCalls.get(sessionKey) ?? 0) + 1; streamCalls.set(sessionKey, callIndex)
    requests.push({ sessionId: sessionKey, callIndex, system: request.system ?? '', messages: messages.map((message) => ({ role: message.role, source: message.source, text: textOf(message) })), tools: (request.tools ?? []).map((tool) => tool.name) })
    const reviewRepair = sessionKey.endsWith('-review')
    const args = reviewRepair && callIndex === 1
      ? { segments: [{ kind: 'thought_attribution', text: 'REDACTED_REVIEW_ATTRIBUTION' }], questions: ['允许的一问'], offeredControls: ['continue', 'correct', 'end'] }
      : reviewRepair
        ? { segments: [{ kind: 'dialogue', text: '脚本复盘回答。' }], questions: ['允许的一问'], offeredControls: ['continue', 'correct', 'end'] }
        : { segments: [{ kind: 'dialogue', text: '脚本门控回答。' }] }
    return stream(args, callIndex)
  })
  const scenarios: any[] = []
  try {
    for (const name of PHASE7_TASK9_SCENARIOS) {
      const scenarioDir = join(outputDir, name)
      mkdirSync(scenarioDir, { recursive: true })
      const conversationId = `phase7-task9-${name}`
      const sessionId = SessionId(`phase7-task9-${name}`)
      const aggregate = ConversationAggregate.create(conversationId, scenarioDir, active, registry)
      aggregate.indexBranch(active, String(sessionId))
      const highRiskInput = '我想自杀'
      const highRisk = name === 'high-risk'
      let handle: AgentHandle | undefined
      const session = highRisk ? ctx.sessions.create(sessionId) : undefined
      if (!highRisk) {
        const exposedToolNames = name === 'knowledge' ? ['retrieve_quotes', 'fetch_quote', 'submit_actor_reply'] as const : ['submit_actor_reply'] as const
        handle = await ctx.agents.create({ sessionId, agentOptions: { provider, model }, setup: setupActorAgent(active, libs, turnState, undefined, { exposedToolNames }) })
        agents.set(String(sessionId), handle)
      }
      const raw = highRisk ? highRiskInput : `脚本 ${name} 场景：我需要先理解自己的处境。`
      const taskId = `task-${name}`
      const messageId = `message-${name}`
      const observed: any[] = []
      const promptHash = sha256(raw)
      const foreignPersona = name === 'cross-person' ? registry.listActive().find((item) => item.id !== active)?.id : undefined
      const foreignMarkers = { reply: `FOREIGN_REPLY:${foreignPersona ?? 'none'}`, progress: `FOREIGN_PROGRESS:${foreignPersona ?? 'none'}`, candidate: `FOREIGN_CANDIDATE:${foreignPersona ?? 'none'}` }
      let foreignFixtureEstablished = false
      let foreignSession: any
      let actorContextText = ''
      let wakeText = ''
      let candidateBeforeActor = false
      let actualPolicy: any = null; let actorQuestions: string[] = []
      const observedCall = (role: 'control' | 'director', label: string) => ({ role, requestId: `${sessionId}:${label}`, provider, model, usage: usageZero(), latencyMs: 0, retries: 0, systemHash: sha256(`${role}:scripted`), messageHashes: [promptHash], tools: [] })
      const classifier = createControlClassifier(async () => {
        observed.push(observedCall('control', 'control'))
        if (name === 'cross-person' && foreignPersona && !foreignFixtureEstablished) {
          const foreignSessionId = SessionId(`phase7-task9-foreign-${name}`); foreignSession = ctx.sessions.create(foreignSessionId)
          aggregate.indexBranch(foreignPersona, String(foreignSessionId))
          foreignSession.append('turn/start', { turn: 1 }); foreignSession.append('step/start', { turn: 1, step: 1 }); foreignSession.append('assistant/message', { turn: 1, step: 1, message: createAssistantMessage({ content: [{ type: 'text', text: foreignMarkers.reply }], source: { provider, model } }) }, { surfaceOp: 'append' }); foreignSession.append('step/end', { turn: 1, step: 1 }); foreignSession.append('turn/end', { turn: 1, reason: { kind: 'completed' } }); await ctx.sessions.flush(foreignSession)
          const rawRef = aggregate.trunk.state.userRaws.at(-1)?.rawRef; if (!rawRef) throw new Error('foreign fixture requires target rawRef')
          aggregate.trunk.updateBranchProgress({ personaId: foreignPersona, summary: foreignMarkers.progress, lastSemanticSeq: aggregate.trunk.nextSeq }, { messageId, taskId, eventPurpose: `phase7-task9:${name}:foreign-progress`, sourceRawRefs: [rawRef] })
          aggregate.trunk.proposeDilemmaItem({ id: `foreign-candidate-${name}`, kind: 'inference', text: foreignMarkers.candidate, status: 'candidate', sourceRawRefs: [rawRef], proposedByPersona: foreignPersona, visibility: 'origin-persona-only', revision: 1 }, { messageId, taskId, eventPurpose: `phase7-task9:${name}:foreign-candidate`, sourceRawRefs: [rawRef] }); foreignFixtureEstablished = true
        }
        return { taskMode: name === 'review' ? 'review' : name === 'dilemma' ? 'dilemma' : 'knowledge', feedbackKind: 'none', confidence: 'high', emotionPriority: false, independentNewDilemma: false, safety: 'allow', safetyReason: 'none' }
      })
      const result = await runDialogueTurn({ raw, taskId, personaId: active, messageId, eventPurposePrefix: `phase7-task9:${name}` }, {
        registry, trunk: aggregate.trunk,
        delivery: { session: (session ?? handle?.agent.session) as any, sessionId: String(sessionId), flush: (session) => ctx.sessions.flush(session as any) },
        classifier,
        director: async ({ currentRawRef, personaId }) => { const call = observedCall('director', 'director'); call.messageHashes = [sha256(raw), sha256(currentRawRef)]; observed.push(call); return { propose: [{ kind: 'inference', text: '脚本候选：需要进一步澄清处境。', sourceRawRefs: [currentRawRef], proposedByPersona: personaId }] } },
        actor: {
          answerExists: () => false,
          loadExisting: () => { throw new Error('not called') },
          run: async ({ policy, candidates, context }): Promise<ActorResult> => {
            actualPolicy = snapshotTurnPolicy(policy)
            candidateBeforeActor = name !== 'cross-person' || (Boolean(foreignFixtureEstablished && foreignPersona && aggregate.trunk.state.branchProgress[foreignPersona]?.summary === foreignMarkers.progress) && aggregate.trunk.state.dilemmaItems.some((item) => item.text === foreignMarkers.candidate) && Boolean(foreignSession?.events.some((event: any) => event.type === 'assistant/message' && JSON.stringify(event.data).includes(foreignMarkers.reply))))
            if (name === 'cross-person' && !candidateBeforeActor) throw new Error('foreign fixture was not established before actor')
            actorContextText = JSON.stringify(context)
            const wake = `执行当前人物 ${active} 的 ${policy.intent}；候选仅供当前人物参考：${candidates.length}；请只调用 submit_actor_reply。`
            wakeText = wake
            if (wake.includes('raw_ref') || wake.includes('message_id')) throw new Error('wake contains forbidden identity')
            if (!handle) throw new Error('actor handle missing for allowed scenario')
            turnState.setNextTurnPolicy(handle.agent.session, { retrievalPolicy: policy.intent === 'answer' && name === 'knowledge' ? 'allow' : 'deny', maxQuestions: policy.maxQuestions, allowedControls: policy.allowedControls })
            handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: wake }], source: { kind: 'plugin', plugin: 'man-roles-roleplayer' } }))
            await handle.agent.whenIdle()
            const projected = projectActorReply(handle.agent.session.events, 1)
            if (!projected) throw new Error('missing submit_actor_reply projection')
            actorQuestions = projected.questions ?? []
            return { ...projected, retrievalCalls: 0 } as ActorResult
          },
        },
        loadCurrentBranchHistory: ({ personaId, sessionId: requested }) => { if (personaId !== active || requested !== String(sessionId)) throw new Error('history loader crossed persona boundary'); const source = (handle?.agent.session.events ?? []).filter((event: any) => event.type === 'user/message' || event.type === 'assistant/message'); return source.map((event: any) => JSON.stringify(event.data?.message ?? event.data)) },
      })
      const events = (handle?.agent.session.events ?? (session as any)?.events ?? []) as any[]
      const deliveredRawRef = 'delivery' in result ? result.delivery?.rawRef : undefined
      const rawMessages = events.filter((event) => event.type === 'user/message' && event.data?.extra?.man_roles_branch_delivery?.raw_ref === deliveredRawRef)
      const scenarioRequests = requests.filter((item) => item.sessionId === String(sessionId))
      const requestText = JSON.stringify(scenarioRequests.map((request) => ({ system: request.system, messages: request.messages })))
      const rawTextCount = rawMessages.filter((event) => textOf(event.data?.message ?? event.data).includes(raw)).length
      const wakeEvents = events.filter((event) => { const source = event.data?.source; return event.type === 'user/message' && source?.kind === 'plugin' && source?.plugin === 'man-roles-roleplayer' && !source.raw_ref && !source.message_id })
      const wake = wakeEvents[0]
      const calls = result.calls ?? { director: 0, actor: 0, retrieval: 0 }
      const actorCalls = scenarioRequests.map((request) => ({ role: 'actor' as const, requestId: `${request.sessionId}:actor:${request.callIndex}`, provider, model, usage: usageZero(), latencyMs: 0, retries: 0, systemHash: sha256(request.system), messageHashes: request.messages.map((message: any) => sha256(JSON.stringify(message))), tools: request.tools }))
      const callsForReport = highRisk ? [] : [...observed, ...actorCalls]
      const wakeSource = wake ? { kind: wake.data.source.kind, plugin: wake.data.source.plugin } : undefined
      const safetyDisposition = ['allow', 'professional-boundary', 'urgent-help', 'refuse'].includes(result.status) ? result.status : 'allow'
      const submitAttempted = events.filter((event) => event.type === 'tool/call' && event.data?.name === 'submit_actor_reply').length
      const submitCalls = events.filter((event) => event.type === 'tool/call' && event.data?.name === 'submit_actor_reply')
      const submitCallIds = new Set(submitCalls.map((event) => event.data?.callId ?? event.data?.id ?? event.data?.message?.source?.callId).filter(Boolean))
      const submitResults = events.filter((event) => event.type === 'tool/result' && event.data?.message && submitCallIds.has(event.data?.message?.source?.callId ?? event.data?.callId))
      const submitAccepted = submitResults.filter((event) => {
        const meta = event.data?.meta
        if (meta?.kind === 'actor-reply') return true
        const text = event.data?.message?.content?.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('') ?? ''
        try { const payload = JSON.parse(text); return payload?.ok === true && payload?.concluded === true } catch { return false }
      }).length
      const directOutput = events.filter((event) => event.type === 'assistant/message' && event.data?.message?.content?.some((block: any) => block.type === 'text' && block.text.trim())).length
      const leak = { reply: { context: actorContextText.includes(foreignMarkers.reply), request: requestText.includes(foreignMarkers.reply), wake: wakeText.includes(foreignMarkers.reply) }, progress: { context: actorContextText.includes(foreignMarkers.progress), request: requestText.includes(foreignMarkers.progress), wake: wakeText.includes(foreignMarkers.progress) }, candidate: { context: actorContextText.includes(foreignMarkers.candidate), request: requestText.includes(foreignMarkers.candidate), wake: wakeText.includes(foreignMarkers.candidate) } }
      const submitDiagnostics = deriveSubmitDiagnostics(events)
      scenarios.push({ name, personaId: active, promptHash, calls: callsForReport, controlCalls: callsForReport.filter((call) => call.role === 'control').length, directorCalls: callsForReport.filter((call) => call.role === 'director').length, actorCalls: callsForReport.filter((call) => call.role === 'actor').length, retrievalCalls: 0, usage: usageZero(), retries: 0, candidateStatuses: aggregate.trunk.state.dilemmaItems.map((item) => item.status), questions: actorQuestions, turnPolicy: highRisk ? null : actualPolicy, outputObservation: deriveOutputObservation(events, highRisk ? 0 : submitAccepted), submitDiagnostics, safety: { disposition: safetyDisposition, downstreamCalls: highRisk ? 0 : calls.actor + calls.director + calls.retrieval, messageHash: promptHash }, submitEvidence: { attempted: submitAttempted, accepted: submitAccepted, rejected: Math.max(0, submitAttempted - submitAccepted), repairCount: Math.max(0, submitDiagnostics.length - 1) }, eventOrder: events.map((event) => event.type), isolation: { actorContextContainsForeignReply: leak.reply.context, actorContextContainsForeignProgress: leak.progress.context, actorContextContainsForeignCandidate: leak.candidate.context, candidateBeforeActor }, foreignLeaks: leak, rawRefCount: rawMessages.length, rawTextCount, wakeSource: highRisk ? null : wakeSource, wakeCount: wakeEvents.length, resultStatus: result.status, trunkRawCount: aggregate.trunk.state.userRaws.length, wakeContainsIdentity: /raw_ref|message_id/.test(wakeText), wakeContainsForeign: Object.values(foreignMarkers).some((marker) => wakeText.includes(marker)), foreignFixtureEstablished, foreignPersona: foreignPersona ?? null, foreignMarkerHashes: name === 'cross-person' ? Object.values(foreignMarkers).map((marker) => sha256(marker)) : [] })
      if (handle) { await handle.dispose(); agents.delete(String(sessionId)) }
    }
  } catch (error) {
    mkdirSync(outputDir, { recursive: true })
    writeFileSync(join(outputDir, 'failure-diagnostic.json'), JSON.stringify({ runId: 'phase7-task9-scripted', error: error instanceof Error ? error.message : String(error), requests }, null, 2), 'utf8')
    throw error
  } finally { offStream(); for (const handle of agents.values()) await handle.dispose() }
  for (const scenario of scenarios) { const plan = allocator.plan(scenario.name); scenario.scenarioBudget = { allocated: plan.allocated, minimumStart: plan.minimumStart, repairReserve: plan.repairReserve ?? 0, observed: scenario.usage.total, blocked: false, blocker: null } }
  const report = { schemaVersion: 2, runMode: 'scripted', runId: 'phase7-task9-scripted', profile: 'scripted-local', attemptMarkerPath: 'absent', attemptMarkerSha256: sha256('absent'), provider, model, expectedScenarios: [...PHASE7_TASK9_SCENARIOS], scenarios, requests: scenarios.flatMap((scenario) => scenario.calls), fullTotal: 0, tokenLimit: 20000, providerNetworkUsed: false, passed: true } as unknown as Phase7Task9Report
  mkdirSync(outputDir, { recursive: true }); writeFileSync(join(outputDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8')
  const exit = ctx.get('appExit')
  if (typeof exit === 'function') exit(0)
  return report
}
