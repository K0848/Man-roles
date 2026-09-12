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

// src/domain/dilemma.ts
function deriveLegacyDilemma(items) {
  const active = [...items].filter((item) => item.status !== "superseded").sort((a, b) => b.revision - a.revision);
  const confirmed = active.find((item) => item.status === "confirmed" && item.visibility === "shared-confirmed");
  if (confirmed) return { phase: "confirmed", candidateText: null, confirmedText: confirmed.text };
  const candidate = active.find((item) => item.status === "candidate" && item.visibility === "origin-persona-only");
  if (candidate) return { phase: "candidate", candidateText: candidate.text, confirmedText: null };
  return { phase: "pending", candidateText: null, confirmedText: null };
}
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
function foldDilemmaState(events, persona) {
  let state = initialDilemmaState(persona);
  for (const event of events) state = transition(state, event);
  return state;
}
var CONFIRM_MARKERS = ["\u5BF9", "\u662F\u7684", "\u6CA1\u9519", "\u5C31\u662F\u8FD9\u6837", "\u6B63\u662F", "\u5BF9\uFF0C\u6211\u56F0\u60D1", "\u540C\u610F", "\u786E\u8BA4"];
var CORRECT_MARKERS = ["\u4E0D\u5BF9", "\u4E0D\u662F", "\u7EA0\u6B63", "\u5176\u5B9E\u662F", "\u6211\u60F3\u8BF4\u7684\u662F", "\u4E0D\u5B8C\u5168\u662F", "\u6539\u4E00\u4E0B", "\u91CD\u65B0\u8BF4"];
function judgeFeedback(feedback) {
  if (CORRECT_MARKERS.some((m) => feedback.includes(m))) return "corrected";
  if (CONFIRM_MARKERS.some((m) => feedback.includes(m))) return "confirmed";
  return "unconfirmed";
}
export {
  deriveLegacyDilemma,
  foldDilemmaState,
  judgeFeedback,
  transition
};
//# sourceMappingURL=domain.js.map
