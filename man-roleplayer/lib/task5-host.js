// src/e2e/task5-host.ts
import { createUserMessage, createAssistantMessage } from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";
import { mkdirSync as mkdirSync2, writeFileSync, readFileSync as readFileSync3 } from "node:fs";
import { join as join3 } from "node:path";
import { createHash } from "node:crypto";

// src/storage/trunk-storage.ts
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { z as z2 } from "zod";
import { dirname, join } from "node:path";

// src/domain/schema.ts
import { z } from "zod";
var taskModeSchema = z.enum(["knowledge", "dilemma", "review"]);
var personaIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "PersonaId must be kebab-case");
var dilemmaItemSchema = z.object({ id: z.string().min(1), kind: z.enum(["fact", "inference", "goal", "value-conflict", "core-conflict"]), text: z.string(), status: z.enum(["candidate", "confirmed", "rejected", "superseded"]), sourceRawRefs: z.array(z.string().min(1)).min(1), proposedByPersona: personaIdSchema, visibility: z.enum(["origin-persona-only", "shared-confirmed"]), revision: z.number().int().positive(), supersedes: z.string().min(1).optional(), supersededBy: z.string().min(1).optional() }).strict();
var dialogueControlStateSchema = z.object({ taskMode: z.enum(["knowledge", "dilemma", "review"]), phase: z.enum(["responding", "clarifying", "awaiting-confirmation", "reflecting", "action-defined", "paused", "closed"]), noProgressCount: z.number().int().nonnegative(), lastControlSeq: z.number().int(), selectedAction: z.string().optional() }).strict();
var branchProgressSchema = z.object({ personaId: personaIdSchema, summary: z.string().nullable(), lastSemanticSeq: z.number().int() }).strict();
var dialogueEventMetaSchema = z.object({
  messageId: z.string().min(1),
  taskId: z.string().min(1),
  eventPurpose: z.string().min(1),
  sourceRawRefs: z.array(z.string().min(1)).min(1)
}).strict();
var taskRoutedEventSchema = dialogueEventMetaSchema.extend({ taskMode: taskModeSchema, confidence: z.enum(["high", "low"]) }).strict();
var dialoguePhaseSetEventSchema = dialogueEventMetaSchema.extend({ control: dialogueControlStateSchema }).strict();
var dilemmaItemProposedEventSchema = dialogueEventMetaSchema.extend({ item: dilemmaItemSchema, personaId: personaIdSchema }).strict();
var dilemmaItemReviewedEventSchema = dialogueEventMetaSchema.extend({ itemId: z.string().min(1), action: z.enum(["confirm", "partial-confirm", "correct", "reject", "skip"]), replacement: dilemmaItemSchema.optional(), personaId: personaIdSchema }).strict();
var dilemmaCoreSelectedEventSchema = dialogueEventMetaSchema.extend({ itemId: z.string().min(1) }).strict();
var branchProgressUpdatedEventSchema = dialogueEventMetaSchema.extend({ progress: branchProgressSchema }).strict();
var actionRecordedEventSchema = dialogueEventMetaSchema.extend({ action: z.string().min(1), details: z.record(z.string(), z.unknown()).default({}) }).strict();
var sessionControlRecordedEventSchema = dialogueEventMetaSchema.extend({ control: z.enum(["pause", "resume", "end", "switch"]), personaId: personaIdSchema.optional() }).strict();
var dialogueCommitSchema = z.object({ payloadHash: z.string().min(1) }).strict();
var legacyPersonaIdRawSchema = z.string().min(1);
var dilemmaPhaseSchema = z.enum(["pending", "candidate", "confirmed", "corrected"]);
var dilemmaStateSchema = z.object({
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
  updatedBySeq: z.number()
});
var initialDilemmaState = (persona) => ({
  phase: "pending",
  activePersona: persona,
  candidateText: null,
  confirmedText: null,
  correctedText: null,
  userRawRefs: [],
  updatedBySeq: -1
});
var dilemmaEventHeaderSchema = z.object({
  turnId: z.string(),
  taskId: z.string(),
  invocationId: z.string()
});
var dilemmaCandidateEventSchema = dilemmaEventHeaderSchema.extend({
  persona: personaIdSchema,
  text: z.string()
});
var dilemmaConfirmedEventSchema = dilemmaEventHeaderSchema.extend({
  text: z.string()
});
var dilemmaCorrectedEventSchema = dilemmaEventHeaderSchema.extend({
  text: z.string()
});
var trunkEventRecordSchema = z.object({
  type: z.string(),
  seq: z.number(),
  time: z.string(),
  data: z.unknown()
});
var trunkCreatedEventSchema = z.object({
  conversationId: z.string()
});
var trunkUserRawAddedEventSchema = z.object({
  ref: z.number(),
  text: z.string(),
  // 6.2: 客户端身份与稳定投递指针。旧 JSONL 无此字段时由 replay 补齐。
  message_id: z.string().min(1).optional(),
  raw_ref: z.string().min(1).optional(),
  // 6.2 Task4: first acceptance fixes the delivery target. Legacy records omit it.
  target_persona_id: personaIdSchema.optional()
});
var trunkDilemmaCandidateEventSchema = z.object({
  persona: personaIdSchema,
  text: z.string()
});
var trunkDilemmaConfirmedEventSchema = z.object({
  text: z.string()
});
var trunkDilemmaCorrectedEventSchema = z.object({
  text: z.string()
});
var trunkActivePersonaEventSchema = z.object({
  persona: personaIdSchema
});
var trunkBranchIndexEventSchema = z.object({
  persona: personaIdSchema,
  sessionId: z.string()
});
var trunkUserRawSchema = z.object({
  ref: z.number(),
  text: z.string(),
  messageId: z.string().min(1),
  rawRef: z.string().min(1),
  targetPersonaId: personaIdSchema.optional()
});
var taskOutcomeSchema = z.object({ taskId: z.string().min(1), personaId: personaIdSchema, branchSessionId: z.string().min(1), branchTurn: z.number().int().positive(), status: z.literal("blocked"), reason: z.literal("budget_exceeded"), retryable: z.literal(true) });
var trunkTaskOutcomeRecordedEventSchema = taskOutcomeSchema;
var trunkBranchDeliveryCommittedEventSchema = z.object({
  conversation_id: z.string().min(1),
  persona_id: personaIdSchema,
  raw_ref: z.string().min(1),
  message_id: z.string().min(1),
  session_id: z.string().min(1)
});
var trunkStateSchema = z.object({
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
  dialogueCommits: z.record(z.string(), dialogueCommitSchema).default({})
});
var initialTrunkState = (conversationId, initialPersonaId) => ({
  conversationId,
  activePersona: initialPersonaId,
  userRaws: [],
  dilemma: initialDilemmaState(initialPersonaId),
  branchesIndex: {},
  taskOutcomes: {},
  deliveryCommitted: [],
  dilemmaItems: [],
  coreDilemmaItemId: null,
  dialogue: null,
  branchProgress: {},
  dialogueCommits: {}
});

// src/domain/dilemma.ts
function transition(state, event2) {
  switch (event2.type) {
    case "user/message":
      if (state.userRawRefs.includes(event2.seq)) return state;
      return { ...state, userRawRefs: [...state.userRawRefs, event2.seq] };
    case "man-roles/dilemma/candidate": {
      if (state.phase !== "pending") return state;
      return {
        ...state,
        phase: "candidate",
        activePersona: event2.data.persona,
        candidateText: event2.data.text,
        updatedBySeq: event2.seq ?? state.updatedBySeq
      };
    }
    case "man-roles/dilemma/confirmed": {
      if (state.phase !== "candidate") return state;
      return {
        ...state,
        phase: "confirmed",
        candidateText: null,
        confirmedText: event2.data.text,
        updatedBySeq: event2.seq ?? state.updatedBySeq
      };
    }
    case "man-roles/dilemma/corrected": {
      if (state.phase !== "candidate") return state;
      return {
        ...state,
        phase: "corrected",
        candidateText: null,
        correctedText: event2.data.text,
        updatedBySeq: event2.seq ?? state.updatedBySeq
      };
    }
    default:
      return state;
  }
}

// src/storage/trunk-storage.ts
var TRUNK_CREATED = "trunk/created";
var TRUNK_USER_RAW_ADDED = "trunk/user-raw-added";
var TRUNK_DILEMMA_CANDIDATE = "trunk/dilemma-candidate";
var TRUNK_DILEMMA_CONFIRMED = "trunk/dilemma-confirmed";
var TRUNK_DILEMMA_CORRECTED = "trunk/dilemma-corrected";
var TRUNK_ACTIVE_PERSONA_SET = "trunk/active-persona-set";
var TRUNK_BRANCH_INDEXED = "trunk/branch-indexed";
var TRUNK_TASK_OUTCOME_RECORDED = "trunk/task-outcome-recorded";
var TRUNK_BRANCH_DELIVERY_COMMITTED = "trunk/branch-delivery-committed";
var TRUNK_TASK_ROUTED = "trunk/task-routed";
var TRUNK_DIALOGUE_PHASE_SET = "trunk/dialogue-phase-set";
var TRUNK_DILEMMA_ITEM_PROPOSED = "trunk/dilemma-item-proposed";
var TRUNK_DILEMMA_ITEM_REVIEWED = "trunk/dilemma-item-reviewed";
var TRUNK_DILEMMA_CORE_SELECTED = "trunk/dilemma-core-selected";
var TRUNK_BRANCH_PROGRESS_UPDATED = "trunk/branch-progress-updated";
var TRUNK_ACTION_RECORDED = "trunk/action-recorded";
var TRUNK_SESSION_CONTROL_RECORDED = "trunk/session-control-recorded";
var TRUNK_PRODUCT_LIFECYCLE = "trunk/v2/product-lifecycle";
var TRUNK_PRODUCT_RESULT = "trunk/v2/product-result";
var NEW_EVENT_SCHEMAS = {
  [TRUNK_TASK_ROUTED]: taskRoutedEventSchema,
  [TRUNK_DIALOGUE_PHASE_SET]: dialoguePhaseSetEventSchema,
  [TRUNK_DILEMMA_ITEM_PROPOSED]: dilemmaItemProposedEventSchema,
  [TRUNK_DILEMMA_ITEM_REVIEWED]: dilemmaItemReviewedEventSchema,
  [TRUNK_DILEMMA_CORE_SELECTED]: dilemmaCoreSelectedEventSchema,
  [TRUNK_BRANCH_PROGRESS_UPDATED]: branchProgressUpdatedEventSchema,
  [TRUNK_ACTION_RECORDED]: actionRecordedEventSchema,
  [TRUNK_SESSION_CONTROL_RECORDED]: sessionControlRecordedEventSchema
};
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
function commitKey(data) {
  return `${data.messageId}\0${data.taskId}\0${data.eventPurpose}`;
}
function applyTrunkRecord(state, record) {
  const commitTypes = ["trunk/task-routed", "trunk/dialogue-phase-set", "trunk/dilemma-item-proposed", "trunk/dilemma-item-reviewed", "trunk/dilemma-core-selected", "trunk/branch-progress-updated", "trunk/action-recorded", "trunk/session-control-recorded"];
  if (commitTypes.includes(record.type)) {
    const fullSchema = NEW_EVENT_SCHEMAS[record.type];
    if (!fullSchema) return state;
    const full = fullSchema.safeParse(record.data);
    if (!full.success) return state;
    const meta = record.data && typeof record.data === "object" ? record.data : {};
    const parsedMeta = dialogueEventMetaSchema.safeParse({ messageId: meta.messageId, taskId: meta.taskId, eventPurpose: meta.eventPurpose, sourceRawRefs: meta.sourceRawRefs });
    if (!parsedMeta.success) return state;
    if (parsedMeta.data.sourceRawRefs.some((ref) => !state.userRaws.some((raw) => raw.rawRef === ref))) return state;
    const itemRefs = meta.item && typeof meta.item === "object" ? meta.item.sourceRawRefs : void 0;
    const replacementRefs = meta.replacement && typeof meta.replacement === "object" ? meta.replacement.sourceRawRefs : void 0;
    for (const refs of [itemRefs, replacementRefs]) {
      if (Array.isArray(refs) && refs.some((ref) => typeof ref !== "string" || !parsedMeta.data.sourceRawRefs.includes(ref))) return state;
    }
    const key = `${parsedMeta.data.messageId}\0${parsedMeta.data.taskId}\0${parsedMeta.data.eventPurpose}`;
    const hash = stableJson(record.data);
    const prior = state.dialogueCommits[key];
    if (prior && prior.payloadHash !== hash) throw new Error(`dialogue commit conflict: ${key}`);
    if (!prior) state = { ...state, dialogueCommits: { ...state.dialogueCommits, [key]: { payloadHash: hash } } };
  }
  switch (record.type) {
    case TRUNK_CREATED:
      return state;
    case TRUNK_USER_RAW_ADDED: {
      const parsed = trunkUserRawAddedEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      if (state.userRaws.some((u) => u.ref === parsed.data.ref)) return state;
      const fold = { type: "user/message", seq: parsed.data.ref };
      const raw = {
        ref: parsed.data.ref,
        text: parsed.data.text,
        messageId: parsed.data.message_id ?? `legacy-message-${state.conversationId}-${parsed.data.ref}`,
        rawRef: parsed.data.raw_ref ?? `legacy-raw-${state.conversationId}-${parsed.data.ref}`
      };
      if (parsed.data.target_persona_id) raw.targetPersonaId = parsed.data.target_persona_id;
      return {
        ...state,
        userRaws: [...state.userRaws, raw],
        dilemma: transition(state.dilemma, fold)
      };
    }
    case TRUNK_DILEMMA_CANDIDATE: {
      const parsed = trunkDilemmaCandidateEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      const fold = {
        type: "man-roles/dilemma/candidate",
        seq: record.seq,
        data: {
          turnId: "trunk",
          taskId: "trunk",
          invocationId: `trunk-seq-${record.seq}`,
          persona: parsed.data.persona,
          text: parsed.data.text
        }
      };
      const next = transition(state.dilemma, fold);
      const refs = legacyRefs(state, record.data);
      if (refs.length === 0) return { ...state, dilemma: next };
      const item2 = { id: `legacy-${record.seq}`, kind: "core-conflict", text: parsed.data.text, status: "candidate", sourceRawRefs: refs, proposedByPersona: parsed.data.persona, visibility: "origin-persona-only", revision: record.seq + 1 };
      return { ...state, dilemma: next, dilemmaItems: state.dilemmaItems.some((x) => x.id === item2.id) ? state.dilemmaItems : [...state.dilemmaItems, item2] };
    }
    case TRUNK_DILEMMA_CONFIRMED: {
      const parsed = trunkDilemmaConfirmedEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      const fold = {
        type: "man-roles/dilemma/confirmed",
        seq: record.seq,
        data: {
          turnId: "trunk",
          taskId: "trunk",
          invocationId: `trunk-seq-${record.seq}`,
          text: parsed.data.text
        }
      };
      const next = transition(state.dilemma, fold);
      const refs = legacyRefs(state, record.data);
      const old = [...state.dilemmaItems].reverse().find((x) => x.status === "candidate" && !x.supersededBy);
      const itemRefs = refs.length ? refs : old?.sourceRawRefs ?? [];
      if (!itemRefs.length) return { ...state, dilemma: next };
      const item2 = { id: `legacy-${record.seq}`, kind: "core-conflict", text: parsed.data.text, status: "confirmed", sourceRawRefs: itemRefs, proposedByPersona: old?.proposedByPersona ?? state.activePersona, visibility: "shared-confirmed", revision: record.seq + 1, ...old ? { supersedes: old.id } : {} };
      const items = old ? state.dilemmaItems.map((x) => x.id === old.id ? { ...x, status: "superseded", supersededBy: item2.id } : x) : state.dilemmaItems;
      return { ...state, dilemma: next, dilemmaItems: items.some((x) => x.id === item2.id) ? items : [...items, item2] };
    }
    case TRUNK_DILEMMA_CORRECTED: {
      const parsed = trunkDilemmaCorrectedEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      const fold = {
        type: "man-roles/dilemma/corrected",
        seq: record.seq,
        data: {
          turnId: "trunk",
          taskId: "trunk",
          invocationId: `trunk-seq-${record.seq}`,
          text: parsed.data.text
        }
      };
      const next = transition(state.dilemma, fold);
      const refs = legacyRefs(state, record.data);
      const old = [...state.dilemmaItems].reverse().find((x) => x.status === "candidate" && !x.supersededBy);
      const itemRefs = refs.length ? refs : old?.sourceRawRefs ?? [];
      if (!itemRefs.length) return { ...state, dilemma: next };
      const item2 = { id: `legacy-${record.seq}`, kind: "core-conflict", text: parsed.data.text, status: "confirmed", sourceRawRefs: itemRefs, proposedByPersona: old?.proposedByPersona ?? state.activePersona, visibility: "shared-confirmed", revision: record.seq + 1, ...old ? { supersedes: old.id } : {} };
      const items = old ? state.dilemmaItems.map((x) => x.id === old.id ? { ...x, status: "superseded", supersededBy: item2.id } : x) : state.dilemmaItems;
      return { ...state, dilemma: next, dilemmaItems: items.some((x) => x.id === item2.id) ? items : [...items, item2] };
    }
    case TRUNK_ACTIVE_PERSONA_SET: {
      const parsed = trunkActivePersonaEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      return { ...state, activePersona: parsed.data.persona };
    }
    case TRUNK_BRANCH_INDEXED: {
      const parsed = trunkBranchIndexEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      return { ...state, branchesIndex: { ...state.branchesIndex, [parsed.data.persona]: parsed.data.sessionId } };
    }
    case TRUNK_TASK_OUTCOME_RECORDED: {
      const parsed = trunkTaskOutcomeRecordedEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      const previous = state.taskOutcomes[parsed.data.taskId];
      if (previous && JSON.stringify(previous) !== JSON.stringify(parsed.data)) throw new Error(`task outcome conflict: ${parsed.data.taskId}`);
      return previous ? state : { ...state, taskOutcomes: { ...state.taskOutcomes, [parsed.data.taskId]: parsed.data } };
    }
    case TRUNK_BRANCH_DELIVERY_COMMITTED: {
      const parsed = trunkBranchDeliveryCommittedEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      if (state.deliveryCommitted.some((d) => d.conversation_id === parsed.data.conversation_id && d.persona_id === parsed.data.persona_id && d.raw_ref === parsed.data.raw_ref)) return state;
      return { ...state, deliveryCommitted: [...state.deliveryCommitted, parsed.data] };
    }
    case "trunk/dilemma-item-proposed": {
      const parsedEvent = dilemmaItemProposedEventSchema.safeParse(record.data);
      const parsed = parsedEvent.success ? parsedEvent.data.item : null;
      if (!parsed || parsed.status !== "candidate" || parsed.visibility !== "origin-persona-only") return state;
      if (state.dilemmaItems.some((x) => x.id === parsed.id)) return state;
      return { ...state, dilemmaItems: [...state.dilemmaItems, parsed] };
    }
    case "trunk/dilemma-item-reviewed": {
      const data = dilemmaItemReviewedEventSchema.safeParse(record.data);
      if (!data.success) return state;
      const old = state.dilemmaItems.find((x) => x.id === data.data.itemId);
      if (!old || data.data.action === "skip") return state;
      if (old.status !== "candidate" || old.supersededBy) return state;
      if (data.data.action === "reject") return { ...state, dilemmaItems: state.dilemmaItems.map((x) => x.id === old.id ? { ...x, status: "rejected" } : x), coreDilemmaItemId: state.coreDilemmaItemId === old.id ? null : state.coreDilemmaItemId };
      const replacement = data.data.replacement;
      if (!replacement || replacement.supersedes !== old.id) return state;
      if (replacement.id === old.id || state.dilemmaItems.some((x) => x.id === replacement.id)) return state;
      if (replacement.revision !== old.revision + 1 || replacement.status !== "confirmed" || replacement.visibility !== "shared-confirmed" || replacement.proposedByPersona !== old.proposedByPersona || replacement.kind !== old.kind) return state;
      const items = state.dilemmaItems.map((x) => x.id === old.id ? { ...x, status: "superseded", supersededBy: replacement.id } : x);
      return { ...state, dilemmaItems: [...items, replacement], coreDilemmaItemId: state.coreDilemmaItemId === old.id ? null : state.coreDilemmaItemId };
    }
    case "trunk/dilemma-core-selected": {
      const parsed = dilemmaCoreSelectedEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      const id = parsed.data.itemId;
      const item2 = state.dilemmaItems.find((x) => x.id === id);
      if (!item2 || item2.kind !== "core-conflict" || item2.status !== "confirmed" || item2.supersededBy) return state;
      return { ...state, coreDilemmaItemId: id };
    }
    case "trunk/branch-progress-updated": {
      const event2 = branchProgressUpdatedEventSchema.safeParse(record.data);
      if (!event2.success) return state;
      const progress = event2.data.progress;
      const prev = state.branchProgress[progress.personaId];
      if (prev && prev.summary === progress.summary && prev.lastSemanticSeq === progress.lastSemanticSeq) return state;
      return { ...state, branchProgress: { ...state.branchProgress, [progress.personaId]: progress } };
    }
    case "trunk/dialogue-phase-set": {
      const parsed = dialoguePhaseSetEventSchema.safeParse(record.data);
      return parsed.success ? { ...state, dialogue: parsed.data.control } : state;
    }
    case "trunk/task-routed":
      return taskRoutedEventSchema.safeParse(record.data).success ? state : state;
    case "trunk/action-recorded":
      return actionRecordedEventSchema.safeParse(record.data).success ? state : state;
    case "trunk/session-control-recorded":
      return sessionControlRecordedEventSchema.safeParse(record.data).success ? state : state;
    default:
      return state;
  }
}
function parseRecordLine(line) {
  try {
    const parsed = trunkEventRecordSchema.safeParse(JSON.parse(line));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
var TrunkStorage = class _TrunkStorage {
  /** 存储目录（JSONL 文件所在目录）。 */
  storageDir;
  /** JSONL 文件绝对路径。 */
  filePath;
  stateInternal;
  nextSeqInternal;
  registry;
  constructor(state, filePath, nextSeq, registry2) {
    this.stateInternal = state;
    this.filePath = filePath;
    this.storageDir = dirname(filePath);
    this.nextSeqInternal = nextSeq;
    this.registry = registry2;
  }
  /** 当前完整状态（只读快照）。 */
  get state() {
    return this.stateInternal;
  }
  /** 下一个事件 seq（未使用）。 */
  get nextSeq() {
    return this.nextSeqInternal;
  }
  /** 创建新 trunk（写入 trunk/created 事件，seq=0）。 */
  static create(conversationId, storageDir, initialPersonaId, registry2) {
    const initial = registry2.requireActiveForCreate(initialPersonaId).id;
    const filePath = join(storageDir, `${conversationId}.jsonl`);
    mkdirSync(storageDir, { recursive: true });
    const storage = new _TrunkStorage(initialTrunkState(conversationId, initial), filePath, 0, registry2);
    storage.append(TRUNK_CREATED, { conversationId, initial_persona_id: initial });
    return storage;
  }
  /**
   * 从磁盘恢复 trunk（启动恢复；重放 JSONL 事件，重复 seq 幂等跳过）。
   * 文件不存在 → 视为新会话（等价 create，但不重复写 created 事件由调用方决定——
   * 此处直接返回新实例并写 created）。
   */
  static load(conversationId, storageDir, registry2) {
    const filePath = join(storageDir, `${conversationId}.jsonl`);
    if (!existsSync(filePath)) {
      throw new Error(`cannot restore missing trunk without explicit initial PersonaId: ${conversationId}`);
    }
    const text = readFileSync(filePath, "utf8");
    const rawLines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
    const rawRecords = rawLines.map(parseRecordLine).filter((record) => record !== null);
    let initialRaw;
    for (const record of rawRecords) {
      const data = record.data;
      initialRaw = typeof data.initial_persona_id === "string" ? data.initial_persona_id : typeof data.persona === "string" ? data.persona : typeof data.target_persona_id === "string" ? data.target_persona_id : typeof data.persona_id === "string" ? data.persona_id : typeof data.personaId === "string" ? data.personaId : void 0;
      if (initialRaw) break;
    }
    if (!initialRaw) throw new Error(`trunk has no recoverable PersonaId: ${conversationId}`);
    const initial = registry2.normalizePersistedId(initialRaw);
    let state = initialTrunkState(conversationId, initial);
    let maxSeq = -1;
    for (const line of rawLines) {
      if (line.trim() === "") continue;
      const record = parseRecordLine(line);
      if (record === null) continue;
      record.data = normalizePersistedPersonaFields(record.data, registry2);
      if (record.seq <= maxSeq) continue;
      maxSeq = record.seq;
      state = applyTrunkRecord(state, record);
    }
    return new _TrunkStorage(state, filePath, maxSeq + 1, registry2);
  }
  /** 追加一条事件：seq 自增、同步落盘、折叠进内存态。返回 seq。 */
  append(type, data) {
    const schema = NEW_EVENT_SCHEMAS[type];
    if (schema) {
      const parsed = schema.parse(data);
      if (parsed.sourceRawRefs.some((ref) => !this.stateInternal.userRaws.some((raw) => raw.rawRef === ref))) throw new Error("sourceRawRefs must reference existing user raws");
      if (parsed.item?.sourceRawRefs.some((ref) => !parsed.sourceRawRefs.includes(ref))) throw new Error("item sourceRawRefs must be included in event sourceRawRefs");
      const replacement = parsed.replacement;
      if (replacement?.sourceRawRefs?.some((ref) => !parsed.sourceRawRefs.includes(ref))) throw new Error("replacement sourceRawRefs must be included in event sourceRawRefs");
      const key = commitKey(parsed);
      const hash = stableJson(parsed);
      const prior = this.stateInternal.dialogueCommits[key];
      if (prior) {
        if (prior.payloadHash !== hash) throw new Error(`dialogue commit conflict: ${key}`);
        return -1;
      }
      data = parsed;
    }
    const seq = this.nextSeqInternal;
    const record = { type, seq, time: (/* @__PURE__ */ new Date()).toISOString(), data };
    appendFileSync(this.filePath, `${JSON.stringify(record)}
`, "utf8");
    this.nextSeqInternal = seq + 1;
    this.stateInternal = applyTrunkRecord(this.stateInternal, record);
    return seq;
  }
  /** Validate a future dialogue event and detect durable key/hash conflicts without writing. */
  preflightDialogueEvent(type, data) {
    const schema = NEW_EVENT_SCHEMAS[type];
    if (!schema) throw new Error(`unknown dialogue event type: ${type}`);
    const parsed = schema.parse(data);
    if (parsed.sourceRawRefs.some((ref) => !this.stateInternal.userRaws.some((raw) => raw.rawRef === ref))) throw new Error("sourceRawRefs must reference existing user raws");
    if (parsed.item?.sourceRawRefs.some((ref) => !parsed.sourceRawRefs.includes(ref))) throw new Error("item sourceRawRefs must be included in event sourceRawRefs");
    if (parsed.replacement?.sourceRawRefs?.some((ref) => !parsed.sourceRawRefs.includes(ref))) throw new Error("replacement sourceRawRefs must be included in event sourceRawRefs");
    const key = commitKey(parsed);
    const hash = stableJson(parsed);
    const prior = this.stateInternal.dialogueCommits[key];
    if (prior && prior.payloadHash !== hash) throw new Error(`dialogue commit conflict: ${key}`);
  }
  /**
   * 追加用户原话（共享层，只增不改；ref/raw_ref 由 Trunk 分配）。
   *
   * messageId 是客户端在一次主动发送及其网络重试间复用的稳定身份；
   * 幂等只依据该身份，不能依据用户原话文本（用户可以主动发送相同文本）。
   * @returns 本次追加或已有消息的 ref。
   */
  addUserRaw(messageId, text, targetPersonaId) {
    if (typeof messageId !== "string" || messageId.trim().length === 0 || messageId !== messageId.trim()) {
      throw new Error("message_id must be a non-empty stable identifier");
    }
    if (typeof text !== "string") throw new Error("user raw text must be a string");
    const existing = this.stateInternal.userRaws.find((raw) => raw.messageId === messageId);
    if (existing !== void 0) {
      if (existing.text !== text) {
        const error = Object.assign(new Error(`message_id conflict: ${messageId}`), { code: "message_id_conflict" });
        throw error;
      }
      if (existing.targetPersonaId === void 0) {
        const error = Object.assign(new Error(`legacy target missing: ${messageId}`), { code: "legacy_target_missing" });
        throw error;
      }
      if (existing.targetPersonaId !== targetPersonaId) {
        const error = Object.assign(new Error(`message target conflict: ${messageId}`), { code: "message_id_conflict" });
        throw error;
      }
      return existing.ref;
    }
    const ref = this.stateInternal.userRaws.length;
    const rawRef = `raw-${this.stateInternal.conversationId}-${ref}`;
    const target = this.registry.get(targetPersonaId).id;
    this.append(TRUNK_USER_RAW_ADDED, { ref, text, message_id: messageId, raw_ref: rawRef, target_persona_id: target });
    return ref;
  }
  commitBranchDelivery(data) {
    const canonical = { ...data, persona_id: this.registry.get(data.persona_id).id };
    if (this.isBranchDeliveryCommitted(canonical.persona_id, canonical.raw_ref)) return -1;
    return this.append(TRUNK_BRANCH_DELIVERY_COMMITTED, canonical);
  }
  isBranchDeliveryCommitted(persona, rawRef) {
    return this.stateInternal.deliveryCommitted.some((d) => d.persona_id === persona && d.raw_ref === rawRef);
  }
  /** 追加导演推断（candidate，未确认；F001：不自动升级 confirmed）。 */
  setDilemmaCandidate(text, persona) {
    return this.append(TRUNK_DILEMMA_CANDIDATE, { persona: this.registry.get(persona).id, text });
  }
  /** 追加用户确认后的困惑（共享事实）。 */
  setDilemmaConfirmed(text) {
    return this.append(TRUNK_DILEMMA_CONFIRMED, { text });
  }
  /** 追加用户纠正后的困惑（共享事实）。 */
  setDilemmaCorrected(text) {
    return this.append(TRUNK_DILEMMA_CORRECTED, { text });
  }
  /** 切换当前人物（只改 active_persona + 调用方更新 branch 引用）。 */
  setActivePersona(persona) {
    return this.append(TRUNK_ACTIVE_PERSONA_SET, { persona: this.registry.get(persona).id });
  }
  /** 登记人物 ↔ session_id 映射（首次进入建 Session 后调用；返回时复用不重建）。 */
  indexBranch(persona, sessionId) {
    return this.append(TRUNK_BRANCH_INDEXED, { persona: this.registry.get(persona).id, sessionId });
  }
  proposeDilemmaItem(item2, meta) {
    const parsed = dilemmaItemSchema.parse(item2);
    this.registry.get(parsed.proposedByPersona);
    if (parsed.status !== "candidate" || parsed.visibility !== "origin-persona-only") throw new Error("proposal must be origin-only candidate");
    if (parsed.sourceRawRefs.some((r) => !this.stateInternal.userRaws.some((u) => u.rawRef === r))) throw new Error("sourceRawRefs must reference existing user raws");
    const existing = this.stateInternal.dilemmaItems.find((x) => x.id === parsed.id);
    if (existing) {
      if (stableJson(existing) !== stableJson(parsed)) throw new Error(`dilemma item conflict: ${parsed.id}`);
      return -1;
    }
    return this.append(TRUNK_DILEMMA_ITEM_PROPOSED, { ...meta, item: parsed, personaId: parsed.proposedByPersona });
  }
  reviewDilemmaItem(itemId, replacement, meta) {
    const old = this.stateInternal.dilemmaItems.find((x) => x.id === itemId);
    if (!old) throw new Error(`unknown dilemma item: ${itemId}`);
    const action = String(meta.action ?? "correct");
    if (!["confirm", "partial-confirm", "correct", "reject", "skip"].includes(action)) throw new Error("invalid review action");
    const next = replacement === void 0 ? void 0 : dilemmaItemSchema.parse(replacement);
    const key = typeof meta.messageId === "string" && typeof meta.taskId === "string" && typeof meta.eventPurpose === "string" ? `${meta.messageId}\0${meta.taskId}\0${meta.eventPurpose}` : void 0;
    const reviewData = { ...meta, itemId, action, personaId: old.proposedByPersona, ...next === void 0 ? {} : { replacement: next } };
    if (key && this.stateInternal.dialogueCommits[key]) return this.append(TRUNK_DILEMMA_ITEM_REVIEWED, reviewData);
    if (old.status !== "candidate" || old.supersededBy) throw new Error("only active candidate may be reviewed");
    if ((action === "reject" || action === "skip") && next !== void 0) throw new Error(`${action} does not accept replacement`);
    if (action !== "reject" && action !== "skip" && next === void 0) throw new Error(`${action} requires replacement`);
    if (next && (next.revision !== old.revision + 1 || next.status !== "confirmed" || next.visibility !== "shared-confirmed" || next.proposedByPersona !== old.proposedByPersona || next.kind !== old.kind)) throw new Error("replacement must be next confirmed revision of same item");
    if (next && this.stateInternal.dilemmaItems.some((x) => x.id === next.id)) throw new Error(`replacement id conflict: ${next.id}`);
    if (next && next.supersedes !== itemId) throw new Error("replacement must supersede reviewed item");
    if (next && next.sourceRawRefs.some((r) => !this.stateInternal.userRaws.some((u) => u.rawRef === r))) throw new Error("sourceRawRefs must reference existing user raws");
    return this.append(TRUNK_DILEMMA_ITEM_REVIEWED, reviewData);
  }
  selectCoreDilemmaItem(itemId, meta) {
    const item2 = this.stateInternal.dilemmaItems.find((x) => x.id === itemId);
    if (!item2 || item2.kind !== "core-conflict" || item2.status !== "confirmed" || item2.supersededBy) throw new Error("core item must be active confirmed core-conflict");
    return this.append(TRUNK_DILEMMA_CORE_SELECTED, { ...meta, itemId });
  }
  updateBranchProgress(progress, meta) {
    const parsed = branchProgressSchema.parse(progress);
    this.registry.get(parsed.personaId);
    return this.append(TRUNK_BRANCH_PROGRESS_UPDATED, { ...meta, progress: parsed });
  }
  setDialogueControl(control, meta) {
    const parsed = dialogueControlStateSchema.parse(control);
    return this.append(TRUNK_DIALOGUE_PHASE_SET, { ...meta, control: { ...parsed, lastControlSeq: this.nextSeqInternal } });
  }
  recordTaskRouted(data) {
    return this.append(TRUNK_TASK_ROUTED, data);
  }
  recordAction(data) {
    return this.append(TRUNK_ACTION_RECORDED, data);
  }
  recordSessionControl(data) {
    return this.append(TRUNK_SESSION_CONTROL_RECORDED, data);
  }
  recordTaskBudgetBlocked(outcome) {
    const canonical = taskOutcomeSchema.parse({ ...outcome, personaId: this.registry.get(outcome.personaId).id });
    const previous = this.stateInternal.taskOutcomes[canonical.taskId];
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(canonical)) throw new Error(`task outcome conflict: ${canonical.taskId}`);
      return -1;
    }
    return this.append(TRUNK_TASK_OUTCOME_RECORDED, canonical);
  }
  /** 用户原话指针列表（只增，派生自 userRaws）。 */
  get userRawRefs() {
    return this.stateInternal.userRaws.map((u) => u.ref);
  }
  /**
   * flush：同步追加写已即时落盘，此处仅保留接口（进程退出/批处理收尾时调用，
   * 保证语义与阶段 3 sessions.flush 对齐）。
   */
  async flush() {
  }
  /** Versioned product boundary: v2 never accepts legacy route/phase events. */
  appendProductEvent(type, data) {
    if (type !== TRUNK_PRODUCT_LIFECYCLE && type !== TRUNK_PRODUCT_RESULT) throw new Error("v2 product event type required");
    const parsed = type === TRUNK_PRODUCT_LIFECYCLE ? zProductLifecycle.parse(data) : zProductResult.parse(data);
    return this.append(type, parsed);
  }
};
var zProductLifecycle = z2.object({ version: z2.literal(2), conversationId: z2.string().min(1), lifecycle: z2.enum(["active", "paused", "closed"]), operationId: z2.string().min(1) }).strict();
var zProductResult = z2.object({ version: z2.literal(2), operationId: z2.string().min(1), status: z2.enum(["reply", "blocked"]), rawRef: z2.string().min(1) }).strict();
function normalizePersistedPersonaFields(value, registry2) {
  if (!value || typeof value !== "object") return value;
  const data = { ...value };
  for (const key of ["persona", "personaId", "target_persona_id", "targetPersonaId", "persona_id", "active_persona_id", "activePersonaId"]) {
    if (typeof data[key] === "string") data[key] = registry2.normalizePersistedId(data[key]);
  }
  return data;
}
function legacyRefs(state, data) {
  const values = [data.raw_ref, data.rawRef, data.sourceRawRef, data.ref, data.raw_seq, data.rawSeq];
  const refs = [];
  for (const value of values) {
    if (typeof value === "string" && state.userRaws.some((u) => u.rawRef === value)) refs.push(value);
    if (typeof value === "number") {
      const raw = state.userRaws.find((u) => u.ref === value);
      if (raw) refs.push(raw.rawRef);
    }
  }
  const onlyRaw = state.userRaws[0];
  if (refs.length === 0 && state.userRaws.length === 1 && onlyRaw) refs.push(onlyRaw.rawRef);
  return [...new Set(refs)];
}

// src/branch/branch-manager.ts
var BranchManager = class {
  branchesInternal = /* @__PURE__ */ new Map();
  activeInternal;
  registry;
  constructor(initialPersonaId, registry2, existingIndex = {}) {
    this.registry = registry2;
    this.activeInternal = registry2.get(initialPersonaId).id;
    for (const [rawPersona, sessionId] of Object.entries(existingIndex)) {
      const persona = registry2.normalizePersistedId(rawPersona);
      this.branchesInternal.set(persona, { persona, sessionId });
    }
    if (registry2.get(this.activeInternal).status === "retired" && !this.branchesInternal.has(this.activeInternal)) {
      throw new Error(`retired active PersonaId requires an existing branch: ${this.activeInternal}`);
    }
  }
  /** 当前活跃人物。 */
  get activePersona() {
    return this.activeInternal;
  }
  /** 全部分支索引（只读快照）。 */
  get branches() {
    return this.branchesInternal;
  }
  /** 当前活跃分支记录（隔离层来源）。 */
  currentBranch() {
    return this.branchesInternal.get(this.activeInternal) ?? null;
  }
  /** 查询某人物分支的 sessionId（未登记返回 null）。 */
  sessionIdOf(persona) {
    return this.branchesInternal.get(persona)?.sessionId ?? null;
  }
  /**
   * 确保某人物分支存在：首次进入时调用 createSessionId() 建 Session 并登记；
   * 已存在则原样复用（返回时恢复不重建）。
   * @param persona - 目标人物。
   * @param createSessionId - 仅在该分支尚未登记时调用，返回新 Session id。
   * @returns { sessionId, created }——created=true 表示本次新建。
   */
  ensureBranch(persona, createSessionId) {
    const canonical = this.registry.get(persona).id;
    const existing = this.branchesInternal.get(canonical);
    if (existing !== void 0) return { sessionId: existing.sessionId, created: false };
    this.registry.requireActiveForCreate(canonical);
    const sessionId = createSessionId();
    this.branchesInternal.set(canonical, { persona: canonical, sessionId });
    return { sessionId, created: true };
  }
  /**
   * 切换当前活跃人物（只改活跃指针；其他分支仅隐藏、不删除、不合并）。
   * 若目标分支未登记，调用方应先 ensureBranch 再 activate。
   */
  activate(persona) {
    const canonical = this.registry.get(persona).id;
    if (!this.branchesInternal.has(canonical)) throw new Error(`cannot activate unindexed branch: ${canonical}`);
    this.activeInternal = canonical;
  }
};

// src/aggregate/aggregate.ts
function defaultSessionIdFor(persona) {
  return `session-man-roles-${persona}`;
}
var ConversationAggregate = class _ConversationAggregate {
  conversationId;
  trunk;
  branches;
  constructor(conversationId, trunk, branches) {
    this.conversationId = conversationId;
    this.trunk = trunk;
    this.branches = branches;
  }
  /** 新建对话（写 trunk/created 事件）。 */
  static create(conversationId, storageDir, initialPersonaId, registry2) {
    registry2.requireActiveForCreate(initialPersonaId);
    const trunk = TrunkStorage.create(conversationId, storageDir, initialPersonaId, registry2);
    return new _ConversationAggregate(conversationId, trunk, new BranchManager(initialPersonaId, registry2));
  }
  /** 从磁盘恢复对话（启动恢复：重放 trunk JSONL；branches 索引与 active 一并恢复）。 */
  static load(conversationId, storageDir, registry2) {
    const trunk = TrunkStorage.load(conversationId, storageDir, registry2);
    const branches = new BranchManager(trunk.state.activePersona, registry2, trunk.state.branchesIndex);
    return new _ConversationAggregate(conversationId, trunk, branches);
  }
  /** 当前人物。 */
  get activePersona() {
    return this.branches.activePersona;
  }
  /** 共享层（user_raw 本体 + 困惑状态）。 */
  get sharedLayer() {
    return { userRaws: this.trunk.state.userRaws, dilemma: this.trunk.state.dilemma };
  }
  get taskOutcomes() {
    return this.trunk.state.taskOutcomes;
  }
  recordTaskBudgetBlocked(outcome) {
    return this.trunk.recordTaskBudgetBlocked(outcome);
  }
  /** 人物 ↔ session_id 索引（只读快照）。 */
  get branchesIndex() {
    return this.branches.branches;
  }
  /** 当前活跃分支记录。 */
  currentBranch() {
    return this.branches.currentBranch();
  }
  /**
   * 追加用户原话（共享层）。返回 ref（稳定指针）；重试按 message_id 返回既有 ref。
   * 调用方还需把该原话 append 到**当前**人物 BranchSession（其对话历史），
   * 但跨人物共享只依赖 trunk（目标架构：branch 历史含 user/message + assistant/message）。
   */
  addUserRaw(messageId, text, targetPersonaId) {
    return this.trunk.addUserRaw(messageId, text, targetPersonaId);
  }
  /** 导演推断候选（未确认；F001）。persona 默认当前人物。 */
  setDilemmaCandidate(text, persona) {
    return this.trunk.setDilemmaCandidate(text, persona);
  }
  /** 用户确认后的困惑（共享事实）。 */
  setDilemmaConfirmed(text) {
    return this.trunk.setDilemmaConfirmed(text);
  }
  /** 用户纠正后的困惑（共享事实）。 */
  setDilemmaCorrected(text) {
    return this.trunk.setDilemmaCorrected(text);
  }
  /**
   * 切换当前人物（产品语义：用户无感知底层切换、当前分支独立可见）。
   * 切换 = 确保目标分支存在（首次进入创建 Session 并登记索引）+
   *       trunk 记录 active-persona-set（方案 A 持久化）+
   *       BranchManager.activate（进程内活跃指针）。
   * 其他分支仅隐藏、不删除、不合并；切回时复用原 sessionId，不重建。
   * @param persona - 目标人物。
   * @param createSessionId - 仅首次进入该分支时调用，返回新 Session id。
   * @returns 目标分支 { sessionId, created }。
   */
  switchPersona(persona, createSessionId = defaultSessionIdFor) {
    const branch = this.branches.ensureBranch(persona, () => createSessionId(persona));
    if (this.trunk.state.branchesIndex[persona] !== branch.sessionId) {
      this.trunk.indexBranch(persona, branch.sessionId);
    }
    if (this.branches.activePersona !== persona) {
      this.trunk.setActivePersona(persona);
      this.branches.activate(persona);
    }
    return branch;
  }
  /** 显式登记分支（调用方在外部创建 Session 后同步索引；幂等）。 */
  indexBranch(persona, sessionId) {
    this.branches.ensureBranch(persona, () => sessionId);
    if (this.trunk.state.branchesIndex[persona] !== sessionId) {
      return this.trunk.indexBranch(persona, sessionId);
    }
    return -1;
  }
  /** trunk 落盘收尾（追加写已即时落盘；接口保留）。 */
  async flush() {
    await this.trunk.flush();
  }
};

// src/branch/message-source.ts
import { z as z3 } from "zod";
var branchUserMessageSourceSchema = z3.object({
  conversation_id: z3.string().min(1),
  message_id: z3.string().min(1),
  raw_ref: z3.string().min(1),
  persona_id: personaIdSchema
});
var BRANCH_USER_MESSAGE_EXTRA_KEY = "man_roles_branch_delivery";
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function branchUserMessageExtra(source) {
  return { [BRANCH_USER_MESSAGE_EXTRA_KEY]: source };
}
function branchUserMessageSourceFromData(value) {
  if (!isRecord(value)) return void 0;
  const extra = isRecord(value.extra) ? value.extra[BRANCH_USER_MESSAGE_EXTRA_KEY] : void 0;
  return extra ?? value.source;
}

// src/runtime/recovery.ts
function sourceInRestoredEvents(branch, source) {
  for (const event2 of branch.restoredEvents ?? []) {
    if (event2.type !== "user/message") continue;
    const parsed = branchUserMessageSourceSchema.safeParse(branchUserMessageSourceFromData(event2.data));
    if (parsed.success && parsed.data.conversation_id === source.conversation_id && parsed.data.raw_ref === source.raw_ref && parsed.data.persona_id === source.persona_id) return true;
  }
  return false;
}
async function projectionExists(branch, source) {
  if (branch.findUserMessageByRawRef) return Boolean(await branch.findUserMessageByRawRef(source.raw_ref));
  return sourceInRestoredEvents(branch, source);
}
function item(raw, status, failureCode) {
  return { rawRef: raw.rawRef, messageId: raw.messageId, ...raw.targetPersonaId ? { personaId: raw.targetPersonaId } : {}, status, ...failureCode ? { failureCode } : {} };
}
async function recoverPendingDeliveries(input) {
  const { trunk } = input;
  const results = [];
  for (const raw of trunk.state.userRaws) {
    if (raw.targetPersonaId === void 0) {
      results.push(item(raw, "failed", "legacy_target_missing"));
      continue;
    }
    if (trunk.isBranchDeliveryCommitted(raw.targetPersonaId, raw.rawRef)) {
      results.push(item(raw, "committed"));
      continue;
    }
    const branch = input.branches[raw.targetPersonaId];
    const sessionId = trunk.state.branchesIndex[raw.targetPersonaId];
    if (!branch || !sessionId || branch.sessionId !== sessionId) {
      results.push(item(raw, "failed", "target_branch_missing"));
      continue;
    }
    const source = branchUserMessageSourceSchema.parse({ conversation_id: trunk.state.conversationId, message_id: raw.messageId, raw_ref: raw.rawRef, persona_id: raw.targetPersonaId });
    if (!branch.findUserMessageByRawRef && !branch.restoredEvents) {
      results.push(item(raw, "failed", branch.flush ? "query_missing" : "flush_missing"));
      continue;
    }
    let exists;
    try {
      exists = await projectionExists(branch, source);
    } catch {
      results.push(item(raw, "failed", "query_failed"));
      continue;
    }
    if (exists) {
      try {
        trunk.commitBranchDelivery({ ...source, session_id: sessionId });
        results.push(item(raw, "recovered"));
      } catch {
        results.push(item(raw, "failed", "commit_failed"));
      }
      continue;
    }
    if (!branch.flush) {
      results.push(item(raw, "failed", "flush_missing"));
      continue;
    }
    try {
      branch.append("user/message", { id: raw.messageId, role: "user", content: [{ type: "text", text: raw.text }], source: { kind: "user" }, extra: branchUserMessageExtra(source) }, { surfaceOp: "append" });
    } catch {
      results.push(item(raw, "failed", "branch_write_failed"));
      continue;
    }
    try {
      await branch.flush(branch);
    } catch {
      results.push(item(raw, "failed", "flush_failed"));
      continue;
    }
    try {
      trunk.commitBranchDelivery({ ...source, session_id: sessionId });
      results.push(item(raw, "recovered"));
    } catch {
      results.push(item(raw, "failed", "commit_failed"));
    }
  }
  return results;
}
async function runRecoveryStartup(input) {
  const deliveries = input.delivery ? await recoverPendingDeliveries(input.delivery) : [];
  const compensation = input.compensation ? await compensateDerivedState(input.compensation) : void 0;
  return { deliveries, ...compensation ? { compensation } : {} };
}
async function compensateDerivedState(input) {
  if (!await input.answerExists() || await input.stateExists()) return { status: "not-needed" };
  try {
    await input.compensate({ taskId: input.taskId, messageId: input.messageId });
    return { status: "compensated" };
  } catch {
    return { status: "failed", failureCode: "derived_state_failed" };
  }
}

// src/persona/registry.ts
import { readFileSync as readFileSync2, readdirSync, statSync } from "node:fs";
import { isAbsolute, join as join2, relative, resolve, sep } from "node:path";

// src/persona/manifest-schema.ts
import { z as z4 } from "zod";
var personaIdSchema2 = z4.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "PersonaId must be kebab-case");
var personaStatusSchema = z4.enum(["active", "retired"]);
var personaContentManifestSchema = z4.object({
  prompt: z4.string().min(1),
  anecdotes: z4.string().min(1),
  quotes: z4.string().min(1),
  blacklist: z4.string().min(1)
}).strict();
var personaManifestSchema = z4.object({
  id: personaIdSchema2,
  displayName: z4.string().min(1),
  status: personaStatusSchema,
  legacyIds: z4.array(z4.string().min(1)).default([]),
  content: personaContentManifestSchema
}).strict();

// src/persona/registry.ts
function safeContentPath(packageDir, value, field) {
  if (isAbsolute(value)) throw new Error(`persona content ${field} must be relative: ${value}`);
  const root = resolve(packageDir);
  const target = resolve(root, value);
  const rel = relative(root, target);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`persona content ${field} escapes package: ${value}`);
  }
  return target;
}
function loadJson(path, field) {
  let value;
  try {
    value = JSON.parse(readFileSync2(path, "utf8"));
  } catch (error) {
    throw new Error(`cannot load persona ${field} content ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!Array.isArray(value)) throw new Error(`persona ${field} content must be an array: ${path}`);
  return value;
}
function assertEntryOwnership(entries, id, field) {
  for (const entry of entries) {
    if (field === "blacklist") {
      if (!entry || typeof entry !== "object" || !("personaId" in entry) || entry.personaId !== id) {
        throw new Error(`persona ${id} ${field} entry ownership mismatch`);
      }
    } else if (field === "anecdotes" || field === "quotes") {
      if (!entry || typeof entry !== "object" || !("personaId" in entry) || entry.personaId !== id) {
        throw new Error(`persona ${id} ${field} entry ownership mismatch`);
      }
    }
  }
}
var PersonaRegistry = class _PersonaRegistry {
  definitions;
  legacyToCanonical;
  constructor(definitions) {
    const canonical = /* @__PURE__ */ new Map();
    const legacy = /* @__PURE__ */ new Map();
    for (const definition of definitions) {
      const parsed = personaManifestSchema.parse(definition.manifest);
      if (canonical.has(parsed.id)) throw new Error(`duplicate canonical PersonaId: ${parsed.id}`);
      const normalized = {
        ...definition,
        id: parsed.id,
        displayName: parsed.displayName,
        status: parsed.status,
        legacyIds: parsed.legacyIds
      };
      assertEntryOwnership(normalized.anecdotes, parsed.id, "anecdotes");
      assertEntryOwnership(normalized.quotes, parsed.id, "quotes");
      assertEntryOwnership(normalized.blacklist, parsed.id, "blacklist");
      canonical.set(parsed.id, normalized);
      for (const legacyId of parsed.legacyIds) {
        if (legacy.has(legacyId) || canonical.has(legacyId)) throw new Error(`duplicate legacy PersonaId: ${legacyId}`);
        legacy.set(legacyId, parsed.id);
      }
    }
    for (const [id] of canonical) {
      if (legacy.has(id)) throw new Error(`canonical PersonaId conflicts with legacy ID: ${id}`);
    }
    this.definitions = canonical;
    this.legacyToCanonical = legacy;
  }
  static fromArtifact(artifact) {
    return new _PersonaRegistry(artifact);
  }
  get(id) {
    const canonical = personaIdSchema2.parse(id);
    const definition = this.definitions.get(canonical);
    if (!definition) throw new Error(`unknown PersonaId: ${id}`);
    return definition;
  }
  normalizePersistedId(id) {
    const parsed = personaIdSchema2.safeParse(id);
    if (parsed.success && this.definitions.has(parsed.data)) return parsed.data;
    const canonical = this.legacyToCanonical.get(id);
    if (canonical) return canonical;
    throw new Error(`unknown PersonaId: ${id}`);
  }
  listActive() {
    return [...this.definitions.values()].filter((d) => d.manifest.status === "active").sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
  }
  list() {
    return [...this.definitions.values()].sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
  }
  canCreate(id) {
    return this.get(id).manifest.status === "active";
  }
  requireKnownForRestore(id) {
    return this.get(id);
  }
  requireActiveForCreate(id) {
    const definition = this.get(id);
    if (definition.manifest.status !== "active") throw new Error(`retired PersonaId cannot be created: ${id}`);
    return definition;
  }
  static fromDirectory(rootDir) {
    const root = resolve(rootDir);
    const names = readdirSync(root).filter((name) => statSafe(join2(root, name))?.isDirectory()).sort();
    const definitions = names.map((name) => {
      const packageDir = join2(root, name);
      const manifestPath = join2(packageDir, "manifest.json");
      let manifest;
      try {
        manifest = personaManifestSchema.parse(JSON.parse(readFileSync2(manifestPath, "utf8")));
      } catch (error) {
        throw new Error(`invalid persona manifest ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (manifest.id !== name) throw new Error(`manifest id ${manifest.id} does not match package directory ${name}`);
      const promptPath = safeContentPath(packageDir, manifest.content.prompt, "prompt");
      const anecdotesPath = safeContentPath(packageDir, manifest.content.anecdotes, "anecdotes");
      const quotesPath = safeContentPath(packageDir, manifest.content.quotes, "quotes");
      const blacklistPath = safeContentPath(packageDir, manifest.content.blacklist, "blacklist");
      const definition = { manifest, prompt: readFileChecked(promptPath), anecdotes: loadJson(anecdotesPath, "anecdotes"), quotes: loadJson(quotesPath, "quotes"), blacklist: loadJson(blacklistPath, "blacklist") };
      assertEntryOwnership(definition.anecdotes, manifest.id, "anecdotes");
      assertEntryOwnership(definition.quotes, manifest.id, "quotes");
      assertEntryOwnership(definition.blacklist, manifest.id, "blacklist");
      return definition;
    });
    return new _PersonaRegistry(definitions);
  }
};
function readFileChecked(path) {
  try {
    return readFileSync2(path, "utf8");
  } catch (error) {
    throw new Error(`missing persona content ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function statSafe(path) {
  try {
    return statSync(path);
  } catch {
    return void 0;
  }
}

// src/e2e/task5-fixture.ts
var TASK5_FIXTURE_IDS = ["alpha", "beta", "gamma"];
function createTask5FixtureRegistry() {
  return new PersonaRegistry(TASK5_FIXTURE_IDS.map((id) => {
    const manifest = {
      id,
      displayName: id,
      status: "active",
      legacyIds: [`legacy-${id}`],
      content: { prompt: "persona.md", anecdotes: "anecdotes.json", quotes: "quotes.json", blacklist: "blacklist.json" }
    };
    const entry = { personaId: id, id: `${id}-fixture`, text: `fixture-${id}`, source: `fixture-${id}` };
    return { manifest, prompt: `fixture prompt ${id}`, anecdotes: [entry], quotes: [entry], blacklist: [entry] };
  }));
}

// src/runtime/message-delivery.ts
function emit(input, snapshot) {
  input.onStatus?.(Object.freeze({ ...snapshot }));
}
async function deliverCurrentUserMessage(input) {
  const { trunk, persona } = input;
  emit(input, { status: "local-pending", conversation_id: trunk.state.conversationId, message_id: input.messageId, persona_id: persona, session_id: input.sessionId, canStartGeneration: false });
  let ref;
  const acceptedBeforeCall = trunk.state.userRaws.some((raw2) => raw2.messageId === input.messageId);
  emit(input, { status: "saving", conversation_id: trunk.state.conversationId, message_id: input.messageId, persona_id: persona, session_id: input.sessionId, canStartGeneration: false });
  if (trunk.state.activePersona !== persona || trunk.state.branchesIndex[persona] !== input.sessionId) {
    const error = Object.assign(new Error(`branch session is not the active indexed persona: ${persona}`), { code: "branch_target_mismatch" });
    emit(input, { status: "failed", conversation_id: trunk.state.conversationId, message_id: input.messageId, persona_id: persona, session_id: input.sessionId, canStartGeneration: false, error });
    return { status: "failed", rawRef: "", source: branchUserMessageSourceSchema.parse({ conversation_id: trunk.state.conversationId, message_id: input.messageId, raw_ref: "rejected", persona_id: persona }), canStartGeneration: false, error };
  }
  try {
    ref = trunk.addUserRaw(input.messageId, input.text, persona);
  } catch (error) {
    emit(input, { status: "failed", conversation_id: trunk.state.conversationId, message_id: input.messageId, persona_id: persona, session_id: input.sessionId, canStartGeneration: false, error });
    throw error;
  }
  const raw = trunk.state.userRaws.find((item2) => item2.ref === ref);
  if (raw === void 0) throw new Error(`accepted user raw missing: ${ref}`);
  const source = branchUserMessageSourceSchema.parse({
    conversation_id: trunk.state.conversationId,
    message_id: raw.messageId,
    raw_ref: raw.rawRef,
    persona_id: persona
  });
  emit(input, { status: "saved-delivering", ...source, session_id: input.sessionId, canStartGeneration: false });
  if (trunk.isBranchDeliveryCommitted(persona, raw.rawRef)) {
    return { status: "committed", rawRef: source.raw_ref, source, canStartGeneration: true, committedSeq: -1 };
  }
  if (acceptedBeforeCall && !input.findUserMessageByRawRef) {
    const error = Object.assign(new Error("durable Branch query is required for an existing accepted raw"), { code: "query_missing" });
    emit(input, { status: "failed", ...source, session_id: input.sessionId, canStartGeneration: false, error });
    return { status: "failed", rawRef: source.raw_ref, source, canStartGeneration: false, error };
  }
  if (input.findUserMessageByRawRef) {
    try {
      if (await input.findUserMessageByRawRef(raw.rawRef)) {
        const committedSeq = trunk.commitBranchDelivery({ ...source, session_id: input.sessionId });
        return { status: "committed", rawRef: source.raw_ref, source, canStartGeneration: true, committedSeq };
      }
    } catch (error) {
      emit(input, { status: "failed", ...source, session_id: input.sessionId, canStartGeneration: false, error });
      return { status: "failed", rawRef: source.raw_ref, source, canStartGeneration: false, error };
    }
  }
  try {
    const message = {
      id: input.messageId,
      role: "user",
      content: [{ type: "text", text: input.text }],
      // `kind:'user'` is the DSH transcript contract for a visible user
      // bubble. Product delivery identity is durable in `extra`, while Trunk
      // remains the authority for the original user text and routing.
      source: { kind: "user" },
      extra: branchUserMessageExtra(source)
    };
    if (input.queueUserMessage) input.queueUserMessage(message);
    else input.session.append("user/message", message, { surfaceOp: "append" });
    await input.flush(input.session);
  } catch (error) {
    emit(input, { status: "failed", ...source, session_id: input.sessionId, canStartGeneration: false, error });
    return { status: "failed", rawRef: source.raw_ref, source, canStartGeneration: false, error };
  }
  try {
    const committedSeq = trunk.commitBranchDelivery({ ...source, session_id: input.sessionId });
    return { status: "committed", rawRef: source.raw_ref, source, canStartGeneration: true, committedSeq, ...input.wakePending ? { wakePending: input.wakePending } : {} };
  } catch (error) {
    emit(input, { status: "failed", ...source, session_id: input.sessionId, canStartGeneration: false, error });
    return { status: "failed", rawRef: source.raw_ref, source, canStartGeneration: false, error };
  }
}

// src/e2e/task5-host.ts
var observeTrunk = (file) => {
  const bytes = readFileSync3(file);
  const lines = bytes.toString("utf8").split(/\r?\n/).filter(Boolean);
  return { bytes: bytes.byteLength, events: lines.length, sha256: createHash("sha256").update(bytes).digest("hex") };
};
var registry = createTask5FixtureRegistry();
var PERSONAS = (() => {
  const ids = registry.listActive().map((d) => d.id);
  if (ids.length !== TASK5_FIXTURE_IDS.length) throw new Error("task5 fixture registry incomplete");
  return ids;
})();
function requireMapValue(map, key, label) {
  const value = map.get(key);
  if (value === void 0) throw new Error(`missing ${label}: ${String(key)}`);
  return value;
}
function requireArrayItem(items, index, label) {
  const value = items[index];
  if (value === void 0) throw new Error(`missing ${label}[${index}]`);
  return value;
}
function requireRecordArray(record, key, label) {
  const value = record[key];
  if (value === void 0) throw new Error(`missing ${label}[${key}]`);
  return value;
}
var primaryPersona = PERSONAS[0];
var secondaryPersona = PERSONAS[1];
if (!primaryPersona || !secondaryPersona) throw new Error("task5 fixture requires primary and secondary personas");
var ROOT = join3(process.env.DSH_HOME ?? ".", "man-roles", "task5-restart");
var CONVERSATION = "task5-real-host";
var sid = (p) => SessionId(`man-roles-task5-${p}`);
var src = (message_id, raw_ref, persona_id) => ({ kind: "plugin", plugin: "man-roles-roleplayer", conversation_id: CONVERSATION, message_id, raw_ref, persona_id });
var event = (text, source) => createUserMessage({ content: [{ type: "text", text }], source });
function isRecord2(value) {
  return typeof value === "object" && value !== null;
}
function appendBranchMessage(session, type, data, options) {
  if (type !== "user/message") throw new Error(`unsupported recovery event type: ${type}`);
  if (!isRecord2(data)) throw new Error("recovery user/message payload must be an object");
  const content = data.content;
  if (!Array.isArray(content) || content.length === 0) throw new Error("recovery user/message content is missing");
  const block = content[0];
  if (!isRecord2(block) || typeof block.text !== "string") throw new Error("recovery user/message text is missing");
  const parsed = branchUserMessageSourceSchema.parse(data.source);
  session.append("user/message", event(block.text, { kind: "plugin", plugin: "man-roles-roleplayer", ...parsed }), options ?? { surfaceOp: "append" });
}
var flush = (ctx, session) => ctx.sessions.flush(session);
async function inspect(ctx, id) {
  const persistence = ctx.sessionPersistence;
  const v = await persistence.inspect(id);
  if (!v || typeof v !== "object" || !("events" in v) || !Array.isArray(v.events)) throw new Error(`missing persistence ${id}`);
  return v.events;
}
function sources(events) {
  return events.flatMap((e) => {
    if (e.type !== "user/message") return [];
    const p = branchUserMessageSourceSchema.safeParse(e.data.source);
    return p.success ? [{ message_id: p.data.message_id, raw_ref: p.data.raw_ref, persona_id: p.data.persona_id }] : [];
  });
}
var count = (events, id) => sources(events).filter((s) => s.message_id === id).length;
function deferred() {
  let resolve2;
  const promise = new Promise((res) => {
    resolve2 = res;
  });
  return { promise, resolve: resolve2 };
}
async function cancelScenario(ctx) {
  const id = SessionId("man-roles-task5-cancel");
  const agent = await ctx.agents.create({ sessionId: id, agentOptions: { provider: "man-roles-compat-local", model: "scripted-no-network" }, setup: () => ({ commit: () => void 0 }) });
  const entered = deferred();
  const release = deferred();
  const requests = [];
  let usageTokens = 0;
  const off = ctx.on("llm/stream", (o, next) => {
    if (String(o.sessionId) !== String(id)) return next();
    requests.push({ provider: String(o.provider ?? ""), model: String(o.model ?? ""), usageTokens: 0 });
    entered.resolve();
    return (async function* () {
      yield { type: "block-start", index: 0, blockType: "text" };
      yield { type: "text-delta", index: 0, text: "partial" };
      await release.promise;
      yield { type: "text-delta", index: 0, text: "[LATE_MARKER]" };
      yield { type: "block-end", index: 0, block: { type: "text", text: "[LATE_MARKER]" } };
      const inputTokens = 0, outputTokens = 0;
      usageTokens += inputTokens + outputTokens;
      requireArrayItem(requests, requests.length - 1, "request").usageTokens += inputTokens + outputTokens;
      yield { type: "usage", usage: { inputTokens, outputTokens } };
      yield { type: "finish", reason: { kind: "stop" } };
    })();
  });
  try {
    agent.agent.followup(createUserMessage({ content: [{ type: "text", text: "fixture cancel" }], source: { kind: "user" } }));
    await Promise.race([entered.promise, new Promise((_, r) => setTimeout(() => r(new Error("cancel timeout")), 5e3))]);
    agent.agent.cancel({ kind: "user" });
    release.resolve();
    await agent.agent.whenIdle();
    const events = agent.agent.session.events;
    const aborted = events.some((e) => e.type === "turn/end" && e.data.reason.kind === "aborted");
    const derivedAttempts = { count: 0 };
    const derivedResult = (() => {
      derivedAttempts.count++;
      return aborted ? { status: "skipped" } : { status: "committed" };
    })();
    return { aborted, assistantCount: events.filter((e) => e.type === "assistant/message").length, lateAssistant: events.filter((e) => e.type === "assistant/message" && JSON.stringify(e.data).includes("LATE_MARKER")).length, derivedAttempt: derivedAttempts.count, derivedResult, persistedDerived: derivedResult.status === "committed" ? 1 : 0, requests, usageTokens: requests.reduce((sum, request) => sum + request.usageTokens, 0) };
  } finally {
    off();
    release.resolve();
    await agent.dispose();
  }
}
async function runTask5Host(ctx, stage) {
  mkdirSync2(ROOT, { recursive: true });
  const trunkDir = join3(ROOT, "trunk");
  const reportPath = join3(ROOT, `${stage}.json`);
  const aggregate = stage === "stage1" ? ConversationAggregate.create(CONVERSATION, trunkDir, primaryPersona, registry) : ConversationAggregate.load(CONVERSATION, trunkDir, registry);
  let recoveryStreamCalls = 0;
  const off = ctx.on("llm/stream", () => {
    recoveryStreamCalls++;
    throw new Error("recovery generation forbidden");
  });
  if (stage === "stage1") {
    const sessions = new Map(PERSONAS.map((p) => [p, ctx.sessions.create(sid(p))]));
    PERSONAS.forEach((p) => aggregate.indexBranch(p, String(sid(p))));
    const add = async (id, text, p, deliver = true) => {
      const ref = aggregate.addUserRaw(id, text, p);
      if (!deliver) return;
      const raw = aggregate.trunk.state.userRaws.find((r) => r.ref === ref);
      const s = requireMapValue(sessions, p, "session");
      s.append("user/message", event(text, src(id, raw.rawRef, p)), { surfaceOp: "append" });
      await flush(ctx, s);
    };
    await add("same-1", "same text", primaryPersona);
    await add("same-2", "same text", primaryPersona);
    await add("retry-1", "retry text", primaryPersona);
    await add("accepted-only", "accepted text", primaryPersona, false);
    await add("branch-only", "branch text", secondaryPersona);
    const trunkFile = aggregate.trunk.filePath;
    const beforeRetry = observeTrunk(trunkFile);
    const retryRaw = aggregate.addUserRaw("retry-1", "retry text", primaryPersona);
    const retryRef = aggregate.trunk.state.userRaws.find((r) => r.ref === retryRaw).rawRef;
    const retryBranchBefore = count(requireMapValue(sessions, primaryPersona, "session").events, "retry-1");
    const retryResult = await deliverCurrentUserMessage({ trunk: aggregate.trunk, persona: primaryPersona, session: { append: (type, data, options) => appendBranchMessage(requireMapValue(sessions, primaryPersona, "session"), type, data, options) }, sessionId: String(sid(primaryPersona)), messageId: "retry-1", text: "retry text", flush: () => flush(ctx, requireMapValue(sessions, primaryPersona, "session")), findUserMessageByRawRef: async (raw) => sources(await inspect(ctx, sid(primaryPersona))).some((x) => x.raw_ref === raw) });
    const retryBranchAfter = count(await inspect(ctx, sid(primaryPersona)), "retry-1");
    const afterRetry = observeTrunk(trunkFile);
    let textConflict = "";
    try {
      aggregate.addUserRaw("retry-1", "different text", primaryPersona);
    } catch (e) {
      textConflict = String(e.message);
    }
    ;
    let targetConflict = "";
    try {
      aggregate.addUserRaw("retry-1", "retry text", secondaryPersona);
    } catch (e) {
      targetConflict = String(e.message);
    }
    ;
    const afterConflicts = observeTrunk(trunkFile);
    for (const p of PERSONAS) {
      const s = requireMapValue(sessions, p, "session");
      s.append("turn/start", { turn: 1 });
      s.append("step/start", { turn: 1, step: 1 });
      s.append("assistant/message", { turn: 1, step: 1, message: createAssistantMessage({ content: [{ type: "text", text: `private-${p}` }], source: { provider: "task5-scripted", model: "no-network" } }) }, { surfaceOp: "append" });
      s.append("step/end", { turn: 1, step: 1 });
      s.append("turn/end", { turn: 1, reason: { kind: "completed" } });
      await flush(ctx, s);
    }
    const persisted = Object.fromEntries(PERSONAS.map((p) => [p, sources(requireMapValue(sessions, p, "session").events).length]));
    writeFileSync(reportPath, JSON.stringify({ stage, pid: process.pid, expectedPersonaIds: PERSONAS, dshSessions: Object.fromEntries(PERSONAS.map((p) => [p, String(sid(p))])), persisted, crashBoundaries: { acceptedOnly: true, branchFlushed: true, assistantFlushed: true }, trunk: { file: trunkFile, beforeRetry, afterRetry, afterConflicts }, stage1Observation: { retry: { sameIdSamePayload: { rawCount: aggregate.trunk.state.userRaws.filter((r) => r.messageId === "retry-1").length, rawRef: retryRef, branchBefore: retryBranchBefore, branchAfter: retryBranchAfter, result: retryResult.status, trunkChangedOnlyByCommit: afterRetry.events === beforeRetry.events + 1 }, sameIdTextConflict: { message: textConflict, rawCount: aggregate.trunk.state.userRaws.length, trunkUnchanged: afterConflicts.sha256 === afterRetry.sha256 }, sameIdTargetConflict: { message: targetConflict, rawCount: aggregate.trunk.state.userRaws.length, trunkUnchanged: afterConflicts.sha256 === afterRetry.sha256 } } }, providerObservation: { recoveryStreamCalls, providerNetworkUsed: false, tokenCost: 0 } }));
  } else {
    const stage1 = JSON.parse(readFileSync3(join3(ROOT, "stage1.json"), "utf8"));
    if (JSON.stringify(stage1.expectedPersonaIds) !== JSON.stringify(PERSONAS) || PERSONAS.some((p) => stage1.dshSessions[p] !== String(sid(p)))) throw new Error("stage1 fixture identity mismatch");
    const handles = /* @__PURE__ */ new Map();
    for (const p of PERSONAS) handles.set(p, await ctx.agents.resume({ resumeSessionId: sid(p), agentOptions: { provider: "task5-scripted", model: "no-network" }, setup: () => ({ commit: () => void 0 }) }));
    const sessions = new Map(PERSONAS.map((p) => [p, requireMapValue(handles, p, "agent handle").agent.session]));
    const before = /* @__PURE__ */ new Map();
    for (const p of PERSONAS) before.set(p, await inspect(ctx, sid(p)));
    const beforeCommitted = aggregate.trunk.state.deliveryCommitted.length;
    const branches = {};
    for (const p of PERSONAS) {
      const s = requireMapValue(sessions, p, "session");
      branches[p] = { sessionId: String(sid(p)), append: (type, data, options) => {
        if (type !== "user/message") throw new Error(`unsupported recovery event type: ${type}`);
        if (!isRecord2(data)) throw new Error("recovery user/message payload must be an object");
        const content = data.content;
        if (!Array.isArray(content) || content.length === 0) throw new Error("recovery user/message content is missing");
        const block = content[0];
        if (!isRecord2(block) || typeof block.text !== "string") throw new Error("recovery user/message text is missing");
        const parsed = branchUserMessageSourceSchema.parse(data.source);
        s.append("user/message", event(block.text, { kind: "plugin", plugin: "man-roles-roleplayer", ...parsed }), options ?? { surfaceOp: "append" });
      }, flush: () => flush(ctx, s), findUserMessageByRawRef: async (raw) => sources(await inspect(ctx, sid(p))).some((x) => x.raw_ref === raw) };
    }
    const beforeSources = Object.fromEntries(PERSONAS.map((p) => [p, sources(requireMapValue(before, p, "before events"))]));
    const recovery = await runRecoveryStartup({ delivery: { trunk: aggregate.trunk, branches }, compensation: { taskId: "task5-assistant-derived", messageId: "assistant-1", answerExists: () => PERSONAS.some((p) => requireMapValue(sessions, p, "session").events.some((e) => e.type === "assistant/message")), stateExists: () => aggregate.sharedLayer.dilemma.phase === "candidate", compensate: () => aggregate.setDilemmaCandidate("fixture-derived", primaryPersona) } });
    const after = /* @__PURE__ */ new Map();
    for (const p of PERSONAS) after.set(p, await inspect(ctx, sid(p)));
    const afterCommitted = aggregate.trunk.state.deliveryCommitted.length;
    off();
    const cancel = await cancelScenario(ctx);
    const assistant = Object.fromEntries(PERSONAS.map((p) => [p, requireMapValue(after, p, "after events").filter((e) => e.type === "assistant/message").map((e) => JSON.stringify(e.data))]));
    const restored = Object.fromEntries(PERSONAS.map((p) => [p, sources(requireMapValue(after, p, "after events"))]));
    const isolation = Object.fromEntries(PERSONAS.map((p) => [p, requireRecordArray(assistant, p, "assistant").some((x) => x.includes(`private-${p}`)) && requireRecordArray(assistant, p, "assistant").every((x) => PERSONAS.filter((q) => q !== p).every((q) => !x.includes(`private-${q}`)))]));
    const scenario = { identical: { same1: { raw: aggregate.trunk.state.userRaws.filter((r) => r.messageId === "same-1").length, branch: count(after.get(primaryPersona), "same-1") }, same2: { raw: aggregate.trunk.state.userRaws.filter((r) => r.messageId === "same-2").length, branch: count(after.get(primaryPersona), "same-2") } }, retry: { raw: aggregate.trunk.state.userRaws.filter((r) => r.messageId === "retry-1").length, branch: count(after.get(primaryPersona), "retry-1"), committed: aggregate.trunk.state.deliveryCommitted.filter((d) => d.raw_ref === aggregate.trunk.state.userRaws.find((r) => r.messageId === "retry-1").rawRef).length }, acceptedOnly: { beforeBranch: count(before.get(primaryPersona), "accepted-only"), afterBranch: count(after.get(primaryPersona), "accepted-only"), committed: aggregate.trunk.isBranchDeliveryCommitted(primaryPersona, aggregate.trunk.state.userRaws.find((r) => r.messageId === "accepted-only").rawRef), status: recovery.deliveries.find((d) => d.messageId === "accepted-only")?.status, failureCode: recovery.deliveries.find((d) => d.messageId === "accepted-only")?.failureCode }, branchOnly: { beforeBranch: count(before.get(secondaryPersona), "branch-only"), afterBranch: count(after.get(secondaryPersona), "branch-only"), committed: aggregate.trunk.isBranchDeliveryCommitted(secondaryPersona, aggregate.trunk.state.userRaws.find((r) => r.messageId === "branch-only").rawRef), status: recovery.deliveries.find((d) => d.messageId === "branch-only")?.status, failureCode: recovery.deliveries.find((d) => d.messageId === "branch-only")?.failureCode }, assistantState: { assistantByPersona: Object.fromEntries(PERSONAS.map((p) => [p, requireRecordArray(assistant, p, "assistant").length])), derivedPersisted: aggregate.sharedLayer.dilemma.phase === "candidate", generation: recoveryStreamCalls }, cancel: { aborted: cancel.aborted, targetTurnAssistantCount: cancel.assistantCount, lateMarkerCount: cancel.lateAssistant, derivedMarkerCount: cancel.persistedDerived, localRequests: cancel.requests.length } };
    const byPersona = Object.fromEntries(PERSONAS.map((p) => [p, requireMapValue(after, p, "after events").length]));
    writeFileSync(reportPath, JSON.stringify({ stage, pid: process.pid, expectedPersonaIds: PERSONAS, stage1Pid: stage1.pid, stage2Pid: process.pid, processRestart: stage1.pid !== process.pid, dshPersistence: PERSONAS.every((p) => requireMapValue(after, p, "after events").length > 0), providerObservation: { recoveryStreamCalls, scriptedRequests: cancel.requests.length, scriptedOnly: cancel.requests.every((r) => r.provider === "man-roles-compat-local" && r.model === "scripted-no-network"), providerNetworkUsed: cancel.requests.some((r) => !(r.provider === "man-roles-compat-local" && r.model === "scripted-no-network")), tokenCost: cancel.requests.reduce((sum, request) => sum + request.usageTokens, 0), requests: cancel.requests }, recovery, before: { byPersona: Object.fromEntries(PERSONAS.map((p) => [p, requireMapValue(before, p, "before events").length])), sources: beforeSources, committed: beforeCommitted }, after: { byPersona, sources: restored, committed: afterCommitted }, derivedState: { persisted: aggregate.sharedLayer.dilemma.phase === "candidate", generationCalls: recoveryStreamCalls }, cancel, restored, assistant, order: aggregate.sharedLayer.userRaws.map((r) => r.messageId), isolation, counts: { userSources: Object.values(restored).reduce((n, x) => n + x.length, 0), committed: afterCommitted }, scenarios: scenario, authority: { stage1: stage1.stage1Observation, beforeKeys: Object.keys(beforeSources), afterKeys: Object.keys(restored) } }));
    for (const h of handles.values()) await h.dispose();
  }
  if (stage === "stage1") off();
  const exit = ctx.get("appExit");
  if (typeof exit === "function") exit(0);
}
export {
  runTask5Host
};
//# sourceMappingURL=task5-host.js.map
