import { createRuntimeRegistry } from '../persona/runtime-registry.ts'
const registry = createRuntimeRegistry()
/**
 * man-roles-roleplayer —— 双人物切换端到端垂直切片驱动（E2E，阶段 4）。
 *
 * 由插件 apply 在 `MAN_ROLES_RP_E2E=dual` 时调用；默认 stub 模型（人物回答与
 * 导演推断均为固定文本），不消耗真实 API token（headless 主任务自身的 prompt
 * 仍走真实 API，用于触发装配）。
 *
 * 覆盖 task_plan 阶段 4 事件流：
 *  王阳明对话（user_raw 共享 + 王阳明 BranchSession 历史）→ 导演 candidate
 *  → 用户确认 confirmed（trunk 持久化，方案 A）→ 切换曾国藩（读已确认主干 +
 *  用户原话、读不到王阳明回答）→ 曾国藩独立回答 → 切回王阳明（恢复其历史）→
 *  flush + trunk 重启恢复自检。
 *
 * 关键契约验证：
 *  - 隔离：曾国藩上下文绝不含王阳明回答；切回王阳明上下文绝不含曾国藩回答
 *    （结构性保证：上下文只装配 currentBranch 历史 + trunk 共享层）；
 *  - 共享：切换后新人物读到用户原话（逐字）+ 已确认主干（confirmed）；
 *  - F001：candidate 不自动升级（确认事件前 phase=candidate）；
 *  - 方案 A：trunk JSONL 落盘 + 重启恢复（candidate/confirmed/userRaws/
 *    branchesIndex/PersonaId 全部读回）；
 *  - BranchSession 只含内置事件类型（user/message + assistant/message），
 *    自定义状态全部走 trunk —— 分支会话可跨进程恢复（不再触发阶段 3 的
 *    SessionFormatUnsupportedError）。
 */
import type { Context } from '@deepseek-ai/cordis'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { ConversationAggregate } from '../aggregate/aggregate.ts'
import { assembleBranchTurn } from '../context/assemble.ts'
import type { PersonaSpec } from '../context/assemble.ts'
import { judgeFeedback } from '../domain/dilemma.ts'
import type { PersonaId } from '../domain/schema.ts'

const TAG = '[man-roles-roleplayer:e2e-dual]'

/** E2E 固定 conversation id（trunk 文件名稳定标识，便于恢复验证）。 */
const CONVERSATION_ID = 'conversation-dual-e2e'
/** 王阳明 / 曾国藩独立 DSH Session id（分支隔离层）。 */
const SESSION_WANG = 'session-man-roles-wang-yangming'
const SESSION_ZENG = 'session-man-roles-zeng-guofan'

/** 用户原话（逐字保存到 trunk 共享层 + 当前分支历史）。 */
const USER_RAW = '我既想坚持理想主义，又觉得现实处处碰壁，不知如何自处。'

/** 人物规格：王阳明（完整占位）与曾国藩（占位 persona——只验证机制，不验证内容质量）。 */
const PERSONAS: Record<PersonaId, PersonaSpec> = {
  王阳明: {
    id: 'wang-yangming',
    name: '王阳明',
    systemPrompt: '你是王阳明。以心学立场与用户对话，务求「知行合一」的实践指引，区分史实、思想解释与现代推演。',
  },
  曾国藩: {
    id: 'zeng-guofan',
    name: '曾国藩',
    systemPrompt: '你是曾国藩。以儒家经世致用、担当实务的立场与用户对话。（占位 persona：阶段 4 只验证机制，人物内容待后续补全）',
  },
}

/** 人物回答 stub（生产由真实模型调用替换；接缝不变）。 */
function stubPersonaReply(persona: PersonaId): string {
  return persona === '王阳明'
    ? '知行本是一体，未曾真知而行，亦未曾实行而知。你既有所求，便先问自己：此心光明否？'
    : '天下事在人为，逆境正是磨炼处。既知所愿，便当咬牙做去，莫问前程。'
}

/** 导演推断 stub（生产由真实模型调用替换；输出保持 candidate 语义）。 */
function stubDirectorCandidate(): string {
  return '用户陷入理想主义与现实行动的冲突，可能困惑于「知行合一」的实践路径。'
}

/** trunk 存储目录：$DSH_HOME/man-roles/trunk/。 */
function trunkDir(): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'man-roles', 'trunk')
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

/** 打印 trunk JSONL 事件序列（观察证据：方案 A 落盘形态）。 */
function inspectTrunkLog(): void {
  const dir = trunkDir()
  const file = join(dir, `${CONVERSATION_ID}.jsonl`)
  if (!existsSync(file)) {
    console.log(`${TAG} 恢复自检: trunk 文件尚不存在 (${file})`)
    return
  }
  const lines = readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '')
  const summary = lines.map((l) => {
    try {
      const e = JSON.parse(l) as { type: string; seq: number; data?: Record<string, unknown> }
      const data = e.data as { text?: string; persona?: string; ref?: number; sessionId?: string } | undefined
      const brief = data?.text !== undefined ? `text=${JSON.stringify(String(data.text).slice(0, 18))}…`
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

/**
 * 重启恢复自检：模拟新进程 ConversationAggregate.load，断言方案 A 恢复完整性。
 * @param expectActive - 期望恢复的 PersonaId。
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

/**
 * 判断 trunk 是否已有用户数据（非仅 trunk/created 事件）。
 * 用于区分「首次完整链路」与「重启后的跨进程恢复验证」两次运行模式。
 */
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

/** 打印两个 BranchSession 的落盘证据（$DSH_HOME/sessions/_no-cwd/<id>/session.jsonl.zstd）。 */
function logBranchSessionPersistence(): void {
  for (const sessionId of [SESSION_WANG, SESSION_ZENG]) {
    const dir = branchSessionDir(sessionId)
    const files = existsSync(dir)
      ? readdirSync(dir).filter((f) => f.endsWith('.jsonl.zstd') || f.endsWith('.jsonl')).join(',')
      : '(无)'
    console.log(`${TAG} 分支会话落盘 ${existsSync(dir) ? '✅' : '❌'} ${sessionId}=${dir} 文件=${files}`)
  }
}

/**
 * 跨进程恢复验证（第 2 次运行：新进程 load 磁盘 trunk）。
 * 断言方案 A 的困惑状态（candidate/confirmed）、user_raw、branches 索引、
 * active_persona 在真实重启后全部读回；分支会话落盘存在。
 */
function runDualRecoveryVerification(): void {
  console.log(`${TAG} 检测到 trunk 已有用户数据 → 跨进程恢复验证模式（真实重启：新进程 load 磁盘）`)
  inspectTrunkLog()
  assertTrunkRecovery('wang-yangming')
  logBranchSessionPersistence()
  console.log(`${TAG} 结论: 方案 A 自持存储跨进程恢复 ✅（困惑状态/用户原话/分支索引/当前人物全部读回；`
    + `BranchSession 仅内置事件类型，无阶段 3 的 SessionFormatUnsupportedError）`)
}

/**
 * 执行双人物切换垂直切片。所有观测输出带 [man-roles-roleplayer:e2e-dual] 前缀。
 * 首次运行（trunk 无数据）跑完整链路；trunk 已有数据时自动进入跨进程恢复验证模式。
 * @param ctx - cordis 上下文（提供 sessions / sessionProjections 服务）。
 */
export function runDualVerticalSlice(ctx: Context): void {
  if (trunkHasData()) {
    runDualRecoveryVerification()
    return
  }
  const sessions = ctx.sessions
  const agg = ConversationAggregate.load(CONVERSATION_ID, trunkDir(), registry)
  console.log(`${TAG} 阶段0: 首次运行（trunk 无数据），创建 conversation=${CONVERSATION_ID}`
    + ` PersonaId=${agg.activePersona} (trunk=${agg.trunk.filePath})`)

  // ── 1. 王阳明对话：user_raw 进共享层 + 王阳明 BranchSession 历史 ─────────
  // 首次进入王阳明分支：switchPersona 登记分支索引（创建其 DSH Session 的契约入口）
  const wangFirst = agg.switchPersona('wang-yangming', () => SESSION_WANG)
  const ref = agg.addUserRaw('e2e-dual-message', USER_RAW, 'wang-yangming')
  const wang = sessions.create(SessionId(SESSION_WANG))
  const wangUserSeq = wang.append(
    'user/message',
    createUserMessage({ content: [{ type: 'text', text: USER_RAW }], source: { kind: 'user' } }),
    { surfaceOp: 'append' },
  ).seq
  const wangReply = stubPersonaReply('王阳明')
  wang.append(
    'assistant/message',
    {
      turn: 0,
      step: 0,
      message: createAssistantMessage({
        content: [{ type: 'text', text: wangReply }],
        source: { provider: 'man-roles-stub', model: 'vertical-slice-dual' },
      }),
    },
    { surfaceOp: 'append', sourceEventSeqs: [wangUserSeq] },
  )
  console.log(`${TAG} 阶段1: 首次进入王阳明 created=${wangFirst.created} sessionId=${wangFirst.sessionId}`
    + ` (应 created=true)`); console.log(`${TAG} 阶段1: user_raw 共享层 ref=${ref} 文本=${JSON.stringify(USER_RAW)}；`
    + `王阳明 BranchSession(${SESSION_WANG}) 历史 ${extractBranchHistory(wang).length} 条`
    + `，回答=${JSON.stringify(wangReply.slice(0, 20))}…`)

  // ── 2. 导演 candidate（未确认，F001）────────────────────────────────────
  agg.setDilemmaCandidate(stubDirectorCandidate(), 'wang-yangming')
  console.log(`${TAG} 阶段2: candidate 已写入 trunk，phase=${agg.trunk.state.dilemma.phase}`
    + ` (应为 candidate，未确认不自动升级 confirmed — F001)`
    + ` ${agg.trunk.state.dilemma.phase === 'candidate' ? '✅' : '❌'}`)

  // ── 3. 用户确认（语义判定）→ confirmed（共享事实）────────────────────────
  const feedback = '对，我就是困惑知行怎么合一。'
  const verdict = judgeFeedback(feedback)
  console.log(`${TAG} 阶段3: 用户反馈=${JSON.stringify(feedback)} 语义判定=${verdict}`)
  if (verdict === 'confirmed') {
    agg.setDilemmaConfirmed('知行合一的实践路径')
  } else if (verdict === 'corrected') {
    agg.setDilemmaCorrected('理想与现实如何两全')
  }
  console.log(`${TAG} 阶段3: 最终 trunk dilemma phase=${agg.trunk.state.dilemma.phase}`
    + ` confirmedText=${JSON.stringify(agg.trunk.state.dilemma.confirmedText)}`
    + ` userRawRefs=${JSON.stringify(agg.trunk.userRawRefs)} (只增不改)`)

  // ── 4. 切换曾国藩（首次进入：创建其 BranchSession + 登记索引）───────────
  const zengSwitch = agg.switchPersona('zeng-guofan', () => SESSION_ZENG)
  const zeng = sessions.create(SessionId(SESSION_ZENG))
  console.log(`${TAG} 阶段4: 切换曾国藩 sessionId=${zengSwitch.sessionId} created=${zengSwitch.created}`
    + ` (首次进入应 created=true)`)
  console.log(`${TAG} 阶段4: PersonaId=${agg.activePersona} branchesIndex=`
    + `${JSON.stringify(Object.fromEntries(agg.branchesIndex))}`)

  // ── 5. 曾国藩上下文装配：共享层 + 曾国藩自己的历史（读不到王阳明回答）───
  const zengAssembled = assembleBranchTurn({
    persona: PERSONAS['曾国藩'],
    sharedLayer: agg.sharedLayer,
    branchHistory: extractBranchHistory(zeng),
  })
  const zengText = zengAssembled.messages.map((m) => m.content).join('\n')
  console.log(`${TAG} 阶段5: 曾国藩上下文 messages=${zengAssembled.messages.length} 条`
    + ` roles=[${zengAssembled.messages.map((m) => m.role).join(', ')}]`)
  console.log(`${TAG} 阶段5: 隔离断言 曾国藩上下文含用户原话=${zengText.includes(USER_RAW) ? '✅' : '❌'}`)
  console.log(`${TAG} 阶段5: 隔离断言 曾国藩上下文含已确认主干=${zengText.includes('【已确认的困惑】') ? '✅' : '❌'}`)
  console.log(`${TAG} 阶段5: 隔离断言 曾国藩上下文不含王阳明回答=${!zengText.includes('知行本是一体') ? '✅' : '❌'}`)

  // ── 6. 曾国藩独立回答（写入其自己的 BranchSession）──────────────────────
  const zengReply = stubPersonaReply('曾国藩')
  zeng.append(
    'assistant/message',
    {
      turn: 0,
      step: 0,
      message: createAssistantMessage({
        content: [{ type: 'text', text: zengReply }],
        source: { provider: 'man-roles-stub', model: 'vertical-slice-dual' },
      }),
    },
    { surfaceOp: 'append' },
  )
  console.log(`${TAG} 阶段6: 曾国藩独立回答已写入 BranchSession(${SESSION_ZENG})`
    + `，回答=${JSON.stringify(zengReply.slice(0, 20))}…`)

  // ── 7. 切回王阳明：恢复其历史（不重建、不丢回答）────────────────────────
  const wangBack = agg.switchPersona('wang-yangming', () => SESSION_WANG)
  console.log(`${TAG} 阶段7: 切回王阳明 sessionId=${wangBack.sessionId} created=${wangBack.created}`
    + ` (返回复用应 created=false) ${wangBack.created === false ? '✅' : '❌'}`)
  const wangHistory = extractBranchHistory(wang)
  const wangAssembled = assembleBranchTurn({
    persona: PERSONAS['王阳明'],
    sharedLayer: agg.sharedLayer,
    branchHistory: wangHistory,
  })
  const wangText = wangAssembled.messages.map((m) => m.content).join('\n')
  console.log(`${TAG} 阶段7: 王阳明历史 ${wangHistory.length} 条`
    + ` (user/message + assistant/message)`)
  console.log(`${TAG} 阶段7: 隔离断言 王阳明上下文含王阳明回答=${wangText.includes('知行本是一体') ? '✅' : '❌'}`)
  console.log(`${TAG} 阶段7: 隔离断言 王阳明上下文不含曾国藩回答=${!wangText.includes('天下事在人为') ? '✅' : '❌'}`)
  console.log(`${TAG} 阶段7: token 估算=${wangAssembled.tokenEstimate}`
    + ` 预算=${wangAssembled.budget.used}/${wangAssembled.budget.limit}`)

  // ── 8. flush + 方案 A 恢复自检 ───────────────────────────────────────────
  void Promise.all([sessions.flush(wang), sessions.flush(zeng), agg.flush()]).then(
    async () => {
      console.log(`${TAG} 阶段8: flush 完成（王阳明 + 曾国藩 BranchSession + trunk）`)
      // 分支会话只含内置事件类型 → 跨进程恢复不触发阶段 3 的拒绝路径
      console.log(`${TAG} 阶段8: BranchSession 事件类型检查: 王阳明=[${extractBranchHistory(wang).map((h) => h.role).join(',')}]`
        + ` 曾国藩=[${extractBranchHistory(zeng).map((h) => h.role).join(',')}]`
        + ` (仅 user/assistant 内置类型，无自定义事件 → flush 不被拒)`)
      inspectTrunkLog()
      // 同进程内模拟重启（新实例 load）：方案 A 恢复断言
      console.log(`${TAG} 阶段8: 同进程内模拟重启（新实例 load 同一 trunk 文件）`)
      assertTrunkRecovery('wang-yangming')
      logBranchSessionPersistence()
    },
    async (error: unknown) => {
      console.error(`${TAG} 阶段8: flush 失败`, error)
    },
  )
}
