import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject, RoleplayerUnavailableView } from '../src/client/index.ts'
import { RoleplayerView } from '../src/client/RoleplayerView.tsx'

const projection = {
  handle: 'dilemma:one', activePersona: 'wang-yangming' as const,
  branches: [{ persona: 'wang-yangming' as const }, { persona: 'zeng-guofan' as const }],
  timeline: [], revision: 1,
}

function remote() {
  const result = { ok: true as const, value: { ok: true as const, value: [projection] } }
  return {
    list: async () => result,
    getProjection: async () => ({ ok: true as const, value: { ok: true as const, value: projection } }),
    archive: async () => ({ ok: true as const, value: { ok: true as const, value: projection } }),
    restore: async () => ({ ok: true as const, value: { ok: true as const, value: projection } }),
    switchPersona: async () => ({ ok: true as const, value: { ok: true as const, value: projection } }),
    submit: async () => ({ ok: true as const, value: { ok: true as const, value: projection } }),
    cancel: async () => ({ ok: true as const, value: { ok: true as const, value: projection } }),
    delete: async () => ({ ok: true as const, value: { ok: true as const, value: { handle: projection.handle, deleted: true as const } } }),
    confirmState: async () => ({ ok: true as const, value: { ok: true as const, value: projection } }),
    modifyState: async () => ({ ok: true as const, value: { ok: true as const, value: projection } }),
    rejectState: async () => ({ ok: true as const, value: { ok: true as const, value: projection } }),
    withdrawState: async () => ({ ok: true as const, value: { ok: true as const, value: projection } }),
    resolveState: async () => ({ ok: true as const, value: { ok: true as const, value: projection } }),
    challengeEvidence: async () => ({ ok: true as const, value: { ok: true as const, value: projection } }),
    reviewEvidence: async () => ({ ok: true as const, value: { ok: true as const, value: projection } }),
    withdrawEvidence: async () => ({ ok: true as const, value: { ok: true as const, value: projection } }),
  }
}

describe('man-roleplayer client plugin', () => {
  it('declares the remote and registers one projection view through the product root slot', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const slots = ctx.get('slots') as SlotRegistry
    slots.register(
      { name: 'root', children: { 'conversation.view': { kind: 'list', scope: 'session' } } } as never,
      () => null,
    )
    const service = remote()
    ctx.provide('remote', { manRoleplayerRemote: service } as never)
    ctx.provide('remote.manRoleplayerRemote', service as never)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await Promise.resolve()
    const entries = slots.entries('root')
    expect(entries.filter(entry => entry.component === RoleplayerView)).toHaveLength(1)
    const entry = entries.find(entry => entry.component === RoleplayerView)
    if (entry === undefined) throw new Error('roleplayer view entry was not registered')
    const injected = entry.inject === undefined
      ? undefined : Reflect.apply(entry.inject, entry, []) as unknown as { hooks?: unknown }
    expect(typeof injected?.hooks).toBe('object')
    await fiber.dispose()
    expect(slots.entries('root').some(entry => entry.component === RoleplayerView)).toBe(false)
  })

  it('renders a non-interactive product failure state when the Remote namespace is missing', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const slots = ctx.get('slots') as SlotRegistry
    ctx.provide('remote', {} as never)
    const fiber = ctx.plugin({ inject: ['slots', 'remote'], apply })
    await fiber.await()
    expect(slots.entries('root').some(entry => entry.component === RoleplayerUnavailableView)).toBe(true)
    await fiber.dispose()
  })

  it('replaces the unavailable surface when the Remote namespace mounts later', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const slots = ctx.get('slots') as SlotRegistry
    ctx.provide('remote', {} as never)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(slots.entries('root').some(entry => entry.component === RoleplayerUnavailableView)).toBe(true)
    ctx.provide('remote.manRoleplayerRemote', remote() as never)
    await Promise.resolve()
    expect(slots.entries('root').some(entry => entry.component === RoleplayerUnavailableView)).toBe(false)
    expect(slots.entries('root').some(entry => entry.component === RoleplayerView)).toBe(true)
    await fiber.dispose()
  })
})
