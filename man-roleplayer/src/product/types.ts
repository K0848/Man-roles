import { z } from 'zod'

/** Wire contract for the product control-plane smoke Remote. */
export const manRolesProbeRequestSchema = z.object({
  nonce: z.string().min(1),
}).strict()

export const manRolesProbeResponseSchema = z.object({
  ok: z.literal(true),
  nonce: z.string().min(1),
  service: z.literal('manRolesProbe'),
}).strict()

export type ManRolesProbeRequest = z.infer<typeof manRolesProbeRequestSchema>
export type ManRolesProbeResponse = z.infer<typeof manRolesProbeResponseSchema>

/** Product Remote payloads use stable operation identities.  Business failures
 * are returned as data so a Client can keep its current view and draft. */
// The delimiter is reserved for the stable Branch SessionId mapping.  Keeping
// it out of product conversation ids makes Client composer routing exact after
// a page reload rather than relying on an in-memory selection cache.
export const productConversationIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/).refine(value => !value.includes('--'), 'conversationId may not contain --')
export const productCreateRequestSchema = z.object({ conversationId: productConversationIdSchema, personaId: z.string().min(1) }).strict()
export const productViewRequestSchema = z.object({ conversationId: z.string().min(1) }).strict()
export const productSwitchRequestSchema = z.object({ conversationId: z.string().min(1), personaId: z.string().min(1), operationId: z.string().min(1) }).strict()
export const productSendRequestSchema = z.object({ conversationId: z.string().min(1), messageId: z.string().min(1), text: z.string() }).strict()
export const productFeedbackRequestSchema = z.object({ conversationId: z.string().min(1), itemId: z.string().min(1), action: z.enum(['confirm', 'partial-confirm', 'correct', 'reject', 'skip']), operationId: z.string().min(1), replacement: z.string().min(1).optional() }).strict()
export type ProductCreateRequest = z.infer<typeof productCreateRequestSchema>
export type ProductViewRequest = z.infer<typeof productViewRequestSchema>
export type ProductSwitchRequest = z.infer<typeof productSwitchRequestSchema>
export type ProductSendRequest = z.infer<typeof productSendRequestSchema>
export type ProductFeedbackRequest = z.infer<typeof productFeedbackRequestSchema>
