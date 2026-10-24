/** Anchored dilemma actions with keyboard focus contained in the open menu. */
import { useCallback, useEffect, useId, useRef } from 'react'
import { Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './RoleplayerView.module.css'

/** Render the controlled sidebar menu and return keyboard focus to its trigger.
 * @param props - Open state, availability, and existing dilemma action callbacks.
 * @returns The trigger and anchored action list.
 */
export function DilemmaMenu({ open, archived, disabled, onOpen, onClose, onSelect }: {
  readonly open: boolean
  readonly archived: boolean
  readonly disabled: boolean
  readonly onOpen: (trigger: HTMLButtonElement) => void
  readonly onClose: () => void
  readonly onSelect: (action: string) => void
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const menu = useCallback(() => document.querySelector(`[data-dilemma-menu="${id}"]`)?.closest('[role="menu"]'), [id])
  useEffect(() => {
    if (open) menu()?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
  }, [open, menu])
  const close = () => { onClose(); trigger.current?.focus() }
  return <span onKeyDown={(event) => {
    if (!open) return
    if (event.key === 'Escape' || event.key === 'Tab') { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation() }; close(); return }
    const items = [...(menu()?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : undefined
    if (next !== undefined) { event.preventDefault(); items[next]?.focus() }
  }}>
    <Menu portal open={open} align="end" {...(css.sidebarMenuAnchor === undefined ? {} : { className: css.sidebarMenuAnchor })}
      anchor={<button ref={trigger} className={css.dilemmaMore} type="button" aria-label="更多操作" aria-haspopup="menu" aria-expanded={open}
        onKeyDown={(event) => { if (event.key === 'ArrowDown' && !open) { event.preventDefault(); onOpen(event.currentTarget) } }}
        onClick={(event) => { if (open) close(); else onOpen(event.currentTarget) }}>···</button>}
      items={[...(archived ? [{ id: 'restore', label: '恢复困惑', disabled }] : [{ id: 'rename', label: '重命名', disabled }, { id: 'archive', label: '归档', disabled }]), { type: 'separator', id: 'separator' }, { id: 'delete', label: <span data-dilemma-menu={id}>永久删除</span>, danger: true, disabled }]}
      onClose={close} onSelect={(action) => { close(); onSelect(action) }} />
  </span>
}
