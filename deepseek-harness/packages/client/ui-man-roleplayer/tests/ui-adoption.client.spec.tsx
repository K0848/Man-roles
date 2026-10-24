// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GlobalStandardProps, OwnerOf, PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import type { DilemmaHandle, RoleplayerPersonaOption, RoleplayerProjection } from '@deepseek-ai/dsh-man-roleplayer/types'
import { RoleplayerView } from '../src/client/RoleplayerView.tsx'
import { PersonaDeck } from '../src/client/PersonaDeck.tsx'
import type { RoleplayerProjectionStore, RoleplayerStoreView } from '../src/client/store.ts'

const framework: GlobalStandardProps = {
  useSessions: () => { throw new Error('This product fixture does not read ordinary sessions') },
  useWorkspaces: () => { throw new Error('This product fixture does not read workspaces') },
}

const personas: readonly RoleplayerPersonaOption[] = [
  { id: 'wang-yangming', displayName: '王阳明' }, { id: 'zeng-guofan', displayName: '曾国藩' },
  { id: 'zhuangzi', displayName: '庄子' }, { id: 'su-shi', displayName: '苏轼' }, { id: 'zhu-xi', displayName: '朱熹' },
]
const handle = 'dilemma:reading' as DilemmaHandle
const base: RoleplayerProjection = {
  handle, title: '论文与求职', activePersona: 'wang-yangming', revision: 1,
  branches: [{ persona: 'wang-yangming' }, { persona: 'zhuangzi' }],
  timeline: [
    { id: 'turn:wang', operationId: 'turn:wang', kind: 'persona-message', persona: 'wang-yangming', status: 'completed', text: '知行本来合一。先做眼下可做之事。', claims: [{ start: 0, end: 7, kind: 'reliable-quote', evidenceIds: ['evidence:one'], status: 'accepted' }] },
    { id: 'turn:zhuang', operationId: 'turn:zhuang', kind: 'persona-message', persona: 'zhuangzi', status: 'completed', text: '换一个角度看待得失。' },
    { id: 'turn:pending', kind: 'persona-message', persona: 'wang-yangming', status: 'pending', text: '尚未完成' },
  ],
  evidence: [{ id: 'evidence:one', persona: 'wang-yangming', status: 'available', title: '传习录', text: '资料原文', source: '传习录卷上', evidenceType: 'disciple-record', trustLevel: 'reliable' }],
  state: { status: 'completed', sharedStateItems: [{ id: 'state:one', persona: 'wang-yangming', kind: 'goal', text: '希望兼顾论文与求职', status: 'candidate', revision: 1 }], personaSnapshot: { persona: 'wang-yangming', currentUnderstanding: '两件事的优先级尚未理清', coreView: '从可行的小事开始', revision: 1 } },
}

function fixture(projection: RoleplayerProjection = base) {
  let snapshot: RoleplayerStoreView = { status: 'ready', connected: true, dilemmas: [projection], personas, selected: projection.handle, error: null }
  const create = vi.fn(async () => true)
  const submit = vi.fn(async (_text: string, _reply?: string) => true)
  const switchPersona = vi.fn(async () => true)
  const cancel = vi.fn(async () => true)
  const details = {
    error: null, retry: vi.fn(async () => true), retryMessage: vi.fn(async () => true),
    pause: vi.fn(async () => true), endStage: vi.fn(async () => true), resume: vi.fn(async () => true),
    archive: vi.fn(async () => true), restore: vi.fn(async () => true), rename: vi.fn(async () => true),
    delete: vi.fn(async () => true), confirmState: vi.fn(async () => true), modifyState: vi.fn(async () => true),
    rejectState: vi.fn(async () => true), withdrawState: vi.fn(async () => true), resolveState: vi.fn(async () => true),
    challengeEvidence: vi.fn(async () => true), withdrawEvidence: vi.fn(async () => true),
    reviewEvidence: vi.fn(async () => true), retryState: vi.fn(async () => true),
  }
  const store = {
    sidebar: () => ({
      items: snapshot.dilemmas.filter(item => item.archived !== true),
      archivedItems: snapshot.dilemmas.filter(item => item.archived === true), create,
    }),
    conversation: () => ({ submit, switchPersona, cancel }), details: () => details,
    select: vi.fn((next: DilemmaHandle) => { snapshot = { ...snapshot, selected: next } }),
  } as unknown as RoleplayerProjectionStore
  const renderDeck = (_name: 'manRoleplayer.personaDeck', owner: OwnerOf<'manRoleplayer.personaDeck'>) => <PersonaDeck {...owner} {...framework} />
  // The fixture has one child slot; adapt its concrete renderer to the framework's generic signature.
  const renderSlot = renderDeck as PropsRenderSlots<'manRoleplayer.personaDeck'>['renderSlot']
  const props = {
    ...framework, store, renderSlot,
    useRoleplayer: <T,>(selector: (view: RoleplayerStoreView) => T) => selector(snapshot),
  }
  return { props, create, submit, switchPersona, cancel, details,
    update: (change: Partial<RoleplayerStoreView>) => { snapshot = { ...snapshot, ...change } },
    project: (next: RoleplayerProjection) => { snapshot = { ...snapshot, dilemmas: [next], selected: next.handle } },
  }
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('adopted product workspace interactions', () => {
  it('navigates anchored dilemma actions with keyboard and restores focus on Escape', () => {
    const f = fixture()
    render(<RoleplayerView {...f.props} />)
    const trigger = screen.getByRole('button', { name: '更多操作' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const menu = screen.getByRole('menu')
    expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: '重命名' }))
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: '永久删除' }))
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: '重命名' }))
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('retains edited state text after failed save and disables save while disconnected', async () => {
    const f = fixture()
    f.details.modifyState.mockResolvedValueOnce(false)
    const { rerender } = render(<RoleplayerView {...f.props} />)
    fireEvent.click(screen.getByRole('button', { name: '修改' }))
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: '修改状态' })
    fireEvent.change(input, { target: { value: '先完成论文初稿' } })
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }))
    await waitFor(() => { expect(f.details.modifyState).toHaveBeenCalledWith('state:one', '先完成论文初稿', 'goal') })
    expect(input.value).toBe('先完成论文初稿')
    f.update({ connected: false })
    rerender(<RoleplayerView {...f.props} />)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '保存修改' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: '修改状态' }).value).toBe('先完成论文初稿')
  })

  it('uses the approved light palette and restores the document appearance when the product unmounts', () => {
    document.body.setAttribute('data-ds-dark-theme', '')
    document.documentElement.style.colorScheme = 'dark'
    const f = fixture()
    const { unmount } = render(<RoleplayerView {...f.props} />)
    expect(document.body.hasAttribute('data-ds-dark-theme')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
    unmount()
    expect(document.body.hasAttribute('data-ds-dark-theme')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
    document.body.removeAttribute('data-ds-dark-theme')
    document.documentElement.style.colorScheme = ''
  })
  it('keeps the focused state input through mobile-panel updates and restores its trigger on Escape', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body)
    const f = fixture()
    const { rerender } = render(<RoleplayerView {...f.props} />)
    const trigger = screen.getByRole<HTMLButtonElement>('button', { name: '收起详情面板' })
    trigger.focus()
    fireEvent.click(trigger)
    const panel = screen.getByRole('dialog', { name: '困惑详情' })
    fireEvent.click(within(panel).getByRole('button', { name: '修改' }))
    const input = within(panel).getByRole('textbox', { name: '修改状态' })
    input.focus()
    fireEvent.change(input, { target: { value: '逐字修改时应保留焦点' } })
    expect(document.activeElement).toBe(input)
    f.update({ connected: false })
    rerender(<RoleplayerView {...f.props} />)
    expect(document.activeElement).toBe(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '困惑详情' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('keeps mobile-sidebar search focused during edits and restores the opening button on Escape', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body)
    const f = fixture()
    render(<RoleplayerView {...f.props} />)
    const trigger = screen.getByRole<HTMLButtonElement>('button', { name: '打开困惑列表' })
    trigger.focus()
    fireEvent.click(trigger)
    const sidebar = screen.getByRole('dialog', { name: '困惑列表' })
    const input = within(sidebar).getByRole('searchbox', { name: '搜索困惑' })
    input.focus()
    fireEvent.change(input, { target: { value: '论文' } })
    expect(document.activeElement).toBe(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '困惑列表' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('opens the evidence tab from an unchanged claim range and keeps evidence actions real', async () => {
    const f = fixture()
    const { container } = render(<RoleplayerView {...f.props} />)
    const claim = screen.getByRole<HTMLButtonElement>('button', { name: '查看原话依据：evidence:one' })
    expect(claim.getAttribute('data-claim-start')).toBe('0')
    expect(claim.getAttribute('data-claim-end')).toBe('7')
    expect(claim.getAttribute('data-claim-status')).toBe('accepted')
    const original = container.querySelector('[data-roleplayer-kind="persona-message"]')?.textContent
    fireEvent.click(claim)
    expect(screen.getByRole('tab', { name: '资料依据' }).getAttribute('aria-selected')).toBe('true')
    const evidence = screen.getByText('传习录').closest('details')
    expect(document.activeElement).toBe(evidence)
    expect(screen.getByText('资料原文')).toBeTruthy()
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '质疑' }))
    await waitFor(() => { expect(f.details.challengeEvidence).toHaveBeenCalledWith('evidence:one') })
    expect(container.querySelector('[data-roleplayer-kind="persona-message"]')?.textContent).toBe(original)
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '证据详情' }))
    expect(screen.getByRole('dialog', { name: '证据详情' })).toBeTruthy()
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps stale claim text and shows the withdrawn source without offering it as available', () => {
    const f = fixture({ ...base, evidence: (base.evidence ?? []).map(item => ({ ...item, status: 'withdrawn' })), timeline: base.timeline.map(item => item.claims === undefined ? item : ({ ...item, claims: item.claims.map(claim => ({ ...claim, status: 'stale' })) })) })
    const { container } = render(<RoleplayerView {...f.props} />)
    const claim = screen.getByRole<HTMLButtonElement>('button', { name: /查看原话依据/ })
    expect(claim.getAttribute('data-claim-text-range')).toBe('0:7')
    expect(claim.getAttribute('data-claim-status')).toBe('stale')
    fireEvent.click(claim)
    expect(screen.getByText('已撤回').closest('summary')).toBeTruthy()
    expect(container.querySelector('[data-claim-range="0:7"]')?.textContent).toContain('知行本来合一。')
    expect(screen.queryByRole('button', { name: '质疑' })).toBeNull()
  })

  it('replies only to a completed answer by the current persona and submits its stable id', async () => {
    const f = fixture()
    render(<RoleplayerView {...f.props} />)
    expect((screen.getByRole<HTMLButtonElement>('button', { name: '回复庄子的回答' })).disabled).toBe(true)
    expect(screen.getAllByRole('button', { name: '回复王阳明的回答' })).toHaveLength(1)
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '回复王阳明的回答' }))
    expect(screen.getByText('回复 王阳明')).toBeTruthy()
    fireEvent.change(screen.getByRole<HTMLTextAreaElement>('textbox', { name: '输入困惑' }), { target: { value: '那我可以先做什么？' } })
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: /发送/ }))
    await waitFor(() => { expect(f.submit).toHaveBeenCalledWith('那我可以先做什么？', 'turn:wang') })
    await waitFor(() => { expect((screen.getByRole<HTMLTextAreaElement>('textbox', { name: '输入困惑' })).value).toBe('') })
    expect(screen.queryByRole('button', { name: '取消引用回复' })).toBeNull()
  })

  it('preserves failed-send drafts and drops the reply when switching personas', async () => {
    const f = fixture()
    f.submit.mockResolvedValue(false)
    const { rerender } = render(<RoleplayerView {...f.props} />)
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '回复王阳明的回答' }))
    fireEvent.change(screen.getByRole<HTMLTextAreaElement>('textbox', { name: '输入困惑' }), { target: { value: '我的草稿' } })
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: /发送/ }))
    await waitFor(() => { expect(f.submit).toHaveBeenCalledOnce() })
    expect((screen.getByRole<HTMLTextAreaElement>('textbox', { name: '输入困惑' })).value).toBe('我的草稿')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '取消引用回复' })).toBeTruthy()
    fireEvent.click(within(screen.getByRole('group', { name: '选择人物' })).getByRole('button', { name: '庄子' }))
    f.project({ ...base, activePersona: 'zhuangzi' })
    rerender(<RoleplayerView {...f.props} />)
    expect(screen.queryByRole('button', { name: '取消引用回复' })).toBeNull()
    expect((screen.getByRole<HTMLTextAreaElement>('textbox', { name: '输入困惑' })).value).toBe('我的草稿')
  })

  it('preserves separate drafts by dilemma while searching and collapsing panels', () => {
    const f = fixture()
    const other = { ...base, handle: 'dilemma:other' as DilemmaHandle, title: '另一份困惑' }
    const archived = { ...base, handle: 'dilemma:archive' as DilemmaHandle, title: '归档的事情', archived: true }
    f.update({ dilemmas: [base, other, archived] })
    const { rerender } = render(<RoleplayerView {...f.props} />)
    fireEvent.change(screen.getByRole<HTMLTextAreaElement>('textbox', { name: '输入困惑' }), { target: { value: '第一份草稿' } })
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '收起困惑列表' }))
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '收起详情面板' }))
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '展开困惑列表' }))
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '展开详情面板' }))
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '另一份困惑' }))
    rerender(<RoleplayerView {...f.props} />)
    expect((screen.getByRole<HTMLTextAreaElement>('textbox', { name: '输入困惑' })).value).toBe('')
    fireEvent.change(screen.getByRole<HTMLTextAreaElement>('textbox', { name: '输入困惑' }), { target: { value: '第二份草稿' } })
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '论文与求职' }))
    rerender(<RoleplayerView {...f.props} />)
    expect((screen.getByRole<HTMLTextAreaElement>('textbox', { name: '输入困惑' })).value).toBe('第一份草稿')
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索困惑' }), { target: { value: '归档' } })
    const nav = screen.getByRole('navigation', { name: '困惑列表' })
    expect(within(nav).queryByRole('button', { name: '论文与求职' })).toBeNull()
    expect(within(nav).getByRole('button', { name: '归档的事情' })).toBeTruthy()
  })

  it('locks persona switching during a pending or unknown cancellation and retains recovery controls', () => {
    const f = fixture()
    f.update({ pending: { handle, persona: 'wang-yangming', messageId: 'message:live' as never, deliveryOperationId: 'delivery:live' as never, turnOperationId: 'turn:live' as never, executionState: 'unknown' } })
    render(<RoleplayerView {...f.props} />)
    for (const button of within(screen.getByRole('group', { name: '选择人物' })).getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole<HTMLButtonElement>('button', { name: /邀请人物/ })).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: '停止并切换' })).toBeNull()
    expect(screen.getByText('正在确认停止')).toBeTruthy()
    expect((screen.getByRole<HTMLButtonElement>('button', { name: '取消' })).disabled).toBe(true)
    expect(screen.getByText('正在核对当前回答是否已停止')).toBeTruthy()
  })

  it('keeps deck browsing separate from a failed single-person create', async () => {
    const f = fixture()
    f.create.mockResolvedValue(false)
    render(<RoleplayerView {...f.props} />)
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: /新建困惑/ }))
    expect(f.create).not.toHaveBeenCalled()
    expect(f.switchPersona).not.toHaveBeenCalled()
    const choose = screen.getByRole<HTMLButtonElement>('button', { name: /选择苏轼/ })
    fireEvent.click(choose)
    expect(f.create).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '开始这份困惑' }))
    await waitFor(() => { expect(f.create).toHaveBeenCalledWith(['su-shi']) })
    expect(await screen.findByText(/操作未成功，请检查连接后重试/)).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('exposes all real roster options for invitations and switches only after confirmation', async () => {
    const f = fixture()
    render(<RoleplayerView {...f.props} />)
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: /邀请人物/ }))
    for (const persona of personas) expect(screen.getAllByText(persona.displayName).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '邀请曾国藩' }))
    expect(f.switchPersona).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '邀请曾国藩入座' }))
    await waitFor(() => { expect(f.switchPersona).toHaveBeenCalledWith('zeng-guofan') })
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull() })
  })

  it.each(['paused', 'stage_ended'] as const)('offers a real resume action for %s and preserves the composer draft', async (status) => {
    const f = fixture()
    const { rerender } = render(<RoleplayerView {...f.props} />)
    fireEvent.change(screen.getByRole<HTMLTextAreaElement>('textbox', { name: '输入困惑' }), { target: { value: '暂停前的草稿' } })
    f.project({ ...base, discussionStatus: status })
    rerender(<RoleplayerView {...f.props} />)
    expect((screen.getByRole<HTMLButtonElement>('button', { name: /发送/ })).disabled).toBe(true)
    fireEvent.click(screen.getAllByRole('button', { name: '继续讨论' })[0]!)
    await waitFor(() => { expect(f.details.resume).toHaveBeenCalledOnce() })
    expect((screen.getByRole<HTMLTextAreaElement>('textbox', { name: '输入困惑' })).value).toBe('暂停前的草稿')
  })

  it('keeps archived content read-only and provides real restore and deletion checkpoint retry', async () => {
    const f = fixture({ ...base, archived: true })
    const { rerender } = render(<RoleplayerView {...f.props} />)
    expect(screen.queryByRole('textbox', { name: '输入困惑' })).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: '恢复困惑' })[0]!)
    await waitFor(() => { expect(f.details.restore).toHaveBeenCalledOnce() })
    f.project({ ...base, deletion: { operationId: 'delete:checkpoint' as never, stage: 'delete-branch', retryable: true, irreversible: true } })
    rerender(<RoleplayerView {...f.props} />)
    expect(screen.getByText('删除阶段：delete-branch（不可逆）')).toBeTruthy()
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '重试未完成步骤' }))
    expect(f.details.delete).toHaveBeenCalledWith('delete:checkpoint')
  })

  it('reports actual state write success or failure without locally confirming a candidate', async () => {
    const f = fixture()
    render(<RoleplayerView {...f.props} />)
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '确认' }))
    expect(await screen.findByText('已确认信息')).toBeTruthy()
    expect(f.details.confirmState).toHaveBeenCalledWith('state:one')
    expect(screen.getByText('待你确认')).toBeTruthy()
    f.details.rejectState.mockResolvedValue(false)
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '拒绝' }))
    expect(await screen.findByText('操作未成功，请重试。原记录已保留。')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '撤销' })).toBeNull()
  })

  it('keeps IME Enter and Shift+Enter as editing gestures and renders persisted reply context', async () => {
    const f = fixture({ ...base, timeline: [...base.timeline, { id: 'user:reply', kind: 'user-message', status: 'completed', text: '后续的问题', replyToTimelineEventId: 'turn:wang' }] })
    render(<RoleplayerView {...f.props} />)
    expect(screen.getByText('回复 王阳明')).toBeTruthy()
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', { name: '输入困惑' })
    fireEvent.change(composer, { target: { value: '正在输入' } })
    fireEvent.keyDown(composer, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(composer, { key: 'Enter', keyCode: 229 })
    fireEvent.keyDown(composer, { key: 'Enter', shiftKey: true })
    expect(f.submit).not.toHaveBeenCalled()
    fireEvent.keyDown(composer, { key: 'Enter' })
    await act(async () => { await Promise.resolve() })
    expect(f.submit).toHaveBeenCalledWith('正在输入', undefined)
  })
})
