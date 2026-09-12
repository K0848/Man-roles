// src/validation/phase7-task9-budget.ts
var PHASE7_TASK9_SCENARIO_BUDGETS = [
  { name: "knowledge", allocated: 7e3, minimumStart: 2500, repairReserve: 1800 },
  { name: "dilemma", allocated: 5e3, minimumStart: 1800, repairReserve: 1800 },
  { name: "review", allocated: 4500, minimumStart: 2500, repairReserve: 1800 },
  { name: "high-risk", allocated: 0, minimumStart: 0, repairReserve: 0 },
  { name: "cross-person", allocated: 3500, minimumStart: 2200, repairReserve: 1500 }
];

// src/e2e/batch-budget.ts
var NATIVE_BATCH_TOKEN_LIMIT = 2e4;
function estimateRequestReservation(request) {
  const promptChars = JSON.stringify({ system: request.system ?? "", messages: request.messages, tools: request.tools ?? [] }).length;
  const promptEstimate = Math.ceil(promptChars / 4);
  const outputReserve = request.maxTokens ?? 256;
  return promptEstimate + outputReserve;
}
function usageTotal(usage) {
  return usage.inputTokens + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0) + (usage.reasoningTokens ?? 0);
}
var BatchBudget = class {
  limit;
  nextId = 1;
  pending = /* @__PURE__ */ new Map();
  observed = 0;
  constructor(limit = NATIVE_BATCH_TOKEN_LIMIT) {
    this.limit = limit;
  }
  canStart(request) {
    return this.observed + this.estimatedReserved + estimateRequestReservation(request) <= this.limit;
  }
  reserve(request) {
    if (!this.canStart(request)) return void 0;
    const id = this.nextId++;
    this.pending.set(id, estimateRequestReservation(request));
    return id;
  }
  observe(id, usage) {
    if (!this.pending.delete(id)) throw new Error(`unknown or already-settled reservation: ${id}`);
    this.observed += usageTotal(usage);
    return this.observed <= this.limit;
  }
  cancel(id) {
    this.pending.delete(id);
  }
  get estimatedReserved() {
    return [...this.pending.values()].reduce((sum, value) => sum + value, 0);
  }
  get observedTokens() {
    return this.observed;
  }
  get exceeded() {
    return this.observed > this.limit;
  }
};
var ScenarioAllocator = class {
  limit;
  plans;
  used = 0;
  observedByScenario = /* @__PURE__ */ new Map();
  blockedScenarios = /* @__PURE__ */ new Set();
  blockers = /* @__PURE__ */ new Map();
  consumedRepairReserve = /* @__PURE__ */ new Set();
  constructor(plansOrNames, limit = NATIVE_BATCH_TOKEN_LIMIT, perScenario = 3200, minimumStart = 1800) {
    this.limit = limit;
    const plans = plansOrNames.map((item) => typeof item === "string" ? { name: item, allocated: perScenario, minimumStart } : item);
    if (new Set(plans.map((x) => x.name)).size !== plans.length || plans.some((x) => x.allocated < 0 || x.minimumStart < 0 || x.minimumStart > x.allocated || (x.repairReserve ?? 0) < 0 || (x.repairReserve ?? 0) > x.allocated)) throw new Error("invalid scenario allocation plan");
    const total = plans.reduce((sum, x) => sum + x.allocated, 0);
    if (total > limit) throw new Error("scenario allocation exceeds global token limit");
    this.plans = plans;
  }
  plan(name) {
    const plan = this.plans.find((x) => x.name === name);
    if (!plan) throw new Error(`unknown scenario: ${name}`);
    return plan;
  }
  canStart(name, estimated, useRepairReserve = false) {
    return this.admission(name, estimated, useRepairReserve).allowed;
  }
  admission(name, estimated, useRepairReserve = false) {
    const plan = this.plan(name);
    const repairReserve = plan.repairReserve ?? 0;
    const remainingScenario = plan.allocated - (this.observedByScenario.get(name) ?? 0);
    const laterReserve = this.plans.slice(this.plans.indexOf(plan) + 1).reduce((sum, x) => sum + x.minimumStart, 0);
    const reserveNeeded = this.consumedRepairReserve.has(name) || useRepairReserve ? 0 : repairReserve;
    const allowed = estimated <= remainingScenario - reserveNeeded && this.used + estimated + laterReserve + reserveNeeded <= this.limit;
    return { allowed, remainingScenario, estimated, laterReserve, repairReserve: reserveNeeded, ...allowed ? {} : { reason: estimated > remainingScenario - reserveNeeded ? "remainingScenario" : "laterReserve-or-global" } };
  }
  consumeRepairReserve(name) {
    this.plan(name);
    this.consumedRepairReserve.add(name);
  }
  markBlocked(name, details) {
    this.plan(name);
    this.blockedScenarios.add(name);
    if (details) this.blockers.set(name, details);
  }
  blockerFor(name) {
    this.plan(name);
    return this.blockers.get(name) ?? null;
  }
  observedFor(name) {
    this.plan(name);
    return this.observedByScenario.get(name) ?? 0;
  }
  isBlocked(name) {
    this.plan(name);
    return this.blockedScenarios.has(name);
  }
  observe(name, amount) {
    const plan = this.plan(name);
    const next = (this.observedByScenario.get(name) ?? 0) + amount;
    if (next > plan.allocated || this.used + amount > this.limit) {
      this.markBlocked(name, this.admission(name, amount));
      throw new Error(`scenario budget exceeded: ${name}`);
    }
    ;
    this.observedByScenario.set(name, next);
    this.used += amount;
  }
  get observed() {
    return this.used;
  }
};
export {
  BatchBudget,
  NATIVE_BATCH_TOKEN_LIMIT,
  PHASE7_TASK9_SCENARIO_BUDGETS,
  ScenarioAllocator,
  estimateRequestReservation,
  usageTotal
};
//# sourceMappingURL=batch-budget.js.map
