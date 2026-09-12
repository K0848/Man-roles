// src/evidence/ledger.ts
var EvidenceLedger = class {
  constructor(personaId, turnId) {
    this.personaId = personaId;
    this.turnId = turnId;
  }
  personaId;
  turnId;
  grants = /* @__PURE__ */ new Map();
  grant(grant) {
    if (grant.personaId !== this.personaId || grant.turnId !== this.turnId || !grant.evidenceId) return false;
    this.grants.set(grant.evidenceId, { ...grant });
    return true;
  }
  hasCurrentGrant(evidenceId, kind) {
    const grant = this.grants.get(evidenceId);
    return grant !== void 0 && grant.personaId === this.personaId && grant.turnId === this.turnId && (kind === void 0 || grant.kind === kind);
  }
  get(evidenceId) {
    return this.grants.get(evidenceId);
  }
  entries() {
    return [...this.grants.values()].map((g) => ({ ...g }));
  }
  clear() {
    this.grants.clear();
  }
};

// src/dialogue/public-contract.ts
var DIALOGUE_CONTROLS = ["confirm", "partial-confirm", "correct", "skip", "continue", "pause", "end", "switch-persona", "new-dilemma"];
function isDialogueControl(value) {
  return typeof value === "string" && DIALOGUE_CONTROLS.includes(value);
}

// src/runtime/turn-state.ts
function turnPolicyViolation(args, current) {
  if (!current.policyConfigured) return void 0;
  const questions = Array.isArray(args?.questions) ? args.questions : [];
  if (current.maxQuestions !== void 0 && questions.length > current.maxQuestions) return `\u672C\u56DE\u5408\u6700\u591A\u5141\u8BB8 ${current.maxQuestions} \u4E2A\u95EE\u9898\uFF1B\u8BF7\u5220\u9664\u591A\u4F59\u95EE\u9898\u540E\u91CD\u65B0\u63D0\u4EA4\u3002`;
  return void 0;
}
function normalizeTurnPolicyArgs(args, current) {
  if (!current.policyConfigured || typeof args !== "object" || args === null) return args;
  const offeredControls = args.offeredControls;
  if (!Array.isArray(offeredControls)) return args;
  const normalized = offeredControls.filter((control) => !isDialogueControl(control) || current.allowedControls.includes(control));
  return normalized.length === offeredControls.length ? args : { ...args, offeredControls: normalized };
}
var ActorTurnStateRegistry = class {
  states = /* @__PURE__ */ new WeakMap();
  pendingPolicies = /* @__PURE__ */ new WeakMap();
  state(session, personaId, turnId) {
    let byTurn = this.states.get(session);
    if (!byTurn) {
      byTurn = /* @__PURE__ */ new Map();
      this.states.set(session, byTurn);
    }
    let value = byTurn.get(turnId);
    if (!value) {
      value = { personaId, turnId, ledger: new EvidenceLedger(personaId, turnId), failures: 0, repairPrompted: false, submitted: false, retrievalPolicy: "allow", allowedControls: ["confirm", "partial-confirm", "correct", "skip", "continue", "pause", "end", "switch-persona", "new-dilemma"], policyConfigured: false };
      byTurn.set(turnId, value);
    }
    return value;
  }
  /** Coordinator/Actor boundary sets this before followup; tools enforce it again at execution. */
  setRetrievalPolicy(session, personaId, turnId, policy) {
    this.state(session, personaId, turnId).retrievalPolicy = policy;
  }
  setTurnPolicy(session, personaId, turnId, policy) {
    const current = this.state(session, personaId, turnId);
    current.retrievalPolicy = policy.retrievalPolicy;
    current.maxQuestions = policy.maxQuestions;
    current.allowedControls = [...new Set(policy.allowedControls)];
    current.policyConfigured = true;
  }
  setNextTurnPolicy(session, policy) {
    this.pendingPolicies.set(session, { retrievalPolicy: policy.retrievalPolicy, maxQuestions: policy.maxQuestions, allowedControls: [...new Set(policy.allowedControls)] });
  }
  setNextTurnRetrievalPolicy(session, policy) {
    this.pendingPolicies.set(session, { retrievalPolicy: policy });
  }
  setRepairDetails(session, personaId, turnId, details) {
    this.state(session, personaId, turnId).repairDetails = details;
  }
  stateForExecution(exec, personaId) {
    const session = exec.agent?.session;
    if (!session) throw new Error("actor tool execution missing agent session");
    const turnId = openTurnId(session);
    if (turnId === void 0) throw new Error("actor tool execution has no open turn");
    const byTurn = this.states.get(session);
    if (byTurn) {
      for (const key of byTurn.keys()) if (key !== turnId) byTurn.delete(key);
    }
    const value = this.state(session, personaId, turnId);
    const pending = this.pendingPolicies.get(session);
    if (pending) {
      if (pending.retrievalPolicy) value.retrievalPolicy = pending.retrievalPolicy;
      if (pending.maxQuestions !== void 0) value.maxQuestions = pending.maxQuestions;
      if (pending.allowedControls !== void 0) value.allowedControls = [...new Set(pending.allowedControls)];
      if (pending.maxQuestions !== void 0 || pending.allowedControls !== void 0) value.policyConfigured = true;
      this.pendingPolicies.delete(session);
    }
    return value;
  }
  clearSession(session) {
    this.states.delete(session);
  }
  consumeRepairPrompt(session) {
    const byTurn = this.states.get(session);
    if (!byTurn) return false;
    const events = session.events ?? [];
    const hasSuccess = events.some((event) => event.type === "tool/result" && typeof event.data === "object" && event.data !== null && typeof event.data.meta === "object" && event.data.meta?.kind === "actor-reply");
    for (const value of byTurn.values()) if (value.failures === 1 && !hasSuccess && !value.submitted && !value.repairPrompted) {
      value.repairPrompted = true;
      return value.repairDetails ?? "\u63D0\u4EA4\u7ED3\u6784\u65E0\u6548\uFF0C\u8BF7\u4FEE\u590D\u540E\u91CD\u8BD5\u3002";
    }
    return false;
  }
  markSubmitted(session) {
    const byTurn = this.states.get(session);
    if (byTurn) for (const value of byTurn.values()) value.submitted = true;
  }
  consumeEvidenceRecoveryPrompt(session) {
    const byTurn = this.states.get(session);
    if (!byTurn) return false;
    const events = session.events ?? [];
    const hasSuccess = events.some((event) => event.type === "tool/result" && typeof event.data === "object" && event.data !== null && typeof event.data.meta === "object" && event.data.meta?.kind === "actor-reply");
    for (const value of byTurn.values()) if (value.failures === 0 && !hasSuccess && !value.submitted && !value.repairPrompted && value.ledger.entries().length > 0) {
      value.repairPrompted = true;
      return true;
    }
    return false;
  }
};
function openTurnId(session) {
  let open;
  for (const event of session.events ?? []) {
    const turn = event.data?.turn;
    if (event.type === "turn/start" && typeof turn === "number") open = String(turn);
    if (event.type === "turn/end" && typeof turn === "number" && open === String(turn)) open = void 0;
  }
  return open;
}
export {
  ActorTurnStateRegistry,
  normalizeTurnPolicyArgs,
  openTurnId,
  turnPolicyViolation
};
//# sourceMappingURL=turn-state.js.map
