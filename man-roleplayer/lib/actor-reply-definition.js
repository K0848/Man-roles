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

// src/client/actor-reply-definition.ts
function eventData(event) {
  return event.data;
}
function matchReply(event) {
  if (event.type !== "tool/result" || event.surfaceOp !== "append") return null;
  const meta = parseActorReplyMeta(eventData(event)?.meta);
  const callId = eventData(event)?.message?.source?.callId;
  return meta && typeof callId === "string" ? { meta, callId } : null;
}
var actorReplyConversationNodeDefinition = {
  kind: "man-roles-actor-reply",
  target: "chat",
  match: (event) => {
    const data = eventData(event);
    if (event.type === "tool/call" && data?.name === "submit_actor_reply" && typeof data.callId === "string") {
      return { id: data.callId, role: "start" };
    }
    const matched = matchReply(event);
    return matched ? { id: matched.callId, role: "update" } : null;
  },
  start: (_context, match) => {
    const data = eventData(match.event);
    if (match.event.type !== "tool/call" || data?.name !== "submit_actor_reply" || typeof data.callId !== "string") {
      throw new Error("actor reply node start requires submit_actor_reply tool/call");
    }
    return { turn: data.turn, step: data.step, callId: data.callId, callSeq: match.event.seq };
  },
  update: (context, match) => {
    const matched = matchReply(match.event);
    return matched ? { ...context.state, result: matched.meta, resultSeq: match.event.seq } : context.state;
  },
  publication: () => "immediate",
  buildViewNode: (context) => context.state?.result === void 0 ? null : {
    key: context.key,
    kind: "man-roles-actor-reply",
    id: context.id,
    target: "chat",
    anchorSeq: context.state.resultSeq ?? context.state.callSeq,
    location: context.start?.location ?? { kind: "unresolved" },
    visibility: "visible",
    data: context.state.result
  }
};
export {
  actorReplyConversationNodeDefinition
};
//# sourceMappingURL=actor-reply-definition.js.map
