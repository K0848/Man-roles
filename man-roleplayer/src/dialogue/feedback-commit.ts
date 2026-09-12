import type { FeedbackKind } from './types.ts'
import type { PersonaId, TrunkState } from '../domain/schema.ts'
import type { TrunkStorage } from '../storage/trunk-storage.ts'
import { z } from 'zod'

/** Feedback is a product command, not an untyped collection of optional fields. */
export const feedbackPayloadSchema = z.object({
  kind: z.enum(['none', 'confirm', 'partial-confirm', 'correct', 'reject', 'new-information', 'reality-changed', 'disagree-persona', 'not-helpful', 'question-evidence', 'action-feedback', 'skip', 'continue', 'pause', 'end', 'unclear']),
  itemId: z.string().min(1).optional(), replacement: z.unknown().optional(), details: z.object({ summary: z.string().trim().min(1), lastSemanticSeq: z.number().optional() }).strict().optional(),
}).strict()
export type FeedbackPayload = z.infer<typeof feedbackPayloadSchema>

export interface FeedbackCommitInput { trunk: TrunkStorage; state: TrunkState; kind: FeedbackKind; personaId: PersonaId; messageId: string; taskId: string; eventPurpose: string; sourceRawRefs: string[]; itemId?: string; replacement?: unknown; details?: Record<string, unknown> }
const reviewed = new Set<FeedbackKind>(['confirm', 'partial-confirm', 'correct', 'reject', 'skip'])

function orderedSourceRefs(trunk: TrunkStorage, refs: readonly string[]): string[] {
  const unique = [...new Set(refs)]
  const order = new Map(trunk.state.userRaws.map((raw, index) => [raw.rawRef, index]))
  return unique.sort((a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER))
}

export function commitFeedback(input: FeedbackCommitInput): number | undefined {
  if (reviewed.has(input.kind)) {
    if (!input.itemId) throw new Error(`${input.kind} requires itemId`)
    const action = input.kind === 'partial-confirm' ? 'partial-confirm' : input.kind
    if (action !== 'reject' && action !== 'skip' && input.replacement === undefined) throw new Error(`${input.kind} requires replacement`)
    const replacementRefs = input.replacement && typeof input.replacement === 'object' && Array.isArray((input.replacement as { sourceRawRefs?: unknown }).sourceRawRefs)
      ? (input.replacement as { sourceRawRefs: string[] }).sourceRawRefs
      : []
    const meta = { messageId: input.messageId, taskId: input.taskId, eventPurpose: input.eventPurpose, sourceRawRefs: orderedSourceRefs(input.trunk, [...input.sourceRawRefs, ...replacementRefs]) }
    return input.trunk.reviewDilemmaItem(input.itemId, input.replacement, { ...meta, action, personaId: input.personaId })
  }
  const meta = { messageId: input.messageId, taskId: input.taskId, eventPurpose: input.eventPurpose, sourceRawRefs: input.sourceRawRefs }
  if (input.kind === 'pause' || input.kind === 'end' || input.kind === 'continue') return input.trunk.recordSessionControl({ ...meta, control: input.kind === 'continue' ? 'resume' : input.kind, personaId: input.personaId })
  if (input.kind === 'question-evidence') return input.trunk.recordAction({ ...meta, action: 'question-evidence', details: input.details ?? {} })
  if (input.kind === 'disagree-persona' || input.kind === 'not-helpful') {
    const summary = input.details?.summary
    if (!summary) throw new Error(`${input.kind} requires details.summary`)
    return input.trunk.updateBranchProgress({ personaId: input.personaId, summary, lastSemanticSeq: input.details?.lastSemanticSeq ?? input.trunk.nextSeq }, meta)
  }
  if (input.kind === 'new-information' || input.kind === 'reality-changed' || input.kind === 'action-feedback') return input.trunk.recordAction({ ...meta, action: input.kind, details: input.details ?? {} })
  return undefined
}
export const applyFeedbackCommit = commitFeedback
