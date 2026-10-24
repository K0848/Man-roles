/** Versioned Host Remote facade for the browser-facing dilemma projection. */

import { createHash } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  DilemmaHandle, RoleplayerCancelRequest, RoleplayerDeleteRequest, RoleplayerFailure,
  RoleplayerCreateRequest, RoleplayerHandleRequest, RoleplayerListRequest, RoleplayerListResult,
  RoleplayerPersonaOption, RoleplayerRosterResult, RoleplayerMutationRequest,
  RoleplayerProjection, RoleplayerProjectionResult, RoleplayerResult, RoleplayerSubmitRequest,
  RoleplayerDeleteResult,
  RoleplayerSwitchRequest, RoleplayerStateModifyRequest, RoleplayerStateRequest,
  RoleplayerEvidenceRequest, RoleplayerRenameRequest, RoleplayerChoiceAnswerRequest, RoleplayerChoiceCancelRequest,
  RoleplayerRetryRequest,
  RoleplayerStateRetryRequest,
} from './types.ts'
import { isPersonaId, LEGACY_PERSONAS, PERSONA_REGISTRY } from './types.ts'
import { deliveryOperationId, messageId, operationId, requestId, turnOperationId } from './product/index.ts'
import type { DilemmaConversation, DilemmaId } from './product/index.ts'
import { dilemmaHandle } from './service.ts'
import type { ManRoleplayer } from './service.ts'

const VERSION = 1

declare module '@deepseek-ai/cordis' {
  interface Context { manRoleplayerRemote: ManRoleplayerRemoteService }
}

function handleFor(id: string): DilemmaHandle {
  return dilemmaHandle(id as DilemmaId) as DilemmaHandle
}

function handleDigest(handle: DilemmaHandle): string {
  return createHash('sha256').update(handle).digest('hex')
}

function failure(error: unknown): RoleplayerFailure {
  const message = error instanceof Error ? error.message : 'man-roleplayer operation failed'
  if (/archived/iu.test(message)) return { code: 'archived', message: 'dilemma is archived' }
  if (/deleting/iu.test(message)) return { code: 'deleting', message: 'dilemma is being deleted' }
  if (/discussion is paused/iu.test(message)) return { code: 'paused', message: 'discussion is paused; resume it before submitting' }
  if (/stage has ended|stage-ended/iu.test(message)) return { code: 'stage-ended', message: 'discussion stage has ended; resume it before submitting' }
  if (/still running|stop-failed|unknown.*stop|stopping/iu.test(message)) return { code: 'invalid-request', message: 'the current persona turn has not reached a confirmed stopped state' }
  if (/deletion/iu.test(message)) return { code: 'deletion-failed', message: 'dilemma deletion did not complete' }
  if (/unknown dilemma/iu.test(message)) return { code: 'unknown-dilemma', message: 'dilemma is no longer available' }
  if (/revision/iu.test(message)) return { code: 'revision-conflict', message: 'dilemma changed; reload its projection' }
  if (/invalid|must|requires|cannot|not archived/iu.test(message)) return { code: 'invalid-request', message }
  return { code: 'internal', message: 'man-roleplayer operation failed' }
}

function ok<T>(value: T): RoleplayerResult<T> { return { ok: true, value } }
function rejected<T>(error: RoleplayerFailure): RoleplayerResult<T> { return { ok: false, error } }

async function projection(product: ManRoleplayer, conversation: DilemmaConversation): Promise<RoleplayerProjection> {
  let timeline: RoleplayerProjection['timeline'] = await Promise.all(conversation.timeline.map(async (item) => {
    const text = item.kind === 'persona-message' && item.status === 'completed'
      ? await product.acceptedAnswerWithClaims(conversation.id, item.id) : undefined
    const userText = item.kind === 'user-message' ? item.text : undefined
    return {
      id: item.id, kind: item.kind === 'persona-message' ? 'persona-message' as const : item.kind === 'user-message' ? 'user-message' as const : item.kind === 'choice-answer' ? 'choice-answer' as const : 'system-status' as const,
      ...(item.persona === undefined ? {} : { persona: item.persona }),
      ...(item.status === undefined ? {} : { status: item.status }),
      ...(item.operationId === undefined ? {} : { operationId: item.operationId }),
      ...(item.kind !== 'user-message' || item.replyToTimelineEventId === undefined ? {} : { replyToTimelineEventId: item.replyToTimelineEventId }),
      ...(userText === undefined ? {} : { text: userText }),
      ...(text === undefined ? {} : { text: text.text, claims: text.claims.map(claim => ({ ...claim.textRange, kind: claim.kind, evidenceIds: claim.evidenceIds, status: 'accepted' as const })) }),
    }
  }))
  const evidence = await product.evidenceStatus(conversation.id)
  const evidenceStatus = new Map(evidence.map(item => [item.id, item.status]))
  timeline = timeline.map(item => item.claims === undefined ? item : {
    ...item, claims: item.claims.map(claim => ({ ...claim, status: claim.evidenceIds.every(id => evidenceStatus.get(id) === 'available') ? 'accepted' as const : 'stale' as const })),
  })
  const evidenceActivity = await product.evidenceActivity(conversation.id)
  const state = await product.stateStatus(conversation.id)
  const activeTurn = await product.activeTurn(conversation.id)
  const activity = conversation.activities === undefined ? undefined : await Promise.all(conversation.activities.map(async (item) => {
    const reasoning = await product.reasoning(conversation.id, item.turnOperationId)
    return {
      id: String(item.id), messageId: String(item.messageId), turnOperationId: String(item.turnOperationId),
      persona: item.persona, phase: item.phase, startedAt: item.startedAt,
      ...(item.endedAt === undefined ? {} : { endedAt: item.endedAt }),
      ...(item.durationMs === undefined ? {} : { durationMs: item.durationMs }),
      ...(item.count === undefined ? {} : { count: item.count }),
      ...(item.stages === undefined ? {} : { stages: item.stages }),
      ...(reasoning === undefined ? {} : { reasoning }),
    }
  }))
  return {
    handle: handleFor(conversation.id),
    activePersona: conversation.activePersona,
    discussionStatus: conversation.discussionStatus,
    branches: conversation.branches.map(branch => ({ persona: branch.persona })),
    timeline,
    ...(conversation.title === undefined ? {} : { title: conversation.title }),
    titleRevision: conversation.titleRevision,
    titleUserOwned: conversation.titleUserOwned,
    ...(conversation.archived === undefined ? {} : { archived: conversation.archived }),
    ...(conversation.deletion === undefined ? {} : {
      deletion: { operationId: conversation.deletion.operationId as RoleplayerProjection['deletion'] extends { operationId: infer T } ? T : never, stage: conversation.deletion.stage, irreversible: conversation.deletion.irreversible, retryable: conversation.deletion.stage !== 'completed' },
    }),
    ...(evidence.length === 0 ? {} : { evidence }),
    ...(evidenceActivity.length === 0 ? {} : { evidenceActivity }),
    ...(state === undefined ? {} : { state: { ...state, operationId: state.operationId as RoleplayerProjection['state'] extends { operationId?: infer T } ? T : never } }),
    ...(conversation.choice === undefined ? {} : { choice: conversation.choice }),
    ...(activeTurn === undefined ? {} : { activeTurn: { ...activeTurn, messageId: activeTurn.messageId as RoleplayerProjection['activeTurn'] extends { messageId: infer T } ? T : never, deliveryOperationId: activeTurn.deliveryOperationId as RoleplayerProjection['activeTurn'] extends { deliveryOperationId: infer T } ? T : never, turnOperationId: activeTurn.turnOperationId as RoleplayerProjection['activeTurn'] extends { turnOperationId: infer T } ? T : never } }),
    ...(activity === undefined ? {} : { activity }),
    revision: conversation.lifecycleRevision,
  }
}

/** Remote service that exposes only redacted product projections and handles. */
export class ManRoleplayerRemoteService extends TypertRemoteService {
  static inject = ['manRoleplayer']

  constructor(ctx: Context) {
    super(ctx, 'manRoleplayerRemote')
  }

  @Remote('listPersonas')
  listPersonas(request: { readonly version: number }): Promise<RoleplayerRosterResult> {
    const result = request.version !== VERSION
      ? rejected<readonly RoleplayerPersonaOption[]>({ code: 'invalid-request', message: 'unsupported man-roleplayer request' })
      : ok(PERSONA_REGISTRY.map(({ id, displayName }) => ({ id, displayName })))
    return Promise.resolve(result)
  }

  @Remote('list')
  async list(request: RoleplayerListRequest): Promise<RoleplayerListResult> {
    if (request.version !== VERSION) {
      return rejected({ code: 'invalid-request', message: 'unsupported man-roleplayer request' })
    }
    try {
      const conversations = await this.product().list(request.includeArchived ?? false)
      return ok(await Promise.all(conversations.map(conversation => projection(this.product(), conversation))))
    } catch (error) { return rejected(failure(error)) }
  }

  @Remote('create')
  async create(request: RoleplayerCreateRequest): Promise<RoleplayerProjectionResult> {
    const activePersona: unknown = request.activePersona
    const personas: readonly unknown[] = request.personas ?? LEGACY_PERSONAS
    const explicitPersonas = request.personas !== undefined
    if (request.version !== VERSION || !isPersonaId(activePersona)
      || (explicitPersonas && personas.length !== 1) || personas.length < 1 || !personas.every(isPersonaId)
      || new Set(personas).size !== personas.length || !personas.includes(activePersona)) {
      return rejected({ code: 'invalid-request', message: 'unsupported man-roleplayer request' })
    }
    try {
      const conversation = await this.product().createBlank({
        requestId: requestId(request.requestId), activePersona,
        personas,
      })
      return ok(await projection(this.product(), conversation))
    } catch (error) { return rejected(failure(error)) }
  }

  @Remote('getProjection')
  async getProjection(request: RoleplayerHandleRequest): Promise<RoleplayerProjectionResult> {
    const conversation = await this.resolve(request)
    return conversation.ok ? ok(await projection(this.product(), conversation.value)) : conversation
  }

  @Remote('archive')
  async archive(request: RoleplayerMutationRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().archive(
      conversation.id, requestId(request.requestId), request.expectedRevision,
    ))
  }

  @Remote('restore')
  async restore(request: RoleplayerMutationRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().restore(
      conversation.id, requestId(request.requestId), request.expectedRevision,
    ))
  }

  @Remote('rename')
  async rename(request: RoleplayerRenameRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().rename(
      conversation.id, request.title, requestId(request.requestId), request.expectedRevision,
    ))
  }

  @Remote('pause')
  async pause(request: RoleplayerMutationRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().pause(
      conversation.id, requestId(request.requestId), request.expectedRevision,
    ))
  }

  @Remote('resume')
  async resume(request: RoleplayerMutationRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().resumeDiscussion(
      conversation.id, requestId(request.requestId), request.expectedRevision,
    ))
  }

  @Remote('endStage')
  async endStage(request: RoleplayerMutationRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().endStage(
      conversation.id, requestId(request.requestId), request.expectedRevision,
    ))
  }

  @Remote('switchPersona')
  async switchPersona(request: RoleplayerSwitchRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().switchPersona(
      conversation.id, request.persona, requestId(request.requestId),
      request.expectedRevision,
    ))
  }

  @Remote('answerChoice')
  async answerChoice(request: RoleplayerChoiceAnswerRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().answerChoice(
      conversation.id, operationId(request.choiceOperationId), request.answers, requestId(request.requestId), request.expectedRevision,
    ))
  }

  @Remote('cancelChoice')
  async cancelChoice(request: RoleplayerChoiceCancelRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().cancelChoice(
      conversation.id, operationId(request.choiceOperationId), requestId(request.requestId), request.expectedRevision,
    ))
  }

  @Remote('confirmState')
  async confirmState(request: RoleplayerStateRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().confirmState(
      conversation.id, request.itemId, requestId(request.requestId), request.expectedRevision,
    ))
  }

  @Remote('modifyState')
  async modifyState(request: RoleplayerStateModifyRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().modifyState(
      conversation.id, request.itemId, { text: request.text, ...(request.kind === undefined ? {} : { kind: request.kind }) },
      requestId(request.requestId), request.expectedRevision,
    ))
  }

  @Remote('rejectState')
  async rejectState(request: RoleplayerStateRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().rejectState(
      conversation.id, request.itemId, requestId(request.requestId), request.expectedRevision,
    ))
  }

  @Remote('withdrawState')
  async withdrawState(request: RoleplayerStateRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().withdrawState(
      conversation.id, request.itemId, requestId(request.requestId), request.expectedRevision,
    ))
  }

  @Remote('resolveState')
  async resolveState(request: RoleplayerStateRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().resolveState(
      conversation.id, request.itemId, requestId(request.requestId), request.expectedRevision,
    ))
  }

  @Remote('challengeEvidence')
  async challengeEvidence(request: RoleplayerEvidenceRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().challengeEvidence(
      conversation.id, request.evidenceId, requestId(request.requestId),
    ))
  }

  @Remote('reviewEvidence')
  async reviewEvidence(request: RoleplayerEvidenceRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().reviewEvidence(
      conversation.id, request.evidenceId, requestId(request.requestId),
    ))
  }

  @Remote('withdrawEvidence')
  async withdrawEvidence(request: RoleplayerEvidenceRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().withdrawEvidence(
      conversation.id, request.evidenceId, requestId(request.requestId),
    ))
  }

  @Remote('submit')
  async submit(request: RoleplayerSubmitRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.submitUntilChoiceOrCompletion(conversation, {
      messageId: messageId(request.messageId), deliveryOperationId: deliveryOperationId(request.deliveryOperationId),
      turnOperationId: turnOperationId(request.turnOperationId), text: request.text, requestId: requestId(request.requestId),
      expectedRevision: request.expectedRevision,
      ...(request.replyToTimelineEventId === undefined ? {} : { replyToTimelineEventId: request.replyToTimelineEventId }),
    }))
  }

  /** Return from the durable claim boundary while the owning Agent remains awaited. */
  private async submitUntilChoiceOrCompletion(
    conversation: DilemmaConversation,
    request: Parameters<ManRoleplayer['submitMessage']>[1],
  ): Promise<DilemmaConversation> {
    return this.product().submitMessage(conversation.id, { ...request, acknowledgeOnly: true })
  }

  @Remote('retryMessage')
  async retryMessage(request: RoleplayerRetryRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().retryMessage(
      conversation.id, messageId(request.messageId), turnOperationId(request.failedTurnOperationId),
      requestId(request.requestId), request.expectedRevision,
    ))
  }

  @Remote('retryState')
  async retryState(request: RoleplayerStateRetryRequest): Promise<RoleplayerProjectionResult> {
    return this.mutate(request, conversation => this.product().retryState(
      conversation.id, operationId(request.stateOperationId), operationId(request.retryOperationId),
    ))
  }

  @Remote('cancel')
  async cancel(request: RoleplayerCancelRequest): Promise<RoleplayerProjectionResult> {
    // A submit changes the product revision while its Agent is still running.
    // Cancellation is authorized by the matching in-flight operation lease,
    // so requiring the pre-submit revision here would make the visible Cancel
    // control fail precisely during the window it is meant to close.
    const resolved = await this.resolve(request)
    if (!resolved.ok) return resolved
    try {
      return ok(await projection(this.product(), await this.product().cancelMessage(
        resolved.value.id, messageId(request.messageId), deliveryOperationId(request.deliveryOperationId),
        turnOperationId(request.turnOperationId),
      )))
    } catch (error) { return rejected(failure(error)) }
  }

  @Remote('delete')
  async delete(request: RoleplayerDeleteRequest): Promise<RoleplayerDeleteResult> {
    const receipt = await this.product().readDeletionReceipt(operationId(request.operationId))
    if (receipt !== undefined) {
      if (receipt.handleDigest !== handleDigest(request.handle)) return rejected({ code: 'unknown-dilemma', message: 'dilemma is no longer available' })
      if (receipt.status === 'completed' || await this.product().recoverDeletionReceipt(operationId(request.operationId), receipt.handleDigest)) {
        return ok({ handle: request.handle, deleted: true })
      }
    }
    const checked = await this.check(request)
    if (!checked.ok) return checked
    try {
      await this.product().requestDeletion(checked.value.id, { operationId: operationId(request.operationId), stage: 'requested', irreversible: false }, requestId(request.requestId), request.expectedRevision)
      const result = await this.product().delete(checked.value.id, operationId(request.operationId))
      if (result.stage !== 'completed') {
        return rejected({
          code: 'deletion-failed', message: 'dilemma deletion did not complete',
          details: { stage: result.stage, operationId: String(result.operationId) },
        })
      }
      return ok({ handle: request.handle, deleted: true })
    } catch (error) {
      const after = await this.product().read(checked.value.id).catch(() => undefined)
      return after === undefined ? rejected({ code: 'unknown-dilemma', message: 'dilemma was deleted' }) : rejected(failure(error))
    }
  }

  private product(): ManRoleplayer { return this.ctx.get('manRoleplayer') as ManRoleplayer }

  private async resolve(request: RoleplayerHandleRequest): Promise<RoleplayerResult<DilemmaConversation>> {
    if (request.version !== VERSION || request.handle.trim() === '') {
      return rejected({ code: 'invalid-request', message: 'unsupported man-roleplayer request' })
    }
    const conversation = (await this.product().list(true)).find(item => handleFor(item.id) === request.handle)
    return conversation === undefined ? rejected({ code: 'unknown-dilemma', message: 'dilemma is no longer available' }) : ok(conversation)
  }

  private async check(request: RoleplayerMutationRequest): Promise<RoleplayerResult<DilemmaConversation>> {
    if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) {
      return rejected({ code: 'invalid-request', message: 'expectedRevision must be a non-negative integer' })
    }
    const resolved = await this.resolve(request)
    if (!resolved.ok) return resolved
    if (resolved.value.seenRequests.includes(requestId(request.requestId))) return resolved
    return resolved.value.lifecycleRevision !== request.expectedRevision
      ? rejected({ code: 'revision-conflict', message: 'dilemma changed; reload its projection' })
      : resolved
  }

  private async mutate(
    request: RoleplayerMutationRequest,
    operation: (conversation: DilemmaConversation) => Promise<DilemmaConversation>,
  ): Promise<RoleplayerProjectionResult> {
    const checked = await this.check(request)
    if (!checked.ok) return checked
    if (checked.value.seenRequests.includes(requestId(request.requestId))) return ok(await projection(this.product(), checked.value))
    try { return ok(await projection(this.product(), await operation(checked.value))) } catch (error) { return rejected(failure(error)) }
  }
}

export default ManRoleplayerRemoteService
