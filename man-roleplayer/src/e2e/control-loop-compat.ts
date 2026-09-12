import { createRuntimeRegistry } from '../persona/runtime-registry.ts'
const registry = createRuntimeRegistry()
/**
 * DSH AgentLoop 与 man-roleplayer 聚合架构的兼容性切片。
 *
 * 该切片使用真实 AgentLoop / Agent / Session / systemPrompt / persistence 生命周期，
 * 但在 `llm/stream` 最后边界返回本地脚本流，因此不访问 Provider、不消耗 token。
 * 最终请求仍由 AgentLoop 正常重建，测试捕获的是模型实际会收到的 system/messages。
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Agent, AgentHandle } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ConversationAggregate } from '../aggregate/aggregate.ts'
import { personaSpecFor } from '../context/personas-data.ts'
import type { PersonaId } from '../domain/schema.ts'
import {
  evaluateControlLoopEvidence,
  type CapturedLoopRequest,
  type ControlLoopEvidence,
  type ControlLoopMarkers,
} from '../validation/control-loop-report.ts'

const TAG = '[man-roles-roleplayer:loop-compat]'
const PLUGIN_SOURCE = 'man-roles-roleplayer'
const FAKE_PROVIDER = 'man-roles-compat-local'
const FAKE_MODEL = 'scripted-no-network'

const INITIAL_USER_RAW = '我既想坚持理想主义，又觉得现实处处碰壁，不知如何自处。'
const CORRECTION_USER_RAW = '我纠正一下：我不是害怕失败，而是不能接受收入突然中断。'
const CANDIDATE_TEXT = '用户主要是在害怕失败。'
const CORRECTED_TEXT = '用户在意的是收入连续性，而不是对失败本身的恐惧。'
const CONTINUE_B = '请从你的角度继续辨析。'
const CONTINUE_A = '请根据我刚才的纠正继续。'
const CONTINUE_AFTER_RESUME = '请在恢复会话后继续。'
const CANCEL_PROMPT = '[MAN_ROLES_COMPAT_CANCEL] 请开始一个会被用户取消的回答。'

const WANG_REPLY_1 = '[WANG_PRIVATE_REPLY_1] 王阳明分支私有回答。'
const ZENG_REPLY_1 = '[ZENG_PRIVATE_REPLY_1] 曾国藩分支私有回答。'
const ZENG_REPLY_2 = '[ZENG_PRIVATE_REPLY_2] 曾国藩分支纠正后回答。'

const MARKERS: ControlLoopMarkers = {
  initialUserRaw: INITIAL_USER_RAW,
  correctionUserRaw: CORRECTION_USER_RAW,
  candidateText: CANDIDATE_TEXT,
  correctedText: CORRECTED_TEXT,
  wangReply1: WANG_REPLY_1,
  zengReply1: ZENG_REPLY_1,
  zengReply2: ZENG_REPLY_2,
}

function validationRoot(runId: string): string {
  const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(dshHome, 'man-roles', 'control-loop-validation', runId)
}

function textOfContent(content: unknown): string {
  if (!Array.isArray(content)) return typeof content === 'string' ? content : ''
  return content.map((block) => {
    if (typeof block !== 'object' || block === null) return ''
    const value = block as { type?: string; text?: string; name?: string; arguments?: string }
    if (value.type === 'text' || value.type === 'reasoning') return value.text ?? ''
    if (value.type === 'tool-call') return `[tool-call:${value.name ?? ''}]${value.arguments ?? ''}`
    return ''
  }).join('')
}

function captureRequest(
  options: GenerateOptions,
  label: CapturedLoopRequest['label'],
  persona: PersonaId,
): CapturedLoopRequest {
  return {
    label,
    persona,
    sessionId: String(options.sessionId ?? ''),
    system: options.system ?? '',
    messages: options.messages.map(message => ({
      role: String(message.role),
      text: textOfContent(message.content),
    })),
  }
}

function textResponse(text: string): AsyncIterable<StreamChunk> {
  return (async function* () {
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'usage', usage: { inputTokens: 0, outputTokens: 0 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  })()
}

function hangingResponse(signal: AbortSignal | undefined): AsyncIterable<StreamChunk> {
  return (async function* () {
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: 'partial-before-cancel' }
    await new Promise<never>((_resolve, reject) => {
      const abort = (): void => reject(new Error('compatibility stream aborted by user'))
      if (signal?.aborted) {
        abort()
        return
      }
      signal?.addEventListener('abort', abort, { once: true })
    })
  })()
}

function branchLog(agent: Agent): string {
  return JSON.stringify(agent.session.events)
}

function turnEndKinds(agent: Agent): string[] {
  return agent.session.events.flatMap(event => {
    if (event.type !== 'turn/end') return []
    const reason = event.data.reason as { kind?: unknown }
    return typeof reason.kind === 'string' ? [reason.kind] : []
  })
}

async function waitForIdle(agent: Agent, previousTurnStarts = 0, timeoutMs = 10_000): Promise<void> {
  // followup() 将消息写入 inbox 后通过微任务唤醒 driver；先让该调度边界
  // 完成，避免在 driver 尚未认领消息时读到创建阶段的初始 idle。
  const deadline = Date.now() + timeoutMs
  while (agent.session.events.filter(event => event.type === 'turn/start').length <= previousTurnStarts) {
    if (Date.now() >= deadline) throw new Error(`agent ${agent.id} 未在 ${timeoutMs}ms 内开始新 turn`)
    await new Promise<void>(resolve => setImmediate(resolve))
  }
  return Promise.race([
    agent.whenIdle(),
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`agent ${agent.id} 未在 ${timeoutMs}ms 内回到 idle`)), timeoutMs)
    }),
  ])
}

function send(agent: Agent, text: string): number {
  const previousTurnStarts = agent.session.events.filter(event => event.type === 'turn/start').length
  agent.followup(createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }))
  return previousTurnStarts
}

/** 只把尚未投递给该人物的用户原话同步到分支；不会同步任何人物回答。 */
function syncMissingUserRaws(
  aggregate: ConversationAggregate,
  persona: PersonaId,
  agent: Agent,
  delivered: Record<PersonaId, Set<number>>,
): void {
  for (const raw of aggregate.sharedLayer.userRaws) {
    if (delivered[persona].has(raw.ref)) continue
    agent.inject(createUserMessage({
      content: [{ type: 'text', text: `【共享用户原话 ref=${raw.ref}】${raw.text}` }],
      source: { kind: 'plugin', plugin: PLUGIN_SOURCE },
    }))
    delivered[persona].add(raw.ref)
  }
}

/** 结构化困惑使用 DSH runtime context；candidate 明确不进入演员上下文。 */
function renderSharedDilemma(aggregate: ConversationAggregate): string {
  const dilemma = aggregate.sharedLayer.dilemma
  if (dilemma.phase === 'confirmed' && dilemma.confirmedText !== null) {
    return `【已确认的共享困惑】${dilemma.confirmedText}`
  }
  if (dilemma.phase === 'corrected' && dilemma.correctedText !== null) {
    return `【用户纠正后的共享困惑】${dilemma.correctedText}`
  }
  return ''
}

function setupFor(aggregate: ConversationAggregate, persona: PersonaId) {
  return (agentCtx: Context): void => {
    const spec = personaSpecFor(persona)
    agentCtx.systemPrompt.section({
      name: 'man-roles:persona',
      order: 0,
      text: `[MAN_ROLES_PERSONA=${persona}]\n${spec.systemPrompt}`,
    })
    agentCtx.systemPrompt.context({
      name: 'man-roles:shared-dilemma',
      order: 10,
      text: () => renderSharedDilemma(aggregate),
    })
  }
}

/**
 * 运行兼容性切片并写 `<DSH_HOME>/man-roles/control-loop-validation/<runId>/report.json`。
 * 通过时 appExit(0)，硬门槛失败或运行异常时 appExit(1)。
 */
export async function runControlLoopCompatibilitySlice(ctx: Context): Promise<void> {
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
  const root = validationRoot(runId)
  const trunkDir = join(root, 'trunk')
  const reportFile = join(root, 'report.json')
  mkdirSync(root, { recursive: true })

  const conversationId = `conversation-loop-compat-${runId}`
  const wangSessionId = SessionId(`session-loop-compat-wang-${runId}`)
  const zengSessionId = SessionId(`session-loop-compat-zeng-${runId}`)
  const aggregate = ConversationAggregate.create(conversationId, trunkDir, 'wang-yangming', registry)
  const delivered: Record<PersonaId, Set<number>> = {
    'wang-yangming': new Set<number>(),
    'zeng-guofan': new Set<number>(),
  }
  const requests: CapturedLoopRequest[] = []
  const callCounts = new Map<string, number>()
  const cancelEntered = Promise.withResolvers<void>()
  let wangHandle: AgentHandle | undefined
  let zengHandle: AgentHandle | undefined
  let resumedWangHandle: AgentHandle | undefined
  let streamDispose: (() => void) | undefined
  let exitCode = 1

  try {
    console.log(`${TAG} runId=${runId}`)
    console.log(`${TAG} 使用真实 DSH AgentLoop + 本地脚本流；不会访问 Provider，不消耗 token`)

    const knownSessions = new Map<string, PersonaId>([
      [String(wangSessionId), 'wang-yangming'],
      [String(zengSessionId), 'zeng-guofan'],
    ])
    streamDispose = ctx.on('llm/stream', (options, next) => {
      const persona = knownSessions.get(String(options.sessionId ?? ''))
      if (persona === undefined) return next()
      // session title 等辅助请求也复用该分支的 sessionId，但没有真实用户
      // turn 的 user 来源；不应参与控制循环的请求编号和证据判定。
      const isUserTurnRequest = options.messages.some(message => message.role === 'user' && message.source?.kind === 'user')
      if (!isUserTurnRequest) return textResponse('兼容性验证')
      const allText = [options.system ?? '', ...options.messages.map(message => textOfContent(message.content))].join('\n')
      if (allText.includes(CANCEL_PROMPT)) {
        requests.push(captureRequest(options, 'A_CANCEL', persona))
        cancelEntered.resolve()
        return hangingResponse(options.signal)
      }

      const sessionKey = String(options.sessionId)
      const call = (callCounts.get(sessionKey) ?? 0) + 1
      callCounts.set(sessionKey, call)
      const label = persona === 'wang-yangming'
        ? (call === 1 ? 'A1' : call === 2 ? 'A2' : 'A3')
        : (call === 1 ? 'B1' : 'B2')
      requests.push(captureRequest(options, label, persona))

      const response = persona === 'wang-yangming'
        ? call === 1 ? WANG_REPLY_1 : `[WANG_PRIVATE_REPLY_${call}] 王阳明分支私有回答。`
        : call === 1 ? ZENG_REPLY_1 : ZENG_REPLY_2
      return textResponse(response)
    })

    aggregate.switchPersona('wang-yangming', () => String(wangSessionId))
    wangHandle = await ctx.agents.create({
      sessionId: wangSessionId,
      agentOptions: { provider: FAKE_PROVIDER, model: FAKE_MODEL },
      setup: setupFor(aggregate, 'wang-yangming'),
    })

    const initialRef = aggregate.addUserRaw('e2e-initial-message', INITIAL_USER_RAW, 'wang-yangming')
    aggregate.setDilemmaCandidate(CANDIDATE_TEXT, 'wang-yangming')
    delivered['wang-yangming'].add(initialRef)
    const wangInitialTurn = send(wangHandle.agent, INITIAL_USER_RAW)
    await waitForIdle(wangHandle.agent, wangInitialTurn)
    console.log(`${TAG} A1 完成：王阳明收到用户原话，candidate 不进入演员事实上下文`)

    aggregate.switchPersona('zeng-guofan', () => String(zengSessionId))
    zengHandle = await ctx.agents.create({
      sessionId: zengSessionId,
      agentOptions: { provider: FAKE_PROVIDER, model: FAKE_MODEL },
      setup: setupFor(aggregate, 'zeng-guofan'),
    })
    syncMissingUserRaws(aggregate, 'zeng-guofan', zengHandle.agent, delivered)
    const zengContinueTurn = send(zengHandle.agent, CONTINUE_B)
    await waitForIdle(zengHandle.agent, zengContinueTurn)
    console.log(`${TAG} B1 完成：曾国藩通过共享原话接续，不接收王阳明回答`)

    const correctionRef = aggregate.addUserRaw('e2e-correction-message', CORRECTION_USER_RAW, 'zeng-guofan')
    aggregate.setDilemmaCorrected(CORRECTED_TEXT)
    delivered['zeng-guofan'].add(correctionRef)
    const zengCorrectionTurn = send(zengHandle.agent, CORRECTION_USER_RAW)
    await waitForIdle(zengHandle.agent, zengCorrectionTurn)
    console.log(`${TAG} B2 完成：纠正原话与 corrected 状态在生成前生效`)

    aggregate.switchPersona('wang-yangming', () => String(wangSessionId))
    syncMissingUserRaws(aggregate, 'wang-yangming', wangHandle.agent, delivered)
    const wangContinueTurn = send(wangHandle.agent, CONTINUE_A)
    await waitForIdle(wangHandle.agent, wangContinueTurn)
    console.log(`${TAG} A2 完成：恢复王阳明自己的历史，并读取用户纠正`)

    await ctx.sessions.flush(wangHandle.agent.session)
    await wangHandle.dispose()
    wangHandle = undefined
    resumedWangHandle = await ctx.agents.resume({
      resumeSessionId: wangSessionId,
      agentOptions: { provider: FAKE_PROVIDER, model: FAKE_MODEL },
      setup: setupFor(aggregate, 'wang-yangming'),
    })
    const wangResumeTurn = send(resumedWangHandle.agent, CONTINUE_AFTER_RESUME)
    await waitForIdle(resumedWangHandle.agent, wangResumeTurn)
    console.log(`${TAG} A3 完成：BranchSession 持久化恢复并继续生成`)

    const wangCancelTurn = send(resumedWangHandle.agent, CANCEL_PROMPT)
    await Promise.race([
      cancelEntered.promise,
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('取消探针未在 10s 内进入 llm/stream')), 10_000)
      }),
    ])
    resumedWangHandle.agent.cancel({ kind: 'user' })
    await waitForIdle(resumedWangHandle.agent, wangCancelTurn)
    console.log(`${TAG} A_CANCEL 完成：活动流被用户取消并收束`)

    await Promise.all([
      ctx.sessions.flush(resumedWangHandle.agent.session),
      ctx.sessions.flush(zengHandle.agent.session),
      aggregate.flush(),
    ])

    const restored = ConversationAggregate.load(conversationId, trunkDir, registry)
    const evidence: ControlLoopEvidence = {
      requests,
      branchLogs: {
        王阳明: branchLog(resumedWangHandle.agent),
        曾国藩: branchLog(zengHandle.agent),
      },
      restoredTrunk: {
        userRaws: restored.sharedLayer.userRaws.map(raw => raw.text),
        dilemmaPhase: restored.sharedLayer.dilemma.phase,
        correctedText: restored.sharedLayer.dilemma.correctedText,
      },
      cancelTurnEndKinds: turnEndKinds(resumedWangHandle.agent),
    }
    const summary = evaluateControlLoopEvidence(evidence, MARKERS)
    const report = {
      schemaVersion: 1,
      runId,
      generatedAt: new Date().toISOString(),
      mode: 'real-dsh-agent-loop-with-local-scripted-stream',
      providerNetworkUsed: false,
      tokenCost: 0,
      conversationId,
      sessionIds: { 王阳明: String(wangSessionId), 曾国藩: String(zengSessionId) },
      strategy: {
        sharedUserRaw: 'agent.inject + per-persona delivered-ref cursor',
        sharedDilemma: 'agent-scoped systemPrompt.context',
        privateHistory: 'independent DSH BranchSession',
      },
      summary,
      requests,
      restoredTrunk: evidence.restoredTrunk,
      cancelTurnEndKinds: evidence.cancelTurnEndKinds,
      branchEventTypes: {
        王阳明: resumedWangHandle.agent.session.events.map(event => event.type),
        曾国藩: zengHandle.agent.session.events.map(event => event.type),
      },
      branchLogs: evidence.branchLogs,
    }
    writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    exitCode = summary.passed ? 0 : 1
    console.log(`${TAG} ${summary.passed ? '✅ 全部硬门槛通过' : '❌ 硬门槛失败'} checks=${summary.checks.length}`)
    if (!summary.passed) console.log(`${TAG} failures=${JSON.stringify(summary.hardGateFailures)}`)
    console.log(`${TAG} 报告=${reportFile}`)
  } catch (error) {
    const failure = {
      schemaVersion: 1,
      runId,
      generatedAt: new Date().toISOString(),
      mode: 'real-dsh-agent-loop-with-local-scripted-stream',
      providerNetworkUsed: false,
      tokenCost: 0,
      error: error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { message: String(error) },
      requests,
    }
    writeFileSync(reportFile, `${JSON.stringify(failure, null, 2)}\n`, 'utf8')
    console.error(`${TAG} ❌ 运行失败，错误报告=${reportFile}`, error)
  } finally {
    streamDispose?.()
    await Promise.allSettled([
      resumedWangHandle?.dispose(),
      wangHandle?.dispose(),
      zengHandle?.dispose(),
    ].filter((value): value is Promise<void> => value !== undefined))
    const appExit = ctx.get('appExit')
    if (typeof appExit === 'function') {
      console.log(`${TAG} 请求优雅退出 appExit(${exitCode})`)
      appExit(exitCode)
    }
  }
}
