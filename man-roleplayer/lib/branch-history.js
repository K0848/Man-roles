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
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function branchUserMessageSourceFromData(value) {
  if (!isRecord(value)) return void 0;
  const extra = isRecord(value.extra) ? value.extra[BRANCH_USER_MESSAGE_EXTRA_KEY] : void 0;
  return extra ?? value.source;
}
function branchUserMessageFromData(value) {
  if (!isRecord(value)) return void 0;
  return isRecord(value.message) ? value.message : value;
}

// src/dialogue/public-contract.ts
var TURN_INTENTS = ["answer", "clarify", "await-confirmation", "reflect", "offer-controls", "pause", "close"];
var DIALOGUE_CONTROLS = ["confirm", "partial-confirm", "correct", "skip", "continue", "pause", "end", "switch-persona", "new-dilemma"];
function isTurnIntent(value) {
  return typeof value === "string" && TURN_INTENTS.includes(value);
}
function isDialogueControl(value) {
  return typeof value === "string" && DIALOGUE_CONTROLS.includes(value);
}

// src/runtime/actor-reply-projection.ts
function isRecord2(value) {
  return typeof value === "object" && value !== null;
}
function callIdFromSource(source) {
  if (!isRecord2(source) || typeof source.callId !== "string") return void 0;
  return source.callId;
}
function toolCallIdFromContent(content) {
  if (!Array.isArray(content)) return void 0;
  const first = content[0];
  return isRecord2(first) && typeof first.toolCallId === "string" ? first.toolCallId : void 0;
}
function isProjectedEvidence(value) {
  if (!isRecord2(value) || typeof value.id !== "string" || value.kind !== "quote" && value.kind !== "anecdote" || typeof value.source !== "string") return false;
  return (value.credibility === void 0 || typeof value.credibility === "string") && (value.title === void 0 || typeof value.title === "string");
}
function isProjectedEvidenceArray(value) {
  return Array.isArray(value) && value.every(isProjectedEvidence);
}
function isPublicMeta(value) {
  return (value.turnIntent === void 0 || isTurnIntent(value.turnIntent)) && (value.questions === void 0 || Array.isArray(value.questions) && value.questions.every((q) => typeof q === "string")) && (value.controls === void 0 || Array.isArray(value.controls) && value.controls.every(isDialogueControl));
}
function parseActorReplyMeta(value) {
  if (!isRecord2(value) || value.kind !== "actor-reply" || typeof value.reply !== "string" || !isProjectedEvidenceArray(value.evidence) || !isPublicMeta(value)) return void 0;
  return { kind: "actor-reply", reply: value.reply, evidence: value.evidence, ...typeof value.turnIntent === "string" ? { turnIntent: value.turnIntent } : {}, ...Array.isArray(value.questions) ? { questions: value.questions } : {}, ...Array.isArray(value.controls) ? { controls: value.controls } : {}, ...value.fallback === true ? { fallback: true } : {} };
}
function projectActorReply(events, turn) {
  const calls = /* @__PURE__ */ new Set();
  let result;
  let active;
  for (const event of events) {
    const data = event.data;
    if (!isRecord2(data)) continue;
    const turnValue = data.turn;
    if (event.type === "turn/start" && typeof turnValue === "number") active = turnValue;
    if (event.type === "turn/end" && turnValue === active) {
      active = void 0;
      continue;
    }
    if (active !== turn) continue;
    if (event.type === "tool/call" && data.name === "submit_actor_reply" && typeof data.callId === "string") calls.add(data.callId);
    if (event.type === "tool/result") {
      const message = isRecord2(data.message) ? data.message : void 0;
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

// src/product/branch-history.ts
function isRecord3(value) {
  return typeof value === "object" && value !== null;
}
function userText(data) {
  const message = branchUserMessageFromData(data);
  if (!message || !Array.isArray(message.content)) return void 0;
  const text = message.content.filter((block) => isRecord3(block) && block.type === "text" && typeof block.text === "string").map((block) => String(block.text)).join("");
  return text || void 0;
}
function userMessageId(data) {
  const message = branchUserMessageFromData(data);
  if (!message) return void 0;
  if (typeof message.id === "string") return message.id;
  const source = branchUserMessageSourceFromData(message);
  return isRecord3(source) && typeof source.message_id === "string" ? source.message_id : void 0;
}
function branchHistory(events) {
  const lines = [];
  let activeTurn;
  for (const event of events) {
    if (event.type === "turn/start" && isRecord3(event.data) && typeof event.data.turn === "number") {
      activeTurn = event.data.turn;
      continue;
    }
    if (event.type === "user/message") {
      const text = userText(event.data);
      if (text) lines.push(text);
    }
    if (event.type === "turn/end" && activeTurn !== void 0) {
      const reply = projectActorReply(events, activeTurn);
      if (reply) lines.push(reply.reply);
      activeTurn = void 0;
    }
  }
  return lines;
}
function verifiedReplyForMessage(events, messageId) {
  let activeTurn;
  let targetTurn;
  for (const event of events) {
    if (event.type === "turn/start" && isRecord3(event.data) && typeof event.data.turn === "number") activeTurn = event.data.turn;
    if (event.type === "user/message" && userMessageId(event.data) === messageId) targetTurn = activeTurn;
    if (event.type === "turn/end" && activeTurn !== void 0) activeTurn = void 0;
  }
  return targetTurn === void 0 ? void 0 : projectActorReply(events, targetTurn);
}
export {
  branchHistory,
  verifiedReplyForMessage
};
//# sourceMappingURL=branch-history.js.map
