import { describe, expect, it, vi } from 'vitest'
import { DeletionMachine, allowedContext, availableEvidence, deliveryOperationId, dilemmaId, fallbackTitle, messageId, operationId, project, requestId, safetyDecision, sessionId, stateResultIsCurrent, turnOperationId, visibleTurnStatus, type DeletionDriver, type ProductEvent } from '../src/product/index.ts'

const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('zeng') }] as const
const created = (id = 'd1'): ProductEvent => ({ type: 'created', id: dilemmaId(id), branches, activePersona: 'wang-yangming', requestId: requestId('create') })

describe('man-roleplayer product domain', () => {
  it('replays persisted user reply ids through delivery reconciliation and delivery-only facts', () => {
    const result = project([created(),
      { type: 'turn', turnOperationId: turnOperationId('reply-target'), messageId: messageId('source'), persona: 'wang-yangming', status: 'completed', sessionEventId: 'source-event', requestId: requestId('source-completed') },
      { type: 'user-message', id: 'reply', messageId: messageId('reply'), persona: 'wang-yangming', content: '继续', status: 'pending', replyToTimelineEventId: 'reply-target', requestId: requestId('reply-pending') },
      { type: 'message-delivery', messageId: messageId('reply'), deliveryOperationId: deliveryOperationId('reply-delivery'), persona: 'wang-yangming', status: 'delivered', requestId: requestId('reply-delivered') },
      { type: 'user-message', id: 'reply', messageId: messageId('reply'), persona: 'wang-yangming', status: 'delivered', requestId: requestId('reply-reconciled') },
      { type: 'message-delivery', messageId: messageId('delivery-only'), deliveryOperationId: deliveryOperationId('delivery-only'), persona: 'wang-yangming', status: 'delivered', replyToTimelineEventId: 'reply-target', requestId: requestId('delivery-only') },
    ])
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'reply-target', operationId: 'reply-target', kind: 'persona-message', status: 'completed' }))
    expect(result.timeline.filter(item => item.kind === 'user-message')).toEqual([
      expect.objectContaining({ id: 'reply', text: '继续', status: 'delivered', replyToTimelineEventId: 'reply-target' }),
      expect.objectContaining({ id: 'delivery-only', replyToTimelineEventId: 'reply-target' }),
    ])
  })

  it('accepts a nonempty variable set of distinct registered persona branches', () => {
    const customBranches = [{ persona: 'zhuangzi' as const, sessionId: sessionId('zhuang') }, { persona: 'su-shi' as const, sessionId: sessionId('su-shi') }, { persona: 'zhu-xi' as const, sessionId: sessionId('zhu-xi') }] as const
    const result = project([{ type: 'created', id: dilemmaId('custom'), branches: customBranches, activePersona: 'zhuangzi', requestId: requestId('custom-create') }])
    expect(result.branches).toEqual(customBranches)
    expect(result.activePersona).toBe('zhuangzi')
  })

  it('keeps context scoped to the target persona and excludes withdrawn evidence', () => {
    const events: ProductEvent[] = [created(),
      { type: 'user-message', id: 'u1', messageId: messageId('u1'), persona: 'wang-yangming', status: 'delivered', requestId: requestId('u1') },
      { type: 'message-delivery', messageId: messageId('u1'), deliveryOperationId: deliveryOperationId('d-u1'), persona: 'wang-yangming', status: 'delivered', sessionMessageId: 'session-u1', sessionEventId: 'event-u1', requestId: requestId('d-u1') },
      { type: 'persona-message', id: 'wang-answer', persona: 'wang-yangming', sessionId: sessionId('wang'), sourceEventId: 'wang-s1', requestId: requestId('w1') },
      { type: 'persona-message', id: 'zeng-answer', persona: 'zeng-guofan', sessionId: sessionId('zeng'), sourceEventId: 'zeng-s1', requestId: requestId('z1') },
      { type: 'evidence', evidenceId: 'e1', status: 'available', requestId: requestId('e1') },
      { type: 'evidence', evidenceId: 'e1', status: 'withdrawn', requestId: requestId('e1-withdraw') },
    ]
    expect(allowedContext(events, 'wang-yangming')).toMatchObject({ allowedEventIds: ['u1'], excludedEventIds: ['zeng-s1'] })
    expect(availableEvidence(events)).toEqual([])
  })

  it('rejects safety hits before any model-side operation and gates stale state results', () => {
    expect(safetyDecision('我想自杀')).toMatchObject({ allowed: false })
    expect(safetyDecision('请给我法律意见和保证收益')).toMatchObject({ allowed: false })
    expect(safetyDecision('请帮我整理困惑')).toEqual({ allowed: true })
    const result: ProductEvent = { type: 'state-analysis', operationId: operationId('state-1'), inputWatermark: 'm1', revision: 2, branchRevision: 1, status: 'completed', requestId: requestId('state-1') }
    expect(stateResultIsCurrent(result, 'm1', 2, 1)).toBe(true)
    expect(stateResultIsCurrent(result, 'm0', 2, 1)).toBe(false)
  })

  it('keeps cancellation visible when a late completion is appended', () => {
    const events: ProductEvent[] = [created(),
      { type: 'turn', turnOperationId: turnOperationId('turn-1'), messageId: messageId('m1'), persona: 'wang-yangming', status: 'cancelled', requestId: requestId('cancel') },
      { type: 'turn', turnOperationId: turnOperationId('turn-1'), messageId: messageId('m1'), persona: 'wang-yangming', status: 'completed', sessionEventId: 'late', requestId: requestId('late') },
    ]
    expect(project(events).timeline).toContainEqual(expect.objectContaining({ id: 'turn-1', status: 'cancelled' }))
    expect(visibleTurnStatus(events, turnOperationId('turn-1'))).toBe('cancelled')
  })

  it('upserts one user timeline item across pending and delivered product facts', () => {
    const events: ProductEvent[] = [created(),
      { type: 'user-message', id: 'message-1', messageId: messageId('message-1'), persona: 'wang-yangming', content: '原始困惑', status: 'pending', deliveryOperationId: deliveryOperationId('delivery-1'), requestId: requestId('user-pending') },
      { type: 'message-delivery', messageId: messageId('message-1'), deliveryOperationId: deliveryOperationId('delivery-1'), persona: 'wang-yangming', status: 'claimed', sessionMessageId: 'session-message-1', requestId: requestId('delivery-claimed') },
      { type: 'message-delivery', messageId: messageId('message-1'), deliveryOperationId: deliveryOperationId('delivery-1'), persona: 'wang-yangming', status: 'delivered', sessionMessageId: 'session-message-1', sessionEventId: 'session-event-1', requestId: requestId('delivery-delivered') },
      { type: 'user-message', id: 'message-1', messageId: messageId('message-1'), persona: 'wang-yangming', content: '原始困惑', status: 'delivered', deliveryOperationId: deliveryOperationId('delivery-1'), sessionEventId: 'session-event-1', requestId: requestId('user-delivered') },
    ]
    expect(project(events).timeline.filter(item => item.kind === 'user-message')).toEqual([
      expect.objectContaining({ id: 'message-1', text: '原始困惑', status: 'delivered', operationId: deliveryOperationId('delivery-1') }),
    ])
  })

  it('falls back to a safe bounded title without a provider retry', () => {
    expect(fallbackTitle('  first   user\nmessage  ')).toBe('first user message')
    expect(fallbackTitle('x'.repeat(100))).toHaveLength(48)
  })
  it('marks renamed titles as user-owned and ignores late automatic results', () => {
    const result = project([created(),
      { type: 'title', operationId: operationId('title'), status: 'claimed', titleRevision: 0, requestId: requestId('title-claim') },
      { type: 'renamed', title: '用户标题', titleRevision: 1, requestId: requestId('rename') },
      { type: 'title', operationId: operationId('title'), status: 'completed', titleRevision: 0, value: '迟到标题', requestId: requestId('title-late') },
    ])
    expect(result).toMatchObject({ title: '用户标题', titleRevision: 1, titleUserOwned: true })
  })
  it('projects isolated persona references without copying answer text', () => {
    const result = project([created(),
      { type: 'user-message', id: 'u1', persona: 'wang-yangming', requestId: requestId('u1') },
      { type: 'persona-message', id: 'p1', persona: 'wang-yangming', sessionId: sessionId('wang'), sourceEventId: 's1', requestId: requestId('p1') },
      { type: 'persona-message', id: 'p2', persona: 'zeng-guofan', sessionId: sessionId('zeng'), sourceEventId: 's2', requestId: requestId('p2') },
    ])
    expect(result.branches).toEqual(branches)
    expect(result.timeline).toEqual([
      { id: 'u1', kind: 'user-message', persona: 'wang-yangming' },
      { id: 'p1', kind: 'persona-message', persona: 'wang-yangming', sessionId: sessionId('wang'), sourceEventId: 's1' },
      { id: 'p2', kind: 'persona-message', persona: 'zeng-guofan', sessionId: sessionId('zeng'), sourceEventId: 's2' },
    ])
  })

  it('rejects a persona reference to the other branch session', () => {
    expect(() => project([created(), {
      type: 'persona-message', id: 'wrong', persona: 'wang-yangming', sessionId: sessionId('zeng'), sourceEventId: 's2', requestId: requestId('wrong'),
    }])).toThrow(/own branch session/)
  })

  it('reconciles a claimed branch allocation exactly once before switching', () => {
    const allocation = { operationId: operationId('branch-op'), persona: 'zhuangzi' as const, sessionId: sessionId('zhuang'), expectedLifecycleRevision: 0, status: 'claimed' as const }
    const added = { type: 'branch-added' as const, operationId: allocation.operationId, branch: { persona: allocation.persona, sessionId: allocation.sessionId }, requestId: requestId('branch-added') }
    const result = project([created(), { type: 'branch-allocation', allocation, requestId: requestId('branch-claim') }, added, added])
    expect(result.branches.map(branch => branch.persona)).toEqual(['wang-yangming', 'zeng-guofan', 'zhuangzi'])
    expect(result.branchAllocations).toEqual([allocation])
  })

  it('deduplicates repeated request ids deterministically', () => {
    const result = project([created(),
      { type: 'user-message', id: 'u1', persona: 'wang-yangming', requestId: requestId('same') },
      { type: 'user-message', id: 'duplicate', persona: 'wang-yangming', requestId: requestId('same') },
    ])
    expect(result.timeline).toEqual([{ id: 'u1', kind: 'user-message', persona: 'wang-yangming' }])
  })

  it('removes only the matching reversible delete request from the projection', () => {
    const result = project([created(),
      { type: 'deletion', operation: { operationId: operationId('delete-1'), stage: 'requested', irreversible: false }, requestId: requestId('delete-1') },
      { type: 'deletion-cancelled', operationId: operationId('delete-1'), requestId: requestId('cancel-1') },
    ])
    expect(result.deletion).toBeUndefined()
  })
  it('allows only active acknowledgements from the other persona', () => {
    const base = created()
    const original: ProductEvent = { type: 'user-message', id: 'u0', messageId: messageId('u0'), persona: 'wang-yangming', status: 'delivered', replyToTimelineEventId: 't1', requestId: requestId('original-user') }
    const active: ProductEvent = { type: 'persona-acknowledgement', id: 'ack-1', sourcePersona: 'wang-yangming', sourceUserMessageId: 'u0', sourcePersonaMessageId: 't1', status: 'active', requestId: requestId('ack-1') }
    const user: ProductEvent = { type: 'user-message', id: 'u1', messageId: messageId('u1'), persona: 'wang-yangming', content: '你说得对', status: 'delivered', replyToTimelineEventId: 't1', requestId: requestId('ack-user') }
    const delivery: ProductEvent = { type: 'message-delivery', messageId: messageId('u0'), deliveryOperationId: deliveryOperationId('original-delivery'), persona: 'wang-yangming', status: 'delivered', sessionMessageId: 'session-u0', sessionEventId: 'event-u0', requestId: requestId('original-delivery') }
    const ackDelivery: ProductEvent = { type: 'message-delivery', messageId: messageId('u1'), deliveryOperationId: deliveryOperationId('ack-delivery'), persona: 'wang-yangming', status: 'delivered', sessionMessageId: 'session-u1', sessionEventId: 'event-u1', requestId: requestId('ack-delivery') }
    const turn: ProductEvent = { type: 'turn', turnOperationId: turnOperationId('t1'), messageId: messageId('u0'), persona: 'wang-yangming', status: 'completed', sessionEventId: 'event-t1', requestId: requestId('ack-turn') }
    const validWithdrawn = { ...active, status: 'withdrawn' as const, requestId: requestId('ack-1-withdrawn') }
    const events = [base, original, user, delivery, ackDelivery, turn, active]
    const context = allowedContext(events, 'zeng-guofan')
    expect(context.allowedEventIds).toEqual(expect.arrayContaining(['u0', 'ack-1']))
    expect(context.allowedEventIds).not.toContain('u1')
    expect(context.excludedEventIds).not.toContain('wang-answer')
    expect(allowedContext([...events, validWithdrawn], 'zeng-guofan').allowedEventIds).not.toContain('ack-1')
  })
})

describe('DeletionMachine', () => {
  function driver(failAt?: string): DeletionDriver & { calls: string[] } {
    const calls: string[] = []
    const step = (name: string) => async () => { calls.push(name); if (name === failAt) throw new Error(`${name} failed`) }
    return { calls, stopAgents: step('stop'), deleteSession: async id => step(id)(), deleteProduct: step('product') }
  }
  it('can be cancelled before execution and rejects cancellation after irreversible work', async () => {
    const persist = vi.fn(async () => {})
    const machine = new DeletionMachine(dilemmaId('d1'), branches, persist)
    const op = { operationId: operationId('op1'), stage: 'requested' as const, irreversible: false }
    machine.arm(op)
    expect(machine.cancel()).toEqual(op)
    machine.arm(op)
    const d = driver()
    await machine.run(op, d)
    expect(d.calls).toEqual(['stop', 'wang', 'zeng', 'product'])
    expect(() => machine.cancel()).toThrow(/irreversible/)
  })
  it('resumes a failed operation from the persisted stage with the same operation id', async () => {
    const states: string[] = []
    const persist = vi.fn(async (op: { stage: string }) => { states.push(op.stage) })
    const machine = new DeletionMachine(dilemmaId('d1'), branches, persist)
    const failed = await machine.run({ operationId: operationId('op2'), stage: 'requested', irreversible: false }, driver('zeng'))
    expect(failed).toMatchObject({ stage: 'failed', irreversible: true })
    const retry = driver()
    const resumed = await machine.run(failed, retry)
    expect(resumed.stage).toBe('completed')
    expect(retry.calls).toEqual(['zeng', 'product'])
    expect(states[0]).toBe('stopping-agents')
    expect(states).toContain('failed')
    expect(states.at(-1)).toBe('deleting-product')
  })
  it('reads legacy persona-specific deletion stages as generic branch targets', async () => {
    const machine = new DeletionMachine(dilemmaId('legacy-delete'), branches, async () => {})
    const d = driver()
    const completed = await machine.run({ operationId: operationId('legacy-op'), stage: 'deleting-wang', irreversible: true }, d)
    expect(completed.stage).toBe('completed')
    expect(d.calls).toEqual(['wang', 'zeng', 'product'])
  })
  it('does not allow a different operation id to take over', async () => {
    const machine = new DeletionMachine(dilemmaId('d1'), branches, async () => {})
    await machine.run({ operationId: operationId('op3'), stage: 'requested', irreversible: false }, driver('stop'))
    await expect(machine.run({ operationId: operationId('other'), stage: 'failed', irreversible: false }, driver())).rejects.toThrow(/different deletion operation/)
  })
})
