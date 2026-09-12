export type TurnTaskStatus = 'running' | 'completed' | 'cancelled' | 'blocked'
export interface TurnTask { taskId: string; status: TurnTaskStatus; result?: unknown; reason?: 'budget-exceeded' | 'operation-failed' }
/** Single-flight, cancellable product task runner. */
export class TurnRunner {
  private readonly tasks = new Map<string, TurnTask>()
  private readonly controllers = new Map<string, AbortController>()
  private readonly executions = new Map<string, Promise<TurnTask>>()

  /**
   * Starts an already durably accepted product task.  The delivery boundary is
   * deliberately explicit: callers cannot accidentally run an Actor before
   * `trunk/branch-delivery-committed` exists.
   */
  runAfterDelivery<T>(input: { taskId: string; deliveryCommitted: boolean; operation: (signal: AbortSignal) => Promise<T>; budgetMs?: number }): Promise<TurnTask> {
    if (!input.deliveryCommitted) return Promise.resolve({ taskId: input.taskId, status: 'blocked', reason: 'budget-exceeded' })
    return this.run(input.taskId, input.operation, input.budgetMs)
  }

  async run<T>(taskId: string, operation: (signal: AbortSignal) => Promise<T>, budgetMs = 30_000): Promise<TurnTask> {
    const prior = this.executions.get(taskId)
    if (prior) return prior
    const completed = this.tasks.get(taskId)
    if (completed) return completed
    const controller = new AbortController()
    const task: TurnTask = { taskId, status: 'running' }
    this.tasks.set(taskId, task)
    this.controllers.set(taskId, controller)
    const execution = (async (): Promise<TurnTask> => {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const value = await Promise.race([
          operation(controller.signal),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('budget exceeded'), { code: 'budget-exceeded' })), budgetMs) }),
        ])
        // A non-cooperative Actor can still resolve after cancellation.  Its
        // output must never become a durable product result.
        if (!controller.signal.aborted) {
          task.result = value
          task.status = 'completed'
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          task.status = 'blocked'
          task.reason = (error as { code?: unknown })?.code === 'budget-exceeded' ? 'budget-exceeded' : 'operation-failed'
          task.result = error
        }
      } finally {
        if (controller.signal.aborted) {
          task.status = 'cancelled'
          delete task.result
        }
        if (timer !== undefined) clearTimeout(timer)
        this.controllers.delete(taskId)
        this.executions.delete(taskId)
      }
      return task
    })()
    this.executions.set(taskId, execution)
    return execution
  }
  cancel(taskId: string): boolean { const task = this.tasks.get(taskId); const controller = this.controllers.get(taskId); if (!task || !controller || task.status !== 'running') return false; controller.abort(); return true }
  get(taskId: string): TurnTask | undefined { return this.tasks.get(taskId) }
}
