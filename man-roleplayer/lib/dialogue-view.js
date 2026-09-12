// src/dialogue/public-view.ts
function canonical(id, registry) {
  return registry.get(id).id;
}
function validateSelectedHistoricalRawRefs(state, refs) {
  const unique = [...new Set(refs)];
  if (unique.some((ref) => !state.userRaws.some((raw) => raw.rawRef === ref))) throw new Error("historical raw ref missing");
  return unique.sort((a, b) => {
    const ar = state.userRaws.find((raw) => raw.rawRef === a)?.ref ?? Number.MAX_SAFE_INTEGER;
    const br = state.userRaws.find((raw) => raw.rawRef === b)?.ref ?? Number.MAX_SAFE_INTEGER;
    return ar - br || a.localeCompare(b);
  });
}
function buildActorContext(state, persona, registry, currentRawRef, selectedHistoricalRawRefs = [], currentBranchHistory = []) {
  const personaId = canonical(persona, registry);
  const definition = registry.get(personaId);
  if (!currentRawRef) throw new Error("currentRawRef is required");
  const current = state.userRaws.find((r) => r.rawRef === currentRawRef);
  if (!current) throw new Error(`current raw ref missing: ${currentRawRef}`);
  const refs = validateSelectedHistoricalRawRefs(state, selectedHistoricalRawRefs);
  const raws = refs.map((ref) => {
    const raw = state.userRaws.find((r) => r.rawRef === ref);
    if (!raw) throw new Error(`historical raw ref missing: ${ref}`);
    return raw;
  });
  return { personaId, currentRaw: current.text, currentRawRef, selectedHistoricalRawRefs: refs, raw: current.text, historicalRaws: raws.map((r) => r.text), currentBranchHistory, persona: { id: definition.id, displayName: definition.displayName, status: definition.status, prompt: definition.prompt }, confirmedItems: state.dilemmaItems.filter((x) => x.status === "confirmed" && x.visibility === "shared-confirmed" && !x.supersededBy), candidateItems: state.dilemmaItems.filter((x) => x.status === "candidate" && x.visibility === "origin-persona-only" && x.proposedByPersona === personaId && !x.supersededBy).map((x) => ({ ...x, unconfirmed: true })), branchProgress: state.branchProgress[personaId] ?? null };
}
function publicDialogueView(state, persona, registry) {
  const id = canonical(persona, registry);
  const branches = {};
  for (const key of Object.keys(state.branchesIndex)) branches[key] = { progress: state.branchProgress[key] ?? null };
  return { dilemmaItems: state.dilemmaItems.filter((x) => x.status === "confirmed" && x.visibility === "shared-confirmed" && !x.supersededBy || x.status === "candidate" && x.proposedByPersona === id && !x.supersededBy), branchProgress: state.branchProgress[id] ?? null, dialogue: state.dialogue, branches };
}
export {
  buildActorContext,
  publicDialogueView,
  validateSelectedHistoricalRawRefs
};
//# sourceMappingURL=dialogue-view.js.map
