// src/product/turn-runner.ts
var TurnRunner = class {
  tasks = /* @__PURE__ */ new Map();
  controllers = /* @__PURE__ */ new Map();
  executions = /* @__PURE__ */ new Map();
  /**
   * Starts an already durably accepted product task.  The delivery boundary is
   * deliberately explicit: callers cannot accidentally run an Actor before
   * `trunk/branch-delivery-committed` exists.
   */
  runAfterDelivery(input) {
    if (!input.deliveryCommitted) return Promise.resolve({ taskId: input.taskId, status: "blocked", reason: "budget-exceeded" });
    return this.run(input.taskId, input.operation, input.budgetMs);
  }
  async run(taskId, operation, budgetMs = 3e4) {
    const prior = this.executions.get(taskId);
    if (prior) return prior;
    const completed = this.tasks.get(taskId);
    if (completed) return completed;
    const controller = new AbortController();
    const task = { taskId, status: "running" };
    this.tasks.set(taskId, task);
    this.controllers.set(taskId, controller);
    const execution = (async () => {
      let timer;
      try {
        const value = await Promise.race([
          operation(controller.signal),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(Object.assign(new Error("budget exceeded"), { code: "budget-exceeded" })), budgetMs);
          })
        ]);
        if (!controller.signal.aborted) {
          task.result = value;
          task.status = "completed";
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          task.status = "blocked";
          task.reason = error?.code === "budget-exceeded" ? "budget-exceeded" : "operation-failed";
          task.result = error;
        }
      } finally {
        if (controller.signal.aborted) {
          task.status = "cancelled";
          delete task.result;
        }
        if (timer !== void 0) clearTimeout(timer);
        this.controllers.delete(taskId);
        this.executions.delete(taskId);
      }
      return task;
    })();
    this.executions.set(taskId, execution);
    return execution;
  }
  cancel(taskId) {
    const task = this.tasks.get(taskId);
    const controller = this.controllers.get(taskId);
    if (!task || !controller || task.status !== "running") return false;
    controller.abort();
    return true;
  }
  get(taskId) {
    return this.tasks.get(taskId);
  }
};
export {
  TurnRunner
};
//# sourceMappingURL=turn-runner.js.map
