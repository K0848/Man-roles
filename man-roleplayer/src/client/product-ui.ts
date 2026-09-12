import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { createElement, useState } from 'react'
import type { ProductController, ProductView } from './product-controller.ts'

type RenderedNode = ReturnType<typeof createElement>
type ProductComposerProps = { matched: { conversationId: string; sessionId: string }; controller: ProductController }
type ProductCandidate = { id?: string; text?: string; status?: string; proposedByPersona?: string }
type ProductPanelProps = { controller: ProductController; personas: ReadonlyArray<{ id: string; displayName: string }>; open: (sessionId: string) => void }

/** True only for the session-id form minted by ConversationRepository. */
export function productBranchFromSessionId(sessionId: string | undefined): { conversationId: string; sessionId: string } | null {
  if (!sessionId) return null
  const match = /^session-man-roles-[a-z0-9]+(?:-[a-z0-9]+)*--([A-Za-z0-9][A-Za-z0-9_-]{0,127})$/.exec(sessionId)
  return match ? { conversationId: match[1]!, sessionId } : null
}
export function selectProductComposer({ session }: ComposerChainProps): { conversationId: string; sessionId: string } | null {
  return productBranchFromSessionId(session?.sessionId)
}
function operationId(prefix: string): string {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${id}`
}

/** Product-only composer: it never calls DSH `session.prompt`. */
export function ProductComposer(props: ProductComposerProps): RenderedNode {
  const [draft, setDraft] = useState(''); const [error, setError] = useState<string | null>(null); const [sending, setSending] = useState(false)
  const send = (): void => {
    const text = draft.trim(); if (!text || sending) return
    setSending(true)
    void props.controller.send({ conversationId: props.matched.conversationId, messageId: operationId('message'), text }).then(result => {
      if (result.ok) { setDraft(''); setError(null) } else setError(result.code ?? '发送失败')
    }).catch(() => setError('发送失败')).finally(() => setSending(false))
  }
  return createElement('div', { 'data-man-roles-product-composer': 'true', style: { padding: '10px', borderTop: '1px solid var(--dsh-border, #ddd)', display: 'flex', gap: '8px', flexDirection: 'column' } }, [
    createElement('textarea', { key: 'draft', value: draft, disabled: sending, placeholder: '向当前人物说说你的困惑…', rows: 2, onChange: (event: { target: { value: string } }) => setDraft(event.target.value), onKeyDown: (event: { key: string; shiftKey: boolean; preventDefault(): void }) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() } } }),
    error ? createElement('div', { key: 'error', role: 'alert' }, error) : null,
    createElement('button', { key: 'send', type: 'button', disabled: sending || draft.trim() === '', onClick: send, 'data-man-roles-product-send': 'true' }, sending ? '发送中…' : '发送'),
  ])
}

/** Sidebar control plane for create, persona switching, refresh and feedback. */
export function ProductPanel(props: ProductPanelProps): RenderedNode {
  const [view, setView] = useState<ProductView | null>(null); const [error, setError] = useState<string | null>(null)
  const [corrections, setCorrections] = useState<Record<string, string>>({})
  const create = (): void => {
    const persona = props.personas[0]; if (!persona) return
    const conversationId = operationId('conversation')
    void props.controller.create({ conversationId, personaId: persona.id }).then(result => {
      if (!result.ok || !result.view?.activeBranchSessionId) { setError(result.code ?? '创建对话失败'); return }
      setView(result.view); setError(null); props.open(result.view.activeBranchSessionId)
    }).catch(error => setError(error instanceof Error ? `创建对话失败：${error.message}` : '创建对话失败'))
  }
  const refresh = (): void => { if (!view) return; void props.controller.view({ conversationId: view.conversationId }).then(result => { if (result.ok && result.view) { setView(result.view); setError(null) } else setError(result.code ?? '刷新失败') }).catch(() => setError('刷新失败')) }
  const switchPersona = (personaId: string): void => { if (!view) return; void props.controller.switchPersona({ conversationId: view.conversationId, personaId, operationId: operationId('switch') }, props.open).then(result => { if (!result.ok) setError(result.code ?? '切换失败'); else if (result.view) { setView(result.view); setError(null) } else refresh() }).catch(() => setError('切换失败')) }
  const candidates = (view?.candidateItems ?? []).filter((item): item is ProductCandidate => typeof item === 'object' && item !== null && typeof item.id === 'string')
  const [pendingFeedback, setPendingFeedback] = useState<string | null>(null)
  const feedback = (candidate: ProductCandidate, action: 'confirm' | 'partial-confirm' | 'correct' | 'reject' | 'skip', replacement?: string): void => {
    if (!view || !candidate.id || pendingFeedback) return
    const operation = `${view.conversationId}-${candidate.id}-${action}`
    setPendingFeedback(operation)
    void props.controller.feedback({ conversationId: view.conversationId, itemId: candidate.id, action, operationId: `feedback-${operation}`, ...(replacement ? { replacement } : {}) }).then(result => {
      if (result.ok) refresh(); else setError(result.code ?? '反馈失败')
    }).catch(() => setError('反馈失败')).finally(() => setPendingFeedback(null))
  }
  const feedbackLabel: Record<'confirm' | 'partial-confirm' | 'correct' | 'reject' | 'skip', string> = { confirm: '确认', 'partial-confirm': '部分确认', correct: '纠正', reject: '不符合', skip: '暂不处理' }
  const feedbackActions = ['confirm', 'partial-confirm', 'correct', 'reject', 'skip'] as const
  return createElement('section', { 'data-man-roles-product-panel': 'true', style: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px' } }, [
    createElement('strong', { key: 'title' }, '向古人问惑'),
    createElement('button', { key: 'create', type: 'button', onClick: create, 'data-man-roles-create': 'true' }, '新建困惑对话'),
    view ? createElement('div', { key: 'conversation' }, `当前人物：${view.activePersonaId}`) : null,
    view ? createElement('div', { key: 'personas', style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } }, props.personas.map(persona => createElement('button', { key: persona.id, type: 'button', disabled: persona.id === view.activePersonaId, onClick: () => switchPersona(persona.id), 'data-man-roles-switch': persona.id }, persona.displayName))) : null,
    view ? createElement('button', { key: 'refresh', type: 'button', onClick: refresh, 'data-man-roles-refresh': 'true' }, '刷新状态') : null,
    ...candidates.map(candidate => createElement('div', { key: candidate.id, 'data-man-roles-candidate-id': candidate.id, style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
      createElement('div', { key: 'text' }, `候选困惑：${candidate.text ?? candidate.id}`),
      createElement('input', { key: 'replacement', value: corrections[candidate.id!] ?? candidate.text ?? '', placeholder: '纠正后的困惑表述', onChange: (event: { target: { value: string } }) => setCorrections({ ...corrections, [candidate.id!]: event.target.value }), 'data-man-roles-candidate-replacement': candidate.id }),
      createElement('div', { key: 'actions', style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } }, feedbackActions.map(action => createElement('button', {
        key: action,
        type: 'button',
        disabled: pendingFeedback !== null,
        onClick: () => feedback(candidate, action, action === 'correct' ? corrections[candidate.id!]?.trim() || candidate.text : undefined),
        'data-man-roles-feedback': action,
        ...(action === 'confirm' ? { 'data-man-roles-confirm': 'true' } : {}),
      }, feedbackLabel[action])))
    ])),
    error ? createElement('div', { key: 'error', role: 'alert' }, error) : null,
  ])
}
