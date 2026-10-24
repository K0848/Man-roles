import { describe, expect, it } from 'vitest'
import { shouldUseShippedPresetRoot } from '../src/profile-boot.ts'

describe('profile preset-root compatibility', () => {
  it('keeps shipped precedence for ordinary Web/headless and custom profiles without explicit roots', () => {
    expect(shouldUseShippedPresetRoot('web', {})).toBe(true)
    expect(shouldUseShippedPresetRoot('headless', {})).toBe(true)
    expect(shouldUseShippedPresetRoot('custom', { default: 'standard' })).toBe(true)
    expect(shouldUseShippedPresetRoot('custom', { roots: [] })).toBe(true)
  })

  it('preserves a non-empty explicit root for any custom product composition', () => {
    expect(shouldUseShippedPresetRoot('custom', { roots: [{ path: 'product-presets', trust: 'system' }] })).toBe(false)
  })
})
