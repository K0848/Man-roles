// src/client/actor-reply-node.ts
import { isAppendSurfaceEvent } from "@deepseek-ai/dsh-client-runtime/client";
import { createElement } from "react";

// src/dialogue/types.ts
import { z } from "zod";
var taskModeSchema = z.enum(["knowledge", "dilemma", "review"]);
var safetyDispositionSchema = z.enum(["allow", "professional-boundary", "urgent-help", "refuse"]);
var safetyReasonSchema = z.enum(["none", "medical", "mental-health", "legal", "financial", "self-harm", "imminent-danger", "sexual", "illegal-assistance"]);
var dialoguePhaseSchema = z.enum(["responding", "clarifying", "awaiting-confirmation", "reflecting", "action-defined", "paused", "closed"]);
var feedbackKindSchema = z.enum(["none", "confirm", "partial-confirm", "correct", "reject", "new-information", "reality-changed", "disagree-persona", "not-helpful", "question-evidence", "action-feedback", "skip", "continue", "pause", "end", "unclear"]);
var turnIntentSchema = z.enum(["answer", "clarify", "await-confirmation", "reflect", "offer-controls", "pause", "close"]);
var dialogueControlSchema = z.enum(["confirm", "partial-confirm", "correct", "skip", "continue", "pause", "end", "switch-persona", "new-dilemma"]);
var turnControlDecisionSchema = z.object({
  safety: safetyDispositionSchema,
  safetyReason: safetyReasonSchema,
  taskMode: taskModeSchema,
  confidence: z.enum(["high", "low"]),
  emotionPriority: z.boolean(),
  feedbackKind: feedbackKindSchema,
  independentNewDilemma: z.boolean()
}).strict();

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
  return (value.turnIntent === void 0 || turnIntentSchema.safeParse(value.turnIntent).success) && (value.questions === void 0 || Array.isArray(value.questions) && value.questions.every((q) => typeof q === "string")) && (value.controls === void 0 || Array.isArray(value.controls) && value.controls.every((c) => dialogueControlSchema.safeParse(c).success));
}
function parseActorReplyMeta(value) {
  if (!isRecord(value) || value.kind !== "actor-reply" || typeof value.reply !== "string" || !isProjectedEvidenceArray(value.evidence) || !isPublicMeta(value)) return void 0;
  return { kind: "actor-reply", reply: value.reply, evidence: value.evidence, ...typeof value.turnIntent === "string" ? { turnIntent: value.turnIntent } : {}, ...Array.isArray(value.questions) ? { questions: value.questions } : {}, ...Array.isArray(value.controls) ? { controls: value.controls } : {}, ...value.fallback === true ? { fallback: true } : {} };
}

// src/client/actor-reply-node.ts
function eventData(event) {
  return event.data;
}
function matchReply(event) {
  if (event.type !== "tool/result" || !isAppendSurfaceEvent(event)) return null;
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
  buildViewNode: (context) => context.state?.result === void 0 ? null : { key: context.key, kind: "man-roles-actor-reply", id: context.id, target: "chat", anchorSeq: context.state.resultSeq ?? context.state.callSeq, location: context.start?.location ?? { kind: "unresolved" }, visibility: "visible", data: context.state.result }
};
function ActorReplyNodeView({ node }) {
  return createElement("div", { "data-man-roles-actor-reply": "true" }, node.data.reply);
}
function registerActorReplyNode(ctx) {
  ctx.conversationEvents.register(actorReplyConversationNodeDefinition);
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({ name: "conversation.chat.node", key: "man-roles-actor-reply" }, ActorReplyNodeView));
}
export {
  actorReplyConversationNodeDefinition,
  registerActorReplyNode
};
//# sourceMappingURL=actor-reply-node.js.map
