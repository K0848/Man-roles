// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PersonaId, RoleplayerPersonaOption } from '@deepseek-ai/dsh-man-roleplayer/types'
import { PersonaDeck } from '../src/client/PersonaDeck.tsx'
import { getPersonaPresentation } from '../src/client/persona-presentation.ts'
type PersonaDeckProps = Parameters<typeof PersonaDeck>[0]

afterEach(() => { cleanup() })

const personas: readonly RoleplayerPersonaOption[] = [
  { id: 'wang-yangming', displayName: '王阳明' },
  { id: 'zeng-guofan', displayName: '曾国藩' },
  { id: 'zhuangzi', displayName: '庄子' },
]
function renderDeck(overrides: Partial<PersonaDeckProps> = {}) {
  const useSessions: PersonaDeckProps['useSessions'] = () => { throw new Error('unused by PersonaDeck') }
  const useWorkspaces: PersonaDeckProps['useWorkspaces'] = () => { throw new Error('unused by PersonaDeck') }
  const props = {
    mode: 'new' as const, personas, joined: [] as readonly PersonaId[],
    busy: false, disabled: false,
    useSessions, useWorkspaces,
    onConfirm: vi.fn(), onClose: vi.fn(),
    ...overrides,
  }
  const result = render(<PersonaDeck {...props} />)
  return { ...result, props }
}

describe('PersonaDeck', () => {
  it('renders only roster props and keeps inspection separate from explicit selection and confirmation', () => {
    const { props } = renderDeck({ personas: [personas[2]!] })
    expect(screen.getByRole('button', { name: '翻看庄子人物卡' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '翻看王阳明人物卡' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '翻看庄子人物卡' }))
    expect(screen.getByText(/你拿来衡量自己的那把尺/)).toBeTruthy()
    expect(props.onConfirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '选择庄子' }))
    expect(props.onConfirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '开始这份困惑' }))
    expect(props.onConfirm).toHaveBeenCalledWith('zhuangzi')
  })

  it('marks joined personas in invite mode while keeping them selectable', () => {
    const { props } = renderDeck({ mode: 'invite', joined: ['zeng-guofan'], activePersona: 'zeng-guofan' })
    expect(screen.getByText('正在对话')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '邀请曾国藩' }))
    expect(screen.getByRole('button', { name: '继续与曾国藩对话' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '继续与曾国藩对话' }))
    expect(props.onConfirm).toHaveBeenCalledWith('zeng-guofan')
  })

  it('keeps the selected card and exposes an error while offline confirmation is disabled', () => {
    renderDeck({ mode: 'invite', disabled: true, error: '暂时无法连接' })
    fireEvent.click(screen.getByRole('button', { name: '邀请王阳明' }))
    expect(screen.getByRole('button', { name: '邀请王阳明入座' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('alert').textContent).toBe('暂时无法连接')
    expect(screen.getByRole('button', { name: '返回' }).hasAttribute('disabled')).toBe(false)
  })

  it('prevents duplicate confirmation and close while busy', () => {
    const { props } = renderDeck({ busy: true })
    fireEvent.click(screen.getByRole('button', { name: '选择王阳明' }))
    fireEvent.click(screen.getByRole('button', { name: '正在处理…' }))
    fireEvent.click(screen.getByRole('button', { name: '返回' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onConfirm).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('supports card flip and left/right keyboard navigation', () => {
    const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    try {
      renderDeck()
      const first = screen.getByRole('button', { name: '翻看王阳明人物卡' })
      fireEvent.keyDown(first, { key: 'ArrowRight' })
      expect(document.activeElement).toBe(screen.getByRole('button', { name: '翻看曾国藩人物卡' }))
      fireEvent.keyDown(document.activeElement!, { key: ' ' })
      fireEvent.click(document.activeElement!)
      expect(screen.getByRole('button', { name: '翻看曾国藩人物卡' }).getAttribute('aria-pressed')).toBe('true')
    } finally {
      if (scrollIntoViewDescriptor === undefined) Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
      else Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoViewDescriptor)
    }
  })

  it('returns source-backed presentation metadata with the product portrait contract', () => {
    expect(getPersonaPresentation('wang-yangming').portrait).toBe('/man-roleplayer/portraits/wang-yangming.png')
    expect(getPersonaPresentation('zeng-guofan').tagline).toBe('日日有功，稳步向前')
  })
})
