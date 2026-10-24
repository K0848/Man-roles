/** Minimal REAL Loader composition support for the T0 context harness. */
import { lstat, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Include from '../../../../vendor/include/src/index.ts'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import SessionStore from '@deepseek-ai/dsh-session'
import SessionPersistenceJsonl from '@deepseek-ai/dsh-session-persistence-jsonl'
import Storage, { storageBackendServiceKey } from '@deepseek-ai/dsh-storage'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as Product from '@deepseek-ai/dsh-man-roleplayer'
import type { Context as CordisContext } from '@deepseek-ai/cordis'
import { MemoryMediaPool, MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'

const pools = new Map<string, MemoryMediaPool>()

function assertOwnedRoot(root: string): void {
  if (resolve(root) !== root || dirname(root) !== resolve(tmpdir())
    || !basename(root).startsWith('dsh-man-roleplayer-t0-') || !pools.has(root)) {
    throw new Error('T0 fixture does not own this temporary root: ' + root)
  }
}

function createMemoryBackendPlugin(pool: MemoryMediaPool) {
  return {
    name: 't0-memory-storage', inject: ['storage'],
    apply(ctx: CordisContext): void {
      const backend = new MemoryStorageBackend(pool)
      const unregister = ctx.storage.backend.register('memory', backend)
      const unprovide = ctx.provide(storageBackendServiceKey('memory'), {})
      ctx.effect(() => async () => { unprovide(); unregister(); await backend.close() }, 'T0 memory storage')
    },
  }
}

/** Create an isolated temp root and mount the production Loader composition. */
export async function createT0Composition(existingRoot?: string): Promise<{ ctx: Context; root: string }> {
  if (existingRoot !== undefined) assertOwnedRoot(existingRoot)
  const root = existingRoot ?? await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-t0-'))
  const pool = pools.get(root) ?? new MemoryMediaPool()
  pools.set(root, pool)
  const ctx = new Context(); ctx.baseUrl = pathToFileURL(root).href + '/'
  try {
    await mkdir(join(root, 'sessions'), { recursive: true })
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@deepseek-ai/dsh-llm'",
      "- name: '@deepseek-ai/dsh-session'",
      "- name: '@deepseek-ai/dsh-system-prompt'",
      '  config:',
      "    persona: 't0 test persona'",
      "- name: '@deepseek-ai/dsh-tools'",
      "- name: '@deepseek-ai/dsh-agent'",
      '  config:',
      '    agents: []',
      "- name: '@deepseek-ai/dsh-agent-loop'",
      "- name: '@deepseek-ai/dsh-session-persistence-jsonl'",
      '  config:',
      `    root: ${JSON.stringify(join(root, 'sessions'))}`,
      "- name: '@deepseek-ai/dsh-storage'",
      "- name: 't0-memory-storage'",
      "- name: '@deepseek-ai/dsh-storage-domain'",
      '  config:',
      "    backend: 'memory'",
      "- name: '@deepseek-ai/dsh-man-roleplayer'",
      '',
    ].join('\n'))
    await ctx.plugin(Loader); ctx.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-llm', LlmRuntime], ['@deepseek-ai/dsh-session', SessionStore],
      ['@deepseek-ai/dsh-system-prompt', SystemPrompt], ['@deepseek-ai/dsh-tools', ToolRuntime],
      ['@deepseek-ai/dsh-agent', AgentRegistry], ['@deepseek-ai/dsh-agent-loop', AgentLoop],
      ['@deepseek-ai/dsh-session-persistence-jsonl', SessionPersistenceJsonl], ['@deepseek-ai/dsh-storage', Storage],
      ['t0-memory-storage', createMemoryBackendPlugin(pool)], ['@deepseek-ai/dsh-storage-domain', StorageDomain],
      ['@deepseek-ai/dsh-man-roleplayer', Product],
    ])
    ctx.loader.internal = { version: 'v2', async import(specifier: string) {
      const module = modules.get(specifier); if (module === undefined) throw new Error(`unexpected T0 import: ${specifier}`); return module
    } } as unknown as NonNullable<typeof ctx.loader.internal>
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await ctx.loader.await()
    return { ctx, root }
  } catch (error) {
    try { await disposeT0Composition(ctx, root) }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'T0 startup and cleanup failed') }
    throw error
  }
}

/** Remove one exact T0 temp root after its Loader has been disposed. */
export async function disposeT0Composition(ctx: Context, root: string): Promise<void> {
  assertOwnedRoot(root)
  await ctx.fiber.dispose()
  // 只清理本 fixture 创建的真实临时目录；不跟随后来替换成的链接或目录联接。
  const entry = await lstat(root)
  if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('T0 cleanup requires an owned real directory')
  await rm(root, { recursive: true, force: false })
  const pool = pools.get(root)
  pool?.media.clear(); pool?.versions.clear(); pools.delete(root)
}
