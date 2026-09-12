export interface BudgetUsage { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number; reasoningTokens?: number }
export interface BudgetRequest { system?: string; messages: readonly unknown[]; tools?: readonly unknown[]; maxTokens?: number }
export const NATIVE_BATCH_TOKEN_LIMIT = 20_000
export function estimateRequestReservation(request: BudgetRequest): number {
  const promptChars = JSON.stringify({ system: request.system ?? '', messages: request.messages, tools: request.tools ?? [] }).length
  const promptEstimate = Math.ceil(promptChars / 4)
  const outputReserve = request.maxTokens ?? 256
  return promptEstimate + outputReserve
}
export function usageTotal(usage: BudgetUsage): number { return usage.inputTokens + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0) + (usage.reasoningTokens ?? 0) }
export class BatchBudget {
  readonly limit: number
  private nextId = 1
  private pending = new Map<number, number>()
  private observed = 0
  constructor(limit = NATIVE_BATCH_TOKEN_LIMIT) { this.limit = limit }
  canStart(request: BudgetRequest): boolean { return this.observed + this.estimatedReserved + estimateRequestReservation(request) <= this.limit }
  reserve(request: BudgetRequest): number | undefined { if (!this.canStart(request)) return undefined; const id = this.nextId++; this.pending.set(id, estimateRequestReservation(request)); return id }
  observe(id: number, usage: BudgetUsage): boolean { if (!this.pending.delete(id)) throw new Error(`unknown or already-settled reservation: ${id}`); this.observed += usageTotal(usage); return this.observed <= this.limit }
  cancel(id: number): void { this.pending.delete(id) }
  get estimatedReserved(): number { return [...this.pending.values()].reduce((sum, value) => sum + value, 0) }
  get observedTokens(): number { return this.observed }
  get exceeded(): boolean { return this.observed > this.limit }
}

/** Deterministic admission plan: each scenario receives a ceiling and a protected
 * startup reserve for every later scenario, so an early noisy model cannot starve them. */
export interface ScenarioBudget { name: string; allocated: number; minimumStart: number; repairReserve?: number }
export { PHASE7_TASK9_SCENARIO_BUDGETS } from '../validation/phase7-task9-budget.ts'
export class ScenarioAllocator {
  readonly limit: number
  private readonly plans: readonly ScenarioBudget[]
  private used = 0
  private readonly observedByScenario = new Map<string, number>()
  private readonly blockedScenarios = new Set<string>()
  private readonly blockers = new Map<string, { remainingScenario: number; estimated: number; laterReserve: number; repairReserve: number; reason: string }>()
  private readonly consumedRepairReserve = new Set<string>()
  constructor(plansOrNames: readonly (ScenarioBudget | string)[], limit = NATIVE_BATCH_TOKEN_LIMIT, perScenario = 3200, minimumStart = 1800) {
    this.limit = limit
    const plans = plansOrNames.map((item) => typeof item === 'string' ? { name: item, allocated: perScenario, minimumStart } : item)
    if (new Set(plans.map((x) => x.name)).size !== plans.length || plans.some((x) => x.allocated < 0 || x.minimumStart < 0 || x.minimumStart > x.allocated || (x.repairReserve ?? 0) < 0 || (x.repairReserve ?? 0) > x.allocated)) throw new Error('invalid scenario allocation plan')
    const total = plans.reduce((sum, x) => sum + x.allocated, 0)
    if (total > limit) throw new Error('scenario allocation exceeds global token limit')
    this.plans = plans
  }
  plan(name: string): ScenarioBudget { const plan = this.plans.find((x) => x.name === name); if (!plan) throw new Error(`unknown scenario: ${name}`); return plan }
  canStart(name: string, estimated: number, useRepairReserve = false): boolean { return this.admission(name, estimated, useRepairReserve).allowed }
  admission(name: string, estimated: number, useRepairReserve = false): { allowed: boolean; remainingScenario: number; estimated: number; laterReserve: number; repairReserve: number; reason?: string } {
    const plan = this.plan(name); const repairReserve = plan.repairReserve ?? 0; const remainingScenario = plan.allocated - (this.observedByScenario.get(name) ?? 0); const laterReserve = this.plans.slice(this.plans.indexOf(plan) + 1).reduce((sum, x) => sum + x.minimumStart, 0); const reserveNeeded = this.consumedRepairReserve.has(name) || useRepairReserve ? 0 : repairReserve; const allowed = estimated <= remainingScenario - reserveNeeded && this.used + estimated + laterReserve + reserveNeeded <= this.limit
    return { allowed, remainingScenario, estimated, laterReserve, repairReserve: reserveNeeded, ...(allowed ? {} : { reason: estimated > remainingScenario - reserveNeeded ? 'remainingScenario' : 'laterReserve-or-global' }) }
  }
  consumeRepairReserve(name: string): void { this.plan(name); this.consumedRepairReserve.add(name) }
  markBlocked(name: string, details?: { remainingScenario: number; estimated: number; laterReserve: number; repairReserve: number; reason: string }): void { this.plan(name); this.blockedScenarios.add(name); if (details) this.blockers.set(name, details) }
  blockerFor(name: string): { remainingScenario: number; estimated: number; laterReserve: number; repairReserve: number; reason: string } | null { this.plan(name); return this.blockers.get(name) ?? null }
  observedFor(name: string): number { this.plan(name); return this.observedByScenario.get(name) ?? 0 }
  isBlocked(name: string): boolean { this.plan(name); return this.blockedScenarios.has(name) }
  observe(name: string, amount: number): void { const plan = this.plan(name); const next = (this.observedByScenario.get(name) ?? 0) + amount; if (next > plan.allocated || this.used + amount > this.limit) { this.markBlocked(name, this.admission(name, amount) as any); throw new Error(`scenario budget exceeded: ${name}`) }; this.observedByScenario.set(name, next); this.used += amount }
  get observed(): number { return this.used }
}
