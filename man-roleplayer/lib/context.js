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

// src/context/assemble.ts
var CONTEXT_TOKEN_LIMIT = 4e3;
function estimateTokens(text) {
  const compact = text.replace(/\s+/g, "");
  const cjk = compact.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const rest = compact.length - cjk;
  return cjk + Math.ceil(rest / 4);
}
function assembleBranchTurn(input) {
  const messages = [];
  messages.push({ role: "system", content: input.persona.systemPrompt });
  const dilemma = input.sharedLayer.dilemma;
  if (dilemma.phase === "confirmed" && dilemma.confirmedText !== null) {
    messages.push({
      role: "user",
      content: `\u3010\u5DF2\u786E\u8BA4\u7684\u56F0\u60D1\u3011${dilemma.confirmedText}\uFF08\u8FD9\u662F\u7528\u6237\u5DF2\u7ECF\u786E\u8BA4\u7684\u7406\u89E3\uFF0C\u56DE\u7B54\u65F6\u5E94\u4EE5\u6B64\u4E3A\u524D\u63D0\uFF09`
    });
  } else if (dilemma.phase === "corrected" && dilemma.correctedText !== null) {
    messages.push({
      role: "user",
      content: `\u3010\u7528\u6237\u7EA0\u6B63\u540E\u7684\u56F0\u60D1\u3011${dilemma.correctedText}\uFF08\u4EE5\u6B64\u4E3A\u51C6\uFF0C\u5FFD\u7565\u6B64\u524D\u63A8\u65AD\uFF09`
    });
  }
  const raws = input.historyBudgetTokens === void 0 ? input.sharedLayer.userRaws : selectHistory({ currentRaw: input.sharedLayer.userRaws.at(-1), candidates: input.sharedLayer.userRaws, confirmedRawRefs: dilemma.phase === "confirmed" ? input.sharedLayer.userRaws.map((x) => x.rawRef) : [], personaId: input.persona.id, budgetTokens: input.historyBudgetTokens }).selected;
  for (const raw of raws) {
    messages.push({ role: "user", content: raw.text });
  }
  const history = input.branchHistory.slice(-(input.maxHistoryTurns ?? 4));
  for (const h of history) {
    messages.push({ role: h.role, content: h.content });
  }
  const used = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  const ratio = used / CONTEXT_TOKEN_LIMIT;
  return { messages, tokenEstimate: used, budget: { used, limit: CONTEXT_TOKEN_LIMIT, ratio } };
}
function assembleNextTurn(input) {
  const history = input.lastReply === "" ? [] : [{ role: "assistant", content: input.lastReply }];
  return assembleBranchTurn({
    persona: input.persona,
    sharedLayer: {
      userRaws: [{ ref: 0, text: input.userRaw, messageId: "fixture-message-0", rawRef: "fixture-raw-0" }],
      dilemma: input.dilemma
    },
    branchHistory: history,
    maxHistoryTurns: 1
  });
}
export {
  CONTEXT_TOKEN_LIMIT,
  assembleBranchTurn,
  assembleNextTurn,
  estimateTokens
};
//# sourceMappingURL=context.js.map
