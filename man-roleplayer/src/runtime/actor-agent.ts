import type { Context } from '@deepseek-ai/cordis'
import { ReasoningEffortId, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { PersonaId } from '../domain/schema.ts'
import { personaSpecFor } from '../context/personas-data.ts'
import { registerActorTools } from './actor-tools.ts'
import type { ContentLibraries } from '../retrieval/retrieve.ts'
import type { ActorTurnStateRegistry } from './turn-state.ts'
import { filterActorStepMessages } from './actor-context-filter.ts'

export const ACTOR_TOOL_NAMES = ['retrieve_anecdotes', 'fetch_anecdote', 'retrieve_quotes', 'fetch_quote', 'submit_actor_reply'] as const
export function setupActorAgent(personaId: PersonaId, libs: ContentLibraries, registry: ActorTurnStateRegistry, capture?: (value: readonly string[]) => void, options?: { exposedToolNames?: readonly string[] }) {
  return (agentCtx: Context): void => {
    const spec = personaSpecFor(personaId)
    agentCtx.systemPrompt.section({ name: 'man-roles:persona', order: 0, complete: true, text: `[MAN_ROLES_PERSONA=${personaId}]\n${spec.systemPrompt}\n\n产品运行约束：每一轮必须以 submit_actor_reply 作为唯一终止动作；先完成必要检索/取证，再调用 submit_actor_reply 提交可展示回答。不要用普通 assistant 文本结束回合，普通文本不会被产品消费。dialogue 场景也必须提交 dialogue segment；证据场景必须提交通过证据门的 evidence ID。` })
    agentCtx.tools.restrict({ allow: [] })
    agentCtx.tools.presentAs('native')
    agentCtx.on('agent/pre-step', async (_payload, next) => {
      const decision = await next()
      return decision.kind === 'enter' ? { ...decision, messages: filterActorStepMessages(decision.messages) } : decision
    })
    // DSH AgentOptions 不承载推理档位；在请求 waterfall 统一关闭推理，避免真实批次隐式增加成本。
    agentCtx.on('agent/request', async (_payload, next) => ({ ...(await next()), reasoningEffort: ReasoningEffortId('off') }))
    // Repair steering is part of the production actor contract, not an E2E
    // mode feature. The same turn state that records tool-result failures
    // controls the single repair opportunity for every setup.
    agentCtx.on('agent/turn-stopping', ({ agent }) => {
      const repairDetails = registry.consumeRepairPrompt(agent.session)
      if (repairDetails) agent.steer(createUserMessage({ content: [{ type: 'text', text: `上一次 submit_actor_reply 被证据门以 repairable 拒绝。${repairDetails}现在必须只调用一次 submit_actor_reply；不要输出普通文本。` }], source: { kind: 'plugin', plugin: 'man-roles-roleplayer' } }))
      else if (process.env.MAN_ROLES_RP_E2E === 'native-evidence' && registry.consumeEvidenceRecoveryPrompt(agent.session)) agent.steer(createUserMessage({ content: [{ type: 'text', text: '你已经取得当前人物 evidence，但尚未提交产品回答。现在必须只调用一次 submit_actor_reply，使用已有 evidence 或安全 dialogue；不要输出普通文本，也不要新增检索。' }], source: { kind: 'plugin', plugin: 'man-roles-roleplayer' } }))
    })
    const definitions = registerActorTools(agentCtx, libs, personaId, registry, options?.exposedToolNames)
    capture?.(definitions.map((x) => x.name))
  }
}
