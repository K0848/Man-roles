// src/validation/task5-report.ts
import { z } from "zod";
var recoveryItem = z.object({ rawRef: z.string().min(1), messageId: z.string().min(1), personaId: z.string().min(1).optional(), status: z.enum(["committed", "recovered", "failed"]), failureCode: z.string().min(1).optional() }).strict();
var request = z.object({ provider: z.string(), model: z.string(), usageTokens: z.number().int().nonnegative() }).strict();
var reportSchema = z.object({ stage: z.literal("stage2"), pid: z.number().int().positive(), expectedPersonaIds: z.array(z.string().min(1)), stage1Pid: z.number().int().positive(), stage2Pid: z.number().int().positive(), processRestart: z.boolean(), dshPersistence: z.boolean(), providerObservation: z.object({ recoveryStreamCalls: z.number().int().nonnegative(), scriptedRequests: z.number().int().nonnegative(), scriptedOnly: z.boolean(), providerNetworkUsed: z.boolean(), tokenCost: z.number().int().nonnegative(), requests: z.array(request).optional() }).strict(), recovery: z.object({ deliveries: z.array(recoveryItem), compensation: z.object({ status: z.enum(["not-needed", "compensated", "failed"]) }).optional() }).strict(), before: z.object({ byPersona: z.record(z.string(), z.number().int().nonnegative()), committed: z.number().int().nonnegative(), sources: z.record(z.string(), z.array(z.unknown())).optional() }).strict(), after: z.object({ byPersona: z.record(z.string(), z.number().int().nonnegative()), committed: z.number().int().nonnegative(), sources: z.record(z.string(), z.array(z.unknown())).optional() }).strict(), derivedState: z.object({ persisted: z.boolean(), generationCalls: z.number().int().nonnegative() }).strict(), cancel: z.object({ aborted: z.boolean(), assistantCount: z.number().int().nonnegative(), lateAssistant: z.number().int().nonnegative(), persistedDerived: z.number().int().nonnegative(), derivedAttempt: z.number().int().nonnegative().optional(), derivedResult: z.object({ status: z.enum(["skipped", "committed"]) }).strict(), requests: z.array(request), usageTokens: z.number().int().nonnegative().optional() }).strict(), restored: z.record(z.string(), z.array(z.object({ message_id: z.string(), raw_ref: z.string(), persona_id: z.string() }).strict())), assistant: z.record(z.string(), z.array(z.string())), order: z.array(z.string()), isolation: z.record(z.string(), z.boolean()), counts: z.object({ userSources: z.number().int().nonnegative(), committed: z.number().int().nonnegative() }).strict(), scenarios: z.object({ identical: z.object({ same1: z.object({ raw: z.number().int().nonnegative(), branch: z.number().int().nonnegative() }).strict(), same2: z.object({ raw: z.number().int().nonnegative(), branch: z.number().int().nonnegative() }).strict() }).strict(), retry: z.object({ raw: z.number().int().nonnegative(), branch: z.number().int().nonnegative(), committed: z.number().int().nonnegative() }).strict(), acceptedOnly: z.object({ beforeBranch: z.number().int().nonnegative(), afterBranch: z.number().int().nonnegative(), committed: z.boolean(), status: z.enum(["committed", "recovered", "failed"]), failureCode: z.string().optional() }).strict(), branchOnly: z.object({ beforeBranch: z.number().int().nonnegative(), afterBranch: z.number().int().nonnegative(), committed: z.boolean(), status: z.enum(["committed", "recovered", "failed"]), failureCode: z.string().optional() }).strict(), assistantState: z.object({ assistantByPersona: z.record(z.string(), z.number().int().nonnegative()), derivedPersisted: z.boolean(), generation: z.number().int().nonnegative() }).strict(), cancel: z.object({ aborted: z.boolean(), targetTurnAssistantCount: z.number().int().nonnegative(), lateMarkerCount: z.number().int().nonnegative(), derivedMarkerCount: z.number().int().nonnegative(), localRequests: z.number().int().nonnegative() }).strict() }).strict(), authority: z.record(z.string(), z.unknown()).optional() }).strict();
function validateTask5Report(report, expectedPersonaIds) {
  const parsed = reportSchema.safeParse(report);
  if (!parsed.success) return { passed: false, hardGateFailures: ["report-invalid"] };
  const r = parsed.data;
  const f = [];
  const ids = [...expectedPersonaIds];
  const unique = new Set(ids);
  const keys = (v) => Object.keys(v ?? {}).sort();
  const n = (ok, code) => {
    if (!ok) f.push(code);
  };
  if (r.before.sources && r.after.sources) {
    n(JSON.stringify(keys(r.before.sources)) === JSON.stringify([...ids].sort()) && JSON.stringify(keys(r.after.sources)) === JSON.stringify([...ids].sort()), "before-after-keys");
    const all = Object.values(r.restored).flat();
    const refs = all.map((x) => `${x.raw_ref}|${x.message_id}`);
    n(new Set(refs).size === refs.length, "duplicate-sources");
    ids.forEach((id) => (r.restored[id] ?? []).forEach((x) => n(x.persona_id === id, `source-owner-${id}`)));
  }
  n(ids.length > 0 && unique.size === ids.length && JSON.stringify([...r.expectedPersonaIds].sort()) === JSON.stringify([...ids].sort()), "expected-persona-ids");
  n(r.stage1Pid !== r.stage2Pid && r.processRestart, "restart-pids");
  n(JSON.stringify(keys(r.restored)) === JSON.stringify([...ids].sort()), "restored-personas");
  n(JSON.stringify(keys(r.assistant)) === JSON.stringify([...ids].sort()), "assistant-personas");
  n(JSON.stringify(keys(r.isolation)) === JSON.stringify([...ids].sort()), "isolation-keys");
  ids.forEach((id) => {
    const own = (r.assistant[id] ?? []).some((x) => x.includes(`private-${id}`));
    const foreign = (r.assistant[id] ?? []).some((x) => ids.some((q) => q !== id && x.includes(`private-${q}`)));
    n(own && !foreign && (r.isolation[id] ?? false) === own, `isolation-${id}`);
  });
  n(JSON.stringify(keys(r.scenarios.assistantState.assistantByPersona)) === JSON.stringify([...ids].sort()) && ids.every((id) => (r.scenarios.assistantState.assistantByPersona[id] ?? 0) === (r.assistant[id] ?? []).length), "assistant-state");
  n(r.processRestart && r.dshPersistence, "restart");
  n(r.counts.committed === r.after.committed && (!r.before.sources || r.counts.userSources === Object.values(r.restored).reduce((n2, x) => n2 + x.length, 0)), "committed");
  n(r.providerObservation.recoveryStreamCalls === 0 && r.providerObservation.scriptedOnly && !r.providerObservation.providerNetworkUsed && r.providerObservation.tokenCost === 0 && r.cancel.requests.every((q) => q.usageTokens === 0), "provider");
  n(r.cancel.requests.length === r.providerObservation.scriptedRequests && r.cancel.requests.every((q) => q.provider === "man-roles-compat-local" && q.model === "scripted-no-network"), "provider-identity");
  n(r.scenarios.retry.raw === 1 && r.scenarios.retry.branch === 1 && r.scenarios.retry.committed === 1, "retry");
  n(r.scenarios.acceptedOnly.beforeBranch === 0 && r.scenarios.acceptedOnly.afterBranch === 1 && r.scenarios.acceptedOnly.committed, "accepted-only");
  n(r.scenarios.branchOnly.beforeBranch === 1 && r.scenarios.branchOnly.afterBranch === 1 && r.scenarios.branchOnly.committed, "branch-only");
  n(r.derivedState.persisted && r.derivedState.generationCalls === 0, "derived-state");
  n(r.cancel.aborted && r.cancel.assistantCount === 0 && r.cancel.lateAssistant === 0 && r.cancel.persistedDerived === 0 && (r.cancel.derivedAttempt === void 0 || r.cancel.derivedAttempt === 1) && r.cancel.derivedResult.status === "skipped", "cancel");
  n(r.scenarios.cancel.localRequests === r.cancel.requests.length, "cancel-request");
  n(r.recovery.deliveries.length === r.after.committed && r.recovery.deliveries.every((x) => x.status === "recovered" || x.status === "committed"), "recovery-items");
  const committedDeliveries = r.recovery.deliveries.filter((x) => x.status === "committed").length;
  const recoveredDeliveries = r.recovery.deliveries.filter((x) => x.status === "recovered").length;
  n(r.before.committed === committedDeliveries, "before-committed");
  n(r.after.committed === r.before.committed + recoveredDeliveries, "after-committed");
  return { passed: f.length === 0, hardGateFailures: f };
  if (r.before.sources && r.after.sources) {
    n(JSON.stringify(keys(r.before.sources)) === JSON.stringify([...ids].sort()) && JSON.stringify(keys(r.after.sources)) === JSON.stringify([...ids].sort()), "before-after-keys");
    const all = Object.values(r.restored).flat();
    const refs = all.map((x) => `${x.raw_ref}|${x.message_id}`);
    n(new Set(refs).size === refs.length, "duplicate-sources");
    ids.forEach((id) => {
      for (const source of r.restored[id] ?? []) n(source.persona_id === id, `source-owner-${id}`);
    });
  }
  n(JSON.stringify(r.order) === JSON.stringify(["same-1", "same-2", "retry-1", "accepted-only", "branch-only"]), "order");
  return { passed: f.length === 0, hardGateFailures: f };
}
export {
  validateTask5Report
};
//# sourceMappingURL=task5-report.js.map
