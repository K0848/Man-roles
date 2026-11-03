/** Pure product domain for a dilemma with independently owned persona branches. */

import { SessionId as dshSessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionId as DshSessionId } from '@deepseek-ai/dsh-session/types'
import type { PersonaId } from '../types.ts'

export type { PersonaId } from '../types.ts'
/** Durable discussion admission state; pausing or ending a stage blocks new persona turns. */
export type DiscussionStatus = 'in_progress' | 'paused' | 'stage_ended'
/** Host-owned durable dilemma identity; browser callers receive an opaque handle instead. */
export type DilemmaId = string & { readonly __dilemmaId: unique symbol }
/** Stable request identity used for append-only event deduplication. */
export type RequestId = string & { readonly __requestId: unique symbol }
/** Stable product operation identity retained across recovery. */
export type OperationId = string & { readonly __operationId: unique symbol }
/** Stable product user-message identity shared by its delivery and turn attempts. */
export type MessageId = string & { readonly __messageId: unique symbol }
/** Distinct delivery attempt identity; retries must not reuse a completed attempt. */
export type DeliveryOperationId = OperationId & { readonly __deliveryOperationId: unique symbol }
/** Distinct persona-turn attempt identity, including retries of the same message. */
export type TurnOperationId = OperationId & { readonly __turnOperationId: unique symbol }
/** Branded product revision for optimistic concurrency. */
export type Revision = number & { readonly __revision: unique symbol }
/** DSH-owned Session identity used only on the Host product side. */
export type SessionId = DshSessionId

/**
 * Brand a Host-owned string as a durable dilemma id; no validation or allocation occurs.
 * @param value - Caller-owned durable dilemma identity.
 * @returns The same string branded as a dilemma id.
 */
export const dilemmaId = (value: string): DilemmaId => value as DilemmaId
/**
 * Brand a caller-owned string as a request deduplication id without validation.
 * @param value - Caller-owned stable deduplication identity.
 * @returns The same string branded as a request id.
 */
export const requestId = (value: string): RequestId => value as RequestId
/**
 * Brand a caller-owned string as a stable product operation id without validation.
 * @param value - Caller-owned stable operation identity.
 * @returns The same string branded as a product operation id.
 */
export const operationId = (value: string): OperationId => value as OperationId
/**
 * Brand a caller-owned string as a product message id without validation.
 * @param value - Caller-owned stable user-message identity.
 * @returns The same string branded as a product message id.
 */
export const messageId = (value: string): MessageId => value as MessageId
/**
 * Brand a caller-owned string as a delivery attempt id without validation.
 * @param value - Caller-owned identity for one delivery attempt.
 * @returns The same string branded as a delivery operation id.
 */
export const deliveryOperationId = (value: string): DeliveryOperationId => value as DeliveryOperationId
/**
 * Brand a caller-owned string as a persona-turn attempt id without validation.
 * @param value - Caller-owned identity for one persona-turn attempt.
 * @returns The same string branded as a turn operation id.
 */
export const turnOperationId = (value: string): TurnOperationId => value as TurnOperationId
/** Reuse the DSH Session id constructor so product branches retain the canonical identity type. */
export const sessionId = dshSessionId

/** Durable identity of the persona composition bound to one branch. */
export interface PersonaPresetIdentity {
  readonly presetId: string
  readonly assemblyDigest: string
  readonly persona: PersonaId
  readonly researchFingerprint: string
}
/** One isolated persona Session and its optional persisted preset/research identity. */
export interface PersonaBranch {
  readonly persona: PersonaId
  readonly sessionId: SessionId
  readonly presetIdentity?: PersonaPresetIdentity
}
/** Durable claim for a branch whose Session may exist before its membership is published. */
export interface BranchAllocation {
  readonly operationId: OperationId
  readonly persona: PersonaId
  readonly sessionId: SessionId
  readonly presetIdentity?: PersonaPresetIdentity
  readonly expectedLifecycleRevision: number
  readonly status: 'claimed' | 'ready' | 'failed'
}
/** Product timeline categories; persona entries retain Session references instead of answer copies. */
export type TimelineKind = 'user-message' | 'persona-message' | 'choice-answer' | 'state-action' | 'system-status'
/** Durable product timeline reference; only user expressions are stored as inline text. */
export interface TimelineReference {
  readonly id: string
  readonly kind: TimelineKind
  readonly persona?: PersonaId
  readonly sessionId?: SessionId
  readonly sourceEventId?: string
  readonly status?: 'pending' | 'delivered' | 'completed' | 'cancelled' | 'failed'
  readonly operationId?: OperationId
  /** 用户消息所引用的人物回合；重放时直接保留已持久化的关系。 */
  readonly replyToTimelineEventId?: string
  /** User expression only; persona/session body is never projected here. */
  readonly text?: string
}
/** Replayed product facts and operation checkpoints, excluding private persona answer bodies. */
export interface DilemmaConversation {
  readonly id: DilemmaId
  readonly activePersona: PersonaId
  readonly discussionStatus: DiscussionStatus
  readonly branches: readonly PersonaBranch[]
  readonly branchAllocations: readonly BranchAllocation[]
  readonly timeline: readonly TimelineReference[]
  readonly seenRequests: readonly RequestId[]
  readonly deletion?: DeletionOperation
  readonly title?: string
  /** Monotonic title-generation revision; user renames invalidate older claims. */
  readonly titleRevision: number
  /** User-owned titles permanently suppress automatic title results. */
  readonly titleUserOwned: boolean
  readonly archived?: boolean
  readonly revision: number
  /** Monotonic revision of every accepted product fact for Remote CAS. */
  readonly lifecycleRevision: number
  /** Latest durable shared-state records, projected without private Session text. */
  readonly sharedStateItems: readonly SharedStateItem[]
  /** Latest snapshot for each persona, sourced from that persona's completed turn. */
  readonly personaSnapshots: readonly PersonaSnapshot[]
  readonly choice?: ChoiceState
  readonly activities?: readonly (Extract<ProductEvent, { type: 'activity' }> & {
    readonly stages?: readonly { readonly phase: Extract<ProductEvent, { type: 'activity' }>['phase']; readonly startedAt: number; readonly endedAt?: number; readonly durationMs?: number; readonly count?: number }[] | undefined
  })[]
}

/** Durable lifecycle of one product-to-Session message delivery attempt. */
export type DeliveryStatus = 'pending' | 'claimed' | 'delivered' | 'failed' | 'cancelled'
/** Durable persona-turn result; execution quiescence is tracked independently. */
export type TurnStatus = 'claimed' | 'running' | 'completed' | 'failed' | 'cancelled'
/** Durable execution state kept separate from the user-visible turn result. */
export type ExecutionState = 'running' | 'waiting-user' | 'stopping' | 'stopped' | 'stop-failed' | 'unknown'
/** Durable analysis lifecycle; stale results cannot replace current shared state. */
export type StateStatus = 'claimed' | 'running' | 'completed' | 'failed' | 'stale'
/** Model-proposed state with explicit source references; confirmation remains Host/user controlled. */
export interface StateCandidate {
  readonly id: string
  readonly kind: 'fact' | 'goal' | 'conflict' | 'unresolved' | 'understanding'
  readonly text: string
  readonly sourceEventIds: readonly string[]
  /** Model proposal only; Host verifies exact user wording before auto-confirming. */
  readonly confirmation?: 'explicit' | 'needs-confirmation'
  readonly sourceQuote?: string
}
/** User-governed lifecycle of one immutable shared-state version. */
export type SharedStateItemStatus = 'candidate' | 'confirmed' | 'rejected' | 'superseded' | 'withdrawn' | 'resolved'
/** Latest version of a sourced shared-state item, retaining its decision and producing operation. */
export interface SharedStateItem {
  readonly id: string
  readonly persona: PersonaId
  readonly kind: StateCandidate['kind']
  readonly text: string
  readonly sourceEventIds: readonly string[]
  readonly status: SharedStateItemStatus
  /** Durable audit of why this item did or did not require confirmation. */
  readonly confirmation?: 'explicit' | 'needs-confirmation'
  readonly revision: number
  readonly sourceOperationId: OperationId
}
/** Structured current understanding from one persona's completed turn, with stable sources. */
export interface PersonaSnapshot {
  readonly persona: PersonaId
  readonly sourceTurnOperationId: TurnOperationId
  readonly sourceEventIds: readonly string[]
  readonly revision: number
  readonly currentUnderstanding: string
  readonly coreView: string
  readonly advice?: string
}
/** Audit of allowed/excluded event references for one persona's model input. */
export interface ContextProjection {
  readonly operationId: OperationId
  readonly persona: PersonaId
  readonly allowedEventIds: readonly string[]
  readonly excludedEventIds: readonly string[]
  readonly inputFingerprint?: string
  readonly modelInputBytes?: number
}

/** Stable, provider-facing state input captured at the operation claim. */
export type StateAnalysisInputProjection = readonly Record<string, unknown>[]

/** One selectable label and optional explanation in a product-owned question. */
export interface ChoiceOption {
  readonly label: string
  readonly description?: string
}
/** Structured question accepted from the owning persona turn. */
export interface ChoiceQuestion {
  readonly id: string
  readonly question: string
  readonly header?: string
  readonly detail?: string
  readonly options?: readonly ChoiceOption[]
  readonly multiSelect?: boolean
}
/** Explicit user selection, custom response, or skip; omission of content alone is not a skip. */
export interface ChoiceAnswer {
  readonly id: string
  readonly selected: readonly string[]
  readonly custom?: string
  /** 用户显式跳过；空答案本身不代表跳过。 */
  readonly skipped?: boolean
}
/** Durable lifecycle of one product-owned structured choice. */
export type ChoiceStatus = 'pending' | 'answered' | 'cancelled' | 'failed'
/** Latest questions and settlement belonging to one persona-turn operation. */
export interface ChoiceState {
  readonly operationId: OperationId
  readonly turnOperationId: TurnOperationId
  readonly persona: PersonaId
  readonly status: ChoiceStatus
  readonly questions?: readonly ChoiceQuestion[]
  readonly answers?: readonly ChoiceAnswer[]
}

/** Append-only product facts; request ids deduplicate mutations and Session references retain private history ownership. */
export type ProductEvent =
  | { readonly type: 'created'; readonly id: DilemmaId; readonly branches: readonly PersonaBranch[]; readonly activePersona: PersonaId; readonly requestId: RequestId }
  | { readonly type: 'branch-allocation'; readonly allocation: BranchAllocation; readonly requestId: RequestId }
  | { readonly type: 'branch-added'; readonly operationId: OperationId; readonly branch: PersonaBranch; readonly requestId: RequestId }
  | { readonly type: 'persona-switched'; readonly persona: PersonaId; readonly requestId: RequestId; readonly timelineId: string }
  | { readonly type: 'discussion-status'; readonly status: DiscussionStatus; readonly requestId: RequestId }
  | { readonly type: 'archived'; readonly requestId: RequestId }
  | { readonly type: 'restored'; readonly requestId: RequestId }
  | { readonly type: 'user-message'; readonly id: string; readonly persona: PersonaId; readonly requestId: RequestId; readonly content?: string; readonly messageId?: MessageId; readonly deliveryOperationId?: DeliveryOperationId; readonly status?: DeliveryStatus; readonly replyToTimelineEventId?: string; readonly sessionEventId?: string }
  | { readonly type: 'message-retry'; readonly messageId: MessageId; readonly previousTurnOperationId: TurnOperationId; readonly previousDeliveryOperationId: DeliveryOperationId; readonly turnOperationId: TurnOperationId; readonly deliveryOperationId: DeliveryOperationId; readonly requestId: RequestId }
  | { readonly type: 'persona-message'; readonly id: string; readonly persona: PersonaId; readonly sessionId: SessionId; readonly sourceEventId: string; readonly requestId: RequestId }
  | { readonly type: 'deletion'; readonly operation: DeletionOperation; readonly requestId: RequestId }
  | { readonly type: 'deletion-cancelled'; readonly operationId: OperationId; readonly requestId: RequestId }
  | { readonly type: 'message-delivery'; readonly messageId: MessageId; readonly deliveryOperationId: DeliveryOperationId; readonly persona: PersonaId; readonly status: DeliveryStatus; readonly sessionMessageId?: string; readonly sessionEventId?: string; readonly replyToTimelineEventId?: string; readonly requestId: RequestId }
  | { readonly type: 'turn'; readonly turnOperationId: TurnOperationId; readonly messageId: MessageId; readonly persona: PersonaId; readonly status: TurnStatus; readonly sessionEventId?: string; readonly requestId: RequestId }
  | { readonly type: 'turn-execution'; readonly turnOperationId: TurnOperationId; readonly messageId: MessageId; readonly persona: PersonaId; readonly state: ExecutionState; readonly error?: string; readonly requestId: RequestId }
  | { readonly type: 'turn-budget'; readonly turnOperationId: TurnOperationId; readonly messageId: MessageId; readonly persona: PersonaId; readonly modelRequests: number; readonly toolCalls: number; readonly noProgressCount: number; readonly inputTokens?: number; readonly outputTokens?: number; readonly cacheReadTokens?: number; readonly cacheWriteTokens?: number; readonly status: 'running' | 'budget-exhausted' | 'completed' | 'failed' | 'cancelled'; readonly requestId: RequestId }
  | { readonly type: 'activity'; readonly id: OperationId; readonly messageId: MessageId; readonly turnOperationId: TurnOperationId; readonly persona: PersonaId; readonly phase: 'received' | 'thinking' | 'researching' | 'evidence-check' | 'finalizing' | 'completed' | 'failed' | 'cancelled'; readonly startedAt: number; readonly endedAt?: number; readonly durationMs?: number; readonly count?: number; readonly requestId: RequestId }
  | { readonly type: 'context-projection'; readonly projection: ContextProjection; readonly requestId: RequestId }
  | { readonly type: 'state-analysis'; readonly operationId: OperationId; readonly inputWatermark: string; readonly revision: number; readonly branchRevision: number; readonly contextRevision?: number; readonly status: StateStatus; readonly failureCategory?: 'provider' | 'parse' | 'context'; readonly failureDetail?: string; readonly candidates?: readonly StateCandidate[]; readonly persona?: PersonaId; readonly inputProjection?: StateAnalysisInputProjection; readonly modelInputProjection?: StateAnalysisInputProjection; readonly sourceOperationId?: OperationId; readonly requestId: RequestId }
  | { readonly type: 'shared-state'; readonly item: SharedStateItem; readonly requestId: RequestId }
  | { readonly type: 'persona-snapshot'; readonly snapshot: PersonaSnapshot; readonly requestId: RequestId }
  | { readonly type: 'title'; readonly operationId: OperationId; readonly status: 'claimed' | 'completed' | 'fallback' | 'stale' | 'suppressed'; readonly value?: string; readonly titleRevision?: number; readonly requestId: RequestId }
  | { readonly type: 'renamed'; readonly title: string; readonly titleRevision?: number; readonly requestId: RequestId }
  | { readonly type: 'evidence'; readonly evidenceId: string; readonly status: 'available' | 'challenged' | 'withdrawn'; readonly persona?: PersonaId; readonly evidenceType?: string; readonly trustLevel?: string; readonly source?: string; readonly sourceFingerprint?: string; readonly toolOperationId?: OperationId; readonly requestId: RequestId }
  | { readonly type: 'safety-blocked'; readonly messageId: MessageId; readonly safetyOperationId: OperationId; readonly persona: PersonaId; readonly content: string; readonly kind: 'danger' | 'professional'; readonly reason: string; readonly requestId: RequestId }
  | { readonly type: 'system-safety-reply'; readonly safetyOperationId: OperationId; readonly messageId: MessageId; readonly text: string; readonly requestId: RequestId }
  | { readonly type: 'persona-acknowledgement'; readonly id: string; readonly sourcePersona: PersonaId; readonly sourceUserMessageId: string; readonly sourcePersonaMessageId: string; readonly status: 'active' | 'withdrawn'; readonly requestId: RequestId }
  | { readonly type: 'evidence-tool-claim'; readonly operationId: OperationId; readonly turnOperationId: OperationId; readonly persona: PersonaId; readonly sessionId: SessionId; readonly topic: string; readonly requestedCount: number; readonly reservedCount: number; readonly reservedBytes: number; readonly deadline: number; readonly evidenceRevision: number; readonly fingerprint: string; readonly returnedEvidenceIds?: readonly string[]; readonly status: 'claimed' | 'completed' | 'failed' | 'cancelled'; readonly requestId: RequestId }
  | { readonly type: 'claim-sidecar'; readonly turnOperationId: OperationId; readonly textRange: { readonly start: number; readonly end: number }; readonly kind: 'reliable-quote' | 'historical-fact' | 'attribution' | 'modern-inference' | 'insufficient-evidence'; readonly evidenceIds: readonly string[]; readonly status: 'accepted' | 'stale'; readonly requestId: RequestId }
  | { readonly type: 'choice'; readonly operationId: OperationId; readonly turnOperationId: TurnOperationId; readonly persona: PersonaId; readonly status: ChoiceStatus; readonly questions?: readonly ChoiceQuestion[]; readonly answers?: readonly ChoiceAnswer[]; readonly requestId: RequestId }

/** Recoverable deletion checkpoint, including legacy branch labels retained for persisted operations. */
export type DeletionStage = 'requested' | 'stopping-agents'
  | 'deleting-branch' | 'deleting-first-branch' | 'deleting-second-branch'
  | 'deleting-wang' | 'deleting-zeng'
  | 'deleting-product' | 'completed' | 'failed'
type ResumeStage = Exclude<DeletionStage, 'completed' | 'failed'>
/** Stable deletion identity and progress; irreversible checkpoints can only resume the same operation. */
export interface DeletionOperation {
  readonly operationId: OperationId
  readonly stage: DeletionStage
  readonly irreversible: boolean
  readonly error?: string
  /** Immutable branch targets captured before any destructive Session delete. */
  readonly targets?: readonly PersonaBranch[]
  readonly completedSessionIds?: readonly SessionId[]
  readonly currentSessionId?: SessionId
  /** The persisted checkpoint that a failed operation must retry. */
  readonly resumeStage?: ResumeStage
}
/** Minimal product-global proof retained after successful deletion. */
export type DeletionReceipt = {
  readonly operationId: OperationId
  readonly handleDigest: string
  readonly status: 'pending'
  readonly deleted: true
} | {
  readonly operationId: OperationId
  readonly handleDigest: string
  readonly status: 'completed'
  readonly completedAt: number
  readonly deleted: true
}

function resumeStageOf(operation: DeletionOperation): ResumeStage {
  if (operation.stage !== 'failed' || operation.resumeStage === undefined) {
    throw new Error('failed deletion operation is missing its resume stage')
  }
  return operation.resumeStage
}

/**
 * Replay one append-only product log, deduplicating request ids and validating branch relationships.
 * @param events - Ordered log beginning with exactly one created event and isolated distinct persona branches.
 * @returns The current product projection without private persona response bodies.
 * @throws If the creation event or persisted branch relationships are invalid.
 */
export function project(events: readonly ProductEvent[]): DilemmaConversation {
  const [created] = events
  if (created?.type !== 'created') throw new Error('dilemma projection requires a leading created event')
  if (events.slice(1).some(event => event.type === 'created')) throw new Error('dilemma projection accepts exactly one created event')
  const byPersona = new Map(created.branches.map(branch => [branch.persona, branch]))
  if (created.branches.length === 0 || byPersona.size !== created.branches.length) throw new Error('dilemma projection requires nonempty distinct persona branches')
  if (!byPersona.has(created.activePersona)) throw new Error('dilemma projection active persona is not one of its branches')
  const sessionIds = new Set(created.branches.map(branch => branch.sessionId))
  if (sessionIds.size !== created.branches.length) throw new Error('dilemma projection requires isolated persona sessions')
  const branchAllocations = new Map<PersonaId, BranchAllocation>()
  let activePersona = created.activePersona
  let discussionStatus: DiscussionStatus = 'in_progress'
  let deletion: DeletionOperation | undefined
  let title: string | undefined
  let titleRevision = 0
  let titleUserOwned = false
  let archived = false
  let revision = 0
  let lifecycleRevision = 0
  const timeline: TimelineReference[] = []
  const userRefs = new Map<string, TimelineReference>()
  const turnRefs = new Map<TurnOperationId, TimelineReference>()
  const sharedState = new Map<string, SharedStateItem>()
  const personaSnapshots = new Map<PersonaId, PersonaSnapshot>()
  const activities = new Map<string, Extract<ProductEvent, { type: 'activity' }>>()
  const activityStages = new Map<string, Extract<ProductEvent, { type: 'activity' }>['phase'] extends never ? never : { phase: Extract<ProductEvent, { type: 'activity' }>['phase']; startedAt: number; endedAt?: number; durationMs?: number; count?: number }[]>()
  let choice: ChoiceState | undefined
  const seen = new Set<RequestId>()
  for (const event of events) {
    if (seen.has(event.requestId)) continue
    seen.add(event.requestId)
    // Progress facts are durable observations, not user/product mutations;
    // they must not invalidate a concurrent CAS operation.
    if (!['activity', 'turn-execution', 'turn-budget', 'context-projection', 'state-analysis'].includes(event.type)) lifecycleRevision += 1
    if (event.type === 'branch-allocation') {
      const allocation = event.allocation
      const prior = branchAllocations.get(allocation.persona)
      if (byPersona.has(allocation.persona) || sessionIds.has(allocation.sessionId)
        || (prior !== undefined && (prior.operationId !== allocation.operationId || prior.sessionId !== allocation.sessionId))) {
        throw new Error('branch allocation conflicts with a persisted persona or Session')
      }
      branchAllocations.set(allocation.persona, allocation)
    }
    if (event.type === 'branch-added') {
      const allocation = branchAllocations.get(event.branch.persona)
      if (allocation === undefined || allocation.operationId !== event.operationId
        || allocation.sessionId !== event.branch.sessionId
        || byPersona.has(event.branch.persona) || sessionIds.has(event.branch.sessionId)) {
        throw new Error('branch addition does not match its persisted allocation')
      }
      byPersona.set(event.branch.persona, event.branch)
      sessionIds.add(event.branch.sessionId)
    }
    if (event.type === 'persona-switched') {
      if (!byPersona.has(event.persona)) throw new Error('persona switch requires an associated branch')
      activePersona = event.persona
      timeline.push({ id: event.timelineId, kind: 'system-status', persona: event.persona })
    }
    if (event.type === 'discussion-status') {
      discussionStatus = event.status
      timeline.push({ id: `discussion:${event.requestId}`, kind: 'system-status', status: 'delivered' })
    }
    if (event.type === 'user-message') {
      const messageKey = event.messageId ?? event.id
      const prior = userRefs.get(messageKey)
      const next = {
        id: event.id, kind: 'user-message' as const, persona: event.persona,
        ...(event.content === undefined ? {} : { text: event.content }),
        ...(event.status === undefined || event.status === 'claimed' ? {} : { status: event.status }),
        ...(event.deliveryOperationId === undefined ? {} : { operationId: event.deliveryOperationId }),
        ...(event.replyToTimelineEventId === undefined ? {} : { replyToTimelineEventId: event.replyToTimelineEventId }),
      }
      if (prior === undefined) { timeline.push(next); userRefs.set(messageKey, next) }
      else {
        // A delivery reconciliation appends a second fact for the same
        // message. Keep one wire item while merging the latest status and the
        // original user text; duplicate timeline rows would misrepresent one
        // product operation as two user messages after reload.
        Object.assign(prior, next)
      }
    }
    if (event.type === 'persona-message') {
      if (byPersona.get(event.persona)?.sessionId !== event.sessionId) {
        throw new Error('persona message must reference its own branch session')
      }
      timeline.push({ id: event.id, kind: 'persona-message', persona: event.persona, sessionId: event.sessionId, sourceEventId: event.sourceEventId })
    }
    if (event.type === 'renamed') {
      titleRevision = event.titleRevision ?? titleRevision + 1
      titleUserOwned = true
      title = event.title
    }
    if (event.type === 'archived') archived = true
    if (event.type === 'restored') archived = false
    if (event.type === 'title' && event.status !== 'claimed' && event.status !== 'stale' && event.status !== 'suppressed'
      && title === undefined && !titleUserOwned
      && (event.titleRevision === undefined || event.titleRevision === titleRevision)) title = event.value
    if (event.type === 'state-analysis' && event.status === 'completed') revision = Math.max(revision, event.revision)
    if (event.type === 'shared-state') sharedState.set(event.item.id, event.item)
    if (event.type === 'persona-snapshot') personaSnapshots.set(event.snapshot.persona, event.snapshot)
    if (event.type === 'activity') { activities.set(String(event.id), event); const stages = activityStages.get(String(event.id)) ?? []; stages.push({ phase: event.phase, startedAt: event.startedAt, ...(event.endedAt === undefined ? {} : { endedAt: event.endedAt }), ...(event.durationMs === undefined ? {} : { durationMs: event.durationMs }), ...(event.count === undefined ? {} : { count: event.count }) }); activityStages.set(String(event.id), stages) }
    if (event.type === 'choice') {
      choice = {
        operationId: event.operationId, turnOperationId: event.turnOperationId, persona: event.persona,
        status: event.status,
        ...(event.questions === undefined ? {} : { questions: event.questions }),
        ...(event.answers === undefined ? {} : { answers: event.answers }),
      }
      if (event.status === 'answered' || event.status === 'cancelled' || event.status === 'failed') {
        timeline.push({ id: `choice:${event.operationId}`, kind: 'choice-answer', persona: event.persona, status: event.status === 'answered' ? 'completed' : event.status, operationId: event.operationId })
      }
    }
    if (event.type === 'message-delivery') {
      const prior = userRefs.get(String(event.messageId))
      const ref = { id: event.messageId, kind: 'user-message' as const, persona: event.persona, status: event.status === 'delivered' ? 'delivered' as const : event.status === 'pending' ? 'pending' as const : event.status === 'failed' ? 'failed' as const : event.status === 'cancelled' ? 'cancelled' as const : 'pending' as const, operationId: event.deliveryOperationId, ...(event.replyToTimelineEventId === undefined ? {} : { replyToTimelineEventId: event.replyToTimelineEventId }) }
      if (prior === undefined) { timeline.push(ref); userRefs.set(String(event.messageId), ref) }
      else Object.assign(prior, { ...ref, ...(prior.text === undefined ? {} : { text: prior.text }) })
    }
    if (event.type === 'turn') {
      const status = event.status === 'completed' ? 'completed' as const : event.status === 'cancelled' ? 'cancelled' as const : event.status === 'failed' ? 'failed' as const : undefined
      if (status !== undefined) {
        const prior = turnRefs.get(event.turnOperationId)
        // Cancellation is a durable terminal decision. A late assistant event
        // remains in the private Session but can never become product-visible.
        if (prior?.status === 'cancelled' || prior?.status === 'completed') continue
        if (event.sessionEventId !== undefined) {
          const ref = { id: event.turnOperationId, kind: 'persona-message' as const, persona: event.persona, sourceEventId: event.sessionEventId, status, operationId: event.turnOperationId }
          if (prior === undefined) { timeline.push(ref); turnRefs.set(event.turnOperationId, ref) } else Object.assign(prior, ref)
        } else if (prior === undefined) {
          const ref = { id: event.turnOperationId, kind: 'system-status' as const, persona: event.persona, status, operationId: event.turnOperationId }
          timeline.push(ref); turnRefs.set(event.turnOperationId, ref)
        }
      }
    }
    if (event.type === 'deletion') deletion = event.operation
    if (event.type === 'deletion-cancelled') {
      if (deletion?.operationId !== event.operationId || deletion.stage !== 'requested') {
        throw new Error('only the current requested deletion may be cancelled')
      }
      deletion = undefined
    }
  }
  const projectedActivities = [...activities.values()].map((item) => {
    const stages = activityStages.get(String(item.id))
    return { ...item, ...(stages === undefined ? {} : { stages }) }
  })
  return {
    id: created.id, activePersona, discussionStatus,
    branches: [...byPersona.values()], branchAllocations: [...branchAllocations.values()],
    timeline, seenRequests: [...seen],
    ...(deletion === undefined ? {} : { deletion }), ...(title === undefined ? {} : { title }),
    ...(archived ? { archived: true } : {}), titleRevision, titleUserOwned, revision, lifecycleRevision,
    sharedStateItems: [...sharedState.values()], personaSnapshots: [...personaSnapshots.values()],
    ...(choice === undefined ? {} : { choice }),
    ...(activities.size === 0 ? {} : { activities: projectedActivities }),
  }
}

/**
 * Return the event ids that are legal model input for one persona branch.
 * @param events - Ordered product facts for one created dilemma.
 * @param persona - Persona whose own Session input is being assembled.
 * @returns Allowed shared/user sources and excluded private-persona event ids.
 * @throws If the log does not begin with a created event.
 */
export function allowedContext(events: readonly ProductEvent[], persona: PersonaId): ContextProjection {
  const created = events[0]; if (created?.type !== 'created') throw new Error('context requires a created dilemma')
  const excluded: string[] = []; const allowed: string[] = []
  const blocked = new Set(events.filter((event): event is Extract<ProductEvent, { type: 'safety-blocked' }> => event.type === 'safety-blocked').map(event => String(event.messageId)))
  const delivered = new Set(deliveredUserMessageIds(events, blocked))
  const acknowledgements = new Map<string, Extract<ProductEvent, { type: 'persona-acknowledgement' }>>()
  const sharedStateLatest = new Map<string, Extract<ProductEvent, { type: 'shared-state' }>>()
  for (const event of events) if (event.type === 'persona-acknowledgement') acknowledgements.set(event.id, event)
  for (const event of events) if (event.type === 'shared-state') sharedStateLatest.set(event.item.id, event)
  // An acknowledgement points at the original user message, which remains
  // shared context. Only the later acknowledgement reply that depends on the
  // source persona's answer is excluded below.
  const acknowledgedUserIds = new Set<string>()
  for (const event of events) {
    if (event.type === 'user-message' && event.replyToTimelineEventId !== undefined
      && [...acknowledgements.values()].some(ack => event.id !== ack.sourceUserMessageId
        && ack.sourcePersona !== persona && ack.status === 'active'
        && ack.sourcePersonaMessageId === event.replyToTimelineEventId
        && isPersonaAcknowledgementText(event.content)
        && isActivePersonaAcknowledgement(events, ack))) acknowledgedUserIds.add(event.id)
  }
  for (const event of events) {
    if (event.type === 'persona-message' && event.persona !== persona) excluded.push(event.sourceEventId)
    else if (event.type === 'context-projection') continue
    else if (event.type === 'state-analysis' && event.status !== 'completed') continue
    else if (event.type === 'user-message' && delivered.has(event.id) && !acknowledgedUserIds.has(event.id)) allowed.push(event.id)
    else if (event.type === 'shared-state' && sharedStateLatest.get(event.item.id) === event && event.item.status === 'confirmed') allowed.push(event.item.id)
    else if (event.type === 'choice' && event.status === 'answered') allowed.push(String(event.operationId))
    else if (event.type === 'persona-acknowledgement') continue
  }
  for (const event of acknowledgements.values()) if (event.status === 'active' && event.sourcePersona !== persona && isActivePersonaAcknowledgement(events, event)) allowed.push(event.id)
  return { operationId: operationId(`context:${persona}`), persona, allowedEventIds: [...new Set(allowed)], excludedEventIds: excluded }
}

/** Recognize only the fixed, low-information replies that depend on a persona answer. */
function isPersonaAcknowledgementText(text: string | undefined): boolean {
  if (text === undefined) return false
  const normalized = text.replace(/\s+/gu, ' ').trim()
  return normalized === '你说得对' || normalized === '我认同' || normalized === '我赞同'
}

/**
 * Return user ids with a matching delivered delivery and complete Session references.
 * @param events - Product user-message and delivery facts.
 * @param blocked - Message identities to exclude, normally the safety-blocked set; defaults to empty.
 * @returns User event ids with latest delivered facts and complete Session references.
 */
export function deliveredUserMessageIds(events: readonly ProductEvent[], blocked = new Set<string>()): readonly string[] {
  const users = new Map<string, Extract<ProductEvent, { type: 'user-message' }>>()
  const deliveries = new Map<string, Extract<ProductEvent, { type: 'message-delivery' }>>()
  for (const event of events) {
    if (event.type === 'user-message') users.set(event.id, event)
    if (event.type === 'message-delivery') deliveries.set(String(event.messageId), event)
  }
  return [...users].filter(([, user]) => {
    const delivery = deliveries.get(user.messageId ?? user.id)
    return user.status === 'delivered' && !blocked.has(user.messageId ?? user.id) && delivery?.status === 'delivered'
      && delivery.sessionMessageId !== undefined && delivery.sessionEventId !== undefined
  }).map(([id]) => id)
}

/**
 * Check that an acknowledgement still references one delivered user and one completed source turn.
 * @param events - Product facts used to verify the source user delivery and turn.
 * @param acknowledgement - Acknowledgement whose active status and source references are checked.
 * @returns Whether every referenced delivery, persona, reply target, and completed turn still matches.
 */
export function isActivePersonaAcknowledgement(events: readonly ProductEvent[], acknowledgement: Extract<ProductEvent, { type: 'persona-acknowledgement' }>): boolean {
  if (acknowledgement.status !== 'active') return false
  const user = events.findLast(event => event.type === 'user-message' && event.id === acknowledgement.sourceUserMessageId)
  const delivery = events.findLast(event => event.type === 'message-delivery' && String(event.messageId) === acknowledgement.sourceUserMessageId)
  const turn = events.findLast(event => event.type === 'turn' && String(event.turnOperationId) === acknowledgement.sourcePersonaMessageId)
  return user?.type === 'user-message' && user.persona === acknowledgement.sourcePersona
    && user.status === 'delivered' && delivery?.type === 'message-delivery' && delivery.status === 'delivered'
    && delivery.sessionMessageId !== undefined && delivery.sessionEventId !== undefined
    && delivery.persona === acknowledgement.sourcePersona && turn?.type === 'turn'
    && turn.persona === acknowledgement.sourcePersona && turn.messageId === acknowledgement.sourceUserMessageId
    && user.replyToTimelineEventId === acknowledgement.sourcePersonaMessageId
    && turn.status === 'completed' && turn.sessionEventId !== undefined
}

/**
 * Whether a state-analysis result can commit against the current durable watermark.
 * @param result - Analysis result proposed for commitment.
 * @param inputWatermark - Current durable input watermark.
 * @param revision - Current product analysis revision.
 * @param branchRevision - Current completed-turn revision for the target branch.
 * @returns Whether the completed result matches all three current revision values.
 */
export function stateResultIsCurrent(result: Extract<ProductEvent, { type: 'state-analysis' }>, inputWatermark: string, revision: number, branchRevision: number): boolean {
  return result.status === 'completed' && result.inputWatermark === inputWatermark && result.revision === revision && result.branchRevision === branchRevision
}

/** Select a safe title after a provider failure or unknown result. */
const MAX_TITLE_CHARACTERS = 48
/**
 * Build a whitespace-normalized, grapheme-bounded title from the first user message.
 * @param firstMessage - Original user expression used when automatic titling cannot provide a valid title.
 * @param maxCharacters - Maximum grapheme clusters; defaults to 48.
 * @returns The clipped title, or 未命名困惑 when normalization produces no content.
 */
export function fallbackTitle(firstMessage: string, maxCharacters = MAX_TITLE_CHARACTERS): string {
  const normalized = firstMessage.replace(/\s+/gu, ' ').trim()
  const segments = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(normalized)].map(segment => segment.segment)
  return segments.slice(0, maxCharacters).join('') || '未命名困惑'
}
/**
 * Resolve a completed/cancelled race with the durable terminal fact winning.
 * @param events - Ordered turn facts for the dilemma.
 * @param operation - Exact turn attempt whose first terminal fact wins.
 * @returns The first completed, cancelled, or failed status, or undefined before a terminal fact exists.
 */
export function visibleTurnStatus(events: readonly ProductEvent[], operation: TurnOperationId): TurnStatus | undefined {
  const terminals = events.filter((event): event is Extract<ProductEvent, { type: 'turn' }> => event.type === 'turn' && event.turnOperationId === operation && ['completed', 'cancelled', 'failed'].includes(event.status))
  const first = terminals[0]
  if (first !== undefined) return first.status
  const terminal = terminals.at(-1)
  return terminal?.status
}

/**
 * Keep only evidence that has not been challenged or withdrawn.
 * @param events - Evidence lifecycle facts in persisted order.
 * @returns Evidence ids whose latest status remains available.
 */
export function availableEvidence(events: readonly ProductEvent[]): readonly string[] {
  const status = new Map<string, 'available' | 'challenged' | 'withdrawn'>()
  for (const event of events) if (event.type === 'evidence') status.set(event.evidenceId, event.status)
  return [...status].filter(([, value]) => value === 'available').map(([id]) => id)
}

/**
 * Apply the pre-model safety gate; blocked input has no provider side effect.
 * @param text - User text checked before any provider request.
 * @returns Admission or a typed refusal with its user-visible reason; this pure function performs no provider call.
 */
export function safetyDecision(text: string): { readonly allowed: true } | { readonly allowed: false; readonly kind: 'danger' | 'professional'; readonly reason: string } {
  const normalized = text.trim().toLowerCase()
  if (normalized.length === 0) return { allowed: false, kind: 'professional', reason: 'empty message' }
  if (/(?:kill|suicide|bomb|自杀|杀人|炸弹|色情|裸聊|制作炸弹|入侵网站|盗取密码)/iu.test(normalized)) return { allowed: false, kind: 'danger', reason: '请立即停止人物对话并寻求现实支持或专业帮助。' }
  if (/(?:诊断|确诊|处方|法律意见|打官司|稳赚|保证收益)/iu.test(normalized)) return { allowed: false, kind: 'professional', reason: '这类问题不进入人物角色，请咨询合格的专业人士。' }
  return { allowed: true }
}

/** Host-owned effects for quiescing Agents and permanently removing Session and product facts. */
export interface DeletionDriver {
  /** Resolve only after every product-owned Agent is disposed and no longer writes its Session. */
  stopAgents(): Promise<void>
  /**
   * Permanently remove one captured branch history; repeated deletion must tolerate an absent Session.
   * @param sessionId - Captured target Session id.
   */
  deleteSession(sessionId: SessionId): Promise<void>
  /**
   * Remove product facts only after every target Session is gone; retain any response-loss recovery receipt externally.
   * @param dilemmaId - Product record whose captured branches have all been deleted.
   */
  deleteProduct(dilemmaId: DilemmaId): Promise<void>
}

/** Checkpointed deletion coordinator; persists progress before effects and returns failed checkpoints for recovery. */
export class DeletionMachine {
  constructor(
    private readonly id: DilemmaId,
    private readonly branches: readonly PersonaBranch[],
    private readonly persist: (operation: DeletionOperation) => Promise<void>,
  ) {}
  private current: DeletionOperation | undefined
  /**
   * Read the most recently armed or persisted checkpoint without mutating it.
   * @returns Current deletion checkpoint, or undefined before arming and after cancellation.
   */
  get operation(): DeletionOperation | undefined { return this.current }

  /**
   * Arm a confirmed requested deletion in memory; callers own persistence of the request and any cancellation.
   * @param operation - Reversible requested checkpoint for the same operation id as any existing request.
   * @throws If execution already started or another operation id is active.
   */
  arm(operation: DeletionOperation): void {
    if (operation.stage !== 'requested' || operation.irreversible) throw new Error('only a reversible requested deletion can be armed')
    if (this.current !== undefined && this.current.operationId !== operation.operationId) throw new Error('a different deletion operation is already active')
    this.current = operation
  }

  /**
   * Cancel only an armed request whose execution has not started.
   * @returns The cancelled requested checkpoint; the machine becomes unarmed.
   * @throws If no operation is active or its stage is no longer requested.
   */
  cancel(): DeletionOperation {
    if (this.current === undefined) throw new Error('no deletion request is active')
    if (this.current.stage === 'requested') {
      const cancelled = this.current
      this.current = undefined
      return cancelled
    }
    throw new Error('deletion is irreversible after execution starts')
  }
  /**
   * Stop Agents, delete each captured branch, then remove product facts with durable checkpoints.
   * @param op - Current or failed checkpoint; a failed checkpoint must carry its resume stage.
   * @param driver - Host effects; Session deletion must tolerate already-removed targets during recovery.
   * @returns Completed or failed checkpoint; effect failures are persisted and returned for retry.
   * @throws If another operation is active, a failed checkpoint lacks its resume stage, or failure persistence itself rejects.
   */
  async run(op: DeletionOperation, driver: DeletionDriver): Promise<DeletionOperation> {
    if (this.current?.operationId !== undefined && this.current.operationId !== op.operationId) throw new Error('a different deletion operation is already active')
    if (op.stage === 'completed') return op
    const { error: _error, ...retryable } = op
    let current: DeletionOperation = op.stage === 'failed'
      ? { ...retryable, stage: resumeStageOf(op) }
      : op
    this.current = current
    try {
      if (current.stage === 'requested') current = await this.save('stopping-agents', false)
      if (current.stage === 'stopping-agents') {
        await driver.stopAgents()
        current = await this.save('deleting-branch', true, { targets: current.targets ?? this.branches, completedSessionIds: current.completedSessionIds ?? [] })
      }
      if (current.stage === 'deleting-branch' || current.stage === 'deleting-first-branch' || current.stage === 'deleting-second-branch' || current.stage === 'deleting-wang' || current.stage === 'deleting-zeng') {
        const targets = current.targets ?? this.branches
        const completed = new Set(current.completedSessionIds ?? [])
        const legacyIndex = current.stage === 'deleting-first-branch' || current.stage === 'deleting-wang' ? 0
          : current.stage === 'deleting-second-branch' || current.stage === 'deleting-zeng' ? 1 : undefined
        const orderedTargets = legacyIndex === undefined ? targets : [...targets.slice(legacyIndex), ...targets.slice(0, legacyIndex)]
        for (const pending of orderedTargets) {
          if (completed.has(pending.sessionId)) continue
          current = await this.save('deleting-branch', true, { targets, completedSessionIds: [...completed], currentSessionId: pending.sessionId })
          await driver.deleteSession(pending.sessionId)
          completed.add(pending.sessionId)
          current = await this.save('deleting-branch', true, { targets, completedSessionIds: [...completed] })
        }
        if (targets.some(branch => !completed.has(branch.sessionId))) throw new Error('deletion branch checkpoint did not cover all targets')
        current = await this.save('deleting-product', true, { targets, completedSessionIds: [...completed] })
      }
      if (current.stage === 'deleting-product') {
        await driver.deleteProduct(this.id)
        // The terminal action deletes the product log that owns checkpoints.
        // Its preceding `deleting-product` fact is the durable recovery proof.
        current = {
          operationId: current.operationId, stage: 'completed', irreversible: true,
          ...(current.targets === undefined ? {} : { targets: current.targets }),
          ...(current.completedSessionIds === undefined ? {} : { completedSessionIds: current.completedSessionIds }),
        }
        this.current = current
      }
      return current
    } catch (error) {
      const failed: DeletionOperation = {
        operationId: current.operationId,
        stage: 'failed' as const,
        resumeStage: current.stage as ResumeStage,
        irreversible: current.irreversible,
        error: error instanceof Error ? error.message : String(error),
        ...(current.targets === undefined ? {} : { targets: current.targets }),
        ...(current.completedSessionIds === undefined ? {} : { completedSessionIds: current.completedSessionIds }),
        ...(current.currentSessionId === undefined ? {} : { currentSessionId: current.currentSessionId }),
      }
      this.current = failed; await this.persist(failed); return failed
    }
  }
  private async save(
    stage: DeletionStage,
    irreversible: boolean,
    details: Pick<DeletionOperation, 'targets' | 'completedSessionIds' | 'currentSessionId'> = {},
  ): Promise<DeletionOperation> {
    const current = this.current
    if (current === undefined) throw new Error('deletion operation is not initialized')
    const next = {
      operationId: current.operationId, stage, irreversible: irreversible || current.irreversible,
      ...(details.targets === undefined && current.targets === undefined ? {} : { targets: details.targets ?? current.targets }),
      ...(details.completedSessionIds === undefined && current.completedSessionIds === undefined
        ? {} : { completedSessionIds: details.completedSessionIds ?? current.completedSessionIds }),
      ...(details.currentSessionId === undefined && current.currentSessionId === undefined
        ? {} : { currentSessionId: details.currentSessionId ?? current.currentSessionId }),
    }
    await this.persist(next)
    this.current = next
    return next
  }
}
