/**
 * man-roles-roleplayer —— TrunkStorage（方案 A：插件自持 JSONL 存储）。
 *
 * 背景（阶段 3 实测结论）：自定义 session 事件无法跨进程持久化（append 无
 * ignorable 写入通道，persistence assertEventsSupported 拒绝未知类型）。因此
 * 困惑主干（candidate/confirmed/corrected）、用户原话本体、branches 索引与
 * active_persona 由本插件**自持独立 JSONL** 持久化（用户 2026-08-23 确认方案 A），
 * DSH Projection 仅作进程内视图；不修改 DSH Core。
 *
 * 存储语义（事件源 + 投影）：
 *  - JSONL 追加写（一行一条 { type, seq, time, data }），无 BOM UTF-8；
 *  - seq 单调递增，恢复时重复 seq 幂等跳过；
 *  - 启动恢复 = 重放全部事件，dilemma 状态复用 src/domain/dilemma.ts 状态机
 *    （F001：candidate 不自动升级 confirmed，与阶段 3 同一规则）；
 *  - 本模块纯 node:fs + zod，零 @deepseek-ai 运行时依赖（可单测）。
 *
 * 写入策略：每次 append 同步落盘（appendFileSync）——MVP 数据量小，简单可靠；
 * 失败路径：写文件抛错向上抛，由调用方决定（task_plan：TrunkStorage 写失败
 * 不阻塞人物回答，共享层落后可后续补偿）。
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { z, type ZodType } from 'zod'
import { dirname, join } from 'node:path'
import {
  initialTrunkState,
  trunkEventRecordSchema,
  trunkUserRawAddedEventSchema,
  trunkDilemmaCandidateEventSchema,
  trunkDilemmaConfirmedEventSchema,
  trunkDilemmaCorrectedEventSchema,
  trunkActivePersonaEventSchema,
  trunkBranchIndexEventSchema,
  trunkTaskOutcomeRecordedEventSchema,
  trunkBranchDeliveryCommittedEventSchema,
  dilemmaItemSchema, branchProgressSchema, dialogueControlStateSchema,
  taskRoutedEventSchema, dialoguePhaseSetEventSchema, dilemmaItemProposedEventSchema,
  dilemmaItemReviewedEventSchema, dilemmaCoreSelectedEventSchema, branchProgressUpdatedEventSchema,
  actionRecordedEventSchema, sessionControlRecordedEventSchema, dialogueEventMetaSchema,
} from '../domain/schema.ts'
import type { PersonaId, TrunkEventRecord, TrunkState, TaskOutcome } from '../domain/schema.ts'
import type { PersonaRegistry } from '../persona/registry.ts'
import { taskOutcomeSchema } from '../domain/schema.ts'
import { transition } from '../domain/dilemma.ts'
import type { DilemmaFoldInput } from '../domain/dilemma.ts'

/** trunk 事件类型常量（本存储自己的事件命名空间，与 session 自定义事件无关）。 */
export const TRUNK_CREATED = 'trunk/created' as const
export const TRUNK_USER_RAW_ADDED = 'trunk/user-raw-added' as const
export const TRUNK_DILEMMA_CANDIDATE = 'trunk/dilemma-candidate' as const
export const TRUNK_DILEMMA_CONFIRMED = 'trunk/dilemma-confirmed' as const
export const TRUNK_DILEMMA_CORRECTED = 'trunk/dilemma-corrected' as const
export const TRUNK_ACTIVE_PERSONA_SET = 'trunk/active-persona-set' as const
export const TRUNK_BRANCH_INDEXED = 'trunk/branch-indexed' as const
export const TRUNK_TASK_OUTCOME_RECORDED = 'trunk/task-outcome-recorded' as const
export const TRUNK_BRANCH_DELIVERY_COMMITTED = 'trunk/branch-delivery-committed' as const
export const TRUNK_TASK_ROUTED = 'trunk/task-routed' as const
export const TRUNK_DIALOGUE_PHASE_SET = 'trunk/dialogue-phase-set' as const
export const TRUNK_DILEMMA_ITEM_PROPOSED = 'trunk/dilemma-item-proposed' as const
export const TRUNK_DILEMMA_ITEM_REVIEWED = 'trunk/dilemma-item-reviewed' as const
export const TRUNK_DILEMMA_CORE_SELECTED = 'trunk/dilemma-core-selected' as const
export const TRUNK_BRANCH_PROGRESS_UPDATED = 'trunk/branch-progress-updated' as const
export const TRUNK_ACTION_RECORDED = 'trunk/action-recorded' as const
export const TRUNK_SESSION_CONTROL_RECORDED = 'trunk/session-control-recorded' as const
export const TRUNK_PRODUCT_LIFECYCLE = 'trunk/v2/product-lifecycle' as const
export const TRUNK_PRODUCT_RESULT = 'trunk/v2/product-result' as const

const NEW_EVENT_SCHEMAS: Record<string, ZodType> = {
  [TRUNK_TASK_ROUTED]: taskRoutedEventSchema,
  [TRUNK_DIALOGUE_PHASE_SET]: dialoguePhaseSetEventSchema,
  [TRUNK_DILEMMA_ITEM_PROPOSED]: dilemmaItemProposedEventSchema,
  [TRUNK_DILEMMA_ITEM_REVIEWED]: dilemmaItemReviewedEventSchema,
  [TRUNK_DILEMMA_CORE_SELECTED]: dilemmaCoreSelectedEventSchema,
  [TRUNK_BRANCH_PROGRESS_UPDATED]: branchProgressUpdatedEventSchema,
  [TRUNK_ACTION_RECORDED]: actionRecordedEventSchema,
  [TRUNK_SESSION_CONTROL_RECORDED]: sessionControlRecordedEventSchema,
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value as object).sort().map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(value)
}

function commitKey(data: { messageId: string; taskId: string; eventPurpose: string }): string {
  return `${data.messageId}\u0000${data.taskId}\u0000${data.eventPurpose}`
}

/**
 * 把一条 trunk 事件折叠进 TrunkState（append 增量更新与恢复重放共用同一逻辑，
 * 保证两者语义一致）。dilemma 部分经状态机 transition 处理（复用阶段 3 规则）。
 */
export function applyTrunkRecord(state: TrunkState, record: TrunkEventRecord): TrunkState {
  const commitTypes = ['trunk/task-routed', 'trunk/dialogue-phase-set', 'trunk/dilemma-item-proposed', 'trunk/dilemma-item-reviewed', 'trunk/dilemma-core-selected', 'trunk/branch-progress-updated', 'trunk/action-recorded', 'trunk/session-control-recorded']
  if (commitTypes.includes(record.type)) {
    const fullSchema = NEW_EVENT_SCHEMAS[record.type]
    if (!fullSchema) return state
    const full = fullSchema.safeParse(record.data)
    // A malformed payload must not even reserve its durable idempotency key.
    if (!full.success) return state
    const meta = (record.data && typeof record.data === 'object') ? record.data as Record<string, unknown> : {}
    const parsedMeta = dialogueEventMetaSchema.safeParse({ messageId: meta.messageId, taskId: meta.taskId, eventPurpose: meta.eventPurpose, sourceRawRefs: meta.sourceRawRefs })
    if (!parsedMeta.success) return state
    if (parsedMeta.data.sourceRawRefs.some((ref) => !state.userRaws.some((raw) => raw.rawRef === ref))) return state
    const itemRefs = (meta.item && typeof meta.item === 'object') ? (meta.item as Record<string, unknown>).sourceRawRefs : undefined
    const replacementRefs = (meta.replacement && typeof meta.replacement === 'object') ? (meta.replacement as Record<string, unknown>).sourceRawRefs : undefined
    for (const refs of [itemRefs, replacementRefs]) {
      if (Array.isArray(refs) && refs.some((ref) => typeof ref !== 'string' || !parsedMeta.data.sourceRawRefs.includes(ref))) return state
    }
    const key = `${parsedMeta.data.messageId}\u0000${parsedMeta.data.taskId}\u0000${parsedMeta.data.eventPurpose}`
    const hash = stableJson(record.data)
    const prior = state.dialogueCommits[key]
    if (prior && prior.payloadHash !== hash) throw new Error(`dialogue commit conflict: ${key}`)
    if (!prior) state = { ...state, dialogueCommits: { ...state.dialogueCommits, [key]: { payloadHash: hash } } }
  }
  switch (record.type) {
    case TRUNK_CREATED:
      return state

    case TRUNK_USER_RAW_ADDED: {
      const parsed = trunkUserRawAddedEventSchema.safeParse(record.data)
      if (!parsed.success) return state
      // 幂等：ref 已存在则跳过（不重复追加本体）
      if (state.userRaws.some((u) => u.ref === parsed.data.ref)) return state
      const fold: DilemmaFoldInput = { type: 'user/message', seq: parsed.data.ref }
      const raw: { ref: number; text: string; messageId: string; rawRef: string; targetPersonaId?: PersonaId } = { ref: parsed.data.ref, text: parsed.data.text,
        messageId: parsed.data.message_id ?? `legacy-message-${state.conversationId}-${parsed.data.ref}`,
        rawRef: parsed.data.raw_ref ?? `legacy-raw-${state.conversationId}-${parsed.data.ref}` }
      // The target is an ordinary enumerable state field so snapshots and
      // structured clones retain the acceptance fact. Legacy records omit it.
      if (parsed.data.target_persona_id) raw.targetPersonaId = parsed.data.target_persona_id
      return {
        ...state,
        userRaws: [...state.userRaws, raw],
        dilemma: transition(state.dilemma, fold),
      }
    }

    case TRUNK_DILEMMA_CANDIDATE: {
      const parsed = trunkDilemmaCandidateEventSchema.safeParse(record.data)
      if (!parsed.success) return state
      const fold: DilemmaFoldInput = {
        type: 'man-roles/dilemma/candidate',
        seq: record.seq,
        data: {
          turnId: 'trunk',
          taskId: 'trunk',
          invocationId: `trunk-seq-${record.seq}`,
          persona: parsed.data.persona,
          text: parsed.data.text,
        },
      }
      const next = transition(state.dilemma, fold)
      const refs = legacyRefs(state, (record.data as Record<string, unknown>))
      if (refs.length === 0) return { ...state, dilemma: next }
      const item: import('../domain/schema.ts').DilemmaItem = { id: `legacy-${record.seq}`, kind: 'core-conflict', text: parsed.data.text, status: 'candidate', sourceRawRefs: refs, proposedByPersona: parsed.data.persona, visibility: 'origin-persona-only', revision: record.seq + 1 }
      return { ...state, dilemma: next, dilemmaItems: state.dilemmaItems.some((x) => x.id === item.id) ? state.dilemmaItems : [...state.dilemmaItems, item] }
    }

    case TRUNK_DILEMMA_CONFIRMED: {
      const parsed = trunkDilemmaConfirmedEventSchema.safeParse(record.data)
      if (!parsed.success) return state
      const fold: DilemmaFoldInput = {
        type: 'man-roles/dilemma/confirmed',
        seq: record.seq,
        data: {
          turnId: 'trunk',
          taskId: 'trunk',
          invocationId: `trunk-seq-${record.seq}`,
          text: parsed.data.text,
        },
      }
      const next = transition(state.dilemma, fold)
      const refs = legacyRefs(state, (record.data as Record<string, unknown>))
      const old = [...state.dilemmaItems].reverse().find((x) => x.status === 'candidate' && !x.supersededBy)
      const itemRefs = refs.length ? refs : (old?.sourceRawRefs ?? [])
      // A legacy event without a durable raw source can still update the
      // compatibility dilemma projection, but must not invent an invalid
      // DilemmaItem whose required sourceRawRefs is empty.
      if (!itemRefs.length) return { ...state, dilemma: next }
      const item: import('../domain/schema.ts').DilemmaItem = { id: `legacy-${record.seq}`, kind: 'core-conflict', text: parsed.data.text, status: 'confirmed', sourceRawRefs: itemRefs, proposedByPersona: old?.proposedByPersona ?? state.activePersona, visibility: 'shared-confirmed', revision: record.seq + 1, ...(old ? { supersedes: old.id } : {}) }
      const items = old ? state.dilemmaItems.map((x) => x.id === old.id ? { ...x, status: 'superseded' as const, supersededBy: item.id } : x) : state.dilemmaItems
      return { ...state, dilemma: next, dilemmaItems: items.some((x) => x.id === item.id) ? items : [...items, item] }
    }

    case TRUNK_DILEMMA_CORRECTED: {
      const parsed = trunkDilemmaCorrectedEventSchema.safeParse(record.data)
      if (!parsed.success) return state
      const fold: DilemmaFoldInput = {
        type: 'man-roles/dilemma/corrected',
        seq: record.seq,
        data: {
          turnId: 'trunk',
          taskId: 'trunk',
          invocationId: `trunk-seq-${record.seq}`,
          text: parsed.data.text,
        },
      }
      const next = transition(state.dilemma, fold)
      const refs = legacyRefs(state, (record.data as Record<string, unknown>))
      const old = [...state.dilemmaItems].reverse().find((x) => x.status === 'candidate' && !x.supersededBy)
      const itemRefs = refs.length ? refs : (old?.sourceRawRefs ?? [])
      if (!itemRefs.length) return { ...state, dilemma: next }
      const item: import('../domain/schema.ts').DilemmaItem = { id: `legacy-${record.seq}`, kind: 'core-conflict', text: parsed.data.text, status: 'confirmed', sourceRawRefs: itemRefs, proposedByPersona: old?.proposedByPersona ?? state.activePersona, visibility: 'shared-confirmed', revision: record.seq + 1, ...(old ? { supersedes: old.id } : {}) }
      const items = old ? state.dilemmaItems.map((x) => x.id === old.id ? { ...x, status: 'superseded' as const, supersededBy: item.id } : x) : state.dilemmaItems
      return { ...state, dilemma: next, dilemmaItems: items.some((x) => x.id === item.id) ? items : [...items, item] }
    }

    case TRUNK_ACTIVE_PERSONA_SET: {
      const parsed = trunkActivePersonaEventSchema.safeParse(record.data)
      if (!parsed.success) return state
      return { ...state, activePersona: parsed.data.persona }
    }

    case TRUNK_BRANCH_INDEXED: {
      const parsed = trunkBranchIndexEventSchema.safeParse(record.data)
      if (!parsed.success) return state
      return { ...state, branchesIndex: { ...state.branchesIndex, [parsed.data.persona]: parsed.data.sessionId } }
    }

    case TRUNK_TASK_OUTCOME_RECORDED: {
      const parsed = trunkTaskOutcomeRecordedEventSchema.safeParse(record.data); if (!parsed.success) return state
      const previous = state.taskOutcomes[parsed.data.taskId]; if (previous && JSON.stringify(previous) !== JSON.stringify(parsed.data)) throw new Error(`task outcome conflict: ${parsed.data.taskId}`)
      return previous ? state : { ...state, taskOutcomes: { ...state.taskOutcomes, [parsed.data.taskId]: parsed.data } }
    }

    case TRUNK_BRANCH_DELIVERY_COMMITTED: {
      const parsed = trunkBranchDeliveryCommittedEventSchema.safeParse(record.data)
      if (!parsed.success) return state
      if (state.deliveryCommitted.some((d) => d.conversation_id === parsed.data.conversation_id && d.persona_id === parsed.data.persona_id && d.raw_ref === parsed.data.raw_ref)) return state
      return { ...state, deliveryCommitted: [...state.deliveryCommitted, parsed.data] }
    }

    case 'trunk/dilemma-item-proposed': {
      const parsedEvent = dilemmaItemProposedEventSchema.safeParse(record.data)
      const parsed = parsedEvent.success ? parsedEvent.data.item : null
      if (!parsed || parsed.status !== 'candidate' || parsed.visibility !== 'origin-persona-only') return state
      if (state.dilemmaItems.some((x) => x.id === parsed.id)) return state
      return { ...state, dilemmaItems: [...state.dilemmaItems, parsed] }
    }
    case 'trunk/dilemma-item-reviewed': {
      const data = dilemmaItemReviewedEventSchema.safeParse(record.data)
      if (!data.success) return state
      const old = state.dilemmaItems.find((x) => x.id === data.data.itemId)
      if (!old || data.data.action === 'skip') return state
      if (old.status !== 'candidate' || old.supersededBy) return state
      if (data.data.action === 'reject') return { ...state, dilemmaItems: state.dilemmaItems.map((x) => x.id === old.id ? { ...x, status: 'rejected' as const } : x), coreDilemmaItemId: state.coreDilemmaItemId === old.id ? null : state.coreDilemmaItemId }
      const replacement = data.data.replacement
      if (!replacement || replacement.supersedes !== old.id) return state
      if (replacement.id === old.id || state.dilemmaItems.some((x) => x.id === replacement.id)) return state
      if (replacement.revision !== old.revision + 1 || replacement.status !== 'confirmed' || replacement.visibility !== 'shared-confirmed' || replacement.proposedByPersona !== old.proposedByPersona || replacement.kind !== old.kind) return state
      const items = state.dilemmaItems.map((x) => x.id === old.id ? { ...x, status: 'superseded' as const, supersededBy: replacement.id } : x)
      return { ...state, dilemmaItems: [...items, replacement], coreDilemmaItemId: state.coreDilemmaItemId === old.id ? null : state.coreDilemmaItemId }
    }
    case 'trunk/dilemma-core-selected': {
      const parsed = dilemmaCoreSelectedEventSchema.safeParse(record.data)
      if (!parsed.success) return state
      const id = parsed.data.itemId
      const item = state.dilemmaItems.find((x) => x.id === id)
      if (!item || item.kind !== 'core-conflict' || item.status !== 'confirmed' || item.supersededBy) return state
      return { ...state, coreDilemmaItemId: id }
    }
    case 'trunk/branch-progress-updated': {
      const event = branchProgressUpdatedEventSchema.safeParse(record.data)
      if (!event.success) return state
      const progress = event.data.progress
      const prev = state.branchProgress[progress.personaId]
      if (prev && prev.summary === progress.summary && prev.lastSemanticSeq === progress.lastSemanticSeq) return state
      return { ...state, branchProgress: { ...state.branchProgress, [progress.personaId]: progress } }
    }
    case 'trunk/dialogue-phase-set': {
      const parsed = dialoguePhaseSetEventSchema.safeParse(record.data)
      return parsed.success ? { ...state, dialogue: parsed.data.control } : state
    }

    case 'trunk/task-routed': return taskRoutedEventSchema.safeParse(record.data).success ? state : state
    case 'trunk/action-recorded': return actionRecordedEventSchema.safeParse(record.data).success ? state : state
    case 'trunk/session-control-recorded': return sessionControlRecordedEventSchema.safeParse(record.data).success ? state : state

    default:
      return state
  }
}

/** 从一行 JSON 解析 trunk 事件记录（解析失败返回 null）。 */
function parseRecordLine(line: string): TrunkEventRecord | null {
  try {
    const parsed = trunkEventRecordSchema.safeParse(JSON.parse(line))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * 方案 A 自持存储。一个 conversation 对应一个 JSONL 文件
 * `<storageDir>/<conversationId>.jsonl`。
 */
export class TrunkStorage {
  /** 存储目录（JSONL 文件所在目录）。 */
  readonly storageDir: string
  /** JSONL 文件绝对路径。 */
  readonly filePath: string
  private stateInternal: TrunkState
  private nextSeqInternal: number
  readonly registry: PersonaRegistry

  private constructor(state: TrunkState, filePath: string, nextSeq: number, registry: PersonaRegistry) {
    this.stateInternal = state
    this.filePath = filePath
    this.storageDir = dirname(filePath)
    this.nextSeqInternal = nextSeq
    this.registry = registry
  }

  /** 当前完整状态（只读快照）。 */
  get state(): TrunkState {
    return this.stateInternal
  }

  /** 下一个事件 seq（未使用）。 */
  get nextSeq(): number {
    return this.nextSeqInternal
  }

  /** 创建新 trunk（写入 trunk/created 事件，seq=0）。 */
  static create(conversationId: string, storageDir: string, initialPersonaId: PersonaId, registry: PersonaRegistry): TrunkStorage {
    const initial = registry.requireActiveForCreate(initialPersonaId).id
    const filePath = join(storageDir, `${conversationId}.jsonl`)
    mkdirSync(storageDir, { recursive: true })
    const storage = new TrunkStorage(initialTrunkState(conversationId, initial), filePath, 0, registry)
    storage.append(TRUNK_CREATED, { conversationId, initial_persona_id: initial })
    return storage
  }

  /**
   * 从磁盘恢复 trunk（启动恢复；重放 JSONL 事件，重复 seq 幂等跳过）。
   * 文件不存在 → 视为新会话（等价 create，但不重复写 created 事件由调用方决定——
   * 此处直接返回新实例并写 created）。
   */
  static load(conversationId: string, storageDir: string, registry: PersonaRegistry): TrunkStorage {
    const filePath = join(storageDir, `${conversationId}.jsonl`)
    if (!existsSync(filePath)) {
      throw new Error(`cannot restore missing trunk without explicit initial PersonaId: ${conversationId}`)
    }
    const text = readFileSync(filePath, 'utf8')
    const rawLines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
    const rawRecords = rawLines.map(parseRecordLine).filter((record): record is TrunkEventRecord => record !== null)
    let initialRaw: string | undefined
    for (const record of rawRecords) {
      const data = record.data as Record<string, unknown>
      initialRaw = typeof data.initial_persona_id === 'string' ? data.initial_persona_id
        : typeof data.persona === 'string' ? data.persona
        : typeof data.target_persona_id === 'string' ? data.target_persona_id
        : typeof data.persona_id === 'string' ? data.persona_id
        : typeof data.personaId === 'string' ? data.personaId : undefined
      if (initialRaw) break
    }
    if (!initialRaw) throw new Error(`trunk has no recoverable PersonaId: ${conversationId}`)
    // This is the persisted replay boundary: legacy IDs are accepted here and
    // converted before any canonical-only state fold or runtime construction.
    const initial = registry.normalizePersistedId(initialRaw)
    let state = initialTrunkState(conversationId, initial)
    let maxSeq = -1
    for (const line of rawLines) {
      if (line.trim() === '') continue
      const record = parseRecordLine(line)
      if (record === null) continue
      record.data = normalizePersistedPersonaFields(record.data, registry)
      if (record.seq <= maxSeq) continue // 幂等：重复 seq 跳过
      maxSeq = record.seq
      state = applyTrunkRecord(state, record)
    }
    return new TrunkStorage(state, filePath, maxSeq + 1, registry)
  }

  /** 追加一条事件：seq 自增、同步落盘、折叠进内存态。返回 seq。 */
  append(type: string, data: unknown): number {
    const schema = NEW_EVENT_SCHEMAS[type]
    if (schema) {
      const parsed = schema.parse(data) as { messageId: string; taskId: string; eventPurpose: string; sourceRawRefs: string[]; item?: { sourceRawRefs: string[] } }
      if (parsed.sourceRawRefs.some((ref) => !this.stateInternal.userRaws.some((raw) => raw.rawRef === ref))) throw new Error('sourceRawRefs must reference existing user raws')
      if (parsed.item?.sourceRawRefs.some((ref) => !parsed.sourceRawRefs.includes(ref))) throw new Error('item sourceRawRefs must be included in event sourceRawRefs')
      const replacement = (parsed as { replacement?: { sourceRawRefs?: string[] } }).replacement
      if (replacement?.sourceRawRefs?.some((ref) => !parsed.sourceRawRefs.includes(ref))) throw new Error('replacement sourceRawRefs must be included in event sourceRawRefs')
      const key = commitKey(parsed)
      const hash = stableJson(parsed)
      const prior = this.stateInternal.dialogueCommits[key]
      if (prior) {
        if (prior.payloadHash !== hash) throw new Error(`dialogue commit conflict: ${key}`)
        return -1
      }
      data = parsed
    }
    const seq = this.nextSeqInternal
    const record: TrunkEventRecord = { type, seq, time: new Date().toISOString(), data }
    appendFileSync(this.filePath, `${JSON.stringify(record)}\n`, 'utf8')
    this.nextSeqInternal = seq + 1
    this.stateInternal = applyTrunkRecord(this.stateInternal, record)
    return seq
  }

  /** Validate a future dialogue event and detect durable key/hash conflicts without writing. */
  preflightDialogueEvent(type: string, data: unknown): void {
    const schema = NEW_EVENT_SCHEMAS[type]
    if (!schema) throw new Error(`unknown dialogue event type: ${type}`)
    const parsed = schema.parse(data) as { messageId: string; taskId: string; eventPurpose: string; sourceRawRefs: string[]; item?: { sourceRawRefs: string[] }; replacement?: { sourceRawRefs?: string[] } }
    if (parsed.sourceRawRefs.some((ref) => !this.stateInternal.userRaws.some((raw) => raw.rawRef === ref))) throw new Error('sourceRawRefs must reference existing user raws')
    if (parsed.item?.sourceRawRefs.some((ref) => !parsed.sourceRawRefs.includes(ref))) throw new Error('item sourceRawRefs must be included in event sourceRawRefs')
    if (parsed.replacement?.sourceRawRefs?.some((ref) => !parsed.sourceRawRefs.includes(ref))) throw new Error('replacement sourceRawRefs must be included in event sourceRawRefs')
    const key = commitKey(parsed); const hash = stableJson(parsed); const prior = this.stateInternal.dialogueCommits[key]
    if (prior && prior.payloadHash !== hash) throw new Error(`dialogue commit conflict: ${key}`)
  }

  /**
   * 追加用户原话（共享层，只增不改；ref/raw_ref 由 Trunk 分配）。
   *
   * messageId 是客户端在一次主动发送及其网络重试间复用的稳定身份；
   * 幂等只依据该身份，不能依据用户原话文本（用户可以主动发送相同文本）。
   * @returns 本次追加或已有消息的 ref。
   */
  addUserRaw(messageId: string, text: string, targetPersonaId: PersonaId): number {
    if (typeof messageId !== 'string' || messageId.trim().length === 0 || messageId !== messageId.trim()) {
      throw new Error('message_id must be a non-empty stable identifier')
    }
    if (typeof text !== 'string') throw new Error('user raw text must be a string')

    const existing = this.stateInternal.userRaws.find((raw) => raw.messageId === messageId)
    if (existing !== undefined) {
      if (existing.text !== text) {
        const error = Object.assign(new Error(`message_id conflict: ${messageId}`), { code: 'message_id_conflict' as const })
        throw error
      }
      if (existing.targetPersonaId === undefined) {
        const error = Object.assign(new Error(`legacy target missing: ${messageId}`), { code: 'legacy_target_missing' as const })
        throw error
      }
      if (existing.targetPersonaId !== targetPersonaId) {
        const error = Object.assign(new Error(`message target conflict: ${messageId}`), { code: 'message_id_conflict' as const })
        throw error
      }
      return existing.ref
    }

    const ref = this.stateInternal.userRaws.length
    // raw_ref 是产品层指针，由 Trunk 根据 conversation/ref 生成，调用方不可伪造。
    const rawRef = `raw-${this.stateInternal.conversationId}-${ref}`
    const target = this.registry.get(targetPersonaId).id
    this.append(TRUNK_USER_RAW_ADDED, { ref, text, message_id: messageId, raw_ref: rawRef, target_persona_id: target })
    return ref
  }

  commitBranchDelivery(data: { conversation_id: string; persona_id: PersonaId; raw_ref: string; message_id: string; session_id: string }): number {
    const canonical = { ...data, persona_id: this.registry.get(data.persona_id).id }
    if (this.isBranchDeliveryCommitted(canonical.persona_id, canonical.raw_ref)) return -1
    return this.append(TRUNK_BRANCH_DELIVERY_COMMITTED, canonical)
  }

  isBranchDeliveryCommitted(persona: PersonaId, rawRef: string): boolean {
    return this.stateInternal.deliveryCommitted.some((d) => d.persona_id === persona && d.raw_ref === rawRef)
  }

  /** 追加导演推断（candidate，未确认；F001：不自动升级 confirmed）。 */
  setDilemmaCandidate(text: string, persona: PersonaId): number {
    return this.append(TRUNK_DILEMMA_CANDIDATE, { persona: this.registry.get(persona).id, text })
  }

  /** 追加用户确认后的困惑（共享事实）。 */
  setDilemmaConfirmed(text: string): number {
    return this.append(TRUNK_DILEMMA_CONFIRMED, { text })
  }

  /** 追加用户纠正后的困惑（共享事实）。 */
  setDilemmaCorrected(text: string): number {
    return this.append(TRUNK_DILEMMA_CORRECTED, { text })
  }

  /** 切换当前人物（只改 active_persona + 调用方更新 branch 引用）。 */
  setActivePersona(persona: PersonaId): number {
    return this.append(TRUNK_ACTIVE_PERSONA_SET, { persona: this.registry.get(persona).id })
  }

  /** 登记人物 ↔ session_id 映射（首次进入建 Session 后调用；返回时复用不重建）。 */
  indexBranch(persona: PersonaId, sessionId: string): number {
    return this.append(TRUNK_BRANCH_INDEXED, { persona: this.registry.get(persona).id, sessionId })
  }

  proposeDilemmaItem(item: unknown, meta?: Record<string, unknown>): number {
    const parsed = dilemmaItemSchema.parse(item)
    this.registry.get(parsed.proposedByPersona)
    if (parsed.status !== 'candidate' || parsed.visibility !== 'origin-persona-only') throw new Error('proposal must be origin-only candidate')
    if (parsed.sourceRawRefs.some((r) => !this.stateInternal.userRaws.some((u) => u.rawRef === r))) throw new Error('sourceRawRefs must reference existing user raws')
    const existing = this.stateInternal.dilemmaItems.find((x) => x.id === parsed.id)
    if (existing) {
      // Item identity is a business key, not a best-effort duplicate hint:
      // replaying the same payload is idempotent, while reusing the ID for a
      // different payload must fail closed without reserving a new event.
      if (stableJson(existing) !== stableJson(parsed)) throw new Error(`dilemma item conflict: ${parsed.id}`)
      return -1
    }
    return this.append(TRUNK_DILEMMA_ITEM_PROPOSED, { ...meta, item: parsed, personaId: parsed.proposedByPersona })
  }
  reviewDilemmaItem(itemId: string, replacement: unknown, meta: Record<string, unknown>): number {
    const old = this.stateInternal.dilemmaItems.find((x) => x.id === itemId)
    if (!old) throw new Error(`unknown dilemma item: ${itemId}`)
    const action = String(meta.action ?? 'correct') as 'confirm'|'partial-confirm'|'correct'|'reject'|'skip'
    if (!['confirm','partial-confirm','correct','reject','skip'].includes(action)) throw new Error('invalid review action')
    const next = replacement === undefined ? undefined : dilemmaItemSchema.parse(replacement)
    const key = typeof meta.messageId === 'string' && typeof meta.taskId === 'string' && typeof meta.eventPurpose === 'string'
      ? `${meta.messageId}\u0000${meta.taskId}\u0000${meta.eventPurpose}` : undefined
    // Replaying the exact business operation remains idempotent even after the
    // candidate has transitioned; conflicting payloads are rejected by append.
    const reviewData = { ...meta, itemId, action, personaId: old.proposedByPersona, ...(next === undefined ? {} : { replacement: next }) }
    if (key && this.stateInternal.dialogueCommits[key]) return this.append(TRUNK_DILEMMA_ITEM_REVIEWED, reviewData)
    if (old.status !== 'candidate' || old.supersededBy) throw new Error('only active candidate may be reviewed')
    if ((action === 'reject' || action === 'skip') && next !== undefined) throw new Error(`${action} does not accept replacement`)
    if (action !== 'reject' && action !== 'skip' && next === undefined) throw new Error(`${action} requires replacement`)
    if (next && (next.revision !== old.revision + 1 || next.status !== 'confirmed' || next.visibility !== 'shared-confirmed' || next.proposedByPersona !== old.proposedByPersona || next.kind !== old.kind)) throw new Error('replacement must be next confirmed revision of same item')
    if (next && this.stateInternal.dilemmaItems.some((x) => x.id === next.id)) throw new Error(`replacement id conflict: ${next.id}`)
    if (next && next.supersedes !== itemId) throw new Error('replacement must supersede reviewed item')
    if (next && next.sourceRawRefs.some((r) => !this.stateInternal.userRaws.some((u) => u.rawRef === r))) throw new Error('sourceRawRefs must reference existing user raws')
    return this.append(TRUNK_DILEMMA_ITEM_REVIEWED, reviewData)
  }
  selectCoreDilemmaItem(itemId: string, meta: Record<string, unknown>): number {
    const item = this.stateInternal.dilemmaItems.find((x) => x.id === itemId)
    if (!item || item.kind !== 'core-conflict' || item.status !== 'confirmed' || item.supersededBy) throw new Error('core item must be active confirmed core-conflict')
    return this.append(TRUNK_DILEMMA_CORE_SELECTED, { ...meta, itemId })
  }
  updateBranchProgress(progress: unknown, meta: Record<string, unknown>): number {
    const parsed = branchProgressSchema.parse(progress); this.registry.get(parsed.personaId)
    return this.append(TRUNK_BRANCH_PROGRESS_UPDATED, { ...meta, progress: parsed })
  }
  setDialogueControl(control: unknown, meta: Record<string, unknown>): number {
    const parsed = dialogueControlStateSchema.parse(control)
    return this.append(TRUNK_DIALOGUE_PHASE_SET, { ...meta, control: { ...parsed, lastControlSeq: this.nextSeqInternal } })
  }
  recordTaskRouted(data: unknown): number { return this.append(TRUNK_TASK_ROUTED, data) }
  recordAction(data: unknown): number { return this.append(TRUNK_ACTION_RECORDED, data) }
  recordSessionControl(data: unknown): number { return this.append(TRUNK_SESSION_CONTROL_RECORDED, data) }

  recordTaskBudgetBlocked(outcome: TaskOutcome): number {
    const canonical = taskOutcomeSchema.parse({ ...outcome, personaId: this.registry.get(outcome.personaId).id })
    const previous = this.stateInternal.taskOutcomes[canonical.taskId]
    if (previous) { if (JSON.stringify(previous) !== JSON.stringify(canonical)) throw new Error(`task outcome conflict: ${canonical.taskId}`); return -1 }
    return this.append(TRUNK_TASK_OUTCOME_RECORDED, canonical)
  }

  /** 用户原话指针列表（只增，派生自 userRaws）。 */
  get userRawRefs(): number[] {
    return this.stateInternal.userRaws.map((u) => u.ref)
  }

  /**
   * flush：同步追加写已即时落盘，此处仅保留接口（进程退出/批处理收尾时调用，
   * 保证语义与阶段 3 sessions.flush 对齐）。
   */
  async flush(): Promise<void> {
    // 无缓冲，appendFileSync 已同步落盘；保留 await 语义便于调用方统一收尾。
  }

  /** Versioned product boundary: v2 never accepts legacy route/phase events. */
  appendProductEvent(type: typeof TRUNK_PRODUCT_LIFECYCLE | typeof TRUNK_PRODUCT_RESULT, data: unknown): number {
    if (type !== TRUNK_PRODUCT_LIFECYCLE && type !== TRUNK_PRODUCT_RESULT) throw new Error('v2 product event type required')
    const parsed = type === TRUNK_PRODUCT_LIFECYCLE
      ? zProductLifecycle.parse(data)
      : zProductResult.parse(data)
    return this.append(type, parsed)
  }
}

const zProductLifecycle = z.object({ version: z.literal(2), conversationId: z.string().min(1), lifecycle: z.enum(['active', 'paused', 'closed']), operationId: z.string().min(1) }).strict()
const zProductResult = z.object({ version: z.literal(2), operationId: z.string().min(1), status: z.enum(['reply', 'blocked']), rawRef: z.string().min(1) }).strict()

function normalizePersistedPersonaFields(value: unknown, registry: PersonaRegistry): unknown {
  if (!value || typeof value !== 'object') return value
  const data = { ...(value as Record<string, unknown>) }
  for (const key of ['persona', 'personaId', 'target_persona_id', 'targetPersonaId', 'persona_id', 'active_persona_id', 'activePersonaId']) {
    if (typeof data[key] === 'string') data[key] = registry.normalizePersistedId(data[key])
  }
  return data
}

function legacyRefs(state: TrunkState, data: Record<string, unknown>): string[] {
  const values = [data.raw_ref, data.rawRef, data.sourceRawRef, data.ref, data.raw_seq, data.rawSeq]
  const refs: string[] = []
  for (const value of values) {
    if (typeof value === 'string' && state.userRaws.some((u) => u.rawRef === value)) refs.push(value)
    if (typeof value === 'number') {
      const raw = state.userRaws.find((u) => u.ref === value)
      if (raw) refs.push(raw.rawRef)
    }
  }
  const onlyRaw = state.userRaws[0]
  if (refs.length === 0 && state.userRaws.length === 1 && onlyRaw) refs.push(onlyRaw.rawRef)
  return [...new Set(refs)]
}
