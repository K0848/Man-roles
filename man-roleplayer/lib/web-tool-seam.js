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
export {
  runWebSearchSeam
};
//# sourceMappingURL=web-tool-seam.js.map
