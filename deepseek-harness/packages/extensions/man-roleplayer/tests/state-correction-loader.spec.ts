/** State correction regressions through the production Loader and actual state-analysis requests. */
import { afterEach, describe, expect, it } from 'vitest'
import { LlmAdapter, type GenerateOptions, type LlmResolvedModelInfo, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { createT0Composition, disposeT0Composition } from './t0-loader-support.ts'
import { textResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'
import { deliveryOperationId, dilemmaId, messageId, operationId, requestId, sessionId, turnOperationId, type ProductEvent } from '../src/product/index.ts'
import { ProductConversationRepository } from '../src/repository.ts'

type Input = Record<string, unknown>[]
const originalDeadline = '两周后要交课程草稿'
const correctedDeadline = '四周后要交课程草稿'
const job = '我准备找AI产品经理工作'

class StateAdapter extends LlmAdapter {
  readonly inputs: Input[] = []
  readonly prompts: string[] = []
  constructor(private readonly respond: (input: Input, call: number) => object) { super() }
  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model })
  }
  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const request = JSON.stringify(options.messages)
    const text = options.messages.flatMap(message => message.content).find(part => part.type === 'text')
    if (text?.type !== 'text') throw new Error('state analysis did not send text')
    const input = JSON.parse(text.text.split('可见事件:\n').at(-1)!) as Input
    this.inputs.push(input)
    this.prompts.push(text.text)
    expect(request).toContain('JSON Schema')
    yield* textResponse(JSON.stringify(this.respond(input, this.inputs.length)))
  }
}

let composition: Awaited<ReturnType<typeof createT0Composition>> | undefined
afterEach(async () => { if (composition !== undefined) await disposeT0Composition(composition.ctx, composition.root); composition = undefined })

async function setup(adapter: StateAdapter) {
  composition = await createT0Composition()
  const { ctx } = composition
  ctx.llm.registerAdapter(['mock'], adapter)
  const id = dilemmaId('state-correction')
  await ctx.manRoleplayer.create({ id, requestId: requestId('create'), branches: [
    { persona: 'wang-yangming', sessionId: sessionId('state-correction-wang') },
  ], activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
  const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
  const appendMessage = async (key: string, content: string) => {
    await repository.append(id, { type: 'user-message', id: key, messageId: messageId(key), persona: 'wang-yangming', content, status: 'delivered', requestId: requestId(key) })
    await repository.append(id, { type: 'message-delivery', messageId: messageId(key), deliveryOperationId: deliveryOperationId(key), persona: 'wang-yangming', status: 'delivered', sessionMessageId: key, sessionEventId: key, requestId: requestId(`delivery:${key}`) })
    await repository.append(id, { type: 'turn', turnOperationId: turnOperationId(`turn:${key}`), messageId: messageId(key), persona: 'wang-yangming', status: 'completed', sessionEventId: key, requestId: requestId(`turn:${key}`) })
  }
  await appendMessage('original', `${originalDeadline}，${job}。请帮我理清安排。`)
  return { ctx, id, repository, appendMessage }
}

function candidate(id: string, text: string, source: unknown, kind = 'fact') {
  return { id, kind, text, sourceEventIds: [String(source)], confirmation: 'explicit', sourceQuote: text }
}
function output(input: Input, candidates: object[]) {
  const current = input.filter(item => item.type === 'shared-state' && item.kind === 'fact').at(-1)
  return { candidates, personaSnapshot: {
    persona: 'wang-yangming', sourceEventIds: [String(current?.id ?? input.at(-1)?.id)],
    currentUnderstanding: current === undefined ? '围绕当前困惑讨论' : `用户当前期限是${String(current.text)}`,
    coreView: '依据当前有效处境安排下一步',
  } }
}
function states(events: readonly ProductEvent[]) {
  const latest = new Map<string, Extract<ProductEvent, { type: 'shared-state' }>['item']>()
  for (const event of events) if (event.type === 'shared-state') latest.set(event.item.id, event.item)
  return [...latest.values()]
}

describe('state correction authority', () => {
  it('uses the corrected current state in the next request and snapshot without reviving old or duplicate facts', async () => {
    const adapter = new StateAdapter((input, call) => {
      const source = input.find(item => item.type === 'user-message')!.id
      return output(input, call === 1 ? [candidate('deadline', originalDeadline, source), candidate('job', job, source, 'goal')]
        : [candidate('old-deadline-new-id', originalDeadline, source), candidate('duplicate-job', job, source, 'goal'),
          { id: 'inference', kind: 'understanding', text: '需要协调课程与练习', sourceEventIds: [String(source)], confirmation: 'needs-confirmation' }])
    })
    const { ctx, id, repository } = await setup(adapter)
    await ctx.manRoleplayer.analyzeState(id, operationId('first'))
    const firstAnalysis = (await repository.readEvents(id))?.findLast(event => event.type === 'state-analysis')
    expect(firstAnalysis?.type === 'state-analysis' ? firstAnalysis.failureDetail : undefined).toBeUndefined()
    expect(firstAnalysis).toMatchObject({ status: 'completed' })
    await ctx.manRoleplayer.modifyState(id, 'deadline', { text: correctedDeadline }, requestId('correct-deadline'))
    await ctx.manRoleplayer.analyzeState(id, operationId('after-correction'))
    const events = await repository.readEvents(id) ?? []
    const latest = states(events)
    expect(adapter.inputs[1]?.filter(item => item.type === 'shared-state').map(item => item.text)).toEqual([job, correctedDeadline])
    expect(JSON.stringify(adapter.inputs[1]?.find(item => item.type === 'user-message'))).not.toContain(originalDeadline)
    expect(latest.filter(item => item.status === 'confirmed' && item.kind === 'fact').map(item => item.text)).toEqual([correctedDeadline])
    expect(latest.filter(item => item.status === 'confirmed' && item.text === job)).toHaveLength(1)
    expect(latest.some(item => item.id === 'old-deadline-new-id' || item.id === 'duplicate-job')).toBe(false)
    expect(latest.find(item => item.id === 'inference')?.status).toBe('candidate')
    expect((await ctx.manRoleplayer.stateStatus(id))?.personaSnapshot?.currentUnderstanding).toContain(correctedDeadline)
  })

  it.each(['reject', 'withdraw'] as const)('does not reintroduce an old %s source but accepts an explicit later message', async action => {
    const adapter = new StateAdapter((input, call) => {
      const source = input.filter(item => item.type === 'user-message').at(-1)!.id
      const proposed = candidate('deadline', originalDeadline, source)
      if (call === 1 && action === 'reject') return output(input, [{ ...proposed, confirmation: 'needs-confirmation', sourceQuote: undefined }])
      return output(input, [proposed])
    })
    const { ctx, id, repository, appendMessage } = await setup(adapter)
    await ctx.manRoleplayer.analyzeState(id, operationId('first'))
    const firstAnalysis = (await repository.readEvents(id))?.findLast(event => event.type === 'state-analysis')
    expect(firstAnalysis?.type === 'state-analysis' ? firstAnalysis.failureDetail : undefined).toBeUndefined()
    expect(firstAnalysis).toMatchObject({ status: 'completed' })
    if (action === 'reject') await ctx.manRoleplayer.rejectState(id, 'deadline', requestId('reject'))
    else await ctx.manRoleplayer.withdrawState(id, 'deadline', requestId('withdraw'))
    await ctx.manRoleplayer.analyzeState(id, operationId('old-source'))
    expect(states(await repository.readEvents(id) ?? []).filter(item => item.status === 'confirmed')).toHaveLength(0)
    await appendMessage('fresh-statement', originalDeadline)
    await ctx.manRoleplayer.analyzeState(id, operationId('fresh-source'))
    const latest = states(await repository.readEvents(id) ?? [])
    expect(latest.find(item => item.id === 'deadline')?.status).toBe(action === 'reject' ? 'rejected' : 'withdrawn')
    expect(latest.find(item => item.id === 'fresh-source:deadline')).toMatchObject({ status: 'confirmed', sourceEventIds: ['fresh-statement'] })
  })
})


it('labels independently retained fragments instead of fabricating a clipped user statement', async () => {
  const detail = '最堵的是老师说我的步骤太杂。我并不是不努力，只是每次想证明自己反而说得更多。我下周还有一次练习。'
  const adapter = new StateAdapter((input, call) => {
    const source = input.filter(item => item.type === 'user-message').at(-1)!.id
    if (call === 1) return output(input, [
      candidate('practice-fact', '老师说我的步骤太杂', source),
      candidate('effort-fact', '我并不是不努力', source),
      candidate('explanation-fact', '每次想证明自己反而说得更多', source),
    ])
    const retained = input.filter(item => item.type === 'user-message').at(-1)!
    expect(retained.content).toBeUndefined()
    expect(retained.contentStatus).toBe('partially-processed')
    expect(retained.remainingFragments).toEqual(['最堵的是', '，只是', '。我下周还有一次练习。'])
    expect(JSON.stringify(input)).not.toContain('最堵的是。，只是。')
    return output(input, [candidate('fabricated-joined-quote', '最堵的是，只是', retained.id), candidate('new-practice', '我下周还有一次练习', retained.id)])
  })
  const { ctx, id, repository, appendMessage } = await setup(adapter)
  await appendMessage('practice-detail', detail)
  await ctx.manRoleplayer.analyzeState(id, operationId('practice-first'))
  await ctx.manRoleplayer.analyzeState(id, operationId('practice-second'))
  expect(adapter.inputs).toHaveLength(2)
  expect(adapter.prompts[1]).toContain('不得据此推断用户没有说清、遗漏信息或表达不完整')
  expect(states(await repository.readEvents(id) ?? []).find(item => item.id === 'new-practice')).toMatchObject({ status: 'confirmed', confirmation: 'explicit' })
  expect(states(await repository.readEvents(id) ?? []).find(item => item.id === 'fabricated-joined-quote')).toMatchObject({ status: 'candidate', confirmation: 'needs-confirmation' })
})
