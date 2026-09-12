window.__ModuleLoader__.load({ id: 'man-roles-roleplayer', factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  actorReplyConversationNodeDefinition: () => actorReplyConversationNodeDefinition,
  apply: () => apply,
  inject: () => inject,
  name: () => name,
  personaEntries: () => personaEntries
});
module.exports = __toCommonJS(index_exports);

// src/client/generated-metadata.ts
var ACTIVE_PERSONAS = [{ "id": "wang-yangming", "displayName": "\u738B\u9633\u660E", "status": "active" }, { "id": "zeng-guofan", "displayName": "\u66FE\u56FD\u85E9", "status": "active" }];

// src/client/remote-probe.ts
function record(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("expected object");
  return value;
}
function string(value, field) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`expected ${field}`);
  return value;
}
function exact(value, fields) {
  const row = record(value);
  for (const key of Object.keys(row)) if (!fields.includes(key)) throw new Error(`unexpected ${key}`);
  return row;
}
function strict(typeSymbol, parse) {
  return { mode: "strict", typeSymbol, schema: { parse } };
}
function request(fields) {
  return strict(`man-roles-roleplayer#${fields.join("_")}Request`, (value) => {
    const row = exact(value, fields);
    for (const field of fields) string(row[field], field);
    return value;
  });
}
function feedbackRequest(value) {
  const row = exact(value, ["conversationId", "itemId", "action", "operationId", "replacement"]);
  for (const field of ["conversationId", "itemId", "action", "operationId"]) string(row[field], field);
  if (!["confirm", "partial-confirm", "correct", "reject", "skip"].includes(row.action)) throw new Error("invalid feedback action");
  if (row.replacement !== void 0) string(row.replacement, "replacement");
  return value;
}
function productView(value) {
  const row = exact(value, ["conversationId", "activePersonaId", "lifecycle", "activeBranchSessionId", "branches", "userRaws", "candidateItems", "confirmedItems", "branchProgress", "taskState"]);
  string(row.conversationId, "conversationId");
  string(row.activePersonaId, "activePersonaId");
  if (row.activeBranchSessionId !== null) string(row.activeBranchSessionId, "activeBranchSessionId");
  if (!Array.isArray(row.branches) || !Array.isArray(row.userRaws) || !Array.isArray(row.candidateItems) || !Array.isArray(row.confirmedItems)) throw new Error("invalid product view collection");
  return value;
}
function productResult(value) {
  const row = record(value);
  if (row.ok !== true && row.ok !== false) throw new Error("invalid product result");
  if (row.ok === false) {
    string(row.code, "code");
    return value;
  }
  if (row.view !== void 0) productView(row.view);
  if (row.sessionId !== void 0) string(row.sessionId, "sessionId");
  if (row.rawRef !== void 0) string(row.rawRef, "rawRef");
  if (row.taskId !== void 0) string(row.taskId, "taskId");
  return value;
}
var PRODUCT_RESULT = strict("man-roles-roleplayer#ProductResult", productResult);
var manRolesRemoteContribution = Object.freeze({
  package: "man-roles-roleplayer",
  descriptors: Object.freeze([{
    id: "manRolesProbe/ping",
    service: "manRolesProbe",
    namespace: "manRolesProbe",
    method: "ping",
    invocation: { kind: "direct" },
    parameters: [{ name: "probePingRequest", wire: "probePingRequest", source: "json", codec: request(["nonce"]) }],
    result: strict("man-roles-roleplayer#ProbeResult", (value) => {
      const row = exact(value, ["ok", "nonce", "service"]);
      if (row.ok !== true || row.service !== "manRolesProbe") throw new Error("invalid probe result");
      string(row.nonce, "nonce");
      return value;
    })
  }, ...[
    ["create", ["conversationId", "personaId"]],
    ["view", ["conversationId"]],
    ["switchPersona", ["conversationId", "personaId", "operationId"]],
    ["send", ["conversationId", "messageId", "text"]],
    ["feedback", ["conversationId", "itemId", "action", "operationId", "replacement"]]
  ].map(([method, fields]) => ({
    id: `manRolesProduct/${method}`,
    service: "manRolesProduct",
    namespace: "manRolesProduct",
    method,
    invocation: { kind: "direct" },
    parameters: [{ name: { create: "productCreateRequest", view: "productViewRequest", switchPersona: "productSwitchRequest", send: "productSendRequest", feedback: "productFeedbackRequest" }[String(method)], wire: { create: "productCreateRequest", view: "productViewRequest", switchPersona: "productSwitchRequest", send: "productSendRequest", feedback: "productFeedbackRequest" }[String(method)], source: "json", codec: method === "feedback" ? strict("man-roles-roleplayer#productFeedbackRequest", feedbackRequest) : request(fields) }],
    result: PRODUCT_RESULT
  }))])
});
async function mountManRolesRemote(ctx) {
  return ctx.remote.$mount(manRolesRemoteContribution);
}

// src/client/product-controller.ts
function unwrap(value) {
  if ("value" in value) return value.value;
  if ("error" in value) return { ok: false, code: value.error?.message ?? "remote-failed" };
  return value;
}
var ProductController = class {
  constructor(remote) {
    this.remote = remote;
  }
  remote;
  async create(input) {
    return unwrap(await this.remote.manRolesProduct.create(input));
  }
  async view(input) {
    return unwrap(await this.remote.manRolesProduct.view(input));
  }
  async send(input) {
    return unwrap(await this.remote.manRolesProduct.send(input));
  }
  /** Navigation belongs to the caller and occurs only after ProductService has committed the switch. */
  async switchPersona(input, open) {
    const result = unwrap(await this.remote.manRolesProduct.switchPersona(input));
    if (result.ok && result.sessionId) open(result.sessionId);
    return result;
  }
  async feedback(input) {
    return unwrap(await this.remote.manRolesProduct.feedback(input));
  }
};

// src/client/product-ui.ts
var import_react = require("react");
function productBranchFromSessionId(sessionId) {
  if (!sessionId) return null;
  const match = /^session-man-roles-[a-z0-9]+(?:-[a-z0-9]+)*--([A-Za-z0-9][A-Za-z0-9_-]{0,127})$/.exec(sessionId);
  return match ? { conversationId: match[1], sessionId } : null;
}
function selectProductComposer({ session }) {
  return productBranchFromSessionId(session?.sessionId);
}
function operationId(prefix) {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}
function ProductComposer(props) {
  const [draft, setDraft] = (0, import_react.useState)("");
  const [error, setError] = (0, import_react.useState)(null);
  const [sending, setSending] = (0, import_react.useState)(false);
  const send = () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    void props.controller.send({ conversationId: props.matched.conversationId, messageId: operationId("message"), text }).then((result) => {
      if (result.ok) {
        setDraft("");
        setError(null);
      } else setError(result.code ?? "\u53D1\u9001\u5931\u8D25");
    }).catch(() => setError("\u53D1\u9001\u5931\u8D25")).finally(() => setSending(false));
  };
  return (0, import_react.createElement)("div", { "data-man-roles-product-composer": "true", style: { padding: "10px", borderTop: "1px solid var(--dsh-border, #ddd)", display: "flex", gap: "8px", flexDirection: "column" } }, [
    (0, import_react.createElement)("textarea", { key: "draft", value: draft, disabled: sending, placeholder: "\u5411\u5F53\u524D\u4EBA\u7269\u8BF4\u8BF4\u4F60\u7684\u56F0\u60D1\u2026", rows: 2, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    } }),
    error ? (0, import_react.createElement)("div", { key: "error", role: "alert" }, error) : null,
    (0, import_react.createElement)("button", { key: "send", type: "button", disabled: sending || draft.trim() === "", onClick: send, "data-man-roles-product-send": "true" }, sending ? "\u53D1\u9001\u4E2D\u2026" : "\u53D1\u9001")
  ]);
}
function ProductPanel(props) {
  const [view, setView] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)(null);
  const [corrections, setCorrections] = (0, import_react.useState)({});
  const create = () => {
    const persona = props.personas[0];
    if (!persona) return;
    const conversationId = operationId("conversation");
    void props.controller.create({ conversationId, personaId: persona.id }).then((result) => {
      if (!result.ok || !result.view?.activeBranchSessionId) {
        setError(result.code ?? "\u521B\u5EFA\u5BF9\u8BDD\u5931\u8D25");
        return;
      }
      setView(result.view);
      setError(null);
      props.open(result.view.activeBranchSessionId);
    }).catch((error2) => setError(error2 instanceof Error ? `\u521B\u5EFA\u5BF9\u8BDD\u5931\u8D25\uFF1A${error2.message}` : "\u521B\u5EFA\u5BF9\u8BDD\u5931\u8D25"));
  };
  const refresh = () => {
    if (!view) return;
    void props.controller.view({ conversationId: view.conversationId }).then((result) => {
      if (result.ok && result.view) {
        setView(result.view);
        setError(null);
      } else setError(result.code ?? "\u5237\u65B0\u5931\u8D25");
    }).catch(() => setError("\u5237\u65B0\u5931\u8D25"));
  };
  const switchPersona = (personaId) => {
    if (!view) return;
    void props.controller.switchPersona({ conversationId: view.conversationId, personaId, operationId: operationId("switch") }, props.open).then((result) => {
      if (!result.ok) setError(result.code ?? "\u5207\u6362\u5931\u8D25");
      else if (result.view) {
        setView(result.view);
        setError(null);
      } else refresh();
    }).catch(() => setError("\u5207\u6362\u5931\u8D25"));
  };
  const candidates = (view?.candidateItems ?? []).filter((item) => typeof item === "object" && item !== null && typeof item.id === "string");
  const [pendingFeedback, setPendingFeedback] = (0, import_react.useState)(null);
  const feedback = (candidate, action, replacement) => {
    if (!view || !candidate.id || pendingFeedback) return;
    const operation = `${view.conversationId}-${candidate.id}-${action}`;
    setPendingFeedback(operation);
    void props.controller.feedback({ conversationId: view.conversationId, itemId: candidate.id, action, operationId: `feedback-${operation}`, ...replacement ? { replacement } : {} }).then((result) => {
      if (result.ok) refresh();
      else setError(result.code ?? "\u53CD\u9988\u5931\u8D25");
    }).catch(() => setError("\u53CD\u9988\u5931\u8D25")).finally(() => setPendingFeedback(null));
  };
  const feedbackLabel = { confirm: "\u786E\u8BA4", "partial-confirm": "\u90E8\u5206\u786E\u8BA4", correct: "\u7EA0\u6B63", reject: "\u4E0D\u7B26\u5408", skip: "\u6682\u4E0D\u5904\u7406" };
  const feedbackActions = ["confirm", "partial-confirm", "correct", "reject", "skip"];
  return (0, import_react.createElement)("section", { "data-man-roles-product-panel": "true", style: { display: "flex", flexDirection: "column", gap: "6px", padding: "8px" } }, [
    (0, import_react.createElement)("strong", { key: "title" }, "\u5411\u53E4\u4EBA\u95EE\u60D1"),
    (0, import_react.createElement)("button", { key: "create", type: "button", onClick: create, "data-man-roles-create": "true" }, "\u65B0\u5EFA\u56F0\u60D1\u5BF9\u8BDD"),
    view ? (0, import_react.createElement)("div", { key: "conversation" }, `\u5F53\u524D\u4EBA\u7269\uFF1A${view.activePersonaId}`) : null,
    view ? (0, import_react.createElement)("div", { key: "personas", style: { display: "flex", gap: "4px", flexWrap: "wrap" } }, props.personas.map((persona) => (0, import_react.createElement)("button", { key: persona.id, type: "button", disabled: persona.id === view.activePersonaId, onClick: () => switchPersona(persona.id), "data-man-roles-switch": persona.id }, persona.displayName))) : null,
    view ? (0, import_react.createElement)("button", { key: "refresh", type: "button", onClick: refresh, "data-man-roles-refresh": "true" }, "\u5237\u65B0\u72B6\u6001") : null,
    ...candidates.map((candidate) => (0, import_react.createElement)("div", { key: candidate.id, "data-man-roles-candidate-id": candidate.id, style: { display: "flex", flexDirection: "column", gap: "4px" } }, [
      (0, import_react.createElement)("div", { key: "text" }, `\u5019\u9009\u56F0\u60D1\uFF1A${candidate.text ?? candidate.id}`),
      (0, import_react.createElement)("input", { key: "replacement", value: corrections[candidate.id] ?? candidate.text ?? "", placeholder: "\u7EA0\u6B63\u540E\u7684\u56F0\u60D1\u8868\u8FF0", onChange: (event) => setCorrections({ ...corrections, [candidate.id]: event.target.value }), "data-man-roles-candidate-replacement": candidate.id }),
      (0, import_react.createElement)("div", { key: "actions", style: { display: "flex", gap: "4px", flexWrap: "wrap" } }, feedbackActions.map((action) => (0, import_react.createElement)("button", {
        key: action,
        type: "button",
        disabled: pendingFeedback !== null,
        onClick: () => feedback(candidate, action, action === "correct" ? corrections[candidate.id]?.trim() || candidate.text : void 0),
        "data-man-roles-feedback": action,
        ...action === "confirm" ? { "data-man-roles-confirm": "true" } : {}
      }, feedbackLabel[action])))
    ])),
    error ? (0, import_react.createElement)("div", { key: "error", role: "alert" }, error) : null
  ]);
}

// src/client/actor-reply-node.ts
var import_react2 = require("react");

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

// src/client/actor-reply-node.ts
function ActorReplyNodeView({ node }) {
  return (0, import_react2.createElement)("div", { "data-man-roles-actor-reply": "true" }, node.data.reply);
}
function registerActorReplyNode(ctx) {
  ctx.conversationEvents.register(actorReplyConversationNodeDefinition);
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({ name: "conversation.chat.node", key: "man-roles-actor-reply" }, ActorReplyNodeView));
}

// src/client/index.ts
var name = "man-roles-roleplayer-ui";
var inject = ["slots", "remote", "sessions", "conversationEvents"];
var personaEntries = ACTIVE_PERSONAS;
async function apply(ctx) {
  console.log("[man-roles-roleplayer:ui] client \u63D2\u4EF6\u5DF2\u52A0\u8F7D\uFF0C\u6CE8\u518C UI \u6CE8\u5165\u70B9 sidebar.footer.action");
  const remoteDispose = await mountManRolesRemote(ctx);
  let controller;
  await ctx.inject(["remote.manRolesProduct"], (productCtx) => {
    controller = new ProductController(productCtx.remote);
  });
  if (!controller) throw new Error("manRolesProduct Remote did not become available");
  registerActorReplyNode(ctx);
  const open = (sessionId) => ctx.sessions.open(sessionId);
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: "man-roles-roleplayer-product-panel",
    inject: () => ({ personas: personaEntries, controller, open })
  }, ProductPanel));
  ctx.slots.inject("conversation.composer", () => ctx.slots.register({
    name: "conversation.composer",
    priority: 10,
    select: selectProductComposer,
    inject: () => ({ controller })
  }, ProductComposer));
  console.log("[man-roles-roleplayer:ui] Product \u63A7\u5236\u9762\u4E0E\u4EC5\u4EA7\u54C1 Branch \u7684 composer \u5DF2\u6CE8\u518C");
  return remoteDispose;
}
return module.exports; } });
//# sourceMappingURL=client.js.map
