// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import { ActivityDetails, RoleplayerView } from '../src/client/RoleplayerView.tsx'

import { RoleplayerProjectionStore, type RoleplayerRemote, type RoleplayerStoreView } from '../src/client/store.ts'

const framework: GlobalStandardProps = {
  useSessions: () => { throw new Error('This product fixture does not read ordinary sessions') },
  useWorkspaces: () => { throw new Error('This product fixture does not read workspaces') },
}

afterEach(cleanup)

describe('man-roleplayer reasoning surface', () => {
  it('keeps live and settled raw reasoning collapsed while updating the summary', () => {
    const { rerender } = render(<ActivityDetails now={2_000} activity={{
      id: 'turn-1', messageId: 'message-1', turnOperationId: 'turn-1', persona: 'wang-yangming',
      phase: 'thinking', startedAt: 1_000,
      reasoning: { persona: 'wang-yangming', turnOperationId: 'turn-1', status: 'running', text: '先厘清问题\n再核对资料' },
    }} />)
    expect(screen.getByText('再核对资料')).toBeTruthy()
    const running = screen.getByText('思考过程').closest('details')
    expect(running?.open).toBe(false)
    expect(running?.querySelector('div')?.textContent).toBe('先厘清问题\n再核对资料')

    rerender(<ActivityDetails now={3_000} activity={{
      id: 'turn-1', messageId: 'message-1', turnOperationId: 'turn-1', persona: 'wang-yangming',
      phase: 'completed', startedAt: 1_000, endedAt: 3_000, durationMs: 2_000,
      reasoning: { persona: 'wang-yangming', turnOperationId: 'turn-1', status: 'completed', text: '先厘清问题，再给出回答' },
    }} />)
    expect(screen.getAllByText('先厘清问题，再给出回答')).toHaveLength(2)
    const settled = screen.getByText('思考过程').closest('details')
    expect(settled?.open).toBe(false)
  })

  it('keeps cancellation and failure labels on the reasoning row', () => {
    const { rerender } = render(<ActivityDetails now={2_000} activity={{
      id: 'turn-2', messageId: 'message-2', turnOperationId: 'turn-2', persona: 'zeng-guofan',
      phase: 'cancelled', startedAt: 1_000, endedAt: 2_000,
      reasoning: { persona: 'zeng-guofan', turnOperationId: 'turn-2', status: 'cancelled', text: '已完成部分思考' },
    }} />)
    expect(screen.getByText('思考过程 · 已取消')).toBeTruthy()
    rerender(<ActivityDetails now={2_000} activity={{
      id: 'turn-3', messageId: 'message-3', turnOperationId: 'turn-3', persona: 'zeng-guofan',
      phase: 'failed', startedAt: 1_000, endedAt: 2_000,
      reasoning: { persona: 'zeng-guofan', turnOperationId: 'turn-3', status: 'failed', text: '失败前的思考' },
    }} />)
    expect(screen.getByText('思考过程 · 未完成')).toBeTruthy()
  })
})

it('requires an answer for every choice question and keeps the choice open while waiting', async () => {
  let submitted: readonly unknown[] | undefined
  const projection = {
    handle: 'dilemma:choice', activePersona: 'wang-yangming', branches: [{ persona: 'wang-yangming' }],
    revision: 1,
    activeTurn: { messageId: 'message:choice', deliveryOperationId: 'delivery:choice', turnOperationId: 'turn:choice', persona: 'wang-yangming', status: 'waiting-choice', executionState: 'running' },
    choice: { operationId: 'choice:one', turnOperationId: 'turn:choice', persona: 'wang-yangming', status: 'pending', questions: [
      { id: 'direction', question: '方向？', options: [{ label: '继续' }] },
      { id: 'risk', question: '风险？', options: [{ label: '时间' }] },
    ] },
    timeline: [
      { id: 'message:old', kind: 'user-message', text: '上一个问题', status: 'completed' },
      { id: 'message:choice', kind: 'user-message', text: '怎么选择？', status: 'completed' },
    ],
    activity: [
      { id: 'activity:old', messageId: 'message:old', turnOperationId: 'turn:old', persona: 'wang-yangming', phase: 'failed', startedAt: 1000, endedAt: 3000, durationMs: 2000 },
      { id: 'activity:choice', messageId: 'message:choice', turnOperationId: 'turn:choice', persona: 'wang-yangming', phase: 'thinking', startedAt: 4000 },
    ],
  }
  const remote = {
    list: async () => ({ ok: true as const, value: { ok: true as const, value: [projection] } }),
    answerChoice: async (request: { answers: readonly unknown[] }) => {
      submitted = request.answers
      return new Promise(() => {})
    },
  } as unknown as RoleplayerRemote
  const store = new RoleplayerProjectionStore(remote)
  await store.refresh()
  const props = {
    ...framework,
    store,
    renderSlot: () => null,
    useRoleplayer: <T,>(selector: (view: RoleplayerStoreView) => T) => selector(store.getSnapshot()),
  }
  render(<RoleplayerView {...props} />)
  expect(screen.getByText('等待你选择，模型暂不生成回答。')).toBeTruthy()
  expect(screen.getAllByText('等待你选择，模型暂不生成回答。')).toHaveLength(1)
  expect(screen.getByText('本轮过程 · 用时 2 秒')).toBeTruthy()
  expect(screen.getByText(/选择等待期间不计入模型生成时间/)).toBeTruthy()
  expect(screen.queryByText(/思考中 · 已用时/)).toBeNull()

  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '提交选择' }))
  expect(screen.getByRole('alert').textContent).toContain('请为每个问题选择至少一个选项')
  expect(submitted).toBeUndefined()

  fireEvent.click(screen.getByLabelText('继续'))
  fireEvent.click(screen.getAllByRole('button', { name: '我还有其他考虑' })[1]!)
  fireEvent.change(screen.getByRole<HTMLInputElement>('textbox', { name: '补充 risk' }), { target: { value: '   ' } })
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '提交选择' }))
  expect(submitted).toBeUndefined()

  fireEvent.change(screen.getByRole<HTMLInputElement>('textbox', { name: '补充 risk' }), { target: { value: '时机不成熟' } })
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '提交选择' }))
  expect(submitted).toEqual([
    { id: 'direction', selected: ['继续'] },
    { id: 'risk', selected: [], custom: '时机不成熟' },
  ])
  expect((screen.getByRole<HTMLButtonElement>('button', { name: '正在提交…' })).disabled).toBe(true)
  store.dispose()
})

it('sends an explicit skip marker for every question', async () => {
  let submitted: readonly unknown[] | undefined
  const projection = {
    handle: 'dilemma:skip', activePersona: 'wang-yangming', branches: [{ persona: 'wang-yangming' }], revision: 1,
    choice: { operationId: 'choice:skip', turnOperationId: 'turn:skip', persona: 'wang-yangming', status: 'pending', questions: [
      { id: 'q1', question: '一？' }, { id: 'q2', question: '二？' },
    ] }, timeline: [],
  }
  const store = new RoleplayerProjectionStore({
    list: async () => ({ ok: true as const, value: { ok: true as const, value: [projection] } }),
    answerChoice: async (request: { answers: readonly unknown[] }) => { submitted = request.answers; return new Promise(() => {}) },
  } as unknown as RoleplayerRemote)
  await store.refresh()
  const props = {
    ...framework,
    store,
    renderSlot: () => null,
    useRoleplayer: <T,>(selector: (view: RoleplayerStoreView) => T) => selector(store.getSnapshot()),
  }
  render(<RoleplayerView {...props} />)
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '跳过此问' }))
  expect(submitted).toEqual([
    { id: 'q1', selected: [], skipped: true },
    { id: 'q2', selected: [], skipped: true },
  ])
  store.dispose()
})

it('preserves expanded choice drafts across dilemma switches without sharing them', async () => {
  const choice = (handle: string, operationId: string) => ({
    handle, activePersona: 'wang-yangming', branches: [{ persona: 'wang-yangming' }], revision: 1,
    choice: { operationId, turnOperationId: `turn:${operationId}`, persona: 'wang-yangming', status: 'pending', questions: [
      { id: 'next_topic', question: '接下来想谈什么？' },
    ] }, timeline: [],
  })
  const store = new RoleplayerProjectionStore({
    list: async () => ({ ok: true as const, value: { ok: true as const, value: [
      choice('dilemma:a', 'choice:a'), choice('dilemma:b', 'choice:b'),
    ] } }),
  } as unknown as RoleplayerRemote)
  await store.refresh()
  const props = {
    ...framework,
    store,
    renderSlot: () => null,
    useRoleplayer: <T,>(selector: (view: RoleplayerStoreView) => T) => selector(store.getSnapshot()),
  }
  const { rerender } = render(<RoleplayerView {...props} />)
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '我还有其他考虑' }))
  fireEvent.change(screen.getByRole<HTMLInputElement>('textbox', { name: '补充 next_topic' }), { target: { value: '原困惑的选择草稿' } })

  store.select('dilemma:b' as never)
  rerender(<RoleplayerView {...props} />)
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '我还有其他考虑' }))
  expect((screen.getByRole<HTMLInputElement>('textbox', { name: '补充 next_topic' })).value).toBe('')
  fireEvent.change(screen.getByRole<HTMLInputElement>('textbox', { name: '补充 next_topic' }), { target: { value: '另一份困惑的草稿' } })

  store.select('dilemma:a' as never)
  rerender(<RoleplayerView {...props} />)
  expect((screen.getByRole<HTMLInputElement>('textbox', { name: '补充 next_topic' })).value).toBe('原困惑的选择草稿')
  store.select('dilemma:b' as never)
  rerender(<RoleplayerView {...props} />)
  expect((screen.getByRole<HTMLInputElement>('textbox', { name: '补充 next_topic' })).value).toBe('另一份困惑的草稿')
  store.dispose()
})

it('switches a single-select answer between options and custom text without submitting both', async () => {
  let submitted: readonly unknown[] | undefined
  const projection = {
    handle: 'dilemma:single-switch', activePersona: 'wang-yangming', branches: [{ persona: 'wang-yangming' }], revision: 1,
    choice: { operationId: 'choice:single-switch', turnOperationId: 'turn:single-switch', persona: 'wang-yangming', status: 'pending', questions: [
      { id: 'next_topic', question: '接下来讲什么？', options: [{ label: '先讲挫败' }] },
    ] }, timeline: [],
  }
  const store = new RoleplayerProjectionStore({
    list: async () => ({ ok: true as const, value: { ok: true as const, value: [projection] } }),
    answerChoice: async (request: { answers: readonly unknown[] }) => { submitted = request.answers; return new Promise(() => {}) },
  } as unknown as RoleplayerRemote)
  await store.refresh()
  const props = {
    ...framework,
    store,
    renderSlot: () => null,
    useRoleplayer: <T,>(selector: (view: RoleplayerStoreView) => T) => selector(store.getSnapshot()),
  }
  render(<RoleplayerView {...props} />)
  const option = screen.getByLabelText('先讲挫败') as HTMLInputElement
  fireEvent.click(option)
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '我还有其他考虑' }))
  const custom = screen.getByRole<HTMLInputElement>('textbox', { name: '补充 next_topic' })
  fireEvent.change(custom, { target: { value: '我想先讲那次面试的具体经过' } })
  expect(option.checked).toBe(false)
  fireEvent.click(option)
  expect(option.checked).toBe(true)
  expect(custom.value).toBe('我想先讲那次面试的具体经过')
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '提交选择' }))
  expect(submitted).toEqual([{ id: 'next_topic', selected: ['先讲挫败'] }])
  store.dispose()
})

it('submits single-select custom text as the alternative to an option answer', async () => {
  let submitted: readonly unknown[] | undefined
  const projection = {
    handle: 'dilemma:single-custom', activePersona: 'wang-yangming', branches: [{ persona: 'wang-yangming' }], revision: 1,
    choice: { operationId: 'choice:single-custom', turnOperationId: 'turn:single-custom', persona: 'wang-yangming', status: 'pending', questions: [
      { id: 'next_topic', question: '接下来讲什么？', options: [{ label: '先讲挫败' }] },
    ] }, timeline: [],
  }
  const store = new RoleplayerProjectionStore({
    list: async () => ({ ok: true as const, value: { ok: true as const, value: [projection] } }),
    answerChoice: async (request: { answers: readonly unknown[] }) => { submitted = request.answers; return new Promise(() => {}) },
  } as unknown as RoleplayerRemote)
  await store.refresh()
  const props = {
    ...framework,
    store,
    renderSlot: () => null,
    useRoleplayer: <T,>(selector: (view: RoleplayerStoreView) => T) => selector(store.getSnapshot()),
  }
  render(<RoleplayerView {...props} />)
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '我还有其他考虑' }))
  const option = screen.getByLabelText('先讲挫败') as HTMLInputElement
  const custom = screen.getByRole<HTMLInputElement>('textbox', { name: '补充 next_topic' })
  fireEvent.change(custom, { target: { value: '从另一件事谈起' } })
  expect(option.checked).toBe(false)
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '提交选择' }))
  expect(submitted).toEqual([{ id: 'next_topic', selected: [], custom: '从另一件事谈起' }])
  store.dispose()
})

it('keeps multi-select options and custom text in the same answer', async () => {
  let submitted: readonly unknown[] | undefined
  const projection = {
    handle: 'dilemma:multi', activePersona: 'wang-yangming', branches: [{ persona: 'wang-yangming' }], revision: 1,
    choice: { operationId: 'choice:multi', turnOperationId: 'turn:multi', persona: 'wang-yangming', status: 'pending', questions: [
      { id: 'considerations', question: '还有哪些考虑？', multiSelect: true, options: [{ label: '时间' }] },
    ] }, timeline: [],
  }
  const store = new RoleplayerProjectionStore({
    list: async () => ({ ok: true as const, value: { ok: true as const, value: [projection] } }),
    answerChoice: async (request: { answers: readonly unknown[] }) => { submitted = request.answers; return new Promise(() => {}) },
  } as unknown as RoleplayerRemote)
  await store.refresh()
  const props = {
    ...framework,
    store,
    renderSlot: () => null,
    useRoleplayer: <T,>(selector: (view: RoleplayerStoreView) => T) => selector(store.getSnapshot()),
  }
  render(<RoleplayerView {...props} />)
  fireEvent.click(screen.getByLabelText('时间'))
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '我还有其他考虑' }))
  fireEvent.change(screen.getByRole<HTMLInputElement>('textbox', { name: '补充 considerations' }), { target: { value: '也要考虑家人安排' } })
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '提交选择' }))
  expect(submitted).toEqual([{ id: 'considerations', selected: ['时间'], custom: '也要考虑家人安排' }])
  store.dispose()
})


it('preserves typed text and stops claiming live progress during disconnection', async () => {
  const projection = {
    handle: 'dilemma:connection', activePersona: 'wang-yangming', branches: [{ persona: 'wang-yangming' }],
    revision: 1, timeline: [{ id: 'message:one', kind: 'user-message', text: '一个问题', status: 'completed' }],
    activity: [{ id: 'activity:one', messageId: 'message:one', turnOperationId: 'turn:one', persona: 'wang-yangming', phase: 'thinking', startedAt: 1000 }],
  }
  const store = new RoleplayerProjectionStore({
    list: async () => ({ ok: true, value: { ok: true, value: [projection] } }),
  } as unknown as RoleplayerRemote)
  await store.refresh()
  const props = {
    ...framework,
    store,
    renderSlot: () => null,
    useRoleplayer: <T,>(selector: (view: RoleplayerStoreView) => T) => selector(store.getSnapshot()),
  }
  const { rerender } = render(<RoleplayerView {...props} />)
  fireEvent.change(screen.getByRole<HTMLTextAreaElement>('textbox', { name: '输入困惑' }), { target: { value: '仍在编辑的内容' } })
  store.setConnected(false)
  rerender(<RoleplayerView {...props} />)
  expect((screen.getByRole<HTMLTextAreaElement>('textbox', { name: '输入困惑' })).value).toBe('仍在编辑的内容')
  expect((screen.getByRole<HTMLButtonElement>('button', { name: /发送/ })).disabled).toBe(true)
  expect(screen.getByText('连接已中断 · 正在重连')).toBeTruthy()
  expect(screen.getByText('本轮过程 · 连接已中断，正在核对回答状态')).toBeTruthy()
  expect(screen.queryByText('可以继续提交新的困惑')).toBeNull()
  store.dispose()
})


it('shows an explicit synchronization failure after a connected reload fails', async () => {
  let fail = false
  const store = new RoleplayerProjectionStore({
    list: async () => {
      if (fail) throw new Error('Host is still recovering')
      return { ok: true, value: { ok: true, value: [{
        handle: 'dilemma:sync-failure', activePersona: 'wang-yangming',
        branches: [{ persona: 'wang-yangming' }], revision: 1, timeline: [],
      }] } }
    },
  } as unknown as RoleplayerRemote)
  await store.refresh()
  fail = true
  await store.refresh()
  const props = {
    ...framework,
    store,
    renderSlot: () => null,
    useRoleplayer: <T,>(selector: (view: RoleplayerStoreView) => T) => selector(store.getSnapshot()),
  }
  render(<RoleplayerView {...props} />)
  expect(screen.getByText('同步失败 · 请重试')).toBeTruthy()
  expect(screen.getByText('同步失败')).toBeTruthy()
  expect(screen.getByText('未能读取最新回答状态，请重试；未发送内容已保留')).toBeTruthy()
  expect((screen.getByRole<HTMLButtonElement>('button', { name: '重试' })).disabled).toBe(false)
  expect(screen.queryByText('正在同步')).toBeNull()
  expect(screen.queryByText('同步中')).toBeNull()
  expect(screen.queryByText('正在读取最新回答状态')).toBeNull()
  store.dispose()
})
