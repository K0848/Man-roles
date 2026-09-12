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
export {
  manRolesRemoteContribution,
  mountManRolesRemote
};
//# sourceMappingURL=client-remote-probe.js.map
