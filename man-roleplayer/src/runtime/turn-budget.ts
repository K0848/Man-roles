import type { PersonaId, TaskOutcome } from '../domain/schema.ts'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type { SessionEvent } from '@deepseek-ai/dsh-session'

export interface TurnBudgetConfig { maxSteps: number; maxToolCalls: number; maxTokens: number }
export interface BudgetUsage { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number; reasoningTokens?: number }
export type BudgetEvent = SessionEvent
export interface BudgetSession { events: readonly SessionEvent[] }

export function createTurnBudget(overrides: Partial<TurnBudgetConfig> = {}): TurnBudgetConfig {
  return { maxSteps: overrides.maxSteps ?? 8, maxToolCalls: overrides.maxToolCalls ?? 5, maxTokens: overrides.maxTokens ?? 20000 }
}

export interface FullTokenUsage { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; reasoningTokens: number }
export function sumTokenUsageForTurn(events: readonly BudgetEvent[], turn: number): FullTokenUsage {
  const total: FullTokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 }
  for (const event of events) {
    if (event.type !== 'assistant/message' || event.data?.turn !== turn) continue
    const usage: BudgetUsage = (event as SessionEvent<'assistant/message'>).data.usage ?? {}
    total.inputTokens += usage.inputTokens ?? 0; total.outputTokens += usage.outputTokens ?? 0
    total.cacheReadTokens += usage.cacheReadTokens ?? 0; total.cacheWriteTokens += usage.cacheWriteTokens ?? 0; total.reasoningTokens += usage.reasoningTokens ?? 0
  }
  return total
}

export function attachTurnBudget(ctx: Context, agent: Agent, budget: TurnBudgetConfig, options: { resolveTask: (turn: number) => { taskId: string; personaId: PersonaId; branchSessionId: string }; recordBlocked: (outcome: TaskOutcome) => void }): () => void {
  const toolCounts = new Map<number, number>(); const exhausted = new Set<number>()
  const record = (turn: number): void => { const task = options.resolveTask(turn); options.recordBlocked({ ...task, branchTurn: turn, status: 'blocked', reason: 'budget_exceeded', retryable: true }) }
  const offStep = ctx.on('agent/pre-step', async ({ agent: subject, step, turn }, next): Promise<PreStepDecision> => {
    if (subject !== agent) return next()
    const usage = sumTokenUsageForTurn(agent.session.events, turn); const total = Object.values(usage).reduce((sum, value) => sum + value, 0)
    if (exhausted.has(turn) || step > budget.maxSteps || total >= budget.maxTokens) { record(turn); exhausted.add(turn); return { kind: 'reject' } }
    return next()
  })
  const offTool = agent.ctx.tools.guard((execution) => {
    if (execution.name === 'submit_actor_reply') return undefined
    const session = execution.agent?.session ?? agent.session; const current = [...session.events].reverse().find((event) => event.type === 'turn/start')?.data?.turn
    if (typeof current !== 'number' || !Number.isInteger(current) || current < 1) throw new Error('budget guard requires an open positive turn')
    const count = toolCounts.get(current) ?? 0; if (exhausted.has(current) || count >= budget.maxToolCalls) { record(current); exhausted.add(current); return '本回合已达到工具调用预算' }
    toolCounts.set(current, count + 1); return undefined
  })
  return () => { offStep(); offTool() }
}
