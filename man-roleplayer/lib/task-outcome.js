// src/runtime/task-outcome.ts
var TASK_BUDGET_BLOCKED_MESSAGE = "\u672C\u8F6E\u6267\u884C\u5DF2\u505C\u6B62\uFF0C\u53EF\u91CD\u8BD5";
function projectTaskOutcome(_outcome) {
  return { status: "blocked", message: TASK_BUDGET_BLOCKED_MESSAGE, retryable: true };
}
export {
  TASK_BUDGET_BLOCKED_MESSAGE,
  projectTaskOutcome
};
//# sourceMappingURL=task-outcome.js.map
