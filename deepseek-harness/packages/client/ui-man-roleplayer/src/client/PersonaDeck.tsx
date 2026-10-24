import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PersonaId, RoleplayerPersonaOption } from '@deepseek-ai/dsh-man-roleplayer/types'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './PersonaDeck.module.css'
import { getPersonaPresentation } from './persona-presentation.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'manRoleplayer.personaDeck': {
      kind: 'single'
      scope: 'root'
      owner: {
        mode: 'new' | 'invite'
        personas: readonly RoleplayerPersonaOption[]
        joined: readonly PersonaId[]
        activePersona?: PersonaId
        busy: boolean
        disabled: boolean
        error?: string
        onConfirm: (persona: PersonaId) => void
        onClose: () => void
      }
    }
  }
}

type PersonaDeckProps = PropsRuntime<'manRoleplayer.personaDeck'>

/** Select and inspect one available persona before explicitly starting or inviting them.
 * @param props - Roster, current participation state, availability and callbacks for this deck.
 * @returns The controlled persona card dialog.
 */
export function PersonaDeck({
  mode, personas, joined, activePersona, busy, disabled, error, onConfirm, onClose,
}: PersonaDeckProps) {
  const [selected, setSelected] = useState<PersonaId>()
  const [flipped, setFlipped] = useState<ReadonlySet<PersonaId>>(() => new Set())
  const dialogRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const deckRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const focusable = dialog?.querySelector<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])')
    focusable?.focus()
    return () => { openerRef.current?.focus() }
  }, [])

  const close = (): void => {
    if (busy) return
    onClose()
    requestAnimationFrame(() => openerRef.current?.focus())
  }
  const toggleFlip = (id: PersonaId): void => {
    setFlipped((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const onDeckKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    const card = target.closest<HTMLElement>('[data-persona-card]')
    const cards = [...(deckRef.current?.querySelectorAll<HTMLElement>('[data-persona-card]') ?? [])]
    const index = cards.indexOf(card as HTMLElement)
    if (index < 0 || cards.length === 0) return
    event.preventDefault()
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + cards.length) % cards.length
    const button = cards[next]?.querySelector<HTMLButtonElement>('button[data-flip]')
    button?.focus()
    cards[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }
  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab') return
    const dialog = dialogRef.current
    if (dialog === null) return
    const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    if (focusable.length === 0) { event.preventDefault(); dialog.focus(); return }
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  const selectedPersona = personas.find(persona => persona.id === selected)
  const selectedPresentation = selected === undefined ? undefined : getPersonaPresentation(selected)
  const confirmLabel = selectedPersona === undefined
    ? mode === 'new' ? '选择一位人物后开始' : '选择一位人物后邀请'
    : mode === 'new' ? '开始这份困惑'
      : joined.includes(selectedPersona.id) ? `继续与${selectedPersona.displayName}对话`
        : `邀请${selectedPersona.displayName}入座`

  return <Modal open onClose={close} title={mode === 'new' ? '选择一位人物' : '邀请一位人物'} closeLabel="关闭人物卡册" headless className={css.modal ?? ''}>
    <section ref={dialogRef} className={css.gallery} aria-label={mode === 'new' ? '选择人物开启困惑' : '选择人物加入困惑'} onKeyDown={trapFocus} tabIndex={-1}>
      <header className={css.header}>
        <div>
          <p className={css.eyebrow}>{mode === 'new' ? '从一个问题，一位人物开始' : '在已有对话中增加一种视角'}</p>
          <h2>{mode === 'new' ? '选一位先哲，开启这份困惑。' : '你想与谁，聊聊这份困惑？'}</h2>
          <p className={css.description}>先看一眼，再翻到背面。选一种此刻需要的思考方式。</p>
        </div>
        <button type="button" className={css.close} aria-label="关闭人物卡册" disabled={busy} onClick={close}>×</button>
      </header>
      <div ref={deckRef} className={css.deck} onKeyDown={onDeckKeyDown} aria-label="人物卡片">
        {personas.map((persona, index) => {
          const presentation = getPersonaPresentation(persona.id)
          const isSelected = selected === persona.id
          const isJoined = joined.includes(persona.id)
          const isFlipped = flipped.has(persona.id)
          const status = mode === 'new' ? '可选择' : persona.id === activePersona ? '正在对话' : isJoined ? '已在此困惑' : '可邀请'
          return <article key={persona.id} className={`${css.card} ${isSelected ? css.chosen : ''}`} data-persona-card="true">
            <p className={css.status}>{status}</p>
            <div className={css.perspective}>
              <button type="button" data-flip="true" className={`${css.flip} ${isFlipped ? css.flipped : ''}`} aria-label={`翻看${persona.displayName}人物卡`} aria-pressed={isFlipped} onClick={() => { toggleFlip(persona.id) }}>
                <span className={css.inner}>
                  <span className={`${css.face} ${css.front}`} aria-hidden={isFlipped}>
                    <img className={css.portrait} src={presentation.portrait} alt="" />
                    <span className={css.frame} />
                    <span className={css.top}><span>{presentation.era}</span><span className={css.seal}>{presentation.seal}</span></span>
                    <span className={css.frontCopy}><span className={css.name}>{persona.displayName}</span><span className={css.tagline}>{presentation.tagline}</span><span className={css.themes}>{presentation.themes.map(theme => <span key={theme}>{theme}</span>)}</span><span className={css.flipPrompt}>翻面 · 了解人物视角 <span aria-hidden="true">↻</span></span></span>
                  </span>
                  <span className={`${css.face} ${css.back}`} aria-hidden={!isFlipped}>
                    <span className={css.backTop}><span>{persona.displayName}</span><span>{String(index + 1).padStart(2, '0')} / {String(personas.length).padStart(2, '0')}</span></span>
                    <span className={css.question}>{presentation.question}</span><span className={css.divider} />
                    <span className={css.backLabel}>适合聊什么</span><span className={css.backText}>{presentation.fit}</span>
                    <span className={css.backLabel}>会怎样追问</span><span className={css.backText}>{presentation.method}</span>
                    <span className={css.source}><span>资料范围</span>{presentation.source}</span>
                    <span className={css.backReturn}>↻ 翻回人物正面</span>
                  </span>
                </span>
              </button>
            </div>
            <button type="button" className={css.select} aria-pressed={isSelected} onClick={() => { setSelected(persona.id) }}>
              <span className={css.mark} aria-hidden="true" />{mode === 'new' ? `选择${persona.displayName}` : `邀请${persona.displayName}`}
            </button>
          </article>
        })}
      </div>
      <footer className={css.footer}>
        <div className={css.selection} aria-live="polite">
          {selectedPersona === undefined || selectedPresentation === undefined
            ? <><strong>还没有选定人物</strong><span>翻牌只了解人物，不会开始对话。</span></>
            : <><img className={css.selectedPortrait} src={selectedPresentation.portrait} alt="" /><span><strong>已选 · {selectedPersona.displayName}</strong><span>{selectedPresentation.tagline}</span></span></>}
        </div>
        <div className={css.actions}>
          <button type="button" className={css.secondary} disabled={busy} onClick={close}>返回</button>
          <button type="button" className={css.primary} disabled={busy || disabled || selected === undefined} onClick={() => { if (!busy && !disabled && selected !== undefined) onConfirm(selected) }}>{busy ? '正在处理…' : confirmLabel}</button>
        </div>
        {error === undefined || error === '' ? null : <p className={css.error} role="alert">{error}</p>}
      </footer>
    </section>
  </Modal>
}
