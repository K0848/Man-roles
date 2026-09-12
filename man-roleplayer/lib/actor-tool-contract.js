// src/runtime/actor-tool-contract.ts
import { z as z2 } from "zod";

// src/dialogue/types.ts
import { z } from "zod";

// src/dialogue/public-contract.ts
var TURN_INTENTS = ["answer", "clarify", "await-confirmation", "reflect", "offer-controls", "pause", "close"];
var DIALOGUE_CONTROLS = ["confirm", "partial-confirm", "correct", "skip", "continue", "pause", "end", "switch-persona", "new-dilemma"];

// src/dialogue/types.ts
var taskModeSchema = z.enum(["knowledge", "dilemma", "review"]);
var safetyDispositionSchema = z.enum(["allow", "professional-boundary", "urgent-help", "refuse"]);
var safetyReasonSchema = z.enum(["none", "medical", "mental-health", "legal", "financial", "self-harm", "imminent-danger", "sexual", "illegal-assistance"]);
var dialoguePhaseSchema = z.enum(["responding", "clarifying", "awaiting-confirmation", "reflecting", "action-defined", "paused", "closed"]);
var feedbackKindSchema = z.enum(["none", "confirm", "partial-confirm", "correct", "reject", "new-information", "reality-changed", "disagree-persona", "not-helpful", "question-evidence", "action-feedback", "skip", "continue", "pause", "end", "unclear"]);
var turnIntentSchema = z.enum(TURN_INTENTS);
var dialogueControlSchema = z.enum(DIALOGUE_CONTROLS);
var turnControlDecisionSchema = z.object({
  safety: safetyDispositionSchema,
  safetyReason: safetyReasonSchema,
  taskMode: taskModeSchema,
  confidence: z.enum(["high", "low"]),
  emotionPriority: z.boolean(),
  feedbackKind: feedbackKindSchema,
  independentNewDilemma: z.boolean()
}).strict();

// src/runtime/actor-tool-contract.ts
var FINAL_ACTOR_TOOL_NAMES = ["retrieve_anecdotes", "fetch_anecdote", "retrieve_quotes", "fetch_quote", "web_search", "submit_actor_reply"];
var segmentSchema = z2.object({ kind: z2.enum(["dialogue", "historical_fact", "verbatim_quote", "thought_attribution", "modern_inference", "modern_external_fact"]), text: z2.string().trim().min(1), evidenceIds: z2.array(z2.string().min(1)).optional() }).strict().superRefine((s, ctx) => {
  if (["historical_fact", "verbatim_quote", "thought_attribution", "modern_external_fact"].includes(s.kind) && (!s.evidenceIds || s.evidenceIds.length === 0)) ctx.addIssue({ code: z2.ZodIssueCode.custom, message: "evidence required" });
});
var submitArgsSchema = z2.object({ segments: z2.array(segmentSchema).min(1), turnIntent: turnIntentSchema.optional(), questions: z2.array(z2.string().trim().min(1)).refine((x) => new Set(x).size === x.length, "duplicate questions").optional(), offeredControls: z2.array(dialogueControlSchema).max(9).refine((x) => new Set(x).size === x.length, "duplicate controls").optional() }).strict();
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
export {
  FINAL_ACTOR_TOOL_NAMES,
  missingEvidenceDetails,
  submitArgsSchema,
  validateSubmitArgs,
  validateSubmitArgsDetailed
};
//# sourceMappingURL=actor-tool-contract.js.map
