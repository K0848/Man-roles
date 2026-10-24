import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { MemoryMediaPool, MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import { ProductConversationRepository } from '../src/repository.ts'
import { dilemmaId, requestId, sessionId, turnOperationId, type ProductEvent } from '../src/product/index.ts'
import { productEventSchema } from '../src/spec.ts'

const branches = [
  { persona: 'wang-yangming' as const, sessionId: sessionId('wang') },
  { persona: 'zeng-guofan' as const, sessionId: sessionId('zeng') },
] as const

async function composition(pool: MemoryMediaPool) {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new MemoryStorageBackend(pool)
  ctx.storage.backend.register('memory', backend)
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', facility)
  return { backend, repository: new ProductConversationRepository(facility) }
}

const created: ProductEvent = {
  type: 'created', id: dilemmaId('d1'), branches, activePersona: 'wang-yangming', requestId: requestId('create-1'),
}

describe('ProductConversationRepository', () => {
  it('rejects unknown fields on persisted event and nested projection schemas', () => {
    expect(() => productEventSchema.parse({ type: 'renamed', title: 'x', requestId: requestId('r'), extra: true })).toThrow()
    expect(() => productEventSchema.parse({ type: 'context-projection', projection: { operationId: 'x', persona: 'wang-yangming', allowedEventIds: [], excludedEventIds: [], extra: true }, requestId: requestId('r') })).toThrow()
  })
  it('rejects an empty sidecar batch without writing', async () => {
    const pool = new MemoryMediaPool(); const composed = await composition(pool)
    await composed.repository.create(created)
    await expect(composed.repository.appendClaimSidecarsIfCurrent(dilemmaId('d1'), turnOperationId('turn-empty'), 0, [])).rejects.toThrow(/at least one claim/)
    expect(await composed.repository.readEvents(dilemmaId('d1'))).toEqual([created])
    await composed.repository.close(); await composed.backend.close()
  })
  it('replays the same projection after closing and reopening its durable medium', async () => {
    const pool = new MemoryMediaPool()
    const first = await composition(pool)
    await first.repository.create(created)
    await first.repository.append(dilemmaId('d1'), {
      type: 'user-message', id: 'u1', persona: 'wang-yangming', requestId: requestId('u1'),
    })
    await first.repository.append(dilemmaId('d1'), {
      type: 'persona-message', id: 'p1', persona: 'wang-yangming', sessionId: sessionId('wang'),
      sourceEventId: 's1', requestId: requestId('p1'),
    })
    const before = await first.repository.read(dilemmaId('d1'))
    await first.repository.close()
    await first.backend.close()

    const second = await composition(pool)
    expect(await second.repository.read(dilemmaId('d1'))).toEqual(before)
    expect((await second.repository.list()).map(conversation => conversation.id)).toEqual([dilemmaId('d1')])
    await second.repository.close()
    await second.backend.close()
  })

  it('deduplicates a repeated request in the persisted event list', async () => {
    const pool = new MemoryMediaPool()
    const first = await composition(pool)
    await first.repository.create(created)
    const event = { type: 'user-message' as const, id: 'u1', persona: 'wang-yangming' as const, requestId: requestId('same') }
    expect((await first.repository.append(dilemmaId('d1'), event)).accepted).toBe(true)
    expect((await first.repository.append(dilemmaId('d1'), event)).accepted).toBe(false)
    await first.repository.close()
    await first.backend.close()

    const second = await composition(pool)
    expect((await second.repository.read(dilemmaId('d1')))?.timeline).toEqual([
      { id: 'u1', kind: 'user-message', persona: 'wang-yangming' },
    ])
    await second.repository.close()
    await second.backend.close()
  })

  it('rejects a request-id reuse whose payload differs from the committed event', async () => {
    const pool = new MemoryMediaPool()
    const composed = await composition(pool)
    await composed.repository.create(created)
    await composed.repository.append(dilemmaId('d1'), {
      type: 'user-message', id: 'first', persona: 'wang-yangming', requestId: requestId('same'),
    })
    await expect(composed.repository.append(dilemmaId('d1'), {
      type: 'user-message', id: 'different', persona: 'wang-yangming', requestId: requestId('same'),
    })).rejects.toThrow(/conflicts with the existing product event/)
    await composed.repository.close()
    await composed.backend.close()
  })

  it('rejects a create replay that reuses its request id with different conversation facts', async () => {
    const pool = new MemoryMediaPool()
    const composed = await composition(pool)
    await composed.repository.create(created)
    await expect(composed.repository.create({ ...created, activePersona: 'zeng-guofan' }))
      .rejects.toThrow(/conflicts with the existing dilemma/)
    await composed.repository.close()
    await composed.backend.close()
  })
})
