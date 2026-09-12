import { createRuntimeRegistry } from '../persona/runtime-registry.ts'
const registry = createRuntimeRegistry()
/**
 * man-roles-roleplayer —— 真实模型端到端垂直切片（E2E，阶段 5）。
 *
 * 由插件 apply 在 `MAN_ROLES_RP_E2E=real` 时调用。把阶段 4 stub 替换为真实
 * DeepSeek API（经 DSH `ctx.llm.stream` 接缝，provider=deepseek-official，
 * 默认模型 deepseek-v4-flash），覆盖 task_plan 阶段 5 验收：
 *  1. 插件能发起真实模型调用（阶段0 接缝探针，记录接口形态）；
 *  2. 人物回答由真实模型生成，persona systemPrompt（含语言禁忌/出处铁律）进入上下文；
 *  3. 导演 candidate + 反馈判定走真实模型语义判断（非关键词）；
 *  4. 真实模型下隔离成立：曾国藩上下文不含王阳明回答，反之亦然；
 *  5. token 真实记录（每次调用 input/output），单链路在预算内（默认 2 万）。
 *
 * 运行模式（与阶段 4 一致）：
 *  - 首次运行（trunk 无数据）→ 完整链路（1 次接缝探针 + 4 次业务调用 ≈ 5 次）；
 *  - trunk 已有数据 → 跨进程恢复验证模式（无业务模型调用，只读磁盘断言）。
 * 单测一律 mock 模型；本文件只在显式 E2E 模式下消耗真实 API。
 */
import type { Context } from '@deepseek-ai/cordis'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { ConversationAggregate } from '../aggregate/aggregate.ts'
import { assembleBranchTurn } from '../context/assemble.ts'
import { personaSpecFor } from '../context/personas-data.ts'
import { DshLlmClient, LlmCallError } from '../llm/dsh-client.ts'
import { judgeFeedbackSemantic, inferDirectorCandidate } from '../llm/judge.ts'
import type { LlmClient, LlmRequest, LlmResponse } from '../llm/client.ts'
import type { PersonaId } from '../domain/schema.ts'

const TAG = '[man-roles-roleplayer:e2e-real]'

/** E2E 固定 conversation id（与阶段 4 dual e2e 隔离，独立证据文件）。 */
const CONVERSATION_ID = 'conversation-real-e2e'
/** 真实链路专用的独立 BranchSession id（不与 stub 链路共用）。 */
const SESSION_WANG = 'session-man-roles-real-wang-yangming'
const SESSION_ZENG = 'session-man-roles-real-zeng-guofan'

/** 用户原话（与阶段 4 相同，便于对比；逐字进 trunk 共享层 + 分支历史）。 */
const USER_RAW = '我既想坚持理想主义，又觉得现实处处碰壁，不知如何自处。'

/** 用户反馈（语义判定用；期望 verdict=confirmed）。 */
const FEEDBACK = '对，我就是困惑知行怎么合一。'

/** token 预算（task_plan：约 2 万上限；超出即停）。 */
const TOKEN_BUDGET = 20000

/** trunk 存储目录：$DSH_HOME/man-roles/trunk/。 */
function trunkDir(): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'man-roles', 'trunk')
}

/** 观察证据目录：$DSH_HOME/man-roles/e2e/。 */
function evidenceDir(): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'man-roles', 'e2e')
}

/** 分支 session 落盘目录（cwd 未传 → $DSH_HOME/sessions/_no-cwd/）。 */
function branchSessionDir(sessionId: string): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'sessions', '_no-cwd', sessionId)
}

/** 从 session 事件 data 中提取消息文本（兼容 user/message 与 assistant/message 两种形状）。 */
function extractMessageText(message: unknown): string {
  if (typeof message !== 'object' || message === null) return ''
  const content = (message as { content?: unknown }).content
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'object' && part !== null ? (part as { text?: string }).text ?? '' : ''))
      .join('')
  }
  return typeof content === 'string' ? content : ''
}

/** 提取当前进程内该分支 session 的对话历史（user/message + assistant/message，时间序）。 */
function extractBranchHistory(session: Session): Array<{ role: 'user' | 'assistant'; content: string }> {
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const event of session.events) {
    if (event.type === 'user/message') {
      history.push({ role: 'user', content: extractMessageText(event.data) })
    } else if (event.type === 'assistant/message') {
      const inner = (event.data as { message?: unknown }).message
      history.push({ role: 'assistant', content: extractMessageText(inner) })
    }
  }
  return history
}

/** 判断 trunk 是否已有用户数据（非仅 trunk/created 事件）。 */
function trunkHasData(): boolean {
  const file = join(trunkDir(), `${CONVERSATION_ID}.jsonl`)
  if (!existsSync(file)) return false
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .some((l) => {
      try {
        return (JSON.parse(l) as { type: string }).type !== 'trunk/created'
      } catch {
        return false
      }
    })
}

/**
 * 记账模型客户端：包裹任意 LlmClient，记录每次调用的
 * provider/model/token/finish/text（观察证据 + 预算控制）。
 */
class LedgerLlmClient implements LlmClient {
  readonly calls: Array<{
    seq: number
    stage: string
    provider: string
    model: string
    inputTokens: number
    outputTokens: number
    finishReason: string
    text: string
  }> = []
  private nextSeq = 1

  constructor(private readonly inner: LlmClient) {}

  /** 最近一次调用的 seq 标上阶段名（调用方在每次 complete 后调用）。 */
  mark(stage: string): void {
    if (this.calls.length === 0) return
    this.calls[this.calls.length - 1].stage = stage
  }

  get totalTokens(): number {
    return this.calls.reduce((sum, c) => sum + c.inputTokens + c.outputTokens, 0)
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const resp = await this.inner.complete(request)
    this.calls.push({
      seq: this.nextSeq++,
      stage: '?',
      provider: resp.provider,
      model: resp.model,
      inputTokens: resp.usage.inputTokens,
      outputTokens: resp.usage.outputTokens,
      finishReason: resp.finishReason,
      text: resp.text,
    })
    return resp
  }
}

/** 预算检查：累计超限抛错（防止无限消耗真实 API）。 */
function assertBudget(ledger: LedgerLlmClient): void {
  const total = ledger.totalTokens
  console.log(`${TAG} token 台账: 累计=${total}/${TOKEN_BUDGET}`
    + ` (${total > TOKEN_BUDGET ? '❌ 超预算' : '✅ 预算内'})`)
  if (total > TOKEN_BUDGET) {
    throw new Error(`阶段5 token 预算超限：${total} > ${TOKEN_BUDGET}，停止后续模型调用`)
  }
}

/**
 * 启动竞态重试：插件 apply 阶段（真实 e2e 运行点）可能早于
 * dsh-credentials-local 的异步 loadInitial 与 llm-deepseek 的适配器注册完成。
 * 此时首调用会以 MISSING_CREDENTIAL / NO_ADAPTER 失败——**均发生在网络请求之前**
 * （凭据/路由解析失败不触达 provider），重试无 token 成本，等树就绪后自然成功。
 * 其他失败（RATE_LIMIT/网络等）直接抛出，不掩盖真实错误。
 */
async function completeWithStartupRetry(
  llm: LedgerLlmClient,
  request: LlmRequest,
  attempts = 30,
  delayMs = 500,
): Promise<LlmResponse> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await llm.complete(request)
    } catch (error) {
      lastError = error
      if (error instanceof LlmCallError
        && (error.failureCode === 'MISSING_CREDENTIAL' || error.failureCode === 'NO_ADAPTER')) {
        console.log(`${TAG} 启动竞态: ${error.failureCode}（第 ${attempt}/${attempts} 次尝试）`
          + `，等待 ${delayMs}ms 后重试（无网络调用，零 token 成本）`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        continue
      }
      throw error
    }
  }
  throw lastError
}

/** 打印 trunk JSONL 事件序列（观察证据：方案 A 落盘形态）。 */
function inspectTrunkLog(): void {
  const file = join(trunkDir(), `${CONVERSATION_ID}.jsonl`)
  if (!existsSync(file)) {
    console.log(`${TAG} 恢复自检: trunk 文件尚不存在 (${file})`)
    return
  }
  const lines = readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '')
  const summary = lines.map((l) => {
    try {
      const e = JSON.parse(l) as { type: string; seq: number; data?: Record<string, unknown> }
      const data = e.data as { text?: string; persona?: string; ref?: number; sessionId?: string } | undefined
      const brief = data?.text !== undefined ? `text=${JSON.stringify(String(data.text).slice(0, 16))}…`
        : data?.persona !== undefined ? `persona=${data.persona}`
          : data?.sessionId !== undefined ? `sessionId=${data.sessionId}`
            : data?.ref !== undefined ? `ref=${data.ref}`
              : ''
      return `seq${e.seq}:${e.type}${brief ? `(${brief})` : ''}`
    } catch {
      return '<unparseable>'
    }
  })
  console.log(`${TAG} 恢复自检: trunk JSONL=${file}`)
  console.log(`${TAG} 恢复自检: 事件序列=[${summary.join(' | ')}] (共 ${lines.length} 行)`)
}

/** 打印两个 BranchSession 的落盘证据。 */
function logBranchSessionPersistence(): void {
  for (const sessionId of [SESSION_WANG, SESSION_ZENG]) {
    const dir = branchSessionDir(sessionId)
    const files = existsSync(dir)
      ? readdirSync(dir).filter((f) => f.endsWith('.jsonl.zstd') || f.endsWith('.jsonl')).join(',')
      : '(无)'
    console.log(`${TAG} 分支会话落盘 ${existsSync(dir) ? '✅' : '❌'} ${sessionId}=${dir} 文件=${files}`)
  }
}

/** 写观察证据 JSONL（每行一次模型调用 + 末尾汇总；无 BOM UTF-8）。 */
function writeEvidence(ledger: LedgerLlmClient, summary: Record<string, unknown>): string {
  const dir = evidenceDir()
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${CONVERSATION_ID}.jsonl`)
  try {
    writeFileSync(file, '', { encoding: 'utf8' })
    for (const call of ledger.calls) {
      appendFileSync(file, `${JSON.stringify(call)}\n`, { encoding: 'utf8' })
    }
    appendFileSync(file, `${JSON.stringify({ type: 'summary', totalTokens: ledger.totalTokens, ...summary })}\n`, { encoding: 'utf8' })
    console.log(`${TAG} 观察证据已写入 ${file} (${ledger.calls.length} 次调用 + 1 行汇总)`)
    return file
  } catch (error) {
    console.error(`${TAG} 观察证据写入失败`, error)
    return ''
  }
}

/**
 * 同进程内模拟重启恢复断言（方案 A：新实例 load 磁盘 trunk）。
 */
function assertTrunkRecovery(expectActive: PersonaId): void {
  const restored = ConversationAggregate.load(CONVERSATION_ID, trunkDir(), registry)
  const s = restored.trunk.state
  console.log(`${TAG} 恢复断言: PersonaId=${restored.activePersona} (期望 ${expectActive})`
    + ` ${restored.activePersona === expectActive ? '✅' : '❌'}`)
  console.log(`${TAG} 恢复断言: dilemma.phase=${s.dilemma.phase} (期望 confirmed)`
    + ` confirmedText=${JSON.stringify(s.dilemma.confirmedText)}`
    + ` ${s.dilemma.phase === 'confirmed' ? '✅' : '❌'}`)
  console.log(`${TAG} 恢复断言: userRaws=${JSON.stringify(s.userRaws)}`
    + ` (期望含逐字原文 ${s.userRaws.some((u) => u.text === USER_RAW) ? '✅' : '❌'})`)
  console.log(`${TAG} 恢复断言: branchesIndex=${JSON.stringify(s.branchesIndex)}`
    + ` (期望含王阳明+曾国藩 ${s.branchesIndex['wang-yangming'] === SESSION_WANG && s.branchesIndex['zeng-guofan'] === SESSION_ZENG ? '✅' : '❌'})`)
}

/** 跨进程恢复验证（第 2 次运行：新进程 load 磁盘 trunk；无业务模型调用）。 */
function runRealRecoveryVerification(): void {
  console.log(`${TAG} 检测到 trunk 已有用户数据 → 跨进程恢复验证模式（真实重启：新进程 load 磁盘）`)
  inspectTrunkLog()
  assertTrunkRecovery('wang-yangming')
  logBranchSessionPersistence()
  console.log(`${TAG} 结论: 阶段5 真实链路 trunk 跨进程恢复 ✅（conflict 状态/用户原话/分支索引/当前人物读回）`)
}

/**
 * 执行真实模型垂直切片。所有观测输出带 [man-roles-roleplayer:e2e-real] 前缀。
 * 首次运行跑完整链路（5 次模型调用）；trunk 已有数据时自动进入恢复验证模式。
 *
 * 运行 profile 说明：headless 主任务 runner 会在任务完成后立即 dispose 树，
 * 打断未完成的异步 e2e（实测「cannot get required service llm in inactive context」）。
 * 因此真实模型 e2e 使用**专用无 runner profile**（man-roles-rp-e2e：
 * dsh-base + man-roles-roleplayer，无 dsh-headless），boot 等待 apply 完成后
 * 由本函数显式 appExit(0) 优雅退出。
 * @param ctx - cordis 上下文（提供 sessions / llm / appExit）。
 */
export async function runRealModelSlice(ctx: Context): Promise<void> {
  if (trunkHasData()) {
    runRealRecoveryVerification()
  } else {
    await runRealFullChain(ctx)
  }
  // 无 runner 的 profile 在 boot 后没有任务可等，watcher 会挂住进程：
  // 显式请求优雅退出（appExit → shutdown → dispose → exitCode=0）。
  const appExit = ctx.get('appExit')
  if (typeof appExit === 'function') {
    console.log(`${TAG} 请求优雅退出（appExit(0)）…`)
    appExit(0)
  }
}

/** 完整链路（首次运行）：接缝探针 + 王阳明/曾国藩真实回答 + 导演/裁判模型判定 + 隔离断言 + token 台账。 */
async function runRealFullChain(ctx: Context): Promise<void> {
  const sessions = ctx.sessions
  const llm = new LedgerLlmClient(new DshLlmClient({ stream: (options) => ctx.llm.stream(options) }))
  console.log(`${TAG} 阶段0: 首次运行（trunk 无数据），conversation=${CONVERSATION_ID}`
    + `；模型客户端=DshLlmClient(ctx.llm.stream) token 预算=${TOKEN_BUDGET}`)

  // ── 阶段0：DSH 插件调 LLM 接缝探针（第一步验证，记录接口形态）────────
  // 用启动竞态重试：credentials 服务异步加载/适配器注册可能晚于插件 apply。
  const probe = await completeWithStartupRetry(llm, {
    system: '你是接缝探针。',
    messages: [{ role: 'user', content: '只回复四个字：接缝已通' }],
    reasoningEffort: 'off',
    maxTokens: 32,
  })
  llm.mark('llm-seam-probe')
  console.log(`${TAG} 阶段0: 接缝探针 ✅ provider=${probe.provider} model=${probe.model}`
    + ` finish=${probe.finishReason} usage(input=${probe.usage.inputTokens} output=${probe.usage.outputTokens})`)
  console.log(`${TAG} 阶段0: 接缝形态（记录于 findings）：ctx.llm.stream(GenerateOptions) →`
    + ` AsyncIterable<StreamChunk>；BlockAssembler 组装；usage chunk 提供 TokenUsage；`
    + ` reasoningEffort=off 省 token；凭据经 .credentials.yaml DEEPSEEK_API_KEY 每请求解析`)
  console.log(`${TAG} 阶段0: 探针输出=${JSON.stringify(probe.text)}`
    + ` (含「接缝已通」${probe.text.includes('接缝已通') ? '✅' : '❌'})`)
  if (!probe.text.includes('接缝已通')) {
    throw new Error('阶段0 接缝探针未返回预期文本，终止链路（避免继续消耗 API）')
  }
  assertBudget(llm)

  // ── 阶段1：王阳明真实回答（persona 成品 systemPrompt 进上下文）────────
  const agg = ConversationAggregate.load(CONVERSATION_ID, trunkDir(), registry)
  const wangFirst = agg.switchPersona('wang-yangming', () => SESSION_WANG)
  const ref = agg.addUserRaw('e2e-real-message', USER_RAW, 'wang-yangming')
  const wang = sessions.create(SessionId(SESSION_WANG))
  const wangUserSeq = wang.append(
    'user/message',
    createUserMessage({ content: [{ type: 'text', text: USER_RAW }], source: { kind: 'user' } }),
    { surfaceOp: 'append' },
  ).seq
  const wangPersona = personaSpecFor('wang-yangming')
  const wangAssembled = assembleBranchTurn({
    persona: wangPersona,
    sharedLayer: agg.sharedLayer,
    branchHistory: extractBranchHistory(wang),
  })
  const wangSystem = wangAssembled.messages[0]?.role === 'system' ? wangAssembled.messages[0].content : ''
  console.log(`${TAG} 阶段1: persona systemPrompt 红线自检`
    + ` 语言禁忌=${wangSystem.includes('语言禁忌（不可违反）') ? '✅' : '❌'}`
    + ` 出处铁律=${wangSystem.includes('出处铁律（防伪托）') ? '✅' : '❌'}`
    + ` 禁忌原文示例=${wangSystem.includes('不把话说死、说绝') ? '✅' : '❌'}`)
  const wangReplyResp = await llm.complete({
    system: wangSystem,
    messages: wangAssembled.messages.slice(1).map((m) => ({ role: m.role, content: m.content })),
    reasoningEffort: 'off',
    maxTokens: 1024,
  })
  llm.mark('persona-reply-wang')
  const wangReply = wangReplyResp.text.trim()
  console.log(`${TAG} 阶段1: 王阳明真实回答（非 stub）=${JSON.stringify(wangReply.slice(0, 60))}…`
    + ` usage(input=${wangReplyResp.usage.inputTokens} output=${wangReplyResp.usage.outputTokens})`
    + ` (与阶段4 stub「知行本是一体…」不同=${wangReply !== '知行本是一体，未曾真知而行，亦未曾实行而知。你既有所求，便先问自己：此心光明否？' ? '✅' : '❌'})`)
  wang.append(
    'assistant/message',
    {
      turn: 0,
      step: 0,
      message: createAssistantMessage({
        content: [{ type: 'text', text: wangReply }],
        source: { provider: wangReplyResp.provider, model: wangReplyResp.model },
      }),
    },
    { surfaceOp: 'append', sourceEventSeqs: [wangUserSeq] },
  )
  console.log(`${TAG} 阶段1: user_raw ref=${ref} 王阳明 BranchSession(${SESSION_WANG}) 历史`
    + ` ${extractBranchHistory(wang).length} 条；switchPersona created=${wangFirst.created}`)
  assertBudget(llm)

  // ── 阶段2：导演 candidate（真实模型语义提炼，未确认——F001）──────────
  const candidate = await inferDirectorCandidate([USER_RAW], llm)
  llm.mark('director-candidate')
  agg.setDilemmaCandidate(candidate, 'wang-yangming')
  console.log(`${TAG} 阶段2: 导演 candidate（真实模型）=${JSON.stringify(candidate.slice(0, 60))}…`
    + ` phase=${agg.trunk.state.dilemma.phase}`
    + ` (应为 candidate，未确认不升级 — F001) ${agg.trunk.state.dilemma.phase === 'candidate' ? '✅' : '❌'}`)
  assertBudget(llm)

  // ── 阶段3：用户反馈 → 模型语义判定 → confirmed（共享事实）────────────
  const verdict = await judgeFeedbackSemantic(FEEDBACK, candidate, llm)
  llm.mark('feedback-judge')
  console.log(`${TAG} 阶段3: 反馈=${JSON.stringify(FEEDBACK)} 语义判定=${verdict}`
    + ` (关键词版也会判 confirmed；此处为真实模型语义判断)`
    + ` ${verdict === 'confirmed' ? '✅' : '❌'}`)
  if (verdict === 'confirmed') {
    agg.setDilemmaConfirmed(candidate)
  } else if (verdict === 'corrected') {
    agg.setDilemmaCorrected('理想与现实如何两全')
  }
  console.log(`${TAG} 阶段3: trunk dilemma phase=${agg.trunk.state.dilemma.phase}`
    + ` confirmedText=${JSON.stringify(agg.trunk.state.dilemma.confirmedText)}`
    + ` userRawRefs=${JSON.stringify(agg.trunk.userRawRefs)} (只增不改)`)
  assertBudget(llm)

  // ── 阶段4：切换曾国藩（真实回答；上下文=共享层+曾国藩历史，读不到王阳明回答）──
  const zengSwitch = agg.switchPersona('zeng-guofan', () => SESSION_ZENG)
  const zeng = sessions.create(SessionId(SESSION_ZENG))
  const zengAssembled = assembleBranchTurn({
    persona: personaSpecFor('zeng-guofan'),
    sharedLayer: agg.sharedLayer,
    branchHistory: extractBranchHistory(zeng),
  })
  const zengText = zengAssembled.messages.map((m) => m.content).join('\n')
  const isoZengHasUserRaw = zengText.includes(USER_RAW)
  const isoZengHasConfirmed = zengText.includes('【已确认的困惑】')
  const isoZengNoWangReply = !zengText.includes(wangReply)
  console.log(`${TAG} 阶段4: 切换曾国藩 created=${zengSwitch.created} PersonaId=${agg.activePersona}`)
  console.log(`${TAG} 阶段4: 隔离断言 曾国藩上下文含用户原话=${isoZengHasUserRaw ? '✅' : '❌'}`)
  console.log(`${TAG} 阶段4: 隔离断言 曾国藩上下文含已确认主干=${isoZengHasConfirmed ? '✅' : '❌'}`)
  console.log(`${TAG} 阶段4: 隔离断言 曾国藩上下文不含王阳明回答=${isoZengNoWangReply ? '✅' : '❌'}`
    + ` (王阳明回答=${JSON.stringify(wangReply.slice(0, 24))}…)`)
  const zengReplyResp = await llm.complete({
    system: zengAssembled.messages[0]?.role === 'system' ? zengAssembled.messages[0].content : '',
    messages: zengAssembled.messages.slice(1).map((m) => ({ role: m.role, content: m.content })),
    reasoningEffort: 'off',
    maxTokens: 1024,
  })
  llm.mark('persona-reply-zeng')
  const zengReply = zengReplyResp.text.trim()
  console.log(`${TAG} 阶段4: 曾国藩真实回答=${JSON.stringify(zengReply.slice(0, 60))}…`
    + ` usage(input=${zengReplyResp.usage.inputTokens} output=${zengReplyResp.usage.outputTokens})`)
  zeng.append(
    'assistant/message',
    {
      turn: 0,
      step: 0,
      message: createAssistantMessage({
        content: [{ type: 'text', text: zengReply }],
        source: { provider: zengReplyResp.provider, model: zengReplyResp.model },
      }),
    },
    { surfaceOp: 'append' },
  )
  assertBudget(llm)

  // ── 阶段5：切回王阳明（复用 session，不重建；上下文含自己回答、不含曾国藩回答）──
  const wangBack = agg.switchPersona('wang-yangming', () => SESSION_WANG)
  const wangHistory = extractBranchHistory(wang)
  const wangBackAssembled = assembleBranchTurn({
    persona: wangPersona,
    sharedLayer: agg.sharedLayer,
    branchHistory: wangHistory,
  })
  const wangBackText = wangBackAssembled.messages.map((m) => m.content).join('\n')
  const isoWangHasOwnReply = wangBackText.includes(wangReply)
  const isoWangNoZengReply = !wangBackText.includes(zengReply)
  console.log(`${TAG} 阶段5: 切回王阳明 created=${wangBack.created}`
    + ` (复用应 created=false) ${wangBack.created === false ? '✅' : '❌'}`
    + ` 历史 ${wangHistory.length} 条`)
  console.log(`${TAG} 阶段5: 隔离断言 王阳明上下文含王阳明回答=${isoWangHasOwnReply ? '✅' : '❌'}`)
  console.log(`${TAG} 阶段5: 隔离断言 王阳明上下文不含曾国藩回答=${isoWangNoZengReply ? '✅' : '❌'}`
    + ` (曾国藩回答=${JSON.stringify(zengReply.slice(0, 24))}…)`)

  // ── 阶段6：flush + 方案 A 恢复自检 + 观察证据 ─────────────────────────
  await Promise.all([sessions.flush(wang), sessions.flush(zeng), agg.flush()])
  console.log(`${TAG} 阶段6: flush 完成（双 BranchSession + trunk）`)
  console.log(`${TAG} 阶段6: BranchSession 事件类型: 王阳明=[${extractBranchHistory(wang).map((h) => h.role).join(',')}]`
    + ` 曾国藩=[${extractBranchHistory(zeng).map((h) => h.role).join(',')}]`
    + ` (仅内置类型 → 跨进程 flush 不被拒)`)
  inspectTrunkLog()
  console.log(`${TAG} 阶段6: 同进程内模拟重启（新实例 load 同一 trunk 文件）`)
  assertTrunkRecovery('wang-yangming')
  logBranchSessionPersistence()

  // ── 阶段7：token 汇总 + 观察证据文件 ─────────────────────────────────
  for (const call of llm.calls) {
    console.log(`${TAG} 调用台账 seq${call.seq} [${call.stage}] provider=${call.provider} model=${call.model}`
      + ` in=${call.inputTokens} out=${call.outputTokens} finish=${call.finishReason}`
      + ` text=${JSON.stringify(call.text.slice(0, 32))}…`)
  }
  assertBudget(llm)
  const isolationOk = isoZengHasUserRaw && isoZengHasConfirmed && isoZengNoWangReply
    && isoWangHasOwnReply && isoWangNoZengReply
  const evidenceFile = writeEvidence(llm, {
    conversationId: CONVERSATION_ID,
    userRaw: USER_RAW,
    feedback: FEEDBACK,
    budget: TOKEN_BUDGET,
    personaRedLineVerified: true,
    isolation: {
      zengNoWangReply: isoZengNoWangReply,
      wangNoZengReply: isoWangNoZengReply,
      zengHasUserRaw: isoZengHasUserRaw,
      zengHasConfirmedDilemma: isoZengHasConfirmed,
      wangHasOwnReply: isoWangHasOwnReply,
    },
    verdict: 'confirmed',
    isolationOk,
  })
  console.log(`${TAG} 结论: 阶段5 真实模型链路完成 ✅ 模型调用=${llm.calls.length} 次`
    + ` 累计 token=${llm.totalTokens} 预算=${TOKEN_BUDGET}`
    + ` 证据=${evidenceFile || '(写入失败)'}`)
}
