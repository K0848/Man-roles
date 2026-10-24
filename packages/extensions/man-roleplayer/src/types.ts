/** Wire-safe Host projection and operation vocabulary for the browser client. */

import type { Branded } from '@deepseek-ai/dsh-brand'
import type { ExecutionState } from './product/index.ts'

/** One audited persona definition shared by Host, Remote, client and deployment bindings. */
export const PERSONA_REGISTRY = [
  { id: 'wang-yangming', displayName: '王阳明', presetId: 'wang-yangming', researchFileName: '调研成果-王阳明.md' },
  { id: 'zeng-guofan', displayName: '曾国藩', presetId: 'zeng-guofan', researchFileName: '调研成果-曾国藩.md' },
  { id: 'zhuangzi', displayName: '庄子', presetId: 'zhuangzi', researchFileName: '调研成果-庄子.md' },
  { id: 'su-shi', displayName: '苏轼', presetId: 'su-shi', researchFileName: '调研成果-苏轼.md' },
  { id: 'zhu-xi', displayName: '朱熹', presetId: 'zhu-xi', researchFileName: '调研成果-朱熹.md' },
] as const
/** Stable persona ids available to the product client and Host. */
export const PERSONA_IDS = PERSONA_REGISTRY.map(persona => persona.id) as unknown as readonly [PersonaId, ...PersonaId[]]
/** Compatibility pair used only when replaying legacy create requests. */
export const LEGACY_PERSONAS = [PERSONA_REGISTRY[0].id, PERSONA_REGISTRY[1].id] as const
/** Client-safe persona vocabulary; no Host product imports cross this face. */
export type PersonaId = typeof PERSONA_REGISTRY[number]['id']
/** User-facing names and deployment bindings derived from the single registry. */
export const PERSONA_DISPLAY_NAMES: Readonly<Record<PersonaId, string>> = Object.fromEntries(
  PERSONA_REGISTRY.map(persona => [persona.id, persona.displayName]),
) as Record<PersonaId, string>
/** Return the registered definition for one persona id. */
export function personaDefinition(persona: PersonaId) {
  const definition = PERSONA_REGISTRY.find(item => item.id === persona)
  if (definition === undefined) throw new Error(`unknown persona '${persona}'`)
  return definition
}
/** Return whether an untrusted value names one registered persona. */
export function isPersonaId(value: unknown): value is PersonaId {
  return typeof value === 'string' && PERSONA_REGISTRY.some(persona => persona.id === value)
}
export type DiscussionStatus = 'in_progress' | 'paused' | 'stage_ended'

/** Finite per-persona-turn execution limits. */
export interface TurnBudget {
  readonly maxModelRequests: number
  readonly maxToolCalls: number
  readonly activeTimeoutMs: number
  readonly requestTimeoutMs: number
  readonly noProgressLimit: number
  readonly stopTimeoutMs: number
}

/** Protocol revision for the man-roleplayer Remote surface. */
export type ManRoleplayerProtocolVersion = number
/** Opaque browser handle; it never exposes a DSH Session id. */
export type DilemmaHandle = Branded<'DilemmaHandle'>
/** Client-created operation/message identity. */
export type ManRoleplayerOperationId = Branded<'ManRoleplayerOperationId'>
/** One product request identity used for idempotency. */
export type ManRoleplayerRequestId = Branded<'ManRoleplayerRequestId'>

export interface RoleplayerTimelineItem {
  readonly id: string
  readonly kind: 'user-message' | 'persona-message' | 'choice-answer' | 'system-status'
  readonly persona?: PersonaId
  readonly status?: 'pending' | 'delivered' | 'completed' | 'cancelled' | 'failed'
  readonly operationId?: string
  /** Persisted user reply target, referring to a persona timeline item's stable id. */
  readonly replyToTimelineEventId?: string
  /** Accepted persona answer text; ordinary Session assistant/tool text is omitted. */
  readonly text?: string
  /** Host-validated accepted claim ranges; evidence正文 is never copied here. */
  readonly claims?: readonly { readonly start: number; readonly end: number; readonly kind: string; readonly evidenceIds: readonly string[]; readonly status: 'accepted' | 'stale' }[]
}

export interface RoleplayerChoiceOption {
  readonly label: string
  readonly description?: string
}
export interface RoleplayerChoiceQuestion {
  readonly id: string
  readonly question: string
  readonly header?: string
  readonly detail?: string
  readonly options?: readonly RoleplayerChoiceOption[]
  readonly multiSelect?: boolean
}
export interface RoleplayerChoiceAnswer {
  readonly id: string
  readonly selected: readonly string[]
  readonly custom?: string
  /** Explicit user skip; an empty answer is invalid. */
  readonly skipped?: boolean
}
export interface RoleplayerChoiceState {
  readonly operationId: string
  readonly turnOperationId: string
  readonly persona: PersonaId
  readonly status: 'pending' | 'answered' | 'cancelled' | 'failed'
  readonly questions?: readonly RoleplayerChoiceQuestion[]
  readonly answers?: readonly RoleplayerChoiceAnswer[]
}

/** Product projection deliberately redacted of raw branch Session ids. */
export interface RoleplayerProjection {
  readonly handle: DilemmaHandle
  readonly activePersona: PersonaId
  readonly discussionStatus?: DiscussionStatus
  readonly branches: readonly { readonly persona: PersonaId }[]
  readonly timeline: readonly RoleplayerTimelineItem[]
  readonly title?: string
  readonly titleRevision?: number
  readonly titleUserOwned?: boolean
  readonly archived?: boolean
  readonly deletion?: {
    readonly operationId: ManRoleplayerOperationId
    readonly stage: string
    readonly irreversible: boolean
    readonly retryable: boolean
  }
  /** Redacted evidence lifecycle facts; research正文 never crosses this wire. */
  readonly evidence?: readonly {
    readonly id: string
    readonly persona: PersonaId
    readonly status: 'available' | 'challenged' | 'withdrawn'
    readonly evidenceType?: string
    readonly trustLevel?: string
    readonly title?: string
    readonly text?: string
    readonly source?: string
  }[]
  readonly evidenceActivity?: readonly {
    readonly operationId: string
    readonly status: 'completed-with-results' | 'completed-zero-hit' | 'budget-exhausted' | 'cancelled' | 'failed'
    readonly returnedCount: number
  }[]
  /** Current durable state-analysis result, without private Session content. */
  readonly state?: {
    readonly operationId?: ManRoleplayerOperationId
    readonly retryable?: boolean
    readonly failureCategory?: 'provider' | 'parse' | 'context' | 'stale'
    readonly status: 'claimed' | 'running' | 'completed' | 'failed' | 'stale'
    readonly candidates?: readonly { readonly id: string; readonly kind: string; readonly text: string }[]
    readonly sharedStateItems?: readonly {
      readonly id: string
      readonly persona: PersonaId
      readonly kind: 'fact' | 'goal' | 'conflict' | 'unresolved' | 'understanding'
      readonly text: string
      readonly status: 'candidate' | 'confirmed' | 'rejected' | 'superseded' | 'withdrawn' | 'resolved'
      readonly revision: number
    }[]
    readonly personaSnapshot?: {
      readonly persona: PersonaId
      readonly currentUnderstanding: string
      readonly coreView: string
      readonly advice?: string
      readonly revision: number
    }
  }
  readonly choice?: RoleplayerChoiceState
  readonly activeTurn?: { readonly messageId: ManRoleplayerOperationId; readonly deliveryOperationId: ManRoleplayerOperationId; readonly turnOperationId: ManRoleplayerOperationId; readonly persona: PersonaId; readonly status: 'pending' | 'running' | 'waiting-choice'; readonly executionState: ExecutionState }
  /** Product activity plus reasoning derived from the matching persona Session; no Session/tool/prompt metadata. */
  readonly activity?: readonly { readonly id: string; readonly messageId: string; readonly turnOperationId: string; readonly persona: PersonaId; readonly phase: 'received' | 'thinking' | 'researching' | 'evidence-check' | 'finalizing' | 'completed' | 'failed' | 'cancelled'; readonly startedAt: number; readonly endedAt?: number; readonly durationMs?: number; readonly count?: number; readonly stages?: readonly { readonly phase: string; readonly startedAt: number; readonly endedAt?: number; readonly durationMs?: number; readonly count?: number }[]; readonly reasoning?: { readonly persona: PersonaId; readonly turnOperationId: string; readonly status: 'running' | 'completed' | 'failed' | 'cancelled'; readonly text: string } }[]
  readonly revision: number
}

export interface RoleplayerPersonaOption {
  readonly id: PersonaId
  readonly displayName: string
}

export interface RoleplayerFailure {
  readonly code: 'unknown-dilemma' | 'revision-conflict' | 'archived' | 'deleting' | 'deletion-failed' | 'paused' | 'stage-ended' | 'invalid-request' | 'internal'
  readonly message: string
  readonly details?: { readonly stage?: string; readonly operationId?: string }
}

export type RoleplayerResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RoleplayerFailure }

export interface RoleplayerListRequest {
  readonly version: ManRoleplayerProtocolVersion
  readonly includeArchived?: boolean
}
export interface RoleplayerCreateRequest {
  readonly version: ManRoleplayerProtocolVersion
  readonly requestId: ManRoleplayerRequestId
  readonly activePersona: PersonaId
  /** New clients select one or more distinct personas; omission retains the legacy Wang/Zeng pair for old callers. */
  readonly personas?: readonly PersonaId[]
}
export interface RoleplayerHandleRequest {
  readonly version: ManRoleplayerProtocolVersion
  readonly handle: DilemmaHandle
}
export interface RoleplayerMutationRequest extends RoleplayerHandleRequest {
  readonly requestId: ManRoleplayerRequestId
  readonly expectedRevision: number
}
export interface RoleplayerRenameRequest extends RoleplayerMutationRequest {
  readonly title: string
}
export interface RoleplayerChoiceAnswerRequest extends RoleplayerMutationRequest {
  readonly choiceOperationId: ManRoleplayerOperationId
  readonly answers: readonly RoleplayerChoiceAnswer[]
}
export interface RoleplayerChoiceCancelRequest extends RoleplayerMutationRequest {
  readonly choiceOperationId: ManRoleplayerOperationId
}
export interface RoleplayerRetryRequest extends RoleplayerMutationRequest {
  readonly messageId: ManRoleplayerOperationId
  readonly failedTurnOperationId: ManRoleplayerOperationId
}
export interface RoleplayerSubmitRequest extends RoleplayerMutationRequest {
  readonly messageId: ManRoleplayerOperationId
  readonly deliveryOperationId: ManRoleplayerOperationId
  readonly turnOperationId: ManRoleplayerOperationId
  readonly text: string
  readonly replyToTimelineEventId?: string
}
export interface RoleplayerCancelRequest extends RoleplayerMutationRequest {
  readonly messageId: ManRoleplayerOperationId
  readonly deliveryOperationId: ManRoleplayerOperationId
  readonly turnOperationId: ManRoleplayerOperationId
}
export interface RoleplayerSwitchRequest extends RoleplayerMutationRequest {
  readonly persona: PersonaId
}
export interface RoleplayerStateRequest extends RoleplayerMutationRequest {
  readonly itemId: string
}
export interface RoleplayerStateRetryRequest extends RoleplayerMutationRequest {
  readonly stateOperationId: ManRoleplayerOperationId
  readonly retryOperationId: ManRoleplayerOperationId
}
export interface RoleplayerStateModifyRequest extends RoleplayerMutationRequest {
  readonly itemId: string
  readonly text: string
  readonly kind?: 'fact' | 'goal' | 'conflict' | 'unresolved' | 'understanding'
}
export interface RoleplayerEvidenceRequest extends RoleplayerMutationRequest {
  readonly evidenceId: string
}
export interface RoleplayerDeleteRequest extends RoleplayerMutationRequest {
  readonly operationId: ManRoleplayerOperationId
}
export interface RoleplayerDeletedValue {
  readonly handle: DilemmaHandle
  readonly deleted: true
}

export type RoleplayerListResult = RoleplayerResult<readonly RoleplayerProjection[]>
export type RoleplayerRosterResult = RoleplayerResult<readonly RoleplayerPersonaOption[]>
export type RoleplayerProjectionResult = RoleplayerResult<RoleplayerProjection>
export type RoleplayerDeleteResult = RoleplayerResult<RoleplayerDeletedValue>
