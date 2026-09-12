// src/dialogue/public-contract.ts
var TURN_INTENTS = ["answer", "clarify", "await-confirmation", "reflect", "offer-controls", "pause", "close"];
var DIALOGUE_CONTROLS = ["confirm", "partial-confirm", "correct", "skip", "continue", "pause", "end", "switch-persona", "new-dilemma"];
function isTurnIntent(value) {
  return typeof value === "string" && TURN_INTENTS.includes(value);
}
function isDialogueControl(value) {
  return typeof value === "string" && DIALOGUE_CONTROLS.includes(value);
}

// src/runtime/actor-reply-projection.ts
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function callIdFromSource(source) {
  if (!isRecord(source) || typeof source.callId !== "string") return void 0;
  return source.callId;
}
function toolCallIdFromContent(content) {
  if (!Array.isArray(content)) return void 0;
  const first = content[0];
  return isRecord(first) && typeof first.toolCallId === "string" ? first.toolCallId : void 0;
}
function isProjectedEvidence(value) {
  if (!isRecord(value) || typeof value.id !== "string" || value.kind !== "quote" && value.kind !== "anecdote" || typeof value.source !== "string") return false;
  return (value.credibility === void 0 || typeof value.credibility === "string") && (value.title === void 0 || typeof value.title === "string");
}
function isProjectedEvidenceArray(value) {
  return Array.isArray(value) && value.every(isProjectedEvidence);
}
function isPublicMeta(value) {
  return (value.turnIntent === void 0 || isTurnIntent(value.turnIntent)) && (value.questions === void 0 || Array.isArray(value.questions) && value.questions.every((q) => typeof q === "string")) && (value.controls === void 0 || Array.isArray(value.controls) && value.controls.every(isDialogueControl));
}
function parseActorReplyMeta(value) {
  if (!isRecord(value) || value.kind !== "actor-reply" || typeof value.reply !== "string" || !isProjectedEvidenceArray(value.evidence) || !isPublicMeta(value)) return void 0;
  return { kind: "actor-reply", reply: value.reply, evidence: value.evidence, ...typeof value.turnIntent === "string" ? { turnIntent: value.turnIntent } : {}, ...Array.isArray(value.questions) ? { questions: value.questions } : {}, ...Array.isArray(value.controls) ? { controls: value.controls } : {}, ...value.fallback === true ? { fallback: true } : {} };
}
function projectActorReply(events, turn) {
  const calls = /* @__PURE__ */ new Set();
  let result;
  let active;
  for (const event of events) {
    const data = event.data;
    if (!isRecord(data)) continue;
    const turnValue = data.turn;
    if (event.type === "turn/start" && typeof turnValue === "number") active = turnValue;
    if (event.type === "turn/end" && turnValue === active) {
      active = void 0;
      continue;
    }
    if (active !== turn) continue;
    if (event.type === "tool/call" && data.name === "submit_actor_reply" && typeof data.callId === "string") calls.add(data.callId);
    if (event.type === "tool/result") {
      const message = isRecord(data.message) ? data.message : void 0;
      const callId = callIdFromSource(message?.source) ?? toolCallIdFromContent(data.content);
      if (!callId || !calls.has(callId)) continue;
      const parsed = parseActorReplyMeta(data.meta);
      if (!parsed) continue;
      if (result) return void 0;
      result = parsed;
    }
  }
  return result;
}
export {
  parseActorReplyMeta,
  projectActorReply
};
//# sourceMappingURL=actor-reply-projection.js.map
