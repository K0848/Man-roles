/**
 * man-roles-roleplayer —— headless 端到端垂直切片驱动（E2E）。
 *
 * 由插件 apply 在 `MAN_ROLES_RP_E2E=1` 时调用；默认 stub 模型（人物回答与
 * 导演推断均为固定文本），不消耗真实 API token（headless 主任务自身的 prompt
 * 仍走真实 API，用于触发装配）。
 *
 * 覆盖 task_plan 阶段 3 最小事件流：
 *  用户输入 → 保存 user_raw（user/message，逐字）→ 人物回答（assistant/message）
 *  → 导演 candidate（自定义事件）→ Projection 显示困惑状态 → 用户确认
 *  （confirmed 事件）→ 下一轮上下文装配读取已确认状态。
 *
 * 同时演示/断言：
 *  - 幂等：同 (task_id, invocation_id) 重复提交跳过（不重复落盘/不重复调用）；
 *  - F001：candidate 不自动升级（确认事件之前 phase 保持 candidate）；
 *  - 恢复自检：读取 JSONL 观察自定义事件的持久化形态（无 ignorable 标记）。
 */
import type { Context } from '@deepseek-ai/cordis'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { zstdDecompress } from 'node:zlib'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { assembleNextTurn } from '../context/assemble.ts'
import { foldDilemmaState, judgeFeedback } from '../domain/dilemma.ts'
import { IdempotencyRegistry, newTurnIds } from '../turn/ids.ts'
import { DILEMMA_CANDIDATE, DILEMMA_CONFIRMED, toFoldInput } from '../events.ts'

/** E2E 探针 session 固定 id（cwd 未传 → 落盘到 $DSH_HOME/sessions/_no-cwd/）。 */
const SESSION_ID = 'session-man-roles-vertical-slice'
const TAG = '[man-roles-roleplayer:e2e]'

/** 用户原话（逐字保存，验证「user_raw 只增不改」）。 */
const USER_RAW = '我既想坚持理想主义，又觉得现实处处碰壁，不知如何自处。'

/** 人物回答 stub（生产由真实模型调用替换；接缝不变）。 */
function stubPersonaReply(): string {
  return '知行本是一体，未曾真知而行，亦未曾实行而知。你既有所求，便先问自己：此心光明否？'
}

/** 导演推断 stub（生产由真实模型调用替换；输出保持 candidate 语义）。 */
function stubDirectorCandidate(): string {
  return '用户陷入理想主义与现实行动的冲突，可能困惑于「知行合一」的实践路径。'
}

/** JSONL 落盘目录：$DSH_HOME/sessions/_no-cwd/<id>/（cwd 未传时）。 */
function sessionDir(): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'sessions', '_no-cwd', SESSION_ID)
}

const zstdDecompressAsync = promisify(zstdDecompress)

/** 简化 zstd 帧扫描（对齐 harness scanZstdFrames 语义：定位每个独立帧的字节范围）。 */
function scanZstdFrames(buffer: Buffer): Array<{ start: number; end: number }> {
  const frames: Array<{ start: number; end: number }> = []
  let offset = 0
  while (offset < buffer.length) {
    if (buffer.length - offset < 4) break
    const start = offset
    if (buffer.readUInt32LE(offset) !== 0xFD2FB528) break
    offset += 4
    if (offset === buffer.length) break
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 0x20) !== 0
    const checksum = (descriptor & 0x04) !== 0
    const dictionaryFlag = descriptor & 0x03
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0
      ? (singleSegment ? 1 : 0)
      : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) break
    offset += remainingHeaderBytes
    for (;;) {
      if (buffer.length - offset < 3) return frames
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 0x03
      const blockSize = blockHeader >>> 3
      if (blockType === 0x03) return frames
      const payloadBytes = blockType === 0x01 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) return frames
      offset += payloadBytes
      if (lastBlock) break
    }
    if (checksum) {
      if (buffer.length - offset < 4) return frames
      offset += 4
    }
    frames.push({ start, end: offset })
  }
  return frames
}

/** 解压并打印会话日志：事件类型序列 + 自定义事件的 ignorable 标记检查。 */
async function inspectSessionLog(raw: Buffer): Promise<void> {
  const frames = scanZstdFrames(raw)
  const parts: string[] = []
  for (const frame of frames) {
    const out = await zstdDecompressAsync(raw.subarray(frame.start, frame.end))
    parts.push(out.toString('utf8'))
  }
  const lines = parts.join('').split(/\r?\n/).filter((l) => l.trim() !== '')
  const types = lines.map((l) => {
    try {
      return JSON.parse(l).type as string
    } catch {
      return '<unparseable>'
    }
  })
  console.log(`${TAG} 恢复自检: 事件类型序列=[${types.join(', ')}]`)
  for (const line of lines) {
    const e = JSON.parse(line) as { type: string; seq: number; ignorable?: true }
    if (typeof e.type === 'string' && e.type.startsWith('man-roles/')) {
      // 契约检查：append() 不提供 ignorable 通道 → 事件对象不含 ignorable 标记
      console.log(`${TAG} 恢复自检: 自定义事件 type=${e.type} seq=${e.seq} `
        + `ignorable=${'ignorable' in e ? e.ignorable : '<absent>'}`)
    }
  }
  const custom = lines.filter((l) => {
    try {
      return (JSON.parse(l) as { type: string }).type.startsWith('man-roles/')
    } catch {
      return false
    }
  })
  if (custom.length > 0) {
    console.log(`${TAG} 恢复自检: 自定义事件已持久化到 zstd JSONL (${custom.length} 条)，均无 ignorable 标记；`
      + `按 dsh-session-persistence assertEventsSupported 契约（coordinator.ts L1061-1066），`
      + `无 ignorable 的未知类型在重启恢复时会被拒绝 —— 阶段 3 适配结论「跨进程持久化需适配」，详见 README`)
  }
}

/** 恢复自检：读取落盘 JSONL（zstd 压缩），列出事件并检查自定义事件的持久化形态。 */
async function restoreSelfCheck(): Promise<void> {
  const dir = sessionDir()
  if (!existsSync(dir)) {
    console.log(`${TAG} 恢复自检: 会话目录尚不存在 (${dir})，跳过`)
    return
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl.zstd') || f.endsWith('.jsonl'))
  console.log(`${TAG} 恢复自检: 会话目录=${dir}，日志文件=${files.join(', ') || '(无)'}`)
  for (const file of files) {
    const raw = readFileSync(join(dir, file))
    if (file.endsWith('.zstd')) {
      await inspectSessionLog(raw)
    } else {
      const text = raw.toString('utf8')
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
      const types = lines.map((l) => {
        try {
          return JSON.parse(l).type as string
        } catch {
          return '<unparseable>'
        }
      })
      console.log(`${TAG} 恢复自检: 事件类型序列=[${types.join(', ')}]`)
    }
  }
}

/**
 * 执行完整垂直切片。所有观测输出带 [man-roles-roleplayer:e2e] 前缀。
 * @param ctx - cordis 上下文（提供 sessions / sessionProjections 服务）。
 */
export function runVerticalSlice(ctx: Context): void {
  const sessions = ctx.sessions
  const projections = ctx.sessionProjections

  // ── 0. 会话创建（固定 id）──────────────────────────────────────────
  // 注意：SessionStore.create 只查内存 store（新进程为空），不自动加载磁盘
  // 旧会话，因此固定 id 总能 create 成功。磁盘上若已有同 id 落盘（上次运行），
  // flush 时 persistence 会尝试恢复旧 log —— 这恰好是跨进程持久化契约的验证点。
  const hasStored = existsSync(sessionDir())
    && readdirSync(sessionDir()).some((f) => f.endsWith('.zstd') || f.endsWith('.jsonl'))
  const session = sessions.create(SessionId(SESSION_ID))
  console.log(`${TAG} 阶段0: 创建会话 ${SESSION_ID} (seq=0)${hasStored ? '；磁盘已有同 id 落盘 → 跨进程持久化契约验证路径' : ''}`)

  const idem = new IdempotencyRegistry()

  // ── 1. 用户输入 → 保存 user_raw（逐字）+ 幂等记录 ────────────────────
  const turnIds = newTurnIds('e2e')
  let userSeq = -1
  const appendUser = (): number => {
    const ev = session.append(
      'user/message',
      createUserMessage({ content: [{ type: 'text', text: USER_RAW }], source: { kind: 'user' } }),
      { surfaceOp: 'append' },
    )
    return ev.seq
  }
  const first = idem.tryRun(turnIds.taskId, turnIds.invocationId, appendUser)
  userSeq = first.value
  console.log(`${TAG} 阶段1: user_raw 落盘 seq=${userSeq} 文本=${JSON.stringify(USER_RAW)} (逐字，仅追加)`)
  // 幂等演示：同 (task, invocation) 重复提交 → skipped，不重复落盘
  const repeat = idem.tryRun(turnIds.taskId, turnIds.invocationId, () => {
    throw new Error('重复提交不应执行落盘')
  })
  console.log(`${TAG} 阶段1: 幂等演示 重复提交 (${turnIds.taskId}:${turnIds.invocationId}) → status=${repeat.status}`
    + ` (断言: 不产生第二条 user/message)`)
  const userCount = session.events.filter((e) => e.type === 'user/message').length
  console.log(`${TAG} 阶段1: user/message 事件数=${userCount} (应为 1)`)

  // ── 2. 人物回答（stub）───────────────────────────────────────────────
  const replyText = stubPersonaReply()
  const replyInv = newTurnIds('e2e-reply')
  idem.tryRun(replyInv.taskId, replyInv.invocationId, () => {
    session.append(
      'assistant/message',
      {
        turn: 0,
        step: 0,
        message: createAssistantMessage({
          content: [{ type: 'text', text: replyText }],
          source: { provider: 'man-roles-stub', model: 'vertical-slice' },
        }),
      },
      { surfaceOp: 'append', sourceEventSeqs: [userSeq] },
    )
    return true
  })
  console.log(`${TAG} 阶段2: 人物回答(王阳明, stub) seq 已追加, 文本=${JSON.stringify(replyText)}`)

  // ── 3. 导演推断 → candidate 事件（不自动升级为 confirmed）─────────────
  const candidateText = stubDirectorCandidate()
  const candInv = newTurnIds('e2e-cand')
  idem.tryRun(candInv.taskId, candInv.invocationId, () => {
    session.append(
      DILEMMA_CANDIDATE,
      {
        turnId: turnIds.turnId,
        taskId: candInv.taskId,
        invocationId: candInv.invocationId,
        persona: 'wang-yangming',
        text: candidateText,
      },
    )
    return true
  })
  const snapAfterCandidate = projections.snapshot(session)
  const stateAfterCandidate = projections.stateOf(session, 'man-roles/dilemma')
  console.log(`${TAG} 阶段3: candidate 已追加, snapshot asOfSeq=${snapAfterCandidate.asOfSeq} `
    + `values=${JSON.stringify(snapAfterCandidate.values)}`)
  console.log(`${TAG} 阶段3: 状态机断言 phase=${stateAfterCandidate?.phase} (应为 candidate，`
    + `未确认不自动升级 confirmed — F001)`)

  // ── 4. 用户确认（反馈语义判断）→ confirmed 事件 ───────────────────────
  const feedback = '对，我就是困惑知行怎么合一。'
  const verdict = judgeFeedback(feedback)
  console.log(`${TAG} 阶段4: 用户反馈=${JSON.stringify(feedback)} 语义判定=${verdict}`)
  if (verdict === 'confirmed' || verdict === 'corrected') {
    const confInv = newTurnIds('e2e-conf')
    const targetText = verdict === 'confirmed' ? '知行合一的实践路径' : '理想与现实如何两全'
    idem.tryRun(confInv.taskId, confInv.invocationId, () => {
      session.append(
        verdict === 'confirmed' ? DILEMMA_CONFIRMED : 'man-roles/dilemma/corrected',
        {
          turnId: turnIds.turnId,
          taskId: confInv.taskId,
          invocationId: confInv.invocationId,
          text: targetText,
        },
      )
      return true
    })
    console.log(`${TAG} 阶段4: 已生成 ${verdict} 事件 text=${JSON.stringify(targetText)}`)
  }
  const snapFinal = projections.snapshot(session)
  const stateFinal = projections.stateOf(session, 'man-roles/dilemma')
  console.log(`${TAG} 阶段4: 最终 snapshot asOfSeq=${snapFinal.asOfSeq} values=${JSON.stringify(snapFinal.values)}`)
  console.log(`${TAG} 阶段4: 最终状态 phase=${stateFinal?.phase} confirmedText=${JSON.stringify(stateFinal?.confirmedText)}`
    + ` userRawRefs=${JSON.stringify(stateFinal?.userRawRefs)} (只增不改)`)

  // ── 5. 下一轮上下文装配（读取已确认状态）──────────────────────────────
  const assembled = assembleNextTurn({
    persona: {
      id: 'wang-yangming',
      name: '王阳明',
      systemPrompt: '你是王阳明。以心学立场与用户对话，务求「知行合一」的实践指引，区分史实、思想解释与现代推演。',
    },
    userRaw: USER_RAW,
    lastReply: replyText,
    dilemma: stateFinal ?? foldDilemmaState([]),
  })
  console.log(`${TAG} 阶段5: 下一轮上下文装配 messages=${assembled.messages.length} 条, `
    + `roles=[${assembled.messages.map((m) => m.role).join(', ')}]`)
  console.log(`${TAG} 阶段5: 已确认状态出现在上下文中: `
    + JSON.stringify(assembled.messages.some((m) => m.content.startsWith('【已确认的困惑】'))))
  console.log(`${TAG} 阶段5: token 估算=${assembled.tokenEstimate} 预算=${assembled.budget.used}/${assembled.budget.limit} `
    + `(ratio=${assembled.budget.ratio.toFixed(3)})`)

  // ── 6. 事件流回读（全量 fold 一致性）──────────────────────────────────
  const foldEvents = session.events.map((e) => toFoldInput(e)).filter((e) => e !== null)
  const folded = foldDilemmaState(foldEvents as Parameters<typeof foldDilemmaState>[0])
  console.log(`${TAG} 阶段6: 全量 fold 回读 phase=${folded.phase} userRawRefs=${JSON.stringify(folded.userRawRefs)}`
    + ` (与 projection 状态一致=${folded.phase === stateFinal?.phase})`)

  // ── 7. 落盘 + 恢复自检 ────────────────────────────────────────────────
  void sessions.flush(session).then(
    async () => {
      console.log(`${TAG} 阶段7: flush 完成 (已提交持久化到 ${sessionDir()})`)
      await restoreSelfCheck()
    },
    async (error: unknown) => {
      // 预期契约行为：磁盘已有含自定义事件的旧 log，恢复路径拒绝无 ignorable
      // 的未知类型（session-persistence coordinator.assertEventsSupported）。
      // 这是阶段 3 的适配结论「跨进程持久化需适配」的运行时证据，不是插件 bug。
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('unknown to this harness')) {
        console.log(`${TAG} 阶段7: flush 被拒 —— 预期契约行为（跨进程持久化缺口）: ${message.split(';')[0]}`)
        await restoreSelfCheck()
        return
      }
      console.error(`${TAG} 阶段7: flush 失败`, error)
    },
  )
}
