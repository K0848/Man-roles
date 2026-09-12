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
import { z as z2 } from "zod";

// src/dialogue/types.ts
import { z } from "zod";

// src/dialogue/public-contract.ts
var TURN_INTENTS = ["answer", "clarify", "await-confirmation", "reflect", "offer-controls", "pause", "close"];
var DIALOGUE_CONTROLS = ["confirm", "partial-confirm", "correct", "skip", "continue", "pause", "end", "switch-persona", "new-dilemma"];
function isDialogueControl(value) {
  return typeof value === "string" && DIALOGUE_CONTROLS.includes(value);
}

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
function registerActorTools(agentCtx, libs, personaId, registry, exposedToolNames, webSearch) {
  const state = (exec) => registry.stateForExecution(exec, personaId);
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
export {
  FINAL_ACTOR_TOOL_NAMES,
  registerActorTools,
  sanitizeSubmitDiagnostics
};
//# sourceMappingURL=actor-tools.js.map
