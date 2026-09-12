// src/runtime/turn-budget.ts
function createTurnBudget(overrides = {}) {
  return { maxSteps: overrides.maxSteps ?? 8, maxToolCalls: overrides.maxToolCalls ?? 5, maxTokens: overrides.maxTokens ?? 2e4 };
}
function sumTokenUsageForTurn(events, turn) {
  const total = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 };
  for (const event of events) {
    if (event.type !== "assistant/message" || event.data?.turn !== turn) continue;
    const usage = event.data.usage ?? {};
    total.inputTokens += usage.inputTokens ?? 0;
    total.outputTokens += usage.outputTokens ?? 0;
    total.cacheReadTokens += usage.cacheReadTokens ?? 0;
    total.cacheWriteTokens += usage.cacheWriteTokens ?? 0;
    total.reasoningTokens += usage.reasoningTokens ?? 0;
  }
  return total;
}
function attachTurnBudget(ctx, agent, budget, options) {
  const toolCounts = /* @__PURE__ */ new Map();
  const exhausted = /* @__PURE__ */ new Set();
  const record = (turn) => {
    const task = options.resolveTask(turn);
    options.recordBlocked({ ...task, branchTurn: turn, status: "blocked", reason: "budget_exceeded", retryable: true });
  };
  const offStep = ctx.on("agent/pre-step", async ({ agent: subject, step, turn }, next) => {
    if (subject !== agent) return next();
    const usage = sumTokenUsageForTurn(agent.session.events, turn);
    const total = Object.values(usage).reduce((sum, value) => sum + value, 0);
    if (exhausted.has(turn) || step > budget.maxSteps || total >= budget.maxTokens) {
      record(turn);
      exhausted.add(turn);
      return { kind: "reject" };
    }
    return next();
  });
  const offTool = agent.ctx.tools.guard((execution) => {
    if (execution.name === "submit_actor_reply") return void 0;
    const session = execution.agent?.session ?? agent.session;
    const current = [...session.events].reverse().find((event) => event.type === "turn/start")?.data?.turn;
    if (typeof current !== "number" || !Number.isInteger(current) || current < 1) throw new Error("budget guard requires an open positive turn");
    const count = toolCounts.get(current) ?? 0;
    if (exhausted.has(current) || count >= budget.maxToolCalls) {
      record(current);
      exhausted.add(current);
      return "\u672C\u56DE\u5408\u5DF2\u8FBE\u5230\u5DE5\u5177\u8C03\u7528\u9884\u7B97";
    }
    toolCounts.set(current, count + 1);
    return void 0;
  });
  return () => {
    offStep();
    offTool();
  };
}
export {
  attachTurnBudget,
  createTurnBudget,
  sumTokenUsageForTurn
};
//# sourceMappingURL=turn-budget.js.map
