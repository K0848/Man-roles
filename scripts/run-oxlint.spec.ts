import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { resolveOxlintInvocation } from './run-oxlint.ts'

const defaultConfig = fileURLToPath(new URL('../.oxlintrc.json', import.meta.url))

describe('Oxlint invocation', () => {
  it('preserves the ordinary default invocation', () => {
    expect(resolveOxlintInvocation(['.'], { PATH: '/bin' })).toEqual({
      args: ['.', '--config', defaultConfig],
      env: { PATH: '/bin' },
    })
  })

  it('bounds both worker pools from one setting', () => {
    expect(resolveOxlintInvocation(['.', '--fix'], { DSH_OXLINT_THREADS: '4', GOMAXPROCS: '12' })).toEqual({
      args: ['.', '--fix', '--config', defaultConfig, '--threads=4'],
      env: { DSH_OXLINT_THREADS: '4', GOMAXPROCS: '4' },
    })
  })

  it('uses location-preserving diagnostics in CI', () => {
    expect(resolveOxlintInvocation(['.'], { CI: 'true', DSH_OXLINT_THREADS: '4' })).toEqual({
      args: ['.', '--config', defaultConfig, '--format=unix', '--threads=4'],
      env: { CI: 'true', DSH_OXLINT_THREADS: '4', GOMAXPROCS: '4' },
    })
  })

  it('preserves an explicitly selected CI formatter', () => {
    expect(resolveOxlintInvocation(['.', '--format', 'github'], { CI: 'true' }).args)
      .toEqual(['.', '--format', 'github', '--config', defaultConfig])
  })

  it.each([
    ['--config', 'custom.json'], ['--config=custom.json'], ['-c', 'custom.json'],
  ])('preserves an explicitly selected configuration %j', (...selection) => {
    expect(resolveOxlintInvocation(['.', ...selection], {}).args).toEqual(['.', ...selection])
  })

  it.each(['0', '-1', '1.5', 'auto'])('rejects invalid worker bound %s', (value) => {
    expect(() => resolveOxlintInvocation(['.'], { DSH_OXLINT_THREADS: value }))
      .toThrow('DSH_OXLINT_THREADS must be a positive integer')
  })

  it('rejects a competing direct worker bound', () => {
    expect(() => resolveOxlintInvocation(['.', '--threads=2'], { DSH_OXLINT_THREADS: '4' }))
      .toThrow('use DSH_OXLINT_THREADS instead')
  })
})
