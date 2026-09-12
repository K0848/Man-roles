/**
 * man-roles-roleplayer —— turn/task/invocation 标识与幂等骨架（纯 TS）。
 *
 * 对应 task_plan「最小数据契约」：task 可含多次 invocation（任务与模型调用解耦）。
 *  - turn_id        ：一轮对话（用户输入 + 回答 + 状态变更）；
 *  - task_id        ：一次业务任务（如「生成困惑候选」）；
 *  - invocation_id  ：一次模型/工具调用；
 *  - 幂等           ：以 (task_id, invocation_id) 为键，同轮重复提交跳过并返回首次结果。
 *
 * 失败路径约定：单次 invocation 失败只记录该 invocation，task 可重试该 invocation，
 * 不整段重跑（由调用方在 tryRun 的 fn 内按 invocation_id 记录失败）。
 */
import { randomUUID } from 'node:crypto'

/** 一次业务任务内的一次模型/工具调用标识。 */
export interface TurnIds {
  turnId: string
  taskId: string
  invocationId: string
}

/**
 * 生成一组标识（默认随机；可注入 seed 前缀便于测试与日志关联）。
 */
export function newTurnIds(seed = 'mr'): TurnIds {
  const suffix = randomUUID().slice(0, 8)
  return {
    turnId: `${seed}-turn-${suffix}`,
    taskId: `${seed}-task-${suffix}`,
    invocationId: `${seed}-inv-${suffix}`,
  }
}

/** 幂等执行结果。 */
export type IdempotentRun<T> =
  | { status: 'ran'; value: T }
  | { status: 'skipped'; value: T }
  | { status: 'failed'; error: unknown }

/**
 * 幂等注册表：以 (task_id, invocation_id) 为键记忆已完成调用。
 * 同键重复提交 → skipped 并返回首次结果；不自动重试整段（失败路径由调用方控制）。
 */
export class IdempotencyRegistry {
  private readonly done = new Map<string, unknown>()

  static keyOf(taskId: string, invocationId: string): string {
    return `${taskId}:${invocationId}`
  }

  /** 该 (task, invocation) 是否已执行完成（成功或失败均记录）。 */
  has(taskId: string, invocationId: string): boolean {
    return this.done.has(IdempotencyRegistry.keyOf(taskId, invocationId))
  }

  /**
   * 幂等执行：已执行则跳过；否则执行 fn 并记录结果。
   * fn 抛错时记录失败（防止重复提交重放失败调用），由调用方决定是否用新 invocation_id 重试。
   */
  tryRun<T>(taskId: string, invocationId: string, fn: () => T): IdempotentRun<T> {
    const key = IdempotencyRegistry.keyOf(taskId, invocationId)
    const memo = this.done.get(key)
    if (memo !== undefined) {
      if (memo instanceof IdempotencyError) return { status: 'failed', error: memo.error }
      return { status: 'skipped', value: memo as T }
    }
    try {
      const value = fn()
      this.done.set(key, value)
      return { status: 'ran', value }
    } catch (error) {
      this.done.set(key, new IdempotencyError(error))
      return { status: 'failed', error }
    }
  }
}

/** 内部包装：标记一次失败的 invocation（幂等键记住失败，避免重放）。 */
class IdempotencyError {
  constructor(readonly error: unknown) {}
}
