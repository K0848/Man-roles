// src/e2e/native-evidence-failure-replay.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
var FIXTURE_PATH = join(process.cwd(), "tests", "fixtures", "native-evidence-real-failure-replay.json");
function isFixture(value) {
  if (typeof value !== "object" || value === null) return false;
  const item = value;
  return typeof item.id === "string" && typeof item.sourceRunId === "string" && typeof item.kind === "string" && Array.isArray(item.completed) && Array.isArray(item.skipped) && Number.isFinite(item.totalTokens) && Number.isFinite(item.tokenLimit) && Array.isArray(item.observed);
}
function loadHistoricalFailureFixtures(path = FIXTURE_PATH) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed) || parsed.length !== 6 || parsed.some((item) => !isFixture(item))) throw new Error("invalid native evidence failure replay fixture");
  return parsed;
}
function replayHistoricalFailure(fixture) {
  const common = { id: fixture.id, sourceRunId: fixture.sourceRunId, kind: fixture.kind, identified: true, historicalReportReplay: true, scriptedNativeAgentLoop: false };
  switch (fixture.kind) {
    case "cacheRead-budget-overrun":
      return { ...common, state: "budget-blocked", expectedSignals: ["batch-token-limit-exceeded", "scenarios-skipped", "token-limit-exceeded"] };
    case "evidence-followed-by-raw-text":
      return { ...common, state: "repairable", expectedSignals: ["historical_fact:product-reply-missing", "historical_fact:historical-evidence-missing"] };
    case "repair-followed-by-raw-text":
      return { ...common, state: "repairable", expectedSignals: ["adversarial:submit-repair-budget", "adversarial:repair-sequence"] };
    case "duplicate-successful-submit":
      return { ...common, state: "rejected", expectedSignals: ["adversarial:submit-repair-budget", "adversarial:gate"] };
    case "quote-normalization-mismatch":
      return { ...common, state: "pass-after-normalization", expectedSignals: ["verbatim_quote:evidence-gate"] };
    case "cross-person-fence-rejection":
      return { ...common, state: "pass-after-fence", expectedSignals: ["cross-person:cross-person-fence-failed", "cross-person:cross-person-canonical-rejection-missing"] };
  }
}
function replayHistoricalFailures(path) {
  return loadHistoricalFailureFixtures(path).map(replayHistoricalFailure);
}
export {
  loadHistoricalFailureFixtures,
  replayHistoricalFailure,
  replayHistoricalFailures
};
//# sourceMappingURL=native-evidence-failure-replay.js.map
