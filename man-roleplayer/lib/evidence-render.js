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
export {
  renderVerifiedReply
};
//# sourceMappingURL=evidence-render.js.map
