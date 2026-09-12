import { readdirSync } from 'node:fs'
import { basename } from 'node:path'
import type { PersonaId } from '../domain/schema.ts'
import { ConversationAggregate, defaultSessionIdFor } from '../aggregate/aggregate.ts'
import type { PersonaRegistry } from '../persona/registry.ts'
import type { BranchSessionWriter } from '../runtime/message-delivery.ts'
import { deliverCurrentUserMessage, type DeliveryResult } from '../runtime/message-delivery.ts'
import { TurnRunner, type TurnTask } from './turn-runner.ts'
import { commitFeedback } from '../dialogue/feedback-commit.ts'
import { deterministicSafetyGate } from '../dialogue/safety.ts'
import type { DilemmaItem } from '../domain/schema.ts'

export interface ProductConversation { id: string; activePersona: PersonaId; lifecycle: 'active'|'paused'|'closed' }
/** Legacy isolated fixture. Normal product writes use ConversationRepository below. */
export class ProductRepository {
  private readonly rows = new Map<string, ProductConversation>()
  create(id: string, personaId: PersonaId): ProductConversation { if (this.rows.has(id)) throw new Error('conversation exists'); const row = { id, activePersona: personaId, lifecycle: 'active' as const }; this.rows.set(id, row); return row }
  list(): ProductConversation[] { return [...this.rows.values()] }
  get(id: string): ProductConversation | undefined { return this.rows.get(id) }
  switchPersona(id: string, personaId: PersonaId): ProductConversation { const row = this.rows.get(id); if (!row) throw new Error('conversation missing'); row.activePersona = personaId; return row }
}

/** The one Host owner for Trunk/Aggregate instances and per-conversation writes. */
export class ConversationRepository {
  private readonly conversations = new Map<string, ConversationAggregate>()
  readonly diagnostics: Array<{ conversationId: string; code: 'trunk-load-failed' }> = []
  private readonly queues = new Map<string, Promise<unknown>>()
  constructor(private readonly storageDir: string, private readonly registry: PersonaRegistry) {}
  create(id: string, persona: PersonaId): ConversationAggregate {
    if (this.conversations.has(id)) throw new Error('conversation exists')
    const aggregate = ConversationAggregate.create(id, this.storageDir, persona, this.registry)
    // A product conversation cannot accept its first message without a Branch
    // target. The Host may create the corresponding DSH Session separately,
    // but the authoritative target remains this aggregate index.
    aggregate.switchPersona(this.registry.requireActiveForCreate(persona).id, current => this.sessionIdFor(id, current))
    this.conversations.set(id, aggregate)
    return aggregate
  }
  /** Session ids are stable across restart and unique across conversations. */
  sessionIdFor(conversationId: string, persona: PersonaId): string {
    return `${defaultSessionIdFor(persona)}--${conversationId}`
  }
  get(id: string): ConversationAggregate {
    const existing = this.conversations.get(id)
    if (existing) return existing
    const aggregate = ConversationAggregate.load(id, this.storageDir, this.registry)
    this.conversations.set(id, aggregate)
    return aggregate
  }
  list(): ConversationAggregate[] {
    const ids = new Set(this.conversations.keys())
    try { for (const name of readdirSync(this.storageDir)) if (name.endsWith('.jsonl')) ids.add(basename(name, '.jsonl')) } catch { /* empty product store */ }
    const rows: ConversationAggregate[] = []; this.diagnostics.length = 0
    for (const id of ids) { try { rows.push(this.get(id)) } catch { this.diagnostics.push({ conversationId: id, code: 'trunk-load-failed' }) } }
    return rows
  }
  /** Serializes one Conversation without preventing another from progressing. */
  async withConversation<T>(id: string, operation: (aggregate: ConversationAggregate) => Promise<T> | T): Promise<T> {
    const prior = this.queues.get(id) ?? Promise.resolve()
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    this.queues.set(id, prior.then(() => gate))
    await prior
    try { return await operation(this.get(id)) } finally { release(); if (this.queues.get(id) === gate) this.queues.delete(id) }
  }
}

export type ProductTaskView = Pick<TurnTask, 'taskId' | 'status' | 'reason'>
export type ProductConversationView = {
  conversationId: string; activePersonaId: PersonaId; lifecycle: 'active' | 'paused' | 'closed'
  activeBranchSessionId: string | null
  branches: Array<{ personaId: PersonaId; sessionId: string }>
  userRaws: Array<{ rawRef: string; text: string }>
  candidateItems: unknown[]; confirmedItems: unknown[]; branchProgress: Record<string, unknown>; taskState: ProductTaskView | null
}
export interface ProductTaskStart { taskId: string; run: (signal: AbortSignal) => Promise<unknown>; budgetMs?: number; wakePending?: () => boolean }
/** Creates the normal v2 task only after the Branch delivery is durable. */
export type ProductTurnTaskFactory = (input: { aggregate: ConversationAggregate; messageId: string; text: string; rawRef: string; personaId: PersonaId; delivery: DeliveryResult }) => ProductTaskStart | undefined

/** The only normal application write boundary used by Remotes and commands. */
export class ManRolesProductService {
  private readonly runner: TurnRunner
  private readonly activeTasks = new Map<string, ProductTaskView>()
  constructor(readonly conversations: ConversationRepository, runner = new TurnRunner(), private readonly taskFactory?: ProductTurnTaskFactory) { this.runner = runner }
  private view(aggregate: ConversationAggregate): ProductConversationView {
    const state = aggregate.trunk.state
    return {
      conversationId: aggregate.conversationId, activePersonaId: aggregate.activePersona, lifecycle: state.lifecycle ?? 'active', activeBranchSessionId: aggregate.currentBranch()?.sessionId ?? null,
      branches: [...aggregate.branchesIndex.values()].map(branch => ({ personaId: branch.persona, sessionId: branch.sessionId })),
      userRaws: state.userRaws.map(raw => ({ rawRef: raw.rawRef, text: raw.text })),
      candidateItems: state.dilemmaItems.filter(item => item.status === 'candidate' && !item.supersededBy),
      confirmedItems: state.dilemmaItems.filter(item => item.status === 'confirmed' && !item.supersededBy),
      branchProgress: state.branchProgress, taskState: this.activeTasks.get(aggregate.conversationId) ?? null,
    }
  }
  create(id: string, personaId: PersonaId): ProductConversationView { return this.view(this.conversations.create(id, personaId)) }
  list(): ProductConversationView[] { return this.conversations.list().map(aggregate => this.view(aggregate)) }
  viewConversation(id: string): ProductConversationView { return this.view(this.conversations.get(id)) }
  switchPersona(id: string, personaId: PersonaId): ProductConversationView { const aggregate = this.conversations.get(id); aggregate.switchPersona(personaId, current => this.conversations.sessionIdFor(id, current)); return this.view(aggregate) }
  async send(input: { conversationId: string; messageId: string; text: string; session: BranchSessionWriter; flush: (session: BranchSessionWriter) => Promise<unknown> | unknown; findUserMessageByRawRef?: (rawRef: string) => boolean | Promise<boolean>; queueUserMessage?: (data: unknown) => void; wakePending?: () => boolean; task?: ProductTaskStart }): Promise<{ ok: true; rawRef: string; taskId?: string } | { ok: false; code: string }> {
    return this.conversations.withConversation(input.conversationId, async aggregate => {
      const branch = aggregate.currentBranch()
      if (!branch) return { ok: false, code: 'branch-missing' as const }
      // Safety is the outer product boundary.  Do not enqueue a dangerous
      // message and then rely on a later coordinator stage to avoid a call.
      if (deterministicSafetyGate(input.text).disposition !== 'allow') return { ok: false, code: 'safety-blocked' as const }
      const result = await deliverCurrentUserMessage({ trunk: aggregate.trunk, persona: aggregate.activePersona, session: input.session, sessionId: branch.sessionId, messageId: input.messageId, text: input.text, flush: input.flush, findUserMessageByRawRef: input.findUserMessageByRawRef, queueUserMessage: input.queueUserMessage, wakePending: input.wakePending })
      if (result.status !== 'committed') return { ok: false, code: 'delivery-failed' as const }
      const task = input.task ?? this.taskFactory?.({ aggregate, messageId: input.messageId, text: input.text, rawRef: result.rawRef, personaId: aggregate.activePersona, delivery: result })
      if (!task) return { ok: true, rawRef: result.rawRef }
      const prior = this.activeTasks.get(aggregate.conversationId)
      if (prior?.status === 'running' && prior.taskId !== task.taskId) return { ok: false, code: 'conversation-busy' as const }
      const taskPersona = aggregate.activePersona
      this.activeTasks.set(aggregate.conversationId, { taskId: task.taskId, status: 'running' })
      // `task.run` owns Actor wake-up.  This ensures the v2 safety boundary
      // can return without reaching the model for high-risk input.
      void this.runner.runAfterDelivery({ taskId: task.taskId, deliveryCommitted: result.canStartGeneration, operation: signal => task.run(signal), budgetMs: task.budgetMs }).then(task => {
        if (task.status === 'blocked' && task.reason === 'budget-exceeded') {
          // Budget is a durable product outcome, never an invented persona
          // reply.  The retry can therefore reuse the same raw with a new id.
          aggregate.recordTaskBudgetBlocked({ taskId: task.taskId, personaId: taskPersona, branchSessionId: branch.sessionId, branchTurn: Math.max(1, aggregate.trunk.state.deliveryCommitted.filter(delivery => delivery.persona_id === taskPersona).length), status: 'blocked', reason: 'budget_exceeded', retryable: true })
        }
        this.activeTasks.set(aggregate.conversationId, { taskId: task.taskId, status: task.status, ...(task.reason ? { reason: task.reason } : {}) })
      })
      return { ok: true, rawRef: result.rawRef, taskId: task.taskId }
    })
  }
  cancel(conversationId: string, taskId: string): boolean {
    const current = this.activeTasks.get(conversationId)
    return !!current && current.taskId === taskId && this.runner.cancel(taskId)
  }
  /** Diagnostic read only; Product Remotes expose the narrowed view above. */
  task(taskId: string): TurnTask | undefined { return this.runner.get(taskId) }
  async feedback(input: { conversationId: string; itemId: string; action: 'confirm' | 'partial-confirm' | 'correct' | 'reject' | 'skip'; operationId: string; replacement?: string }): Promise<{ ok: true } | { ok: false; code: string }> {
    return this.conversations.withConversation(input.conversationId, async aggregate => {
      const item = aggregate.trunk.state.dilemmaItems.find(candidate => candidate.id === input.itemId)
      if (!item) return { ok: false as const, code: 'candidate-missing' }
      const replacement = input.action === 'reject' || input.action === 'skip' ? undefined : this.confirmedRevision(item, input.replacement)
      try {
        commitFeedback({ trunk: aggregate.trunk, state: aggregate.trunk.state, kind: input.action, personaId: aggregate.activePersona, messageId: input.operationId, taskId: input.operationId, eventPurpose: 'product-feedback', sourceRawRefs: item.sourceRawRefs, itemId: item.id, replacement })
        return { ok: true as const }
      } catch (error) { return { ok: false as const, code: error instanceof Error ? error.message : 'feedback-failed' } }
    })
  }
  private confirmedRevision(item: DilemmaItem, text?: string): DilemmaItem {
    if (text !== undefined && text.trim() === '') throw new Error('replacement must not be blank')
    return { ...item, id: `${item.id}:r${item.revision + 1}`, text: text?.trim() || item.text, status: 'confirmed', visibility: 'shared-confirmed', revision: item.revision + 1, supersedes: item.id }
  }
}
