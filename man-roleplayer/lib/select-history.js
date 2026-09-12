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
export {
  selectHistory
};
//# sourceMappingURL=select-history.js.map
