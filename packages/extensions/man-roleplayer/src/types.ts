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
/**
 * Return the registered definition for one persona id.
 * @param persona - Registered persona identity.
 * @returns The audited registry entry.
 * @throws If the supplied id is absent from the registry.
 */
export function personaDefinition(persona: PersonaId): typeof PERSONA_REGISTRY[number] {
  const definition = PERSONA_REGISTRY.find(item => item.id === persona)
  if (definition === undefined) throw new Error(`unknown persona '${persona}'`)
  return definition
}
/**
 * Return whether an untrusted value names one registered persona.
 * @param value - Untrusted persona value from a request or deployment binding.
 * @returns Whether the value is a registered persona string.
 */
export function isPersonaId(value: unknown): value is PersonaId {
  return typeof value === 'string' && PERSONA_REGISTRY.some(persona => persona.id === value)
}
/** Product discussion admission state; paused and ended discussions require explicit resume. */
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

/** Browser timeline entry with accepted answer text and product references, excluding raw Session identities. */
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

/** One user-visible structured-choice option. */
export interface RoleplayerChoiceOption {
  readonly label: string
  readonly description?: string
}
/** One product-scoped question with optional options, free text, or multiple selection. */
export interface RoleplayerChoiceQuestion {
  readonly id: string
  readonly question: string
  readonly header?: string
  readonly detail?: string
  readonly options?: readonly RoleplayerChoiceOption[]
  readonly multiSelect?: boolean
}
/** User selection, custom response, or explicit skip for one structured question. */
export interface RoleplayerChoiceAnswer {
  readonly id: string
  readonly selected: readonly string[]
  readonly custom?: string
  /** Explicit user skip; an empty answer is invalid. */
  readonly skipped?: boolean
}
/** Latest browser-safe lifecycle of the choice owned by one persona turn. */
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

/** Client-selectable persona id and display name, excluding Host research/preset paths. */
export interface RoleplayerPersonaOption {
  readonly id: PersonaId
  readonly displayName: string
}

/** Typed browser-safe failure code and message with optional deletion retry details. */
export interface RoleplayerFailure {
  readonly code: 'unknown-dilemma' | 'revision-conflict' | 'archived' | 'deleting' | 'deletion-failed' | 'paused' | 'stage-ended' | 'invalid-request' | 'internal'
  readonly message: string
  readonly details?: { readonly stage?: string; readonly operationId?: string }
}

/** Discriminated Remote outcome; only successful results contain the requested value. */
export type RoleplayerResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RoleplayerFailure }

/** Versioned list query with optional inclusion of archived dilemmas. */
export interface RoleplayerListRequest {
  readonly version: ManRoleplayerProtocolVersion
  readonly includeArchived?: boolean
}
/** Idempotent blank-dilemma creation request; explicit persona selection is checked by the Remote. */
export interface RoleplayerCreateRequest {
  readonly version: ManRoleplayerProtocolVersion
  readonly requestId: ManRoleplayerRequestId
  readonly activePersona: PersonaId
  /** New clients select one or more distinct personas; omission retains the legacy Wang/Zeng pair for old callers. */
  readonly personas?: readonly PersonaId[]
}
/** Versioned request identifying a dilemma through its opaque browser handle. */
export interface RoleplayerHandleRequest {
  readonly version: ManRoleplayerProtocolVersion
  readonly handle: DilemmaHandle
}
/** Idempotent mutation with optimistic concurrency against the lifecycle revision. */
export interface RoleplayerMutationRequest extends RoleplayerHandleRequest {
  readonly requestId: ManRoleplayerRequestId
  readonly expectedRevision: number
}
/** User-owned title mutation; blank titles are rejected. */
export interface RoleplayerRenameRequest extends RoleplayerMutationRequest {
  readonly title: string
}
/** Answers submitted to a matching pending product choice operation. */
export interface RoleplayerChoiceAnswerRequest extends RoleplayerMutationRequest {
  readonly choiceOperationId: ManRoleplayerOperationId
  readonly answers: readonly RoleplayerChoiceAnswer[]
}
/** Cancellation targeting one pending product choice operation. */
export interface RoleplayerChoiceCancelRequest extends RoleplayerMutationRequest {
  readonly choiceOperationId: ManRoleplayerOperationId
}
/** Retry identity for an original message and its failed persona-turn attempt. */
export interface RoleplayerRetryRequest extends RoleplayerMutationRequest {
  readonly messageId: ManRoleplayerOperationId
  readonly failedTurnOperationId: ManRoleplayerOperationId
}
/** User message with stable delivery/turn identities and an optional accepted-answer reply target. */
export interface RoleplayerSubmitRequest extends RoleplayerMutationRequest {
  readonly messageId: ManRoleplayerOperationId
  readonly deliveryOperationId: ManRoleplayerOperationId
  readonly turnOperationId: ManRoleplayerOperationId
  readonly text: string
  readonly replyToTimelineEventId?: string
}
/** Matching message/delivery/turn identities used to cancel a live product lease. */
export interface RoleplayerCancelRequest extends RoleplayerMutationRequest {
  readonly messageId: ManRoleplayerOperationId
  readonly deliveryOperationId: ManRoleplayerOperationId
  readonly turnOperationId: ManRoleplayerOperationId
}
/** Target persona for a stopped dilemma; a missing branch is allocated before activation. */
export interface RoleplayerSwitchRequest extends RoleplayerMutationRequest {
  readonly persona: PersonaId
}
/** Stable shared-state item targeted by an explicit user transition. */
export interface RoleplayerStateRequest extends RoleplayerMutationRequest {
  readonly itemId: string
}
/** Failed analysis identity and stable new retry identity; no persona turn is replayed. */
export interface RoleplayerStateRetryRequest extends RoleplayerMutationRequest {
  readonly stateOperationId: ManRoleplayerOperationId
  readonly retryOperationId: ManRoleplayerOperationId
}
/** User-authored replacement text and optional kind for a modifiable state item. */
export interface RoleplayerStateModifyRequest extends RoleplayerMutationRequest {
  readonly itemId: string
  readonly text: string
  readonly kind?: 'fact' | 'goal' | 'conflict' | 'unresolved' | 'understanding'
}
/** Evidence id targeted by a user challenge, withdrawal, or explicit review. */
export interface RoleplayerEvidenceRequest extends RoleplayerMutationRequest {
  readonly evidenceId: string
}
/** Stable deletion operation identity retained across checkpoint and response-loss retries. */
export interface RoleplayerDeleteRequest extends RoleplayerMutationRequest {
  readonly operationId: ManRoleplayerOperationId
}
/** Minimal completion acknowledgement that reveals no deleted conversation content. */
export interface RoleplayerDeletedValue {
  readonly handle: DilemmaHandle
  readonly deleted: true
}

/** Remote outcome containing filtered redacted dilemma projections. */
export type RoleplayerListResult = RoleplayerResult<readonly RoleplayerProjection[]>
/** Remote outcome containing the audited client persona roster. */
export type RoleplayerRosterResult = RoleplayerResult<readonly RoleplayerPersonaOption[]>
/** Remote outcome containing one redacted dilemma projection. */
export type RoleplayerProjectionResult = RoleplayerResult<RoleplayerProjection>
/** Remote outcome containing only the minimal deletion acknowledgement. */
export type RoleplayerDeleteResult = RoleplayerResult<RoleplayerDeletedValue>
