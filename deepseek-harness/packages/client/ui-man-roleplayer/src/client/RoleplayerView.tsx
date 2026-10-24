/** Product root over the single roleplayer projection store. */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactElement, RefObject } from 'react'
import css from './RoleplayerView.module.css'
import { Button, Input, Pill, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { DilemmaMenu } from './DilemmaMenu.tsx'
import type { InjectFace, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ManRoleplayerOperationId, PersonaId, RoleplayerChoiceAnswer, RoleplayerChoiceQuestion, RoleplayerProjection, RoleplayerTimelineItem } from '@deepseek-ai/dsh-man-roleplayer/types'
import type { RoleplayerProjectionStore } from './store.ts'
import { getPersonaPresentation } from './persona-presentation.ts'

interface RoleplayerViewInjected {
  hooks: { roleplayer: RoleplayerProjectionStore }
  store: RoleplayerProjectionStore
}

type RoleplayerViewProps = PropsRuntime<'root'> & PropsRenderSlots<'manRoleplayer.personaDeck'> & InjectFace<RoleplayerViewInjected>

type Activity = NonNullable<RoleplayerProjection['activity']>[number]
function evidenceTypeLabel(kind: string | undefined): string {
  const labels: Record<string, string> = {
    'authorial-text': '本人著述', 'disciple-record': '弟子记录', 'historical-account': '史料记载',
    'textual-parable': '寓言文本', 'quoted-other-speaker': '转引他人话语', 'later-evaluation': '后世评价',
    'variant-reading': '版本异文', 'contested-attribution': '归属存疑', 'modern-interpretation': '现代解读',
    quote: '引文', 'historical-fact': '历史事实', attribution: '归属说明',
  }
  return kind === undefined ? '资料' : labels[kind] ?? '其他资料'
}

function reasoningSummary(text: string, running: boolean): string {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '')
  return running ? lines.at(-1) ?? '' : lines[0] ?? ''
}

export function ActivityDetails({ activity, now, connected = true }: {
  readonly activity: Activity
  readonly now: number
  readonly connected?: boolean
}) {
  const duration = activity.durationMs ?? (activity.endedAt === undefined ? Math.max(0, now - activity.startedAt) : 0)
  const running = activity.endedAt === undefined
  const phases = [...(activity.stages ?? [{
    phase: activity.phase,
    startedAt: activity.startedAt,
    ...(activity.endedAt === undefined ? {} : { endedAt: activity.endedAt }),
    ...(activity.durationMs === undefined ? {} : { durationMs: activity.durationMs }),
    ...(activity.count === undefined ? {} : { count: activity.count }),
  } as const])]
  const labels = new Map<string, string>([
    ['received', '已接收问题'], ['thinking', '正在思考/组织回答'], ['researching', '查阅资料'],
    ['evidence-check', '核对回答依据'], ['finalizing', '正在整理正式回答'], ['completed', '回答结束'],
    ['failed', '未形成可用回答'], ['cancelled', '回答已取消'],
  ])
  const unique = [...new Map(phases.map(stage => [stage.phase, stage])).values()]
  const researchCount = phases.reduce((maximum, stage) => Math.max(maximum, stage.phase === 'researching' ? stage.count ?? 0 : 0), 0)
  const reasoning = activity.reasoning
  const reasoningLabel = reasoning === undefined
    ? undefined
    : reasoning.status === 'failed' ? '思考过程 · 未完成'
      : reasoning.status === 'cancelled' ? '思考过程 · 已取消' : '思考过程'
  const summary = running && !connected
    ? '本轮过程 · 连接已中断，正在核对回答状态'
    : running
      ? `本轮过程 · 思考中 · 已用时 ${Math.max(1, Math.round(duration / 1000))} 秒`
      : `本轮过程 · 用时 ${Math.round(duration / 1000)} 秒${researchCount === 0 ? '' : ` · 查阅 ${researchCount} 条资料`}`
  return <details className={css.activity} open={running}>
    <summary>{summary}</summary>
    {unique.map((stage, index) => <p key={`${activity.id}-stage-${index}`}>{labels.get(stage.phase) ?? stage.phase}</p>)}
    {reasoning === undefined ? null : <details className={css.reasoning}>
      <summary><span>{reasoningLabel}</span><span className={css.reasoningSummary}>
        {reasoningSummary(reasoning.text, reasoning.status === 'running')}
      </span></summary>
      <div>{reasoning.text}</div>
    </details>}
  </details>
}

function useModalFocusTrap(ref: RefObject<HTMLElement>, open: boolean, onEscape: () => void): void {
  const escapeRef = useRef(onEscape)
  escapeRef.current = onEscape
  useEffect(() => {
    if (!open) return
    const dialog = ref.current
    if (dialog === null) return
    const focusable = (): HTMLElement[] => [
      ...dialog.querySelectorAll<HTMLElement>('button, input, textarea, select, [href], [tabindex]:not([tabindex="-1"])'),
    ].filter(element => !element.hasAttribute('disabled')
      && element.getAttribute('aria-disabled') !== 'true'
      && element.getAttribute('hidden') === null
      && element.offsetParent !== null)
    const initialFocus = requestAnimationFrame(() => { (focusable()[0] ?? dialog).focus() })
    const isTopmost = (): boolean => {
      const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')]
      return dialogs[dialogs.length - 1] === dialog
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!isTopmost()) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); escapeRef.current(); return }
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (elements.length === 0) { event.preventDefault(); dialog.focus(); return }
      const first = elements[0]
      const last = elements.at(-1)
      if (first === undefined || last === undefined) return
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => { cancelAnimationFrame(initialFocus); window.removeEventListener('keydown', onKeyDown, true) }
  }, [open, ref])
}

function AcceptedText({ item, onEvidence }: {
  readonly item: RoleplayerTimelineItem
  readonly onEvidence: (ids: readonly string[], trigger: HTMLButtonElement) => void
}) {
  const text = item.text ?? ''
  const claims = [...(item.claims ?? [])]
    .filter(claim => claim.start >= 0 && claim.end > claim.start && claim.end <= text.length)
    .sort((a, b) => a.start - b.start)
  if (claims.length === 0) return <>{text}</>
  const parts: ReactElement[] = []; let cursor = 0
  for (const [index, claim] of claims.entries()) {
    if (claim.start < cursor) continue
    const claimAttributes = { 'data-claim-start': String(claim.start), 'data-claim-end': String(claim.end), 'data-claim-text-range': `${claim.start}:${claim.end}` }
    const evidenceLabel = claim.kind === 'reliable-quote' ? '查看原话依据' : claim.kind === 'historical-fact' ? '查看史实依据' : '查看资料依据'
    parts.push(<span key={`text-${index}`} data-claim-range={`${claim.start}:${claim.end}`}>{text.slice(cursor, claim.end)}{claim.evidenceIds[0] === undefined
      ? claim.kind === 'insufficient-evidence' ? <span className={css.claimNote} {...claimAttributes}>资料不足</span> : null
      : <button className={css.claim} type="button" {...claimAttributes} data-claim-status={claim.status} aria-label={`${evidenceLabel}：${claim.evidenceIds.join(', ')}`} onClick={(event) => { onEvidence(claim.evidenceIds, event.currentTarget) }}>{evidenceLabel}</button>}</span>)
    cursor = claim.end
  }
  parts.push(<span key="text-rest">{text.slice(cursor)}</span>)
  return <>{parts}</>
}

/** Render the one store's sidebar/conversation/details projection in a view tab. */
export function RoleplayerView({ useRoleplayer, store, renderSlot }: RoleplayerViewProps) {
  useLayoutEffect(() => {
    // This product replaces the generic layout presenter with the approved light reading surface.
    const previousDark = document.body.hasAttribute('data-ds-dark-theme')
    const previousScheme = document.documentElement.style.colorScheme
    document.body.removeAttribute('data-ds-dark-theme')
    document.documentElement.style.colorScheme = 'light'
    return () => {
      document.body.toggleAttribute('data-ds-dark-theme', previousDark)
      document.documentElement.style.colorScheme = previousScheme
    }
  }, [])
  const [draftByHandle, setDraftByHandle] = useState<Record<string, string>>({})
  const [titleDraft, setTitleDraft] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [stateDraft, setStateDraft] = useState<Record<string, string>>({})
  const [editingStateId, setEditingStateId] = useState<string>()
  const [sidebarMenuHandle, setSidebarMenuHandle] = useState<string>()
  const [choiceDraft, setChoiceDraft] = useState<Record<string, { selected: string[]; custom: string; mode?: 'options' | 'custom' }>>({})
  const [choiceExpanded, setChoiceExpanded] = useState<Record<string, boolean>>({})
  const [choiceSubmitting, setChoiceSubmitting] = useState<string>()
  const [choiceError, setChoiceError] = useState<string>()
  const choiceSubmission = useRef<string>()
  const [deleteOperation, setDeleteOperation] = useState<Parameters<ReturnType<RoleplayerProjectionStore['details']>['delete']>[0]>()
  const [evidenceIds, setEvidenceIds] = useState<readonly string[]>()
  const [deckMode, setDeckMode] = useState<'new' | 'invite'>()
  const [deckBusy, setDeckBusy] = useState(false)
  const deckSubmission = useRef(false)
  const [deckError, setDeckError] = useState<string>()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarMobile, setSidebarMobile] = useState(false)
  const [search, setSearch] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [detailsTab, setDetailsTab] = useState<'state' | 'perspective' | 'evidence'>('state')
  const [highlightedEvidence, setHighlightedEvidence] = useState<readonly string[]>([])
  const evidenceNodes = useRef(new Map<string, HTMLDetailsElement>())
  const [reply, setReply] = useState<{ id: string; persona: PersonaId; text: string; handle: string }>()
  const [feedback, setFeedback] = useState<string>()
  const [mobileDetails, setMobileDetails] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const newTrigger = useRef<HTMLButtonElement | null>(null)
  const mobileDetailsTrigger = useRef<HTMLButtonElement | null>(null)
  const mobileSidebarTrigger = useRef<HTMLButtonElement | null>(null)
  const deleteTrigger = useRef<HTMLButtonElement | null>(null)
  const evidenceTrigger = useRef<HTMLButtonElement | null>(null)
  const evidenceDialog = useRef<HTMLDivElement>(null)
  const mobileAsideRef = useRef<HTMLElement>(null)
  const mobileSidebarRef = useRef<HTMLElement>(null)
  const deleteDialogRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const closeMobileSidebar = (): void => { setSidebarMobile(false); if (sidebarMobile) mobileSidebarTrigger.current?.focus() }
  useModalFocusTrap(mobileAsideRef, mobileDetails, () => { setMobileDetails(false); mobileDetailsTrigger.current?.focus() })
  useModalFocusTrap(mobileSidebarRef, sidebarMobile, closeMobileSidebar)
  useModalFocusTrap(evidenceDialog, evidenceIds !== undefined, () => { setEvidenceIds(undefined); evidenceTrigger.current?.focus() })
  useModalFocusTrap(deleteDialogRef, deleteOperation !== undefined, () => { setDeleteOperation(undefined); deleteTrigger.current?.focus() })
  useEffect(() => {
    const close = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (deleteOperation !== undefined) { setDeleteOperation(undefined); deleteTrigger.current?.focus() }
      else if (mobileDetails) { setMobileDetails(false); mobileDetailsTrigger.current?.focus() }
    }
    window.addEventListener('keydown', close)
    return () => { window.removeEventListener('keydown', close) }
  }, [deleteOperation, mobileDetails])
  const view = useRoleplayer(snapshot => snapshot)
  const connected = view.connected !== false
  const syncFailed = view.status === 'error'
  const online = connected && view.status === 'ready'
  const personaName = (persona: PersonaId): string => view.personas.find(item => item.id === persona)?.displayName ?? persona
  const selected = view.dilemmas.find(item => item.handle === view.selected)
  useEffect(() => {
    setReply(undefined); setEditingTitle(false); setEditingStateId(undefined)
  }, [selected?.handle, selected?.activePersona])
  const sidebar = store.sidebar()
  const matchesSearch = (item: RoleplayerProjection): boolean => (item.title ?? '未命名困惑').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  const activeItems = sidebar.items.filter(matchesSearch)
  const archivedItems = sidebar.archivedItems.filter(matchesSearch)
  const conversation = store.conversation()
  const details = store.details()
  const pending = view.pending
  const stopping = pending?.executionState === 'stopping' || pending?.executionState === 'stop-failed' || pending?.executionState === 'unknown'
  const draft = selected === undefined ? '' : draftByHandle[String(selected.handle)] ?? ''
  const discussionStatus = selected?.discussionStatus ?? 'in_progress'
  const readOnly = selected?.archived === true || selected?.deletion !== undefined
  const stateItems = selected?.state?.sharedStateItems ?? []
  const pendingStateItems = stateItems.filter(item => item.status === 'candidate')
  const confirmedStateItems = stateItems.filter(item => item.status === 'confirmed')
  const historicalStateItems = stateItems.filter(item => item.status !== 'candidate' && item.status !== 'confirmed')
  const activeChoice = selected?.choice?.status === 'pending' ? selected.choice : undefined
  const waitingForChoice = activeChoice !== undefined || selected?.activeTurn?.status === 'waiting-choice'
  const hasRunningActivity = !waitingForChoice && (selected?.activity?.some(item => item.endedAt === undefined) ?? false)
  useEffect(() => {
    if (!hasRunningActivity || !online) return
    const timer = setInterval(() => { setNow(Date.now()) }, 1000)
    return () => { clearInterval(timer) }
  }, [selected?.handle, hasRunningActivity, online])
  const activeQuestions = activeChoice?.questions
  const choiceOperationId = activeChoice?.operationId
  // Keep drafts for every choice that remains pending in the Host projection,
  // including while the user views another dilemma. Operation ids prevent one
  // choice from ever reusing another choice's answers.
  const pendingChoicePrefixKey = JSON.stringify(view.dilemmas
    .flatMap(item => item.choice?.status === 'pending' ? [`${item.choice.operationId}:`] : [])
    .sort())
  useEffect(() => {
    const prefixes = JSON.parse(pendingChoicePrefixKey) as string[]
    const belongsToPendingChoice = (key: string): boolean => prefixes.some(prefix => key.startsWith(prefix))
    setChoiceDraft(previous => Object.fromEntries(
      Object.entries(previous).filter(([key]) => belongsToPendingChoice(key)),
    ))
    setChoiceExpanded(previous => Object.fromEntries(
      Object.entries(previous).filter(([key]) => belongsToPendingChoice(key)),
    ))
  }, [pendingChoicePrefixKey])
  useEffect(() => {
    setChoiceError(undefined)
    setChoiceSubmitting(undefined)
    choiceSubmission.current = undefined
  }, [choiceOperationId])
  const failedUser = selected?.timeline.findLast(item => item.kind === 'user-message' && item.status === 'failed')
  const latestTurn = selected?.timeline.findLast(item => item.kind === 'system-status' && item.operationId !== undefined)
  const failedTurn = latestTurn?.status === 'failed' ? latestTurn : undefined
  const errorLabel = details.error === null ? undefined : '操作暂时失败，请重试'
  if (view.status === 'error' && view.dilemmas.length === 0) {
    return <section data-roleplayer-unavailable="true" aria-label="困惑产品暂不可用"><p>困惑产品暂不可用，请稍后重试</p><Button variant="ghost" size="sm" type="button" disabled={!connected} onClick={() => { void details.retry() }}>重新连接</Button></section>
  }
  const submit = async (): Promise<void> => {
    if (!online || pending !== undefined || discussionStatus !== 'in_progress' || activeChoice !== undefined || readOnly || draft.trim() === '') return
    const replyId = reply !== undefined && reply.handle === selected?.handle && reply.persona === selected.activePersona
      && selected.timeline.some(item => item.id === reply.id && item.kind === 'persona-message' && item.status === 'completed' && item.persona === selected.activePersona)
      ? reply.id : undefined
    if (await conversation.submit(draft, replyId)) {
      setDraftByHandle(current => ({ ...current, [String(selected?.handle)]: current[String(selected?.handle)] === draft ? '' : current[String(selected?.handle)] ?? '' }))
      setReply(undefined)
    }
  }
  const openEvidence = (ids: readonly string[], trigger: HTMLButtonElement): void => {
    evidenceTrigger.current = trigger
    setHighlightedEvidence(ids)
    setDetailsTab('evidence')
    setDetailsOpen(true)
    setMobileDetails(window.matchMedia('(max-width: 1000px)').matches)
    requestAnimationFrame(() => {
      const target = ids[0] === undefined ? undefined : evidenceNodes.current.get(ids[0])
      target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      target?.focus()
    })
  }
  const confirmPersona = async (persona: PersonaId): Promise<void> => {
    if (deckSubmission.current || !online || deckMode === undefined || deckMode === 'invite' && (pending !== undefined || readOnly || selected === undefined)) return
    deckSubmission.current = true
    setDeckBusy(true)
    setDeckError(undefined)
    try {
      const ok = deckMode === 'new' ? await sidebar.create([persona]) : await conversation.switchPersona(persona)
      if (ok) {
        setDeckMode(undefined)
        setReply(undefined)
        requestAnimationFrame(() => composerRef.current?.focus())
      } else setDeckError('操作未成功，请检查连接后重试。已选择的人物会保留。')
    } finally { deckSubmission.current = false; setDeckBusy(false) }
  }
  const stateAction = async (action: Promise<boolean>, label: string): Promise<boolean> => {
    const ok = await action
    setFeedback(ok ? label : '操作未成功，请重试。原记录已保留。')
    return ok
  }
  const answerForQuestion = (question: RoleplayerChoiceQuestion, operationId: string): RoleplayerChoiceAnswer => {
    const current = choiceDraft[`${operationId}:${question.id}`] ?? { selected: [], custom: '' }
    const custom = current.custom.trim()
    return {
      id: question.id,
      selected: [...current.selected],
      ...(custom === '' || question.multiSelect !== true && current.mode !== 'custom' ? {} : { custom }),
    }
  }
  const answerChoice = async (skip: boolean): Promise<void> => {
    if (!online || activeChoice === undefined || activeQuestions === undefined
      || choiceSubmission.current === activeChoice.operationId) return
    const operationId = activeChoice.operationId
    const answers: RoleplayerChoiceAnswer[] = activeQuestions.map((question) => {
      return skip ? { id: question.id, selected: [], skipped: true } : answerForQuestion(question, operationId)
    })
    if (!skip && answers.some(answer => answer.selected.length === 0 && answer.custom === undefined)) {
      setChoiceError('请为每个问题选择至少一个选项，或填写其他考虑；也可以选择“跳过此问”。')
      return
    }
    choiceSubmission.current = operationId
    setChoiceSubmitting(operationId)
    setChoiceError(undefined)
    const succeeded = await details.answerChoice(operationId as ManRoleplayerOperationId, answers)
    if (choiceSubmission.current === operationId) {
      choiceSubmission.current = undefined
      setChoiceSubmitting(undefined)
      if (!succeeded) setChoiceError(details.error?.includes('choice answer is invalid') === true
        ? '单选题的选项与其他考虑需要二选一，请调整答案后重试。'
        : '提交未成功，请检查连接后重试。')
    }
  }
  return (
    <section className={`${css.roleplayer} ${sidebarCollapsed ? css.sidebarCollapsed : ''} ${!detailsOpen ? css.detailsCollapsed : ''} ${sidebarMobile ? css.mobileSidebarOpen : ''}`} data-roleplayer-view="true" aria-label="向古人问惑">
      <nav ref={mobileSidebarRef} className={css.sidebarLeft} aria-label="困惑列表" role={sidebarMobile ? 'dialog' : undefined} aria-modal={sidebarMobile ? true : undefined}>
        <div className={css.brandRow}><span className={css.brandMark}>惑</span><strong>向古人问惑</strong>
          <Button variant="ghost" size="sm" type="button" aria-label={sidebarCollapsed ? '展开困惑列表' : '收起困惑列表'} onClick={(event) => { if (window.matchMedia('(max-width: 1000px)').matches) { if (sidebarMobile) closeMobileSidebar(); else { mobileSidebarTrigger.current = event.currentTarget; setSidebarMobile(true) } } else setSidebarCollapsed(!sidebarCollapsed) }}>☰</Button>
        </div>
        <div className={css.sidebarActions}>
          <Button variant="primary" className={css.primaryButton} type="button" onClick={(event) => { newTrigger.current = event.currentTarget; setDeckError(undefined); setDeckMode('new') }}><span aria-hidden="true">＋</span> 新建困惑</Button>
        </div>
        <label className={css.searchField}><span>搜索困惑</span><Input type="search" aria-label="搜索困惑" placeholder="搜索困惑…" value={search} onChange={(event) => { setSearch(event.target.value) }} /></label>
        <div className={css.sidebarList}>
          <h3 className={css.groupLabel}>进行中 <span>{sidebar.items.length}</span></h3>
          {activeItems.length === 0 ? <p className={css.emptyHint}>还没有进行中的困惑</p> : activeItems.map(item => <div className={`${css.dilemmaRow} ${item.handle === view.selected ? css.selectedItem : ''}`} key={item.handle}>
            <button className={css.dilemmaItem} type="button" onClick={() => { store.select(item.handle); setSidebarMenuHandle(undefined); closeMobileSidebar() }}><span className={css.itemTitle}>{item.title ?? '未命名困惑'}</span><span className={css.itemMeta} aria-hidden="true">{item.choice?.status === 'pending' || item.activeTurn?.status === 'waiting-choice' ? '等待你选择' : '继续思考'} <span aria-hidden="true">›</span></span></button>
            <DilemmaMenu open={sidebarMenuHandle === String(item.handle)} archived={false} disabled={!online}
              onOpen={(trigger) => {
                deleteTrigger.current = trigger; store.select(item.handle); setSidebarMenuHandle(String(item.handle))
              }}
              onClose={() => { setSidebarMenuHandle(undefined) }} onSelect={(action) => {
                setSidebarMenuHandle(undefined)
                if (action === 'rename') { setTitleDraft(item.title ?? ''); setEditingTitle(true) }
                else if (action === 'archive') void details.archive()
                else if (action === 'restore') void details.restore()
                else setDeleteOperation(`delete:${crypto.randomUUID()}` as Parameters<typeof details.delete>[0])
              }} />
          </div>)}
          <h3 className={css.groupLabel}>已归档 <span>{sidebar.archivedItems.length}</span></h3>
          {archivedItems.length === 0 ? <p className={css.emptyHint}>归档的困惑会出现在这里</p> : archivedItems.map(item => <div className={`${css.dilemmaRow} ${item.handle === view.selected ? css.selectedItem : ''}`} key={item.handle}>
            <button className={css.dilemmaItem} type="button" onClick={() => { store.select(item.handle); setSidebarMenuHandle(undefined); closeMobileSidebar() }}><span className={css.itemTitle}>{item.title ?? '未命名困惑'}</span><span className={css.itemMeta} aria-hidden="true">已归档 <span aria-hidden="true">›</span></span></button>
            <DilemmaMenu open={sidebarMenuHandle === String(item.handle)} archived={true} disabled={!online}
              onOpen={(trigger) => {
                deleteTrigger.current = trigger; store.select(item.handle); setSidebarMenuHandle(String(item.handle))
              }}
              onClose={() => { setSidebarMenuHandle(undefined) }} onSelect={(action) => {
                setSidebarMenuHandle(undefined)
                if (action === 'rename') { setTitleDraft(item.title ?? ''); setEditingTitle(true) }
                else if (action === 'archive') void details.archive()
                else if (action === 'restore') void details.restore()
                else setDeleteOperation(`delete:${crypto.randomUUID()}` as Parameters<typeof details.delete>[0])
              }} />
          </div>)}
        </div>
        <p className={css.sidebarFootnote}>一份困惑，多一种看法</p>
      </nav>
      <main className={css.mainConversation}>
        <header className={css.conversationHeader}>
          <Button variant="ghost" size="sm" type="button" className={css.mobileNav} aria-label="打开困惑列表" onClick={(event) => { mobileSidebarTrigger.current = event.currentTarget; setSidebarMobile(true) }}>☰</Button>
          <div className={css.conversationTitle}>
            {editingTitle && selected !== undefined
              ? <Input aria-label="困惑标题" value={titleDraft} onChange={(event) => { setTitleDraft(event.target.value) }} />
              : <h1>{selected?.title ?? '向古人问惑'}</h1>}
            {selected === undefined || readOnly ? null : editingTitle
              ? <>
                <Button variant="primary" size="sm" type="button" disabled={!online} onClick={() => { void details.rename(titleDraft).then((success) => { if (success) setEditingTitle(false) }) }}>保存标题</Button>
                <Button variant="ghost" size="sm" type="button" onClick={() => { setEditingTitle(false) }}>取消重命名</Button>
              </>
              : <Button variant="ghost" size="sm" type="button" onClick={() => { setTitleDraft(selected.title ?? ''); setEditingTitle(true) }}>重命名</Button>}
          </div>
          <span className={css.headerStatus} role="status"><StateDot state={syncFailed ? 'error' : !connected || waitingForChoice || stopping ? 'warning' : !online || pending !== undefined ? 'ongoing' : 'done'} />{!connected ? '连接已中断 · 正在重连' : syncFailed ? '同步失败 · 请重试' : !online ? '正在同步' : selected?.archived ? '已归档' : waitingForChoice ? '等待你选择' : pending !== undefined ? stopping ? '正在确认停止' : '正在回答' : '就绪'}</span>
          <button ref={mobileDetailsTrigger} type="button" aria-label={detailsOpen ? '收起详情面板' : '展开详情面板'} aria-expanded={detailsOpen} onClick={() => { if (window.matchMedia('(max-width: 1000px)').matches) { setMobileDetails(!mobileDetails); setDetailsOpen(true) } else { setDetailsOpen(!detailsOpen); setMobileDetails(false) } }}>◫</button>
        </header>
        {selected === undefined ? null : <div className={css.personaBar} data-roleplayer-persona={selected.activePersona}>
          <span className={css.personaCaption}>与谁对谈</span>
          <div className={css.personaSwitch} role="group" aria-label="选择人物">
            {selected.branches.map(branch => <button key={branch.persona} className={selected.activePersona === branch.persona ? css.personaActive : ''}
              type="button" aria-pressed={selected.activePersona === branch.persona} disabled={!online || pending !== undefined || readOnly}
              onClick={() => { setReply(undefined); void conversation.switchPersona(branch.persona) }}><img className={css.avatarMini} alt="" src={getPersonaPresentation(branch.persona).portrait} />{personaName(branch.persona)}</button>)}
          </div>
          <Button variant="outline" className={css.inviteButton} type="button" disabled={!online || pending !== undefined || readOnly || selected.branches.length === view.personas.length}
            onClick={() => { setDeckError(undefined); setDeckMode('invite') }}>＋ 邀请人物</Button>
        </div>}
        {selected === undefined || discussionStatus === 'in_progress' && !readOnly ? null : <div className={css.recoveryBanner} role="status">
          <span>{selected.deletion !== undefined ? '删除正在处理中，请在详情中查看进度。' : selected.archived ? '这份困惑已归档，恢复后可以继续对谈。' : discussionStatus === 'paused' ? '讨论已暂停，未发送内容已保留。' : '本阶段已结束，可以继续讨论。'}</span>
          {selected.deletion !== undefined ? null : <Button variant="ghost" size="sm" type="button" disabled={!online} onClick={() => { void (selected.archived ? details.restore() : details.resume()) }}>{selected.archived ? '恢复困惑' : '继续讨论'}</Button>}
        </div>}
        <div className={css.timeline} data-roleplayer-timeline="true" aria-live="polite">
          {selected === undefined ? <div className={css.emptyConversation}>
            <div className={css.emptyIcon} aria-hidden="true">✦</div>
            <h2>先新建一份困惑</h2>
            <p>把正在思考的事写下来，再选择一位人物开始对谈。</p>
            <Button variant="ghost" size="sm" className={css.secondaryButton} type="button" onClick={() => { setDeckError(undefined); setDeckMode('new') }}>
              开始一份新困惑 <span aria-hidden="true">→</span>
            </Button>
          </div> : selected.timeline.length === 0 ? <div className={css.emptyConversation}>
            <div className={css.emptyIcon} aria-hidden="true">↗</div>
            <h2>从一句话开始</h2>
            <p>写下此刻最真实的困惑，不必先把它整理得完整。</p>
          </div> : null}
          {selected?.timeline.map(item => <article className={css.timelineItem} key={item.id}
            data-roleplayer-kind={item.kind} data-roleplayer-status={item.status}>
            {item.kind !== 'persona-message' || item.persona === undefined ? null : <div className={css.authorRow}><img alt="" src={getPersonaPresentation(item.persona).portrait} /><div><strong>{personaName(item.persona)}</strong><span>{getPersonaPresentation(item.persona).era} · 人物视角</span></div></div>}
            {item.kind !== 'user-message' || item.replyToTimelineEventId === undefined ? null : <div className={css.sentReply}>{(() => {
              const target = selected.timeline.find(entry => entry.id === item.replyToTimelineEventId && entry.kind === 'persona-message')
              return target?.persona === undefined ? '引用的回答当前不可用' : <>回复 {personaName(target.persona)}<p>{target.text}</p></>
            })()}</div>}
            <div className={css.messageBody}>
              {item.kind === 'persona-message' && item.text !== undefined ? <>{(() => { const activity = selected.activity?.find(entry => entry.turnOperationId === item.operationId); if (activity === undefined) return <AcceptedText item={item} onEvidence={openEvidence} />; return <>{waitingForChoice && activity.endedAt === undefined ? <p>等待你选择，模型暂不生成回答。</p> : <ActivityDetails activity={activity} now={now} connected={connected} />}<AcceptedText item={item} onEvidence={openEvidence} /></> })()}</>
                : item.kind === 'user-message' ? <>{item.text ?? '你的困惑已提交'}{waitingForChoice && (selected.activeTurn?.messageId === item.id || (selected.activeTurn === undefined && selected.activity?.some(activity => activity.messageId === item.id && activity.turnOperationId === activeChoice?.turnOperationId && activity.endedAt === undefined) === true))
                  ? <p>等待你选择，模型暂不生成回答。</p>
                  : selected.activity?.filter(activity => activity.messageId === item.id && (activity.endedAt === undefined || activity.phase === 'failed' || activity.phase === 'cancelled')).map(activity => <ActivityDetails activity={activity} key={activity.id} now={now} connected={connected} />)}</>
                  : item.kind === 'choice-answer' ? '已记录选择'
                    : item.status === 'failed' ? '回答失败，请重试'
                      : item.status === 'cancelled' ? '已取消'
                        : item.kind === 'system-status' ? '系统状态已更新' : ''}
            </div>
            {item.kind !== 'persona-message' || item.text === undefined || item.status !== 'completed' ? null : <div className={css.messageActions}>
              <Button variant="ghost" size="sm" type="button" disabled={!online || pending !== undefined || readOnly || item.persona !== selected.activePersona} aria-label={`回复${item.persona === undefined ? '人物' : personaName(item.persona)}的回答`}
                title={item.persona !== selected.activePersona ? '切回该人物后才能引用其回答' : '引用这段回答'}
                onClick={() => { if (item.persona === selected.activePersona) { setReply({ id: item.id, persona: item.persona, text: item.text ?? '', handle: selected.handle }); composerRef.current?.focus() } }}>↩ 回复</Button>
              <Button variant="ghost" size="sm" type="button" onClick={() => { void navigator.clipboard.writeText(item.text ?? '').then(() => { setFeedback('已复制回答') }, () => { setFeedback('复制失败，请手动选择正文复制') }) }}>复制回答</Button>
            </div>}
          </article>)}
        </div>
        {!online || readOnly || activeChoice === undefined || activeQuestions === undefined
          ? null : <section className={css.choiceCard} aria-label="结构化选择">
            <h2>请做出选择</h2>
            {activeQuestions.map((question) => {
              const questionKey = `${activeChoice.operationId}:${question.id}`
              const current = choiceDraft[questionKey] ?? { selected: [], custom: '' }
              return <fieldset key={question.id}>
                <legend>{question.question}</legend>
                {question.options?.map(option => <label key={option.label}>
                  <input
                    type={question.multiSelect === true ? 'checkbox' : 'radio'}
                    name={`choice-${activeChoice.operationId}-${question.id}`}
                    checked={current.selected.includes(option.label)}
                    onChange={() => {
                      const selected = question.multiSelect === true
                        ? current.selected.includes(option.label)
                          ? current.selected.filter(label => label !== option.label)
                          : [...current.selected, option.label]
                        : [option.label]
                      setChoiceDraft(previous => ({ ...previous, [questionKey]: {
                        ...current, selected, ...(question.multiSelect === true ? {} : { mode: 'options' as const }),
                      } }))
                      setChoiceError(undefined)
                    }}
                  />
                  {option.label}
                </label>)}
                <Button variant="ghost" size="sm" type="button"
                  onClick={() => { setChoiceExpanded(previous => ({ ...previous, [questionKey]: !previous[questionKey] })) }}>
                  我还有其他考虑
                </Button>
                {choiceExpanded[questionKey] ? <Input aria-label={`补充 ${question.id}`} value={current.custom}
                  onChange={(event) => {
                    setChoiceDraft(previous => ({ ...previous, [questionKey]: {
                      ...current, custom: event.target.value,
                      ...(question.multiSelect === true ? {} : { selected: [], mode: 'custom' as const }),
                    } }))
                    setChoiceError(undefined)
                  }} /> : null}
              </fieldset>
            })}
            {choiceError === undefined ? null : <p role="alert">{choiceError}</p>}
            <Button variant="primary" type="button" disabled={choiceSubmitting === activeChoice.operationId} onClick={() => { void answerChoice(false) }}>{choiceSubmitting === activeChoice.operationId ? '正在提交…' : '提交选择'}</Button>
            <Button variant="ghost" size="sm" type="button" disabled={choiceSubmitting === activeChoice.operationId} onClick={() => { void answerChoice(true) }}>跳过此问</Button>
            <Button variant="ghost" size="sm" type="button" disabled={choiceSubmitting === activeChoice.operationId} onClick={() => { void details.cancelChoice(activeChoice.operationId as ManRoleplayerOperationId) }}>取消提问</Button>
          </section>}
        {selected === undefined || readOnly ? null : <form className={css.composer}
          onSubmit={(event) => { event.preventDefault(); void submit() }}>
          {reply === undefined || reply.handle !== selected.handle || reply.persona !== selected.activePersona ? null : <div className={css.replyPreview}><div><strong>回复 {personaName(reply.persona)}</strong><p>{reply.text}</p></div><Button variant="ghost" size="sm" type="button" aria-label="取消引用回复" onClick={() => { setReply(undefined) }}>×</Button></div>}
          <div className={css.composerField}>
            <textarea ref={composerRef} aria-label="输入困惑" placeholder="写下你的困惑或回应…" value={draft}
              onChange={(event) => {
                setDraftByHandle(current => ({ ...current, [String(selected.handle)]: event.target.value }))
              }}
              onKeyDown={(event) => {
                // oxlint-disable-next-line typescript/no-deprecated -- IME compatibility uses 229 where isComposing is unreliable.
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); void submit() }
              }} />
            <span>Enter 发送 · Shift + Enter 换行</span>
          </div>
          <div className={css.composerActions}>
            <Button variant="primary" className={css.primaryButton} type="submit"
              disabled={!online || pending !== undefined || discussionStatus !== 'in_progress' || activeChoice !== undefined || draft.trim() === ''}>
              发送 <span aria-hidden="true">↗</span>
            </Button>
            {pending === undefined ? null : <Button variant="ghost" size="sm" className={css.ghostButton} type="button" disabled={!online || stopping}
              onClick={() => {
                void conversation.cancel(pending.messageId, pending.deliveryOperationId, pending.turnOperationId)
              }}>取消</Button>}
          </div>
        </form>}
      </main>
      <aside ref={mobileAsideRef} role={mobileDetails ? 'dialog' : undefined} aria-modal={mobileDetails ? true : undefined} className={`${css.sidebarRight} ${mobileDetails ? css.mobileAsideOpen : ''}`} aria-label="困惑详情" aria-hidden={!detailsOpen && !mobileDetails}>
        <Button variant="ghost" size="sm" type="button" className={css.mobileClose} onClick={() => { setMobileDetails(false); mobileDetailsTrigger.current?.focus() }}>关闭状态面板</Button>
        <div className={css.panelHeader}><div><span className={css.sectionKicker}>本次对谈</span><h2>困惑详情</h2></div><span className={css.statusBadge}>{!connected ? '等待重连' : syncFailed ? '同步失败' : !online ? '同步中' : waitingForChoice ? '等待你选择' : pending !== undefined ? stopping ? '等待停止确认' : '正在回答' : selected === undefined ? '未开始' : selected.archived ? '只读' : selected.state?.status === undefined ? '等待开始' : selected.state.status === 'completed' ? '已更新' : selected.state.status === 'failed' ? '更新失败' : selected.state.status === 'stale' ? '已过期' : '同步中'}</span></div>
        {selected === undefined ? null : <section className={css.personaIdentity} aria-label="当前对谈人物">
          <img src={getPersonaPresentation(selected.activePersona).portrait} alt="" />
          <div>
            <span className={css.sectionKicker}>{getPersonaPresentation(selected.activePersona).era}</span>
            <h3>{personaName(selected.activePersona)}</h3>
            <p>{getPersonaPresentation(selected.activePersona).tagline}</p>
            <div className={css.personaIdentityThemes}>
              {getPersonaPresentation(selected.activePersona).themes.map(theme => <Pill key={theme}>{theme}</Pill>)}
            </div>
          </div>
        </section>}
        <div className={css.detailTabs} role="tablist" aria-label="详情内容">
          {([['state', '当前状态'], ['perspective', '人物视角'], ['evidence', '资料依据']] as const).map(([tab, label]) => <button key={tab} id={`roleplayer-tab-${tab}`} type="button" role="tab" aria-selected={detailsTab === tab} aria-controls={`roleplayer-panel-${tab}`} tabIndex={detailsTab === tab ? 0 : -1} onClick={() => { setDetailsTab(tab) }}
            onKeyDown={(event) => {
              const tabs = ['state', 'perspective', 'evidence'] as const
              const current = tabs.indexOf(tab)
              const next = event.key === 'ArrowRight' ? tabs[(current + 1) % tabs.length] : event.key === 'ArrowLeft' ? tabs[(current + tabs.length - 1) % tabs.length] : event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[2] : undefined
              if (next !== undefined) { event.preventDefault(); setDetailsTab(next); document.getElementById(`roleplayer-tab-${next}`)?.focus() }
            }}>{label}</button>)}
        </div>
        <div className={css.detailContent} role="tabpanel" id="roleplayer-panel-evidence" aria-labelledby="roleplayer-tab-evidence" hidden={detailsTab !== 'evidence'}>
          {selected?.evidence === undefined || selected.evidence.length === 0 ? <p>本次对谈暂无资料依据</p> : null}
          {selected?.evidence === undefined ? null : <div aria-label="证据状态">
            <h3>证据状态</h3>
            {selected.evidence.map(item => <details key={item.id} open tabIndex={-1}
              ref={(node) => {
                if (node === null) evidenceNodes.current.delete(item.id)
                else evidenceNodes.current.set(item.id, node)
              }} className={`${css.evidenceCard} ${highlightedEvidence.includes(item.id) ? css.highlightedEvidence : ''}`}
              data-roleplayer-evidence={item.status}>
              <summary className={css.evidenceCardHeader}><strong>{item.title ?? '资料'}</strong><Pill>{item.status === 'available' ? '可用' : item.status === 'challenged' ? '已被质疑/待复核' : '已撤回'}</Pill></summary>
              {item.text === undefined ? null : <p className={css.evidenceBody}>{item.text}</p>}
              {item.source === undefined ? null : <p className={css.evidenceSource}>出处：{item.source}</p>}
              <p className={css.evidenceMeta}>类型：{evidenceTypeLabel(item.evidenceType)} · 可信度：{item.trustLevel === 'reliable' ? '有可靠来源' : item.trustLevel === 'restricted' ? '使用受限，需谨慎理解' : '未标注'}</p>
              <div className={css.evidenceActions}><Button variant="outline" size="sm" type="button" onClick={(event) => { evidenceTrigger.current = event.currentTarget; setEvidenceIds([item.id]) }}>证据详情</Button>
                {!readOnly && item.status === 'available' ? <>
                  <Button variant="ghost" size="sm" type="button" disabled={!online} onClick={() => { void stateAction(details.challengeEvidence(item.id), '已质疑，等待复核') }}>质疑</Button>
                  <Button variant="ghost" size="sm" type="button" disabled={!online} onClick={() => { void stateAction(details.withdrawEvidence(item.id), '已撤回资料，历史正文保留') }}>撤回</Button>
                </> : null}
                {!readOnly && item.status === 'challenged' ? <Button variant="ghost" size="sm" type="button" disabled={!online} onClick={() => { void stateAction(details.reviewEvidence(item.id), '已提交人工复核') }}>人工复核</Button> : null}</div>
            </details>)}
          </div>}
          {selected?.evidenceActivity === undefined ? null : <div aria-label="证据检索活动">
            <h3>证据检索</h3>
            {selected.evidenceActivity.map(activity => <p key={activity.operationId}>{activity.status === 'completed-with-results' ? `已找到 ${activity.returnedCount} 条` : activity.status === 'completed-zero-hit' ? '未找到匹配资料' : activity.status === 'budget-exhausted' ? '本轮检索次数已用完' : activity.status === 'cancelled' ? '检索已取消' : '检索失败'}</p>)}
          </div>}
        </div>
        <div className={css.detailContent} role="tabpanel" id="roleplayer-panel-state" aria-labelledby="roleplayer-tab-state" hidden={detailsTab !== 'state'}>
          <section className={css.discussionSummary} aria-label="讨论进度"><h3>讨论进度</h3><dl className={css.discussionMetrics}><div><dt>阶段</dt><dd>{selected === undefined ? '尚未开始' : selected.archived ? '已归档' : discussionStatus === 'paused' ? '已暂停' : discussionStatus === 'stage_ended' ? '阶段结束' : '进行中'}</dd></div><div><dt>待确认</dt><dd>{pendingStateItems.length}</dd></div><div><dt>已确认</dt><dd>{confirmedStateItems.length}</dd></div></dl>
            <p>{!connected ? '连接恢复后会自动核对回答状态，未发送内容已保留' : syncFailed ? '未能读取最新回答状态，请重试；未发送内容已保留' : !online ? '正在读取最新回答状态' : waitingForChoice ? '当前轮次等待你选择；选择等待期间不计入模型生成时间' : pending !== undefined ? stopping ? '正在核对当前回答是否已停止' : '当前人物正在回答' : errorLabel ?? (selected?.archived === true ? '已归档' : selected === undefined ? '选择一位人物开始' : discussionStatus === 'paused' ? '本阶段已暂停' : discussionStatus === 'stage_ended' ? '本阶段已结束' : '可以继续提交新的困惑')}</p>
            {details.error === null ? null : <Button variant="ghost" size="sm" type="button" disabled={!connected || view.status === 'loading'} onClick={() => { void details.retry() }}>重试</Button>}
            {!online || pending !== undefined || failedUser?.id === undefined || failedTurn?.operationId === undefined ? null : <Button variant="ghost" size="sm" type="button" disabled={!online} onClick={() => { void details.retryMessage(failedUser.id as ManRoleplayerOperationId, failedTurn.operationId as ManRoleplayerOperationId) }}>重试本次回答</Button>}
            {selected === undefined || readOnly ? null : discussionStatus === 'in_progress'
              ? <>
                <Button variant="outline" size="sm" type="button" disabled={!online} onClick={() => { void details.pause() }}>暂停讨论</Button>
                <Button variant="outline" size="sm" type="button" disabled={!online} onClick={() => { void details.endStage() }}>结束本阶段</Button>
              </>
              : <Button variant="outline" size="sm" type="button" disabled={!online} onClick={() => { void details.resume() }}>继续讨论</Button>}
          </section>
          {selected?.state === undefined ? <p>状态将在对谈后整理，你可以逐条确认或修改。</p> : <div aria-label="当前状态">
            <h3>当前状态：{selected.state.status === 'completed' ? '已更新' : selected.state.status === 'failed' ? '更新失败' : selected.state.status === 'stale' ? '已过期' : '处理中'}</h3>
            {selected.state.status === 'claimed' || selected.state.status === 'running' ? <p>正在整理，不影响继续对话</p> : null}
            {selected.state.status === 'completed' && stateItems.length === 0 ? <p>本轮没有需要记录或确认的新信息</p> : null}
            {pendingStateItems.length === 0 ? null : <details className={css.stateGroup} open>
              <summary>待你确认 <span>{pendingStateItems.length}</span></summary>
              {pendingStateItems.map(item => <div className={css.stateCard} key={item.id} data-roleplayer-state={item.status}>
                <div className={css.stateCardMeta}><span>{{ fact: '事实', goal: '目标', conflict: '矛盾', unresolved: '待解决', understanding: '理解' }[item.kind]}</span><Pill>{item.status === 'candidate' ? '待确认' : '已确认'}</Pill></div>
                <p>{item.text}</p>
                {!readOnly ? <div className={css.stateActions}>
                  <Button variant="outline" type="button" disabled={!online} onClick={() => { void stateAction(details.confirmState(item.id), '已确认信息') }}>确认</Button>
                  <Button variant="ghost" size="sm" type="button" onClick={() => { setEditingStateId(item.id); setStateDraft(current => ({ ...current, [item.id]: current[item.id] ?? item.text })) }}>修改</Button>
                  <Button variant="ghost" size="sm" type="button" disabled={!online} onClick={() => { void stateAction(details.rejectState(item.id), '已拒绝候选信息') }}>拒绝</Button>
                  {item.kind === 'unresolved' ? <Button variant="ghost" size="sm" type="button" disabled={!online} onClick={() => { void stateAction(details.resolveState(item.id), '已标记解决') }}>标记已解决</Button> : null}
                </div> : null}
                {editingStateId === item.id ? <div className={css.stateEditor}><Input aria-label="修改状态" value={stateDraft[item.id] ?? item.text} onChange={(event) => { setStateDraft({ ...stateDraft, [item.id]: event.target.value }) }} /><Button variant="primary" type="button" disabled={!online} onClick={() => { void stateAction(details.modifyState(item.id, stateDraft[item.id] ?? item.text, item.kind), '已保存修改').then((success) => { if (success) setEditingStateId(undefined) }) }}>保存修改</Button><Button variant="ghost" size="sm" type="button" onClick={() => { setEditingStateId(undefined) }}>取消</Button></div> : null}
              </div>)}
            </details>}
            {confirmedStateItems.length === 0 ? null : <details className={css.stateGroup} open>
              <summary>已确认信息 <span>{confirmedStateItems.length}</span></summary>
              {confirmedStateItems.map(item => <div className={css.stateCard} key={item.id} data-roleplayer-state={item.status}>
                <div className={css.stateCardMeta}><span>{{ fact: '事实', goal: '目标', conflict: '矛盾', unresolved: '待解决', understanding: '理解' }[item.kind]}</span><Pill>{item.status === 'candidate' ? '待确认' : '已确认'}</Pill></div>
                <p>{item.text}</p>
                {!readOnly ? <div className={css.stateActions}><Button variant="ghost" size="sm" type="button" onClick={() => { setEditingStateId(item.id); setStateDraft(current => ({ ...current, [item.id]: current[item.id] ?? item.text })) }}>修改</Button><Button variant="ghost" size="sm" type="button" disabled={!online} onClick={() => { void stateAction(details.withdrawState(item.id), '已撤回信息') }}>撤回</Button></div> : null}
                {editingStateId === item.id ? <div className={css.stateEditor}><Input aria-label="修改状态" value={stateDraft[item.id] ?? item.text} onChange={(event) => { setStateDraft({ ...stateDraft, [item.id]: event.target.value }) }} /><Button variant="primary" type="button" disabled={!online} onClick={() => { void stateAction(details.modifyState(item.id, stateDraft[item.id] ?? item.text, item.kind), '已保存修改').then((success) => { if (success) setEditingStateId(undefined) }) }}>保存修改</Button><Button variant="ghost" size="sm" type="button" onClick={() => { setEditingStateId(undefined) }}>取消</Button></div> : null}
              </div>)}
            </details>}
            {historicalStateItems.length === 0 ? null : <details className={css.stateGroup}><summary>历史记录 <span>{historicalStateItems.length}</span></summary>{historicalStateItems.map(item => <p key={item.id} data-roleplayer-state={item.status}>{item.status === 'rejected' ? '已拒绝' : item.status === 'withdrawn' ? '已撤回' : item.status === 'superseded' ? '已替代' : '已解决'}：{item.text}</p>)}</details>}
            {!readOnly && selected.state.status === 'failed' && selected.state.retryable === true ? <Button variant="ghost" size="sm" type="button" disabled={!online} onClick={() => { void details.retryState() }}>重试状态整理</Button> : null}
          </div>}
        </div>
        <div className={css.detailContent} role="tabpanel" id="roleplayer-panel-perspective" aria-labelledby="roleplayer-tab-perspective" hidden={detailsTab !== 'perspective'}>
          {selected?.state?.personaSnapshot === undefined ? null : <section aria-label="当前人物视角">
            <h3>{personaName(selected.state.personaSnapshot.persona)}当前视角</h3>
            <section className={css.perspectiveSection}><h4>对你处境的理解</h4>
              <p>{selected.state.personaSnapshot.currentUnderstanding}</p></section>
            <section className={css.perspectiveSection}><h4>核心看法</h4><p>{selected.state.personaSnapshot.coreView}</p></section>
            {selected.state.personaSnapshot.advice === undefined ? null : <section className={css.perspectiveSection}><h4>行动建议</h4>
              <p>{selected.state.personaSnapshot.advice}</p></section>}
          </section>}
          {selected?.state?.personaSnapshot === undefined ? <p>当前人物的理解会在对谈后更新。</p> : null}
        </div>
        <div className={css.detailsFooter}>
          {selected === undefined ? null : <>
            {selected.deletion ? <p role="status">删除阶段：{selected.deletion.stage}{selected.deletion.irreversible ? '（不可逆）' : ''}</p> : null}
            {selected.deletion?.retryable === true
              ? <Button variant="ghost" size="sm" type="button" disabled={!online} onClick={() => {
                const deletion = selected.deletion
                if (deletion !== undefined) void details.delete(deletion.operationId)
              }}>重试未完成步骤</Button>
              : selected.deletion === undefined ? (selected.archived === true
                ? <Button variant="ghost" size="sm" type="button" disabled={!online} onClick={() => { void details.restore() }}>恢复困惑</Button>
                : <Button variant="ghost" size="sm" type="button" disabled={!online} onClick={() => { void details.archive() }}>归档</Button>) : null}
            {selected.deletion === undefined ? <Button variant="ghost" size="sm" type="button" onClick={(event) => { deleteTrigger.current = event.currentTarget; setDeleteOperation((selected.deletion?.operationId ?? `delete:${crypto.randomUUID()}`) as Parameters<typeof details.delete>[0]) }}>删除</Button> : null}

          </>}
        </div>
      </aside>
      <Button variant="ghost" size="sm" type="button" className={css.mobileDetailsButton} onClick={() => { setMobileDetails(true) }}>状态面板</Button>
      {deleteOperation === undefined ? null : <div ref={deleteDialogRef} role="dialog" aria-modal="true" aria-labelledby="roleplayer-delete-title" className={css.drawer}>
        <h2 id="roleplayer-delete-title">确认删除</h2>
        <p>将从本机删除困惑、人物历史和产品记录；此前已发送给 Provider 的请求无法撤回。删除开始后不可恢复。</p>
        <Button variant="ghost" size="sm" type="button" onClick={() => { setDeleteOperation(undefined); deleteTrigger.current?.focus() }}>取消</Button>
        <Button variant="ghost" size="sm" type="button" disabled={!online} onClick={() => {
          // The confirmation dialog represents the reversible user intent;
          // once submitted it must close so failure is rendered by the
          // durable deletion projection and can reuse the same operation.
          const operation = deleteOperation
          setDeleteOperation(undefined)
          void details.delete(operation)
        }}>确认删除</Button>
      </div>}
      {evidenceIds === undefined ? null : <div ref={evidenceDialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="roleplayer-evidence-title" className={css.drawer}>
        <h2 id="roleplayer-evidence-title">证据详情</h2>
        {selected?.evidence?.filter(item => evidenceIds.includes(item.id)).map(item => <div key={item.id}><h3>{item.title ?? '资料'}</h3><p>{item.text ?? '当前资料正文不可用'}</p><p>出处：{item.source ?? '未标注'}</p><p>{item.status === 'available' ? '当前可用' : '该证据已失效，历史回答保留但不再作为后续依据'}</p></div>)}
        <Button variant="ghost" size="sm" type="button" onClick={() => { setEvidenceIds(undefined); evidenceTrigger.current?.focus() }}>关闭</Button>
      </div>}
      {deckMode === undefined ? null : renderSlot('manRoleplayer.personaDeck', {
        mode: deckMode, personas: view.personas, joined: deckMode === 'new' ? [] : selected?.branches.map(branch => branch.persona) ?? [],
        ...(selected === undefined ? {} : { activePersona: selected.activePersona }),
        busy: deckBusy, disabled: !online || deckMode === 'invite' && (pending !== undefined || readOnly || selected === undefined),
        ...(deckError === undefined ? {} : { error: deckError }),
        onClose: () => { if (!deckSubmission.current) { setDeckMode(undefined); newTrigger.current?.focus() } },
        onConfirm: (persona) => { void confirmPersona(persona) },
      })}
      {sidebarMobile || mobileDetails ? <button className={css.mobileBackdrop} type="button" aria-label="关闭覆盖面板" onClick={() => { if (sidebarMobile) closeMobileSidebar(); if (mobileDetails) { setMobileDetails(false); mobileDetailsTrigger.current?.focus() } }} /> : null}
      {feedback === undefined ? null : <div className={css.feedback} role="status">{feedback}<Button variant="ghost" size="sm" type="button" aria-label="关闭操作提示" onClick={() => { setFeedback(undefined) }}>×</Button></div>}
    </section>
  )
}
