import { createRuntimeRegistry } from '../persona/runtime-registry.ts'
const registry = createRuntimeRegistry()
import type { Context } from '@deepseek-ai/cordis'
import { type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import type { SessionEvent, UserMessage } from '@deepseek-ai/dsh-session'
import { SessionId } from '@deepseek-ai/dsh-session'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ConversationAggregate } from '../aggregate/aggregate.ts'
import { runRecoveryStartup } from '../runtime/recovery.ts'
import { branchUserMessageExtra, branchUserMessageSourceFromData, branchUserMessageSourceSchema } from '../branch/message-source.ts'

function recoveryMessage(data: unknown): UserMessage {
  if (typeof data !== 'object' || data === null) throw new Error('delivery probe: recovery payload is not an object')
  const record = data as Record<string, unknown>
  if (!Array.isArray(record.content)) throw new Error('delivery probe: recovery payload content is invalid')
  const parsed = branchUserMessageSourceSchema.safeParse(branchUserMessageSourceFromData(record))
  if (!parsed.success) throw new Error('delivery probe: recovery payload source is invalid')
  return { id: typeof record.id === 'string' ? record.id : parsed.data.message_id, role: 'user', content: record.content, source: { kind: 'user' }, extra: branchUserMessageExtra(parsed.data) } as UserMessage
}

/** 只验证 DSH Session append + sessions.flush；不创建 Agent、不触发 AgentLoop/Provider。 */
export async function runDeliveryProbe(ctx: Context): Promise<void> {
  const target = registry.listActive()[0]
  if (target === undefined) throw new Error('delivery probe: no active persona in registry')
  const targetPersona = target.id
  const sessionId = SessionId(`man-roles-delivery-probe-${Date.now()}`)
  const session = ctx.sessions.create(sessionId, { meta: { cwd: mkdtempSync(join(tmpdir(), 'man-roles-delivery-')) } })
  const trunkDir = mkdtempSync(join(tmpdir(), 'man-roles-trunk-'))
  const aggregate = ConversationAggregate.create('delivery-probe-recovery', trunkDir, targetPersona, registry)
  aggregate.indexBranch(targetPersona, String(sessionId))
  aggregate.trunk.addUserRaw('delivery-probe-recovery-message', 'recovery probe', targetPersona)
  const restoredAggregate = ConversationAggregate.load(aggregate.conversationId, trunkDir, registry)
  await ctx.sessions.flush(session)
  let generationCalls = 0
  const offGenerationSpy = ctx.on('llm/stream', (_options: GenerateOptions, next: () => AsyncIterable<StreamChunk>) => { generationCalls++; return next() })
  let compensationCalls = 0
  const recovery = await runRecoveryStartup({
    delivery: {
          trunk: restoredAggregate.trunk,
      branches: {
        [targetPersona]: {
          sessionId: String(sessionId),
          findUserMessageByRawRef: async (rawRef) => {
            const persistence = ctx.get('sessionPersistence')
            if (persistence === undefined || typeof persistence.inspect !== 'function') throw new Error('delivery probe: durable query seam unavailable')
            const inspected = await persistence.inspect(String(sessionId))
            const persistedText = typeof inspected === 'string' ? inspected : JSON.stringify(inspected)
            return persistedText.includes(rawRef)
          },
          append: (type, data, options) => session.append(type, recoveryMessage(data), options ?? { surfaceOp: 'append' }),
          flush: () => ctx.sessions.flush(session),
        },
      },
    },
    compensation: { taskId: 'delivery-probe-task', messageId: 'delivery-probe-answer', answerExists: () => true, stateExists: () => false, compensate: () => { compensationCalls++ } },
  })
  offGenerationSpy()
  if (recovery.deliveries[0]?.status !== 'recovered' || recovery.compensation?.status !== 'compensated' || compensationCalls !== 1 || generationCalls !== 0) {
    throw new Error(`delivery probe: startup recovery failed deliveries=${JSON.stringify(recovery.deliveries)} compensation=${recovery.compensation?.status} compensationCalls=${compensationCalls} generationCalls=${generationCalls}`)
  }
  const source = {
    conversation_id: 'delivery-probe-conversation',
    message_id: 'delivery-probe-message',
    raw_ref: 'raw-delivery-probe-0',
    persona_id: targetPersona,
  }
  session.append('user/message', {
    id: source.message_id,
    role: 'user',
    content: [{ type: 'text', text: 'delivery probe' }],
    source: { kind: 'user' },
    extra: branchUserMessageExtra(source),
  } as UserMessage, { surfaceOp: 'append' })
  await ctx.sessions.flush(session)
  const event = session.events.find((item): item is SessionEvent<'user/message'> => {
    if (item.type !== 'user/message') return false
    const parsed = branchUserMessageSourceSchema.safeParse(branchUserMessageSourceFromData(item.data))
    return parsed.success && parsed.data.raw_ref === source.raw_ref
  })
  const eventSource = event ? branchUserMessageSourceSchema.safeParse(branchUserMessageSourceFromData(event.data)) : undefined
  if (event === undefined || !eventSource?.success || eventSource.data.conversation_id !== source.conversation_id
      || eventSource.data.message_id !== source.message_id || eventSource.data.persona_id !== source.persona_id) {
    throw new Error('delivery probe: flushed Session.events lost source metadata')
  }
  const persistence = ctx.get('sessionPersistence')
  let persistedReadback = false
  if (persistence !== undefined && typeof persistence.inspect === 'function') {
    const inspected = await persistence.inspect(String(sessionId))
    const persistedText = typeof inspected === 'string' ? inspected : JSON.stringify(inspected)
    if (!persistedText.includes(source.raw_ref) || !persistedText.includes(source.message_id)) {
      throw new Error('delivery probe: persisted session lost source metadata')
    }
    persistedReadback = true
  } else {
    throw new Error('delivery probe: durable persistence inspect unavailable')
  }
  console.log('[man-roles-roleplayer:delivery-probe] PASS source=%j sessionEventsReadback=true persistedReadback=%s recoveryStartup=true compensation=true generationCalls=%d providerNetworkUsed=false tokenCost=0', source, persistedReadback, generationCalls)
  const appExit = ctx.get('appExit')
  if (typeof appExit === 'function') appExit(0)
}
