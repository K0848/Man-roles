// src/validation/mvp-report.ts
import { z } from "zod";
var mvpReportSchema = z.object({
  schemaVersion: z.literal(1),
  providerNetworkUsed: z.literal(false),
  tokenCost: z.literal(0),
  scenarios: z.array(z.string()).min(1),
  passed: z.literal(true),
  trace: z.object({ productConversations: z.literal(1), userRaws: z.number().int().min(1), branchEvents: z.number().int().min(1), taskCalls: z.number().int().nonnegative(), firstAccepted: z.literal(true), secondAccepted: z.literal(true), switchedTo: z.string().min(1), retryDidNotAppend: z.literal(true), deliveryInterrupted: z.literal(true), cancelLateResultRejected: z.literal(true), budgetDurable: z.literal(true), budgetPersonaIsOriginal: z.literal(true) }).strict()
}).strict();
function validateMvpReport(value) {
  return mvpReportSchema.parse(value);
}
export {
  mvpReportSchema,
  validateMvpReport
};
//# sourceMappingURL=mvp-report.js.map
