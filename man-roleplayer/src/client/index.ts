/**
 * man-roles-roleplayer —— Client 面（浏览器端）UI 注入点。
 *
 * 展示困惑状态（candidate/confirmed/corrected）+ 确认/纠正入口。
 * 注入点级验证（task_plan 允许的降级项）：注册调用不抛错、client bundle 进入
 * boot graph、/plugins/<id>/client.js 可服务；像素级可见性不在本阶段验收范围。
 *
 * 投影数据读取：DSH client runtime 提供 `useProjection` 框架座（session-scope
 * slot 的标准 props），本组件尽力探测使用；不可用时退回注入的演示数据。
 * 真实投影推送依赖 web 会话的事件流动与 host 侧投影单元注册，本阶段以注入点
 * 为准（README 记录该通道验证状态）。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// 类型引用：SlotMap 声明合并与 ClientContext 形状（构建时被擦除）
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { PropsRuntime, SlotComponent } from '@deepseek-ai/dsh-client-ui-slots'
import { ACTIVE_PERSONAS } from './generated-metadata.ts'
import { mountManRolesRemote } from './remote-probe.ts'
import { ProductController } from './product-controller.ts'
import { ProductComposer, ProductPanel, selectProductComposer } from './product-ui.ts'
import { registerActorReplyNode } from './actor-reply-node.ts'
export { actorReplyConversationNodeDefinition } from './actor-reply-node.ts'

/** 稳定插件名。 */
export const name = 'man-roles-roleplayer-ui'

/** 需要浏览器端 slots 服务（由 dsh-client-runtime 提供）。 */
export const inject = ['slots', 'remote', 'sessions', 'conversationEvents']

/** 困惑状态投影 key（与 host 侧注册一致）。 */
const DILEMMA_KEY = 'man-roles/dilemma'

export const personaEntries = ACTIVE_PERSONAS

/**
 * 困惑状态面板组件（React 共享模块 + createElement，避免 JSX 构建依赖）。
 * props 由注入 + 框架标准 props（可能含 useProjection）组成。
 */
type DilemmaPanelProps = PropsRuntime<'sidebar.footer.action'> & { personas: typeof personaEntries; controller: ProductController }
type RenderedNode = ReturnType<SlotComponent<never>>
function DilemmaPanel(props: DilemmaPanelProps): RenderedNode {
  const React = (globalThis as { require?: (id: string) => unknown }).require?.('react')
  if (React === undefined) {
    console.warn('[man-roles-roleplayer:ui] react 不可用，跳过渲染')
    return null
  }
  const { createElement, useEffect, useState } = React as {
    createElement: (...args: unknown[]) => RenderedNode
    useEffect: (fn: () => void, deps?: unknown[]) => void
    useState: <T>(init: T | (() => T)) => [T, (v: T) => void]
  }

  // 尽力读取真实投影（session-scope slot 标准 props 提供 useProjection）
  const useProjection = (props as DilemmaPanelProps & { useProjection?: unknown }).useProjection as
    | ((key: string) => { value?: unknown; subscribe?: unknown })
    | undefined
  const [projected, setProjected] = useState<unknown>(undefined)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  if (useProjection !== undefined) {
    useEffect(() => {
      const face = useProjection(DILEMMA_KEY)
      setProjected(face?.value)
    }, [useProjection])
  }

  const state = projected as Record<string, unknown> | undefined
  if (state === undefined || state === null) {
    return createElement('div', { 'data-man-roles-dilemma-error': 'missing-state' }, '困惑状态暂不可用')
  }
  const phase = String(state.phase ?? 'pending')
  const candidate = state.candidateText ?? null
  const confirmed = state.confirmedText ?? null
  const corrected = state.correctedText ?? null
  const persona = String(state.activePersona ?? '')
  if (persona === '') return createElement('div', { 'data-man-roles-dilemma-error': 'missing-persona' }, '人物状态暂不可用')

  const statusLine = phase === 'confirmed'
    ? `已确认困惑：${confirmed}`
    : phase === 'corrected'
      ? `已纠正困惑：${corrected}`
      : phase === 'candidate'
        ? `候选困惑：${candidate}（等待确认/纠正）`
        : '尚未识别困惑'

  const conversationId = typeof state.conversationId === 'string' ? state.conversationId : ''
  const candidateId = typeof state.candidateId === 'string' ? state.candidateId : ''
  const feedback = (action: 'confirm' | 'correct', replacement?: string): void => {
    if (!conversationId || !candidateId) { setFeedbackError('候选困惑尚未同步，无法提交反馈。'); return }
    const operationId = `feedback-${candidateId}-${action}`
    void props.controller.feedback({ conversationId, itemId: candidateId, action, operationId, ...(replacement ? { replacement } : {}) }).then(result => {
      setFeedbackError(result.ok ? null : (result.code ?? '提交反馈失败。'))
    }).catch(() => setFeedbackError('提交反馈失败。'))
  }
  const onConfirm = (): void => feedback('confirm')
  const onCorrect = (): void => {
    const replacement = globalThis.prompt?.('请写下你希望保留的困惑表述：', String(candidate ?? ''))
    if (replacement?.trim()) feedback('correct', replacement)
  }

  return createElement(
    'div',
    {
      'data-man-roles-dilemma': 'true',
      style: {
        display: 'flex', flexDirection: 'column', gap: '6px',
        padding: '8px 10px', borderRadius: '10px', fontSize: '12px',
        background: 'var(--dsh-surface, rgba(127,127,127,.08))',
        border: '1px solid var(--dsh-border, rgba(127,127,127,.25))',
        maxWidth: '280px',
      },
    },
    [
      createElement('div', {
        key: 'title',
        style: { fontWeight: 600, color: 'var(--dsh-accent, #7c5cff)' },
      }, `困惑状态 · ${persona}`),
      createElement('div', { key: 'status', style: { color: 'inherit' } }, statusLine),
      feedbackError ? createElement('div', { key: 'feedback-error', role: 'alert', style: { color: 'var(--dsh-danger, #b42318)' } }, feedbackError) : null,
      createElement('div', {
        key: 'actions',
        style: { display: 'flex', gap: '6px' },
      }, [
        createElement('button', {
          key: 'confirm',
          onClick: onConfirm,
          disabled: phase !== 'candidate',
          style: { fontSize: '11px', cursor: 'pointer' },
        }, '确认'),
        createElement('button', {
          key: 'correct',
          onClick: onCorrect,
          disabled: phase !== 'candidate',
          style: { fontSize: '11px', cursor: 'pointer' },
        }, '纠正'),
      ]),
    ],
  )
}

/**
 * 浏览器端插件主体：向 sidebar.footer.action 注册困惑状态面板。
 * @param ctx - client root context（含 slots 服务）。
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  console.log('[man-roles-roleplayer:ui] client 插件已加载，注册 UI 注入点 sidebar.footer.action')
  // The contribution itself creates `remote.manRolesProduct`; parking this
  // scoped injection avoids both a boot-time dependency cycle and an
  // unscoped proxy that Cordis correctly refuses to call later.
  const remoteDispose = await mountManRolesRemote(ctx)
  let controller: ProductController | undefined
  await ctx.inject(['remote.manRolesProduct'], productCtx => {
    controller = new ProductController(productCtx.remote as unknown as ConstructorParameters<typeof ProductController>[0])
  })
  if (!controller) throw new Error('manRolesProduct Remote did not become available')
  registerActorReplyNode(ctx)
  const open = (sessionId: string): void => ctx.sessions.open(sessionId as never)
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'man-roles-roleplayer-product-panel',
    inject: () => ({ personas: personaEntries, controller, open }),
  } as never, ProductPanel as never))
  ctx.slots.inject('conversation.composer', () => ctx.slots.register({
    name: 'conversation.composer', priority: 10, select: selectProductComposer,
    inject: () => ({ controller }),
  } as never, ProductComposer as never))
  console.log('[man-roles-roleplayer:ui] Product 控制面与仅产品 Branch 的 composer 已注册')
  return remoteDispose
}
