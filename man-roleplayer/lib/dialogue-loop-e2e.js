var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/domain/schema.ts
import { z as z4 } from "zod";
var taskModeSchema2, personaIdSchema, dilemmaItemSchema, dialogueControlStateSchema, branchProgressSchema, dialogueEventMetaSchema, taskRoutedEventSchema, dialoguePhaseSetEventSchema, dilemmaItemProposedEventSchema, dilemmaItemReviewedEventSchema, dilemmaCoreSelectedEventSchema, branchProgressUpdatedEventSchema, actionRecordedEventSchema, sessionControlRecordedEventSchema, dialogueCommitSchema, legacyPersonaIdRawSchema, dilemmaPhaseSchema, dilemmaStateSchema, initialDilemmaState, dilemmaEventHeaderSchema, dilemmaCandidateEventSchema, dilemmaConfirmedEventSchema, dilemmaCorrectedEventSchema, trunkEventRecordSchema, trunkCreatedEventSchema, trunkUserRawAddedEventSchema, trunkDilemmaCandidateEventSchema, trunkDilemmaConfirmedEventSchema, trunkDilemmaCorrectedEventSchema, trunkActivePersonaEventSchema, trunkBranchIndexEventSchema, trunkUserRawSchema, taskOutcomeSchema, trunkTaskOutcomeRecordedEventSchema, trunkBranchDeliveryCommittedEventSchema, trunkStateSchema, initialTrunkState;
var init_schema = __esm({
  "src/domain/schema.ts"() {
    "use strict";
    taskModeSchema2 = z4.enum(["knowledge", "dilemma", "review"]);
    personaIdSchema = z4.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "PersonaId must be kebab-case");
    dilemmaItemSchema = z4.object({ id: z4.string().min(1), kind: z4.enum(["fact", "inference", "goal", "value-conflict", "core-conflict"]), text: z4.string(), status: z4.enum(["candidate", "confirmed", "rejected", "superseded"]), sourceRawRefs: z4.array(z4.string().min(1)).min(1), proposedByPersona: personaIdSchema, visibility: z4.enum(["origin-persona-only", "shared-confirmed"]), revision: z4.number().int().positive(), supersedes: z4.string().min(1).optional(), supersededBy: z4.string().min(1).optional() }).strict();
    dialogueControlStateSchema = z4.object({ taskMode: z4.enum(["knowledge", "dilemma", "review"]), phase: z4.enum(["responding", "clarifying", "awaiting-confirmation", "reflecting", "action-defined", "paused", "closed"]), noProgressCount: z4.number().int().nonnegative(), lastControlSeq: z4.number().int(), selectedAction: z4.string().optional() }).strict();
    branchProgressSchema = z4.object({ personaId: personaIdSchema, summary: z4.string().nullable(), lastSemanticSeq: z4.number().int() }).strict();
    dialogueEventMetaSchema = z4.object({
      messageId: z4.string().min(1),
      taskId: z4.string().min(1),
      eventPurpose: z4.string().min(1),
      sourceRawRefs: z4.array(z4.string().min(1)).min(1)
    }).strict();
    taskRoutedEventSchema = dialogueEventMetaSchema.extend({ taskMode: taskModeSchema2, confidence: z4.enum(["high", "low"]) }).strict();
    dialoguePhaseSetEventSchema = dialogueEventMetaSchema.extend({ control: dialogueControlStateSchema }).strict();
    dilemmaItemProposedEventSchema = dialogueEventMetaSchema.extend({ item: dilemmaItemSchema, personaId: personaIdSchema }).strict();
    dilemmaItemReviewedEventSchema = dialogueEventMetaSchema.extend({ itemId: z4.string().min(1), action: z4.enum(["confirm", "partial-confirm", "correct", "reject", "skip"]), replacement: dilemmaItemSchema.optional(), personaId: personaIdSchema }).strict();
    dilemmaCoreSelectedEventSchema = dialogueEventMetaSchema.extend({ itemId: z4.string().min(1) }).strict();
    branchProgressUpdatedEventSchema = dialogueEventMetaSchema.extend({ progress: branchProgressSchema }).strict();
    actionRecordedEventSchema = dialogueEventMetaSchema.extend({ action: z4.string().min(1), details: z4.record(z4.string(), z4.unknown()).default({}) }).strict();
    sessionControlRecordedEventSchema = dialogueEventMetaSchema.extend({ control: z4.enum(["pause", "resume", "end", "switch"]), personaId: personaIdSchema.optional() }).strict();
    dialogueCommitSchema = z4.object({ payloadHash: z4.string().min(1) }).strict();
    legacyPersonaIdRawSchema = z4.string().min(1);
    dilemmaPhaseSchema = z4.enum(["pending", "candidate", "confirmed", "corrected"]);
    dilemmaStateSchema = z4.object({
      phase: dilemmaPhaseSchema,
      activePersona: personaIdSchema.nullable(),
      /** 导演推断的困惑文本（未确认）。 */
      candidateText: z4.string().nullable(),
      /** 用户确认后的困惑文本。 */
      confirmedText: z4.string().nullable(),
      /** 用户纠正后的困惑文本。 */
      correctedText: z4.string().nullable(),
      /** 已关联的 user/message 事件 seq 列表（只增，append-only）。 */
      userRawRefs: z4.array(z4.number()),
      /** 最近一次状态变更的 session 事件 seq（-1 = 尚无）。 */
      updatedBySeq: z4.number()
    });
    initialDilemmaState = (persona) => ({
      phase: "pending",
      activePersona: persona,
      candidateText: null,
      confirmedText: null,
      correctedText: null,
      userRawRefs: [],
      updatedBySeq: -1
    });
    dilemmaEventHeaderSchema = z4.object({
      turnId: z4.string(),
      taskId: z4.string(),
      invocationId: z4.string()
    });
    dilemmaCandidateEventSchema = dilemmaEventHeaderSchema.extend({
      persona: personaIdSchema,
      text: z4.string()
    });
    dilemmaConfirmedEventSchema = dilemmaEventHeaderSchema.extend({
      text: z4.string()
    });
    dilemmaCorrectedEventSchema = dilemmaEventHeaderSchema.extend({
      text: z4.string()
    });
    trunkEventRecordSchema = z4.object({
      type: z4.string(),
      seq: z4.number(),
      time: z4.string(),
      data: z4.unknown()
    });
    trunkCreatedEventSchema = z4.object({
      conversationId: z4.string()
    });
    trunkUserRawAddedEventSchema = z4.object({
      ref: z4.number(),
      text: z4.string(),
      // 6.2: 客户端身份与稳定投递指针。旧 JSONL 无此字段时由 replay 补齐。
      message_id: z4.string().min(1).optional(),
      raw_ref: z4.string().min(1).optional(),
      // 6.2 Task4: first acceptance fixes the delivery target. Legacy records omit it.
      target_persona_id: personaIdSchema.optional()
    });
    trunkDilemmaCandidateEventSchema = z4.object({
      persona: personaIdSchema,
      text: z4.string()
    });
    trunkDilemmaConfirmedEventSchema = z4.object({
      text: z4.string()
    });
    trunkDilemmaCorrectedEventSchema = z4.object({
      text: z4.string()
    });
    trunkActivePersonaEventSchema = z4.object({
      persona: personaIdSchema
    });
    trunkBranchIndexEventSchema = z4.object({
      persona: personaIdSchema,
      sessionId: z4.string()
    });
    trunkUserRawSchema = z4.object({
      ref: z4.number(),
      text: z4.string(),
      messageId: z4.string().min(1),
      rawRef: z4.string().min(1),
      targetPersonaId: personaIdSchema.optional()
    });
    taskOutcomeSchema = z4.object({ taskId: z4.string().min(1), personaId: personaIdSchema, branchSessionId: z4.string().min(1), branchTurn: z4.number().int().positive(), status: z4.literal("blocked"), reason: z4.literal("budget_exceeded"), retryable: z4.literal(true) });
    trunkTaskOutcomeRecordedEventSchema = taskOutcomeSchema;
    trunkBranchDeliveryCommittedEventSchema = z4.object({
      conversation_id: z4.string().min(1),
      persona_id: personaIdSchema,
      raw_ref: z4.string().min(1),
      message_id: z4.string().min(1),
      session_id: z4.string().min(1)
    });
    trunkStateSchema = z4.object({
      conversationId: z4.string(),
      activePersona: personaIdSchema,
      userRaws: z4.array(trunkUserRawSchema),
      dilemma: dilemmaStateSchema,
      branchesIndex: z4.record(personaIdSchema, z4.string()),
      taskOutcomes: z4.record(z4.string(), taskOutcomeSchema),
      deliveryCommitted: z4.array(trunkBranchDeliveryCommittedEventSchema),
      dilemmaItems: z4.array(dilemmaItemSchema).default([]),
      coreDilemmaItemId: z4.string().nullable().default(null),
      dialogue: dialogueControlStateSchema.nullable().default(null),
      branchProgress: z4.record(personaIdSchema, branchProgressSchema).default({}),
      dialogueCommits: z4.record(z4.string(), dialogueCommitSchema).default({})
    });
    initialTrunkState = (conversationId, initialPersonaId) => ({
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
  }
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
var init_dilemma = __esm({
  "src/domain/dilemma.ts"() {
    "use strict";
    init_schema();
  }
});

// src/storage/trunk-storage.ts
var trunk_storage_exports = {};
__export(trunk_storage_exports, {
  TRUNK_ACTION_RECORDED: () => TRUNK_ACTION_RECORDED,
  TRUNK_ACTIVE_PERSONA_SET: () => TRUNK_ACTIVE_PERSONA_SET,
  TRUNK_BRANCH_DELIVERY_COMMITTED: () => TRUNK_BRANCH_DELIVERY_COMMITTED,
  TRUNK_BRANCH_INDEXED: () => TRUNK_BRANCH_INDEXED,
  TRUNK_BRANCH_PROGRESS_UPDATED: () => TRUNK_BRANCH_PROGRESS_UPDATED,
  TRUNK_CREATED: () => TRUNK_CREATED,
  TRUNK_DIALOGUE_PHASE_SET: () => TRUNK_DIALOGUE_PHASE_SET,
  TRUNK_DILEMMA_CANDIDATE: () => TRUNK_DILEMMA_CANDIDATE,
  TRUNK_DILEMMA_CONFIRMED: () => TRUNK_DILEMMA_CONFIRMED,
  TRUNK_DILEMMA_CORE_SELECTED: () => TRUNK_DILEMMA_CORE_SELECTED,
  TRUNK_DILEMMA_CORRECTED: () => TRUNK_DILEMMA_CORRECTED,
  TRUNK_DILEMMA_ITEM_PROPOSED: () => TRUNK_DILEMMA_ITEM_PROPOSED,
  TRUNK_DILEMMA_ITEM_REVIEWED: () => TRUNK_DILEMMA_ITEM_REVIEWED,
  TRUNK_PRODUCT_LIFECYCLE: () => TRUNK_PRODUCT_LIFECYCLE,
  TRUNK_PRODUCT_RESULT: () => TRUNK_PRODUCT_RESULT,
  TRUNK_SESSION_CONTROL_RECORDED: () => TRUNK_SESSION_CONTROL_RECORDED,
  TRUNK_TASK_OUTCOME_RECORDED: () => TRUNK_TASK_OUTCOME_RECORDED,
  TRUNK_TASK_ROUTED: () => TRUNK_TASK_ROUTED,
  TRUNK_USER_RAW_ADDED: () => TRUNK_USER_RAW_ADDED,
  TrunkStorage: () => TrunkStorage,
  applyTrunkRecord: () => applyTrunkRecord
});
import { appendFileSync, existsSync, mkdirSync, readFileSync as readFileSync2 } from "node:fs";
import { z as z9 } from "zod";
import { dirname, join as join2 } from "node:path";
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
var TRUNK_CREATED, TRUNK_USER_RAW_ADDED, TRUNK_DILEMMA_CANDIDATE, TRUNK_DILEMMA_CONFIRMED, TRUNK_DILEMMA_CORRECTED, TRUNK_ACTIVE_PERSONA_SET, TRUNK_BRANCH_INDEXED, TRUNK_TASK_OUTCOME_RECORDED, TRUNK_BRANCH_DELIVERY_COMMITTED, TRUNK_TASK_ROUTED, TRUNK_DIALOGUE_PHASE_SET, TRUNK_DILEMMA_ITEM_PROPOSED, TRUNK_DILEMMA_ITEM_REVIEWED, TRUNK_DILEMMA_CORE_SELECTED, TRUNK_BRANCH_PROGRESS_UPDATED, TRUNK_ACTION_RECORDED, TRUNK_SESSION_CONTROL_RECORDED, TRUNK_PRODUCT_LIFECYCLE, TRUNK_PRODUCT_RESULT, NEW_EVENT_SCHEMAS, TrunkStorage, zProductLifecycle, zProductResult;
var init_trunk_storage = __esm({
  "src/storage/trunk-storage.ts"() {
    "use strict";
    init_schema();
    init_schema();
    init_dilemma();
    TRUNK_CREATED = "trunk/created";
    TRUNK_USER_RAW_ADDED = "trunk/user-raw-added";
    TRUNK_DILEMMA_CANDIDATE = "trunk/dilemma-candidate";
    TRUNK_DILEMMA_CONFIRMED = "trunk/dilemma-confirmed";
    TRUNK_DILEMMA_CORRECTED = "trunk/dilemma-corrected";
    TRUNK_ACTIVE_PERSONA_SET = "trunk/active-persona-set";
    TRUNK_BRANCH_INDEXED = "trunk/branch-indexed";
    TRUNK_TASK_OUTCOME_RECORDED = "trunk/task-outcome-recorded";
    TRUNK_BRANCH_DELIVERY_COMMITTED = "trunk/branch-delivery-committed";
    TRUNK_TASK_ROUTED = "trunk/task-routed";
    TRUNK_DIALOGUE_PHASE_SET = "trunk/dialogue-phase-set";
    TRUNK_DILEMMA_ITEM_PROPOSED = "trunk/dilemma-item-proposed";
    TRUNK_DILEMMA_ITEM_REVIEWED = "trunk/dilemma-item-reviewed";
    TRUNK_DILEMMA_CORE_SELECTED = "trunk/dilemma-core-selected";
    TRUNK_BRANCH_PROGRESS_UPDATED = "trunk/branch-progress-updated";
    TRUNK_ACTION_RECORDED = "trunk/action-recorded";
    TRUNK_SESSION_CONTROL_RECORDED = "trunk/session-control-recorded";
    TRUNK_PRODUCT_LIFECYCLE = "trunk/v2/product-lifecycle";
    TRUNK_PRODUCT_RESULT = "trunk/v2/product-result";
    NEW_EVENT_SCHEMAS = {
      [TRUNK_TASK_ROUTED]: taskRoutedEventSchema,
      [TRUNK_DIALOGUE_PHASE_SET]: dialoguePhaseSetEventSchema,
      [TRUNK_DILEMMA_ITEM_PROPOSED]: dilemmaItemProposedEventSchema,
      [TRUNK_DILEMMA_ITEM_REVIEWED]: dilemmaItemReviewedEventSchema,
      [TRUNK_DILEMMA_CORE_SELECTED]: dilemmaCoreSelectedEventSchema,
      [TRUNK_BRANCH_PROGRESS_UPDATED]: branchProgressUpdatedEventSchema,
      [TRUNK_ACTION_RECORDED]: actionRecordedEventSchema,
      [TRUNK_SESSION_CONTROL_RECORDED]: sessionControlRecordedEventSchema
    };
    TrunkStorage = class _TrunkStorage {
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
        const filePath = join2(storageDir, `${conversationId}.jsonl`);
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
        const filePath = join2(storageDir, `${conversationId}.jsonl`);
        if (!existsSync(filePath)) {
          throw new Error(`cannot restore missing trunk without explicit initial PersonaId: ${conversationId}`);
        }
        const text = readFileSync2(filePath, "utf8");
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
        const canonical2 = { ...data, persona_id: this.registry.get(data.persona_id).id };
        if (this.isBranchDeliveryCommitted(canonical2.persona_id, canonical2.raw_ref)) return -1;
        return this.append(TRUNK_BRANCH_DELIVERY_COMMITTED, canonical2);
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
        const canonical2 = taskOutcomeSchema.parse({ ...outcome, personaId: this.registry.get(outcome.personaId).id });
        const previous = this.stateInternal.taskOutcomes[canonical2.taskId];
        if (previous) {
          if (JSON.stringify(previous) !== JSON.stringify(canonical2)) throw new Error(`task outcome conflict: ${canonical2.taskId}`);
          return -1;
        }
        return this.append(TRUNK_TASK_OUTCOME_RECORDED, canonical2);
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
    zProductLifecycle = z9.object({ version: z9.literal(2), conversationId: z9.string().min(1), lifecycle: z9.enum(["active", "paused", "closed"]), operationId: z9.string().min(1) }).strict();
    zProductResult = z9.object({ version: z9.literal(2), operationId: z9.string().min(1), status: z9.enum(["reply", "blocked"]), rawRef: z9.string().min(1) }).strict();
  }
});

// src/e2e/vertical-slice-dialogue-loop.ts
import { mkdirSync as mkdirSync3, mkdtempSync, readFileSync as readFileSync3, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as join3 } from "node:path";
import { createHash as createHash2 } from "node:crypto";

// src/dialogue/safety.ts
import { z } from "zod";
var safetyResultSchema = z.object({ disposition: z.enum(["allow", "professional-boundary", "urgent-help", "refuse"]), reason: z.enum(["none", "medical", "mental-health", "legal", "financial", "self-harm", "imminent-danger", "sexual", "illegal-assistance"]), message: z.string() }).strict().superRefine((v, ctx) => {
  const allowed = { allow: ["none"], "professional-boundary": ["medical", "mental-health", "legal", "financial"], "urgent-help": ["self-harm", "imminent-danger"], refuse: ["sexual", "illegal-assistance"] };
  if (!(allowed[v.disposition] ?? []).includes(v.reason)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "safety reason does not match disposition" });
  if (v.disposition === "allow" && v.message !== "") ctx.addIssue({ code: z.ZodIssueCode.custom, message: "allow must have empty message" });
  if (v.disposition !== "allow" && v.message.trim() === "") ctx.addIssue({ code: z.ZodIssueCode.custom, message: "nonallow must have non-empty message" });
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

// src/dialogue/types.ts
import { z as z2 } from "zod";

// src/dialogue/public-contract.ts
var TURN_INTENTS = ["answer", "clarify", "await-confirmation", "reflect", "offer-controls", "pause", "close"];
var DIALOGUE_CONTROLS = ["confirm", "partial-confirm", "correct", "skip", "continue", "pause", "end", "switch-persona", "new-dilemma"];

// src/dialogue/types.ts
var taskModeSchema = z2.enum(["knowledge", "dilemma", "review"]);
var safetyDispositionSchema = z2.enum(["allow", "professional-boundary", "urgent-help", "refuse"]);
var safetyReasonSchema = z2.enum(["none", "medical", "mental-health", "legal", "financial", "self-harm", "imminent-danger", "sexual", "illegal-assistance"]);
var dialoguePhaseSchema = z2.enum(["responding", "clarifying", "awaiting-confirmation", "reflecting", "action-defined", "paused", "closed"]);
var feedbackKindSchema = z2.enum(["none", "confirm", "partial-confirm", "correct", "reject", "new-information", "reality-changed", "disagree-persona", "not-helpful", "question-evidence", "action-feedback", "skip", "continue", "pause", "end", "unclear"]);
var turnIntentSchema = z2.enum(TURN_INTENTS);
var dialogueControlSchema = z2.enum(DIALOGUE_CONTROLS);
var turnControlDecisionSchema = z2.object({
  safety: safetyDispositionSchema,
  safetyReason: safetyReasonSchema,
  taskMode: taskModeSchema,
  confidence: z2.enum(["high", "low"]),
  emotionPriority: z2.boolean(),
  feedbackKind: feedbackKindSchema,
  independentNewDilemma: z2.boolean()
}).strict();
var defaultControlDecision = () => ({ safety: "allow", safetyReason: "none", taskMode: "dilemma", confidence: "low", emotionPriority: false, feedbackKind: "unclear", independentNewDilemma: false });

// src/dialogue/control-classifier.ts
function parseControlDecision(value) {
  return turnControlDecisionSchema.parse(value);
}
function createControlClassifier(adapter, observe2) {
  return { async classify(input) {
    const started = Date.now();
    const safety = deterministicSafetyGate(input.raw);
    let output;
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
        output = parseControlDecision(await invoke());
      } catch (error) {
        failed = true;
        try {
          parseAttempts++;
          output = parseControlDecision(await invoke());
          repaired = true;
          failed = false;
        } catch (repairError) {
          failed = true;
        }
      }
    }
    const base = output ?? defaultControlDecision();
    const merged = mergeSafetyDecision(safety, { disposition: base.safety, reason: base.safetyReason, message: "" });
    const result = { ...base, safety: merged.disposition, safetyReason: merged.reason };
    observe2?.({ input: { raw: input.raw, ...input.confirmedContext === void 0 ? {} : { confirmedContext: input.confirmedContext }, ...input.phase === void 0 ? {} : { phase: input.phase }, ...input.invocationId === void 0 ? {} : { invocationId: input.invocationId } }, output: result, parseFailed: failed, repairUsed: repaired, attempts, parseAttempts, latencyMs: Date.now() - started, ...tokenUsage ? { tokenUsage } : {} });
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
import { z as z3 } from "zod";
var feedbackPayloadSchema = z3.object({
  kind: z3.enum(["none", "confirm", "partial-confirm", "correct", "reject", "new-information", "reality-changed", "disagree-persona", "not-helpful", "question-evidence", "action-feedback", "skip", "continue", "pause", "end", "unclear"]),
  itemId: z3.string().min(1).optional(),
  replacement: z3.unknown().optional(),
  details: z3.object({ summary: z3.string().trim().min(1), lastSemanticSeq: z3.number().optional() }).strict().optional()
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
init_schema();
import { createHash } from "node:crypto";
import { z as z6 } from "zod";

// src/persona/manifest-schema.ts
import { z as z5 } from "zod";
var personaIdSchema2 = z5.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "PersonaId must be kebab-case");
var personaStatusSchema = z5.enum(["active", "retired"]);
var personaContentManifestSchema = z5.object({
  prompt: z5.string().min(1),
  anecdotes: z5.string().min(1),
  quotes: z5.string().min(1),
  blacklist: z5.string().min(1)
}).strict();
var personaManifestSchema = z5.object({
  id: personaIdSchema2,
  displayName: z5.string().min(1),
  status: personaStatusSchema,
  legacyIds: z5.array(z5.string().min(1)).default([]),
  content: personaContentManifestSchema
}).strict();

// src/dialogue/director-update.ts
var proposalSchema = z6.object({ id: z6.string().min(1).optional(), kind: z6.enum(["fact", "inference", "goal", "value-conflict", "core-conflict"]), text: z6.string().min(1), sourceRawRefs: z6.array(z6.string().min(1)).min(1), proposedByPersona: personaIdSchema2 }).strict();
var directorUpdateSchema = z6.object({ propose: z6.array(proposalSchema), coreCandidateId: z6.string().min(1).optional() }).strict();
var idFor = (p) => `candidate-${createHash("sha256").update(JSON.stringify([p.kind, p.text, p.sourceRawRefs, p.proposedByPersona])).digest("hex").slice(0, 20)}`;
function validateDirectorUpdate(value, state, personaId, registry) {
  registry.get(personaId);
  const parsed = directorUpdateSchema.parse(value);
  const seen = /* @__PURE__ */ new Set();
  const propose = parsed.propose.map((raw) => {
    if (raw.proposedByPersona !== personaId) throw new Error("director proposal must belong to current persona");
    registry.get(raw.proposedByPersona);
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
function canonical(id, registry) {
  return registry.get(id).id;
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
function buildActorContext(state, persona, registry, currentRawRef, selectedHistoricalRawRefs = [], currentBranchHistory = []) {
  const personaId = canonical(persona, registry);
  const definition = registry.get(personaId);
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
init_schema();
import { z as z7 } from "zod";
var branchUserMessageSourceSchema = z7.object({
  conversation_id: z7.string().min(1),
  message_id: z7.string().min(1),
  raw_ref: z7.string().min(1),
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
import { z as z8 } from "zod";
var turnInterpretationSchema = z8.object({
  responseNeeds: z8.object({ answerKnowledge: z8.boolean(), acknowledgeEmotion: z8.boolean(), clarify: z8.boolean(), proposeCandidate: z8.boolean() }).strict(),
  safetyEscalation: z8.enum(["none", "professional-boundary", "urgent-help", "refuse"]),
  feedback: z8.enum(["none", "confirm", "partial-confirm", "correct", "reject", "skip", "pause", "end", "continue"])
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
  let branchHistory2;
  try {
    branchHistory2 = await deps.loadCurrentBranchHistory({ personaId, sessionId });
  } catch (error) {
    return { ...fail("branch-history-failed", error, calls), control, policy };
  }
  const context = buildActorContext(deps.trunk.state, personaId, deps.registry, delivered.rawRef, selectedHistoricalRawRefs, branchHistory2);
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

// src/e2e/dialogue-loop-fixture.ts
import { mkdirSync as mkdirSync2 } from "node:fs";

// src/persona/registry.ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
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
    value = JSON.parse(readFileSync(path, "utf8"));
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
    const canonical2 = /* @__PURE__ */ new Map();
    const legacy = /* @__PURE__ */ new Map();
    for (const definition of definitions) {
      const parsed = personaManifestSchema.parse(definition.manifest);
      if (canonical2.has(parsed.id)) throw new Error(`duplicate canonical PersonaId: ${parsed.id}`);
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
      canonical2.set(parsed.id, normalized);
      for (const legacyId of parsed.legacyIds) {
        if (legacy.has(legacyId) || canonical2.has(legacyId)) throw new Error(`duplicate legacy PersonaId: ${legacyId}`);
        legacy.set(legacyId, parsed.id);
      }
    }
    for (const [id] of canonical2) {
      if (legacy.has(id)) throw new Error(`canonical PersonaId conflicts with legacy ID: ${id}`);
    }
    this.definitions = canonical2;
    this.legacyToCanonical = legacy;
  }
  static fromArtifact(artifact) {
    return new _PersonaRegistry(artifact);
  }
  get(id) {
    const canonical2 = personaIdSchema2.parse(id);
    const definition = this.definitions.get(canonical2);
    if (!definition) throw new Error(`unknown PersonaId: ${id}`);
    return definition;
  }
  normalizePersistedId(id) {
    const parsed = personaIdSchema2.safeParse(id);
    if (parsed.success && this.definitions.has(parsed.data)) return parsed.data;
    const canonical2 = this.legacyToCanonical.get(id);
    if (canonical2) return canonical2;
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
    const names = readdirSync(root).filter((name) => statSafe(join(root, name))?.isDirectory()).sort();
    const definitions = names.map((name) => {
      const packageDir = join(root, name);
      const manifestPath = join(packageDir, "manifest.json");
      let manifest;
      try {
        manifest = personaManifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
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
    return readFileSync(path, "utf8");
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

// src/e2e/dialogue-loop-fixture.ts
init_trunk_storage();
var FIXTURE_PERSONA_IDS = ["alpha", "beta", "gamma"];
function createDialogueFixture(root, conversationId = "dialogue-loop") {
  const registry = new PersonaRegistry(FIXTURE_PERSONA_IDS.map((id) => ({ manifest: { id, displayName: id, status: "active", legacyIds: [], content: { prompt: "fixture", anecdotes: "fixture", quotes: "fixture", blacklist: "fixture" } }, prompt: "fixture", anecdotes: [], quotes: [], blacklist: [] })));
  mkdirSync2(root, { recursive: true });
  const trunk = TrunkStorage.create(conversationId, root, "alpha", registry);
  const branches = Object.fromEntries(FIXTURE_PERSONA_IDS.map((personaId) => {
    const branch = { personaId, sessionId: `fixture-${conversationId}-${personaId}`, events: [], append(type, data) {
      branch.events.push({ type, personaId, text: data.content?.[0]?.text ?? "", rawRef: data.source?.raw_ref });
    }, async flush() {
    } };
    trunk.indexBranch(personaId, branch.sessionId);
    return [personaId, branch];
  }));
  return { root, registry, trunk, branches, answers: /* @__PURE__ */ new Map(), observations: [], actorContexts: [], actorResults: [], providerRequests: [], globalTrace: [], loaderRequests: [] };
}
function branchHistory(branch) {
  return branch.events.map((e) => `${e.type}:${e.text}`);
}

// src/validation/dialogue-loop-report.ts
import { z as z10 } from "zod";
var requestSchema = z10.object({ kind: z10.enum(["classifier", "director", "actor", "retrieval"]), requestId: z10.string().min(1), personaId: z10.string().optional(), usage: z10.object({ inputTokens: z10.number().int().nonnegative(), outputTokens: z10.number().int().nonnegative(), totalTokens: z10.number().int().nonnegative() }).strict(), network: z10.boolean() }).strict();
var contextSchema = z10.array(z10.object({ personaId: z10.string(), currentRawRef: z10.string(), candidateItems: z10.array(z10.unknown()), confirmedItems: z10.array(z10.unknown()), selectedHistoricalRawRefs: z10.array(z10.string()), branchHistory: z10.array(z10.string()), branchProgress: z10.unknown() }).strict());
var actorResultSchema = z10.object({ personaId: z10.string(), messageId: z10.string(), questions: z10.array(z10.string()), controls: z10.array(z10.string()), retrievalCalls: z10.number().int().nonnegative(), replyMarker: z10.string() }).strict();
var restartSchema = z10.object({ before: z10.object({ actor: z10.number(), classifier: z10.number(), director: z10.number(), rawCount: z10.number(), answerCount: z10.number(), branchCount: z10.number(), progressCount: z10.number(), bytesHash: z10.string() }).strict(), after: z10.object({ actor: z10.number(), classifier: z10.number(), director: z10.number(), rawCount: z10.number(), answerCount: z10.number(), branchCount: z10.number(), progressCount: z10.number(), bytesHash: z10.string() }).strict(), progressCompensated: z10.boolean(), loadBytesUnchanged: z10.boolean(), actorDelta: z10.number(), classifierDelta: z10.number(), directorDelta: z10.number(), rawDelta: z10.number(), answerDelta: z10.number(), branchDelta: z10.number(), progressDelta: z10.number(), loadedHash: z10.string(), finalHash: z10.string() }).strict();
var scenarioSchema = z10.object({ name: z10.string(), status: z10.enum(["passed", "blocked"]), error: z10.string().optional(), calls: z10.object({ classifier: z10.number().int().nonnegative(), director: z10.number().int().nonnegative(), actor: z10.number().int().nonnegative(), retrieval: z10.number().int().nonnegative() }).strict(), providerRequests: z10.array(requestSchema), actorResults: z10.array(actorResultSchema), eventTypes: z10.array(z10.string()), eventSeqs: z10.array(z10.number().int().nonnegative()), candidateStatuses: z10.array(z10.string()), revisionLineage: z10.array(z10.object({ id: z10.string(), text: z10.string(), status: z10.string(), visibility: z10.string(), supersedes: z10.string().optional(), supersededBy: z10.string().optional() }).strict()), contexts: z10.record(z10.string(), contextSchema), branchHistories: z10.record(z10.string(), z10.array(z10.string())), globalTrace: z10.array(z10.object({ seq: z10.number(), kind: z10.string(), type: z10.string(), personaId: z10.string().optional() }).strict()), loaderRequests: z10.array(z10.object({ personaId: z10.string(), sessionId: z10.string(), target: z10.string() }).strict()), restart: restartSchema.optional(), urgentDownstreamCalls: z10.number().int().nonnegative() }).strict();
var dialogueLoopReportSchema = z10.object({ schemaVersion: z10.literal(3), providerNetworkUsed: z10.boolean(), tokenCost: z10.number().int().nonnegative(), providerRequests: z10.array(requestSchema), scenarios: z10.array(scenarioSchema), totalCalls: z10.number().int().nonnegative(), expectedPersonaIds: z10.array(z10.string()), passed: z10.boolean() }).strict();
function validateDialogueLoopReport(report, expectedScenarioNames, expectedPersonaIds) {
  const parsed = dialogueLoopReportSchema.safeParse(report);
  if (!parsed.success) return { ok: false, code: "schema-invalid", issues: parsed.error.issues };
  const r = parsed.data;
  const fail2 = (code) => ({ ok: false, code });
  if (r.passed !== true) return fail2("passed-summary-mismatch");
  if (expectedPersonaIds.length === 0 || new Set(expectedScenarioNames).size !== expectedScenarioNames.length || new Set(expectedPersonaIds).size !== expectedPersonaIds.length) return fail2("expected-set-not-unique");
  if (JSON.stringify([...r.expectedPersonaIds].sort()) !== JSON.stringify([...expectedPersonaIds].sort())) return fail2("persona-set-mismatch");
  const names = r.scenarios.map((s) => s.name);
  if (JSON.stringify([...names].sort()) !== JSON.stringify([...expectedScenarioNames].sort()) || new Set(names).size !== names.length) return fail2("scenario-set-mismatch");
  const flat = r.scenarios.flatMap((s) => s.providerRequests);
  if (JSON.stringify(flat) !== JSON.stringify(r.providerRequests)) return fail2("provider-cost-or-network");
  if (new Set(flat.map((q) => q.requestId)).size !== flat.length) return fail2("provider-request-id-duplicate");
  if (flat.some((q) => q.network)) return fail2("schema-invalid");
  if (flat.some((q) => q.usage.inputTokens > 0 || q.usage.outputTokens > 0 || q.usage.totalTokens > 0)) return fail2("provider-cost-or-network");
  if (r.providerNetworkUsed !== flat.some((q) => q.network) || r.tokenCost !== flat.reduce((n, q) => n + q.usage.totalTokens, 0)) return fail2("schema-invalid");
  const urgentEarly = r.scenarios.find((s) => s.name === "urgent");
  if (urgentEarly && (urgentEarly.urgentDownstreamCalls !== 0 || Object.values(urgentEarly.calls).slice(1).some((n) => n !== 0))) return fail2("urgent-downstream-nonzero");
  const total = r.scenarios.reduce((n, s) => n + Object.values(s.calls).reduce((a, b) => a + b, 0), 0);
  if (total !== r.totalCalls) return fail2("total-calls-mismatch");
  const allMessages = r.scenarios.flatMap((s) => s.actorResults.map((a) => a.messageId));
  if (new Set(allMessages).size !== allMessages.length) return fail2("actor-result-invalid");
  for (const s of r.scenarios) {
    if (s.eventSeqs.some((seq, i) => i > 0 && seq <= s.eventSeqs[i - 1])) return fail2("event-seq-not-increasing");
    if (s.globalTrace.some((entry, i) => i > 0 && entry.seq <= s.globalTrace[i - 1].seq)) return fail2("event-seq-not-increasing");
    const counts = s.providerRequests.reduce((a, q) => {
      a[q.kind]++;
      return a;
    }, { classifier: 0, director: 0, actor: 0, retrieval: 0 });
    if (JSON.stringify(counts) !== JSON.stringify(s.calls)) return fail2("scenario-call-count-mismatch");
    if (s.actorResults.length !== s.calls.actor || new Set(s.actorResults.map((a) => a.messageId)).size !== s.actorResults.length || s.actorResults.some((a) => !expectedPersonaIds.includes(a.personaId) || !Array.isArray(a.questions) || !Array.isArray(a.controls) || !Number.isInteger(a.retrievalCalls) || a.retrievalCalls < 0)) return fail2("actor-result-invalid");
    if (s.status !== (s.name === "urgent" ? "blocked" : "passed")) return fail2("scenario-status-mismatch");
    if (s.name === "urgent" && (s.urgentDownstreamCalls !== 0 || s.providerRequests.length !== 0)) return fail2("urgent-downstream-nonzero");
    if (JSON.stringify(Object.keys(s.contexts).sort()) !== JSON.stringify([...expectedPersonaIds].sort()) || JSON.stringify(Object.keys(s.branchHistories).sort()) !== JSON.stringify([...expectedPersonaIds].sort())) return fail2("context-persona-set-mismatch");
    if (s.name === "knowledge" && s.candidateStatuses.length !== 0) return fail2("knowledge-candidate-present");
    if (s.name === "knowledge" && (s.calls.director !== 0 || s.actorResults.some((a) => a.questions.length !== 0))) return fail2("knowledge-boundary-invalid");
    if (s.name === "dilemma") {
      const primary = expectedPersonaIds[0];
      const d = s.globalTrace.find((x) => x.type === "provider/director")?.seq;
      const a = s.globalTrace.find((x) => x.type === "actor-context")?.seq;
      const candidateIds = new Set(s.revisionLineage.filter((x) => x.status === "candidate").map((x) => x.id));
      const context = s.contexts[primary]?.[0];
      if (d === void 0 || a === void 0 || d >= a || !context?.candidateItems.some((item) => typeof item === "object" && item !== null && "unconfirmed" in item && item.unconfirmed === true && "id" in item && candidateIds.has(item.id))) return fail2("director-before-actor");
    }
    if (s.name === "partial-confirm" || s.name === "correct") {
      const old = s.revisionLineage.find((x) => x.status === "superseded");
      const next = s.revisionLineage.find((x) => x.status === "confirmed" && x.supersedes);
      const invalid = !old || !next || old.supersededBy !== next.id || next.supersedes !== old.id || next.visibility !== "shared-confirmed" || s.name === "correct" && old.text === next.text;
      if (invalid) return fail2(s.name === "correct" ? "correction-lineage-invalid" : "revision-lineage-invalid");
    }
    if (s.name === "skip" && (s.calls.director !== 1 || s.candidateStatuses.some((status) => status !== "candidate") || s.revisionLineage.some((x) => x.status !== "candidate" || x.visibility !== "origin-persona-only" || x.supersededBy))) return fail2(s.calls.director !== 1 ? "skip-director-rerun" : "skip-mutated-candidate");
    if (s.name === "review-reality-changed" && !s.eventTypes.includes("trunk/action-recorded")) return fail2("review-action-missing");
    if (s.name === "switch-isolation") {
      const primary = expectedPersonaIds[0];
      const others = expectedPersonaIds.slice(1);
      const primaryContexts = s.contexts[primary] ?? [];
      const primaryContext = primaryContexts.find((c) => c.candidateItems.length > 0) ?? primaryContexts.at(-1);
      const shared = s.revisionLineage.find((x) => x.status === "confirmed" && x.visibility === "shared-confirmed");
      if (!primaryContext || !shared) return fail2("shared-confirmed-missing");
      const replies = new Map(s.actorResults.map((a) => [a.personaId, a.replyMarker]));
      for (const p of expectedPersonaIds) {
        for (const c of s.contexts[p] ?? []) {
          const own = c.candidateItems.every((item) => typeof item === "object" && item !== null && "proposedByPersona" in item && item.proposedByPersona === p);
          if (!own) return fail2("switch-context-invalid");
          for (const [other, marker] of replies) if (other !== p && c.branchHistory.some((line) => line.includes(marker))) return fail2("foreign-branch-leak");
          if (c.branchHistory.some((line) => s.actorResults.some((a) => a.personaId !== p && a.replyMarker.length > 0 && line.includes(a.replyMarker)))) return fail2("foreign-branch-leak");
          const progress = JSON.stringify(c.branchProgress ?? "");
          for (const [other, marker] of replies) if (other !== p && (progress.includes(marker) || progress.includes(`progress-${other}`))) return fail2("foreign-branch-leak");
        }
      }
      for (const p of others) {
        const c = s.contexts[p].at(-1);
        const hasShared = c?.confirmedItems.some((item) => typeof item === "object" && item !== null && "id" in item && item.id === shared.id);
        if (!c || !hasShared || !c.selectedHistoricalRawRefs.includes(primaryContext.currentRawRef)) return fail2("switch-context-invalid");
      }
      const sessions = /* @__PURE__ */ new Map();
      for (const q of s.loaderRequests) {
        if (!expectedPersonaIds.includes(q.personaId) || q.target !== q.personaId || sessions.has(q.personaId) && sessions.get(q.personaId) !== q.sessionId) return fail2("loader-target-mismatch");
        sessions.set(q.personaId, q.sessionId);
      }
      if (sessions.size !== expectedPersonaIds.length) return fail2("loader-target-mismatch");
    }
    if (s.restart) {
      const x = s.restart;
      if (!x.progressCompensated || !x.loadBytesUnchanged || x.loadedHash !== x.before.bytesHash || x.finalHash !== x.after.bytesHash || x.actorDelta !== 0 || x.classifierDelta !== 0 || x.directorDelta !== 0 || x.rawDelta !== 0 || x.answerDelta !== 0 || x.branchDelta !== 0 || x.progressDelta !== 1 || x.after.actor !== x.before.actor + x.actorDelta || x.after.classifier !== x.before.classifier + x.classifierDelta || x.after.director !== x.before.director + x.directorDelta || x.after.rawCount !== x.before.rawCount + x.rawDelta || x.after.answerCount !== x.before.answerCount + x.answerDelta || x.after.branchCount !== x.before.branchCount + x.branchDelta || x.after.progressCount !== x.before.progressCount + x.progressDelta) return fail2("restart-not-idempotent");
    }
  }
  return { ok: true, report: r };
}

// src/e2e/vertical-slice-dialogue-loop.ts
var dialogueScenarioNames = ["knowledge", "dilemma", "partial-confirm", "correct", "review-reality-changed", "skip", "urgent", "switch-isolation", "restart-idempotency"];
var zero = () => ({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
var sha = (s) => createHash2("sha256").update(s).digest("hex");
function observe(f, kind, personaId) {
  const request = { kind, requestId: `${f.root.split(/[\\/]/).pop()}-${kind}-${f.providerRequests.length + 1}`, ...personaId ? { personaId } : {}, usage: zero(), network: false };
  f.providerRequests.push(request);
  f.observations.push(request);
  f.globalTrace.push({ seq: f.globalTrace.length, kind: "trunk", type: `provider/${kind}`, ...personaId ? { personaId } : {} });
}
function makeDeps(f, personaId, mode, feedbackKind) {
  let activeMessageId = "";
  const classifier = createControlClassifier(async () => {
    observe(f, "classifier", personaId);
    return { safety: "allow", safetyReason: "none", taskMode: mode, confidence: "high", emotionPriority: false, feedbackKind, independentNewDilemma: false };
  });
  const actor = {
    answerExists: ({ messageId, personaId: id }) => f.answers.has(`${messageId}:${id}`),
    loadExisting: ({ messageId, personaId: id }) => f.answers.get(`${messageId}:${id}`),
    run: async ({ context }) => {
      const result = { reply: `stub-${personaId}-${context.currentRaw}`, progressSummary: `progress-${personaId}`, questions: [], retrievalCalls: 0 };
      const snapshot = { personaId, currentRawRef: context.currentRawRef, candidateItems: context.candidateItems, confirmedItems: context.confirmedItems, selectedHistoricalRawRefs: context.selectedHistoricalRawRefs, branchHistory: context.currentBranchHistory, branchProgress: context.branchProgress };
      f.actorContexts.push(snapshot);
      f.globalTrace.push({ seq: f.globalTrace.length, kind: "context", type: "actor-context", personaId });
      f.answers.set(`${activeMessageId}:${personaId}`, result);
      f.actorResults.push({ personaId, messageId: activeMessageId, questions: result.questions ?? [], controls: result.controls ?? [], retrievalCalls: result.retrievalCalls ?? 0, replyMarker: result.reply });
      f.branches[personaId].events.push({ type: "assistant/message", personaId, text: result.reply });
      observe(f, "actor", personaId);
      return result;
    }
  };
  const deps = {
    registry: f.registry,
    trunk: f.trunk,
    delivery: { session: f.branches[personaId], sessionId: f.branches[personaId].sessionId, flush: async (session) => session.flush(), findUserMessageByRawRef: (ref) => f.branches[personaId].events.some((event) => event.rawRef === ref) },
    classifier,
    actor,
    director: async ({ currentRawRef }) => {
      observe(f, "director", personaId);
      return { propose: [{ id: `candidate-${personaId}`, kind: "core-conflict", text: `${personaId} conflict`, sourceRawRefs: [currentRawRef], proposedByPersona: personaId }] };
    },
    loadCurrentBranchHistory: async ({ personaId: target, sessionId }) => {
      f.loaderRequests.push({ personaId: target, sessionId, target: personaId });
      f.globalTrace.push({ seq: f.globalTrace.length, kind: "loader", type: "branch-history-loaded", personaId: target });
      return branchHistory(f.branches[target]);
    }
  };
  Object.defineProperty(deps, "__setMessageId", { value: (id) => {
    activeMessageId = id;
  } });
  return deps;
}
async function turn(f, personaId, raw, id, mode = "dilemma", feedbackKind = "none", feedback, selectedHistoricalRawRefs) {
  const deps = makeDeps(f, personaId, mode, feedbackKind);
  deps.__setMessageId(`message-${id}`);
  return runDialogueTurn({ raw, taskId: `task-${id}`, personaId, messageId: `message-${id}`, eventPurposePrefix: `turn-${id}`, ...feedback ? { feedback } : {}, ...selectedHistoricalRawRefs ? { selectedHistoricalRawRefs } : {} }, deps);
}
function reportScenario(f, name, result) {
  const lines = readFileSync3(f.trunk.filePath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const calls = { classifier: 0, director: 0, actor: 0, retrieval: 0 };
  for (const request of f.providerRequests) calls[request.kind]++;
  const contexts = Object.fromEntries(FIXTURE_PERSONA_IDS.map((persona) => [persona, f.actorContexts.filter((x) => x.personaId === persona)]));
  const histories = Object.fromEntries(FIXTURE_PERSONA_IDS.map((persona) => [persona, branchHistory(f.branches[persona])]));
  const branchTypes = FIXTURE_PERSONA_IDS.flatMap((persona) => f.branches[persona].events.map((event) => event.type));
  return { name, status: name === "urgent" || result.status !== "ok" ? "blocked" : "passed", providerRequests: [...f.providerRequests], actorResults: f.actorResults.map((a) => ({ ...a, messageId: `${name}:${a.messageId}` })), calls, eventTypes: [...lines.map((line) => line.type), ...branchTypes], eventSeqs: lines.map((line) => line.seq), candidateStatuses: f.trunk.state.dilemmaItems.map((item) => item.status), revisionLineage: f.trunk.state.dilemmaItems.map((item) => ({ id: item.id, text: item.text, status: item.status, visibility: item.visibility, ...item.supersedes ? { supersedes: item.supersedes } : {}, ...item.supersededBy ? { supersededBy: item.supersededBy } : {} })), contexts, branchHistories: histories, globalTrace: [...f.globalTrace], loaderRequests: [...f.loaderRequests], urgentDownstreamCalls: name === "urgent" ? f.providerRequests.length : 0, ...result.error?.code ? { error: result.error.code } : {}, ...result.restart ? { restart: result.restart } : {} };
}
async function scenario(name) {
  const root = mkdtempSync(join3(tmpdir(), `dialogue-${name}-`));
  const f = createDialogueFixture(root, `conversation-${name}`);
  try {
    let result;
    if (name === "urgent") result = await turn(f, "alpha", "\u6211\u60F3\u81EA\u6740", "urgent");
    else if (name === "knowledge") result = await turn(f, "alpha", "knowledge question", "knowledge", "knowledge");
    else if (name === "dilemma") result = await turn(f, "alpha", "dilemma question", "dilemma");
    else if (name === "partial-confirm" || name === "correct" || name === "skip") {
      await turn(f, "alpha", `${name} first`, "first");
      const item = f.trunk.state.dilemmaItems[0];
      const kind = name === "skip" ? "skip" : name;
      const replacement = name === "skip" ? void 0 : { ...item, id: `${item.id}-r2`, status: "confirmed", visibility: "shared-confirmed", revision: 2, text: `${name} revised`, supersedes: item.id };
      result = await turn(f, "alpha", `${name} feedback`, "feedback", "dilemma", kind, { kind, itemId: item.id, ...replacement ? { replacement } : {} });
    } else if (name === "review-reality-changed") result = await turn(f, "alpha", "review reality changed", "review", "review", "reality-changed");
    else if (name === "switch-isolation") {
      await turn(f, "alpha", "alpha branch", "switch-a");
      const alphaRaw = f.trunk.state.userRaws[0].rawRef;
      const alphaItem = f.trunk.state.dilemmaItems[0];
      await turn(f, "alpha", "confirm alpha", "switch-confirm", "dilemma", "confirm", { kind: "confirm", itemId: alphaItem.id, replacement: { ...alphaItem, revision: alphaItem.revision + 1, status: "confirmed", visibility: "shared-confirmed", supersedes: alphaItem.id, id: `${alphaItem.id}-confirmed` } });
      f.trunk.setActivePersona("beta");
      await turn(f, "beta", "beta branch", "switch-b", "dilemma", "none", void 0, [alphaRaw]);
      f.trunk.setActivePersona("gamma");
      result = await turn(f, "gamma", "gamma branch", "switch-c", "dilemma", "none", void 0, [alphaRaw]);
    } else {
      const deps = makeDeps(f, "alpha", "dilemma", "none");
      const input = { raw: "restart candidate", taskId: "task-restart", personaId: "alpha", messageId: "message-restart", eventPurposePrefix: "turn-restart" };
      deps.__setMessageId(input.messageId);
      const original = f.trunk.updateBranchProgress.bind(f.trunk);
      let failOnce = true;
      f.trunk.updateBranchProgress = (...args) => {
        if (failOnce) {
          failOnce = false;
          throw new Error("progress unavailable");
        }
        return original(...args);
      };
      const first = await runDialogueTurn(input, deps);
      const before = readFileSync3(f.trunk.filePath);
      const count = (kind) => f.providerRequests.filter((request) => request.kind === kind).length;
      const eventCount = (type) => readFileSync3(f.trunk.filePath, "utf8").split(/\r?\n/).filter(Boolean).filter((line) => JSON.parse(line).type === type).length;
      const beforeCounts = { actor: count("actor"), classifier: count("classifier"), director: count("director"), raw: f.trunk.state.userRaws.length, answer: f.answers.size, branch: f.branches.alpha.events.length, progress: eventCount("trunk/branch-progress-updated") };
      const loaded = (await Promise.resolve().then(() => (init_trunk_storage(), trunk_storage_exports))).TrunkStorage.load(f.trunk.state.conversationId, f.root, f.registry);
      const loadBytes = readFileSync3(f.trunk.filePath);
      f.trunk = loaded;
      const resumed = makeDeps(f, "alpha", "dilemma", "none");
      resumed.__setMessageId(input.messageId);
      const second = await runDialogueTurn(input, resumed);
      const after = readFileSync3(f.trunk.filePath);
      const afterCounts = { actor: count("actor"), classifier: count("classifier"), director: count("director"), raw: f.trunk.state.userRaws.length, answer: f.answers.size, branch: f.branches.alpha.events.length, progress: eventCount("trunk/branch-progress-updated") };
      result = { ...second, restart: { before: { actor: beforeCounts.actor, classifier: beforeCounts.classifier, director: beforeCounts.director, rawCount: beforeCounts.raw, answerCount: beforeCounts.answer, branchCount: beforeCounts.branch, progressCount: beforeCounts.progress, bytesHash: sha(before) }, after: { actor: afterCounts.actor, classifier: afterCounts.classifier, director: afterCounts.director, rawCount: afterCounts.raw, answerCount: afterCounts.answer, branchCount: afterCounts.branch, progressCount: afterCounts.progress, bytesHash: sha(after) }, progressCompensated: first.status === "failed" && second.status === "ok", loadBytesUnchanged: before.equals(loadBytes), actorDelta: afterCounts.actor - beforeCounts.actor, classifierDelta: afterCounts.classifier - beforeCounts.classifier, directorDelta: afterCounts.director - beforeCounts.director, rawDelta: afterCounts.raw - beforeCounts.raw, answerDelta: afterCounts.answer - beforeCounts.answer, branchDelta: afterCounts.branch - beforeCounts.branch, progressDelta: afterCounts.progress - beforeCounts.progress, loadedHash: sha(loadBytes), finalHash: sha(after) } };
    }
    return reportScenario(f, name, result);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
async function runDialogueLoopE2E(options = {}) {
  const scenarios = [];
  for (const name of dialogueScenarioNames) scenarios.push(await scenario(name));
  const providerRequests = scenarios.flatMap((entry) => entry.providerRequests);
  const totalCalls = scenarios.reduce((sum, entry) => sum + Object.values(entry.calls).reduce((a, b) => a + b, 0), 0);
  const report = { schemaVersion: 3, providerNetworkUsed: providerRequests.some((request) => request.network), tokenCost: providerRequests.reduce((sum, request) => sum + request.usage.totalTokens, 0), providerRequests, scenarios, totalCalls, expectedPersonaIds: [...FIXTURE_PERSONA_IDS], passed: true };
  const validation = validateDialogueLoopReport(report, dialogueScenarioNames, FIXTURE_PERSONA_IDS);
  const finalReport = { ...report, passed: validation.ok };
  if (options.outputDir) {
    mkdirSync3(options.outputDir, { recursive: true });
    writeFileSync(join3(options.outputDir, "dialogue-loop-report.json"), JSON.stringify(finalReport, null, 2) + "\n");
  }
  return finalReport;
}
export {
  dialogueScenarioNames,
  runDialogueLoopE2E
};
//# sourceMappingURL=dialogue-loop-e2e.js.map
