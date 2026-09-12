import type { PersonaId } from '../domain/schema.ts'

export type SegmentKind = 'dialogue' | 'historical_fact' | 'verbatim_quote' | 'thought_attribution' | 'modern_inference' | 'modern_external_fact'
export type EvidenceKind = 'anecdote' | 'quote' | 'web'

export interface ActorReplySegment {
  kind: SegmentKind
  text: string
  evidenceIds?: string[]
}
export interface EvidenceGrant {
  evidenceId: string
  kind: EvidenceKind
  personaId: PersonaId
  turnId: string
}

export interface EvidenceViolation {
  code: string
  segmentIndex?: number
  detail: string
}

export interface EvidenceValidationResult {
  ok: boolean
  violations: EvidenceViolation[]
  segments: ActorReplySegment[]
}
