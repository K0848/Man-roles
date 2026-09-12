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
function transition(state, event) {
  switch (event.type) {
    case "user/message":
      if (state.userRawRefs.includes(event.seq)) return state;
      return { ...state, userRawRefs: [...state.userRawRefs, event.seq] };
    case "man-roles/dilemma/candidate": {
      if (state.phase !== "pending") return state;
      return {
        ...state,
        phase: "candidate",
        activePersona: event.data.persona,
        candidateText: event.data.text,
        updatedBySeq: event.seq ?? state.updatedBySeq
      };
    }
    case "man-roles/dilemma/confirmed": {
      if (state.phase !== "candidate") return state;
      return {
        ...state,
        phase: "confirmed",
        candidateText: null,
        confirmedText: event.data.text,
        updatedBySeq: event.seq ?? state.updatedBySeq
      };
    }
    case "man-roles/dilemma/corrected": {
      if (state.phase !== "candidate") return state;
      return {
        ...state,
        phase: "corrected",
        candidateText: null,
        correctedText: event.data.text,
        updatedBySeq: event.seq ?? state.updatedBySeq
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
      const item = { id: `legacy-${record.seq}`, kind: "core-conflict", text: parsed.data.text, status: "candidate", sourceRawRefs: refs, proposedByPersona: parsed.data.persona, visibility: "origin-persona-only", revision: record.seq + 1 };
      return { ...state, dilemma: next, dilemmaItems: state.dilemmaItems.some((x) => x.id === item.id) ? state.dilemmaItems : [...state.dilemmaItems, item] };
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
      const item = { id: `legacy-${record.seq}`, kind: "core-conflict", text: parsed.data.text, status: "confirmed", sourceRawRefs: itemRefs, proposedByPersona: old?.proposedByPersona ?? state.activePersona, visibility: "shared-confirmed", revision: record.seq + 1, ...old ? { supersedes: old.id } : {} };
      const items = old ? state.dilemmaItems.map((x) => x.id === old.id ? { ...x, status: "superseded", supersededBy: item.id } : x) : state.dilemmaItems;
      return { ...state, dilemma: next, dilemmaItems: items.some((x) => x.id === item.id) ? items : [...items, item] };
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
      const item = { id: `legacy-${record.seq}`, kind: "core-conflict", text: parsed.data.text, status: "confirmed", sourceRawRefs: itemRefs, proposedByPersona: old?.proposedByPersona ?? state.activePersona, visibility: "shared-confirmed", revision: record.seq + 1, ...old ? { supersedes: old.id } : {} };
      const items = old ? state.dilemmaItems.map((x) => x.id === old.id ? { ...x, status: "superseded", supersededBy: item.id } : x) : state.dilemmaItems;
      return { ...state, dilemma: next, dilemmaItems: items.some((x) => x.id === item.id) ? items : [...items, item] };
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
      const item = state.dilemmaItems.find((x) => x.id === id);
      if (!item || item.kind !== "core-conflict" || item.status !== "confirmed" || item.supersededBy) return state;
      return { ...state, coreDilemmaItemId: id };
    }
    case "trunk/branch-progress-updated": {
      const event = branchProgressUpdatedEventSchema.safeParse(record.data);
      if (!event.success) return state;
      const progress = event.data.progress;
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
  constructor(state, filePath, nextSeq, registry) {
    this.stateInternal = state;
    this.filePath = filePath;
    this.storageDir = dirname(filePath);
    this.nextSeqInternal = nextSeq;
    this.registry = registry;
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
  static create(conversationId, storageDir, initialPersonaId, registry) {
    const initial = registry.requireActiveForCreate(initialPersonaId).id;
    const filePath = join(storageDir, `${conversationId}.jsonl`);
    mkdirSync(storageDir, { recursive: true });
    const storage = new _TrunkStorage(initialTrunkState(conversationId, initial), filePath, 0, registry);
    storage.append(TRUNK_CREATED, { conversationId, initial_persona_id: initial });
    return storage;
  }
  /**
   * 从磁盘恢复 trunk（启动恢复；重放 JSONL 事件，重复 seq 幂等跳过）。
   * 文件不存在 → 视为新会话（等价 create，但不重复写 created 事件由调用方决定——
   * 此处直接返回新实例并写 created）。
   */
  static load(conversationId, storageDir, registry) {
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
    const initial = registry.normalizePersistedId(initialRaw);
    let state = initialTrunkState(conversationId, initial);
    let maxSeq = -1;
    for (const line of rawLines) {
      if (line.trim() === "") continue;
      const record = parseRecordLine(line);
      if (record === null) continue;
      record.data = normalizePersistedPersonaFields(record.data, registry);
      if (record.seq <= maxSeq) continue;
      maxSeq = record.seq;
      state = applyTrunkRecord(state, record);
    }
    return new _TrunkStorage(state, filePath, maxSeq + 1, registry);
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
  proposeDilemmaItem(item, meta) {
    const parsed = dilemmaItemSchema.parse(item);
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
    const item = this.stateInternal.dilemmaItems.find((x) => x.id === itemId);
    if (!item || item.kind !== "core-conflict" || item.status !== "confirmed" || item.supersededBy) throw new Error("core item must be active confirmed core-conflict");
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
function normalizePersistedPersonaFields(value, registry) {
  if (!value || typeof value !== "object") return value;
  const data = { ...value };
  for (const key of ["persona", "personaId", "target_persona_id", "targetPersonaId", "persona_id", "active_persona_id", "activePersonaId"]) {
    if (typeof data[key] === "string") data[key] = registry.normalizePersistedId(data[key]);
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
export {
  TRUNK_ACTION_RECORDED,
  TRUNK_ACTIVE_PERSONA_SET,
  TRUNK_BRANCH_DELIVERY_COMMITTED,
  TRUNK_BRANCH_INDEXED,
  TRUNK_BRANCH_PROGRESS_UPDATED,
  TRUNK_CREATED,
  TRUNK_DIALOGUE_PHASE_SET,
  TRUNK_DILEMMA_CANDIDATE,
  TRUNK_DILEMMA_CONFIRMED,
  TRUNK_DILEMMA_CORE_SELECTED,
  TRUNK_DILEMMA_CORRECTED,
  TRUNK_DILEMMA_ITEM_PROPOSED,
  TRUNK_DILEMMA_ITEM_REVIEWED,
  TRUNK_PRODUCT_LIFECYCLE,
  TRUNK_PRODUCT_RESULT,
  TRUNK_SESSION_CONTROL_RECORDED,
  TRUNK_TASK_OUTCOME_RECORDED,
  TRUNK_TASK_ROUTED,
  TRUNK_USER_RAW_ADDED,
  TrunkStorage,
  applyTrunkRecord
};
//# sourceMappingURL=storage.js.map
