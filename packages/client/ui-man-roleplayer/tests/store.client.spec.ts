import { describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { DilemmaHandle, ManRoleplayerOperationId, PersonaId, RoleplayerDeleteResult, RoleplayerProjection, RoleplayerProjectionResult, RoleplayerResult, RoleplayerSubmitRequest } from '@deepseek-ai/dsh-man-roleplayer/types'
import { RoleplayerProjectionStore, type RoleplayerRemote } from '../src/client/store.ts'

const handle = 'dilemma:opaque' as DilemmaHandle
const base: RoleplayerProjection = {
  handle,
  activePersona: 'wang-yangming',
  branches: [{ persona: 'wang-yangming' }, { persona: 'zeng-guofan' }],
  timeline: [],
  revision: 2,
}

function carrier<T>(value: RoleplayerResult<T>): RemoteResult<RoleplayerResult<T>> { return { ok: true, value } }

function fakeRemote(): RoleplayerRemote & { current: RoleplayerProjection; requests: string[] } {
  const state = { current: base, requests: [] as string[] }
  const projection = (): RemoteResult<RoleplayerProjectionResult> => carrier({ ok: true, value: state.current })
  return {
    get current() { return state.current },
    set current(value: RoleplayerProjection) { state.current = value },
    requests: state.requests,
    list: async () => carrier({ ok: true, value: [state.current] }),
    create: async () => projection(),
    getProjection: async () => projection(),
    archive: async (request) => { state.requests.push(`archive:${request.expectedRevision}`); state.current = { ...state.current, archived: true, revision: 3 }; return projection() },
    restore: async (request) => {
      state.requests.push(`restore:${request.expectedRevision}`)
      const { archived: _archived, ...withoutArchive } = state.current
      state.current = { ...withoutArchive, revision: 4 }
      return projection()
    },
    switchPersona: async (request) => { state.requests.push(`switch:${request.persona}`); state.current = { ...state.current, activePersona: request.persona, revision: 5 }; return projection() },
    rename: async (request) => { state.requests.push(`rename:${request.title}`); state.current = { ...state.current, title: request.title, revision: 6 }; return projection() },
    pause: async () => { state.requests.push('pause'); state.current = { ...state.current, discussionStatus: 'paused', revision: 7 }; return projection() },
    resume: async () => { state.requests.push('resume'); state.current = { ...state.current, discussionStatus: 'in_progress', revision: 8 }; return projection() },
    endStage: async () => { state.requests.push('endStage'); state.current = { ...state.current, discussionStatus: 'stage_ended', revision: 9 }; return projection() },
    submit: async (request) => { state.requests.push(`submit:${request.text}`); return projection() },
    retryMessage: async () => { state.requests.push('retryMessage'); return projection() },
    cancel: async (request) => { state.requests.push(`cancel:${request.messageId}`); return projection() },
    answerChoice: async () => { state.requests.push('answerChoice'); return projection() },
    cancelChoice: async () => { state.requests.push('cancelChoice'); return projection() },
    delete: async (request) => { state.requests.push(`delete:${request.operationId}`); return carrier({ ok: true, value: { handle, deleted: true } }) },
    confirmState: async () => projection(),
    modifyState: async () => projection(),
    rejectState: async () => projection(),
    withdrawState: async () => projection(),
    resolveState: async () => projection(),
    challengeEvidence: async () => projection(),
    reviewEvidence: async () => projection(),
    withdrawEvidence: async () => projection(),
  }
}

describe('man-roleplayer client projection store', () => {
  it('sends a completed current-persona reply id without copying its answer into the Remote request', async () => {
    const remote = fakeRemote(); const sent: RoleplayerSubmitRequest[] = []
    remote.current = { ...base, timeline: [{ id: 'turn:reply', kind: 'persona-message', persona: 'wang-yangming', status: 'completed', text: 'private answer text' }] }
    remote.submit = async (request) => { sent.push(request); return carrier({ ok: true, value: remote.current }) }
    const store = new RoleplayerProjectionStore(remote)
    await store.refresh()
    expect(await store.conversation().submit('继续说说', 'turn:reply')).toBe(true)
    expect(sent).toEqual([expect.objectContaining({ handle, text: '继续说说', replyToTimelineEventId: 'turn:reply' })])
    expect(JSON.stringify(sent)).not.toContain('private answer text')
    expect(await store.conversation().submit('普通消息')).toBe(true)
    expect(sent[1]).not.toHaveProperty('replyToTimelineEventId')
    store.dispose()
  })

  it('rejects missing, wrong-persona, non-persona, and non-completed reply targets without sending', async () => {
    const remote = fakeRemote(); const submit = vi.fn(remote.submit); remote.submit = submit
    remote.current = { ...base, timeline: [
      { id: 'other-persona', kind: 'persona-message', persona: 'zeng-guofan', status: 'completed' },
      { id: 'user', kind: 'user-message', persona: 'wang-yangming', status: 'delivered' },
      { id: 'failed', kind: 'persona-message', persona: 'wang-yangming', status: 'failed' },
      { id: 'cancelled', kind: 'persona-message', persona: 'wang-yangming', status: 'cancelled' },
      { id: 'unfinished', kind: 'persona-message', persona: 'wang-yangming' },
    ] }
    const store = new RoleplayerProjectionStore(remote); await store.refresh()
    for (const id of ['missing', '', 'other-persona', 'user', 'failed', 'cancelled', 'unfinished']) {
      expect(await store.conversation().submit('保留草稿', id)).toBe(false)
      expect(store.getSnapshot().error).toContain('引用消息已失效')
      expect(store.getSnapshot().pending).toBeUndefined()
    }
    expect(submit).not.toHaveBeenCalled()
    store.dispose()
  })

  it('rejects retained reply callbacks after switching dilemma or persona', async () => {
    const remote = fakeRemote(); const submit = vi.fn(remote.submit); remote.submit = submit
    const original: RoleplayerProjection = { ...base, timeline: [{ id: 'old-turn', kind: 'persona-message', persona: 'wang-yangming', status: 'completed' }] }
    const other: RoleplayerProjection = { ...original, handle: 'dilemma:other' as DilemmaHandle }
    remote.current = original
    remote.list = async () => carrier({ ok: true, value: [original, other] })
    const store = new RoleplayerProjectionStore(remote); await store.refresh()
    const stale = store.conversation()
    store.select(other.handle)
    expect(await stale.submit('不要串到另一个困惑', 'old-turn')).toBe(false)
    store.select(handle)
    expect(await store.conversation().switchPersona('zeng-guofan')).toBe(true)
    expect(await stale.submit('不要串到另一个人物', 'old-turn')).toBe(false)
    store.select(null)
    expect(await store.conversation().submit('已无困惑', 'old-turn')).toBe(false)
    expect(store.getSnapshot().error).toContain('引用消息已失效')
    expect(submit).not.toHaveBeenCalled()
    store.dispose()
  })

  it('creates a dilemma from one selected persona and sends the variable roster unchanged', async () => {
    const remote = fakeRemote(); const requests: PersonaId[][] = []
    remote.create = async (request) => {
      requests.push([...(request.personas ?? [])])
      remote.current = { ...remote.current, branches: [{ persona: request.activePersona }] }
      return carrier({ ok: true, value: remote.current })
    }
    const store = new RoleplayerProjectionStore(remote)
    await store.refresh()
    expect(await store.sidebar().create(['wang-yangming'])).toBe(true)
    expect(requests).toEqual([['wang-yangming']])
    expect(store.conversation().projection?.branches).toEqual([{ persona: 'wang-yangming' }])
  })

  it('keeps an active turn bound to its dilemma while another dilemma is selected', async () => {
    const remote = fakeRemote(); const store = new RoleplayerProjectionStore(remote)
    const other = { ...base, handle: 'dilemma:other' as DilemmaHandle, activeTurn: { messageId: 'message:a' as ManRoleplayerOperationId, deliveryOperationId: 'delivery:a' as ManRoleplayerOperationId, turnOperationId: 'turn:a' as ManRoleplayerOperationId, persona: 'wang-yangming' as const, status: 'running' as const, executionState: 'running' as const } }
    remote.list = async () => carrier({ ok: true, value: [base, other] })
    await store.refresh()
    expect(store.getSnapshot().pending).toBeUndefined()
    store.select(other.handle)
    expect(store.getSnapshot().dilemmas.find(item => item.handle === other.handle)?.activeTurn?.turnOperationId).toBe('turn:a')
    expect(store.getSnapshot().pending).toMatchObject({ handle: other.handle, turnOperationId: 'turn:a' })
    store.select(base.handle)
    expect(store.getSnapshot().pending).toBeUndefined()
  })

  it('keeps polling a long-running turn until its terminal projection clears pending', async () => {
    vi.useFakeTimers()
    try {
      const remote = fakeRemote()
      const turnOperationId = 'turn:long' as ManRoleplayerOperationId
      remote.current = { ...base, activeTurn: { messageId: 'message:long' as ManRoleplayerOperationId, deliveryOperationId: 'delivery:long' as ManRoleplayerOperationId, turnOperationId, persona: 'wang-yangming', status: 'running', executionState: 'running' } }
      const store = new RoleplayerProjectionStore(remote)
      await store.refresh()
      let polls = 0
      remote.getProjection = async () => {
        polls += 1
        if (polls > 600) {
          const { activeTurn: _activeTurn, ...withoutActiveTurn } = remote.current
          remote.current = { ...withoutActiveTurn, revision: 3, timeline: [{ operationId: turnOperationId, kind: 'persona-message', status: 'completed', text: 'long answer' }] as never }
        }
        return carrier({ ok: true, value: remote.current })
      }
      ;(store as unknown as {
        scheduleTurnRefresh: (handle: DilemmaHandle, turn: string) => void
      }).scheduleTurnRefresh(handle, turnOperationId)
      await vi.advanceTimersByTimeAsync(25 + 600 * 100)
      expect(polls).toBeGreaterThan(600)
      expect(store.getSnapshot().pendingByHandle?.[handle]).toBeUndefined()
      expect(store.getSnapshot().dilemmas[0]?.timeline).toContainEqual(expect.objectContaining({ operationId: turnOperationId, status: 'completed' }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops turn polling on dispose, including after an in-flight projection resolves', async () => {
    vi.useFakeTimers()
    try {
      const remote = fakeRemote(); const store = new RoleplayerProjectionStore(remote)
      remote.current = {
        ...remote.current,
        activeTurn: {
          messageId: 'message:disposed' as ManRoleplayerOperationId,
          deliveryOperationId: 'delivery:disposed' as ManRoleplayerOperationId,
          turnOperationId: 'turn:disposed' as ManRoleplayerOperationId,
          persona: 'wang-yangming', status: 'running', executionState: 'running',
        },
      }
      await store.refresh()
      let calls = 0
      let resolveProjection!: (value: RemoteResult<RoleplayerProjectionResult>) => void
      remote.getProjection = async () => {
        calls += 1
        return await new Promise<RemoteResult<RoleplayerProjectionResult>>((resolve) => { resolveProjection = resolve })
      }
      ;(store as unknown as {
        scheduleTurnRefresh: (handle: DilemmaHandle, turn: string) => void
      }).scheduleTurnRefresh(handle, 'turn:disposed')
      await vi.advanceTimersByTimeAsync(25)
      expect(calls).toBe(1)
      store.dispose()
      resolveProjection(carrier({ ok: true, value: remote.current }))
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(1000)
      expect(calls).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('retries failed state analysis through one product operation without a second user submit', async () => {
    const remote = fakeRemote(); let retryCalls = 0
    remote.current = { ...base, state: { status: 'failed', operationId: 'state:a' as ManRoleplayerOperationId, retryable: true } }
    remote.retryState = async (request) => { retryCalls += 1; expect(request.stateOperationId).toBe('state:a'); return carrier({ ok: true, value: remote.current }) }
    const store = new RoleplayerProjectionStore(remote); await store.refresh()
    expect(await store.details().retryState()).toBe(true); expect(retryCalls).toBe(1)
  })

  it('retries archive once after a revision conflict with the same request id', async () => {
    const remote = fakeRemote(); const requests: { id: string; revision: number }[] = []; let first = true
    remote.archive = async (request) => {
      requests.push({ id: request.requestId, revision: request.expectedRevision })
      if (first) { first = false; remote.current = { ...remote.current, revision: 3 }; return carrier({ ok: false, error: { code: 'revision-conflict', message: 'changed', details: {} } }) }
      remote.current = { ...remote.current, archived: true, revision: 4 }; return carrier({ ok: true, value: remote.current })
    }
    const store = new RoleplayerProjectionStore(remote); await store.refresh(); expect(await store.details().archive()).toBe(true)
    expect(requests).toHaveLength(2)
    expect(requests[0]?.id).toBe(requests[1]?.id)
    expect(requests[1]?.revision).toBeGreaterThan(requests[0]?.revision ?? 0)
  })

  it('crosses three synchronous archive conflicts and stops at eight attempts', async () => {
    const remote = fakeRemote(); const seen: Array<{ id: string; revision: number }> = []; let conflicts = 3
    remote.archive = async (request) => {
      seen.push({ id: request.requestId, revision: request.expectedRevision })
      if (conflicts > 0) {
        conflicts -= 1
        remote.current = { ...remote.current, revision: remote.current.revision + 1 }
        return carrier({ ok: false, error: { code: 'revision-conflict', message: 'changed', details: {} } })
      }
      remote.current = { ...remote.current, archived: true, revision: remote.current.revision + 1 }
      return carrier({ ok: true, value: remote.current })
    }
    const store = new RoleplayerProjectionStore(remote)
    await store.refresh()
    expect(await store.details().archive()).toBe(true)
    expect(seen).toHaveLength(4)
    expect(new Set(seen.map(item => item.id)).size).toBe(1)
    expect(seen.map(item => item.revision)).toEqual([2, 3, 4, 5])
  })

  it('does not issue a ninth archive attempt after eight conflicts', async () => {
    const remote = fakeRemote(); const seen: string[] = []
    remote.archive = async (request) => {
      seen.push(request.requestId)
      remote.current = { ...remote.current, revision: remote.current.revision + 1 }
      return carrier({ ok: false, error: { code: 'revision-conflict', message: 'changed', details: {} } })
    }
    const store = new RoleplayerProjectionStore(remote)
    await store.refresh()
    expect(await store.details().archive()).toBe(false)
    expect(seen).toHaveLength(8)
  })

  it('owns one projection and exposes sidebar, conversation, and details selectors', async () => {
    const remote = fakeRemote(); const store = new RoleplayerProjectionStore(remote)
    expect(await store.refresh()).toBe(true)
    expect(store.sidebar().items).toHaveLength(1)
    expect(store.conversation().projection?.handle).toBe(handle)
    expect(store.details().projection?.revision).toBe(2)
    expect(await store.details().archive()).toBe(true)
    expect(remote.requests).toEqual(['archive:2'])
    expect(store.sidebar().items).toHaveLength(0)
    expect(await store.details().restore()).toBe(true)
    expect(await store.conversation().switchPersona('zeng-guofan')).toBe(true)
    expect(remote.requests).toEqual(['archive:2', 'restore:3', 'switch:zeng-guofan'])
    expect(await store.details().delete('delete-operation' as ManRoleplayerOperationId)).toBe(true)
    expect(store.conversation().projection).toBeUndefined()
  })

  it('keeps carrier failures observable without exposing Session ids', async () => {
    const remote = fakeRemote()
    remote.list = async () => ({ ok: false, error: { code: 'transport', message: 'offline', details: {} } })
    const store = new RoleplayerProjectionStore(remote)
    expect(await store.refresh()).toBe(false)
    expect(store.getSnapshot()).toMatchObject({ status: 'error', error: 'offline' })
    expect(JSON.stringify(store.getSnapshot())).not.toContain('sessionId')
  })

  it('routes rename, discussion lifecycle, retry, and choice actions through the product Remote', async () => {
    const remote = fakeRemote(); const store = new RoleplayerProjectionStore(remote)
    await store.refresh()
    expect(await store.details().rename('我的困惑')).toBe(true)
    expect(await store.details().pause()).toBe(true)
    expect(await store.details().resume()).toBe(true)
    expect(await store.details().endStage()).toBe(true)
    expect(await store.details().retryMessage('message-1' as ManRoleplayerOperationId, 'turn-1' as ManRoleplayerOperationId)).toBe(true)
    expect(await store.details().answerChoice('choice-1' as ManRoleplayerOperationId, [{ id: 'q', selected: [] }])).toBe(true)
    remote.current = { ...remote.current, revision: remote.current.revision + 1, choice: {
      operationId: 'choice-1', turnOperationId: 'turn-choice-1', persona: 'wang-yangming', status: 'pending',
      questions: [{ id: 'q', question: '继续吗？', options: [{ label: '继续' }] }],
    } }
    await store.refresh()
    expect(await store.details().cancelChoice('choice-1' as ManRoleplayerOperationId)).toBe(true)
    expect(remote.requests).toEqual(['rename:我的困惑', 'pause', 'resume', 'endStage', 'retryMessage', 'answerChoice', 'cancelChoice'])
  })

  it('turns transport rejects into observable errors and refreshes failed deletion state before retry', async () => {
    const remote = fakeRemote(); const store = new RoleplayerProjectionStore(remote)
    await store.refresh()
    remote.archive = async () => { throw new Error('archive transport failed') }
    expect(await store.details().archive()).toBe(false)
    expect(store.getSnapshot().error).toBe('archive transport failed')

    const revisions: number[] = []
    let failed = true
    remote.delete = async (request) => {
      revisions.push(request.expectedRevision)
      if (failed) {
        failed = false
        remote.current = { ...remote.current, revision: request.expectedRevision + 1 }
        return carrier({ ok: false, error: { code: 'deletion-failed', message: 'deletion is still running', details: { stage: 'stopping-agents' } } })
      }
      return carrier({ ok: true, value: { handle, deleted: true } })
    }
    expect(await store.details().delete('delete-operation' as ManRoleplayerOperationId)).toBe(false)
    expect(store.getSnapshot().dilemmas[0]?.revision).toBe(3)
    expect(await store.details().delete('delete-operation' as ManRoleplayerOperationId)).toBe(true)
    expect(revisions).toEqual([2, 3])
    expect(store.conversation().projection).toBeUndefined()
  })

  it('rejects malformed, false, and wrong-handle deletion acknowledgements', async () => {
    const acknowledgements: readonly unknown[] = [
      { handle, deleted: false },
      { handle: 'dilemma:other', deleted: true },
      { handle, deleted: true, extra: 'unexpected' },
      base,
    ]
    for (const acknowledgement of acknowledgements) {
      const remote = fakeRemote(); const store = new RoleplayerProjectionStore(remote)
      await store.refresh()
      remote.delete = async () => carrier({ ok: true, value: acknowledgement } as unknown as RoleplayerDeleteResult)
      expect(await store.details().delete('delete-operation' as ManRoleplayerOperationId)).toBe(false)
      expect(store.conversation().projection?.handle).toBe(handle)
      expect(store.getSnapshot().error).toBe('invalid dilemma deletion acknowledgement')
    }
  })

  it('retries a lost successful delete response through the durable receipt acknowledgement', async () => {
    const remote = fakeRemote(); const store = new RoleplayerProjectionStore(remote)
    await store.refresh()
    let calls = 0
    remote.delete = async () => {
      calls += 1
      if (calls === 1) throw new Error('response lost after commit')
      return carrier({ ok: true, value: { handle, deleted: true } })
    }
    expect(await store.details().delete('delete-operation' as ManRoleplayerOperationId)).toBe(false)
    expect(store.conversation().projection?.handle).toBe(handle)
    expect(await store.details().delete('delete-operation' as ManRoleplayerOperationId)).toBe(true)
    expect(calls).toBe(2)
    expect(store.conversation().projection).toBeUndefined()
  })
})


describe('man-roleplayer connection recovery and selection', () => {
  it('keeps valid persisted selection, falls back from missing ids, and moves recent selections first', async () => {
    const remote = fakeRemote()
    const other = { ...base, handle: 'dilemma:other' as DilemmaHandle }
    remote.list = async () => carrier({ ok: true, value: [base, other] })
    const write = vi.fn()
    const store = new RoleplayerProjectionStore(remote, { read: () => other.handle, write })
    await store.refresh()
    expect(store.getSnapshot().selected).toBe(other.handle)
    store.select(base.handle)
    expect(store.sidebar().items[0]?.handle).toBe(base.handle)
    expect(write).toHaveBeenCalledWith(base.handle)
    await store.refresh()
    expect(store.sidebar().items[0]?.handle).toBe(base.handle)
    const fallback = new RoleplayerProjectionStore(remote, { read: () => 'missing' as DilemmaHandle, write })
    await fallback.refresh()
    expect(fallback.getSnapshot().selected).toBe(base.handle)
    store.dispose(); fallback.dispose()
  })

  it('places a newly created dilemma first without dropping another dilemma pending turn', async () => {
    const remote = fakeRemote()
    remote.current = { ...base, activeTurn: { messageId: 'message:active' as ManRoleplayerOperationId, deliveryOperationId: 'delivery:active' as ManRoleplayerOperationId, turnOperationId: 'turn:active' as ManRoleplayerOperationId, persona: 'wang-yangming', status: 'running', executionState: 'running' } }
    const store = new RoleplayerProjectionStore(remote)
    await store.refresh()
    const created = { ...base, handle: 'dilemma:new' as DilemmaHandle }
    remote.create = async () => carrier({ ok: true, value: created })
    expect(await store.sidebar().create(['wang-yangming'])).toBe(true)
    expect(store.sidebar().items[0]?.handle).toBe(created.handle)
    expect(store.getSnapshot().pendingByHandle?.[base.handle]?.turnOperationId).toBe('turn:active')
    store.dispose()
  })

  it('blocks sending while disconnected and replaces pending state from the reconnected Host', async () => {
    const remote = fakeRemote()
    remote.current = { ...base, activeTurn: { messageId: 'message:active' as ManRoleplayerOperationId, deliveryOperationId: 'delivery:active' as ManRoleplayerOperationId, turnOperationId: 'turn:active' as ManRoleplayerOperationId, persona: 'wang-yangming', status: 'running', executionState: 'running' } }
    const store = new RoleplayerProjectionStore(remote)
    await store.refresh()
    expect(store.getSnapshot().pending).toBeDefined()
    store.setConnected(false)
    expect(await store.conversation().submit('保留这份草稿')).toBe(false)
    expect(remote.requests).toEqual([])
    remote.current = { ...base, revision: 3 }
    store.setConnected(true)
    await store.refresh()
    expect(store.getSnapshot()).toMatchObject({ connected: true, status: 'ready' })
    expect(store.getSnapshot().pending).toBeUndefined()
    store.dispose()
  })

  it('ignores an obsolete generation list response after reconnect', async () => {
    const remote = fakeRemote()
    let complete!: (value: RemoteResult<RoleplayerResult<readonly RoleplayerProjection[]>>) => void
    remote.list = () => new Promise((resolve) => { complete = resolve })
    const store = new RoleplayerProjectionStore(remote)
    const stale = store.refresh()
    store.setConnected(false)
    remote.list = async () => carrier({ ok: true, value: [{ ...base, title: '重连后最新困惑', revision: 5 }] })
    store.setConnected(true)
    await store.refresh()
    complete(carrier({ ok: true, value: [base] }))
    expect(await stale).toBe(false)
    expect(store.conversation().projection?.title).toBe('重连后最新困惑')
    store.dispose()
  })
})
