import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { PersonaId } from '../domain/schema.ts'
import type { ConversationAggregate } from '../aggregate/aggregate.ts'
import type { PersonaRegistry } from '../persona/registry.ts'
import { buildContentLibraries } from '../retrieval/data.ts'
import { setupActorAgent } from '../runtime/actor-agent.ts'
import { ActorTurnStateRegistry } from '../runtime/turn-state.ts'
import { runDialogueTurnV2AfterDelivery } from '../dialogue/coordinator.ts'
import type { ProductTurnTaskFactory } from './service.ts'
import { nativeActorDeliveryBridge, type NativeActorBranch } from './native-actor-branch.ts'
import { branchHistory, verifiedReplyForMessage } from './branch-history.ts'
import { branchUserMessageFromData, branchUserMessageSourceFromData } from '../branch/message-source.ts'
export { branchHistory, verifiedReplyForMessage } from './branch-history.ts'

type EventLike = { type: string; seq?: number; data?: unknown }
type BranchActor = NativeActorBranch & Pick<Agent, 'whenIdle' | 'cancel'> & { session: NativeActorBranch['session'] & { events: readonly EventLike[] } }
type AgentHost = Pick<Context, 'agents' | 'sessions'>

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
function sourceHasRawRef(data: unknown, rawRef: string): boolean {
  const source = branchUserMessageSourceFromData(branchUserMessageFromData(data))
  return isRecord(source) && source.raw_ref === rawRef
}
function durableBranchHasRaw(events: readonly EventLike[], rawRef: string): boolean {
  return events.some(event => {
    if (!isRecord(event.data)) return false
    if (event.type === 'user/message') return sourceHasRawRef(event.data, rawRef)
    if (event.type !== 'agent/inbox/spliced' || !Array.isArray(event.data.inserted)) return false
    return event.data.inserted.some(message => sourceHasRawRef(message, rawRef))
  })
}
/**
 * Host-only owner of live DSH Actors.  It never reads a foreign branch: all
 * operations are addressed by the aggregate's already-indexed session id.
 */
export class NativeActorProductRuntime {
  private readonly state = new ActorTurnStateRegistry()
  private readonly libs = buildContentLibraries()
  constructor(private readonly ctx: AgentHost, private readonly registry: PersonaRegistry) {}

  async branch(aggregate: ConversationAggregate): Promise<ReturnType<typeof nativeActorDeliveryBridge> & { actor: BranchActor }> {
    const current = aggregate.currentBranch()
    if (!current) throw new Error('branch-missing')
    const actor = await this.ensure(current.sessionId, current.persona)
    const bridge = nativeActorDeliveryBridge(actor, session => this.ctx.sessions.flush(session as never))
    return { ...bridge, actor }
  }

  taskFactory(): ProductTurnTaskFactory {
    return ({ aggregate, messageId, text, personaId, delivery }) => ({
      taskId: `product:${aggregate.conversationId}:${messageId}`,
      run: async signal => {
        const branch = await this.branch(aggregate)
        const result = await runDialogueTurnV2AfterDelivery({ raw: text, taskId: `product:${aggregate.conversationId}:${messageId}`, personaId, messageId, eventPurposePrefix: 'product-v2' }, {
          registry: this.registry,
          trunk: aggregate.trunk,
          // The delivery was already committed before this task was allowed to
          // run.  This value is unused by the after-delivery coordinator but
          // preserves its typed dependency boundary.
          delivery: { session: branch.session, sessionId: aggregate.currentBranch()?.sessionId ?? 'branch-missing', flush: session => this.ctx.sessions.flush(session as never) },
          director: async ({ personaId: directorPersona, currentRawRef }) => process.env.MAN_ROLES_PRODUCT_SCRIPTED_CANDIDATE === '1'
            ? { propose: [{ kind: 'core-conflict', text: '脚本化候选困惑。', sourceRawRefs: [currentRawRef], proposedByPersona: directorPersona }] }
            : undefined,
          actor: {
            answerExists: () => verifiedReplyForMessage(branch.actor.session.events, messageId) !== undefined,
            loadExisting: () => verifiedReplyForMessage(branch.actor.session.events, messageId) ?? { reply: '' },
            run: async ({ policy }) => {
              const beforeTurns = branch.actor.session.events.filter(event => event.type === 'turn/start').length
              this.state.setNextTurnPolicy(branch.actor.session, { retrievalPolicy: 'allow', maxQuestions: policy.maxQuestions, allowedControls: policy.allowedControls })
              const abort = () => branch.actor.cancel({ kind: 'user' })
              signal.addEventListener('abort', abort, { once: true })
              try {
                // This is deliberately the first native wake.  Safety and
                // director errors above cannot spend a model call.
                if (!branch.wakePending()) throw new Error('actor-has-no-pending-delivery')
                await branch.actor.whenIdle()
              } finally {
                signal.removeEventListener('abort', abort)
              }
              if (signal.aborted) throw new Error('actor-cancelled')
              const reply = projectActorReply(branch.actor.session.events, beforeTurns + 1)
              if (!reply) throw new Error('actor-reply-missing')
              return { reply: reply.reply, ...(reply.turnIntent ? { turnIntent: reply.turnIntent as never } : {}), ...(reply.questions ? { questions: reply.questions } : {}), ...(reply.controls ? { controls: reply.controls as never } : {}), ...(reply.evidence ? { evidence: reply.evidence } : {}) }
            },
          },
          loadCurrentBranchHistory: () => branchHistory(branch.actor.session.events),
        }, delivery)
        // Coordinator failures are product task failures, not successful
        // completions merely because the error was represented as data.
        if (result.status !== 'ok') throw new Error(`native dialogue failed: ${'error' in result ? `${result.error.code}:${result.error.message}` : result.status}`)
        return result
      },
    })
  }

  private async ensure(sessionId: string, personaId: PersonaId): Promise<BranchActor> {
    const id = SessionId(sessionId)
    const active = this.ctx.agents.get(id) as BranchActor | undefined
    if (active) return active
    const options = { provider: process.env.MAN_ROLES_PROVIDER ?? 'man-roles-unconfigured', model: process.env.MAN_ROLES_MODEL ?? 'no-network' }
    try {
      return (await this.ctx.agents.resume({ resumeSessionId: id, agentOptions: options, setup: setupActorAgent(personaId, this.libs, this.state) })).agent as BranchActor
    } catch {
      // A brand-new indexed Branch has no persisted DSH session yet.  Only
      // this narrowly defined absence falls back to creation; all later
      // send/flush errors are surfaced at the product delivery boundary.
      return (await this.ctx.agents.create({ sessionId: id, agentOptions: options, setup: setupActorAgent(personaId, this.libs, this.state) })).agent as BranchActor
    }
  }

  hasDurableDelivery(actor: BranchActor, rawRef: string): boolean {
    return durableBranchHasRaw(actor.session.events, rawRef)
  }
}
