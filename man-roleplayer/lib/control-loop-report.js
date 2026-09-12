// src/validation/control-loop-report.ts
function requestText(request) {
  if (request === void 0) return "";
  return [request.system, ...request.messages.map((message) => message.text)].join("\n");
}
function has(text, marker) {
  return marker !== "" && text.includes(marker);
}
function evaluateControlLoopEvidence(evidence, markers) {
  const byLabel = new Map(evidence.requests.map((request) => [request.label, request]));
  const text = (label) => requestText(byLabel.get(label));
  const checks = [];
  const add = (id, category, passed, detail, gate = true) => {
    checks.push({ id, category, gate, passed, detail });
  };
  add(
    "A1.sees-initial-user-raw",
    "shared-context",
    has(text("A1"), markers.initialUserRaw),
    "\u738B\u9633\u660E\u9996\u8F6E\u5FC5\u987B\u770B\u5230\u7528\u6237\u9010\u5B57\u539F\u8BDD"
  );
  add(
    "A1.candidate-not-promoted",
    "shared-context",
    !has(text("A1"), markers.candidateText),
    "\u672A\u7ECF\u786E\u8BA4\u7684 candidate \u4E0D\u5F97\u4F5C\u4E3A\u6F14\u5458\u4E0A\u4E0B\u6587\u4E8B\u5B9E"
  );
  add(
    "B1.sees-initial-user-raw",
    "shared-context",
    has(text("B1"), markers.initialUserRaw),
    "\u66FE\u56FD\u85E9\u9996\u6B21\u8FDB\u5165\u5FC5\u987B\u65E0\u611F\u63A5\u7EED\u540C\u4E00\u56F0\u60D1\u7684\u7528\u6237\u539F\u8BDD"
  );
  add(
    "B1.no-wang-reply",
    "persona-isolation",
    !has(text("B1"), markers.wangReply1),
    "\u66FE\u56FD\u85E9\u4E0D\u5F97\u770B\u5230\u738B\u9633\u660E\u56DE\u7B54"
  );
  add(
    "B1.no-candidate",
    "persona-isolation",
    !has(text("B1"), markers.candidateText),
    "\u66FE\u56FD\u85E9\u4E0D\u5F97\u628A\u672A\u786E\u8BA4\u5BFC\u6F14\u5019\u9009\u5F53\u5171\u4EAB\u4E8B\u5B9E"
  );
  add(
    "B2.sees-correction-raw",
    "shared-context",
    has(text("B2"), markers.correctionUserRaw),
    "\u7528\u6237\u7EA0\u6B63\u539F\u8BDD\u5FC5\u987B\u8FDB\u5165\u5F53\u524D\u4EBA\u7269\u4E0B\u4E00\u8F6E\u8F93\u5165"
  );
  add(
    "B2.sees-corrected-state",
    "shared-context",
    has(text("B2"), markers.correctedText),
    "\u7EA0\u6B63\u540E\u7684\u5171\u4EAB\u72B6\u6001\u5FC5\u987B\u5728\u4E0B\u4E00\u8F6E\u751F\u6210\u524D\u751F\u6548"
  );
  add(
    "B2.no-wang-reply",
    "persona-isolation",
    !has(text("B2"), markers.wangReply1),
    "\u7EA0\u6B63\u540E\u4ECD\u4E0D\u5F97\u6CC4\u9732\u738B\u9633\u660E\u56DE\u7B54"
  );
  add(
    "A2.sees-correction-raw",
    "shared-context",
    has(text("A2"), markers.correctionUserRaw),
    "\u5207\u56DE\u738B\u9633\u660E\u540E\u5FC5\u987B\u770B\u5230\u8DE8\u4EBA\u7269\u5171\u4EAB\u7684\u7528\u6237\u7EA0\u6B63\u539F\u8BDD"
  );
  add(
    "A2.sees-corrected-state",
    "shared-context",
    has(text("A2"), markers.correctedText),
    "\u5207\u56DE\u738B\u9633\u660E\u540E\u5FC5\u987B\u770B\u5230\u7EA0\u6B63\u540E\u7684\u5171\u4EAB\u72B6\u6001"
  );
  add(
    "A2.keeps-own-history",
    "persona-isolation",
    has(text("A2"), markers.wangReply1),
    "\u5207\u56DE\u738B\u9633\u660E\u540E\u5FC5\u987B\u6062\u590D\u738B\u9633\u660E\u81EA\u5DF1\u7684\u5386\u53F2"
  );
  add(
    "A2.no-zeng-replies",
    "persona-isolation",
    !has(text("A2"), markers.zengReply1) && !has(text("A2"), markers.zengReply2),
    "\u738B\u9633\u660E\u4E0D\u5F97\u770B\u5230\u66FE\u56FD\u85E9\u56DE\u7B54"
  );
  add(
    "branch.wang-no-zeng-replies",
    "persona-isolation",
    !has(evidence.branchLogs.\u738B\u9633\u660E, markers.zengReply1) && !has(evidence.branchLogs.\u738B\u9633\u660E, markers.zengReply2),
    "\u738B\u9633\u660E BranchSession \u65E5\u5FD7\u4E0D\u5F97\u542B\u66FE\u56FD\u85E9\u56DE\u7B54"
  );
  add(
    "branch.zeng-no-wang-reply",
    "persona-isolation",
    !has(evidence.branchLogs.\u66FE\u56FD\u85E9, markers.wangReply1),
    "\u66FE\u56FD\u85E9 BranchSession \u65E5\u5FD7\u4E0D\u5F97\u542B\u738B\u9633\u660E\u56DE\u7B54"
  );
  add(
    "A3.resume-keeps-own-history",
    "recovery",
    has(text("A3"), markers.wangReply1),
    "AgentLoop resume \u540E\u5FC5\u987B\u6062\u590D\u738B\u9633\u660E\u5386\u53F2"
  );
  add(
    "A3.resume-keeps-correction",
    "recovery",
    has(text("A3"), markers.correctionUserRaw) && has(text("A3"), markers.correctedText),
    "AgentLoop resume \u540E\u5FC5\u987B\u7EE7\u7EED\u8BFB\u53D6\u7EA0\u6B63\u539F\u8BDD\u4E0E\u7EA0\u6B63\u72B6\u6001"
  );
  add(
    "A3.resume-no-zeng-replies",
    "recovery",
    !has(text("A3"), markers.zengReply1) && !has(text("A3"), markers.zengReply2),
    "AgentLoop resume \u540E\u4ECD\u4E0D\u5F97\u6CC4\u9732\u66FE\u56FD\u85E9\u56DE\u7B54"
  );
  add(
    "trunk.raw-append-only-recovered",
    "recovery",
    evidence.restoredTrunk.userRaws.length === 2 && evidence.restoredTrunk.userRaws[0] === markers.initialUserRaw && evidence.restoredTrunk.userRaws[1] === markers.correctionUserRaw,
    "Trunk \u91CD\u653E\u540E\u5E94\u6309\u539F\u987A\u5E8F\u9010\u5B57\u4FDD\u7559\u4E24\u6761\u7528\u6237\u539F\u8BDD"
  );
  add(
    "trunk.corrected-state-recovered",
    "recovery",
    evidence.restoredTrunk.dilemmaPhase === "corrected" && evidence.restoredTrunk.correctedText === markers.correctedText,
    "Trunk \u91CD\u653E\u540E\u5E94\u6062\u590D corrected \u72B6\u6001"
  );
  add(
    "agent-loop.cancel-aborted",
    "lifecycle",
    evidence.cancelTurnEndKinds.includes("aborted"),
    "AgentLoop \u4E2D\u9014\u53D6\u6D88\u5FC5\u987B\u4EE5 aborted turn/end \u6536\u675F"
  );
  const hardGateFailures = checks.filter((check) => check.gate && !check.passed).map((check) => check.id);
  return { passed: hardGateFailures.length === 0, hardGateFailures, checks };
}
export {
  evaluateControlLoopEvidence
};
//# sourceMappingURL=control-loop-report.js.map
