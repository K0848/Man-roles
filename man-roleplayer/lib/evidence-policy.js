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
export {
  validateActorReply
};
//# sourceMappingURL=evidence-policy.js.map
