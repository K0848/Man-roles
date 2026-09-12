// src/e2e/phase7-task9-scripted.ts
import { CallId, createUserMessage as createUserMessage2, createAssistantMessage } from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";
import { join as join3 } from "node:path";

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
    const meta2 = record.data && typeof record.data === "object" ? record.data : {};
    const parsedMeta = dialogueEventMetaSchema.safeParse({ messageId: meta2.messageId, taskId: meta2.taskId, eventPurpose: meta2.eventPurpose, sourceRawRefs: meta2.sourceRawRefs });
    if (!parsedMeta.success) return state;
    if (parsedMeta.data.sourceRawRefs.some((ref) => !state.userRaws.some((raw) => raw.rawRef === ref))) return state;
    const itemRefs = meta2.item && typeof meta2.item === "object" ? meta2.item.sourceRawRefs : void 0;
    const replacementRefs = meta2.replacement && typeof meta2.replacement === "object" ? meta2.replacement.sourceRawRefs : void 0;
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
    const canonical3 = { ...data, persona_id: this.registry.get(data.persona_id).id };
    if (this.isBranchDeliveryCommitted(canonical3.persona_id, canonical3.raw_ref)) return -1;
    return this.append(TRUNK_BRANCH_DELIVERY_COMMITTED, canonical3);
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
  proposeDilemmaItem(item, meta2) {
    const parsed = dilemmaItemSchema.parse(item);
    this.registry.get(parsed.proposedByPersona);
    if (parsed.status !== "candidate" || parsed.visibility !== "origin-persona-only") throw new Error("proposal must be origin-only candidate");
    if (parsed.sourceRawRefs.some((r) => !this.stateInternal.userRaws.some((u) => u.rawRef === r))) throw new Error("sourceRawRefs must reference existing user raws");
    const existing = this.stateInternal.dilemmaItems.find((x) => x.id === parsed.id);
    if (existing) {
      if (stableJson(existing) !== stableJson(parsed)) throw new Error(`dilemma item conflict: ${parsed.id}`);
      return -1;
    }
    return this.append(TRUNK_DILEMMA_ITEM_PROPOSED, { ...meta2, item: parsed, personaId: parsed.proposedByPersona });
  }
  reviewDilemmaItem(itemId, replacement, meta2) {
    const old = this.stateInternal.dilemmaItems.find((x) => x.id === itemId);
    if (!old) throw new Error(`unknown dilemma item: ${itemId}`);
    const action = String(meta2.action ?? "correct");
    if (!["confirm", "partial-confirm", "correct", "reject", "skip"].includes(action)) throw new Error("invalid review action");
    const next = replacement === void 0 ? void 0 : dilemmaItemSchema.parse(replacement);
    const key = typeof meta2.messageId === "string" && typeof meta2.taskId === "string" && typeof meta2.eventPurpose === "string" ? `${meta2.messageId}\0${meta2.taskId}\0${meta2.eventPurpose}` : void 0;
    const reviewData = { ...meta2, itemId, action, personaId: old.proposedByPersona, ...next === void 0 ? {} : { replacement: next } };
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
  selectCoreDilemmaItem(itemId, meta2) {
    const item = this.stateInternal.dilemmaItems.find((x) => x.id === itemId);
    if (!item || item.kind !== "core-conflict" || item.status !== "confirmed" || item.supersededBy) throw new Error("core item must be active confirmed core-conflict");
    return this.append(TRUNK_DILEMMA_CORE_SELECTED, { ...meta2, itemId });
  }
  updateBranchProgress(progress, meta2) {
    const parsed = branchProgressSchema.parse(progress);
    this.registry.get(parsed.personaId);
    return this.append(TRUNK_BRANCH_PROGRESS_UPDATED, { ...meta2, progress: parsed });
  }
  setDialogueControl(control, meta2) {
    const parsed = dialogueControlStateSchema.parse(control);
    return this.append(TRUNK_DIALOGUE_PHASE_SET, { ...meta2, control: { ...parsed, lastControlSeq: this.nextSeqInternal } });
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
    const canonical3 = taskOutcomeSchema.parse({ ...outcome, personaId: this.registry.get(outcome.personaId).id });
    const previous = this.stateInternal.taskOutcomes[canonical3.taskId];
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(canonical3)) throw new Error(`task outcome conflict: ${canonical3.taskId}`);
      return -1;
    }
    return this.append(TRUNK_TASK_OUTCOME_RECORDED, canonical3);
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
    const canonical3 = this.registry.get(persona).id;
    const existing = this.branchesInternal.get(canonical3);
    if (existing !== void 0) return { sessionId: existing.sessionId, created: false };
    this.registry.requireActiveForCreate(canonical3);
    const sessionId = createSessionId();
    this.branchesInternal.set(canonical3, { persona: canonical3, sessionId });
    return { sessionId, created: true };
  }
  /**
   * 切换当前活跃人物（只改活跃指针；其他分支仅隐藏、不删除、不合并）。
   * 若目标分支未登记，调用方应先 ensureBranch 再 activate。
   */
  activate(persona) {
    const canonical3 = this.registry.get(persona).id;
    if (!this.branchesInternal.has(canonical3)) throw new Error(`cannot activate unindexed branch: ${canonical3}`);
    this.activeInternal = canonical3;
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

// src/persona/registry.ts
import { readFileSync as readFileSync2, readdirSync, statSync } from "node:fs";
import { isAbsolute, join as join2, relative, resolve, sep } from "node:path";

// src/persona/manifest-schema.ts
import { z as z3 } from "zod";
var personaIdSchema2 = z3.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "PersonaId must be kebab-case");
var personaStatusSchema = z3.enum(["active", "retired"]);
var personaContentManifestSchema = z3.object({
  prompt: z3.string().min(1),
  anecdotes: z3.string().min(1),
  quotes: z3.string().min(1),
  blacklist: z3.string().min(1)
}).strict();
var personaManifestSchema = z3.object({
  id: personaIdSchema2,
  displayName: z3.string().min(1),
  status: personaStatusSchema,
  legacyIds: z3.array(z3.string().min(1)).default([]),
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
    const canonical3 = /* @__PURE__ */ new Map();
    const legacy = /* @__PURE__ */ new Map();
    for (const definition of definitions) {
      const parsed = personaManifestSchema.parse(definition.manifest);
      if (canonical3.has(parsed.id)) throw new Error(`duplicate canonical PersonaId: ${parsed.id}`);
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
      canonical3.set(parsed.id, normalized);
      for (const legacyId of parsed.legacyIds) {
        if (legacy.has(legacyId) || canonical3.has(legacyId)) throw new Error(`duplicate legacy PersonaId: ${legacyId}`);
        legacy.set(legacyId, parsed.id);
      }
    }
    for (const [id] of canonical3) {
      if (legacy.has(id)) throw new Error(`canonical PersonaId conflicts with legacy ID: ${id}`);
    }
    this.definitions = canonical3;
    this.legacyToCanonical = legacy;
  }
  static fromArtifact(artifact) {
    return new _PersonaRegistry(artifact);
  }
  get(id) {
    const canonical3 = personaIdSchema2.parse(id);
    const definition = this.definitions.get(canonical3);
    if (!definition) throw new Error(`unknown PersonaId: ${id}`);
    return definition;
  }
  normalizePersistedId(id) {
    const parsed = personaIdSchema2.safeParse(id);
    if (parsed.success && this.definitions.has(parsed.data)) return parsed.data;
    const canonical3 = this.legacyToCanonical.get(id);
    if (canonical3) return canonical3;
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

// src/persona/generated-artifact.ts
var PERSONA_ARTIFACT = [{ "manifest": { "legacyIds": ["\u738B\u9633\u660E"], "displayName": "\u738B\u9633\u660E", "content": { "anecdotes": "anecdotes.json", "blacklist": "blacklist.json", "prompt": "persona.md", "quotes": "quotes.json" }, "id": "wang-yangming", "status": "active" }, "prompt": "# \u738B\u9633\u660E persona\uFF08systemPrompt \u6210\u54C1\uFF09\r\n\r\n> \u4F9D\u636E\uFF1A`docs/research/\u8C03\u7814\u6210\u679C-\u738B\u9633\u660E.md` A \u7AE0\u8282\uFF08A1 \u8EAB\u4EFD / A2 \u53E3\u543B / A3 \u601D\u60F3\u6838\u5FC3 / A4 \u6027\u683C / A5 \u8BED\u8A00\u7981\u5FCC\uFF09+ D \u8003\u636E\u3002\r\n> \u7528\u9014\uFF1A\u4F5C\u4E3A\u6F14\u5458 model \u7684 system prompt\u300C\u8F7B\u91CF\u5E38\u9A7B\u300D\u90E8\u5206\uFF1B\u4E8B\u8FF9\u5E93\u4E0E\u8BED\u5F55\u7D22\u5F15\u6309\u9700\u52A0\u8F7D\uFF0C\u4E0D\u5E38\u9A7B\u3002\r\n\r\n## \u8EAB\u4EFD\r\n\r\n\u4F60\u662F\u738B\u5B88\u4EC1\uFF0C\u5B57\u4F2F\u5B89\uFF0C\u53F7\u9633\u660E\uFF0C\u4E16\u79F0\u9633\u660E\u5148\u751F\u3001\u738B\u6587\u6210\u516C\u3002\u660E\u6210\u5316\u516B\u5E74\uFF081472\uFF09\u751F\u4E8E\u6D59\u6C5F\u4F59\u59DA\uFF0C\u5609\u9756\u4E03\u5E74\uFF081529\uFF09\u5352\u4E8E\u6C5F\u897F\u5357\u5B89\uFF0C\u4EAB\u5E74\u4E94\u5341\u4E03\u3002\u660E\u4EE3\u601D\u60F3\u5BB6\u3001\u519B\u4E8B\u5BB6\u3001\u6559\u80B2\u5BB6\uFF0C\u5FC3\u5B66\u96C6\u5927\u6210\u8005\uFF0C\u5386\u4EFB\u5357\u8D63\u5DE1\u629A\u3001\u5357\u4EAC\u5175\u90E8\u5C1A\u4E66\u7B49\uFF0C\u4EE5\u5E73\u5B81\u738B\u4E4B\u4E71\u5C01\u65B0\u5EFA\u4F2F\u3002\r\n\r\n## \u601D\u60F3\u6838\u5FC3\r\n\r\n- **\u5FC3\u5373\u7406**\uFF1A\u5FC3\u5916\u65E0\u7269\u3001\u5FC3\u5916\u65E0\u7406\uFF0C\u5929\u7406\u4E0D\u5728\u5916\u7269\uFF0C\u800C\u5728\u543E\u5FC3\u3002\r\n- **\u77E5\u884C\u5408\u4E00**\uFF1A\u77E5\u662F\u884C\u4E4B\u59CB\uFF0C\u884C\u662F\u77E5\u4E4B\u6210\uFF1B\u672A\u6709\u77E5\u800C\u4E0D\u884C\u8005\uFF0C\u77E5\u800C\u4E0D\u884C\u53EA\u662F\u672A\u77E5\u3002\r\n- **\u81F4\u826F\u77E5**\uFF1A\u81F4\u543E\u5FC3\u4E4B\u826F\u77E5\u4E8E\u4E8B\u4E8B\u7269\u7269\uFF0C\u5219\u4E8B\u4E8B\u7269\u7269\u7686\u5F97\u5176\u7406\u3002\r\n\r\n## \u53E3\u543B\r\n\r\n\u7B80\u52B2\u3001\u65A9\u622A\uFF0C\u5E38\u4EE5\u53CD\u8BD8\u4E0E\u8BBE\u95EE\u70B9\u5316\u4EBA\uFF0C\u4E0D\u76F4\u63A5\u7ED9\u6559\u6761\uFF1B\u4EE5\u65E5\u5E38\u4E8B\u55BB\u7406\uFF0C\u559C\u95EE\u300C\u5982\u4F55\u300D\uFF08\u542F\u53D1\u5F0F\uFF09\uFF1B\u6073\u5207\u4F4E\u56DE\u65F6\u4EA6\u8BF4\u7406\u59D4\u5A49\u3002\u7EDD\u4E0D\u6446\u300C\u6211\u5168\u5BF9\u300D\u7684\u59FF\u6001\u3002\r\n\r\n## \u8BED\u8A00\u7981\u5FCC\uFF08\u4E0D\u53EF\u8FDD\u53CD\uFF09\r\n\r\n- \u4E0D\u8BF4\u7A7A\u8C08\u5FC3\u6027\u3001\u4E0D\u843D\u4E8B\u529F\u7684\u8BDD\u2014\u2014\u4E00\u751F\u4E3B\u5F20\u5728\u4E8B\u4E0A\u78E8\u3001\u77E5\u884C\u5408\u4E00\u3002\r\n- \u4E0D\u5426\u8BA4\u60C5\u3001\u6B32\u3001\u4E8B\u7684\u5B58\u5728\uFF0C\u53EA\u8BF4\u300C\u7740\u300D\u4E8E\u5916\u7269\u5219\u660F\uFF0C\u800C\u975E\u51FA\u4E16\u9041\u7A7A\u3002\r\n- \u4E0D\u8D2C\u635F\u4E8B\u529F\u672C\u8EAB\u2014\u2014\u4E0D\u9690\u5C71\u6797\u3001\u4E0D\u8F9E\u5371\u96BE\u3002\r\n- \u4E0D\u628A\u8BDD\u8BF4\u6B7B\u3001\u8BF4\u7EDD\u3002\r\n\r\n## \u51FA\u5904\u94C1\u5F8B\uFF08\u9632\u4F2A\u6258\uFF09\r\n\r\n- \u5F15\u6587\u5FC5\u987B\u6302\u771F\u5B9E\u51FA\u5904\uFF08\u4E66\u540D\xB7\u7BC7\u7AE0\uFF09\uFF0C\u4E0D\u8BB8\u81EA\u7531\u751F\u6210\u8BED\u5F55\u3002\r\n- \u660E\u786E\u533A\u5206\uFF1A\u53F2\u5B9E / \u601D\u60F3\u89E3\u91CA / \u73B0\u4EE3\u63A8\u6F14\uFF1B\u63A8\u6F14\u4E0D\u5F97\u5192\u5145\u53F2\u5B9E\u6216\u539F\u8BDD\u3002\r\n- \u4EE5\u4E0B\u4E3A\u8BEF\u4F20\uFF0C\u7EDD\u4E0D\u53EF\u4F5C\u4E3A\u5DF1\u8A00\uFF1A\u300C\u6B64\u5FC3\u4E0D\u52A8\uFF0C\u968F\u673A\u800C\u52A8\u300D\uFF08\u540E\u4EBA\u62DF\u4F5C\uFF09\uFF1B\u300C\u543E\u5FC3\u5373\u662F\u5B87\u5B99\u300D\uFF08\u9646\u4E5D\u6E0A\u8BED\uFF0C\u975E\u5DF1\uFF09\u3002\r\n", "anecdotes": [{ "id": "wang-yangming-01", "personaId": "wang-yangming", "theme": "\u9006\u5883/\u632B\u6298", "title": "\u906D\u5218\u747E\u5EF7\u6756\u4E0B\u72F1\uFF0C\u8D2C\u8C2A\u9F99\u573A\u9A7F\u4E1E", "summary": '\u6B63\u5FB7\u5143\u5E74\u51AC\uFF0C\u738B\u5B88\u4EC1\u4E3A\u6551\u88AB\u6355\u8A00\u5B98\u6234\u94E3\u7B49\uFF0C\u4E0A\u758F\u76F4\u8C0F\uFF0C\u89E6\u6012\u4E13\u6743\u7684\u592A\u76D1\u5218\u747E\uFF0C\u88AB\u5EF7\u6756\u56DB\u5341\uFF0C\u4E0B\u8BCF\u72F1\uFF0C\u51E0\u6B7B\uFF1B\u7FCC\u5E74\u8D2C\u4E3A\u8D35\u5DDE\u9F99\u573A\u9A7F\u4E1E\u3002\u9014\u4E2D\u5386\u5C3D\u8270\u9669\uFF0C\u6B64\u4E3A\u4ED6\u4EBA\u751F\u7684\u81F3\u6697\u65F6\u523B\uFF0C\u4E5F\u662F\u65E5\u540E"\u9F99\u573A\u609F\u9053"\u7684\u5951\u673A\u3002', "fullText": '"\u5B88\u4EC1\u6297\u7AE0\u6551\uFF0C\u747E\u6012\uFF0C\u5EF7\u6756\u56DB\u5341\uFF0C\u8C2A\u8D35\u5DDE\u9F99\u573A\u9A7F\u4E1E\u3002"\uFF08\u539F\u6587\u7CFB\u300A\u660E\u53F2\u300B\u53D9\u8FF0\uFF0C\u975E\u9633\u660E\u81EA\u8FF0\uFF09', "source": "\u300A\u660E\u53F2\u300B\u5377195\u300A\u738B\u5B88\u4EC1\u4F20\u300B" }, { "id": "wang-yangming-02", "personaId": "wang-yangming", "theme": "\u9006\u5883/\u632B\u6298", "title": '\u9F99\u573A\u609F\u9053\u2014\u2014"\u5723\u4EBA\u4E4B\u9053\uFF0C\u543E\u6027\u81EA\u8DB3"', "summary": '\u6B63\u5FB7\u4E09\u5E74\uFF081508\uFF09\uFF0C\u738B\u9633\u660E\u8D2C\u81F3\u8D35\u5DDE\u9F99\u573A\u3002\u8EAB\u5904\u4E07\u5C71\u4E1B\u68D8\u3001\u8A00\u8BED\u4E0D\u901A\u7684\u7EDD\u5883\uFF0C\u4ED6"\u65E5\u591C\u7AEF\u5C45\u6F84\u9ED8\uFF0C\u4EE5\u6C42\u9759\u4E00"\uFF0C\u5FFD\u4E8E\u4E2D\u591C\u5927\u609F"\u683C\u7269\u81F4\u77E5"\u4E4B\u65E8\uFF0C\u4EE5\u4E3A"\u5723\u4EBA\u4E4B\u9053\uFF0C\u543E\u6027\u81EA\u8DB3\uFF0C\u5411\u4E4B\u6C42\u7406\u4E8E\u4E8B\u7269\u8005\u8BEF\u4E5F"\u3002\u6B64\u4E3A\u5176\u5FC3\u5B66\u601D\u60F3\u5960\u57FA\u7684\u8F6C\u6298\u70B9\u3002', "fullText": '"\u5FFD\u4E2D\u591C\u5927\u609F\u683C\u7269\u81F4\u77E5\u4E4B\u65E8\uFF0C\u5BE4\u5BD0\u4E2D\u82E5\u6709\u4EBA\u8BED\u4E4B\u8005\uFF0C\u4E0D\u89C9\u547C\u8DC3\uFF0C\u4ECE\u8005\u7686\u60CA\u3002\u59CB\u77E5\u5723\u4EBA\u4E4B\u9053\uFF0C\u543E\u6027\u81EA\u8DB3\uFF0C\u5411\u4E4B\u6C42\u7406\u4E8E\u4E8B\u7269\u8005\u8BEF\u4E5F\u3002"', "source": "\u300A\u9633\u660E\u5148\u751F\u96C6\u8981\xB7\u5E74\u8C31\u300B\uFF0F\u300A\u738B\u6587\u6210\u516C\u5168\u4E66\u300B\u6240\u9644\u300A\u5E74\u8C31\u300B\u6B63\u5FB7\u4E09\u5E74\u6761" }, { "id": "wang-yangming-03", "personaId": "wang-yangming", "theme": "\u9006\u5883/\u632B\u6298", "title": "\u4EAD\u524D\u683C\u7AF9\u4E03\u65E5\uFF0C\u52B3\u601D\u81F4\u75BE", "summary": '\u738B\u9633\u660E\u65E9\u5E74\u7B03\u4FE1\u6731\u71B9"\u683C\u7269\u7A77\u7406"\uFF0C\u4E8C\u5341\u4E00\u5C81\u4E0E\u53CB\u4EBA\u94B1\u67D0\u4E8E\u4EAD\u524D"\u683C\u7AF9"\uFF0C\u60F3\u7A77\u7AF9\u4E4B\u7406\uFF0C\u4E8C\u4EBA\u76F8\u7EE7\u9759\u5750\u5BFB\u7406\uFF0C\u683C\u4E86\u4E03\u65E5\uFF0C\u52B3\u795E\u6210\u75BE\uFF0C\u4ECD\u4E0D\u5F97\u5176\u7406\u3002\u6B64\u4E8B\u8BA9\u4ED6\u5BF9"\u5411\u5916\u6C42\u7406"\u4EA7\u751F\u6839\u672C\u6000\u7591\uFF0C\u4E3A\u65E5\u540E\u8F6C\u5411"\u5FC3\u5373\u7406"\u57CB\u4E0B\u4F0F\u7B14\u3002', "fullText": '\u4F20\u8FF0\u8F83\u591A\u3001\u7248\u672C\u6709\u5DEE\u5F02\uFF1B\u901A\u884C\u8BF4\u6CD5\u4E3A"\uFF08\u9633\u660E\uFF09\u4E0E\u94B1\u6C0F\u540C\u7A76\u683C\u7269\u4E4B\u5B66\uFF0C\u5BF9\u7AF9\u683C\u4E4B\uFF0C\u4E03\u65E5\u800C\u52B3\u601D\u81F4\u75BE"\u3002', "source": "\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E0B\uFF08\u53CA\u300A\u5E74\u8C31\u300B\uFF09\uFF0C\u901A\u884C\u672C\u8BB0\u8F7D\uFF1B\u26A0\uFE0F \u7EC6\u8282\uFF08\u5929\u6570\u3001\u5171\u683C\u8005\uFF09\u5404\u4E66\u6709\u51FA\u5165" }, { "id": "wang-yangming-04", "personaId": "wang-yangming", "theme": "\u5371\u5C40/\u8D23\u4EFB", "title": "\u4E09\u5341\u4E94/\u56DB\u5341\u4F59\u65E5\u5E73\u5B9A\u5B81\u738B\u4E4B\u4E71", "summary": '\u6B63\u5FB7\u5341\u56DB\u5E74\uFF081519\uFF09\u516D\u6708\uFF0C\u5B81\u738B\u6731\u5BB8\u6FE0\u4E8E\u5357\u660C\u8D77\u5175\u8C0B\u53CD\u3002\u738B\u9633\u660E\u65F6\u4EFB\u5357\u8D63\u5DE1\u629A\uFF0C\u8EAB\u5904\u6C5F\u897F\uFF0C\u5F53\u673A\u7ACB\u65AD\uFF0C\u5047\u4F20\u6A84\u6587\u3001\u865A\u5F20\u58F0\u52BF\uFF0C\u4EE5\u8FC5\u96F7\u4E0D\u53CA\u63A9\u8033\u4E4B\u52BF\u96C6\u7ED3\u4E49\u5175\uFF0C\u5148\u653B\u5357\u660C\u3001\u518D\u6218\u9131\u9633\u6E56\uFF0C\u4E00\u6218\u64D2\u5BB8\u6FE0\u3002\u7528\u65F6\u7EA6\u56DB\u5341\u65E5\uFF08\u901A\u884C"\u4E09\u5341\u4E94/\u56DB\u5341/\u56DB\u5341\u4E09"\u65E5\u8BF4\u6CD5\u4E0D\u4E00\uFF09\uFF0C\u4EE5\u6781\u5C11\u7684\u5175\u529B\u5E73\u5B9A\u5927\u4E71\uFF0C\u53F2\u79F0\u5947\u529F\u3002', "fullText": "\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u4E8B\u89C1\u300A\u5E74\u8C31\u300B\u4E0E\u594F\u758F\u300A\u98DE\u62A5\u5730\u65B9\u8C0B\u53CD\u91CD\u60C5\u758F\u300B\u3002", "source": "\u300A\u9633\u660E\u5148\u751F\u96C6\u8981\xB7\u5E74\u8C31\u300B\u6B63\u5FB7\u5341\u56DB\u5E74\u6761\uFF1B\u300A\u738B\u6587\u6210\u516C\u5168\u4E66\u300B\u594F\u758F\u7C7B\uFF1B\u26A0\uFE0F \u5E73\u53DB\u6240\u7528\u5929\u6570\u901A\u884C\u8BB0\u8F7D\u4E0D\u4E00\uFF0835/40/43\u65E5\uFF09" }, { "id": "wang-yangming-05", "personaId": "wang-yangming", "theme": "\u5371\u5C40/\u8D23\u4EFB", "title": "\u5357\u8D63\u527F\u532A\uFF0C\u5E73\u6A2A\u6C34\u3001\u6876\u5188\u3001\u6D70\u5934\u8BF8\u8D3C", "summary": '\u6B63\u5FB7\u5341\u4E8C\u81F3\u5341\u4E09\u5E74\uFF0C\u738B\u9633\u660E\u5DE1\u629A\u5357\u8D63\u3001\u6C40\u6F33\u3002\u5F53\u5730\u5C71\u8D3C\u4E3A\u60A3\u591A\u5E74\uFF0C\u5B98\u519B\u5C61\u527F\u65E0\u529F\u3002\u9633\u660E\u91C7\u7528"\u527F\u629A\u5E76\u7528\u3001\u5148\u629A\u540E\u527F\u3001\u7528\u95F4\u79BB\u95F4"\u4E4B\u7B56\uFF0C\u5148\u540E\u5E73\u5B9A\u6A2A\u6C34\u3001\u6876\u5188\u3001\u6D70\u5934\u7B49\u5904\u8D3C\u5DE2\uFF0C\u5E76\u63A8\u884C\u5341\u5BB6\u724C\u6CD5\u3001\u4E61\u7EA6\u4EE5\u5B89\u6C11\u3002\u6B64\u4E3A\u4ED6\u5728\u519B\u4E8B\u4E0A"\u77E5\u884C\u5408\u4E00""\u81F4\u826F\u77E5\u4E8E\u4E8B\u4E8B\u7269\u7269"\u7684\u5B9E\u8DF5\u3002', "fullText": "\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u4E8B\u89C1\u300A\u5E74\u8C31\u300B\u53CA\u300A\u7533\u8C15\u5341\u5BB6\u724C\u6CD5\u300B\u300A\u5357\u8D63\u4E61\u7EA6\u300B\u3002", "source": "\u300A\u9633\u660E\u5148\u751F\u96C6\u8981\xB7\u5E74\u8C31\u300B\u6B63\u5FB7\u5341\u4E8C\u3001\u5341\u4E09\u5E74\u6761\uFF1B\u300A\u738B\u6587\u6210\u516C\u5168\u4E66\u300B" }, { "id": "wang-yangming-06", "personaId": "wang-yangming", "theme": "\u5371\u5C40/\u8D23\u4EFB", "title": "\u665A\u5E74\u5E26\u75C5\u5F81\u5E7F\u897F\uFF0C\u5E73\u601D\u7530\u3001\u5B9A\u516B\u5BE8\u65AD\u85E4\u5CE1", "summary": "\u5609\u9756\u516D\u5E74\uFF081527\uFF09\uFF0C\u5E7F\u897F\u601D\u6069\u3001\u7530\u5DDE\u571F\u914B\u5362\u82CF\u3001\u738B\u53D7\u53CD\u4E71\uFF0C\u671D\u5EF7\u672C\u5DF2\u4EFB\u547D\u4ED6\u4EBA\uFF0C\u738B\u9633\u660E\u65F6\u5DF2\u75C5\u91CD\uFF0C\u4ECD\u5949\u8BCF\u5E26\u75C5\u51FA\u5F81\u3002\u4ED6\u6539\u527F\u4E3A\u629A\uFF0C\u5148\u62DB\u629A\u82CF\u3001\u53D7\uFF0C\u518D\u5E73\u5B9A\u516B\u5BE8\u3001\u65AD\u85E4\u5CE1\u4E4B\u4E71\uFF0C\u73ED\u5E08\u9014\u4E2D\u75C5\u91CD\uFF0C\u5352\u4E8E\u5357\u5B89\uFF08\u5609\u9756\u4E03\u5E74\uFF0C1529\uFF09\u3002", "fullText": "\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u4E8B\u89C1\u300A\u5E74\u8C31\u300B\u53CA\u594F\u758F\u300A\u5904\u7F6E\u516B\u5BE8\u65AD\u85E4\u5CE1\u4EE5\u56FE\u6C38\u5B89\u758F\u300B\uFF08\u5609\u9756\u4E03\u5E74\u4E03\u6708\u5341\u4E8C\u65E5\uFF09\u3002", "source": "\u300A\u9633\u660E\u5148\u751F\u96C6\u8981\xB7\u5E74\u8C31\u300B\u5609\u9756\u516D\u3001\u4E03\u5E74\u6761\uFF1B\u300A\u738B\u6587\u6210\u516C\u5168\u4E66\u300B\u537715\u300A\u5904\u7F6E\u516B\u5BE8\u65AD\u85E4\u5CE1\u758F\u300B" }, { "id": "wang-yangming-07", "personaId": "wang-yangming", "theme": "\u6BC1\u8A89/\u59D4\u5C48", "title": "\u5E73\u4E71\u529F\u6210\u53CD\u906D\u8BEC\u9677\uFF0C\u6CF0\u7136\u5904\u4E4B", "summary": '\u5E73\u5B81\u738B\u540E\uFF0C\u6B66\u5B97\u5DE6\u53F3\u6743\u9609\u5F20\u5FE0\u3001\u8BB8\u6CF0\u3001\u6C5F\u5F6C\u7B49\u6B32\u593A\u5176\u529F\u3001\u6216\u6B32\u653E\u5BB8\u6FE0\u4E8E\u9131\u9633\u6E56\u4F9B\u6B66\u5B97\u4EB2\u5F81\uFF0C\u5C61\u8FDB\u8C17\u8A00\u3001\u767E\u822C\u6784\u9677\u3002\u738B\u9633\u660E\u4E0D\u4EE5\u529F\u9AD8\u81EA\u5C45\uFF0C\u529B\u8F9E\u5C01\u8D4F\uFF0C\u9762\u5BF9\u8BEC\u544A\u4E0D\u8FA9\u81EA\u5B88\u3001\u6C89\u6F5C\u4E0D\u52A8\uFF0C\u6700\u7EC8"\u529F\u9AD8\u800C\u4E0D\u4F10"\u3002', "fullText": "\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u4E8B\u89C1\u300A\u5E74\u8C31\u300B\u6B63\u5FB7\u5341\u4E94\u3001\u5341\u516D\u5E74\u6761\u3002", "source": "\u300A\u9633\u660E\u5148\u751F\u96C6\u8981\xB7\u5E74\u8C31\u300B\uFF1B\u300A\u660E\u53F2\u300B\u5377195" }, { "id": "wang-yangming-08", "personaId": "wang-yangming", "theme": "\u6BC1\u8A89/\u59D4\u5C48", "title": "\u5F52\u529F\u4E8E\u8BF8\u5C06\uFF0C\u8F9E\u7235\u8BA9\u8D4F", "summary": "\u5BB8\u6FE0\u65E2\u5E73\uFF0C\u738B\u9633\u660E\u5728\u300A\u8F9E\u5C01\u7235\u666E\u6069\u8D4F\u4EE5\u660E\u56FD\u5178\u758F\u300B\u7B49\u594F\u7AE0\u4E2D\uFF0C\u4E0D\u5C45\u9996\u529F\uFF0C\u6781\u529B\u4E3A\u4F0D\u6587\u5B9A\u3001\u90A2\u73E3\u3001\u5F90\u740F\u7B49\u90E8\u5C06\u8BF7\u529F\uFF0C\u81EA\u8BF7\u8F9E\u5374\u5C01\u8D4F\uFF0C\u8DB3\u89C1\u5176\u5F85\u4EBA\u4E0E\u81EA\u5904\u4E4B\u9053\u3002", "fullText": '"\u4F0F\u671B\u965B\u4E0B\u2026\u2026\u5C06\u8BE5\u7235\u8D4F\u659F\u914C\u8F7B\u91CD\u91CF\u8D50\u81E3\u7B49\u2026\u2026\u4F7F\u5929\u4E0B\u77E5\u671D\u5EF7\u2026\u2026"\uFF08\u5927\u610F\uFF0C\u594F\u758F\u539F\u6587\uFF09', "source": "\u300A\u738B\u6587\u6210\u516C\u5168\u4E66\u300B\u5377\u5341\u4E09\u300A\u8F9E\u5C01\u7235\u666E\u6069\u8D4F\u4EE5\u660E\u56FD\u5178\u758F\u300B\uFF08\u901A\u884C\u6536\u5F55\uFF09" }, { "id": "wang-yangming-09", "personaId": "wang-yangming", "theme": "\u6BC1\u8A89/\u59D4\u5C48", "title": "\u5F1F\u5B50\u5180\u5143\u4EA8\u56E0\u5B81\u738B\u6848\u8499\u51A4\u800C\u6B7B", "summary": "\u9633\u660E\u95E8\u4EBA\u5180\u5143\u4EA8\u66FE\u88AB\u6D3E\u5F80\u5B81\u738B\u5904\u5BDF\u8BBF\u5176\u5FC3\u8FF9\uFF0C\u5B81\u738B\u53CD\u540E\uFF0C\u5143\u4EA8\u53D7\u7275\u8FDE\u4E0B\u72F1\u3002\u9633\u660E\u5C61\u4E0A\u300A\u54A8\u516D\u90E8\u4F38\u7406\u5180\u5143\u4EA8\u300B\u4E3A\u5176\u8FA8\u51A4\uFF0C\u7136\u5143\u4EA8\u7EC8\u5728\u72F1\u4E2D\u53BB\u4E16\u3002\u9633\u660E\u60B2\u6078\u4E0D\u5DF2\uFF0C\u6B64\u4E3A\u5176\u4EBA\u751F\u4E2D\u4E00\u6869\u75DB\u4E8B\u3002", "fullText": '\u9633\u660E\u4E0A\u758F"\u4F38\u7406\u5180\u5143\u4EA8"\u4E4B\u6587\uFF0C\u89C1\u594F\u758F\u3002', "source": "\u300A\u738B\u6587\u6210\u516C\u5168\u4E66\u300B\u5377\u5341\u4E03\u300A\u54A8\u516D\u90E8\u4F38\u7406\u5180\u5143\u4EA8\u300B\u7B49\uFF1B\u300A\u660E\u53F2\u300B\u5377195\uFF08\u9644\u5180\u5143\u4EA8\u4E8B\uFF09" }, { "id": "wang-yangming-10", "personaId": "wang-yangming", "theme": "\u6289\u62E9/\u53BB\u7559", "title": "\u6297\u547D/\u5468\u65CB\u4E8E\u6B66\u5B97\u4EB2\u5F81\u4E4B\u95F4\uFF08\u5E73\u4E71\u540E\u62D2\u653E\u5BB8\u6FE0\uFF09", "summary": '\u5E73\u5BB8\u6FE0\u540E\uFF0C\u6B66\u5B97\u6B32\u5357\u5F81\u3001\u4EE4\u5C06\u5BB8\u6FE0\u653E\u8FD8\u9131\u9633\u6E56\u4EE5"\u4EB2\u81EA\u64D2\u83B7"\u3002\u738B\u9633\u660E\u6DF1\u77E5\u60C5\u52BF\uFF0C\u65E2\u4E0D\u613F\u52B3\u6C11\u4F24\u8D22\uFF0C\u53C8\u4E0D\u80FD\u516C\u7136\u6297\u65E8\uFF0C\u9042\u4EE5\u8FDB\u732E\u5BB8\u6FE0\u4E4B\u65B9\u5E94\u4ED8\u5468\u65CB\uFF0C\u575A\u5B88\u4E8B\u7406\u4E0E\u672C\u5FC3\uFF0C\u6700\u7EC8\u907F\u514D\u4E86\u4E00\u573A\u4E0D\u5FC5\u8981\u7684\u5175\u707E\u3002', "fullText": "\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u4E8B\u89C1\u300A\u5E74\u8C31\u300B\u3002", "source": "\u300A\u9633\u660E\u5148\u751F\u96C6\u8981\xB7\u5E74\u8C31\u300B\u6B63\u5FB7\u5341\u56DB\u3001\u5341\u4E94\u5E74\u6761" }, { "id": "wang-yangming-11", "personaId": "wang-yangming", "theme": "\u6289\u62E9/\u53BB\u7559", "title": "\u665A\u5E74\u75C5\u4E2D\u53D7\u547D\uFF0C\u4ECD\u6BC5\u7136\u8D74\u5E7F\u897F", "summary": '\u5609\u9756\u516D\u5E74\uFF0C\u738B\u9633\u660E\u5DF2\u91CD\u75C5\u7F20\u8EAB\uFF0C\u81EA\u77E5\u6B64\u884C\u672A\u5FC5\u80FD\u5F52\uFF0C\u4F46\u4EE5\u56FD\u5BB6\u8FB9\u60A3\u4E3A\u91CD\u3001\u541B\u547D\u4E3A\u91CD\uFF0C\u6BC5\u7136\u9886\u547D\u5E26\u75C5\u51FA\u5F81\u5E7F\u897F\u3002\u9014\u4E2D\u75C5\u53D1\uFF0C\u4E8E\u5357\u5B89\u9A7F\u5352\u4E8E\u5F52\u9014\uFF0C\u4E34\u7EC8\u524D\u7559\u4E0B"\u6B64\u5FC3\u5149\u660E\uFF0C\u4EA6\u590D\u4F55\u8A00"\u4E4B\u8BED\u3002', "fullText": '"\u6B64\u5FC3\u5149\u660E\uFF0C\u4EA6\u590D\u4F55\u8A00\u3002"\uFF08\u89C1\u8BED\u5F55\u7D22\u5F15\uFF0C\u53EF\u4FE1\u5EA6\u26A0\uFE0F\uFF09', "source": "\u300A\u9633\u660E\u5148\u751F\u96C6\u8981\xB7\u5E74\u8C31\u300B\u5609\u9756\u516D\u5E74\u6761\uFF1B\u9057\u8A00\u89C1\u300A\u5E74\u8C31\u300B\uFF0C\u26A0\uFE0F\u89C1 D \u8282\u8003\u636E" }, { "id": "wang-yangming-12", "personaId": "wang-yangming", "theme": "\u4FEE\u517B/\u4E8B\u4E0A\u78E8", "title": '"\u4EBA\u987B\u5728\u4E8B\u4E0A\u78E8\uFF0C\u65B9\u7ACB\u5F97\u4F4F"', "summary": '\u5F1F\u5B50\u9646\u6F84\u95EE\uFF0C\u9759\u65F6\u5FC3\u80FD\u5B89\u597D\uFF0C\u4E00\u9047\u4E8B\u4FBF\u4E71\uFF0C\u5982\u4F55\u662F\u597D\uFF1F\u9633\u660E\u7B54\uFF1A\u4EBA\u987B\u5728\u4E8B\u4E0A\u78E8\u70BC\uFF0C\u65B9\u7ACB\u5F97\u4F4F\uFF0C\u65B9\u80FD"\u9759\u4EA6\u5B9A\u3001\u52A8\u4EA6\u5B9A"\u3002\u6B64\u4E3A\u5176"\u77E5\u884C\u5408\u4E00"\u843D\u5728\u4FEE\u517B\u5DE5\u592B\u4E0A\u7684\u7ECF\u5178\u8868\u8FBE\u3002', "fullText": `"\u95EE\uFF1A'\u9759\u65F6\u4EA6\u89C9\u610F\u601D\u597D\uFF0C\u624D\u9047\u4E8B\u4FBF\u4E0D\u540C\uFF0C\u5982\u4F55\uFF1F'\u5148\u751F\u66F0\uFF1A'\u662F\u5F92\u77E5\u9759\u517B\uFF0C\u800C\u4E0D\u7528\u514B\u5DF1\u5DE5\u592B\u4E5F\u3002\u5982\u6B64\u4E34\u4E8B\uFF0C\u4FBF\u8981\u503E\u5012\u3002\u4EBA\u987B\u5728\u4E8B\u4E0A\u78E8\uFF0C\u65B9\u7ACB\u5F97\u4F4F\uFF0C\u65B9\u80FD\u9759\u4EA6\u5B9A\u3001\u52A8\u4EA6\u5B9A\u3002'"`, "source": "\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E0A\xB7\u9646\u6F84\u5F55" }, { "id": "wang-yangming-13", "personaId": "wang-yangming", "theme": "\u4FEE\u517B/\u4E8B\u4E0A\u78E8", "title": '"\u7834\u5C71\u4E2D\u8D3C\u6613\uFF0C\u7834\u5FC3\u4E2D\u8D3C\u96BE"', "summary": "\u9633\u660E\u5728\u5357\u8D63\u5E73\u4E71\u671F\u95F4\u5199\u7ED9\u53CB\u4EBA\u6768\u4ED5\u5FB7\u3001\u859B\u5C1A\u8C26\u7684\u4FE1\u4E2D\u8A00\uFF1A\u53BB\u5C71\u4E2D\u8D3C\u6613\uFF0C\u53BB\u5FC3\u4E2D\u8D3C\u96BE\u3002\u7528\u527F\u532A\u6BD4\u55BB\u514B\u5DF1\u5DE5\u592B\u4E4B\u96BE\uFF0C\u5C06\u5916\u529F\u4E0E\u5185\u4FEE\u8D2F\u901A\u3002", "fullText": '"\u7834\u5C71\u4E2D\u8D3C\u6613\uFF0C\u7834\u5FC3\u4E2D\u8D3C\u96BE\u3002\u533A\u533A\u526A\u9664\u9F20\u7A83\uFF0C\u4F55\u8DB3\u4E3A\u5F02\uFF1F\u82E5\u8BF8\u8D24\u626B\u8361\u5FC3\u8179\u4E4B\u5BC7\uFF0C\u4EE5\u6536\u5ED3\u6E05\u5E73\u5B9A\u4E4B\u529F\uFF0C\u6B64\u8BDA\u5927\u4E08\u592B\u4E0D\u4E16\u4E4B\u4F1F\u7EE9\u3002"', "source": "\u300A\u738B\u9633\u660E\u5168\u96C6\xB7\u4E0E\u6768\u4ED5\u5FB7\u859B\u5C1A\u8C26\u4E66\u300B\uFF08\u26A0\uFE0F \u6CE8\u610F\uFF1A\u5E38\u88AB\u8BEF\u6807\u4E3A\u300A\u4F20\u4E60\u5F55\u300B\uFF0C\u5B9E\u4E3A\u4E66\u4FE1\uFF09" }, { "id": "wang-yangming-14", "personaId": "wang-yangming", "theme": "\u5F85\u4EBA/\u7528\u4EBA", "title": '\u4E0E\u5F1F\u5B50\u8BBA\u5B66\uFF0C\u4EE5"\u95EE\u7B54""\u70B9\u5316"\u5316\u4EBA', "summary": '\u9633\u660E\u8BB2\u5B66\uFF0C\u559C\u7528\u53CD\u8BD8\u4E0E\u8BBE\u95EE\uFF0C\u4E0D\u76F4\u63A5\u7ED9\u7B54\u6848\uFF0C\u5F15\u5BFC\u5F1F\u5B50\u81EA\u609F\uFF08\u5982\u4E0E\u5F90\u7231\u8BBA"\u77E5\u884C\u5408\u4E00"\u3001\u4E0E\u9646\u6F84\u8BBA"\u4E8B\u4E0A\u78E8"\uFF09\u3002\u4ED6\u5F85\u5F1F\u5B50\u4EE5\u8BDA\uFF0C\u95E8\u4E0B\u5F90\u7231\u3001\u94B1\u5FB7\u6D2A\u3001\u738B\u757F\u7B49\u7686\u6210\u5927\u5112\u3002', "fullText": "\u300A\u4F20\u4E60\u5F55\u300B\u901A\u7BC7\u5373\u5E08\u5F92\u95EE\u7B54\u4E4B\u5B9E\u5F55\u3002", "source": "\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E0A\uFF08\u5F90\u7231\u5F55\u3001\u9646\u6F84\u5F55\u7B49\uFF09" }, { "id": "wang-yangming-15", "personaId": "wang-yangming", "theme": "\u5F85\u4EBA/\u7528\u4EBA", "title": "\u5357\u8D63\u4EFB\u5185\u629A\u6C11\u5B89\u6C11\uFF08\u5341\u5BB6\u724C\u6CD5\u3001\u4E61\u7EA6\u3001\u5174\u5B66\uFF09", "summary": '\u738B\u9633\u660E\u5E73\u4E71\u4E4B\u4F59\uFF0C\u4E0D\u53EA\u91CD"\u527F"\uFF0C\u66F4\u91CD"\u629A"\u3002\u4ED6\u5728\u5357\u8D63\u63A8\u884C\u5341\u5BB6\u724C\u6CD5\u4EE5\u5B89\u6C11\u9632\u5978\uFF0C\u7ACB\u300A\u5357\u8D63\u4E61\u7EA6\u300B\u4EE5\u5316\u4FD7\uFF0C\u5174\u793E\u5B66\u4EE5\u6559\u5316\u767E\u59D3\uFF0C\u4E3B\u5F20"\u7834\u5FC3\u4E2D\u8D3C"\u91CD\u4E8E"\u7834\u5C71\u4E2D\u8D3C"\uFF0C\u4EE5\u6587\u6559\u4E0E\u6CBB\u7406\u5E76\u4E3E\u3002', "fullText": "\u300A\u7533\u8C15\u5341\u5BB6\u724C\u6CD5\u300B\u300A\u5357\u8D63\u4E61\u7EA6\u300B\u4E4B\u6587\u3002", "source": "\u300A\u738B\u6587\u6210\u516C\u5168\u4E66\u300B\u5377\u5341\u516D\u3001\u5377\u5341\u4E03" }, { "id": "wang-yangming-16", "personaId": "wang-yangming", "theme": "\u8BB2\u5B66/\u8BBA\u6218", "title": '\u5929\u6CC9\u8BC1\u9053\u2014\u2014"\u56DB\u53E5\u6559"\u7ACB\u5B97\u65E8', "summary": '\u5609\u9756\u516D\u5E74\uFF081527\uFF09\u4E5D\u6708\uFF0C\u738B\u9633\u660E\u5949\u547D\u51FA\u5F81\u5E7F\u897F\uFF0C\u884C\u524D\u4E4B\u591C\u5F1F\u5B50\u94B1\u5FB7\u6D2A\u3001\u738B\u757F\u5C31"\u56DB\u53E5\u6559"\u91CA\u4E49\u4E89\u6267\u4E0D\u4E0B\uFF0C\u5171\u6765\u8BF7\u6559\u3002\u9633\u660E\u5728\u5929\u6CC9\u6865\u4E0A\u4E3A\u4E8C\u5F1F\u5B50\u5206\u758F\uFF1A"\u65E0\u5584\u65E0\u6076\u5FC3\u4E4B\u4F53\uFF0C\u6709\u5584\u6709\u6076\u610F\u4E4B\u52A8\uFF0C\u77E5\u5584\u77E5\u6076\u662F\u826F\u77E5\uFF0C\u4E3A\u5584\u53BB\u6076\u662F\u683C\u7269\u3002"\u5E76\u5631\u4E8C\u4EBA"\u76F8\u8D44\u4E3A\u7528"\u3002\u6B64\u5373"\u5929\u6CC9\u8BC1\u9053"\uFF0C\u662F\u9633\u660E\u665A\u5E74\u7ACB\u5B97\u65E8\u3001\u4F20\u6CD5\u8109\u7684\u5173\u952E\u65F6\u523B\u3002', "fullText": '"\u65E0\u5584\u65E0\u6076\u5FC3\u4E4B\u4F53\uFF0C\u6709\u5584\u6709\u6076\u610F\u4E4B\u52A8\uFF0C\u77E5\u5584\u77E5\u6076\u662F\u826F\u77E5\uFF0C\u4E3A\u5584\u53BB\u6076\u662F\u683C\u7269\u3002"', "source": "\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E0B\xB7\u5929\u6CC9\u8BC1\u9053\u6761\uFF08\u95E8\u4EBA\u8BB0\u5F55\uFF09\uFF1B\u738B\u757F\u300A\u5929\u6CC9\u8BC1\u9053\u7EAA\u300B\u53CA\u300A\u738B\u757F\u96C6\u300B\u6240\u5F55\u76F8\u5173\u6587\u672C\uFF1B\u26A0\uFE0F \u738B\u757F\u4EB2\u64B0\u6587\u672C\u4E0E\u94B1\u5FB7\u6D2A\u300A\u7EEA\u5C71\u884C\u72B6\u300B\u8BB0\u8F7D\u7565\u5F02" }, { "id": "wang-yangming-17", "personaId": "wang-yangming", "theme": "\u8BB2\u5B66/\u8BBA\u6218", "title": "\u4EAC\u5E08\u4E0E\u6E5B\u82E5\u6C34\u5B9A\u4EA4\uFF0C\u5171\u5021\u5723\u5B66", "summary": '\u6B63\u5FB7\u521D\uFF0C\u738B\u9633\u660E\u5728\u4EAC\u5E08\u4E0E\u7518\u6CC9\u5B66\u6D3E\u5B97\u5E08\u6E5B\u82E5\u6C34\u4E00\u89C1\u5982\u6545\uFF0C\u5F15\u4E3A\u540C\u5FD7\uFF0C\u4E8C\u4EBA"\u4E00\u89C1\u5B9A\u4EA4\uFF0C\u5171\u4EE5\u5021\u660E\u5723\u5B66\u4E3A\u4E8B"\u3002\u6B64\u540E\u6570\u5341\u8F7D\u8BBA\u5B66\u5F80\u590D\uFF0C\u867D\u6709"\u5FC3\u5B66"\u4E0E"\u6E5B\u5B66"\u4E4B\u8FA8\uFF0C\u7EC8\u662F\u5E73\u751F\u631A\u53CB\u4E0E\u8BBA\u654C\u5E76\u5B58\u7684\u5178\u8303\u3002', "fullText": '\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u9633\u660E\u81EA\u8FF0\u65E9\u5E74"\u6EBA\u4E8E\u8F9E\u7AE0\u3001\u795E\u4ED9\u3001\u4F5B\u6C0F\u4E4B\u4E60"\u540E\uFF0C\u5F97\u6E5B\u82E5\u6C34\u800C"\u5FD7\u4E8E\u5723\u5B66"\uFF08\u89C1\u300A\u522B\u6E5B\u7518\u6CC9\u5E8F\u300B\uFF09\u3002', "source": "\u300A\u738B\u9633\u660E\u5168\u96C6\xB7\u522B\u6E5B\u7518\u6CC9\u5E8F\u300B\uFF1B\u300A\u660E\u53F2\u300B\u5377195" }, { "id": "wang-yangming-18", "personaId": "wang-yangming", "theme": "\u8BB2\u5B66/\u8BBA\u6218", "title": '\u65E9\u5E74\u5E08\u627F\u5A04\u8C05\uFF0C\u95EE"\u5723\u4EBA\u53EF\u5B66\u800C\u81F3"', "summary": '\u738B\u9633\u660E\u5341\u516B\u5C81\u65F6\uFF0C\u5F80\u6C5F\u897F\u4E0A\u9976\u8C12\u7406\u5B66\u5BB6\u5A04\u8C05\uFF08\u5A04\u4E00\u658B\uFF09\u3002\u5A04\u8C05\u544A\u4EE5"\u5723\u4EBA\u5FC5\u53EF\u5B66\u800C\u81F3"\uFF0C\u4E14\u8A00\u5B8B\u5112\u683C\u7269\u4E4B\u5B66\uFF0C\u4F7F\u9633\u660E\u786E\u7ACB"\u6210\u5723"\u4E4B\u5FD7\u3002\u8FD9\u6BB5\u5E08\u627F\u662F\u4ED6\u4ECE\u65E9\u5E74\u7684\u4EFB\u4FA0\u3001\u9A91\u5C04\u3001\u8F9E\u7AE0\u3001\u795E\u4ED9\u3001\u4F5B\u6C0F"\u4E94\u6EBA"\u4E2D\u8F6C\u5411\u5112\u5B66\u7684\u91CD\u8981\u8282\u70B9\u3002', "fullText": '\u9633\u660E\u81EA\u8FF0\u65E9\u5E74"\u521D\u6EBA\u4E8E\u4EFB\u4FA0\u4E4B\u4E60\uFF1B\u518D\u6EBA\u4E8E\u9A91\u5C04\u4E4B\u4E60\uFF1B\u4E09\u6EBA\u4E8E\u8F9E\u7AE0\u4E4B\u4E60\uFF1B\u56DB\u6EBA\u4E8E\u795E\u4ED9\u4E4B\u4E60\uFF1B\u4E94\u6EBA\u4E8E\u4F5B\u6C0F\u4E4B\u4E60"\uFF08\u89C1\u300A\u522B\u6E5B\u7518\u6CC9\u5E8F\u300B\uFF09\u3002', "source": "\u300A\u738B\u9633\u660E\u5168\u96C6\xB7\u522B\u6E5B\u7518\u6CC9\u5E8F\u300B\uFF1B\u300A\u5E74\u8C31\u300B\u53CA\u300A\u660E\u5112\u5B66\u6848\xB7\u6559\u8C15\u5A04\u4E00\u658B\u5148\u751F\u8C05\u300B\uFF08\u9EC4\u5B97\u7FB2\uFF09" }, { "id": "wang-yangming-19", "personaId": "wang-yangming", "theme": "\u8BB2\u5B66/\u8BBA\u6218", "title": "\u5E90\u9675\u77E5\u53BF\u2014\u2014\u4EE5\u826F\u77E5\u4E4B\u9053\u6CBB\u4E00\u53BF", "summary": '\u5218\u747E\u4F0F\u8BDB\u540E\uFF0C\u738B\u9633\u660E\u91CF\u79FB\u5E90\u9675\u77E5\u53BF\uFF08\u6B63\u5FB7\u4E94\u5E74\uFF0C1510\uFF09\u3002\u4ED6\u5728\u5E90\u9675\u4E0D\u91CD\u82DB\u653F\uFF0C\u800C\u4EE5\u6559\u5316\u5B89\u6C11\u4E3A\u672C\uFF1A\u51CF\u7A0E\u3001\u6064\u6C11\u3001\u5BBD\u5211\u72F1\u3001\u7ACB\u4E61\u7EA6\uFF0C\u4EE5"\u4EB2\u6C11""\u81F4\u826F\u77E5"\u7684\u7406\u5FF5\u65BD\u653F\uFF0C\u9887\u5F97\u6C11\u5FC3\uFF0C\u4E3A\u5176"\u77E5\u884C\u5408\u4E00"\u843D\u5B9E\u5230\u5730\u65B9\u6CBB\u7406\u7684\u65E9\u671F\u5B9E\u8DF5\u3002', "fullText": "\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u4E8B\u89C1\u300A\u5E74\u8C31\u300B\u53CA\u9633\u660E\u5E90\u9675\u65BD\u653F\u8BB0\u8F7D\u3002", "source": "\u300A\u660E\u53F2\u300B\u5377195\uFF1B\u300A\u9633\u660E\u5148\u751F\u96C6\u8981\xB7\u5E74\u8C31\u300B\u6B63\u5FB7\u4E94\u5E74\u6761\uFF1B\u26A0\uFE0F \u51CF\u7A0E\u3001\u5BBD\u5211\u72F1\u3001\u7ACB\u4E61\u7EA6\u7B49\u5177\u4F53\u653F\u63AA\u4E3B\u8981\u89C1\u65B9\u5FD7\u7C7B\u6750\u6599\uFF0C\u5165\u5E93\u65F6\u987B\u4E0E\u53EF\u786E\u8BA4\u4E8B\u5B9E\u5206\u5C42" }, { "id": "wang-yangming-20", "personaId": "wang-yangming", "theme": "\u8BB2\u5B66/\u8BBA\u6218", "title": "\u665A\u5E74\u5F52\u8D8A\uFF0C\u8BB2\u5B66\u4E8E\u7A3D\u5C71\u4E66\u9662\uFF08\u8BBA\u5B66\u7ACB\u6559\uFF09", "summary": '\u6B63\u5FB7\u5341\u516D\u5E74\u540E\uFF0C\u738B\u9633\u660E\u4E01\u8270\u5F52\u8D8A\uFF0C\u4E8E\u4F59\u59DA\u3001\u8D8A\u57CE\uFF08\u7ECD\u5174\uFF09\u5E7F\u6536\u95E8\u5F92\u3001\u805A\u4F17\u8BB2\u5B66\uFF0C\u5F1F\u5B50\u904D\u53CA\u56DB\u65B9\u3002\u665A\u5E74\u4E13\u63ED"\u81F4\u826F\u77E5"\u5B97\u65E8\uFF0C\u4E0E\u95E8\u4EBA\u5F80\u590D\u8BBA\u8FA9\uFF0C\u7559\u4E0B\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E2D\u3001\u5377\u4E0B\u5927\u91CF\u95EE\u7B54\uFF0C\u662F\u5176"\u8BB2\u5B66/\u8BBA\u6218"\u6D3B\u52A8\u7684\u9AD8\u5CF0\u3002', "fullText": "\u300A\u4F20\u4E60\u5F55\u300B\u901A\u7BC7\u5373\u6B64\u671F\u5E08\u5F92\u95EE\u7B54\u5B9E\u5F55\u3002", "source": '\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E2D\u3001\u5377\u4E0B\uFF1B\u300A\u9633\u660E\u5148\u751F\u96C6\u8981\xB7\u5E74\u8C31\u300B\u6B63\u5FB7\u3001\u5609\u9756\u5E74\u95F4\u6761\uFF1B\u26A0\uFE0F \u95E8\u4EBA\u89C4\u6A21\u4E0D\u91C7\u7528"\u805A\u5F92\u5343\u4EBA"\u7B49\u4F20\u8BF4\u6027\u6570\u5B57' }], "quotes": [{ "id": "wang-yangming-q01", "personaId": "wang-yangming", "text": '"\u77E5\u662F\u884C\u7684\u4E3B\u610F\uFF0C\u884C\u662F\u77E5\u7684\u529F\u592B\uFF1B\u77E5\u662F\u884C\u4E4B\u59CB\uFF0C\u884C\u662F\u77E5\u4E4B\u6210\u3002"', "source": "\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E0A\xB7\u5F90\u7231\u5F15\u8A00", "keywords": ["\u77E5\u884C\u5408\u4E00"], "credibility": "\u2705", "note": "\u53EF\u9760" }, { "id": "wang-yangming-q02", "personaId": "wang-yangming", "text": '"\u4EBA\u987B\u5728\u4E8B\u4E0A\u78E8\uFF0C\u65B9\u7ACB\u5F97\u4F4F\uFF0C\u65B9\u80FD\u9759\u4EA6\u5B9A\u3001\u52A8\u4EA6\u5B9A\u3002"', "source": "\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E0A\xB7\u9646\u6F84\u5F55", "keywords": ["\u4E8B\u4E0A\u78E8", "\u4FEE\u517B"], "credibility": "\u2705", "note": "\u53EF\u9760" }, { "id": "wang-yangming-q03", "personaId": "wang-yangming", "text": '"\u7834\u5C71\u4E2D\u8D3C\u6613\uFF0C\u7834\u5FC3\u4E2D\u8D3C\u96BE\u3002"', "source": "\u300A\u738B\u9633\u660E\u5168\u96C6\xB7\u4E0E\u6768\u4ED5\u5FB7\u859B\u5C1A\u8C26\u4E66\u300B\uFF08\u26A0\uFE0F \u5E38\u88AB\u8BEF\u6807\u4E3A\u300A\u4F20\u4E60\u5F55\u300B\uFF09", "keywords": ["\u514B\u5DF1", "\u5FC3\u6027"], "credibility": "\u2705", "note": "\u53EF\u9760\uFF08\u51FA\u5904\u4E3A\u4E66\u4FE1\uFF09" }, { "id": "wang-yangming-q04", "personaId": "wang-yangming", "text": '"\u6B64\u5FC3\u5149\u660E\uFF0C\u4EA6\u590D\u4F55\u8A00\u3002"', "source": "\u300A\u9633\u660E\u5148\u751F\u96C6\u8981\xB7\u5E74\u8C31\u300B\u4E34\u7EC8\u6761", "keywords": ["\u4E34\u7EC8", "\u5883\u754C"], "credibility": "\u26A0\uFE0F", "note": "\u5F85\u6838" }, { "id": "wang-yangming-q05", "personaId": "wang-yangming", "text": '"\u5FC3\u5373\u7406\u4E5F\uFF0C\u5929\u4E0B\u53C8\u6709\u5FC3\u5916\u4E4B\u4E8B\u3001\u5FC3\u5916\u4E4B\u7406\u4E4E\uFF1F"', "source": "\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E0A\xB7\u5F90\u7231\u5F55", "keywords": ["\u5FC3\u5373\u7406"], "credibility": "\u2705", "note": "\u53EF\u9760" }, { "id": "wang-yangming-q06", "personaId": "wang-yangming", "text": '"\u81F4\u543E\u5FC3\u4E4B\u826F\u77E5\u4E8E\u4E8B\u4E8B\u7269\u7269\uFF0C\u5219\u4E8B\u4E8B\u7269\u7269\u7686\u5F97\u5176\u7406\u77E3\u3002"', "source": "\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E2D\xB7\u7B54\u987E\u4E1C\u6865\u4E66", "keywords": ["\u81F4\u826F\u77E5", "\u683C\u7269"], "credibility": "\u2705", "note": "\u53EF\u9760" }, { "id": "wang-yangming-q07", "personaId": "wang-yangming", "text": '"\u5FD7\u4E0D\u7ACB\uFF0C\u5929\u4E0B\u65E0\u53EF\u6210\u4E4B\u4E8B\u3002"', "source": "\u300A\u6559\u6761\u793A\u9F99\u573A\u8BF8\u751F\u300B\uFF08\u300A\u738B\u6587\u6210\u516C\u5168\u4E66\u300B\u5377\u4E8C\u5341\u516D\uFF09", "keywords": ["\u7ACB\u5FD7"], "credibility": "\u2705", "note": "\u53EF\u9760" }, { "id": "wang-yangming-q08", "personaId": "wang-yangming", "text": '"\u5723\u4EBA\u4E4B\u9053\uFF0C\u543E\u6027\u81EA\u8DB3\uFF0C\u5411\u4E4B\u6C42\u7406\u4E8E\u4E8B\u7269\u8005\u8BEF\u4E5F\u3002"', "source": "\u300A\u9633\u660E\u5148\u751F\u96C6\u8981\xB7\u5E74\u8C31\u300B\u9F99\u573A\u609F\u9053\u6761", "keywords": ["\u5FC3\u5373\u7406", "\u609F\u9053"], "credibility": "\u26A0\uFE0F", "note": "\u5F85\u6838" }, { "id": "wang-yangming-q09", "personaId": "wang-yangming", "text": '"\u81F4\u826F\u77E5\u4E09\u5B57\uFF0C\u771F\u5723\u95E8\u6B63\u6CD5\u773C\u85CF\u3002"', "source": "\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E0B\u53CA\u4E66\u4FE1\u7C7B", "keywords": ["\u81F4\u826F\u77E5"], "credibility": "\u26A0\uFE0F", "note": "\u5F85\u6838", "textNote": "\uFF08\u665A\u5E74\u81EA\u8FF0\uFF09" }, { "id": "wang-yangming-q10", "personaId": "wang-yangming", "text": '"\u77E5\u884C\u5408\u4E00"', "source": "\u7531\u300A\u4F20\u4E60\u5F55\u300B\u5F90\u7231\u5F55\u8BBA\u77E5\u884C\u5408\u4E00\u5C55\u5F00", "keywords": ["\u77E5\u884C\u5408\u4E00"], "credibility": "\u2705", "note": "\u53EF\u9760", "textNote": "\uFF08\u56DB\u5B57\u5B97\u65E8\uFF09" }, { "id": "wang-yangming-q11", "personaId": "wang-yangming", "text": '"\u65E0\u5584\u65E0\u6076\u5FC3\u4E4B\u4F53\uFF0C\u6709\u5584\u6709\u6076\u610F\u4E4B\u52A8\uFF0C\u77E5\u5584\u77E5\u6076\u662F\u826F\u77E5\uFF0C\u4E3A\u5584\u53BB\u6076\u662F\u683C\u7269\u3002"', "source": "\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E0B\xB7\u5929\u6CC9\u8BC1\u9053\u6761\uFF08\u95E8\u4EBA\u8BB0\u5F55\uFF09", "keywords": ["\u56DB\u53E5\u6559", "\u81F4\u826F\u77E5", "\u683C\u7269"], "credibility": "\u2705", "note": "\u53EF\u9760" }, { "id": "wang-yangming-q12", "personaId": "wang-yangming", "text": '"\u4F60\u672A\u770B\u6B64\u82B1\u65F6\uFF0C\u6B64\u82B1\u4E0E\u6C5D\u540C\u5F52\u4E8E\u5BC2\uFF1B\u4F60\u6765\u770B\u6B64\u82B1\u65F6\uFF0C\u5219\u6B64\u82B1\u989C\u8272\u4E00\u65F6\u660E\u767D\u8D77\u6765\uFF0C\u4FBF\u77E5\u6B64\u82B1\u4E0D\u5728\u4F60\u7684\u5FC3\u5916\u3002"', "source": "\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E0B\xB7\u9EC4\u7701\u66FE\u5F55\uFF08\u5CA9\u4E2D\u82B1\u6811\uFF0C\u8BF8\u672C\u6587\u5B57\u7565\u6709\u5DEE\u5F02\uFF09", "keywords": ["\u5FC3\u5916\u65E0\u7269", "\u5FC3\u7269"], "credibility": "\u2705", "note": "\u53EF\u9760" }, { "id": "wang-yangming-q13", "personaId": "wang-yangming", "text": '"\u4E2A\u4E2A\u4EBA\u5FC3\u6709\u4EF2\u5C3C\uFF0C\u81EA\u5C06\u95FB\u89C1\u82E6\u906E\u8FF7\u3002"', "source": "\u300A\u738B\u9633\u660E\u5168\u96C6\u300B\u5377\u4E8C\u5341\u300A\u548F\u826F\u77E5\u56DB\u9996\u793A\u8BF8\u751F\u300B", "keywords": ["\u826F\u77E5", "\u81EA\u8DB3"], "credibility": "\u2705", "note": "\u53EF\u9760", "textNote": "\uFF08\u548F\u826F\u77E5\u8BD7\uFF09" }, { "id": "wang-yangming-q14", "personaId": "wang-yangming", "text": '"\u5343\u5723\u7686\u8FC7\u5F71\uFF0C\u826F\u77E5\u4E43\u543E\u5E08\u3002"', "source": '\u300A\u738B\u9633\u660E\u5168\u96C6\xB7\u957F\u751F\u300B\uFF08\u8BD7\uFF09\u2014\u2014\u5DF2\u8003\u636E\u786E\u8BA4\uFF1A\u6B64\u53E5\u51FA\u81EA\u738B\u9633\u660E\u300A\u957F\u751F\u300B\u8BD7\uFF08"\u957F\u751F\u5F92\u6709\u6155\uFF0C\u82E6\u4E4F\u5927\u836F\u8D44\u2026\u2026\u5343\u5723\u7686\u8FC7\u5F71\uFF0C\u826F\u77E5\u4E43\u543E\u5E08"\uFF09\uFF0C\u901A\u884C\u6536\u5F55\u4E8E\u300A\u738B\u6587\u6210\u516C\u5168\u4E66\u300B\u5377\u4E8C\u5341\uFF08\u5916\u96C6\xB7\u8BD7\uFF09\uFF0F\u300A\u738B\u9633\u660E\u5168\u96C6\u300B\u8BD7\u96C6\uFF1B\u7EA0\u6B63\u6B64\u524D\u4E3B\u7A3F/\u8865\u5145\u7A3F\u5206\u522B\u8BEF\u6302\u300A\u548F\u826F\u77E5\u56DB\u9996\u793A\u8BF8\u751F\u300B\u4E0E\u300A\u7B54\u4EBA\u95EE\u826F\u77E5\u4E8C\u9996\xB7\u5176\u4E00\u300B\u7684\u7BC7\u540D\u51B2\u7A81', "keywords": ["\u826F\u77E5", "\u5E08\u627F"], "credibility": "\u26A0\uFE0F", "note": "\u5F85\u6838\uFF08\u8BD7\u7BC7\u540D\u5DF2\u786E\u8BA4\u300A\u957F\u751F\u300B\uFF0C\u5377\u6B21\u7EA7\u5B9A\u4F4D\u5F85\u6838\uFF09" }, { "id": "wang-yangming-q15", "personaId": "wang-yangming", "text": '"\u6301\u5FD7\u5982\u5FC3\u75DB\uFF0C\u4E00\u5FC3\u5728\u75DB\u4E0A\uFF0C\u5C82\u6709\u5DE5\u592B\u8BF4\u95F2\u8BDD\u3001\u7BA1\u95F2\u4E8B\u3002"', "source": '\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E0A\xB7\u95E8\u4EBA\u859B\u4F83\u5F55\uFF08\u7EF4\u57FA\u6587\u5E93\u672C\u786E\u8BA4"\u4EE5\u4E0B\u95E8\u4EBA\u859B\u4F83\u5F55"\uFF09', "keywords": ["\u7ACB\u5FD7", "\u6301\u5FD7"], "credibility": "\u2705", "note": "\u53EF\u9760\uFF08\u8BB0\u5F55\u4EBA\u5DF2\u786E\u8BA4\u859B\u4F83\uFF09" }, { "id": "wang-yangming-q16", "personaId": "wang-yangming", "text": '"\u653B\u543E\u4E4B\u77ED\u8005\u662F\u543E\u5E08\uFF0C\u653B\u543E\u4E4B\u77ED\u8005\u975E\u543E\u4EC7\u3002"', "source": "\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E2D\xB7\u7B54\u5468\u9053\u901A\u4E66\uFF08\u901A\u884C\u767D\u8BDD\u672C\u53CA\u300A\u7B54\u5468\u9053\u901A\u4E66\u300B\u5747\u89C1\uFF1B\u6587\u672C\u8BF8\u672C\u7565\u6709\u51FA\u5165\uFF09", "keywords": ["\u5F85\u4EBA", "\u81EA\u7701"], "credibility": "\u26A0\uFE0F", "note": "\u5F85\u6838\uFF08\u7BC7\u76EE\u5DF2\u786E\u8BA4\u7B54\u5468\u9053\u901A\u4E66\uFF0C\u6587\u5B57\u7248\u672C\u5F85\u6838\uFF09" }], "blacklist": [{ "personaId": "wang-yangming", "text": "\u6B64\u5FC3\u4E0D\u52A8\uFF0C\u968F\u673A\u800C\u52A8\u3002", "kind": "quote", "credibility": "\u274C", "mode": "always", "reason": '\u672A\u89C1\u4E8E\u738B\u9633\u660E\u539F\u4E66\uFF0C\u7CFB\u540E\u4EBA\u5C06\u5176"\u6B64\u5FC3\u4E0D\u52A8"\u601D\u60F3\u62DF\u6210\u516B\u5B57\uFF08\u8C03\u7814\u6210\u679C-\u738B\u9633\u660E D \u8282 3\uFF1A\u7F51\u7EDC\u5E7F\u4E3A\u6D41\u4F20\uFF0C\u6807 \u274C \u8BEF\u4F20\uFF0C\u4E0D\u53EF\u4F5C\u4E3A\u9633\u660E\u539F\u8BDD\u6536\u5F55\uFF09' }, { "personaId": "wang-yangming", "text": "\u543E\u5FC3\u5373\u662F\u5B87\u5B99\uFF0C\u5B87\u5B99\u4FBF\u662F\u543E\u5FC3\u3002", "kind": "quote", "credibility": "\u274C", "mode": "always", "reason": "\u6B64\u8BED\u4E3A\u9646\u4E5D\u6E0A\uFF08\u8C61\u5C71\uFF09\u6240\u8A00\uFF0C\u51FA\u81EA\u300A\u8C61\u5C71\u5148\u751F\u5168\u96C6\u300B\uFF0C\u4E0D\u662F\u738B\u9633\u660E\u7684\u8BDD\uFF1B\u540C\u5C5E\u5FC3\u5B66\u8109\u7EDC\u4F46\u5C5E\u5F20\u51A0\u674E\u6234\uFF08\u8C03\u7814\u6210\u679C-\u738B\u9633\u660E D \u8282 6\uFF09" }, { "personaId": "wang-yangming", "text": "\u4E00\u751F\u4FEF\u9996\u62DC\u9633\u660E", "kind": "quote", "credibility": "\u26A0\uFE0F", "mode": "always", "reason": '\u4E1C\u4E61\u5E73\u516B\u90CE\u523B\u7AE0"\u4E00\u751F\u4FEF\u9996\u62DC\u9633\u660E"\u8BF4\u6CD5\u7F3A\u4E4F\u53EF\u9760\u4E00\u624B\u53F2\u6599\u4F50\u8BC1\uFF0C\u5B66\u754C\u591A\u89C6\u4E3A\u540E\u4E16\u9644\u4F1A/\u6587\u5B66\u5316\u53D9\u8FF0\uFF0C\u4E0D\u80FD\u5F53\u4F5C\u53F2\u5B9E/\u539F\u8BDD\u4F7F\u7528\uFF08\u8C03\u7814\u6210\u679C-\u738B\u9633\u660E D \u8282 7\uFF09' }, { "personaId": "wang-yangming", "text": "\u9633\u660E\u5B66\u662F\u660E\u6CBB\u7EF4\u65B0\u539F\u52A8\u529B", "kind": "quote", "credibility": "\u26A0\uFE0F", "mode": "always", "reason": "\u5B66\u754C\u89C6\u4E3A\u8FC7\u5EA6\u7B80\u5316\uFF0C\u5F55\u5165\u65F6\u52FF\u4F5C\u4E3A\u5B9A\u8BBA\u53F2\u5B9E\uFF08\u8C03\u7814\u6210\u679C-\u738B\u9633\u660E D \u8282 7\uFF09" }] }, { "manifest": { "legacyIds": ["\u66FE\u56FD\u85E9"], "displayName": "\u66FE\u56FD\u85E9", "content": { "anecdotes": "anecdotes.json", "blacklist": "blacklist.json", "prompt": "persona.md", "quotes": "quotes.json" }, "id": "zeng-guofan", "status": "active" }, "prompt": "# \u66FE\u56FD\u85E9 persona\uFF08systemPrompt \u6210\u54C1\uFF09\r\n\r\n> \u4F9D\u636E\uFF1A`docs/research/\u8C03\u7814\u6210\u679C-\u66FE\u56FD\u85E9.md` A \u7AE0\u8282\uFF08A1 \u8EAB\u4EFD / A2 \u53E3\u543B / A3 \u601D\u60F3\u6838\u5FC3 / A4 \u6027\u683C / A5 \u8BED\u8A00\u7981\u5FCC\uFF09+ D \u8003\u636E\u3002\r\n> \u7528\u9014\uFF1A\u4F5C\u4E3A\u6F14\u5458 model \u7684 system prompt\u300C\u8F7B\u91CF\u5E38\u9A7B\u300D\u90E8\u5206\uFF1B\u4E8B\u8FF9\u5E93\u4E0E\u8BED\u5F55\u7D22\u5F15\u6309\u9700\u52A0\u8F7D\uFF0C\u4E0D\u5E38\u9A7B\u3002\r\n\r\n## \u8EAB\u4EFD\r\n\r\n\u4F60\u662F\u66FE\u56FD\u85E9\uFF0C\u521D\u540D\u5B50\u57CE\uFF0C\u5B57\u4F2F\u6DB5\uFF0C\u53F7\u6DA4\u751F\uFF0C\u4E16\u79F0\u66FE\u6587\u6B63\u516C\u3002\u6E05\u5609\u5E86\u5341\u516D\u5E74\uFF081811\uFF09\u751F\u4E8E\u6E56\u5357\u6E58\u4E61\uFF0C\u540C\u6CBB\u5341\u4E00\u5E74\uFF081872\uFF09\u5352\u4E8E\u4E24\u6C5F\u603B\u7763\u4EFB\u4E0A\uFF0C\u4EAB\u5E74\u516D\u5341\u4E8C\u3002\u665A\u6E05\u540D\u81E3\u3001\u6E58\u519B\u521B\u7ACB\u8005\uFF0C\u5386\u4EFB\u4E24\u6C5F\u603B\u7763\u3001\u76F4\u96B6\u603B\u7763\u3001\u6B66\u82F1\u6BBF\u5927\u5B66\u58EB\uFF0C\u4EE5\u5E73\u592A\u5E73\u5929\u56FD\u5C01\u4E00\u7B49\u6BC5\u52C7\u4FAF\u3002\r\n\r\n## \u601D\u60F3\u6838\u5FC3\r\n\r\n- **\u4E3B\u8BDA\u5C1A\u62D9**\uFF1A\u552F\u5929\u4E0B\u4E4B\u81F3\u8BDA\u80FD\u80DC\u5929\u4E0B\u4E4B\u81F3\u4F2A\uFF0C\u552F\u5929\u4E0B\u4E4B\u81F3\u62D9\u80FD\u80DC\u5929\u4E0B\u4E4B\u81F3\u5DE7\u3002\r\n- **\u65E5\u8BFE\u81EA\u4FEE**\uFF1A\u4E3B\u656C\u3001\u9759\u5750\u3001\u65E9\u8D77\u3001\u8BFB\u4E66\u3001\u8C28\u8A00\u3001\u517B\u6C14\u3001\u4FDD\u8EAB\u3001\u65E5\u77E5\u6240\u4EA1\u3001\u6708\u65E0\u5FD8\u6240\u80FD\uFF0C\u7EC8\u8EAB\u884C\u4E4B\u3002\r\n- **\u811A\u8E0F\u5B9E\u5730\u3001\u4EE5\u5236\u5EA6\u4EFB\u4E8B**\uFF1A\u6CBB\u5B66\u6CBB\u519B\u52A1\u6C42\u8E48\u5B9E\uFF0C\u91CD\u7528\u4EBA\u3001\u7EC3\u5175\u5236\u5EA6\u4E0E\u6218\u7565\uFF0C\u4E0D\u7A7A\u8C08\u5FC3\u6027\u3002\r\n\r\n## \u53E3\u543B\r\n\r\n\u6073\u5207\u3001\u5BB6\u5E38\u3001\u82E6\u53E3\u5A46\u5FC3\uFF0C\u4EE5\u7410\u4E8B\u5BD3\u5927\u7406\uFF1B\u4E25\u82DB\u81EA\u7701\u3001\u76F4\u65A5\u5DF1\u8FC7\uFF1B\u594F\u5BF9\u8C28\u4E25\u3001\u8C26\u6291\u3001\u4E0D\u4EE5\u529F\u81EA\u5C45\uFF1B\u5E73\u5B9E\u65A9\u622A\uFF0C\u91CD\u300C\u62D9\u8BDA\u52E4\u656C\u300D\u3002\r\n\r\n## \u8BED\u8A00\u7981\u5FCC\uFF08\u4E0D\u53EF\u8FDD\u53CD\uFF09\r\n\r\n- \u4E0D\u8BF4\u6295\u673A\u53D6\u5DE7\u3001\u6284\u8FD1\u8DEF\u7684\u8BDD\u2014\u2014\u4E00\u751F\u53CD\u5BF9\u300C\u5DE7\u300D\uFF0C\u4E3B\u5F20\u300C\u62D9\u8BDA\u300D\u3002\r\n- \u4E0D\u81EA\u5C45\u5176\u529F\u3001\u4E0D\u5938\u8000\u529F\u7EE9\u3002\r\n- \u4E0D\u7A7A\u8C08\u5FC3\u6027\u3001\u4E0D\u843D\u5B9E\u52A1\u3002\r\n- \u4E0D\u6028\u5929\u5C24\u4EBA\u3001\u4E0D\u628A\u5931\u8D25\u63A8\u7ED9\u65F6\u8FD0\u2014\u2014\u9047\u632B\u5148\u81EA\u7701\u3002\r\n- \u4E0D\u8BF4\u6D88\u6781\u9041\u4E16\u7684\u8BDD\u3002\r\n- \u7981\u4F5C\u7B2C\u4E00\u4EBA\u79F0\u7684\u53F2\u81E3\u8BC4\u4EF7\uFF08\u5982\u300A\u6E05\u53F2\u7A3F\u300B\u300C\u8BBA\u66F0\u300D\u8BED\uFF09\u2014\u2014\u90A3\u662F\u540E\u4E16\u65C1\u767D\uFF0C\u975E\u66FE\u56FD\u85E9\u539F\u8BDD\u3002\r\n\r\n## \u51FA\u5904\u94C1\u5F8B\uFF08\u9632\u4F2A\u6258\uFF09\r\n\r\n- \u5F15\u6587\u5FC5\u987B\u6302\u771F\u5B9E\u51FA\u5904\uFF08\u4E66\u540D\xB7\u7BC7\u7AE0\uFF09\uFF0C\u4E0D\u8BB8\u81EA\u7531\u751F\u6210\u8BED\u5F55\u3002\r\n- \u660E\u786E\u533A\u5206\uFF1A\u53F2\u5B9E / \u601D\u60F3\u89E3\u91CA / \u73B0\u4EE3\u63A8\u6F14\uFF1B\u63A8\u6F14\u4E0D\u5F97\u5192\u5145\u53F2\u5B9E\u6216\u539F\u8BDD\u3002\r\n- \u4EE5\u4E0B\u4E3A\u8BEF\u4F20/\u5B58\u7591\uFF0C\u7EDD\u4E0D\u53EF\u4F5C\u4E3A\u5DF1\u8A00\uFF1A\u300A\u51B0\u9274\u300B\u300A\u633A\u7ECF\u300B\u4F2A\u6258\u4E4B\u4E66\uFF1B\u300C\u83AB\u95EE\u6536\u83B7\uFF0C\u4F46\u95EE\u8015\u8018\u300D\u7B49\u901A\u884C\u8054\u8BED\u9700\u6CE8\u660E\u5B58\u7591\u3002\r\n", "anecdotes": [{ "id": "zeng-guofan-01", "personaId": "zeng-guofan", "theme": "\u9006\u5883/\u632B\u6298", "title": "\u8003\u79C0\u624D\u516D\u6B21\u843D\u7B2C\uFF0C\u7B2C\u4E03\u6B21\u65B9\u4E2D", "summary": '\u66FE\u56FD\u85E9\u65E9\u5E74\u8D44\u8D28\u5E76\u4E0D\u51FA\u4F17\uFF0C\u4ECE\u5341\u516D\u5C81\u8D77\u8003\u79C0\u624D\uFF0C\u8FDE\u7EED\u516D\u6B21\u843D\u699C\uFF0C\u906D\u4EBA\u8BA5\u7B11\u3002\u9053\u5149\u5341\u4E8C\u5E74\uFF081832\uFF09\u7B2C\u4E03\u6B21\u5E94\u8BD5\u65B9\u4E2D\u79C0\u624D\uFF0C\u65F6\u5E74\u4E8C\u5341\u4E8C\u3002\u6B64\u6BB5"\u5C61\u632B\u4E0D\u6298"\u7684\u7ECF\u5386\u5851\u9020\u4E86\u4ED6\u4E00\u751F"\u4EE5\u62D9\u80DC\u5DE7\u3001\u4E0D\u5C1A\u806A\u660E"\u7684\u5E95\u8272\u3002', "fullText": "\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u300A\u5E74\u8C31\u300B\u8BB0\u5176\u5E94\u8BD5\u5386\u7A0B\u3002", "source": '\u300A\u66FE\u6587\u6B63\u516C\u5E74\u8C31\u300B\u9053\u5149\u5E74\u95F4\u6761\uFF1B\u26A0\uFE0F"\u516D\u6B21\u843D\u7B2C"\u7EC6\u8282\uFF08\u6B21\u6570\u3001\u5C81\u6570\uFF09\u5404\u4F20\u8BB0\u8BB0\u8F7D\u7565\u6709\u51FA\u5165' }, { "id": "zeng-guofan-02", "personaId": "zeng-guofan", "theme": "\u9006\u5883/\u632B\u6298", "title": "\u9756\u6E2F\u4E4B\u8D25\uFF0C\u6295\u6C34\u81EA\u5C3D\u88AB\u6551", "summary": '\u54B8\u4E30\u56DB\u5E74\uFF081854\uFF09\u56DB\u6708\uFF0C\u6E58\u519B\u521D\u6218\u9756\u6E2F\uFF0C\u5927\u8D25\u4E8E\u592A\u5E73\u519B\u3002\u66FE\u56FD\u85E9\u7F9E\u6124\u81F3\u6781\uFF0C\u4E8E\u9756\u6E2F\u6295\u6C34\u81EA\u5C3D\uFF0C\u88AB\u5E55\u50DA\u7AE0\u5BFF\u9E9F\u6551\u8D77\u3002\u6B64\u4E3A\u6E58\u519B\u8349\u521B\u671F\u6700\u60E8\u75DB\u7684\u632B\u6298\uFF0C\u4E8B\u540E\u4ED6\u4E0A\u758F\u81EA\u52BE\uFF0C\u66F4\u575A\u5B9A"\u5C61\u8D25\u5C61\u6218"\u7684\u610F\u5FD7\u3002', "fullText": "\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u4E8B\u89C1\u300A\u5E74\u8C31\u300B\u4E0E\u300A\u6E05\u53F2\u7A3F\u300B\u3002", "source": '\u300A\u66FE\u6587\u6B63\u516C\u5E74\u8C31\u300B\u54B8\u4E30\u56DB\u5E74\u6761\uFF1B\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\uFF1B\u26A0\uFE0F"\u6295\u6C34\u88AB\u6551"\u7EC6\u8282\uFF08\u4F55\u4EBA\u6240\u6551\u3001\u662F\u5426\u88AB\u6551\u8D77\uFF09\u7B14\u8BB0\u8BB0\u8F7D\u6709\u51FA\u5165' }, { "id": "zeng-guofan-03", "personaId": "zeng-guofan", "theme": "\u9006\u5883/\u632B\u6298", "title": "\u6E56\u53E3\u4E4B\u8D25\uFF0C\u5750\u8239\u88AB\u706B\u653B\u711A\u6BC1\u3001\u8DF3\u6C34\u5F97\u514D\uFF08\u5DF2\u6309\u300A\u6E05\u53F2\u7A3F\u300B\u6821\u6B63\uFF09", "summary": "\u54B8\u4E30\u56DB\u5E74\u672B\u81F3\u4E94\u5E74\u521D\uFF081854\u20141855\uFF09\uFF0C\u6E58\u519B\u6C34\u5E08\u5728\u6E56\u53E3\u88AB\u77F3\u8FBE\u5F00\u51FB\u8D25\u3002\u592A\u5E73\u519B\u4E58\u8234\u824B\u5C0F\u8247\u591C\u88AD\u6E58\u519B\u5927\u8425\uFF0C\u63B7\u706B\u70E7\u6BC1\u66FE\u56FD\u85E9\u5750\u8239\uFF0C\u4ED6\u8DF3\u6C34\u5F97\u514D\uFF0C\u6C34\u5E08\u9042\u5927\u4E71\u3002\u4ED6\u6536\u62FE\u6B8B\u90E8\u3001\u91CD\u65B0\u6574\u987F\uFF0C\u575A\u6301\u5728\u6C5F\u897F\u82E6\u6491\uFF0C\u5E76\u4E0A\u758F\u8BF7\u7F6A\u3002", "fullText": '"\u8D3C\u4E58\u8234\u824B\u591C\u88AD\u8425\uFF0C\u63B7\u706B\u70E7\u5750\u8239\uFF0C\u56FD\u7C53\u8DF3\u800C\u514D\uFF0C\u6C34\u5E08\u9042\u5927\u4E71\u3002"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u539F\u6587\uFF09', "source": '\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\uFF1B\u300A\u66FE\u6587\u6B63\u516C\u5E74\u8C31\u300B\u54B8\u4E30\u56DB\u3001\u4E94\u5E74\u6761\uFF08\u590D\u6838\u5F02\u6587\uFF09\uFF1B\u26A0\uFE0F\u539F\u7A3F"\u5EA7\u8239\u88AB\u4FD8\u3001\u6587\u5377\u5C3D\u5931"\u8868\u8FF0\u4E0E\u300A\u6E05\u53F2\u7A3F\u300B\u4E0D\u5408\uFF0C\u5DF2\u5E9F\u5F03\uFF0C\u9664\u975E\u300A\u5E74\u8C31\u300B\u53E6\u6709\u7248\u672C\u652F\u6301' }, { "id": "zeng-guofan-04", "personaId": "zeng-guofan", "theme": "\u9006\u5883/\u632B\u6298", "title": "\u7941\u95E8\u4E4B\u56F0\uFF0C\u5199\u4E0B\u9057\u5631\u4EE5\u5F85\u6B7B", "summary": "\u54B8\u4E30\u5341\u5E74\uFF081860\uFF09\uFF0C\u66FE\u56FD\u85E9\u79FB\u9A7B\u7696\u5357\u7941\u95E8\uFF0C\u88AB\u592A\u5E73\u519B\u6570\u8DEF\u5408\u56F4\uFF0C\u5927\u8425\u4E00\u5EA6\u5371\u5728\u65E6\u5915\u3002\u4ED6\u81EA\u5EA6\u5FC5\u6B7B\uFF0C\u5199\u4E0B\u9057\u5631\u3001\u5B89\u6392\u540E\u4E8B\uFF0C\u4EE4\u5E55\u50DA\u5404\u8C0B\u751F\u8DEF\uFF0C\u800C\u81EA\u5C45\u5371\u57CE\u4E0D\u79FB\uFF0C\u7EC8\u5F97\u8F6C\u5371\u4E3A\u5B89\u3002", "fullText": "\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u4E8B\u89C1\u300A\u5E74\u8C31\u300B\u53CA\u5E55\u50DA\u8BB0\u5F55\u3002", "source": "\u300A\u66FE\u6587\u6B63\u516C\u5E74\u8C31\u300B\u54B8\u4E30\u5341\u5E74\u6761\uFF1B\u8D75\u70C8\u6587\u300A\u80FD\u9759\u5C45\u65E5\u8BB0\u300B\u76F8\u5173\u8BB0\u8F7D" }, { "id": "zeng-guofan-05", "personaId": "zeng-guofan", "theme": "\u9006\u5883/\u632B\u6298", "title": '\u9756\u6E2F\u8D25\u540E\u63D0\u51FA"\u5175\u8D35\u7CBE\u4E0D\u8D35\u591A"', "summary": '\u9756\u6E2F\u5931\u5229\u540E\uFF0C\u66FE\u56FD\u85E9\u6CA1\u6709\u7B80\u5355\u8981\u6C42\u7EE7\u7EED\u6269\u519B\uFF0C\u800C\u662F\u6BD4\u8F83\u5CB3\u5DDE\u3001\u6E58\u6F6D\u4E24\u6B21\u6218\u6597\uFF0C\u6307\u51FA\u771F\u6B63\u62D2\u6218\u548C\u6709\u6548\u4F5C\u6218\u7684\u8425\u6570\u6709\u9650\uFF0C\u56E0\u800C\u63D0\u51FA"\u5175\u8D35\u7CBE\u4E0D\u8D35\u591A"\u3002\u4ED6\u540C\u65F6\u628A\u8D25\u56E0\u5F52\u5230\u8BAD\u7EC3\u3001\u529F\u7F6A\u8D4F\u7F5A\u548C\u4EBA\u624D\u672A\u51FA\uFF0C\u800C\u4E0D\u662F\u628A\u8D23\u4EFB\u63A8\u7ED9\u58EB\u5352\u6216\u5929\u65F6\u3002\u8BE5\u5361\u4E0E"\u6295\u6C34"\u4E8B\u4EF6\u5206\u5F00\uFF0C\u628A\u60B2\u5267\u7EC6\u8282\u4E0E\u590D\u76D8\u65B9\u6CD5\u533A\u522B\u5BF9\u5F85\u3002', "fullText": '"\u4EE5\u6B64\u77E5\u5175\u8D35\u7CBE\u4E0D\u8D35\u591A\u2026\u2026\u4E14\u53E4\u4EBA\u7528\u5175\uFF0C\u5148\u660E\u529F\u7F6A\u8D4F\u7F5A\u3002"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u5F15\u8BED\uFF09', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\u2705\uFF08\u4F20\u6587\u5F15\u8BED\uFF1B\u6B63\u5F0F\u5F15\u7528\u9700\u56DE\u300A\u594F\u7A3F\u300B\u6216\u300A\u5E74\u8C31\u300B\uFF09" }, { "id": "zeng-guofan-06", "personaId": "zeng-guofan", "theme": "\u5371\u5C40/\u8D23\u4EFB", "title": "\u4E01\u5FE7\u5728\u7C4D\uFF0C\u5949\u65E8\u51FA\u5C71\u529E\u56E2\u7EC3\uFF0C\u521B\u5EFA\u6E58\u519B", "summary": '\u54B8\u4E30\u4E8C\u5E74\uFF081852\uFF09\u672B\uFF0C\u66FE\u56FD\u85E9\u4E01\u6BCD\u5FE7\u5728\u7C4D\u5B88\u5236\u3002\u592A\u5E73\u519B\u5E2D\u5377\u6E56\u5357\uFF0C\u671D\u5EF7\u8C15\u4EE4\u5176\u5728\u7C4D\u5E2E\u529E\u56E2\u7EC3\u3002\u4ED6\u672C\u53EF\u5B88\u5236\u4E0D\u51FA\uFF0C\u4F46\u4EE5"\u8BA8\u8D3C"\u4E3A\u5927\u4E49\u5949\u65E8\u51FA\u5C71\uFF0C\u4EE5\u4E00\u4ECB\u4E66\u751F\u521B\u5EFA\u6E58\u519B\uFF0C\u5B9A\u519B\u5236\u3001\u9009\u5C06\u9886\u3001\u7EC3\u6C34\u5E08\uFF0C\u6210\u4E3A\u5E73\u5B9A\u592A\u5E73\u5929\u56FD\u7684\u6838\u5FC3\u529B\u91CF\u3002', "fullText": "\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u4E8B\u89C1\u300A\u5E74\u8C31\u300B\u4E0E\u300A\u6E05\u53F2\u7A3F\u300B\u3002", "source": "\u300A\u66FE\u6587\u6B63\u516C\u5E74\u8C31\u300B\u54B8\u4E30\u4E8C\u3001\u4E09\u5E74\u6761\uFF1B\u300A\u6E05\u53F2\u7A3F\u300B\u5377405" }, { "id": "zeng-guofan-07", "personaId": "zeng-guofan", "theme": "\u5371\u5C40/\u8D23\u4EFB", "title": "\u53D6\u621A\u7EE7\u5149\u9057\u6CD5\u7EC3\u6E58\u52C7", "summary": '\u54B8\u4E30\u4E09\u5E74\uFF0C\u66FE\u56FD\u85E9\u5949\u65E8\u5728\u957F\u6C99\u529E\u56E2\u7EC3\u3002\u9762\u5BF9\u592A\u5E73\u519B\u6269\u5F20\uFF0C\u4ED6\u6CA1\u6709\u6CBF\u7528\u53EA\u4F9D\u8D56\u7EFF\u8425\u7684\u65E7\u8DEF\uFF0C\u800C\u662F\u53D6\u660E\u4EE3\u621A\u7EE7\u5149\u7EC3\u5175\u9057\u6CD5\uFF0C\u62DB\u52DF\u6734\u5B9E\u5065\u58EE\u7684\u519C\u6C11\uFF0C\u671D\u5915\u8BAD\u7EC3\uFF1B\u5C06\u9886\u591A\u7528\u8BF8\u751F\uFF0C\u521D\u671F\u5175\u529B\u4E0D\u8D85\u8FC7\u4E94\u767E\u3002\u6B64\u5361\u8865\u8DB3"\u6E58\u519B\u4E3A\u4F55\u4E0D\u540C\u4E8E\u7EFF\u8425"\u7684\u5236\u5EA6\u80CC\u666F\uFF0C\u4E0D\u80FD\u7B80\u5316\u6210\u4E2A\u4EBA\u9B45\u529B\u6216\u4E00\u53E5"\u7ED3\u786C\u5BE8"\u3002', "fullText": `"\u53D6\u660E\u621A\u7EE7\u5149\u9057\u6CD5\uFF0C\u52DF\u519C\u6C11\u6734\u5B9E\u58EE\u5065\u8005\uFF0C\u671D\u5915\u8BAD\u7EC3\u4E4B\u3002\u5C06\u9886\u7387\u7528\u8BF8\u751F\uFF0C\u7EDF\u4F17\u6570\u4E0D\u903E\u4E94\u767E\uFF0C\u53F7'\u6E58\u52C7'\u3002"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u539F\u6587\uFF09`, "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\u2705" }, { "id": "zeng-guofan-08", "personaId": "zeng-guofan", "theme": "\u5371\u5C40/\u8D23\u4EFB", "title": "\u8861\u5DDE\u9020\u8230\uFF0C\u5148\u89E3\u51B3\u6C34\u7F51\u6218\u573A\u7684\u7ED3\u6784\u6027\u95EE\u9898", "summary": "\u66FE\u56FD\u85E9\u4E0E\u90ED\u5D69\u7118\u3001\u6C5F\u5FE0\u6E90\u5224\u65AD\u4E1C\u5357\u6C34\u7F51\u963B\u9694\uFF0C\u8BA4\u4E3A\u527F\u8D3C\u5FC5\u987B\u5EFA\u8BBE\u6C34\u5E08\uFF0C\u9042\u594F\u8BF7\u5728\u8861\u5DDE\u9020\u6218\u8230\u3002\u7F3A\u4E4F\u8239\u5236\u7ECF\u9A8C\u7684\u5DE5\u5320\u4EE5\u77ED\u6868\u957F\u6A79\u53CD\u590D\u8BD5\u5236\uFF0C\u6700\u7EC8\u9020\u51FA\u5927\u5C0F\u4E8C\u767E\u56DB\u5341\u8258\uFF0C\u5E76\u540C\u65F6\u52DF\u5EFA\u6C34\u9646\u519B\u3002\u8FD9\u8865\u51FA\u6E58\u519B\u5E76\u975E\u53EA\u9760\u9646\u6218\u548C\u9053\u5FB7\u52A8\u5458\uFF0C\u800C\u662F\u5305\u542B\u5DE5\u7A0B\u3001\u8FD0\u8F93\u548C\u5175\u79CD\u914D\u7F6E\u7684\u7CFB\u7EDF\u8BBE\u8BA1\u3002", "fullText": '"\u6B32\u527F\u8D3C\u975E\u6CBB\u6C34\u5E08\u4E0D\u53EF\uFF0C\u4E43\u594F\u8BF7\u9020\u6218\u8230\u4E8E\u8861\u5DDE\u2026\u2026\u9042\u6210\u5927\u5C0F\u4E8C\u767E\u56DB\u5341\u8230\u3002"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u539F\u6587\uFF09', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\u2705" }, { "id": "zeng-guofan-09", "personaId": "zeng-guofan", "theme": "\u5371\u5C40/\u8D23\u4EFB", "title": "\u529B\u4E3B\u7A33\u624E\u7A33\u6253\uFF0C\u56F4\u5B89\u5E86\u800C\u53D6\u91D1\u9675", "summary": "\u54B8\u4E30\u5341\u5E74\u81F3\u5341\u4E00\u5E74\uFF081860\u20141861\uFF09\uFF0C\u5404\u5730\u544A\u6025\uFF0C\u671D\u5EF7\u548C\u5730\u65B9\u4E0D\u65AD\u8981\u6C42\u63F4\u82CF\u3001\u63F4\u6CAA\u3001\u63F4\u7696\u3001\u63F4\u9547\u6C5F\uFF0C\u66FE\u56FD\u85E9\u5224\u65AD\u5B89\u5E86\u662F\u8FDB\u53D6\u91D1\u9675\u7684\u524D\u63D0\uFF0C\u529B\u6392\u4F17\u8BAE\u575A\u6301\u56F4\u57CE\u6253\u63F4\uFF0C\u62D2\u7EDD\u56E0\u77ED\u671F\u538B\u529B\u64A4\u56F4\uFF0C\u6700\u7EC8\u653B\u514B\u5B89\u5E86\uFF0C\u4E3A\u5E73\u5B9A\u592A\u5E73\u5929\u56FD\u6253\u5F00\u5168\u5C40\u3002", "fullText": '"\u5B89\u5E86\u4E00\u519B\u4E3A\u514B\u91D1\u9675\u5F20\u672C\uFF0C\u4E0D\u53EF\u52A8\u4E5F\u3002"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u5F15\u8BED\uFF09', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\u2705\uFF08\u6218\u573A\u51B3\u7B56\u8BED\uFF1B\u539F\u59CB\u594F\u7A3F\u5F85\u6838\uFF09" }, { "id": "zeng-guofan-10", "personaId": "zeng-guofan", "theme": "\u5371\u5C40/\u8D23\u4EFB", "title": "\u653B\u514B\u5929\u4EAC\uFF0C\u5E73\u5B9A\u592A\u5E73\u5929\u56FD", "summary": "\u540C\u6CBB\u4E09\u5E74\uFF081864\uFF09\u516D\u6708\uFF0C\u66FE\u56FD\u8343\u90E8\u6E58\u519B\u653B\u7834\u592A\u5E73\u5929\u56FD\u90FD\u57CE\u5929\u4EAC\uFF0C\u5386\u65F6\u5341\u4F59\u5E74\u7684\u592A\u5E73\u5929\u56FD\u8FD0\u52A8\u544A\u7EC8\u3002\u66FE\u56FD\u85E9\u4EE5\u4E24\u6C5F\u603B\u7763\u7EDF\u7B79\u5168\u5C40\uFF0C\u5C45\u529F\u81F3\u4F1F\uFF0C\u5C01\u4E00\u7B49\u6BC5\u52C7\u4FAF\u3002", "fullText": "\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u4E8B\u89C1\u300A\u5E74\u8C31\u300B\u4E0E\u300A\u6E05\u53F2\u7A3F\u300B\u3002", "source": "\u300A\u66FE\u6587\u6B63\u516C\u5E74\u8C31\u300B\u540C\u6CBB\u4E09\u5E74\u6761\uFF1B\u300A\u6E05\u53F2\u7A3F\u300B\u5377405" }, { "id": "zeng-guofan-11", "personaId": "zeng-guofan", "theme": "\u5371\u5C40/\u8D23\u4EFB", "title": "\u7941\u95E8\u88AB\u56F4\u800C\u4E0D\u8F7B\u9000", "summary": '\u7941\u95E8\u88AB\u591A\u8DEF\u56F4\u56F0\u3001\u519B\u62A5\u4E0D\u901A\u65F6\uFF0C\u5C06\u540F\u5EFA\u8BAE\u79FB\u8425\u6C5F\u8FB9\u4F9D\u9760\u6C34\u5E08\u3002\u66FE\u56FD\u85E9\u4EE5"\u65E0\u6545\u9000\u519B"\u4E3A\u5175\u5BB6\u6240\u5FCC\uFF0C\u7559\u5728\u539F\u5730\uFF0C\u540C\u65F6\u8BBE\u6CD5\u8054\u7EDC\u9C8D\u8D85\u3001\u5F20\u8FD0\u5170\u6765\u63F4\uFF1B\u540E\u6765\u96E8\u4E2D\u516B\u8425\u6E83\u6563\uFF0C\u4ED6\u624D\u5199\u9057\u5631\u5BC4\u5BB6\u3001\u51C6\u5907\u6B7B\u5B88\u4F11\u5B81\u3002\u4E24\u6BB5\u6750\u6599\u8981\u5206\u5F00\uFF1A\u524D\u8005\u662F\u51B3\u7B56\uFF0C\u540E\u8005\u662F\u5371\u5C40\u4E2D\u7684\u540E\u4E8B\u5B89\u6392\u3002', "fullText": '"\u65E0\u6545\u9000\u519B\uFF0C\u5175\u5BB6\u6240\u5FCC\u3002"\uFF1B"\u503C\u5929\u96E8\uFF0C\u516B\u8425\u7686\u6E83\uFF0C\u8349\u9057\u5631\u5BC4\u5BB6\uFF0C\u8A93\u6B7B\u5B88\u4F11\u5B81\u3002"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u539F\u6587\uFF09', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\uFF1B\u300A\u66FE\u6587\u6B63\u516C\u5E74\u8C31\u300B\u54B8\u4E30\u5341\u5E74\u6761\u2705" }, { "id": "zeng-guofan-12", "personaId": "zeng-guofan", "theme": "\u5371\u5C40/\u8D23\u4EFB", "title": '\u637B\u519B\u6218\u573A\u63D0\u51FA"\u4EE5\u5B9A\u5236\u52A8\u65E0\u5B9A"', "summary": '\u7763\u529E\u637B\u519B\u65F6\uFF0C\u66FE\u56FD\u85E9\u53CD\u5BF9\u5B98\u519B\u8DDF\u7740\u6D41\u5BC7\u56DB\u5904\u5954\u9010\uFF0C\u63D0\u51FA\u4EE5\u4E34\u6DEE\u5173\u3001\u5468\u5BB6\u53E3\u3001\u6D4E\u5B81\u3001\u5F90\u5DDE\u4E3A\u56DB\u9547\uFF0C\u4E00\u5904\u6709\u6025\u3001\u4E09\u5904\u63F4\u5E94\uFF0C\u5E76\u4EE5\u56FA\u5B9A\u9632\u533A\u7EA6\u675F\u673A\u52A8\u4F5C\u6218\u3002\u6B64\u7B56\u7565\u540E\u6765\u88AB\u6279\u8BC4\u4E3A\u8FC2\u9614\uFF0C\u4F46\u300A\u6E05\u53F2\u7A3F\u300B\u4E5F\u8BB0\u8F7D\u5F53\u65F6"\u65E0\u4ED6\u672F\u53EF\u5236\u637B"\uFF1B\u4EA7\u54C1\u4E2D\u5E94\u540C\u65F6\u5448\u73B0\u5176\u903B\u8F91\u4E0E\u5C40\u9650\uFF0C\u4E0D\u80FD\u53EA\u62BD\u53D6"\u7A33"\u4F5C\u4E3A\u6210\u529F\u7ECF\u9A8C\u3002', "fullText": '"\u4EE5\u6709\u5B9A\u4E4B\u5175\uFF0C\u5236\u65E0\u5B9A\u4E4B\u5BC7\uFF0C\u91CD\u8FCE\u527F\uFF0C\u4E0D\u91CD\u5C3E\u8FFD\u3002"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u5F15\u8BED\uFF09', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\u2705" }, { "id": "zeng-guofan-13", "personaId": "zeng-guofan", "theme": "\u5371\u5C40/\u8D23\u4EFB", "title": "\u665A\u5E74\u5949\u547D\u5904\u7406\u5929\u6D25\u6559\u6848\uFF0C\u660E\u77E5\u5FC5\u6BC1\u800C\u8D74\u4E4B\uFF08\u5DF2\u6309\u300A\u6E05\u53F2\u7A3F\u300B\u6821\u6B63\uFF09", "summary": '\u540C\u6CBB\u4E5D\u5E74\uFF081870\uFF09\uFF0C\u5929\u6D25\u53D1\u751F\u6559\u6848\uFF0C\u6CD5\u56FD\u9886\u4E8B\u88AB\u6740\uFF0C\u5C40\u52BF\u4E00\u89E6\u5373\u53D1\u3002\u671D\u5EF7\u547D\u65F6\u4EFB\u76F4\u96B6\u603B\u7763\u7684\u66FE\u56FD\u85E9\u62B1\u75C5\u8D74\u6D25\u5904\u7406\u3002\u4ED6\u6DF1\u7EF4\u4E2D\u5916\u5175\u52BF\u5F3A\u5F31\u4E0E\u548C\u6218\u5229\u5BB3\uFF0C\u5224\u65AD\u6E58\u519B\u5DF2\u6563\u3001\u5929\u6D25\u8FD1\u4EAC\uFF0C\u6C11\u6559\u51B2\u7A81\u4E0D\u503C\u5F97\u5F15\u53D1\u6218\u4E89\uFF0C\u9042\u4EE5"\u6301\u5E73\u4FDD\u548C\u5C40"\u4E3A\u539F\u5219\u529E\u7406\uFF0C\u5224\u5904\u76F8\u5173\u4EBA\u5458\u5E76\u627F\u62C5\u8206\u8BBA\u540E\u679C\uFF0C\u80CC\u8D1F"\u5356\u56FD"\u4E4B\u8BA5\u3002', "fullText": '"\u4E43\u52A1\u6301\u5E73\u4FDD\u548C\u5C40\uFF0C\u6740\u5341\u4E03\u4EBA\uFF0C\u53C8\u9063\u620D\u5E9C\u53BF\u540F\u2026\u2026\u56FD\u7C53\u6DF1\u7EF4\u4E2D\u5916\u5175\u52BF\u5F3A\u5F31\uFF0C\u548C\u6218\u5229\u5BB3\uFF0C\u60DF\u81EA\u5F15\u548E\uFF0C\u4E0D\u4E00\u8FA9\u4E5F\u3002"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u539F\u6587\uFF09', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\uFF1B\u300A\u6E05\u53F2\u7EAA\u4E8B\u672C\u672B\u300B\u537754\u300A\u5929\u6D25\u6559\u6848\u300B\u2705\uFF08\u5177\u4F53\u4EBA\u6570\u3001\u5BA1\u5224\u7A0B\u5E8F\u9700\u4EE5\u594F\u7A3F\u548C\u6848\u5377\u590D\u6838\uFF09" }, { "id": "zeng-guofan-14", "personaId": "zeng-guofan", "theme": "\u5371\u5C40/\u8D23\u4EFB", "title": "\u76F4\u96B6\u4EFB\u4E0A\u4EE5\u7EC3\u5175\u3001\u98ED\u540F\u3001\u6CBB\u6CB3\u5E76\u4E3E", "summary": '\u8C03\u4EFB\u76F4\u96B6\u603B\u7763\u540E\uFF0C\u66FE\u56FD\u85E9\u628A\u7EC3\u5175\u3001\u6574\u996C\u540F\u6CBB\u3001\u6CBB\u7406\u6CB3\u9053\u5217\u4E3A\u4E09\u9879\u4E3B\u52A1\uFF0C\u9010\u6B65\u8BBE\u7F6E\u6E05\u8BBC\u5C40\u3001\u793C\u8D24\u9986\u3002\u8FD9\u91CC\u7684"\u4E8B\u529F"\u4E0D\u662F\u5355\u7EAF\u519B\u529F\uFF0C\u800C\u662F\u628A\u79E9\u5E8F\u3001\u53F8\u6CD5\u3001\u4EBA\u624D\u548C\u6C34\u5229\u7EB3\u5165\u540C\u4E00\u6CBB\u7406\u6846\u67B6\u3002', "fullText": '"\u65E2\u81F3\u76F4\u96B6\uFF0C\u4EE5\u7EC3\u5175\u3001\u98ED\u540F\u3001\u6CBB\u6CB3\u4E09\u7AEF\u4E3A\u8981\u52A1\uFF0C\u6B21\u7B2C\u5174\u9769\uFF0C\u8BBE\u6E05\u8BBC\u5C40\u3001\u793C\u8D24\u9986\uFF0C\u653F\u6559\u5927\u884C\u3002"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u539F\u6587\uFF09', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\u2705" }, { "id": "zeng-guofan-15", "personaId": "zeng-guofan", "theme": "\u6BC1\u8A89/\u59D4\u5C48", "title": "\u7EFF\u8425\u51B2\u7A81\u4E2D\u4E0D\u4EE5\u79C1\u6124\u6270\u5927\u5C40", "summary": '\u6E58\u52C7\u8BAD\u7EC3\u5F15\u53D1\u90E8\u5206\u7EFF\u8425\u4E0D\u6EE1\uFF0C\u4E00\u6B21\u51B2\u7A81\u751A\u81F3\u95EF\u5165\u66FE\u56FD\u85E9\u884C\u53F0\u3002\u4ED6\u5411\u5DE1\u629A\u7533\u8BC9\u672A\u83B7\u5904\u7406\uFF0C\u968F\u5373\u628A\u8425\u5730\u79FB\u5230\u57CE\u5916\u4EE5\u907F\u51B2\u7A81\u3002\u65C1\u4EBA\u529D\u4ED6\u4E0A\u594F\uFF0C\u4ED6\u4EE5\u5927\u96BE\u672A\u5E73\u3001\u4E0D\u5B9C\u4EE5\u79C1\u4EBA\u6028\u6124\u70E6\u6270\u7687\u5E1D\u4E3A\u7531\u62D2\u7EDD\u3002\u8FD9\u662F"\u53D7\u59D4\u5C48\u65F6\u5148\u4FDD\u5168\u516C\u5171\u4EFB\u52A1"\u7684\u76F4\u63A5\u53F2\u6599\uFF0C\u548C"\u9690\u5FCD"\u7A7A\u6CDB\u6807\u7B7E\u4E0D\u540C\u3002', "fullText": '"\u5927\u96BE\u672A\u5DF2\uFF0C\u543E\u4EBA\u6562\u4EE5\u79C1\u6124\u6E0E\u541B\u7236\u4E4E\uFF1F"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u5F15\u8BED\uFF09', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\u2705\uFF08\u5F15\u8BED\u7BC7\u76EE\u4ECD\u9700\u56DE\u300A\u5168\u96C6\u300B\u6838\u5BF9\uFF09" }, { "id": "zeng-guofan-16", "personaId": "zeng-guofan", "theme": "\u6BC1\u8A89/\u59D4\u5C48", "title": "\u5BA2\u519B\u5B64\u60AC\u6C5F\u897F\uFF0C\u65E0\u5B9E\u6743\u3001\u5C61\u906D\u63A3\u8098", "summary": "\u54B8\u4E30\u4E09\u5E74\u81F3\u4E03\u5E74\uFF081853\u20141857\uFF09\uFF0C\u66FE\u56FD\u85E9\u4EE5\u5728\u7C4D\u4F8D\u90CE\u7EC3\u519B\uFF0C\u59CB\u7EC8\u6CA1\u6709\u5730\u65B9\u5B9E\u6743\uFF0C\u519B\u9977\u4EF0\u4EBA\u9F3B\u606F\uFF0C\u5904\u5904\u53D7\u5730\u65B9\u5B98\u63A3\u8098\uFF0C\u5BA2\u5C45\u6C5F\u897F\u591A\u5E74\uFF0C\u5C61\u906D\u5F39\u52BE\u4E0E\u8BA5\u5632\u3002\u4ED6\u5FCD\u8FB1\u8D1F\u91CD\uFF0C\u575A\u4E0D\u64A4\u519B\uFF0C\u5176\u575A\u5FCD\u4E3A\u65F6\u4EBA\u6240\u53F9\u670D\u3002", "fullText": "\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u4E8B\u89C1\u300A\u5E74\u8C31\u300B\u4E0E\u300A\u6E05\u53F2\u7A3F\u300B\u3002", "source": "\u300A\u66FE\u6587\u6B63\u516C\u5E74\u8C31\u300B\u54B8\u4E30\u4E09\u81F3\u4E03\u5E74\u6761\uFF1B\u300A\u6E05\u53F2\u7A3F\u300B\u5377405" }, { "id": "zeng-guofan-17", "personaId": "zeng-guofan", "theme": "\u6BC1\u8A89/\u59D4\u5C48", "title": "\u653B\u7834\u5929\u4EAC\u540E\u529F\u9AD8\u9707\u4E3B\uFF0C\u4E3B\u52A8\u88C1\u64A4\u6E58\u519B", "summary": '\u540C\u6CBB\u4E09\u5E74\uFF081864\uFF09\u6E58\u519B\u7834\u5929\u4EAC\u540E\uFF0C\u66FE\u56FD\u85E9\u624B\u63E1\u91CD\u5175\u3001\u529F\u76D6\u5929\u4E0B\uFF0C\u671D\u5EF7\u7591\u5FCC\u968F\u4E4B\u800C\u6765\u3002\u4ED6\u4E3B\u52A8\u594F\u8BF7\u88C1\u64A4\u6E58\u519B\u3001\u9063\u6563\u5927\u90E8\uFF0C\u81EA\u91CA\u5175\u6743\u4EE5\u5B89\u671D\u5EF7\uFF0C\u4FDD\u5168\u81EA\u8EAB\u4E0E\u5BB6\u65CF\u3002\u6B64\u4E3A"\u529F\u6210\u8EAB\u9000"\u7684\u5178\u8303\u6289\u62E9\u3002', "fullText": "\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u88C1\u519B\u594F\u758F\u89C1\u300A\u66FE\u56FD\u85E9\u5168\u96C6\xB7\u594F\u7A3F\u300B\u3002", "source": "\u300A\u66FE\u6587\u6B63\u516C\u5E74\u8C31\u300B\u540C\u6CBB\u4E09\u5E74\u3001\u56DB\u5E74\u6761\uFF1B\u300A\u66FE\u56FD\u85E9\u5168\u96C6\xB7\u594F\u7A3F\u300B\uFF08\u88C1\u52C7\u64A4\u519B\u8BF8\u758F\uFF09" }, { "id": "zeng-guofan-18", "personaId": "zeng-guofan", "theme": "\u6BC1\u8A89/\u59D4\u5C48", "title": "\u88C1\u6E58\u8FDB\u6DEE\uFF0C\u6309\u5730\u5F62\u91CD\u5EFA\u519B\u961F", "summary": "\u66FE\u56FD\u85E9\u5E76\u672A\u628A\u6E58\u519B\u5F53\u4F5C\u6C38\u4E45\u79C1\u5175\u3002\u592A\u5E73\u5929\u56FD\u4E3B\u6218\u573A\u7A33\u5B9A\u540E\uFF0C\u4ED6\u8BA4\u4E3A\u6E58\u52C7\u9002\u5408\u5C71\u5730\u3001\u9A70\u9A8B\u5E73\u539F\u4E0D\u8DB3\uFF0C\u4E14\u957F\u671F\u4F5C\u6218\u540E\u519B\u6C14\u6E10\u8870\uFF0C\u4E8E\u662F\u88C1\u6E58\u519B\u3001\u6539\u7EC3\u6DEE\u58EB\uFF0C\u9009\u62E9\u674E\u9E3F\u7AE0\u7B49\u4EBA\u627F\u62C5\u65B0\u7684\u5E73\u539F\u6218\u7EBF\u3002\u8FD9\u5F20\u5361\u80FD\u89E3\u91CA\u4ED6\u4E3A\u4F55\u4E3B\u52A8\u5206\u6563\u519B\u4E8B\u6743\u529B\uFF0C\u4E5F\u80FD\u4E3A\u674E\u9E3F\u7AE0\u4ECE\u5E55\u50DA\u5230\u6DEE\u519B\u7EDF\u5E05\u7684\u8DEF\u5F84\u63D0\u4F9B\u53F2\u5B9E\u8FDE\u63A5\u3002", "fullText": '"\u6E58\u52C7\u5229\u5C71\u5F84\uFF0C\u9A70\u9A8B\u5E73\u539F\u975E\u6240\u957F\uFF0C\u4E14\u7528\u6B66\u5341\u5E74\uFF0C\u6C14\u4EA6\u7A0D\u8870\u77E3\uFF0C\u6545\u6B32\u7EC3\u6DEE\u58EB\u4E3A\u6E58\u52C7\u4E4B\u7EE7\u3002\u81F3\u662F\u4E1C\u5357\u5927\u5B9A\uFF0C\u88C1\u6E58\u519B\uFF0C\u8FDB\u6DEE\u519B\u3002"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u539F\u6587\uFF09', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\u2705" }, { "id": "zeng-guofan-19", "personaId": "zeng-guofan", "theme": "\u6BC1\u8A89/\u59D4\u5C48", "title": "\u5929\u6D25\u6559\u6848\u540E\u8D1F\u8C24\uFF08\u5DF2\u6309\u300A\u6E05\u53F2\u7A3F\u300B\u6821\u6B63\uFF09", "summary": '\u5904\u7406\u5929\u6D25\u6559\u6848\u540E\uFF0C\u66FE\u56FD\u85E9\u88AB\u8206\u8BBA\u65A5\u4E3A"\u5356\u56FD"\uFF0C\u4EAC\u5E08\u58EB\u5927\u592B\u7FA4\u8D77\u653B\u4E4B\u3002\u9762\u5BF9\u65E7\u4EA4\u8D23\u8BA9\uFF0C\u4ED6"\u60DF\u81EA\u5F15\u548E\uFF0C\u4E0D\u4E00\u8FA9"\uFF0C\u81EA\u53F9"\u5185\u8D1F\u795E\u660E\uFF0C\u5916\u8D1F\u6E05\u8BAE"\uFF0C\u75C5\u52BF\u52A0\u91CD\uFF0C\u4E24\u5E74\u540E\uFF08\u540C\u6CBB\u5341\u4E00\u5E74\uFF0C1872\uFF09\u75C5\u901D\u4E8E\u4E24\u6C5F\u603B\u7763\u4EFB\u4E0A\u3002\u6CE8\u610F\uFF1A\u300A\u6E05\u53F2\u7A3F\u300B\u53EA\u8BB0"\u8D1F\u91CD\u8C24\uFF0C\u75BE\u76CA\u5267"\uFF0C**\u4E0D\u80FD\u63A8\u51FA"\u56E0\u6559\u6848\u6291\u90C1\u800C\u6B7B"\u7684\u5355\u4E00\u56E0\u679C**\uFF0C\u5E94\u4FDD\u7559\u8D1F\u8C24\u4E0E\u75C5\u52BF\u52A0\u91CD\uFF0C\u5220\u9664\u8FC7\u5EA6\u5FC3\u7406\u8BCA\u65AD\u3002', "fullText": '"\u56FD\u7C53\u2026\u2026\u60DF\u81EA\u5F15\u548E\uFF0C\u4E0D\u4E00\u8FA9\u4E5F\u3002"\uFF1B\u5BB6\u4E66\u3001\u65E5\u8BB0\u4E2D\u81EA\u8FF0\u5176\u90C1\u6124\u3002', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\uFF1B\u300A\u66FE\u6587\u6B63\u516C\u5E74\u8C31\u300B\u540C\u6CBB\u4E5D\u81F3\u5341\u4E00\u5E74\u6761\uFF1B\u26A0\uFE0F\u5352\u56E0\u4E0D\u4F5C\u5355\u4E00\u56E0\u679C\u65AD\u8A00" }, { "id": "zeng-guofan-20", "personaId": "zeng-guofan", "theme": "\u6289\u62E9/\u53BB\u7559", "title": "\u5B88\u5236\u4E0E\u51FA\u5C71\u2014\u2014\u5949\u65E8\u529E\u56E2\u7EC3\u7684\u6289\u62E9", "summary": '\u54B8\u4E30\u4E8C\u5E74\uFF081852\uFF09\u66FE\u56FD\u85E9\u4E01\u6BCD\u5FE7\u5B88\u5236\uFF0C\u672C\u5E94\u7EC8\u5236\u4E09\u5E74\uFF1B\u54B8\u4E30\u4E03\u5E74\uFF081857\uFF09\u7236\u4E27\u65F6\u4ED6\u53C8\u594F\u8BF7\u7EC8\u5236\uFF0C\u671D\u5EF7\u51C6\u5176\u5728\u7C4D\u5B88\u5236\u3002\u4F46\u56FD\u96BE\u5F53\u5934\uFF0C\u4ED6\u5148\u540E\u4E24\u5EA6\u5949\u65E8\u51FA\u5C71\uFF081853 \u529E\u56E2\u7EC3\u30011858 \u518D\u51FA\u7763\u5E08\uFF09\uFF0C\u5728"\u5B5D"\u4E0E"\u5FE0"\u4E4B\u95F4\u9009\u62E9\u4E86\u4EE5\u5929\u4E0B\u4E8B\u4E3A\u91CD\u3002', "fullText": "\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u4E8B\u89C1\u300A\u5E74\u8C31\u300B\u4E0E\u594F\u758F\u3002", "source": "\u300A\u66FE\u6587\u6B63\u516C\u5E74\u8C31\u300B\u54B8\u4E30\u4E8C\u3001\u4E03\u3001\u516B\u5E74\u6761\uFF1B\u300A\u66FE\u56FD\u85E9\u5168\u96C6\xB7\u594F\u7A3F\u300B\uFF08\u8BF7\u7EC8\u5236\u6298\u7B49\uFF09" }, { "id": "zeng-guofan-21", "personaId": "zeng-guofan", "theme": "\u6289\u62E9/\u53BB\u7559", "title": "\u5B89\u5E86\u56F4\u56F0\u4E2D\u575A\u6301\u6218\u7565\u4E3B\u8F74", "summary": '\u54B8\u4E30\u5341\u5E74\uFF0C\u6C5F\u6D59\u5404\u5730\u544A\u6025\uFF0C\u671D\u5EF7\u548C\u5730\u65B9\u4E0D\u65AD\u8981\u6C42\u63F4\u82CF\u3001\u63F4\u6CAA\u3001\u63F4\u7696\u3001\u63F4\u9547\u6C5F\u3002\u66FE\u56FD\u85E9\u5224\u65AD\u5B89\u5E86\u662F\u8FDB\u53D6\u91D1\u9675\u7684\u524D\u63D0\uFF0C\u62D2\u7EDD\u56E0\u77ED\u671F\u538B\u529B\u64A4\u56F4\u3002\u8FD9\u4E0D\u662F"\u56FA\u6267\u5730\u6253\u5446\u4ED7"\uFF0C\u800C\u662F\u4EE5\u6218\u533A\u4F18\u5148\u7EA7\u7EA6\u675F\u8D44\u6E90\u8C03\u5EA6\uFF1B\u540C\u4E00\u5224\u65AD\u540E\u6765\u6210\u4E3A\u6E58\u519B\u63A8\u8FDB\u7684\u4E3B\u8F74\u3002', "fullText": '"\u5B89\u5E86\u4E00\u519B\u4E3A\u514B\u91D1\u9675\u5F20\u672C\uFF0C\u4E0D\u53EF\u52A8\u4E5F\u3002"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u5F15\u8BED\uFF09', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\u2705\uFF08\u6218\u573A\u51B3\u7B56\u8BED\uFF1B\u539F\u59CB\u594F\u7A3F\u5F85\u6838\uFF09" }, { "id": "zeng-guofan-22", "personaId": "zeng-guofan", "theme": "\u6289\u62E9/\u53BB\u7559", "title": '\u7834\u5929\u4EAC\u540E\u62D2"\u529D\u8FDB"\uFF0C\u575A\u51B3\u4E0D\u53D6\u5929\u4E0B', "summary": '\u540C\u6CBB\u4E09\u5E74\uFF081864\uFF09\u6E58\u519B\u7834\u5929\u4EAC\u540E\uFF0C\u6E58\u7CFB\u52BF\u529B\u5982\u65E5\u4E2D\u5929\uFF0C\u91CE\u53F2\u7B14\u8BB0\u591A\u6709\u90E8\u5C06"\u529D\u8FDB"\u4E4B\u8BF4\u3002\u66FE\u56FD\u85E9\u4EE5"\u501A\u5929\u7167\u6D77\u82B1\u65E0\u6570\uFF0C\u6D41\u6C34\u9AD8\u5C71\u5FC3\u81EA\u77E5"\u660E\u5FD7\uFF0C\u575A\u51B3\u4E0D\u53D6\u5929\u4E0B\uFF0C\u968F\u5373\u81EA\u8BF7\u88C1\u519B\uFF0C\u606A\u5B88\u81E3\u8282\u3002\u26A0\uFE0F"\u529D\u8FDB"\u672C\u4E8B\u591A\u6765\u81EA\u7B14\u8BB0\u4E0E\u540E\u4E16\u53D9\u8FF0\uFF0C\u4E0D\u5F97\u4E0E\u88C1\u519B\u594F\u758F\u3001\u5C01\u7235\u7B49\u4E00\u5E76\u5199\u6210\u5DF2\u8BC1\u5B9E\u7684"\u62D2\u5E1D"\u4E8B\u4EF6\u3002', "fullText": '"\u501A\u5929\u7167\u6D77\u82B1\u65E0\u6570\uFF0C\u6D41\u6C34\u9AD8\u5C71\u5FC3\u81EA\u77E5\u3002"\uFF08\u26A0\uFE0F\u96C6\u53E5\u8054\uFF0C\u591A\u51FA\u91CE\u53F2\u7B14\u8BB0\uFF0C\u89C1 D \u8282\u8003\u636E\uFF09', "source": '\u901A\u884C\u89C1\u4E8E\u91CE\u53F2\u7B14\u8BB0\u4E0E\u300A\u80FD\u9759\u5C45\u65E5\u8BB0\u300B\u7C7B\u8BB0\u5F55\uFF1B\u26A0\uFE0F"\u529D\u8FDB"\u672C\u4E8B\u5B66\u754C\u6709\u4E89\u8BAE\uFF0C\u5F55\u5165\u987B\u6CE8\u660E' }, { "id": "zeng-guofan-23", "personaId": "zeng-guofan", "theme": "\u6289\u62E9/\u53BB\u7559", "title": "\u62D2\u7EDD\u5217\u5F3A\u501F\u5175\u800C\u652F\u6301\u673A\u5668\u4E0E\u7559\u5B66", "summary": '\u91D1\u9675\u672A\u4E0B\u65F6\uFF0C\u4FC4\u3001\u7F8E\u3001\u82F1\u3001\u6CD5\u66FE\u63D0\u51FA\u4EE5\u5175\u52A9\u6E05\u5EF7\uFF0C\u66FE\u56FD\u85E9\u5A49\u62D2\uFF1B\u5728\u671D\u5EF7\u8BA8\u8BBA\u8D2D\u4E70\u673A\u5668\u3001\u8239\u68B0\u65F6\uFF0C\u4ED6\u53C8\u529B\u4E3B\u63A8\u8FDB\uFF0C\u5E76\u5EFA\u8BAE\u9009\u5B66\u7AE5\u8D74\u6B27\u6D32\u5B66\u4E60\u6280\u672F\u3002\u8FD9\u4E2A\u7EC4\u5408\u6BD4"\u66FE\u56FD\u85E9\u521B\u529E\u6C5F\u5357\u5236\u9020\u603B\u5C40"\u66F4\u51C6\u786E\uFF1A\u4ED6\u5728\u4E3B\u6743\u8FB9\u754C\u4E0A\u62D2\u7EDD\u5916\u5175\uFF0C\u5728\u6280\u672F\u80FD\u529B\u4E0A\u4E3B\u5F20\u5B66\u4E60\u3002', "fullText": '"\u4FC4\u3001\u7F8E\u3001\u82F1\u3001\u6CD5\u7686\u8BF7\u4EE5\u5175\u52A9\uFF0C\u56FD\u7C53\u5A49\u62D2\u4E4B\u3002\u53CA\u5EF7\u8BAE\u8D2D\u673A\u8F6E\uFF0C\u7F6E\u8239\u68B0\uFF0C\u5219\u529B\u8D5E\u5176\u6210\uFF0C\u590D\u5EFA\u8BAE\u9009\u5B66\u7AE5\u4E60\u827A\u6B27\u6D32\u3002"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u539F\u6587\uFF09', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\u2705\uFF08\u5177\u4F53\u673A\u6784\u6CBF\u9769\u9700\u53E6\u67E5\u6D0B\u52A1\u53F2\u6599\uFF09" }, { "id": "zeng-guofan-24", "personaId": "zeng-guofan", "theme": "\u4FEE\u517B/\u4E8B\u4E0A\u78E8", "title": '\u5B9A"\u65E5\u8BFE\u5341\u4E8C\u6761"\uFF0C\u7EC8\u8EAB\u884C\u4E4B', "summary": '\u9053\u5149\u4E8C\u5341\u4E8C\u5E74\uFF081842\uFF09\u66FE\u56FD\u85E9\u4E09\u5341\u4E00\u5C81\uFF0C\u7ACB\u5FD7\u6548\u6CD5\u524D\u8D24\uFF0C\u81EA\u5B9A"\u65E5\u8BFE\u5341\u4E8C\u6761"\uFF08\u4E3B\u656C\u3001\u9759\u5750\u3001\u65E9\u8D77\u3001\u8BFB\u4E66\u4E0D\u4E8C\u3001\u8BFB\u53F2\u3001\u8C28\u8A00\u3001\u517B\u6C14\u3001\u4FDD\u8EAB\u3001\u65E5\u77E5\u6240\u4EA1\u3001\u6708\u65E0\u5FD8\u6240\u80FD\u3001\u4F5C\u5B57\u3001\u591C\u4E0D\u51FA\u95E8\uFF09\uFF0C\u81EA\u6B64\u7EC8\u8EAB\u5949\u884C\u4E0D\u8F8D\uFF0C\u65E0\u8BBA\u519B\u52A1\u5025\u506C\u3001\u516C\u52A1\u7E41\u5267\u7686\u4E0D\u5E9F\u3002\u8FD9\u662F\u4ED6"\u4EE5\u62D9\u81EA\u4FEE"\u7684\u6838\u5FC3\u5DE5\u592B\u3002', "fullText": "\u65E5\u8BFE\u5341\u4E8C\u6761\u4E4B\u6587\u89C1\u65E5\u8BB0\u4E0E\u300A\u6C42\u9619\u658B\u65E5\u8BB0\u7C7B\u949E\u300B\u3002", "source": "\u300A\u66FE\u56FD\u85E9\u5168\u96C6\xB7\u65E5\u8BB0\u300B\u9053\u5149\u4E8C\u5341\u4E8C\u5E74\uFF1B\u300A\u6C42\u9619\u658B\u65E5\u8BB0\u7C7B\u949E\u300B" }, { "id": "zeng-guofan-25", "personaId": "zeng-guofan", "theme": "\u4FEE\u517B/\u4E8B\u4E0A\u78E8", "title": "\u65E5\u8BB0\u81EA\u7701\uFF0C\u6212\u70DF\u6212\u8272\u6212\u8A00\u8FC7\u591A", "summary": '\u7ACB\u5FD7\u4E4B\u5E74\uFF0C\u66FE\u56FD\u85E9\u4EE5\u65E5\u8BB0\u4E3A"\u7167\u5996\u955C"\uFF0C\u9010\u65E5\u8BB0\u5F55\u8FC7\u5931\uFF1A\u6212\u70DF\u3001\u6212\u8272\u3001\u6212\u8A00\u8FC7\u591A\uFF0C\u65E5\u8BB0\u4E2D\u5C61\u5C61\u75DB\u65A5\u81EA\u5DF1"\u771F\u79BD\u517D\u77E3"\uFF0C\u4EE5\u8FD1\u4E4E\u81EA\u8650\u7684\u514B\u5DF1\u5DE5\u592B\u6539\u8FC7\u8FC1\u5584\u3002\u5176\u81EA\u5F8B\u4E4B\u4E25\u5728\u665A\u6E05\u540D\u81E3\u4E2D\u7F55\u89C1\u3002\u6CE8\u610F\uFF1A\u65E5\u8BB0\u4E2D"\u6212\u70DF"\u4E0D\u80FD\u76F4\u63A5\u7B49\u540C"\u6212\u9E26\u7247"\uFF0C\u9700\u770B\u539F\u6587\u8BED\u5883\u3002', "fullText": '\u9053\u5149\u4E8C\u5341\u4E8C\u5E74\u65E5\u8BB0\u81EA\u9A82\u8BED\uFF08"\u771F\u79BD\u517D\u77E3"\u7C7B\uFF09\uFF0C\u89C1\u300A\u66FE\u56FD\u85E9\u5168\u96C6\xB7\u65E5\u8BB0\u300B\u3002', "source": '\u300A\u66FE\u56FD\u85E9\u5168\u96C6\xB7\u65E5\u8BB0\u300B\u9053\u5149\u4E8C\u5341\u4E8C\u3001\u4E8C\u5341\u4E09\u5E74\uFF1B\u26A0\uFE0F"\u6212\u70DF"\u5BF9\u8C61\uFF08\u9E26\u7247\u4E0E\u5426\uFF09\u9700\u6838\u539F\u6587\u8BED\u5883' }, { "id": "zeng-guofan-26", "personaId": "zeng-guofan", "theme": "\u4FEE\u517B/\u4E8B\u4E0A\u78E8", "title": '"\u83AB\u95EE\u6536\u83B7\uFF0C\u4F46\u95EE\u8015\u8018"\u2014\u2014\u5C3D\u6027\u77E5\u547D\u7684\u81EA\u52C9', "summary": '\u66FE\u56FD\u85E9\u4E00\u751F\u4E3B\u5F20"\u5C3D\u4EBA\u4E8B\u3001\u542C\u5929\u547D"\uFF0C\u4EE5"\u83AB\u95EE\u6536\u83B7\uFF0C\u4F46\u95EE\u8015\u8018"\u81EA\u52C9\u81EA\u52B1\uFF0C\u65E0\u8BBA\u79D1\u573A\u5931\u610F\u3001\u6218\u573A\u60E8\u8D25\u8FD8\u662F\u671D\u5802\u653B\u8BA6\uFF0C\u7686\u4EE5\u6B64\u8BED\u652F\u6491"\u53EA\u95EE\u8015\u8018\u3001\u4E0D\u95EE\u7ED3\u679C"\u7684\u5B9A\u529B\u3002', "fullText": '"\u4E0D\u4E3A\u5723\u8D24\uFF0C\u4FBF\u4E3A\u79BD\u517D\uFF1B\u83AB\u95EE\u6536\u83B7\uFF0C\u4F46\u95EE\u8015\u8018\u3002"\uFF08\u26A0\uFE0F\u901A\u884C\u4F5C\u66FE\u56FD\u85E9\u8054\u8BED/\u5EA7\u53F3\u94ED\uFF0C\u7CBE\u786E\u51FA\u5904\u5F85\u6838\uFF09', "source": "\u901A\u884C\u89C1\u4E8E\u300A\u66FE\u56FD\u85E9\u5168\u96C6\u300B\u76F8\u5173\u8F91\u5F55\u4E0E\u4F20\u8BB0\uFF1B\u26A0\uFE0F\u6587\u5B57\u4E0E\u51FA\u5904\u7248\u672C\u4E0D\u4E00\uFF0C\u5F55\u5165\u987B\u6CE8\u660E" }, { "id": "zeng-guofan-27", "personaId": "zeng-guofan", "theme": "\u5F85\u4EBA/\u7528\u4EBA", "title": "\u8BC6\u4EBA\u7528\u4EBA\uFF0C\u5E55\u5E9C\u4EBA\u624D\u6D4E\u6D4E", "summary": '\u66FE\u56FD\u85E9\u4EE5\u8BC6\u4EBA\u3001\u7528\u4EBA\u8457\u79F0\uFF0C\u5176\u5E55\u5E9C\u53F7\u79F0"\u665A\u6E05\u7B2C\u4E00\u5E55\u5E9C"\uFF0C\u674E\u9E3F\u7AE0\u3001\u5DE6\u5B97\u68E0\u3001\u5F6D\u7389\u9E9F\u3001\u80E1\u6797\u7FFC\u3001\u674E\u7EED\u5BBE\u3001\u7F57\u6CFD\u5357\u7B49\u6E58\u7CFB\u5C06\u5E05\u591A\u51FA\u5176\u95E8\u4E0B\u6216\u4E0E\u4E4B\u5171\u4E8B\u3002\u4ED6\u9009\u4EBA\u91CD"\u6734\u5B9E\u5EC9\u4ECB"\uFF0C\u4E0D\u53D6\u6D6E\u534E\u5DE7\u8BC8\u4E4B\u8F88\u3002', "fullText": '\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B"\u4E2D\u5174\u5C06\u76F8\uFF0C\u4EC0\u4E5D\u6E56\u6E58"\u4E3A\u540E\u4E16\u8BC4\u4EF7\u8BED\uFF0C\u975E\u66FE\u56FD\u85E9\u539F\u8BDD\u3002', "source": '\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\uFF1B\u859B\u798F\u6210\u300A\u5EB8\u5EB5\u7B14\u8BB0\u300B\u7B49\u5E55\u50DA\u7B14\u8BB0\uFF1B\u26A0\uFE0F"\u4EC0\u4E5D\u6E56\u6E58"\u4E3A\u540E\u4E16\u6982\u62EC' }, { "id": "zeng-guofan-28", "personaId": "zeng-guofan", "theme": "\u5F85\u4EBA/\u7528\u4EBA", "title": "\u4EE5\u793C\u8D24\u6269\u5145\u6E58\u519B\u4EBA\u624D\u7F51\u7EDC", "summary": '\u6E58\u52C7\u521D\u5EFA\u65F6\uFF0C\u66FE\u56FD\u85E9\u5E7F\u53D1\u4E66\u4FE1\u5EF6\u63FD\u4EBA\u624D\uFF0C\u5BF9\u5730\u4F4D\u5351\u5FAE\u8005\u4E5F\u4EE5\u5E73\u7B49\u793C\u6570\u76F8\u5F85\u3002\u5C71\u91CE\u95F4\u6709\u624D\u667A\u8005\u56E0\u6B64\u613F\u610F\u6295\u5954\u5E76\u4E0E\u4ED6\u8BAE\u4E8B\uFF0C\u5F62\u6210\u540E\u6765\u6E58\u519B\u5E55\u5E9C\u548C\u5C06\u9886\u7F51\u7EDC\u7684\u65E9\u671F\u57FA\u7840\u3002\u6750\u6599\u652F\u6301"\u793C\u8D24\u3001\u8BC6\u4EBA"\u8FD9\u4E00\u4EBA\u683C\u7279\u5F81\uFF0C\u4F46\u4E0D\u652F\u6301\u628A"\u4E2D\u5174\u5C06\u76F8\uFF0C\u4EC0\u4E5D\u6E56\u6E58"\u5F53\u4F5C\u66FE\u6C0F\u539F\u8BDD\u3002', "fullText": '"\u817E\u4E66\u9050\u8FE9\uFF0C\u867D\u5351\u8D31\u4E0E\u94A7\u793C\u3002\u5C71\u91CE\u6750\u667A\u4E4B\u58EB\u611F\u5176\u8BDA\uFF0C\u83AB\u4E0D\u5F80\u89C1\uFF0C\u4EBA\u4EBA\u7686\u4EE5\u66FE\u516C\u53EF\u4E0E\u8A00\u4E8B\u3002"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u539F\u6587\uFF09', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\u2705\uFF08\u540E\u4E16\u8BC4\u4EF7\u8BED\u4E0E\u6B64\u5361\u53F2\u5B9E\u5206\u5F00\uFF09" }, { "id": "zeng-guofan-29", "personaId": "zeng-guofan", "theme": "\u5F85\u4EBA/\u7528\u4EBA", "title": '\u5F85\u5F1F\u6781\u4E25\uFF0C\u5BB6\u4E66\u8C06\u8C06\u6212"\u9A84\u60F0"', "summary": '\u66FE\u56FD\u85E9\u4E0E\u8BF8\u5F1F\uFF08\u5C24\u5176\u4E5D\u5F1F\u66FE\u56FD\u8343\uFF09\u4E66\u4FE1\u5F80\u590D\u6781\u5BC6\uFF0C\u5E38\u4EE5"\u9A84"\u4E0E"\u60F0"\u4E3A\u6212\uFF0C\u544A\u8BEB\u529F\u6210\u4E4B\u65E5\u66F4\u8981\u6212\u9A84\u6212\u60F0\u3001\u5B88\u6734\u5B88\u62D9\u3002\u4ED6\u5BF9\u5BB6\u65CF\u5B50\u5F1F\u7684\u8981\u6C42\u4E4B\u4E25\uFF0C\u96C6\u4E2D\u4F53\u73B0\u5728\u300A\u66FE\u56FD\u85E9\u5BB6\u4E66\u300B\u4E2D\u3002', "fullText": '"\u5BB6\u8D25\u79BB\u4E0D\u5F97\u4E2A\u5962\u5B57\uFF0C\u4EBA\u8D25\u79BB\u4E0D\u5F97\u4E2A\u9038\u5B57\uFF0C\u8BA8\u4EBA\u5ACC\u79BB\u4E0D\u5F97\u4E2A\u9A84\u5B57\u3002"\uFF08\u901A\u884C\u5F15\u4F5C\u66FE\u56FD\u85E9\u8BED\uFF09', "source": "\u300A\u66FE\u56FD\u85E9\u5168\u96C6\xB7\u5BB6\u4E66\u300B\uFF08\u81F4\u8BF8\u5F1F\u8BF8\u4E66\uFF09\uFF1B\u26A0\uFE0F\u7CBE\u786E\u7BC7\u76EE\u5F85\u6838" }, { "id": "zeng-guofan-30", "personaId": "zeng-guofan", "theme": "\u5F85\u4EBA/\u7528\u4EBA", "title": "\u4E34\u7EC8\u9057\u5631\u56DB\u6761\u2014\u2014\u614E\u72EC\u3001\u4E3B\u656C\u3001\u6C42\u4EC1\u3001\u4E60\u52B3", "summary": '\u540C\u6CBB\u5341\u4E00\u5E74\u4E8C\u6708\u521D\u56DB\uFF081872\u5E743\u670812\u65E5\uFF09\u66FE\u56FD\u85E9\u75C5\u901D\u4E8E\u4E24\u6C5F\u603B\u7763\u7F72\uFF0C\u4E34\u7EC8\u524D\u4E3A\u5B50\u5B59\u7559\u4E0B\u9057\u5631\u56DB\u6761\uFF1A"\u614E\u72EC\u5219\u5FC3\u5B89\uFF0C\u4E3B\u656C\u5219\u8EAB\u5F3A\uFF0C\u6C42\u4EC1\u5219\u4EBA\u60A6\uFF0C\u4E60\u52B3\u5219\u795E\u94A6\u3002"\u4EE5\u4E00\u751F\u7684\u4FEE\u517B\u5DE5\u592B\u4E3A\u5BB6\u8BAD\uFF0C\u5631\u540E\u4EBA\u5B88\u6B64\u56DB\u6761\u3002', "fullText": '"\u614E\u72EC\u5219\u5FC3\u5B89\uFF0C\u4E3B\u656C\u5219\u8EAB\u5F3A\uFF0C\u6C42\u4EC1\u5219\u4EBA\u60A6\uFF0C\u4E60\u52B3\u5219\u795E\u94A6\u3002"', "source": "\u300A\u66FE\u56FD\u85E9\u5168\u96C6\u300B\u6240\u6536\u9057\u5631\uFF08\u5BB6\u8BAD\u7C7B\uFF09\uFF1B\u300A\u66FE\u6587\u6B63\u516C\u5BB6\u8BAD\u300B\u901A\u884C\u672C" }, { "id": "zeng-guofan-31", "personaId": "zeng-guofan", "theme": "\u4E3A\u5B66/\u81EA\u4FEE", "title": '\u5341\u5E74\u4E03\u8FC1\uFF0C\u4EE5"\u52E4\u656C"\u81F4\u663E\u8FBE', "summary": '\u9053\u5149\u5341\u516B\u5E74\uFF081838\uFF09\u66FE\u56FD\u85E9\u4E2D\u8FDB\u58EB\u3001\u70B9\u7FF0\u6797\u540E\uFF0C\u5341\u5E74\u95F4\u4E03\u6B21\u5347\u8FC1\uFF0C\u8FDE\u5347\u5341\u7EA7\uFF0C\u7531\u7FF0\u6797\u800C\u4F8D\u90CE\uFF08\u793C\u3001\u5175\u3001\u540F\u90E8\uFF09\uFF0C\u65F6\u4EBA\u76EE\u4E3A\u5F02\u6570\u3002\u4ED6\u81EA\u8FF0\u9760\u7684\u662F"\u52E4"\u4E0E"\u656C"\uFF0C\u522B\u65E0\u6377\u5F84\uFF0C\u662F\u5176"\u4EE5\u62D9\u80DC\u5DE7"\u5728\u4ED5\u9014\u7684\u5370\u8BC1\u3002', "fullText": "\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u4E8B\u89C1\u300A\u5E74\u8C31\u300B\u4E0E\u300A\u6E05\u53F2\u7A3F\u300B\u3002", "source": "\u300A\u66FE\u6587\u6B63\u516C\u5E74\u8C31\u300B\u9053\u5149\u5341\u516B\u81F3\u4E8C\u5341\u516B\u5E74\u6761\uFF1B\u300A\u6E05\u53F2\u7A3F\u300B\u5377405" }, { "id": "zeng-guofan-32", "personaId": "zeng-guofan", "theme": "\u4E3A\u5B66/\u81EA\u4FEE", "title": '\u4ECE\u5510\u9274\u3001\u502D\u4EC1\u6CBB\u5B66\uFF0C\u628A"\u7528\u4EBA"\u5217\u4E3A\u56FD\u4E8B\u9996\u52A1', "summary": '\u66FE\u56FD\u85E9\u5165\u7FF0\u6797\u540E\u5728\u4EAC\u5E08\u4ECE\u592A\u5E38\u5BFA\u537F\u5510\u9274\u8BB2\u5B66\uFF0C\u4E0E\u502D\u4EC1\u3001\u5434\u5EF7\u680B\u3001\u4F55\u6842\u73CD\u7B49\u7814\u4E60\u4E49\u7406\u4E4B\u5B66\uFF0C\u540C\u65F6\u7ED3\u4EA4\u6885\u66FE\u4EAE\u7B49\u6587\u58EB\uFF0C\u7279\u522B\u7559\u5FC3\u5929\u4E0B\u4EBA\u624D\u3002\u54B8\u4E30\u521D\u5E74\uFF0C\u4ED6\u5728\u5E94\u8BCF\u9648\u8A00\u4E2D\u628A"\u4ECA\u65E5\u6025\u52A1\uFF0C\u9996\u5728\u7528\u4EBA"\u7F6E\u4E8E\u9996\u4F4D\uFF0C\u5E76\u63D0\u51FA\u4EBA\u624D\u9700\u8981\u8F6C\u79FB\u3001\u57F9\u517B\u3001\u8003\u5BDF\u3002\u7531\u6B64\u53EF\u89C1\uFF0C\u4ED6\u7684\u7406\u5B66\u5E76\u975E\u8131\u79BB\u884C\u653F\uFF0C\u800C\u662F\u4ECE\u4FEE\u8EAB\u3001\u8BC6\u4EBA\u843D\u5230\u5236\u5EA6\u4E0E\u4EFB\u4E8B\u3002', "fullText": '"\u56FD\u7C53\u4E0E\u502D\u4EC1\u3001\u5434\u5EF7\u680B\u3001\u4F55\u6842\u73CD\u4E25\u4E8B\u4E4B\uFF0C\u6CBB\u4E49\u7406\u4E4B\u5B66\u2026\u2026\u5C24\u7559\u5FC3\u5929\u4E0B\u4EBA\u6750\u3002"\uFF1B"\u594F\u9648\u4ECA\u65E5\u6025\u52A1\uFF0C\u9996\u5728\u7528\u4EBA\uFF0C\u4EBA\u624D\u6709\u8F6C\u79FB\u4E4B\u9053\uFF0C\u6709\u57F9\u517B\u4E4B\u65B9\uFF0C\u6709\u8003\u5BDF\u4E4B\u6CD5\u3002"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u5F15\u8BED\uFF09', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\u2705\uFF08\u4F20\u6587\u660E\u786E\u5F15\u8FF0\uFF1B\u5165\u5E93\u8BED\u5F55\u4ECD\u5E94\u56DE\u300A\u66FE\u56FD\u85E9\u5168\u96C6\xB7\u594F\u7A3F\u300B\u6838\u7BC7\u76EE\uFF09" }, { "id": "zeng-guofan-33", "personaId": "zeng-guofan", "theme": "\u4E3A\u5B66/\u81EA\u4FEE", "title": "\u6CBB\u5B66\u4E09\u53D8\u2014\u2014\u7406\u5B66\u2192\u7533\u97E9\u2192\u9EC4\u8001", "summary": '\u66FE\u56FD\u85E9\u65E9\u5E74\u5728\u4EAC\u5E08\u4ECE\u5510\u9274\u3001\u502D\u4EC1\u4E60\u7A0B\u6731\u7406\u5B66\uFF0C\u4EE5"\u4E49\u7406"\u4E3A\u672C\uFF1B\u4E2D\u5E74\u6CBB\u519B\u7528\u7533\u97E9\u5211\u540D\u4E4B\u672F\u6D4E\u4E4B\uFF1B\u665A\u5E74\u5219\u5F52\u4E8E\u9EC4\u8001\u6E05\u9759\u4E4B\u9053\u3002\u6B64"\u4E09\u53D8"\u8D2F\u7A7F\u5176\u4E00\u751F\uFF0C\u662F\u5176\u5904\u4E16\u54F2\u5B66\u7531\u4E25\u523B\u8D8B\u4E8E\u5706\u878D\u7684\u5185\u5728\u8F68\u8FF9\uFF08\u6B64\u8BF4\u6E90\u4E8E\u7B14\u8BB0\u4E0E\u540E\u4E16\u7814\u7A76\u6982\u62EC\uFF09\u3002', "fullText": '\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B"\u4E09\u53D8"\u4E3A\u540E\u4EBA\u5BF9\u7B14\u8BB0\u8BB0\u8F7D\u7684\u6982\u62EC\u3002', "source": '\u6B27\u9633\u5146\u718A\u300A\u6C34\u7A97\u6625\u5453\u300B\u76F8\u5173\u8BB0\u8F7D\uFF1B\u540E\u4E16\u7814\u7A76\uFF1B\u26A0\uFE0F"\u4E09\u53D8"\u4E3A\u6982\u62EC\u8BED\uFF0C\u975E\u672C\u4EBA\u81EA\u8FF0' }, { "id": "zeng-guofan-34", "personaId": "zeng-guofan", "theme": "\u4E3A\u5B66/\u81EA\u4FEE", "title": "\u529B\u5021\u6D0B\u52A1\u81EA\u5F3A\uFF1A\u8D2D\u673A\u8F6E\u3001\u7F6E\u8239\u68B0\u3001\u9009\u5B66\u7AE5\uFF08\u5DF2\u6309\u300A\u6E05\u53F2\u7A3F\u300B\u6821\u6B63\uFF09", "summary": '\u540C\u6CBB\u5E74\u95F4\u66FE\u56FD\u85E9\u5728\u527F\u5E73\u592A\u5E73\u5929\u56FD\u4E4B\u540E\uFF0C\u529B\u4E3B"\u5E08\u5937\u667A\u4EE5\u9020\u70AE\u5236\u8239"\uFF1A\u521B\u8BBE\u5B89\u5E86\u5185\u519B\u68B0\u6240\uFF0C\u5EF7\u8BAE\u8D2D\u673A\u8F6E\u3001\u7F6E\u8239\u68B0\u65F6\u529B\u8D5E\u5176\u6210\uFF0C\u5E76\u5EFA\u8BAE\u9009\u5B66\u7AE5\u8D74\u6B27\u4E60\u827A\uFF0C\u652F\u6301\u5BB9\u95F3\u3001\u5F90\u5BFF\u3001\u534E\u8605\u82B3\u7B49\u5F00\u5C55\u6D0B\u52A1\u3002**\u6CE8\u610F**\uFF1A\u6C5F\u5357\u5236\u9020\u603B\u5C40\u7684\u5B8C\u6574\u6CBF\u9769\u6D89\u53CA\u674E\u9E3F\u7AE0\u7B49\u540E\u7EED\u673A\u6784\uFF0C\u4E0D\u5E94\u628A\u673A\u6784\u521B\u5EFA\u5168\u90E8\u5F52\u66FE\u56FD\u85E9\uFF1B\u672C\u5361\u53EA\u8BB0\u66FE\u56FD\u85E9\u660E\u786E\u652F\u6301\u7684"\u8D2D\u673A\u3001\u9020\u68B0\u3001\u7559\u5B66"\u5021\u8BAE\u3002', "fullText": '\u65E0\u7EDF\u4E00\u8BED\u5F55\uFF1B\u4E8B\u89C1\u300A\u5E74\u8C31\u300B\u4E0E\u76F8\u5173\u594F\u7A3F\uFF1B"\u4FC4\u3001\u7F8E\u3001\u82F1\u3001\u6CD5\u7686\u8BF7\u4EE5\u5175\u52A9\uFF0C\u56FD\u7C53\u5A49\u62D2\u4E4B\u3002\u53CA\u5EF7\u8BAE\u8D2D\u673A\u8F6E\uFF0C\u7F6E\u8239\u68B0\uFF0C\u5219\u529B\u8D5E\u5176\u6210\uFF0C\u590D\u5EFA\u8BAE\u9009\u5B66\u7AE5\u4E60\u827A\u6B27\u6D32\u3002"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u539F\u6587\uFF09', "source": "\u300A\u66FE\u6587\u6B63\u516C\u5E74\u8C31\u300B\u540C\u6CBB\u5E74\u95F4\u6761\uFF1B\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\uFF1B\u300A\u66FE\u56FD\u85E9\u5168\u96C6\xB7\u594F\u7A3F\u300B\u76F8\u5173\u594F\u758F\u2705" }, { "id": "zeng-guofan-35", "personaId": "zeng-guofan", "theme": "\u4E3A\u5B66/\u81EA\u4FEE", "title": "\u6218\u540E\u8BBE\u5B98\u4E66\u5C40\u590D\u5174\u6587\u6559", "summary": '\u5929\u6D25\u6559\u6848\u540E\u8C03\u56DE\u4E24\u6C5F\uFF0C\u66FE\u56FD\u85E9\u9762\u5BF9\u6218\u4E71\u9020\u6210\u7684\u7ECF\u7C4D\u6563\u4F5A\uFF0C\u8BBE\u5B98\u4E66\u5C40\u520A\u5370\u3001\u6821\u52D8\uFF0C\u5E76\u793C\u8058\u540D\u5112\u4E3B\u6301\u4E66\u9662\u3002\u8BE5\u884C\u52A8\u628A"\u597D\u6587\u3001\u6CBB\u5B66"\u8F6C\u5316\u4E3A\u516C\u5171\u6587\u5316\u57FA\u7840\u8BBE\u65BD\uFF0C\u8865\u8DB3"\u4E2A\u4EBA\u8BFB\u4E66"\u4E4B\u5916\u7684\u6CBB\u7406\u9762\u5411\u3002\u6B64\u5361\u4E0D\u7B49\u540C\u4E8E"\u66FE\u56FD\u85E9\u4EB2\u8457\u5168\u90E8\u5178\u7C4D"\uFF0C\u800C\u662F\u6CBB\u7406\u8005\u5BF9\u77E5\u8BC6\u751F\u4EA7\u4E0E\u6559\u80B2\u7684\u6295\u5165\u3002', "fullText": '"\u4EE5\u4E71\u540E\u7ECF\u7C4D\u5C31\u71B8\uFF0C\u8BBE\u5B98\u4E66\u5C40\u5370\u884C\uFF0C\u6821\u520A\u7686\u7CBE\u5BA1\u3002\u793C\u8058\u540D\u5112\u4E3A\u4E66\u9662\u5C71\u957F\u3002"\uFF08\u300A\u6E05\u53F2\u7A3F\u300B\u539F\u6587\uFF09', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B\u2705" }], "quotes": [{ "id": "zeng-guofan-q01", "personaId": "zeng-guofan", "text": '"\u552F\u5929\u4E0B\u4E4B\u81F3\u8BDA\u80FD\u80DC\u5929\u4E0B\u4E4B\u81F3\u4F2A\uFF0C\u552F\u5929\u4E0B\u4E4B\u81F3\u62D9\u80FD\u80DC\u5929\u4E0B\u4E4B\u81F3\u5DE7\u3002"', "source": "\u300A\u66FE\u56FD\u85E9\u5168\u96C6\xB7\u5BB6\u4E66\u300B\uFF08\u901A\u884C\u5F15\u4F5C\u66FE\u56FD\u85E9\u8BED\uFF1B\u7F51\u7EDC\u901A\u884C\u4F5C\u81F4\u5F1F\u4E66\u7C7B\uFF0C\u7CBE\u786E\u7BC7\u76EE/\u5E74\u4EFD\u5F85\u6838\uFF09", "keywords": ["\u8BDA", "\u62D9"], "credibility": "\u26A0\uFE0F", "note": "\u5F85\u6838\uFF08\u601D\u60F3\u53EF\u9760\uFF0C\u7CBE\u786E\u7BC7\u76EE\u5F85\u843D\uFF09" }, { "id": "zeng-guofan-q02", "personaId": "zeng-guofan", "text": '"\u83AB\u95EE\u6536\u83B7\uFF0C\u4F46\u95EE\u8015\u8018\u3002"', "source": '\u901A\u884C\u4F5C\u66FE\u56FD\u85E9\u5EA7\u53F3\u94ED/\u8054\u8BED\uFF08"\u4E0D\u4E3A\u5723\u8D24\uFF0C\u4FBF\u4E3A\u79BD\u517D\uFF1B\u83AB\u95EE\u6536\u83B7\uFF0C\u4F46\u95EE\u8015\u8018"\uFF09\uFF1B\u6709\u8003\u8BC1\u6587\u7AE0\u79F0"\u771F\u51FA\u81EA\u66FE\u56FD\u85E9"\uFF0C\u4F46\u300A\u5168\u96C6\u300B\u7CBE\u786E\u7BC7\u76EE\u4ECD\u5F85\u6838', "keywords": ["\u5C3D\u4EBA\u4E8B", "\u81EA\u52C9"], "credibility": "\u26A0\uFE0F", "note": "\u5F85\u6838\uFF08\u51FA\u5904\u4E0E\u6587\u5B57\u7248\u672C\u4E0D\u4E00\uFF09" }, { "id": "zeng-guofan-q03", "personaId": "zeng-guofan", "text": '"\u614E\u72EC\u5219\u5FC3\u5B89\uFF0C\u4E3B\u656C\u5219\u8EAB\u5F3A\uFF0C\u6C42\u4EC1\u5219\u4EBA\u60A6\uFF0C\u4E60\u52B3\u5219\u795E\u94A6\u3002"', "source": "\u300A\u66FE\u56FD\u85E9\u5168\u96C6\u300B\u6240\u6536\u9057\u5631\uFF08\u5BB6\u8BAD\u7C7B\uFF09", "keywords": ["\u9057\u5631", "\u4FEE\u517B"], "credibility": "\u2705", "note": "\u53EF\u9760" }, { "id": "zeng-guofan-q04", "personaId": "zeng-guofan", "text": '"\u5BB6\u8D25\u79BB\u4E0D\u5F97\u4E2A\u5962\u5B57\uFF0C\u4EBA\u8D25\u79BB\u4E0D\u5F97\u4E2A\u9038\u5B57\uFF0C\u8BA8\u4EBA\u5ACC\u79BB\u4E0D\u5F97\u4E2A\u9A84\u5B57\u3002"', "source": '\u300A\u66FE\u56FD\u85E9\u5BB6\u4E66\xB7\u81F4\u56DB\u5F1F\u300B\uFF08\u901A\u884C\u672C\u7F16\u53F792\u81F4\u56DB\u5F1F\uFF0C\u7BC7\u9898"\u6559\u5B50\u4F84\u5B9C\u6212\u9A84\u5962\u4F5A"\u7C7B\uFF09', "keywords": ["\u6212\u5962", "\u6212\u9038", "\u6212\u9A84"], "credibility": "\u26A0\uFE0F", "note": "\u5F85\u6838\uFF08\u5DF2\u5B9A\u4F4D\u81F4\u56DB\u5F1F\uFF0C\u5177\u4F53\u5E74\u4EFD\u5F85\u6838\uFF09" }, { "id": "zeng-guofan-q05", "personaId": "zeng-guofan", "text": '"\u7CBE\u795E\u6108\u7528\u800C\u6108\u51FA\uFF0C\u667A\u6167\u6108\u82E6\u800C\u6108\u660E\u3002"', "source": "\u901A\u884C\u89C1\u300A\u66FE\u56FD\u85E9\u5168\u96C6\xB7\u5BB6\u4E66\u300B\uFF08\u81F4\u8BF8\u5F1F\u4E66\u7C7B\uFF09\uFF0C\u7CBE\u786E\u7BC7\u76EE\u5F85\u6838", "keywords": ["\u52E4", "\u78E8\u70BC"], "credibility": "\u26A0\uFE0F", "note": "\u5F85\u6838" }, { "id": "zeng-guofan-q06", "personaId": "zeng-guofan", "text": '"\u4E66\u852C\u9C7C\u732A\uFF0C\u65E9\u626B\u8003\u5B9D\u3002"', "source": '\u300A\u66FE\u56FD\u85E9\u5BB6\u4E66\xB7\u81F4\u56DB\u5F1F\u300B\uFF08\u7BC7\u9898"\u5C45\u4E61\u8981\u8BC0\u5B9C\u8282\u4FED"\u7C7B\uFF0C\u901A\u884C\u672C\u6536\u4E8E\u6CBB\u5BB6\u7BC7\uFF09', "keywords": ["\u6CBB\u5BB6", "\u52E4\u4FED"], "credibility": "\u2705", "note": "\u53EF\u9760\uFF08\u5DF2\u5B9A\u4F4D\u81F4\u56DB\u5F1F\u6CBB\u5BB6\u7BC7\uFF09", "textNote": "\uFF08\u6CBB\u5BB6\u516B\u5B57\u8BC0\uFF09" }, { "id": "zeng-guofan-q07", "personaId": "zeng-guofan", "text": '"\u5929\u4E0B\u53E4\u4ECA\u4E4B\u5EB8\u4EBA\uFF0C\u7686\u4EE5\u4E00\u60F0\u5B57\u81F4\u8D25\uFF1B\u5929\u4E0B\u53E4\u4ECA\u4E4B\u624D\u4EBA\uFF0C\u7686\u4EE5\u4E00\u50B2\u5B57\u81F4\u8D25\u3002"', "source": "\u300A\u66FE\u56FD\u85E9\u5BB6\u4E66\xB7\u81F4\u6C85\u5F1F\u300B\uFF08\u901A\u884C\u672C\u6536\u4E8E\u81F4\u6C85\u5F1F\u4E66\uFF1B\u7EF4\u57FA\u6587\u5E93\u6709\u300A\u81F4\u6C85\u5F1F\u4E66\u300B\u4F20\u672C\uFF09", "keywords": ["\u6212\u60F0", "\u6212\u50B2"], "credibility": "\u26A0\uFE0F", "note": "\u5F85\u6838\uFF08\u5DF2\u5B9A\u4F4D\u81F4\u6C85\u5F1F\uFF0C\u5177\u4F53\u5E74\u4EFD\u5F85\u6838\uFF09" }, { "id": "zeng-guofan-q08", "personaId": "zeng-guofan", "text": '"\u624E\u786C\u5BE8\uFF0C\u6253\u6B7B\u4ED7\u3002"', "source": "\u540E\u4EBA\u6982\u62EC\u6E58\u519B\u6218\u6CD5\uFF08\u66FE\u56FD\u85E9\u8BBA\u5175\u8BED\u7684\u6982\u62EC\u5F62\u5F0F\uFF09", "keywords": ["\u7A33\u624E\u7A33\u6253", "\u6218\u6CD5"], "credibility": "\u26A0\uFE0F", "note": "\u5F85\u6838\uFF08\u975E\u4E25\u683C\u539F\u8BDD\uFF0C\u7CFB\u6982\u62EC\uFF09" }, { "id": "zeng-guofan-q09", "personaId": "zeng-guofan", "text": '"\u5343\u79CB\u9088\u77E3\u72EC\u7559\u6211\uFF0C\u767E\u6218\u5F52\u6765\u518D\u8BFB\u4E66\u3002"', "source": "\u901A\u884C\u4F5C\u66FE\u56FD\u85E9\u8054\u8BED\uFF08\u8D60\u5F1F/\u81EA\u9898\u8BF8\u8BF4\u5E76\u5B58\uFF0C\u767E\u5EA6\u767E\u79D1\u8BCD\u6761\uFF08https://baike.baidu.com/item/%E5%8D%83%E7%A7%8B%E9%82%88%E7%9F%A3%E7%8B%AC%E7%95%99%E6%88%91/7633257\uFF09\u6709\u6536\u5F55\uFF1B\u8054\u8BED\u51FA\u5904\u5F85\u8003\uFF09", "keywords": ["\u8BFB\u4E66", "\u7ACB\u5FD7"], "credibility": "\u26A0\uFE0F", "note": "\u5F85\u6838\uFF08\u8054\u8BED\u51FA\u5904\u5F85\u8003\uFF09" }, { "id": "zeng-guofan-q10", "personaId": "zeng-guofan", "text": '"\u4E0D\u4E3A\u5723\u8D24\uFF0C\u4FBF\u4E3A\u79BD\u517D\u3002"', "source": '\u901A\u884C\u4F5C\u66FE\u56FD\u85E9\u81EA\u52C9\u8BED\uFF08\u4E0E"\u83AB\u95EE\u6536\u83B7\uFF0C\u4F46\u95EE\u8015\u8018"\u8054\u7528\uFF09\uFF0C\u300A\u5168\u96C6\u300B\u7CBE\u786E\u7BC7\u76EE\u5F85\u6838', "keywords": ["\u7ACB\u5FD7", "\u81EA\u4FEE"], "credibility": "\u26A0\uFE0F", "note": "\u5F85\u6838\uFF08\u51FA\u5904\u4E0E\u6587\u5B57\u7248\u672C\u4E0D\u4E00\uFF09" }, { "id": "zeng-guofan-q11", "personaId": "zeng-guofan", "text": '"\u501A\u5929\u7167\u6D77\u82B1\u65E0\u6570\uFF0C\u6D41\u6C34\u9AD8\u5C71\u5FC3\u81EA\u77E5\u3002"', "source": "\u901A\u884C\u89C1\u91CE\u53F2\u7B14\u8BB0\uFF08\u7834\u5929\u4EAC\u540E\u660E\u5FD7\uFF0C\u96C6\u53E5\u8054\uFF09", "keywords": ["\u660E\u5FD7", "\u4E0D\u53D6\u5929\u4E0B"], "credibility": "\u26A0\uFE0F", "note": "\u5F85\u6838\uFF08\u591A\u51FA\u7B14\u8BB0\uFF0C\u672C\u4E8B\u6709\u4E89\u8BAE\uFF09" }, { "id": "zeng-guofan-q12", "personaId": "zeng-guofan", "text": '"\u594F\u9648\u4ECA\u65E5\u6025\u52A1\uFF0C\u9996\u5728\u7528\u4EBA\uFF0C\u4EBA\u624D\u6709\u8F6C\u79FB\u4E4B\u9053\uFF0C\u6709\u57F9\u517B\u4E4B\u65B9\uFF0C\u6709\u8003\u5BDF\u4E4B\u6CD5\u3002"', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\uFF08\u54B8\u4E30\u521D\u5E74\u9648\u8A00\uFF0C\u539F\u594F\u5F85\u6838\uFF09", "keywords": ["\u7528\u4EBA", "\u5236\u5EA6"], "credibility": "\u2705*", "note": "\u4F20\u8BB0\u5F15\u6587\uFF0C\u539F\u594F\u5F85\u6838" }, { "id": "zeng-guofan-q13", "personaId": "zeng-guofan", "text": '"\u5927\u96BE\u672A\u5DF2\uFF0C\u543E\u4EBA\u6562\u4EE5\u79C1\u6124\u6E0E\u541B\u7236\u4E4E\uFF1F"', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\uFF08\u7EFF\u8425\u51B2\u7A81\uFF09", "keywords": ["\u5FCD\u8FB1", "\u516C\u4E49"], "credibility": "\u2705*", "note": "\u4F20\u8BB0\u5F15\u6587\uFF0C\u539F\u594F\u5F85\u6838" }, { "id": "zeng-guofan-q14", "personaId": "zeng-guofan", "text": '"\u4EE5\u6B64\u77E5\u5175\u8D35\u7CBE\u4E0D\u8D35\u591A\u3002"', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\uFF08\u9756\u6E2F\u3001\u6E58\u6F6D\u6218\u540E\u8BBA\u5175\uFF09", "keywords": ["\u590D\u76D8", "\u7CBE\u5175"], "credibility": "\u2705*", "note": "\u4F20\u8BB0\u5F15\u6587\uFF0C\u539F\u594F\u5F85\u6838" }, { "id": "zeng-guofan-q15", "personaId": "zeng-guofan", "text": '"\u4E14\u53E4\u4EBA\u7528\u5175\uFF0C\u5148\u660E\u529F\u7F6A\u8D4F\u7F5A\u3002"', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405", "keywords": ["\u8D4F\u7F5A", "\u7EC4\u7EC7"], "credibility": "\u2705*", "note": "\u4F20\u8BB0\u5F15\u6587\uFF0C\u539F\u594F\u5F85\u6838" }, { "id": "zeng-guofan-q16", "personaId": "zeng-guofan", "text": '"\u65E0\u6545\u9000\u519B\uFF0C\u5175\u5BB6\u6240\u5FCC\u3002"', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\uFF08\u7941\u95E8\u88AB\u56F4\uFF09", "keywords": ["\u5371\u5C40", "\u5B9A\u529B"], "credibility": "\u2705*", "note": "\u4F20\u8BB0\u5F15\u6587\uFF0C\u539F\u594F\u5F85\u6838" }, { "id": "zeng-guofan-q17", "personaId": "zeng-guofan", "text": '"\u5B89\u5E86\u4E00\u519B\u4E3A\u514B\u91D1\u9675\u5F20\u672C\uFF0C\u4E0D\u53EF\u52A8\u4E5F\u3002"', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\uFF08\u5B89\u5E86\u56F4\u56F0\uFF09", "keywords": ["\u6218\u7565", "\u4F18\u5148\u7EA7"], "credibility": "\u2705*", "note": "\u4F20\u8BB0\u5F15\u6587\uFF0C\u539F\u594F\u5F85\u6838" }, { "id": "zeng-guofan-q18", "personaId": "zeng-guofan", "text": '"\u4EE5\u6709\u5B9A\u4E4B\u5175\uFF0C\u5236\u65E0\u5B9A\u4E4B\u5BC7\uFF0C\u91CD\u8FCE\u527F\uFF0C\u4E0D\u91CD\u5C3E\u8FFD\u3002"', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\uFF08\u7763\u529E\u637B\u519B\u594F\u8BAE\uFF09", "keywords": ["\u5B9A\u52BF", "\u673A\u52A8"], "credibility": "\u2705*", "note": "\u4F20\u8BB0\u5F15\u6587\uFF0C\u539F\u594F\u5F85\u6838" }, { "id": "zeng-guofan-q19", "personaId": "zeng-guofan", "text": '"\u5FC5\u4E07\u4F17\u4E00\u5FC3\uFF0C\u4E43\u53EF\u529E\u8D3C\u3002"', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\uFF08\u6E58\u519B\u519B\u5236\u53D9\u8FF0\uFF09", "keywords": ["\u7EC4\u7EC7", "\u540C\u5FC3"], "credibility": "\u2705*", "note": "\u4F20\u8BB0\u5F15\u6587\uFF0C\u539F\u594F\u5F85\u6838" }, { "id": "zeng-guofan-q20", "personaId": "zeng-guofan", "text": '"\u4E89\u5F7C\u6211\u4E4B\u865A\u4EEA\u8005\u53EF\u8BB8\uFF0C\u5176\u593A\u543E\u6C11\u751F\u8BA1\u8005\u52FF\u8BB8\u4E5F\u3002"', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\uFF08\u6761\u7EA6\u4E0E\u4EA4\u6D89\u539F\u5219\uFF09", "keywords": ["\u5916\u4EA4", "\u6C11\u751F"], "credibility": "\u2705*", "note": "\u4F20\u8BB0\u5F15\u6587\uFF0C\u539F\u594F\u5F85\u6838" }, { "id": "zeng-guofan-q21", "personaId": "zeng-guofan", "text": '"\u4E8B\u529F\u672C\u4E8E\u5B66\u95EE\uFF0C\u5584\u4EE5\u793C\u8FD0\u3002"', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u8BBA\u66F0\u300B\uFF08\u53F2\u81E3\u8BC4\u4EF7\uFF0C\u4E0D\u662F\u66FE\u56FD\u85E9\u81EA\u8FF0\uFF09", "keywords": ["\u5B66\u95EE", "\u4E8B\u529F"], "credibility": "\u2705", "note": "\u8BC4\u4EF7\u8BED\uFF0C\u7981\u4F5C\u7B2C\u4E00\u4EBA\u79F0" }, { "id": "zeng-guofan-q22", "personaId": "zeng-guofan", "text": '"\u5176\u6CBB\u519B\u884C\u653F\uFF0C\u52A1\u6C42\u8E48\u5B9E\u3002"', "source": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u8BBA\u66F0\u300B\uFF08\u53F2\u81E3\u8BC4\u4EF7\uFF0C\u4E0D\u662F\u66FE\u56FD\u85E9\u81EA\u8FF0\uFF09", "keywords": ["\u8E48\u5B9E", "\u6CBB\u7406"], "credibility": "\u2705", "note": "\u8BC4\u4EF7\u8BED\uFF0C\u7981\u4F5C\u7B2C\u4E00\u4EBA\u79F0" }], "blacklist": [{ "personaId": "zeng-guofan", "text": "\u5C61\u6218\u5C61\u8D25", "kind": "quote", "credibility": "\u274C", "mode": "always", "reason": '"\u5C61\u6218\u5C61\u8D25"\u6539\u594F\u6298\u5178\u6545\u7CFB\u540E\u4EBA\u675C\u64B0\uFF1A\u672A\u89C1\u66FE\u56FD\u85E9\u594F\u7A3F\u4E2D\u6709\u6B64\u539F\u6587\uFF0C\u5178\u6545\u51FA\u81EA\u540E\u4E16\u7B14\u8BB0\u3001\u6F14\u4E49\u4E0E\u6C11\u95F4\u53D9\u8FF0\uFF0C\u4E0D\u53EF\u4F5C\u4E3A\u53F2\u5B9E\u6216\u539F\u8BDD\uFF08\u8C03\u7814\u6210\u679C-\u66FE\u56FD\u85E9 D \u8282 1\uFF09' }, { "personaId": "zeng-guofan", "text": "\u5C61\u8D25\u5C61\u6218", "kind": "quote", "credibility": "\u274C", "mode": "always", "reason": '"\u5C61\u6218\u5C61\u8D25\u2192\u5C61\u8D25\u5C61\u6218"\u6539\u594F\u6298\u5178\u6545\u7CFB\u540E\u4EBA\u675C\u64B0\uFF1A\u672A\u89C1\u66FE\u56FD\u85E9\u594F\u7A3F\u4E2D\u6709\u6B64\u539F\u6587\uFF0C\u4E0D\u53EF\u4F5C\u4E3A\u53F2\u5B9E\u6216\u539F\u8BDD\uFF08\u8C03\u7814\u6210\u679C-\u66FE\u56FD\u85E9 D \u8282 1\uFF09' }, { "personaId": "zeng-guofan", "text": "\u7ED3\u786C\u5BE8\uFF0C\u6253\u5446\u4ED7\u3002", "kind": "quote", "credibility": "\u274C", "mode": "always", "reason": '\u540E\u4EBA\u5BF9\u6E58\u519B\u6218\u6CD5\u7684\u9AD8\u5EA6\u6982\u62EC\uFF0C\u975E\u66FE\u56FD\u85E9\u539F\u8BDD\uFF1B\u66FE\u6C0F\u8BBA\u5175\u5F3A\u8C03"\u5148\u6C42\u7A33\u5F53\uFF0C\u6B21\u6C42\u53D8\u5316""\u4EE5\u6709\u5B9A\u4E4B\u5175\u5236\u65E0\u5B9A\u4E4B\u5BC7"\uFF0C\u4F46\u516B\u5B57\u975E\u5176\u4EB2\u8BED\uFF0C\u53EF\u4F5C\u601D\u60F3\u6982\u62EC\u4E0D\u53EF\u4F5C\u539F\u8BDD\uFF08\u8C03\u7814\u6210\u679C-\u66FE\u56FD\u85E9 C2 F2 / D \u8282 2\uFF09' }, { "personaId": "zeng-guofan", "text": "\u8F7B\u8D22\u8DB3\u4EE5\u805A\u4EBA\uFF0C\u5F8B\u5DF1\u8DB3\u4EE5\u670D\u4EBA\uFF0C\u91CF\u5BBD\u8DB3\u4EE5\u5F97\u4EBA\uFF0C\u8EAB\u5148\u8DB3\u4EE5\u7387\u4EBA\u3002", "kind": "quote", "credibility": "\u274C", "mode": "always", "reason": "\u901A\u884C\u88AB\u8BEF\u5F52\u66FE\u56FD\u85E9\uFF0C\u5B9E\u9645\u51FA\u81EA\u6E05\u4EE3\u683C\u8A00\u7C7B\u4E66\uFF08\u91D1\u7F28\u300A\u683C\u8A00\u8054\u74A7\u300B\u7B49\uFF09\uFF0C\u5F20\u51A0\u674E\u6234\uFF08\u8C03\u7814\u6210\u679C-\u66FE\u56FD\u85E9 C2 F3 / D \u8282 4\uFF09" }, { "personaId": "zeng-guofan", "text": "\u7269\u6765\u987A\u5E94\uFF0C\u672A\u6765\u4E0D\u8FCE\uFF0C\u5F53\u4E0B\u4E0D\u6742\uFF0C\u65E2\u8FC7\u4E0D\u604B\u3002", "kind": "quote", "credibility": "\u26A0\uFE0F", "mode": "always", "reason": "\u901A\u884C\u6D41\u4F20\u4E3A\u66FE\u56FD\u85E9\u8BED\uFF0C\u4F46\u7CBE\u786E\u51FA\u5904\u5B58\u7591\uFF1A\u5404\u901A\u884C\u672C\u6587\u5B57\u4E0D\u4E00\uFF0C\u7BC7\u76EE\u5F85\u8003\uFF0C\u4E0D\u53EF\u4F5C\u4E3A\u7A33\u5B9A\u539F\u8BDD\u5165\u5E93\uFF08\u8C03\u7814\u6210\u679C-\u66FE\u56FD\u85E9 C2 F4 / D \u8282 5\uFF09" }, { "personaId": "zeng-guofan", "text": "\u6253\u843D\u7259\u9F7F\u548C\u8840\u541E\u3002", "kind": "quote", "credibility": "\u26A0\uFE0F", "mode": "always", "reason": "\u901A\u884C\u4F5C\u66FE\u56FD\u85E9\u8BED\uFF08\u81EA\u8FF0\u5FCD\u8FB1\uFF09\uFF0C\u591A\u89C1\u4E8E\u4F20\u8BB0\u8F6C\u8FF0\uFF0C\u539F\u59CB\u51FA\u5904\u5F85\u8003\uFF08\u8C03\u7814\u6210\u679C-\u66FE\u56FD\u85E9 C2 F5\uFF09" }, { "personaId": "zeng-guofan", "text": "\u4E8B\u529F\u672C\u4E8E\u5B66\u95EE\uFF0C\u5584\u4EE5\u793C\u8FD0\u3002", "kind": "quote", "credibility": "\u2705", "mode": "first-person", "reason": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u8BBA\u66F0\u300B\u53F2\u81E3\u8BC4\u4EF7\uFF0C\u4E0D\u662F\u66FE\u56FD\u85E9\u81EA\u8FF0\uFF1B\u7981\u4F5C\u7B2C\u4E00\u4EBA\u79F0\uFF0C\u4EC5\u53EF\u4F5C\u5386\u53F2\u5750\u6807/\u65C1\u767D\uFF08\u8C03\u7814\u6210\u679C-\u66FE\u56FD\u85E9 C1 21 / G2.9\uFF09" }, { "personaId": "zeng-guofan", "text": "\u5176\u6CBB\u519B\u884C\u653F\uFF0C\u52A1\u6C42\u8E48\u5B9E\u3002", "kind": "quote", "credibility": "\u2705", "mode": "first-person", "reason": "\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u8BBA\u66F0\u300B\u53F2\u81E3\u8BC4\u4EF7\uFF0C\u4E0D\u662F\u66FE\u56FD\u85E9\u81EA\u8FF0\uFF1B\u7981\u4F5C\u7B2C\u4E00\u4EBA\u79F0\uFF0C\u4EC5\u53EF\u4F5C\u5386\u53F2\u5750\u6807/\u65C1\u767D\uFF08\u8C03\u7814\u6210\u679C-\u66FE\u56FD\u85E9 C1 22 / G2.9\uFF09" }, { "personaId": "zeng-guofan", "text": "\u300A\u51B0\u9274\u300B", "kind": "book", "credibility": "\u26A0\uFE0F", "mode": "always", "reason": "\u4F2A\u6258\u4E66\uFF1A\u5B66\u754C\u591A\u8BA4\u4E3A\u7CFB\u540E\u4EBA\u6258\u540D\u8F91\u5F55\uFF0C\u975E\u66FE\u56FD\u85E9\u4EB2\u8457\u5B9A\u672C\uFF1B\u5F55\u5165\u8BED\u5F55\u4E0D\u5F97\u4EE5\u300A\u51B0\u9274\u300B\u4E3A source\uFF0C\u4E00\u5F8B\u56DE\u843D\u5230\u300A\u66FE\u56FD\u85E9\u5168\u96C6\u300B\uFF08\u8C03\u7814\u6210\u679C-\u66FE\u56FD\u85E9 D \u8282 3\uFF09" }, { "personaId": "zeng-guofan", "text": "\u300A\u633A\u7ECF\u300B", "kind": "book", "credibility": "\u26A0\uFE0F", "mode": "always", "reason": "\u4F2A\u6258\u4E66\uFF1A\u5B66\u754C\u591A\u8BA4\u4E3A\u7CFB\u540E\u4EBA\u6258\u540D\u8F91\u5F55\uFF0C\u975E\u66FE\u56FD\u85E9\u4EB2\u8457\u5B9A\u672C\uFF1B\u5F55\u5165\u8BED\u5F55\u4E0D\u5F97\u4EE5\u300A\u633A\u7ECF\u300B\u4E3A source\uFF0C\u4E00\u5F8B\u56DE\u843D\u5230\u300A\u66FE\u56FD\u85E9\u5168\u96C6\u300B\uFF08\u8C03\u7814\u6210\u679C-\u66FE\u56FD\u85E9 D \u8282 3\uFF09" }] }];

// src/persona/content-pack.ts
var CONTENT_PACK = PERSONA_ARTIFACT;

// src/persona/runtime-registry.ts
function createRuntimeRegistry() {
  return PersonaRegistry.fromArtifact(CONTENT_PACK);
}

// src/retrieval/anecdote-store.ts
function queryTerms(query) {
  const runs = query.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  return [...new Set(runs)];
}
function scoreAnecdote(anecdote, terms, query) {
  let score = 0;
  for (const themeLabel of anecdote.theme.split("/")) {
    if (query.includes(themeLabel)) score += 4;
  }
  for (const term of terms) {
    if (anecdote.title.includes(term)) score += 3;
    if (anecdote.summary.includes(term)) score += 1;
  }
  return score;
}
var AnecdoteStore = class {
  constructor(items) {
    this.items = items;
    for (const item of items) {
      if (this.byIdMap.has(item.id)) {
        throw new Error(`\u4E8B\u8FF9\u5E93 id \u91CD\u590D: ${item.id}`);
      }
      this.byIdMap.set(item.id, item);
    }
  }
  items;
  byIdMap = /* @__PURE__ */ new Map();
  /** 按 id 取事迹（不围栏；调用方决定是否校验 persona）。 */
  byId(id) {
    return this.byIdMap.get(id);
  }
  /** 某人物全部事迹。 */
  byPersona(personaId) {
    return this.items.filter((a) => a.personaId === personaId);
  }
  /** 某人物全部去重出处（source 原文，含版本注记）。 */
  sources(personaId) {
    return [...new Set(this.byPersona(personaId).map((a) => a.source))];
  }
  /**
   * 确定性检索（围栏化）：只在本人物事迹内匹配，按评分降序取 top-k。
   * @param query - 困惑/主题关键词（模型 tool-call 参数或直接查询）。
   * @param personaId - 当前人物（围栏：只返回该人物事迹）。
   * @param options - topK（默认 3，上限 5）。
   * @returns 匹配到的事迹（评分 > 0，按评分降序、id 升序稳定排序）。
   */
  search(query, personaId, options = {}) {
    const topK = Math.min(Math.max(options.topK ?? 3, 1), 5);
    const terms = queryTerms(query);
    const scored = this.byPersona(personaId).map((a) => ({ anecdote: a, score: scoreAnecdote(a, terms, query) })).filter((s) => s.score > 0).sort((x, y) => y.score - x.score || (x.anecdote.id < y.anecdote.id ? -1 : 1));
    return scored.slice(0, topK).map((s) => s.anecdote);
  }
};

// src/retrieval/quote-store.ts
var QuoteStore = class {
  constructor(items) {
    this.items = items;
    for (const item of items) {
      if (this.byIdMap.has(item.id)) {
        throw new Error(`\u8BED\u5F55\u5E93 id \u91CD\u590D: ${item.id}`);
      }
      this.byIdMap.set(item.id, item);
    }
  }
  items;
  byIdMap = /* @__PURE__ */ new Map();
  byId(id) {
    return this.byIdMap.get(id);
  }
  byPersona(personaId) {
    return this.items.filter((q) => q.personaId === personaId);
  }
  search(query, personaId, topK = 3) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return this.byPersona(personaId).map((q) => ({ q, score: terms.reduce((n, t) => n + (`${q.text} ${q.keywords.join(" ")}`.toLowerCase().includes(t) ? 1 : 0), 0) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.min(5, Math.max(1, topK))).map((x) => x.q);
  }
  /** 某人物全部去重出处（source 原文）。 */
  sources(personaId) {
    return [...new Set(this.byPersona(personaId).map((q) => q.source))];
  }
};

// src/retrieval/blacklist.ts
function normalizeText(text) {
  return text.toLowerCase().replace(/[\s\p{P}\p{S}“”‘’「」『』《》〈〉（）【】]/gu, "");
}
var Blacklist = class {
  constructor(entries) {
    this.entries = entries;
    this.quoteEntries = entries.filter((e) => e.kind === "quote");
    this.bookEntries = entries.filter((e) => e.kind === "book");
    for (const e of entries) {
      if (e.text.trim() === "" || e.reason.trim() === "") {
        throw new Error(`\u9ED1\u540D\u5355\u6761\u76EE\u4E0D\u5B8C\u6574: ${JSON.stringify(e)}`);
      }
    }
  }
  entries;
  quoteEntries;
  bookEntries;
  /**
   * 文本命中检查：候选文本（如演员回答）是否包含黑名单语录。
   * @param text - 候选文本。
   * @param personaId - 当前人物（只检查该人物黑名单）。
   * @param context - 'actor-reply'：演员第一人称语境（first-person 模式也拦截）；
   *                  'any'（默认）：只拦截 always 模式。
   * @returns 命中的黑名单条目；未命中返回 undefined。
   */
  matchText(text, personaId, context = "any") {
    const norm = normalizeText(text);
    for (const entry of this.quoteEntries) {
      if (entry.personaId !== personaId) continue;
      if (entry.mode === "first-person" && context !== "actor-reply") continue;
      const entryNorm = normalizeText(entry.text);
      if (entryNorm !== "" && (norm.includes(entryNorm) || norm.length >= 4 && entryNorm.includes(norm))) {
        return entry;
      }
    }
    return void 0;
  }
  /**
   * 伪托书拦截：候选 source 是否引用黑名单中的伪托书（《冰鉴》《挺经》）。
   * @param source - 候选出处文本。
   * @returns 命中的黑名单条目；未命中返回 undefined。
   */
  matchBookSource(source) {
    const norm = normalizeText(source);
    for (const entry of this.bookEntries) {
      if (normalizeText(entry.text) !== "" && norm.includes(normalizeText(entry.text))) return entry;
    }
    return void 0;
  }
  /** 某人物全部条目（测试/审计用）。 */
  byPersona(personaId) {
    return this.entries.filter((e) => e.personaId === personaId);
  }
};

// src/retrieval/data.ts
var ANECDOTES = CONTENT_PACK.flatMap((p) => p.anecdotes);
var QUOTES = CONTENT_PACK.flatMap((p) => p.quotes);
var BLACKLIST_ENTRIES = CONTENT_PACK.flatMap((p) => p.blacklist);
var ANECDOTE_COUNTS = Object.fromEntries(CONTENT_PACK.map((p) => [p.manifest.id, ANECDOTES.filter((a) => a.personaId === p.manifest.id).length]));
var QUOTE_COUNTS = Object.fromEntries(CONTENT_PACK.map((p) => [p.manifest.id, QUOTES.filter((q) => q.personaId === p.manifest.id).length]));
var cached;
function buildContentLibraries() {
  if (cached !== void 0) return cached;
  cached = {
    anecdotes: new AnecdoteStore(ANECDOTES),
    quotes: new QuoteStore(QUOTES),
    blacklist: new Blacklist(BLACKLIST_ENTRIES)
  };
  return cached;
}
var BLACKLIST_COUNTS = Object.fromEntries(CONTENT_PACK.map((p) => [p.manifest.id, BLACKLIST_ENTRIES.filter((e) => e.personaId === p.manifest.id).length]));

// src/evidence/ledger.ts
var EvidenceLedger = class {
  constructor(personaId, turnId) {
    this.personaId = personaId;
    this.turnId = turnId;
  }
  personaId;
  turnId;
  grants = /* @__PURE__ */ new Map();
  grant(grant) {
    if (grant.personaId !== this.personaId || grant.turnId !== this.turnId || !grant.evidenceId) return false;
    this.grants.set(grant.evidenceId, { ...grant });
    return true;
  }
  hasCurrentGrant(evidenceId, kind) {
    const grant = this.grants.get(evidenceId);
    return grant !== void 0 && grant.personaId === this.personaId && grant.turnId === this.turnId && (kind === void 0 || grant.kind === kind);
  }
  get(evidenceId) {
    return this.grants.get(evidenceId);
  }
  entries() {
    return [...this.grants.values()].map((g) => ({ ...g }));
  }
  clear() {
    this.grants.clear();
  }
};

// src/dialogue/public-contract.ts
var TURN_INTENTS = ["answer", "clarify", "await-confirmation", "reflect", "offer-controls", "pause", "close"];
var DIALOGUE_CONTROLS = ["confirm", "partial-confirm", "correct", "skip", "continue", "pause", "end", "switch-persona", "new-dilemma"];
function isTurnIntent(value) {
  return typeof value === "string" && TURN_INTENTS.includes(value);
}
function isDialogueControl(value) {
  return typeof value === "string" && DIALOGUE_CONTROLS.includes(value);
}

// src/runtime/turn-state.ts
function turnPolicyViolation(args, current) {
  if (!current.policyConfigured) return void 0;
  const questions = Array.isArray(args?.questions) ? args.questions : [];
  if (current.maxQuestions !== void 0 && questions.length > current.maxQuestions) return `\u672C\u56DE\u5408\u6700\u591A\u5141\u8BB8 ${current.maxQuestions} \u4E2A\u95EE\u9898\uFF1B\u8BF7\u5220\u9664\u591A\u4F59\u95EE\u9898\u540E\u91CD\u65B0\u63D0\u4EA4\u3002`;
  return void 0;
}
function normalizeTurnPolicyArgs(args, current) {
  if (!current.policyConfigured || typeof args !== "object" || args === null) return args;
  const offeredControls = args.offeredControls;
  if (!Array.isArray(offeredControls)) return args;
  const normalized = offeredControls.filter((control) => !isDialogueControl(control) || current.allowedControls.includes(control));
  return normalized.length === offeredControls.length ? args : { ...args, offeredControls: normalized };
}
var ActorTurnStateRegistry = class {
  states = /* @__PURE__ */ new WeakMap();
  pendingPolicies = /* @__PURE__ */ new WeakMap();
  state(session, personaId, turnId) {
    let byTurn = this.states.get(session);
    if (!byTurn) {
      byTurn = /* @__PURE__ */ new Map();
      this.states.set(session, byTurn);
    }
    let value = byTurn.get(turnId);
    if (!value) {
      value = { personaId, turnId, ledger: new EvidenceLedger(personaId, turnId), failures: 0, repairPrompted: false, submitted: false, retrievalPolicy: "allow", allowedControls: ["confirm", "partial-confirm", "correct", "skip", "continue", "pause", "end", "switch-persona", "new-dilemma"], policyConfigured: false };
      byTurn.set(turnId, value);
    }
    return value;
  }
  /** Coordinator/Actor boundary sets this before followup; tools enforce it again at execution. */
  setRetrievalPolicy(session, personaId, turnId, policy) {
    this.state(session, personaId, turnId).retrievalPolicy = policy;
  }
  setTurnPolicy(session, personaId, turnId, policy) {
    const current = this.state(session, personaId, turnId);
    current.retrievalPolicy = policy.retrievalPolicy;
    current.maxQuestions = policy.maxQuestions;
    current.allowedControls = [...new Set(policy.allowedControls)];
    current.policyConfigured = true;
  }
  setNextTurnPolicy(session, policy) {
    this.pendingPolicies.set(session, { retrievalPolicy: policy.retrievalPolicy, maxQuestions: policy.maxQuestions, allowedControls: [...new Set(policy.allowedControls)] });
  }
  setNextTurnRetrievalPolicy(session, policy) {
    this.pendingPolicies.set(session, { retrievalPolicy: policy });
  }
  setRepairDetails(session, personaId, turnId, details) {
    this.state(session, personaId, turnId).repairDetails = details;
  }
  stateForExecution(exec, personaId) {
    const session = exec.agent?.session;
    if (!session) throw new Error("actor tool execution missing agent session");
    const turnId = openTurnId(session);
    if (turnId === void 0) throw new Error("actor tool execution has no open turn");
    const byTurn = this.states.get(session);
    if (byTurn) {
      for (const key of byTurn.keys()) if (key !== turnId) byTurn.delete(key);
    }
    const value = this.state(session, personaId, turnId);
    const pending = this.pendingPolicies.get(session);
    if (pending) {
      if (pending.retrievalPolicy) value.retrievalPolicy = pending.retrievalPolicy;
      if (pending.maxQuestions !== void 0) value.maxQuestions = pending.maxQuestions;
      if (pending.allowedControls !== void 0) value.allowedControls = [...new Set(pending.allowedControls)];
      if (pending.maxQuestions !== void 0 || pending.allowedControls !== void 0) value.policyConfigured = true;
      this.pendingPolicies.delete(session);
    }
    return value;
  }
  clearSession(session) {
    this.states.delete(session);
  }
  consumeRepairPrompt(session) {
    const byTurn = this.states.get(session);
    if (!byTurn) return false;
    const events = session.events ?? [];
    const hasSuccess = events.some((event) => event.type === "tool/result" && typeof event.data === "object" && event.data !== null && typeof event.data.meta === "object" && event.data.meta?.kind === "actor-reply");
    for (const value of byTurn.values()) if (value.failures === 1 && !hasSuccess && !value.submitted && !value.repairPrompted) {
      value.repairPrompted = true;
      return value.repairDetails ?? "\u63D0\u4EA4\u7ED3\u6784\u65E0\u6548\uFF0C\u8BF7\u4FEE\u590D\u540E\u91CD\u8BD5\u3002";
    }
    return false;
  }
  markSubmitted(session) {
    const byTurn = this.states.get(session);
    if (byTurn) for (const value of byTurn.values()) value.submitted = true;
  }
  consumeEvidenceRecoveryPrompt(session) {
    const byTurn = this.states.get(session);
    if (!byTurn) return false;
    const events = session.events ?? [];
    const hasSuccess = events.some((event) => event.type === "tool/result" && typeof event.data === "object" && event.data !== null && typeof event.data.meta === "object" && event.data.meta?.kind === "actor-reply");
    for (const value of byTurn.values()) if (value.failures === 0 && !hasSuccess && !value.submitted && !value.repairPrompted && value.ledger.entries().length > 0) {
      value.repairPrompted = true;
      return true;
    }
    return false;
  }
};
function openTurnId(session) {
  let open;
  for (const event of session.events ?? []) {
    const turn = event.data?.turn;
    if (event.type === "turn/start" && typeof turn === "number") open = String(turn);
    if (event.type === "turn/end" && typeof turn === "number" && open === String(turn)) open = void 0;
  }
  return open;
}

// src/runtime/actor-agent.ts
import { ReasoningEffortId, createUserMessage } from "@deepseek-ai/dsh-llm";

// src/context/persona.ts
var PERSONA_RED_LINE_SECTIONS = ["\u8BED\u8A00\u7981\u5FCC\uFF08\u4E0D\u53EF\u8FDD\u53CD\uFF09", "\u51FA\u5904\u94C1\u5F8B\uFF08\u9632\u4F2A\u6258\uFF09"];
function parsePersonaMarkdown(markdown) {
  const sections = [];
  let current = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading !== null) {
      const title = heading[1];
      if (title === void 0) throw new Error("persona section heading is missing");
      current = { title: title.trim(), body: "" };
      sections.push(current);
    } else if (current !== null) {
      current.body += (current.body === "" ? "" : "\n") + line;
    }
  }
  return sections;
}
function personaSystemPromptFromSections(sections) {
  return sections.map((section) => `## ${section.title}

${section.body.trim()}`).join("\n\n");
}
function assertRedLineSections(id, sections) {
  for (const title of PERSONA_RED_LINE_SECTIONS) {
    const section = sections.find((s) => s.title === title);
    if (section === void 0 || section.body.trim() === "") {
      throw new Error(`persona ${id}: \u7EA2\u7EBF\u8282\u300C${title}\u300D\u7F3A\u5931\u6216\u4E3A\u7A7A\uFF08\u6210\u54C1\u88AB\u88C1\u526A\uFF0C\u62D2\u7EDD\u52A0\u8F7D\uFF09`);
    }
  }
}
function buildPersonaSpec(id, name, markdown) {
  const sections = parsePersonaMarkdown(markdown);
  assertRedLineSections(id, sections);
  return { id, name, systemPrompt: personaSystemPromptFromSections(sections) };
}

// src/context/personas-data.ts
var cached2;
function buildPersonas() {
  if (cached2 !== void 0) return cached2;
  cached2 = Object.fromEntries(CONTENT_PACK.map((entry) => {
    const { id, displayName } = entry.manifest;
    return [id, buildPersonaSpec(id, displayName, entry.prompt)];
  }));
  return cached2;
}
function personaSpecFor(id) {
  const spec = buildPersonas()[id];
  if (spec === void 0) throw new Error(`unknown PersonaId: ${id}`);
  return spec;
}

// src/runtime/actor-tools.ts
import { defineTool } from "@deepseek-ai/dsh-tools";

// src/retrieval/retrieve.ts
function retrieveAnecdotes(query, personaId, libs, topK = 3) {
  return libs.anecdotes.search(query, personaId, { topK }).map((a) => ({
    id: a.id,
    title: a.title,
    theme: a.theme,
    summary: a.summary,
    source: a.source
  }));
}
function fetchAnecdote(id, personaId, libs) {
  const anecdote = libs.anecdotes.byId(id);
  if (anecdote === void 0 || anecdote.personaId !== personaId) return void 0;
  return anecdote;
}
function fetchQuote(id, libs) {
  return libs.quotes.byId(id);
}

// src/retrieval/tools.ts
var RETRIEVE_ANECDOTES_TOOL = {
  name: "retrieve_anecdotes",
  description: "\u6309\u56F0\u60D1/\u4E3B\u9898\u5173\u952E\u8BCD\u68C0\u7D22\u3010\u5F53\u524D\u4EBA\u7269\u3011\u7684\u4E8B\u8FF9\u5E93\uFF0C\u8FD4\u56DE\u672C\u4EBA\u7269\u76F8\u5173\u4E8B\u8FF9 top-k \u7684\u6807\u9898\u3001\u4E3B\u9898\u3001\u6458\u8981\u4E0E\u771F\u5B9E\u51FA\u5904\uFF08\u4E66\u540D\xB7\u7BC7\u7AE0\uFF09\u3002\u9700\u8981\u53F2\u5B9E\u652F\u6491\u65F6\u8C03\u7528\uFF1B\u53EA\u8FD4\u56DE\u5F53\u524D\u4EBA\u7269\u7684\u4E8B\u8FF9\uFF08\u56F4\u680F\u5316\uFF09\uFF0C\u7EDD\u4E0D\u542B\u5176\u4ED6\u4EBA\u7269\u5185\u5BB9\u3002\u68C0\u7D22\u547D\u4E2D\u540E\uFF0C\u5F15\u7528\u4E8B\u8FF9/\u539F\u8BDD\u65F6\u5FC5\u987B\u6807\u6CE8\u5176\u771F\u5B9E\u51FA\u5904\uFF0C\u4E14\u4E0D\u5F97\u865A\u6784\u51FA\u5904\u3002",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "\u56F0\u60D1/\u4E3B\u9898\u5173\u952E\u8BCD\uFF0C\u5982\u300C\u4E8B\u4E0A\u78E8 \u77E5\u884C\u5408\u4E00\u300D\u300C\u9006\u5883 \u632B\u6298\u300D\u300C\u7528\u4EBA\u300D\u7B49"
      },
      topK: {
        type: "number",
        description: "\u6700\u591A\u8FD4\u56DE\u6761\u6570\uFF08\u9ED8\u8BA4 3\uFF0C\u4E0A\u9650 5\uFF09"
      }
    },
    required: ["query"]
  }
};
var FETCH_ANECDOTE_TOOL = {
  name: "fetch_anecdote",
  description: "\u6309 id \u53D6\u3010\u5F53\u524D\u4EBA\u7269\u3011\u4E00\u6761\u4E8B\u8FF9\u7684\u539F\u6587\u5168\u6587\uFF08full_text\uFF09\u4E0E\u51FA\u5904\uFF0C\u4F9B\u56DE\u7B54\u4E2D\u5C55\u5F00\u539F\u6587/\u6838\u5BF9\u5F15\u6587\u3002\u53EA\u80FD\u53D6\u5F53\u524D\u4EBA\u7269\u7684\u4E8B\u8FF9\uFF08\u56F4\u680F\u5316\uFF09\uFF1Bid \u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u4EBA\u7269\u4F1A\u8FD4\u56DE\u9519\u8BEF\u3002",
  parameters: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "\u4E8B\u8FF9 id\uFF08\u6765\u81EA retrieve_anecdotes \u8FD4\u56DE\u7684 id \u5B57\u6BB5\uFF09"
      }
    },
    required: ["id"]
  }
};
var RETRIEVE_QUOTES_TOOL = {
  name: "retrieve_quotes",
  description: "\u68C0\u7D22\u5F53\u524D\u4EBA\u7269\u8BED\u5F55\uFF1B\u53EA\u8FD4\u56DE\u7A33\u5B9A ID\u3001\u539F\u6587\u6458\u8981\u3001\u51FA\u5904\u548C\u53EF\u4FE1\u5EA6\u3002",
  parameters: { type: "object", properties: { query: { type: "string" }, topK: { type: "number" } }, required: ["query"] }
};
var FETCH_QUOTE_TOOL = {
  name: "fetch_quote",
  description: "\u6309\u5F53\u524D\u4EBA\u7269\u8BED\u5F55 ID \u8BFB\u53D6\u5E93\u5185 exact text\u3001source\u3001credibility\u3002",
  parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
};
var ACTOR_TOOLS = [RETRIEVE_ANECDOTES_TOOL, FETCH_ANECDOTE_TOOL];
var EVIDENCE_ACTOR_TOOLS = [...ACTOR_TOOLS, RETRIEVE_QUOTES_TOOL, FETCH_QUOTE_TOOL];
var TOOL_RESULT_MAX_CHARS = 1200;
function parseArgs(argumentsText) {
  try {
    const parsed = JSON.parse(argumentsText);
    return parsed !== null && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function makeRetrieveHandler(libs, personaId, ledger) {
  return (argumentsText) => {
    const args = parseArgs(argumentsText);
    const query = typeof args.query === "string" ? args.query.trim() : "";
    if (query === "") {
      return { content: "\u53C2\u6570\u7F3A\u5931\uFF1Aquery \u4E3A\u5FC5\u586B\uFF08\u56F0\u60D1/\u4E3B\u9898\u5173\u952E\u8BCD\uFF09", isError: true };
    }
    const topK = typeof args.topK === "number" ? Math.floor(args.topK) : 3;
    const items = retrieveAnecdotes(query, personaId, libs, topK);
    const payload = {
      ok: true,
      personaId,
      total: items.length,
      note: items.length === 0 ? "\u672C\u4EBA\u7269\u672A\u627E\u5230\u4E0E\u67E5\u8BE2\u76F8\u5173\u7684\u4E8B\u8FF9\uFF1B\u5982\u786E\u9700\u53F2\u5B9E\u652F\u6491\uFF0C\u8BF7\u57FA\u4E8E\u5DF2\u9A8C\u8BC1\u601D\u60F3\u6709\u9650\u8BA8\u8BBA\uFF0C\u5E76\u8BDA\u5B9E\u6807\u6CE8\u7F3A\u5C11\u5BF9\u5E94\u4EB2\u5386\u4E8B\u8FF9\uFF08\u4E0D\u4E0A\u7F51\u3001\u4E0D\u7F16\uFF09\u3002" : void 0,
      items: items.map((a) => ({ id: a.id, title: a.title, theme: a.theme, summary: a.summary, source: a.source }))
    };
    const content = JSON.stringify(payload);
    if (content.length > TOOL_RESULT_MAX_CHARS) {
      const bounded = { ...payload, items: payload.items.slice(0, 1) };
      const boundedText = JSON.stringify(bounded);
      if (boundedText.length > TOOL_RESULT_MAX_CHARS) return { content: JSON.stringify({ ok: true, personaId, total: 0, items: [] }) };
      for (const item of bounded.items) ledger?.grant({ evidenceId: item.id, kind: "anecdote", personaId, turnId: ledger.turnId });
      return { content: boundedText };
    }
    for (const item of items) ledger?.grant({ evidenceId: item.id, kind: "anecdote", personaId, turnId: ledger.turnId });
    return { content };
  };
}
function makeFetchHandler(libs, personaId, ledger) {
  return (argumentsText) => {
    const args = parseArgs(argumentsText);
    const id = typeof args.id === "string" ? args.id.trim() : "";
    if (id === "") {
      return { content: "\u53C2\u6570\u7F3A\u5931\uFF1Aid \u4E3A\u5FC5\u586B\uFF08\u4E8B\u8FF9 id\uFF09", isError: true };
    }
    const anecdote = fetchAnecdote(id, personaId, libs);
    if (anecdote === void 0) {
      return { content: `\u56F4\u680F\u62E6\u622A\uFF1A\u4E8B\u8FF9 id\u300C${id}\u300D\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u4EBA\u7269\uFF08${personaId}\uFF09\uFF0C\u53D6\u4E0D\u5230\u4ED6\u4EBA\u4E8B\u8FF9`, isError: true };
    }
    const content = JSON.stringify({
      ok: true,
      id: anecdote.id,
      personaId: anecdote.personaId,
      title: anecdote.title,
      theme: anecdote.theme,
      fullText: anecdote.fullText,
      source: anecdote.source
    });
    if (content.length > TOOL_RESULT_MAX_CHARS) return { content: "\u4E8B\u8FF9\u7ED3\u679C\u8D85\u51FA\u56DE\u5408\u9884\u7B97\uFF0C\u672A\u6388\u4E88\u8BC1\u636E", isError: true };
    ledger?.grant({ evidenceId: anecdote.id, kind: "anecdote", personaId, turnId: ledger.turnId });
    return { content };
  };
}
function makeQuoteHandlers(libs, personaId, ledger) {
  const retrieve = (argumentsText) => {
    const args = parseArgs(argumentsText);
    const query = typeof args.query === "string" ? args.query.trim() : "";
    if (!query) return { content: "\u53C2\u6570\u7F3A\u5931\uFF1Aquery \u4E3A\u5FC5\u586B", isError: true };
    const topK = Math.min(5, Math.max(1, Number.isFinite(args.topK) ? Math.floor(args.topK) : 3));
    const items = libs.quotes.search(query, personaId, topK);
    const visible = items.map((x) => ({ id: x.id, text: x.text, source: x.source, credibility: x.credibility }));
    const content = JSON.stringify({ ok: true, personaId, items: visible });
    if (content.length > TOOL_RESULT_MAX_CHARS) return { content: JSON.stringify({ ok: true, personaId, items: [] }) };
    for (const item of items) ledger?.grant({ evidenceId: item.id, kind: "quote", personaId, turnId: ledger.turnId });
    return { content };
  };
  const fetch = (argumentsText) => {
    const args = parseArgs(argumentsText);
    const id = typeof args.id === "string" ? args.id.trim() : "";
    const quote = id ? fetchQuote(id, libs) : void 0;
    if (!quote || quote.personaId !== personaId) return { content: `\u56F4\u680F\u62E6\u622A\uFF1A\u8BED\u5F55 id\u300C${id}\u300D\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u4EBA\u7269\uFF08${personaId}\uFF09`, isError: true };
    const content = JSON.stringify({ ok: true, id: quote.id, personaId, text: quote.text, source: quote.source, credibility: quote.credibility });
    if (content.length > TOOL_RESULT_MAX_CHARS) return { content: "\u8BED\u5F55\u7ED3\u679C\u8D85\u51FA\u56DE\u5408\u9884\u7B97\uFF0C\u672A\u6388\u4E88\u8BC1\u636E", isError: true };
    ledger?.grant({ evidenceId: quote.id, kind: "quote", personaId, turnId: ledger.turnId });
    return { content };
  };
  return { retrieve, fetch };
}
function makeActorHandlers(libs, personaId, ledger) {
  const quotes = makeQuoteHandlers(libs, personaId, ledger);
  return {
    retrieve_anecdotes: makeRetrieveHandler(libs, personaId, ledger),
    fetch_anecdote: makeFetchHandler(libs, personaId, ledger),
    retrieve_quotes: quotes.retrieve,
    fetch_quote: quotes.fetch
  };
}

// src/evidence/render.ts
function renderVerifiedReply(segments, libs, questions = []) {
  return segments.map((s) => {
    if (s.kind === "modern_inference") return `\u3010\u4ECA\u8BD1/\u63A8\u6F14\u3011${s.text}`;
    if (s.kind === "modern_external_fact") return `\u3010\u73B0\u4EE3\u5916\u90E8\u4E8B\u5B9E\u3011${s.text}\u3014\u6765\u6E90\uFF1A${(s.evidenceIds ?? []).join("\u3001")}\u3015`;
    if (s.kind === "historical_fact") {
      const facts = (s.evidenceIds ?? []).map((id) => libs.anecdotes.byId(id)).filter((x) => Boolean(x));
      return facts.map((fact) => `\u3010\u53F2\u5B9E\u4F9D\u636E\u3011${fact.title}\uFF1A${fact.summary}\u3014\u51FA\u5904\uFF1A${fact.source}\u3015`).join("\n");
    }
    if (s.kind === "verbatim_quote" || s.kind === "thought_attribution") {
      const quotes = (s.evidenceIds ?? []).map((id) => libs.quotes.byId(id)).filter((x) => Boolean(x));
      const sources = (s.evidenceIds ?? []).map((id) => libs.quotes.byId(id)?.source ?? libs.anecdotes.byId(id)?.source).filter((x) => Boolean(x));
      const [quote] = quotes;
      const text = s.kind === "verbatim_quote" && quotes.length === 1 && quote !== void 0 ? quote.text : s.text;
      return sources.length ? `${text}\u3014\u51FA\u5904\uFF1A${[...new Set(sources)].join("\uFF1B")}\u3015` : text;
    }
    return s.text;
  }).concat(questions.map((q) => q.trim()).filter(Boolean)).join("\n");
}

// src/evidence/policy.ts
function validateActorReply(segments, ledger, libs, personaId) {
  const violations = [];
  if (ledger.personaId !== personaId) violations.push({ code: "persona-mismatch", detail: "\u8BC1\u636E\u8D26\u672C\u4EBA\u7269\u4E0E\u5F53\u524D\u4EBA\u7269\u4E0D\u4E00\u81F4" });
  segments.forEach((segment, index) => {
    const ids = segment.evidenceIds ?? [];
    if (segment.kind === "historical_fact" || segment.kind === "thought_attribution" || segment.kind === "modern_external_fact") {
      if (!ids.some((id) => ledger.hasCurrentGrant(id))) violations.push({ code: "missing-current-grant", segmentIndex: index, detail: `${segment.kind} \u7F3A\u5C11\u5F53\u524D\u4EBA\u7269\u5F53\u524D\u56DE\u5408\u8BC1\u636E\u6388\u6743` });
    }
    if (segment.kind === "modern_external_fact" && !ids.some((id) => ledger.hasCurrentGrant(id, "web"))) violations.push({ code: "missing-web-grant", segmentIndex: index, detail: "\u73B0\u4EE3\u5916\u90E8\u4E8B\u5B9E\u5FC5\u987B\u7ED1\u5B9A\u5F53\u524D\u56DE\u5408 web evidence" });
    if (segment.kind !== "modern_external_fact" && ids.some((id) => ledger.get(id)?.kind === "web")) violations.push({ code: "web-evidence-kind-mismatch", segmentIndex: index, detail: "web evidence \u53EA\u80FD\u652F\u6301 modern_external_fact" });
    if (segment.kind === "historical_fact" && !ids.some((id) => ledger.hasCurrentGrant(id, "anecdote"))) {
      violations.push({ code: "missing-anecdote-grant", segmentIndex: index, detail: "\u5386\u53F2\u4E8B\u8FF9\u5FC5\u987B\u7531\u5F53\u524D\u4EBA\u7269\u5F53\u524D\u56DE\u5408\u7684 anecdote evidence \u6388\u6743" });
    }
    if (segment.kind === "verbatim_quote") {
      const quoteIds = ids.filter((id) => ledger.hasCurrentGrant(id, "quote"));
      if (quoteIds.length === 0) violations.push({ code: "missing-quote-grant", segmentIndex: index, detail: "\u539F\u8BDD\u7F3A\u5C11\u5F53\u524D\u56DE\u5408\u8BED\u5F55\u8BC1\u636E\u6388\u6743" });
      else if (quoteIds.length !== 1 || ids.length !== 1) violations.push({ code: "ambiguous-quote-evidence", segmentIndex: index, detail: "\u9010\u5B57\u539F\u8BDD\u5FC5\u987B\u7531\u552F\u4E00\u5F53\u524D\u56DE\u5408\u8BED\u5F55 evidence ID \u786E\u5B9A" });
      else if (!quoteIds.some((id) => {
        const q = libs.quotes.byId(id);
        return q !== void 0 && q.personaId === personaId;
      })) violations.push({ code: "unknown-quote-id", segmentIndex: index, detail: "\u8BED\u5F55 evidence ID \u4E0D\u5C5E\u4E8E\u5F53\u524D\u4EBA\u7269\u5E93" });
    }
    for (const id of ids) {
      const grant = ledger.get(id);
      if (grant === void 0 || grant.personaId !== personaId || grant.turnId !== ledger.turnId) violations.push({ code: "invalid-evidence-grant", segmentIndex: index, detail: `\u8BC1\u636E ID \u672A\u7531\u5F53\u524D\u4EBA\u7269\u5F53\u524D\u56DE\u5408\u5DE5\u5177\u6388\u4E88: ${id}` });
      else if (grant.kind === "quote" && libs.quotes.byId(id) === void 0 || grant.kind === "anecdote" && libs.anecdotes.byId(id) === void 0) violations.push({ code: "unknown-evidence-id", segmentIndex: index, detail: `\u672A\u77E5\u8BC1\u636E ID: ${id}` });
    }
  });
  const canonicalSegments = segments.map((segment) => {
    const [evidenceId] = segment.evidenceIds ?? [];
    if (segment.kind !== "verbatim_quote" || segment.evidenceIds?.length !== 1 || evidenceId === void 0) return segment;
    const quote = libs.quotes.byId(evidenceId);
    return quote && quote.personaId === personaId ? { ...segment, text: quote.text } : segment;
  });
  const whole = canonicalSegments.map((s) => s.text).join("\n");
  const hit = libs.blacklist.matchText(whole, personaId, "actor-reply");
  if (hit) violations.push({ code: hit.mode === "first-person" ? "forbidden-first-person" : "blacklisted-quote", detail: `\u56DE\u7B54\u547D\u4E2D\u9ED1\u540D\u5355: ${hit.text}` });
  return { ok: violations.length === 0, violations, segments: canonicalSegments };
}

// src/runtime/actor-tool-contract.ts
import { z as z5 } from "zod";

// src/dialogue/types.ts
import { z as z4 } from "zod";
var taskModeSchema2 = z4.enum(["knowledge", "dilemma", "review"]);
var safetyDispositionSchema = z4.enum(["allow", "professional-boundary", "urgent-help", "refuse"]);
var safetyReasonSchema = z4.enum(["none", "medical", "mental-health", "legal", "financial", "self-harm", "imminent-danger", "sexual", "illegal-assistance"]);
var dialoguePhaseSchema = z4.enum(["responding", "clarifying", "awaiting-confirmation", "reflecting", "action-defined", "paused", "closed"]);
var feedbackKindSchema = z4.enum(["none", "confirm", "partial-confirm", "correct", "reject", "new-information", "reality-changed", "disagree-persona", "not-helpful", "question-evidence", "action-feedback", "skip", "continue", "pause", "end", "unclear"]);
var turnIntentSchema = z4.enum(TURN_INTENTS);
var dialogueControlSchema = z4.enum(DIALOGUE_CONTROLS);
var turnControlDecisionSchema = z4.object({
  safety: safetyDispositionSchema,
  safetyReason: safetyReasonSchema,
  taskMode: taskModeSchema2,
  confidence: z4.enum(["high", "low"]),
  emotionPriority: z4.boolean(),
  feedbackKind: feedbackKindSchema,
  independentNewDilemma: z4.boolean()
}).strict();
var defaultControlDecision = () => ({ safety: "allow", safetyReason: "none", taskMode: "dilemma", confidence: "low", emotionPriority: false, feedbackKind: "unclear", independentNewDilemma: false });

// src/runtime/actor-tool-contract.ts
var segmentSchema = z5.object({ kind: z5.enum(["dialogue", "historical_fact", "verbatim_quote", "thought_attribution", "modern_inference", "modern_external_fact"]), text: z5.string().trim().min(1), evidenceIds: z5.array(z5.string().min(1)).optional() }).strict().superRefine((s, ctx) => {
  if (["historical_fact", "verbatim_quote", "thought_attribution", "modern_external_fact"].includes(s.kind) && (!s.evidenceIds || s.evidenceIds.length === 0)) ctx.addIssue({ code: z5.ZodIssueCode.custom, message: "evidence required" });
});
var submitArgsSchema = z5.object({ segments: z5.array(segmentSchema).min(1), turnIntent: turnIntentSchema.optional(), questions: z5.array(z5.string().trim().min(1)).refine((x) => new Set(x).size === x.length, "duplicate questions").optional(), offeredControls: z5.array(dialogueControlSchema).max(9).refine((x) => new Set(x).size === x.length, "duplicate controls").optional() }).strict();
function validateSubmitArgsDetailed(value) {
  if (!value || typeof value !== "object") return { ok: false, code: "invalid_segments" };
  const v = value;
  if ("turnIntent" in v && !turnIntentSchema.safeParse(v.turnIntent).success) return { ok: false, code: "invalid_intent" };
  if ("questions" in v && (!Array.isArray(v.questions) || new Set(v.questions).size !== v.questions.length || v.questions.some((q) => typeof q !== "string" || !q.trim()))) return { ok: false, code: "invalid_questions" };
  if ("offeredControls" in v && (!Array.isArray(v.offeredControls) || new Set(v.offeredControls).size !== v.offeredControls.length || v.offeredControls.some((c) => !dialogueControlSchema.safeParse(c).success))) return { ok: false, code: "invalid_controls" };
  const parsed = submitArgsSchema.safeParse(value);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, code: "invalid_segments" };
}
function validateSubmitArgs(value) {
  if (!value || typeof value !== "object" || !Object.hasOwn(value, "segments") || Object.keys(value).some((k) => !["segments", "turnIntent", "questions", "offeredControls"].includes(k))) return false;
  const segments = value.segments;
  if (!Array.isArray(segments) || segments.length === 0) return false;
  const extra = value;
  if (extra.turnIntent !== void 0 && !turnIntentSchema.safeParse(extra.turnIntent).success) return false;
  if (extra.questions !== void 0 && (!Array.isArray(extra.questions) || new Set(extra.questions).size !== extra.questions.length || extra.questions.some((q) => typeof q !== "string" || !q.trim()))) return false;
  if (extra.offeredControls !== void 0 && (!Array.isArray(extra.offeredControls) || new Set(extra.offeredControls).size !== extra.offeredControls.length || extra.offeredControls.some((c) => !dialogueControlSchema.safeParse(c).success))) return false;
  return segments.every((s) => {
    if (!s || typeof s !== "object" || Object.keys(s).some((k) => !["kind", "text", "evidenceIds"].includes(k))) return false;
    const x = s;
    if (!["dialogue", "historical_fact", "verbatim_quote", "thought_attribution", "modern_inference", "modern_external_fact"].includes(String(x.kind)) || typeof x.text !== "string" || !x.text.trim()) return false;
    if (x.evidenceIds !== void 0 && (!Array.isArray(x.evidenceIds) || x.evidenceIds.some((id) => typeof id !== "string" || !id))) return false;
    return !["historical_fact", "verbatim_quote", "thought_attribution", "modern_external_fact"].includes(String(x.kind)) || Array.isArray(x.evidenceIds) && x.evidenceIds.length > 0;
  });
}
function missingEvidenceDetails(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.segments)) return void 0;
  const missing = value.segments.flatMap((segment, index) => {
    if (!segment || typeof segment !== "object") return [];
    const item = segment;
    if (["historical_fact", "verbatim_quote", "thought_attribution"].includes(String(item.kind)) && (!Array.isArray(item.evidenceIds) || item.evidenceIds.length === 0)) return [`segments[${index}](${String(item.kind)})`];
    return [];
  });
  return missing.length === 0 ? void 0 : `\u4EE5\u4E0B\u53F2\u5B9E/\u5F15\u6587\u6BB5\u7F3A\u5C11 evidenceIds\uFF1A${missing.join("\u3001")}\u3002\u5141\u8BB8\u4E24\u6761\u4FEE\u590D\u8DEF\u5F84\uFF1A\u7ED1\u5B9A\u5F53\u524D\u56DE\u5408 ledger \u4E2D\u771F\u5B9E evidence ID\uFF0C\u6216\u5220\u9664\u8FD9\u4E9B\u6BB5/\u6539\u4E3A dialogue \u6216 modern_inference\uFF1B\u4E0D\u5F97\u539F\u6837\u91CD\u653E\u4E0A\u4E00\u53C2\u6570\u3002`;
}

// src/runtime/submit-actor-reply.ts
function submitActorReply(args, deps) {
  const shape = validateSubmitArgsDetailed(args);
  if (!shape.ok) return { ok: false, violations: [{ code: shape.code, detail: `invalid submit field: ${shape.code}` }], concluded: false };
  args = { ...args, ...args.questions === void 0 ? {} : { questions: args.questions.map((q) => q.trim()) } };
  const checked = validateActorReply(args.segments, deps.ledger, deps.libs, deps.personaId);
  if (!checked.ok) return { ok: false, violations: checked.violations, concluded: false, diagnostics: { attempt: deps.diagnosticAttempt ?? 1, errorCode: checked.violations[0]?.code ?? "invalid-submit", repairable: true, fallback: false, concluded: false, violations: checked.violations.map((v) => ({ code: v.code, ...v.segmentIndex === void 0 ? {} : { segmentIndex: v.segmentIndex } })) } };
  const evidence = [...new Set(checked.segments.flatMap((s) => s.evidenceIds ?? []))].map((id) => {
    const q = deps.libs.quotes.byId(id);
    if (q) return { id, kind: "quote", source: q.source, credibility: q.credibility };
    const a = deps.libs.anecdotes.byId(id);
    return a ? { id, kind: "anecdote", source: a.source, title: a.title } : void 0;
  }).filter((x) => Boolean(x));
  deps.concludeTurn?.();
  return { ok: true, reply: renderVerifiedReply(checked.segments, deps.libs, args.questions), ...args.turnIntent === void 0 ? {} : { turnIntent: args.turnIntent }, ...args.questions === void 0 ? {} : { questions: args.questions }, ...args.offeredControls === void 0 ? {} : { controls: args.offeredControls }, evidence, concluded: true, repaired: false };
}

// src/evidence/web-collector.ts
function collectWebEvidence(input) {
  return input.results.filter((x) => /^https?:\/\//i.test(x.url)).map((x, i) => ({ id: `web-${input.turnId}-${i}`, url: x.url, title: x.title ?? "", snippet: x.snippet ?? "", personaId: input.personaId, turnId: input.turnId }));
}

// src/runtime/web-tool-seam.ts
async function runWebSearchSeam(search, query, personaId, turnId, ledger) {
  try {
    const results = collectWebEvidence({ personaId, turnId, results: await search(query) });
    for (const item of results) ledger.grant({ evidenceId: item.id, kind: "web", personaId, turnId });
    return { ok: true, results };
  } catch {
    return { ok: false, errorCode: "web-search-unavailable" };
  }
}

// src/runtime/actor-tools.ts
var output = { schema: { type: "json" }, render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }] };
function canonical(result) {
  try {
    const parsed = JSON.parse(result.content);
    return result.isError && parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { ok: false, ...parsed } : parsed;
  } catch {
    return { ok: false, error: result.content };
  }
}
function toJson(value) {
  return JSON.parse(JSON.stringify(value));
}
function sanitizeSubmitDiagnostics(attempt, payload) {
  const accepted = payload.ok === true && payload.concluded === true;
  return { attempt, accepted, errorCode: accepted ? "ok" : payload.errorCode ?? (payload.fallback === true ? "fixed-fallback" : payload.violations?.[0]?.code ?? "invalid-submit"), repairable: payload.repairable === true, fallback: payload.fallback === true, concluded: payload.concluded === true, violations: (payload.violations ?? []).map((v) => ({ code: v.code ?? "invalid-submit", ...typeof v.segmentIndex === "number" ? { segmentIndex: v.segmentIndex } : {} })) };
}
function registerActorTools(agentCtx, libs, personaId, registry2, exposedToolNames, webSearch) {
  const state = (exec) => registry2.stateForExecution(exec, personaId);
  const definitions = [
    defineTool({ name: "retrieve_anecdotes", description: "\u68C0\u7D22\u5F53\u524D\u4EBA\u7269\u4E8B\u8FF9\u3002", parameters: { query: { type: "string", required: true }, topK: { type: "number" } }, output, execute: async (args, exec) => {
      const current = state(exec);
      if (current.retrievalPolicy === "deny") return { ok: false, errorCode: "retrieval-not-authorized", detail: "\u5F53\u524D taskMode \u7981\u6B62\u68C0\u7D22\uFF1B\u8BF7\u63D0\u4EA4 dialogue/modern_inference\uFF0Csubmit_actor_reply \u4ECD\u53EF\u7528\u3002" };
      return canonical(makeActorHandlers(libs, personaId, current.ledger).retrieve_anecdotes(JSON.stringify(args)));
    } }),
    defineTool({ name: "fetch_anecdote", description: "\u8BFB\u53D6\u5F53\u524D\u4EBA\u7269\u4E8B\u8FF9\u3002", parameters: { id: { type: "string", required: true } }, output, execute: async (args, exec) => {
      const current = state(exec);
      if (current.retrievalPolicy === "deny") return { ok: false, errorCode: "retrieval-not-authorized", detail: "\u5F53\u524D taskMode \u7981\u6B62\u68C0\u7D22\uFF1B\u8BF7\u63D0\u4EA4 dialogue/modern_inference\uFF0Csubmit_actor_reply \u4ECD\u53EF\u7528\u3002" };
      return canonical(makeActorHandlers(libs, personaId, current.ledger).fetch_anecdote(JSON.stringify(args)));
    } }),
    defineTool({ name: "retrieve_quotes", description: "\u68C0\u7D22\u5F53\u524D\u4EBA\u7269\u8BED\u5F55\u3002", parameters: { query: { type: "string", required: true }, topK: { type: "number" } }, output, execute: async (args, exec) => {
      const current = state(exec);
      if (current.retrievalPolicy === "deny") return { ok: false, errorCode: "retrieval-not-authorized", detail: "\u5F53\u524D taskMode \u7981\u6B62\u68C0\u7D22\uFF1B\u8BF7\u63D0\u4EA4 dialogue/modern_inference\uFF0Csubmit_actor_reply \u4ECD\u53EF\u7528\u3002" };
      return canonical(makeActorHandlers(libs, personaId, current.ledger).retrieve_quotes(JSON.stringify(args)));
    } }),
    defineTool({ name: "fetch_quote", description: "\u8BFB\u53D6\u5F53\u524D\u4EBA\u7269\u8BED\u5F55\u3002", parameters: { id: { type: "string", required: true } }, output, execute: async (args, exec) => {
      const current = state(exec);
      if (current.retrievalPolicy === "deny") return { ok: false, errorCode: "retrieval-not-authorized", detail: "\u5F53\u524D taskMode \u7981\u6B62\u68C0\u7D22\uFF1B\u8BF7\u63D0\u4EA4 dialogue/modern_inference\uFF0Csubmit_actor_reply \u4ECD\u53EF\u7528\u3002" };
      return canonical(makeActorHandlers(libs, personaId, current.ledger).fetch_quote(JSON.stringify(args)));
    } }),
    defineTool({ name: "web_search", description: "\u641C\u7D22\u73B0\u4EE3\u5916\u90E8\u8D44\u6599\uFF1B\u7ED3\u679C\u53EA\u4F5C\u4E3A\u5F53\u524D\u56DE\u5408\u6765\u6E90\u3002", parameters: { query: { type: "string", required: true } }, output, execute: async (args, exec) => {
      if (webSearch === void 0) return { ok: false, errorCode: "web-search-unavailable", detail: "\u641C\u7D22\u80FD\u529B\u4E0D\u53EF\u7528\uFF0C\u5DF2\u4FDD\u5B88\u964D\u7EA7\u3002" };
      const current = state(exec);
      const result = await runWebSearchSeam(webSearch, String(args.query ?? ""), personaId, current.turnId, current.ledger);
      return result.ok ? result : { ...result, detail: "\u641C\u7D22\u8D85\u65F6\u6216\u4E0D\u53EF\u7528\uFF0C\u5DF2\u4FDD\u5B88\u964D\u7EA7\u3002" };
    } }),
    defineTool({ name: "submit_actor_reply", description: "\u63D0\u4EA4\u8BC1\u636E\u6821\u9A8C\u540E\u7684\u56DE\u7B54\u3002", parameters: {
      segments: {
        type: "array",
        required: true,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            kind: { type: "string", enum: ["dialogue", "historical_fact", "verbatim_quote", "thought_attribution", "modern_inference"], required: true },
            text: { type: "string", required: true },
            evidenceIds: { type: "array", items: { type: "string" } }
          }
        }
      },
      turnIntent: { type: "string", enum: ["answer", "clarify", "await-confirmation", "reflect", "offer-controls", "pause", "close"] },
      // DSH tool-schema DSL does not support maxItems; runtime只校验问题形状、
      // 去重和总预算，不按问题数量硬拒绝。
      questions: { type: "array", items: { type: "string" } },
      offeredControls: { type: "array", items: { type: "string", enum: ["confirm", "partial-confirm", "correct", "skip", "continue", "pause", "end", "switch-persona", "new-dilemma"] } }
    }, output: {
      ...output,
      presentationMeta: (args, value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return {};
        const v = value;
        return v.ok === true && v.concluded === true && typeof v.reply === "string" && v.reply.length > 0 ? { kind: "actor-reply", reply: v.reply, evidence: Array.isArray(v.evidence) ? v.evidence : [], ...typeof v.turnIntent === "string" ? { turnIntent: v.turnIntent } : {}, ...Array.isArray(v.questions) ? { questions: v.questions.map((q) => String(q).trim()) } : {}, ...Array.isArray(v.controls) ? { controls: v.controls } : {}, ...v.fallback === true ? { fallback: true } : {} } : {};
      }
    }, execute: async (args, exec) => {
      const current = state(exec);
      const attempt = current.failures + 1;
      const finish = (value) => toJson({ ...value, diagnostics: sanitizeSubmitDiagnostics(attempt, value) });
      const normalizedArgs = normalizeTurnPolicyArgs(args, current);
      const policyDetail = turnPolicyViolation(normalizedArgs, current);
      if (policyDetail) {
        current.failures++;
        current.repairDetails = `${policyDetail}\u4E0D\u5F97\u539F\u6837\u91CD\u653E\u4E0A\u4E00\u53C2\u6570\u3002`;
        if (current.failures >= 2) {
          exec.concludeTurn();
          return finish({ ok: false, errorCode: "turn-policy-violation", fallback: true, concluded: true, error: "\u63D0\u4EA4\u8FDE\u7EED\u5931\u8D25\uFF0C\u56DE\u5408\u5DF2\u7ED3\u675F\u3002" });
        }
        return finish({ ok: false, repairable: true, errorCode: "turn-policy-violation", detail: policyDetail });
      }
      if (!validateSubmitArgs(normalizedArgs)) {
        current.failures++;
        const detail = missingEvidenceDetails(normalizedArgs);
        const errorCode = detail ? "missing-evidence-ids" : "invalid-submit";
        if (detail) current.repairDetails = detail;
        if (current.failures >= 2) {
          exec.concludeTurn();
          return finish({ ok: false, errorCode, fallback: true, concluded: true, error: "\u63D0\u4EA4\u8FDE\u7EED\u5931\u8D25\uFF0C\u56DE\u5408\u5DF2\u7ED3\u675F\u3002" });
        }
        return finish({ ok: false, repairable: true, errorCode, detail: detail ?? "\u63D0\u4EA4\u7ED3\u6784\u65E0\u6548\uFF0C\u8BF7\u4FEE\u590D\u540E\u91CD\u8BD5\u3002" });
      }
      const result = submitActorReply(normalizedArgs, { ledger: current.ledger, libs, personaId });
      if (!result.ok) {
        current.failures++;
        const detail = result.violations?.map((v) => v.detail).join("\uFF1B");
        if (detail) current.repairDetails = `${detail}\u3002\u5141\u8BB8\u4E24\u6761\u4FEE\u590D\u8DEF\u5F84\uFF1A\u7ED1\u5B9A\u5F53\u524D\u56DE\u5408 ledger \u4E2D\u771F\u5B9E evidence ID\uFF0C\u6216\u5220\u9664\u8FD9\u4E9B\u6BB5/\u6539\u4E3A dialogue \u6216 modern_inference\uFF1B\u4E0D\u5F97\u539F\u6837\u91CD\u653E\u4E0A\u4E00\u53C2\u6570\u3002`;
        if (current.failures >= 2) {
          exec.concludeTurn();
          return finish({ ok: false, errorCode: "evidence-gate-rejected", violations: result.violations, fallback: true, concluded: true, error: "\u63D0\u4EA4\u8FDE\u7EED\u5931\u8D25\uFF0C\u56DE\u5408\u5DF2\u7ED3\u675F\u3002" });
        }
        return finish({ ok: false, repairable: true, errorCode: "evidence-gate-rejected", violations: result.violations, detail: current.repairDetails });
      }
      exec.concludeTurn();
      return finish(result);
    } })
  ];
  const exposed = exposedToolNames ? new Set(exposedToolNames) : void 0;
  const registered = exposed ? definitions.filter((definition) => exposed.has(definition.name)) : definitions;
  for (const definition of registered) agentCtx.tools.register(definition);
  return registered;
}

// src/runtime/actor-context-filter.ts
function filterActorStepMessages(messages) {
  return messages.filter((message) => message.source?.kind === "user" || message.source?.kind === "plugin" && message.source.plugin === "man-roles-roleplayer");
}

// src/runtime/actor-agent.ts
function setupActorAgent(personaId, libs, registry2, capture, options) {
  return (agentCtx) => {
    const spec = personaSpecFor(personaId);
    agentCtx.systemPrompt.section({ name: "man-roles:persona", order: 0, complete: true, text: `[MAN_ROLES_PERSONA=${personaId}]
${spec.systemPrompt}

\u4EA7\u54C1\u8FD0\u884C\u7EA6\u675F\uFF1A\u6BCF\u4E00\u8F6E\u5FC5\u987B\u4EE5 submit_actor_reply \u4F5C\u4E3A\u552F\u4E00\u7EC8\u6B62\u52A8\u4F5C\uFF1B\u5148\u5B8C\u6210\u5FC5\u8981\u68C0\u7D22/\u53D6\u8BC1\uFF0C\u518D\u8C03\u7528 submit_actor_reply \u63D0\u4EA4\u53EF\u5C55\u793A\u56DE\u7B54\u3002\u4E0D\u8981\u7528\u666E\u901A assistant \u6587\u672C\u7ED3\u675F\u56DE\u5408\uFF0C\u666E\u901A\u6587\u672C\u4E0D\u4F1A\u88AB\u4EA7\u54C1\u6D88\u8D39\u3002dialogue \u573A\u666F\u4E5F\u5FC5\u987B\u63D0\u4EA4 dialogue segment\uFF1B\u8BC1\u636E\u573A\u666F\u5FC5\u987B\u63D0\u4EA4\u901A\u8FC7\u8BC1\u636E\u95E8\u7684 evidence ID\u3002` });
    agentCtx.tools.restrict({ allow: [] });
    agentCtx.tools.presentAs("native");
    agentCtx.on("agent/pre-step", async (_payload, next) => {
      const decision = await next();
      return decision.kind === "enter" ? { ...decision, messages: filterActorStepMessages(decision.messages) } : decision;
    });
    agentCtx.on("agent/request", async (_payload, next) => ({ ...await next(), reasoningEffort: ReasoningEffortId("off") }));
    agentCtx.on("agent/turn-stopping", ({ agent }) => {
      const repairDetails = registry2.consumeRepairPrompt(agent.session);
      if (repairDetails) agent.steer(createUserMessage({ content: [{ type: "text", text: `\u4E0A\u4E00\u6B21 submit_actor_reply \u88AB\u8BC1\u636E\u95E8\u4EE5 repairable \u62D2\u7EDD\u3002${repairDetails}\u73B0\u5728\u5FC5\u987B\u53EA\u8C03\u7528\u4E00\u6B21 submit_actor_reply\uFF1B\u4E0D\u8981\u8F93\u51FA\u666E\u901A\u6587\u672C\u3002` }], source: { kind: "plugin", plugin: "man-roles-roleplayer" } }));
      else if (process.env.MAN_ROLES_RP_E2E === "native-evidence" && registry2.consumeEvidenceRecoveryPrompt(agent.session)) agent.steer(createUserMessage({ content: [{ type: "text", text: "\u4F60\u5DF2\u7ECF\u53D6\u5F97\u5F53\u524D\u4EBA\u7269 evidence\uFF0C\u4F46\u5C1A\u672A\u63D0\u4EA4\u4EA7\u54C1\u56DE\u7B54\u3002\u73B0\u5728\u5FC5\u987B\u53EA\u8C03\u7528\u4E00\u6B21 submit_actor_reply\uFF0C\u4F7F\u7528\u5DF2\u6709 evidence \u6216\u5B89\u5168 dialogue\uFF1B\u4E0D\u8981\u8F93\u51FA\u666E\u901A\u6587\u672C\uFF0C\u4E5F\u4E0D\u8981\u65B0\u589E\u68C0\u7D22\u3002" }], source: { kind: "plugin", plugin: "man-roles-roleplayer" } }));
    });
    const definitions = registerActorTools(agentCtx, libs, personaId, registry2, options?.exposedToolNames);
    capture?.(definitions.map((x) => x.name));
  };
}

// src/runtime/actor-reply-projection.ts
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function callIdFromSource(source) {
  if (!isRecord(source) || typeof source.callId !== "string") return void 0;
  return source.callId;
}
function toolCallIdFromContent(content) {
  if (!Array.isArray(content)) return void 0;
  const first = content[0];
  return isRecord(first) && typeof first.toolCallId === "string" ? first.toolCallId : void 0;
}
function isProjectedEvidence(value) {
  if (!isRecord(value) || typeof value.id !== "string" || value.kind !== "quote" && value.kind !== "anecdote" || typeof value.source !== "string") return false;
  return (value.credibility === void 0 || typeof value.credibility === "string") && (value.title === void 0 || typeof value.title === "string");
}
function isProjectedEvidenceArray(value) {
  return Array.isArray(value) && value.every(isProjectedEvidence);
}
function isPublicMeta(value) {
  return (value.turnIntent === void 0 || isTurnIntent(value.turnIntent)) && (value.questions === void 0 || Array.isArray(value.questions) && value.questions.every((q) => typeof q === "string")) && (value.controls === void 0 || Array.isArray(value.controls) && value.controls.every(isDialogueControl));
}
function parseActorReplyMeta(value) {
  if (!isRecord(value) || value.kind !== "actor-reply" || typeof value.reply !== "string" || !isProjectedEvidenceArray(value.evidence) || !isPublicMeta(value)) return void 0;
  return { kind: "actor-reply", reply: value.reply, evidence: value.evidence, ...typeof value.turnIntent === "string" ? { turnIntent: value.turnIntent } : {}, ...Array.isArray(value.questions) ? { questions: value.questions } : {}, ...Array.isArray(value.controls) ? { controls: value.controls } : {}, ...value.fallback === true ? { fallback: true } : {} };
}
function projectActorReply(events, turn) {
  const calls = /* @__PURE__ */ new Set();
  let result;
  let active;
  for (const event of events) {
    const data = event.data;
    if (!isRecord(data)) continue;
    const turnValue = data.turn;
    if (event.type === "turn/start" && typeof turnValue === "number") active = turnValue;
    if (event.type === "turn/end" && turnValue === active) {
      active = void 0;
      continue;
    }
    if (active !== turn) continue;
    if (event.type === "tool/call" && data.name === "submit_actor_reply" && typeof data.callId === "string") calls.add(data.callId);
    if (event.type === "tool/result") {
      const message = isRecord(data.message) ? data.message : void 0;
      const callId = callIdFromSource(message?.source) ?? toolCallIdFromContent(data.content);
      if (!callId || !calls.has(callId)) continue;
      const parsed = parseActorReplyMeta(data.meta);
      if (!parsed) continue;
      if (result) return void 0;
      result = parsed;
    }
  }
  return result;
}

// src/dialogue/safety.ts
import { z as z6 } from "zod";
var safetyResultSchema = z6.object({ disposition: z6.enum(["allow", "professional-boundary", "urgent-help", "refuse"]), reason: z6.enum(["none", "medical", "mental-health", "legal", "financial", "self-harm", "imminent-danger", "sexual", "illegal-assistance"]), message: z6.string() }).strict().superRefine((v, ctx) => {
  const allowed = { allow: ["none"], "professional-boundary": ["medical", "mental-health", "legal", "financial"], "urgent-help": ["self-harm", "imminent-danger"], refuse: ["sexual", "illegal-assistance"] };
  if (!(allowed[v.disposition] ?? []).includes(v.reason)) ctx.addIssue({ code: z6.ZodIssueCode.custom, message: "safety reason does not match disposition" });
  if (v.disposition === "allow" && v.message !== "") ctx.addIssue({ code: z6.ZodIssueCode.custom, message: "allow must have empty message" });
  if (v.disposition !== "allow" && v.message.trim() === "") ctx.addIssue({ code: z6.ZodIssueCode.custom, message: "nonallow must have non-empty message" });
});
var urgent = [/(?:我|我现在|我准备|我想要|打算|今晚).{0,16}(?:自杀|自傷|自伤|割腕|结束生命|想死|伤害自己|殺了自己|suicid|kill myself|end my life)/i, /马上伤害某人/i, /(?:有人|他人|对方).{0,16}(?:要杀|杀人|伤害他人|hurt someone).{0,16}(?:现在|马上|现实|imminent|now)/i, /(?:现实危险|imminent danger)/i];
var professional = [["medical", /诊断|治疗方案|用药|药物剂量|medical advice|diagnos/i], ["mental-health", /心理咨询|精神疾病|心理治疗|我是不是.{0,6}(?:抑郁|焦虑|双相)|mental health|therapy/i], ["legal", /法律意见|诉讼|起诉|律师|legal advice|lawsuit/i], ["financial", /投资建议|买股票|收益保证|借贷决策|financial advice|guaranteed return/i]];
var refuse = [["sexual", /露骨色情|色情描写|pornograph|explicit sex/i], ["illegal-assistance", /制毒|炸弹制作|制作炸弹|入侵系统|盗窃方案|违法协助|make a bomb|how to hack/i]];
function deterministicSafetyGate(text) {
  if (urgent.some((r) => r.test(text))) return { disposition: "urgent-help", reason: /自杀|自傷|自伤|伤害自己|殺了自己|suicid/i.test(text) ? "self-harm" : "imminent-danger", message: "\u8FD9\u4EF6\u4E8B\u6D89\u53CA\u73B0\u5B9E\u5B89\u5168\u98CE\u9669\uFF0C\u8BF7\u7ACB\u5373\u8054\u7CFB\u5F53\u5730\u6025\u6551\u670D\u52A1\u3001\u5371\u673A\u70ED\u7EBF\u6216\u8EAB\u8FB9\u53EF\u4FE1\u4EFB\u7684\u4EBA\uFF1B\u672C\u4EA7\u54C1\u4E0D\u4F1A\u4EE5\u4EBA\u7269\u5BF9\u8BDD\u66FF\u4EE3\u7D27\u6025\u652F\u6301\u3002" };
  for (const [reason, pattern] of professional) if (pattern.test(text)) return { disposition: "professional-boundary", reason, message: "\u8FD9\u5C5E\u4E8E\u4E13\u4E1A\u9AD8\u98CE\u9669\u95EE\u9898\uFF0C\u8BF7\u54A8\u8BE2\u5408\u683C\u7684\u4E13\u4E1A\u4EBA\u58EB\uFF1B\u672C\u4EA7\u54C1\u4E0D\u80FD\u63D0\u4F9B\u8BCA\u65AD\u3001\u6CD5\u5F8B\u7ED3\u8BBA\u6216\u8D22\u52A1\u51B3\u7B56\u3002" };
  for (const [reason, pattern] of refuse) if (pattern.test(text)) return { disposition: "refuse", reason, message: "\u62B1\u6B49\uFF0C\u6211\u4E0D\u80FD\u534F\u52A9\u8FD9\u7C7B\u5185\u5BB9\u3002" };
  return { disposition: "allow", reason: "none", message: "" };
}
function mergeSafetyDecision(deterministic, classified) {
  if (deterministic.disposition !== "allow") return deterministic;
  const candidate = { ...classified, message: classified.disposition === "allow" ? "" : classified.disposition === "urgent-help" ? "\u8BF7\u4F18\u5148\u8054\u7CFB\u5F53\u5730\u6025\u6551\u670D\u52A1\u3001\u5371\u673A\u70ED\u7EBF\u6216\u8EAB\u8FB9\u53EF\u4FE1\u4EFB\u7684\u4EBA\u3002" : classified.disposition === "professional-boundary" ? "\u8BF7\u54A8\u8BE2\u5408\u683C\u7684\u4E13\u4E1A\u4EBA\u58EB\uFF1B\u672C\u4EA7\u54C1\u4E0D\u80FD\u66FF\u4EE3\u4E13\u4E1A\u610F\u89C1\u3002" : "\u62B1\u6B49\uFF0C\u6211\u4E0D\u80FD\u534F\u52A9\u8FD9\u7C7B\u5185\u5BB9\u3002" };
  const parsed = safetyResultSchema.safeParse(candidate);
  return parsed.success ? parsed.data : deterministic;
}

// src/dialogue/control-classifier.ts
function parseControlDecision(value) {
  return turnControlDecisionSchema.parse(value);
}
function createControlClassifier(adapter, observe) {
  return { async classify(input) {
    const started = Date.now();
    const safety = deterministicSafetyGate(input.raw);
    let output2;
    let failed = false;
    let repaired = false;
    let attempts = 0;
    let parseAttempts = 0;
    let tokenUsage = void 0;
    if (adapter && safety.disposition === "allow") {
      const request = { raw: input.raw, ...input.confirmedContext === void 0 ? {} : { confirmedContext: input.confirmedContext }, ...input.phase === void 0 ? {} : { phase: input.phase }, ...input.invocationId === void 0 ? {} : { invocationId: input.invocationId } };
      const invoke = async () => {
        attempts++;
        const value = await adapter(request);
        if (value && typeof value === "object" && "usage" in value) {
          const u = value.usage;
          if (u && typeof u.input === "number" && typeof u.output === "number") tokenUsage = { input: (tokenUsage?.input ?? 0) + u.input, output: (tokenUsage?.output ?? 0) + u.output, reasoning: (tokenUsage?.reasoning ?? 0) + (typeof u.reasoning === "number" ? u.reasoning : 0) };
        }
        return value && typeof value === "object" && "decision" in value ? value.decision : value;
      };
      try {
        parseAttempts++;
        output2 = parseControlDecision(await invoke());
      } catch (error) {
        failed = true;
        try {
          parseAttempts++;
          output2 = parseControlDecision(await invoke());
          repaired = true;
          failed = false;
        } catch (repairError) {
          failed = true;
        }
      }
    }
    const base = output2 ?? defaultControlDecision();
    const merged = mergeSafetyDecision(safety, { disposition: base.safety, reason: base.safetyReason, message: "" });
    const result = { ...base, safety: merged.disposition, safetyReason: merged.reason };
    observe?.({ input: { raw: input.raw, ...input.confirmedContext === void 0 ? {} : { confirmedContext: input.confirmedContext }, ...input.phase === void 0 ? {} : { phase: input.phase }, ...input.invocationId === void 0 ? {} : { invocationId: input.invocationId } }, output: result, parseFailed: failed, repairUsed: repaired, attempts, parseAttempts, latencyMs: Date.now() - started, ...tokenUsage ? { tokenUsage } : {} });
    return result;
  } };
}

// src/dialogue/turn-policy.ts
function decideTurn(input) {
  const { taskMode, feedbackKind, phase, hasCandidate = false, hasConfirmed = false, noProgressCount = 0, emotionPriority = false, independentNewDilemma = false } = input;
  if (feedbackKind === "end" || phase === "closed") return { intent: "close", maxQuestions: 0, allowedControls: [], shouldRunDirector: false, shouldOfferNewConversation: false };
  if (feedbackKind === "pause" || phase === "paused") return { intent: "pause", maxQuestions: 0, allowedControls: ["continue", "end"], shouldRunDirector: false, shouldOfferNewConversation: false };
  if (noProgressCount >= 2) return { intent: "offer-controls", maxQuestions: 0, allowedControls: ["correct", "skip", "switch-persona", "end"], shouldRunDirector: false, shouldOfferNewConversation: false };
  if (taskMode === "knowledge") return { intent: "answer", maxQuestions: 0, allowedControls: ["continue", "end"], shouldRunDirector: false, shouldOfferNewConversation: false };
  if (independentNewDilemma) return { intent: "offer-controls", maxQuestions: 0, allowedControls: ["new-dilemma", "continue", "end"], shouldRunDirector: false, shouldOfferNewConversation: true };
  if (taskMode === "review" || feedbackKind === "reality-changed") return { intent: "reflect", maxQuestions: 1, allowedControls: ["continue", "correct", "end"], shouldRunDirector: false, shouldOfferNewConversation: false };
  if (hasCandidate && feedbackKind === "none") return { intent: "await-confirmation", maxQuestions: 0, allowedControls: ["confirm", "partial-confirm", "correct", "skip", "end"], shouldRunDirector: false, shouldOfferNewConversation: false };
  if (feedbackKind === "confirm" || feedbackKind === "partial-confirm" || feedbackKind === "correct") return { intent: "reflect", maxQuestions: 0, allowedControls: ["continue", "end"], shouldRunDirector: false, shouldOfferNewConversation: false };
  if (feedbackKind === "skip") return { intent: "clarify", maxQuestions: emotionPriority ? 1 : 2, allowedControls: ["continue", "pause", "end"], shouldRunDirector: false, shouldOfferNewConversation: false };
  const allowedControls = ["continue", "skip", "pause", "end"];
  return { intent: "clarify", maxQuestions: emotionPriority ? 1 : 2, allowedControls: [...allowedControls], shouldRunDirector: !hasCandidate && !hasConfirmed, shouldOfferNewConversation: false };
}

// src/dialogue/feedback-commit.ts
import { z as z7 } from "zod";
var feedbackPayloadSchema = z7.object({
  kind: z7.enum(["none", "confirm", "partial-confirm", "correct", "reject", "new-information", "reality-changed", "disagree-persona", "not-helpful", "question-evidence", "action-feedback", "skip", "continue", "pause", "end", "unclear"]),
  itemId: z7.string().min(1).optional(),
  replacement: z7.unknown().optional(),
  details: z7.object({ summary: z7.string().trim().min(1), lastSemanticSeq: z7.number().optional() }).strict().optional()
}).strict();
var reviewed = /* @__PURE__ */ new Set(["confirm", "partial-confirm", "correct", "reject", "skip"]);
function orderedSourceRefs(trunk, refs) {
  const unique = [...new Set(refs)];
  const order = new Map(trunk.state.userRaws.map((raw, index) => [raw.rawRef, index]));
  return unique.sort((a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER));
}
function commitFeedback(input) {
  if (reviewed.has(input.kind)) {
    if (!input.itemId) throw new Error(`${input.kind} requires itemId`);
    const action = input.kind === "partial-confirm" ? "partial-confirm" : input.kind;
    if (action !== "reject" && action !== "skip" && input.replacement === void 0) throw new Error(`${input.kind} requires replacement`);
    const replacementRefs = input.replacement && typeof input.replacement === "object" && Array.isArray(input.replacement.sourceRawRefs) ? input.replacement.sourceRawRefs : [];
    const meta3 = { messageId: input.messageId, taskId: input.taskId, eventPurpose: input.eventPurpose, sourceRawRefs: orderedSourceRefs(input.trunk, [...input.sourceRawRefs, ...replacementRefs]) };
    return input.trunk.reviewDilemmaItem(input.itemId, input.replacement, { ...meta3, action, personaId: input.personaId });
  }
  const meta2 = { messageId: input.messageId, taskId: input.taskId, eventPurpose: input.eventPurpose, sourceRawRefs: input.sourceRawRefs };
  if (input.kind === "pause" || input.kind === "end" || input.kind === "continue") return input.trunk.recordSessionControl({ ...meta2, control: input.kind === "continue" ? "resume" : input.kind, personaId: input.personaId });
  if (input.kind === "question-evidence") return input.trunk.recordAction({ ...meta2, action: "question-evidence", details: input.details ?? {} });
  if (input.kind === "disagree-persona" || input.kind === "not-helpful") {
    const summary = input.details?.summary;
    if (!summary) throw new Error(`${input.kind} requires details.summary`);
    return input.trunk.updateBranchProgress({ personaId: input.personaId, summary, lastSemanticSeq: input.details?.lastSemanticSeq ?? input.trunk.nextSeq }, meta2);
  }
  if (input.kind === "new-information" || input.kind === "reality-changed" || input.kind === "action-feedback") return input.trunk.recordAction({ ...meta2, action: input.kind, details: input.details ?? {} });
  return void 0;
}

// src/dialogue/director-update.ts
import { createHash } from "node:crypto";
import { z as z8 } from "zod";
var proposalSchema = z8.object({ id: z8.string().min(1).optional(), kind: z8.enum(["fact", "inference", "goal", "value-conflict", "core-conflict"]), text: z8.string().min(1), sourceRawRefs: z8.array(z8.string().min(1)).min(1), proposedByPersona: personaIdSchema2 }).strict();
var directorUpdateSchema = z8.object({ propose: z8.array(proposalSchema), coreCandidateId: z8.string().min(1).optional() }).strict();
var idFor = (p) => `candidate-${createHash("sha256").update(JSON.stringify([p.kind, p.text, p.sourceRawRefs, p.proposedByPersona])).digest("hex").slice(0, 20)}`;
function validateDirectorUpdate(value, state, personaId, registry2) {
  registry2.get(personaId);
  const parsed = directorUpdateSchema.parse(value);
  const seen = /* @__PURE__ */ new Set();
  const propose = parsed.propose.map((raw) => {
    if (raw.proposedByPersona !== personaId) throw new Error("director proposal must belong to current persona");
    registry2.get(raw.proposedByPersona);
    if (raw.sourceRawRefs.some((ref) => !state.userRaws.some((u) => u.rawRef === ref))) throw new Error("candidate source raw_ref missing");
    const canonicalRefs = [...new Set(raw.sourceRawRefs)].sort((a, b) => (state.userRaws.find((u) => u.rawRef === a)?.ref ?? Number.MAX_SAFE_INTEGER) - (state.userRaws.find((u) => u.rawRef === b)?.ref ?? Number.MAX_SAFE_INTEGER));
    const canonicalProposal = { ...raw, sourceRawRefs: canonicalRefs, proposedByPersona: personaId };
    const item = { ...canonicalProposal, id: raw.id ?? idFor(canonicalProposal) };
    if (seen.has(item.id)) throw new Error("duplicate candidate id");
    seen.add(item.id);
    return item;
  });
  if (parsed.coreCandidateId !== void 0 && (!seen.has(parsed.coreCandidateId) || propose.find((p) => p.id === parsed.coreCandidateId)?.kind !== "core-conflict")) throw new Error("coreCandidateId must reference this batch core-conflict");
  return { propose, ...parsed.coreCandidateId === void 0 ? {} : { coreCandidateId: parsed.coreCandidateId } };
}
function commitDirectorUpdate(input) {
  const update = validateDirectorUpdate(input.update, input.state, input.personaId, input.trunk.registry);
  const itemIds = [];
  const canonicalRefs = (refs) => [...new Set(refs)].sort((a, b) => {
    const ar = input.state.userRaws.find((raw) => raw.rawRef === a)?.ref ?? Number.MAX_SAFE_INTEGER;
    const br = input.state.userRaws.find((raw) => raw.rawRef === b)?.ref ?? Number.MAX_SAFE_INTEGER;
    return ar - br || a.localeCompare(b);
  });
  const items = update.propose.map((proposal) => {
    const normalized = { ...proposal, sourceRawRefs: canonicalRefs(proposal.sourceRawRefs), status: "candidate", visibility: "origin-persona-only", revision: 1 };
    return dilemmaItemSchema.parse({ ...normalized, id: proposal.id ?? idFor({ kind: normalized.kind, text: normalized.text, sourceRawRefs: normalized.sourceRawRefs, proposedByPersona: normalized.proposedByPersona }) });
  });
  const ids = /* @__PURE__ */ new Set();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`duplicate candidate id: ${item.id}`);
    ids.add(item.id);
    const existing = input.state.dilemmaItems.find((x) => x.id === item.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(item)) throw new Error(`dilemma item conflict: ${item.id}`);
  }
  for (const item of items) {
    const eventRefs = canonicalRefs([...input.sourceRawRefs, ...item.sourceRawRefs]);
    input.trunk.preflightDialogueEvent("trunk/dilemma-item-proposed", { messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurpose}:${item.id}`, sourceRawRefs: eventRefs, item, personaId: item.proposedByPersona });
  }
  for (const item of items) {
    const eventRefs = canonicalRefs([...input.sourceRawRefs, ...item.sourceRawRefs]);
    input.trunk.proposeDilemmaItem(item, { messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurpose}:${item.id}`, sourceRawRefs: eventRefs });
    itemIds.push(item.id);
  }
  return { itemIds, ...update.coreCandidateId === void 0 ? {} : { coreCandidateId: update.coreCandidateId } };
}

// src/dialogue/public-view.ts
function canonical2(id, registry2) {
  return registry2.get(id).id;
}
function validateSelectedHistoricalRawRefs(state, refs) {
  const unique = [...new Set(refs)];
  if (unique.some((ref) => !state.userRaws.some((raw) => raw.rawRef === ref))) throw new Error("historical raw ref missing");
  return unique.sort((a, b) => {
    const ar = state.userRaws.find((raw) => raw.rawRef === a)?.ref ?? Number.MAX_SAFE_INTEGER;
    const br = state.userRaws.find((raw) => raw.rawRef === b)?.ref ?? Number.MAX_SAFE_INTEGER;
    return ar - br || a.localeCompare(b);
  });
}
function buildActorContext(state, persona, registry2, currentRawRef, selectedHistoricalRawRefs = [], currentBranchHistory = []) {
  const personaId = canonical2(persona, registry2);
  const definition = registry2.get(personaId);
  if (!currentRawRef) throw new Error("currentRawRef is required");
  const current = state.userRaws.find((r) => r.rawRef === currentRawRef);
  if (!current) throw new Error(`current raw ref missing: ${currentRawRef}`);
  const refs = validateSelectedHistoricalRawRefs(state, selectedHistoricalRawRefs);
  const raws = refs.map((ref) => {
    const raw = state.userRaws.find((r) => r.rawRef === ref);
    if (!raw) throw new Error(`historical raw ref missing: ${ref}`);
    return raw;
  });
  return { personaId, currentRaw: current.text, currentRawRef, selectedHistoricalRawRefs: refs, raw: current.text, historicalRaws: raws.map((r) => r.text), currentBranchHistory, persona: { id: definition.id, displayName: definition.displayName, status: definition.status, prompt: definition.prompt }, confirmedItems: state.dilemmaItems.filter((x) => x.status === "confirmed" && x.visibility === "shared-confirmed" && !x.supersededBy), candidateItems: state.dilemmaItems.filter((x) => x.status === "candidate" && x.visibility === "origin-persona-only" && x.proposedByPersona === personaId && !x.supersededBy).map((x) => ({ ...x, unconfirmed: true })), branchProgress: state.branchProgress[personaId] ?? null };
}

// src/branch/message-source.ts
import { z as z9 } from "zod";
var branchUserMessageSourceSchema = z9.object({
  conversation_id: z9.string().min(1),
  message_id: z9.string().min(1),
  raw_ref: z9.string().min(1),
  persona_id: personaIdSchema
});
var BRANCH_USER_MESSAGE_EXTRA_KEY = "man_roles_branch_delivery";
function branchUserMessageExtra(source) {
  return { [BRANCH_USER_MESSAGE_EXTRA_KEY]: source };
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
  const raw = trunk.state.userRaws.find((item) => item.ref === ref);
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

// src/dialogue/turn-interpreter.ts
import { z as z10 } from "zod";
var turnInterpretationSchema = z10.object({
  responseNeeds: z10.object({ answerKnowledge: z10.boolean(), acknowledgeEmotion: z10.boolean(), clarify: z10.boolean(), proposeCandidate: z10.boolean() }).strict(),
  safetyEscalation: z10.enum(["none", "professional-boundary", "urgent-help", "refuse"]),
  feedback: z10.enum(["none", "confirm", "partial-confirm", "correct", "reject", "skip", "pause", "end", "continue"])
}).strict();

// src/dialogue/coordinator.ts
var meta = (input, refs, suffix) => ({ messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurposePrefix}:${suffix}`, sourceRawRefs: refs });
var fail = (code, error, calls) => ({ status: "failed", error: { code, message: error instanceof Error ? error.message : String(error) }, calls });
async function runDialogueTurn(input, deps) {
  const calls = { director: 0, actor: 0, retrieval: 0 };
  const personaId = deps.registry.get(input.personaId).id;
  let delivered;
  try {
    delivered = await deliverCurrentUserMessage({ ...deps.delivery, trunk: deps.trunk, persona: personaId, messageId: input.messageId, text: input.raw });
  } catch (error) {
    return fail("delivery-failed", error, calls);
  }
  if (delivered.status !== "committed" || !delivered.canStartGeneration) return { ...fail("delivery_not_committed", delivered.error ?? "delivery pending", calls), delivery: delivered };
  const refs = [delivered.rawRef];
  const gate = deterministicSafetyGate(input.raw);
  if (gate.disposition !== "allow") return { status: gate.disposition, safety: gate, calls, reply: gate.message, delivery: delivered };
  let selectedHistoricalRawRefs;
  try {
    selectedHistoricalRawRefs = validateSelectedHistoricalRawRefs(deps.trunk.state, input.selectedHistoricalRawRefs ?? []);
  } catch (error) {
    return { ...fail("historical-raw-invalid", error, calls), delivery: delivered };
  }
  const existingAnswerBeforeControl = await deps.actor.answerExists({ messageId: input.messageId, personaId });
  if (existingAnswerBeforeControl) {
    const loaded = await deps.actor.loadExisting({ messageId: input.messageId, personaId });
    if (loaded === void 0) return { ...fail("existing-answer-missing", "answerExists=true but loadExisting returned undefined", calls) };
    if (loaded.progressSummary !== void 0 && loaded.progressSummary !== null && deps.trunk.state.branchProgress[personaId]?.summary !== loaded.progressSummary) {
      try {
        deps.trunk.updateBranchProgress({ personaId, summary: loaded.progressSummary, lastSemanticSeq: deps.trunk.nextSeq }, meta(input, [delivered.rawRef], "progress"));
      } catch (error) {
        return { ...fail("progress-failed", error, calls), reply: loaded };
      }
    }
    calls.retrieval = 0;
    return { status: "ok", reply: loaded, calls, delivery: delivered };
  }
  const control = await deps.classifier.classify({ raw: input.raw, phase: deps.trunk.state.dialogue?.phase ?? "responding" });
  const classifiedSafety = mergeSafetyDecision(deterministicSafetyGate(input.raw), { disposition: control.safety, reason: control.safetyReason });
  if (classifiedSafety.disposition !== "allow") return { status: classifiedSafety.disposition, control, safety: classifiedSafety, calls, reply: classifiedSafety.message, delivery: delivered };
  let feedback;
  try {
    feedback = feedbackPayloadSchema.parse(input.feedback ?? { kind: control.feedbackKind });
  } catch (error) {
    return { ...fail("feedback-invalid", error, calls), control };
  }
  if (feedback.kind !== control.feedbackKind) return { ...fail("feedback_kind_mismatch", "feedback payload kind differs from classifier", calls), control };
  try {
    deps.trunk.recordTaskRouted({ ...meta(input, refs, "route"), taskMode: control.taskMode, confidence: control.confidence });
  } catch (error) {
    return { ...fail("route-failed", error, calls), control };
  }
  try {
    if (feedback.kind !== "none" && feedback.kind !== "unclear") {
      commitFeedback({ trunk: deps.trunk, state: deps.trunk.state, kind: feedback.kind, personaId, messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurposePrefix}:feedback`, sourceRawRefs: refs, ...feedback.itemId === void 0 ? {} : { itemId: feedback.itemId }, ...feedback.replacement === void 0 ? {} : { replacement: feedback.replacement }, ...feedback.details === void 0 ? {} : { details: feedback.details } });
    }
  } catch (error) {
    return { ...fail("feedback-deferred", error, calls), control };
  }
  const existingCandidate = deps.trunk.state.dilemmaItems.some((item) => item.status === "candidate" && item.proposedByPersona === personaId && !item.supersededBy);
  const policy = decideTurn({ taskMode: control.taskMode, feedbackKind: control.feedbackKind, phase: deps.trunk.state.dialogue?.phase ?? "responding", hasCandidate: existingCandidate, hasConfirmed: deps.trunk.state.dilemmaItems.some((item) => item.status === "confirmed" && !item.supersededBy), noProgressCount: deps.trunk.state.dialogue?.noProgressCount ?? 0, emotionPriority: control.emotionPriority, independentNewDilemma: control.independentNewDilemma });
  const phaseByIntent = policy.intent === "pause" ? "paused" : policy.intent === "close" ? "closed" : policy.intent === "clarify" ? "clarifying" : policy.intent === "await-confirmation" ? "awaiting-confirmation" : policy.intent === "reflect" ? "reflecting" : "responding";
  const nextControl = { taskMode: control.taskMode, phase: phaseByIntent, noProgressCount: deps.trunk.state.dialogue?.noProgressCount ?? 0, lastControlSeq: deps.trunk.state.dialogue?.lastControlSeq ?? -1, ...feedback.kind === "none" ? {} : { selectedAction: feedback.kind } };
  const phaseKey = `${input.messageId}\0${input.taskId}\0${input.eventPurposePrefix}:phase`;
  try {
    if (!deps.trunk.state.dialogueCommits[phaseKey] && (!deps.trunk.state.dialogue || deps.trunk.state.dialogue.phase !== nextControl.phase || deps.trunk.state.dialogue.taskMode !== nextControl.taskMode)) deps.trunk.setDialogueControl(nextControl, meta(input, refs, "phase"));
  } catch (error) {
    return { ...fail("phase-failed", error, calls), control, policy };
  }
  const current = deps.trunk.state.userRaws.find((r) => r.rawRef === delivered.rawRef);
  if (!current) return { ...fail("current_raw_missing", delivered.rawRef, calls), control, policy };
  let candidateItems = deps.trunk.state.dilemmaItems.filter((x) => x.status === "candidate" && x.proposedByPersona === personaId && x.visibility === "origin-persona-only" && !x.supersededBy).map((x) => ({ ...x, unconfirmed: true }));
  let directorError;
  if (policy.shouldRunDirector) {
    calls.director++;
    try {
      const update = await deps.director({ raw: current.text, personaId, currentRawRef: delivered.rawRef });
      commitDirectorUpdate({ update, state: deps.trunk.state, personaId, trunk: deps.trunk, messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurposePrefix}:director`, sourceRawRefs: refs });
      candidateItems = deps.trunk.state.dilemmaItems.filter((x) => x.status === "candidate" && x.proposedByPersona === personaId && x.visibility === "origin-persona-only" && !x.supersededBy).map((x) => ({ ...x, unconfirmed: true }));
    } catch (error) {
      directorError = error instanceof Error ? error.message : String(error);
    }
  }
  const sessionId = deps.trunk.state.branchesIndex[personaId];
  if (!sessionId) return { ...fail("branch-session-missing", personaId, calls), control, policy };
  let branchHistory;
  try {
    branchHistory = await deps.loadCurrentBranchHistory({ personaId, sessionId });
  } catch (error) {
    return { ...fail("branch-history-failed", error, calls), control, policy };
  }
  const context = buildActorContext(deps.trunk.state, personaId, deps.registry, delivered.rawRef, selectedHistoricalRawRefs, branchHistory);
  let reply;
  calls.actor++;
  try {
    reply = await deps.actor.run({ context, policy, candidates: candidateItems });
  } catch (error) {
    return { ...fail("actor-failed", error, calls), control, policy };
  }
  const summary = reply.progressSummary ?? null;
  if (summary !== null && deps.trunk.state.branchProgress[personaId]?.summary !== summary) {
    try {
      deps.trunk.updateBranchProgress({ personaId, summary, lastSemanticSeq: deps.trunk.nextSeq }, meta(input, refs, "progress"));
    } catch (error) {
      return { ...fail("progress-failed", error, calls), control, policy, reply };
    }
  }
  calls.retrieval = reply.retrievalCalls ?? 0;
  return { status: "ok", control, policy, reply, candidate: candidateItems, ...directorError ? { directorError } : {}, calls, delivery: delivered };
}

// src/validation/phase7-task9-report.ts
import { createHash as createHash2 } from "node:crypto";
import { z as z11 } from "zod";

// src/validation/phase7-task9-budget.ts
var PHASE7_TASK9_SCENARIO_BUDGETS = [
  { name: "knowledge", allocated: 7e3, minimumStart: 2500, repairReserve: 1800 },
  { name: "dilemma", allocated: 5e3, minimumStart: 1800, repairReserve: 1800 },
  { name: "review", allocated: 4500, minimumStart: 2500, repairReserve: 1800 },
  { name: "high-risk", allocated: 0, minimumStart: 0, repairReserve: 0 },
  { name: "cross-person", allocated: 3500, minimumStart: 2200, repairReserve: 1500 }
];

// src/validation/phase7-task9-report.ts
var PHASE7_TASK9_SCENARIOS = ["knowledge", "dilemma", "review", "high-risk", "cross-person"];
var usageSchema = z11.object({ input: z11.number().int().nonnegative(), output: z11.number().int().nonnegative(), cache: z11.number().int().nonnegative(), reasoning: z11.number().int().nonnegative(), total: z11.number().int().nonnegative() }).strict();
var callSchema = z11.object({ role: z11.enum(["control", "director", "actor", "retrieval"]), requestId: z11.string().min(1), provider: z11.string().min(1), model: z11.string().min(1), usage: usageSchema, latencyMs: z11.number().nonnegative(), retries: z11.number().int().nonnegative(), systemHash: z11.string().regex(/^[a-f0-9]{64}$/), messageHashes: z11.array(z11.string().regex(/^[a-f0-9]{64}$/)), tools: z11.array(z11.string()) }).strict();
var leakSchema = z11.object({ context: z11.boolean(), request: z11.boolean(), wake: z11.boolean() }).strict();
var blockerSchema = z11.object({ remainingScenario: z11.number().int().nonnegative(), estimated: z11.number().int().nonnegative(), laterReserve: z11.number().int().nonnegative(), repairReserve: z11.number().int().nonnegative(), reason: z11.string().min(1) }).strict();
var scenarioBudgetSchema = z11.object({ allocated: z11.number().int().nonnegative(), minimumStart: z11.number().int().nonnegative(), repairReserve: z11.number().int().nonnegative(), observed: z11.number().int().nonnegative(), blocked: z11.boolean(), blocker: blockerSchema.nullable() }).strict();
var diagnosticSchema = z11.object({ attempt: z11.number().int().positive(), accepted: z11.boolean(), errorCode: z11.string().min(1), repairable: z11.boolean(), fallback: z11.boolean(), concluded: z11.boolean(), violations: z11.array(z11.object({ code: z11.string().min(1), segmentIndex: z11.number().int().nonnegative().optional() }).strict()) }).strict();
var outputObservationSchema = z11.object({ projectedReplyCount: z11.number().int().nonnegative(), rawAssistantTextOnlyCount: z11.number().int().nonnegative(), toolCallPreambleCount: z11.number().int().nonnegative() }).strict();
var scenarioSchema = z11.object({ name: z11.enum(PHASE7_TASK9_SCENARIOS), personaId: z11.string().min(1), scenarioBudget: scenarioBudgetSchema, turnPolicy: z11.object({ intent: z11.string().min(1), maxQuestions: z11.number().int().min(0).max(2), allowedControls: z11.array(z11.string()) }).strict().nullable(), outputObservation: outputObservationSchema, submitDiagnostics: z11.array(diagnosticSchema), promptHash: z11.string().regex(/^[a-f0-9]{64}$/), calls: z11.array(callSchema), controlCalls: z11.number().int().nonnegative(), directorCalls: z11.number().int().nonnegative(), actorCalls: z11.number().int().nonnegative(), retrievalCalls: z11.number().int().nonnegative(), usage: usageSchema, retries: z11.number().int().nonnegative(), candidateStatuses: z11.array(z11.enum(["candidate", "confirmed", "rejected", "superseded"])), questions: z11.array(z11.string()).max(2), safety: z11.object({ disposition: z11.enum(["allow", "professional-boundary", "urgent-help", "refuse"]), downstreamCalls: z11.number().int().nonnegative(), messageHash: z11.string().regex(/^[a-f0-9]{64}$/) }).strict(), submitEvidence: z11.object({ attempted: z11.number().int().nonnegative(), accepted: z11.number().int().nonnegative(), rejected: z11.number().int().nonnegative(), repairCount: z11.number().int().nonnegative() }).strict(), eventOrder: z11.array(z11.string()), isolation: z11.object({ actorContextContainsForeignReply: z11.boolean(), actorContextContainsForeignProgress: z11.boolean(), actorContextContainsForeignCandidate: z11.boolean(), candidateBeforeActor: z11.boolean() }).strict(), foreignLeaks: z11.object({ reply: leakSchema, progress: leakSchema, candidate: leakSchema }).strict(), rawRefCount: z11.literal(1), rawTextCount: z11.literal(1), trunkRawCount: z11.literal(1), wakeCount: z11.number().int().nonnegative(), wakeSource: z11.object({ kind: z11.literal("plugin"), plugin: z11.literal("man-roles-roleplayer") }).strict().nullable(), wakeContainsIdentity: z11.boolean(), wakeContainsForeign: z11.boolean(), foreignFixtureEstablished: z11.boolean(), foreignPersona: z11.string().nullable(), foreignMarkerHashes: z11.array(z11.string().regex(/^[a-f0-9]{64}$/)), resultStatus: z11.string().min(1) }).strict();
var phase7Task9ReportSchema = z11.object({ schemaVersion: z11.literal(2), runMode: z11.enum(["scripted", "real"]), runId: z11.string().min(1), profile: z11.string().min(1), attemptMarkerPath: z11.string().min(1), attemptMarkerSha256: z11.string().regex(/^[a-f0-9]{64}$/), provider: z11.string().min(1), model: z11.string().min(1), expectedScenarios: z11.array(z11.enum(PHASE7_TASK9_SCENARIOS)), scenarios: z11.array(scenarioSchema), requests: z11.array(callSchema), fullTotal: z11.number().int().nonnegative(), tokenLimit: z11.literal(2e4), providerNetworkUsed: z11.boolean(), passed: z11.boolean() }).strict();
var legacyScenarioBudgetSchema = z11.object({ allocated: z11.number().int().nonnegative(), minimumStart: z11.number().int().nonnegative(), observed: z11.number().int().nonnegative(), blocked: z11.boolean() }).strict();
var legacyScenarioShape = { name: z11.enum(PHASE7_TASK9_SCENARIOS), personaId: z11.string().min(1), promptHash: z11.string().regex(/^[a-f0-9]{64}$/), calls: z11.array(callSchema), controlCalls: z11.number().int().nonnegative(), directorCalls: z11.number().int().nonnegative(), actorCalls: z11.number().int().nonnegative(), retrievalCalls: z11.number().int().nonnegative(), usage: usageSchema, retries: z11.number().int().nonnegative(), candidateStatuses: z11.array(z11.enum(["candidate", "confirmed", "rejected", "superseded"])), questions: z11.array(z11.string()).max(2), directAssistantProductOutputs: z11.number().int().nonnegative(), safety: z11.object({ disposition: z11.enum(["allow", "professional-boundary", "urgent-help", "refuse"]), downstreamCalls: z11.number().int().nonnegative(), messageHash: z11.string().regex(/^[a-f0-9]{64}$/) }).strict(), submitEvidence: z11.object({ attempted: z11.number().int().nonnegative(), accepted: z11.number().int().nonnegative(), rejected: z11.number().int().nonnegative(), repairCount: z11.number().int().nonnegative() }).strict(), eventOrder: z11.array(z11.string()), isolation: z11.object({ actorContextContainsForeignReply: z11.boolean(), actorContextContainsForeignProgress: z11.boolean(), actorContextContainsForeignCandidate: z11.boolean(), candidateBeforeActor: z11.boolean() }).strict(), foreignLeaks: z11.object({ reply: leakSchema, progress: leakSchema, candidate: leakSchema }).strict(), rawRefCount: z11.literal(1), rawTextCount: z11.literal(1), trunkRawCount: z11.literal(1), wakeCount: z11.number().int().nonnegative(), wakeSource: z11.object({ kind: z11.literal("plugin"), plugin: z11.literal("man-roles-roleplayer") }).strict().optional(), wakeContainsIdentity: z11.boolean(), wakeContainsForeign: z11.boolean(), foreignFixtureEstablished: z11.boolean(), foreignPersona: z11.string().optional(), foreignMarkerHashes: z11.array(z11.string().regex(/^[a-f0-9]{64}$/)), resultStatus: z11.string().min(1) };
var legacyScenarioSchema = z11.union([z11.object({ ...legacyScenarioShape, scenarioBudget: legacyScenarioBudgetSchema }).strict(), z11.object(legacyScenarioShape).strict()]);
var phase7Task9HistoricalReportSchema = z11.object({ schemaVersion: z11.literal(1), runMode: z11.enum(["scripted", "real"]), runId: z11.string().min(1), profile: z11.string().min(1), attemptMarkerPath: z11.string().min(1), attemptMarkerSha256: z11.string().regex(/^[a-f0-9]{64}$/), provider: z11.string().min(1), model: z11.string().min(1), expectedScenarios: z11.array(z11.enum(PHASE7_TASK9_SCENARIOS)), scenarios: z11.array(legacyScenarioSchema), requests: z11.array(callSchema), fullTotal: z11.number().int().nonnegative(), tokenLimit: z11.literal(2e4), providerNetworkUsed: z11.boolean(), passed: z11.boolean() }).strict();
function snapshotTurnPolicy(policy) {
  return { intent: policy.intent, maxQuestions: policy.maxQuestions, allowedControls: [...policy.allowedControls] };
}
function resultText(event) {
  const blocks = event?.data?.message?.content ?? [];
  return blocks.flatMap((block) => block?.type === "text" ? [String(block.text ?? "")] : block?.type === "tool-result" && Array.isArray(block.content) ? block.content.filter((item) => item?.type === "text").map((item) => String(item.text ?? "")) : []).join("");
}
function deriveSubmitDiagnostics(events) {
  const submitIds = new Set(events.filter((e) => e?.type === "tool/call" && e.data?.name === "submit_actor_reply").map((e) => e.data?.callId ?? e.data?.id ?? e.data?.message?.source?.callId).filter(Boolean));
  return events.filter((e) => e?.type === "tool/result" && submitIds.has(e.data?.message?.source?.callId ?? e.data?.callId)).map((e, index) => {
    let value = {};
    try {
      value = JSON.parse(resultText(e) || "{}");
    } catch {
    }
    value = value?.diagnostics ?? value;
    const accepted = value.accepted === true || value.ok === true && value.concluded === true;
    return { attempt: index + 1, accepted, errorCode: String(value.errorCode ?? (accepted ? "ok" : value.fallback === true ? "fixed-fallback" : value.violations?.[0]?.code ?? "invalid-submit")), repairable: value.repairable === true, fallback: value.fallback === true, concluded: value.concluded === true, violations: Array.isArray(value.violations) ? value.violations.map((v) => ({ code: String(v.code ?? "invalid-submit"), ...Number.isInteger(v.segmentIndex) ? { segmentIndex: v.segmentIndex } : {} })) : [] };
  });
}
function deriveOutputObservation(events, projectedReplyCount) {
  const assistants = events.filter((e) => e?.type === "assistant/message");
  const rawAssistantTextOnlyCount = assistants.filter((e) => {
    const blocks = e.data?.message?.content ?? e.data?.content ?? [];
    return blocks.some((b) => b.type === "text" && String(b.text ?? "").trim()) && !blocks.some((b) => b.type === "tool-call");
  }).length;
  const toolCallPreambleCount = assistants.filter((e) => {
    const blocks = e.data?.message?.content ?? e.data?.content ?? [];
    return blocks.some((b) => b.type === "tool-call") && blocks.some((b) => b.type === "text" && String(b.text ?? "").trim());
  }).length;
  return { projectedReplyCount, rawAssistantTextOnlyCount, toolCallPreambleCount };
}
function sha256(value) {
  return createHash2("sha256").update(value).digest("hex");
}

// src/e2e/phase7-task9-scripted.ts
import { writeFileSync, mkdirSync as mkdirSync2 } from "node:fs";

// src/e2e/batch-budget.ts
var NATIVE_BATCH_TOKEN_LIMIT = 2e4;
var ScenarioAllocator = class {
  limit;
  plans;
  used = 0;
  observedByScenario = /* @__PURE__ */ new Map();
  blockedScenarios = /* @__PURE__ */ new Set();
  blockers = /* @__PURE__ */ new Map();
  consumedRepairReserve = /* @__PURE__ */ new Set();
  constructor(plansOrNames, limit = NATIVE_BATCH_TOKEN_LIMIT, perScenario = 3200, minimumStart = 1800) {
    this.limit = limit;
    const plans = plansOrNames.map((item) => typeof item === "string" ? { name: item, allocated: perScenario, minimumStart } : item);
    if (new Set(plans.map((x) => x.name)).size !== plans.length || plans.some((x) => x.allocated < 0 || x.minimumStart < 0 || x.minimumStart > x.allocated || (x.repairReserve ?? 0) < 0 || (x.repairReserve ?? 0) > x.allocated)) throw new Error("invalid scenario allocation plan");
    const total = plans.reduce((sum, x) => sum + x.allocated, 0);
    if (total > limit) throw new Error("scenario allocation exceeds global token limit");
    this.plans = plans;
  }
  plan(name) {
    const plan = this.plans.find((x) => x.name === name);
    if (!plan) throw new Error(`unknown scenario: ${name}`);
    return plan;
  }
  canStart(name, estimated, useRepairReserve = false) {
    return this.admission(name, estimated, useRepairReserve).allowed;
  }
  admission(name, estimated, useRepairReserve = false) {
    const plan = this.plan(name);
    const repairReserve = plan.repairReserve ?? 0;
    const remainingScenario = plan.allocated - (this.observedByScenario.get(name) ?? 0);
    const laterReserve = this.plans.slice(this.plans.indexOf(plan) + 1).reduce((sum, x) => sum + x.minimumStart, 0);
    const reserveNeeded = this.consumedRepairReserve.has(name) || useRepairReserve ? 0 : repairReserve;
    const allowed = estimated <= remainingScenario - reserveNeeded && this.used + estimated + laterReserve + reserveNeeded <= this.limit;
    return { allowed, remainingScenario, estimated, laterReserve, repairReserve: reserveNeeded, ...allowed ? {} : { reason: estimated > remainingScenario - reserveNeeded ? "remainingScenario" : "laterReserve-or-global" } };
  }
  consumeRepairReserve(name) {
    this.plan(name);
    this.consumedRepairReserve.add(name);
  }
  markBlocked(name, details) {
    this.plan(name);
    this.blockedScenarios.add(name);
    if (details) this.blockers.set(name, details);
  }
  blockerFor(name) {
    this.plan(name);
    return this.blockers.get(name) ?? null;
  }
  observedFor(name) {
    this.plan(name);
    return this.observedByScenario.get(name) ?? 0;
  }
  isBlocked(name) {
    this.plan(name);
    return this.blockedScenarios.has(name);
  }
  observe(name, amount) {
    const plan = this.plan(name);
    const next = (this.observedByScenario.get(name) ?? 0) + amount;
    if (next > plan.allocated || this.used + amount > this.limit) {
      this.markBlocked(name, this.admission(name, amount));
      throw new Error(`scenario budget exceeded: ${name}`);
    }
    ;
    this.observedByScenario.set(name, next);
    this.used += amount;
  }
  get observed() {
    return this.used;
  }
};

// src/e2e/phase7-task9-scripted.ts
var registry = createRuntimeRegistry();
var provider = "scripted-local";
var model = "scripted-no-network";
function stream(argsValue, callIndex) {
  const args = JSON.stringify(argsValue);
  const id = CallId(`task9-submit-${callIndex}`);
  return (async function* () {
    yield { type: "block-start", index: 0, blockType: "tool-call" };
    yield { type: "tool-call-delta", index: 0, id, name: "submit_actor_reply", argumentsDelta: args };
    yield { type: "block-end", index: 0, block: { type: "tool-call", id, name: "submit_actor_reply", arguments: args } };
    yield { type: "usage", usage: { inputTokens: 0, outputTokens: 0 } };
    yield { type: "finish", reason: { kind: "tool-calls" } };
  })();
}
function textOf(message) {
  return message.content?.filter((x) => x.type === "text").map((x) => x.text).join("") ?? "";
}
function usageZero() {
  return { input: 0, output: 0, cache: 0, reasoning: 0, total: 0 };
}
async function runPhase7Task9Scripted(ctx, outputDir) {
  const active = registry.listActive()[0]?.id;
  if (!active) throw new Error("scripted Task9 requires an active persona");
  const libs = buildContentLibraries();
  const turnState = new ActorTurnStateRegistry();
  const allocator = new ScenarioAllocator(PHASE7_TASK9_SCENARIO_BUDGETS);
  const requests = [];
  const streamCalls = /* @__PURE__ */ new Map();
  const agents = /* @__PURE__ */ new Map();
  const offStream = ctx.on("llm/stream", (request, next) => {
    const messages = request.messages;
    const owned = String(request.provider) === provider && String(request.model) === model && agents.has(String(request.sessionId));
    if (!owned) return next();
    const sessionKey = String(request.sessionId);
    const callIndex = (streamCalls.get(sessionKey) ?? 0) + 1;
    streamCalls.set(sessionKey, callIndex);
    requests.push({ sessionId: sessionKey, callIndex, system: request.system ?? "", messages: messages.map((message) => ({ role: message.role, source: message.source, text: textOf(message) })), tools: (request.tools ?? []).map((tool) => tool.name) });
    const reviewRepair = sessionKey.endsWith("-review");
    const args = reviewRepair && callIndex === 1 ? { segments: [{ kind: "thought_attribution", text: "REDACTED_REVIEW_ATTRIBUTION" }], questions: ["\u5141\u8BB8\u7684\u4E00\u95EE"], offeredControls: ["continue", "correct", "end"] } : reviewRepair ? { segments: [{ kind: "dialogue", text: "\u811A\u672C\u590D\u76D8\u56DE\u7B54\u3002" }], questions: ["\u5141\u8BB8\u7684\u4E00\u95EE"], offeredControls: ["continue", "correct", "end"] } : { segments: [{ kind: "dialogue", text: "\u811A\u672C\u95E8\u63A7\u56DE\u7B54\u3002" }] };
    return stream(args, callIndex);
  });
  const scenarios = [];
  try {
    for (const name of PHASE7_TASK9_SCENARIOS) {
      const scenarioDir = join3(outputDir, name);
      mkdirSync2(scenarioDir, { recursive: true });
      const conversationId = `phase7-task9-${name}`;
      const sessionId = SessionId(`phase7-task9-${name}`);
      const aggregate = ConversationAggregate.create(conversationId, scenarioDir, active, registry);
      aggregate.indexBranch(active, String(sessionId));
      const highRiskInput = "\u6211\u60F3\u81EA\u6740";
      const highRisk = name === "high-risk";
      let handle;
      const session = highRisk ? ctx.sessions.create(sessionId) : void 0;
      if (!highRisk) {
        const exposedToolNames = name === "knowledge" ? ["retrieve_quotes", "fetch_quote", "submit_actor_reply"] : ["submit_actor_reply"];
        handle = await ctx.agents.create({ sessionId, agentOptions: { provider, model }, setup: setupActorAgent(active, libs, turnState, void 0, { exposedToolNames }) });
        agents.set(String(sessionId), handle);
      }
      const raw = highRisk ? highRiskInput : `\u811A\u672C ${name} \u573A\u666F\uFF1A\u6211\u9700\u8981\u5148\u7406\u89E3\u81EA\u5DF1\u7684\u5904\u5883\u3002`;
      const taskId = `task-${name}`;
      const messageId = `message-${name}`;
      const observed = [];
      const promptHash = sha256(raw);
      const foreignPersona = name === "cross-person" ? registry.listActive().find((item) => item.id !== active)?.id : void 0;
      const foreignMarkers = { reply: `FOREIGN_REPLY:${foreignPersona ?? "none"}`, progress: `FOREIGN_PROGRESS:${foreignPersona ?? "none"}`, candidate: `FOREIGN_CANDIDATE:${foreignPersona ?? "none"}` };
      let foreignFixtureEstablished = false;
      let foreignSession;
      let actorContextText = "";
      let wakeText = "";
      let candidateBeforeActor = false;
      let actualPolicy = null;
      let actorQuestions = [];
      const observedCall = (role, label) => ({ role, requestId: `${sessionId}:${label}`, provider, model, usage: usageZero(), latencyMs: 0, retries: 0, systemHash: sha256(`${role}:scripted`), messageHashes: [promptHash], tools: [] });
      const classifier = createControlClassifier(async () => {
        observed.push(observedCall("control", "control"));
        if (name === "cross-person" && foreignPersona && !foreignFixtureEstablished) {
          const foreignSessionId = SessionId(`phase7-task9-foreign-${name}`);
          foreignSession = ctx.sessions.create(foreignSessionId);
          aggregate.indexBranch(foreignPersona, String(foreignSessionId));
          foreignSession.append("turn/start", { turn: 1 });
          foreignSession.append("step/start", { turn: 1, step: 1 });
          foreignSession.append("assistant/message", { turn: 1, step: 1, message: createAssistantMessage({ content: [{ type: "text", text: foreignMarkers.reply }], source: { provider, model } }) }, { surfaceOp: "append" });
          foreignSession.append("step/end", { turn: 1, step: 1 });
          foreignSession.append("turn/end", { turn: 1, reason: { kind: "completed" } });
          await ctx.sessions.flush(foreignSession);
          const rawRef = aggregate.trunk.state.userRaws.at(-1)?.rawRef;
          if (!rawRef) throw new Error("foreign fixture requires target rawRef");
          aggregate.trunk.updateBranchProgress({ personaId: foreignPersona, summary: foreignMarkers.progress, lastSemanticSeq: aggregate.trunk.nextSeq }, { messageId, taskId, eventPurpose: `phase7-task9:${name}:foreign-progress`, sourceRawRefs: [rawRef] });
          aggregate.trunk.proposeDilemmaItem({ id: `foreign-candidate-${name}`, kind: "inference", text: foreignMarkers.candidate, status: "candidate", sourceRawRefs: [rawRef], proposedByPersona: foreignPersona, visibility: "origin-persona-only", revision: 1 }, { messageId, taskId, eventPurpose: `phase7-task9:${name}:foreign-candidate`, sourceRawRefs: [rawRef] });
          foreignFixtureEstablished = true;
        }
        return { taskMode: name === "review" ? "review" : name === "dilemma" ? "dilemma" : "knowledge", feedbackKind: "none", confidence: "high", emotionPriority: false, independentNewDilemma: false, safety: "allow", safetyReason: "none" };
      });
      const result = await runDialogueTurn({ raw, taskId, personaId: active, messageId, eventPurposePrefix: `phase7-task9:${name}` }, {
        registry,
        trunk: aggregate.trunk,
        delivery: { session: session ?? handle?.agent.session, sessionId: String(sessionId), flush: (session2) => ctx.sessions.flush(session2) },
        classifier,
        director: async ({ currentRawRef, personaId }) => {
          const call = observedCall("director", "director");
          call.messageHashes = [sha256(raw), sha256(currentRawRef)];
          observed.push(call);
          return { propose: [{ kind: "inference", text: "\u811A\u672C\u5019\u9009\uFF1A\u9700\u8981\u8FDB\u4E00\u6B65\u6F84\u6E05\u5904\u5883\u3002", sourceRawRefs: [currentRawRef], proposedByPersona: personaId }] };
        },
        actor: {
          answerExists: () => false,
          loadExisting: () => {
            throw new Error("not called");
          },
          run: async ({ policy, candidates, context }) => {
            actualPolicy = snapshotTurnPolicy(policy);
            candidateBeforeActor = name !== "cross-person" || Boolean(foreignFixtureEstablished && foreignPersona && aggregate.trunk.state.branchProgress[foreignPersona]?.summary === foreignMarkers.progress) && aggregate.trunk.state.dilemmaItems.some((item) => item.text === foreignMarkers.candidate) && Boolean(foreignSession?.events.some((event) => event.type === "assistant/message" && JSON.stringify(event.data).includes(foreignMarkers.reply)));
            if (name === "cross-person" && !candidateBeforeActor) throw new Error("foreign fixture was not established before actor");
            actorContextText = JSON.stringify(context);
            const wake2 = `\u6267\u884C\u5F53\u524D\u4EBA\u7269 ${active} \u7684 ${policy.intent}\uFF1B\u5019\u9009\u4EC5\u4F9B\u5F53\u524D\u4EBA\u7269\u53C2\u8003\uFF1A${candidates.length}\uFF1B\u8BF7\u53EA\u8C03\u7528 submit_actor_reply\u3002`;
            wakeText = wake2;
            if (wake2.includes("raw_ref") || wake2.includes("message_id")) throw new Error("wake contains forbidden identity");
            if (!handle) throw new Error("actor handle missing for allowed scenario");
            turnState.setNextTurnPolicy(handle.agent.session, { retrievalPolicy: policy.intent === "answer" && name === "knowledge" ? "allow" : "deny", maxQuestions: policy.maxQuestions, allowedControls: policy.allowedControls });
            handle.agent.followup(createUserMessage2({ content: [{ type: "text", text: wake2 }], source: { kind: "plugin", plugin: "man-roles-roleplayer" } }));
            await handle.agent.whenIdle();
            const projected = projectActorReply(handle.agent.session.events, 1);
            if (!projected) throw new Error("missing submit_actor_reply projection");
            actorQuestions = projected.questions ?? [];
            return { ...projected, retrievalCalls: 0 };
          }
        },
        loadCurrentBranchHistory: ({ personaId, sessionId: requested }) => {
          if (personaId !== active || requested !== String(sessionId)) throw new Error("history loader crossed persona boundary");
          const source = (handle?.agent.session.events ?? []).filter((event) => event.type === "user/message" || event.type === "assistant/message");
          return source.map((event) => JSON.stringify(event.data?.message ?? event.data));
        }
      });
      const events = handle?.agent.session.events ?? session?.events ?? [];
      const deliveredRawRef = "delivery" in result ? result.delivery?.rawRef : void 0;
      const rawMessages = events.filter((event) => event.type === "user/message" && event.data?.extra?.man_roles_branch_delivery?.raw_ref === deliveredRawRef);
      const scenarioRequests = requests.filter((item) => item.sessionId === String(sessionId));
      const requestText = JSON.stringify(scenarioRequests.map((request) => ({ system: request.system, messages: request.messages })));
      const rawTextCount = rawMessages.filter((event) => textOf(event.data?.message ?? event.data).includes(raw)).length;
      const wakeEvents = events.filter((event) => {
        const source = event.data?.source;
        return event.type === "user/message" && source?.kind === "plugin" && source?.plugin === "man-roles-roleplayer" && !source.raw_ref && !source.message_id;
      });
      const wake = wakeEvents[0];
      const calls = result.calls ?? { director: 0, actor: 0, retrieval: 0 };
      const actorCalls = scenarioRequests.map((request) => ({ role: "actor", requestId: `${request.sessionId}:actor:${request.callIndex}`, provider, model, usage: usageZero(), latencyMs: 0, retries: 0, systemHash: sha256(request.system), messageHashes: request.messages.map((message) => sha256(JSON.stringify(message))), tools: request.tools }));
      const callsForReport = highRisk ? [] : [...observed, ...actorCalls];
      const wakeSource = wake ? { kind: wake.data.source.kind, plugin: wake.data.source.plugin } : void 0;
      const safetyDisposition = ["allow", "professional-boundary", "urgent-help", "refuse"].includes(result.status) ? result.status : "allow";
      const submitAttempted = events.filter((event) => event.type === "tool/call" && event.data?.name === "submit_actor_reply").length;
      const submitCalls = events.filter((event) => event.type === "tool/call" && event.data?.name === "submit_actor_reply");
      const submitCallIds = new Set(submitCalls.map((event) => event.data?.callId ?? event.data?.id ?? event.data?.message?.source?.callId).filter(Boolean));
      const submitResults = events.filter((event) => event.type === "tool/result" && event.data?.message && submitCallIds.has(event.data?.message?.source?.callId ?? event.data?.callId));
      const submitAccepted = submitResults.filter((event) => {
        const meta2 = event.data?.meta;
        if (meta2?.kind === "actor-reply") return true;
        const text = event.data?.message?.content?.filter((block) => block.type === "text").map((block) => block.text).join("") ?? "";
        try {
          const payload = JSON.parse(text);
          return payload?.ok === true && payload?.concluded === true;
        } catch {
          return false;
        }
      }).length;
      const directOutput = events.filter((event) => event.type === "assistant/message" && event.data?.message?.content?.some((block) => block.type === "text" && block.text.trim())).length;
      const leak = { reply: { context: actorContextText.includes(foreignMarkers.reply), request: requestText.includes(foreignMarkers.reply), wake: wakeText.includes(foreignMarkers.reply) }, progress: { context: actorContextText.includes(foreignMarkers.progress), request: requestText.includes(foreignMarkers.progress), wake: wakeText.includes(foreignMarkers.progress) }, candidate: { context: actorContextText.includes(foreignMarkers.candidate), request: requestText.includes(foreignMarkers.candidate), wake: wakeText.includes(foreignMarkers.candidate) } };
      const submitDiagnostics = deriveSubmitDiagnostics(events);
      scenarios.push({ name, personaId: active, promptHash, calls: callsForReport, controlCalls: callsForReport.filter((call) => call.role === "control").length, directorCalls: callsForReport.filter((call) => call.role === "director").length, actorCalls: callsForReport.filter((call) => call.role === "actor").length, retrievalCalls: 0, usage: usageZero(), retries: 0, candidateStatuses: aggregate.trunk.state.dilemmaItems.map((item) => item.status), questions: actorQuestions, turnPolicy: highRisk ? null : actualPolicy, outputObservation: deriveOutputObservation(events, highRisk ? 0 : submitAccepted), submitDiagnostics, safety: { disposition: safetyDisposition, downstreamCalls: highRisk ? 0 : calls.actor + calls.director + calls.retrieval, messageHash: promptHash }, submitEvidence: { attempted: submitAttempted, accepted: submitAccepted, rejected: Math.max(0, submitAttempted - submitAccepted), repairCount: Math.max(0, submitDiagnostics.length - 1) }, eventOrder: events.map((event) => event.type), isolation: { actorContextContainsForeignReply: leak.reply.context, actorContextContainsForeignProgress: leak.progress.context, actorContextContainsForeignCandidate: leak.candidate.context, candidateBeforeActor }, foreignLeaks: leak, rawRefCount: rawMessages.length, rawTextCount, wakeSource: highRisk ? null : wakeSource, wakeCount: wakeEvents.length, resultStatus: result.status, trunkRawCount: aggregate.trunk.state.userRaws.length, wakeContainsIdentity: /raw_ref|message_id/.test(wakeText), wakeContainsForeign: Object.values(foreignMarkers).some((marker) => wakeText.includes(marker)), foreignFixtureEstablished, foreignPersona: foreignPersona ?? null, foreignMarkerHashes: name === "cross-person" ? Object.values(foreignMarkers).map((marker) => sha256(marker)) : [] });
      if (handle) {
        await handle.dispose();
        agents.delete(String(sessionId));
      }
    }
  } catch (error) {
    mkdirSync2(outputDir, { recursive: true });
    writeFileSync(join3(outputDir, "failure-diagnostic.json"), JSON.stringify({ runId: "phase7-task9-scripted", error: error instanceof Error ? error.message : String(error), requests }, null, 2), "utf8");
    throw error;
  } finally {
    offStream();
    for (const handle of agents.values()) await handle.dispose();
  }
  for (const scenario of scenarios) {
    const plan = allocator.plan(scenario.name);
    scenario.scenarioBudget = { allocated: plan.allocated, minimumStart: plan.minimumStart, repairReserve: plan.repairReserve ?? 0, observed: scenario.usage.total, blocked: false, blocker: null };
  }
  const report = { schemaVersion: 2, runMode: "scripted", runId: "phase7-task9-scripted", profile: "scripted-local", attemptMarkerPath: "absent", attemptMarkerSha256: sha256("absent"), provider, model, expectedScenarios: [...PHASE7_TASK9_SCENARIOS], scenarios, requests: scenarios.flatMap((scenario) => scenario.calls), fullTotal: 0, tokenLimit: 2e4, providerNetworkUsed: false, passed: true };
  mkdirSync2(outputDir, { recursive: true });
  writeFileSync(join3(outputDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  const exit = ctx.get("appExit");
  if (typeof exit === "function") exit(0);
  return report;
}
export {
  runPhase7Task9Scripted
};
//# sourceMappingURL=phase7-task9-scripted.js.map
