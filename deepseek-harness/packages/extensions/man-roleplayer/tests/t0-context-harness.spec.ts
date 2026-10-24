/** T0 context candidate: REAL Loader composition plus replaceable test context. */

import { access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { defineContentToolFixture } from '@deepseek-ai/dsh-tools'
import { dilemmaId, requestId, sessionId } from '../src/product/index.ts'
import { PERSONA_REGISTRY, type PersonaId } from '../src/types.ts'
import { createT0Composition, disposeT0Composition } from './t0-loader-support.ts'
import { appendSummaryProjection, mountCandidate, type Projection } from './t0-context-candidate.ts'
import { MockAdapter, textResponse, toolCallResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'

const active: { ctx: Context; root: string }[] = []

afterEach(async () => {
  const errors: unknown[] = []
  for (const item of active.splice(0)) {
    try { await disposeT0Composition(item.ctx, item.root) } catch (error) { errors.push(error) }
  }
  if (errors.length > 0) throw new AggregateError(errors, 'T0 fixture cleanup failed')
})

async function setup(
  script: (StreamChunk[] | 'hang')[] = Array.from({ length: 20 }, () => textResponse('ok')),
  personas: readonly [PersonaId, PersonaId] = [PERSONA_REGISTRY[0].id, PERSONA_REGISTRY[1].id],
): Promise<{
  ctx: Context
  root: string
  adapter: MockAdapter
  agent: Agent
  updateState: (revision: number, value: string | undefined) => Promise<void>
  projections: Projection[]
  candidate: ReturnType<typeof mountCandidate>
}> {
  const mounted = await createT0Composition(); const { ctx } = mounted; active.push(mounted)
  const adapter = new MockAdapter(script)
  ctx.llm.registerAdapter(['mock'], adapter)
  await ctx.manRoleplayer.create({
    id: dilemmaId('t0-context'), requestId: requestId('t0-create'), activePersona: personas[0],
    branches: [
      { persona: personas[0], sessionId: sessionId('t0-wang') },
      { persona: personas[1], sessionId: sessionId('t0-zeng') },
    ], agentOptions: { provider: 'mock', model: 'mock' },
  })
  const repository = (ctx.manRoleplayer as unknown as { repository: { append: (id: string, event: unknown) => Promise<void> } }).repository
  await repository.append('t0-context', { type: 'shared-state', item: {
    id: 't0-state-a', persona: personas[0], kind: 'goal', text: '下周离职', sourceEventIds: ['u-origin-a'], status: 'confirmed', revision: 1, sourceOperationId: 't0-state-a-op',
  }, requestId: 't0-state-a-request' })
  const candidate = mountCandidate(ctx)
  const agent = ctx.agents.get(sessionId('t0-wang'))
  if (agent === undefined) throw new Error('T0 fixture agent missing')
  const updateState = async (revision: number, value: string | undefined): Promise<void> => {
    const prior = await (ctx.manRoleplayer as unknown as {
      repository: { readEvents: (id: string) => Promise<readonly unknown[] | undefined> }
    }).repository.readEvents('t0-context') ?? []
    for (const event of prior) {
      if (typeof event !== 'object' || event === null || !('type' in event) || event.type !== 'shared-state' || !('item' in event)) continue
      const item = event.item as {
        id?: string
        status?: string
        persona?: string
        kind?: string
        text?: string
        sourceEventIds?: readonly string[]
        sourceOperationId?: string
      }
      if (item.status !== 'confirmed' || item.id === undefined) continue
      await repository.append('t0-context', { type: 'shared-state', item: {
        ...item, status: 'superseded', revision, sourceOperationId: `${item.id}-superseded-${String(revision)}`,
      }, requestId: `t0-supersede-${item.id}-${String(revision)}` })
    }
    await repository.append('t0-context', { type: 'shared-state', item: {
      id: `t0-state-${String(revision)}`, persona: personas[0], kind: 'goal', text: value ?? '', sourceEventIds: [`u-state-${String(revision)}`],
      status: value === undefined ? 'withdrawn' : 'confirmed', revision, sourceOperationId: `t0-state-${String(revision)}-op`,
    }, requestId: `t0-state-${String(revision)}-request` })
    // 产品事件是唯一状态来源，下一次 pre-step 必须重新读取。
  }
  return { ctx, root: mounted.root, adapter, agent, updateState, projections: candidate.projections, candidate }
}

function send(agent: Agent, text: string): void {
  agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
}

function requestText(adapter: MockAdapter, index = -1): string {
  const request = adapter.requests.at(index)
  return JSON.stringify(request?.messages ?? [])
}

function visibleText(adapter: MockAdapter, index = -1): string {
  const request = adapter.requests.at(index)
  return (request?.messages ?? []).flatMap(message => message.content
    .flatMap(block => block.type === 'text' ? [block.text] : [])).join('\n')
}

function isContextEvent(event: SessionEvent): boolean {
  return event.type === 'user/message' && event.data.source.kind === 'plugin' && event.data.source.plugin === 't0-context'
}

/** 只移除传输信号和每次创建的消息 id，保留路由、角色、来源、工具及全部正文。 */
function normalizedRequest(request: GenerateOptions): unknown {
  const { signal: _signal, messages, ...configuration } = request
  return { ...configuration, messages: messages.map(({ id: _id, ...message }) => message) }
}

function requestProjection(adapter: MockAdapter, index = -1): Record<string, unknown> {
  const messages = adapter.requests.at(index)?.messages.filter(message => message.source.kind === 'plugin'
    && message.source.plugin === 't0-context') ?? []
  expect(messages).toHaveLength(1)
  return JSON.parse(messages[0]!.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('')) as Record<string, unknown>
}

function expectToolPair(adapter: MockAdapter, callId: string): void {
  const messages = adapter.requests.at(-1)!.messages
  const call = messages.findIndex(message => message.role === 'assistant'
    && message.content.some(block => block.type === 'tool-call' && block.id === callId))
  const result = messages.findIndex(message => message.source.kind === 'tool' && message.source.callId === callId)
  expect(call).toBeGreaterThanOrEqual(0)
  expect(result).toBeGreaterThan(call)
  expect(messages[result]!.role).toBe('user')
  expect(messages[result]!.content[0]!.type).toBe('tool-result')
}

describe('v0.3 T0 context candidate', () => {
  it('T0-00 releases its medium and directory and refuses an unowned root', async () => {
    await expect(createT0Composition(tmpdir())).rejects.toThrow('does not own')
    const fixture = await createT0Composition()
    active.push(fixture)
    await disposeT0Composition(fixture.ctx, fixture.root)
    active.splice(active.indexOf(fixture), 1)
    await expect(access(fixture.root)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(createT0Composition(fixture.root)).rejects.toThrow('does not own')
  })
  it('T0-00 boots REAL Loader and captures a final request', async () => {
    const { agent, adapter } = await setup()
    send(agent, '基线')
    await agent.whenIdle()
    expect(adapter.requests).toHaveLength(1)
    expect(requestText(adapter)).toContain('下周离职')
  })

  it('T0-01 keeps one effective source and records projection metadata', async () => {
    const { agent, adapter, projections } = await setup()
    send(agent, '基线')
    await agent.whenIdle()
    const parsed = JSON.parse(requestText(adapter)) as { content?: { text?: string }[] }[]
    const matches = parsed.filter(message => message.content?.some(block => block.text?.includes('t0-context')))
    expect(matches).toHaveLength(1)
    expect(projections[0]).toMatchObject({ revision: 1, generation: 0 })
    expect(requestProjection(adapter).adopted).toEqual([expect.objectContaining({
      id: 't0-state-a', revision: 1, sourceEventIds: ['u-origin-a'], sourceOperationId: 't0-state-a-op',
      scope: 'shared-user-state', sourcePersona: 'wang-yangming', targetPersona: 'wang-yangming', adoptionReason: 'confirmed-current',
    })])
  })

  it('T0-02 replaces A with B in the actual next request', async () => {
    const { agent, adapter, updateState, projections } = await setup()
    send(agent, '第一轮')
    await agent.whenIdle()
    await updateState(2, '先留任三个月再评估')
    send(agent, '我修改了计划')
    await agent.whenIdle()
    expect(requestText(adapter)).toContain('先留任三个月再评估')
    expect(requestProjection(adapter, 0).effective).toBe('下周离职')
    expect(requestProjection(adapter).effective).toBe('先留任三个月再评估')
    expect(agent.session.events.filter(event => event.type === 'user/message'
      && event.data.source.kind === 'plugin' && event.data.source.plugin === 't0-context')).toHaveLength(2)
    expect(projections.at(-1)).toMatchObject({ revision: 2, generation: 1 })
  })

  it('T0-03 withdraws the effective state without restoring A', async () => {
    const { agent, adapter, updateState } = await setup()
    send(agent, '第一轮')
    await agent.whenIdle()
    await updateState(3, undefined)
    send(agent, '撤回目标')
    await agent.whenIdle()
    expect(visibleText(adapter)).toContain('"effective":null')
    expect(visibleText(adapter)).not.toContain('下周离职')
  })


  it('T0-04 isolates real private tool history and reuses A when returning from B', async () => {
    const { ctx, adapter, agent, updateState } = await setup([
      toolCallResponse('t0-private-call', 'private_lookup', {}, '甲的私有回答'),
      textResponse('甲的最终判断'), textResponse('乙回答'), textResponse('甲返回'),
    ], [PERSONA_REGISTRY[2].id, PERSONA_REGISTRY[3].id])
    agent.ctx.tools.register(defineContentToolFixture({
      name: 'private_lookup', description: 'private test lookup', parameters: {},
      async execute() { return [{ type: 'text', text: '甲的私有工具结果' }] },
    }))
    send(agent, '甲的私有原话')
    await agent.whenIdle()
    await updateState(2, '共享目标')
    const other = ctx.agents.get(sessionId('t0-zeng'))!
    send(other, '乙的问题')
    await other.whenIdle()
    const otherRequest = adapter.requests.at(-1)!
    for (const secret of ['甲的私有原话', '甲的私有回答', '甲的最终判断', '甲的私有工具结果', 't0-private-call']) {
      expect(JSON.stringify(otherRequest.messages)).not.toContain(secret)
    }
    expect(otherRequest.tools?.some(tool => tool.name === 'private_lookup')).toBe(false)
    expect(requestProjection(adapter).effective).toBe('共享目标')
    send(agent, '返回甲')
    await agent.whenIdle()
    expect(visibleText(adapter)).toContain('甲的私有原话')
    expect(visibleText(adapter)).toContain('甲的最终判断')
    expect(requestText(adapter)).toContain('t0-private-call')
    expectToolPair(adapter, 't0-private-call')
    expect(requestProjection(adapter).effective).toBe('共享目标')
  })

  it('T0-05 updates the shared revision between two model steps in one Agent turn', async () => {
    const { agent, adapter, updateState, projections } = await setup([
      toolCallResponse('t0-update-call', 't0_update_shared_state', { revision: 2, value: 'B' }), textResponse('完成'),
    ])
    agent.ctx.tools.register(defineContentToolFixture({ name: 't0_update_shared_state', description: 'update state', parameters: { revision: { type: 'number', required: true }, value: { type: 'string', required: true } }, async execute(args) {
      await updateState(args.revision ?? 2, args.value ?? 'B')
      return [{ type: 'text', text: 'state updated' }]
    } }))
    send(agent, '同回合更新')
    await agent.whenIdle()
    expect(adapter.requests).toHaveLength(2)
    expect(projections.map(item => item.revision)).toEqual([1, 2])
    const second = adapter.requests[1]?.messages ?? []
    const steps = agent.session.events.filter(event => event.type === 'step/start')
    expect(steps).toHaveLength(2)
    expect(steps[0]!.data.turn).toBe(steps[1]!.data.turn)
    expect(steps[0]!.data.step).not.toBe(steps[1]!.data.step)
    expect(JSON.stringify(second)).toContain('revision\\":2')
    expect(second.some(message => message.role === 'assistant' && JSON.stringify(message).includes('t0-update-call'))).toBe(true)
    expect(second.some(message => message.source.kind === 'tool' && JSON.stringify(message).includes('t0-update-call'))).toBe(true)
    expectToolPair(adapter, 't0-update-call')
  })



  it('T0-06 preserves a registered tool call/result in the second real Agent Loop request', async () => {
    const { agent, adapter, updateState } = await setup([
      toolCallResponse('t0-pair-call', 't0_pairing_tool', {}), textResponse('done'),
    ])
    agent.ctx.tools.register(defineContentToolFixture({ name: 't0_pairing_tool', description: 'pairing tool', parameters: {}, async execute() {
      await updateState(2, 'B')
      return [{ type: 'text', text: 'paired-result' }]
    } }))
    send(agent, '真实工具配对')
    await agent.whenIdle()
    expect(adapter.requests).toHaveLength(2)
    const second = adapter.requests[1]?.messages ?? []
    const assistant = second.find(message => message.role === 'assistant' && JSON.stringify(message).includes('t0-pair-call'))
    const result = second.find(message => message.source.kind === 'tool' && JSON.stringify(message).includes('t0-pair-call'))
    expect(assistant).toBeDefined(); expect(result).toBeDefined()
    expectToolPair(adapter, 't0-pair-call')
  })

  it('T0-06 defers replacement while a registered tool group is still open', async () => {
    const { agent, adapter, updateState } = await setup([
      toolCallResponse('t0-open-call', 't0_open_tool', {}), textResponse('done'),
    ])
    const gate = Promise.withResolvers<undefined>()
    const started = Promise.withResolvers<undefined>()
    agent.ctx.tools.register(defineContentToolFixture({ name: 't0_open_tool', description: 'open tool', parameters: {}, async execute() {
      started.resolve(undefined)
      await gate.promise
      return [{ type: 'text', text: 'released-result' }]
    } }))
    send(agent, '进行中的工具组')
    try {
      await started.promise
      expect(adapter.requests).toHaveLength(1)
      const generation = agent.session.surface.replaceGeneration
      await updateState(2, 'B')
      expect(adapter.requests).toHaveLength(1)
      expect(agent.session.surface.replaceGeneration).toBe(generation)
      expect(agent.session.events.filter(event => event.type === 'tool/result')).toHaveLength(0)
    } finally { gate.resolve(undefined) }
    await agent.whenIdle()
    expect(adapter.requests).toHaveLength(2)
    expect(visibleText(adapter, -1)).toContain('"effective":"B"')
    const second = adapter.requests[1]?.messages ?? []
    expect(second.some(message => message.role === 'assistant' && JSON.stringify(message).includes('t0-open-call'))).toBe(true)
    expect(second.some(message => message.source.kind === 'tool' && JSON.stringify(message).includes('t0-open-call'))).toBe(true)
    expectToolPair(adapter, 't0-open-call')
  })

  it('T0-07 invalidates a summary whose durable dependencies include A and background', async () => {
    const { ctx, root, agent, adapter, updateState } = await setup()
    const other = ctx.agents.get(sessionId('t0-zeng')); if (other === undefined) throw new Error('T0 second agent missing')
    send(other, 'persist second agent'); await other.whenIdle()
    const background = agent.session.append('user/message', createUserMessage({ content: [{ type: 'text', text: '[u-background] background: still valid' }], source: { kind: 'user' } }), { surfaceOp: 'append' })
    const summary = appendSummaryProjection(agent, {
      summaryId: 'summary-a', revision: 1,
      dependsOn: [{ kind: 'shared-state', id: 't0-state-a', revision: 1 }, { kind: 'user-message', id: background.data.id, revision: 1 }],
      body: 'summary-a: 下周离职 + background: still valid',
    }, { op: 'replace', start: background.seq, end: background.seq }, [background.seq])
    expect(agent.session.surface.nodes).not.toContain(background.seq)
    send(agent, '摘要有效请求')
    await agent.whenIdle()
    expect(visibleText(adapter)).toContain('summary-a: 下周离职 + background: still valid')
    expect(visibleText(adapter).match(/下周离职/gu)).toHaveLength(1)
    await updateState(2, 'B')
    send(agent, '摘要冷 replay')
    await agent.whenIdle()
    const final = visibleText(adapter)
    expect(final).not.toContain('summary-a: 下周离职 + background: still valid')
    expect(final).toContain('background: still valid')
    expect(final.match(/background: still valid/gu)).toHaveLength(1)
    expect(final).toContain('summary-invalidated')
    expect(agent.session.events).toContainEqual(expect.objectContaining({ seq: summary, type: 'user/message' }))
    expect(JSON.stringify(agent.session.events)).toContain('dependsOn')
    expect(agent.session.events.find(event => event.seq === background.seq)).toEqual(background)
    const validGeneration = agent.session.surface.replaceGeneration
    await ctx.sessions.flush(agent.session)
    await ctx.fiber.dispose(); active.splice(active.findIndex(item => item.ctx === ctx), 1)
    const reopened = await createT0Composition(root); active.push(reopened)
    const coldAdapter = new MockAdapter([textResponse('ok')]); reopened.ctx.llm.registerAdapter(['mock'], coldAdapter)
    await reopened.ctx.manRoleplayer.resume(dilemmaId('t0-context'), { provider: 'mock', model: 'mock' })
    const cold = reopened.ctx.agents.get(sessionId('t0-wang')); if (cold === undefined) throw new Error('T0 cold agent missing')
    mountCandidate(reopened.ctx); send(cold, '摘要冷重开'); await cold.whenIdle()
    expect(visibleText(coldAdapter)).not.toContain('summary-a: 下周离职 + background: still valid')
    expect(visibleText(coldAdapter)).toContain('background: still valid')
    expect(visibleText(coldAdapter).match(/background: still valid/gu)).toHaveLength(1)
    expect(visibleText(coldAdapter)).toContain('summary-invalidated')
    expect(cold.session.surface.replaceGeneration).toBe(validGeneration)
  })



  it.each(['missing', 'null', 'empty', 'unknown-id', 'wrong-body'])('T0-07 rejects unprovable summary metadata: %s', async (kind) => {
    const { agent, adapter } = await setup()
    agent.session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: '仍有效背景；正文故意提及 missing-message-id' }], source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    const body = 'untrusted-summary-secret'
    const metadata = {
      summaryId: 'unprovable', revision: 1,
      body: kind === 'wrong-body' ? 'different text' : body,
      dependsOn: kind === 'empty' ? [] : [{ kind: 'user-message', id: 'missing-message-id', revision: 1 }],
    }
    agent.session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: body }],
      source: { kind: 'plugin', plugin: 't0-summary', form: 'snapshot',
        sections: kind === 'missing' ? [] : [{ name: 'summary', text: kind === 'null' ? 'null' : JSON.stringify(metadata) }] },
    }), { surfaceOp: 'append' })
    send(agent, '依赖不明')
    await agent.whenIdle()
    expect(visibleText(adapter)).not.toContain(body)
    expect(visibleText(adapter)).toContain('仍有效背景')
    const generation = agent.session.surface.replaceGeneration
    send(agent, '重复读取')
    await agent.whenIdle()
    expect(agent.session.surface.replaceGeneration).toBe(generation)
  })

  it('T0-08 retires legacy injections without deleting logs or intervening private history', async () => {
    const { ctx, agent, adapter, projections } = await setup()
    const original = []
    for (const plugin of ['man-roleplayer-context', 'man-roleplayer-state', 'man-roleplayer-choice']) {
      original.push(agent.session.append('user/message', createUserMessage({
        content: [{ type: 'text', text: 'obsolete secret ' + plugin }],
        source: { kind: 'plugin', plugin, form: 'snapshot', sections: [] },
      }), { surfaceOp: 'append' }))
      agent.session.append('user/message', createUserMessage({
        content: [{ type: 'text', text: '保留的私有原话 ' + plugin }], source: { kind: 'user' },
      }), { surfaceOp: 'append' })
    }
    for (let index = 0; index < 2; index += 1) {
      send(agent, '兼容读取')
      await agent.whenIdle()
    }
    expect(visibleText(adapter)).not.toContain('obsolete secret')
    for (const event of original) {
      expect(agent.session.events.find(item => item.seq === event.seq)).toEqual(event)
      expect(visibleText(adapter)).toContain('保留的私有原话 ' + (event.data.source.kind === 'plugin' ? event.data.source.plugin : ''))
    }
    expect(requestProjection(adapter).effective).toBe('下周离职')
    expect(projections.filter(item => item.applied)).toHaveLength(1)
    await ctx.sessions.flush(agent.session)
    const persisted = await ctx.sessionPersistence.inspect(agent.id)
    for (const event of original) expect(persisted.events.find(item => item.seq === event.seq)).toEqual(event)
  })


  it.each(['before-projection', 'after-projection'])('T0-09 recovers %s with the same complete request as uninterrupted execution', async (checkpoint) => {
    const run = async (restart: boolean) => {
      const { ctx, root, agent, adapter, updateState, candidate } = await setup()
      const other = ctx.agents.get(sessionId('t0-zeng'))!
      send(other, '持久化旁支')
      await other.whenIdle()
      appendSummaryProjection(agent, {
        summaryId: 'recovery-summary-a', revision: 1,
        dependsOn: [{ kind: 'shared-state', id: 't0-state-a', revision: 1 }],
        body: '恢复前基于A的摘要',
      }, 'append')
      send(agent, '中断前请求')
      await agent.whenIdle()
      expect(adapter.requests).toHaveLength(2)
      await updateState(2, '先留任三个月再评估')
      if (checkpoint === 'after-projection') await candidate.project(agent)
      const beforeEvents = agent.session.events.filter(isContextEvent).length
      const beforeGeneration = agent.session.surface.replaceGeneration
      expect(beforeEvents).toBe(checkpoint === 'after-projection' ? 2 : 1)
      expect(beforeGeneration).toBe(checkpoint === 'after-projection' ? 2 : 0)
      expect(adapter.requests).toHaveLength(2)
      await ctx.sessions.flush(agent.session)
      const disk = await ctx.sessionPersistence.inspect(agent.id)
      expect(disk.events.filter(isContextEvent)).toEqual(agent.session.events.filter(isContextEvent))

      let live = agent
      let observed = adapter
      let owner = ctx
      if (restart) {
        await ctx.fiber.dispose()
        // 所有权在第二个 Loader 创建成功前仍保留，启动失败也会回收原根目录。
        const reopened = await createT0Composition(root)
        active.splice(active.findIndex(item => item.ctx === ctx), 1, reopened)
        owner = reopened.ctx
        observed = new MockAdapter([textResponse('ok')])
        owner.llm.registerAdapter(['mock'], observed)
        const restored = await owner.manRoleplayer.read(dilemmaId('t0-context'))
        if (restored === undefined) throw new Error('T0 persisted dilemma missing after Loader reopen')
        expect(restored.sharedStateItems.some(item => item.status === 'confirmed' && item.text === '先留任三个月再评估')).toBe(true)
        expect(owner.agents.get(agent.id)).toBeUndefined()
        await owner.manRoleplayer.resume(dilemmaId('t0-context'), { provider: 'mock', model: 'mock' })
        live = owner.agents.get(agent.id)!
        expect(live.session.events.filter(isContextEvent)).toEqual(disk.events.filter(isContextEvent))
        expect(live.session.surface.replaceGeneration).toBe(beforeGeneration)
        mountCandidate(owner)
        expect(observed.requests).toHaveLength(0)
      }
      send(live, '中断后继续')
      await live.whenIdle()
      expect(observed.requests).toHaveLength(restart ? 1 : 3)
      expect(requestProjection(observed).effective).toBe('先留任三个月再评估')
      expect(visibleText(observed)).not.toContain('恢复前基于A的摘要')
      expect(live.session.events.filter(isContextEvent)).toHaveLength(2)
      expect(live.session.surface.replaceGeneration).toBe(2)
      await owner.sessions.flush(live.session)
      const afterDisk = await owner.sessionPersistence.inspect(live.id)
      expect(afterDisk.events.filter(isContextEvent)).toEqual(live.session.events.filter(isContextEvent))
      return { request: normalizedRequest(observed.requests.at(-1)!), projectionCount: 2,
        generation: live.session.surface.replaceGeneration }
    }
    const uninterrupted = await run(false)
    const recovered = await run(true)
    expect(recovered).toEqual(uninterrupted)
    process.stdout.write('T0-09 evidence ' + JSON.stringify({ checkpoint, projectionCount: recovered.projectionCount,
      replaceGeneration: recovered.generation, recoveredRequestCount: 1, completeRequestEquivalent: true }) + '\n')
  })


  it('T0-10 measures stable source reuse over five rounds and one state change', async () => {
    const { agent, adapter, updateState, projections } = await setup()
    const metrics = []
    for (let index = 0; index < 6; index += 1) {
      if (index === 5) await updateState(2, '先留任三个月再评估')
      send(agent, '成本观察' + String(index + 1))
      await agent.whenIdle()
      const request = adapter.requests.at(-1)!
      const context = request.messages.filter(message => message.source.kind === 'plugin' && message.source.plugin === 't0-context')
      const projection = requestProjection(adapter)
      const sources = (projection.adopted as { id: string; revision: number }[]).map(item => item.id + '@' + String(item.revision))
      const measure = {
        messageCount: request.messages.length,
        requestBytes: Buffer.byteLength(JSON.stringify(request.messages), 'utf8'),
        contentBytes: Buffer.byteLength(JSON.stringify(request.messages.map(message => message.content)), 'utf8'),
        sharedContentBytes: Buffer.byteLength(JSON.stringify(context.map(message => message.content)), 'utf8'),
        repeatedSources: sources.length - new Set(sources).size,
        replaceGeneration: agent.session.surface.replaceGeneration,
      }
      metrics.push(measure)
      expect(measure.repeatedSources).toBe(0)
      expect(measure.replaceGeneration).toBe(index < 5 ? 0 : 1)
    }
    expect(adapter.requests).toHaveLength(6)
    expect(new Set(metrics.slice(0, 5).map(item => item.sharedContentBytes)).size).toBe(1)
    expect(projections.filter(item => item.applied)).toHaveLength(2)
    process.stdout.write('T0-10 metrics ' + JSON.stringify({ requestCount: adapter.requests.length,
      reuseCount: projections.filter(item => !item.applied).length, metrics }) + '\n')
  })

})
