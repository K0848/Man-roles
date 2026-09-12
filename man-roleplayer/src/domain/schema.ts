/**
 * man-roles-roleplayer —— 最小数据契约（阶段 3）。
 *
 * 对应 task_plan.md「最小数据契约」表：
 *  - user_raw            → 用户原话，保存在 session 的 `user/message` 事件 content 中，
 *                          **只增不改**（事件日志 append-only，天然不可被摘要覆盖；
 *                          本包不提供任何写回 user/message 的路径）。
 *  - dilemma_candidate   → 导演推断的困惑（候选），只有用户确认事件后才升级为 confirmed。
 *  - dilemma_confirmed   → 用户确认后的困惑（由用户反馈语义触发，不固定措辞）。
 *  - dilemma_corrected   → 用户纠正后的困惑（同上）。
 *  - active_persona      → 当前人物（由 PersonaRegistry 提供 canonical PersonaId）。
 *  - turn_id/task_id/invocation_id → 轮次/任务/模型调用标识（见 src/turn/ids.ts）。
 *  - projection snapshot → 困惑状态面板快照 {asOfSeq, values}（见 src/projection/）。
 *
 * 运行时依赖 zod（插件 package.json 唯一 dependency）；@deepseek-ai/* 全部为
 * type-only import（构建时擦除），遵循阶段 2 结论：不声明 registry 缺失版本。
 */
import { z } from 'zod'
const taskModeSchema = z.enum(['knowledge', 'dilemma', 'review'])

/** 当前人物：只接受 Registry 规范化后的 canonical PersonaId。 */
// Domain accepts canonical IDs and replay-time legacy IDs; Registry owns canonical format validation.
export const personaIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'PersonaId must be kebab-case')
export type PersonaId = z.infer<typeof personaIdSchema>
export const dilemmaItemSchema = z.object({ id: z.string().min(1), kind: z.enum(['fact', 'inference', 'goal', 'value-conflict', 'core-conflict']), text: z.string(), status: z.enum(['candidate', 'confirmed', 'rejected', 'superseded']), sourceRawRefs: z.array(z.string().min(1)).min(1), proposedByPersona: personaIdSchema, visibility: z.enum(['origin-persona-only', 'shared-confirmed']), revision: z.number().int().positive(), supersedes: z.string().min(1).optional(), supersededBy: z.string().min(1).optional() }).strict()
export type DilemmaItem = z.infer<typeof dilemmaItemSchema>
export const dialogueControlStateSchema = z.object({ taskMode: z.enum(['knowledge', 'dilemma', 'review']), phase: z.enum(['responding', 'clarifying', 'awaiting-confirmation', 'reflecting', 'action-defined', 'paused', 'closed']), noProgressCount: z.number().int().nonnegative(), lastControlSeq: z.number().int(), selectedAction: z.string().optional() }).strict()
export type DialogueControlState = z.infer<typeof dialogueControlStateSchema>
export const branchProgressSchema = z.object({ personaId: personaIdSchema, summary: z.string().nullable(), lastSemanticSeq: z.number().int() }).strict()
export type BranchProgress = z.infer<typeof branchProgressSchema>

/** Closed envelope used by every new business event. */
export const dialogueEventMetaSchema = z.object({
  messageId: z.string().min(1), taskId: z.string().min(1), eventPurpose: z.string().min(1),
  sourceRawRefs: z.array(z.string().min(1)).min(1),
}).strict()
export type DialogueEventMeta = z.infer<typeof dialogueEventMetaSchema>
export const taskRoutedEventSchema = dialogueEventMetaSchema.extend({ taskMode: taskModeSchema, confidence: z.enum(['high', 'low']) }).strict()
export const dialoguePhaseSetEventSchema = dialogueEventMetaSchema.extend({ control: dialogueControlStateSchema }).strict()
export const dilemmaItemProposedEventSchema = dialogueEventMetaSchema.extend({ item: dilemmaItemSchema, personaId: personaIdSchema }).strict()
export const dilemmaItemReviewedEventSchema = dialogueEventMetaSchema.extend({ itemId: z.string().min(1), action: z.enum(['confirm', 'partial-confirm', 'correct', 'reject', 'skip']), replacement: dilemmaItemSchema.optional(), personaId: personaIdSchema }).strict()
export const dilemmaCoreSelectedEventSchema = dialogueEventMetaSchema.extend({ itemId: z.string().min(1) }).strict()
export const branchProgressUpdatedEventSchema = dialogueEventMetaSchema.extend({ progress: branchProgressSchema }).strict()
export const actionRecordedEventSchema = dialogueEventMetaSchema.extend({ action: z.string().min(1), details: z.record(z.string(), z.unknown()).default({}) }).strict()
export const sessionControlRecordedEventSchema = dialogueEventMetaSchema.extend({ control: z.enum(['pause', 'resume', 'end', 'switch']), personaId: personaIdSchema.optional() }).strict()
export const dialogueCommitSchema = z.object({ payloadHash: z.string().min(1) }).strict()
export type DialogueCommit = z.infer<typeof dialogueCommitSchema>
/** Persisted input is intentionally untrusted: normalize it through Registry before canonical parsing. */
export const legacyPersonaIdRawSchema = z.string().min(1)

/**
 * 困惑状态相位：
 *  - pending    ：尚无导演推断；
 *  - candidate  ：导演推断生成，**未确认**（F001：不得自动升级为 confirmed）；
 *  - confirmed  ：用户语义确认后的困惑；
 *  - corrected  ：用户语义纠正后的困惑。
 */
export const dilemmaPhaseSchema = z.enum(['pending', 'candidate', 'confirmed', 'corrected'])
export type DilemmaPhase = z.infer<typeof dilemmaPhaseSchema>

/**
 * 困惑状态（projection host 状态 + client 视图共用形状）。
 * 状态机规则（src/domain/dilemma.ts 强制）：
 *  - candidate 事件仅在 phase==='pending' 时生效；
 *  - confirmed/corrected 事件仅在 phase==='candidate' 时生效（用户确认/纠正前置）；
 *  - 一旦 confirmed/corrected，后续 candidate 不覆盖（已确认状态优先）。
 */
export const dilemmaStateSchema = z.object({
  phase: dilemmaPhaseSchema,
  activePersona: personaIdSchema.nullable(),
  /** 导演推断的困惑文本（未确认）。 */
  candidateText: z.string().nullable(),
  /** 用户确认后的困惑文本。 */
  confirmedText: z.string().nullable(),
  /** 用户纠正后的困惑文本。 */
  correctedText: z.string().nullable(),
  /** 已关联的 user/message 事件 seq 列表（只增，append-only）。 */
  userRawRefs: z.array(z.number()),
  /** 最近一次状态变更的 session 事件 seq（-1 = 尚无）。 */
  updatedBySeq: z.number(),
})
export type DilemmaState = z.infer<typeof dilemmaStateSchema>

/** 空日志初始状态。 */
export const initialDilemmaState = (persona: PersonaId): DilemmaState => ({
  phase: 'pending',
  activePersona: persona,
  candidateText: null,
  confirmedText: null,
  correctedText: null,
  userRawRefs: [],
  updatedBySeq: -1,
})

/** 领域事件通用头（turn/task/invocation 标识，幂等与失败路径用）。 */
export const dilemmaEventHeaderSchema = z.object({
  turnId: z.string(),
  taskId: z.string(),
  invocationId: z.string(),
})
export type DilemmaEventHeader = z.infer<typeof dilemmaEventHeaderSchema>

/** candidate 事件数据。 */
export const dilemmaCandidateEventSchema = dilemmaEventHeaderSchema.extend({
  persona: personaIdSchema,
  text: z.string(),
})
export type DilemmaCandidateEventData = z.infer<typeof dilemmaCandidateEventSchema>

/** confirmed 事件数据。 */
export const dilemmaConfirmedEventSchema = dilemmaEventHeaderSchema.extend({
  text: z.string(),
})
export type DilemmaConfirmedEventData = z.infer<typeof dilemmaConfirmedEventSchema>

/** corrected 事件数据。 */
export const dilemmaCorrectedEventSchema = dilemmaEventHeaderSchema.extend({
  text: z.string(),
})
export type DilemmaCorrectedEventData = z.infer<typeof dilemmaCorrectedEventSchema>

/**
 * 领域事件判别联合（状态机输入；seq 为事件在 session 中的序号，与
 * SessionEvent 顶层字段一致，便于从 session 事件直接映射）。
 */
export type DilemmaDomainEvent =
  | { type: 'man-roles/dilemma/candidate'; seq: number; data: DilemmaCandidateEventData }
  | { type: 'man-roles/dilemma/confirmed'; seq: number; data: DilemmaConfirmedEventData }
  | { type: 'man-roles/dilemma/corrected'; seq: number; data: DilemmaCorrectedEventData }

// ─────────────────────────────────────────────────────────────────────────────
// 阶段 4：TrunkStorage（方案 A 自持存储）数据契约
//
// 困惑主干（candidate/confirmed/corrected）、用户原话本体、branches 索引、
// active_persona 由插件自持 JSONL 持久化（方案 A，用户 2026-08-23 确认），
// DSH Projection 仅作进程内视图。JSONL 为追加写事件日志（事件源语义），
// 每条记录 { type, seq, time, data }；seq 单调递增，重复 seq 幂等跳过。
// dilemma 状态字段与 DilemmaState 同形状（状态机复用 src/domain/dilemma.ts，
// F001：candidate 不自动升级 confirmed）。
// ─────────────────────────────────────────────────────────────────────────────

/** trunk 事件记录（JSONL 一行一条）。 */
export const trunkEventRecordSchema = z.object({
  type: z.string(),
  seq: z.number(),
  time: z.string(),
  data: z.unknown(),
})
export type TrunkEventRecord = z.infer<typeof trunkEventRecordSchema>

/** trunk/created 数据：会话创建（conversation_id 是文件名的稳定标识）。 */
export const trunkCreatedEventSchema = z.object({
  conversationId: z.string(),
})
export type TrunkCreatedEventData = z.infer<typeof trunkCreatedEventSchema>

/** trunk/user-raw-added 数据：用户原话本体（共享层，只增不改；ref 为稳定指针）。 */
export const trunkUserRawAddedEventSchema = z.object({
  ref: z.number(),
  text: z.string(),
  // 6.2: 客户端身份与稳定投递指针。旧 JSONL 无此字段时由 replay 补齐。
  message_id: z.string().min(1).optional(),
  raw_ref: z.string().min(1).optional(),
  // 6.2 Task4: first acceptance fixes the delivery target. Legacy records omit it.
  target_persona_id: personaIdSchema.optional(),
})
export type TrunkUserRawAddedEventData = z.infer<typeof trunkUserRawAddedEventSchema>

/** trunk/dilemma-candidate 数据：导演推断（未确认，不自动升级——F001）。 */
export const trunkDilemmaCandidateEventSchema = z.object({
  persona: personaIdSchema,
  text: z.string(),
})
export type TrunkDilemmaCandidateEventData = z.infer<typeof trunkDilemmaCandidateEventSchema>

/** trunk/dilemma-confirmed 数据：用户确认后的困惑（共享，作为事实注入上下文）。 */
export const trunkDilemmaConfirmedEventSchema = z.object({
  text: z.string(),
})
export type TrunkDilemmaConfirmedEventData = z.infer<typeof trunkDilemmaConfirmedEventSchema>

/** trunk/dilemma-corrected 数据：用户纠正后的困惑（共享，作为事实注入上下文）。 */
export const trunkDilemmaCorrectedEventSchema = z.object({
  text: z.string(),
})
export type TrunkDilemmaCorrectedEventData = z.infer<typeof trunkDilemmaCorrectedEventSchema>

/** trunk/active-persona-set 数据：当前人物切换（切换只改此字段 + branch 引用）。 */
export const trunkActivePersonaEventSchema = z.object({
  persona: personaIdSchema,
})
export type TrunkActivePersonaEventData = z.infer<typeof trunkActivePersonaEventSchema>

/** trunk/branch-indexed 数据：人物 ↔ session_id 映射（首次进入建 Session，返回复用）。 */
export const trunkBranchIndexEventSchema = z.object({
  persona: personaIdSchema,
  sessionId: z.string(),
})
export type TrunkBranchIndexEventData = z.infer<typeof trunkBranchIndexEventSchema>

/** 用户原话本体条目（ref = 稳定指针，text = 逐字原文）。 */
export const trunkUserRawSchema = z.object({
  ref: z.number(),
  text: z.string(),
  messageId: z.string().min(1),
  rawRef: z.string().min(1),
  targetPersonaId: personaIdSchema.optional(),
})
export type TrunkUserRaw = z.infer<typeof trunkUserRawSchema>

export const taskOutcomeSchema = z.object({ taskId: z.string().min(1), personaId: personaIdSchema, branchSessionId: z.string().min(1), branchTurn: z.number().int().positive(), status: z.literal('blocked'), reason: z.literal('budget_exceeded'), retryable: z.literal(true) })
export type TaskOutcome = z.infer<typeof taskOutcomeSchema>
export const trunkTaskOutcomeRecordedEventSchema = taskOutcomeSchema

export const trunkBranchDeliveryCommittedEventSchema = z.object({
  conversation_id: z.string().min(1), persona_id: personaIdSchema,
  raw_ref: z.string().min(1), message_id: z.string().min(1), session_id: z.string().min(1),
})
export type TrunkBranchDeliveryCommittedEventData = z.infer<typeof trunkBranchDeliveryCommittedEventSchema>

/** TrunkStorage 内存态（恢复后即完整状态；dilemma 与 DilemmaState 同形状）。 */
export const trunkStateSchema = z.object({
  conversationId: z.string(),
  activePersona: personaIdSchema,
  userRaws: z.array(trunkUserRawSchema),
  dilemma: dilemmaStateSchema,
  branchesIndex: z.record(personaIdSchema, z.string()),
  taskOutcomes: z.record(z.string(), taskOutcomeSchema),
  deliveryCommitted: z.array(trunkBranchDeliveryCommittedEventSchema),
  dilemmaItems: z.array(dilemmaItemSchema).default([]),
  coreDilemmaItemId: z.string().nullable().default(null),
  dialogue: dialogueControlStateSchema.nullable().default(null),
  branchProgress: z.record(personaIdSchema, branchProgressSchema).default({}),
  dialogueCommits: z.record(z.string(), dialogueCommitSchema).default({}),
})
export type TrunkState = z.infer<typeof trunkStateSchema>

/** 空 trunk 初始状态（conversation_id 由调用方指定）。 */
export const initialTrunkState = (conversationId: string, initialPersonaId: PersonaId): TrunkState => ({
  conversationId,
  activePersona: initialPersonaId,
  userRaws: [],
  dilemma: initialDilemmaState(initialPersonaId),
  branchesIndex: {},
  taskOutcomes: {},
  deliveryCommitted: [],
  dilemmaItems: [], coreDilemmaItemId: null, dialogue: null, branchProgress: {}, dialogueCommits: {},
})
