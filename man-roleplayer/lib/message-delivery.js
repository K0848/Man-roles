// src/branch/message-source.ts
import { z as z2 } from "zod";

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

// src/branch/message-source.ts
var branchUserMessageSourceSchema = z2.object({
  conversation_id: z2.string().min(1),
  message_id: z2.string().min(1),
  raw_ref: z2.string().min(1),
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
export {
  deliverCurrentUserMessage
};
//# sourceMappingURL=message-delivery.js.map
