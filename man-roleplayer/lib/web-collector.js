// src/evidence/web-collector.ts
function collectWebEvidence(input) {
  return input.results.filter((x) => /^https?:\/\//i.test(x.url)).map((x, i) => ({ id: `web-${input.turnId}-${i}`, url: x.url, title: x.title ?? "", snippet: x.snippet ?? "", personaId: input.personaId, turnId: input.turnId }));
}
function evidenceForTurn(evidence, personaId, turnId) {
  return evidence.filter((x) => x.personaId === personaId && x.turnId === turnId);
}
async function searchWithFallback(search, timeoutMs = 5e3) {
  try {
    const value = await Promise.race([search(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs))]);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, reason: error instanceof Error && error.message === "timeout" ? "timeout" : "unavailable" };
  }
}
export {
  collectWebEvidence,
  evidenceForTurn,
  searchWithFallback
};
//# sourceMappingURL=web-collector.js.map
