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
export {
  submitActorReply,
  submitWithOneRepair
};
//# sourceMappingURL=submit-actor-reply.js.map
