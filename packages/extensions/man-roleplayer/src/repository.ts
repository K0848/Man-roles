/** Host-owned durable repository for the product conversation event stream. */

import { isDeepStrictEqual } from 'node:util'
import type { Domain, DomainFacility, KvTable } from '@deepseek-ai/dsh-storage-domain'
import { project } from './product/index.ts'
import type { DeletionReceipt, DilemmaConversation, DilemmaId, OperationId, ProductEvent, TurnOperationId, TurnStatus } from './product/index.ts'
import { manRoleplayerProductDomainSpec } from './spec.ts'

/** Append outcome, distinguishing a request replay from a newly committed fact. */
export interface ProductAppendResult {
  readonly accepted: boolean
  readonly conversation: DilemmaConversation
}

/** Result of the single-winner turn terminal transition. */
export interface TurnTerminalResult extends ProductAppendResult { readonly accepted: boolean; readonly terminal?: TurnStatus }
/** Result of the single-winner delivery terminal transition. */
export interface DeliveryTerminalResult extends ProductAppendResult { readonly accepted: boolean; readonly terminal?: 'delivered' | 'cancelled' | 'failed' }
/** Result of settling one message's delivery and turn facts as one commit. */
export interface MessageSettlementResult extends ProductAppendResult {
  readonly accepted: boolean
  readonly terminal?: 'delivered' | 'completed' | 'cancelled' | 'failed'
}
/** Result of an atomic Claim sidecar commit against one evidence revision. */
export interface ClaimSidecarCommitResult extends ProductAppendResult { readonly accepted: boolean; readonly status: 'accepted' | 'stale' }
/** Result of the single-winner evidence-tool claim terminal transition. */
export interface EvidenceToolClaimTerminalResult extends ProductAppendResult { readonly accepted: boolean; readonly status: 'completed' | 'failed' | 'cancelled' }
/** Result of a compare-and-append state-item transition. */
export interface SharedStateCommitResult extends ProductAppendResult { readonly accepted: boolean }

/**
 * Durable product event repository. The storage-domain table is the source of
 * truth: this class retains only its open handle and an operation tail, never
 * a second event or projection cache.
 */
export class ProductConversationRepository {
  private domain?: Domain<typeof manRoleplayerProductDomainSpec>
  private table?: KvTable<string, readonly ProductEvent[]>
  private receipts?: KvTable<string, DeletionReceipt>
  private tail: Promise<void> = Promise.resolve()
  private opening?: Promise<void>
  private closed = false

  /** @param facility - Host-provided storage-domain facility. */
  constructor(private readonly facility: DomainFacility) {}

  /** Open the durable domain; repeated opens share the same lifecycle. */
  async open(): Promise<void> {
    if (this.closed) throw new Error('product repository is closed')
    if (this.domain !== undefined) return
    this.opening ??= this.openDomain()
    await this.opening
  }

  /** Close after queued writes land, then release the domain handle. */
  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    await this.opening?.then(undefined, () => {
      // An open failure leaves no owned domain; close still must settle so the
      // host can release this repository without masking the original failure.
    })
    await this.tail
    await this.domain?.close()
  }

  /** Create one conversation from its leading `created` fact. */
  create(event: Extract<ProductEvent, { type: 'created' }>): Promise<DilemmaConversation> {
    return this.enqueue(async () => {
      const table = this.requireTable()
      const existing = table.get(event.id)
      if (existing !== undefined) {
        if (existing[0]?.requestId === event.requestId && isDeepStrictEqual(existing[0], event)) {
          return project(existing)
        }
        if (existing[0]?.requestId === event.requestId) {
          throw new Error(`request '${event.requestId}' conflicts with the existing dilemma '${event.id}'`)
        }
        throw new Error(`dilemma '${event.id}' already exists`)
      }
      await table.put(event.id, [event])
      return project([event])
    })
  }

  /** Append one fact, deduplicating by request id in the serialized operation. */
  append(id: DilemmaId, event: Exclude<ProductEvent, { type: 'created' }>): Promise<ProductAppendResult> {
    return this.enqueue(async () => {
      const table = this.requireTable()
      const events = table.get(id)
      if (events === undefined) throw new Error(`unknown dilemma '${id}'`)
      const prior = events.find(candidate => candidate.requestId === event.requestId)
      if (prior !== undefined) {
        if (!isDeepStrictEqual(prior, event)) {
          throw new Error(`request '${event.requestId}' conflicts with the existing product event`)
        }
        return { accepted: false, conversation: project(events) }
      }
      const next = [...events, event]
      await table.put(id, next)
      return { accepted: true, conversation: project(next) }
    })
  }

  /** Append a state transition batch only if the product revision is unchanged. */
  appendSharedStateIfCurrent(
    id: DilemmaId, expectedRevision: number,
    events: readonly Extract<ProductEvent, { type: 'shared-state' }>[],
  ): Promise<SharedStateCommitResult> {
    return this.enqueue(async () => {
      const table = this.requireTable(); const current = table.get(id)
      if (current === undefined) throw new Error(`unknown dilemma '${id}'`)
      if (events.length === 0) throw new Error('shared-state transition requires at least one event')
      const conversation = project(current)
      if (conversation.lifecycleRevision !== expectedRevision) throw new Error(`dilemma '${id}' revision changed before state transition`)
      const next = [...current]
      let changed = false
      for (const event of events) {
        const prior = current.find(candidate => candidate.requestId === event.requestId)
        if (prior !== undefined) {
          if (!isDeepStrictEqual(prior, event)) throw new Error(`request '${event.requestId}' conflicts with the existing state event`)
          continue
        }
        next.push(event); changed = true
      }
      if (changed) await table.put(id, next)
      return { accepted: changed, conversation: project(next) }
    })
  }

  /** Atomically claim the only terminal state allowed for one turn operation. */
  appendTurnTerminalIfOpen(id: DilemmaId, operation: TurnOperationId, event: Extract<ProductEvent, { type: 'turn' }>): Promise<TurnTerminalResult> {
    return this.enqueue(async () => {
      const table = this.requireTable(); const events = table.get(id)
      if (events === undefined) throw new Error(`unknown dilemma '${id}'`)
      const prior = events.find(candidate => candidate.type === 'turn' && candidate.turnOperationId === operation && ['completed', 'cancelled', 'failed'].includes(candidate.status))
      if (prior?.type === 'turn') return { accepted: false, terminal: prior.status, conversation: project(events) }
      const next = [...events, event]; await table.put(id, next)
      return { accepted: true, terminal: event.status, conversation: project(next) }
    })
  }

  /** Atomically append one delivery terminal and never overwrite an existing terminal. */
  appendDeliveryTerminalIfOpen(id: DilemmaId, operation: import('./product/index.ts').DeliveryOperationId, event: Extract<ProductEvent, { type: 'message-delivery' }>): Promise<DeliveryTerminalResult> {
    return this.enqueue(async () => {
      const table = this.requireTable(); const events = table.get(id)
      if (events === undefined) throw new Error(`unknown dilemma '${id}'`)
      const prior = events.find(candidate => candidate.type === 'message-delivery' && candidate.deliveryOperationId === operation && ['delivered', 'cancelled', 'failed'].includes(candidate.status))
      if (prior?.type === 'message-delivery' && prior.status !== 'claimed' && prior.status !== 'pending') return { accepted: false, terminal: prior.status, conversation: project(events) }
      const next = [...events, event]; await table.put(id, next)
      return { accepted: true, terminal: event.status as 'delivered' | 'cancelled' | 'failed', conversation: project(next) }
    })
  }

  /** Atomically settle the delivery and turn terminals for one message operation. */
  settleMessageOperationIfOpen(
    id: DilemmaId,
    deliveryOperation: import('./product/index.ts').DeliveryOperationId,
    turnOperation: TurnOperationId,
    delivery: Extract<ProductEvent, { type: 'message-delivery' }>,
    turn: Extract<ProductEvent, { type: 'turn' }>,
    sidecars: readonly Extract<ProductEvent, { type: 'claim-sidecar' }>[] = [],
    expectedEvidenceRevision?: number,
  ): Promise<MessageSettlementResult> {
    return this.enqueue(async () => {
      const table = this.requireTable(); const events = table.get(id)
      if (events === undefined) throw new Error(`unknown dilemma '${id}'`)
      const deliveryTerminal = events.find((event): event is Extract<ProductEvent, { type: 'message-delivery' }> => event.type === 'message-delivery' && event.deliveryOperationId === deliveryOperation && ['delivered', 'cancelled', 'failed'].includes(event.status))
      const turnTerminal = events.find((event): event is Extract<ProductEvent, { type: 'turn' }> => event.type === 'turn' && event.turnOperationId === turnOperation && ['completed', 'cancelled', 'failed'].includes(event.status))
      if (deliveryTerminal !== undefined || turnTerminal !== undefined) {
        const terminal = turnTerminal?.status === 'completed' || turnTerminal?.status === 'cancelled' || turnTerminal?.status === 'failed'
          ? turnTerminal.status
          : deliveryTerminal?.status === 'delivered' ? 'completed' as const
            : deliveryTerminal?.status === 'cancelled' || deliveryTerminal?.status === 'failed' ? deliveryTerminal.status : undefined
        if (terminal === undefined) throw new Error('message terminal state could not be determined')
        const next = [...events]
        if (deliveryTerminal === undefined) next.push(delivery)
        if (turnTerminal === undefined) next.push({ ...turn, status: terminal === 'completed' ? 'completed' : terminal })
        const currentEvidenceRevision = events.filter(event => event.type === 'evidence').length
        const sidecarStatus = terminal === 'completed' && expectedEvidenceRevision === currentEvidenceRevision ? 'accepted' as const : 'stale' as const
        for (const sidecar of sidecars) {
          const prior = events.find(event => event.requestId === sidecar.requestId)
          if (prior !== undefined) {
            if (!isDeepStrictEqual(prior, { ...sidecar, status: prior.type === 'claim-sidecar' ? prior.status : sidecarStatus })) throw new Error(`request '${sidecar.requestId}' conflicts with the existing product event`)
            continue
          }
          next.push({ ...sidecar, status: sidecarStatus })
        }
        if (next.length !== events.length) await table.put(id, next)
        return { accepted: next.length !== events.length, terminal, conversation: project(next) }
      }
      const currentEvidenceRevision = events.filter(event => event.type === 'evidence').length
      const evidenceChanged = sidecars.length > 0 && expectedEvidenceRevision !== currentEvidenceRevision
      const terminal = evidenceChanged ? 'failed' as const : turn.status === 'completed' ? 'completed' as const
        : turn.status === 'cancelled' ? 'cancelled' as const
          : turn.status === 'failed' ? 'failed' as const
            : delivery.status === 'delivered' || delivery.status === 'cancelled' || delivery.status === 'failed' ? delivery.status : 'failed' as const
      const committedDelivery = evidenceChanged ? { ...delivery, status: 'failed' as const } : delivery
      const { sessionEventId: _sessionEventId, ...turnWithoutSessionEvent } = turn
      const committedTurn = evidenceChanged ? { ...turnWithoutSessionEvent, status: 'failed' as const } : turn
      const committedSidecars = sidecars.map(sidecar => ({ ...sidecar, status: terminal === 'completed' ? 'accepted' as const : 'stale' as const }))
      const next = [...events, committedDelivery, committedTurn, ...committedSidecars]
      await table.put(id, next)
      return { accepted: true, terminal, conversation: project(next) }
    })
  }

  /** Append all sidecars once, only while the turn and evidence revision remain current. */
  appendClaimSidecarsIfCurrent(id: DilemmaId, turnOperation: TurnOperationId, expectedEvidenceRevision: number, claims: readonly Extract<ProductEvent, { type: 'claim-sidecar' }>[]): Promise<ClaimSidecarCommitResult> {
    return this.enqueue(async () => {
      const table = this.requireTable(); const events = table.get(id)
      if (events === undefined) throw new Error(`unknown dilemma '${id}'`)
      if (claims.length === 0) throw new Error('claim sidecar requires at least one claim')
      const replay = claims.length > 0 && claims.every((claim) => {
        const prior = events.find(event => event.requestId === claim.requestId)
        if (prior === undefined) return false
        if (!isDeepStrictEqual(prior, claim)) throw new Error(`request '${claim.requestId}' conflicts with the existing product event`)
        return true
      })
      if (replay) return { accepted: false, status: claims[0]?.status ?? 'stale', conversation: project(events) }
      const turn = events.findLast(event => event.type === 'turn' && event.turnOperationId === turnOperation)
      const evidenceRevision = events.filter(event => event.type === 'evidence').length
      const unavailable = claims.some(claim => claim.evidenceIds.some(evidenceId => events.findLast((event): event is Extract<ProductEvent, { type: 'evidence' }> => event.type === 'evidence' && event.evidenceId === evidenceId)?.status !== 'available'))
      const status = turn?.type !== 'turn' || turn.status !== 'completed' || evidenceRevision !== expectedEvidenceRevision || unavailable ? 'stale' as const : 'accepted' as const
      const next = [...events, ...claims.map(claim => ({ ...claim, status }))]
      await table.put(id, next)
      return { accepted: true, status, conversation: project(next) }
    })
  }

  /** Atomically settle one claimed evidence-tool operation exactly once. */
  settleEvidenceToolClaimIfOpen(id: DilemmaId, operation: OperationId, event: Extract<ProductEvent, { type: 'evidence-tool-claim' }>): Promise<EvidenceToolClaimTerminalResult> {
    return this.enqueue(async () => {
      const table = this.requireTable(); const events = table.get(id)
      if (events === undefined) throw new Error(`unknown dilemma '${id}'`)
      if (event.status === 'claimed') throw new Error('evidence-tool terminal must not be claimed')
      const prior = events.findLast((candidate): candidate is Extract<ProductEvent, { type: 'evidence-tool-claim' }> => candidate.type === 'evidence-tool-claim' && candidate.operationId === operation && candidate.status !== 'claimed')
      if (prior?.status === 'completed' || prior?.status === 'failed' || prior?.status === 'cancelled') return { accepted: false, status: prior.status, conversation: project(events) }
      if (!events.some(candidate => candidate.type === 'evidence-tool-claim' && candidate.operationId === operation && candidate.status === 'claimed')) throw new Error(`evidence-tool claim '${operation}' is not open`)
      const next = [...events, event]; await table.put(id, next)
      return { accepted: true, status: event.status, conversation: project(next) }
    })
  }

  /** Commit returned evidence provenance when the evidence revision observed before completion is still current. */
  completeEvidenceToolClaimIfOpen(id: DilemmaId, operation: OperationId, provenance: readonly Extract<ProductEvent, { type: 'evidence' }>[], claim: Extract<ProductEvent, { type: 'evidence-tool-claim' }>, expectedRevision: number): Promise<EvidenceToolClaimTerminalResult> {
    return this.enqueue(async () => {
      const table = this.requireTable(); const events = table.get(id)
      if (events === undefined) throw new Error(`unknown dilemma '${id}'`)
      if (claim.status !== 'completed') throw new Error('evidence-tool completion must be terminal completed')
      const prior = events.findLast((candidate): candidate is Extract<ProductEvent, { type: 'evidence-tool-claim' }> => candidate.type === 'evidence-tool-claim' && candidate.operationId === operation && candidate.status !== 'claimed')
      if (prior?.status === 'completed' || prior?.status === 'failed' || prior?.status === 'cancelled') return { accepted: false, status: prior.status, conversation: project(events) }
      const claimed = events.findLast((candidate): candidate is Extract<ProductEvent, { type: 'evidence-tool-claim' }> => candidate.type === 'evidence-tool-claim' && candidate.operationId === operation && candidate.status === 'claimed')
      if (claimed === undefined || claimed.persona !== claim.persona || claimed.sessionId !== claim.sessionId || claimed.turnOperationId !== claim.turnOperationId || claimed.fingerprint !== claim.fingerprint || claimed.evidenceRevision !== claim.evidenceRevision) throw new Error(`evidence-tool claim '${operation}' does not match its open claim`)
      const returned = new Set(claim.returnedEvidenceIds ?? [])
      const provenanceIds = new Set(provenance.map(item => item.evidenceId))
      if (returned.size !== provenanceIds.size || [...returned].some(evidenceId => !provenanceIds.has(evidenceId))) throw new Error(`evidence-tool claim '${operation}' returned ids do not match provenance`)
      const currentRevision = events.filter(event => event.type === 'evidence').length
      const invalid = currentRevision !== expectedRevision || provenance.some((item) => {
        const priorEvidence = events.findLast((event): event is Extract<ProductEvent, { type: 'evidence' }> => event.type === 'evidence' && event.evidenceId === item.evidenceId)
        return priorEvidence?.status === 'withdrawn' || priorEvidence?.status === 'challenged'
      })
      const finalClaim = invalid ? { ...claim, status: 'failed' as const, returnedEvidenceIds: [] } : claim
      const next = [...events, ...(invalid ? [] : provenance), finalClaim]
      await table.put(id, next)
      return { accepted: true, status: finalClaim.status === 'completed' ? 'completed' : 'failed', conversation: project(next) }
    })
  }

  /** Read and replay one persisted event list. */
  async read(id: DilemmaId): Promise<DilemmaConversation | undefined> {
    await this.open()
    const events = this.requireTable().get(id)
    return events === undefined ? undefined : project(events)
  }

  /** Read the authoritative append-only facts for deterministic context construction. */
  async readEvents(id: DilemmaId): Promise<readonly ProductEvent[] | undefined> {
    await this.open()
    const events = this.requireTable().get(id)
    return events === undefined ? undefined : [...events]
  }

  /** List and replay every persisted conversation in table-key order. */
  async list(): Promise<readonly DilemmaConversation[]> {
    await this.open()
    return [...this.requireTable().entries()].map(([, events]) => project(events))
  }

  /** Permanently remove product-owned events after both Session histories are gone. */
  remove(id: DilemmaId): Promise<boolean> {
    return this.enqueue(async () => this.requireTable().delete(id))
  }

  /** Record the deletion intent before product removal, idempotently. */
  recordDeletionIntent(receipt: Extract<DeletionReceipt, { status: 'pending' }>): Promise<boolean> {
    return this.enqueue(async () => {
      const receipts = this.requireReceipts()
      const prior = receipts.get(receipt.operationId)
      if (prior !== undefined) {
        if (!isDeepStrictEqual(prior, receipt)) throw new Error(`deletion receipt '${receipt.operationId}' conflicts with the existing receipt`)
        return false
      }
      await receipts.put(receipt.operationId, receipt)
      return true
    })
  }

  /** Mark a deletion proof complete only after product removal succeeded. */
  completeDeletionReceipt(operationId: OperationId, handleDigest: string, completedAt: number): Promise<boolean> {
    return this.enqueue(async () => {
      const receipts = this.requireReceipts()
      const prior = receipts.get(operationId)
      if (prior === undefined) throw new Error(`deletion receipt '${operationId}' has no pending intent`)
      if (prior.handleDigest !== handleDigest) throw new Error(`deletion receipt '${operationId}' conflicts with its handle`)
      if (prior.status === 'completed') return false
      await receipts.put(operationId, { operationId, handleDigest, status: 'completed', completedAt, deleted: true })
      return true
    })
  }

  /** Read one deletion proof without exposing the deleted conversation. */
  async readDeletionReceipt(operationId: OperationId): Promise<DeletionReceipt | undefined> {
    await this.open()
    const receipt = this.requireReceipts().get(operationId)
    return receipt === undefined ? undefined : { ...receipt }
  }

  private async openDomain(): Promise<void> {
    const domain = await this.facility.open(manRoleplayerProductDomainSpec)
    this.domain = domain
    this.table = domain.table('conversations')
    this.receipts = domain.table('deletion_receipts')
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.closed) return Promise.reject(new Error('product repository is closed'))
    const result = this.tail.then(async () => { await this.open(); return await operation() })
    this.tail = result.then(() => {}, () => {})
    return result
  }

  private requireTable(): KvTable<string, readonly ProductEvent[]> {
    if (this.table === undefined) throw new Error('product repository is not open')
    return this.table
  }

  private requireReceipts(): KvTable<string, DeletionReceipt> {
    if (this.receipts === undefined) throw new Error('deletion receipt table is not open')
    return this.receipts
  }
}
