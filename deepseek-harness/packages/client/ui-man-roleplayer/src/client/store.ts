/** React-free projection store and Host operations for the dilemma client. */

import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {
  DilemmaHandle, ManRoleplayerOperationId, ManRoleplayerRequestId, PersonaId, RoleplayerCancelRequest,
  RoleplayerCreateRequest, RoleplayerDeleteRequest, RoleplayerListResult, RoleplayerMutationRequest,
  RoleplayerPersonaOption, RoleplayerProjection,
  RoleplayerProjectionResult, RoleplayerResult, RoleplayerSubmitRequest, RoleplayerSwitchRequest,
  RoleplayerDeleteResult,
  RoleplayerStateModifyRequest, RoleplayerStateRequest,
  RoleplayerEvidenceRequest, RoleplayerRenameRequest, RoleplayerChoiceAnswerRequest,
  RoleplayerChoiceCancelRequest, RoleplayerChoiceAnswer, RoleplayerRetryRequest, RoleplayerStateRetryRequest,
} from '@deepseek-ai/dsh-man-roleplayer/types'
import type { ExecutionState } from '@deepseek-ai/dsh-man-roleplayer/product'

export interface RoleplayerRemote {
  list: (request: { version: number; includeArchived?: boolean }) => Promise<RemoteResult<RoleplayerListResult>>
  listPersonas?: (request: { version: number }) => Promise<RemoteResult<RoleplayerResult<readonly RoleplayerPersonaOption[]>>>
  create: (request: RoleplayerCreateRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  getProjection: (request: { version: number; handle: DilemmaHandle }) => Promise<RemoteResult<RoleplayerProjectionResult>>
  archive: (request: RoleplayerMutationRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  restore: (request: RoleplayerMutationRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  rename: (request: RoleplayerRenameRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  pause: (request: RoleplayerMutationRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  resume: (request: RoleplayerMutationRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  endStage: (request: RoleplayerMutationRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  switchPersona: (request: RoleplayerSwitchRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  submit: (request: RoleplayerSubmitRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  retryMessage: (request: RoleplayerRetryRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  cancel: (request: RoleplayerCancelRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  answerChoice: (request: RoleplayerChoiceAnswerRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  cancelChoice: (request: RoleplayerChoiceCancelRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  delete: (request: RoleplayerDeleteRequest) => Promise<RemoteResult<RoleplayerDeleteResult>>
  confirmState: (request: RoleplayerStateRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  modifyState: (request: RoleplayerStateModifyRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  rejectState: (request: RoleplayerStateRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  withdrawState: (request: RoleplayerStateRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  resolveState: (request: RoleplayerStateRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  challengeEvidence: (request: RoleplayerEvidenceRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  reviewEvidence: (request: RoleplayerEvidenceRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  withdrawEvidence: (request: RoleplayerEvidenceRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
  retryState?: (request: RoleplayerStateRetryRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>
}

export type RoleplayerStoreStatus = 'cold' | 'loading' | 'ready' | 'error'

export interface RoleplayerStoreView {
  readonly status: RoleplayerStoreStatus
  readonly connected?: boolean
  readonly dilemmas: readonly RoleplayerProjection[]
  readonly personas: readonly RoleplayerPersonaOption[]
  readonly selected: DilemmaHandle | null
  readonly error: string | null
  readonly pending?: {
    readonly handle: DilemmaHandle
    readonly persona: RoleplayerSwitchRequest['persona']
    readonly messageId: ManRoleplayerOperationId
    readonly deliveryOperationId: ManRoleplayerOperationId
    readonly turnOperationId: ManRoleplayerOperationId
    readonly executionState: ExecutionState
  }
  /** Long-running turns are owned per dilemma; selection must not reroute them. */
  readonly pendingByHandle?: Readonly<Record<DilemmaHandle, NonNullable<RoleplayerStoreView['pending']>>>
}

type PendingTurn = NonNullable<RoleplayerStoreView['pending']>
type PendingByHandle = Record<DilemmaHandle, PendingTurn>

function withoutPending(source: PendingByHandle, handle: DilemmaHandle): PendingByHandle {
  return Object.fromEntries(Object.entries(source).filter(([key]) => key !== handle))
}

export interface RoleplayerSidebarSelector {
  readonly status: RoleplayerStoreStatus
  readonly items: readonly RoleplayerProjection[]
  readonly archivedItems: readonly RoleplayerProjection[]
  readonly selected: DilemmaHandle | null
  readonly create: (personas: readonly PersonaId[]) => Promise<boolean>
}

export interface RoleplayerConversationSelector {
  readonly projection: RoleplayerProjection | undefined
  readonly submit: (text: string, replyToTimelineEventId?: string) => Promise<boolean>
  readonly switchPersona: (persona: RoleplayerSwitchRequest['persona']) => Promise<boolean>
  readonly cancel: (
    messageId: ManRoleplayerOperationId,
    deliveryOperationId: ManRoleplayerOperationId,
    turnOperationId: ManRoleplayerOperationId,
  ) => Promise<boolean>
}

export interface RoleplayerDetailsSelector {
  readonly projection: RoleplayerProjection | undefined
  readonly error: string | null
  readonly archive: () => Promise<boolean>
  readonly restore: () => Promise<boolean>
  readonly rename: (title: string) => Promise<boolean>
  readonly retryMessage: (messageId: ManRoleplayerOperationId, failedTurnOperationId: ManRoleplayerOperationId) => Promise<boolean>
  readonly pause: () => Promise<boolean>
  readonly resume: () => Promise<boolean>
  readonly endStage: () => Promise<boolean>
  readonly delete: (operationId: ManRoleplayerOperationId) => Promise<boolean>
  readonly retry: () => Promise<boolean>
  readonly retryState: () => Promise<boolean>
  readonly confirmState: (itemId: string) => Promise<boolean>
  readonly modifyState: (itemId: string, text: string, kind?: RoleplayerStateModifyRequest['kind']) => Promise<boolean>
  readonly rejectState: (itemId: string) => Promise<boolean>
  readonly withdrawState: (itemId: string) => Promise<boolean>
  readonly resolveState: (itemId: string) => Promise<boolean>
  readonly challengeEvidence: (evidenceId: string) => Promise<boolean>
  readonly reviewEvidence: (evidenceId: string) => Promise<boolean>
  readonly withdrawEvidence: (evidenceId: string) => Promise<boolean>
  readonly answerChoice: (choiceOperationId: ManRoleplayerOperationId, answers: readonly RoleplayerChoiceAnswer[]) => Promise<boolean>
  readonly cancelChoice: (choiceOperationId: ManRoleplayerOperationId) => Promise<boolean>
}

const VERSION = 1
const initialView: RoleplayerStoreView = Object.freeze({ status: 'cold', dilemmas: [], personas: [], selected: null, error: null })

function requestId(prefix: string): ManRoleplayerRequestId {
  return `${prefix}:${crypto.randomUUID()}` as ManRoleplayerRequestId
}

function operationId(prefix: string): ManRoleplayerOperationId {
  return `${prefix}:${crypto.randomUUID()}` as ManRoleplayerOperationId
}

function isValidDeletedValue(value: unknown, handle: DilemmaHandle): value is { readonly handle: DilemmaHandle; readonly deleted: true } {
  if (value === null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return Object.keys(record).length === 2 && record.handle === handle && record.deleted === true
}

function business<T>(carrier: RemoteResult<RoleplayerResult<T>>): RoleplayerResult<T> {
  return carrier.ok ? carrier.value : { ok: false, error: { code: 'internal', message: carrier.error.message } }
}

/** One store owns the whole Host projection; sidebar, conversation, and details use pure selectors. */
export class RoleplayerProjectionStore {
  private view = initialView
  private readonly listeners = new Set<() => void>()
  private loading: Promise<boolean> | undefined
  private mutationVersion = 0
  private stateRefreshTimer: ReturnType<typeof setTimeout> | undefined
  private choiceRefreshTimer: ReturnType<typeof setTimeout> | undefined
  private turnRefreshTimer: ReturnType<typeof setTimeout> | undefined
  private disposed = false

  private connectionGeneration = 0

  constructor(private readonly remote: RoleplayerRemote, private readonly selection?: {
    readonly read: () => DilemmaHandle | null
    readonly write: (handle: DilemmaHandle | null) => void
  }) {
    this.view = { ...initialView, selected: selection?.read() ?? null }
  }

  /** Consume the existing transport's generation state; a reconnect always reloads Host facts. */
  setConnected(connected: boolean): void {
    if (this.view.connected === connected) return
    this.connectionGeneration += 1
    this.loading = undefined
    if (!connected) {
      this.publish({ ...this.view, connected: false, status: 'loading', error: null })
      return
    }
    this.publish({ ...this.view, connected: true, status: 'loading' })
    void this.refresh(true).then((success) => {
      if (!success || this.disposed || this.view.connected === false) return
      const active = this.view.pending
      if (active !== undefined) this.scheduleTurnRefresh(active.handle, active.turnOperationId)
      const state = this.selectedProjection()?.state
      if (state?.status === 'claimed' || state?.status === 'running') this.scheduleStateRefresh()
    })
  }

  /** Stop background observation when the owning client plugin is disposed. */
  dispose(): void {
    this.disposed = true
    if (this.stateRefreshTimer !== undefined) clearTimeout(this.stateRefreshTimer)
    if (this.choiceRefreshTimer !== undefined) clearTimeout(this.choiceRefreshTimer)
    if (this.turnRefreshTimer !== undefined) clearTimeout(this.turnRefreshTimer)
    this.stateRefreshTimer = undefined
    this.choiceRefreshTimer = undefined
    this.turnRefreshTimer = undefined
  }

  private pendingFor(handle: DilemmaHandle): RoleplayerStoreView['pending'] { return this.view.pendingByHandle?.[handle] }

  private publishWithPending(view: RoleplayerStoreView, pendingByHandle: Readonly<Record<DilemmaHandle, NonNullable<RoleplayerStoreView['pending']>>>): void {
    const selectedPending = view.selected === null ? undefined : pendingByHandle[view.selected]
    const { pending: _pending, ...withoutPending } = view
    this.publish({ ...withoutPending, pendingByHandle, ...(selectedPending === undefined ? {} : { pending: selectedPending }) })
  }

  getSnapshot = (): RoleplayerStoreView => this.view

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  sidebar = (): RoleplayerSidebarSelector => ({
    status: this.view.status,
    items: this.view.dilemmas.filter(item => item.archived !== true),
    archivedItems: this.view.dilemmas.filter(item => item.archived === true),
    selected: this.view.selected,
    create: personas => this.create(personas),
  })

  conversation = (): RoleplayerConversationSelector => {
    const projection = this.selectedProjection()
    return {
      projection,
      submit: (text, replyToTimelineEventId) => this.submit(text, replyToTimelineEventId, projection),
      switchPersona: persona => this.switchPersona(persona),
      cancel: (messageId, deliveryOperationId, turnOperationId) => this.cancel(messageId, deliveryOperationId, turnOperationId),
    }
  }

  details = (): RoleplayerDetailsSelector => ({
    projection: this.selectedProjection(), error: this.view.error,
    archive: () => this.archive(), restore: () => this.restore(), delete: operation => this.delete(operation),
    rename: title => this.rename(title), pause: () => this.discussionMutation('pause'),
    resume: () => this.discussionMutation('resume'), endStage: () => this.discussionMutation('endStage'),
    retryMessage: (messageId, failedTurnOperationId) => this.retryMessage(messageId, failedTurnOperationId),
    retry: () => this.refresh(true),
    retryState: () => this.retryState(),
    confirmState: itemId => this.stateMutation('confirmState', itemId),
    modifyState: (itemId, text, kind) => this.stateModify(itemId, text, kind),
    rejectState: itemId => this.stateMutation('rejectState', itemId),
    withdrawState: itemId => this.stateMutation('withdrawState', itemId),
    resolveState: itemId => this.stateMutation('resolveState', itemId),
    challengeEvidence: evidenceId => this.evidenceMutation('challengeEvidence', evidenceId),
    reviewEvidence: evidenceId => this.evidenceMutation('reviewEvidence', evidenceId),
    withdrawEvidence: evidenceId => this.evidenceMutation('withdrawEvidence', evidenceId),
    answerChoice: (choiceOperationId, answers) => this.answerChoice(choiceOperationId, answers),
    cancelChoice: choiceOperationId => this.cancelChoice(choiceOperationId),
  })

  refresh(includeArchived = true): Promise<boolean> {
    if (this.view.connected === false || this.disposed) return Promise.resolve(false)
    if (this.loading !== undefined) return this.loading
    const generation = this.connectionGeneration
    const startedAt = this.mutationVersion
    this.publish({ ...this.view, status: this.view.status === 'ready' ? 'ready' : 'loading', error: null })
    const rosterRequest = this.remote.listPersonas?.({ version: VERSION })
    const pending = Promise.all([
      this.remote.list({ version: VERSION, includeArchived }),
      rosterRequest ?? Promise.resolve(undefined),
    ]).then(([carrier, rosterCarrier]) => {
      if (this.disposed || generation !== this.connectionGeneration) return false
      const result = business(carrier)
      if (!result.ok) { this.publish({ ...this.view, status: 'error', error: result.error.message }); return false }
      const roster = rosterCarrier === undefined ? { ok: true as const, value: this.view.personas } : business(rosterCarrier)
      if (!roster.ok) { this.publish({ ...this.view, status: 'error', error: roster.error.message }); return false }
      const selected = this.view.selected !== null && result.value.some(item => item.handle === this.view.selected)
        ? this.view.selected : result.value[0]?.handle ?? null
      // List refreshes can race a mutation response; retain the newer local
      // projection when the server response was started before that mutation.
      if (startedAt !== this.mutationVersion) return true
      const currentByHandle = new Map(this.view.dilemmas.map(item => [item.handle, item]))
      const existingOrder = new Map(this.view.dilemmas.map((item, index) => [item.handle, index]))
      const dilemmas = [...result.value].reverse().sort((a, b) =>
        (existingOrder.get(a.handle) ?? -1) - (existingOrder.get(b.handle) ?? -1)).map((item) => {
        const current = currentByHandle.get(item.handle)
        // A mutation response may legitimately keep the same lifecycle revision
        // in older Hosts; never let that stale list row overwrite a changed
        // active persona/choice projection.
        return current !== undefined && item.revision < current.revision ? current : item
      })
      let pendingByHandle: PendingByHandle = {}
      for (const item of dilemmas) {
        const active = item.activeTurn
        if (active !== undefined && (active.status === 'running' || active.status === 'waiting-choice')) {
          pendingByHandle[item.handle] = {
            handle: item.handle, persona: active.persona, messageId: active.messageId,
            deliveryOperationId: active.deliveryOperationId, turnOperationId: active.turnOperationId,
            executionState: active.executionState,
          }
        } else pendingByHandle = withoutPending(pendingByHandle, item.handle)
      }
      this.publishWithPending({ ...this.view, status: 'ready', dilemmas, personas: roster.value, selected, error: null }, pendingByHandle)
      return true
    }).catch((error: unknown) => {
      if (this.disposed || generation !== this.connectionGeneration) return false
      this.publish({ ...this.view, status: 'error', error: error instanceof Error ? error.message : 'dilemma projection failed' })
      return false
    }).finally(() => { if (generation === this.connectionGeneration) this.loading = undefined })
    this.loading = pending
    return pending
  }

  select(handle: DilemmaHandle | null): void {
    const pendingByHandle = { ...(this.view.pendingByHandle ?? {}) }
    if (handle !== null && pendingByHandle[handle] === undefined) {
      const active = this.view.dilemmas.find(item => item.handle === handle)?.activeTurn
      if (active !== undefined && (active.status === 'running' || active.status === 'waiting-choice')) {
        pendingByHandle[handle] = {
          handle, persona: active.persona, messageId: active.messageId,
          deliveryOperationId: active.deliveryOperationId, turnOperationId: active.turnOperationId,
          executionState: active.executionState,
        }
      }
    }
    const selected = handle !== null && this.view.dilemmas.some(item => item.handle === handle) ? handle : null
    const dilemmas = selected === null ? this.view.dilemmas : [
      ...this.view.dilemmas.filter(item => item.handle === selected),
      ...this.view.dilemmas.filter(item => item.handle !== selected),
    ]
    this.publishWithPending({ ...this.view, selected, dilemmas }, pendingByHandle)
  }

  private async create(personas: readonly PersonaId[]): Promise<boolean> {
    if (this.view.connected === false || this.view.status !== 'ready') return false
    const activePersona = personas[0]
    if (activePersona === undefined || personas.length !== 1 || new Set(personas).size !== personas.length) return false
    try {
      const carrier = await this.remote.create({ version: VERSION, requestId: requestId('create'), activePersona, personas })
      const result = business(carrier)
      if (!result.ok) { this.publish({ ...this.view, error: result.error.message }); return false }
      const dilemmas = [result.value, ...this.view.dilemmas.filter(item => item.handle !== result.value.handle)]
      const { pending: _pending, pendingByHandle: _pendingByHandle, ...withoutPending } = this.view
      this.publishWithPending({ ...withoutPending, status: 'ready', dilemmas, selected: result.value.handle, error: null }, this.view.pendingByHandle ?? {})
      return true
    } catch (error: unknown) {
      this.publish({ ...this.view, error: error instanceof Error ? error.message : 'dilemma creation failed' })
      return false
    }
  }

  private selectedProjection(): RoleplayerProjection | undefined {
    return this.view.dilemmas.find(item => item.handle === this.view.selected)
  }

  private async submit(text: string, replyToTimelineEventId?: string, source?: RoleplayerProjection): Promise<boolean> {
    const projection = this.selectedProjection()
    if (replyToTimelineEventId !== undefined) {
      // 引用归属以当前 Host 投影为准；旧页面回调不能将引用带到另一困惑或人物。
      const target = projection?.timeline.find(item => item.id === replyToTimelineEventId)
      if (projection === undefined || source?.handle !== projection.handle || source.activePersona !== projection.activePersona
        || target?.kind !== 'persona-message' || target.status !== 'completed' || target.persona !== projection.activePersona) {
        this.publish({ ...this.view, error: '引用消息已失效，请选择当前困惑中该人物已完成的回复。' })
        return false
      }
    }
    if (projection === undefined) return false
    if (this.view.connected === false || this.view.status !== 'ready' || this.pendingFor(projection.handle) !== undefined || projection.archived === true || projection.deletion !== undefined || projection.choice?.status === 'pending' || (projection.discussionStatus ?? 'in_progress') !== 'in_progress') return false
    const request = {
      version: VERSION, handle: projection.handle, expectedRevision: projection.revision,
      requestId: requestId('submit'), messageId: operationId('message'),
      deliveryOperationId: operationId('delivery'), turnOperationId: operationId('turn'), text,
      ...(replyToTimelineEventId === undefined ? {} : { replyToTimelineEventId }),
    }
    const pending = {
      handle: projection.handle,
      persona: projection.activePersona,
      messageId: request.messageId,
      deliveryOperationId: request.deliveryOperationId,
      turnOperationId: request.turnOperationId,
      executionState: 'running' as const,
    }
    this.publishWithPending(this.view, { ...(this.view.pendingByHandle ?? {}), [projection.handle]: pending })
    this.scheduleChoiceRefresh(projection.handle)
    try {
      const success = await this.applyMutation(this.remote.submit(request))
      if (success) {
        const accepted = this.view.dilemmas.find(item => item.handle === request.handle)
        // The ack projection can race the first activeTurn read. Poll by the
        // initiating operation unconditionally so a fast completion cannot
        // strand the UI without the accepted terminal projection.
        if (accepted?.activeTurn !== undefined) this.scheduleTurnRefresh(request.handle, accepted.activeTurn.turnOperationId)
        else this.scheduleTurnRefresh(request.handle, request.turnOperationId)
      } else this.scheduleTurnRefresh(request.handle, request.turnOperationId)
      return success
    } finally {
      if (this.choiceRefreshTimer !== undefined) clearTimeout(this.choiceRefreshTimer)
      this.choiceRefreshTimer = undefined
      let pendingByHandle = { ...(this.view.pendingByHandle ?? {}) }
      if (this.view.dilemmas.find(item => item.handle === projection.handle)?.activeTurn === undefined) {
        pendingByHandle = withoutPending(pendingByHandle, projection.handle)
      }
      this.publishWithPending(this.view, pendingByHandle)
    }
  }

  /** Poll the product projection while a submit may be waiting on a product-owned choice. */
  private scheduleChoiceRefresh(handle: DilemmaHandle): void {
    if (this.disposed || this.view.connected === false) return
    if (this.choiceRefreshTimer !== undefined) clearTimeout(this.choiceRefreshTimer)
    let attempts = 0
    const poll = (): void => {
      attempts += 1
      // The submit Remote remains pending while askChoice waits. A concurrent
      // projection request can transiently fail at the transport/host layer;
      // keep the observation window alive so one failed poll cannot hide the
      // durable pending choice from the user.
      void this.refreshProjection(handle).then(() => {
        if (this.disposed || this.view.connected === false) return
        if (this.pendingFor(handle) === undefined || attempts >= 600) {
          this.choiceRefreshTimer = undefined
          return
        }
        this.choiceRefreshTimer = setTimeout(poll, 100)
      }, () => {
        if (this.disposed || this.view.connected === false) return
        if (this.pendingFor(handle) === undefined || attempts >= 600) {
          this.choiceRefreshTimer = undefined
          return
        }
        this.choiceRefreshTimer = setTimeout(poll, 100)
      })
    }
    this.choiceRefreshTimer = setTimeout(poll, 25)
  }

  /** Poll the selected product projection without sharing the list refresh lock. */
  private async refreshProjection(handle: DilemmaHandle): Promise<boolean> {
    if (this.disposed || this.view.connected === false) return false
    const generation = this.connectionGeneration
    const currentSelected = this.view.dilemmas.find(item => item.handle === handle)
    if (currentSelected === undefined) return false
    const carrier = await this.remote.getProjection({ version: VERSION, handle })
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- disposal may occur during the awaited request.
    if (this.disposed || generation !== this.connectionGeneration) return false
    const result = business(carrier)
    if (!result.ok) return false
    // Polls overlap the long-running submit request. A response that started
    // before answerChoice may arrive afterward with an older lifecycle
    // revision; never let that stale projection erase the accepted answer.
    const current = this.view.dilemmas.find(item => item.handle === result.value.handle)
    if (current !== undefined && result.value.revision < current.revision) return true
    let pendingByHandle = { ...(this.view.pendingByHandle ?? {}) }
    const active = result.value.activeTurn
    if (active === undefined) pendingByHandle = withoutPending(pendingByHandle, handle)
    else pendingByHandle[handle] = {
      handle, persona: active.persona, messageId: active.messageId, deliveryOperationId: active.deliveryOperationId,
      turnOperationId: active.turnOperationId, executionState: active.executionState,
    }
    this.publishWithPending({
      ...this.view,
      dilemmas: this.view.dilemmas.map(item => item.handle === result.value.handle ? result.value : item),
    }, pendingByHandle)
    return true
  }

  /** State analysis is intentionally detached from submit; refresh until its
   * durable status becomes visible, with a bounded client-side observation
   * window so the UI does not spin forever after a failed Host operation. */
  private scheduleStateRefresh(): void {
    if (this.disposed || this.view.connected === false) return
    if (this.stateRefreshTimer !== undefined) clearTimeout(this.stateRefreshTimer)
    let attempts = 0
    const poll = (): void => {
      attempts += 1
      void this.refresh(true).then(() => {
        if (this.disposed || this.view.connected === false) return
        const selected = this.selectedProjection()
        // The first refresh observes claimed/running; keep polling until the
        // terminal analysis projection publishes candidates or a failure.
        const state = selected?.state
        // A completed analysis event is committed before its snapshot and
        // candidate facts; keep observing until the product-owned facts are
        // visible, otherwise a race can leave the details pane permanently
        // without confirmation controls.
        const settled = state?.status === 'failed' || state?.status === 'stale'
          || (state?.status === 'completed' && state.sharedStateItems !== undefined)
        if (settled || attempts >= 600) return
        this.stateRefreshTimer = setTimeout(poll, 100)
      })
    }
    this.stateRefreshTimer = setTimeout(poll, 25)
  }

  private async switchPersona(persona: RoleplayerSwitchRequest['persona']): Promise<boolean> {
    // A long-running choice turn can finish between the last poll and this
    // click; refresh first so the lifecycle revision sent to Host is current.
    const targetHandle = this.selectedProjection()?.handle
    if (targetHandle === undefined) return false
    const stableRequestId = requestId('switch')
    // State analysis publishes a short deterministic fact sequence; bounded
    // retries let this user mutation cross it without replaying any model call.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await this.refreshProjection(targetHandle)
      const projection = this.view.dilemmas.find(item => item.handle === targetHandle)
      if (projection === undefined) return false
      const result = await this.remote.switchPersona({
        version: VERSION, handle: projection.handle, expectedRevision: projection.revision,
        requestId: stableRequestId, persona,
      })
      const businessResult = business(result)
      if (businessResult.ok) {
        this.mutationVersion += 1
        this.publish({
          ...this.view,
          dilemmas: this.view.dilemmas.map(item => item.handle === businessResult.value.handle ? businessResult.value : item),
          selected: businessResult.value.handle,
          error: null,
        })
        await this.refreshProjection(targetHandle)
        return true
      }
      if (businessResult.error.code !== 'revision-conflict' || attempt === 7) {
        this.publish({ ...this.view, error: businessResult.error.message })
        return false
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    return false
  }

  private async rename(title: string): Promise<boolean> {
    const projection = this.selectedProjection(); if (projection === undefined) return false
    const request: RoleplayerRenameRequest = {
      version: VERSION, handle: projection.handle, expectedRevision: projection.revision,
      requestId: requestId('rename'), title,
    }
    return this.applyMutation(this.remote.rename(request))
  }

  private async retryMessage(messageId: ManRoleplayerOperationId, failedTurnOperationId: ManRoleplayerOperationId): Promise<boolean> {
    const projection = this.selectedProjection(); if (projection === undefined) return false
    const request: RoleplayerRetryRequest = {
      version: VERSION, handle: projection.handle, expectedRevision: projection.revision,
      requestId: requestId('retryMessage'), messageId, failedTurnOperationId,
    }
    const success = await this.applyMutation(this.remote.retryMessage(request))
    if (success) this.scheduleStateRefresh()
    return success
  }

  private async retryState(): Promise<boolean> {
    const projection = this.selectedProjection()
    const state = projection?.state
    if (projection === undefined || state?.operationId === undefined
      || state.retryable !== true || this.remote.retryState === undefined) return false
    const request: RoleplayerStateRetryRequest = {
      version: VERSION, handle: projection.handle, expectedRevision: projection.revision,
      requestId: requestId('retryState'), stateOperationId: state.operationId,
      retryOperationId: operationId('retryState'),
    }
    const success = await this.applyMutation(this.remote.retryState(request))
    if (success) this.scheduleStateRefresh()
    return success
  }

  private async discussionMutation(method: 'pause' | 'resume' | 'endStage'): Promise<boolean> {
    if (this.selectedProjection() === undefined) return false
    return this.simpleMutation(this.remote[method].bind(this.remote), method)
  }

  private async answerChoice(choiceOperationId: ManRoleplayerOperationId, answers: readonly RoleplayerChoiceAnswer[]): Promise<boolean> {
    const projection = this.selectedProjection(); if (projection === undefined) return false
    const turnOperationId = projection.choice?.turnOperationId
    const request: RoleplayerChoiceAnswerRequest = {
      version: VERSION, handle: projection.handle, expectedRevision: projection.revision,
      requestId: requestId('answerChoice'), choiceOperationId, answers,
    }
    const success = await this.applyMutation(this.remote.answerChoice(request))
    if (success && turnOperationId !== undefined) this.scheduleTurnRefresh(projection.handle, turnOperationId)
    return success
  }

  /** Continue observing the Agent turn after a mutation returns its intermediate projection. */
  private scheduleTurnRefresh(handle: DilemmaHandle, turnOperationId: string): void {
    if (this.disposed || this.view.connected === false) return
    if (this.turnRefreshTimer !== undefined) clearTimeout(this.turnRefreshTimer)
    const poll = (): void => {
      void this.refreshProjection(handle).then(() => {
        if (this.disposed || this.view.connected === false) return
        const projection = this.view.dilemmas.find(item => item.handle === handle)
        const failedOrCancelled = projection?.timeline.some(item => item.operationId === turnOperationId
          && (item.status === 'failed' || item.status === 'cancelled')) === true
        const acceptedVisible = projection?.timeline.some(item => item.operationId === turnOperationId
          && item.kind === 'persona-message' && item.status === 'completed' && item.text !== undefined) === true
        const settled = failedOrCancelled || acceptedVisible
        if (settled) {
          this.turnRefreshTimer = undefined
          let pendingByHandle = { ...(this.view.pendingByHandle ?? {}) }
          if (pendingByHandle[handle]?.turnOperationId === turnOperationId) {
            pendingByHandle = withoutPending(pendingByHandle, handle)
          }
          this.publishWithPending(this.view, pendingByHandle)
          if (acceptedVisible) this.scheduleStateRefresh()
          return
        }
        this.turnRefreshTimer = setTimeout(poll, 100)
      }, () => {
        if (this.disposed || this.view.connected === false) return
        // A transport failure does not prove the Host turn ended; retain the
        // observation until the persisted projection reports a terminal state.
        this.turnRefreshTimer = setTimeout(poll, 100)
      })
    }
    this.turnRefreshTimer = setTimeout(poll, 25)
  }

  private async cancelChoice(choiceOperationId: ManRoleplayerOperationId): Promise<boolean> {
    const projection = this.view.dilemmas.find(item => item.choice?.status === 'pending' && item.choice.operationId === choiceOperationId)
    if (projection === undefined) { this.publish({ ...this.view, error: 'choice operation owner not found' }); return false }
    const request: RoleplayerChoiceCancelRequest = {
      version: VERSION, handle: projection.handle, expectedRevision: projection.revision,
      requestId: requestId('cancelChoice'), choiceOperationId,
    }
    return this.applyMutation(this.remote.cancelChoice(request))
  }

  private async stateMutation(
    method: 'confirmState' | 'rejectState' | 'withdrawState' | 'resolveState', itemId: string,
  ): Promise<boolean> {
    const projection = this.selectedProjection(); if (projection === undefined) return false
    const request: RoleplayerStateRequest = {
      version: VERSION, handle: projection.handle, expectedRevision: projection.revision,
      requestId: requestId(method), itemId,
    }
    return this.applyMutation(this.remote[method](request))
  }

  private async stateModify(itemId: string, text: string, kind?: RoleplayerStateModifyRequest['kind']): Promise<boolean> {
    const projection = this.selectedProjection(); if (projection === undefined) return false
    const request: RoleplayerStateModifyRequest = {
      version: VERSION, handle: projection.handle, expectedRevision: projection.revision,
      requestId: requestId('modifyState'), itemId, text,
      ...(kind === undefined ? {} : { kind }),
    }
    return this.applyMutation(this.remote.modifyState(request))
  }

  private async evidenceMutation(
    method: 'challengeEvidence' | 'reviewEvidence' | 'withdrawEvidence', evidenceId: string,
  ): Promise<boolean> {
    const targetHandle = this.selectedProjection()?.handle
    if (targetHandle === undefined) return false
    const mutationRequestId = requestId(method)
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await this.refreshProjection(targetHandle)
      const projection = this.view.dilemmas.find(item => item.handle === targetHandle)
      if (projection === undefined) return false
      const request: RoleplayerEvidenceRequest = {
        version: VERSION, handle: projection.handle, expectedRevision: projection.revision,
        requestId: mutationRequestId, evidenceId,
      }
      const result = business(await this.remote[method](request))
      if (result.ok) {
        this.readMutation({ ok: true, value: { ok: true, value: result.value } })
        await this.refreshProjection(targetHandle)
        return true
      }
      if (result.error.code !== 'revision-conflict' || attempt === 7) {
        this.publish({ ...this.view, error: result.error.message })
        return false
      }
    }
    return false
  }

  private async cancel(
    messageId: ManRoleplayerOperationId,
    deliveryOperationId: ManRoleplayerOperationId,
    turnOperationId: ManRoleplayerOperationId,
  ): Promise<boolean> {
    const owner = Object.values(this.view.pendingByHandle ?? {}).find(item => item.messageId === messageId
      && item.deliveryOperationId === deliveryOperationId && item.turnOperationId === turnOperationId)
    if (owner === undefined) { this.publish({ ...this.view, error: 'cancel operation owner not found' }); return false }
    const projection = this.view.dilemmas.find(item => item.handle === owner.handle)
    if (projection === undefined) return false
    return this.applyMutation(this.remote.cancel({
      version: VERSION, handle: projection.handle, expectedRevision: projection.revision,
      requestId: requestId('cancel'), messageId, deliveryOperationId, turnOperationId,
    }))
  }

  private async archive(): Promise<boolean> { return this.simpleMutation(this.remote.archive.bind(this.remote), 'archive') }
  private async restore(): Promise<boolean> { return this.simpleMutation(this.remote.restore.bind(this.remote), 'restore') }

  private async delete(operation: ManRoleplayerOperationId): Promise<boolean> {
    const projection = this.selectedProjection(); if (projection === undefined) return false
    try {
      const result = await this.remote.delete({ version: VERSION, handle: projection.handle, expectedRevision: projection.revision, requestId: requestId('delete'), operationId: operation })
      const deleted = business(result)
      if (!deleted.ok) {
        if (deleted.error.code === 'deletion-failed') await this.refresh(true)
        this.publish({ ...this.view, error: deleted.error.message })
        return false
      }
      if (!isValidDeletedValue(deleted.value, projection.handle)) {
        this.publish({ ...this.view, error: 'invalid dilemma deletion acknowledgement' })
        return false
      }
      const remaining = this.view.dilemmas.filter(item => item.handle !== deleted.value.handle)
      this.publish({ ...this.view, dilemmas: remaining, selected: null, error: null })
      return true
    } catch (error: unknown) {
      this.publish({ ...this.view, error: error instanceof Error ? error.message : 'dilemma deletion failed' })
      return false
    }
  }

  private async simpleMutation(
    method: (request: RoleplayerMutationRequest) => Promise<RemoteResult<RoleplayerProjectionResult>>,
    prefix: string,
  ): Promise<boolean> {
    const stableRequestId = requestId(prefix)
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const projection = this.selectedProjection(); if (projection === undefined) return false
      try {
        const result = business(await method({
          version: VERSION, handle: projection.handle,
          expectedRevision: projection.revision, requestId: stableRequestId,
        }))
        if (result.ok) {
          this.mutationVersion += 1
          this.publish({
            ...this.view,
            dilemmas: this.view.dilemmas.map(item => item.handle === result.value.handle ? result.value : item),
            selected: result.value.handle,
            error: null,
          })
          await this.refresh(true)
          return true
        }
        if (result.error.code === 'revision-conflict' && attempt < 7) { await this.refresh(true); continue }
        this.publish({ ...this.view, error: result.error.message }); return false
      } catch (error: unknown) {
        this.publish({ ...this.view, error: error instanceof Error ? error.message : 'dilemma operation failed' }); return false
      }
    }
    return false
  }

  private async applyMutation(result: Promise<RemoteResult<RoleplayerProjectionResult>>): Promise<boolean> {
    const generation = this.connectionGeneration
    try {
      const carrier = await result
      if (this.disposed || generation !== this.connectionGeneration) return false
      const success = this.readMutation(carrier)
      if (success) await this.refresh(true)
      return success
    } catch (error: unknown) {
      if (this.disposed || generation !== this.connectionGeneration) return false
      this.publish({ ...this.view, error: error instanceof Error ? error.message : 'dilemma operation failed' })
      return false
    }
  }

  private readMutation(carrier: RemoteResult<RoleplayerProjectionResult>): boolean {
    const result = business(carrier)
    if (!result.ok) { this.publish({ ...this.view, error: result.error.message }); return false }
    this.mutationVersion += 1
    const current = this.view.dilemmas.map(item => item.handle === result.value.handle ? result.value : item)
    this.publish({ ...this.view, dilemmas: current, error: null })
    return true
  }

  private publish(view: RoleplayerStoreView): void {
    if (this.disposed) return
    if (view.selected !== this.view.selected) this.selection?.write(view.selected)
    this.view = Object.freeze({ ...view, dilemmas: Object.freeze([...view.dilemmas]) })
    for (const listener of this.listeners) listener()
  }
}
