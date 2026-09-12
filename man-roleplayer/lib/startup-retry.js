// src/e2e/startup-retry.ts
async function decideStartupRetry(agentMatches, code, retryCount, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {
  if (!agentMatches || code !== "MISSING_CREDENTIAL" && code !== "NO_ADAPTER" || retryCount >= 30) return void 0;
  await wait(500);
  return { kind: "retry" };
}
export {
  decideStartupRetry
};
//# sourceMappingURL=startup-retry.js.map
