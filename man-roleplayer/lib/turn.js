// src/turn/ids.ts
import { randomUUID } from "node:crypto";
function newTurnIds(seed = "mr") {
  const suffix = randomUUID().slice(0, 8);
  return {
    turnId: `${seed}-turn-${suffix}`,
    taskId: `${seed}-task-${suffix}`,
    invocationId: `${seed}-inv-${suffix}`
  };
}
var IdempotencyRegistry = class _IdempotencyRegistry {
  done = /* @__PURE__ */ new Map();
  static keyOf(taskId, invocationId) {
    return `${taskId}:${invocationId}`;
  }
  /** 该 (task, invocation) 是否已执行完成（成功或失败均记录）。 */
  has(taskId, invocationId) {
    return this.done.has(_IdempotencyRegistry.keyOf(taskId, invocationId));
  }
  /**
   * 幂等执行：已执行则跳过；否则执行 fn 并记录结果。
   * fn 抛错时记录失败（防止重复提交重放失败调用），由调用方决定是否用新 invocation_id 重试。
   */
  tryRun(taskId, invocationId, fn) {
    const key = _IdempotencyRegistry.keyOf(taskId, invocationId);
    const memo = this.done.get(key);
    if (memo !== void 0) {
      if (memo instanceof IdempotencyError) return { status: "failed", error: memo.error };
      return { status: "skipped", value: memo };
    }
    try {
      const value = fn();
      this.done.set(key, value);
      return { status: "ran", value };
    } catch (error) {
      this.done.set(key, new IdempotencyError(error));
      return { status: "failed", error };
    }
  }
};
var IdempotencyError = class {
  constructor(error) {
    this.error = error;
  }
  error;
};
export {
  IdempotencyRegistry,
  newTurnIds
};
//# sourceMappingURL=turn.js.map
