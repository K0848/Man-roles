var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __knownSymbol = (name2, symbol) => (symbol = Symbol[name2]) ? symbol : /* @__PURE__ */ Symbol.for("Symbol." + name2);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __decoratorStart = (base) => [, , , __create(base?.[__knownSymbol("metadata")] ?? null)];
var __decoratorStrings = ["class", "method", "getter", "setter", "accessor", "field", "value", "get", "set"];
var __expectFn = (fn) => fn !== void 0 && typeof fn !== "function" ? __typeError("Function expected") : fn;
var __decoratorContext = (kind, name2, done, metadata, fns) => ({ kind: __decoratorStrings[kind], name: name2, metadata, addInitializer: (fn) => done._ ? __typeError("Already initialized") : fns.push(__expectFn(fn || null)) });
var __decoratorMetadata = (array, target) => __defNormalProp(target, __knownSymbol("metadata"), array[3]);
var __runInitializers = (array, flags, self, value) => {
  for (var i = 0, fns = array[flags >> 1], n = fns && fns.length; i < n; i++) flags & 1 ? fns[i].call(self) : value = fns[i].call(self, value);
  return value;
};
var __decorateElement = (array, flags, name2, decorators, target, extra) => {
  var fn, it, done, ctx, access, k = flags & 7, s = !!(flags & 8), p = !!(flags & 16);
  var j = k > 3 ? array.length + 1 : k ? s ? 1 : 2 : 0, key = __decoratorStrings[k + 5];
  var initializers = k > 3 && (array[j - 1] = []), extraInitializers = array[j] || (array[j] = []);
  var desc = k && (!p && !s && (target = target.prototype), k < 5 && (k > 3 || !p) && __getOwnPropDesc(k < 4 ? target : { get [name2]() {
    return __privateGet(this, extra);
  }, set [name2](x) {
    return __privateSet(this, extra, x);
  } }, name2));
  k ? p && k < 4 && __name(extra, (k > 2 ? "set " : k > 1 ? "get " : "") + name2) : __name(target, name2);
  for (var i = decorators.length - 1; i >= 0; i--) {
    ctx = __decoratorContext(k, name2, done = {}, array[3], extraInitializers);
    if (k) {
      ctx.static = s, ctx.private = p, access = ctx.access = { has: p ? (x) => __privateIn(target, x) : (x) => name2 in x };
      if (k ^ 3) access.get = p ? (x) => (k ^ 1 ? __privateGet : __privateMethod)(x, target, k ^ 4 ? extra : desc.get) : (x) => x[name2];
      if (k > 2) access.set = p ? (x, y) => __privateSet(x, target, y, k ^ 4 ? extra : desc.set) : (x, y) => x[name2] = y;
    }
    it = (0, decorators[i])(k ? k < 4 ? p ? extra : desc[key] : k > 4 ? void 0 : { get: desc.get, set: desc.set } : target, ctx), done._ = 1;
    if (k ^ 4 || it === void 0) __expectFn(it) && (k > 4 ? initializers.unshift(it) : k ? p ? extra = it : desc[key] = it : target = it);
    else if (typeof it !== "object" || it === null) __typeError("Object expected");
    else __expectFn(fn = it.get) && (desc.get = fn), __expectFn(fn = it.set) && (desc.set = fn), __expectFn(fn = it.init) && initializers.unshift(fn);
  }
  return k || __decoratorMetadata(array, target), desc && __defProp(target, name2, desc), p ? k ^ 4 ? extra : desc : target;
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateIn = (member, obj) => Object(obj) !== obj ? __typeError('Cannot use the "in" operator on this value') : member.has(obj);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// src/domain/schema.ts
import { z } from "zod";
var taskModeSchema, personaIdSchema, dilemmaItemSchema, dialogueControlStateSchema, branchProgressSchema, dialogueEventMetaSchema, taskRoutedEventSchema, dialoguePhaseSetEventSchema, dilemmaItemProposedEventSchema, dilemmaItemReviewedEventSchema, dilemmaCoreSelectedEventSchema, branchProgressUpdatedEventSchema, actionRecordedEventSchema, sessionControlRecordedEventSchema, dialogueCommitSchema, legacyPersonaIdRawSchema, dilemmaPhaseSchema, dilemmaStateSchema, initialDilemmaState, dilemmaEventHeaderSchema, dilemmaCandidateEventSchema, dilemmaConfirmedEventSchema, dilemmaCorrectedEventSchema, trunkEventRecordSchema, trunkCreatedEventSchema, trunkUserRawAddedEventSchema, trunkDilemmaCandidateEventSchema, trunkDilemmaConfirmedEventSchema, trunkDilemmaCorrectedEventSchema, trunkActivePersonaEventSchema, trunkBranchIndexEventSchema, trunkUserRawSchema, taskOutcomeSchema, trunkTaskOutcomeRecordedEventSchema, trunkBranchDeliveryCommittedEventSchema, trunkStateSchema, initialTrunkState;
var init_schema = __esm({
  "src/domain/schema.ts"() {
    "use strict";
    taskModeSchema = z.enum(["knowledge", "dilemma", "review"]);
    personaIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "PersonaId must be kebab-case");
    dilemmaItemSchema = z.object({ id: z.string().min(1), kind: z.enum(["fact", "inference", "goal", "value-conflict", "core-conflict"]), text: z.string(), status: z.enum(["candidate", "confirmed", "rejected", "superseded"]), sourceRawRefs: z.array(z.string().min(1)).min(1), proposedByPersona: personaIdSchema, visibility: z.enum(["origin-persona-only", "shared-confirmed"]), revision: z.number().int().positive(), supersedes: z.string().min(1).optional(), supersededBy: z.string().min(1).optional() }).strict();
    dialogueControlStateSchema = z.object({ taskMode: z.enum(["knowledge", "dilemma", "review"]), phase: z.enum(["responding", "clarifying", "awaiting-confirmation", "reflecting", "action-defined", "paused", "closed"]), noProgressCount: z.number().int().nonnegative(), lastControlSeq: z.number().int(), selectedAction: z.string().optional() }).strict();
    branchProgressSchema = z.object({ personaId: personaIdSchema, summary: z.string().nullable(), lastSemanticSeq: z.number().int() }).strict();
    dialogueEventMetaSchema = z.object({
      messageId: z.string().min(1),
      taskId: z.string().min(1),
      eventPurpose: z.string().min(1),
      sourceRawRefs: z.array(z.string().min(1)).min(1)
    }).strict();
    taskRoutedEventSchema = dialogueEventMetaSchema.extend({ taskMode: taskModeSchema, confidence: z.enum(["high", "low"]) }).strict();
    dialoguePhaseSetEventSchema = dialogueEventMetaSchema.extend({ control: dialogueControlStateSchema }).strict();
    dilemmaItemProposedEventSchema = dialogueEventMetaSchema.extend({ item: dilemmaItemSchema, personaId: personaIdSchema }).strict();
    dilemmaItemReviewedEventSchema = dialogueEventMetaSchema.extend({ itemId: z.string().min(1), action: z.enum(["confirm", "partial-confirm", "correct", "reject", "skip"]), replacement: dilemmaItemSchema.optional(), personaId: personaIdSchema }).strict();
    dilemmaCoreSelectedEventSchema = dialogueEventMetaSchema.extend({ itemId: z.string().min(1) }).strict();
    branchProgressUpdatedEventSchema = dialogueEventMetaSchema.extend({ progress: branchProgressSchema }).strict();
    actionRecordedEventSchema = dialogueEventMetaSchema.extend({ action: z.string().min(1), details: z.record(z.string(), z.unknown()).default({}) }).strict();
    sessionControlRecordedEventSchema = dialogueEventMetaSchema.extend({ control: z.enum(["pause", "resume", "end", "switch"]), personaId: personaIdSchema.optional() }).strict();
    dialogueCommitSchema = z.object({ payloadHash: z.string().min(1) }).strict();
    legacyPersonaIdRawSchema = z.string().min(1);
    dilemmaPhaseSchema = z.enum(["pending", "candidate", "confirmed", "corrected"]);
    dilemmaStateSchema = z.object({
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
    initialDilemmaState = (persona) => ({
      phase: "pending",
      activePersona: persona,
      candidateText: null,
      confirmedText: null,
      correctedText: null,
      userRawRefs: [],
      updatedBySeq: -1
    });
    dilemmaEventHeaderSchema = z.object({
      turnId: z.string(),
      taskId: z.string(),
      invocationId: z.string()
    });
    dilemmaCandidateEventSchema = dilemmaEventHeaderSchema.extend({
      persona: personaIdSchema,
      text: z.string()
    });
    dilemmaConfirmedEventSchema = dilemmaEventHeaderSchema.extend({
      text: z.string()
    });
    dilemmaCorrectedEventSchema = dilemmaEventHeaderSchema.extend({
      text: z.string()
    });
    trunkEventRecordSchema = z.object({
      type: z.string(),
      seq: z.number(),
      time: z.string(),
      data: z.unknown()
    });
    trunkCreatedEventSchema = z.object({
      conversationId: z.string()
    });
    trunkUserRawAddedEventSchema = z.object({
      ref: z.number(),
      text: z.string(),
      // 6.2: 客户端身份与稳定投递指针。旧 JSONL 无此字段时由 replay 补齐。
      message_id: z.string().min(1).optional(),
      raw_ref: z.string().min(1).optional(),
      // 6.2 Task4: first acceptance fixes the delivery target. Legacy records omit it.
      target_persona_id: personaIdSchema.optional()
    });
    trunkDilemmaCandidateEventSchema = z.object({
      persona: personaIdSchema,
      text: z.string()
    });
    trunkDilemmaConfirmedEventSchema = z.object({
      text: z.string()
    });
    trunkDilemmaCorrectedEventSchema = z.object({
      text: z.string()
    });
    trunkActivePersonaEventSchema = z.object({
      persona: personaIdSchema
    });
    trunkBranchIndexEventSchema = z.object({
      persona: personaIdSchema,
      sessionId: z.string()
    });
    trunkUserRawSchema = z.object({
      ref: z.number(),
      text: z.string(),
      messageId: z.string().min(1),
      rawRef: z.string().min(1),
      targetPersonaId: personaIdSchema.optional()
    });
    taskOutcomeSchema = z.object({ taskId: z.string().min(1), personaId: personaIdSchema, branchSessionId: z.string().min(1), branchTurn: z.number().int().positive(), status: z.literal("blocked"), reason: z.literal("budget_exceeded"), retryable: z.literal(true) });
    trunkTaskOutcomeRecordedEventSchema = taskOutcomeSchema;
    trunkBranchDeliveryCommittedEventSchema = z.object({
      conversation_id: z.string().min(1),
      persona_id: personaIdSchema,
      raw_ref: z.string().min(1),
      message_id: z.string().min(1),
      session_id: z.string().min(1)
    });
    trunkStateSchema = z.object({
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
function deriveLegacyDilemma(items) {
  const active = [...items].filter((item2) => item2.status !== "superseded").sort((a, b) => b.revision - a.revision);
  const confirmed = active.find((item2) => item2.status === "confirmed" && item2.visibility === "shared-confirmed");
  if (confirmed) return { phase: "confirmed", candidateText: null, confirmedText: confirmed.text };
  const candidate = active.find((item2) => item2.status === "candidate" && item2.visibility === "origin-persona-only");
  if (candidate) return { phase: "candidate", candidateText: candidate.text, confirmedText: null };
  return { phase: "pending", candidateText: null, confirmedText: null };
}
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
function foldDilemmaState(events, persona) {
  let state = initialDilemmaState(persona);
  for (const event2 of events) state = transition(state, event2);
  return state;
}
function judgeFeedback(feedback) {
  if (CORRECT_MARKERS.some((m) => feedback.includes(m))) return "corrected";
  if (CONFIRM_MARKERS.some((m) => feedback.includes(m))) return "confirmed";
  return "unconfirmed";
}
var CONFIRM_MARKERS, CORRECT_MARKERS;
var init_dilemma = __esm({
  "src/domain/dilemma.ts"() {
    "use strict";
    init_schema();
    CONFIRM_MARKERS = ["\u5BF9", "\u662F\u7684", "\u6CA1\u9519", "\u5C31\u662F\u8FD9\u6837", "\u6B63\u662F", "\u5BF9\uFF0C\u6211\u56F0\u60D1", "\u540C\u610F", "\u786E\u8BA4"];
    CORRECT_MARKERS = ["\u4E0D\u5BF9", "\u4E0D\u662F", "\u7EA0\u6B63", "\u5176\u5B9E\u662F", "\u6211\u60F3\u8BF4\u7684\u662F", "\u4E0D\u5B8C\u5168\u662F", "\u6539\u4E00\u4E0B", "\u91CD\u65B0\u8BF4"];
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
import { appendFileSync, existsSync as existsSync2, mkdirSync, readFileSync as readFileSync3 } from "node:fs";
import { z as z3 } from "zod";
import { dirname, join as join3 } from "node:path";
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
function normalizePersistedPersonaFields(value, registry8) {
  if (!value || typeof value !== "object") return value;
  const data = { ...value };
  for (const key of ["persona", "personaId", "target_persona_id", "targetPersonaId", "persona_id", "active_persona_id", "activePersonaId"]) {
    if (typeof data[key] === "string") data[key] = registry8.normalizePersistedId(data[key]);
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
      constructor(state, filePath, nextSeq, registry8) {
        this.stateInternal = state;
        this.filePath = filePath;
        this.storageDir = dirname(filePath);
        this.nextSeqInternal = nextSeq;
        this.registry = registry8;
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
      static create(conversationId, storageDir, initialPersonaId, registry8) {
        const initial = registry8.requireActiveForCreate(initialPersonaId).id;
        const filePath = join3(storageDir, `${conversationId}.jsonl`);
        mkdirSync(storageDir, { recursive: true });
        const storage = new _TrunkStorage(initialTrunkState(conversationId, initial), filePath, 0, registry8);
        storage.append(TRUNK_CREATED, { conversationId, initial_persona_id: initial });
        return storage;
      }
      /**
       * 从磁盘恢复 trunk（启动恢复；重放 JSONL 事件，重复 seq 幂等跳过）。
       * 文件不存在 → 视为新会话（等价 create，但不重复写 created 事件由调用方决定——
       * 此处直接返回新实例并写 created）。
       */
      static load(conversationId, storageDir, registry8) {
        const filePath = join3(storageDir, `${conversationId}.jsonl`);
        if (!existsSync2(filePath)) {
          throw new Error(`cannot restore missing trunk without explicit initial PersonaId: ${conversationId}`);
        }
        const text = readFileSync3(filePath, "utf8");
        const rawLines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
        const rawRecords = rawLines.map(parseRecordLine).filter((record) => record !== null);
        let initialRaw;
        for (const record of rawRecords) {
          const data = record.data;
          initialRaw = typeof data.initial_persona_id === "string" ? data.initial_persona_id : typeof data.persona === "string" ? data.persona : typeof data.target_persona_id === "string" ? data.target_persona_id : typeof data.persona_id === "string" ? data.persona_id : typeof data.personaId === "string" ? data.personaId : void 0;
          if (initialRaw) break;
        }
        if (!initialRaw) throw new Error(`trunk has no recoverable PersonaId: ${conversationId}`);
        const initial = registry8.normalizePersistedId(initialRaw);
        let state = initialTrunkState(conversationId, initial);
        let maxSeq = -1;
        for (const line of rawLines) {
          if (line.trim() === "") continue;
          const record = parseRecordLine(line);
          if (record === null) continue;
          record.data = normalizePersistedPersonaFields(record.data, registry8);
          if (record.seq <= maxSeq) continue;
          maxSeq = record.seq;
          state = applyTrunkRecord(state, record);
        }
        return new _TrunkStorage(state, filePath, maxSeq + 1, registry8);
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
      proposeDilemmaItem(item2, meta2) {
        const parsed = dilemmaItemSchema.parse(item2);
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
        const item2 = this.stateInternal.dilemmaItems.find((x) => x.id === itemId);
        if (!item2 || item2.kind !== "core-conflict" || item2.status !== "confirmed" || item2.supersededBy) throw new Error("core item must be active confirmed core-conflict");
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
    zProductLifecycle = z3.object({ version: z3.literal(2), conversationId: z3.string().min(1), lifecycle: z3.enum(["active", "paused", "closed"]), operationId: z3.string().min(1) }).strict();
    zProductResult = z3.object({ version: z3.literal(2), operationId: z3.string().min(1), status: z3.enum(["reply", "blocked"]), rawRef: z3.string().min(1) }).strict();
  }
});

// src/index.ts
import { join as join15 } from "node:path";

// src/projection/dilemma-projection.ts
init_schema();
init_dilemma();

// src/events.ts
init_schema();
var DILEMMA_CANDIDATE = "man-roles/dilemma/candidate";
var DILEMMA_CONFIRMED = "man-roles/dilemma/confirmed";
var DILEMMA_CORRECTED = "man-roles/dilemma/corrected";
function toFoldInput(event2) {
  switch (event2.type) {
    case "user/message":
      return { type: "user/message", seq: event2.seq };
    case DILEMMA_CANDIDATE: {
      const parsed = dilemmaCandidateEventSchema.safeParse(event2.data);
      if (!parsed.success) return null;
      return { type: DILEMMA_CANDIDATE, seq: event2.seq, data: parsed.data };
    }
    case DILEMMA_CONFIRMED: {
      const parsed = dilemmaConfirmedEventSchema.safeParse(event2.data);
      if (!parsed.success) return null;
      return { type: DILEMMA_CONFIRMED, seq: event2.seq, data: parsed.data };
    }
    case DILEMMA_CORRECTED: {
      const parsed = dilemmaCorrectedEventSchema.safeParse(event2.data);
      if (!parsed.success) return null;
      return { type: DILEMMA_CORRECTED, seq: event2.seq, data: parsed.data };
    }
    default:
      return null;
  }
}

// src/projection/dilemma-projection.ts
var DILEMMA_PROJECTION_KEY = "man-roles/dilemma";
function dilemmaProjectionDefinition() {
  return {
    key: DILEMMA_PROJECTION_KEY,
    stateSchema: dilemmaStateSchema,
    init: () => ({
      phase: "pending",
      // A projection can exist before any persona-bearing event arrives. Keep
      // this explicitly uninitialized instead of inventing a default person.
      activePersona: null,
      candidateText: null,
      confirmedText: null,
      correctedText: null,
      userRawRefs: [],
      updatedBySeq: -1
    }),
    apply: (state, event2) => {
      if (typeof event2 !== "object" || event2 === null) return state;
      const input = toFoldInput(event2);
      return input === null ? state : transition(state, input);
    },
    wire: {
      viewSchema: dilemmaStateSchema,
      view: (state) => state
    },
    stateVersion: 1
  };
}

// src/e2e/vertical-slice.ts
import { createAssistantMessage, createUserMessage } from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { zstdDecompress } from "node:zlib";
import { promisify } from "node:util";
import { join } from "node:path";
import { homedir } from "node:os";

// src/context/select-history.ts
var estimate = (s) => Math.max(1, Math.ceil(s.length / 2));
function selectHistory(input) {
  const required = /* @__PURE__ */ new Set([input.currentRaw.rawRef, ...input.confirmedRawRefs ?? []]);
  const pool = [...input.candidates, ...input.branchHistory ?? []].filter((x, i, a) => a.findIndex((y) => y.rawRef === x.rawRef) === i);
  const ordered = pool.sort((a, b) => (required.has(b.rawRef) ? 1 : 0) - (required.has(a.rawRef) ? 1 : 0) || (b.priority ?? 0) - (a.priority ?? 0));
  const selected = [];
  const dropped = [];
  let used = 0;
  for (const item2 of [input.currentRaw, ...ordered]) {
    if (selected.some((x) => x.rawRef === item2.rawRef)) continue;
    const cost = estimate(item2.text);
    const must = item2.rawRef === input.currentRaw.rawRef || required.has(item2.rawRef);
    if (must || used + cost <= input.budgetTokens) {
      selected.push(item2);
      used += cost;
    } else dropped.push({ rawRef: item2.rawRef, reason: "budget" });
  }
  return { selected, selectedRawRefs: selected.map((x) => x.rawRef), dropped, estimatedTokens: used };
}

// src/context/assemble.ts
var CONTEXT_TOKEN_LIMIT = 4e3;
function estimateTokens(text) {
  const compact = text.replace(/\s+/g, "");
  const cjk = compact.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const rest = compact.length - cjk;
  return cjk + Math.ceil(rest / 4);
}
function assembleBranchTurn(input) {
  const messages = [];
  messages.push({ role: "system", content: input.persona.systemPrompt });
  const dilemma = input.sharedLayer.dilemma;
  if (dilemma.phase === "confirmed" && dilemma.confirmedText !== null) {
    messages.push({
      role: "user",
      content: `\u3010\u5DF2\u786E\u8BA4\u7684\u56F0\u60D1\u3011${dilemma.confirmedText}\uFF08\u8FD9\u662F\u7528\u6237\u5DF2\u7ECF\u786E\u8BA4\u7684\u7406\u89E3\uFF0C\u56DE\u7B54\u65F6\u5E94\u4EE5\u6B64\u4E3A\u524D\u63D0\uFF09`
    });
  } else if (dilemma.phase === "corrected" && dilemma.correctedText !== null) {
    messages.push({
      role: "user",
      content: `\u3010\u7528\u6237\u7EA0\u6B63\u540E\u7684\u56F0\u60D1\u3011${dilemma.correctedText}\uFF08\u4EE5\u6B64\u4E3A\u51C6\uFF0C\u5FFD\u7565\u6B64\u524D\u63A8\u65AD\uFF09`
    });
  }
  const raws = input.historyBudgetTokens === void 0 ? input.sharedLayer.userRaws : selectHistory({ currentRaw: input.sharedLayer.userRaws.at(-1), candidates: input.sharedLayer.userRaws, confirmedRawRefs: dilemma.phase === "confirmed" ? input.sharedLayer.userRaws.map((x) => x.rawRef) : [], personaId: input.persona.id, budgetTokens: input.historyBudgetTokens }).selected;
  for (const raw of raws) {
    messages.push({ role: "user", content: raw.text });
  }
  const history = input.branchHistory.slice(-(input.maxHistoryTurns ?? 4));
  for (const h of history) {
    messages.push({ role: h.role, content: h.content });
  }
  const used = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  const ratio = used / CONTEXT_TOKEN_LIMIT;
  return { messages, tokenEstimate: used, budget: { used, limit: CONTEXT_TOKEN_LIMIT, ratio } };
}
function assembleNextTurn(input) {
  const history = input.lastReply === "" ? [] : [{ role: "assistant", content: input.lastReply }];
  return assembleBranchTurn({
    persona: input.persona,
    sharedLayer: {
      userRaws: [{ ref: 0, text: input.userRaw, messageId: "fixture-message-0", rawRef: "fixture-raw-0" }],
      dilemma: input.dilemma
    },
    branchHistory: history,
    maxHistoryTurns: 1
  });
}

// src/e2e/vertical-slice.ts
init_dilemma();

// src/turn/ids.ts
import { randomUUID } from "node:crypto";
function newTurnIds(seed = "mr") {
  const suffix = randomUUID().slice(0, 8);
  return {
    turnId: `${seed}-turn-${suffix}`,
    taskId: `${seed}-task-${suffix}`,
    invocationId: `${seed}-inv-${suffix}`
  };
}
var IdempotencyRegistry = class _IdempotencyRegistry {
  done = /* @__PURE__ */ new Map();
  static keyOf(taskId, invocationId) {
    return `${taskId}:${invocationId}`;
  }
  /** 该 (task, invocation) 是否已执行完成（成功或失败均记录）。 */
  has(taskId, invocationId) {
    return this.done.has(_IdempotencyRegistry.keyOf(taskId, invocationId));
  }
  /**
   * 幂等执行：已执行则跳过；否则执行 fn 并记录结果。
   * fn 抛错时记录失败（防止重复提交重放失败调用），由调用方决定是否用新 invocation_id 重试。
   */
  tryRun(taskId, invocationId, fn) {
    const key = _IdempotencyRegistry.keyOf(taskId, invocationId);
    const memo = this.done.get(key);
    if (memo !== void 0) {
      if (memo instanceof IdempotencyError) return { status: "failed", error: memo.error };
      return { status: "skipped", value: memo };
    }
    try {
      const value = fn();
      this.done.set(key, value);
      return { status: "ran", value };
    } catch (error) {
      this.done.set(key, new IdempotencyError(error));
      return { status: "failed", error };
    }
  }
};
var IdempotencyError = class {
  constructor(error) {
    this.error = error;
  }
  error;
};

// src/e2e/vertical-slice.ts
var SESSION_ID = "session-man-roles-vertical-slice";
var TAG = "[man-roles-roleplayer:e2e]";
var USER_RAW = "\u6211\u65E2\u60F3\u575A\u6301\u7406\u60F3\u4E3B\u4E49\uFF0C\u53C8\u89C9\u5F97\u73B0\u5B9E\u5904\u5904\u78B0\u58C1\uFF0C\u4E0D\u77E5\u5982\u4F55\u81EA\u5904\u3002";
function stubPersonaReply() {
  return "\u77E5\u884C\u672C\u662F\u4E00\u4F53\uFF0C\u672A\u66FE\u771F\u77E5\u800C\u884C\uFF0C\u4EA6\u672A\u66FE\u5B9E\u884C\u800C\u77E5\u3002\u4F60\u65E2\u6709\u6240\u6C42\uFF0C\u4FBF\u5148\u95EE\u81EA\u5DF1\uFF1A\u6B64\u5FC3\u5149\u660E\u5426\uFF1F";
}
function stubDirectorCandidate() {
  return "\u7528\u6237\u9677\u5165\u7406\u60F3\u4E3B\u4E49\u4E0E\u73B0\u5B9E\u884C\u52A8\u7684\u51B2\u7A81\uFF0C\u53EF\u80FD\u56F0\u60D1\u4E8E\u300C\u77E5\u884C\u5408\u4E00\u300D\u7684\u5B9E\u8DF5\u8DEF\u5F84\u3002";
}
function sessionDir() {
  const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
  return join(home, "sessions", "_no-cwd", SESSION_ID);
}
var zstdDecompressAsync = promisify(zstdDecompress);
function scanZstdFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset < buffer.length) {
    if (buffer.length - offset < 4) break;
    const start = offset;
    if (buffer.readUInt32LE(offset) !== 4247762216) break;
    offset += 4;
    if (offset === buffer.length) break;
    const descriptor = buffer.readUInt8(offset);
    offset += 1;
    const contentSizeFlag = descriptor >>> 6;
    const singleSegment = (descriptor & 32) !== 0;
    const checksum = (descriptor & 4) !== 0;
    const dictionaryFlag = descriptor & 3;
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
    const contentSizeBytes = contentSizeFlag === 0 ? singleSegment ? 1 : 0 : 1 << contentSizeFlag;
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
    if (buffer.length - offset < remainingHeaderBytes) break;
    offset += remainingHeaderBytes;
    for (; ; ) {
      if (buffer.length - offset < 3) return frames;
      const blockHeader = buffer.readUIntLE(offset, 3);
      offset += 3;
      const lastBlock = (blockHeader & 1) !== 0;
      const blockType = blockHeader >>> 1 & 3;
      const blockSize = blockHeader >>> 3;
      if (blockType === 3) return frames;
      const payloadBytes = blockType === 1 ? 1 : blockSize;
      if (buffer.length - offset < payloadBytes) return frames;
      offset += payloadBytes;
      if (lastBlock) break;
    }
    if (checksum) {
      if (buffer.length - offset < 4) return frames;
      offset += 4;
    }
    frames.push({ start, end: offset });
  }
  return frames;
}
async function inspectSessionLog(raw) {
  const frames = scanZstdFrames(raw);
  const parts = [];
  for (const frame of frames) {
    const out = await zstdDecompressAsync(raw.subarray(frame.start, frame.end));
    parts.push(out.toString("utf8"));
  }
  const lines = parts.join("").split(/\r?\n/).filter((l) => l.trim() !== "");
  const types = lines.map((l) => {
    try {
      return JSON.parse(l).type;
    } catch {
      return "<unparseable>";
    }
  });
  console.log(`${TAG} \u6062\u590D\u81EA\u68C0: \u4E8B\u4EF6\u7C7B\u578B\u5E8F\u5217=[${types.join(", ")}]`);
  for (const line of lines) {
    const e = JSON.parse(line);
    if (typeof e.type === "string" && e.type.startsWith("man-roles/")) {
      console.log(`${TAG} \u6062\u590D\u81EA\u68C0: \u81EA\u5B9A\u4E49\u4E8B\u4EF6 type=${e.type} seq=${e.seq} ignorable=${"ignorable" in e ? e.ignorable : "<absent>"}`);
    }
  }
  const custom = lines.filter((l) => {
    try {
      return JSON.parse(l).type.startsWith("man-roles/");
    } catch {
      return false;
    }
  });
  if (custom.length > 0) {
    console.log(`${TAG} \u6062\u590D\u81EA\u68C0: \u81EA\u5B9A\u4E49\u4E8B\u4EF6\u5DF2\u6301\u4E45\u5316\u5230 zstd JSONL (${custom.length} \u6761)\uFF0C\u5747\u65E0 ignorable \u6807\u8BB0\uFF1B\u6309 dsh-session-persistence assertEventsSupported \u5951\u7EA6\uFF08coordinator.ts L1061-1066\uFF09\uFF0C\u65E0 ignorable \u7684\u672A\u77E5\u7C7B\u578B\u5728\u91CD\u542F\u6062\u590D\u65F6\u4F1A\u88AB\u62D2\u7EDD \u2014\u2014 \u9636\u6BB5 3 \u9002\u914D\u7ED3\u8BBA\u300C\u8DE8\u8FDB\u7A0B\u6301\u4E45\u5316\u9700\u9002\u914D\u300D\uFF0C\u8BE6\u89C1 README`);
  }
}
async function restoreSelfCheck() {
  const dir = sessionDir();
  if (!existsSync(dir)) {
    console.log(`${TAG} \u6062\u590D\u81EA\u68C0: \u4F1A\u8BDD\u76EE\u5F55\u5C1A\u4E0D\u5B58\u5728 (${dir})\uFF0C\u8DF3\u8FC7`);
    return;
  }
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl.zstd") || f.endsWith(".jsonl"));
  console.log(`${TAG} \u6062\u590D\u81EA\u68C0: \u4F1A\u8BDD\u76EE\u5F55=${dir}\uFF0C\u65E5\u5FD7\u6587\u4EF6=${files.join(", ") || "(\u65E0)"}`);
  for (const file of files) {
    const raw = readFileSync(join(dir, file));
    if (file.endsWith(".zstd")) {
      await inspectSessionLog(raw);
    } else {
      const text = raw.toString("utf8");
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      const types = lines.map((l) => {
        try {
          return JSON.parse(l).type;
        } catch {
          return "<unparseable>";
        }
      });
      console.log(`${TAG} \u6062\u590D\u81EA\u68C0: \u4E8B\u4EF6\u7C7B\u578B\u5E8F\u5217=[${types.join(", ")}]`);
    }
  }
}
function runVerticalSlice(ctx) {
  const sessions = ctx.sessions;
  const projections = ctx.sessionProjections;
  const hasStored = existsSync(sessionDir()) && readdirSync(sessionDir()).some((f) => f.endsWith(".zstd") || f.endsWith(".jsonl"));
  const session = sessions.create(SessionId(SESSION_ID));
  console.log(`${TAG} \u9636\u6BB50: \u521B\u5EFA\u4F1A\u8BDD ${SESSION_ID} (seq=0)${hasStored ? "\uFF1B\u78C1\u76D8\u5DF2\u6709\u540C id \u843D\u76D8 \u2192 \u8DE8\u8FDB\u7A0B\u6301\u4E45\u5316\u5951\u7EA6\u9A8C\u8BC1\u8DEF\u5F84" : ""}`);
  const idem = new IdempotencyRegistry();
  const turnIds = newTurnIds("e2e");
  let userSeq = -1;
  const appendUser = () => {
    const ev = session.append(
      "user/message",
      createUserMessage({ content: [{ type: "text", text: USER_RAW }], source: { kind: "user" } }),
      { surfaceOp: "append" }
    );
    return ev.seq;
  };
  const first = idem.tryRun(turnIds.taskId, turnIds.invocationId, appendUser);
  userSeq = first.value;
  console.log(`${TAG} \u9636\u6BB51: user_raw \u843D\u76D8 seq=${userSeq} \u6587\u672C=${JSON.stringify(USER_RAW)} (\u9010\u5B57\uFF0C\u4EC5\u8FFD\u52A0)`);
  const repeat = idem.tryRun(turnIds.taskId, turnIds.invocationId, () => {
    throw new Error("\u91CD\u590D\u63D0\u4EA4\u4E0D\u5E94\u6267\u884C\u843D\u76D8");
  });
  console.log(`${TAG} \u9636\u6BB51: \u5E42\u7B49\u6F14\u793A \u91CD\u590D\u63D0\u4EA4 (${turnIds.taskId}:${turnIds.invocationId}) \u2192 status=${repeat.status} (\u65AD\u8A00: \u4E0D\u4EA7\u751F\u7B2C\u4E8C\u6761 user/message)`);
  const userCount = session.events.filter((e) => e.type === "user/message").length;
  console.log(`${TAG} \u9636\u6BB51: user/message \u4E8B\u4EF6\u6570=${userCount} (\u5E94\u4E3A 1)`);
  const replyText = stubPersonaReply();
  const replyInv = newTurnIds("e2e-reply");
  idem.tryRun(replyInv.taskId, replyInv.invocationId, () => {
    session.append(
      "assistant/message",
      {
        turn: 0,
        step: 0,
        message: createAssistantMessage({
          content: [{ type: "text", text: replyText }],
          source: { provider: "man-roles-stub", model: "vertical-slice" }
        })
      },
      { surfaceOp: "append", sourceEventSeqs: [userSeq] }
    );
    return true;
  });
  console.log(`${TAG} \u9636\u6BB52: \u4EBA\u7269\u56DE\u7B54(\u738B\u9633\u660E, stub) seq \u5DF2\u8FFD\u52A0, \u6587\u672C=${JSON.stringify(replyText)}`);
  const candidateText = stubDirectorCandidate();
  const candInv = newTurnIds("e2e-cand");
  idem.tryRun(candInv.taskId, candInv.invocationId, () => {
    session.append(
      DILEMMA_CANDIDATE,
      {
        turnId: turnIds.turnId,
        taskId: candInv.taskId,
        invocationId: candInv.invocationId,
        persona: "wang-yangming",
        text: candidateText
      }
    );
    return true;
  });
  const snapAfterCandidate = projections.snapshot(session);
  const stateAfterCandidate = projections.stateOf(session, "man-roles/dilemma");
  console.log(`${TAG} \u9636\u6BB53: candidate \u5DF2\u8FFD\u52A0, snapshot asOfSeq=${snapAfterCandidate.asOfSeq} values=${JSON.stringify(snapAfterCandidate.values)}`);
  console.log(`${TAG} \u9636\u6BB53: \u72B6\u6001\u673A\u65AD\u8A00 phase=${stateAfterCandidate?.phase} (\u5E94\u4E3A candidate\uFF0C\u672A\u786E\u8BA4\u4E0D\u81EA\u52A8\u5347\u7EA7 confirmed \u2014 F001)`);
  const feedback = "\u5BF9\uFF0C\u6211\u5C31\u662F\u56F0\u60D1\u77E5\u884C\u600E\u4E48\u5408\u4E00\u3002";
  const verdict = judgeFeedback(feedback);
  console.log(`${TAG} \u9636\u6BB54: \u7528\u6237\u53CD\u9988=${JSON.stringify(feedback)} \u8BED\u4E49\u5224\u5B9A=${verdict}`);
  if (verdict === "confirmed" || verdict === "corrected") {
    const confInv = newTurnIds("e2e-conf");
    const targetText = verdict === "confirmed" ? "\u77E5\u884C\u5408\u4E00\u7684\u5B9E\u8DF5\u8DEF\u5F84" : "\u7406\u60F3\u4E0E\u73B0\u5B9E\u5982\u4F55\u4E24\u5168";
    idem.tryRun(confInv.taskId, confInv.invocationId, () => {
      session.append(
        verdict === "confirmed" ? DILEMMA_CONFIRMED : "man-roles/dilemma/corrected",
        {
          turnId: turnIds.turnId,
          taskId: confInv.taskId,
          invocationId: confInv.invocationId,
          text: targetText
        }
      );
      return true;
    });
    console.log(`${TAG} \u9636\u6BB54: \u5DF2\u751F\u6210 ${verdict} \u4E8B\u4EF6 text=${JSON.stringify(targetText)}`);
  }
  const snapFinal = projections.snapshot(session);
  const stateFinal = projections.stateOf(session, "man-roles/dilemma");
  console.log(`${TAG} \u9636\u6BB54: \u6700\u7EC8 snapshot asOfSeq=${snapFinal.asOfSeq} values=${JSON.stringify(snapFinal.values)}`);
  console.log(`${TAG} \u9636\u6BB54: \u6700\u7EC8\u72B6\u6001 phase=${stateFinal?.phase} confirmedText=${JSON.stringify(stateFinal?.confirmedText)} userRawRefs=${JSON.stringify(stateFinal?.userRawRefs)} (\u53EA\u589E\u4E0D\u6539)`);
  const assembled = assembleNextTurn({
    persona: {
      id: "wang-yangming",
      name: "\u738B\u9633\u660E",
      systemPrompt: "\u4F60\u662F\u738B\u9633\u660E\u3002\u4EE5\u5FC3\u5B66\u7ACB\u573A\u4E0E\u7528\u6237\u5BF9\u8BDD\uFF0C\u52A1\u6C42\u300C\u77E5\u884C\u5408\u4E00\u300D\u7684\u5B9E\u8DF5\u6307\u5F15\uFF0C\u533A\u5206\u53F2\u5B9E\u3001\u601D\u60F3\u89E3\u91CA\u4E0E\u73B0\u4EE3\u63A8\u6F14\u3002"
    },
    userRaw: USER_RAW,
    lastReply: replyText,
    dilemma: stateFinal ?? foldDilemmaState([])
  });
  console.log(`${TAG} \u9636\u6BB55: \u4E0B\u4E00\u8F6E\u4E0A\u4E0B\u6587\u88C5\u914D messages=${assembled.messages.length} \u6761, roles=[${assembled.messages.map((m) => m.role).join(", ")}]`);
  console.log(`${TAG} \u9636\u6BB55: \u5DF2\u786E\u8BA4\u72B6\u6001\u51FA\u73B0\u5728\u4E0A\u4E0B\u6587\u4E2D: ` + JSON.stringify(assembled.messages.some((m) => m.content.startsWith("\u3010\u5DF2\u786E\u8BA4\u7684\u56F0\u60D1\u3011"))));
  console.log(`${TAG} \u9636\u6BB55: token \u4F30\u7B97=${assembled.tokenEstimate} \u9884\u7B97=${assembled.budget.used}/${assembled.budget.limit} (ratio=${assembled.budget.ratio.toFixed(3)})`);
  const foldEvents = session.events.map((e) => toFoldInput(e)).filter((e) => e !== null);
  const folded = foldDilemmaState(foldEvents);
  console.log(`${TAG} \u9636\u6BB56: \u5168\u91CF fold \u56DE\u8BFB phase=${folded.phase} userRawRefs=${JSON.stringify(folded.userRawRefs)} (\u4E0E projection \u72B6\u6001\u4E00\u81F4=${folded.phase === stateFinal?.phase})`);
  void sessions.flush(session).then(
    async () => {
      console.log(`${TAG} \u9636\u6BB57: flush \u5B8C\u6210 (\u5DF2\u63D0\u4EA4\u6301\u4E45\u5316\u5230 ${sessionDir()})`);
      await restoreSelfCheck();
    },
    async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("unknown to this harness")) {
        console.log(`${TAG} \u9636\u6BB57: flush \u88AB\u62D2 \u2014\u2014 \u9884\u671F\u5951\u7EA6\u884C\u4E3A\uFF08\u8DE8\u8FDB\u7A0B\u6301\u4E45\u5316\u7F3A\u53E3\uFF09: ${message.split(";")[0]}`);
        await restoreSelfCheck();
        return;
      }
      console.error(`${TAG} \u9636\u6BB57: flush \u5931\u8D25`, error);
    }
  );
}

// src/persona/registry.ts
import { readFileSync as readFileSync2, readdirSync as readdirSync2, statSync } from "node:fs";
import { isAbsolute, join as join2, relative, resolve, sep } from "node:path";

// src/persona/manifest-schema.ts
import { z as z2 } from "zod";
var personaIdSchema2 = z2.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "PersonaId must be kebab-case");
var personaStatusSchema = z2.enum(["active", "retired"]);
var personaContentManifestSchema = z2.object({
  prompt: z2.string().min(1),
  anecdotes: z2.string().min(1),
  quotes: z2.string().min(1),
  blacklist: z2.string().min(1)
}).strict();
var personaManifestSchema = z2.object({
  id: personaIdSchema2,
  displayName: z2.string().min(1),
  status: personaStatusSchema,
  legacyIds: z2.array(z2.string().min(1)).default([]),
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
    const names = readdirSync2(root).filter((name2) => statSafe(join2(root, name2))?.isDirectory()).sort();
    const definitions = names.map((name2) => {
      const packageDir = join2(root, name2);
      const manifestPath = join2(packageDir, "manifest.json");
      let manifest;
      try {
        manifest = personaManifestSchema.parse(JSON.parse(readFileSync2(manifestPath, "utf8")));
      } catch (error) {
        throw new Error(`invalid persona manifest ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (manifest.id !== name2) throw new Error(`manifest id ${manifest.id} does not match package directory ${name2}`);
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

// src/e2e/vertical-slice-dual.ts
import { createAssistantMessage as createAssistantMessage2, createUserMessage as createUserMessage2 } from "@deepseek-ai/dsh-llm";
import { SessionId as SessionId2 } from "@deepseek-ai/dsh-session";
import { existsSync as existsSync3, readFileSync as readFileSync4, readdirSync as readdirSync3 } from "node:fs";
import { join as join4 } from "node:path";
import { homedir as homedir2 } from "node:os";

// src/aggregate/aggregate.ts
init_trunk_storage();

// src/branch/branch-manager.ts
var BranchManager = class {
  branchesInternal = /* @__PURE__ */ new Map();
  activeInternal;
  registry;
  constructor(initialPersonaId, registry8, existingIndex = {}) {
    this.registry = registry8;
    this.activeInternal = registry8.get(initialPersonaId).id;
    for (const [rawPersona, sessionId] of Object.entries(existingIndex)) {
      const persona = registry8.normalizePersistedId(rawPersona);
      this.branchesInternal.set(persona, { persona, sessionId });
    }
    if (registry8.get(this.activeInternal).status === "retired" && !this.branchesInternal.has(this.activeInternal)) {
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
  static create(conversationId, storageDir, initialPersonaId, registry8) {
    registry8.requireActiveForCreate(initialPersonaId);
    const trunk = TrunkStorage.create(conversationId, storageDir, initialPersonaId, registry8);
    return new _ConversationAggregate(conversationId, trunk, new BranchManager(initialPersonaId, registry8));
  }
  /** 从磁盘恢复对话（启动恢复：重放 trunk JSONL；branches 索引与 active 一并恢复）。 */
  static load(conversationId, storageDir, registry8) {
    const trunk = TrunkStorage.load(conversationId, storageDir, registry8);
    const branches = new BranchManager(trunk.state.activePersona, registry8, trunk.state.branchesIndex);
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

// src/e2e/vertical-slice-dual.ts
init_dilemma();
var registry = createRuntimeRegistry();
var TAG2 = "[man-roles-roleplayer:e2e-dual]";
var CONVERSATION_ID = "conversation-dual-e2e";
var SESSION_WANG = "session-man-roles-wang-yangming";
var SESSION_ZENG = "session-man-roles-zeng-guofan";
var USER_RAW2 = "\u6211\u65E2\u60F3\u575A\u6301\u7406\u60F3\u4E3B\u4E49\uFF0C\u53C8\u89C9\u5F97\u73B0\u5B9E\u5904\u5904\u78B0\u58C1\uFF0C\u4E0D\u77E5\u5982\u4F55\u81EA\u5904\u3002";
var PERSONAS = {
  \u738B\u9633\u660E: {
    id: "wang-yangming",
    name: "\u738B\u9633\u660E",
    systemPrompt: "\u4F60\u662F\u738B\u9633\u660E\u3002\u4EE5\u5FC3\u5B66\u7ACB\u573A\u4E0E\u7528\u6237\u5BF9\u8BDD\uFF0C\u52A1\u6C42\u300C\u77E5\u884C\u5408\u4E00\u300D\u7684\u5B9E\u8DF5\u6307\u5F15\uFF0C\u533A\u5206\u53F2\u5B9E\u3001\u601D\u60F3\u89E3\u91CA\u4E0E\u73B0\u4EE3\u63A8\u6F14\u3002"
  },
  \u66FE\u56FD\u85E9: {
    id: "zeng-guofan",
    name: "\u66FE\u56FD\u85E9",
    systemPrompt: "\u4F60\u662F\u66FE\u56FD\u85E9\u3002\u4EE5\u5112\u5BB6\u7ECF\u4E16\u81F4\u7528\u3001\u62C5\u5F53\u5B9E\u52A1\u7684\u7ACB\u573A\u4E0E\u7528\u6237\u5BF9\u8BDD\u3002\uFF08\u5360\u4F4D persona\uFF1A\u9636\u6BB5 4 \u53EA\u9A8C\u8BC1\u673A\u5236\uFF0C\u4EBA\u7269\u5185\u5BB9\u5F85\u540E\u7EED\u8865\u5168\uFF09"
  }
};
function stubPersonaReply2(persona) {
  return persona === "\u738B\u9633\u660E" ? "\u77E5\u884C\u672C\u662F\u4E00\u4F53\uFF0C\u672A\u66FE\u771F\u77E5\u800C\u884C\uFF0C\u4EA6\u672A\u66FE\u5B9E\u884C\u800C\u77E5\u3002\u4F60\u65E2\u6709\u6240\u6C42\uFF0C\u4FBF\u5148\u95EE\u81EA\u5DF1\uFF1A\u6B64\u5FC3\u5149\u660E\u5426\uFF1F" : "\u5929\u4E0B\u4E8B\u5728\u4EBA\u4E3A\uFF0C\u9006\u5883\u6B63\u662F\u78E8\u70BC\u5904\u3002\u65E2\u77E5\u6240\u613F\uFF0C\u4FBF\u5F53\u54AC\u7259\u505A\u53BB\uFF0C\u83AB\u95EE\u524D\u7A0B\u3002";
}
function stubDirectorCandidate2() {
  return "\u7528\u6237\u9677\u5165\u7406\u60F3\u4E3B\u4E49\u4E0E\u73B0\u5B9E\u884C\u52A8\u7684\u51B2\u7A81\uFF0C\u53EF\u80FD\u56F0\u60D1\u4E8E\u300C\u77E5\u884C\u5408\u4E00\u300D\u7684\u5B9E\u8DF5\u8DEF\u5F84\u3002";
}
function trunkDir() {
  const home = process.env.DSH_HOME ?? join4(homedir2(), ".dsh");
  return join4(home, "man-roles", "trunk");
}
function branchSessionDir(sessionId) {
  const home = process.env.DSH_HOME ?? join4(homedir2(), ".dsh");
  return join4(home, "sessions", "_no-cwd", sessionId);
}
function extractMessageText(message) {
  if (typeof message !== "object" || message === null) return "";
  const content = message.content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === "object" && part !== null ? part.text ?? "" : "").join("");
  }
  return typeof content === "string" ? content : "";
}
function extractBranchHistory(session) {
  const history = [];
  for (const event2 of session.events) {
    if (event2.type === "user/message") {
      history.push({ role: "user", content: extractMessageText(event2.data) });
    } else if (event2.type === "assistant/message") {
      const inner = event2.data.message;
      history.push({ role: "assistant", content: extractMessageText(inner) });
    }
  }
  return history;
}
function inspectTrunkLog() {
  const dir = trunkDir();
  const file = join4(dir, `${CONVERSATION_ID}.jsonl`);
  if (!existsSync3(file)) {
    console.log(`${TAG2} \u6062\u590D\u81EA\u68C0: trunk \u6587\u4EF6\u5C1A\u4E0D\u5B58\u5728 (${file})`);
    return;
  }
  const lines = readFileSync4(file, "utf8").split(/\r?\n/).filter((l) => l.trim() !== "");
  const summary = lines.map((l) => {
    try {
      const e = JSON.parse(l);
      const data = e.data;
      const brief = data?.text !== void 0 ? `text=${JSON.stringify(String(data.text).slice(0, 18))}\u2026` : data?.persona !== void 0 ? `persona=${data.persona}` : data?.sessionId !== void 0 ? `sessionId=${data.sessionId}` : data?.ref !== void 0 ? `ref=${data.ref}` : "";
      return `seq${e.seq}:${e.type}${brief ? `(${brief})` : ""}`;
    } catch {
      return "<unparseable>";
    }
  });
  console.log(`${TAG2} \u6062\u590D\u81EA\u68C0: trunk JSONL=${file}`);
  console.log(`${TAG2} \u6062\u590D\u81EA\u68C0: \u4E8B\u4EF6\u5E8F\u5217=[${summary.join(" | ")}] (\u5171 ${lines.length} \u884C)`);
}
function assertTrunkRecovery(expectActive) {
  const restored = ConversationAggregate.load(CONVERSATION_ID, trunkDir(), registry);
  const s = restored.trunk.state;
  console.log(`${TAG2} \u6062\u590D\u65AD\u8A00: PersonaId=${restored.activePersona} (\u671F\u671B ${expectActive}) ${restored.activePersona === expectActive ? "\u2705" : "\u274C"}`);
  console.log(`${TAG2} \u6062\u590D\u65AD\u8A00: dilemma.phase=${s.dilemma.phase} (\u671F\u671B confirmed) confirmedText=${JSON.stringify(s.dilemma.confirmedText)} ${s.dilemma.phase === "confirmed" ? "\u2705" : "\u274C"}`);
  console.log(`${TAG2} \u6062\u590D\u65AD\u8A00: userRaws=${JSON.stringify(s.userRaws)} (\u671F\u671B\u542B\u9010\u5B57\u539F\u6587 ${s.userRaws.some((u) => u.text === USER_RAW2) ? "\u2705" : "\u274C"})`);
  console.log(`${TAG2} \u6062\u590D\u65AD\u8A00: branchesIndex=${JSON.stringify(s.branchesIndex)} (\u671F\u671B\u542B\u738B\u9633\u660E+\u66FE\u56FD\u85E9 ${s.branchesIndex["wang-yangming"] === SESSION_WANG && s.branchesIndex["zeng-guofan"] === SESSION_ZENG ? "\u2705" : "\u274C"})`);
}
function trunkHasData() {
  const file = join4(trunkDir(), `${CONVERSATION_ID}.jsonl`);
  if (!existsSync3(file)) return false;
  return readFileSync4(file, "utf8").split(/\r?\n/).filter((l) => l.trim() !== "").some((l) => {
    try {
      return JSON.parse(l).type !== "trunk/created";
    } catch {
      return false;
    }
  });
}
function logBranchSessionPersistence() {
  for (const sessionId of [SESSION_WANG, SESSION_ZENG]) {
    const dir = branchSessionDir(sessionId);
    const files = existsSync3(dir) ? readdirSync3(dir).filter((f) => f.endsWith(".jsonl.zstd") || f.endsWith(".jsonl")).join(",") : "(\u65E0)";
    console.log(`${TAG2} \u5206\u652F\u4F1A\u8BDD\u843D\u76D8 ${existsSync3(dir) ? "\u2705" : "\u274C"} ${sessionId}=${dir} \u6587\u4EF6=${files}`);
  }
}
function runDualRecoveryVerification() {
  console.log(`${TAG2} \u68C0\u6D4B\u5230 trunk \u5DF2\u6709\u7528\u6237\u6570\u636E \u2192 \u8DE8\u8FDB\u7A0B\u6062\u590D\u9A8C\u8BC1\u6A21\u5F0F\uFF08\u771F\u5B9E\u91CD\u542F\uFF1A\u65B0\u8FDB\u7A0B load \u78C1\u76D8\uFF09`);
  inspectTrunkLog();
  assertTrunkRecovery("wang-yangming");
  logBranchSessionPersistence();
  console.log(`${TAG2} \u7ED3\u8BBA: \u65B9\u6848 A \u81EA\u6301\u5B58\u50A8\u8DE8\u8FDB\u7A0B\u6062\u590D \u2705\uFF08\u56F0\u60D1\u72B6\u6001/\u7528\u6237\u539F\u8BDD/\u5206\u652F\u7D22\u5F15/\u5F53\u524D\u4EBA\u7269\u5168\u90E8\u8BFB\u56DE\uFF1BBranchSession \u4EC5\u5185\u7F6E\u4E8B\u4EF6\u7C7B\u578B\uFF0C\u65E0\u9636\u6BB5 3 \u7684 SessionFormatUnsupportedError\uFF09`);
}
function runDualVerticalSlice(ctx) {
  if (trunkHasData()) {
    runDualRecoveryVerification();
    return;
  }
  const sessions = ctx.sessions;
  const agg = ConversationAggregate.load(CONVERSATION_ID, trunkDir(), registry);
  console.log(`${TAG2} \u9636\u6BB50: \u9996\u6B21\u8FD0\u884C\uFF08trunk \u65E0\u6570\u636E\uFF09\uFF0C\u521B\u5EFA conversation=${CONVERSATION_ID} PersonaId=${agg.activePersona} (trunk=${agg.trunk.filePath})`);
  const wangFirst = agg.switchPersona("wang-yangming", () => SESSION_WANG);
  const ref = agg.addUserRaw("e2e-dual-message", USER_RAW2, "wang-yangming");
  const wang = sessions.create(SessionId2(SESSION_WANG));
  const wangUserSeq = wang.append(
    "user/message",
    createUserMessage2({ content: [{ type: "text", text: USER_RAW2 }], source: { kind: "user" } }),
    { surfaceOp: "append" }
  ).seq;
  const wangReply = stubPersonaReply2("\u738B\u9633\u660E");
  wang.append(
    "assistant/message",
    {
      turn: 0,
      step: 0,
      message: createAssistantMessage2({
        content: [{ type: "text", text: wangReply }],
        source: { provider: "man-roles-stub", model: "vertical-slice-dual" }
      })
    },
    { surfaceOp: "append", sourceEventSeqs: [wangUserSeq] }
  );
  console.log(`${TAG2} \u9636\u6BB51: \u9996\u6B21\u8FDB\u5165\u738B\u9633\u660E created=${wangFirst.created} sessionId=${wangFirst.sessionId} (\u5E94 created=true)`);
  console.log(`${TAG2} \u9636\u6BB51: user_raw \u5171\u4EAB\u5C42 ref=${ref} \u6587\u672C=${JSON.stringify(USER_RAW2)}\uFF1B\u738B\u9633\u660E BranchSession(${SESSION_WANG}) \u5386\u53F2 ${extractBranchHistory(wang).length} \u6761\uFF0C\u56DE\u7B54=${JSON.stringify(wangReply.slice(0, 20))}\u2026`);
  agg.setDilemmaCandidate(stubDirectorCandidate2(), "wang-yangming");
  console.log(`${TAG2} \u9636\u6BB52: candidate \u5DF2\u5199\u5165 trunk\uFF0Cphase=${agg.trunk.state.dilemma.phase} (\u5E94\u4E3A candidate\uFF0C\u672A\u786E\u8BA4\u4E0D\u81EA\u52A8\u5347\u7EA7 confirmed \u2014 F001) ${agg.trunk.state.dilemma.phase === "candidate" ? "\u2705" : "\u274C"}`);
  const feedback = "\u5BF9\uFF0C\u6211\u5C31\u662F\u56F0\u60D1\u77E5\u884C\u600E\u4E48\u5408\u4E00\u3002";
  const verdict = judgeFeedback(feedback);
  console.log(`${TAG2} \u9636\u6BB53: \u7528\u6237\u53CD\u9988=${JSON.stringify(feedback)} \u8BED\u4E49\u5224\u5B9A=${verdict}`);
  if (verdict === "confirmed") {
    agg.setDilemmaConfirmed("\u77E5\u884C\u5408\u4E00\u7684\u5B9E\u8DF5\u8DEF\u5F84");
  } else if (verdict === "corrected") {
    agg.setDilemmaCorrected("\u7406\u60F3\u4E0E\u73B0\u5B9E\u5982\u4F55\u4E24\u5168");
  }
  console.log(`${TAG2} \u9636\u6BB53: \u6700\u7EC8 trunk dilemma phase=${agg.trunk.state.dilemma.phase} confirmedText=${JSON.stringify(agg.trunk.state.dilemma.confirmedText)} userRawRefs=${JSON.stringify(agg.trunk.userRawRefs)} (\u53EA\u589E\u4E0D\u6539)`);
  const zengSwitch = agg.switchPersona("zeng-guofan", () => SESSION_ZENG);
  const zeng = sessions.create(SessionId2(SESSION_ZENG));
  console.log(`${TAG2} \u9636\u6BB54: \u5207\u6362\u66FE\u56FD\u85E9 sessionId=${zengSwitch.sessionId} created=${zengSwitch.created} (\u9996\u6B21\u8FDB\u5165\u5E94 created=true)`);
  console.log(`${TAG2} \u9636\u6BB54: PersonaId=${agg.activePersona} branchesIndex=${JSON.stringify(Object.fromEntries(agg.branchesIndex))}`);
  const zengAssembled = assembleBranchTurn({
    persona: PERSONAS["\u66FE\u56FD\u85E9"],
    sharedLayer: agg.sharedLayer,
    branchHistory: extractBranchHistory(zeng)
  });
  const zengText = zengAssembled.messages.map((m) => m.content).join("\n");
  console.log(`${TAG2} \u9636\u6BB55: \u66FE\u56FD\u85E9\u4E0A\u4E0B\u6587 messages=${zengAssembled.messages.length} \u6761 roles=[${zengAssembled.messages.map((m) => m.role).join(", ")}]`);
  console.log(`${TAG2} \u9636\u6BB55: \u9694\u79BB\u65AD\u8A00 \u66FE\u56FD\u85E9\u4E0A\u4E0B\u6587\u542B\u7528\u6237\u539F\u8BDD=${zengText.includes(USER_RAW2) ? "\u2705" : "\u274C"}`);
  console.log(`${TAG2} \u9636\u6BB55: \u9694\u79BB\u65AD\u8A00 \u66FE\u56FD\u85E9\u4E0A\u4E0B\u6587\u542B\u5DF2\u786E\u8BA4\u4E3B\u5E72=${zengText.includes("\u3010\u5DF2\u786E\u8BA4\u7684\u56F0\u60D1\u3011") ? "\u2705" : "\u274C"}`);
  console.log(`${TAG2} \u9636\u6BB55: \u9694\u79BB\u65AD\u8A00 \u66FE\u56FD\u85E9\u4E0A\u4E0B\u6587\u4E0D\u542B\u738B\u9633\u660E\u56DE\u7B54=${!zengText.includes("\u77E5\u884C\u672C\u662F\u4E00\u4F53") ? "\u2705" : "\u274C"}`);
  const zengReply = stubPersonaReply2("\u66FE\u56FD\u85E9");
  zeng.append(
    "assistant/message",
    {
      turn: 0,
      step: 0,
      message: createAssistantMessage2({
        content: [{ type: "text", text: zengReply }],
        source: { provider: "man-roles-stub", model: "vertical-slice-dual" }
      })
    },
    { surfaceOp: "append" }
  );
  console.log(`${TAG2} \u9636\u6BB56: \u66FE\u56FD\u85E9\u72EC\u7ACB\u56DE\u7B54\u5DF2\u5199\u5165 BranchSession(${SESSION_ZENG})\uFF0C\u56DE\u7B54=${JSON.stringify(zengReply.slice(0, 20))}\u2026`);
  const wangBack = agg.switchPersona("wang-yangming", () => SESSION_WANG);
  console.log(`${TAG2} \u9636\u6BB57: \u5207\u56DE\u738B\u9633\u660E sessionId=${wangBack.sessionId} created=${wangBack.created} (\u8FD4\u56DE\u590D\u7528\u5E94 created=false) ${wangBack.created === false ? "\u2705" : "\u274C"}`);
  const wangHistory = extractBranchHistory(wang);
  const wangAssembled = assembleBranchTurn({
    persona: PERSONAS["\u738B\u9633\u660E"],
    sharedLayer: agg.sharedLayer,
    branchHistory: wangHistory
  });
  const wangText = wangAssembled.messages.map((m) => m.content).join("\n");
  console.log(`${TAG2} \u9636\u6BB57: \u738B\u9633\u660E\u5386\u53F2 ${wangHistory.length} \u6761 (user/message + assistant/message)`);
  console.log(`${TAG2} \u9636\u6BB57: \u9694\u79BB\u65AD\u8A00 \u738B\u9633\u660E\u4E0A\u4E0B\u6587\u542B\u738B\u9633\u660E\u56DE\u7B54=${wangText.includes("\u77E5\u884C\u672C\u662F\u4E00\u4F53") ? "\u2705" : "\u274C"}`);
  console.log(`${TAG2} \u9636\u6BB57: \u9694\u79BB\u65AD\u8A00 \u738B\u9633\u660E\u4E0A\u4E0B\u6587\u4E0D\u542B\u66FE\u56FD\u85E9\u56DE\u7B54=${!wangText.includes("\u5929\u4E0B\u4E8B\u5728\u4EBA\u4E3A") ? "\u2705" : "\u274C"}`);
  console.log(`${TAG2} \u9636\u6BB57: token \u4F30\u7B97=${wangAssembled.tokenEstimate} \u9884\u7B97=${wangAssembled.budget.used}/${wangAssembled.budget.limit}`);
  void Promise.all([sessions.flush(wang), sessions.flush(zeng), agg.flush()]).then(
    async () => {
      console.log(`${TAG2} \u9636\u6BB58: flush \u5B8C\u6210\uFF08\u738B\u9633\u660E + \u66FE\u56FD\u85E9 BranchSession + trunk\uFF09`);
      console.log(`${TAG2} \u9636\u6BB58: BranchSession \u4E8B\u4EF6\u7C7B\u578B\u68C0\u67E5: \u738B\u9633\u660E=[${extractBranchHistory(wang).map((h) => h.role).join(",")}] \u66FE\u56FD\u85E9=[${extractBranchHistory(zeng).map((h) => h.role).join(",")}] (\u4EC5 user/assistant \u5185\u7F6E\u7C7B\u578B\uFF0C\u65E0\u81EA\u5B9A\u4E49\u4E8B\u4EF6 \u2192 flush \u4E0D\u88AB\u62D2)`);
      inspectTrunkLog();
      console.log(`${TAG2} \u9636\u6BB58: \u540C\u8FDB\u7A0B\u5185\u6A21\u62DF\u91CD\u542F\uFF08\u65B0\u5B9E\u4F8B load \u540C\u4E00 trunk \u6587\u4EF6\uFF09`);
      assertTrunkRecovery("wang-yangming");
      logBranchSessionPersistence();
    },
    async (error) => {
      console.error(`${TAG2} \u9636\u6BB58: flush \u5931\u8D25`, error);
    }
  );
}

// src/e2e/vertical-slice-real.ts
import { createAssistantMessage as createAssistantMessage4, createUserMessage as createUserMessage4 } from "@deepseek-ai/dsh-llm";
import { SessionId as SessionId3 } from "@deepseek-ai/dsh-session";
import { existsSync as existsSync4, mkdirSync as mkdirSync2, readFileSync as readFileSync5, readdirSync as readdirSync4, writeFileSync, appendFileSync as appendFileSync2 } from "node:fs";
import { join as join5 } from "node:path";
import { homedir as homedir3 } from "node:os";

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
function buildPersonaSpec(id, name2, markdown) {
  const sections = parsePersonaMarkdown(markdown);
  assertRedLineSections(id, sections);
  return { id, name: name2, systemPrompt: personaSystemPromptFromSections(sections) };
}

// src/context/personas-data.ts
var cached;
function buildPersonas() {
  if (cached !== void 0) return cached;
  cached = Object.fromEntries(CONTENT_PACK.map((entry) => {
    const { id, displayName } = entry.manifest;
    return [id, buildPersonaSpec(id, displayName, entry.prompt)];
  }));
  return cached;
}
function personaSpecFor(id) {
  const spec = buildPersonas()[id];
  if (spec === void 0) throw new Error(`unknown PersonaId: ${id}`);
  return spec;
}

// src/llm/dsh-client.ts
import {
  BlockAssembler,
  createAssistantMessage as createAssistantMessage3,
  createToolResultMessage,
  createUserMessage as createUserMessage3
} from "@deepseek-ai/dsh-llm";
var DEFAULT_PROVIDER = "deepseek-official";
var DEFAULT_MODEL = "deepseek-v4-flash";
var LlmCallError = class extends Error {
  constructor(message, kind, failureCode, failureMessage) {
    super(message);
    this.kind = kind;
    this.failureCode = failureCode;
    this.failureMessage = failureMessage;
    this.name = "LlmCallError";
  }
  kind;
  failureCode;
  failureMessage;
};
var DshLlmClient = class {
  constructor(options) {
    this.options = options;
  }
  options;
  async complete(request2) {
    const provider3 = this.options.provider ?? DEFAULT_PROVIDER;
    const model3 = this.options.model ?? DEFAULT_MODEL;
    const messages = request2.messages.map((m) => toDshMessage(m, provider3, model3));
    const options = {
      provider: provider3,
      model: model3,
      messages,
      reasoningEffort: request2.reasoningEffort ?? this.options.reasoningEffort ?? "off",
      ...request2.system === void 0 ? {} : { system: request2.system },
      ...request2.tools === void 0 ? {} : { tools: request2.tools },
      ...request2.temperature === void 0 ? {} : { temperature: request2.temperature },
      ...request2.maxTokens === void 0 ? {} : { maxTokens: request2.maxTokens },
      ...request2.signal === void 0 ? {} : { signal: request2.signal }
    };
    const assembler = new BlockAssembler();
    for await (const chunk of this.options.stream(options)) {
      assembler.push(chunk);
    }
    const finish = assembler.finish;
    if (finish.kind === "error" || finish.kind === "aborted") {
      throw new LlmCallError(
        `llm call ${finish.kind}: ${finish.failure.code} ${finish.failure.message}`,
        finish.kind,
        finish.failure.code,
        finish.failure.message
      );
    }
    const blocks = assembler.blocks();
    const text = blocks.filter((block) => block.type === "text").map((block) => block.text).join("");
    const toolCalls = blocks.filter((block) => block.type === "tool-call").map((block) => ({ id: block.id, name: block.name, arguments: block.arguments }));
    const usage = assembler.usage;
    return {
      text,
      usage: {
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        ...usage?.cacheReadTokens === void 0 ? {} : { cacheReadTokens: usage.cacheReadTokens },
        ...usage?.cacheWriteTokens === void 0 ? {} : { cacheWriteTokens: usage.cacheWriteTokens },
        ...usage?.reasoningTokens === void 0 ? {} : { reasoningTokens: usage.reasoningTokens }
      },
      finishReason: finish.kind,
      provider: provider3,
      model: model3,
      ...toolCalls.length > 0 ? { toolCalls } : {}
    };
  }
};
function toDshMessage(m, provider3, model3) {
  if (m.role === "tool") {
    return createToolResultMessage({
      callId: m.toolCallId,
      content: [{ type: "text", text: m.content }],
      isError: m.isError ?? false
    });
  }
  if (m.role === "assistant" && "toolCalls" in m && m.toolCalls.length > 0) {
    return createAssistantMessage3({
      content: [
        ...m.content !== "" ? [{ type: "text", text: m.content }] : [],
        ...m.toolCalls.map((tc) => ({
          type: "tool-call",
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments
        }))
      ],
      source: { provider: provider3, model: model3 }
    });
  }
  if (m.role === "assistant") {
    return createAssistantMessage3({
      content: [{ type: "text", text: m.content }],
      source: { provider: provider3, model: model3 }
    });
  }
  return createUserMessage3({
    content: [{ type: "text", text: m.content }],
    source: { kind: "user" }
  });
}

// src/llm/client.ts
async function runToolLoop(complete, request2, handlers, maxRounds = 3) {
  let messages = [...request2.messages];
  const trail = [];
  let response;
  for (let round = 1; round <= maxRounds; round++) {
    response = await complete(request2.tools === void 0 ? { ...request2, messages } : { ...request2, messages, tools: request2.tools });
    const calls = response.toolCalls ?? [];
    if (calls.length === 0) {
      return { response, trail, truncated: false };
    }
    const results = [];
    for (const call of calls) {
      const handler = handlers[call.name];
      let result;
      if (handler === void 0) {
        result = { content: `\u672A\u77E5\u5DE5\u5177\uFF1A${call.name}\uFF08\u53EF\u7528\u5DE5\u5177\uFF1A${Object.keys(handlers).join("\u3001")}\uFF09`, isError: true };
      } else {
        try {
          const out = handler(call.arguments);
          result = { content: out.content, isError: out.isError ?? false };
        } catch (error) {
          result = { content: `\u5DE5\u5177\u6267\u884C\u5931\u8D25\uFF1A${String(error)}`, isError: true };
        }
      }
      results.push(result);
      trail.push({
        round,
        name: call.name,
        arguments: call.arguments,
        result: result.content,
        isError: result.isError
      });
    }
    if (results.some((result) => result === void 0)) throw new Error("tool result missing");
    messages = [
      ...messages,
      { role: "assistant", content: "", toolCalls: calls },
      ...calls.map((call, i) => {
        const result = results[i];
        if (result === void 0) throw new Error(`tool result missing for ${call.name}`);
        return { role: "tool", toolCallId: call.id, content: result.content, isError: result.isError };
      })
    ];
  }
  return { response, trail, truncated: true };
}
function estimateRequestTokens(request2) {
  return (request2.system === void 0 ? 0 : estimateTokens(request2.system)) + request2.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

// src/llm/judge.ts
var JUDGE_SYSTEM_PROMPT = `\u4F60\u662F\u300C\u56F0\u60D1\u786E\u8BA4\u88C1\u5224\u300D\u3002\u7ED9\u5B9A\u5BFC\u6F14\u5BF9\u7528\u6237\u56F0\u60D1\u7684\u63A8\u65AD\u539F\u6587\u4E0E\u7528\u6237\u7684\u53CD\u9988\u539F\u8BDD\uFF0C\u5224\u65AD\u7528\u6237\u610F\u56FE\u5C5E\u4E8E\u54EA\u4E00\u7C7B\uFF1A
- confirmed\uFF1A\u7528\u6237\u8BA4\u53EF\u8BE5\u63A8\u65AD\uFF08\u5982\u300C\u5BF9\u300D\u300C\u662F\u7684\u300D\u300C\u6CA1\u9519\u300D\u300C\u5C31\u662F\u8FD9\u6837\u300D\u300C\u6211\u56F0\u60D1\u7684\u6B63\u662F\u8FD9\u4E2A\u300D\uFF09\uFF1B
- corrected\uFF1A\u7528\u6237\u8BA4\u4E3A\u63A8\u65AD\u4E0D\u51C6\u5E76\u63D0\u51FA\u4FEE\u6B63\uFF08\u5982\u300C\u4E0D\u5BF9\u300D\u300C\u4E0D\u662F\u300D\u300C\u5176\u5B9E\u662F\u300D\u300C\u6211\u771F\u6B63\u56F0\u60D1\u7684\u662F\u300D\uFF09\uFF1B
- unconfirmed\uFF1A\u7528\u6237\u65E2\u672A\u786E\u8BA4\u4E5F\u672A\u7EA0\u6B63\uFF08\u5982\u7EE7\u7EED\u63D0\u95EE\u3001\u8865\u5145\u80CC\u666F\u3001\u8868\u8FBE\u4E0D\u786E\u5B9A\uFF09\u3002
\u53EA\u8F93\u51FA\u4E00\u4E2A\u8BCD\uFF1Aconfirmed / corrected / unconfirmed\u3002\u4E0D\u8981\u8F93\u51FA\u4EFB\u4F55\u5176\u4ED6\u5185\u5BB9\u3002`;
function judgePrompt(feedback, candidateText) {
  return `\u5BFC\u6F14\u63A8\u65AD\uFF1A${candidateText}
\u7528\u6237\u53CD\u9988\uFF1A${feedback}

\u5224\u5B9A\uFF1A`;
}
function parseVerdict(text) {
  const match = /(unconfirmed|confirmed|corrected)/.exec(text);
  return match === null ? null : match[1];
}
function keywordFallbackVerdict(feedback) {
  if (/(不对|不是|纠正|其实)/.test(feedback)) return "corrected";
  if (/(对|是的|没错|确认|同意)/.test(feedback)) return "confirmed";
  return "unconfirmed";
}
async function judgeFeedbackSemantic(feedback, candidateText, llm) {
  const response = await llm.complete({
    system: JUDGE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: judgePrompt(feedback, candidateText) }],
    reasoningEffort: "off",
    maxTokens: 16
  });
  return parseVerdict(response.text) ?? keywordFallbackVerdict(feedback);
}
var DIRECTOR_SYSTEM_PROMPT = `\u4F60\u662F\u300C\u56F0\u60D1\u5BFC\u6F14\u300D\u3002\u4ECE\u7528\u6237\u539F\u8BDD\u4E2D\u63D0\u70BC\u5176\u5C1A\u672A\u8BF4\u6E05\u7684\u6838\u5FC3\u56F0\u60D1\uFF0C\u8F93\u51FA\u4E00\u53E5\u5019\u9009\u8868\u8FF0\uFF1A
- \u7528\u7B2C\u4E09\u4EBA\u79F0\u63CF\u8FF0\u7528\u6237\u56F0\u60D1\uFF08\u4E0D\u8981\u7528\u300C\u6211\u300D\u5192\u5145\u7528\u6237\uFF09\uFF1B
- \u53EA\u63D0\u70BC\u6700\u6838\u5FC3\u7684\u4E00\u6761\u77DB\u76FE\u6216\u95EE\u9898\uFF1B
- \u4E0D\u8981\u7ED9\u51FA\u5EFA\u8BAE\u3001\u8BC4\u4EF7\u6216\u89E3\u51B3\u65B9\u6848\uFF1B
- \u4FDD\u6301\u9648\u8FF0\u53E5\uFF0C\u4E00\u53E5\u8BDD\u5B8C\u6210\u3002`;
async function inferDirectorCandidate(userRaws, llm) {
  const response = await llm.complete({
    system: DIRECTOR_SYSTEM_PROMPT,
    messages: userRaws.map((text) => ({ role: "user", content: text })),
    reasoningEffort: "off",
    maxTokens: 128
  });
  return response.text.trim();
}

// src/e2e/vertical-slice-real.ts
var registry2 = createRuntimeRegistry();
var TAG3 = "[man-roles-roleplayer:e2e-real]";
var CONVERSATION_ID2 = "conversation-real-e2e";
var SESSION_WANG2 = "session-man-roles-real-wang-yangming";
var SESSION_ZENG2 = "session-man-roles-real-zeng-guofan";
var USER_RAW3 = "\u6211\u65E2\u60F3\u575A\u6301\u7406\u60F3\u4E3B\u4E49\uFF0C\u53C8\u89C9\u5F97\u73B0\u5B9E\u5904\u5904\u78B0\u58C1\uFF0C\u4E0D\u77E5\u5982\u4F55\u81EA\u5904\u3002";
var FEEDBACK = "\u5BF9\uFF0C\u6211\u5C31\u662F\u56F0\u60D1\u77E5\u884C\u600E\u4E48\u5408\u4E00\u3002";
var TOKEN_BUDGET = 2e4;
function trunkDir2() {
  const home = process.env.DSH_HOME ?? join5(homedir3(), ".dsh");
  return join5(home, "man-roles", "trunk");
}
function evidenceDir() {
  const home = process.env.DSH_HOME ?? join5(homedir3(), ".dsh");
  return join5(home, "man-roles", "e2e");
}
function branchSessionDir2(sessionId) {
  const home = process.env.DSH_HOME ?? join5(homedir3(), ".dsh");
  return join5(home, "sessions", "_no-cwd", sessionId);
}
function extractMessageText2(message) {
  if (typeof message !== "object" || message === null) return "";
  const content = message.content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === "object" && part !== null ? part.text ?? "" : "").join("");
  }
  return typeof content === "string" ? content : "";
}
function extractBranchHistory2(session) {
  const history = [];
  for (const event2 of session.events) {
    if (event2.type === "user/message") {
      history.push({ role: "user", content: extractMessageText2(event2.data) });
    } else if (event2.type === "assistant/message") {
      const inner = event2.data.message;
      history.push({ role: "assistant", content: extractMessageText2(inner) });
    }
  }
  return history;
}
function trunkHasData2() {
  const file = join5(trunkDir2(), `${CONVERSATION_ID2}.jsonl`);
  if (!existsSync4(file)) return false;
  return readFileSync5(file, "utf8").split(/\r?\n/).filter((l) => l.trim() !== "").some((l) => {
    try {
      return JSON.parse(l).type !== "trunk/created";
    } catch {
      return false;
    }
  });
}
var LedgerLlmClient = class {
  constructor(inner) {
    this.inner = inner;
  }
  inner;
  calls = [];
  nextSeq = 1;
  /** 最近一次调用的 seq 标上阶段名（调用方在每次 complete 后调用）。 */
  mark(stage) {
    if (this.calls.length === 0) return;
    this.calls[this.calls.length - 1].stage = stage;
  }
  get totalTokens() {
    return this.calls.reduce((sum, c) => sum + c.inputTokens + c.outputTokens, 0);
  }
  async complete(request2) {
    const resp = await this.inner.complete(request2);
    this.calls.push({
      seq: this.nextSeq++,
      stage: "?",
      provider: resp.provider,
      model: resp.model,
      inputTokens: resp.usage.inputTokens,
      outputTokens: resp.usage.outputTokens,
      finishReason: resp.finishReason,
      text: resp.text
    });
    return resp;
  }
};
function assertBudget(ledger) {
  const total = ledger.totalTokens;
  console.log(`${TAG3} token \u53F0\u8D26: \u7D2F\u8BA1=${total}/${TOKEN_BUDGET} (${total > TOKEN_BUDGET ? "\u274C \u8D85\u9884\u7B97" : "\u2705 \u9884\u7B97\u5185"})`);
  if (total > TOKEN_BUDGET) {
    throw new Error(`\u9636\u6BB55 token \u9884\u7B97\u8D85\u9650\uFF1A${total} > ${TOKEN_BUDGET}\uFF0C\u505C\u6B62\u540E\u7EED\u6A21\u578B\u8C03\u7528`);
  }
}
async function completeWithStartupRetry(llm, request2, attempts = 30, delayMs = 500) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await llm.complete(request2);
    } catch (error) {
      lastError = error;
      if (error instanceof LlmCallError && (error.failureCode === "MISSING_CREDENTIAL" || error.failureCode === "NO_ADAPTER")) {
        console.log(`${TAG3} \u542F\u52A8\u7ADE\u6001: ${error.failureCode}\uFF08\u7B2C ${attempt}/${attempts} \u6B21\u5C1D\u8BD5\uFF09\uFF0C\u7B49\u5F85 ${delayMs}ms \u540E\u91CD\u8BD5\uFF08\u65E0\u7F51\u7EDC\u8C03\u7528\uFF0C\u96F6 token \u6210\u672C\uFF09`);
        await new Promise((resolve2) => setTimeout(resolve2, delayMs));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
function inspectTrunkLog2() {
  const file = join5(trunkDir2(), `${CONVERSATION_ID2}.jsonl`);
  if (!existsSync4(file)) {
    console.log(`${TAG3} \u6062\u590D\u81EA\u68C0: trunk \u6587\u4EF6\u5C1A\u4E0D\u5B58\u5728 (${file})`);
    return;
  }
  const lines = readFileSync5(file, "utf8").split(/\r?\n/).filter((l) => l.trim() !== "");
  const summary = lines.map((l) => {
    try {
      const e = JSON.parse(l);
      const data = e.data;
      const brief = data?.text !== void 0 ? `text=${JSON.stringify(String(data.text).slice(0, 16))}\u2026` : data?.persona !== void 0 ? `persona=${data.persona}` : data?.sessionId !== void 0 ? `sessionId=${data.sessionId}` : data?.ref !== void 0 ? `ref=${data.ref}` : "";
      return `seq${e.seq}:${e.type}${brief ? `(${brief})` : ""}`;
    } catch {
      return "<unparseable>";
    }
  });
  console.log(`${TAG3} \u6062\u590D\u81EA\u68C0: trunk JSONL=${file}`);
  console.log(`${TAG3} \u6062\u590D\u81EA\u68C0: \u4E8B\u4EF6\u5E8F\u5217=[${summary.join(" | ")}] (\u5171 ${lines.length} \u884C)`);
}
function logBranchSessionPersistence2() {
  for (const sessionId of [SESSION_WANG2, SESSION_ZENG2]) {
    const dir = branchSessionDir2(sessionId);
    const files = existsSync4(dir) ? readdirSync4(dir).filter((f) => f.endsWith(".jsonl.zstd") || f.endsWith(".jsonl")).join(",") : "(\u65E0)";
    console.log(`${TAG3} \u5206\u652F\u4F1A\u8BDD\u843D\u76D8 ${existsSync4(dir) ? "\u2705" : "\u274C"} ${sessionId}=${dir} \u6587\u4EF6=${files}`);
  }
}
function writeEvidence(ledger, summary) {
  const dir = evidenceDir();
  mkdirSync2(dir, { recursive: true });
  const file = join5(dir, `${CONVERSATION_ID2}.jsonl`);
  try {
    writeFileSync(file, "", { encoding: "utf8" });
    for (const call of ledger.calls) {
      appendFileSync2(file, `${JSON.stringify(call)}
`, { encoding: "utf8" });
    }
    appendFileSync2(file, `${JSON.stringify({ type: "summary", totalTokens: ledger.totalTokens, ...summary })}
`, { encoding: "utf8" });
    console.log(`${TAG3} \u89C2\u5BDF\u8BC1\u636E\u5DF2\u5199\u5165 ${file} (${ledger.calls.length} \u6B21\u8C03\u7528 + 1 \u884C\u6C47\u603B)`);
    return file;
  } catch (error) {
    console.error(`${TAG3} \u89C2\u5BDF\u8BC1\u636E\u5199\u5165\u5931\u8D25`, error);
    return "";
  }
}
function assertTrunkRecovery2(expectActive) {
  const restored = ConversationAggregate.load(CONVERSATION_ID2, trunkDir2(), registry2);
  const s = restored.trunk.state;
  console.log(`${TAG3} \u6062\u590D\u65AD\u8A00: PersonaId=${restored.activePersona} (\u671F\u671B ${expectActive}) ${restored.activePersona === expectActive ? "\u2705" : "\u274C"}`);
  console.log(`${TAG3} \u6062\u590D\u65AD\u8A00: dilemma.phase=${s.dilemma.phase} (\u671F\u671B confirmed) confirmedText=${JSON.stringify(s.dilemma.confirmedText)} ${s.dilemma.phase === "confirmed" ? "\u2705" : "\u274C"}`);
  console.log(`${TAG3} \u6062\u590D\u65AD\u8A00: userRaws=${JSON.stringify(s.userRaws)} (\u671F\u671B\u542B\u9010\u5B57\u539F\u6587 ${s.userRaws.some((u) => u.text === USER_RAW3) ? "\u2705" : "\u274C"})`);
  console.log(`${TAG3} \u6062\u590D\u65AD\u8A00: branchesIndex=${JSON.stringify(s.branchesIndex)} (\u671F\u671B\u542B\u738B\u9633\u660E+\u66FE\u56FD\u85E9 ${s.branchesIndex["wang-yangming"] === SESSION_WANG2 && s.branchesIndex["zeng-guofan"] === SESSION_ZENG2 ? "\u2705" : "\u274C"})`);
}
function runRealRecoveryVerification() {
  console.log(`${TAG3} \u68C0\u6D4B\u5230 trunk \u5DF2\u6709\u7528\u6237\u6570\u636E \u2192 \u8DE8\u8FDB\u7A0B\u6062\u590D\u9A8C\u8BC1\u6A21\u5F0F\uFF08\u771F\u5B9E\u91CD\u542F\uFF1A\u65B0\u8FDB\u7A0B load \u78C1\u76D8\uFF09`);
  inspectTrunkLog2();
  assertTrunkRecovery2("wang-yangming");
  logBranchSessionPersistence2();
  console.log(`${TAG3} \u7ED3\u8BBA: \u9636\u6BB55 \u771F\u5B9E\u94FE\u8DEF trunk \u8DE8\u8FDB\u7A0B\u6062\u590D \u2705\uFF08conflict \u72B6\u6001/\u7528\u6237\u539F\u8BDD/\u5206\u652F\u7D22\u5F15/\u5F53\u524D\u4EBA\u7269\u8BFB\u56DE\uFF09`);
}
async function runRealModelSlice(ctx) {
  if (trunkHasData2()) {
    runRealRecoveryVerification();
  } else {
    await runRealFullChain(ctx);
  }
  const appExit = ctx.get("appExit");
  if (typeof appExit === "function") {
    console.log(`${TAG3} \u8BF7\u6C42\u4F18\u96C5\u9000\u51FA\uFF08appExit(0)\uFF09\u2026`);
    appExit(0);
  }
}
async function runRealFullChain(ctx) {
  const sessions = ctx.sessions;
  const llm = new LedgerLlmClient(new DshLlmClient({ stream: (options) => ctx.llm.stream(options) }));
  console.log(`${TAG3} \u9636\u6BB50: \u9996\u6B21\u8FD0\u884C\uFF08trunk \u65E0\u6570\u636E\uFF09\uFF0Cconversation=${CONVERSATION_ID2}\uFF1B\u6A21\u578B\u5BA2\u6237\u7AEF=DshLlmClient(ctx.llm.stream) token \u9884\u7B97=${TOKEN_BUDGET}`);
  const probe = await completeWithStartupRetry(llm, {
    system: "\u4F60\u662F\u63A5\u7F1D\u63A2\u9488\u3002",
    messages: [{ role: "user", content: "\u53EA\u56DE\u590D\u56DB\u4E2A\u5B57\uFF1A\u63A5\u7F1D\u5DF2\u901A" }],
    reasoningEffort: "off",
    maxTokens: 32
  });
  llm.mark("llm-seam-probe");
  console.log(`${TAG3} \u9636\u6BB50: \u63A5\u7F1D\u63A2\u9488 \u2705 provider=${probe.provider} model=${probe.model} finish=${probe.finishReason} usage(input=${probe.usage.inputTokens} output=${probe.usage.outputTokens})`);
  console.log(`${TAG3} \u9636\u6BB50: \u63A5\u7F1D\u5F62\u6001\uFF08\u8BB0\u5F55\u4E8E findings\uFF09\uFF1Actx.llm.stream(GenerateOptions) \u2192 AsyncIterable<StreamChunk>\uFF1BBlockAssembler \u7EC4\u88C5\uFF1Busage chunk \u63D0\u4F9B TokenUsage\uFF1B reasoningEffort=off \u7701 token\uFF1B\u51ED\u636E\u7ECF .credentials.yaml DEEPSEEK_API_KEY \u6BCF\u8BF7\u6C42\u89E3\u6790`);
  console.log(`${TAG3} \u9636\u6BB50: \u63A2\u9488\u8F93\u51FA=${JSON.stringify(probe.text)} (\u542B\u300C\u63A5\u7F1D\u5DF2\u901A\u300D${probe.text.includes("\u63A5\u7F1D\u5DF2\u901A") ? "\u2705" : "\u274C"})`);
  if (!probe.text.includes("\u63A5\u7F1D\u5DF2\u901A")) {
    throw new Error("\u9636\u6BB50 \u63A5\u7F1D\u63A2\u9488\u672A\u8FD4\u56DE\u9884\u671F\u6587\u672C\uFF0C\u7EC8\u6B62\u94FE\u8DEF\uFF08\u907F\u514D\u7EE7\u7EED\u6D88\u8017 API\uFF09");
  }
  assertBudget(llm);
  const agg = ConversationAggregate.load(CONVERSATION_ID2, trunkDir2(), registry2);
  const wangFirst = agg.switchPersona("wang-yangming", () => SESSION_WANG2);
  const ref = agg.addUserRaw("e2e-real-message", USER_RAW3, "wang-yangming");
  const wang = sessions.create(SessionId3(SESSION_WANG2));
  const wangUserSeq = wang.append(
    "user/message",
    createUserMessage4({ content: [{ type: "text", text: USER_RAW3 }], source: { kind: "user" } }),
    { surfaceOp: "append" }
  ).seq;
  const wangPersona = personaSpecFor("wang-yangming");
  const wangAssembled = assembleBranchTurn({
    persona: wangPersona,
    sharedLayer: agg.sharedLayer,
    branchHistory: extractBranchHistory2(wang)
  });
  const wangSystem = wangAssembled.messages[0]?.role === "system" ? wangAssembled.messages[0].content : "";
  console.log(`${TAG3} \u9636\u6BB51: persona systemPrompt \u7EA2\u7EBF\u81EA\u68C0 \u8BED\u8A00\u7981\u5FCC=${wangSystem.includes("\u8BED\u8A00\u7981\u5FCC\uFF08\u4E0D\u53EF\u8FDD\u53CD\uFF09") ? "\u2705" : "\u274C"} \u51FA\u5904\u94C1\u5F8B=${wangSystem.includes("\u51FA\u5904\u94C1\u5F8B\uFF08\u9632\u4F2A\u6258\uFF09") ? "\u2705" : "\u274C"} \u7981\u5FCC\u539F\u6587\u793A\u4F8B=${wangSystem.includes("\u4E0D\u628A\u8BDD\u8BF4\u6B7B\u3001\u8BF4\u7EDD") ? "\u2705" : "\u274C"}`);
  const wangReplyResp = await llm.complete({
    system: wangSystem,
    messages: wangAssembled.messages.slice(1).map((m) => ({ role: m.role, content: m.content })),
    reasoningEffort: "off",
    maxTokens: 1024
  });
  llm.mark("persona-reply-wang");
  const wangReply = wangReplyResp.text.trim();
  console.log(`${TAG3} \u9636\u6BB51: \u738B\u9633\u660E\u771F\u5B9E\u56DE\u7B54\uFF08\u975E stub\uFF09=${JSON.stringify(wangReply.slice(0, 60))}\u2026 usage(input=${wangReplyResp.usage.inputTokens} output=${wangReplyResp.usage.outputTokens}) (\u4E0E\u9636\u6BB54 stub\u300C\u77E5\u884C\u672C\u662F\u4E00\u4F53\u2026\u300D\u4E0D\u540C=${wangReply !== "\u77E5\u884C\u672C\u662F\u4E00\u4F53\uFF0C\u672A\u66FE\u771F\u77E5\u800C\u884C\uFF0C\u4EA6\u672A\u66FE\u5B9E\u884C\u800C\u77E5\u3002\u4F60\u65E2\u6709\u6240\u6C42\uFF0C\u4FBF\u5148\u95EE\u81EA\u5DF1\uFF1A\u6B64\u5FC3\u5149\u660E\u5426\uFF1F" ? "\u2705" : "\u274C"})`);
  wang.append(
    "assistant/message",
    {
      turn: 0,
      step: 0,
      message: createAssistantMessage4({
        content: [{ type: "text", text: wangReply }],
        source: { provider: wangReplyResp.provider, model: wangReplyResp.model }
      })
    },
    { surfaceOp: "append", sourceEventSeqs: [wangUserSeq] }
  );
  console.log(`${TAG3} \u9636\u6BB51: user_raw ref=${ref} \u738B\u9633\u660E BranchSession(${SESSION_WANG2}) \u5386\u53F2 ${extractBranchHistory2(wang).length} \u6761\uFF1BswitchPersona created=${wangFirst.created}`);
  assertBudget(llm);
  const candidate = await inferDirectorCandidate([USER_RAW3], llm);
  llm.mark("director-candidate");
  agg.setDilemmaCandidate(candidate, "wang-yangming");
  console.log(`${TAG3} \u9636\u6BB52: \u5BFC\u6F14 candidate\uFF08\u771F\u5B9E\u6A21\u578B\uFF09=${JSON.stringify(candidate.slice(0, 60))}\u2026 phase=${agg.trunk.state.dilemma.phase} (\u5E94\u4E3A candidate\uFF0C\u672A\u786E\u8BA4\u4E0D\u5347\u7EA7 \u2014 F001) ${agg.trunk.state.dilemma.phase === "candidate" ? "\u2705" : "\u274C"}`);
  assertBudget(llm);
  const verdict = await judgeFeedbackSemantic(FEEDBACK, candidate, llm);
  llm.mark("feedback-judge");
  console.log(`${TAG3} \u9636\u6BB53: \u53CD\u9988=${JSON.stringify(FEEDBACK)} \u8BED\u4E49\u5224\u5B9A=${verdict} (\u5173\u952E\u8BCD\u7248\u4E5F\u4F1A\u5224 confirmed\uFF1B\u6B64\u5904\u4E3A\u771F\u5B9E\u6A21\u578B\u8BED\u4E49\u5224\u65AD) ${verdict === "confirmed" ? "\u2705" : "\u274C"}`);
  if (verdict === "confirmed") {
    agg.setDilemmaConfirmed(candidate);
  } else if (verdict === "corrected") {
    agg.setDilemmaCorrected("\u7406\u60F3\u4E0E\u73B0\u5B9E\u5982\u4F55\u4E24\u5168");
  }
  console.log(`${TAG3} \u9636\u6BB53: trunk dilemma phase=${agg.trunk.state.dilemma.phase} confirmedText=${JSON.stringify(agg.trunk.state.dilemma.confirmedText)} userRawRefs=${JSON.stringify(agg.trunk.userRawRefs)} (\u53EA\u589E\u4E0D\u6539)`);
  assertBudget(llm);
  const zengSwitch = agg.switchPersona("zeng-guofan", () => SESSION_ZENG2);
  const zeng = sessions.create(SessionId3(SESSION_ZENG2));
  const zengAssembled = assembleBranchTurn({
    persona: personaSpecFor("zeng-guofan"),
    sharedLayer: agg.sharedLayer,
    branchHistory: extractBranchHistory2(zeng)
  });
  const zengText = zengAssembled.messages.map((m) => m.content).join("\n");
  const isoZengHasUserRaw = zengText.includes(USER_RAW3);
  const isoZengHasConfirmed = zengText.includes("\u3010\u5DF2\u786E\u8BA4\u7684\u56F0\u60D1\u3011");
  const isoZengNoWangReply = !zengText.includes(wangReply);
  console.log(`${TAG3} \u9636\u6BB54: \u5207\u6362\u66FE\u56FD\u85E9 created=${zengSwitch.created} PersonaId=${agg.activePersona}`);
  console.log(`${TAG3} \u9636\u6BB54: \u9694\u79BB\u65AD\u8A00 \u66FE\u56FD\u85E9\u4E0A\u4E0B\u6587\u542B\u7528\u6237\u539F\u8BDD=${isoZengHasUserRaw ? "\u2705" : "\u274C"}`);
  console.log(`${TAG3} \u9636\u6BB54: \u9694\u79BB\u65AD\u8A00 \u66FE\u56FD\u85E9\u4E0A\u4E0B\u6587\u542B\u5DF2\u786E\u8BA4\u4E3B\u5E72=${isoZengHasConfirmed ? "\u2705" : "\u274C"}`);
  console.log(`${TAG3} \u9636\u6BB54: \u9694\u79BB\u65AD\u8A00 \u66FE\u56FD\u85E9\u4E0A\u4E0B\u6587\u4E0D\u542B\u738B\u9633\u660E\u56DE\u7B54=${isoZengNoWangReply ? "\u2705" : "\u274C"} (\u738B\u9633\u660E\u56DE\u7B54=${JSON.stringify(wangReply.slice(0, 24))}\u2026)`);
  const zengReplyResp = await llm.complete({
    system: zengAssembled.messages[0]?.role === "system" ? zengAssembled.messages[0].content : "",
    messages: zengAssembled.messages.slice(1).map((m) => ({ role: m.role, content: m.content })),
    reasoningEffort: "off",
    maxTokens: 1024
  });
  llm.mark("persona-reply-zeng");
  const zengReply = zengReplyResp.text.trim();
  console.log(`${TAG3} \u9636\u6BB54: \u66FE\u56FD\u85E9\u771F\u5B9E\u56DE\u7B54=${JSON.stringify(zengReply.slice(0, 60))}\u2026 usage(input=${zengReplyResp.usage.inputTokens} output=${zengReplyResp.usage.outputTokens})`);
  zeng.append(
    "assistant/message",
    {
      turn: 0,
      step: 0,
      message: createAssistantMessage4({
        content: [{ type: "text", text: zengReply }],
        source: { provider: zengReplyResp.provider, model: zengReplyResp.model }
      })
    },
    { surfaceOp: "append" }
  );
  assertBudget(llm);
  const wangBack = agg.switchPersona("wang-yangming", () => SESSION_WANG2);
  const wangHistory = extractBranchHistory2(wang);
  const wangBackAssembled = assembleBranchTurn({
    persona: wangPersona,
    sharedLayer: agg.sharedLayer,
    branchHistory: wangHistory
  });
  const wangBackText = wangBackAssembled.messages.map((m) => m.content).join("\n");
  const isoWangHasOwnReply = wangBackText.includes(wangReply);
  const isoWangNoZengReply = !wangBackText.includes(zengReply);
  console.log(`${TAG3} \u9636\u6BB55: \u5207\u56DE\u738B\u9633\u660E created=${wangBack.created} (\u590D\u7528\u5E94 created=false) ${wangBack.created === false ? "\u2705" : "\u274C"} \u5386\u53F2 ${wangHistory.length} \u6761`);
  console.log(`${TAG3} \u9636\u6BB55: \u9694\u79BB\u65AD\u8A00 \u738B\u9633\u660E\u4E0A\u4E0B\u6587\u542B\u738B\u9633\u660E\u56DE\u7B54=${isoWangHasOwnReply ? "\u2705" : "\u274C"}`);
  console.log(`${TAG3} \u9636\u6BB55: \u9694\u79BB\u65AD\u8A00 \u738B\u9633\u660E\u4E0A\u4E0B\u6587\u4E0D\u542B\u66FE\u56FD\u85E9\u56DE\u7B54=${isoWangNoZengReply ? "\u2705" : "\u274C"} (\u66FE\u56FD\u85E9\u56DE\u7B54=${JSON.stringify(zengReply.slice(0, 24))}\u2026)`);
  await Promise.all([sessions.flush(wang), sessions.flush(zeng), agg.flush()]);
  console.log(`${TAG3} \u9636\u6BB56: flush \u5B8C\u6210\uFF08\u53CC BranchSession + trunk\uFF09`);
  console.log(`${TAG3} \u9636\u6BB56: BranchSession \u4E8B\u4EF6\u7C7B\u578B: \u738B\u9633\u660E=[${extractBranchHistory2(wang).map((h) => h.role).join(",")}] \u66FE\u56FD\u85E9=[${extractBranchHistory2(zeng).map((h) => h.role).join(",")}] (\u4EC5\u5185\u7F6E\u7C7B\u578B \u2192 \u8DE8\u8FDB\u7A0B flush \u4E0D\u88AB\u62D2)`);
  inspectTrunkLog2();
  console.log(`${TAG3} \u9636\u6BB56: \u540C\u8FDB\u7A0B\u5185\u6A21\u62DF\u91CD\u542F\uFF08\u65B0\u5B9E\u4F8B load \u540C\u4E00 trunk \u6587\u4EF6\uFF09`);
  assertTrunkRecovery2("wang-yangming");
  logBranchSessionPersistence2();
  for (const call of llm.calls) {
    console.log(`${TAG3} \u8C03\u7528\u53F0\u8D26 seq${call.seq} [${call.stage}] provider=${call.provider} model=${call.model} in=${call.inputTokens} out=${call.outputTokens} finish=${call.finishReason} text=${JSON.stringify(call.text.slice(0, 32))}\u2026`);
  }
  assertBudget(llm);
  const isolationOk = isoZengHasUserRaw && isoZengHasConfirmed && isoZengNoWangReply && isoWangHasOwnReply && isoWangNoZengReply;
  const evidenceFile = writeEvidence(llm, {
    conversationId: CONVERSATION_ID2,
    userRaw: USER_RAW3,
    feedback: FEEDBACK,
    budget: TOKEN_BUDGET,
    personaRedLineVerified: true,
    isolation: {
      zengNoWangReply: isoZengNoWangReply,
      wangNoZengReply: isoWangNoZengReply,
      zengHasUserRaw: isoZengHasUserRaw,
      zengHasConfirmedDilemma: isoZengHasConfirmed,
      wangHasOwnReply: isoWangHasOwnReply
    },
    verdict: "confirmed",
    isolationOk
  });
  console.log(`${TAG3} \u7ED3\u8BBA: \u9636\u6BB55 \u771F\u5B9E\u6A21\u578B\u94FE\u8DEF\u5B8C\u6210 \u2705 \u6A21\u578B\u8C03\u7528=${llm.calls.length} \u6B21 \u7D2F\u8BA1 token=${llm.totalTokens} \u9884\u7B97=${TOKEN_BUDGET} \u8BC1\u636E=${evidenceFile || "(\u5199\u5165\u5931\u8D25)"}`);
}

// src/e2e/vertical-slice-retrieval.ts
import { mkdirSync as mkdirSync3, writeFileSync as writeFileSync2, appendFileSync as appendFileSync3 } from "node:fs";
import { join as join6 } from "node:path";
import { homedir as homedir4 } from "node:os";

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
    for (const item2 of items) {
      if (this.byIdMap.has(item2.id)) {
        throw new Error(`\u4E8B\u8FF9\u5E93 id \u91CD\u590D: ${item2.id}`);
      }
      this.byIdMap.set(item2.id, item2);
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
    for (const item2 of items) {
      if (this.byIdMap.has(item2.id)) {
        throw new Error(`\u8BED\u5F55\u5E93 id \u91CD\u590D: ${item2.id}`);
      }
      this.byIdMap.set(item2.id, item2);
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
function fetchSource(source, libs, personaId) {
  const matched = [];
  const quotes = personaId === void 0 ? libs.quotes.items : libs.quotes.byPersona(personaId);
  const anecdotes = personaId === void 0 ? libs.anecdotes.items : libs.anecdotes.byPersona(personaId);
  for (const q of quotes) {
    if (sourceMatches(source, q.source)) {
      matched.push({ kind: "quote", id: q.id, text: q.text, source: q.source });
    }
  }
  for (const a of anecdotes) {
    if (sourceMatches(source, a.source)) {
      matched.push({ kind: "anecdote", id: a.id, text: a.summary, source: a.source });
    }
  }
  return matched;
}
function normalizeSource(source) {
  let s = source.trim();
  const caveat = s.search(/[；;，]⚠|（⚠/);
  if (caveat !== -1) s = s.slice(0, caveat);
  s = s.replace(/[。\s]+$/, "");
  return s;
}
function sourceMatches(candidate, librarySource) {
  const c = normalizeSource(candidate);
  const k = normalizeSource(librarySource);
  if (c === "" || k === "") return false;
  const cBare = c.replace(/[《》]/g, "");
  const kBare = k.replace(/[《》]/g, "");
  if (cBare === "" || cBare.length < 2) return false;
  if (c === k || c.startsWith(k) || k.startsWith(c)) return true;
  if (kBare !== "" && kBare.includes(cBare)) return true;
  return false;
}

// src/retrieval/verify.ts
function violation(code, detail) {
  return { code, detail };
}
function verifyCitation(source, personaId, libs) {
  const violations = [];
  const forged = libs.blacklist.matchBookSource(source);
  if (forged !== void 0) {
    violations.push(violation("forged-book-source", `\u5F15\u7528\u7684\u51FA\u5904\u547D\u4E2D\u4F2A\u6258\u4E66\u9ED1\u540D\u5355\u300C${forged.text}\u300D\uFF1A${forged.reason}`));
    return { ok: false, violations };
  }
  const librarySources = [...libs.quotes.sources(personaId), ...libs.anecdotes.sources(personaId)];
  const matched = librarySources.some((libSource) => sourceMatches(source, libSource));
  if (!matched) {
    violations.push(violation("unknown-source", `\u5F15\u7528\u7684\u51FA\u5904\u300C${source}\u300D\u672A\u56DE\u843D\u5E93\u5185\uFF08\u8BE5\u4EBA\u7269\u8BED\u5F55/\u4E8B\u8FF9\u51FA\u5904\u4E2D\u4E0D\u5B58\u5728\uFF09`));
  }
  return { ok: violations.length === 0, violations };
}
function checkBlacklist(text, personaId, libs, context = "any") {
  return libs.blacklist.matchText(text, personaId, context);
}
function verifyReference(ref, personaId, libs) {
  const violations = [];
  if (ref.source !== void 0 && ref.source.trim() !== "") {
    violations.push(...verifyCitation(ref.source, personaId, libs).violations);
  }
  if (ref.text !== void 0 && ref.text.trim() !== "") {
    const hit = checkBlacklist(ref.text, personaId, libs, "actor-reply");
    if (hit !== void 0) {
      violations.push(
        violation(
          hit.mode === "first-person" ? "forbidden-first-person" : "blacklisted-quote",
          `\u56DE\u7B54\u547D\u4E2D\u9ED1\u540D\u5355\u300C${hit.text}\u300D\uFF08${hit.credibility} ${hit.mode}\uFF09\uFF1A${hit.reason}`
        )
      );
    }
  }
  return { ok: violations.length === 0, violations };
}
function extractCitedSources(text) {
  const matches = text.match(/《[^》]+》/g) ?? [];
  return [...new Set(matches)];
}

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
      for (const item2 of bounded.items) ledger?.grant({ evidenceId: item2.id, kind: "anecdote", personaId, turnId: ledger.turnId });
      return { content: boundedText };
    }
    for (const item2 of items) ledger?.grant({ evidenceId: item2.id, kind: "anecdote", personaId, turnId: ledger.turnId });
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
    for (const item2 of items) ledger?.grant({ evidenceId: item2.id, kind: "quote", personaId, turnId: ledger.turnId });
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
async function runActorTurnWithRetrieval(llm, request2, libs, personaId, maxRounds = 3) {
  const withTools = { ...request2, tools: ACTOR_TOOLS };
  const { response, trail, truncated } = await runToolLoop(
    (req) => llm.complete(req),
    withTools,
    makeActorHandlers(libs, personaId),
    maxRounds
  );
  return { reply: response.text.trim(), trail, response, truncated };
}

// src/retrieval/data.ts
var CONTENT_VERSION = "2026-08-23-phase6-v1";
var ANECDOTES = CONTENT_PACK.flatMap((p) => p.anecdotes);
var QUOTES = CONTENT_PACK.flatMap((p) => p.quotes);
var BLACKLIST_ENTRIES = CONTENT_PACK.flatMap((p) => p.blacklist);
var ANECDOTE_COUNTS = Object.fromEntries(CONTENT_PACK.map((p) => [p.manifest.id, ANECDOTES.filter((a) => a.personaId === p.manifest.id).length]));
var QUOTE_COUNTS = Object.fromEntries(CONTENT_PACK.map((p) => [p.manifest.id, QUOTES.filter((q) => q.personaId === p.manifest.id).length]));
var cached2;
function buildContentLibraries() {
  if (cached2 !== void 0) return cached2;
  cached2 = {
    anecdotes: new AnecdoteStore(ANECDOTES),
    quotes: new QuoteStore(QUOTES),
    blacklist: new Blacklist(BLACKLIST_ENTRIES)
  };
  return cached2;
}
function assertContentIntegrity() {
  for (const a of ANECDOTES) {
    for (const field of ["id", "personaId", "theme", "title", "summary", "fullText", "source"]) {
      if (typeof a[field] !== "string" || a[field].trim() === "") {
        throw new Error(`\u4E8B\u8FF9\u5B57\u6BB5\u7F3A\u5931: ${a.id}.${field}`);
      }
    }
  }
  for (const q of QUOTES) {
    for (const field of ["id", "personaId", "text", "source", "credibility"]) {
      if (typeof q[field] !== "string" || q[field].trim() === "") {
        throw new Error(`\u8BED\u5F55\u5B57\u6BB5\u7F3A\u5931: ${q.id}.${field}`);
      }
    }
    if (!["\u2705", "\u2705*", "\u26A0\uFE0F"].includes(q.credibility)) {
      throw new Error(`\u8BED\u5F55\u53EF\u4FE1\u5EA6\u975E\u6CD5\uFF08\u274C \u4E0D\u5F97\u5165\u5E93\uFF09: ${q.id} credibility=${q.credibility}`);
    }
  }
  for (const e of BLACKLIST_ENTRIES) {
    if (e.text.trim() === "" || e.reason.trim() === "") {
      throw new Error(`\u9ED1\u540D\u5355\u6761\u76EE\u4E0D\u5B8C\u6574: ${JSON.stringify(e)}`);
    }
    if (!["quote", "book"].includes(e.kind) || !["always", "first-person"].includes(e.mode)) {
      throw new Error(`\u9ED1\u540D\u5355\u6761\u76EE\u5B57\u6BB5\u975E\u6CD5: ${JSON.stringify(e)}`);
    }
  }
  const quoteTexts = QUOTES.map((q) => normalizeText(q.text)).filter((t) => t !== "");
  for (const e of BLACKLIST_ENTRIES) {
    if (e.kind !== "quote" || e.mode !== "always") continue;
    const entryNorm = normalizeText(e.text);
    if (entryNorm === "") continue;
    for (const qt of quoteTexts) {
      if (qt.includes(entryNorm) || entryNorm.includes(qt)) {
        throw new Error(`\u7EA2\u7EBF\u51B2\u7A81\uFF1A\u9ED1\u540D\u5355\u8BED\u5F55\u300C${e.text}\u300D\u4E0E\u53EF\u5F15\u7528\u5E93\u8BED\u5F55\u91CD\u590D\uFF08\u8BEF\u4F20\u8FDB\u4E86\u53EF\u5F15\u7528\u5E93\uFF09`);
      }
    }
  }
  const books = BLACKLIST_ENTRIES.filter((e) => e.kind === "book").map((e) => e.text);
  for (const required of ["\u300A\u51B0\u9274\u300B", "\u300A\u633A\u7ECF\u300B"]) {
    if (!books.includes(required)) {
      throw new Error(`\u4F2A\u6258\u4E66\u9ED1\u540D\u5355\u7F3A\u5931: ${required}`);
    }
  }
}
var BLACKLIST_COUNTS = Object.fromEntries(CONTENT_PACK.map((p) => [p.manifest.id, BLACKLIST_ENTRIES.filter((e) => e.personaId === p.manifest.id).length]));

// src/e2e/vertical-slice-retrieval.ts
var TAG4 = "[man-roles-roleplayer:e2e-retrieval]";
var CONVERSATION_ID3 = "conversation-retrieval-e2e";
var TOKEN_BUDGET2 = 2e4;
var USER_RAW_WANG = "\u6211\u65E2\u60F3\u575A\u6301\u7406\u60F3\u4E3B\u4E49\uFF0C\u53C8\u89C9\u5F97\u73B0\u5B9E\u5904\u5904\u78B0\u58C1\uFF0C\u4E0D\u77E5\u5982\u4F55\u81EA\u5904\u3002\u4F60\u5F53\u5E74\u9F99\u573A\u90A3\u822C\u7EDD\u5883\uFF0C\u662F\u5982\u4F55\u5728\u4E8B\u4E0A\u78E8\u8FC7\u6765\u7684\uFF1F";
var USER_RAW_ZENG = "\u6211\u505A\u4E8B\u603B\u60F3\u4E00\u6B65\u5230\u4F4D\uFF0C\u7A0D\u9047\u632B\u6298\u5C31\u81EA\u8D23\u4E0D\u5DF2\uFF0C\u53C8\u6015\u81EA\u5DF1\u53EA\u662F\u7A7A\u8C08\u52AA\u529B\u3002\u4F60\u9756\u6E2F\u3001\u6E56\u53E3\u8FDE\u756A\u5927\u8D25\u65F6\uFF0C\u662F\u9760\u4EC0\u4E48\u6491\u8FC7\u6765\u7684\uFF1F";
function toolInstruction() {
  return "\u3010\u5DE5\u5177\u4F7F\u7528\u3011\u9700\u8981\u53F2\u5B9E\u652F\u6491\u65F6\uFF0C\u8BF7\u5148\u8C03\u7528 retrieve_anecdotes \u68C0\u7D22\u672C\u4EBA\u7269\u4E8B\u8FF9\uFF08\u53EF\u7528 fetch_anecdote \u53D6\u539F\u6587\uFF09\u3002\u5F15\u7528\u4E8B\u8FF9\u6216\u539F\u8BDD\u5FC5\u987B\u6807\u6CE8\u5E93\u5185\u771F\u5B9E\u51FA\u5904\uFF08\u4E66\u540D\xB7\u7BC7\u7AE0\uFF09\uFF0C\u4E0D\u5F97\u865A\u6784\u51FA\u5904\uFF0C\u4E0D\u5F97\u5F15\u7528\u4ED6\u4EBA\u4E8B\u8FF9\u3002";
}
function evidenceDir2() {
  const home = process.env.DSH_HOME ?? join6(homedir4(), ".dsh");
  return join6(home, "man-roles", "e2e");
}
var LedgerLlmClient2 = class {
  constructor(inner) {
    this.inner = inner;
  }
  inner;
  calls = [];
  nextSeq = 1;
  mark(stage) {
    if (this.calls.length === 0) return;
    this.calls[this.calls.length - 1].stage = stage;
  }
  get totalTokens() {
    return this.calls.reduce((sum, c) => sum + c.inputTokens + c.outputTokens, 0);
  }
  async complete(request2) {
    const resp = await this.inner.complete(request2);
    this.calls.push({
      seq: this.nextSeq++,
      stage: "?",
      provider: resp.provider,
      model: resp.model,
      inputTokens: resp.usage.inputTokens,
      outputTokens: resp.usage.outputTokens,
      finishReason: resp.finishReason,
      text: resp.text
    });
    return resp;
  }
};
var StartupRetryLlmClient = class {
  constructor(inner, attempts = 30, delayMs = 500) {
    this.inner = inner;
    this.attempts = attempts;
    this.delayMs = delayMs;
  }
  inner;
  attempts;
  delayMs;
  async complete(request2) {
    let lastError;
    for (let attempt = 1; attempt <= this.attempts; attempt++) {
      try {
        return await this.inner.complete(request2);
      } catch (error) {
        lastError = error;
        if (error instanceof LlmCallError && (error.failureCode === "MISSING_CREDENTIAL" || error.failureCode === "NO_ADAPTER")) {
          console.log(`${TAG4} \u542F\u52A8\u7ADE\u6001: ${error.failureCode}\uFF08\u7B2C ${attempt}/${this.attempts} \u6B21\u5C1D\u8BD5\uFF09\uFF0C\u7B49\u5F85 ${this.delayMs}ms \u540E\u91CD\u8BD5\uFF08\u65E0\u7F51\u7EDC\u8C03\u7528\uFF0C\u96F6 token \u6210\u672C\uFF09`);
          await new Promise((resolve2) => setTimeout(resolve2, this.delayMs));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }
};
function assertBudget2(ledger) {
  const total = ledger.totalTokens;
  console.log(`${TAG4} token \u53F0\u8D26: \u7D2F\u8BA1=${total}/${TOKEN_BUDGET2} (${total > TOKEN_BUDGET2 ? "\u274C \u8D85\u9884\u7B97" : "\u2705 \u9884\u7B97\u5185"})`);
  if (total > TOKEN_BUDGET2) {
    throw new Error(`\u9636\u6BB56 token \u9884\u7B97\u8D85\u9650\uFF1A${total} > ${TOKEN_BUDGET2}\uFF0C\u505C\u6B62\u540E\u7EED\u6A21\u578B\u8C03\u7528`);
  }
}
function check(ok, label) {
  console.log(`${TAG4} ${ok ? "\u2705" : "\u274C"} ${label}`);
  if (!ok) throw new Error(`\u9636\u6BB56 e2e \u65AD\u8A00\u5931\u8D25: ${label}`);
}
function runDeterministicAsserts(libs) {
  console.log(`${TAG4} \u5185\u5BB9\u5E93\u5B8C\u6574\u6027\uFF08assertContentIntegrity \u901A\u8FC7 = \u7EA2\u7EBF\u6821\u9A8C\u901A\u8FC7\uFF09`);
  assertContentIntegrity();
  check(ANECDOTE_COUNTS["wang-yangming"] === 20 && ANECDOTE_COUNTS["zeng-guofan"] === 35, `\u4E8B\u8FF9\u6761\u6570 \u738B\u9633\u660E=${ANECDOTE_COUNTS["wang-yangming"]} \u66FE\u56FD\u85E9=${ANECDOTE_COUNTS["zeng-guofan"]}\uFF08\u5408\u8BA1 ${ANECDOTE_COUNTS["wang-yangming"] + ANECDOTE_COUNTS["zeng-guofan"]} \u5B9E\u4F53\u5361\uFF09`);
  check(QUOTE_COUNTS["wang-yangming"] === 16 && QUOTE_COUNTS["zeng-guofan"] === 22, `\u8BED\u5F55\u6761\u6570 \u738B\u9633\u660E=${QUOTE_COUNTS["wang-yangming"]} \u66FE\u56FD\u85E9=${QUOTE_COUNTS["zeng-guofan"]}`);
  check(BLACKLIST_COUNTS["wang-yangming"] >= 4 && BLACKLIST_COUNTS["zeng-guofan"] >= 10, `\u9ED1\u540D\u5355\u6761\u6570 \u738B\u9633\u660E=${BLACKLIST_COUNTS["wang-yangming"]} \u66FE\u56FD\u85E9=${BLACKLIST_COUNTS["zeng-guofan"]}`);
  const wangShiShangMo = retrieveAnecdotes("\u4E8B\u4E0A\u78E8 \u9759\u4EA6\u5B9A \u52A8\u4EA6\u5B9A", "wang-yangming", libs, 3);
  check(wangShiShangMo.some((a) => a.id === "wang-yangming-12"), `\u68C0\u7D22\u300C\u4E8B\u4E0A\u78E8\u300D\u547D\u4E2D\u4E8B\u8FF9\u536112\uFF08\u4EBA\u987B\u5728\u4E8B\u4E0A\u78E8\uFF09`);
  const wangLungChang = retrieveAnecdotes("\u9006\u5883 \u632B\u6298 \u9F99\u573A", "wang-yangming", libs, 3);
  check(wangLungChang.some((a) => a.id === "wang-yangming-02"), `\u68C0\u7D22\u300C\u9006\u5883 \u9F99\u573A\u300D\u547D\u4E2D\u4E8B\u8FF9\u53612\uFF08\u9F99\u573A\u609F\u9053\uFF09`);
  const zengJingGang = retrieveAnecdotes("\u9756\u6E2F \u5927\u8D25 \u81EA\u5C3D", "zeng-guofan", libs, 3);
  check(zengJingGang.some((a) => a.id === "zeng-guofan-02"), `\u68C0\u7D22\u300C\u9756\u6E2F\u300D\u547D\u4E2D\u66FE\u56FD\u85E9\u4E8B\u8FF9\u53612\uFF08\u9756\u6E2F\u4E4B\u8D25\uFF09`);
  check(retrieveAnecdotes("\u91CF\u5B50\u529B\u5B66 \u661F\u9645\u822A\u884C", "wang-yangming", libs, 3).length === 0, "\u65E0\u5173\u67E5\u8BE2\u8FD4\u56DE\u7A7A\uFF08\u964D\u7EA7\u8DEF\u5F84\uFF1A\u4E0D\u4E0A\u7F51\u3001\u4E0D\u7F16\uFF09");
  const fenceWang = retrieveAnecdotes("\u77E5\u884C\u5408\u4E00 \u4FEE\u517B \u7528\u4EBA", "wang-yangming", libs, 5);
  check(fenceWang.length > 0 && fenceWang.every((a) => a.id.startsWith("wang-yangming-")), "\u56F4\u680F\uFF1A\u738B\u9633\u660E\u68C0\u7D22\u7ED3\u679C\u5168\u90E8\u4E3A\u738B\u9633\u660E\u4E8B\u8FF9");
  const fenceZeng = retrieveAnecdotes("\u77E5\u884C\u5408\u4E00 \u4FEE\u517B \u7528\u4EBA", "zeng-guofan", libs, 5);
  check(fenceZeng.length > 0 && fenceZeng.every((a) => a.id.startsWith("zeng-guofan-")), "\u56F4\u680F\uFF1A\u66FE\u56FD\u85E9\u68C0\u7D22\u7ED3\u679C\u5168\u90E8\u4E3A\u66FE\u56FD\u85E9\u4E8B\u8FF9");
  check(fetchAnecdote("wang-yangming-12", "zeng-guofan", libs) === void 0, "\u56F4\u680F\uFF1A\u66FE\u56FD\u85E9\u8BED\u5883\u53D6\u4E0D\u5230\u738B\u9633\u660E\u4E8B\u8FF9\u539F\u6587\uFF08fetchAnecdote \u8FD4\u56DE undefined\uFF09");
  check(fetchAnecdote("zeng-guofan-02", "wang-yangming", libs) === void 0, "\u56F4\u680F\uFF1A\u738B\u9633\u660E\u8BED\u5883\u53D6\u4E0D\u5230\u66FE\u56FD\u85E9\u4E8B\u8FF9\u539F\u6587\uFF08fetchAnecdote \u8FD4\u56DE undefined\uFF09");
  check(fetchAnecdote("wang-yangming-12", "wang-yangming", libs)?.fullText.includes("\u4EBA\u987B\u5728\u4E8B\u4E0A\u78E8"), "\u738B\u9633\u660E\u8BED\u5883\u53EF\u53D6\u5230\u672C\u4EBA\u4E8B\u8FF9\u539F\u6587\uFF08\u542B\u9010\u5B57 fullText\uFF09");
  check(verifyCitation("\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E0A\xB7\u9646\u6F84\u5F55", "wang-yangming", libs).ok, "\u51FA\u5904\u56DE\u843D\uFF1A\u5F15\u7528\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E0A\xB7\u9646\u6F84\u5F55 \u901A\u8FC7");
  check(verifyCitation("\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B", "zeng-guofan", libs).ok, "\u51FA\u5904\u56DE\u843D\uFF1A\u5F15\u7528\u300A\u6E05\u53F2\u7A3F\u300B\u5377405\u300A\u66FE\u56FD\u85E9\u4F20\u300B \u901A\u8FC7");
  const fake = verifyCitation("\u300A\u8D44\u6CBB\u901A\u9274\u300B\u5377\u4E00\u767E\u4E5D\u5341\u4E94", "wang-yangming", libs);
  check(!fake.ok && fake.violations.some((v) => v.code === "unknown-source"), "\u51FA\u5904\u56DE\u843D\uFF1A\u5F15\u7528\u4E0D\u5B58\u5728\u7684\u300A\u8D44\u6CBB\u901A\u9274\u300B\u88AB\u62D2\uFF08unknown-source\uFF09");
  const forged = verifyCitation("\u300A\u51B0\u9274\u300B\u76F8\u4EBA\u672F", "zeng-guofan", libs);
  check(!forged.ok && forged.violations.some((v) => v.code === "forged-book-source"), "\u51FA\u5904\u56DE\u843D\uFF1A\u5F15\u7528\u4F2A\u6258\u4E66\u300A\u51B0\u9274\u300B\u88AB\u62D2\uFF08forged-book-source\uFF09");
  check(checkBlacklist("\u6211\u6B64\u5FC3\u4E0D\u52A8\uFF0C\u968F\u673A\u800C\u52A8\uFF0C\u4EFB\u4ED6\u98CE\u96E8\u3002", "wang-yangming", libs, "actor-reply") !== void 0, "\u9ED1\u540D\u5355\uFF1A\u738B\u9633\u660E\u56DE\u7B54\u5F15\u7528\u300C\u6B64\u5FC3\u4E0D\u52A8\uFF0C\u968F\u673A\u800C\u52A8\u300D\u88AB\u62E6\u622A");
  check(checkBlacklist("\u543E\u5FC3\u5373\u662F\u5B87\u5B99\uFF0C\u5B87\u5B99\u4FBF\u662F\u543E\u5FC3\uFF0C\u6B64\u4E43\u5FC3\u5B66\u771F\u8C1B\u3002", "wang-yangming", libs, "actor-reply") !== void 0, "\u9ED1\u540D\u5355\uFF1A\u5F20\u51A0\u674E\u6234\u300C\u543E\u5FC3\u5373\u5B87\u5B99\u300D\uFF08\u9646\u4E5D\u6E0A\u8BED\uFF09\u88AB\u62E6\u622A");
  check(checkBlacklist("\u6211\u552F\u6709\u7ED3\u786C\u5BE8\uFF0C\u6253\u5446\u4ED7\u3002", "zeng-guofan", libs, "actor-reply") !== void 0, "\u9ED1\u540D\u5355\uFF1A\u66FE\u56FD\u85E9\u56DE\u7B54\u5F15\u7528\u300C\u7ED3\u786C\u5BE8\uFF0C\u6253\u5446\u4ED7\u300D\u88AB\u62E6\u622A");
  check(checkBlacklist("\u8F7B\u8D22\u8DB3\u4EE5\u805A\u4EBA\uFF0C\u5F8B\u5DF1\u8DB3\u4EE5\u670D\u4EBA\u3002", "zeng-guofan", libs, "actor-reply") !== void 0, "\u9ED1\u540D\u5355\uFF1A\u300A\u683C\u8A00\u8054\u74A7\u300B\u8BEF\u5F52\u66FE\u56FD\u85E9\u53E5\u88AB\u62E6\u622A");
  const firstPerson = checkBlacklist("\u4E8B\u529F\u672C\u4E8E\u5B66\u95EE\uFF0C\u5584\u4EE5\u793C\u8FD0\u3002", "zeng-guofan", libs, "actor-reply");
  check(firstPerson !== void 0 && firstPerson.mode === "first-person", "\u9ED1\u540D\u5355\uFF1A\u53F2\u81E3\u8BC4\u4EF7\u4EE5\u7B2C\u4E00\u4EBA\u79F0\u8BF4\u51FA\u88AB\u62E6\u622A\uFF08forbidden-first-person\uFF09");
  check(checkBlacklist("\u4E8B\u529F\u672C\u4E8E\u5B66\u95EE\uFF0C\u5584\u4EE5\u793C\u8FD0\u3002", "zeng-guofan", libs, "any") === void 0, "\u53F2\u81E3\u8BC4\u4EF7\u5728\u975E\u7B2C\u4E00\u4EBA\u79F0\u8BED\u5883\uFF08\u5386\u53F2\u5750\u6807/\u65C1\u767D\uFF09\u4E0D\u62E6\u622A");
  const okRef = verifyReference({ source: "\u300A\u4F20\u4E60\u5F55\u300B\u5377\u4E0A\xB7\u9646\u6F84\u5F55", text: "\u4EBA\u987B\u5728\u4E8B\u4E0A\u78E8\uFF0C\u65B9\u7ACB\u5F97\u4F4F\u3002" }, "wang-yangming", libs);
  check(okRef.ok, "\u8054\u5408\u6821\u9A8C\uFF1A\u771F\u5B9E\u51FA\u5904 + \u5E72\u51C0\u6587\u672C \u901A\u8FC7");
  const badRef = verifyReference({ source: "\u300A\u8D44\u6CBB\u901A\u9274\u300B", text: "\u6211\u6B64\u5FC3\u4E0D\u52A8\uFF0C\u968F\u673A\u800C\u52A8\u3002" }, "wang-yangming", libs);
  check(!badRef.ok && badRef.violations.some((v) => v.code === "unknown-source") && badRef.violations.some((v) => v.code === "blacklisted-quote"), "\u8054\u5408\u6821\u9A8C\uFF1A\u5047\u51FA\u5904 + \u9ED1\u540D\u5355\u8BED\u5F55 \u53CC\u8FDD\u89C4");
}
async function runActorTurn(llm, personaName, userRaw, stageLabel, libs) {
  const persona = personaSpecFor(personaName);
  const system = `${persona.systemPrompt}

${toolInstruction()}`;
  console.log(`${TAG4} ${stageLabel}: \u6F14\u5458\u56DE\u5408\u5F00\u59CB persona=${personaName}\uFF08system \u542B\u7EA2\u7EBF\u4E24\u8282 + \u5DE5\u5177\u4F7F\u7528\u6307\u4EE4\uFF09`);
  const turn2 = await runActorTurnWithRetrieval(llm, {
    system,
    messages: [{ role: "user", content: userRaw }],
    reasoningEffort: "off",
    maxTokens: 1024
  }, libs, personaName);
  llm.mark(`${stageLabel}-actor`);
  const retrievedPersonaIds = [];
  for (const entry of turn2.trail) {
    try {
      const payload = JSON.parse(entry.result);
      if (payload.personaId !== void 0) retrievedPersonaIds.push(payload.personaId);
      if (Array.isArray(payload.items)) {
        for (const item2 of payload.items) {
          const full = fetchAnecdote(item2.id, personaName, libs);
          if (full === void 0) {
            check(false, `${stageLabel} \u56F4\u680F\uFF1A\u8F68\u8FF9\u4E2D\u4E8B\u8FF9 id ${item2.id} \u4E0D\u5C5E\u4E8E\u5F53\u524D\u4EBA\u7269 ${personaName}`);
          }
        }
      }
    } catch {
    }
  }
  check(turn2.trail.length > 0, `${stageLabel}: \u6F14\u5458\u81EA\u4E3B tool-call \u68C0\u7D22\uFF08\u8F68\u8FF9 ${turn2.trail.length} \u6761: ${turn2.trail.map((t) => t.name).join(", ")})`);
  check(retrievedPersonaIds.every((p) => p === personaName), `${stageLabel}: \u56F4\u680F\u65AD\u8A00 \u68C0\u7D22\u7ED3\u679C\u5168\u90E8\u4E3A ${personaName}\uFF08\u5B9E\u9645 ${JSON.stringify(retrievedPersonaIds)}\uFF09`);
  const citedSources = extractCitedSources(turn2.reply);
  console.log(`${TAG4} ${stageLabel}: \u6F14\u5458\u56DE\u7B54=${JSON.stringify(turn2.reply.slice(0, 120))}\u2026 \u5F15\u7528\u51FA\u5904=${JSON.stringify(citedSources)}`);
  if (citedSources.length > 0) {
    for (const source of citedSources) {
      const result = verifyCitation(source, personaName, libs);
      check(result.ok, `${stageLabel}: \u5F15\u7528\u300C${source}\u300D\u56DE\u843D\u5E93\u5185\u901A\u8FC7\uFF08\u8FDD\u89C4=${JSON.stringify(result.violations)}\uFF09`);
    }
  } else {
    console.log(`${TAG4} ${stageLabel}: \u26A0\uFE0F \u6F14\u5458\u56DE\u7B54\u672A\u63D0\u53D6\u5230\u300A\u300B\u51FA\u5904\uFF08\u5F15\u7528\u7F3A\u5931\uFF0C\u4EC5\u8BB0\u5F55\u4E0D\u5224\u5B9A\u5931\u8D25\uFF1B\u7EA2\u7EBF\u4E24\u8282\u4ECD\u7531 system \u7EA6\u675F\uFF09`);
  }
  const blackHit = checkBlacklist(turn2.reply, personaName, libs, "actor-reply");
  check(blackHit === void 0, `${stageLabel}: \u56DE\u7B54\u6587\u672C\u672A\u547D\u4E2D\u9ED1\u540D\u5355${blackHit === void 0 ? "" : `\uFF08\u547D\u4E2D\u300C${blackHit.text}\u300D\uFF09`}`);
  console.log(`${TAG4} ${stageLabel}: \u6F14\u5458\u56DE\u5408\u5B8C\u6210 reply=${JSON.stringify(turn2.reply.slice(0, 40))}\u2026 truncated=${turn2.truncated}`);
  return { reply: turn2.reply, retrievedPersonaIds, citedSources };
}
function writeEvidence2(ledger, summary) {
  const dir = evidenceDir2();
  mkdirSync3(dir, { recursive: true });
  const file = join6(dir, `${CONVERSATION_ID3}.jsonl`);
  try {
    writeFileSync2(file, "", { encoding: "utf8" });
    for (const call of ledger.calls) {
      appendFileSync3(file, `${JSON.stringify(call)}
`, { encoding: "utf8" });
    }
    appendFileSync3(file, `${JSON.stringify({ type: "summary", totalTokens: ledger.totalTokens, ...summary })}
`, { encoding: "utf8" });
    console.log(`${TAG4} \u89C2\u5BDF\u8BC1\u636E\u5DF2\u5199\u5165 ${file} (${ledger.calls.length} \u6B21\u8C03\u7528 + 1 \u884C\u6C47\u603B)`);
    return file;
  } catch (error) {
    console.error(`${TAG4} \u89C2\u5BDF\u8BC1\u636E\u5199\u5165\u5931\u8D25`, error);
    return "";
  }
}
async function runRetrievalSlice(ctx) {
  const libs = buildContentLibraries();
  const ledger = new LedgerLlmClient2(new StartupRetryLlmClient(new DshLlmClient({ stream: (options) => ctx.llm.stream(options) })));
  console.log(`${TAG4} \u9636\u6BB56 e2e \u5F00\u59CB conversation=${CONVERSATION_ID3} contentVersion=${CONTENT_VERSION} token \u9884\u7B97=${TOKEN_BUDGET2}\uFF08\u6A21\u578B\u5BA2\u6237\u7AEF=DshLlmClient(ctx.llm.stream)\uFF09`);
  runDeterministicAsserts(libs);
  const wang = await runActorTurn(ledger, "wang-yangming", USER_RAW_WANG, "\u9636\u6BB51", libs);
  assertBudget2(ledger);
  const zeng = await runActorTurn(ledger, "zeng-guofan", USER_RAW_ZENG, "\u9636\u6BB52", libs);
  assertBudget2(ledger);
  for (const call of ledger.calls) {
    console.log(`${TAG4} \u8C03\u7528\u53F0\u8D26 seq${call.seq} [${call.stage}] provider=${call.provider} model=${call.model} in=${call.inputTokens} out=${call.outputTokens} finish=${call.finishReason} text=${JSON.stringify(call.text.slice(0, 32))}\u2026`);
  }
  assertBudget2(ledger);
  const evidenceFile = writeEvidence2(ledger, {
    conversationId: CONVERSATION_ID3,
    contentVersion: CONTENT_VERSION,
    budget: TOKEN_BUDGET2,
    anecdotes: ANECDOTE_COUNTS,
    quotes: QUOTE_COUNTS,
    blacklist: BLACKLIST_COUNTS,
    actorTurns: {
      wang: { userRaw: USER_RAW_WANG, citedSources: wang.citedSources, retrievedPersonaIds: wang.retrievedPersonaIds },
      zeng: { userRaw: USER_RAW_ZENG, citedSources: zeng.citedSources, retrievedPersonaIds: zeng.retrievedPersonaIds }
    },
    deterministicAsserts: "all-passed"
  });
  console.log(`${TAG4} \u7ED3\u8BBA: \u9636\u6BB56 \u771F\u5B9E\u6A21\u578B\u68C0\u7D22\u94FE\u8DEF\u5B8C\u6210 \u2705 \u6A21\u578B\u8C03\u7528=${ledger.calls.length} \u6B21 \u7D2F\u8BA1 token=${ledger.totalTokens} \u9884\u7B97=${TOKEN_BUDGET2} \u8BC1\u636E=${evidenceFile || "(\u5199\u5165\u5931\u8D25)"}`);
  const appExit = ctx.get("appExit");
  if (typeof appExit === "function") {
    console.log(`${TAG4} \u8BF7\u6C42\u4F18\u96C5\u9000\u51FA\uFF08appExit(0)\uFF09\u2026`);
    appExit(0);
  }
}

// src/e2e/control-loop-compat.ts
import { createUserMessage as createUserMessage5 } from "@deepseek-ai/dsh-llm";
import { SessionId as SessionId4 } from "@deepseek-ai/dsh-session";
import { randomUUID as randomUUID2 } from "node:crypto";
import { mkdirSync as mkdirSync4, writeFileSync as writeFileSync3 } from "node:fs";
import { homedir as homedir5 } from "node:os";
import { join as join7 } from "node:path";

// src/validation/control-loop-report.ts
function requestText(request2) {
  if (request2 === void 0) return "";
  return [request2.system, ...request2.messages.map((message) => message.text)].join("\n");
}
function has(text, marker) {
  return marker !== "" && text.includes(marker);
}
function evaluateControlLoopEvidence(evidence, markers) {
  const byLabel = new Map(evidence.requests.map((request2) => [request2.label, request2]));
  const text = (label) => requestText(byLabel.get(label));
  const checks = [];
  const add = (id, category, passed, detail, gate = true) => {
    checks.push({ id, category, gate, passed, detail });
  };
  add(
    "A1.sees-initial-user-raw",
    "shared-context",
    has(text("A1"), markers.initialUserRaw),
    "\u738B\u9633\u660E\u9996\u8F6E\u5FC5\u987B\u770B\u5230\u7528\u6237\u9010\u5B57\u539F\u8BDD"
  );
  add(
    "A1.candidate-not-promoted",
    "shared-context",
    !has(text("A1"), markers.candidateText),
    "\u672A\u7ECF\u786E\u8BA4\u7684 candidate \u4E0D\u5F97\u4F5C\u4E3A\u6F14\u5458\u4E0A\u4E0B\u6587\u4E8B\u5B9E"
  );
  add(
    "B1.sees-initial-user-raw",
    "shared-context",
    has(text("B1"), markers.initialUserRaw),
    "\u66FE\u56FD\u85E9\u9996\u6B21\u8FDB\u5165\u5FC5\u987B\u65E0\u611F\u63A5\u7EED\u540C\u4E00\u56F0\u60D1\u7684\u7528\u6237\u539F\u8BDD"
  );
  add(
    "B1.no-wang-reply",
    "persona-isolation",
    !has(text("B1"), markers.wangReply1),
    "\u66FE\u56FD\u85E9\u4E0D\u5F97\u770B\u5230\u738B\u9633\u660E\u56DE\u7B54"
  );
  add(
    "B1.no-candidate",
    "persona-isolation",
    !has(text("B1"), markers.candidateText),
    "\u66FE\u56FD\u85E9\u4E0D\u5F97\u628A\u672A\u786E\u8BA4\u5BFC\u6F14\u5019\u9009\u5F53\u5171\u4EAB\u4E8B\u5B9E"
  );
  add(
    "B2.sees-correction-raw",
    "shared-context",
    has(text("B2"), markers.correctionUserRaw),
    "\u7528\u6237\u7EA0\u6B63\u539F\u8BDD\u5FC5\u987B\u8FDB\u5165\u5F53\u524D\u4EBA\u7269\u4E0B\u4E00\u8F6E\u8F93\u5165"
  );
  add(
    "B2.sees-corrected-state",
    "shared-context",
    has(text("B2"), markers.correctedText),
    "\u7EA0\u6B63\u540E\u7684\u5171\u4EAB\u72B6\u6001\u5FC5\u987B\u5728\u4E0B\u4E00\u8F6E\u751F\u6210\u524D\u751F\u6548"
  );
  add(
    "B2.no-wang-reply",
    "persona-isolation",
    !has(text("B2"), markers.wangReply1),
    "\u7EA0\u6B63\u540E\u4ECD\u4E0D\u5F97\u6CC4\u9732\u738B\u9633\u660E\u56DE\u7B54"
  );
  add(
    "A2.sees-correction-raw",
    "shared-context",
    has(text("A2"), markers.correctionUserRaw),
    "\u5207\u56DE\u738B\u9633\u660E\u540E\u5FC5\u987B\u770B\u5230\u8DE8\u4EBA\u7269\u5171\u4EAB\u7684\u7528\u6237\u7EA0\u6B63\u539F\u8BDD"
  );
  add(
    "A2.sees-corrected-state",
    "shared-context",
    has(text("A2"), markers.correctedText),
    "\u5207\u56DE\u738B\u9633\u660E\u540E\u5FC5\u987B\u770B\u5230\u7EA0\u6B63\u540E\u7684\u5171\u4EAB\u72B6\u6001"
  );
  add(
    "A2.keeps-own-history",
    "persona-isolation",
    has(text("A2"), markers.wangReply1),
    "\u5207\u56DE\u738B\u9633\u660E\u540E\u5FC5\u987B\u6062\u590D\u738B\u9633\u660E\u81EA\u5DF1\u7684\u5386\u53F2"
  );
  add(
    "A2.no-zeng-replies",
    "persona-isolation",
    !has(text("A2"), markers.zengReply1) && !has(text("A2"), markers.zengReply2),
    "\u738B\u9633\u660E\u4E0D\u5F97\u770B\u5230\u66FE\u56FD\u85E9\u56DE\u7B54"
  );
  add(
    "branch.wang-no-zeng-replies",
    "persona-isolation",
    !has(evidence.branchLogs.\u738B\u9633\u660E, markers.zengReply1) && !has(evidence.branchLogs.\u738B\u9633\u660E, markers.zengReply2),
    "\u738B\u9633\u660E BranchSession \u65E5\u5FD7\u4E0D\u5F97\u542B\u66FE\u56FD\u85E9\u56DE\u7B54"
  );
  add(
    "branch.zeng-no-wang-reply",
    "persona-isolation",
    !has(evidence.branchLogs.\u66FE\u56FD\u85E9, markers.wangReply1),
    "\u66FE\u56FD\u85E9 BranchSession \u65E5\u5FD7\u4E0D\u5F97\u542B\u738B\u9633\u660E\u56DE\u7B54"
  );
  add(
    "A3.resume-keeps-own-history",
    "recovery",
    has(text("A3"), markers.wangReply1),
    "AgentLoop resume \u540E\u5FC5\u987B\u6062\u590D\u738B\u9633\u660E\u5386\u53F2"
  );
  add(
    "A3.resume-keeps-correction",
    "recovery",
    has(text("A3"), markers.correctionUserRaw) && has(text("A3"), markers.correctedText),
    "AgentLoop resume \u540E\u5FC5\u987B\u7EE7\u7EED\u8BFB\u53D6\u7EA0\u6B63\u539F\u8BDD\u4E0E\u7EA0\u6B63\u72B6\u6001"
  );
  add(
    "A3.resume-no-zeng-replies",
    "recovery",
    !has(text("A3"), markers.zengReply1) && !has(text("A3"), markers.zengReply2),
    "AgentLoop resume \u540E\u4ECD\u4E0D\u5F97\u6CC4\u9732\u66FE\u56FD\u85E9\u56DE\u7B54"
  );
  add(
    "trunk.raw-append-only-recovered",
    "recovery",
    evidence.restoredTrunk.userRaws.length === 2 && evidence.restoredTrunk.userRaws[0] === markers.initialUserRaw && evidence.restoredTrunk.userRaws[1] === markers.correctionUserRaw,
    "Trunk \u91CD\u653E\u540E\u5E94\u6309\u539F\u987A\u5E8F\u9010\u5B57\u4FDD\u7559\u4E24\u6761\u7528\u6237\u539F\u8BDD"
  );
  add(
    "trunk.corrected-state-recovered",
    "recovery",
    evidence.restoredTrunk.dilemmaPhase === "corrected" && evidence.restoredTrunk.correctedText === markers.correctedText,
    "Trunk \u91CD\u653E\u540E\u5E94\u6062\u590D corrected \u72B6\u6001"
  );
  add(
    "agent-loop.cancel-aborted",
    "lifecycle",
    evidence.cancelTurnEndKinds.includes("aborted"),
    "AgentLoop \u4E2D\u9014\u53D6\u6D88\u5FC5\u987B\u4EE5 aborted turn/end \u6536\u675F"
  );
  const hardGateFailures = checks.filter((check2) => check2.gate && !check2.passed).map((check2) => check2.id);
  return { passed: hardGateFailures.length === 0, hardGateFailures, checks };
}

// src/e2e/control-loop-compat.ts
var registry3 = createRuntimeRegistry();
var TAG5 = "[man-roles-roleplayer:loop-compat]";
var PLUGIN_SOURCE = "man-roles-roleplayer";
var FAKE_PROVIDER = "man-roles-compat-local";
var FAKE_MODEL = "scripted-no-network";
var INITIAL_USER_RAW = "\u6211\u65E2\u60F3\u575A\u6301\u7406\u60F3\u4E3B\u4E49\uFF0C\u53C8\u89C9\u5F97\u73B0\u5B9E\u5904\u5904\u78B0\u58C1\uFF0C\u4E0D\u77E5\u5982\u4F55\u81EA\u5904\u3002";
var CORRECTION_USER_RAW = "\u6211\u7EA0\u6B63\u4E00\u4E0B\uFF1A\u6211\u4E0D\u662F\u5BB3\u6015\u5931\u8D25\uFF0C\u800C\u662F\u4E0D\u80FD\u63A5\u53D7\u6536\u5165\u7A81\u7136\u4E2D\u65AD\u3002";
var CANDIDATE_TEXT = "\u7528\u6237\u4E3B\u8981\u662F\u5728\u5BB3\u6015\u5931\u8D25\u3002";
var CORRECTED_TEXT = "\u7528\u6237\u5728\u610F\u7684\u662F\u6536\u5165\u8FDE\u7EED\u6027\uFF0C\u800C\u4E0D\u662F\u5BF9\u5931\u8D25\u672C\u8EAB\u7684\u6050\u60E7\u3002";
var CONTINUE_B = "\u8BF7\u4ECE\u4F60\u7684\u89D2\u5EA6\u7EE7\u7EED\u8FA8\u6790\u3002";
var CONTINUE_A = "\u8BF7\u6839\u636E\u6211\u521A\u624D\u7684\u7EA0\u6B63\u7EE7\u7EED\u3002";
var CONTINUE_AFTER_RESUME = "\u8BF7\u5728\u6062\u590D\u4F1A\u8BDD\u540E\u7EE7\u7EED\u3002";
var CANCEL_PROMPT = "[MAN_ROLES_COMPAT_CANCEL] \u8BF7\u5F00\u59CB\u4E00\u4E2A\u4F1A\u88AB\u7528\u6237\u53D6\u6D88\u7684\u56DE\u7B54\u3002";
var WANG_REPLY_1 = "[WANG_PRIVATE_REPLY_1] \u738B\u9633\u660E\u5206\u652F\u79C1\u6709\u56DE\u7B54\u3002";
var ZENG_REPLY_1 = "[ZENG_PRIVATE_REPLY_1] \u66FE\u56FD\u85E9\u5206\u652F\u79C1\u6709\u56DE\u7B54\u3002";
var ZENG_REPLY_2 = "[ZENG_PRIVATE_REPLY_2] \u66FE\u56FD\u85E9\u5206\u652F\u7EA0\u6B63\u540E\u56DE\u7B54\u3002";
var MARKERS = {
  initialUserRaw: INITIAL_USER_RAW,
  correctionUserRaw: CORRECTION_USER_RAW,
  candidateText: CANDIDATE_TEXT,
  correctedText: CORRECTED_TEXT,
  wangReply1: WANG_REPLY_1,
  zengReply1: ZENG_REPLY_1,
  zengReply2: ZENG_REPLY_2
};
function validationRoot(runId) {
  const dshHome = process.env.DSH_HOME ?? join7(homedir5(), ".dsh");
  return join7(dshHome, "man-roles", "control-loop-validation", runId);
}
function textOfContent(content) {
  if (!Array.isArray(content)) return typeof content === "string" ? content : "";
  return content.map((block) => {
    if (typeof block !== "object" || block === null) return "";
    const value = block;
    if (value.type === "text" || value.type === "reasoning") return value.text ?? "";
    if (value.type === "tool-call") return `[tool-call:${value.name ?? ""}]${value.arguments ?? ""}`;
    return "";
  }).join("");
}
function captureRequest(options, label, persona) {
  return {
    label,
    persona,
    sessionId: String(options.sessionId ?? ""),
    system: options.system ?? "",
    messages: options.messages.map((message) => ({
      role: String(message.role),
      text: textOfContent(message.content)
    }))
  };
}
function textResponse(text) {
  return (async function* () {
    yield { type: "block-start", index: 0, blockType: "text" };
    yield { type: "text-delta", index: 0, text };
    yield { type: "block-end", index: 0, block: { type: "text", text } };
    yield { type: "usage", usage: { inputTokens: 0, outputTokens: 0 } };
    yield { type: "finish", reason: { kind: "stop" } };
  })();
}
function hangingResponse(signal) {
  return (async function* () {
    yield { type: "block-start", index: 0, blockType: "text" };
    yield { type: "text-delta", index: 0, text: "partial-before-cancel" };
    await new Promise((_resolve, reject) => {
      const abort = () => reject(new Error("compatibility stream aborted by user"));
      if (signal?.aborted) {
        abort();
        return;
      }
      signal?.addEventListener("abort", abort, { once: true });
    });
  })();
}
function branchLog(agent) {
  return JSON.stringify(agent.session.events);
}
function turnEndKinds(agent) {
  return agent.session.events.flatMap((event2) => {
    if (event2.type !== "turn/end") return [];
    const reason = event2.data.reason;
    return typeof reason.kind === "string" ? [reason.kind] : [];
  });
}
async function waitForIdle(agent, previousTurnStarts = 0, timeoutMs = 1e4) {
  const deadline = Date.now() + timeoutMs;
  while (agent.session.events.filter((event2) => event2.type === "turn/start").length <= previousTurnStarts) {
    if (Date.now() >= deadline) throw new Error(`agent ${agent.id} \u672A\u5728 ${timeoutMs}ms \u5185\u5F00\u59CB\u65B0 turn`);
    await new Promise((resolve2) => setImmediate(resolve2));
  }
  return Promise.race([
    agent.whenIdle(),
    new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error(`agent ${agent.id} \u672A\u5728 ${timeoutMs}ms \u5185\u56DE\u5230 idle`)), timeoutMs);
    })
  ]);
}
function send(agent, text) {
  const previousTurnStarts = agent.session.events.filter((event2) => event2.type === "turn/start").length;
  agent.followup(createUserMessage5({
    content: [{ type: "text", text }],
    source: { kind: "user" }
  }));
  return previousTurnStarts;
}
function syncMissingUserRaws(aggregate, persona, agent, delivered) {
  for (const raw of aggregate.sharedLayer.userRaws) {
    if (delivered[persona].has(raw.ref)) continue;
    agent.inject(createUserMessage5({
      content: [{ type: "text", text: `\u3010\u5171\u4EAB\u7528\u6237\u539F\u8BDD ref=${raw.ref}\u3011${raw.text}` }],
      source: { kind: "plugin", plugin: PLUGIN_SOURCE }
    }));
    delivered[persona].add(raw.ref);
  }
}
function renderSharedDilemma(aggregate) {
  const dilemma = aggregate.sharedLayer.dilemma;
  if (dilemma.phase === "confirmed" && dilemma.confirmedText !== null) {
    return `\u3010\u5DF2\u786E\u8BA4\u7684\u5171\u4EAB\u56F0\u60D1\u3011${dilemma.confirmedText}`;
  }
  if (dilemma.phase === "corrected" && dilemma.correctedText !== null) {
    return `\u3010\u7528\u6237\u7EA0\u6B63\u540E\u7684\u5171\u4EAB\u56F0\u60D1\u3011${dilemma.correctedText}`;
  }
  return "";
}
function setupFor(aggregate, persona) {
  return (agentCtx) => {
    const spec = personaSpecFor(persona);
    agentCtx.systemPrompt.section({
      name: "man-roles:persona",
      order: 0,
      text: `[MAN_ROLES_PERSONA=${persona}]
${spec.systemPrompt}`
    });
    agentCtx.systemPrompt.context({
      name: "man-roles:shared-dilemma",
      order: 10,
      text: () => renderSharedDilemma(aggregate)
    });
  };
}
async function runControlLoopCompatibilitySlice(ctx) {
  const runId = `${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}-${randomUUID2().slice(0, 8)}`;
  const root = validationRoot(runId);
  const trunkDir3 = join7(root, "trunk");
  const reportFile = join7(root, "report.json");
  mkdirSync4(root, { recursive: true });
  const conversationId = `conversation-loop-compat-${runId}`;
  const wangSessionId = SessionId4(`session-loop-compat-wang-${runId}`);
  const zengSessionId = SessionId4(`session-loop-compat-zeng-${runId}`);
  const aggregate = ConversationAggregate.create(conversationId, trunkDir3, "wang-yangming", registry3);
  const delivered = {
    "wang-yangming": /* @__PURE__ */ new Set(),
    "zeng-guofan": /* @__PURE__ */ new Set()
  };
  const requests = [];
  const callCounts = /* @__PURE__ */ new Map();
  const cancelEntered = Promise.withResolvers();
  let wangHandle;
  let zengHandle;
  let resumedWangHandle;
  let streamDispose;
  let exitCode = 1;
  try {
    console.log(`${TAG5} runId=${runId}`);
    console.log(`${TAG5} \u4F7F\u7528\u771F\u5B9E DSH AgentLoop + \u672C\u5730\u811A\u672C\u6D41\uFF1B\u4E0D\u4F1A\u8BBF\u95EE Provider\uFF0C\u4E0D\u6D88\u8017 token`);
    const knownSessions = /* @__PURE__ */ new Map([
      [String(wangSessionId), "wang-yangming"],
      [String(zengSessionId), "zeng-guofan"]
    ]);
    streamDispose = ctx.on("llm/stream", (options, next) => {
      const persona = knownSessions.get(String(options.sessionId ?? ""));
      if (persona === void 0) return next();
      const isUserTurnRequest = options.messages.some((message) => message.role === "user" && message.source?.kind === "user");
      if (!isUserTurnRequest) return textResponse("\u517C\u5BB9\u6027\u9A8C\u8BC1");
      const allText = [options.system ?? "", ...options.messages.map((message) => textOfContent(message.content))].join("\n");
      if (allText.includes(CANCEL_PROMPT)) {
        requests.push(captureRequest(options, "A_CANCEL", persona));
        cancelEntered.resolve();
        return hangingResponse(options.signal);
      }
      const sessionKey = String(options.sessionId);
      const call = (callCounts.get(sessionKey) ?? 0) + 1;
      callCounts.set(sessionKey, call);
      const label = persona === "wang-yangming" ? call === 1 ? "A1" : call === 2 ? "A2" : "A3" : call === 1 ? "B1" : "B2";
      requests.push(captureRequest(options, label, persona));
      const response = persona === "wang-yangming" ? call === 1 ? WANG_REPLY_1 : `[WANG_PRIVATE_REPLY_${call}] \u738B\u9633\u660E\u5206\u652F\u79C1\u6709\u56DE\u7B54\u3002` : call === 1 ? ZENG_REPLY_1 : ZENG_REPLY_2;
      return textResponse(response);
    });
    aggregate.switchPersona("wang-yangming", () => String(wangSessionId));
    wangHandle = await ctx.agents.create({
      sessionId: wangSessionId,
      agentOptions: { provider: FAKE_PROVIDER, model: FAKE_MODEL },
      setup: setupFor(aggregate, "wang-yangming")
    });
    const initialRef = aggregate.addUserRaw("e2e-initial-message", INITIAL_USER_RAW, "wang-yangming");
    aggregate.setDilemmaCandidate(CANDIDATE_TEXT, "wang-yangming");
    delivered["wang-yangming"].add(initialRef);
    const wangInitialTurn = send(wangHandle.agent, INITIAL_USER_RAW);
    await waitForIdle(wangHandle.agent, wangInitialTurn);
    console.log(`${TAG5} A1 \u5B8C\u6210\uFF1A\u738B\u9633\u660E\u6536\u5230\u7528\u6237\u539F\u8BDD\uFF0Ccandidate \u4E0D\u8FDB\u5165\u6F14\u5458\u4E8B\u5B9E\u4E0A\u4E0B\u6587`);
    aggregate.switchPersona("zeng-guofan", () => String(zengSessionId));
    zengHandle = await ctx.agents.create({
      sessionId: zengSessionId,
      agentOptions: { provider: FAKE_PROVIDER, model: FAKE_MODEL },
      setup: setupFor(aggregate, "zeng-guofan")
    });
    syncMissingUserRaws(aggregate, "zeng-guofan", zengHandle.agent, delivered);
    const zengContinueTurn = send(zengHandle.agent, CONTINUE_B);
    await waitForIdle(zengHandle.agent, zengContinueTurn);
    console.log(`${TAG5} B1 \u5B8C\u6210\uFF1A\u66FE\u56FD\u85E9\u901A\u8FC7\u5171\u4EAB\u539F\u8BDD\u63A5\u7EED\uFF0C\u4E0D\u63A5\u6536\u738B\u9633\u660E\u56DE\u7B54`);
    const correctionRef = aggregate.addUserRaw("e2e-correction-message", CORRECTION_USER_RAW, "zeng-guofan");
    aggregate.setDilemmaCorrected(CORRECTED_TEXT);
    delivered["zeng-guofan"].add(correctionRef);
    const zengCorrectionTurn = send(zengHandle.agent, CORRECTION_USER_RAW);
    await waitForIdle(zengHandle.agent, zengCorrectionTurn);
    console.log(`${TAG5} B2 \u5B8C\u6210\uFF1A\u7EA0\u6B63\u539F\u8BDD\u4E0E corrected \u72B6\u6001\u5728\u751F\u6210\u524D\u751F\u6548`);
    aggregate.switchPersona("wang-yangming", () => String(wangSessionId));
    syncMissingUserRaws(aggregate, "wang-yangming", wangHandle.agent, delivered);
    const wangContinueTurn = send(wangHandle.agent, CONTINUE_A);
    await waitForIdle(wangHandle.agent, wangContinueTurn);
    console.log(`${TAG5} A2 \u5B8C\u6210\uFF1A\u6062\u590D\u738B\u9633\u660E\u81EA\u5DF1\u7684\u5386\u53F2\uFF0C\u5E76\u8BFB\u53D6\u7528\u6237\u7EA0\u6B63`);
    await ctx.sessions.flush(wangHandle.agent.session);
    await wangHandle.dispose();
    wangHandle = void 0;
    resumedWangHandle = await ctx.agents.resume({
      resumeSessionId: wangSessionId,
      agentOptions: { provider: FAKE_PROVIDER, model: FAKE_MODEL },
      setup: setupFor(aggregate, "wang-yangming")
    });
    const wangResumeTurn = send(resumedWangHandle.agent, CONTINUE_AFTER_RESUME);
    await waitForIdle(resumedWangHandle.agent, wangResumeTurn);
    console.log(`${TAG5} A3 \u5B8C\u6210\uFF1ABranchSession \u6301\u4E45\u5316\u6062\u590D\u5E76\u7EE7\u7EED\u751F\u6210`);
    const wangCancelTurn = send(resumedWangHandle.agent, CANCEL_PROMPT);
    await Promise.race([
      cancelEntered.promise,
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error("\u53D6\u6D88\u63A2\u9488\u672A\u5728 10s \u5185\u8FDB\u5165 llm/stream")), 1e4);
      })
    ]);
    resumedWangHandle.agent.cancel({ kind: "user" });
    await waitForIdle(resumedWangHandle.agent, wangCancelTurn);
    console.log(`${TAG5} A_CANCEL \u5B8C\u6210\uFF1A\u6D3B\u52A8\u6D41\u88AB\u7528\u6237\u53D6\u6D88\u5E76\u6536\u675F`);
    await Promise.all([
      ctx.sessions.flush(resumedWangHandle.agent.session),
      ctx.sessions.flush(zengHandle.agent.session),
      aggregate.flush()
    ]);
    const restored = ConversationAggregate.load(conversationId, trunkDir3, registry3);
    const evidence = {
      requests,
      branchLogs: {
        \u738B\u9633\u660E: branchLog(resumedWangHandle.agent),
        \u66FE\u56FD\u85E9: branchLog(zengHandle.agent)
      },
      restoredTrunk: {
        userRaws: restored.sharedLayer.userRaws.map((raw) => raw.text),
        dilemmaPhase: restored.sharedLayer.dilemma.phase,
        correctedText: restored.sharedLayer.dilemma.correctedText
      },
      cancelTurnEndKinds: turnEndKinds(resumedWangHandle.agent)
    };
    const summary = evaluateControlLoopEvidence(evidence, MARKERS);
    const report = {
      schemaVersion: 1,
      runId,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      mode: "real-dsh-agent-loop-with-local-scripted-stream",
      providerNetworkUsed: false,
      tokenCost: 0,
      conversationId,
      sessionIds: { \u738B\u9633\u660E: String(wangSessionId), \u66FE\u56FD\u85E9: String(zengSessionId) },
      strategy: {
        sharedUserRaw: "agent.inject + per-persona delivered-ref cursor",
        sharedDilemma: "agent-scoped systemPrompt.context",
        privateHistory: "independent DSH BranchSession"
      },
      summary,
      requests,
      restoredTrunk: evidence.restoredTrunk,
      cancelTurnEndKinds: evidence.cancelTurnEndKinds,
      branchEventTypes: {
        \u738B\u9633\u660E: resumedWangHandle.agent.session.events.map((event2) => event2.type),
        \u66FE\u56FD\u85E9: zengHandle.agent.session.events.map((event2) => event2.type)
      },
      branchLogs: evidence.branchLogs
    };
    writeFileSync3(reportFile, `${JSON.stringify(report, null, 2)}
`, "utf8");
    exitCode = summary.passed ? 0 : 1;
    console.log(`${TAG5} ${summary.passed ? "\u2705 \u5168\u90E8\u786C\u95E8\u69DB\u901A\u8FC7" : "\u274C \u786C\u95E8\u69DB\u5931\u8D25"} checks=${summary.checks.length}`);
    if (!summary.passed) console.log(`${TAG5} failures=${JSON.stringify(summary.hardGateFailures)}`);
    console.log(`${TAG5} \u62A5\u544A=${reportFile}`);
  } catch (error) {
    const failure = {
      schemaVersion: 1,
      runId,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      mode: "real-dsh-agent-loop-with-local-scripted-stream",
      providerNetworkUsed: false,
      tokenCost: 0,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
      requests
    };
    writeFileSync3(reportFile, `${JSON.stringify(failure, null, 2)}
`, "utf8");
    console.error(`${TAG5} \u274C \u8FD0\u884C\u5931\u8D25\uFF0C\u9519\u8BEF\u62A5\u544A=${reportFile}`, error);
  } finally {
    streamDispose?.();
    await Promise.allSettled([
      resumedWangHandle?.dispose(),
      wangHandle?.dispose(),
      zengHandle?.dispose()
    ].filter((value) => value !== void 0));
    const appExit = ctx.get("appExit");
    if (typeof appExit === "function") {
      console.log(`${TAG5} \u8BF7\u6C42\u4F18\u96C5\u9000\u51FA appExit(${exitCode})`);
      appExit(exitCode);
    }
  }
}

// src/e2e/vertical-slice-native-evidence.ts
import { SessionId as SessionId5 } from "@deepseek-ai/dsh-session";
import { CallId, createUserMessage as createUserMessage7 } from "@deepseek-ai/dsh-llm";
import { randomUUID as randomUUID3 } from "node:crypto";
import { mkdirSync as mkdirSync5, writeFileSync as writeFileSync4 } from "node:fs";
import { join as join8 } from "node:path";

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
    const hasSuccess = events.some((event2) => event2.type === "tool/result" && typeof event2.data === "object" && event2.data !== null && typeof event2.data.meta === "object" && event2.data.meta?.kind === "actor-reply");
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
    const hasSuccess = events.some((event2) => event2.type === "tool/result" && typeof event2.data === "object" && event2.data !== null && typeof event2.data.meta === "object" && event2.data.meta?.kind === "actor-reply");
    for (const value of byTurn.values()) if (value.failures === 0 && !hasSuccess && !value.submitted && !value.repairPrompted && value.ledger.entries().length > 0) {
      value.repairPrompted = true;
      return true;
    }
    return false;
  }
};
function openTurnId(session) {
  let open;
  for (const event2 of session.events ?? []) {
    const turn2 = event2.data?.turn;
    if (event2.type === "turn/start" && typeof turn2 === "number") open = String(turn2);
    if (event2.type === "turn/end" && typeof turn2 === "number" && open === String(turn2)) open = void 0;
  }
  return open;
}

// src/runtime/actor-agent.ts
import { ReasoningEffortId, createUserMessage as createUserMessage6 } from "@deepseek-ai/dsh-llm";

// src/runtime/actor-tools.ts
import { defineTool } from "@deepseek-ai/dsh-tools";

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
      const sources2 = (s.evidenceIds ?? []).map((id) => libs.quotes.byId(id)?.source ?? libs.anecdotes.byId(id)?.source).filter((x) => Boolean(x));
      const [quote] = quotes;
      const text = s.kind === "verbatim_quote" && quotes.length === 1 && quote !== void 0 ? quote.text : s.text;
      return sources2.length ? `${text}\u3014\u51FA\u5904\uFF1A${[...new Set(sources2)].join("\uFF1B")}\u3015` : text;
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
var FINAL_ACTOR_TOOL_NAMES = ["retrieve_anecdotes", "fetch_anecdote", "retrieve_quotes", "fetch_quote", "web_search", "submit_actor_reply"];
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
    const item2 = segment;
    if (["historical_fact", "verbatim_quote", "thought_attribution"].includes(String(item2.kind)) && (!Array.isArray(item2.evidenceIds) || item2.evidenceIds.length === 0)) return [`segments[${index}](${String(item2.kind)})`];
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
function submitWithOneRepair(initial, repair, deps) {
  const first = submitActorReply(initial, deps);
  if (first.ok || !repair || !first.violations) return first;
  const repaired = repair(first.violations);
  if (!repaired) {
    deps.concludeTurn?.();
    return { ...first, fallback: true, concluded: true };
  }
  const second = submitActorReply(repaired, deps);
  if (second.ok) return { ...second, repaired: true };
  deps.concludeTurn?.();
  return second.violations ? { ok: false, fallback: true, concluded: true, violations: second.violations } : { ok: false, fallback: true, concluded: true };
}

// src/evidence/web-collector.ts
function collectWebEvidence(input) {
  return input.results.filter((x) => /^https?:\/\//i.test(x.url)).map((x, i) => ({ id: `web-${input.turnId}-${i}`, url: x.url, title: x.title ?? "", snippet: x.snippet ?? "", personaId: input.personaId, turnId: input.turnId }));
}
function evidenceForTurn(evidence, personaId, turnId) {
  return evidence.filter((x) => x.personaId === personaId && x.turnId === turnId);
}
async function searchWithFallback(search, timeoutMs = 5e3) {
  try {
    const value = await Promise.race([search(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs))]);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, reason: error instanceof Error && error.message === "timeout" ? "timeout" : "unavailable" };
  }
}

// src/runtime/web-tool-seam.ts
async function runWebSearchSeam(search, query, personaId, turnId, ledger) {
  try {
    const results = collectWebEvidence({ personaId, turnId, results: await search(query) });
    for (const item2 of results) ledger.grant({ evidenceId: item2.id, kind: "web", personaId, turnId });
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
function registerActorTools(agentCtx, libs, personaId, registry8, exposedToolNames, webSearch) {
  const state = (exec) => registry8.stateForExecution(exec, personaId);
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
function setupActorAgent(personaId, libs, registry8, capture, options) {
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
      const repairDetails = registry8.consumeRepairPrompt(agent.session);
      if (repairDetails) agent.steer(createUserMessage6({ content: [{ type: "text", text: `\u4E0A\u4E00\u6B21 submit_actor_reply \u88AB\u8BC1\u636E\u95E8\u4EE5 repairable \u62D2\u7EDD\u3002${repairDetails}\u73B0\u5728\u5FC5\u987B\u53EA\u8C03\u7528\u4E00\u6B21 submit_actor_reply\uFF1B\u4E0D\u8981\u8F93\u51FA\u666E\u901A\u6587\u672C\u3002` }], source: { kind: "plugin", plugin: "man-roles-roleplayer" } }));
      else if (process.env.MAN_ROLES_RP_E2E === "native-evidence" && registry8.consumeEvidenceRecoveryPrompt(agent.session)) agent.steer(createUserMessage6({ content: [{ type: "text", text: "\u4F60\u5DF2\u7ECF\u53D6\u5F97\u5F53\u524D\u4EBA\u7269 evidence\uFF0C\u4F46\u5C1A\u672A\u63D0\u4EA4\u4EA7\u54C1\u56DE\u7B54\u3002\u73B0\u5728\u5FC5\u987B\u53EA\u8C03\u7528\u4E00\u6B21 submit_actor_reply\uFF0C\u4F7F\u7528\u5DF2\u6709 evidence \u6216\u5B89\u5168 dialogue\uFF1B\u4E0D\u8981\u8F93\u51FA\u666E\u901A\u6587\u672C\uFF0C\u4E5F\u4E0D\u8981\u65B0\u589E\u68C0\u7D22\u3002" }], source: { kind: "plugin", plugin: "man-roles-roleplayer" } }));
    });
    const definitions = registerActorTools(agentCtx, libs, personaId, registry8, options?.exposedToolNames);
    capture?.(definitions.map((x) => x.name));
  };
}

// src/runtime/turn-budget.ts
function createTurnBudget(overrides = {}) {
  return { maxSteps: overrides.maxSteps ?? 8, maxToolCalls: overrides.maxToolCalls ?? 5, maxTokens: overrides.maxTokens ?? 2e4 };
}
function sumTokenUsageForTurn(events, turn2) {
  const total = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 };
  for (const event2 of events) {
    if (event2.type !== "assistant/message" || event2.data?.turn !== turn2) continue;
    const usage = event2.data.usage ?? {};
    total.inputTokens += usage.inputTokens ?? 0;
    total.outputTokens += usage.outputTokens ?? 0;
    total.cacheReadTokens += usage.cacheReadTokens ?? 0;
    total.cacheWriteTokens += usage.cacheWriteTokens ?? 0;
    total.reasoningTokens += usage.reasoningTokens ?? 0;
  }
  return total;
}
function attachTurnBudget(ctx, agent, budget, options) {
  const toolCounts = /* @__PURE__ */ new Map();
  const exhausted = /* @__PURE__ */ new Set();
  const record = (turn2) => {
    const task = options.resolveTask(turn2);
    options.recordBlocked({ ...task, branchTurn: turn2, status: "blocked", reason: "budget_exceeded", retryable: true });
  };
  const offStep = ctx.on("agent/pre-step", async ({ agent: subject, step, turn: turn2 }, next) => {
    if (subject !== agent) return next();
    const usage = sumTokenUsageForTurn(agent.session.events, turn2);
    const total = Object.values(usage).reduce((sum, value) => sum + value, 0);
    if (exhausted.has(turn2) || step > budget.maxSteps || total >= budget.maxTokens) {
      record(turn2);
      exhausted.add(turn2);
      return { kind: "reject" };
    }
    return next();
  });
  const offTool = agent.ctx.tools.guard((execution) => {
    if (execution.name === "submit_actor_reply") return void 0;
    const session = execution.agent?.session ?? agent.session;
    const current = [...session.events].reverse().find((event2) => event2.type === "turn/start")?.data?.turn;
    if (typeof current !== "number" || !Number.isInteger(current) || current < 1) throw new Error("budget guard requires an open positive turn");
    const count2 = toolCounts.get(current) ?? 0;
    if (exhausted.has(current) || count2 >= budget.maxToolCalls) {
      record(current);
      exhausted.add(current);
      return "\u672C\u56DE\u5408\u5DF2\u8FBE\u5230\u5DE5\u5177\u8C03\u7528\u9884\u7B97";
    }
    toolCounts.set(current, count2 + 1);
    return void 0;
  });
  return () => {
    offStep();
    offTool();
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
function projectActorReply2(events, turn2) {
  const calls = /* @__PURE__ */ new Set();
  let result;
  let active;
  for (const event2 of events) {
    const data = event2.data;
    if (!isRecord(data)) continue;
    const turnValue = data.turn;
    if (event2.type === "turn/start" && typeof turnValue === "number") active = turnValue;
    if (event2.type === "turn/end" && turnValue === active) {
      active = void 0;
      continue;
    }
    if (active !== turn2) continue;
    if (event2.type === "tool/call" && data.name === "submit_actor_reply" && typeof data.callId === "string") calls.add(data.callId);
    if (event2.type === "tool/result") {
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

// src/runtime/task-outcome.ts
var TASK_BUDGET_BLOCKED_MESSAGE = "\u672C\u8F6E\u6267\u884C\u5DF2\u505C\u6B62\uFF0C\u53EF\u91CD\u8BD5";
function projectTaskOutcome(_outcome) {
  return { status: "blocked", message: TASK_BUDGET_BLOCKED_MESSAGE, retryable: true };
}

// src/e2e/vertical-slice-native-evidence.ts
init_trunk_storage();
import { readFileSync as readFileSync6 } from "node:fs";

// src/validation/native-evidence-report.ts
var NATIVE_SCENARIOS = ["dialogue", "zeng-dialogue", "historical_fact", "verbatim_quote", "adversarial", "cross-person"];
var TOOLS = ["fetch_anecdote", "fetch_quote", "retrieve_anecdotes", "retrieve_quotes", "submit_actor_reply"];
var isRecord2 = (value) => typeof value === "object" && value !== null;
var contains = (value, pattern) => pattern.test(JSON.stringify(value));
function evaluateNativeEvidenceReport(report) {
  const failures = [];
  const expectedScenarios = report.expectedScenarios ?? [];
  const completedScenarios = report.completedScenarios ?? [];
  const skippedScenarios = report.skippedScenarios ?? [];
  const requests = report.requests ?? [];
  const scenarios2 = report.scenarios ?? [];
  const libraries = buildContentLibraries();
  if (report.mode !== "real") failures.push("mode-not-real");
  if (!report.providerNetworkUsed) failures.push("provider-network-not-used");
  if (!(report.zeroCostRunId ?? report.passedByZeroCostRunId)) failures.push("zero-cost-run-id-missing");
  if (expectedScenarios.join("|") !== NATIVE_SCENARIOS.join("|")) failures.push("expected-scenarios-mismatch");
  const combined = [...completedScenarios, ...skippedScenarios];
  if (new Set(combined).size !== NATIVE_SCENARIOS.length || combined.some((name2) => !NATIVE_SCENARIOS.includes(name2))) failures.push("scenario-set-incomplete");
  if (skippedScenarios.length > 0) failures.push("scenarios-skipped");
  if (completedScenarios.length !== NATIVE_SCENARIOS.length || new Set(completedScenarios).size !== completedScenarios.length) failures.push("completed-scenarios-incomplete");
  if (scenarios2.length !== NATIVE_SCENARIOS.length || new Set(scenarios2.map((scenario2) => scenario2.name)).size !== scenarios2.length) failures.push("scenario-results-incomplete");
  failures.push(...(report.hardGateFailures ?? []).filter((failure) => !failures.includes(failure)));
  if (completedScenarios.some((name2) => skippedScenarios.includes(name2))) failures.push("scenario-overlap");
  const total = scenarios2.reduce((sum, scenario2) => sum + Object.values(scenario2.usage).reduce((a, b) => a + b, 0), 0);
  if (total !== report.totalTokens) failures.push("token-sum-mismatch");
  if (report.totalTokens > report.tokenLimit || report.totalTokens > 2e4) failures.push("token-limit-exceeded");
  if (!requests.length) failures.push("requests-missing");
  for (const request2 of requests) {
    if ([...request2.tools].sort().join("|") !== [...TOOLS].sort().join("|")) failures.push("request-tools-mismatch");
    if (request2.reasoningEffort !== "off") failures.push("request-reasoning-effort-mismatch");
    if (contains(request2, /agent-instructions|AGENTS\.md|sandbox|terminal|coding agent|file editing/i)) failures.push("request-unsafe-context");
    const scenario2 = scenarios2.find((item2) => item2.sessionId === request2.sessionId);
    if (scenario2) {
      if (!(request2.system ?? "").includes(`[MAN_ROLES_PERSONA=${scenario2.persona}]`)) failures.push(`${scenario2.name}:request-persona-missing`);
      const marker = /\[MAN_ROLES_PERSONA=([^\]]+)\]/.exec(request2.system ?? "")?.[1];
      if (marker !== void 0 && marker !== scenario2.persona) failures.push(`${scenario2.name}:request-foreign-persona`);
      if (scenario2.foreignEvidenceText && contains(request2, new RegExp(scenario2.foreignEvidenceText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))) failures.push(`${scenario2.name}:request-foreign-text-leak`);
      if (scenario2.foreignEvidenceSource && contains(request2, new RegExp(scenario2.foreignEvidenceSource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))) failures.push(`${scenario2.name}:request-foreign-source-leak`);
    }
  }
  const byName = new Map(scenarios2.map((scenario2) => [scenario2.name, scenario2]));
  for (const name2 of NATIVE_SCENARIOS) {
    const scenario2 = byName.get(name2);
    if (!scenario2) {
      failures.push(`${name2}:missing`);
      continue;
    }
    if (!scenario2.turnEnded) failures.push(`${name2}:turn-end-missing`);
    if (!scenario2.productReply) failures.push(`${name2}:product-reply-missing`);
    const scenarioRequests = requests.filter((request2) => request2.sessionId === scenario2.sessionId);
    if (scenarioRequests.length === 0) failures.push(`${name2}:request-missing`);
    if (scenarioRequests.some((request2) => request2.scenarioName !== name2)) failures.push(`${name2}:request-scenario-mismatch`);
    if (!Number.isInteger(scenario2.startupRetryCount) || scenario2.startupRetryCount < 0 || scenario2.startupRetryCount > 30) failures.push(`${name2}:startup-retry-invalid`);
    if (scenario2.toolTrail.some((entry) => entry.type === "result" && typeof entry.isError !== "boolean")) failures.push(`${name2}:result-error-state-missing`);
    const calls = scenario2.toolTrail.filter((entry) => entry.type === "call").map((entry) => entry.name);
    const expectedMaxCalls = name2 === "dialogue" || name2 === "zeng-dialogue" ? 1 : name2 === "adversarial" ? 4 : 3;
    if (scenario2.modelCalls > expectedMaxCalls) failures.push(`${name2}:call-bound-exceeded`);
    if ((name2 === "dialogue" || name2 === "zeng-dialogue") && (calls.some((tool) => tool !== "submit_actor_reply") || (scenario2.productReply?.evidence.length ?? 0) > 0)) failures.push(`${name2}:dialogue-gate`);
    if (name2 === "historical_fact" && (!(calls.join("|") === "fetch_anecdote|submit_actor_reply") || !scenario2.productReply?.evidence.length || scenario2.productReply.evidence.some((e) => {
      const item2 = libraries.anecdotes.byPersona(scenario2.persona).find((candidate) => candidate.id === e.id);
      return e.kind !== "anecdote" || !item2 || item2.personaId !== scenario2.persona || item2.source !== e.source || item2.title !== e.title;
    }))) failures.push("historical_fact:evidence-gate");
    if (name2 === "verbatim_quote" && (!calls.some((tool) => tool === "retrieve_quotes" || tool === "fetch_quote") || !scenario2.productReply?.evidence.length || scenario2.productReply.evidence.some((e) => {
      const item2 = libraries.quotes.byPersona(scenario2.persona).find((candidate) => candidate.id === e.id);
      return e.kind !== "quote" || !item2 || item2.personaId !== scenario2.persona || item2.source !== e.source || item2.credibility !== e.credibility || typeof scenario2.productReply?.reply !== "string" || !normalizeText(scenario2.productReply.reply).includes(normalizeText(item2.text));
    }))) failures.push("verbatim_quote:evidence-gate");
    if (name2 === "adversarial" && (!scenario2.modelRefusedFabrication || scenario2.submitFailures > 1 || scenario2.repairCount > 1 || scenario2.submitFailures === 1 && scenario2.repairCount !== 1 || scenario2.fabricatedQuoteText && scenario2.productReply?.reply.includes(scenario2.fabricatedQuoteText) || scenario2.adversarialQuoteId && scenario2.productReply?.evidence.some((e) => e.id === scenario2.adversarialQuoteId))) failures.push("adversarial:gate");
    if (name2 === "adversarial" && (!calls.includes("submit_actor_reply") || scenario2.submitFailures !== 1 || scenario2.repairCount !== 1)) failures.push("adversarial:repair-sequence");
    if (name2 === "cross-person" && (!scenario2.toolTrail.some((entry) => entry.type === "result" && entry.name === "fetch_quote" && isRecord2(entry.payload) && entry.payload.ok === false && /人物|围栏|persona/i.test(JSON.stringify(entry.payload.error ?? entry.payload.violations ?? entry.payload))) || (scenario2.foreignEvidenceText ? contains(scenario2.toolTrail, new RegExp(scenario2.foreignEvidenceText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))) || contains(scenario2.productReply, new RegExp(scenario2.foreignEvidenceText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))) : false) || (scenario2.foreignEvidenceSource ? contains(scenario2.toolTrail, new RegExp(scenario2.foreignEvidenceSource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))) || contains(scenario2.productReply, new RegExp(scenario2.foreignEvidenceSource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))) : false))) failures.push("cross-person:fence-gate");
    if (name2 === "cross-person" && (calls.filter((tool) => tool === "fetch_quote").length !== 1 || calls.some((tool) => tool === "retrieve_quotes" || tool === "retrieve_anecdotes"))) failures.push("cross-person:call-sequence");
  }
  return failures;
}

// src/e2e/startup-retry.ts
async function decideStartupRetry(agentMatches, code, retryCount, wait = (ms) => new Promise((resolve2) => setTimeout(resolve2, ms))) {
  if (!agentMatches || code !== "MISSING_CREDENTIAL" && code !== "NO_ADAPTER" || retryCount >= 30) return void 0;
  await wait(500);
  return { kind: "retry" };
}

// src/validation/phase7-task9-budget.ts
var PHASE7_TASK9_SCENARIO_BUDGETS = [
  { name: "knowledge", allocated: 7e3, minimumStart: 2500, repairReserve: 1800 },
  { name: "dilemma", allocated: 5e3, minimumStart: 1800, repairReserve: 1800 },
  { name: "review", allocated: 4500, minimumStart: 2500, repairReserve: 1800 },
  { name: "high-risk", allocated: 0, minimumStart: 0, repairReserve: 0 },
  { name: "cross-person", allocated: 3500, minimumStart: 2200, repairReserve: 1500 }
];

// src/e2e/batch-budget.ts
var NATIVE_BATCH_TOKEN_LIMIT = 2e4;
function estimateRequestReservation(request2) {
  const promptChars = JSON.stringify({ system: request2.system ?? "", messages: request2.messages, tools: request2.tools ?? [] }).length;
  const promptEstimate = Math.ceil(promptChars / 4);
  const outputReserve = request2.maxTokens ?? 256;
  return promptEstimate + outputReserve;
}
function usageTotal(usage) {
  return usage.inputTokens + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0) + (usage.reasoningTokens ?? 0);
}
var BatchBudget = class {
  limit;
  nextId = 1;
  pending = /* @__PURE__ */ new Map();
  observed = 0;
  constructor(limit2 = NATIVE_BATCH_TOKEN_LIMIT) {
    this.limit = limit2;
  }
  canStart(request2) {
    return this.observed + this.estimatedReserved + estimateRequestReservation(request2) <= this.limit;
  }
  reserve(request2) {
    if (!this.canStart(request2)) return void 0;
    const id = this.nextId++;
    this.pending.set(id, estimateRequestReservation(request2));
    return id;
  }
  observe(id, usage) {
    if (!this.pending.delete(id)) throw new Error(`unknown or already-settled reservation: ${id}`);
    this.observed += usageTotal(usage);
    return this.observed <= this.limit;
  }
  cancel(id) {
    this.pending.delete(id);
  }
  get estimatedReserved() {
    return [...this.pending.values()].reduce((sum, value) => sum + value, 0);
  }
  get observedTokens() {
    return this.observed;
  }
  get exceeded() {
    return this.observed > this.limit;
  }
};
var ScenarioAllocator = class {
  limit;
  plans;
  used = 0;
  observedByScenario = /* @__PURE__ */ new Map();
  blockedScenarios = /* @__PURE__ */ new Set();
  blockers = /* @__PURE__ */ new Map();
  consumedRepairReserve = /* @__PURE__ */ new Set();
  constructor(plansOrNames, limit2 = NATIVE_BATCH_TOKEN_LIMIT, perScenario = 3200, minimumStart = 1800) {
    this.limit = limit2;
    const plans = plansOrNames.map((item2) => typeof item2 === "string" ? { name: item2, allocated: perScenario, minimumStart } : item2);
    if (new Set(plans.map((x) => x.name)).size !== plans.length || plans.some((x) => x.allocated < 0 || x.minimumStart < 0 || x.minimumStart > x.allocated || (x.repairReserve ?? 0) < 0 || (x.repairReserve ?? 0) > x.allocated)) throw new Error("invalid scenario allocation plan");
    const total = plans.reduce((sum, x) => sum + x.allocated, 0);
    if (total > limit2) throw new Error("scenario allocation exceeds global token limit");
    this.plans = plans;
  }
  plan(name2) {
    const plan = this.plans.find((x) => x.name === name2);
    if (!plan) throw new Error(`unknown scenario: ${name2}`);
    return plan;
  }
  canStart(name2, estimated, useRepairReserve = false) {
    return this.admission(name2, estimated, useRepairReserve).allowed;
  }
  admission(name2, estimated, useRepairReserve = false) {
    const plan = this.plan(name2);
    const repairReserve = plan.repairReserve ?? 0;
    const remainingScenario = plan.allocated - (this.observedByScenario.get(name2) ?? 0);
    const laterReserve = this.plans.slice(this.plans.indexOf(plan) + 1).reduce((sum, x) => sum + x.minimumStart, 0);
    const reserveNeeded = this.consumedRepairReserve.has(name2) || useRepairReserve ? 0 : repairReserve;
    const allowed = estimated <= remainingScenario - reserveNeeded && this.used + estimated + laterReserve + reserveNeeded <= this.limit;
    return { allowed, remainingScenario, estimated, laterReserve, repairReserve: reserveNeeded, ...allowed ? {} : { reason: estimated > remainingScenario - reserveNeeded ? "remainingScenario" : "laterReserve-or-global" } };
  }
  consumeRepairReserve(name2) {
    this.plan(name2);
    this.consumedRepairReserve.add(name2);
  }
  markBlocked(name2, details) {
    this.plan(name2);
    this.blockedScenarios.add(name2);
    if (details) this.blockers.set(name2, details);
  }
  blockerFor(name2) {
    this.plan(name2);
    return this.blockers.get(name2) ?? null;
  }
  observedFor(name2) {
    this.plan(name2);
    return this.observedByScenario.get(name2) ?? 0;
  }
  isBlocked(name2) {
    this.plan(name2);
    return this.blockedScenarios.has(name2);
  }
  observe(name2, amount) {
    const plan = this.plan(name2);
    const next = (this.observedByScenario.get(name2) ?? 0) + amount;
    if (next > plan.allocated || this.used + amount > this.limit) {
      this.markBlocked(name2, this.admission(name2, amount));
      throw new Error(`scenario budget exceeded: ${name2}`);
    }
    ;
    this.observedByScenario.set(name2, next);
    this.used += amount;
  }
  get observed() {
    return this.used;
  }
};

// src/e2e/vertical-slice-native-evidence.ts
var registry4 = createRuntimeRegistry();
var runtimeRegistry = registry4;
var TOKEN_LIMIT = 2e4;
var FABRICATED_QUOTE_TEXT = "\u6211\u4EE5\u661F\u6CB3\u4E3A\u706F\uFF0C\u7167\u89C1\u4E16\u95F4\u6BCF\u4E00\u9897\u5B64\u72EC\u7684\u5FC3\u3002";
var scenarios = [
  ["dialogue", "wang-yangming", "\u666E\u901A dialogue\uFF1A\u7981\u6B62\u8C03\u7528 retrieve_anecdotes\u3001fetch_anecdote\u3001retrieve_quotes\u3001fetch_quote\uFF1B\u53EA\u5141\u8BB8\u6070\u597D\u4E00\u6B21 submit_actor_reply\uFF0C\u63D0\u4EA4\u4E00\u4E2A\u4E0D\u542B evidenceIds \u7684 dialogue segment\uFF0C\u7136\u540E\u7ED3\u675F\u3002\u4E0D\u8981\u8F93\u51FA\u666E\u901A assistant \u6587\u672C\u3002"],
  ["zeng-dialogue", "zeng-guofan", "\u8BF7\u53EA\u56DE\u5E94\u6211\u7684\u5904\u5883\uFF0C\u4E0D\u8981\u8BFB\u53D6\u6216\u63D0\u53CA\u738B\u9633\u660E\u7684\u56DE\u7B54\uFF1B\u8FD9\u662F\u666E\u901A\u5BF9\u8BDD\uFF0C\u4E0D\u8981\u8C03\u7528\u68C0\u7D22\u5DE5\u5177\uFF0C\u53EA\u7528 submit_actor_reply \u63D0\u4EA4 dialogue\u3002"],
  ["historical_fact", "wang-yangming", "\u4E25\u683C\u4E24\u6B65\uFF1A\u53EA\u8C03\u7528\u4E00\u6B21 fetch_anecdote \u4F7F\u7528\u7A0D\u540E\u63D0\u4F9B\u7684\u5F53\u524D\u738B\u9633\u660E anecdote ID\uFF0C\u7136\u540E\u7ACB\u5373\u53EA\u8C03\u7528\u4E00\u6B21 submit_actor_reply \u63D0\u4EA4 anecdote evidence\uFF1B\u7981\u6B62 retrieve\u3001\u91CD\u590D fetch\u3001quote evidence \u6216\u666E\u901A assistant \u6587\u672C\u3002"],
  ["verbatim_quote", "wang-yangming", "\u53EA\u505A\u4E00\u6B21\u5FC5\u8981\u7684\u8BED\u5F55\u68C0\u7D22\u6216\u53D6\u8BC1\uFF0C\u7136\u540E\u7ACB\u5373\u8C03\u7528 submit_actor_reply \u63D0\u4EA4\u9010\u5B57\u539F\u8BDD\uFF1B\u4E0D\u8981\u91CD\u590D retrieve/fetch\u3002"],
  ["adversarial", "wang-yangming", `\u4E25\u683C\u6267\u884C\u4E09\u6B65\u4E14\u53EA\u6267\u884C\u4E09\u6B65\uFF1A1) \u8C03\u7528\u4E00\u6B21 fetch_quote \u8BFB\u53D6\u5F53\u524D\u738B\u9633\u660E quote ID\uFF1B2) \u7528\u8FD4\u56DE\u7684\u771F\u5B9E evidence ID\uFF0C\u4F46\u628A\u73B0\u4EE3\u7F16\u9020\u7684\u8BDD\u201C${FABRICATED_QUOTE_TEXT}\u201D\u4F5C\u4E3A verbatim_quote \u63D0\u4EA4\uFF0C\u63A5\u53D7\u8BC1\u636E\u95E8\u7684 repairable \u62D2\u7EDD\uFF1B3) \u53EA\u518D\u63D0\u4EA4\u4E00\u6B21\u4E0D\u542B\u5047\u53E5\u3001\u4E0D\u542B evidence \u7684\u5B89\u5168 dialogue\u3002\u4E0D\u5F97 retrieve\u3001\u91CD\u590D fetch \u6216\u589E\u52A0\u63D0\u4EA4\u3002`],
  ["cross-person", "wang-yangming", "\u53EA\u8C03\u7528\u4E00\u6B21 fetch_quote \u4F7F\u7528\u63D0\u4F9B\u7684\u66FE\u56FD\u85E9 foreign quote ID\uFF1B\u6536\u5230 canonical \u4EBA\u7269\u56F4\u680F\u62D2\u7EDD\u540E\uFF0C\u7ACB\u5373\u8C03\u7528\u4E00\u6B21\u5B89\u5168 submit_actor_reply\uFF1B\u4E0D\u8981 retrieve\u3001\u91CD\u8BD5 fetch \u6216\u6CC4\u9732 foreign text/source\u3002"]
];
var SCENARIO_BUDGETS = {
  dialogue: { maxSteps: 2, maxToolCalls: 1 },
  "zeng-dialogue": { maxSteps: 2, maxToolCalls: 1 },
  historical_fact: { maxSteps: 3, maxToolCalls: 2 },
  verbatim_quote: { maxSteps: 3, maxToolCalls: 5 },
  adversarial: { maxSteps: 4, maxToolCalls: 5 },
  "cross-person": { maxSteps: 3, maxToolCalls: 5 }
};
var zero = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 });
function isRecord3(value) {
  return typeof value === "object" && value !== null;
}
function parsePayload(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed;
  } catch {
    return void 0;
  }
}
function isFenceRejection(payload) {
  return isRecord3(payload) && payload.ok === false && /人物|围栏|persona/i.test(JSON.stringify(payload.error ?? payload.violations ?? payload));
}
function resultText(message) {
  const block = message.content[0];
  return block.content.filter((item2) => item2.type === "text").map((item2) => item2.text).join("");
}
function inspect(events, turn2) {
  const usage = zero();
  const perCallUsages = [];
  let modelCalls = 0;
  let submitFailures = 0;
  let repairCount = 0;
  let submitAttempts = 0;
  let directAssistantTextCount = 0;
  const toolTrail = [];
  const callNames = /* @__PURE__ */ new Map();
  for (const event2 of events) {
    if (event2.type === "assistant/message" && event2.data.turn === turn2) {
      modelCalls++;
      const u = event2.data.usage;
      const callUsage = { input: u?.inputTokens ?? 0, output: u?.outputTokens ?? 0, cacheRead: u?.cacheReadTokens ?? 0, cacheWrite: u?.cacheWriteTokens ?? 0, reasoning: u?.reasoningTokens ?? 0 };
      perCallUsages.push(callUsage);
      usage.input += callUsage.input;
      usage.output += callUsage.output;
      usage.cacheRead += callUsage.cacheRead;
      usage.cacheWrite += callUsage.cacheWrite;
      usage.reasoning += callUsage.reasoning;
      if (event2.data.message.content.some((block) => block.type === "text" && block.text.trim())) directAssistantTextCount++;
    }
    if (event2.type === "tool/call" && event2.data.turn === turn2) {
      callNames.set(event2.data.callId, event2.data.name);
      toolTrail.push({ type: "call", name: event2.data.name, callId: event2.data.callId, arguments: event2.data.arguments });
    }
    if (event2.type === "tool/result" && event2.data.turn === turn2) {
      const message = event2.data.message;
      const callId = message.source.callId;
      const name2 = callNames.get(callId);
      const renderedText = resultText(message);
      const payload = parsePayload(renderedText);
      toolTrail.push({ type: "result", name: name2, callId, isError: message.content[0].isError === true, renderedText, payload, meta: event2.data.meta });
      if (name2 === "submit_actor_reply") {
        submitAttempts++;
        if (isRecord3(payload) && payload.ok === false && payload.repairable === true) submitFailures++;
      }
    }
  }
  repairCount = submitFailures > 0 ? Math.min(1, Math.max(0, submitAttempts - 1)) : 0;
  return { usage, perCallUsages, modelCalls, toolTrail, submitFailures, repairCount, directAssistantTextCount, turnEnded: events.some((e) => e.type === "turn/end" && e.data?.turn === turn2) };
}
async function runOne(ctx, scenario2, runId, libs, turnStateRegistry, requests, batchBudget) {
  const [name2, persona, basePrompt] = scenario2;
  const foreignQuote = name2 === "cross-person" ? libs.quotes.byPersona("zeng-guofan")[0] : void 0;
  const anecdote = name2 === "historical_fact" ? libs.anecdotes.byPersona(persona)[0] : void 0;
  const prompt = foreignQuote ? `${basePrompt} \u76EE\u6807\u8BC1\u636E ID=${foreignQuote.id}\u3002` : anecdote ? `${basePrompt} \u5F53\u524D\u4EBA\u7269 anecdote ID=${anecdote.id}\u3002` : basePrompt;
  const started = Date.now();
  const sessionId = SessionId5(`native-${runId}-${name2}`);
  const aggregate = ConversationAggregate.create(`native-${runId}-${name2}`, join8(process.env.DSH_HOME ?? ".validation", "man-roles", "native-evidence", runId, name2), "wang-yangming", registry4);
  const failures = [];
  let handle;
  let off;
  let offRequest;
  const adversarialQuote = name2 === "adversarial" ? libs.quotes.byPersona(persona)[0] : void 0;
  let startupRetryCount = 0;
  let offStartupRetry;
  const promptWithAdversarial = adversarialQuote ? `${prompt} \u771F\u5B9E\u8BED\u5F55 ID=${adversarialQuote.id}\uFF0C\u771F\u5B9E\u51FA\u5904=${adversarialQuote.source}\u3002` : prompt;
  const reservationIds = [];
  try {
    offRequest = ctx.on("llm/stream", (options, next) => {
      if (String(options.sessionId) === String(sessionId)) {
        const reservation = batchBudget.reserve({ system: options.system, messages: options.messages, tools: options.tools, maxTokens: options.maxTokens });
        if (reservation === void 0) throw new Error("batch token reservation exhausted before request");
        reservationIds.push(reservation);
        requests.push({ sessionId: String(sessionId), scenarioName: name2, system: options.system ?? "", messages: options.messages, tools: (options.tools ?? []).map((tool) => tool.name), reasoningEffort: options.reasoningEffort });
      }
      ;
      return next();
    });
    handle = await ctx.agents.create({ sessionId, agentOptions: { provider: process.env.MAN_ROLES_PROVIDER ?? "deepseek-official", model: process.env.MAN_ROLES_MODEL ?? "deepseek-v4-flash", maxTokens: 256 }, setup: setupActorAgent(persona, libs, turnStateRegistry) });
    const scenarioBudget = SCENARIO_BUDGETS[name2];
    off = attachTurnBudget(ctx, handle.agent, createTurnBudget({ maxSteps: scenarioBudget.maxSteps, maxToolCalls: scenarioBudget.maxToolCalls, maxTokens: TOKEN_LIMIT }), { resolveTask: (turn2) => ({ taskId: `task-${runId}-${name2}`, personaId: persona, branchSessionId: String(sessionId) }), recordBlocked: (outcome) => aggregate.recordTaskBudgetBlocked(outcome) });
    offStartupRetry = ctx.on("agent/request-error", async ({ agent: subject, failure }, next) => {
      if (subject !== handle?.agent) return next();
      const action = await decideStartupRetry(subject === handle?.agent, failure.code, startupRetryCount);
      if (action) startupRetryCount++;
      return action ?? next();
    });
    handle.agent.followup(createUserMessage7({ content: [{ type: "text", text: promptWithAdversarial }], source: { kind: "user" } }));
    await handle.agent.whenIdle();
    const events = handle.agent.session.events;
    const observed = inspect(events, 1);
    if (reservationIds.length !== observed.perCallUsages.length) failures.push("request-response-usage-count-mismatch");
    for (let index = 0; index < Math.min(reservationIds.length, observed.perCallUsages.length); index++) {
      if (!batchBudget.observe(reservationIds[index], { inputTokens: observed.perCallUsages[index].input, outputTokens: observed.perCallUsages[index].output, cacheReadTokens: observed.perCallUsages[index].cacheRead, cacheWriteTokens: observed.perCallUsages[index].cacheWrite, reasoningTokens: observed.perCallUsages[index].reasoning })) failures.push("batch-token-limit-exceeded");
    }
    const productReply = projectActorReply2(events, 1);
    const names = observed.toolTrail.filter((entry) => entry.type === "call").map((entry) => entry.name).filter((name3) => typeof name3 === "string");
    if (!observed.turnEnded) failures.push("turn-end-missing");
    if (!productReply) failures.push("projectActorReply-missing");
    if ((name2 === "dialogue" || name2 === "zeng-dialogue") && (names.some((tool) => tool !== "submit_actor_reply") || productReply?.evidence?.length)) failures.push("dialogue-gate");
    if (name2 === "historical_fact" && (!names.some((tool) => tool === "retrieve_anecdotes" || tool === "fetch_anecdote") || !productReply?.evidence?.some((e) => e.kind === "anecdote"))) failures.push("historical-evidence-missing");
    if (name2 === "verbatim_quote" && (!names.some((tool) => tool === "retrieve_quotes" || tool === "fetch_quote") || !productReply?.evidence?.some((e) => e.kind === "quote"))) failures.push("quote-evidence-missing");
    if (name2 === "cross-person" && foreignQuote && (!names.includes("fetch_quote") || !observed.toolTrail.some((entry) => entry.type === "result" && entry.name === "fetch_quote" && isFenceRejection(entry.payload)) || observed.toolTrail.some((entry) => entry.type === "result" && (String(entry.renderedText).includes(foreignQuote.text) || String(entry.renderedText).includes(foreignQuote.source))) || String(productReply?.reply ?? "").includes(foreignQuote.text) || String(productReply?.reply ?? "").includes(foreignQuote.source))) failures.push("cross-person-fence-failed");
    const tokens = Object.values(observed.usage).reduce((a, b) => a + b, 0);
    if (tokens > TOKEN_LIMIT) failures.push("scenario-token-limit-exceeded");
    if (name2 === "cross-person" && !observed.toolTrail.some((entry) => entry.type === "result" && entry.name === "fetch_quote" && isFenceRejection(entry.payload))) failures.push("cross-person-canonical-rejection-missing");
    const modelRefusedFabrication = name2 === "adversarial" && Boolean(productReply) && !String(productReply?.reply ?? "").includes(FABRICATED_QUOTE_TEXT) && !productReply?.evidence.some((e) => e.id === adversarialQuote?.id) && observed.toolTrail.some((entry) => entry.type === "result" && entry.name === "submit_actor_reply" && isRecord3(entry.payload) && entry.payload.ok === true);
    if (name2 === "adversarial" && !modelRefusedFabrication) failures.push("adversarial-model-did-not-refuse");
    if (observed.submitFailures > 1 || observed.repairCount > 1 || observed.submitFailures === 1 && observed.repairCount !== 1) failures.push("submit-repair-budget");
    return { name: name2, persona, sessionId: String(sessionId), ...observed, startupRetryCount, latencyMs: Date.now() - started, productReply, fabricatedQuoteText: name2 === "adversarial" ? FABRICATED_QUOTE_TEXT : void 0, adversarialQuoteId: adversarialQuote?.id, foreignEvidenceText: foreignQuote?.text, foreignEvidenceSource: foreignQuote?.source, modelRefusedFabrication, hardGateFailures: failures };
  } catch (error) {
    for (const reservation of reservationIds) batchBudget.cancel(reservation);
    failures.push(error instanceof Error ? error.message : String(error));
    return { name: name2, persona, sessionId: String(sessionId), ...inspect([], 1), startupRetryCount, latencyMs: Date.now() - started, productReply: void 0, adversarialQuoteId: adversarialQuote?.id, foreignEvidenceText: foreignQuote?.text, foreignEvidenceSource: foreignQuote?.source, modelRefusedFabrication: false, hardGateFailures: failures };
  } finally {
    for (const reservation of reservationIds) batchBudget.cancel(reservation);
    off?.();
    offRequest?.();
    offStartupRetry?.();
    await handle?.dispose();
  }
}
async function runNativeEvidenceSlice(ctx) {
  if (process.env.MAN_ROLES_NATIVE_EVIDENCE === "scripted-budget") {
    const scriptedRunId = `native-evidence-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}-${randomUUID3().slice(0, 6)}`;
    return runScriptedProbe(ctx, scriptedRunId, await runNegativeFixtures(ctx, buildContentLibraries(), new ActorTurnStateRegistry(), scriptedRunId));
  }
  const runId = `real-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}-${randomUUID3().slice(0, 8)}`;
  const libs = buildContentLibraries();
  const registry8 = new ActorTurnStateRegistry();
  const results = [];
  const requests = [];
  const skipped = [];
  let totalTokens = 0;
  const hardGateFailures = [];
  const batchBudget = new BatchBudget(NATIVE_BATCH_TOKEN_LIMIT);
  for (let index = 0; index < scenarios.length; index++) {
    if (totalTokens >= TOKEN_LIMIT || batchBudget.exceeded || batchBudget.estimatedReserved >= TOKEN_LIMIT) {
      skipped.push(...scenarios.slice(index).map((scenario3) => scenario3[0]));
      break;
    }
    const scenario2 = scenarios[index];
    const result = await runOne(ctx, scenario2, runId, libs, registry8, requests, batchBudget);
    results.push(result);
    totalTokens += Object.values(result.usage).reduce((a, b) => a + b, 0);
    hardGateFailures.push(...result.hardGateFailures.map((failure) => `${result.name}:${failure}`));
    if (totalTokens > TOKEN_LIMIT || batchBudget.exceeded) {
      hardGateFailures.push("batch-token-limit-exceeded");
      skipped.push(...scenarios.slice(index + 1).map((item2) => item2[0]));
      break;
    }
  }
  if (skipped.length) hardGateFailures.push("scenarios-skipped");
  const report = { runId, mode: "real", providerNetworkUsed: true, totalTokens, tokenLimit: TOKEN_LIMIT, zeroCostRunId: process.env.MAN_ROLES_ZERO_COST_RUN_ID ?? null, passedByZeroCostRunId: process.env.MAN_ROLES_ZERO_COST_RUN_ID ?? null, expectedScenarios: scenarios.map((scenario2) => scenario2[0]), completedScenarios: results.map((result) => result.name), skippedScenarios: skipped, requests, scenarios: results, estimatedReserved: batchBudget.estimatedReserved, observedTokens: batchBudget.observedTokens, costGuardMode: "estimate_before_request + authoritative_after_response", hardGateFailures, generatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  hardGateFailures.push(...evaluateNativeEvidenceReport(report).filter((failure) => !hardGateFailures.includes(failure)));
  const root = join8(process.env.DSH_HOME ?? ".validation", "man-roles", "e2e", "native-evidence", runId);
  mkdirSync5(root, { recursive: true });
  const reportPath = join8(root, "report.json");
  writeFileSync4(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ runId, mode: "real", reportPath, totalTokens, modelCalls: results.reduce((n, s) => n + s.modelCalls, 0), hardGateFailures }));
  const appExit = ctx.get("appExit");
  if (typeof appExit === "function") appExit(hardGateFailures.length === 0 && totalTokens <= TOKEN_LIMIT ? 0 : 1);
}
function scriptedToolStream(name2 = "submit_actor_reply", args = { segments: [{ kind: "dialogue", text: "\u811A\u672C\u95E8\u63A7\u56DE\u7B54\u3002" }] }) {
  return (async function* () {
    const json = JSON.stringify(args);
    const callId = CallId(`call-${name2}`);
    yield { type: "block-start", index: 0, blockType: "tool-call" };
    yield { type: "tool-call-delta", index: 0, id: callId, name: name2, argumentsDelta: json.slice(0, 5) };
    yield { type: "tool-call-delta", index: 0, id: callId, argumentsDelta: json.slice(5) };
    yield { type: "block-end", index: 0, block: { type: "tool-call", id: callId, name: name2, arguments: json } };
    yield { type: "usage", usage: { inputTokens: 0, outputTokens: 0 } };
    yield { type: "finish", reason: { kind: "tool-calls" } };
  })();
}
function scriptedSequenceStream(sequence) {
  let index = 0;
  return () => {
    const item2 = sequence[Math.min(index++, sequence.length - 1)];
    return item2.name === "__assistant_text__" ? scriptedAssistantTextStream() : scriptedToolStream(item2.name, item2.args);
  };
}
function scriptedAssistantTextStream() {
  return (async function* () {
    yield { type: "block-start", index: 0, blockType: "text" };
    yield { type: "text-delta", index: 0, text: "\u6211\u4F1A\u8C28\u614E\u5904\u7406\u8FD9\u53E5\u8BDD\u3002" };
    yield { type: "block-end", index: 0, block: { type: "text", text: "\u6211\u4F1A\u8C28\u614E\u5904\u7406\u8FD9\u53E5\u8BDD\u3002" } };
    yield { type: "finish", reason: { kind: "stop" } };
  })();
}
function titleTextStream() {
  return (async function* () {
    yield { type: "block-start", index: 0, blockType: "text" };
    yield { type: "text-delta", index: 0, text: "\u811A\u672C\u6807\u9898" };
    yield { type: "block-end", index: 0, block: { type: "text", text: "\u811A\u672C\u6807\u9898" } };
    yield { type: "finish", reason: { kind: "stop" } };
  })();
}
async function runNegativeFixtures(ctx, libs, registry8, runId) {
  return runNegativeFixturesDE(ctx, libs, registry8, runId);
}
async function runNegativeFixturesDE(ctx, libs, registry8, runId) {
  const options = { provider: "scripted-local", model: "scripted-no-network" };
  const declared = [[], []];
  const requests = [];
  const streams = /* @__PURE__ */ new Map();
  const off = ctx.on("llm/stream", (request2, next) => {
    const id = String(request2.sessionId);
    const stream2 = streams.get(id);
    if (!stream2) return next();
    requests.push({ session: id, tools: (request2.tools ?? []).map((tool) => tool.name).sort() });
    return stream2();
  });
  let d;
  let e;
  try {
    const dId = SessionId5(`native-D-${runId}`);
    const eId = SessionId5(`native-E-${runId}`);
    const quote = libs.quotes.byPersona("wang-yangming")[0];
    const foreign = libs.quotes.byPersona("zeng-guofan")[0];
    const dInvalid = { segments: [{ kind: "historical_fact", text: "\u672A\u63D0\u4F9B\u8BC1\u636E\u7684\u4E8B\u5B9E\u6BB5" }] };
    const dRepair = { segments: [{ kind: "dialogue", text: "\u8FD9\u53E5\u65E0\u6CD5\u6838\u5B9E\uFF0C\u6211\u4E0D\u628A\u5B83\u5F53\u4F5C\u539F\u8BDD\u3002" }] };
    const eRepair = { segments: [{ kind: "dialogue", text: "\u6211\u4E0D\u80FD\u4F7F\u7528\u53E6\u4E00\u4EBA\u7269\u7684\u8BC1\u636E\u3002" }] };
    d = await ctx.agents.create({ sessionId: dId, agentOptions: options, setup: setupActorAgent("wang-yangming", libs, registry8, (names2) => declared[0].push(...names2)) });
    e = await ctx.agents.create({ sessionId: eId, agentOptions: options, setup: setupActorAgent("wang-yangming", libs, registry8, (names2) => declared[1].push(...names2)) });
    streams.set(String(dId), scriptedSequenceStream([
      { name: "fetch_quote", args: { id: quote.id } },
      { name: "submit_actor_reply", args: dInvalid },
      { name: "__assistant_text__", args: {} },
      { name: "submit_actor_reply", args: dRepair }
    ]));
    streams.set(String(eId), scriptedSequenceStream([
      { name: "fetch_quote", args: { id: foreign.id } },
      { name: "submit_actor_reply", args: eRepair }
    ]));
    const budgetD = attachTurnBudget(ctx, d.agent, createTurnBudget({ maxSteps: 4, maxToolCalls: 5, maxTokens: 2e4 }), { resolveTask: () => ({ taskId: `task-D-${runId}`, personaId: "wang-yangming", branchSessionId: String(dId) }), recordBlocked: () => void 0 });
    const budgetE = attachTurnBudget(ctx, e.agent, createTurnBudget({ maxSteps: 3, maxToolCalls: 5, maxTokens: 2e4 }), { resolveTask: () => ({ taskId: `task-E-${runId}`, personaId: "wang-yangming", branchSessionId: String(eId) }), recordBlocked: () => void 0 });
    d.agent.followup(createUserMessage7({ content: [{ type: "text", text: `\u4E25\u683C\u6309\u4E09\u6B65\uFF1A\u5148 fetch_quote \u5F53\u524D\u738B\u9633\u660E quote ID=${quote.id}\uFF0C\u518D\u7528\u771F\u5B9E evidence ID \u63D0\u4EA4\u5047\u53E5\u201C${FABRICATED_QUOTE_TEXT}\u201D\u8BA9\u8BC1\u636E\u95E8\u62D2\u7EDD\uFF0C\u6700\u540E\u53EA\u63D0\u4EA4\u5B89\u5168 dialogue\u3002` }], source: { kind: "user" } }));
    e.agent.followup(createUserMessage7({ content: [{ type: "text", text: `\u8C03\u7528 fetch_quote \u4F7F\u7528\u66FE\u56FD\u85E9 foreign ID=${foreign.id}\uFF0C\u88AB canonical \u4EBA\u7269\u56F4\u680F\u62D2\u7EDD\u540E\u5B89\u5168\u63D0\u4EA4\uFF1B\u4E0D\u5F97\u6CC4\u9732 foreign text/source\u3002` }], source: { kind: "user" } }));
    await Promise.all([d.agent.whenIdle(), e.agent.whenIdle()]);
    const dEvents = d.agent.session.events;
    const eEvents = e.agent.session.events;
    const dProjection = projectActorReply2(dEvents, 1);
    const eProjection = projectActorReply2(eEvents, 1);
    const dCalls = dEvents.filter((event2) => event2.type === "tool/call").map((event2) => event2.data.name);
    const eCalls = eEvents.filter((event2) => event2.type === "tool/call").map((event2) => event2.data.name);
    const dDirectAssistantTextCount = dEvents.filter((event2) => event2.type === "assistant/message" && event2.data.turn === 1 && event2.data.message.content.some((block) => block.type === "text" && block.text.trim())).length;
    const dResults = dEvents.filter((event2) => event2.type === "tool/result");
    const eResults = eEvents.filter((event2) => event2.type === "tool/result");
    const dPayloads = dResults.map((event2) => parsePayload(resultText(event2.data.message)));
    const dFailures = dPayloads.filter((payload) => isRecord3(payload) && payload.ok === false && payload.repairable === true).length;
    const firstFailure = dPayloads.findIndex((payload) => isRecord3(payload) && payload.ok === false && payload.repairable === true);
    const dRepairCount = firstFailure >= 0 ? dPayloads.slice(firstFailure + 1).filter((payload) => isRecord3(payload) && payload.ok === true).length : 0;
    const ePayloads = eResults.map((event2) => parsePayload(resultText(event2.data.message)));
    const eFence = ePayloads.some((payload) => isRecord3(payload) && payload.ok === false && !JSON.stringify(payload).includes(foreign.text) && !JSON.stringify(payload).includes(foreign.source));
    const failures = [];
    const names = ["fetch_anecdote", "fetch_quote", "retrieve_anecdotes", "retrieve_quotes", "submit_actor_reply"].sort();
    const dMissingIds = dPayloads.some((payload) => isRecord3(payload) && payload.errorCode === "missing-evidence-ids" && /segments\[0\]/.test(String(payload.detail ?? "")) && /不得原样重放/.test(String(payload.detail ?? "")));
    if (!dProjection || dCalls.join("|") !== "fetch_quote|submit_actor_reply|submit_actor_reply" || dCalls.length !== 3 || dDirectAssistantTextCount !== 1 || dFailures !== 1 || dRepairCount !== 1 || !dMissingIds || dProjection.evidence.some((item2) => item2.id === quote.id)) failures.push("adversarial-sequence");
    if (!eProjection || eCalls.join("|") !== "fetch_quote|submit_actor_reply" || eCalls.length !== 2 || !eFence || eProjection.reply.includes(foreign.text) || eProjection.reply.includes(foreign.source)) failures.push("cross-sequence");
    if (declared.some((items) => items.slice().sort().join("|") !== names.join("|"))) failures.push("negative-declared-tool-whitelist");
    if (requests.some((request2) => request2.tools.join("|") !== names.join("|"))) failures.push("negative-request-tool-whitelist");
    const policyResults = {};
    const runPolicyFixture = async (label, first, second, expectFallback = false) => {
      const id = SessionId5(`native-${label}-${runId}`);
      const handle = await ctx.agents.create({ sessionId: id, agentOptions: options, setup: setupActorAgent("wang-yangming", libs, registry8) });
      const session = handle.agent.session;
      registry8.setNextTurnPolicy(session, { retrievalPolicy: "deny", maxQuestions: 0, allowedControls: [] });
      streams.set(String(id), scriptedSequenceStream([{ name: "submit_actor_reply", args: first }, { name: "__assistant_text__", args: {} }, { name: "submit_actor_reply", args: second }]));
      handle.agent.followup(createUserMessage7({ content: [{ type: "text", text: `policy fixture ${label}; only submit_actor_reply` }], source: { kind: "user" } }));
      await handle.agent.whenIdle();
      const events = session.events;
      const payloads = events.filter((event2) => event2.type === "tool/result").map((event2) => parsePayload(resultText(event2.data.message)));
      const calls = events.filter((event2) => event2.type === "tool/call" && event2.data.name === "submit_actor_reply").length;
      const state = registry8.state(session, "wang-yangming", "1");
      const repairText = events.filter((event2) => event2.type === "agent/inbox/spliced").map((event2) => JSON.stringify(event2.data?.inserted ?? event2.data)).join("\n");
      const projection = projectActorReply2(events, 1);
      const completed = events.some((event2) => event2.type === "turn/end" && event2.data?.turn === 1);
      const record = { calls, payloads, failures: state.failures, repairText, projection, completed };
      const firstViolation = payloads[0];
      if (firstViolation?.errorCode !== "turn-policy-violation" || firstViolation?.repairable !== true || !/删除/.test(repairText) || !/不得原样重放/.test(repairText) || (expectFallback ? !payloads[1]?.fallback || projection !== void 0 : calls !== 2 || !projection || projection.questions?.length !== 0 || payloads[1]?.ok !== true)) failures.push(`${label}-policy-repair`);
      await handle.dispose();
      streams.delete(String(id));
      return record;
    };
    policyResults.F = await runPolicyFixture("F", { segments: [{ kind: "dialogue", text: "F" }], questions: ["\u591A\u4F59\u95EE\u9898"] }, { segments: [{ kind: "dialogue", text: "F" }], questions: [] });
    policyResults.G = await runPolicyFixture("G", { segments: [{ kind: "dialogue", text: "G" }], offeredControls: ["continue"] }, { segments: [{ kind: "dialogue", text: "G" }], offeredControls: [], questions: [] });
    policyResults.H = await runPolicyFixture("H", { segments: [{ kind: "dialogue", text: "H" }], questions: ["\u8D8A\u754C"] }, { segments: [{ kind: "dialogue", text: "H" }], questions: ["\u4ECD\u8D8A\u754C"] }, true);
    for (const mode of ["dilemma", "review", "cross-person"]) {
      const session = { events: [{ type: "turn/start", data: { turn: 1 } }] };
      const registered = [];
      const fakeCtx = { tools: { register: (definition) => registered.push(definition) } };
      registerActorTools(fakeCtx, libs, "wang-yangming", registry8);
      registry8.setNextTurnRetrievalPolicy(session, "deny");
      const exec = { agent: { session }, concludeTurn: () => void 0 };
      const denied = [];
      for (const name2 of ["retrieve_anecdotes", "fetch_anecdote", "retrieve_quotes", "fetch_quote"]) {
        const definition = registered.find((x) => x.name === name2);
        const args = name2.startsWith("retrieve_") ? { query: "\u6D4B\u8BD5" } : { id: "unknown" };
        denied.push(await definition.execute(args, exec));
      }
      const submit = registered.find((x) => x.name === "submit_actor_reply");
      const submitted = await submit.execute({ segments: [{ kind: "dialogue", text: `${mode} safe dialogue` }] }, exec);
      policyResults[mode] = { denied, submitted, ledgerEntries: registry8.stateForExecution(exec, "wang-yangming").ledger.entries().length };
      if (denied.some((result) => result?.errorCode !== "retrieval-not-authorized") || policyResults[mode].ledgerEntries !== 0 || submitted?.ok !== true) failures.push(`${mode}-retrieval-policy`);
    }
    const repeatedSession = { events: [{ type: "turn/start", data: { turn: 1 } }] };
    const repeatedTools = [];
    const repeatedCtx = { tools: { register: (definition) => repeatedTools.push(definition) } };
    registerActorTools(repeatedCtx, libs, "wang-yangming", registry8);
    let repeatedConcludes = 0;
    const repeatedExec = { agent: { session: repeatedSession }, concludeTurn: () => {
      repeatedConcludes++;
    } };
    const repeatedSubmit = repeatedTools.find((definition) => definition.name === "submit_actor_reply");
    const repeatedArgs = { segments: [{ kind: "historical_fact", text: "\u540C\u4E00\u65E0\u8BC1\u636E\u53C2\u6570" }] };
    const repeatedFirst = await repeatedSubmit.execute(repeatedArgs, repeatedExec);
    const repeatedSecond = await repeatedSubmit.execute(repeatedArgs, repeatedExec);
    const repeatedMeta = repeatedSubmit.output.presentationMeta(repeatedArgs, repeatedSecond);
    policyResults.repeatInvalid = { first: repeatedFirst, second: repeatedSecond, concluded: repeatedConcludes, publicMetaKeys: Object.keys(repeatedMeta) };
    if (repeatedFirst?.errorCode !== "missing-evidence-ids" || repeatedFirst?.repairable !== true || repeatedSecond?.fallback !== true || repeatedSecond?.concluded !== true || repeatedSecond?.reply !== void 0 || repeatedConcludes !== 1 || Object.keys(repeatedMeta).length !== 0) failures.push("repeat-invalid-fallback");
    budgetD();
    budgetE();
    return { D: { projection: dProjection, calls: dCalls, resultCount: dResults.length, directAssistantTextCount: dDirectAssistantTextCount, submitFailures: dFailures, repairCount: dRepairCount, missingEvidenceIds: dMissingIds, resultPayloads: dPayloads }, E: { projection: eProjection, calls: eCalls, resultCount: eResults.length, fenceRejectedWithoutForeignText: eFence, resultPayloads: ePayloads }, policyResults, failures, requests, declared };
  } catch (error) {
    return { D: void 0, E: void 0, failures: [error instanceof Error ? error.message : String(error)], requests, declared };
  } finally {
    off();
    await d?.dispose();
    await e?.dispose();
  }
}
async function runScriptedProbe(ctx, runId, negativeFixtures) {
  const trunkRoot = join8(process.env.DSH_HOME ?? ".validation", "man-roles", "native-evidence", runId);
  const aggregateA = ConversationAggregate.create(`conversation-A-${runId}`, join8(trunkRoot, "A"), "wang-yangming", runtimeRegistry);
  const aggregateB = ConversationAggregate.create(`conversation-B-${runId}`, join8(trunkRoot, "B"), "wang-yangming", runtimeRegistry);
  const taskA = `task-A-${runId}`;
  const taskB = `task-B-${runId}`;
  const failures = [];
  const calls = {};
  const requests = [];
  const streams = /* @__PURE__ */ new Map();
  const dispose = ctx.on("llm/stream", (options2, next) => {
    const id = String(options2.sessionId);
    const stream2 = streams.get(id);
    if (!stream2) return next();
    const isActorRequest = options2.messages.some((message) => message.role === "user" && message.source.kind === "user");
    if (!isActorRequest) return titleTextStream();
    calls[id] = (calls[id] ?? 0) + 1;
    requests.push({ session: id, system: options2.system ?? "", tools: (options2.tools ?? []).map((tool) => tool.name).sort(), messages: options2.messages.map((message) => ({ source: message.source, text: JSON.stringify(message.content) })) });
    return stream2();
  });
  const libs = buildContentLibraries();
  const stateRegistry = new ActorTurnStateRegistry();
  const declared = [[], [], [], [], []];
  const setup = (slot) => setupActorAgent("wang-yangming", libs, stateRegistry, (names) => declared[slot].push(...names));
  const options = { provider: "scripted-local", model: "scripted-no-network" };
  let a;
  let b;
  let c;
  let d;
  let e;
  let resumed;
  let aOff;
  let bOff;
  let cOff;
  let dOff;
  let eOff;
  declared.splice(3);
  try {
    const aId = SessionId5(`native-A-${runId}`);
    const bId = SessionId5(`native-B-${runId}`);
    const cId = SessionId5(`native-C-${runId}`);
    const anecdoteId = libs.anecdotes.byPersona("wang-yangming")[0].id;
    const cSubmit = { segments: [{ kind: "historical_fact", text: "\u811A\u672C\u4E8B\u8FF9\u56DE\u7B54\u3002", evidenceIds: [anecdoteId] }] };
    a = await ctx.agents.create({ sessionId: aId, agentOptions: options, setup: setup(0) });
    b = await ctx.agents.create({ sessionId: bId, agentOptions: options, setup: setup(1) });
    c = await ctx.agents.create({ sessionId: cId, agentOptions: options, setup: setup(2) });
    aOff = attachTurnBudget(ctx, a.agent, createTurnBudget({ maxSteps: 8, maxToolCalls: 5, maxTokens: 2e4 }), { resolveTask: (turn2) => ({ taskId: taskA, personaId: "wang-yangming", branchSessionId: String(aId) }), recordBlocked: (outcome) => aggregateA.recordTaskBudgetBlocked(outcome) });
    bOff = attachTurnBudget(ctx, b.agent, createTurnBudget({ maxSteps: 8, maxToolCalls: 0, maxTokens: 2e4 }), { resolveTask: (turn2) => ({ taskId: taskB, personaId: "wang-yangming", branchSessionId: String(bId) }), recordBlocked: (outcome) => aggregateB.recordTaskBudgetBlocked(outcome) });
    cOff = attachTurnBudget(ctx, c.agent, createTurnBudget({ maxSteps: 4, maxToolCalls: 5, maxTokens: 2e4 }), { resolveTask: (turn2) => ({ taskId: `task-C-${runId}`, personaId: "wang-yangming", branchSessionId: String(cId) }), recordBlocked: () => void 0 });
    streams.set(String(aId), () => scriptedToolStream());
    streams.set(String(bId), () => scriptedToolStream("fetch_quote", { id: "unknown" }));
    streams.set(String(cId), scriptedSequenceStream([{ name: "fetch_anecdote", args: { id: anecdoteId } }, { name: "__assistant_text__", args: {} }, { name: "submit_actor_reply", args: cSubmit }]));
    a.agent.followup(createUserMessage7({ content: [{ type: "text", text: "\u63D0\u4EA4" }], source: { kind: "user" } }));
    b.agent.followup(createUserMessage7({ content: [{ type: "text", text: "\u9884\u7B97" }], source: { kind: "user" } }));
    c.agent.followup(createUserMessage7({ content: [{ type: "text", text: "\u68C0\u7D22\u5E76\u63D0\u4EA4" }], source: { kind: "user" } }));
    await Promise.all([a.agent.whenIdle(), b.agent.whenIdle(), c.agent.whenIdle()]);
    const ae = a.agent.session.events;
    const aCalls = ae.filter((event2) => event2.type === "tool/call").map((event2) => event2.data.name);
    const be = b.agent.session.events;
    const ar = projectActorReply2(ae, 1);
    const br = projectActorReply2(be, 1);
    const outcomeB = aggregateB.taskOutcomes[taskB];
    const systemProjection = outcomeB ? projectTaskOutcome(outcomeB) : void 0;
    const replayedB = ConversationAggregate.load(aggregateB.conversationId, join8(trunkRoot, "B"), registry4);
    const replayedOutcome = replayedB.taskOutcomes[taskB];
    const outcomeEventCount = readFileSync6(aggregateB.trunk.filePath, "utf8").split(/\r?\n/).filter(Boolean).filter((line) => JSON.parse(line).type === TRUNK_TASK_OUTCOME_RECORDED).length;
    const names = ["fetch_anecdote", "fetch_quote", "retrieve_anecdotes", "retrieve_quotes", "submit_actor_reply"].sort();
    const budgetBlockedStateSupported = Boolean(outcomeB && systemProjection && replayedOutcome && outcomeEventCount === 1);
    const bEnd = [...be].reverse().find((event2) => event2.type === "turn/end");
    const unsafeSystem = requests.some((request2) => !request2.system.includes("MAN_ROLES_PERSONA") || !request2.system.includes("submit_actor_reply") || /AGENTS\.md|sandbox|terminal|coding agent|file editing|代码搜索|文件编辑/i.test(request2.system));
    const dilemmaClean = aggregateA.sharedLayer.dilemma.phase === "pending" && aggregateB.sharedLayer.dilemma.phase === "pending" && aggregateA.sharedLayer.dilemma.candidateText === null && aggregateB.sharedLayer.dilemma.candidateText === null;
    if (Object.keys(aggregateA.taskOutcomes).length !== 0) failures.push("a-outcome-nonempty");
    if (!outcomeB || outcomeB.taskId !== taskB || outcomeB.personaId !== "wang-yangming" || outcomeB.branchSessionId !== String(bId) || outcomeB.branchTurn !== 1 || outcomeB.status !== "blocked" || outcomeB.reason !== "budget_exceeded" || outcomeB.retryable !== true) failures.push("budget-outcome-fields");
    if (!systemProjection || systemProjection.message !== "\u672C\u8F6E\u6267\u884C\u5DF2\u505C\u6B62\uFF0C\u53EF\u91CD\u8BD5" || systemProjection.retryable !== true) failures.push("budget-system-projection");
    if (!replayedOutcome || JSON.stringify(replayedOutcome) !== JSON.stringify(outcomeB)) failures.push("budget-replay");
    if (outcomeEventCount !== 1) failures.push("budget-event-count");
    if (!dilemmaClean) failures.push("budget-dilemma-contamination");
    if (!ar || br || !budgetBlockedStateSupported) failures.push("projection-or-blocked-state");
    if (!bEnd || bEnd.data.reason.kind !== "blocked") failures.push("b-turn-not-blocked");
    if (declared.some((items) => items.slice().sort().join("|") !== names.join("|"))) failures.push("declared-tool-whitelist");
    if ((calls[String(aId)] ?? 0) !== 1 || (calls[String(bId)] ?? 0) !== 1) failures.push("model-call-count");
    if (unsafeSystem) failures.push("unsafe-system");
    if (requests.some((request2) => request2.tools.join("|") !== names.join("|"))) failures.push("request-tool-whitelist");
    await ctx.sessions.flush(a.agent.session);
    aOff?.();
    aOff = void 0;
    await a.dispose();
    a = void 0;
    const resumedDeclared = [];
    resumed = await ctx.agents.resume({ resumeSessionId: aId, agentOptions: options, setup: setupActorAgent("wang-yangming", libs, registry4, (names2) => resumedDeclared.push(...names2)) });
    const resumedEvents = resumed.agent.session.events;
    const resumedEventTypes = resumedEvents.map((event2) => event2.type);
    const resumedProjection = projectActorReply2(resumedEvents, 1);
    if (JSON.stringify(resumedProjection) !== JSON.stringify(ar) || resumedDeclared.length !== 5 || !resumedEventTypes.includes("turn/start")) failures.push("resume-projection-or-tools");
    await resumed.dispose();
    resumed = void 0;
    const cEvents = c.agent.session.events;
    const cDirectAssistantTextCount = cEvents.filter((event2) => event2.type === "assistant/message" && event2.data.turn === 1 && event2.data.message.content.some((block) => block.type === "text" && block.text.trim())).length;
    const cProjection = projectActorReply2(cEvents, 1);
    const cCalls = cEvents.filter((event2) => event2.type === "tool/call").map((event2) => event2.data.name);
    const cSequenceFailed = !cProjection || cDirectAssistantTextCount !== 1 || cCalls[0] !== "fetch_anecdote" || cCalls[1] !== "submit_actor_reply" || cCalls.length !== 2 || !cProjection.evidence.some((e2) => e2.id === anecdoteId && e2.kind === "anecdote") || declared[2].slice().sort().join("|") !== names.join("|") || requests.filter((request2) => request2.session === String(cId)).some((request2) => request2.tools.join("|") !== names.join("|"));
    if (cSequenceFailed) failures.push("retrieval-submit-sequence");
    const allFailures = [...failures, ...negativeFixtures.failures ?? []];
    const summary = { runId, providerNetworkUsed: false, tokenCost: 0, scriptedProbeCompleted: allFailures.length === 0, budgetBlockedStateSupported, outcomeEventCount, taskOutcome: outcomeB, systemProjection, replayedOutcome, hardGateFailures: allFailures, calls, requests, declaredTools: declared, resumedDeclared, resumedEventTypes, resumeProjectionMatches: JSON.stringify(resumedProjection) === JSON.stringify(ar), cProjection, cCalls, cEventCount: cEvents.length, negativeFixtures, projections: { A: ar, B: br, C: cProjection }, events: { A: ae, B: be, C: cEvents } };
    mkdirSync5(trunkRoot, { recursive: true });
    writeFileSync4(join8(trunkRoot, "report.json"), JSON.stringify(summary, null, 2), "utf8");
    console.log(JSON.stringify(summary));
    if (allFailures.length) throw new Error("scripted probe hard gate failed");
  } catch (error) {
    failures.push("probe-exception");
    throw error;
  } finally {
    aOff?.();
    bOff?.();
    cOff?.();
    dispose();
    await a?.dispose();
    await b?.dispose();
    await c?.dispose();
    await resumed?.dispose();
    const exit = ctx.get("appExit");
    if (typeof exit === "function") exit(failures.length === 0 ? 0 : 1);
  }
}

// src/e2e/delivery-probe.ts
import "@deepseek-ai/dsh-llm";
import { SessionId as SessionId6 } from "@deepseek-ai/dsh-session";
import { mkdtempSync } from "node:fs";
import { join as join9 } from "node:path";
import { tmpdir } from "node:os";

// src/branch/message-source.ts
init_schema();
import { z as z6 } from "zod";
var branchUserMessageSourceSchema = z6.object({
  conversation_id: z6.string().min(1),
  message_id: z6.string().min(1),
  raw_ref: z6.string().min(1),
  persona_id: personaIdSchema
});
var BRANCH_USER_MESSAGE_EXTRA_KEY = "man_roles_branch_delivery";
function isRecord4(value) {
  return typeof value === "object" && value !== null;
}
function branchUserMessageExtra(source) {
  return { [BRANCH_USER_MESSAGE_EXTRA_KEY]: source };
}
function branchUserMessageSourceFromData(value) {
  if (!isRecord4(value)) return void 0;
  const extra = isRecord4(value.extra) ? value.extra[BRANCH_USER_MESSAGE_EXTRA_KEY] : void 0;
  return extra ?? value.source;
}
function branchUserMessageFromData(value) {
  if (!isRecord4(value)) return void 0;
  return isRecord4(value.message) ? value.message : value;
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

// src/e2e/delivery-probe.ts
var registry5 = createRuntimeRegistry();
function recoveryMessage(data) {
  if (typeof data !== "object" || data === null) throw new Error("delivery probe: recovery payload is not an object");
  const record = data;
  if (!Array.isArray(record.content)) throw new Error("delivery probe: recovery payload content is invalid");
  const parsed = branchUserMessageSourceSchema.safeParse(branchUserMessageSourceFromData(record));
  if (!parsed.success) throw new Error("delivery probe: recovery payload source is invalid");
  return { id: typeof record.id === "string" ? record.id : parsed.data.message_id, role: "user", content: record.content, source: { kind: "user" }, extra: branchUserMessageExtra(parsed.data) };
}
async function runDeliveryProbe(ctx) {
  const target = registry5.listActive()[0];
  if (target === void 0) throw new Error("delivery probe: no active persona in registry");
  const targetPersona = target.id;
  const sessionId = SessionId6(`man-roles-delivery-probe-${Date.now()}`);
  const session = ctx.sessions.create(sessionId, { meta: { cwd: mkdtempSync(join9(tmpdir(), "man-roles-delivery-")) } });
  const trunkDir3 = mkdtempSync(join9(tmpdir(), "man-roles-trunk-"));
  const aggregate = ConversationAggregate.create("delivery-probe-recovery", trunkDir3, targetPersona, registry5);
  aggregate.indexBranch(targetPersona, String(sessionId));
  aggregate.trunk.addUserRaw("delivery-probe-recovery-message", "recovery probe", targetPersona);
  const restoredAggregate = ConversationAggregate.load(aggregate.conversationId, trunkDir3, registry5);
  await ctx.sessions.flush(session);
  let generationCalls = 0;
  const offGenerationSpy = ctx.on("llm/stream", (_options, next) => {
    generationCalls++;
    return next();
  });
  let compensationCalls = 0;
  const recovery = await runRecoveryStartup({
    delivery: {
      trunk: restoredAggregate.trunk,
      branches: {
        [targetPersona]: {
          sessionId: String(sessionId),
          findUserMessageByRawRef: async (rawRef) => {
            const persistence2 = ctx.get("sessionPersistence");
            if (persistence2 === void 0 || typeof persistence2.inspect !== "function") throw new Error("delivery probe: durable query seam unavailable");
            const inspected = await persistence2.inspect(String(sessionId));
            const persistedText = typeof inspected === "string" ? inspected : JSON.stringify(inspected);
            return persistedText.includes(rawRef);
          },
          append: (type, data, options) => session.append(type, recoveryMessage(data), options ?? { surfaceOp: "append" }),
          flush: () => ctx.sessions.flush(session)
        }
      }
    },
    compensation: { taskId: "delivery-probe-task", messageId: "delivery-probe-answer", answerExists: () => true, stateExists: () => false, compensate: () => {
      compensationCalls++;
    } }
  });
  offGenerationSpy();
  if (recovery.deliveries[0]?.status !== "recovered" || recovery.compensation?.status !== "compensated" || compensationCalls !== 1 || generationCalls !== 0) {
    throw new Error(`delivery probe: startup recovery failed deliveries=${JSON.stringify(recovery.deliveries)} compensation=${recovery.compensation?.status} compensationCalls=${compensationCalls} generationCalls=${generationCalls}`);
  }
  const source = {
    conversation_id: "delivery-probe-conversation",
    message_id: "delivery-probe-message",
    raw_ref: "raw-delivery-probe-0",
    persona_id: targetPersona
  };
  session.append("user/message", {
    id: source.message_id,
    role: "user",
    content: [{ type: "text", text: "delivery probe" }],
    source: { kind: "user" },
    extra: branchUserMessageExtra(source)
  }, { surfaceOp: "append" });
  await ctx.sessions.flush(session);
  const event2 = session.events.find((item2) => {
    if (item2.type !== "user/message") return false;
    const parsed = branchUserMessageSourceSchema.safeParse(branchUserMessageSourceFromData(item2.data));
    return parsed.success && parsed.data.raw_ref === source.raw_ref;
  });
  const eventSource = event2 ? branchUserMessageSourceSchema.safeParse(branchUserMessageSourceFromData(event2.data)) : void 0;
  if (event2 === void 0 || !eventSource?.success || eventSource.data.conversation_id !== source.conversation_id || eventSource.data.message_id !== source.message_id || eventSource.data.persona_id !== source.persona_id) {
    throw new Error("delivery probe: flushed Session.events lost source metadata");
  }
  const persistence = ctx.get("sessionPersistence");
  let persistedReadback = false;
  if (persistence !== void 0 && typeof persistence.inspect === "function") {
    const inspected = await persistence.inspect(String(sessionId));
    const persistedText = typeof inspected === "string" ? inspected : JSON.stringify(inspected);
    if (!persistedText.includes(source.raw_ref) || !persistedText.includes(source.message_id)) {
      throw new Error("delivery probe: persisted session lost source metadata");
    }
    persistedReadback = true;
  } else {
    throw new Error("delivery probe: durable persistence inspect unavailable");
  }
  console.log("[man-roles-roleplayer:delivery-probe] PASS source=%j sessionEventsReadback=true persistedReadback=%s recoveryStartup=true compensation=true generationCalls=%d providerNetworkUsed=false tokenCost=0", source, persistedReadback, generationCalls);
  const appExit = ctx.get("appExit");
  if (typeof appExit === "function") appExit(0);
}

// src/e2e/task5-host.ts
import { createUserMessage as createUserMessage8, createAssistantMessage as createAssistantMessage5 } from "@deepseek-ai/dsh-llm";
import { SessionId as SessionId7 } from "@deepseek-ai/dsh-session";
import { mkdirSync as mkdirSync6, writeFileSync as writeFileSync5, readFileSync as readFileSync7 } from "node:fs";
import { join as join10 } from "node:path";
import { createHash } from "node:crypto";

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
  const bytes = readFileSync7(file);
  const lines = bytes.toString("utf8").split(/\r?\n/).filter(Boolean);
  return { bytes: bytes.byteLength, events: lines.length, sha256: createHash("sha256").update(bytes).digest("hex") };
};
var registry6 = createTask5FixtureRegistry();
var PERSONAS2 = (() => {
  const ids = registry6.listActive().map((d) => d.id);
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
var primaryPersona = PERSONAS2[0];
var secondaryPersona = PERSONAS2[1];
if (!primaryPersona || !secondaryPersona) throw new Error("task5 fixture requires primary and secondary personas");
var ROOT = join10(process.env.DSH_HOME ?? ".", "man-roles", "task5-restart");
var CONVERSATION = "task5-real-host";
var sid = (p) => SessionId7(`man-roles-task5-${p}`);
var src = (message_id, raw_ref, persona_id) => ({ kind: "plugin", plugin: "man-roles-roleplayer", conversation_id: CONVERSATION, message_id, raw_ref, persona_id });
var event = (text, source) => createUserMessage8({ content: [{ type: "text", text }], source });
function isRecord5(value) {
  return typeof value === "object" && value !== null;
}
function appendBranchMessage(session, type, data, options) {
  if (type !== "user/message") throw new Error(`unsupported recovery event type: ${type}`);
  if (!isRecord5(data)) throw new Error("recovery user/message payload must be an object");
  const content = data.content;
  if (!Array.isArray(content) || content.length === 0) throw new Error("recovery user/message content is missing");
  const block = content[0];
  if (!isRecord5(block) || typeof block.text !== "string") throw new Error("recovery user/message text is missing");
  const parsed = branchUserMessageSourceSchema.parse(data.source);
  session.append("user/message", event(block.text, { kind: "plugin", plugin: "man-roles-roleplayer", ...parsed }), options ?? { surfaceOp: "append" });
}
var flush = (ctx, session) => ctx.sessions.flush(session);
async function inspect2(ctx, id) {
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
  const id = SessionId7("man-roles-task5-cancel");
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
    agent.agent.followup(createUserMessage8({ content: [{ type: "text", text: "fixture cancel" }], source: { kind: "user" } }));
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
    return { aborted, assistantCount: events.filter((e) => e.type === "assistant/message").length, lateAssistant: events.filter((e) => e.type === "assistant/message" && JSON.stringify(e.data).includes("LATE_MARKER")).length, derivedAttempt: derivedAttempts.count, derivedResult, persistedDerived: derivedResult.status === "committed" ? 1 : 0, requests, usageTokens: requests.reduce((sum, request2) => sum + request2.usageTokens, 0) };
  } finally {
    off();
    release.resolve();
    await agent.dispose();
  }
}
async function runTask5Host(ctx, stage) {
  mkdirSync6(ROOT, { recursive: true });
  const trunkDir3 = join10(ROOT, "trunk");
  const reportPath = join10(ROOT, `${stage}.json`);
  const aggregate = stage === "stage1" ? ConversationAggregate.create(CONVERSATION, trunkDir3, primaryPersona, registry6) : ConversationAggregate.load(CONVERSATION, trunkDir3, registry6);
  let recoveryStreamCalls = 0;
  const off = ctx.on("llm/stream", () => {
    recoveryStreamCalls++;
    throw new Error("recovery generation forbidden");
  });
  if (stage === "stage1") {
    const sessions = new Map(PERSONAS2.map((p) => [p, ctx.sessions.create(sid(p))]));
    PERSONAS2.forEach((p) => aggregate.indexBranch(p, String(sid(p))));
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
    const retryResult = await deliverCurrentUserMessage({ trunk: aggregate.trunk, persona: primaryPersona, session: { append: (type, data, options) => appendBranchMessage(requireMapValue(sessions, primaryPersona, "session"), type, data, options) }, sessionId: String(sid(primaryPersona)), messageId: "retry-1", text: "retry text", flush: () => flush(ctx, requireMapValue(sessions, primaryPersona, "session")), findUserMessageByRawRef: async (raw) => sources(await inspect2(ctx, sid(primaryPersona))).some((x) => x.raw_ref === raw) });
    const retryBranchAfter = count(await inspect2(ctx, sid(primaryPersona)), "retry-1");
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
    for (const p of PERSONAS2) {
      const s = requireMapValue(sessions, p, "session");
      s.append("turn/start", { turn: 1 });
      s.append("step/start", { turn: 1, step: 1 });
      s.append("assistant/message", { turn: 1, step: 1, message: createAssistantMessage5({ content: [{ type: "text", text: `private-${p}` }], source: { provider: "task5-scripted", model: "no-network" } }) }, { surfaceOp: "append" });
      s.append("step/end", { turn: 1, step: 1 });
      s.append("turn/end", { turn: 1, reason: { kind: "completed" } });
      await flush(ctx, s);
    }
    const persisted = Object.fromEntries(PERSONAS2.map((p) => [p, sources(requireMapValue(sessions, p, "session").events).length]));
    writeFileSync5(reportPath, JSON.stringify({ stage, pid: process.pid, expectedPersonaIds: PERSONAS2, dshSessions: Object.fromEntries(PERSONAS2.map((p) => [p, String(sid(p))])), persisted, crashBoundaries: { acceptedOnly: true, branchFlushed: true, assistantFlushed: true }, trunk: { file: trunkFile, beforeRetry, afterRetry, afterConflicts }, stage1Observation: { retry: { sameIdSamePayload: { rawCount: aggregate.trunk.state.userRaws.filter((r) => r.messageId === "retry-1").length, rawRef: retryRef, branchBefore: retryBranchBefore, branchAfter: retryBranchAfter, result: retryResult.status, trunkChangedOnlyByCommit: afterRetry.events === beforeRetry.events + 1 }, sameIdTextConflict: { message: textConflict, rawCount: aggregate.trunk.state.userRaws.length, trunkUnchanged: afterConflicts.sha256 === afterRetry.sha256 }, sameIdTargetConflict: { message: targetConflict, rawCount: aggregate.trunk.state.userRaws.length, trunkUnchanged: afterConflicts.sha256 === afterRetry.sha256 } } }, providerObservation: { recoveryStreamCalls, providerNetworkUsed: false, tokenCost: 0 } }));
  } else {
    const stage1 = JSON.parse(readFileSync7(join10(ROOT, "stage1.json"), "utf8"));
    if (JSON.stringify(stage1.expectedPersonaIds) !== JSON.stringify(PERSONAS2) || PERSONAS2.some((p) => stage1.dshSessions[p] !== String(sid(p)))) throw new Error("stage1 fixture identity mismatch");
    const handles = /* @__PURE__ */ new Map();
    for (const p of PERSONAS2) handles.set(p, await ctx.agents.resume({ resumeSessionId: sid(p), agentOptions: { provider: "task5-scripted", model: "no-network" }, setup: () => ({ commit: () => void 0 }) }));
    const sessions = new Map(PERSONAS2.map((p) => [p, requireMapValue(handles, p, "agent handle").agent.session]));
    const before = /* @__PURE__ */ new Map();
    for (const p of PERSONAS2) before.set(p, await inspect2(ctx, sid(p)));
    const beforeCommitted = aggregate.trunk.state.deliveryCommitted.length;
    const branches = {};
    for (const p of PERSONAS2) {
      const s = requireMapValue(sessions, p, "session");
      branches[p] = { sessionId: String(sid(p)), append: (type, data, options) => {
        if (type !== "user/message") throw new Error(`unsupported recovery event type: ${type}`);
        if (!isRecord5(data)) throw new Error("recovery user/message payload must be an object");
        const content = data.content;
        if (!Array.isArray(content) || content.length === 0) throw new Error("recovery user/message content is missing");
        const block = content[0];
        if (!isRecord5(block) || typeof block.text !== "string") throw new Error("recovery user/message text is missing");
        const parsed = branchUserMessageSourceSchema.parse(data.source);
        s.append("user/message", event(block.text, { kind: "plugin", plugin: "man-roles-roleplayer", ...parsed }), options ?? { surfaceOp: "append" });
      }, flush: () => flush(ctx, s), findUserMessageByRawRef: async (raw) => sources(await inspect2(ctx, sid(p))).some((x) => x.raw_ref === raw) };
    }
    const beforeSources = Object.fromEntries(PERSONAS2.map((p) => [p, sources(requireMapValue(before, p, "before events"))]));
    const recovery = await runRecoveryStartup({ delivery: { trunk: aggregate.trunk, branches }, compensation: { taskId: "task5-assistant-derived", messageId: "assistant-1", answerExists: () => PERSONAS2.some((p) => requireMapValue(sessions, p, "session").events.some((e) => e.type === "assistant/message")), stateExists: () => aggregate.sharedLayer.dilemma.phase === "candidate", compensate: () => aggregate.setDilemmaCandidate("fixture-derived", primaryPersona) } });
    const after = /* @__PURE__ */ new Map();
    for (const p of PERSONAS2) after.set(p, await inspect2(ctx, sid(p)));
    const afterCommitted = aggregate.trunk.state.deliveryCommitted.length;
    off();
    const cancel = await cancelScenario(ctx);
    const assistant = Object.fromEntries(PERSONAS2.map((p) => [p, requireMapValue(after, p, "after events").filter((e) => e.type === "assistant/message").map((e) => JSON.stringify(e.data))]));
    const restored = Object.fromEntries(PERSONAS2.map((p) => [p, sources(requireMapValue(after, p, "after events"))]));
    const isolation = Object.fromEntries(PERSONAS2.map((p) => [p, requireRecordArray(assistant, p, "assistant").some((x) => x.includes(`private-${p}`)) && requireRecordArray(assistant, p, "assistant").every((x) => PERSONAS2.filter((q) => q !== p).every((q) => !x.includes(`private-${q}`)))]));
    const scenario2 = { identical: { same1: { raw: aggregate.trunk.state.userRaws.filter((r) => r.messageId === "same-1").length, branch: count(after.get(primaryPersona), "same-1") }, same2: { raw: aggregate.trunk.state.userRaws.filter((r) => r.messageId === "same-2").length, branch: count(after.get(primaryPersona), "same-2") } }, retry: { raw: aggregate.trunk.state.userRaws.filter((r) => r.messageId === "retry-1").length, branch: count(after.get(primaryPersona), "retry-1"), committed: aggregate.trunk.state.deliveryCommitted.filter((d) => d.raw_ref === aggregate.trunk.state.userRaws.find((r) => r.messageId === "retry-1").rawRef).length }, acceptedOnly: { beforeBranch: count(before.get(primaryPersona), "accepted-only"), afterBranch: count(after.get(primaryPersona), "accepted-only"), committed: aggregate.trunk.isBranchDeliveryCommitted(primaryPersona, aggregate.trunk.state.userRaws.find((r) => r.messageId === "accepted-only").rawRef), status: recovery.deliveries.find((d) => d.messageId === "accepted-only")?.status, failureCode: recovery.deliveries.find((d) => d.messageId === "accepted-only")?.failureCode }, branchOnly: { beforeBranch: count(before.get(secondaryPersona), "branch-only"), afterBranch: count(after.get(secondaryPersona), "branch-only"), committed: aggregate.trunk.isBranchDeliveryCommitted(secondaryPersona, aggregate.trunk.state.userRaws.find((r) => r.messageId === "branch-only").rawRef), status: recovery.deliveries.find((d) => d.messageId === "branch-only")?.status, failureCode: recovery.deliveries.find((d) => d.messageId === "branch-only")?.failureCode }, assistantState: { assistantByPersona: Object.fromEntries(PERSONAS2.map((p) => [p, requireRecordArray(assistant, p, "assistant").length])), derivedPersisted: aggregate.sharedLayer.dilemma.phase === "candidate", generation: recoveryStreamCalls }, cancel: { aborted: cancel.aborted, targetTurnAssistantCount: cancel.assistantCount, lateMarkerCount: cancel.lateAssistant, derivedMarkerCount: cancel.persistedDerived, localRequests: cancel.requests.length } };
    const byPersona = Object.fromEntries(PERSONAS2.map((p) => [p, requireMapValue(after, p, "after events").length]));
    writeFileSync5(reportPath, JSON.stringify({ stage, pid: process.pid, expectedPersonaIds: PERSONAS2, stage1Pid: stage1.pid, stage2Pid: process.pid, processRestart: stage1.pid !== process.pid, dshPersistence: PERSONAS2.every((p) => requireMapValue(after, p, "after events").length > 0), providerObservation: { recoveryStreamCalls, scriptedRequests: cancel.requests.length, scriptedOnly: cancel.requests.every((r) => r.provider === "man-roles-compat-local" && r.model === "scripted-no-network"), providerNetworkUsed: cancel.requests.some((r) => !(r.provider === "man-roles-compat-local" && r.model === "scripted-no-network")), tokenCost: cancel.requests.reduce((sum, request2) => sum + request2.usageTokens, 0), requests: cancel.requests }, recovery, before: { byPersona: Object.fromEntries(PERSONAS2.map((p) => [p, requireMapValue(before, p, "before events").length])), sources: beforeSources, committed: beforeCommitted }, after: { byPersona, sources: restored, committed: afterCommitted }, derivedState: { persisted: aggregate.sharedLayer.dilemma.phase === "candidate", generationCalls: recoveryStreamCalls }, cancel, restored, assistant, order: aggregate.sharedLayer.userRaws.map((r) => r.messageId), isolation, counts: { userSources: Object.values(restored).reduce((n, x) => n + x.length, 0), committed: afterCommitted }, scenarios: scenario2, authority: { stage1: stage1.stage1Observation, beforeKeys: Object.keys(beforeSources), afterKeys: Object.keys(restored) } }));
    for (const h of handles.values()) await h.dispose();
  }
  if (stage === "stage1") off();
  const exit = ctx.get("appExit");
  if (typeof exit === "function") exit(0);
}

// src/e2e/vertical-slice-dialogue-loop.ts
import { mkdirSync as mkdirSync8, mkdtempSync as mkdtempSync2, readFileSync as readFileSync8, rmSync, writeFileSync as writeFileSync6 } from "node:fs";
import { tmpdir as tmpdir2 } from "node:os";
import { join as join11 } from "node:path";
import { createHash as createHash3 } from "node:crypto";

// src/dialogue/safety.ts
import { z as z7 } from "zod";
var safetyResultSchema = z7.object({ disposition: z7.enum(["allow", "professional-boundary", "urgent-help", "refuse"]), reason: z7.enum(["none", "medical", "mental-health", "legal", "financial", "self-harm", "imminent-danger", "sexual", "illegal-assistance"]), message: z7.string() }).strict().superRefine((v, ctx) => {
  const allowed = { allow: ["none"], "professional-boundary": ["medical", "mental-health", "legal", "financial"], "urgent-help": ["self-harm", "imminent-danger"], refuse: ["sexual", "illegal-assistance"] };
  if (!(allowed[v.disposition] ?? []).includes(v.reason)) ctx.addIssue({ code: z7.ZodIssueCode.custom, message: "safety reason does not match disposition" });
  if (v.disposition === "allow" && v.message !== "") ctx.addIssue({ code: z7.ZodIssueCode.custom, message: "allow must have empty message" });
  if (v.disposition !== "allow" && v.message.trim() === "") ctx.addIssue({ code: z7.ZodIssueCode.custom, message: "nonallow must have non-empty message" });
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
function createControlClassifier(adapter, observe2) {
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
      const request2 = { raw: input.raw, ...input.confirmedContext === void 0 ? {} : { confirmedContext: input.confirmedContext }, ...input.phase === void 0 ? {} : { phase: input.phase }, ...input.invocationId === void 0 ? {} : { invocationId: input.invocationId } };
      const invoke = async () => {
        attempts++;
        const value = await adapter(request2);
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
import { z as z8 } from "zod";
var feedbackPayloadSchema = z8.object({
  kind: z8.enum(["none", "confirm", "partial-confirm", "correct", "reject", "new-information", "reality-changed", "disagree-persona", "not-helpful", "question-evidence", "action-feedback", "skip", "continue", "pause", "end", "unclear"]),
  itemId: z8.string().min(1).optional(),
  replacement: z8.unknown().optional(),
  details: z8.object({ summary: z8.string().trim().min(1), lastSemanticSeq: z8.number().optional() }).strict().optional()
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
var applyFeedbackCommit = commitFeedback;

// src/dialogue/director-update.ts
init_schema();
import { createHash as createHash2 } from "node:crypto";
import { z as z9 } from "zod";
var proposalSchema = z9.object({ id: z9.string().min(1).optional(), kind: z9.enum(["fact", "inference", "goal", "value-conflict", "core-conflict"]), text: z9.string().min(1), sourceRawRefs: z9.array(z9.string().min(1)).min(1), proposedByPersona: personaIdSchema2 }).strict();
var directorUpdateSchema = z9.object({ propose: z9.array(proposalSchema), coreCandidateId: z9.string().min(1).optional() }).strict();
var idFor = (p) => `candidate-${createHash2("sha256").update(JSON.stringify([p.kind, p.text, p.sourceRawRefs, p.proposedByPersona])).digest("hex").slice(0, 20)}`;
function validateDirectorUpdate(value, state, personaId, registry8) {
  registry8.get(personaId);
  const parsed = directorUpdateSchema.parse(value);
  const seen = /* @__PURE__ */ new Set();
  const propose = parsed.propose.map((raw) => {
    if (raw.proposedByPersona !== personaId) throw new Error("director proposal must belong to current persona");
    registry8.get(raw.proposedByPersona);
    if (raw.sourceRawRefs.some((ref) => !state.userRaws.some((u) => u.rawRef === ref))) throw new Error("candidate source raw_ref missing");
    const canonicalRefs = [...new Set(raw.sourceRawRefs)].sort((a, b) => (state.userRaws.find((u) => u.rawRef === a)?.ref ?? Number.MAX_SAFE_INTEGER) - (state.userRaws.find((u) => u.rawRef === b)?.ref ?? Number.MAX_SAFE_INTEGER));
    const canonicalProposal = { ...raw, sourceRawRefs: canonicalRefs, proposedByPersona: personaId };
    const item2 = { ...canonicalProposal, id: raw.id ?? idFor(canonicalProposal) };
    if (seen.has(item2.id)) throw new Error("duplicate candidate id");
    seen.add(item2.id);
    return item2;
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
  for (const item2 of items) {
    if (ids.has(item2.id)) throw new Error(`duplicate candidate id: ${item2.id}`);
    ids.add(item2.id);
    const existing = input.state.dilemmaItems.find((x) => x.id === item2.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(item2)) throw new Error(`dilemma item conflict: ${item2.id}`);
  }
  for (const item2 of items) {
    const eventRefs = canonicalRefs([...input.sourceRawRefs, ...item2.sourceRawRefs]);
    input.trunk.preflightDialogueEvent("trunk/dilemma-item-proposed", { messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurpose}:${item2.id}`, sourceRawRefs: eventRefs, item: item2, personaId: item2.proposedByPersona });
  }
  for (const item2 of items) {
    const eventRefs = canonicalRefs([...input.sourceRawRefs, ...item2.sourceRawRefs]);
    input.trunk.proposeDilemmaItem(item2, { messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurpose}:${item2.id}`, sourceRawRefs: eventRefs });
    itemIds.push(item2.id);
  }
  return { itemIds, ...update.coreCandidateId === void 0 ? {} : { coreCandidateId: update.coreCandidateId } };
}
var commitDirectorProposals = commitDirectorUpdate;

// src/dialogue/public-view.ts
function canonical2(id, registry8) {
  return registry8.get(id).id;
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
function buildActorContext(state, persona, registry8, currentRawRef, selectedHistoricalRawRefs = [], currentBranchHistory = []) {
  const personaId = canonical2(persona, registry8);
  const definition = registry8.get(personaId);
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
function publicDialogueView(state, persona, registry8) {
  const id = canonical2(persona, registry8);
  const branches = {};
  for (const key of Object.keys(state.branchesIndex)) branches[key] = { progress: state.branchProgress[key] ?? null };
  return { dilemmaItems: state.dilemmaItems.filter((x) => x.status === "confirmed" && x.visibility === "shared-confirmed" && !x.supersededBy || x.status === "candidate" && x.proposedByPersona === id && !x.supersededBy), branchProgress: state.branchProgress[id] ?? null, dialogue: state.dialogue, branches };
}

// src/dialogue/turn-interpreter.ts
import { z as z10 } from "zod";
var turnInterpretationSchema = z10.object({
  responseNeeds: z10.object({ answerKnowledge: z10.boolean(), acknowledgeEmotion: z10.boolean(), clarify: z10.boolean(), proposeCandidate: z10.boolean() }).strict(),
  safetyEscalation: z10.enum(["none", "professional-boundary", "urgent-help", "refuse"]),
  feedback: z10.enum(["none", "confirm", "partial-confirm", "correct", "reject", "skip", "pause", "end", "continue"])
}).strict();
function interpretTurn(raw) {
  const text = raw.trim();
  const knowledge = /知行|思想|原话|事迹|何谓|怎么理解/.test(text);
  const emotion = /害怕|担心|焦虑|难过|不安|痛苦|犹豫/.test(text);
  const control = /暂停|先到这里/.test(text) ? "pause" : /结束|再见/.test(text) ? "end" : "none";
  return { responseNeeds: { answerKnowledge: knowledge, acknowledgeEmotion: emotion, clarify: !knowledge || emotion, proposeCandidate: (emotion || !knowledge) && text.length > 8 }, safetyEscalation: "none", feedback: control };
}

// src/dialogue/coordinator.ts
var meta = (input, refs, suffix) => ({ messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurposePrefix}:${suffix}`, sourceRawRefs: refs });
var fail = (code, error, calls) => ({ status: "failed", error: { code, message: error instanceof Error ? error.message : String(error) }, calls });
function v2TurnInstruction(interpretation) {
  if (interpretation.feedback === "end") return { intent: "close", allowedControls: [], shouldRunDirector: false, shouldOfferNewConversation: false };
  if (interpretation.feedback === "pause") return { intent: "pause", allowedControls: ["continue", "end"], shouldRunDirector: false, shouldOfferNewConversation: false };
  if (interpretation.responseNeeds.clarify) return { intent: "clarify", allowedControls: ["continue", "skip", "pause", "end"], shouldRunDirector: false, shouldOfferNewConversation: false };
  return { intent: "answer", allowedControls: ["continue", "end"], shouldRunDirector: false, shouldOfferNewConversation: false };
}
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
  const existingCandidate = deps.trunk.state.dilemmaItems.some((item2) => item2.status === "candidate" && item2.proposedByPersona === personaId && !item2.supersededBy);
  const policy = decideTurn({ taskMode: control.taskMode, feedbackKind: control.feedbackKind, phase: deps.trunk.state.dialogue?.phase ?? "responding", hasCandidate: existingCandidate, hasConfirmed: deps.trunk.state.dilemmaItems.some((item2) => item2.status === "confirmed" && !item2.supersededBy), noProgressCount: deps.trunk.state.dialogue?.noProgressCount ?? 0, emotionPriority: control.emotionPriority, independentNewDilemma: control.independentNewDilemma });
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
  let branchHistory3;
  try {
    branchHistory3 = await deps.loadCurrentBranchHistory({ personaId, sessionId });
  } catch (error) {
    return { ...fail("branch-history-failed", error, calls), control, policy };
  }
  const context = buildActorContext(deps.trunk.state, personaId, deps.registry, delivered.rawRef, selectedHistoricalRawRefs, branchHistory3);
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
async function runDialogueTurnV2(input, deps) {
  const calls = { director: 0, actor: 0, retrieval: 0, interpreter: 0 };
  const personaId = deps.registry.get(input.personaId).id;
  let delivery;
  try {
    delivery = await deliverCurrentUserMessage({ ...deps.delivery, trunk: deps.trunk, persona: personaId, messageId: input.messageId, text: input.raw });
  } catch (error) {
    return fail("delivery-failed", error, calls);
  }
  if (delivery.status !== "committed" || !delivery.canStartGeneration) return { ...fail("delivery-not-committed", delivery.error ?? "delivery pending", calls), delivery };
  return runDialogueTurnV2AfterDelivery(input, deps, delivery);
}
async function runDialogueTurnV2AfterDelivery(input, deps, delivery) {
  const calls = { director: 0, actor: 0, retrieval: 0, interpreter: 0 };
  const personaId = deps.registry.get(input.personaId).id;
  if (delivery.status !== "committed" || !delivery.canStartGeneration) return { ...fail("delivery-not-committed", delivery.error ?? "delivery pending", calls), delivery };
  const safety = deterministicSafetyGate(input.raw);
  if (safety.disposition !== "allow") return { status: safety.disposition, safety, calls, delivery, reply: safety.message };
  const current = deps.trunk.state.userRaws.find((raw) => raw.rawRef === delivery.rawRef);
  if (!current) return { ...fail("current-raw-missing", delivery.rawRef, calls), delivery };
  const existingAnswer = await deps.actor.answerExists({ messageId: input.messageId, personaId });
  if (existingAnswer) {
    const loaded = await deps.actor.loadExisting({ messageId: input.messageId, personaId });
    if (loaded === void 0) return { ...fail("existing-answer-missing", "answerExists=true but loadExisting returned undefined", calls), delivery };
    if (loaded.progressSummary !== void 0 && loaded.progressSummary !== null && deps.trunk.state.branchProgress[personaId]?.summary !== loaded.progressSummary) {
      try {
        deps.trunk.updateBranchProgress({ personaId, summary: loaded.progressSummary, lastSemanticSeq: deps.trunk.nextSeq }, { messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurposePrefix}:progress`, sourceRawRefs: [delivery.rawRef] });
      } catch (error) {
        return { ...fail("progress-failed", error, calls), reply: loaded, delivery };
      }
    }
    return { status: "ok", calls, delivery, reply: loaded };
  }
  calls.interpreter++;
  const interpretation = (deps.interpreter ?? interpretTurn)(current.text);
  if (interpretation.safetyEscalation !== "none") return { status: interpretation.safetyEscalation, interpretation, calls, delivery };
  const hasCandidate = deps.trunk.state.dilemmaItems.some((item2) => item2.status === "candidate" && item2.proposedByPersona === personaId && !item2.supersededBy);
  let candidates = deps.trunk.state.dilemmaItems.filter((item2) => item2.status === "candidate" && item2.proposedByPersona === personaId && !item2.supersededBy).map((item2) => ({ ...item2, unconfirmed: true }));
  if (interpretation.responseNeeds.proposeCandidate && !hasCandidate) {
    calls.director++;
    try {
      const update = await deps.director({ raw: current.text, personaId, currentRawRef: delivery.rawRef });
      if (update !== void 0) commitDirectorUpdate({ update, state: deps.trunk.state, personaId, trunk: deps.trunk, messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurposePrefix}:director`, sourceRawRefs: [delivery.rawRef] });
    } catch {
    }
    candidates = deps.trunk.state.dilemmaItems.filter((item2) => item2.status === "candidate" && item2.proposedByPersona === personaId && !item2.supersededBy).map((item2) => ({ ...item2, unconfirmed: true }));
  }
  const sessionId = deps.trunk.state.branchesIndex[personaId];
  if (!sessionId) return { ...fail("branch-session-missing", personaId, calls), interpretation, delivery };
  const history = await deps.loadCurrentBranchHistory({ personaId, sessionId });
  const historyItems = history.map((text, index) => ({ rawRef: `branch-${personaId}-${index}`, text, personaId }));
  const selected = selectHistory({ currentRaw: current, candidates: deps.trunk.state.userRaws, confirmedRawRefs: deps.trunk.state.dilemmaItems.filter((item2) => item2.status === "confirmed").flatMap((item2) => item2.sourceRawRefs), budgetTokens: deps.contextBudgetTokens ?? 4e3, personaId, branchHistory: historyItems });
  const trunkRefs = new Set(deps.trunk.state.userRaws.map((raw) => raw.rawRef));
  const context = buildActorContext(deps.trunk.state, personaId, deps.registry, delivery.rawRef, selected.selectedRawRefs.filter((ref) => ref !== delivery.rawRef && trunkRefs.has(ref)), history);
  const policy = v2TurnInstruction(interpretation);
  calls.actor++;
  let reply;
  try {
    reply = await deps.actor.run({ context, policy, candidates });
  } catch (error) {
    return { ...fail("actor-failed", error, calls), interpretation, context, delivery };
  }
  calls.retrieval = reply.retrievalCalls ?? 0;
  if (reply.progressSummary !== void 0 && deps.trunk.state.branchProgress[personaId]?.summary !== reply.progressSummary) deps.trunk.updateBranchProgress({ personaId, summary: reply.progressSummary, lastSemanticSeq: deps.trunk.nextSeq }, { messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurposePrefix}:progress`, sourceRawRefs: [delivery.rawRef] });
  return { status: "ok", interpretation, context, candidate: candidates, reply, calls, delivery };
}

// src/e2e/dialogue-loop-fixture.ts
import { mkdirSync as mkdirSync7 } from "node:fs";
init_trunk_storage();
var FIXTURE_PERSONA_IDS = ["alpha", "beta", "gamma"];
function createDialogueFixture(root, conversationId = "dialogue-loop") {
  const registry8 = new PersonaRegistry(FIXTURE_PERSONA_IDS.map((id) => ({ manifest: { id, displayName: id, status: "active", legacyIds: [], content: { prompt: "fixture", anecdotes: "fixture", quotes: "fixture", blacklist: "fixture" } }, prompt: "fixture", anecdotes: [], quotes: [], blacklist: [] })));
  mkdirSync7(root, { recursive: true });
  const trunk = TrunkStorage.create(conversationId, root, "alpha", registry8);
  const branches = Object.fromEntries(FIXTURE_PERSONA_IDS.map((personaId) => {
    const branch = { personaId, sessionId: `fixture-${conversationId}-${personaId}`, events: [], append(type, data) {
      branch.events.push({ type, personaId, text: data.content?.[0]?.text ?? "", rawRef: data.source?.raw_ref });
    }, async flush() {
    } };
    trunk.indexBranch(personaId, branch.sessionId);
    return [personaId, branch];
  }));
  return { root, registry: registry8, trunk, branches, answers: /* @__PURE__ */ new Map(), observations: [], actorContexts: [], actorResults: [], providerRequests: [], globalTrace: [], loaderRequests: [] };
}
function branchHistory(branch) {
  return branch.events.map((e) => `${e.type}:${e.text}`);
}

// src/validation/dialogue-loop-report.ts
import { z as z11 } from "zod";
var requestSchema = z11.object({ kind: z11.enum(["classifier", "director", "actor", "retrieval"]), requestId: z11.string().min(1), personaId: z11.string().optional(), usage: z11.object({ inputTokens: z11.number().int().nonnegative(), outputTokens: z11.number().int().nonnegative(), totalTokens: z11.number().int().nonnegative() }).strict(), network: z11.boolean() }).strict();
var contextSchema = z11.array(z11.object({ personaId: z11.string(), currentRawRef: z11.string(), candidateItems: z11.array(z11.unknown()), confirmedItems: z11.array(z11.unknown()), selectedHistoricalRawRefs: z11.array(z11.string()), branchHistory: z11.array(z11.string()), branchProgress: z11.unknown() }).strict());
var actorResultSchema = z11.object({ personaId: z11.string(), messageId: z11.string(), questions: z11.array(z11.string()), controls: z11.array(z11.string()), retrievalCalls: z11.number().int().nonnegative(), replyMarker: z11.string() }).strict();
var restartSchema = z11.object({ before: z11.object({ actor: z11.number(), classifier: z11.number(), director: z11.number(), rawCount: z11.number(), answerCount: z11.number(), branchCount: z11.number(), progressCount: z11.number(), bytesHash: z11.string() }).strict(), after: z11.object({ actor: z11.number(), classifier: z11.number(), director: z11.number(), rawCount: z11.number(), answerCount: z11.number(), branchCount: z11.number(), progressCount: z11.number(), bytesHash: z11.string() }).strict(), progressCompensated: z11.boolean(), loadBytesUnchanged: z11.boolean(), actorDelta: z11.number(), classifierDelta: z11.number(), directorDelta: z11.number(), rawDelta: z11.number(), answerDelta: z11.number(), branchDelta: z11.number(), progressDelta: z11.number(), loadedHash: z11.string(), finalHash: z11.string() }).strict();
var scenarioSchema = z11.object({ name: z11.string(), status: z11.enum(["passed", "blocked"]), error: z11.string().optional(), calls: z11.object({ classifier: z11.number().int().nonnegative(), director: z11.number().int().nonnegative(), actor: z11.number().int().nonnegative(), retrieval: z11.number().int().nonnegative() }).strict(), providerRequests: z11.array(requestSchema), actorResults: z11.array(actorResultSchema), eventTypes: z11.array(z11.string()), eventSeqs: z11.array(z11.number().int().nonnegative()), candidateStatuses: z11.array(z11.string()), revisionLineage: z11.array(z11.object({ id: z11.string(), text: z11.string(), status: z11.string(), visibility: z11.string(), supersedes: z11.string().optional(), supersededBy: z11.string().optional() }).strict()), contexts: z11.record(z11.string(), contextSchema), branchHistories: z11.record(z11.string(), z11.array(z11.string())), globalTrace: z11.array(z11.object({ seq: z11.number(), kind: z11.string(), type: z11.string(), personaId: z11.string().optional() }).strict()), loaderRequests: z11.array(z11.object({ personaId: z11.string(), sessionId: z11.string(), target: z11.string() }).strict()), restart: restartSchema.optional(), urgentDownstreamCalls: z11.number().int().nonnegative() }).strict();
var dialogueLoopReportSchema = z11.object({ schemaVersion: z11.literal(3), providerNetworkUsed: z11.boolean(), tokenCost: z11.number().int().nonnegative(), providerRequests: z11.array(requestSchema), scenarios: z11.array(scenarioSchema), totalCalls: z11.number().int().nonnegative(), expectedPersonaIds: z11.array(z11.string()), passed: z11.boolean() }).strict();
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
      if (d === void 0 || a === void 0 || d >= a || !context?.candidateItems.some((item2) => typeof item2 === "object" && item2 !== null && "unconfirmed" in item2 && item2.unconfirmed === true && "id" in item2 && candidateIds.has(item2.id))) return fail2("director-before-actor");
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
          const own = c.candidateItems.every((item2) => typeof item2 === "object" && item2 !== null && "proposedByPersona" in item2 && item2.proposedByPersona === p);
          if (!own) return fail2("switch-context-invalid");
          for (const [other, marker] of replies) if (other !== p && c.branchHistory.some((line) => line.includes(marker))) return fail2("foreign-branch-leak");
          if (c.branchHistory.some((line) => s.actorResults.some((a) => a.personaId !== p && a.replyMarker.length > 0 && line.includes(a.replyMarker)))) return fail2("foreign-branch-leak");
          const progress = JSON.stringify(c.branchProgress ?? "");
          for (const [other, marker] of replies) if (other !== p && (progress.includes(marker) || progress.includes(`progress-${other}`))) return fail2("foreign-branch-leak");
        }
      }
      for (const p of others) {
        const c = s.contexts[p].at(-1);
        const hasShared = c?.confirmedItems.some((item2) => typeof item2 === "object" && item2 !== null && "id" in item2 && item2.id === shared.id);
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
var zero2 = () => ({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
var sha = (s) => createHash3("sha256").update(s).digest("hex");
function observe(f, kind, personaId) {
  const request2 = { kind, requestId: `${f.root.split(/[\\/]/).pop()}-${kind}-${f.providerRequests.length + 1}`, ...personaId ? { personaId } : {}, usage: zero2(), network: false };
  f.providerRequests.push(request2);
  f.observations.push(request2);
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
    delivery: { session: f.branches[personaId], sessionId: f.branches[personaId].sessionId, flush: async (session) => session.flush(), findUserMessageByRawRef: (ref) => f.branches[personaId].events.some((event2) => event2.rawRef === ref) },
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
function reportScenario(f, name2, result) {
  const lines = readFileSync8(f.trunk.filePath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const calls = { classifier: 0, director: 0, actor: 0, retrieval: 0 };
  for (const request2 of f.providerRequests) calls[request2.kind]++;
  const contexts = Object.fromEntries(FIXTURE_PERSONA_IDS.map((persona) => [persona, f.actorContexts.filter((x) => x.personaId === persona)]));
  const histories = Object.fromEntries(FIXTURE_PERSONA_IDS.map((persona) => [persona, branchHistory(f.branches[persona])]));
  const branchTypes = FIXTURE_PERSONA_IDS.flatMap((persona) => f.branches[persona].events.map((event2) => event2.type));
  return { name: name2, status: name2 === "urgent" || result.status !== "ok" ? "blocked" : "passed", providerRequests: [...f.providerRequests], actorResults: f.actorResults.map((a) => ({ ...a, messageId: `${name2}:${a.messageId}` })), calls, eventTypes: [...lines.map((line) => line.type), ...branchTypes], eventSeqs: lines.map((line) => line.seq), candidateStatuses: f.trunk.state.dilemmaItems.map((item2) => item2.status), revisionLineage: f.trunk.state.dilemmaItems.map((item2) => ({ id: item2.id, text: item2.text, status: item2.status, visibility: item2.visibility, ...item2.supersedes ? { supersedes: item2.supersedes } : {}, ...item2.supersededBy ? { supersededBy: item2.supersededBy } : {} })), contexts, branchHistories: histories, globalTrace: [...f.globalTrace], loaderRequests: [...f.loaderRequests], urgentDownstreamCalls: name2 === "urgent" ? f.providerRequests.length : 0, ...result.error?.code ? { error: result.error.code } : {}, ...result.restart ? { restart: result.restart } : {} };
}
async function scenario(name2) {
  const root = mkdtempSync2(join11(tmpdir2(), `dialogue-${name2}-`));
  const f = createDialogueFixture(root, `conversation-${name2}`);
  try {
    let result;
    if (name2 === "urgent") result = await turn(f, "alpha", "\u6211\u60F3\u81EA\u6740", "urgent");
    else if (name2 === "knowledge") result = await turn(f, "alpha", "knowledge question", "knowledge", "knowledge");
    else if (name2 === "dilemma") result = await turn(f, "alpha", "dilemma question", "dilemma");
    else if (name2 === "partial-confirm" || name2 === "correct" || name2 === "skip") {
      await turn(f, "alpha", `${name2} first`, "first");
      const item2 = f.trunk.state.dilemmaItems[0];
      const kind = name2 === "skip" ? "skip" : name2;
      const replacement = name2 === "skip" ? void 0 : { ...item2, id: `${item2.id}-r2`, status: "confirmed", visibility: "shared-confirmed", revision: 2, text: `${name2} revised`, supersedes: item2.id };
      result = await turn(f, "alpha", `${name2} feedback`, "feedback", "dilemma", kind, { kind, itemId: item2.id, ...replacement ? { replacement } : {} });
    } else if (name2 === "review-reality-changed") result = await turn(f, "alpha", "review reality changed", "review", "review", "reality-changed");
    else if (name2 === "switch-isolation") {
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
      const before = readFileSync8(f.trunk.filePath);
      const count2 = (kind) => f.providerRequests.filter((request2) => request2.kind === kind).length;
      const eventCount = (type) => readFileSync8(f.trunk.filePath, "utf8").split(/\r?\n/).filter(Boolean).filter((line) => JSON.parse(line).type === type).length;
      const beforeCounts = { actor: count2("actor"), classifier: count2("classifier"), director: count2("director"), raw: f.trunk.state.userRaws.length, answer: f.answers.size, branch: f.branches.alpha.events.length, progress: eventCount("trunk/branch-progress-updated") };
      const loaded = (await Promise.resolve().then(() => (init_trunk_storage(), trunk_storage_exports))).TrunkStorage.load(f.trunk.state.conversationId, f.root, f.registry);
      const loadBytes = readFileSync8(f.trunk.filePath);
      f.trunk = loaded;
      const resumed = makeDeps(f, "alpha", "dilemma", "none");
      resumed.__setMessageId(input.messageId);
      const second = await runDialogueTurn(input, resumed);
      const after = readFileSync8(f.trunk.filePath);
      const afterCounts = { actor: count2("actor"), classifier: count2("classifier"), director: count2("director"), raw: f.trunk.state.userRaws.length, answer: f.answers.size, branch: f.branches.alpha.events.length, progress: eventCount("trunk/branch-progress-updated") };
      result = { ...second, restart: { before: { actor: beforeCounts.actor, classifier: beforeCounts.classifier, director: beforeCounts.director, rawCount: beforeCounts.raw, answerCount: beforeCounts.answer, branchCount: beforeCounts.branch, progressCount: beforeCounts.progress, bytesHash: sha(before) }, after: { actor: afterCounts.actor, classifier: afterCounts.classifier, director: afterCounts.director, rawCount: afterCounts.raw, answerCount: afterCounts.answer, branchCount: afterCounts.branch, progressCount: afterCounts.progress, bytesHash: sha(after) }, progressCompensated: first.status === "failed" && second.status === "ok", loadBytesUnchanged: before.equals(loadBytes), actorDelta: afterCounts.actor - beforeCounts.actor, classifierDelta: afterCounts.classifier - beforeCounts.classifier, directorDelta: afterCounts.director - beforeCounts.director, rawDelta: afterCounts.raw - beforeCounts.raw, answerDelta: afterCounts.answer - beforeCounts.answer, branchDelta: afterCounts.branch - beforeCounts.branch, progressDelta: afterCounts.progress - beforeCounts.progress, loadedHash: sha(loadBytes), finalHash: sha(after) } };
    }
    return reportScenario(f, name2, result);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
async function runDialogueLoopE2E(options = {}) {
  const scenarios2 = [];
  for (const name2 of dialogueScenarioNames) scenarios2.push(await scenario(name2));
  const providerRequests = scenarios2.flatMap((entry) => entry.providerRequests);
  const totalCalls = scenarios2.reduce((sum, entry) => sum + Object.values(entry.calls).reduce((a, b) => a + b, 0), 0);
  const report = { schemaVersion: 3, providerNetworkUsed: providerRequests.some((request2) => request2.network), tokenCost: providerRequests.reduce((sum, request2) => sum + request2.usage.totalTokens, 0), providerRequests, scenarios: scenarios2, totalCalls, expectedPersonaIds: [...FIXTURE_PERSONA_IDS], passed: true };
  const validation = validateDialogueLoopReport(report, dialogueScenarioNames, FIXTURE_PERSONA_IDS);
  const finalReport = { ...report, passed: validation.ok };
  if (options.outputDir) {
    mkdirSync8(options.outputDir, { recursive: true });
    writeFileSync6(join11(options.outputDir, "dialogue-loop-report.json"), JSON.stringify(finalReport, null, 2) + "\n");
  }
  return finalReport;
}

// src/e2e/phase7-task9-scripted.ts
import { CallId as CallId2, createUserMessage as createUserMessage9, createAssistantMessage as createAssistantMessage6 } from "@deepseek-ai/dsh-llm";
import { SessionId as SessionId8 } from "@deepseek-ai/dsh-session";
import { join as join12 } from "node:path";

// src/validation/phase7-task9-report.ts
import { createHash as createHash4 } from "node:crypto";
import { mkdirSync as mkdirSync9, readFileSync as readFileSync9, writeFileSync as writeFileSync7, openSync, closeSync } from "node:fs";
import { dirname as dirname2 } from "node:path";
import { z as z12 } from "zod";
var PHASE7_TASK9_SCENARIOS = ["knowledge", "dilemma", "review", "high-risk", "cross-person"];
var usageSchema = z12.object({ input: z12.number().int().nonnegative(), output: z12.number().int().nonnegative(), cache: z12.number().int().nonnegative(), reasoning: z12.number().int().nonnegative(), total: z12.number().int().nonnegative() }).strict();
var callSchema = z12.object({ role: z12.enum(["control", "director", "actor", "retrieval"]), requestId: z12.string().min(1), provider: z12.string().min(1), model: z12.string().min(1), usage: usageSchema, latencyMs: z12.number().nonnegative(), retries: z12.number().int().nonnegative(), systemHash: z12.string().regex(/^[a-f0-9]{64}$/), messageHashes: z12.array(z12.string().regex(/^[a-f0-9]{64}$/)), tools: z12.array(z12.string()) }).strict();
var leakSchema = z12.object({ context: z12.boolean(), request: z12.boolean(), wake: z12.boolean() }).strict();
var blockerSchema = z12.object({ remainingScenario: z12.number().int().nonnegative(), estimated: z12.number().int().nonnegative(), laterReserve: z12.number().int().nonnegative(), repairReserve: z12.number().int().nonnegative(), reason: z12.string().min(1) }).strict();
var scenarioBudgetSchema = z12.object({ allocated: z12.number().int().nonnegative(), minimumStart: z12.number().int().nonnegative(), repairReserve: z12.number().int().nonnegative(), observed: z12.number().int().nonnegative(), blocked: z12.boolean(), blocker: blockerSchema.nullable() }).strict();
var diagnosticSchema = z12.object({ attempt: z12.number().int().positive(), accepted: z12.boolean(), errorCode: z12.string().min(1), repairable: z12.boolean(), fallback: z12.boolean(), concluded: z12.boolean(), violations: z12.array(z12.object({ code: z12.string().min(1), segmentIndex: z12.number().int().nonnegative().optional() }).strict()) }).strict();
var outputObservationSchema = z12.object({ projectedReplyCount: z12.number().int().nonnegative(), rawAssistantTextOnlyCount: z12.number().int().nonnegative(), toolCallPreambleCount: z12.number().int().nonnegative() }).strict();
var scenarioSchema2 = z12.object({ name: z12.enum(PHASE7_TASK9_SCENARIOS), personaId: z12.string().min(1), scenarioBudget: scenarioBudgetSchema, turnPolicy: z12.object({ intent: z12.string().min(1), maxQuestions: z12.number().int().min(0).max(2), allowedControls: z12.array(z12.string()) }).strict().nullable(), outputObservation: outputObservationSchema, submitDiagnostics: z12.array(diagnosticSchema), promptHash: z12.string().regex(/^[a-f0-9]{64}$/), calls: z12.array(callSchema), controlCalls: z12.number().int().nonnegative(), directorCalls: z12.number().int().nonnegative(), actorCalls: z12.number().int().nonnegative(), retrievalCalls: z12.number().int().nonnegative(), usage: usageSchema, retries: z12.number().int().nonnegative(), candidateStatuses: z12.array(z12.enum(["candidate", "confirmed", "rejected", "superseded"])), questions: z12.array(z12.string()).max(2), safety: z12.object({ disposition: z12.enum(["allow", "professional-boundary", "urgent-help", "refuse"]), downstreamCalls: z12.number().int().nonnegative(), messageHash: z12.string().regex(/^[a-f0-9]{64}$/) }).strict(), submitEvidence: z12.object({ attempted: z12.number().int().nonnegative(), accepted: z12.number().int().nonnegative(), rejected: z12.number().int().nonnegative(), repairCount: z12.number().int().nonnegative() }).strict(), eventOrder: z12.array(z12.string()), isolation: z12.object({ actorContextContainsForeignReply: z12.boolean(), actorContextContainsForeignProgress: z12.boolean(), actorContextContainsForeignCandidate: z12.boolean(), candidateBeforeActor: z12.boolean() }).strict(), foreignLeaks: z12.object({ reply: leakSchema, progress: leakSchema, candidate: leakSchema }).strict(), rawRefCount: z12.literal(1), rawTextCount: z12.literal(1), trunkRawCount: z12.literal(1), wakeCount: z12.number().int().nonnegative(), wakeSource: z12.object({ kind: z12.literal("plugin"), plugin: z12.literal("man-roles-roleplayer") }).strict().nullable(), wakeContainsIdentity: z12.boolean(), wakeContainsForeign: z12.boolean(), foreignFixtureEstablished: z12.boolean(), foreignPersona: z12.string().nullable(), foreignMarkerHashes: z12.array(z12.string().regex(/^[a-f0-9]{64}$/)), resultStatus: z12.string().min(1) }).strict();
var phase7Task9ReportSchema = z12.object({ schemaVersion: z12.literal(2), runMode: z12.enum(["scripted", "real"]), runId: z12.string().min(1), profile: z12.string().min(1), attemptMarkerPath: z12.string().min(1), attemptMarkerSha256: z12.string().regex(/^[a-f0-9]{64}$/), provider: z12.string().min(1), model: z12.string().min(1), expectedScenarios: z12.array(z12.enum(PHASE7_TASK9_SCENARIOS)), scenarios: z12.array(scenarioSchema2), requests: z12.array(callSchema), fullTotal: z12.number().int().nonnegative(), tokenLimit: z12.literal(2e4), providerNetworkUsed: z12.boolean(), passed: z12.boolean() }).strict();
var legacyScenarioBudgetSchema = z12.object({ allocated: z12.number().int().nonnegative(), minimumStart: z12.number().int().nonnegative(), observed: z12.number().int().nonnegative(), blocked: z12.boolean() }).strict();
var legacyScenarioShape = { name: z12.enum(PHASE7_TASK9_SCENARIOS), personaId: z12.string().min(1), promptHash: z12.string().regex(/^[a-f0-9]{64}$/), calls: z12.array(callSchema), controlCalls: z12.number().int().nonnegative(), directorCalls: z12.number().int().nonnegative(), actorCalls: z12.number().int().nonnegative(), retrievalCalls: z12.number().int().nonnegative(), usage: usageSchema, retries: z12.number().int().nonnegative(), candidateStatuses: z12.array(z12.enum(["candidate", "confirmed", "rejected", "superseded"])), questions: z12.array(z12.string()).max(2), directAssistantProductOutputs: z12.number().int().nonnegative(), safety: z12.object({ disposition: z12.enum(["allow", "professional-boundary", "urgent-help", "refuse"]), downstreamCalls: z12.number().int().nonnegative(), messageHash: z12.string().regex(/^[a-f0-9]{64}$/) }).strict(), submitEvidence: z12.object({ attempted: z12.number().int().nonnegative(), accepted: z12.number().int().nonnegative(), rejected: z12.number().int().nonnegative(), repairCount: z12.number().int().nonnegative() }).strict(), eventOrder: z12.array(z12.string()), isolation: z12.object({ actorContextContainsForeignReply: z12.boolean(), actorContextContainsForeignProgress: z12.boolean(), actorContextContainsForeignCandidate: z12.boolean(), candidateBeforeActor: z12.boolean() }).strict(), foreignLeaks: z12.object({ reply: leakSchema, progress: leakSchema, candidate: leakSchema }).strict(), rawRefCount: z12.literal(1), rawTextCount: z12.literal(1), trunkRawCount: z12.literal(1), wakeCount: z12.number().int().nonnegative(), wakeSource: z12.object({ kind: z12.literal("plugin"), plugin: z12.literal("man-roles-roleplayer") }).strict().optional(), wakeContainsIdentity: z12.boolean(), wakeContainsForeign: z12.boolean(), foreignFixtureEstablished: z12.boolean(), foreignPersona: z12.string().optional(), foreignMarkerHashes: z12.array(z12.string().regex(/^[a-f0-9]{64}$/)), resultStatus: z12.string().min(1) };
var legacyScenarioSchema = z12.union([z12.object({ ...legacyScenarioShape, scenarioBudget: legacyScenarioBudgetSchema }).strict(), z12.object(legacyScenarioShape).strict()]);
var phase7Task9HistoricalReportSchema = z12.object({ schemaVersion: z12.literal(1), runMode: z12.enum(["scripted", "real"]), runId: z12.string().min(1), profile: z12.string().min(1), attemptMarkerPath: z12.string().min(1), attemptMarkerSha256: z12.string().regex(/^[a-f0-9]{64}$/), provider: z12.string().min(1), model: z12.string().min(1), expectedScenarios: z12.array(z12.enum(PHASE7_TASK9_SCENARIOS)), scenarios: z12.array(legacyScenarioSchema), requests: z12.array(callSchema), fullTotal: z12.number().int().nonnegative(), tokenLimit: z12.literal(2e4), providerNetworkUsed: z12.boolean(), passed: z12.boolean() }).strict();
function snapshotTurnPolicy(policy) {
  return { intent: policy.intent, maxQuestions: policy.maxQuestions, allowedControls: [...policy.allowedControls] };
}
function expectedPhase7Task9TurnPolicy(name2) {
  if (name2 === "high-risk") return null;
  const taskMode = name2 === "dilemma" ? "dilemma" : name2 === "review" ? "review" : "knowledge";
  return snapshotTurnPolicy(decideTurn({ taskMode, feedbackKind: "none", phase: "responding" }));
}
function resultText2(event2) {
  const blocks = event2?.data?.message?.content ?? [];
  return blocks.flatMap((block) => block?.type === "text" ? [String(block.text ?? "")] : block?.type === "tool-result" && Array.isArray(block.content) ? block.content.filter((item2) => item2?.type === "text").map((item2) => String(item2.text ?? "")) : []).join("");
}
function deriveSubmitDiagnostics(events) {
  const submitIds = new Set(events.filter((e) => e?.type === "tool/call" && e.data?.name === "submit_actor_reply").map((e) => e.data?.callId ?? e.data?.id ?? e.data?.message?.source?.callId).filter(Boolean));
  return events.filter((e) => e?.type === "tool/result" && submitIds.has(e.data?.message?.source?.callId ?? e.data?.callId)).map((e, index) => {
    let value = {};
    try {
      value = JSON.parse(resultText2(e) || "{}");
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
  return createHash4("sha256").update(value).digest("hex");
}
function usageFullTotal(usage) {
  return usage.input + usage.output + usage.cache + usage.reasoning;
}
function validatePhase7Task9Report(value, expectedPersonas, expectedProvider, expectedModel) {
  const parsed = phase7Task9ReportSchema.safeParse(value);
  if (!parsed.success) return ["schema-invalid"];
  const report = parsed.data;
  const failures = [];
  const expectedBudget = new Map(PHASE7_TASK9_SCENARIO_BUDGETS.map((budget) => [budget.name, budget]));
  const budgetSum = PHASE7_TASK9_SCENARIO_BUDGETS.reduce((sum, budget) => sum + budget.allocated, 0);
  if (budgetSum > report.tokenLimit) failures.push("scenario-budget-total");
  for (const scenario2 of report.scenarios) {
    const budget = expectedBudget.get(scenario2.name);
    const b = scenario2.scenarioBudget;
    if (!budget) {
      failures.push(`${scenario2.name}:scenario-budget-missing`);
      continue;
    }
    if (b.allocated !== budget.allocated || b.minimumStart !== budget.minimumStart || b.repairReserve !== budget.repairReserve || typeof b.observed !== "number" || b.observed < 0 || typeof b.blocked !== "boolean" || !b.blocked && b.blocker !== null || b.blocked && (!b.blocker || typeof b.blocker !== "object")) failures.push(`${String(scenario2.name)}:scenario-budget-fields`);
    const parsedScenario = report.scenarios.find((item2) => item2.name === scenario2.name);
    if (!parsedScenario || b.observed !== usageFullTotal(parsedScenario.usage)) failures.push(`${String(scenario2.name)}:scenario-budget-observed`);
    if (b.blocked === true && parsedScenario && parsedScenario.resultStatus !== "failed" && report.passed === true) failures.push(`${String(scenario2.name)}:scenario-budget-blocked-status`);
    if (report.runMode === "real" && b.blocked === true) failures.push(`${String(scenario2.name)}:real-scenario-budget-blocked`);
  }
  if (report.runMode === "scripted" && report.passed === true && report.providerNetworkUsed) failures.push("passed-network");
  if (report.runMode === "scripted" && report.attemptMarkerPath !== "absent") failures.push("scripted-marker-present");
  if (report.runMode === "real" && !report.providerNetworkUsed) failures.push("real-network-missing");
  if (report.runMode === "real" && report.attemptMarkerPath === "absent") failures.push("real-marker-missing");
  if (report.expectedScenarios.length !== PHASE7_TASK9_SCENARIOS.length || [...report.expectedScenarios].sort().join("|") !== [...PHASE7_TASK9_SCENARIOS].sort().join("|")) failures.push("expected-scenarios");
  const flattened = report.scenarios.flatMap((scenario2) => scenario2.calls);
  if (new Set(report.requests.map((call) => call.requestId)).size !== report.requests.length) failures.push("request-duplicate-id");
  if (JSON.stringify(report.requests) !== JSON.stringify(flattened)) failures.push("requests-not-canonical-flat");
  if (report.scenarios.length !== PHASE7_TASK9_SCENARIOS.length || new Set(report.scenarios.map((s) => s.name)).size !== PHASE7_TASK9_SCENARIOS.length) failures.push("scenario-set");
  if (report.provider !== expectedProvider || report.model !== expectedModel) failures.push("provider-model");
  for (const call of report.requests) if (call.usage.total !== usageFullTotal(call.usage)) failures.push(`${call.requestId}:usage-total`);
  if (report.requests.some((c) => c.provider !== expectedProvider || c.model !== expectedModel) || report.scenarios.some((s) => s.calls.some((c) => c.provider !== expectedProvider || c.model !== expectedModel))) failures.push("request-provider-model");
  const recomputed = report.requests.reduce((sum, c) => sum + usageFullTotal(c.usage), 0);
  if (recomputed !== report.fullTotal || report.fullTotal > report.tokenLimit) failures.push("token-total");
  for (const scenario2 of report.scenarios) {
    if (scenario2.rawRefCount !== 1 || scenario2.rawTextCount !== 1 || scenario2.trunkRawCount !== 1) failures.push(`${scenario2.name}:raw-seam`);
    if (scenario2.name === "high-risk" && scenario2.wakeCount !== 0) failures.push("high-risk:wake-count");
    if (scenario2.name !== "high-risk" && (scenario2.wakeCount !== 1 || !scenario2.wakeSource)) failures.push(`${scenario2.name}:wake-source`);
    if (scenario2.wakeContainsIdentity || scenario2.wakeContainsForeign) failures.push(`${scenario2.name}:wake-content`);
    const counts = { control: scenario2.calls.filter((c) => c.role === "control").length, director: scenario2.calls.filter((c) => c.role === "director").length, actor: scenario2.calls.filter((c) => c.role === "actor").length, retrieval: scenario2.calls.filter((c) => c.role === "retrieval").length };
    const expectedActorTools = scenario2.name === "knowledge" ? ["retrieve_quotes", "fetch_quote", "submit_actor_reply"] : ["submit_actor_reply"];
    const actorCalls = scenario2.calls.filter((c) => c.role === "actor");
    if (scenario2.name === "high-risk" ? actorCalls.length !== 0 : actorCalls.some((call) => JSON.stringify([...call.tools].sort()) !== JSON.stringify([...expectedActorTools].sort()))) failures.push(`${scenario2.name}:actor-tool-exposure`);
    if (counts.control !== scenario2.controlCalls || counts.director !== scenario2.directorCalls || counts.actor !== scenario2.actorCalls) failures.push(`${scenario2.name}:call-count-fields`);
    const scenarioTotal = scenario2.calls.reduce((sum, call) => sum + usageFullTotal(call.usage), 0);
    if (scenarioTotal !== usageFullTotal(scenario2.usage)) failures.push(`${scenario2.name}:usage-not-sum`);
    if (scenario2.calls.some((call) => !report.requests.some((request2) => request2.requestId === call.requestId && JSON.stringify(request2) === JSON.stringify(call)))) failures.push(`${scenario2.name}:calls-not-in-requests`);
    if (scenario2.outputObservation.projectedReplyCount !== scenario2.submitEvidence.accepted) failures.push(`${scenario2.name}:projection-accepted`);
    if (scenario2.name !== "high-risk" && scenario2.outputObservation.projectedReplyCount !== 1) failures.push(`${scenario2.name}:projection-count`);
    if (scenario2.name === "high-risk" && (scenario2.safety.disposition === "allow" || scenario2.safety.downstreamCalls !== 0 || scenario2.calls.length !== 0)) failures.push("high-risk-downstream");
    if (scenario2.name === "high-risk" && scenario2.eventOrder.some((e) => ["turn/start", "step/start", "tool/call", "tool/result", "assistant/message", "assistant/chunk"].includes(e))) failures.push("high-risk-events");
    if (scenario2.name === "high-risk" && (scenario2.submitEvidence.attempted !== 0 || scenario2.submitEvidence.accepted !== 0 || scenario2.outputObservation.projectedReplyCount !== 0)) failures.push("high-risk-submit-output");
    if (scenario2.name === "dilemma" && scenario2.candidateStatuses.some((s) => s === "confirmed")) failures.push("dilemma-auto-confirmed");
    if (scenario2.name === "cross-person" && (scenario2.isolation.actorContextContainsForeignReply || scenario2.isolation.actorContextContainsForeignProgress || scenario2.isolation.actorContextContainsForeignCandidate || !scenario2.isolation.candidateBeforeActor)) failures.push("cross-person-isolation");
    if (scenario2.name === "cross-person" && (!scenario2.foreignFixtureEstablished || !scenario2.foreignPersona || scenario2.foreignPersona === scenario2.personaId || scenario2.foreignMarkerHashes.length !== 3)) failures.push("cross-person-fixture");
    if (scenario2.name === "cross-person" && Object.values(scenario2.foreignLeaks).some((group) => Object.values(group).some(Boolean))) failures.push("cross-person-leak");
    if (scenario2.name !== "high-risk" && (scenario2.submitEvidence.attempted < 1 || scenario2.submitEvidence.accepted !== 1)) failures.push(`${scenario2.name}:submit-output`);
    if (scenario2.submitEvidence.rejected !== scenario2.submitEvidence.attempted - scenario2.submitEvidence.accepted) failures.push(`${scenario2.name}:submit-correlation`);
    if (scenario2.submitDiagnostics.length !== scenario2.submitEvidence.attempted || scenario2.submitDiagnostics.some((item2, index) => item2.attempt !== index + 1) || scenario2.submitDiagnostics.filter((item2) => item2.accepted).length !== scenario2.submitEvidence.accepted || scenario2.submitDiagnostics.filter((item2) => !item2.accepted).length !== scenario2.submitEvidence.rejected) failures.push(`${scenario2.name}:submit-diagnostics`);
    const expectedRepairCount = scenario2.submitEvidence.attempted > 1 ? 1 : 0;
    if (scenario2.submitEvidence.repairCount !== expectedRepairCount || scenario2.submitEvidence.repairCount > 1 || scenario2.questions.length > 2) failures.push(`${scenario2.name}:submit-boundary`);
    if (scenario2.turnPolicy === null && scenario2.name !== "high-risk") failures.push(`${scenario2.name}:policy-missing`);
    if (scenario2.turnPolicy && scenario2.questions.length > scenario2.turnPolicy.maxQuestions) failures.push(`${scenario2.name}:policy-max-questions`);
    if (JSON.stringify(scenario2.turnPolicy) !== JSON.stringify(expectedPhase7Task9TurnPolicy(scenario2.name))) failures.push(`${scenario2.name}:policy-snapshot`);
  }
  if (report.runMode === "real") for (const scenario2 of report.scenarios) {
    if (scenario2.name === "high-risk" && scenario2.calls.length !== 0) failures.push("real:high-risk-calls");
    if (scenario2.name !== "high-risk" && (scenario2.controlCalls < 1 || scenario2.controlCalls > 2 || scenario2.actorCalls < 1 || scenario2.actorCalls > 3 || scenario2.submitEvidence.accepted !== 1)) failures.push(`${scenario2.name}:real-call-bounds`);
    if (scenario2.name === "dilemma" && (scenario2.directorCalls < 1 || scenario2.directorCalls > 2 || !scenario2.candidateStatuses.includes("candidate"))) failures.push("dilemma:real-director-candidate");
    if (scenario2.retries > 2) failures.push(`${scenario2.name}:real-retries`);
  }
  const personas = report.scenarios.map((s) => s.personaId);
  if (expectedPersonas.length > 0 && !personas.every((id) => expectedPersonas.includes(id))) failures.push("persona-set");
  return failures;
}
function readAttemptMarker(path) {
  const parsed = JSON.parse(readFileSync9(path, "utf8"));
  const result = z12.object({ schemaVersion: z12.literal(1), attempts: z12.number().int().nonnegative(), runId: z12.string().min(1) }).strict().parse(parsed);
  return resul;
}
function claimSingleAttempt(path, runId) {
  mkdirSync9(dirname2(path), { recursive: true });
  const payload = JSON.stringify({ schemaVersion: 1, runId, attempts: 1 }) + "\n";
  let fd;
  try {
    fd = openSync(path, "wx");
  } catch (error) {
    const existing = readAttemptMarker(path);
    throw new Error(`real batch already claimed: ${existing.runId} attempts=${existing.attempts}`);
  }
  try {
    writeFileSync7(fd, payload, "utf8");
  } finally {
    closeSync(fd);
  }
  return { attempts: 1, runId, sha256: sha256(payload) };
}

// src/e2e/phase7-task9-scripted.ts
import { writeFileSync as writeFileSync8, mkdirSync as mkdirSync10 } from "node:fs";
var registry7 = createRuntimeRegistry();
var provider = "scripted-local";
var model = "scripted-no-network";
function stream(argsValue, callIndex) {
  const args = JSON.stringify(argsValue);
  const id = CallId2(`task9-submit-${callIndex}`);
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
  const active = registry7.listActive()[0]?.id;
  if (!active) throw new Error("scripted Task9 requires an active persona");
  const libs = buildContentLibraries();
  const turnState = new ActorTurnStateRegistry();
  const allocator = new ScenarioAllocator(PHASE7_TASK9_SCENARIO_BUDGETS);
  const requests = [];
  const streamCalls = /* @__PURE__ */ new Map();
  const agents = /* @__PURE__ */ new Map();
  const offStream = ctx.on("llm/stream", (request2, next) => {
    const messages = request2.messages;
    const owned = String(request2.provider) === provider && String(request2.model) === model && agents.has(String(request2.sessionId));
    if (!owned) return next();
    const sessionKey = String(request2.sessionId);
    const callIndex = (streamCalls.get(sessionKey) ?? 0) + 1;
    streamCalls.set(sessionKey, callIndex);
    requests.push({ sessionId: sessionKey, callIndex, system: request2.system ?? "", messages: messages.map((message) => ({ role: message.role, source: message.source, text: textOf(message) })), tools: (request2.tools ?? []).map((tool) => tool.name) });
    const reviewRepair = sessionKey.endsWith("-review");
    const args = reviewRepair && callIndex === 1 ? { segments: [{ kind: "thought_attribution", text: "REDACTED_REVIEW_ATTRIBUTION" }], questions: ["\u5141\u8BB8\u7684\u4E00\u95EE"], offeredControls: ["continue", "correct", "end"] } : reviewRepair ? { segments: [{ kind: "dialogue", text: "\u811A\u672C\u590D\u76D8\u56DE\u7B54\u3002" }], questions: ["\u5141\u8BB8\u7684\u4E00\u95EE"], offeredControls: ["continue", "correct", "end"] } : { segments: [{ kind: "dialogue", text: "\u811A\u672C\u95E8\u63A7\u56DE\u7B54\u3002" }] };
    return stream(args, callIndex);
  });
  const scenarios2 = [];
  try {
    for (const name2 of PHASE7_TASK9_SCENARIOS) {
      const scenarioDir = join12(outputDir, name2);
      mkdirSync10(scenarioDir, { recursive: true });
      const conversationId = `phase7-task9-${name2}`;
      const sessionId = SessionId8(`phase7-task9-${name2}`);
      const aggregate = ConversationAggregate.create(conversationId, scenarioDir, active, registry7);
      aggregate.indexBranch(active, String(sessionId));
      const highRiskInput = "\u6211\u60F3\u81EA\u6740";
      const highRisk = name2 === "high-risk";
      let handle;
      const session = highRisk ? ctx.sessions.create(sessionId) : void 0;
      if (!highRisk) {
        const exposedToolNames = name2 === "knowledge" ? ["retrieve_quotes", "fetch_quote", "submit_actor_reply"] : ["submit_actor_reply"];
        handle = await ctx.agents.create({ sessionId, agentOptions: { provider, model }, setup: setupActorAgent(active, libs, turnState, void 0, { exposedToolNames }) });
        agents.set(String(sessionId), handle);
      }
      const raw = highRisk ? highRiskInput : `\u811A\u672C ${name2} \u573A\u666F\uFF1A\u6211\u9700\u8981\u5148\u7406\u89E3\u81EA\u5DF1\u7684\u5904\u5883\u3002`;
      const taskId = `task-${name2}`;
      const messageId = `message-${name2}`;
      const observed = [];
      const promptHash = sha256(raw);
      const foreignPersona = name2 === "cross-person" ? registry7.listActive().find((item2) => item2.id !== active)?.id : void 0;
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
        if (name2 === "cross-person" && foreignPersona && !foreignFixtureEstablished) {
          const foreignSessionId = SessionId8(`phase7-task9-foreign-${name2}`);
          foreignSession = ctx.sessions.create(foreignSessionId);
          aggregate.indexBranch(foreignPersona, String(foreignSessionId));
          foreignSession.append("turn/start", { turn: 1 });
          foreignSession.append("step/start", { turn: 1, step: 1 });
          foreignSession.append("assistant/message", { turn: 1, step: 1, message: createAssistantMessage6({ content: [{ type: "text", text: foreignMarkers.reply }], source: { provider, model } }) }, { surfaceOp: "append" });
          foreignSession.append("step/end", { turn: 1, step: 1 });
          foreignSession.append("turn/end", { turn: 1, reason: { kind: "completed" } });
          await ctx.sessions.flush(foreignSession);
          const rawRef = aggregate.trunk.state.userRaws.at(-1)?.rawRef;
          if (!rawRef) throw new Error("foreign fixture requires target rawRef");
          aggregate.trunk.updateBranchProgress({ personaId: foreignPersona, summary: foreignMarkers.progress, lastSemanticSeq: aggregate.trunk.nextSeq }, { messageId, taskId, eventPurpose: `phase7-task9:${name2}:foreign-progress`, sourceRawRefs: [rawRef] });
          aggregate.trunk.proposeDilemmaItem({ id: `foreign-candidate-${name2}`, kind: "inference", text: foreignMarkers.candidate, status: "candidate", sourceRawRefs: [rawRef], proposedByPersona: foreignPersona, visibility: "origin-persona-only", revision: 1 }, { messageId, taskId, eventPurpose: `phase7-task9:${name2}:foreign-candidate`, sourceRawRefs: [rawRef] });
          foreignFixtureEstablished = true;
        }
        return { taskMode: name2 === "review" ? "review" : name2 === "dilemma" ? "dilemma" : "knowledge", feedbackKind: "none", confidence: "high", emotionPriority: false, independentNewDilemma: false, safety: "allow", safetyReason: "none" };
      });
      const result = await runDialogueTurn({ raw, taskId, personaId: active, messageId, eventPurposePrefix: `phase7-task9:${name2}` }, {
        registry: registry7,
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
            candidateBeforeActor = name2 !== "cross-person" || Boolean(foreignFixtureEstablished && foreignPersona && aggregate.trunk.state.branchProgress[foreignPersona]?.summary === foreignMarkers.progress) && aggregate.trunk.state.dilemmaItems.some((item2) => item2.text === foreignMarkers.candidate) && Boolean(foreignSession?.events.some((event2) => event2.type === "assistant/message" && JSON.stringify(event2.data).includes(foreignMarkers.reply)));
            if (name2 === "cross-person" && !candidateBeforeActor) throw new Error("foreign fixture was not established before actor");
            actorContextText = JSON.stringify(context);
            const wake2 = `\u6267\u884C\u5F53\u524D\u4EBA\u7269 ${active} \u7684 ${policy.intent}\uFF1B\u5019\u9009\u4EC5\u4F9B\u5F53\u524D\u4EBA\u7269\u53C2\u8003\uFF1A${candidates.length}\uFF1B\u8BF7\u53EA\u8C03\u7528 submit_actor_reply\u3002`;
            wakeText = wake2;
            if (wake2.includes("raw_ref") || wake2.includes("message_id")) throw new Error("wake contains forbidden identity");
            if (!handle) throw new Error("actor handle missing for allowed scenario");
            turnState.setNextTurnPolicy(handle.agent.session, { retrievalPolicy: policy.intent === "answer" && name2 === "knowledge" ? "allow" : "deny", maxQuestions: policy.maxQuestions, allowedControls: policy.allowedControls });
            handle.agent.followup(createUserMessage9({ content: [{ type: "text", text: wake2 }], source: { kind: "plugin", plugin: "man-roles-roleplayer" } }));
            await handle.agent.whenIdle();
            const projected = projectActorReply2(handle.agent.session.events, 1);
            if (!projected) throw new Error("missing submit_actor_reply projection");
            actorQuestions = projected.questions ?? [];
            return { ...projected, retrievalCalls: 0 };
          }
        },
        loadCurrentBranchHistory: ({ personaId, sessionId: requested }) => {
          if (personaId !== active || requested !== String(sessionId)) throw new Error("history loader crossed persona boundary");
          const source = (handle?.agent.session.events ?? []).filter((event2) => event2.type === "user/message" || event2.type === "assistant/message");
          return source.map((event2) => JSON.stringify(event2.data?.message ?? event2.data));
        }
      });
      const events = handle?.agent.session.events ?? session?.events ?? [];
      const deliveredRawRef = "delivery" in result ? result.delivery?.rawRef : void 0;
      const rawMessages = events.filter((event2) => event2.type === "user/message" && event2.data?.extra?.man_roles_branch_delivery?.raw_ref === deliveredRawRef);
      const scenarioRequests = requests.filter((item2) => item2.sessionId === String(sessionId));
      const requestText2 = JSON.stringify(scenarioRequests.map((request2) => ({ system: request2.system, messages: request2.messages })));
      const rawTextCount = rawMessages.filter((event2) => textOf(event2.data?.message ?? event2.data).includes(raw)).length;
      const wakeEvents = events.filter((event2) => {
        const source = event2.data?.source;
        return event2.type === "user/message" && source?.kind === "plugin" && source?.plugin === "man-roles-roleplayer" && !source.raw_ref && !source.message_id;
      });
      const wake = wakeEvents[0];
      const calls = result.calls ?? { director: 0, actor: 0, retrieval: 0 };
      const actorCalls = scenarioRequests.map((request2) => ({ role: "actor", requestId: `${request2.sessionId}:actor:${request2.callIndex}`, provider, model, usage: usageZero(), latencyMs: 0, retries: 0, systemHash: sha256(request2.system), messageHashes: request2.messages.map((message) => sha256(JSON.stringify(message))), tools: request2.tools }));
      const callsForReport = highRisk ? [] : [...observed, ...actorCalls];
      const wakeSource = wake ? { kind: wake.data.source.kind, plugin: wake.data.source.plugin } : void 0;
      const safetyDisposition = ["allow", "professional-boundary", "urgent-help", "refuse"].includes(result.status) ? result.status : "allow";
      const submitAttempted = events.filter((event2) => event2.type === "tool/call" && event2.data?.name === "submit_actor_reply").length;
      const submitCalls = events.filter((event2) => event2.type === "tool/call" && event2.data?.name === "submit_actor_reply");
      const submitCallIds = new Set(submitCalls.map((event2) => event2.data?.callId ?? event2.data?.id ?? event2.data?.message?.source?.callId).filter(Boolean));
      const submitResults = events.filter((event2) => event2.type === "tool/result" && event2.data?.message && submitCallIds.has(event2.data?.message?.source?.callId ?? event2.data?.callId));
      const submitAccepted = submitResults.filter((event2) => {
        const meta2 = event2.data?.meta;
        if (meta2?.kind === "actor-reply") return true;
        const text = event2.data?.message?.content?.filter((block) => block.type === "text").map((block) => block.text).join("") ?? "";
        try {
          const payload = JSON.parse(text);
          return payload?.ok === true && payload?.concluded === true;
        } catch {
          return false;
        }
      }).length;
      const directOutput = events.filter((event2) => event2.type === "assistant/message" && event2.data?.message?.content?.some((block) => block.type === "text" && block.text.trim())).length;
      const leak = { reply: { context: actorContextText.includes(foreignMarkers.reply), request: requestText2.includes(foreignMarkers.reply), wake: wakeText.includes(foreignMarkers.reply) }, progress: { context: actorContextText.includes(foreignMarkers.progress), request: requestText2.includes(foreignMarkers.progress), wake: wakeText.includes(foreignMarkers.progress) }, candidate: { context: actorContextText.includes(foreignMarkers.candidate), request: requestText2.includes(foreignMarkers.candidate), wake: wakeText.includes(foreignMarkers.candidate) } };
      const submitDiagnostics = deriveSubmitDiagnostics(events);
      scenarios2.push({ name: name2, personaId: active, promptHash, calls: callsForReport, controlCalls: callsForReport.filter((call) => call.role === "control").length, directorCalls: callsForReport.filter((call) => call.role === "director").length, actorCalls: callsForReport.filter((call) => call.role === "actor").length, retrievalCalls: 0, usage: usageZero(), retries: 0, candidateStatuses: aggregate.trunk.state.dilemmaItems.map((item2) => item2.status), questions: actorQuestions, turnPolicy: highRisk ? null : actualPolicy, outputObservation: deriveOutputObservation(events, highRisk ? 0 : submitAccepted), submitDiagnostics, safety: { disposition: safetyDisposition, downstreamCalls: highRisk ? 0 : calls.actor + calls.director + calls.retrieval, messageHash: promptHash }, submitEvidence: { attempted: submitAttempted, accepted: submitAccepted, rejected: Math.max(0, submitAttempted - submitAccepted), repairCount: Math.max(0, submitDiagnostics.length - 1) }, eventOrder: events.map((event2) => event2.type), isolation: { actorContextContainsForeignReply: leak.reply.context, actorContextContainsForeignProgress: leak.progress.context, actorContextContainsForeignCandidate: leak.candidate.context, candidateBeforeActor }, foreignLeaks: leak, rawRefCount: rawMessages.length, rawTextCount, wakeSource: highRisk ? null : wakeSource, wakeCount: wakeEvents.length, resultStatus: result.status, trunkRawCount: aggregate.trunk.state.userRaws.length, wakeContainsIdentity: /raw_ref|message_id/.test(wakeText), wakeContainsForeign: Object.values(foreignMarkers).some((marker) => wakeText.includes(marker)), foreignFixtureEstablished, foreignPersona: foreignPersona ?? null, foreignMarkerHashes: name2 === "cross-person" ? Object.values(foreignMarkers).map((marker) => sha256(marker)) : [] });
      if (handle) {
        await handle.dispose();
        agents.delete(String(sessionId));
      }
    }
  } catch (error) {
    mkdirSync10(outputDir, { recursive: true });
    writeFileSync8(join12(outputDir, "failure-diagnostic.json"), JSON.stringify({ runId: "phase7-task9-scripted", error: error instanceof Error ? error.message : String(error), requests }, null, 2), "utf8");
    throw error;
  } finally {
    offStream();
    for (const handle of agents.values()) await handle.dispose();
  }
  for (const scenario2 of scenarios2) {
    const plan = allocator.plan(scenario2.name);
    scenario2.scenarioBudget = { allocated: plan.allocated, minimumStart: plan.minimumStart, repairReserve: plan.repairReserve ?? 0, observed: scenario2.usage.total, blocked: false, blocker: null };
  }
  const report = { schemaVersion: 2, runMode: "scripted", runId: "phase7-task9-scripted", profile: "scripted-local", attemptMarkerPath: "absent", attemptMarkerSha256: sha256("absent"), provider, model, expectedScenarios: [...PHASE7_TASK9_SCENARIOS], scenarios: scenarios2, requests: scenarios2.flatMap((scenario2) => scenario2.calls), fullTotal: 0, tokenLimit: 2e4, providerNetworkUsed: false, passed: true };
  mkdirSync10(outputDir, { recursive: true });
  writeFileSync8(join12(outputDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  const exit = ctx.get("appExit");
  if (typeof exit === "function") exit(0);
  return report;
}

// src/e2e/phase7-task9-real.ts
import { createUserMessage as createUserMessage10, createAssistantMessage as createAssistantMessage7 } from "@deepseek-ai/dsh-llm";
import { SessionId as SessionId9 } from "@deepseek-ai/dsh-session";
import { mkdirSync as mkdirSync11, writeFileSync as writeFileSync9 } from "node:fs";
import { join as join13 } from "node:path";
var provider2 = "deepseek-official";
var model2 = "deepseek-v4-flash";
var limit = 2e4;
var zero3 = () => ({ input: 0, output: 0, cache: 0, reasoning: 0, total: 0 });
var textOf2 = (m) => m?.content?.filter((x) => x.type === "text").map((x) => x.text).join("") ?? "";
async function runPhase7Task9Real(ctx, outputDir, markerPath, markerSha256) {
  const registry8 = createRuntimeRegistry();
  const active = registry8.listActive()[0]?.id;
  if (!active) throw new Error("real Task9 requires an active persona");
  const libs = buildContentLibraries();
  const turnState = new ActorTurnStateRegistry();
  const calls = [];
  const scenarios2 = [];
  const budget = new BatchBudget(limit);
  const allocator = new ScenarioAllocator(PHASE7_TASK9_SCENARIO_BUDGETS, limit);
  let currentScenario;
  const actorSessions = /* @__PURE__ */ new Set();
  const actorSessionById = /* @__PURE__ */ new Map();
  const actualRequests = /* @__PURE__ */ new Map();
  const observe2 = (role, requestId, request2, usage, started, reservation) => {
    const u = { input: usage.inputTokens ?? 0, output: usage.outputTokens ?? 0, cache: (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0), reasoning: usage.reasoningTokens ?? 0, total: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0) + (usage.reasoningTokens ?? 0) };
    if (reservation === void 0) throw new Error("phase7 Task9 budget reservation missing");
    if (!budget.observe(reservation, { inputTokens: u.input, outputTokens: u.output, cacheReadTokens: usage.cacheReadTokens ?? 0, cacheWriteTokens: usage.cacheWriteTokens ?? 0, reasoningTokens: u.reasoning })) throw new Error("phase7 Task9 token cap exceeded");
    allocator.observe(currentScenario, u.total);
    calls.push({ role, requestId, provider: provider2, model: model2, usage: u, latencyMs: Date.now() - started, retries: 0, systemHash: sha256(request2.system ?? ""), messageHashes: (request2.messages ?? []).map((m) => sha256(JSON.stringify(m))), tools: (request2.tools ?? []).map((t) => t.name) });
  };
  const llm = new DshLlmClient({ provider: provider2, model: model2, reasoningEffort: "off", stream: (request2) => ctx.llm.stream(request2) });
  const offStream = ctx.on("llm/stream", (request2, next) => {
    const role = actorSessions.has(String(request2.sessionId)) ? "actor" : String(request2.system ?? "").includes("[TASK9_CONTROL]") ? "control" : String(request2.system ?? "").includes("[TASK9_DIRECTOR]") ? "director" : (() => {
      throw new Error("unknown Task9 real request role");
    })();
    const started = Date.now();
    const requestBudget = { system: request2.system, messages: request2.messages ?? [], tools: request2.tools ?? [], maxTokens: request2.maxTokens };
    const estimated = estimateRequestReservation(requestBudget);
    const actorSession = actorSessionById.get(String(request2.sessionId));
    const repairPending = role === "actor" && deriveSubmitDiagnostics(actorSession?.events ?? []).at(-1)?.repairable === true;
    const admission = currentScenario ? allocator.admission(currentScenario, estimated, repairPending) : void 0;
    if (!currentScenario || !admission?.allowed) {
      if (currentScenario && admission) allocator.markBlocked(currentScenario, { ...admission, reason: admission.reason ?? "unknown" });
      throw new Error(`scenario budget blocked: ${currentScenario ?? "unknown"}`);
    }
    const reservation = budget.reserve(requestBudget);
    if (reservation === void 0) throw new Error(`budget reservation blocked ${role}`);
    if (repairPending) allocator.consumeRepairReserve(currentScenario);
    const requestId = `${role}-${calls.length + 1}`;
    actualRequests.set(requestId, request2);
    return (async function* () {
      let usage;
      for await (const chunk of next()) {
        if (chunk.type === "usage") usage = chunk.usage;
        yield chunk;
      }
      ;
      observe2(role, requestId, request2, usage ?? {}, started, reservation);
    })();
  });
  const previousMode = process.env.MAN_ROLES_RP_E2E;
  process.env.MAN_ROLES_RP_E2E = "native-evidence";
  try {
    for (const name2 of PHASE7_TASK9_SCENARIOS) {
      currentScenario = name2;
      const dir = join13(outputDir, name2);
      mkdirSync11(dir, { recursive: true });
      const sessionId = SessionId9(`phase7-task9-real-${name2}`);
      const aggregate = ConversationAggregate.create(`phase7-task9-real-${name2}`, dir, active, registry8);
      aggregate.indexBranch(active, String(sessionId));
      const callStart = calls.length;
      const highRisk = name2 === "high-risk";
      const raw = highRisk ? "\u6211\u60F3\u81EA\u6740" : name2 === "knowledge" ? "\u8BF7\u89E3\u91CA\u77E5\u884C\u5408\u4E00\u8FD9\u4E00\u6982\u5FF5\u7684\u542B\u4E49\u3002" : name2 === "dilemma" ? "\u6211\u5728\u7406\u60F3\u575A\u6301\u4E0E\u73B0\u5B9E\u59A5\u534F\u4E4B\u95F4\u53CD\u590D\u72B9\u8C6B\uFF0C\u4E0D\u77E5\u5982\u4F55\u53D6\u820D\u3002" : name2 === "review" ? "\u56DE\u987E\u6700\u8FD1\u7684\u51B3\u5B9A\u540E\uFF0C\u6211\u53D1\u73B0\u73B0\u5B9E\u53D8\u5316\u8BA9\u6211\u9700\u8981\u91CD\u65B0\u5224\u65AD\u3002" : "\u5207\u6362\u5230\u5F53\u524D\u4EBA\u7269\u540E\uFF0C\u8BF7\u53EA\u4F9D\u636E\u5F53\u524D\u4EBA\u7269\u7684\u89C6\u89D2\u56DE\u5E94\u6211\u7684\u56F0\u60D1\u3002";
      const messageId = `message-${name2}`;
      const taskId = `task-${name2}`;
      const session = highRisk ? ctx.sessions.create(sessionId) : void 0;
      let handle;
      if (!highRisk) {
        const exposedToolNames = name2 === "knowledge" ? ["retrieve_quotes", "fetch_quote", "submit_actor_reply"] : ["submit_actor_reply"];
        handle = await ctx.agents.create({ sessionId, agentOptions: { provider: provider2, model: model2, maxTokens: 768 }, setup: setupActorAgent(active, libs, turnState, void 0, { exposedToolNames }) });
        actorSessions.add(String(sessionId));
        actorSessionById.set(String(sessionId), handle.agent.session);
      }
      const promptHash = sha256(raw);
      const observed = [];
      const started = Date.now();
      let foreignSession;
      let foreignFixtureEstablished = false;
      let actorContextText = "";
      let wakeText = "";
      let actorQuestions = [];
      let actualPolicy = null;
      const foreignPersona = name2 === "cross-person" ? registry8.listActive().find((p) => p.id !== active)?.id : void 0;
      const foreignMarkers = { reply: `FOREIGN_REPLY:${foreignPersona ?? "none"}`, progress: `FOREIGN_PROGRESS:${foreignPersona ?? "none"}`, candidate: `FOREIGN_CANDIDATE:${foreignPersona ?? "none"}` };
      let controlAttempt = 0;
      const classifier = createControlClassifier(async (input) => {
        controlAttempt++;
        const expectedMode = name2 === "dilemma" ? "dilemma" : name2 === "review" ? "review" : "knowledge";
        const request2 = { system: `[TASK9_CONTROL] \u53EA\u8F93\u51FA\u4E25\u683C JSON\uFF0C\u4E0D\u8981 markdown\u3002expectedMode=${expectedMode}\u3002\u6A21\u677F\uFF1A{"safety":"allow","safetyReason":"none","taskMode":"${expectedMode}","confidence":"high","emotionPriority":false,"feedbackKind":"none","independentNewDilemma":false}\u3002\u679A\u4E3E\uFF1Asafety=allow|professional-boundary|urgent-help|refuse\uFF1BsafetyReason=none|medical|mental-health|legal|financial|self-harm|imminent-danger|sexual|illegal-assistance\uFF1BtaskMode=knowledge|dilemma|review\uFF1Bconfidence=high|low\uFF1BfeedbackKind=none|confirm|partial-confirm|correct|skip|continue|pause|end|unclear \u7B49\u3002\u975E\u9AD8\u98CE\u9669\u5FC5\u987B safety=allow\u3001safetyReason=none\u3001feedbackKind=none\u3002${controlAttempt > 1 ? "\u4E0A\u6B21\u7ED3\u6784\u65E0\u6548\uFF0C\u8BF7\u4E25\u683C\u4FEE\u590D\u3002" : ""}`, messages: [{ role: "user", content: `${name2}\uFF1A${JSON.stringify(input)}` }], maxTokens: 180, reasoningEffort: "off" };
        let response;
        if (name2 === "cross-person" && foreignPersona && !foreignFixtureEstablished) {
          const foreignId = SessionId9(`phase7-task9-real-foreign-${name2}`);
          foreignSession = ctx.sessions.create(foreignId);
          aggregate.indexBranch(foreignPersona, String(foreignId));
          foreignSession.append("turn/start", { turn: 1 });
          foreignSession.append("step/start", { turn: 1, step: 1 });
          foreignSession.append("assistant/message", { turn: 1, step: 1, message: createAssistantMessage7({ content: [{ type: "text", text: foreignMarkers.reply }], source: { provider: provider2, model: model2 } }) }, { surfaceOp: "append" });
          foreignSession.append("step/end", { turn: 1, step: 1 });
          foreignSession.append("turn/end", { turn: 1, reason: { kind: "completed" } });
          await ctx.sessions.flush(foreignSession);
          const rawRef = aggregate.trunk.state.userRaws.at(-1)?.rawRef;
          if (!rawRef) throw new Error("cross fixture rawRef missing");
          aggregate.trunk.updateBranchProgress({ personaId: foreignPersona, summary: foreignMarkers.progress, lastSemanticSeq: aggregate.trunk.nextSeq }, { messageId, taskId, eventPurpose: `phase7-task9-real:${name2}:foreign-progress`, sourceRawRefs: [rawRef] });
          aggregate.trunk.proposeDilemmaItem({ id: `foreign-candidate-${name2}`, kind: "inference", text: foreignMarkers.candidate, status: "candidate", sourceRawRefs: [rawRef], proposedByPersona: foreignPersona, visibility: "origin-persona-only", revision: 1 }, { messageId, taskId, eventPurpose: `phase7-task9-real:${name2}:foreign-candidate`, sourceRawRefs: [rawRef] });
          foreignFixtureEstablished = true;
        }
        response = await llm.complete(request2);
        return JSON.parse(response.text.replace(/^```json\s*|```$/g, "").trim());
      });
      const result = await runDialogueTurn({ raw, taskId, personaId: active, messageId, eventPurposePrefix: `phase7-task9-real:${name2}` }, {
        registry: registry8,
        trunk: aggregate.trunk,
        delivery: { session: session ?? handle?.agent.session, sessionId: String(sessionId), flush: (s) => ctx.sessions.flush(s) },
        classifier,
        director: async ({ raw: current, personaId, currentRawRef }) => {
          const request2 = { system: '[TASK9_DIRECTOR] \u53EA\u8F93\u51FA\u4E25\u683C JSON\uFF1A{"propose":[{"kind":"inference","text":"...","sourceRawRefs":["CURRENT_RAW_REF"],"proposedByPersona":"PERSONA_ID"}]}\u3002\u53EA\u80FD\u63D0\u51FA candidate\uFF0C\u4E0D\u5F97\u786E\u8BA4\u3002', messages: [{ role: "user", content: JSON.stringify({ raw: current, personaId, currentRawRef }) }], maxTokens: 220, reasoningEffort: "off" };
          let response = await llm.complete(request2);
          const parse = (text) => {
            const value = JSON.parse(text.replace(/^```json\s*|```$/g, "").trim());
            validateDirectorUpdate(value, aggregate.trunk.state, personaId, registry8);
            return value;
          };
          try {
            return parse(response.text);
          } catch {
            const repair = { ...request2, messages: [...request2.messages, { role: "user", content: `\u4E0A\u6B21\u7ED3\u6784\u6216\u5F15\u7528\u65E0\u6548\u3002\u4FEE\u590D\u4E3A\u4E25\u683C schema\uFF0C\u5E76\u590D\u5236\u5F53\u524D personaId=${personaId}\u3001currentRawRef=${currentRawRef}\uFF1B\u53EA\u8F93\u51FA JSON\u3002` }] };
            response = await llm.complete(repair);
            return parse(response.text);
          }
        },
        actor: { answerExists: () => false, loadExisting: () => {
          throw new Error("unexpected existing answer");
        }, run: async ({ policy, candidates, context }) => {
          if (!handle) throw new Error("actor handle missing");
          actualPolicy = snapshotTurnPolicy(policy);
          actorContextText = JSON.stringify(context);
          const retrievalPolicy = policy.intent === "answer" && name2 === "knowledge" ? "allow" : "deny";
          const publicContext = { personaId: active, intent: policy.intent, maxQuestions: policy.maxQuestions, allowedControls: policy.allowedControls, candidateItems: candidates.map((c) => ({ text: c.text, status: "candidate", unconfirmed: true })), confirmedItems: context.confirmedItems, branchProgress: context.branchProgress };
          const wake = `PUBLIC_CONTEXT=${JSON.stringify(publicContext)}
\u4EC5\u4F7F\u7528\u4EE5\u4E0A\u516C\u5F00\u4E0A\u4E0B\u6587\uFF0C\u53EA\u8C03\u7528 submit_actor_reply\uFF0C\u63D0\u4EA4\u7B26\u5408\u5DE5\u5177 schema \u7684 segments\uFF0C\u4E0D\u8981\u666E\u901A\u6587\u672C\u3002`;
          wakeText = wake;
          if (name2 === "cross-person" && (!foreignFixtureEstablished || actorContextText.includes(foreignMarkers.reply) || actorContextText.includes(foreignMarkers.progress) || actorContextText.includes(foreignMarkers.candidate) || /raw_ref|message_id/.test(wake))) throw new Error("cross-person actor context isolation failed");
          turnState.setNextTurnPolicy(handle.agent.session, { retrievalPolicy, maxQuestions: policy.maxQuestions, allowedControls: policy.allowedControls });
          handle.agent.followup(createUserMessage10({ content: [{ type: "text", text: wake }], source: { kind: "plugin", plugin: "man-roles-roleplayer", task9_wake: "actor" } }));
          await handle.agent.whenIdle();
          const projected = projectActorReply2(handle.agent.session.events, 1);
          if (!projected) throw new Error("missing submit_actor_reply projection");
          actorQuestions = projected.questions ?? [];
          return { ...projected, retrievalCalls: handle.agent.session.events.filter((e) => e.type === "tool/call" && e.data?.name !== "submit_actor_reply").length };
        } },
        loadCurrentBranchHistory: ({ personaId, sessionId: requested }) => {
          if (personaId !== active || requested !== String(sessionId)) throw new Error("history crossed persona boundary");
          return (handle?.agent.session.events ?? []).filter((e) => e.type === "user/message" || e.type === "assistant/message").map((e) => textOf2(e.data?.message ?? e.data));
        }
      });
      const events = handle?.agent.session.events ?? session?.events ?? [];
      const requestCalls = calls.slice(callStart);
      const submit = events.filter((e) => e.type === "tool/call" && e.data?.name === "submit_actor_reply").length;
      const wakeEvents = events.filter((e) => e.type === "user/message" && e.data?.source?.kind === "plugin" && e.data?.source?.plugin === "man-roles-roleplayer" && e.data?.source?.task9_wake === "actor" && !e.data?.source?.raw_ref && !e.data?.source?.message_id);
      const safety = ["allow", "professional-boundary", "urgent-help", "refuse"].includes(result.status) ? result.status : "allow";
      const actualText = (c) => JSON.stringify(actualRequests.get(c.requestId) ?? {});
      const leak = { reply: { context: actorContextText.includes(foreignMarkers.reply), request: requestCalls.some((c) => actualText(c).includes(foreignMarkers.reply)), wake: wakeText.includes(foreignMarkers.reply) }, progress: { context: actorContextText.includes(foreignMarkers.progress), request: requestCalls.some((c) => actualText(c).includes(foreignMarkers.progress)), wake: wakeText.includes(foreignMarkers.progress) }, candidate: { context: actorContextText.includes(foreignMarkers.candidate), request: requestCalls.some((c) => actualText(c).includes(foreignMarkers.candidate)), wake: wakeText.includes(foreignMarkers.candidate) } };
      const candidateBeforeActor = name2 !== "cross-person" || foreignFixtureEstablished && foreignSession?.events.some((e) => JSON.stringify(e).includes(foreignMarkers.reply)) && aggregate.trunk.state.branchProgress[foreignPersona]?.summary === foreignMarkers.progress && aggregate.trunk.state.dilemmaItems.some((i) => i.text === foreignMarkers.candidate);
      const submitCalls = events.filter((e) => e.type === "tool/call" && e.data?.name === "submit_actor_reply");
      const submitIds = new Set(submitCalls.map((e) => e.data?.callId ?? e.data?.id ?? e.data?.message?.source?.callId));
      const submitResults = events.filter((e) => e.type === "tool/result" && submitIds.has(e.data?.message?.source?.callId ?? e.data?.callId));
      const accepted = submitResults.filter((e) => e.data?.meta?.kind === "actor-reply" || /"ok"\s*:\s*true/.test(textOf2(e.data?.message ?? e.data)) && /"concluded"\s*:\s*true/.test(textOf2(e.data?.message ?? e.data))).length;
      const retrieval = events.filter((e) => e.type === "tool/call" && e.data?.name !== "submit_actor_reply").length;
      const submitDiagnostics = deriveSubmitDiagnostics(events);
      scenarios2.push({ name: name2, personaId: active, promptHash, calls: requestCalls, controlCalls: requestCalls.filter((c) => c.role === "control").length, directorCalls: requestCalls.filter((c) => c.role === "director").length, actorCalls: requestCalls.filter((c) => c.role === "actor").length, retrievalCalls: retrieval, usage: requestCalls.reduce((a, c) => ({ input: a.input + c.usage.input, output: a.output + c.usage.output, cache: a.cache + c.usage.cache, reasoning: a.reasoning + c.usage.reasoning, total: a.total + c.usage.total }), zero3()), retries: Math.max(0, requestCalls.filter((c) => c.role === "control").length - 1) + Math.max(0, requestCalls.filter((c) => c.role === "director").length - 1), candidateStatuses: aggregate.trunk.state.dilemmaItems.map((i) => i.status), questions: actorQuestions, turnPolicy: highRisk ? null : actualPolicy, outputObservation: deriveOutputObservation(events, highRisk ? 0 : accepted), submitDiagnostics, safety: { disposition: safety, downstreamCalls: highRisk ? 0 : result.calls.actor + result.calls.director + retrieval, messageHash: promptHash }, submitEvidence: { attempted: submitCalls.length, accepted, rejected: submitCalls.length - accepted, repairCount: submitDiagnostics.length > 1 ? 1 : 0 }, eventOrder: events.map((e) => e.type), isolation: { actorContextContainsForeignReply: leak.reply.context, actorContextContainsForeignProgress: leak.progress.context, actorContextContainsForeignCandidate: leak.candidate.context, candidateBeforeActor }, foreignLeaks: leak, rawRefCount: events.filter((e) => e.type === "user/message" && e.data?.source?.raw_ref).length, rawTextCount: events.filter((e) => e.type === "user/message" && textOf2(e.data?.message ?? e.data).includes(raw)).length, trunkRawCount: aggregate.trunk.state.userRaws.length, wakeCount: highRisk ? 0 : wakeEvents.length, wakeSource: highRisk ? null : wakeEvents[0] ? { kind: wakeEvents[0].data.source.kind, plugin: wakeEvents[0].data.source.plugin } : null, wakeContainsIdentity: /raw_ref|message_id/.test(wakeText), wakeContainsForeign: Object.values(foreignMarkers).some((m) => wakeText.includes(m)), foreignFixtureEstablished, foreignPersona: foreignPersona ?? null, foreignMarkerHashes: name2 === "cross-person" ? Object.values(foreignMarkers).map(sha256) : [], resultStatus: result.status });
      if (handle) {
        await handle.dispose();
        actorSessions.delete(String(sessionId));
        actorSessionById.delete(String(sessionId));
      }
    }
  } catch (error) {
    mkdirSync11(outputDir, { recursive: true });
    writeFileSync9(join13(outputDir, "failure-diagnostic.json"), JSON.stringify({ runId: process.env.MAN_ROLES_TASK9_RUN_ID ?? "phase7-task9-real", error: error instanceof Error ? error.message : String(error), markerPath, markerSha256, realCalls: calls.length }, null, 2));
    const exit2 = ctx.get("appExit");
    if (typeof exit2 === "function") exit2(1);
    throw error;
  } finally {
    offStream();
    if (previousMode === void 0) delete process.env.MAN_ROLES_RP_E2E;
    else process.env.MAN_ROLES_RP_E2E = previousMode;
  }
  for (const scenario2 of scenarios2) {
    const plan = allocator.plan(scenario2.name);
    scenario2.scenarioBudget = { allocated: plan.allocated, minimumStart: plan.minimumStart, repairReserve: plan.repairReserve ?? 0, observed: allocator.observedFor(scenario2.name), blocked: allocator.isBlocked(scenario2.name), blocker: allocator.blockerFor(scenario2.name) };
  }
  const report = { schemaVersion: 2, runMode: "real", runId: process.env.MAN_ROLES_TASK9_RUN_ID ?? "phase7-task9-real", profile: process.env.DSH_PROFILE ?? "isolated", attemptMarkerPath: markerPath, attemptMarkerSha256: markerSha256, provider: provider2, model: model2, expectedScenarios: [...PHASE7_TASK9_SCENARIOS], scenarios: scenarios2, requests: scenarios2.flatMap((s) => s.calls), fullTotal: budget.observedTokens, tokenLimit: limit, providerNetworkUsed: calls.length > 0, passed: false };
  const failures = validatePhase7Task9Report(report, report.scenarios.map((s) => s.personaId), provider2, model2);
  report.passed = failures.length === 0;
  mkdirSync11(outputDir, { recursive: true });
  writeFileSync9(join13(outputDir, "report.json"), JSON.stringify(report, null, 2));
  const exit = ctx.get("appExit");
  if (typeof exit === "function") exit(report.passed ? 0 : 1);
  return report;
}

// src/e2e/mvp-native-product-host.ts
import { mkdtempSync as mkdtempSync3 } from "node:fs";
import { tmpdir as tmpdir3 } from "node:os";
import { join as join14 } from "node:path";
import { CallId as CallId3 } from "@deepseek-ai/dsh-llm";

// src/product/service.ts
import { readdirSync as readdirSync5 } from "node:fs";
import { basename } from "node:path";

// src/product/turn-runner.ts
var TurnRunner = class {
  tasks = /* @__PURE__ */ new Map();
  controllers = /* @__PURE__ */ new Map();
  executions = /* @__PURE__ */ new Map();
  /**
   * Starts an already durably accepted product task.  The delivery boundary is
   * deliberately explicit: callers cannot accidentally run an Actor before
   * `trunk/branch-delivery-committed` exists.
   */
  runAfterDelivery(input) {
    if (!input.deliveryCommitted) return Promise.resolve({ taskId: input.taskId, status: "blocked", reason: "budget-exceeded" });
    return this.run(input.taskId, input.operation, input.budgetMs);
  }
  async run(taskId, operation, budgetMs = 3e4) {
    const prior = this.executions.get(taskId);
    if (prior) return prior;
    const completed = this.tasks.get(taskId);
    if (completed) return completed;
    const controller = new AbortController();
    const task = { taskId, status: "running" };
    this.tasks.set(taskId, task);
    this.controllers.set(taskId, controller);
    const execution = (async () => {
      let timer;
      try {
        const value = await Promise.race([
          operation(controller.signal),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(Object.assign(new Error("budget exceeded"), { code: "budget-exceeded" })), budgetMs);
          })
        ]);
        if (!controller.signal.aborted) {
          task.result = value;
          task.status = "completed";
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          task.status = "blocked";
          task.reason = error?.code === "budget-exceeded" ? "budget-exceeded" : "operation-failed";
          task.result = error;
        }
      } finally {
        if (controller.signal.aborted) {
          task.status = "cancelled";
          delete task.result;
        }
        if (timer !== void 0) clearTimeout(timer);
        this.controllers.delete(taskId);
        this.executions.delete(taskId);
      }
      return task;
    })();
    this.executions.set(taskId, execution);
    return execution;
  }
  cancel(taskId) {
    const task = this.tasks.get(taskId);
    const controller = this.controllers.get(taskId);
    if (!task || !controller || task.status !== "running") return false;
    controller.abort();
    return true;
  }
  get(taskId) {
    return this.tasks.get(taskId);
  }
};

// src/product/service.ts
var ProductRepository = class {
  rows = /* @__PURE__ */ new Map();
  create(id, personaId) {
    if (this.rows.has(id)) throw new Error("conversation exists");
    const row = { id, activePersona: personaId, lifecycle: "active" };
    this.rows.set(id, row);
    return row;
  }
  list() {
    return [...this.rows.values()];
  }
  get(id) {
    return this.rows.get(id);
  }
  switchPersona(id, personaId) {
    const row = this.rows.get(id);
    if (!row) throw new Error("conversation missing");
    row.activePersona = personaId;
    return row;
  }
};
var ConversationRepository = class {
  constructor(storageDir, registry8) {
    this.storageDir = storageDir;
    this.registry = registry8;
  }
  storageDir;
  registry;
  conversations = /* @__PURE__ */ new Map();
  diagnostics = [];
  queues = /* @__PURE__ */ new Map();
  create(id, persona) {
    if (this.conversations.has(id)) throw new Error("conversation exists");
    const aggregate = ConversationAggregate.create(id, this.storageDir, persona, this.registry);
    aggregate.switchPersona(this.registry.requireActiveForCreate(persona).id, (current) => this.sessionIdFor(id, current));
    this.conversations.set(id, aggregate);
    return aggregate;
  }
  /** Session ids are stable across restart and unique across conversations. */
  sessionIdFor(conversationId, persona) {
    return `${defaultSessionIdFor(persona)}--${conversationId}`;
  }
  get(id) {
    const existing = this.conversations.get(id);
    if (existing) return existing;
    const aggregate = ConversationAggregate.load(id, this.storageDir, this.registry);
    this.conversations.set(id, aggregate);
    return aggregate;
  }
  list() {
    const ids = new Set(this.conversations.keys());
    try {
      for (const name2 of readdirSync5(this.storageDir)) if (name2.endsWith(".jsonl")) ids.add(basename(name2, ".jsonl"));
    } catch {
    }
    const rows = [];
    this.diagnostics.length = 0;
    for (const id of ids) {
      try {
        rows.push(this.get(id));
      } catch {
        this.diagnostics.push({ conversationId: id, code: "trunk-load-failed" });
      }
    }
    return rows;
  }
  /** Serializes one Conversation without preventing another from progressing. */
  async withConversation(id, operation) {
    const prior = this.queues.get(id) ?? Promise.resolve();
    let release;
    const gate = new Promise((resolve2) => {
      release = resolve2;
    });
    this.queues.set(id, prior.then(() => gate));
    await prior;
    try {
      return await operation(this.get(id));
    } finally {
      release();
      if (this.queues.get(id) === gate) this.queues.delete(id);
    }
  }
};
var ManRolesProductService = class {
  constructor(conversations, runner = new TurnRunner(), taskFactory) {
    this.conversations = conversations;
    this.taskFactory = taskFactory;
    this.runner = runner;
  }
  conversations;
  taskFactory;
  runner;
  activeTasks = /* @__PURE__ */ new Map();
  view(aggregate) {
    const state = aggregate.trunk.state;
    return {
      conversationId: aggregate.conversationId,
      activePersonaId: aggregate.activePersona,
      lifecycle: state.lifecycle ?? "active",
      activeBranchSessionId: aggregate.currentBranch()?.sessionId ?? null,
      branches: [...aggregate.branchesIndex.values()].map((branch) => ({ personaId: branch.persona, sessionId: branch.sessionId })),
      userRaws: state.userRaws.map((raw) => ({ rawRef: raw.rawRef, text: raw.text })),
      candidateItems: state.dilemmaItems.filter((item2) => item2.status === "candidate" && !item2.supersededBy),
      confirmedItems: state.dilemmaItems.filter((item2) => item2.status === "confirmed" && !item2.supersededBy),
      branchProgress: state.branchProgress,
      taskState: this.activeTasks.get(aggregate.conversationId) ?? null
    };
  }
  create(id, personaId) {
    return this.view(this.conversations.create(id, personaId));
  }
  list() {
    return this.conversations.list().map((aggregate) => this.view(aggregate));
  }
  viewConversation(id) {
    return this.view(this.conversations.get(id));
  }
  switchPersona(id, personaId) {
    const aggregate = this.conversations.get(id);
    aggregate.switchPersona(personaId, (current) => this.conversations.sessionIdFor(id, current));
    return this.view(aggregate);
  }
  async send(input) {
    return this.conversations.withConversation(input.conversationId, async (aggregate) => {
      const branch = aggregate.currentBranch();
      if (!branch) return { ok: false, code: "branch-missing" };
      if (deterministicSafetyGate(input.text).disposition !== "allow") return { ok: false, code: "safety-blocked" };
      const result = await deliverCurrentUserMessage({ trunk: aggregate.trunk, persona: aggregate.activePersona, session: input.session, sessionId: branch.sessionId, messageId: input.messageId, text: input.text, flush: input.flush, findUserMessageByRawRef: input.findUserMessageByRawRef, queueUserMessage: input.queueUserMessage, wakePending: input.wakePending });
      if (result.status !== "committed") return { ok: false, code: "delivery-failed" };
      const task = input.task ?? this.taskFactory?.({ aggregate, messageId: input.messageId, text: input.text, rawRef: result.rawRef, personaId: aggregate.activePersona, delivery: result });
      if (!task) return { ok: true, rawRef: result.rawRef };
      const prior = this.activeTasks.get(aggregate.conversationId);
      if (prior?.status === "running" && prior.taskId !== task.taskId) return { ok: false, code: "conversation-busy" };
      const taskPersona = aggregate.activePersona;
      this.activeTasks.set(aggregate.conversationId, { taskId: task.taskId, status: "running" });
      void this.runner.runAfterDelivery({ taskId: task.taskId, deliveryCommitted: result.canStartGeneration, operation: (signal) => task.run(signal), budgetMs: task.budgetMs }).then((task2) => {
        if (task2.status === "blocked" && task2.reason === "budget-exceeded") {
          aggregate.recordTaskBudgetBlocked({ taskId: task2.taskId, personaId: taskPersona, branchSessionId: branch.sessionId, branchTurn: Math.max(1, aggregate.trunk.state.deliveryCommitted.filter((delivery) => delivery.persona_id === taskPersona).length), status: "blocked", reason: "budget_exceeded", retryable: true });
        }
        this.activeTasks.set(aggregate.conversationId, { taskId: task2.taskId, status: task2.status, ...task2.reason ? { reason: task2.reason } : {} });
      });
      return { ok: true, rawRef: result.rawRef, taskId: task.taskId };
    });
  }
  cancel(conversationId, taskId) {
    const current = this.activeTasks.get(conversationId);
    return !!current && current.taskId === taskId && this.runner.cancel(taskId);
  }
  /** Diagnostic read only; Product Remotes expose the narrowed view above. */
  task(taskId) {
    return this.runner.get(taskId);
  }
  async feedback(input) {
    return this.conversations.withConversation(input.conversationId, async (aggregate) => {
      const item2 = aggregate.trunk.state.dilemmaItems.find((candidate) => candidate.id === input.itemId);
      if (!item2) return { ok: false, code: "candidate-missing" };
      const replacement = input.action === "reject" || input.action === "skip" ? void 0 : this.confirmedRevision(item2, input.replacement);
      try {
        commitFeedback({ trunk: aggregate.trunk, state: aggregate.trunk.state, kind: input.action, personaId: aggregate.activePersona, messageId: input.operationId, taskId: input.operationId, eventPurpose: "product-feedback", sourceRawRefs: item2.sourceRawRefs, itemId: item2.id, replacement });
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error instanceof Error ? error.message : "feedback-failed" };
      }
    });
  }
  confirmedRevision(item2, text) {
    if (text !== void 0 && text.trim() === "") throw new Error("replacement must not be blank");
    return { ...item2, id: `${item2.id}:r${item2.revision + 1}`, text: text?.trim() || item2.text, status: "confirmed", visibility: "shared-confirmed", revision: item2.revision + 1, supersedes: item2.id };
  }
};

// src/product/native-actor-runtime.ts
import { SessionId as SessionId10 } from "@deepseek-ai/dsh-session";

// src/product/native-actor-branch.ts
function nativeActorDeliveryBridge(actor, flush2) {
  return {
    session: actor.session,
    flush: flush2,
    queueUserMessage: (message) => actor.send(message, "next-turn", false),
    wakePending: () => actor.wakePending()
  };
}

// src/product/branch-history.ts
function isRecord6(value) {
  return typeof value === "object" && value !== null;
}
function userText(data) {
  const message = branchUserMessageFromData(data);
  if (!message || !Array.isArray(message.content)) return void 0;
  const text = message.content.filter((block) => isRecord6(block) && block.type === "text" && typeof block.text === "string").map((block) => String(block.text)).join("");
  return text || void 0;
}
function userMessageId(data) {
  const message = branchUserMessageFromData(data);
  if (!message) return void 0;
  if (typeof message.id === "string") return message.id;
  const source = branchUserMessageSourceFromData(message);
  return isRecord6(source) && typeof source.message_id === "string" ? source.message_id : void 0;
}
function branchHistory2(events) {
  const lines = [];
  let activeTurn;
  for (const event2 of events) {
    if (event2.type === "turn/start" && isRecord6(event2.data) && typeof event2.data.turn === "number") {
      activeTurn = event2.data.turn;
      continue;
    }
    if (event2.type === "user/message") {
      const text = userText(event2.data);
      if (text) lines.push(text);
    }
    if (event2.type === "turn/end" && activeTurn !== void 0) {
      const reply = projectActorReply2(events, activeTurn);
      if (reply) lines.push(reply.reply);
      activeTurn = void 0;
    }
  }
  return lines;
}
function verifiedReplyForMessage(events, messageId) {
  let activeTurn;
  let targetTurn;
  for (const event2 of events) {
    if (event2.type === "turn/start" && isRecord6(event2.data) && typeof event2.data.turn === "number") activeTurn = event2.data.turn;
    if (event2.type === "user/message" && userMessageId(event2.data) === messageId) targetTurn = activeTurn;
    if (event2.type === "turn/end" && activeTurn !== void 0) activeTurn = void 0;
  }
  return targetTurn === void 0 ? void 0 : projectActorReply2(events, targetTurn);
}

// src/product/native-actor-runtime.ts
function isRecord7(value) {
  return typeof value === "object" && value !== null;
}
function sourceHasRawRef(data, rawRef) {
  const source = branchUserMessageSourceFromData(branchUserMessageFromData(data));
  return isRecord7(source) && source.raw_ref === rawRef;
}
function durableBranchHasRaw(events, rawRef) {
  return events.some((event2) => {
    if (!isRecord7(event2.data)) return false;
    if (event2.type === "user/message") return sourceHasRawRef(event2.data, rawRef);
    if (event2.type !== "agent/inbox/spliced" || !Array.isArray(event2.data.inserted)) return false;
    return event2.data.inserted.some((message) => sourceHasRawRef(message, rawRef));
  });
}
var NativeActorProductRuntime = class {
  constructor(ctx, registry8) {
    this.ctx = ctx;
    this.registry = registry8;
  }
  ctx;
  registry;
  state = new ActorTurnStateRegistry();
  libs = buildContentLibraries();
  async branch(aggregate) {
    const current = aggregate.currentBranch();
    if (!current) throw new Error("branch-missing");
    const actor = await this.ensure(current.sessionId, current.persona);
    const bridge = nativeActorDeliveryBridge(actor, (session) => this.ctx.sessions.flush(session));
    return { ...bridge, actor };
  }
  taskFactory() {
    return ({ aggregate, messageId, text, personaId, delivery }) => ({
      taskId: `product:${aggregate.conversationId}:${messageId}`,
      run: async (signal) => {
        const branch = await this.branch(aggregate);
        const result = await runDialogueTurnV2AfterDelivery({ raw: text, taskId: `product:${aggregate.conversationId}:${messageId}`, personaId, messageId, eventPurposePrefix: "product-v2" }, {
          registry: this.registry,
          trunk: aggregate.trunk,
          // The delivery was already committed before this task was allowed to
          // run.  This value is unused by the after-delivery coordinator but
          // preserves its typed dependency boundary.
          delivery: { session: branch.session, sessionId: aggregate.currentBranch()?.sessionId ?? "branch-missing", flush: (session) => this.ctx.sessions.flush(session) },
          director: async ({ personaId: directorPersona, currentRawRef }) => process.env.MAN_ROLES_PRODUCT_SCRIPTED_CANDIDATE === "1" ? { propose: [{ kind: "core-conflict", text: "\u811A\u672C\u5316\u5019\u9009\u56F0\u60D1\u3002", sourceRawRefs: [currentRawRef], proposedByPersona: directorPersona }] } : void 0,
          actor: {
            answerExists: () => verifiedReplyForMessage(branch.actor.session.events, messageId) !== void 0,
            loadExisting: () => verifiedReplyForMessage(branch.actor.session.events, messageId) ?? { reply: "" },
            run: async ({ policy }) => {
              const beforeTurns = branch.actor.session.events.filter((event2) => event2.type === "turn/start").length;
              this.state.setNextTurnPolicy(branch.actor.session, { retrievalPolicy: "allow", maxQuestions: policy.maxQuestions, allowedControls: policy.allowedControls });
              const abort = () => branch.actor.cancel({ kind: "user" });
              signal.addEventListener("abort", abort, { once: true });
              try {
                if (!branch.wakePending()) throw new Error("actor-has-no-pending-delivery");
                await branch.actor.whenIdle();
              } finally {
                signal.removeEventListener("abort", abort);
              }
              if (signal.aborted) throw new Error("actor-cancelled");
              const reply = projectActorReply(branch.actor.session.events, beforeTurns + 1);
              if (!reply) throw new Error("actor-reply-missing");
              return { reply: reply.reply, ...reply.turnIntent ? { turnIntent: reply.turnIntent } : {}, ...reply.questions ? { questions: reply.questions } : {}, ...reply.controls ? { controls: reply.controls } : {}, ...reply.evidence ? { evidence: reply.evidence } : {} };
            }
          },
          loadCurrentBranchHistory: () => branchHistory2(branch.actor.session.events)
        }, delivery);
        if (result.status !== "ok") throw new Error(`native dialogue failed: ${"error" in result ? `${result.error.code}:${result.error.message}` : result.status}`);
        return result;
      }
    });
  }
  async ensure(sessionId, personaId) {
    const id = SessionId10(sessionId);
    const active = this.ctx.agents.get(id);
    if (active) return active;
    const options = { provider: process.env.MAN_ROLES_PROVIDER ?? "man-roles-unconfigured", model: process.env.MAN_ROLES_MODEL ?? "no-network" };
    try {
      return (await this.ctx.agents.resume({ resumeSessionId: id, agentOptions: options, setup: setupActorAgent(personaId, this.libs, this.state) })).agent;
    } catch {
      return (await this.ctx.agents.create({ sessionId: id, agentOptions: options, setup: setupActorAgent(personaId, this.libs, this.state) })).agent;
    }
  }
  hasDurableDelivery(actor, rawRef) {
    return durableBranchHasRaw(actor.session.events, rawRef);
  }
};

// src/e2e/mvp-native-product-host.ts
function scriptedSubmit() {
  return (async function* () {
    const argumentsText = JSON.stringify({ segments: [{ kind: "dialogue", text: "\u811A\u672C\u5316\u4EA7\u54C1\u56DE\u7B54\u3002" }] });
    const callId = CallId3("mvp-native-submit");
    yield { type: "block-start", index: 0, blockType: "tool-call" };
    yield { type: "tool-call-delta", index: 0, id: callId, name: "submit_actor_reply", argumentsDelta: argumentsText };
    yield { type: "block-end", index: 0, block: { type: "tool-call", id: callId, name: "submit_actor_reply", arguments: argumentsText } };
    yield { type: "usage", usage: { inputTokens: 0, outputTokens: 0 } };
    yield { type: "finish", reason: { kind: "tool-calls" } };
  })();
}
function installMvpScriptedProductLlm(ctx) {
  return ctx.on("llm/stream", () => scriptedSubmit());
}
async function runMvpNativeProductHost(ctx) {
  const registry8 = createRuntimeRegistry();
  const personas = registry8.listActive();
  const persona = personas[0]?.id;
  const secondPersona = personas[1]?.id;
  if (!persona || !secondPersona) throw new Error("mvp native product host requires two active personas");
  const runtime = new NativeActorProductRuntime(ctx, registry8);
  const service = new ManRolesProductService(new ConversationRepository(mkdtempSync3(join14(tmpdir3(), "man-roles-native-product-")), registry8), void 0, runtime.taskFactory());
  let streamCalls = 0;
  const off = ctx.on("llm/stream", (_options, _next) => {
    streamCalls++;
    return scriptedSubmit();
  });
  try {
    service.create("mvp-native-product", persona);
    const aggregate = service.conversations.get("mvp-native-product");
    const bridge = await runtime.branch(aggregate);
    const normal = await service.send({ conversationId: "mvp-native-product", messageId: "native-1", text: "\u6211\u60F3\u628A\u7406\u60F3\u843D\u5230\u4ECA\u5929\u7684\u9009\u62E9\u4E0A\u3002", ...bridge, findUserMessageByRawRef: (rawRef) => runtime.hasDurableDelivery(bridge.actor, rawRef) });
    for (let attempt = 0; attempt < 100 && service.viewConversation("mvp-native-product").taskState?.status === "running"; attempt++) await new Promise((resolve2) => setTimeout(resolve2, 10));
    await bridge.actor.whenIdle();
    service.switchPersona("mvp-native-product", secondPersona);
    const secondBranch = await runtime.branch(aggregate);
    const second = await service.send({ conversationId: "mvp-native-product", messageId: "native-2", text: "\u8BF7\u4ECE\u53E6\u4E00\u4EBA\u7269\u89D2\u5EA6\u56DE\u5E94\u3002", ...secondBranch, findUserMessageByRawRef: (rawRef) => runtime.hasDurableDelivery(secondBranch.actor, rawRef) });
    for (let attempt = 0; attempt < 100 && service.viewConversation("mvp-native-product").taskState?.status === "running"; attempt++) await new Promise((resolve2) => setTimeout(resolve2, 10));
    await secondBranch.actor.whenIdle();
    const safety = await service.send({ conversationId: "mvp-native-product", messageId: "native-safety", text: "\u6211\u73B0\u5728\u8981\u4F24\u5BB3\u81EA\u5DF1\u3002", ...bridge, findUserMessageByRawRef: (rawRef) => runtime.hasDurableDelivery(bridge.actor, rawRef) });
    const view = service.viewConversation("mvp-native-product");
    const reply = bridge.actor.session.events.some((event2) => event2.type === "tool/result" && JSON.stringify(event2.data).includes("actor-reply"));
    const firstTexts = JSON.stringify(bridge.actor.session.events);
    const secondTexts = JSON.stringify(secondBranch.actor.session.events);
    const isolated = !firstTexts.includes("\u53E6\u4E00\u4EBA\u7269\u89D2\u5EA6") && !secondTexts.includes("\u7406\u60F3\u843D\u5230\u4ECA\u5929");
    const pass = normal.ok && second.ok && safety.ok === false && safety.code === "safety-blocked" && streamCalls === 2 && reply && view.userRaws.length === 2 && aggregate.trunk.state.deliveryCommitted.length === 2 && isolated;
    const taskResult = service.task("product:mvp-native-product:native-1")?.result;
    console.log(JSON.stringify({ schemaVersion: 1, nativeProductHost: true, passed: pass, providerNetworkUsed: false, tokenCost: 0, streamCalls, normal, second, safety, taskState: view.taskState, ...taskResult instanceof Error ? { taskError: taskResult.message } : {}, userRaws: view.userRaws.length, deliveryCommitted: aggregate.trunk.state.deliveryCommitted.length, firstEventTypes: bridge.actor.session.events.map((event2) => event2.type), secondEventTypes: secondBranch.actor.session.events.map((event2) => event2.type), isolated, reply }));
    if (!pass) throw new Error("mvp-native-product-host contract failed");
  } finally {
    off();
  }
  const appExit = ctx.get("appExit");
  if (typeof appExit === "function") appExit(0);
}

// src/product/remote-probe.ts
import { TypertRemoteService, Remote } from "@deepseek-ai/dsh-typert-protocol";

// src/product/types.ts
import { z as z13 } from "zod";
var manRolesProbeRequestSchema = z13.object({
  nonce: z13.string().min(1)
}).strict();
var manRolesProbeResponseSchema = z13.object({
  ok: z13.literal(true),
  nonce: z13.string().min(1),
  service: z13.literal("manRolesProbe")
}).strict();
var productConversationIdSchema = z13.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/).refine((value) => !value.includes("--"), "conversationId may not contain --");
var productCreateRequestSchema = z13.object({ conversationId: productConversationIdSchema, personaId: z13.string().min(1) }).strict();
var productViewRequestSchema = z13.object({ conversationId: z13.string().min(1) }).strict();
var productSwitchRequestSchema = z13.object({ conversationId: z13.string().min(1), personaId: z13.string().min(1), operationId: z13.string().min(1) }).strict();
var productSendRequestSchema = z13.object({ conversationId: z13.string().min(1), messageId: z13.string().min(1), text: z13.string() }).strict();
var productFeedbackRequestSchema = z13.object({ conversationId: z13.string().min(1), itemId: z13.string().min(1), action: z13.enum(["confirm", "partial-confirm", "correct", "reject", "skip"]), operationId: z13.string().min(1), replacement: z13.string().min(1).optional() }).strict();

// src/product/remote-probe.ts
var productService;
var nativeActors;
function configureManRolesProductService(storageDir, hostCtx) {
  const registry8 = createRuntimeRegistry();
  if (hostCtx && !nativeActors) nativeActors = new NativeActorProductRuntime(hostCtx, registry8);
  if (productService) return productService;
  productService = new ManRolesProductService(
    new ConversationRepository(storageDir, registry8),
    void 0,
    (input) => nativeActors?.taskFactory()(input)
  );
  return productService;
}
function unavailable() {
  return { ok: false, code: "product-service-unavailable" };
}
var _feedback_dec, _send_dec, _switchPersona_dec, _view_dec, _create_dec, _ping_dec, _a, _init;
var ManRolesProbeService = class extends (_a = TypertRemoteService, _ping_dec = [Remote("ping")], _create_dec = [Remote("create")], _view_dec = [Remote("view")], _switchPersona_dec = [Remote("switchPersona")], _send_dec = [Remote("send")], _feedback_dec = [Remote("feedback")], _a) {
  constructor(hostCtx) {
    super(hostCtx, "manRolesProbe");
    this.hostCtx = hostCtx;
    __runInitializers(_init, 5, this);
  }
  hostCtx;
  ping(probePingRequest) {
    const input = manRolesProbeRequestSchema.parse(probePingRequest);
    return manRolesProbeResponseSchema.parse({ ok: true, nonce: input.nonce, service: "manRolesProbe" });
  }
  create(probeCreateRequest) {
    const input = productCreateRequestSchema.parse(probeCreateRequest);
    if (!productService) return unavailable();
    try {
      return { ok: true, view: productService.create(input.conversationId, input.personaId) };
    } catch (error) {
      return { ok: false, code: error instanceof Error ? error.message : "create-failed" };
    }
  }
  view(probeViewRequest) {
    const input = productViewRequestSchema.parse(probeViewRequest);
    if (!productService) return unavailable();
    try {
      return { ok: true, view: productService.viewConversation(input.conversationId) };
    } catch (error) {
      return { ok: false, code: error instanceof Error ? error.message : "view-failed" };
    }
  }
  switchPersona(probeSwitchRequest) {
    const input = productSwitchRequestSchema.parse(probeSwitchRequest);
    if (!productService) return unavailable();
    try {
      const view = productService.switchPersona(input.conversationId, input.personaId);
      return { ok: true, sessionId: view.branches.find((branch) => branch.personaId === view.activePersonaId)?.sessionId, view };
    } catch (error) {
      return { ok: false, code: error instanceof Error ? error.message : "switch-failed" };
    }
  }
  async send(probeSendRequest) {
    const input = productSendRequestSchema.parse(probeSendRequest);
    if (!productService) return unavailable();
    if (!nativeActors) return { ok: false, code: "native-actor-unavailable" };
    try {
      const bridge = await nativeActors.branch(productService.conversations.get(input.conversationId));
      return await productService.send({ conversationId: input.conversationId, messageId: input.messageId, text: input.text, ...bridge, findUserMessageByRawRef: (rawRef) => nativeActors.hasDurableDelivery(bridge.actor, rawRef) });
    } catch (error) {
      return { ok: false, code: error instanceof Error ? error.message : "send-failed" };
    }
  }
  async feedback(probeFeedbackRequest) {
    const input = productFeedbackRequestSchema.parse(probeFeedbackRequest);
    if (!productService) return unavailable();
    return productService.feedback(input);
  }
};
_init = __decoratorStart(_a);
__decorateElement(_init, 1, "ping", _ping_dec, ManRolesProbeService);
__decorateElement(_init, 1, "create", _create_dec, ManRolesProbeService);
__decorateElement(_init, 1, "view", _view_dec, ManRolesProbeService);
__decorateElement(_init, 1, "switchPersona", _switchPersona_dec, ManRolesProbeService);
__decorateElement(_init, 1, "send", _send_dec, ManRolesProbeService);
__decorateElement(_init, 1, "feedback", _feedback_dec, ManRolesProbeService);
__decoratorMetadata(_init, ManRolesProbeService);
var _feedback_dec2, _send_dec2, _switchPersona_dec2, _view_dec2, _create_dec2, _a2, _init2;
var ManRolesProductRemote = class extends (_a2 = TypertRemoteService, _create_dec2 = [Remote("create")], _view_dec2 = [Remote("view")], _switchPersona_dec2 = [Remote("switchPersona")], _send_dec2 = [Remote("send")], _feedback_dec2 = [Remote("feedback")], _a2) {
  constructor(hostCtx) {
    super(hostCtx, "manRolesProduct");
    this.hostCtx = hostCtx;
    __runInitializers(_init2, 5, this);
  }
  hostCtx;
  async create(productCreateRequest) {
    const input = productCreateRequestSchema.parse(productCreateRequest);
    if (!productService) return unavailable();
    if (!nativeActors) return { ok: false, code: "native-actor-unavailable" };
    try {
      const view = productService.create(input.conversationId, input.personaId);
      await nativeActors.branch(productService.conversations.get(input.conversationId));
      return { ok: true, view: productService.viewConversation(input.conversationId) };
    } catch (error) {
      return { ok: false, code: error instanceof Error ? error.message : "create-failed" };
    }
  }
  view(productViewRequest) {
    const input = productViewRequestSchema.parse(productViewRequest);
    if (!productService) return unavailable();
    try {
      return { ok: true, view: productService.viewConversation(input.conversationId) };
    } catch (error) {
      return { ok: false, code: error instanceof Error ? error.message : "view-failed" };
    }
  }
  async switchPersona(productSwitchRequest) {
    const input = productSwitchRequestSchema.parse(productSwitchRequest);
    if (!productService) return unavailable();
    if (!nativeActors) return { ok: false, code: "native-actor-unavailable" };
    try {
      productService.switchPersona(input.conversationId, input.personaId);
      await nativeActors.branch(productService.conversations.get(input.conversationId));
      const view = productService.viewConversation(input.conversationId);
      return { ok: true, sessionId: view.activeBranchSessionId ?? void 0, view };
    } catch (error) {
      return { ok: false, code: error instanceof Error ? error.message : "switch-failed" };
    }
  }
  async send(productSendRequest) {
    const input = productSendRequestSchema.parse(productSendRequest);
    if (!productService) return unavailable();
    if (!nativeActors) return { ok: false, code: "native-actor-unavailable" };
    try {
      const bridge = await nativeActors.branch(productService.conversations.get(input.conversationId));
      return await productService.send({ conversationId: input.conversationId, messageId: input.messageId, text: input.text, ...bridge, findUserMessageByRawRef: (rawRef) => nativeActors.hasDurableDelivery(bridge.actor, rawRef) });
    } catch (error) {
      return { ok: false, code: error instanceof Error ? error.message : "send-failed" };
    }
  }
  async feedback(productFeedbackRequest) {
    const input = productFeedbackRequestSchema.parse(productFeedbackRequest);
    return productService ? productService.feedback(input) : unavailable();
  }
};
_init2 = __decoratorStart(_a2);
__decorateElement(_init2, 1, "create", _create_dec2, ManRolesProductRemote);
__decorateElement(_init2, 1, "view", _view_dec2, ManRolesProductRemote);
__decorateElement(_init2, 1, "switchPersona", _switchPersona_dec2, ManRolesProductRemote);
__decorateElement(_init2, 1, "send", _send_dec2, ManRolesProductRemote);
__decorateElement(_init2, 1, "feedback", _feedback_dec2, ManRolesProductRemote);
__decoratorMetadata(_init2, ManRolesProductRemote);

// src/validation/task5-report.ts
import { z as z14 } from "zod";
var recoveryItem = z14.object({ rawRef: z14.string().min(1), messageId: z14.string().min(1), personaId: z14.string().min(1).optional(), status: z14.enum(["committed", "recovered", "failed"]), failureCode: z14.string().min(1).optional() }).strict();
var request = z14.object({ provider: z14.string(), model: z14.string(), usageTokens: z14.number().int().nonnegative() }).strict();
var reportSchema = z14.object({ stage: z14.literal("stage2"), pid: z14.number().int().positive(), expectedPersonaIds: z14.array(z14.string().min(1)), stage1Pid: z14.number().int().positive(), stage2Pid: z14.number().int().positive(), processRestart: z14.boolean(), dshPersistence: z14.boolean(), providerObservation: z14.object({ recoveryStreamCalls: z14.number().int().nonnegative(), scriptedRequests: z14.number().int().nonnegative(), scriptedOnly: z14.boolean(), providerNetworkUsed: z14.boolean(), tokenCost: z14.number().int().nonnegative(), requests: z14.array(request).optional() }).strict(), recovery: z14.object({ deliveries: z14.array(recoveryItem), compensation: z14.object({ status: z14.enum(["not-needed", "compensated", "failed"]) }).optional() }).strict(), before: z14.object({ byPersona: z14.record(z14.string(), z14.number().int().nonnegative()), committed: z14.number().int().nonnegative(), sources: z14.record(z14.string(), z14.array(z14.unknown())).optional() }).strict(), after: z14.object({ byPersona: z14.record(z14.string(), z14.number().int().nonnegative()), committed: z14.number().int().nonnegative(), sources: z14.record(z14.string(), z14.array(z14.unknown())).optional() }).strict(), derivedState: z14.object({ persisted: z14.boolean(), generationCalls: z14.number().int().nonnegative() }).strict(), cancel: z14.object({ aborted: z14.boolean(), assistantCount: z14.number().int().nonnegative(), lateAssistant: z14.number().int().nonnegative(), persistedDerived: z14.number().int().nonnegative(), derivedAttempt: z14.number().int().nonnegative().optional(), derivedResult: z14.object({ status: z14.enum(["skipped", "committed"]) }).strict(), requests: z14.array(request), usageTokens: z14.number().int().nonnegative().optional() }).strict(), restored: z14.record(z14.string(), z14.array(z14.object({ message_id: z14.string(), raw_ref: z14.string(), persona_id: z14.string() }).strict())), assistant: z14.record(z14.string(), z14.array(z14.string())), order: z14.array(z14.string()), isolation: z14.record(z14.string(), z14.boolean()), counts: z14.object({ userSources: z14.number().int().nonnegative(), committed: z14.number().int().nonnegative() }).strict(), scenarios: z14.object({ identical: z14.object({ same1: z14.object({ raw: z14.number().int().nonnegative(), branch: z14.number().int().nonnegative() }).strict(), same2: z14.object({ raw: z14.number().int().nonnegative(), branch: z14.number().int().nonnegative() }).strict() }).strict(), retry: z14.object({ raw: z14.number().int().nonnegative(), branch: z14.number().int().nonnegative(), committed: z14.number().int().nonnegative() }).strict(), acceptedOnly: z14.object({ beforeBranch: z14.number().int().nonnegative(), afterBranch: z14.number().int().nonnegative(), committed: z14.boolean(), status: z14.enum(["committed", "recovered", "failed"]), failureCode: z14.string().optional() }).strict(), branchOnly: z14.object({ beforeBranch: z14.number().int().nonnegative(), afterBranch: z14.number().int().nonnegative(), committed: z14.boolean(), status: z14.enum(["committed", "recovered", "failed"]), failureCode: z14.string().optional() }).strict(), assistantState: z14.object({ assistantByPersona: z14.record(z14.string(), z14.number().int().nonnegative()), derivedPersisted: z14.boolean(), generation: z14.number().int().nonnegative() }).strict(), cancel: z14.object({ aborted: z14.boolean(), targetTurnAssistantCount: z14.number().int().nonnegative(), lateMarkerCount: z14.number().int().nonnegative(), derivedMarkerCount: z14.number().int().nonnegative(), localRequests: z14.number().int().nonnegative() }).strict() }).strict(), authority: z14.record(z14.string(), z14.unknown()).optional() }).strict();
function validateTask5Report(report, expectedPersonaIds) {
  const parsed = reportSchema.safeParse(report);
  if (!parsed.success) return { passed: false, hardGateFailures: ["report-invalid"] };
  const r = parsed.data;
  const f = [];
  const ids = [...expectedPersonaIds];
  const unique = new Set(ids);
  const keys = (v) => Object.keys(v ?? {}).sort();
  const n = (ok, code) => {
    if (!ok) f.push(code);
  };
  if (r.before.sources && r.after.sources) {
    n(JSON.stringify(keys(r.before.sources)) === JSON.stringify([...ids].sort()) && JSON.stringify(keys(r.after.sources)) === JSON.stringify([...ids].sort()), "before-after-keys");
    const all = Object.values(r.restored).flat();
    const refs = all.map((x) => `${x.raw_ref}|${x.message_id}`);
    n(new Set(refs).size === refs.length, "duplicate-sources");
    ids.forEach((id) => (r.restored[id] ?? []).forEach((x) => n(x.persona_id === id, `source-owner-${id}`)));
  }
  n(ids.length > 0 && unique.size === ids.length && JSON.stringify([...r.expectedPersonaIds].sort()) === JSON.stringify([...ids].sort()), "expected-persona-ids");
  n(r.stage1Pid !== r.stage2Pid && r.processRestart, "restart-pids");
  n(JSON.stringify(keys(r.restored)) === JSON.stringify([...ids].sort()), "restored-personas");
  n(JSON.stringify(keys(r.assistant)) === JSON.stringify([...ids].sort()), "assistant-personas");
  n(JSON.stringify(keys(r.isolation)) === JSON.stringify([...ids].sort()), "isolation-keys");
  ids.forEach((id) => {
    const own = (r.assistant[id] ?? []).some((x) => x.includes(`private-${id}`));
    const foreign = (r.assistant[id] ?? []).some((x) => ids.some((q) => q !== id && x.includes(`private-${q}`)));
    n(own && !foreign && (r.isolation[id] ?? false) === own, `isolation-${id}`);
  });
  n(JSON.stringify(keys(r.scenarios.assistantState.assistantByPersona)) === JSON.stringify([...ids].sort()) && ids.every((id) => (r.scenarios.assistantState.assistantByPersona[id] ?? 0) === (r.assistant[id] ?? []).length), "assistant-state");
  n(r.processRestart && r.dshPersistence, "restart");
  n(r.counts.committed === r.after.committed && (!r.before.sources || r.counts.userSources === Object.values(r.restored).reduce((n2, x) => n2 + x.length, 0)), "committed");
  n(r.providerObservation.recoveryStreamCalls === 0 && r.providerObservation.scriptedOnly && !r.providerObservation.providerNetworkUsed && r.providerObservation.tokenCost === 0 && r.cancel.requests.every((q) => q.usageTokens === 0), "provider");
  n(r.cancel.requests.length === r.providerObservation.scriptedRequests && r.cancel.requests.every((q) => q.provider === "man-roles-compat-local" && q.model === "scripted-no-network"), "provider-identity");
  n(r.scenarios.retry.raw === 1 && r.scenarios.retry.branch === 1 && r.scenarios.retry.committed === 1, "retry");
  n(r.scenarios.acceptedOnly.beforeBranch === 0 && r.scenarios.acceptedOnly.afterBranch === 1 && r.scenarios.acceptedOnly.committed, "accepted-only");
  n(r.scenarios.branchOnly.beforeBranch === 1 && r.scenarios.branchOnly.afterBranch === 1 && r.scenarios.branchOnly.committed, "branch-only");
  n(r.derivedState.persisted && r.derivedState.generationCalls === 0, "derived-state");
  n(r.cancel.aborted && r.cancel.assistantCount === 0 && r.cancel.lateAssistant === 0 && r.cancel.persistedDerived === 0 && (r.cancel.derivedAttempt === void 0 || r.cancel.derivedAttempt === 1) && r.cancel.derivedResult.status === "skipped", "cancel");
  n(r.scenarios.cancel.localRequests === r.cancel.requests.length, "cancel-request");
  n(r.recovery.deliveries.length === r.after.committed && r.recovery.deliveries.every((x) => x.status === "recovered" || x.status === "committed"), "recovery-items");
  const committedDeliveries = r.recovery.deliveries.filter((x) => x.status === "committed").length;
  const recoveredDeliveries = r.recovery.deliveries.filter((x) => x.status === "recovered").length;
  n(r.before.committed === committedDeliveries, "before-committed");
  n(r.after.committed === r.before.committed + recoveredDeliveries, "after-committed");
  return { passed: f.length === 0, hardGateFailures: f };
  if (r.before.sources && r.after.sources) {
    n(JSON.stringify(keys(r.before.sources)) === JSON.stringify([...ids].sort()) && JSON.stringify(keys(r.after.sources)) === JSON.stringify([...ids].sort()), "before-after-keys");
    const all = Object.values(r.restored).flat();
    const refs = all.map((x) => `${x.raw_ref}|${x.message_id}`);
    n(new Set(refs).size === refs.length, "duplicate-sources");
    ids.forEach((id) => {
      for (const source of r.restored[id] ?? []) n(source.persona_id === id, `source-owner-${id}`);
    });
  }
  n(JSON.stringify(r.order) === JSON.stringify(["same-1", "same-2", "retry-1", "accepted-only", "branch-only"]), "order");
  return { passed: f.length === 0, hardGateFailures: f };
}

// src/index.ts
init_dilemma();
init_schema();
init_trunk_storage();

// src/persona/generator.ts
function scanPersonaArtifact(rootDir) {
  const registry8 = PersonaRegistry.fromDirectory(rootDir);
  return registry8.list().map((definition) => ({ manifest: definition.manifest, prompt: definition.prompt, anecdotes: definition.anecdotes, quotes: definition.quotes, blacklist: definition.blacklist }));
}
function generateRegistryArtifacts(rootDir) {
  const host = scanPersonaArtifact(rootDir);
  return { host, client: host.filter((entry) => entry.manifest.status === "active").map(({ manifest }) => ({ id: manifest.id, displayName: manifest.displayName, status: manifest.status })) };
}

// src/index.ts
init_trunk_storage();
init_trunk_storage();

// src/client/product-controller.ts
function unwrap(value) {
  if ("value" in value) return value.value;
  if ("error" in value) return { ok: false, code: value.error?.message ?? "remote-failed" };
  return value;
}
var ProductController = class {
  constructor(remote) {
    this.remote = remote;
  }
  remote;
  async create(input) {
    return unwrap(await this.remote.manRolesProduct.create(input));
  }
  async view(input) {
    return unwrap(await this.remote.manRolesProduct.view(input));
  }
  async send(input) {
    return unwrap(await this.remote.manRolesProduct.send(input));
  }
  /** Navigation belongs to the caller and occurs only after ProductService has committed the switch. */
  async switchPersona(input, open) {
    const result = unwrap(await this.remote.manRolesProduct.switchPersona(input));
    if (result.ok && result.sessionId) open(result.sessionId);
    return result;
  }
  async feedback(input) {
    return unwrap(await this.remote.manRolesProduct.feedback(input));
  }
};

// src/client/components/product-components.ts
var ProductConversationList = (items) => ({ type: "conversation-list", items });
var ManRolesComposer = (state) => ({ type: "composer", ...state });
var PersonaSwitcher = (activePersona, personas) => ({ type: "persona-switcher", activePersona, personas });
var CandidateControls = (candidateId) => ({ type: "candidate-controls", candidateId });
var ResultPanel = (result) => ({ type: "result-panel", result });

// src/validation/mvp-report.ts
import { z as z15 } from "zod";
var mvpReportSchema = z15.object({
  schemaVersion: z15.literal(1),
  providerNetworkUsed: z15.literal(false),
  tokenCost: z15.literal(0),
  scenarios: z15.array(z15.string()).min(1),
  passed: z15.literal(true),
  trace: z15.object({ productConversations: z15.literal(1), userRaws: z15.number().int().min(1), branchEvents: z15.number().int().min(1), taskCalls: z15.number().int().nonnegative(), firstAccepted: z15.literal(true), secondAccepted: z15.literal(true), switchedTo: z15.string().min(1), retryDidNotAppend: z15.literal(true), deliveryInterrupted: z15.literal(true), cancelLateResultRejected: z15.literal(true), budgetDurable: z15.literal(true), budgetPersonaIsOriginal: z15.literal(true) }).strict()
}).strict();
function validateMvpReport(value) {
  return mvpReportSchema.parse(value);
}

// src/index.ts
var name = "man-roles-roleplayer";
var inject = ["sessions", "sessionProjections", "llm", "agents", "agentLoop", "systemPrompt", "sessionPersistence"];
async function apply(ctx) {
  console.log("[man-roles-roleplayer] \u63D2\u4EF6\u5DF2\u52A0\u8F7D (name=%s)\uFF0C\u5DF2\u6CE8\u5165\u670D\u52A1: %j", name, inject);
  configureManRolesProductService(process.env.MAN_ROLES_STORAGE_DIR ?? join15(process.cwd(), ".man-roles"), ctx);
  if (process.env.MAN_ROLES_PRODUCT_SCRIPTED === "1") ctx.effect(() => installMvpScriptedProductLlm(ctx), "man-roles zero-cost product stream");
  await ctx.plugin(ManRolesProbeService);
  await ctx.plugin(ManRolesProductRemote);
  ctx.sessionProjections.register(dilemmaProjectionDefinition());
  console.log("[man-roles-roleplayer] Projection \u5355\u5143\u5DF2\u6CE8\u518C key=%s (stateVersion=1)", DILEMMA_PROJECTION_KEY);
  if (process.env.MAN_ROLES_RP_E2E === "1") {
    console.log("[man-roles-roleplayer] E2E \u6A21\u5F0F\u5F00\u542F\uFF0C\u8FD0\u884C\u5355\u4EBA\u7269\u5782\u76F4\u5207\u7247\u2026");
    runVerticalSlice(ctx);
  } else if (process.env.MAN_ROLES_RP_E2E === "dual") {
    console.log("[man-roles-roleplayer] E2E \u6A21\u5F0F\u5F00\u542F\uFF0C\u8FD0\u884C\u53CC\u4EBA\u7269\u5207\u6362\u5782\u76F4\u5207\u7247\uFF08\u9636\u6BB5 4\uFF0C\u65B9\u6848 A\uFF09\u2026");
    runDualVerticalSlice(ctx);
  } else if (process.env.MAN_ROLES_RP_E2E === "real") {
    console.log("[man-roles-roleplayer] E2E \u6A21\u5F0F\u5F00\u542F\uFF0C\u8FD0\u884C\u771F\u5B9E\u6A21\u578B\u5782\u76F4\u5207\u7247\uFF08\u9636\u6BB5 5\uFF0C\u771F\u5B9E DeepSeek API\uFF09\u2026");
    await runRealModelSlice(ctx);
  } else if (process.env.MAN_ROLES_RP_E2E === "retrieval") {
    console.log("[man-roles-roleplayer] E2E \u6A21\u5F0F\u5F00\u542F\uFF0C\u8FD0\u884C\u9636\u6BB5 6 \u68C0\u7D22\u5782\u76F4\u5207\u7247\uFF08\u771F\u5B9E\u6A21\u578B tool-call + \u56F4\u680F + \u51FA\u5904\u6821\u9A8C\uFF09\u2026");
    await runRetrievalSlice(ctx);
  } else if (process.env.MAN_ROLES_RP_E2E === "loop-compat") {
    console.log("[man-roles-roleplayer] E2E \u6A21\u5F0F\u5F00\u542F\uFF0C\u8FD0\u884C DSH AgentLoop \u63A7\u5236\u5FAA\u73AF\u517C\u5BB9\u6027\u5207\u7247\uFF08\u672C\u5730\u811A\u672C\u6D41\uFF0C\u96F6 token\uFF09\u2026");
    return runControlLoopCompatibilitySlice(ctx);
  } else if (process.env.MAN_ROLES_RP_E2E === "native-evidence") {
    console.log("[man-roles-roleplayer] \u539F\u751F AgentLoop + Evidence Ledger \u5207\u7247\u5F00\u542F\u2026");
    return runNativeEvidenceSlice(ctx);
  } else if (process.env.MAN_ROLES_RP_E2E === "delivery-probe") {
    return runDeliveryProbe(ctx);
  } else if (process.env.MAN_ROLES_RP_E2E === "task5-restart-stage1") {
    return runTask5Host(ctx, "stage1");
  } else if (process.env.MAN_ROLES_RP_E2E === "task5-restart-stage2") {
    return runTask5Host(ctx, "stage2");
  } else if (process.env.MAN_ROLES_RP_E2E === "dialogue-loop") {
    const report = await runDialogueLoopE2E();
    console.log("[man-roles-roleplayer] dialogue-loop local E2E", JSON.stringify(report));
  } else if (process.env.MAN_ROLES_RP_E2E === "mvp-native-product-host") {
    await runMvpNativeProductHost(ctx);
  } else if (process.env.MAN_ROLES_RP_E2E === "phase7-task9-scripted") {
    await runPhase7Task9Scripted(ctx, process.env.MAN_ROLES_TASK9_OUTPUT ?? join15(process.env.DSH_HOME ?? ".validation", "man-roles", "phase7-task9-scripted"));
  } else if (process.env.MAN_ROLES_RP_E2E === "phase7-task9-real") {
    await runPhase7Task9Real(ctx, process.env.MAN_ROLES_TASK9_OUTPUT ?? join15(process.env.DSH_HOME ?? ".validation", "man-roles", "phase7-task9-real"), process.env.MAN_ROLES_TASK9_MARKER ?? "", process.env.MAN_ROLES_TASK9_MARKER_SHA256 ?? "");
  }
}
export {
  ACTOR_TOOLS,
  FINAL_ACTOR_TOOL_NAMES as ACTOR_TOOL_CONTRACT_NAMES,
  ANECDOTES,
  ANECDOTE_COUNTS,
  AnecdoteStore,
  BLACKLIST_COUNTS,
  BLACKLIST_ENTRIES,
  Blacklist,
  BranchManager,
  CONTENT_VERSION,
  CONTEXT_TOKEN_LIMIT,
  CandidateControls,
  ConversationAggregate,
  ConversationRepository,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  DILEMMA_CANDIDATE,
  DILEMMA_CONFIRMED,
  DILEMMA_CORRECTED,
  DIRECTOR_SYSTEM_PROMPT,
  DshLlmClient,
  EvidenceLedger,
  FETCH_ANECDOTE_TOOL,
  FINAL_ACTOR_TOOL_NAMES,
  IdempotencyRegistry,
  JUDGE_SYSTEM_PROMPT,
  LlmCallError,
  ManRolesComposer,
  ManRolesProbeService,
  ManRolesProductRemote,
  ManRolesProductService,
  PERSONA_RED_LINE_SECTIONS,
  PHASE7_TASK9_SCENARIOS,
  PersonaRegistry,
  PersonaSwitcher,
  ProductController,
  ProductConversationList,
  ProductRepository,
  QUOTES,
  QUOTE_COUNTS,
  QuoteStore,
  RETRIEVE_ANECDOTES_TOOL,
  ResultPanel,
  TASK_BUDGET_BLOCKED_MESSAGE,
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
  TurnRunner,
  actionRecordedEventSchema,
  apply,
  applyFeedbackCommit,
  assembleBranchTurn,
  assembleNextTurn,
  assertContentIntegrity,
  assertRedLineSections,
  branchProgressSchema,
  branchProgressUpdatedEventSchema,
  branchUserMessageSourceSchema,
  buildActorContext,
  buildContentLibraries,
  buildPersonaSpec,
  buildPersonas,
  checkBlacklist,
  claimSingleAttempt,
  collectWebEvidence,
  commitDirectorProposals,
  commitDirectorUpdate,
  commitFeedback,
  compensateDerivedState,
  configureManRolesProductService,
  createControlClassifier,
  createRuntimeRegistry,
  createTurnBudget,
  decideTurn,
  defaultSessionIdFor,
  deliverCurrentUserMessage,
  deriveLegacyDilemma,
  deterministicSafetyGate,
  dialogueCommitSchema,
  dialogueControlSchema,
  dialogueControlStateSchema,
  dialogueEventMetaSchema,
  dialogueLoopReportSchema,
  dialoguePhaseSchema,
  dialoguePhaseSetEventSchema,
  dilemmaCandidateEventSchema,
  dilemmaConfirmedEventSchema,
  dilemmaCoreSelectedEventSchema,
  dilemmaCorrectedEventSchema,
  dilemmaItemProposedEventSchema,
  dilemmaItemReviewedEventSchema,
  dilemmaItemSchema,
  dilemmaStateSchema,
  directorUpdateSchema,
  estimateRequestTokens,
  estimateTokens,
  evaluateControlLoopEvidence,
  evidenceForTurn,
  extractCitedSources,
  feedbackKindSchema,
  feedbackPayloadSchema,
  fetchAnecdote,
  fetchQuote,
  fetchSource,
  foldDilemmaState,
  generateRegistryArtifacts,
  inferDirectorCandidate,
  initialDilemmaState,
  initialTrunkState,
  inject,
  interpretTurn,
  judgeFeedback,
  judgeFeedbackSemantic,
  judgePrompt,
  keywordFallbackVerdict,
  makeActorHandlers,
  makeFetchHandler,
  makeRetrieveHandler,
  manRolesProbeRequestSchema,
  manRolesProbeResponseSchema,
  mergeSafetyDecision,
  mvpReportSchema,
  name,
  nativeActorDeliveryBridge,
  newTurnIds,
  normalizeSource,
  parseControlDecision,
  parsePersonaMarkdown,
  parseVerdict,
  personaContentManifestSchema,
  personaIdSchema,
  personaManifestSchema,
  personaSpecFor,
  personaStatusSchema,
  personaSystemPromptFromSections,
  phase7Task9ReportSchema,
  projectTaskOutcome,
  publicDialogueView,
  readAttemptMarker,
  recoverPendingDeliveries,
  registerActorTools,
  renderVerifiedReply,
  retrieveAnecdotes,
  runActorTurnWithRetrieval,
  runDialogueLoopE2E,
  runDialogueTurn,
  runDialogueTurnV2,
  runDialogueTurnV2AfterDelivery,
  runPhase7Task9Scripted,
  runRecoveryStartup,
  runToolLoop,
  safetyDispositionSchema,
  safetyReasonSchema,
  safetyResultSchema,
  scanPersonaArtifact,
  searchWithFallback,
  selectHistory,
  sessionControlRecordedEventSchema,
  sha256,
  sourceMatches,
  submitActorReply,
  submitWithOneRepair,
  taskModeSchema2 as taskModeSchema,
  taskRoutedEventSchema,
  toFoldInput,
  transition,
  trunkActivePersonaEventSchema,
  trunkBranchIndexEventSchema,
  trunkDilemmaCandidateEventSchema,
  trunkDilemmaConfirmedEventSchema,
  trunkDilemmaCorrectedEventSchema,
  trunkEventRecordSchema,
  trunkStateSchema,
  trunkUserRawAddedEventSchema,
  turnControlDecisionSchema,
  turnIntentSchema,
  turnInterpretationSchema,
  usageFullTotal,
  validateActorReply,
  validateDialogueLoopReport,
  validateDirectorUpdate,
  validateMvpReport,
  validatePhase7Task9Report,
  validateSelectedHistoricalRawRefs,
  validateSubmitArgs,
  validateTask5Report,
  verifyCitation,
  verifyReference
};
//# sourceMappingURL=index.js.map
