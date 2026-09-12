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
import { createHash } from "node:crypto";
import { z as z6 } from "zod";

// src/domain/schema.ts
import { z as z4 } from "zod";
var taskModeSchema2 = z4.enum(["knowledge", "dilemma", "review"]);
var personaIdSchema = z4.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "PersonaId must be kebab-case");
var dilemmaItemSchema = z4.object({ id: z4.string().min(1), kind: z4.enum(["fact", "inference", "goal", "value-conflict", "core-conflict"]), text: z4.string(), status: z4.enum(["candidate", "confirmed", "rejected", "superseded"]), sourceRawRefs: z4.array(z4.string().min(1)).min(1), proposedByPersona: personaIdSchema, visibility: z4.enum(["origin-persona-only", "shared-confirmed"]), revision: z4.number().int().positive(), supersedes: z4.string().min(1).optional(), supersededBy: z4.string().min(1).optional() }).strict();
var dialogueControlStateSchema = z4.object({ taskMode: z4.enum(["knowledge", "dilemma", "review"]), phase: z4.enum(["responding", "clarifying", "awaiting-confirmation", "reflecting", "action-defined", "paused", "closed"]), noProgressCount: z4.number().int().nonnegative(), lastControlSeq: z4.number().int(), selectedAction: z4.string().optional() }).strict();
var branchProgressSchema = z4.object({ personaId: personaIdSchema, summary: z4.string().nullable(), lastSemanticSeq: z4.number().int() }).strict();
var dialogueEventMetaSchema = z4.object({
  messageId: z4.string().min(1),
  taskId: z4.string().min(1),
  eventPurpose: z4.string().min(1),
  sourceRawRefs: z4.array(z4.string().min(1)).min(1)
}).strict();
var taskRoutedEventSchema = dialogueEventMetaSchema.extend({ taskMode: taskModeSchema2, confidence: z4.enum(["high", "low"]) }).strict();
var dialoguePhaseSetEventSchema = dialogueEventMetaSchema.extend({ control: dialogueControlStateSchema }).strict();
var dilemmaItemProposedEventSchema = dialogueEventMetaSchema.extend({ item: dilemmaItemSchema, personaId: personaIdSchema }).strict();
var dilemmaItemReviewedEventSchema = dialogueEventMetaSchema.extend({ itemId: z4.string().min(1), action: z4.enum(["confirm", "partial-confirm", "correct", "reject", "skip"]), replacement: dilemmaItemSchema.optional(), personaId: personaIdSchema }).strict();
var dilemmaCoreSelectedEventSchema = dialogueEventMetaSchema.extend({ itemId: z4.string().min(1) }).strict();
var branchProgressUpdatedEventSchema = dialogueEventMetaSchema.extend({ progress: branchProgressSchema }).strict();
var actionRecordedEventSchema = dialogueEventMetaSchema.extend({ action: z4.string().min(1), details: z4.record(z4.string(), z4.unknown()).default({}) }).strict();
var sessionControlRecordedEventSchema = dialogueEventMetaSchema.extend({ control: z4.enum(["pause", "resume", "end", "switch"]), personaId: personaIdSchema.optional() }).strict();
var dialogueCommitSchema = z4.object({ payloadHash: z4.string().min(1) }).strict();
var legacyPersonaIdRawSchema = z4.string().min(1);
var dilemmaPhaseSchema = z4.enum(["pending", "candidate", "confirmed", "corrected"]);
var dilemmaStateSchema = z4.object({
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
var dilemmaEventHeaderSchema = z4.object({
  turnId: z4.string(),
  taskId: z4.string(),
  invocationId: z4.string()
});
var dilemmaCandidateEventSchema = dilemmaEventHeaderSchema.extend({
  persona: personaIdSchema,
  text: z4.string()
});
var dilemmaConfirmedEventSchema = dilemmaEventHeaderSchema.extend({
  text: z4.string()
});
var dilemmaCorrectedEventSchema = dilemmaEventHeaderSchema.extend({
  text: z4.string()
});
var trunkEventRecordSchema = z4.object({
  type: z4.string(),
  seq: z4.number(),
  time: z4.string(),
  data: z4.unknown()
});
var trunkCreatedEventSchema = z4.object({
  conversationId: z4.string()
});
var trunkUserRawAddedEventSchema = z4.object({
  ref: z4.number(),
  text: z4.string(),
  // 6.2: 客户端身份与稳定投递指针。旧 JSONL 无此字段时由 replay 补齐。
  message_id: z4.string().min(1).optional(),
  raw_ref: z4.string().min(1).optional(),
  // 6.2 Task4: first acceptance fixes the delivery target. Legacy records omit it.
  target_persona_id: personaIdSchema.optional()
});
var trunkDilemmaCandidateEventSchema = z4.object({
  persona: personaIdSchema,
  text: z4.string()
});
var trunkDilemmaConfirmedEventSchema = z4.object({
  text: z4.string()
});
var trunkDilemmaCorrectedEventSchema = z4.object({
  text: z4.string()
});
var trunkActivePersonaEventSchema = z4.object({
  persona: personaIdSchema
});
var trunkBranchIndexEventSchema = z4.object({
  persona: personaIdSchema,
  sessionId: z4.string()
});
var trunkUserRawSchema = z4.object({
  ref: z4.number(),
  text: z4.string(),
  messageId: z4.string().min(1),
  rawRef: z4.string().min(1),
  targetPersonaId: personaIdSchema.optional()
});
var taskOutcomeSchema = z4.object({ taskId: z4.string().min(1), personaId: personaIdSchema, branchSessionId: z4.string().min(1), branchTurn: z4.number().int().positive(), status: z4.literal("blocked"), reason: z4.literal("budget_exceeded"), retryable: z4.literal(true) });
var trunkBranchDeliveryCommittedEventSchema = z4.object({
  conversation_id: z4.string().min(1),
  persona_id: personaIdSchema,
  raw_ref: z4.string().min(1),
  message_id: z4.string().min(1),
  session_id: z4.string().min(1)
});
var trunkStateSchema = z4.object({
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
function interpretTurn(raw) {
  const text = raw.trim();
  const knowledge = /知行|思想|原话|事迹|何谓|怎么理解/.test(text);
  const emotion = /害怕|担心|焦虑|难过|不安|痛苦|犹豫/.test(text);
  const control = /暂停|先到这里/.test(text) ? "pause" : /结束|再见/.test(text) ? "end" : "none";
  return { responseNeeds: { answerKnowledge: knowledge, acknowledgeEmotion: emotion, clarify: !knowledge || emotion, proposeCandidate: (emotion || !knowledge) && text.length > 8 }, safetyEscalation: "none", feedback: control };
}

// src/context/select-history.ts
var estimate = (s) => Math.max(1, Math.ceil(s.length / 2));
function selectHistory(input) {
  const required = /* @__PURE__ */ new Set([input.currentRaw.rawRef, ...input.confirmedRawRefs ?? []]);
  const pool = [...input.candidates, ...input.branchHistory ?? []].filter((x, i, a) => a.findIndex((y) => y.rawRef === x.rawRef) === i);
  const ordered = pool.sort((a, b) => (required.has(b.rawRef) ? 1 : 0) - (required.has(a.rawRef) ? 1 : 0) || (b.priority ?? 0) - (a.priority ?? 0));
  const selected = [];
  const dropped = [];
  let used = 0;
  for (const item of [input.currentRaw, ...ordered]) {
    if (selected.some((x) => x.rawRef === item.rawRef)) continue;
    const cost = estimate(item.text);
    const must = item.rawRef === input.currentRaw.rawRef || required.has(item.rawRef);
    if (must || used + cost <= input.budgetTokens) {
      selected.push(item);
      used += cost;
    } else dropped.push({ rawRef: item.rawRef, reason: "budget" });
  }
  return { selected, selectedRawRefs: selected.map((x) => x.rawRef), dropped, estimatedTokens: used };
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
  const hasCandidate = deps.trunk.state.dilemmaItems.some((item) => item.status === "candidate" && item.proposedByPersona === personaId && !item.supersededBy);
  let candidates = deps.trunk.state.dilemmaItems.filter((item) => item.status === "candidate" && item.proposedByPersona === personaId && !item.supersededBy).map((item) => ({ ...item, unconfirmed: true }));
  if (interpretation.responseNeeds.proposeCandidate && !hasCandidate) {
    calls.director++;
    try {
      const update = await deps.director({ raw: current.text, personaId, currentRawRef: delivery.rawRef });
      if (update !== void 0) commitDirectorUpdate({ update, state: deps.trunk.state, personaId, trunk: deps.trunk, messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurposePrefix}:director`, sourceRawRefs: [delivery.rawRef] });
    } catch {
    }
    candidates = deps.trunk.state.dilemmaItems.filter((item) => item.status === "candidate" && item.proposedByPersona === personaId && !item.supersededBy).map((item) => ({ ...item, unconfirmed: true }));
  }
  const sessionId = deps.trunk.state.branchesIndex[personaId];
  if (!sessionId) return { ...fail("branch-session-missing", personaId, calls), interpretation, delivery };
  const history = await deps.loadCurrentBranchHistory({ personaId, sessionId });
  const historyItems = history.map((text, index) => ({ rawRef: `branch-${personaId}-${index}`, text, personaId }));
  const selected = selectHistory({ currentRaw: current, candidates: deps.trunk.state.userRaws, confirmedRawRefs: deps.trunk.state.dilemmaItems.filter((item) => item.status === "confirmed").flatMap((item) => item.sourceRawRefs), budgetTokens: deps.contextBudgetTokens ?? 4e3, personaId, branchHistory: historyItems });
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
export {
  commitFeedback,
  feedbackPayloadSchema,
  runDialogueTurn,
  runDialogueTurnV2,
  runDialogueTurnV2AfterDelivery
};
//# sourceMappingURL=dialogue-coordinator.js.map
