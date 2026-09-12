import { branchUserMessageExtra, branchUserMessageSourceSchema } from '../branch/message-source.ts'
import type { BranchUserMessageSource } from '../branch/message-source.ts'
import type { PersonaId } from '../domain/schema.ts'
import type { TrunkStorage } from '../storage/trunk-storage.ts'

/** DSH Session 的最小公开写入接缝；不依赖 DSH 运行时包。 */
export interface BranchSessionWriter {
  append(type: 'user/message', data: unknown, options?: { surfaceOp: 'append' }): unknown
}

/** DSH 的 durable boundary 是 sessions.flush(session)，由装配层注入。 */
export type BranchSessionFlush = (session: BranchSessionWriter) => Promise<unknown> | unknown

export type DeliveryStatus =
  | 'local-pending'
  | 'saving'
  | 'saved-delivering'
  | 'generating'
  | 'failed'
  | 'recovering'

export interface DeliveryStatusSnapshot {
  status: DeliveryStatus
  conversation_id: string
  message_id: string
  raw_ref?: string
  persona_id: PersonaId
  session_id?: string
  canStartGeneration: boolean
  error?: unknown
}

export interface DeliverCurrentUserMessageInput {
  trunk: TrunkStorage
  persona: PersonaId
  session: BranchSessionWriter
  sessionId: string
  messageId: string
  text: string
  flush: BranchSessionFlush
  /** Adapter query over the durably restored BranchSession view. */
  findUserMessageByRawRef?: (rawRef: string) => boolean | Promise<boolean>
  onStatus?: (snapshot: DeliveryStatusSnapshot) => void
  /** Native Actor path: enqueue the one durable user message without waking. */
  queueUserMessage?: (data: unknown) => void
  /** Called only by TurnRunner after the delivery commit. */
  wakePending?: () => boolean
}

export interface DeliveryResult {
  status: 'committed' | 'failed'
  rawRef: string
  source: BranchUserMessageSource
  canStartGeneration: boolean
  committedSeq?: number
  error?: unknown
  wakePending?: () => boolean
}

function emit(input: DeliverCurrentUserMessageInput, snapshot: DeliveryStatusSnapshot): void {
  input.onStatus?.(Object.freeze({ ...snapshot }))
}

/**
 * Trunk accepted → 当前人物 BranchSession append/flush → trunk committed。
 *
 * 该函数只负责当前用户消息投影，不查询或读取另一人物分支，也不会调用
 * AgentLoop。append 成功但 flush 失败时，Trunk 的 accepted 原话仍保留，且
 * 不会写 committed；这正是跨两个持久化边界的 pending 状态。
 */
export async function deliverCurrentUserMessage(input: DeliverCurrentUserMessageInput): Promise<DeliveryResult> {
  const { trunk, persona } = input
  emit(input, { status: 'local-pending', conversation_id: trunk.state.conversationId, message_id: input.messageId, persona_id: persona, session_id: input.sessionId, canStartGeneration: false })

  let ref: number
  const acceptedBeforeCall = trunk.state.userRaws.some((raw) => raw.messageId === input.messageId)
  emit(input, { status: 'saving', conversation_id: trunk.state.conversationId, message_id: input.messageId, persona_id: persona, session_id: input.sessionId, canStartGeneration: false })
  // Validate the target before acceptance: an invalid persona/session must not
  // leave an accepted raw that recovery could later deliver elsewhere.
  if (trunk.state.activePersona !== persona || trunk.state.branchesIndex[persona] !== input.sessionId) {
    const error = Object.assign(new Error(`branch session is not the active indexed persona: ${persona}`), { code: 'branch_target_mismatch' as const })
    emit(input, { status: 'failed', conversation_id: trunk.state.conversationId, message_id: input.messageId, persona_id: persona, session_id: input.sessionId, canStartGeneration: false, error })
    return { status: 'failed', rawRef: '', source: branchUserMessageSourceSchema.parse({ conversation_id: trunk.state.conversationId, message_id: input.messageId, raw_ref: 'rejected', persona_id: persona }), canStartGeneration: false, error }
  }
  try {
    ref = trunk.addUserRaw(input.messageId, input.text, persona)
  } catch (error) {
    emit(input, { status: 'failed', conversation_id: trunk.state.conversationId, message_id: input.messageId, persona_id: persona, session_id: input.sessionId, canStartGeneration: false, error })
    throw error
  }

  const raw = trunk.state.userRaws.find((item) => item.ref === ref)
  if (raw === undefined) throw new Error(`accepted user raw missing: ${ref}`)
  // The target is fixed at first acceptance; retrying with another persona is
  // rejected by TrunkStorage's message identity conflict rules.
  const source = branchUserMessageSourceSchema.parse({
    conversation_id: trunk.state.conversationId,
    message_id: raw.messageId,
    raw_ref: raw.rawRef,
    persona_id: persona,
  })
  emit(input, { status: 'saved-delivering', ...source, session_id: input.sessionId, canStartGeneration: false })

  // A client/network retry after the committed event is a no-op: do not
  // append a second Branch projection or create another committed side effect.
  if (trunk.isBranchDeliveryCommitted(persona, raw.rawRef)) {
    return { status: 'committed', rawRef: source.raw_ref, source, canStartGeneration: true, committedSeq: -1 }
  }

  if (acceptedBeforeCall && !input.findUserMessageByRawRef) {
    const error = Object.assign(new Error('durable Branch query is required for an existing accepted raw'), { code: 'query_missing' as const })
    emit(input, { status: 'failed', ...source, session_id: input.sessionId, canStartGeneration: false, error })
    return { status: 'failed', rawRef: source.raw_ref, source, canStartGeneration: false, error }
  }

  // A previous append may have succeeded while the trunk commit failed. Ask
  // the adapter's durable view before appending again, otherwise a retry would
  // duplicate the Branch projection.
  if (input.findUserMessageByRawRef) {
    try {
      if (await input.findUserMessageByRawRef(raw.rawRef)) {
        const committedSeq = trunk.commitBranchDelivery({ ...source, session_id: input.sessionId })
        return { status: 'committed', rawRef: source.raw_ref, source, canStartGeneration: true, committedSeq }
      }
    } catch (error) {
      emit(input, { status: 'failed', ...source, session_id: input.sessionId, canStartGeneration: false, error })
      return { status: 'failed', rawRef: source.raw_ref, source, canStartGeneration: false, error }
    }
  }

  try {
    const message = {
      id: input.messageId,
      role: 'user',
      content: [{ type: 'text', text: input.text }],
      // `kind:'user'` is the DSH transcript contract for a visible user
      // bubble. Product delivery identity is durable in `extra`, while Trunk
      // remains the authority for the original user text and routing.
      source: { kind: 'user' },
      extra: branchUserMessageExtra(source),
    }
    if (input.queueUserMessage) input.queueUserMessage(message)
    else input.session.append('user/message', message, { surfaceOp: 'append' })
    await input.flush(input.session)
  } catch (error) {
    emit(input, { status: 'failed', ...source, session_id: input.sessionId, canStartGeneration: false, error })
    return { status: 'failed', rawRef: source.raw_ref, source, canStartGeneration: false, error }
  }

  try {
    const committedSeq = trunk.commitBranchDelivery({ ...source, session_id: input.sessionId })
    return { status: 'committed', rawRef: source.raw_ref, source, canStartGeneration: true, committedSeq, ...(input.wakePending ? { wakePending: input.wakePending } : {}) }
  } catch (error) {
    emit(input, { status: 'failed', ...source, session_id: input.sessionId, canStartGeneration: false, error })
    return { status: 'failed', rawRef: source.raw_ref, source, canStartGeneration: false, error }
  }
}
