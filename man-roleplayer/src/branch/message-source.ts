import { z } from 'zod'
import { personaIdSchema } from '../domain/schema.ts'
import type { PersonaRegistry } from '../persona/registry.ts'

/** Stable provenance carried by a BranchSession user/message projection. */
export const branchUserMessageSourceSchema = z.object({
  conversation_id: z.string().min(1),
  message_id: z.string().min(1),
  raw_ref: z.string().min(1),
  persona_id: personaIdSchema,
})
export type BranchUserMessageSource = z.infer<typeof branchUserMessageSourceSchema>

/**
 * DSH uses `source.kind` to decide whether a message is a user bubble or an
 * injected context row. Product delivery identity therefore belongs in the
 * message's durable extra metadata, never in `source.kind='plugin'`.
 */
export const BRANCH_USER_MESSAGE_EXTRA_KEY = 'man_roles_branch_delivery' as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Build plugin-owned metadata beside an ordinary DSH user message. */
export function branchUserMessageExtra(source: BranchUserMessageSource): Record<string, BranchUserMessageSource> {
  return { [BRANCH_USER_MESSAGE_EXTRA_KEY]: source }
}

/**
 * Read product delivery identity from a current user message or a legacy
 * plugin-sourced message. Legacy records remain readable and are never
 * rewritten merely to change transcript presentation.
 */
export function branchUserMessageSourceFromData(value: unknown): unknown {
  if (!isRecord(value)) return undefined
  const extra = isRecord(value.extra) ? value.extra[BRANCH_USER_MESSAGE_EXTRA_KEY] : undefined
  return extra ?? value.source
}

/** Both live DSH events and old fixtures may wrap the message in `data.message`. */
export function branchUserMessageFromData(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined
  return isRecord(value.message) ? value.message : value
}

/** Parse a persisted source at the compatibility boundary without rewriting it. */
export function parseBranchUserMessageSource(value: unknown, registry: PersonaRegistry): BranchUserMessageSource {
  if (!value || typeof value !== 'object') throw new Error('invalid branch message source')
  const raw = value as Record<string, unknown>
  return branchUserMessageSourceSchema.parse({ ...raw, persona_id: registry.normalizePersistedId(String(raw.persona_id)) })
}
