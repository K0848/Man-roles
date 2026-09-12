import type { TaskOutcome } from '../domain/schema.ts'
export const TASK_BUDGET_BLOCKED_MESSAGE = '本轮执行已停止，可重试'
export function projectTaskOutcome(_outcome: TaskOutcome): { status: 'blocked'; message: string; retryable: true } { return { status: 'blocked', message: TASK_BUDGET_BLOCKED_MESSAGE, retryable: true } }
