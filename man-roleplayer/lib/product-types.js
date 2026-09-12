// src/product/types.ts
import { z } from "zod";
var manRolesProbeRequestSchema = z.object({
  nonce: z.string().min(1)
}).strict();
var manRolesProbeResponseSchema = z.object({
  ok: z.literal(true),
  nonce: z.string().min(1),
  service: z.literal("manRolesProbe")
}).strict();
var productConversationIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/).refine((value) => !value.includes("--"), "conversationId may not contain --");
var productCreateRequestSchema = z.object({ conversationId: productConversationIdSchema, personaId: z.string().min(1) }).strict();
var productViewRequestSchema = z.object({ conversationId: z.string().min(1) }).strict();
var productSwitchRequestSchema = z.object({ conversationId: z.string().min(1), personaId: z.string().min(1), operationId: z.string().min(1) }).strict();
var productSendRequestSchema = z.object({ conversationId: z.string().min(1), messageId: z.string().min(1), text: z.string() }).strict();
var productFeedbackRequestSchema = z.object({ conversationId: z.string().min(1), itemId: z.string().min(1), action: z.enum(["confirm", "partial-confirm", "correct", "reject", "skip"]), operationId: z.string().min(1), replacement: z.string().min(1).optional() }).strict();
export {
  manRolesProbeRequestSchema,
  manRolesProbeResponseSchema,
  productConversationIdSchema,
  productCreateRequestSchema,
  productFeedbackRequestSchema,
  productSendRequestSchema,
  productSwitchRequestSchema,
  productViewRequestSchema
};
//# sourceMappingURL=product-types.js.map
