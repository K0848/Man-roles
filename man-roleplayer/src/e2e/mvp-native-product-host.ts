import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { CallId } from '@deepseek-ai/dsh-llm'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import { createRuntimeRegistry } from '../persona/runtime-registry.ts'
import { ConversationRepository, ManRolesProductService } from '../product/service.ts'
import { NativeActorProductRuntime } from '../product/native-actor-runtime.ts'

function scriptedSubmit(): AsyncIterable<StreamChunk> {
  return (async function* () {
    const argumentsText = JSON.stringify({ segments: [{ kind: 'dialogue', text: '脚本化产品回答。' }] })
    const callId = CallId('mvp-native-submit')
    yield { type: 'block-start', index: 0, blockType: 'tool-call' } satisfies StreamChunk
    yield { type: 'tool-call-delta', index: 0, id: callId, name: 'submit_actor_reply', argumentsDelta: argumentsText } satisfies StreamChunk
    yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: callId, name: 'submit_actor_reply', arguments: argumentsText } } satisfies StreamChunk
    yield { type: 'usage', usage: { inputTokens: 0, outputTokens: 0 } } satisfies StreamChunk
    yield { type: 'finish', reason: { kind: 'tool-calls' } } satisfies StreamChunk
  })()
}

/** Installs the same zero-cost actor stream used by the Web product smoke. */
export function installMvpScriptedProductLlm(ctx: Context): () => void {
  return ctx.on('llm/stream', () => scriptedSubmit())
}

/**
 * Exercises the actual Host Agent lifecycle used by the Product Remote.  The
 * DSH stream is intercepted locally, so this proves the normal native path
 * without provider traffic, profile writes, or token expenditure.
 */
export async function runMvpNativeProductHost(ctx: Context): Promise<void> {
  const registry = createRuntimeRegistry(); const personas = registry.listActive(); const persona = personas[0]?.id; const secondPersona = personas[1]?.id
  if (!persona || !secondPersona) throw new Error('mvp native product host requires two active personas')
  const runtime = new NativeActorProductRuntime(ctx, registry)
  const service = new ManRolesProductService(new ConversationRepository(mkdtempSync(join(tmpdir(), 'man-roles-native-product-')), registry), undefined, runtime.taskFactory())
  let streamCalls = 0
  const off = ctx.on('llm/stream', (_options, _next) => { streamCalls++; return scriptedSubmit() })
  try {
    service.create('mvp-native-product', persona)
    const aggregate = service.conversations.get('mvp-native-product')
    const bridge = await runtime.branch(aggregate)
    const normal = await service.send({ conversationId: 'mvp-native-product', messageId: 'native-1', text: '我想把理想落到今天的选择上。', ...bridge, findUserMessageByRawRef: rawRef => runtime.hasDurableDelivery(bridge.actor, rawRef) })
    // ProductService intentionally returns after durable acceptance.  Wait for
    // the detached TurnRunner before inspecting the native Actor result.
    for (let attempt = 0; attempt < 100 && service.viewConversation('mvp-native-product').taskState?.status === 'running'; attempt++) await new Promise(resolve => setTimeout(resolve, 10))
    await bridge.actor.whenIdle()
    service.switchPersona('mvp-native-product', secondPersona)
    const secondBranch = await runtime.branch(aggregate)
    const second = await service.send({ conversationId: 'mvp-native-product', messageId: 'native-2', text: '请从另一人物角度回应。', ...secondBranch, findUserMessageByRawRef: rawRef => runtime.hasDurableDelivery(secondBranch.actor, rawRef) })
    for (let attempt = 0; attempt < 100 && service.viewConversation('mvp-native-product').taskState?.status === 'running'; attempt++) await new Promise(resolve => setTimeout(resolve, 10))
    await secondBranch.actor.whenIdle()
    const safety = await service.send({ conversationId: 'mvp-native-product', messageId: 'native-safety', text: '我现在要伤害自己。', ...bridge, findUserMessageByRawRef: rawRef => runtime.hasDurableDelivery(bridge.actor, rawRef) })
    const view = service.viewConversation('mvp-native-product')
    const reply = bridge.actor.session.events.some(event => event.type === 'tool/result' && JSON.stringify(event.data).includes('actor-reply'))
    const firstTexts = JSON.stringify(bridge.actor.session.events); const secondTexts = JSON.stringify(secondBranch.actor.session.events)
    const isolated = !firstTexts.includes('另一人物角度') && !secondTexts.includes('理想落到今天')
    const pass = normal.ok && second.ok && safety.ok === false && safety.code === 'safety-blocked' && streamCalls === 2 && reply && view.userRaws.length === 2 && aggregate.trunk.state.deliveryCommitted.length === 2 && isolated
    const taskResult = service.task('product:mvp-native-product:native-1')?.result
    // Keep E2E output to product-safe metadata; native event bodies can carry
    // prompt material and must never become a diagnostic display channel.
    console.log(JSON.stringify({ schemaVersion: 1, nativeProductHost: true, passed: pass, providerNetworkUsed: false, tokenCost: 0, streamCalls, normal, second, safety, taskState: view.taskState, ...(taskResult instanceof Error ? { taskError: taskResult.message } : {}), userRaws: view.userRaws.length, deliveryCommitted: aggregate.trunk.state.deliveryCommitted.length, firstEventTypes: bridge.actor.session.events.map(event => event.type), secondEventTypes: secondBranch.actor.session.events.map(event => event.type), isolated, reply }))
    if (!pass) throw new Error('mvp-native-product-host contract failed')
  } finally {
    off()
  }
  const appExit = ctx.get('appExit')
  if (typeof appExit === 'function') appExit(0)
}
