// src/dialogue/director-update.ts
import { createHash } from "node:crypto";
import { z as z3 } from "zod";

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

// src/dialogue/director-update.ts
var proposalSchema = z3.object({ id: z3.string().min(1).optional(), kind: z3.enum(["fact", "inference", "goal", "value-conflict", "core-conflict"]), text: z3.string().min(1), sourceRawRefs: z3.array(z3.string().min(1)).min(1), proposedByPersona: personaIdSchema2 }).strict();
var directorUpdateSchema = z3.object({ propose: z3.array(proposalSchema), coreCandidateId: z3.string().min(1).optional() }).strict();
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
var commitDirectorProposals = commitDirectorUpdate;
export {
  commitDirectorProposals,
  commitDirectorUpdate,
  directorUpdateSchema,
  validateDirectorUpdate
};
//# sourceMappingURL=dialogue-director.js.map
