import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { dilemmaId, requestId, sessionId } from '../src/product/index.ts'
import { AgentStopTimeoutError, ManRoleplayer } from '../src/service.ts'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'

describe('ManRoleplayer lifecycle', () => {
  it('closes its durable product domain even when owned agent disposal times out', async () => {
    const ctx = new Context()
    await ctx.plugin(Storage)
    ctx.storage.backend.register('memory', new MemoryStorageBackend())
    const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
    ctx.storage.mount('domain', facility)
    ctx.provide('storageDomain', facility)
    const never = new Promise<void>(() => {})
    ctx.provide('agents', {
      create: async () => ({ agent: {} as never, dispose: () => never }),
    } as never)
    const product = new ManRoleplayer(ctx, { delete: async () => false } as never, 1)
    await product.open()
    await product.create({
      id: dilemmaId('timeout-close'), requestId: requestId('create-timeout'), activePersona: 'wang-yangming',
      branches: [
        { persona: 'wang-yangming', sessionId: sessionId('timeout-wang') },
        { persona: 'zeng-guofan', sessionId: sessionId('timeout-zeng') },
      ],
    })
    await expect(product.close()).rejects.toBeInstanceOf(AgentStopTimeoutError)
    expect(facility.get('man_roleplayer_product')).toBeUndefined()
    await ctx.fiber.dispose()
  })
})
