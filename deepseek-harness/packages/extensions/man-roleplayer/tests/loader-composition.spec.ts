/** REAL Loader composition: variable DSH branches, durable product events, restart, and coordinated delete. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Include from '../../../../vendor/include/src/index.ts'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import LlmRuntime, { CallId, createAssistantMessage, createToolResultMessage, createUserMessage, LlmAdapter, ReasoningEffortId, type GenerateOptions, type LlmResolvedModelInfo, type StreamChunk } from '@deepseek-ai/dsh-llm'
import SessionStore from '@deepseek-ai/dsh-session'
import SessionPersistenceJsonl from '@deepseek-ai/dsh-session-persistence-jsonl'
import Storage, { storageBackendServiceKey } from '@deepseek-ai/dsh-storage'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { DilemmaId } from '../src/product/index.ts'
import AgentPresets from '@deepseek-ai/dsh-agent-presets'
import * as Persona from '@deepseek-ai/dsh-persona'
import type {} from '../src/index.ts'
import { deliveryOperationId, dilemmaId, messageId, operationId, requestId, sessionId, turnOperationId, type DilemmaConversation, type ProductEvent } from '../src/product/index.ts'
import { ProductConversationRepository } from '../src/repository.ts'
import type { ManRoleplayerOperationId, ManRoleplayerRequestId } from '../src/types.ts'
import { MemoryMediaPool, MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import { MockAdapter, textResponse, toolCallResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'

let root: string | undefined
const contexts: Context[] = []
const pool = new MemoryMediaPool()
const localPresetRoot = fileURLToPath(new URL('../presets/', import.meta.url))

async function waitForBackgroundQuiet(ctx: Context): Promise<void> {
  const product = ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const conversations = await ctx.manRoleplayer.list(true)
    let busy = false
    for (const conversation of conversations) {
      if (await ctx.manRoleplayer.activeTurn(conversation.id) !== undefined) { busy = true; break }
      const events = await product.repository.readEvents(conversation.id) ?? []
      if (events.some(event => (event.type === 'state-analysis' && (event.status === 'claimed' || event.status === 'running'))
        || (event.type === 'title' && event.status === 'claimed'))) { busy = true; break }
    }
    if (!busy) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

async function waitForActiveTurn(ctx: Context, id: DilemmaId): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await ctx.manRoleplayer.activeTurn(id) !== undefined) return
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new Error(`active turn did not become observable for ${id}`)
}

class ControlledStateAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  readonly started: Promise<void>
  private releaseStream!: () => void
  private markStarted!: () => void
  constructor(private readonly chunks: readonly StreamChunk[]) {
    super()
    this.started = new Promise((resolve) => { this.markStarted = resolve })
  }
  release(): void { this.releaseStream() }
  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model })
  }
  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options); this.markStarted()
    await new Promise<void>((resolve) => { this.releaseStream = resolve })
    yield* this.chunks
  }
}

class ChallengeBeforeSubmitAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  private call = 0

  constructor(private readonly beforeSubmit: () => Promise<void>, private readonly submitArguments: object) {
    super()
  }

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model })
  }

  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    this.call++
    if (this.call === 1) yield* toolCallResponse('challenge-lookup', 'evidence_lookup', { topic: '阳明事迹', requestedCount: 1 })
    else if (this.call === 2) {
      await this.beforeSubmit()
      yield* toolCallResponse('challenge-submit', 'persona_turn_submit', this.submitArguments)
    } else yield* textResponse('unstructured after stale submission')
  }
}

afterEach(async () => {
  await Promise.all(contexts.map(ctx => waitForBackgroundQuiet(ctx)))
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
  pool.media.clear()
  pool.versions.clear()
})

const memoryBackendPlugin = {
  name: 'fixture-memory-storage',
  inject: ['storage'],
  apply(ctx: Context): void {
    const backend = new MemoryStorageBackend(pool)
    const unregister = ctx.storage.backend.register('memory', backend)
    const unprovide = ctx.provide(storageBackendServiceKey('memory'), {})
    ctx.effect(() => async () => {
      unprovide()
      unregister()
      await backend.close()
    }, 'fixture memory storage')
  },
}

async function loadComposition(
  sessionRoot: string,
  research?: { wangYangmingPath: string; zengGuofanPath: string },
  presets?: { root: string; wangYangming: string; zengGuofan: string },
  agentOptions?: { provider: string; model: string },
  stateAnalysis = false,
  turnBudget?: {
    maxModelRequests?: number
    maxToolCalls?: number
    activeTimeoutMs?: number
    requestTimeoutMs?: number
    noProgressLimit?: number
    stopTimeoutMs?: number
  },
): Promise<Context> {
  const configPath = join(root!, `cordis-${contexts.length}.yml`)
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-llm'",
    "- name: '@deepseek-ai/dsh-session'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    '  config:',
    "    persona: 'test persona'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-agent'",
    "- name: '@deepseek-ai/dsh-agent-loop'",
    '  config:',
    '    agents: []',
    "- name: '@deepseek-ai/dsh-session-persistence-jsonl'",
    '  config:',
    `    root: ${JSON.stringify(sessionRoot)}`,
    "- name: '@deepseek-ai/dsh-storage'",
    "- name: 'fixture-memory-storage'",
    "- name: '@deepseek-ai/dsh-storage-domain'",
    '  config:',
    "    backend: 'memory'",
    ...(presets === undefined ? [] : [
      "- name: '@deepseek-ai/dsh-agent-presets'",
      '  config:',
      '    default: wang-yangming',
      `    roots: ${JSON.stringify([{ path: presets.root, trust: 'system' }])}`,
      '    includeUserRoot: false',
    ]),
    "- name: '@deepseek-ai/dsh-man-roleplayer'",
    ...(research === undefined && presets === undefined && agentOptions === undefined ? [] : [
      '  config:',
      ...(research === undefined ? [] : [`    research: ${JSON.stringify(research)}`]),
      ...(presets === undefined ? [] : [`    presets: ${JSON.stringify({ wangYangming: presets.wangYangming, zengGuofan: presets.zengGuofan })}`]),
      ...(agentOptions === undefined ? [] : [`    agentOptions: ${JSON.stringify(agentOptions)}`]),
      ...(stateAnalysis ? ['    stateAnalysis: true'] : []),
      ...(turnBudget === undefined ? [] : [`    turnBudget: ${JSON.stringify(turnBudget)}`]),
    ]),
    '',
  ].join('\n'))
  const ctx = new Context()
  ctx.baseUrl = pathToFileURL(root!).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const productPlugin = await import('@deepseek-ai/dsh-man-roleplayer')
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-llm', LlmRuntime],
    ['@deepseek-ai/dsh-session', SessionStore],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['@deepseek-ai/dsh-agent', AgentRegistry],
    ['@deepseek-ai/dsh-agent-loop', AgentLoop],
    ['@deepseek-ai/dsh-session-persistence-jsonl', SessionPersistenceJsonl],
    ['@deepseek-ai/dsh-storage', Storage],
    ['fixture-memory-storage', memoryBackendPlugin],
    ['@deepseek-ai/dsh-storage-domain', StorageDomain],
    ['@deepseek-ai/dsh-agent-presets', AgentPresets],
    ['@deepseek-ai/dsh-persona', Persona],
    ['@deepseek-ai/dsh-man-roleplayer', productPlugin],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  try {
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await ctx.loader.await()
    contexts.push(ctx)
    return ctx
  } catch (error) {
    await ctx.fiber.dispose()
    throw error
  }
}

async function materializeBranches(ctx: Context): Promise<void> {
  for (const session of ctx.sessions.list()) {
    session.append('turn/start', { turn: 1 })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('step/end', { turn: 1, step: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    await ctx.sessions.flush(session)
  }
}

function personaSubmitArguments(
  text: string,
  kind: 'reliable-quote' | 'historical-fact' | 'attribution' | 'modern-inference' | 'insufficient-evidence' = 'modern-inference',
  evidenceIds: readonly string[] = [],
): { readonly segments: readonly { readonly text: string; readonly kind: typeof kind; readonly evidenceIds: readonly string[] }[] } {
  return { segments: [{ text, kind, evidenceIds }] }
}

function personaSubmitResponse(callId: string, text: string): StreamChunk[] {
  return toolCallResponse(callId, 'persona_turn_submit', personaSubmitArguments(text), text)
}

async function structuredEvidenceCase(options: {
  readonly name: string
  readonly wangSource: string
  readonly wangTitle: string
  readonly evidenceId: string
  readonly evidenceType: 'quote' | 'historical-fact' | 'attribution'
  readonly claimKind: 'reliable-quote' | 'historical-fact' | 'attribution'
  readonly answer: string
}): Promise<{ readonly result: DilemmaConversation; readonly events: readonly ProductEvent[]; readonly adapter: MockAdapter }> {
  root = await mkdtemp(join(tmpdir(), `dsh-man-roleplayer-structured-evidence-${options.name}-`))
  const wangPath = join(root, '调研成果-王阳明.md'); const zengPath = join(root, '调研成果-曾国藩.md')
  const zengCard = '> persona_id：`曾国藩`\n### 【事迹卡 1】\n- **title**：曾资料\n- **full_text**：曾资料材料\n- **source**：《正式史料》\n'
  await writeFile(wangPath, options.wangSource); await writeFile(zengPath, zengCard)
  const ctx = await loadComposition(join(root, 'sessions'), { wangYangmingPath: wangPath, zengGuofanPath: zengPath }, { root: localPresetRoot, wangYangming: 'wang-yangming', zengGuofan: 'zeng-guofan' })
  const adapter = new MockAdapter([
    toolCallResponse(`${options.name}-lookup`, 'evidence_lookup', { topic: options.wangTitle, requestedCount: 1 }),
    toolCallResponse(`${options.name}-submit`, 'persona_turn_submit', personaSubmitArguments(options.answer, options.claimKind, [options.evidenceId])),
    textResponse(`${options.name}-title`),
  ])
  ctx.llm.registerAdapter(['mock'], adapter)
  const id = dilemmaId(`${options.name}-loader`); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId(`${options.name}-wang`) }, { persona: 'zeng-guofan' as const, sessionId: sessionId(`${options.name}-zeng`) }] as const
  await ctx.manRoleplayer.create({ id, requestId: requestId(`${options.name}-create`), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
  const result = await ctx.manRoleplayer.submitMessage(id, { messageId: messageId(`${options.name}-message`), deliveryOperationId: deliveryOperationId(`${options.name}-delivery`), turnOperationId: turnOperationId(`${options.name}-turn`), text: `${options.name} input`, requestId: requestId(`${options.name}-request`) })
  const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
  return { result, events: events ?? [], adapter }
}

describe('man-roleplayer real Loader composition', () => {
  it('starts with one branch, adds two personas idempotently, and restores the roster after restart', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-dynamic-roster-'))
    const sessionRoot = join(root, 'sessions')
    const first = await loadComposition(sessionRoot)
    const id = dilemmaId('dynamic-roster-loader')
    await first.manRoleplayer.create({
      id, requestId: requestId('dynamic-roster-create'),
      branches: [{ persona: 'wang-yangming', sessionId: sessionId('dynamic-roster-wang') }],
      activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' },
    })
    const initial = await first.manRoleplayer.read(id)
    expect(initial?.branches.map(branch => branch.persona)).toEqual(['wang-yangming'])
    const joinedZeng = await first.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('dynamic-roster-join-zeng'))
    const joinedZhuangzi = await first.manRoleplayer.switchPersona(id, 'zhuangzi', requestId('dynamic-roster-join-zhuangzi'))
    expect(joinedZhuangzi.branches.map(branch => branch.persona)).toEqual(['wang-yangming', 'zeng-guofan', 'zhuangzi'])
    const sessionIds = joinedZhuangzi.branches.map(branch => branch.sessionId)
    const repeated = await first.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('dynamic-roster-return-zeng'))
    expect(repeated.branches.map(branch => branch.sessionId)).toEqual(sessionIds)
    expect(repeated.branches).toHaveLength(3)
    expect(joinedZeng.activePersona).toBe('zeng-guofan')
    await materializeBranches(first)
    await first.fiber.dispose(); contexts.splice(contexts.indexOf(first), 1)

    const second = await loadComposition(sessionRoot)
    const restored = await second.manRoleplayer.resume(id, { provider: 'mock', model: 'mock' })
    expect(restored.branches.map(branch => branch.persona)).toEqual(['wang-yangming', 'zeng-guofan', 'zhuangzi'])
    expect(restored.activePersona).toBe('zeng-guofan')
    for (const branch of restored.branches) expect(second.agents.get(branch.sessionId)).toBeDefined()
  })

  it('deletes every dynamically added branch and resumes a failed checkpoint with the same operation', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-dynamic-delete-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const id = dilemmaId('dynamic-delete-loader')
    await ctx.manRoleplayer.create({
      id, requestId: requestId('dynamic-delete-create'),
      branches: [{ persona: 'wang-yangming', sessionId: sessionId('dynamic-delete-wang') }],
      activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' },
    })
    await ctx.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('dynamic-delete-join-zeng'))
    await ctx.manRoleplayer.switchPersona(id, 'zhuangzi', requestId('dynamic-delete-join-zhuangzi'))
    const conversation = await ctx.manRoleplayer.read(id)
    if (conversation === undefined) throw new Error('dynamic delete conversation was not created')
    const deletionRequest = operationId('dynamic-delete-operation')
    await ctx.manRoleplayer.requestDeletion(id, { operationId: deletionRequest, stage: 'requested', irreversible: false }, requestId('dynamic-delete-request'), conversation.lifecycleRevision)
    const persistence = (ctx.manRoleplayer as unknown as { persistence: { delete: (sessionId: import('@deepseek-ai/dsh-session').SessionId) => Promise<void> } }).persistence
    const originalDelete = persistence.delete.bind(persistence)
    let injected = true
    vi.spyOn(persistence, 'delete').mockImplementation(async (session) => {
      if (injected && String(session).includes('zeng-guofan')) { injected = false; throw new Error('injected branch delete failure') }
      await originalDelete(session)
    })
    const failed = await ctx.manRoleplayer.delete(id, deletionRequest)
    expect(failed.stage).toBe('failed')
    expect(failed.targets).toHaveLength(3)
    expect(failed.completedSessionIds).toHaveLength(1)
    const resumed = await ctx.manRoleplayer.delete(id, deletionRequest)
    expect(resumed.stage).toBe('completed')
    expect(await ctx.manRoleplayer.read(id)).toBeUndefined()
    expect((await ctx.manRoleplayer.readDeletionReceipt(deletionRequest))?.status).toBe('completed')
  })

  it('includes a claimed but unpublished branch in deletion targets', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-claimed-delete-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const id = dilemmaId('claimed-delete-loader')
    await ctx.manRoleplayer.create({
      id, requestId: requestId('claimed-delete-create'),
      branches: [{ persona: 'wang-yangming', sessionId: sessionId('claimed-delete-wang') }],
      activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' },
    })
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    const claimedSession = sessionId('claimed-delete-zeng')
    await repository.append(id, {
      type: 'branch-allocation',
      allocation: { operationId: operationId('claimed-delete-allocation'), persona: 'zeng-guofan', sessionId: claimedSession, expectedLifecycleRevision: 1, status: 'claimed' },
      requestId: requestId('claimed-delete-claim'),
    })
    const conversation = await ctx.manRoleplayer.read(id)
    if (conversation === undefined) throw new Error('claimed delete conversation was not created')
    const deletion = operationId('claimed-delete-operation')
    await ctx.manRoleplayer.requestDeletion(id, { operationId: deletion, stage: 'requested', irreversible: false }, requestId('claimed-delete-request'), conversation.lifecycleRevision)
    const completed = await ctx.manRoleplayer.delete(id, deletion)
    expect(completed.stage).toBe('completed')
    expect(completed.targets?.map(target => target.sessionId)).toEqual(['claimed-delete-wang', 'claimed-delete-zeng'])
    expect(completed.completedSessionIds).toHaveLength(2)
  })

  it('cold-reads a legacy deletion checkpoint and continues it after restart', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-legacy-delete-recovery-'))
    const sessionRoot = join(root, 'sessions')
    const first = await loadComposition(sessionRoot)
    const id = dilemmaId('legacy-delete-recovery-loader')
    const branches = [
      { persona: 'wang-yangming' as const, sessionId: sessionId('legacy-delete-recovery-wang') },
      { persona: 'zeng-guofan' as const, sessionId: sessionId('legacy-delete-recovery-zeng') },
    ] as const
    await first.manRoleplayer.create({ id, requestId: requestId('legacy-delete-recovery-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const repository = (first.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    await repository.append(id, {
      type: 'deletion',
      operation: { operationId: operationId('legacy-delete-recovery-operation'), stage: 'deleting-wang', irreversible: true },
      requestId: requestId('legacy-delete-recovery-checkpoint'),
    })
    await materializeBranches(first)
    await first.fiber.dispose(); contexts.splice(contexts.indexOf(first), 1)
    const second = await loadComposition(sessionRoot)
    expect((await second.manRoleplayer.read(id))?.deletion?.stage).toBe('deleting-wang')
    await expect(second.manRoleplayer.delete(id, operationId('legacy-delete-recovery-operation'))).resolves.toMatchObject({ stage: 'completed' })
    expect(await second.manRoleplayer.read(id)).toBeUndefined()
  })

  it('retries a failed first join with the original branch allocation and Session id', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-branch-recovery-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const id = dilemmaId('branch-recovery-loader')
    await ctx.manRoleplayer.create({
      id, requestId: requestId('branch-recovery-create'),
      branches: [{ persona: 'wang-yangming', sessionId: sessionId('branch-recovery-wang') }],
      activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' },
    })
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    const originalAppend = repository.append.bind(repository)
    let injected = true
    vi.spyOn(repository, 'append').mockImplementation(async (dilemma, event) => {
      if (injected && event.type === 'branch-added') {
        injected = false
        throw new Error('injected branch association failure')
      }
      return originalAppend(dilemma, event)
    })
    await expect(ctx.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('branch-recovery-join'))).rejects.toThrow(/association failure/)
    const failed = await ctx.manRoleplayer.read(id)
    expect(failed?.branches.map(branch => branch.persona)).toEqual(['wang-yangming'])
    expect(failed?.branchAllocations).toHaveLength(1)
    expect(failed?.branchAllocations[0]?.status).toBe('failed')
    const allocatedSession = failed?.branchAllocations[0]?.sessionId
    vi.restoreAllMocks()
    const recovered = await ctx.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('branch-recovery-retry'))
    expect(recovered.branches.map(branch => branch.persona)).toEqual(['wang-yangming', 'zeng-guofan'])
    expect(recovered.branches.find(branch => branch.persona === 'zeng-guofan')?.sessionId).toBe(allocatedSession)
    expect(recovered.branchAllocations).toHaveLength(1)
  })

  it('recovers a Session-created-before-branch-added allocation after a cold Loader restart', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-branch-cold-recovery-'))
    const sessionRoot = join(root, 'sessions')
    const first = await loadComposition(sessionRoot)
    const id = dilemmaId('branch-cold-recovery-loader')
    await first.manRoleplayer.create({
      id, requestId: requestId('branch-cold-recovery-create'),
      branches: [{ persona: 'wang-yangming', sessionId: sessionId('branch-cold-recovery-wang') }],
      activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' },
    })
    const claimedSession = sessionId('branch-cold-recovery-zeng')
    const claimedHandle = await first.agents.create({ sessionId: claimedSession, agentOptions: { provider: 'mock', model: 'mock' } })
    const repository = (first.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    await repository.append(id, {
      type: 'branch-allocation',
      allocation: { operationId: operationId('branch-cold-recovery-allocation'), persona: 'zeng-guofan', sessionId: claimedSession, expectedLifecycleRevision: 1, status: 'claimed' },
      requestId: requestId('branch-cold-recovery-claim'),
    })
    await materializeBranches(first)
    await claimedHandle.dispose()
    await first.fiber.dispose(); contexts.splice(contexts.indexOf(first), 1)

    const second = await loadComposition(sessionRoot)
    const recovered = await second.manRoleplayer.resume(id, { provider: 'mock', model: 'mock' })
    expect(recovered.branches.map(branch => branch.persona)).toEqual(['wang-yangming', 'zeng-guofan'])
    expect(recovered.branches.find(branch => branch.persona === 'zeng-guofan')?.sessionId).toBe(claimedSession)
    const events = await (second.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(events?.filter(event => event.type === 'branch-added' && event.operationId === operationId('branch-cold-recovery-allocation'))).toHaveLength(1)
  })

  it('accepts a same-turn reliable historical-fact claim returned by evidence_lookup', async () => {
    const { result, events, adapter } = await structuredEvidenceCase({
      name: 'structured-fact', wangSource: '> persona_id：`王阳明`\n### 【事迹卡 1】\n- **title**：阳明事迹\n- **full_text**：阳明事迹材料\n- **source**：《正式史料》\n', wangTitle: '阳明事迹', evidenceId: 'wang-yangming:research:1', evidenceType: 'historical-fact', claimKind: 'historical-fact', answer: '史实回答',
    })
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'structured-fact-message', status: 'delivered' }))
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'structured-fact-turn', status: 'completed' }))
    expect(events.some(event => event.type === 'evidence-tool-claim' && event.status === 'completed' && event.returnedEvidenceIds?.includes('wang-yangming:research:1'))).toBe(true)
    expect(events.some(event => event.type === 'claim-sidecar' && event.status === 'accepted' && event.kind === 'historical-fact')).toBe(true)
    expect(adapter.requests.filter(request => request.purpose === 'session-title')).toHaveLength(1)
  })

  it('rejects first-person lived-experience narration backed only by a historical account', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-historical-first-person-'))
    const wangPath = join(root, '调研成果-王阳明.md'); const zengPath = join(root, '调研成果-曾国藩.md')
    await writeFile(wangPath, '> persona_id：`王阳明`\n### 【事迹卡 1】\n- **evidence_kind**：史传记载\n- **title**：贬谪经历\n- **full_text**：史书记载王阳明曾遭贬谪。\n- **source**：《明史》✅\n')
    await writeFile(zengPath, '> persona_id：`曾国藩`\n### 【事迹卡 1】\n- **title**：曾资料\n- **full_text**：曾资料材料\n- **source**：《正式史料》✅\n')
    const ctx = await loadComposition(join(root, 'sessions'), { wangYangmingPath: wangPath, zengGuofanPath: zengPath }, { root: localPresetRoot, wangYangming: 'wang-yangming', zengGuofan: 'zeng-guofan' })
    const adapter = new MockAdapter([
      toolCallResponse('historical-first-person-lookup', 'evidence_lookup', { topic: '贬谪经历', requestedCount: 1 }),
      toolCallResponse('historical-first-person-invalid', 'persona_turn_submit', personaSubmitArguments('至于我为什么能谈这件事，《明史》记载了这次贬谪。', 'historical-fact', ['wang-yangming:research:1'])),
      toolCallResponse('historical-first-person-valid', 'persona_turn_submit', personaSubmitArguments('《明史》记载，王阳明曾遭贬谪。', 'historical-fact', ['wang-yangming:research:1'])),
      textResponse('史传标题'),
    ])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('historical-first-person-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('historical-first-person-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('historical-first-person-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('historical-first-person-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const result = await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('historical-first-person-message'), deliveryOperationId: deliveryOperationId('historical-first-person-delivery'), turnOperationId: turnOperationId('historical-first-person-turn'), text: '说说这段经历', requestId: requestId('historical-first-person-request') })
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'historical-first-person-turn', status: 'completed' }))
    expect(await ctx.manRoleplayer.acceptedAnswer(id, 'historical-first-person-turn')).toBe('《明史》记载，王阳明曾遭贬谪。')
    expect(adapter.requests.filter(request => request.purpose !== 'session-title')).toHaveLength(3)
    expect(JSON.stringify(adapter.requests[2]?.messages)).toContain("evidence 'wang-yangming:research:1' requires wholly third-person attribution")
  })

  it('allows a valid submission after an earlier structured submission fails validation', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-structured-retry-'))
    const wangPath = join(root, '调研成果-王阳明.md'); const zengPath = join(root, '调研成果-曾国藩.md')
    const card = (persona: string, title: string) => `> persona_id：\`${persona}\`\n### 【事迹卡 1】\n- **title**：${title}\n- **full_text**：${title}材料\n- **source**：《正式史料》\n`
    await writeFile(wangPath, card('王阳明', '阳明事迹')); await writeFile(zengPath, card('曾国藩', '曾国藩事迹'))
    const ctx = await loadComposition(join(root, 'sessions'), { wangYangmingPath: wangPath, zengGuofanPath: zengPath }, { root: localPresetRoot, wangYangming: 'wang-yangming', zengGuofan: 'zeng-guofan' })
    const answer = '史实回答'; const recoveredAnswer = '史实回答（依据）'
    const adapter = new MockAdapter([
      toolCallResponse('retry-invalid', 'persona_turn_submit', personaSubmitArguments(answer, 'historical-fact', ['wang-yangming:research:1'])),
      toolCallResponse('retry-lookup', 'evidence_lookup', { topic: '阳明事迹', requestedCount: 1 }),
      toolCallResponse('retry-valid', 'persona_turn_submit', personaSubmitArguments(recoveredAnswer, 'historical-fact', ['wang-yangming:research:1'])),
      textResponse('retry title'),
    ])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('structured-retry-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('structured-retry-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('structured-retry-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('structured-retry-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const result = await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('structured-retry-message'), deliveryOperationId: deliveryOperationId('structured-retry-delivery'), turnOperationId: turnOperationId('structured-retry-turn'), text: 'retry input', requestId: requestId('structured-retry-request') })
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id) ?? []
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'structured-retry-turn', status: 'completed' }))
    expect(events.some(event => event.type === 'claim-sidecar' && event.status === 'accepted' && event.kind === 'historical-fact')).toBe(true)
    const checks = events.filter((event): event is Extract<ProductEvent, { type: 'activity' }> => event.type === 'activity' && event.turnOperationId === 'structured-retry-turn' && event.phase === 'evidence-check')
    expect(checks).toHaveLength(2)
    expect(new Set(checks.map(event => String(event.requestId))).size).toBe(2)
  })

  it('accepts a same-turn reliable quote claim from the formal quote table', async () => {
    const { result, events } = await structuredEvidenceCase({
      name: 'structured-quote', wangSource: '> persona_id：`王阳明`\n| 编号 | 语录 | 出处 | 可信度 |\n|---|---|---|---|\n| 1 | "知行合一" | 《传习录》 | ✅ |\n', wangTitle: '知行合一', evidenceId: 'wang-yangming:research:quote:1', evidenceType: 'quote', claimKind: 'reliable-quote', answer: '引文回答',
    })
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'structured-quote-turn', status: 'completed' }))
    expect(events.some(event => event.type === 'evidence-tool-claim' && event.status === 'completed' && event.returnedEvidenceIds?.includes('wang-yangming:research:quote:1'))).toBe(true)
    expect(events.some(event => event.type === 'claim-sidecar' && event.status === 'accepted' && event.kind === 'reliable-quote')).toBe(true)
  })

  it('lets both personas correct a rejected bare identity greeting in the same turn', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-identity-minimum-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const adapter = new MockAdapter([
      personaSubmitResponse('identity-wang-invalid', '你好。'),
      personaSubmitResponse('identity-wang-valid', '我是王阳明，可以帮助你梳理当前困惑。'),
      textResponse('identity title'),
      personaSubmitResponse('identity-zeng-invalid', '你好。'),
      personaSubmitResponse('identity-zeng-valid', '我是曾国藩，可以帮助你梳理当前困惑。'),
    ])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('identity-minimum-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('identity-minimum-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('identity-minimum-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('identity-minimum-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const result = await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('identity-minimum-message'), deliveryOperationId: deliveryOperationId('identity-minimum-delivery'), turnOperationId: turnOperationId('identity-minimum-turn'), text: '你是谁呀', requestId: requestId('identity-minimum-request') })
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'identity-minimum-turn', status: 'completed' }))
    await ctx.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('identity-minimum-switch'))
    const recovered = await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('identity-zeng-message'), deliveryOperationId: deliveryOperationId('identity-zeng-delivery'), turnOperationId: turnOperationId('identity-zeng-turn'), text: '你是谁呀', requestId: requestId('identity-zeng-request') })
    expect(recovered.timeline).toContainEqual(expect.objectContaining({ id: 'identity-zeng-turn', status: 'completed' }))
    expect(adapter.requests.filter(request => request.purpose !== 'session-title')).toHaveLength(4)
    const policyText = adapter.requests.flatMap(request => request.messages).flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('\n')
    expect(policyText).toContain('本轮是身份短问：请自然说明当前对话人物是王阳明')
    expect(policyText).toContain('本轮是身份短问：请自然说明当前对话人物是曾国藩')
  })

  it('rejects advice answers that contain no situational guidance', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-advice-minimum-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const unsupported = '现有材料不足以判断你的具体处境，因此不能把历史材料直接套用到你的选择上；在缺少更多信息时，这里只能说明证据边界，不能替你决定接下来应该采取哪一种现实行动，也不能保证任何结果必然发生。'
    const gamed = '校验占位：本段不含任何证据编号，仅用于确认本轮提交链路中现代化推论类分段可以被接受，因此文字写得足够长，以通过非空白字符数量的下限要求。这里继续补充没有面向用户价值的句子，直到满足系统要求。'
    const uncitedBiography = '我当年曾被贬到很远的地方，也在那里重新理解了选择和行动。现在回到你的两个选择，可以先把可逆与不可逆的部分分别写清，再通过一个低成本试验获得真实反馈；不要只在脑内反复比较，也不要把一次决定想成永远不能调整的判决。'
    const substantive = '先把两个选择分别写成未来三个月可以观察的具体结果，再找出其中可逆和不可逆的部分。今天只做一个成本很低的小试验，给自己设定明确的复盘日期；到时依据实际反馈调整，而不是要求现在一次选中永远正确的道路。这样既承认不确定，也没有停在焦虑里。'
    const adapter = new MockAdapter([
      personaSubmitResponse('advice-off-topic', '花盆放在窗边。'),
      toolCallResponse('advice-no-guidance', 'persona_turn_submit', personaSubmitArguments(unsupported, 'insufficient-evidence')),
      personaSubmitResponse('advice-validation-filler', gamed),
      personaSubmitResponse('advice-uncited-biography', uncitedBiography),
      personaSubmitResponse('advice-valid', substantive),
      textResponse('advice title'),
    ])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('advice-minimum-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('advice-minimum-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('advice-minimum-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('advice-minimum-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const result = await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('advice-minimum-message'), deliveryOperationId: deliveryOperationId('advice-minimum-delivery'), turnOperationId: turnOperationId('advice-minimum-turn'), text: '我面临两个选择，该怎样判断并行动？', requestId: requestId('advice-minimum-request') })
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'advice-minimum-turn', status: 'completed' }))
    expect(await ctx.manRoleplayer.acceptedAnswer(id, 'advice-minimum-turn')).toBe(substantive)
    expect(adapter.requests.filter(request => request.purpose !== 'session-title')).toHaveLength(5)
    const policyText = adapter.requests.flatMap(request => request.messages).flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('\n')
    expect(policyText).toContain('在用户明确要求的回应范围和长度内回应现实处境，不因建议型措辞擅自追加整套方案')
  })

  it('does not apply the identity minimum to a negated identity phrase', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-identity-negative-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const adapter = new MockAdapter([personaSubmitResponse('identity-negative-submit', '你好。'), textResponse('identity negative title')]); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('identity-negative-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('identity-negative-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('identity-negative-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('identity-negative-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const result = await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('identity-negative-message'), deliveryOperationId: deliveryOperationId('identity-negative-delivery'), turnOperationId: turnOperationId('identity-negative-turn'), text: '我不是在问你是谁，我在问你能否帮忙', requestId: requestId('identity-negative-request') })
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'identity-negative-turn', status: 'completed' }))
  })

  it('accepts restricted attribution only as a non-first-person claim', async () => {
    const { result, events } = await structuredEvidenceCase({
      name: 'structured-attribution', wangSource: '> persona_id：`王阳明`\n### 【事迹卡 1】\n- **title**：阳明评价\n- **full_text**：阳明评价材料\n- **source**：《后世评述》⚠️\n', wangTitle: '阳明评价', evidenceId: 'wang-yangming:research:1', evidenceType: 'attribution', claimKind: 'attribution', answer: '背景说明',
    })
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'structured-attribution-turn', status: 'completed' }))
    expect(events.some(event => event.type === 'claim-sidecar' && event.status === 'accepted' && event.kind === 'attribution')).toBe(true)
  })

  it('lets Host generate contiguous Claim ranges and fails closed for invalid segments or evidence provenance', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-structured-claims-negative-'))
    const cases: readonly { readonly name: string; readonly segments: readonly Record<string, unknown>[] }[] = [
      { name: 'empty-text', segments: [{ text: '', kind: 'modern-inference', evidenceIds: [] }] },
      { name: 'unknown-kind', segments: [{ text: 'answer!', kind: 'unknown', evidenceIds: [] }] },
      { name: 'not-returned', segments: [{ text: 'answer!', kind: 'reliable-quote', evidenceIds: ['wang-yangming:research:1'] }] },
      { name: 'cross-persona', segments: [{ text: 'answer!', kind: 'historical-fact', evidenceIds: ['zeng-guofan:research:1'] }] },
    ]
    for (const testCase of cases) {
      const caseRoot = join(root, testCase.name); await mkdir(caseRoot, { recursive: true })
      const wangPath = join(caseRoot, '调研成果-王阳明.md'); const zengPath = join(caseRoot, '调研成果-曾国藩.md')
      const card = (persona: string, title: string) => `> persona_id：\`${persona}\`\n### 【事迹卡 1】\n- **title**：${title}\n- **full_text**：${title}材料\n- **source**：《正式史料》\n`
      await writeFile(wangPath, card('王阳明', '阳明史实')); await writeFile(zengPath, card('曾国藩', '曾国藩史实'))
      const ctx = await loadComposition(join(caseRoot, 'sessions'), { wangYangmingPath: wangPath, zengGuofanPath: zengPath }, { root: localPresetRoot, wangYangming: 'wang-yangming', zengGuofan: 'zeng-guofan' })
      const adapter = new MockAdapter([
        toolCallResponse(`${testCase.name}-submit`, 'persona_turn_submit', { segments: testCase.segments }),
        textResponse('unstructured fallback'),
      ])
      ctx.llm.registerAdapter(['mock'], adapter)
      const id = dilemmaId(`structured-negative-${testCase.name}`); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId(`structured-negative-${testCase.name}-wang`) }, { persona: 'zeng-guofan' as const, sessionId: sessionId(`structured-negative-${testCase.name}-zeng`) }] as const
      await ctx.manRoleplayer.create({ id, requestId: requestId(`structured-negative-${testCase.name}-create`), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
      const result = await ctx.manRoleplayer.submitMessage(id, { messageId: messageId(`structured-negative-${testCase.name}-message`), deliveryOperationId: deliveryOperationId(`structured-negative-${testCase.name}-delivery`), turnOperationId: turnOperationId(`structured-negative-${testCase.name}-turn`), text: `${testCase.name} input`, requestId: requestId(`structured-negative-${testCase.name}-request`) })
      const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
      expect(result.timeline).toContainEqual(expect.objectContaining({ id: `structured-negative-${testCase.name}-turn`, status: 'failed' }))
      expect(events?.some(event => event.type === 'claim-sidecar' && event.status === 'accepted')).toBe(false)
      expect(events?.some(event => event.type === 'turn' && event.turnOperationId === `structured-negative-${testCase.name}-turn` && event.status === 'completed')).toBe(false)
    }
  })

  it('rejects a structured answer when evidence is challenged before final submission', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-structured-challenge-'))
    const wangPath = join(root, '调研成果-王阳明.md'); const zengPath = join(root, '调研成果-曾国藩.md')
    const card = (persona: string, title: string) => `> persona_id：\`${persona}\`\n### 【事迹卡 1】\n- **title**：${title}\n- **full_text**：${title}材料\n- **source**：《正式史料》\n`
    await writeFile(wangPath, card('王阳明', '阳明事迹')); await writeFile(zengPath, card('曾国藩', '曾国藩事迹'))
    const ctx = await loadComposition(join(root, 'sessions'), { wangYangmingPath: wangPath, zengGuofanPath: zengPath }, { root: localPresetRoot, wangYangming: 'wang-yangming', zengGuofan: 'zeng-guofan' })
    const id = dilemmaId('structured-challenge-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('structured-challenge-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('structured-challenge-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('structured-challenge-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const adapter = new ChallengeBeforeSubmitAdapter(
      async () => { await ctx.manRoleplayer.challengeEvidence(id, 'wang-yangming:research:1', requestId('structured-challenge-evidence')) },
      personaSubmitArguments('stale answer', 'historical-fact', ['wang-yangming:research:1']),
    )
    ctx.llm.registerAdapter(['mock'], adapter)
    const result = await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('structured-challenge-message'), deliveryOperationId: deliveryOperationId('structured-challenge-delivery'), turnOperationId: turnOperationId('structured-challenge-turn'), text: 'challenge input', requestId: requestId('structured-challenge-request') })
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'structured-challenge-turn', status: 'failed' }))
    expect(events?.some(event => event.type === 'evidence' && event.evidenceId === 'wang-yangming:research:1' && event.status === 'challenged')).toBe(true)
    expect(events?.some(event => event.type === 'claim-sidecar' && event.status === 'accepted')).toBe(false)
    expect(events?.some(event => event.type === 'title' && event.status !== 'claimed')).toBe(false)
  })

  it('repairs one unstructured private draft into an accepted submit without duplicating product work', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-structured-finalizer-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const adapter = new MockAdapter([
      textResponse('private draft'),
      personaSubmitResponse('structured-finalizer-submit', 'finalized answer'),
      textResponse('finalized title'),
    ])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('structured-finalizer-loader')
    const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('structured-finalizer-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('structured-finalizer-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('structured-finalizer-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const result = await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('structured-finalizer-message'), deliveryOperationId: deliveryOperationId('structured-finalizer-delivery'), turnOperationId: turnOperationId('structured-finalizer-turn'), text: '需要结构化收口', requestId: requestId('structured-finalizer-request') })
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id) ?? []
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'structured-finalizer-turn', status: 'completed' }))
    expect(await ctx.manRoleplayer.acceptedAnswer(id, 'structured-finalizer-turn')).toBe('finalized answer')
    expect(events.filter(event => event.type === 'user-message' && event.content !== undefined)).toHaveLength(1)
    expect(events.some(event => event.type === 'activity' && event.phase === 'finalizing')).toBe(true)
    expect(events.some(event => event.type === 'claim-sidecar' && event.status === 'accepted')).toBe(true)
    expect(events.some(event => event.type === 'evidence-tool-claim')).toBe(false)
    expect(events.filter(event => event.type === 'state-analysis')).toHaveLength(0)
    expect(adapter.requests.filter(request => request.purpose !== 'session-title')).toHaveLength(2)
    const repairPrompt = adapter.requests[1]!.messages.flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('\n')
    expect(repairPrompt).toContain('上一条 assistant 文本只是未提交草稿')
  })

  it('keeps an unstructured assistant answer private and fails after one bounded finalization attempt', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-structured-gate-plain-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const adapter = new MockAdapter([textResponse('plain answer'), textResponse('must not title')])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('structured-gate-plain-loader')
    const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('structured-gate-plain-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('structured-gate-plain-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('structured-gate-plain-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const result = await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('structured-gate-plain-message'), deliveryOperationId: deliveryOperationId('structured-gate-plain-delivery'), turnOperationId: turnOperationId('structured-gate-plain-turn'), text: 'plain input', requestId: requestId('structured-gate-plain-submit') })
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'structured-gate-plain-message', status: 'failed' }))
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'structured-gate-plain-turn', status: 'failed' }))
    expect(events?.some(event => event.type === 'turn' && event.turnOperationId === turnOperationId('structured-gate-plain-turn') && event.status === 'completed')).toBe(false)
    expect(events?.some(event => event.type === 'title' && event.status !== 'claimed')).toBe(false)
    expect(events?.some(event => event.type === 'claim-sidecar')).toBe(false)
    expect(ctx.agents.get(branches[0].sessionId)?.session.events.some(event => event.type === 'assistant/message')).toBe(true)
    expect(events?.some(event => event.type === 'activity' && event.phase === 'finalizing')).toBe(true)
    expect(adapter.requests.filter(request => request.purpose !== 'session-title')).toHaveLength(2)
    expect(adapter.requests.filter(request => request.purpose === 'session-title')).toHaveLength(0)
  })

  it('accepts only a valid persona_turn_submit result as the completed persona answer', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-structured-gate-submit-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const submittedText = 'structured answer'
    const adapter = new MockAdapter([
      toolCallResponse('structured-submit-call', 'persona_turn_submit', { segments: [
        { text: 'structured ', kind: 'modern-inference', evidenceIds: [] },
        { text: 'answer', kind: 'modern-inference', evidenceIds: [] },
      ] }),
      textResponse('结构化标题'),
    ])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('structured-gate-submit-loader')
    const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('structured-gate-submit-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('structured-gate-submit-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('structured-gate-submit-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const result = await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('structured-gate-submit-message'), deliveryOperationId: deliveryOperationId('structured-gate-submit-delivery'), turnOperationId: turnOperationId('structured-gate-submit-turn'), text: 'structured input', requestId: requestId('structured-gate-submit-request') })
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    const toolResult = ctx.agents.get(branches[0].sessionId)?.session.events.findLast(event => event.type === 'tool/result' && event.data.meta !== undefined)
    expect(toolResult?.type).toBe('tool/result')
    expect(toolResult?.type === 'tool/result' && toolResult.data.meta).toMatchObject({ type: 'persona-turn-submit', turnOperationId: 'structured-gate-submit-turn' })
    if (!result.timeline.some(item => item.id === 'structured-gate-submit-turn' && item.status === 'completed')) throw new Error(JSON.stringify({ result, events, toolResult }))
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'structured-gate-submit-message', status: 'delivered' }))
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'structured-gate-submit-turn', status: 'completed', sourceEventId: String(toolResult?.seq) }))
    expect(events?.filter(event => event.type === 'claim-sidecar' && event.status === 'accepted').map(event => event.type === 'claim-sidecar' ? event.textRange : undefined)).toEqual([
      { start: 0, end: 'structured '.length },
      { start: 'structured '.length, end: submittedText.length },
    ])
    expect(events?.filter(event => event.type === 'title' && event.status !== 'claimed')).toHaveLength(1)
    expect(adapter.requests.filter(request => request.purpose === 'session-title')).toHaveLength(1)
  })

  it('submits through one real target Session and records stable Session references', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-submit-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const answer = '先把困惑中的目标、限制和可逆选择分别写清，再从今天能完成的小动作开始验证。不要把一次取舍想成永久判决，而要约定复盘时间，根据真实反馈继续调整；这样既没有回避决定，也保留了修正方向的空间。'
    const adapter = new MockAdapter([personaSubmitResponse('submit-persona', answer), textResponse('标题')])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('submit-loader')
    const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('submit-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('submit-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('create-submit'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const result = await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('message-submit'), deliveryOperationId: deliveryOperationId('delivery-submit'), turnOperationId: turnOperationId('turn-submit'), text: '我的困惑是如何取舍', requestId: requestId('submit-message') })
    const session = ctx.agents.get(branches[0].sessionId)!.session
    const user = session.events.find(event => event.type === 'user/message')
    const assistant = session.events.find(event => event.type === 'assistant/message' && user !== undefined && event.seq > user.seq)
    const personaRequests = adapter.requests.filter(request => request.purpose !== 'session-title')
    expect(personaRequests).toHaveLength(1)
    expect(personaRequests[0]!.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('我的困惑是如何取舍')))).toBe(true)
    expect(ctx.agents.get(branches[1].sessionId)!.session.events.filter(event => event.type === 'user/message')).toHaveLength(0)
    expect(user).toBeDefined(); expect(assistant).toBeDefined()
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'message-submit', status: 'delivered' }))
    const submitResult = session.events.findLast(event => event.type === 'tool/result' && event.data.meta !== undefined)
    expect(submitResult?.type).toBe('tool/result')
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'turn-submit', sourceEventId: String(submitResult!.seq), status: 'completed' }))
    const noAckEvents = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(noAckEvents?.some(event => event.type === 'persona-acknowledgement')).toBe(false)
    await expect(ctx.manRoleplayer.cancelMessage(id, messageId('message-submit'), deliveryOperationId('delivery-submit'), turnOperationId('turn-submit'))).resolves.toMatchObject({ revision: result.revision })
    const terminalEvents = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(terminalEvents?.filter(event => event.type === 'message-delivery' && event.deliveryOperationId === 'delivery-submit' && ['delivered', 'cancelled', 'failed'].includes(event.status))).toHaveLength(1)
    expect(terminalEvents?.filter(event => event.type === 'turn' && event.turnOperationId === 'turn-submit' && ['completed', 'cancelled', 'failed'].includes(event.status))).toHaveLength(1)
  })

  it('mounts distinct configured persona presets and persists their research-bound identity', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-presets-'))
    const sessionRoot = join(root, 'sessions')
    const wangPath = join(root, '调研成果-王阳明.md')
    const zengPath = join(root, '调研成果-曾国藩.md')
    const source = (persona: string, title: string) => `> persona_id：\`${persona}\`\n### 【事迹卡 1】\n- **title**：${title}\n- **full_text**：${title}材料\n- **source**：《正式史料》\n`
    await writeFile(wangPath, source('王阳明', '王资料'))
    await writeFile(zengPath, source('曾国藩', '曾资料'))
    const ctx = await loadComposition(sessionRoot, { wangYangmingPath: wangPath, zengGuofanPath: zengPath }, {
      root: localPresetRoot, wangYangming: 'wang-yangming', zengGuofan: 'zeng-guofan',
    })
    const adapter = new MockAdapter([textResponse('王回答'), textResponse('标题'), textResponse('曾回答')])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('presets-loader')
    const branches = [
      { persona: 'wang-yangming' as const, sessionId: sessionId('presets-wang') },
      { persona: 'zeng-guofan' as const, sessionId: sessionId('presets-zeng') },
    ] as const
    const created = await ctx.manRoleplayer.create({
      id, requestId: requestId('presets-create'), branches, activePersona: 'wang-yangming',
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    expect(created.branches.map(branch => branch.presetIdentity?.presetId)).toEqual(['wang-yangming', 'zeng-guofan'])
    expect(created.branches[0]?.presetIdentity?.persona).toBe('wang-yangming')
    expect(created.branches[1]?.presetIdentity?.persona).toBe('zeng-guofan')
    const wangIdentity = created.branches[0]?.presetIdentity
    if (wangIdentity === undefined) throw new Error('preset identity fixture did not persist')
    await expect(ctx.manRoleplayer.create({
      id: dilemmaId('preset-mismatch-loader'), requestId: requestId('preset-mismatch-create'), activePersona: 'wang-yangming',
      branches: [
        { ...branches[0], presetIdentity: { ...wangIdentity, presetId: 'zeng-guofan' } }, branches[1],
      ],
    })).rejects.toThrow(/conflicts/)
    expect(adapter.requests).toHaveLength(0)
    await ctx.manRoleplayer.submitMessage(id, {
      messageId: messageId('presets-wang-message'), deliveryOperationId: deliveryOperationId('presets-wang-delivery'),
      turnOperationId: turnOperationId('presets-wang-turn'), text: '王问题', requestId: requestId('presets-wang-request'),
    })
    expect(adapter.requests.some(request => request.system?.includes('你是王阳明对话分支') === true)).toBe(true)
    await ctx.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('presets-switch'))
    await ctx.manRoleplayer.submitMessage(id, {
      messageId: messageId('presets-zeng-message'), deliveryOperationId: deliveryOperationId('presets-zeng-delivery'),
      turnOperationId: turnOperationId('presets-zeng-turn'), text: '曾问题', requestId: requestId('presets-zeng-request'),
    })
    expect(adapter.requests.some(request => request.system?.includes('你是曾国藩对话分支') === true)).toBe(true)
    await materializeBranches(ctx)
    await ctx.fiber.dispose()
    contexts.splice(contexts.indexOf(ctx), 1)
    const resumed = await loadComposition(sessionRoot, { wangYangmingPath: wangPath, zengGuofanPath: zengPath }, {
      root: localPresetRoot, wangYangming: 'wang-yangming', zengGuofan: 'zeng-guofan',
    })
    const recovery = new MockAdapter([])
    resumed.llm.registerAdapter(['mock'], recovery)
    await expect(resumed.manRoleplayer.resume(id, { provider: 'mock', model: 'mock' })).resolves.toBeDefined()
    expect(recovery.requests).toHaveLength(0)
    expect((await resumed.manRoleplayer.read(id))?.branches.map(branch => branch.presetIdentity?.researchFingerprint)).toEqual([
      created.branches[0]?.presetIdentity?.researchFingerprint, created.branches[1]?.presetIdentity?.researchFingerprint,
    ])
  })

  it('fails closed for missing, duplicate, and changed persona preset identities', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-preset-identity-'))
    const sessionRoot = join(root, 'sessions')
    const wangPath = join(root, '调研成果-王阳明.md')
    const zengPath = join(root, '调研成果-曾国藩.md')
    const source = (persona: string) => `> persona_id：\`${persona}\`\n### 【事迹卡 1】\n- **title**：资料\n- **full_text**：资料正文\n- **source**：《正式史料》\n`
    await writeFile(wangPath, source('王阳明'))
    await writeFile(zengPath, source('曾国藩'))
    const research = { wangYangmingPath: wangPath, zengGuofanPath: zengPath }
    const presets = { root: localPresetRoot, wangYangming: 'wang-yangming', zengGuofan: 'zeng-guofan' }
    await expect(loadComposition(sessionRoot, undefined, presets)).rejects.toThrow(/together/)
    await expect(loadComposition(sessionRoot, research)).rejects.toThrow(/together/)
    await expect(loadComposition(sessionRoot, {
      wangYangmingPath: join(root, 'missing', '调研成果-王阳明.md'), zengGuofanPath: zengPath,
    }, presets)).rejects.toThrow()
    await expect(loadComposition(sessionRoot, research, {
      root: localPresetRoot, wangYangming: 'missing-preset', zengGuofan: 'zeng-guofan',
    })).rejects.toThrow(/not found/)
    await expect(loadComposition(sessionRoot, research, {
      root: localPresetRoot, wangYangming: 'wang-yangming', zengGuofan: 'wang-yangming',
    })).rejects.toThrow(/distinct/)

    const presetRoot = join(root, 'preset-copy')
    await mkdir(join(presetRoot, 'wang-yangming'), { recursive: true })
    await mkdir(join(presetRoot, 'zeng-guofan'), { recursive: true })
    await copyFile(join(localPresetRoot, 'wang-yangming', 'agent.cordis.yml'), join(presetRoot, 'wang-yangming', 'agent.cordis.yml'))
    await copyFile(join(localPresetRoot, 'zeng-guofan', 'agent.cordis.yml'), join(presetRoot, 'zeng-guofan', 'agent.cordis.yml'))
    const ctx = await loadComposition(sessionRoot, research, {
      root: presetRoot, wangYangming: 'wang-yangming', zengGuofan: 'zeng-guofan',
    })
    const id = dilemmaId('preset-identity-loader')
    const branches = [
      { persona: 'wang-yangming' as const, sessionId: sessionId('preset-identity-wang') },
      { persona: 'zeng-guofan' as const, sessionId: sessionId('preset-identity-zeng') },
    ] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('preset-identity-create'), branches, activePersona: 'wang-yangming' })
    await ctx.fiber.dispose()
    contexts.splice(contexts.indexOf(ctx), 1)
    const missingBindings = await loadComposition(sessionRoot)
    const missingBindingRecovery = new MockAdapter([])
    missingBindings.llm.registerAdapter(['mock'], missingBindingRecovery)
    await expect(missingBindings.manRoleplayer.resume(id, { provider: 'mock', model: 'mock' })).rejects.toThrow(/current Host bindings/)
    expect(missingBindingRecovery.requests).toHaveLength(0)
    await missingBindings.fiber.dispose()
    contexts.splice(contexts.indexOf(missingBindings), 1)
    const changedComposition = await readFile(join(presetRoot, 'wang-yangming', 'agent.cordis.yml'), 'utf8')
    await writeFile(join(presetRoot, 'wang-yangming', 'agent.cordis.yml'), `${changedComposition}\n# changed\n`)
    const changed = await loadComposition(sessionRoot, research, {
      root: presetRoot, wangYangming: 'wang-yangming', zengGuofan: 'zeng-guofan',
    })
    const recovery = new MockAdapter([])
    changed.llm.registerAdapter(['mock'], recovery)
    await expect(changed.manRoleplayer.resume(id, { provider: 'mock', model: 'mock' })).rejects.toThrow(/identity|changed/)
    expect(recovery.requests).toHaveLength(0)
  })

  it('blocks high-risk input before the real provider is reached', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-safety-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const adapter = new MockAdapter([textResponse('must not run')]); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('safety-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('safety-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('safety-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('create-safety'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const result = await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('message-safety'), deliveryOperationId: deliveryOperationId('delivery-safety'), turnOperationId: turnOperationId('turn-safety'), text: '我想自杀', requestId: requestId('safety-message') })
    expect(adapter.requests).toHaveLength(0)
    expect(result.timeline).not.toContainEqual(expect.objectContaining({ id: 'message-safety' }))
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(events?.filter(event => event.type === 'safety-blocked' && event.messageId === 'message-safety')).toHaveLength(1)
    expect(events?.filter(event => event.type === 'system-safety-reply' && event.messageId === 'message-safety')).toHaveLength(1)
  })
  it('repairs a safety reply after a crash between safety terminal and reply', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-safety-recovery-'))
    const ctx = await loadComposition(join(root, 'sessions')); const adapter = new MockAdapter([textResponse('must not run')]); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('safety-recovery-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('safety-recovery-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('safety-recovery-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('safety-recovery-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    await repository.append(id, { type: 'safety-blocked', messageId: messageId('safety-recovery-message'), safetyOperationId: operationId('safety-recovery-operation'), persona: 'wang-yangming', content: 'blocked', kind: 'danger', reason: 'fixed safety reply', requestId: requestId('safety-recovery-blocked') })
    await ctx.manRoleplayer.read(id); await ctx.manRoleplayer.read(id)
    const events = await repository.readEvents(id)
    expect(events?.filter(event => event.type === 'system-safety-reply' && event.safetyOperationId === 'safety-recovery-operation')).toHaveLength(1)
    expect(events?.some(event => event.type === 'message-delivery' || event.type === 'turn')).toBe(false); expect(adapter.requests).toHaveLength(0)
  })
  it('keeps safety-blocked text excluded across later turns and persona switches', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-safety-cross-turn-'))
    const ctx = await loadComposition(join(root, 'sessions')); const adapter = new MockAdapter([textResponse('safe answer'), textResponse('title')]); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('safety-cross-turn-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('safety-cross-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('safety-cross-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('safety-cross-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('safety-cross-blocked'), deliveryOperationId: deliveryOperationId('safety-cross-blocked-delivery'), turnOperationId: turnOperationId('safety-cross-blocked-turn'), text: 'I want suicide', requestId: requestId('safety-cross-blocked-request') })
    expect(adapter.requests).toHaveLength(0)
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('safety-cross-normal'), deliveryOperationId: deliveryOperationId('safety-cross-normal-delivery'), turnOperationId: turnOperationId('safety-cross-normal-turn'), text: 'normal question', requestId: requestId('safety-cross-normal-request') })
    await ctx.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('safety-cross-switch'))
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(events?.some(event => event.type === 'safety-blocked' && event.messageId === 'safety-cross-blocked')).toBe(true)
    expect(events?.filter(event => event.type === 'system-safety-reply' && event.messageId === 'safety-cross-blocked')).toHaveLength(1)
    expect(events?.some(event => event.type === 'state-analysis' && event.inputWatermark === 'safety-cross-blocked')).toBe(false)
    expect(adapter.requests.some(request => request.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('I want suicide'))))).toBe(false)
  })
  it('records exact persona acknowledgement without leaking the private answer', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-ack-'))
    const ctx = await loadComposition(join(root, 'sessions')); const adapter = new MockAdapter([personaSubmitResponse('ack-source-submit', 'wang-private-secret'), textResponse('ack-title'), personaSubmitResponse('ack-ack-submit', 'ack answer'), personaSubmitResponse('ack-zeng-submit', 'zeng answer'), personaSubmitResponse('ack-zeng-after-submit', 'zeng after withdrawal')]); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('ack-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('ack-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('ack-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('ack-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('source-message'), deliveryOperationId: deliveryOperationId('source-delivery'), turnOperationId: turnOperationId('source-turn'), text: '请听我说', replyToTimelineEventId: 'source-turn', requestId: requestId('source-request') })
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('ack-message'), deliveryOperationId: deliveryOperationId('ack-delivery'), turnOperationId: turnOperationId('ack-turn'), text: '你说得对', replyToTimelineEventId: 'source-turn', requestId: requestId('ack-request') })
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    const ack = events?.find(event => event.type === 'persona-acknowledgement')
    expect(ack).toMatchObject({ sourcePersona: 'wang-yangming', sourceUserMessageId: 'source-message', sourcePersonaMessageId: 'source-turn', status: 'active' })
    expect(events?.some(event => event.type === 'persona-acknowledgement' && 'content' in event)).toBe(false)
    await ctx.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('ack-switch'))
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('zeng-message'), deliveryOperationId: deliveryOperationId('zeng-delivery'), turnOperationId: turnOperationId('zeng-turn'), text: '问题', requestId: requestId('zeng-request') })
    const zengRequest = adapter.requests.findLast(request => request.purpose !== 'session-title' && request.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('问题'))))!
    expect(zengRequest.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('persona-acknowledgement')))).toBe(true)
    expect(zengRequest.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('wang-private-secret')))).toBe(false)
    expect(zengRequest.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('你说得对')))).toBe(false)
    await ctx.manRoleplayer.withdrawPersonaAcknowledgement(id, 'persona-acknowledgement:ack-message:source-turn', requestId('ack-withdraw'))
    const withdrawn = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(withdrawn?.filter(event => event.type === 'persona-acknowledgement' && event.id === 'persona-acknowledgement:ack-message:source-turn')).toHaveLength(2)
    expect(withdrawn?.filter(event => event.type === 'persona-acknowledgement' && event.status === 'withdrawn')).toHaveLength(1)
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('zeng-after'), deliveryOperationId: deliveryOperationId('zeng-after-delivery'), turnOperationId: turnOperationId('zeng-after-turn'), text: '撤回后继续', requestId: requestId('zeng-after-request') })
    const afterRequest = adapter.requests.findLast(request => request.purpose !== 'session-title' && request.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('撤回后继续'))))!
    expect(afterRequest.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('请听我说')))).toBe(true)
  })
  it('generates a title once, persists it, and lets rename override it', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-title-'))
    const ctx = await loadComposition(join(root, 'sessions')); const adapter = new MockAdapter([personaSubmitResponse('title-submit', 'answer'), textResponse('**标题：** 身份之问** （或更简版：**你是谁？**）')]); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('title-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('title-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('title-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('title-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    expect(ctx.agents.get(branches[0].sessionId)?.options).toMatchObject({ provider: 'mock', model: 'mock' })
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('title-message'), deliveryOperationId: deliveryOperationId('title-delivery'), turnOperationId: turnOperationId('title-turn'), text: '我的困惑原话', requestId: requestId('title-request') })
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(events?.filter(event => event.type === 'title')).toHaveLength(2)
    expect(adapter.requests).toHaveLength(2); expect(adapter.requests[1]!.purpose).toBe('session-title')
    expect(events?.filter(event => event.type === 'title')).toHaveLength(2)
    expect(events?.find(event => event.type === 'title' && event.status === 'completed')).toMatchObject({ value: '身份之问' })
    await ctx.manRoleplayer.rename(id, '用户标题', requestId('title-rename'))
    const renamed = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(renamed?.filter(event => event.type === 'renamed')).toHaveLength(1)
    expect((await ctx.manRoleplayer.read(id))?.title).toBe('用户标题')
  })

  it('derives each product attempt reasoning from its persona Session across settled and streaming steps', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-reasoning-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const id = dilemmaId('reasoning-loader')
    const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('reasoning-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('reasoning-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('reasoning-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    const agent = ctx.agents.get(branches[0].sessionId)
    if (agent === undefined) throw new Error('reasoning persona Agent was not created')
    const firstUser = createUserMessage({ content: [{ type: 'text', text: '原始问题' }], source: { kind: 'user' } })
    agent.session.append('turn/start', { turn: 1 })
    agent.session.append('step/start', { turn: 1, step: 1 })
    agent.session.append('user/message', firstUser, { surfaceOp: 'append' })
    const firstChunk = agent.session.append('assistant/chunk', { turn: 1, step: 1, chunk: { type: 'reasoning-delta', index: 0, text: '第一步流式草稿' } })
    agent.session.append('assistant/message', { turn: 1, step: 1, message: createAssistantMessage({ content: [{ type: 'reasoning', text: '第一步已完成思考' }], source: { provider: 'mock', model: 'mock' } }) }, { surfaceOp: 'append', sourceEventSeqs: [firstChunk.seq] })
    agent.session.append('step/end', { turn: 1, step: 1 })
    agent.session.append('step/start', { turn: 1, step: 2 })
    agent.session.append('assistant/chunk', { turn: 1, step: 2, chunk: { type: 'reasoning-delta', index: 0, text: '第二步' } })
    agent.session.append('assistant/chunk', { turn: 1, step: 2, chunk: { type: 'reasoning-delta', index: 0, text: '仍在思考' } })
    await repository.append(id, { type: 'user-message', id: 'reasoning-message', messageId: messageId('reasoning-message'), deliveryOperationId: deliveryOperationId('reasoning-delivery'), persona: 'wang-yangming', content: '原始问题', status: 'pending', requestId: requestId('reasoning-user') })
    await repository.append(id, { type: 'message-delivery', messageId: messageId('reasoning-message'), deliveryOperationId: deliveryOperationId('reasoning-delivery'), persona: 'wang-yangming', status: 'claimed', sessionMessageId: String(firstUser.id), requestId: requestId('reasoning-delivery') })
    await repository.append(id, { type: 'turn', turnOperationId: turnOperationId('reasoning-turn'), messageId: messageId('reasoning-message'), persona: 'wang-yangming', status: 'running', requestId: requestId('reasoning-turn') })
    expect(await ctx.manRoleplayer.reasoning(id, turnOperationId('reasoning-turn'))).toEqual({
      persona: 'wang-yangming', turnOperationId: 'reasoning-turn', status: 'running',
      text: '第一步已完成思考\n\n第二步仍在思考',
    })

    const secondFinalChunk = agent.session.append('assistant/chunk', { turn: 1, step: 2, chunk: { type: 'reasoning-delta', index: 0, text: '完成' } })
    agent.session.append('assistant/message', { turn: 1, step: 2, message: createAssistantMessage({ content: [{ type: 'reasoning', text: '第二步最终思考' }], source: { provider: 'mock', model: 'mock' } }) }, { surfaceOp: 'append', sourceEventSeqs: [secondFinalChunk.seq] })
    agent.session.append('step/end', { turn: 1, step: 2 })
    agent.session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    await repository.append(id, { type: 'turn', turnOperationId: turnOperationId('reasoning-turn'), messageId: messageId('reasoning-message'), persona: 'wang-yangming', status: 'completed', sessionEventId: 'reasoning-submit-event', requestId: requestId('reasoning-turn-completed') })
    expect(await ctx.manRoleplayer.reasoning(id, turnOperationId('reasoning-turn'))).toMatchObject({ status: 'completed', text: '第一步已完成思考\n\n第二步最终思考' })

    const retryUser = createUserMessage({ content: [{ type: 'text', text: '重试输入' }], source: { kind: 'user' } })
    agent.session.append('turn/start', { turn: 2 })
    agent.session.append('step/start', { turn: 2, step: 1 })
    agent.session.append('user/message', retryUser, { surfaceOp: 'append' })
    agent.session.append('assistant/chunk', { turn: 2, step: 1, chunk: { type: 'reasoning-delta', index: 0, text: '重试轮次思考' } })
    await repository.append(id, { type: 'message-retry', messageId: messageId('reasoning-message'), previousTurnOperationId: turnOperationId('reasoning-turn'), previousDeliveryOperationId: deliveryOperationId('reasoning-delivery'), turnOperationId: turnOperationId('reasoning-retry-turn'), deliveryOperationId: deliveryOperationId('reasoning-retry-delivery'), requestId: requestId('reasoning-retry') })
    await repository.append(id, { type: 'message-delivery', messageId: messageId('reasoning-message'), deliveryOperationId: deliveryOperationId('reasoning-retry-delivery'), persona: 'wang-yangming', status: 'claimed', sessionMessageId: String(retryUser.id), requestId: requestId('reasoning-retry-delivery') })
    await repository.append(id, { type: 'turn', turnOperationId: turnOperationId('reasoning-retry-turn'), messageId: messageId('reasoning-message'), persona: 'wang-yangming', status: 'running', requestId: requestId('reasoning-retry-turn') })
    expect((await ctx.manRoleplayer.reasoning(id, turnOperationId('reasoning-turn')))?.text).toBe('第一步已完成思考\n\n第二步最终思考')
    expect(await ctx.manRoleplayer.reasoning(id, turnOperationId('reasoning-retry-turn'))).toMatchObject({ status: 'running', text: '重试轮次思考' })
  })
  it('falls back on an invalid title, does not replay the turn, and does not retry after reload', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-title-reload-')); const sessionRoot = join(root, 'sessions')
    const first = await loadComposition(sessionRoot); const adapter = new MockAdapter([personaSubmitResponse('title-reload-submit', 'answer'), textResponse('x'.repeat(49))]); first.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('title-reload-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('title-reload-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('title-reload-zeng') }] as const
    await first.manRoleplayer.create({ id, requestId: requestId('title-reload-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    await first.manRoleplayer.submitMessage(id, { messageId: messageId('title-reload-message'), deliveryOperationId: deliveryOperationId('title-reload-delivery'), turnOperationId: turnOperationId('title-reload-turn'), text: '首条困惑原话', requestId: requestId('title-reload-request') })
    const firstEvents = await (first.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(firstEvents?.find(event => event.type === 'title' && event.status === 'fallback')).toMatchObject({ value: '首条困惑原话' })
    expect(adapter.requests.filter(request => request.purpose === 'session-title')).toHaveLength(1)
    await materializeBranches(first)
    await first.fiber.dispose(); contexts.splice(contexts.indexOf(first), 1)
    const second = await loadComposition(sessionRoot); const recovery = new MockAdapter([]); second.llm.registerAdapter(['mock'], recovery); await second.manRoleplayer.resume(id, { provider: 'mock', model: 'mock' })
    expect(recovery.requests).toHaveLength(0); expect((await second.manRoleplayer.read(id))?.title).toBe('首条困惑原话')
    await second.manRoleplayer.rename(id, '冷启动标题', requestId('title-reload-rename'))
    const coldEvents = await (second.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(coldEvents?.filter(event => event.type === 'renamed')).toHaveLength(1)
  })
  it('settles state analysis once and recovers its terminal without replaying a persona turn', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-state-')); const sessionRoot = join(root, 'sessions')
    const ctx = await loadComposition(sessionRoot); const adapter = new MockAdapter([textResponse('{"candidates":[{"id":"goal-1","kind":"goal","text":"明确取舍","sourceEventIds":["e0"]}],"personaSnapshot":{"persona":"wang-yangming","sourceEventIds":["e1"],"currentUnderstanding":"正在明确取舍","coreView":"先厘清目标再选择","advice":"保留可调整空间"}}')]); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('state-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('state-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('state-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('state-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    // 真实发送会先后写入 pending 与 delivered 两个同 id 事实；模型投影必须只保留一个权威事件。
    await repository.append(id, { type: 'user-message', id: 'state-message', messageId: messageId('state-message'), persona: 'wang-yangming', content: 'state input', status: 'pending', requestId: requestId('state-user-pending') })
    await repository.append(id, { type: 'message-delivery', messageId: messageId('state-message'), deliveryOperationId: deliveryOperationId('state-delivery'), persona: 'wang-yangming', status: 'delivered', sessionMessageId: 'state-session-message', sessionEventId: 'state-user-event', requestId: requestId('state-delivery') })
    await repository.append(id, { type: 'turn', turnOperationId: turnOperationId('state-turn'), messageId: messageId('state-message'), persona: 'wang-yangming', status: 'completed', sessionEventId: 'state-session-event', requestId: requestId('state-turn') })
    await repository.append(id, { type: 'user-message', id: 'state-message', messageId: messageId('state-message'), persona: 'wang-yangming', status: 'delivered', sessionEventId: 'state-user-event', requestId: requestId('state-user-delivered') })
    const firstAnalysis = ctx.manRoleplayer.analyzeState(id, operationId('state-operation'))
    const secondAnalysis = ctx.manRoleplayer.analyzeState(id, operationId('state-operation'))
    await Promise.all([firstAnalysis, secondAnalysis])
    const events = await repository.readEvents(id)
    expect(adapter.requests).toHaveLength(1); expect(events?.filter(event => event.type === 'state-analysis')).toHaveLength(3)
    const statePrompt = adapter.requests[0]!.messages.flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('\n')
    expect(statePrompt).toContain('JSON Schema:')
    expect(statePrompt).toContain('"required":["id","kind","text","sourceEventIds"]')
    expect(statePrompt).toContain('"required":["candidates","personaSnapshot"]')
    expect(events?.filter(event => event.type === 'state-analysis').map(event => event.status)).toEqual(['claimed', 'running', 'completed'])
    const completed = events?.find(event => event.type === 'state-analysis' && event.status === 'completed')
    expect(completed).toMatchObject({ revision: 0, branchRevision: 1, inputWatermark: 'state-message', candidates: [{ id: 'goal-1' }] })
    if (completed?.type !== 'state-analysis') throw new Error('completed state event was not persisted')
    expect(completed.modelInputProjection).toEqual([
      { id: 'e0', type: 'user-message', persona: 'wang-yangming', content: 'state input' },
      { id: 'e1', type: 'turn', persona: 'wang-yangming' },
    ])
    await materializeBranches(ctx); await ctx.fiber.dispose(); contexts.splice(contexts.indexOf(ctx), 1)
    const resumed = await loadComposition(sessionRoot); const recovery = new MockAdapter([]); resumed.llm.registerAdapter(['mock'], recovery); await resumed.manRoleplayer.resume(id, { provider: 'mock', model: 'mock' })
    await resumed.manRoleplayer.analyzeState(id, operationId('state-operation'))
    expect(recovery.requests).toHaveLength(0)
  })

  it('requires a multi-turn state snapshot to reference the latest completed turn', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-state-current-turn-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const oldTurnOutput = '{"candidates":[],"personaSnapshot":{"persona":"wang-yangming","sourceEventIds":["state-old-turn"],"currentUnderstanding":"旧理解","coreView":"旧观点"}}'
    const currentTurnOutput = '{"candidates":[],"personaSnapshot":{"persona":"wang-yangming","sourceEventIds":["e3"],"currentUnderstanding":"当前理解","coreView":"当前观点"}}'
    const adapter = new MockAdapter([textResponse(oldTurnOutput), textResponse(currentTurnOutput)])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('state-current-turn-loader')
    const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('state-current-turn-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('state-current-turn-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('state-current-turn-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    for (const suffix of ['old', 'current'] as const) {
      await repository.append(id, { type: 'user-message', id: `state-${suffix}-message`, messageId: messageId(`state-${suffix}-message`), persona: 'wang-yangming', content: `${suffix} input`, status: 'delivered', requestId: requestId(`state-${suffix}-user`) })
      await repository.append(id, { type: 'message-delivery', messageId: messageId(`state-${suffix}-message`), deliveryOperationId: deliveryOperationId(`state-${suffix}-delivery`), persona: 'wang-yangming', status: 'delivered', sessionMessageId: `state-${suffix}-session-message`, sessionEventId: `state-${suffix}-user-event`, requestId: requestId(`state-${suffix}-delivery`) })
      await repository.append(id, { type: 'turn', turnOperationId: turnOperationId(`state-${suffix}-turn`), messageId: messageId(`state-${suffix}-message`), persona: 'wang-yangming', status: 'completed', sessionEventId: `state-${suffix}-event`, requestId: requestId(`state-${suffix}-turn`) })
    }
    await ctx.manRoleplayer.analyzeState(id, operationId('state-old-target-operation'))
    expect((await repository.readEvents(id))?.find(event => event.type === 'state-analysis' && event.operationId === 'state-old-target-operation' && event.status === 'failed')).toMatchObject({ failureCategory: 'context' })
    await ctx.manRoleplayer.analyzeState(id, operationId('state-current-target-operation'))
    const completedState = (await repository.readEvents(id))?.find(event => event.type === 'state-analysis' && event.operationId === 'state-current-target-operation' && event.status === 'completed')
    expect(completedState).toBeDefined()
    const modelPrompt = adapter.requests[0]?.messages.flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('\n') ?? ''
    expect(modelPrompt).toContain('"id":"e3"')
    expect(modelPrompt).not.toMatch(/state-(?:old|current)-(?:message|turn|event)/u)
    if (completedState?.type !== 'state-analysis') throw new Error('completed state event was not persisted')
    expect(JSON.stringify(completedState.modelInputProjection)).toContain('"id":"e3"')
    expect(JSON.stringify(completedState.modelInputProjection)).not.toMatch(/sessionEventId|state-(?:old|current)-(?:message|turn|event)/u)
  })

  it('recovers a claimed state analysis exactly once without replaying its provider', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-state-claimed-recovery-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const id = dilemmaId('state-claimed-recovery-loader')
    const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('state-claimed-recovery-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('state-claimed-recovery-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('state-claimed-recovery-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    await repository.append(id, {
      type: 'state-analysis', operationId: operationId('state-claimed-recovery-operation'), inputWatermark: 'state-claimed-recovery-input',
      revision: 0, branchRevision: 1, status: 'claimed', requestId: requestId('state-claimed-recovery-claim'),
    })
    const recovery = new MockAdapter([]); ctx.llm.registerAdapter(['mock'], recovery)
    await expect(ctx.manRoleplayer.read(id)).resolves.toMatchObject({ id })
    await expect(ctx.manRoleplayer.read(id)).resolves.toMatchObject({ id })
    const events = await repository.readEvents(id)
    expect(events?.filter((event): event is Extract<ProductEvent, { type: 'state-analysis' }> => event.type === 'state-analysis' && event.operationId === 'state-claimed-recovery-operation').map(event => event.status)).toEqual(['claimed', 'failed'])
    expect(recovery.requests).toHaveLength(0)
  })
  it('records provider failure and late revision results as non-allow-listed terminals', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-state-negative-'))
    const ctx = await loadComposition(join(root, 'sessions')); const id = dilemmaId('state-negative-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('state-negative-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('state-negative-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('state-negative-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    await repository.append(id, { type: 'user-message', id: 'state-negative-message', messageId: messageId('state-negative-message'), persona: 'wang-yangming', content: 'state input', status: 'delivered', requestId: requestId('state-negative-user') })
    await repository.append(id, { type: 'message-delivery', messageId: messageId('state-negative-message'), deliveryOperationId: deliveryOperationId('state-negative-delivery'), persona: 'wang-yangming', status: 'delivered', sessionMessageId: 'state-negative-session-message', sessionEventId: 'state-negative-user-event', requestId: requestId('state-negative-delivery') })
    await repository.append(id, { type: 'turn', turnOperationId: turnOperationId('state-negative-turn'), messageId: messageId('state-negative-message'), persona: 'wang-yangming', status: 'completed', sessionEventId: 'state-negative-event', requestId: requestId('state-negative-turn') })
    const failedAdapter = new MockAdapter([() => { throw new Error('provider failed') }]); const unregisterFailed = ctx.llm.registerAdapter(['mock'], failedAdapter)
    await ctx.manRoleplayer.analyzeState(id, operationId('state-failed-operation'))
    expect(failedAdapter.requests).toHaveLength(1)
    expect((await repository.readEvents(id))?.find(event => event.type === 'state-analysis' && event.operationId === operationId('state-failed-operation') && event.status === 'failed')).toMatchObject({ failureCategory: 'provider' })
    unregisterFailed()
    const lateAdapter = new ControlledStateAdapter(textResponse('{"candidates":[],"personaSnapshot":{"persona":"wang-yangming","sourceEventIds":["e1"],"currentUnderstanding":"等待确认","coreView":"保持问题开放"}}')); ctx.llm.registerAdapter(['mock'], lateAdapter)
    const lateAnalysis = ctx.manRoleplayer.analyzeState(id, operationId('state-late-operation')); await lateAdapter.started
    await repository.append(id, { type: 'user-message', id: 'late-user', messageId: messageId('late-message'), persona: 'wang-yangming', content: 'late input', status: 'delivered', requestId: requestId('late-user') })
    await repository.append(id, { type: 'message-delivery', messageId: messageId('late-message'), deliveryOperationId: deliveryOperationId('late-delivery'), persona: 'wang-yangming', status: 'delivered', sessionMessageId: 'late-session-message', sessionEventId: 'late-user-event', requestId: requestId('late-delivery') })
    lateAdapter.release(); await lateAnalysis
    const events = await repository.readEvents(id)
    const lateEvents = events?.filter(event => event.type === 'state-analysis' && event.operationId === 'state-late-operation') ?? []
    expect(lateEvents).toEqual([expect.objectContaining({ status: 'claimed' }), expect.objectContaining({ status: 'running' }), expect.objectContaining({ status: 'stale' })])
    expect((await ctx.manRoleplayer.read(id))?.timeline.some(item => item.id === 'state-late-operation')).toBe(false)
  })

  it('retries a failed state with its claimed input after new messages and a persona switch', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-state-retry-input-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const id = dilemmaId('state-retry-input-loader')
    const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('state-retry-input-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('state-retry-input-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('state-retry-input-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    await repository.append(id, { type: 'user-message', id: 'retry-original', messageId: messageId('retry-original'), persona: 'wang-yangming', content: '原始输入', status: 'delivered', requestId: requestId('retry-original-user') })
    await repository.append(id, { type: 'message-delivery', messageId: messageId('retry-original'), deliveryOperationId: deliveryOperationId('retry-original-delivery'), persona: 'wang-yangming', status: 'delivered', sessionMessageId: 'retry-original-session-message', sessionEventId: 'retry-original-session-event', requestId: requestId('retry-original-delivery') })
    await repository.append(id, { type: 'turn', turnOperationId: turnOperationId('retry-original-turn'), messageId: messageId('retry-original'), persona: 'wang-yangming', status: 'completed', sessionEventId: 'retry-original-turn-event', requestId: requestId('retry-original-turn') })
    const failedAdapter = new MockAdapter([() => { throw new Error('state provider failed') }]); const unregisterFailed = ctx.llm.registerAdapter(['mock'], failedAdapter)
    await ctx.manRoleplayer.analyzeState(id, operationId('retry-source'))
    expect(failedAdapter.requests).toHaveLength(1)
    unregisterFailed()
    const failedSource = (await repository.readEvents(id))?.findLast(event => event.type === 'state-analysis' && event.operationId === operationId('retry-source') && event.status === 'failed')
    if (failedSource?.type !== 'state-analysis' || failedSource.inputProjection === undefined) throw new Error('failed state source was not persisted')
    // 兼容修复前已经落盘的重复用户事实；重试必须重新生成去重后的精确模型输入。
    await repository.append(id, {
      ...failedSource,
      inputProjection: [...failedSource.inputProjection, failedSource.inputProjection[0]!],
      modelInputProjection: [{ id: 'e0', type: 'user-message', persona: 'wang-yangming', content: '原始输入' }, { id: 'e1', type: 'turn', persona: 'wang-yangming' }, { id: 'e0', type: 'user-message', persona: 'wang-yangming' }],
      requestId: requestId('retry-source-legacy-duplicate'),
    })
    await repository.append(id, { type: 'user-message', id: 'retry-new', messageId: messageId('retry-new'), persona: 'wang-yangming', content: '新输入不得进入重试', status: 'delivered', requestId: requestId('retry-new-user') })
    await repository.append(id, { type: 'persona-switched', persona: 'zeng-guofan', timelineId: 'retry-switch-timeline', requestId: requestId('retry-switch') })
    const retryAdapter = new MockAdapter([textResponse('{"candidates":[],"personaSnapshot":{"persona":"wang-yangming","sourceEventIds":["e1"],"currentUnderstanding":"恢复","coreView":"保持原输入"}}')]); ctx.llm.registerAdapter(['mock'], retryAdapter)
    const before = await repository.readEvents(id)
    const beforeCounts = { users: before!.filter(event => event.type === 'user-message').length, turns: before!.filter(event => event.type === 'turn').length, titles: before!.filter(event => event.type === 'title').length }
    await ctx.manRoleplayer.retryState(id, operationId('retry-source'), operationId('retry-attempt'))
    expect(retryAdapter.requests).toHaveLength(1)
    const retryText = retryAdapter.requests[0]!.messages.flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('\n')
    expect(retryText).toContain('原始输入')
    expect(retryText).not.toContain('新输入不得进入重试')
    const events = await repository.readEvents(id)
    const retryResult = events?.find(event => event.type === 'state-analysis' && event.operationId === operationId('retry-attempt') && event.status === 'stale')
    expect(retryResult).toBeDefined()
    if (retryResult?.type !== 'state-analysis') throw new Error('retry state result was not persisted')
    expect(retryResult.modelInputProjection).toEqual([
      { id: 'e0', type: 'user-message', persona: 'wang-yangming', content: '原始输入' },
      { id: 'e1', type: 'turn', persona: 'wang-yangming' },
    ])
    expect(events?.filter(event => event.type === 'user-message')).toHaveLength(beforeCounts.users)
    expect(events?.filter(event => event.type === 'turn')).toHaveLength(beforeCounts.turns)
    expect(events?.filter(event => event.type === 'title')).toHaveLength(beforeCounts.titles)
    await ctx.manRoleplayer.retryState(id, operationId('retry-source'), operationId('retry-attempt'))
    expect(retryAdapter.requests).toHaveLength(1)
  })

  it('starts one asynchronous state analysis after an accepted persona answer without delaying it', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-state-auto-'))
    const sessionRoot = join(root, 'sessions')
    const stateTurn = 'state-auto-turn'
    const stateText = JSON.stringify({
      candidates: [{ id: 'state-auto-goal', kind: 'goal', text: '明确下一步', sourceEventIds: ['e1'] }],
      personaSnapshot: {
        persona: 'wang-yangming', sourceEventIds: ['e1'],
        currentUnderstanding: '正在厘清选择', coreView: '先区分目标与手段', advice: '保留调整空间',
      },
    })
    const ctx = await loadComposition(sessionRoot, undefined, undefined, { provider: 'mock', model: 'mock' }, true)
    const adviceAnswer = '先把这次选择真正要解决的问题写成一句话，再列出不能牺牲的边界和可以试错的部分。今天先做一个成本最低、能够产生新信息的动作，并约定复盘时间；届时用实际反馈修正，而不是要求自己现在就预见全部后果。'
    const adapter = new MockAdapter([
      personaSubmitResponse('state-auto-submit', adviceAnswer),
      options => options.purpose === 'session-title' ? textResponse('状态标题') : textResponse(stateText),
      textResponse(stateText),
    ])
    vi.spyOn(adapter, 'resolveModel').mockResolvedValue({
      provider: 'mock', id: 'mock', name: 'mock',
      reasoning: { efforts: [{ id: ReasoningEffortId('off'), name: 'Off' }] },
    })
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('state-auto-loader')
    const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('state-auto-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('state-auto-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('state-auto-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const answer = await ctx.manRoleplayer.submitMessage(id, {
      messageId: messageId('state-auto-message'), deliveryOperationId: deliveryOperationId('state-auto-delivery'),
      turnOperationId: turnOperationId(stateTurn), text: '我要如何选择', requestId: requestId('state-auto-request'),
    })
    expect(answer.timeline).toContainEqual(expect.objectContaining({ id: stateTurn, status: 'completed' }))
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    for (let attempt = 0; attempt < 50; attempt++) {
      const events = await repository.readEvents(id) ?? []
      if (events.some(event => event.type === 'state-analysis' && event.status === 'completed')) break
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    const events = await repository.readEvents(id) ?? []
    expect(events.filter(event => event.type === 'state-analysis')).toHaveLength(3)
    expect(events.filter(event => event.type === 'state-analysis').map(event => event.status)).toEqual(['claimed', 'running', 'completed'])
    expect(events.some(event => event.type === 'persona-snapshot' && event.snapshot.persona === 'wang-yangming')).toBe(true)
    expect(events.some(event => event.type === 'shared-state' && event.item.id === 'state-auto-goal' && event.item.status === 'candidate')).toBe(true)
    expect(adapter.requests.filter(request => request.purpose === 'session-title')).toHaveLength(1)
    expect(adapter.requests.filter(request => request.purpose !== 'session-title')).toHaveLength(2)
    const stateRequest = adapter.requests.find(request => request.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('分析以下可见事件'))))
    expect(stateRequest?.reasoningEffort).toBe('off')
    const beforeConfirm = await ctx.manRoleplayer.read(id)
    if (beforeConfirm === undefined) throw new Error('state auto fixture was not readable')
    const confirmed = await ctx.manRoleplayer.confirmState(id, 'state-auto-goal', requestId('state-auto-confirm'), beforeConfirm.lifecycleRevision)
    expect(confirmed.sharedStateItems.find(item => item.id === 'state-auto-goal')).toMatchObject({ status: 'confirmed', text: '明确下一步' })
    await expect(ctx.manRoleplayer.confirmState(id, 'state-auto-goal', requestId('state-auto-confirm'), beforeConfirm.lifecycleRevision)).resolves.toEqual(confirmed)
    const modified = await ctx.manRoleplayer.modifyState(id, 'state-auto-goal', { text: '明确可调整的下一步', kind: 'goal' }, requestId('state-auto-modify'), confirmed.lifecycleRevision)
    const replacement = modified.sharedStateItems.find(item => item.text === '明确可调整的下一步')
    expect(replacement).toMatchObject({ status: 'confirmed', kind: 'goal' })
    if (replacement === undefined) throw new Error('modified state item was not projected')
    const withdrawn = await ctx.manRoleplayer.withdrawState(id, replacement.id, requestId('state-auto-withdraw'), modified.lifecycleRevision)
    expect(withdrawn.sharedStateItems.find(item => item.id === replacement.id)).toMatchObject({ status: 'withdrawn' })
    const remote = ctx.get('manRoleplayerRemote')
    if (remote === undefined) throw new Error('state remote was not loaded')
    const wire = await remote.list({ version: 1, includeArchived: true })
    if (!wire.ok || wire.value[0] === undefined) throw new Error('state remote did not return the product projection')
    expect(wire.value[0].state?.sharedStateItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: replacement.id, status: 'withdrawn', text: '明确可调整的下一步' }),
    ]))
  })

  it('auto-confirms only Host-verifiable verbatim user state and downgrades an unverifiable model claim', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-state-explicit-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const adapter = new MockAdapter([textResponse(JSON.stringify({
      candidates: [
        { id: 'explicit-goal', kind: 'goal', text: '我想离职', sourceEventIds: ['e0'], confirmation: 'explicit', sourceQuote: '我想离职' },
        { id: 'invented-goal', kind: 'goal', text: '用户已经决定离职', sourceEventIds: ['e0'], confirmation: 'explicit', sourceQuote: '用户已经决定离职' },
      ],
      personaSnapshot: { persona: 'wang-yangming', sourceEventIds: ['e1'], currentUnderstanding: '用户在考虑离职', coreView: '先厘清原因' },
    }))])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('state-explicit-loader')
    const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('state-explicit-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('state-explicit-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('state-explicit-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    await repository.append(id, { type: 'user-message', id: 'state-explicit-message', messageId: messageId('state-explicit-message'), persona: 'wang-yangming', content: '我想离职', status: 'delivered', requestId: requestId('state-explicit-user') })
    await repository.append(id, { type: 'message-delivery', messageId: messageId('state-explicit-message'), deliveryOperationId: deliveryOperationId('state-explicit-delivery'), persona: 'wang-yangming', status: 'delivered', sessionMessageId: 'state-explicit-session-message', sessionEventId: 'state-explicit-user-event', requestId: requestId('state-explicit-delivery') })
    await repository.append(id, { type: 'turn', turnOperationId: turnOperationId('state-explicit-turn'), messageId: messageId('state-explicit-message'), persona: 'wang-yangming', status: 'completed', sessionEventId: 'state-explicit-turn-event', requestId: requestId('state-explicit-turn') })
    await ctx.manRoleplayer.analyzeState(id, operationId('state-explicit-operation'))
    const states = (await repository.readEvents(id) ?? []).filter((event): event is Extract<ProductEvent, { type: 'shared-state' }> => event.type === 'shared-state')
    expect(states.find(event => event.item.id === 'explicit-goal')?.item).toMatchObject({ status: 'confirmed', confirmation: 'explicit' })
    expect(states.find(event => event.item.id === 'invented-goal')?.item).toMatchObject({ status: 'candidate', confirmation: 'needs-confirmation' })
  })

  it('skips research, state analysis, and model title generation for a low-information opening', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-low-information-'))
    const ctx = await loadComposition(join(root, 'sessions'), undefined, undefined, { provider: 'mock', model: 'mock' }, true)
    const adapter = new MockAdapter([personaSubmitResponse('low-information-submit', '请说说你想讨论的具体困惑。')])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('low-information-loader')
    const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('low-information-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('low-information-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('low-information-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('low-information-message'), deliveryOperationId: deliveryOperationId('low-information-delivery'), turnOperationId: turnOperationId('low-information-turn'), text: '我是个人', requestId: requestId('low-information-request') })
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id) ?? []
    const requestText = adapter.requests.flatMap(request => request.messages).flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('\n')
    expect(requestText).toContain('不要调用 evidence_lookup')
    expect(events.some(event => event.type === 'evidence-tool-claim')).toBe(false)
    expect(events.some(event => event.type === 'state-analysis')).toBe(false)
    expect(events.find(event => event.type === 'title' && event.status === 'fallback')).toMatchObject({ value: '我是个人' })
    expect(adapter.requests.filter(request => request.purpose === 'session-title')).toHaveLength(0)
  })

  it('filters another persona private Session data while retaining shared user expressions', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-isolation-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const adapter = new MockAdapter([personaSubmitResponse('iso-wang-submit', 'wang-private-secret'), options => options.purpose === 'session-title' ? textResponse('iso-title') : personaSubmitResponse(options.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('shared-expression'))) ? 'iso-zeng-submit' : 'iso-zeng-missing', options.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('shared-expression'))) ? 'zeng answer' : 'missing shared')])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('isolation-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('iso-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('iso-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('create-iso'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('iso-wang-message'), deliveryOperationId: deliveryOperationId('iso-wang-delivery'), turnOperationId: turnOperationId('iso-wang-turn'), text: 'shared-expression', requestId: requestId('iso-wang-request') })
    await ctx.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('iso-switch'))
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('iso-zeng-message'), deliveryOperationId: deliveryOperationId('iso-zeng-delivery'), turnOperationId: turnOperationId('iso-zeng-turn'), text: 'zeng question', requestId: requestId('iso-zeng-request') })
    const second = adapter.requests.findLast(request => request.purpose !== 'session-title' && request.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('zeng question'))))!
    const secondText = second.messages.flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('\n')
    expect(secondText).toContain('shared-expression'); expect(secondText).not.toContain('wang-private-secret'); expect(secondText).not.toContain('tool-secret'); expect(secondText).not.toContain('unconfirmed-candidate')
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(events?.some(event => event.type === 'context-projection' && event.projection.persona === 'zeng-guofan')).toBe(true)
  })

  it('reconciles missing product references after a cold Loader restart without calling Provider', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-reconcile-'))
    const sessionRoot = join(root, 'sessions'); const first = await loadComposition(sessionRoot)
    const firstAdapter = new MockAdapter([personaSubmitResponse('rec-submit', 'reconcile answer'), textResponse('标题1'), textResponse('标题2')]); first.llm.registerAdapter(['mock'], firstAdapter)
    const id = dilemmaId('reconcile-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('rec-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('rec-zeng') }] as const
    await first.manRoleplayer.create({ id, requestId: requestId('create-rec'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    await first.manRoleplayer.submitMessage(id, { messageId: messageId('rec-message'), deliveryOperationId: deliveryOperationId('rec-delivery'), turnOperationId: turnOperationId('rec-turn'), text: 'recover me', requestId: requestId('rec-request') })
    await materializeBranches(first)
    const domain = first.storageDomain.get('man_roleplayer_product')!
    const table = domain.table('conversations')
    const events = table.get(id) as readonly ProductEvent[]
    const retained = events.filter(event => !(event.type === 'message-delivery' && event.status === 'delivered') && !(event.type === 'turn' && event.status === 'completed'))
    await table.put(id, retained)
    await first.fiber.dispose(); contexts.splice(contexts.indexOf(first), 1)
    const second = await loadComposition(sessionRoot); const recoveryAdapter = new MockAdapter([]); second.llm.registerAdapter(['mock'], recoveryAdapter)
    await second.manRoleplayer.resume(id, { provider: 'mock', model: 'mock' })
    const result = await second.manRoleplayer.reconcileMessage(id, { messageId: messageId('rec-message'), deliveryOperationId: deliveryOperationId('rec-delivery'), turnOperationId: turnOperationId('rec-turn') })
    expect(recoveryAdapter.requests).toHaveLength(0)
    const session = second.agents.get(branches[0].sessionId)!.session; const submitResult = session.events.findLast(event => event.type === 'tool/result' && event.data.meta !== undefined)
    expect(submitResult?.type).toBe('tool/result')
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'rec-turn', sourceEventId: String(submitResult!.seq), status: 'completed' }))
  })

  it('recovers a persisted persona_turn_submit marker without replaying Provider', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-structured-recovery-'))
    const sessionRoot = join(root, 'sessions'); const ctx = await loadComposition(sessionRoot)
    const id = dilemmaId('structured-recovery-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('structured-recovery-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('structured-recovery-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('structured-recovery-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    const message = messageId('structured-recovery-message'); const delivery = deliveryOperationId('structured-recovery-delivery'); const turn = turnOperationId('structured-recovery-turn')
    await repository.append(id, { type: 'user-message', id: message, messageId: message, deliveryOperationId: delivery, status: 'pending', content: 'recover structured', persona: 'wang-yangming', requestId: requestId('structured-recovery-message') })
    const agent = ctx.agents.get(branches[0].sessionId)!; const user = createUserMessage({ content: [{ type: 'text', text: 'recover structured' }], source: { kind: 'user' } })
    agent.session.append('turn/start', { turn: 1 }); agent.session.append('step/start', { turn: 1, step: 1 }); const userEvent = agent.session.append('user/message', user, { surfaceOp: 'append' })
    const marker = { type: 'persona-turn-submit', accepted: true as const, submissionId: 'structured-recovery-submission', turnOperationId: String(turn), text: 'recovered answer', claims: [{ textRange: { start: 0, end: 16 }, kind: 'modern-inference' as const, evidenceIds: [] }], evidenceRevision: 0 }
    const callEvent = agent.session.append('tool/call', { turn: 1, step: 1, callId: CallId('structured-recovery-call'), name: 'persona_turn_submit', arguments: JSON.stringify({ text: marker.text, claims: marker.claims }) })
    const toolEvent = agent.session.append('tool/result', { turn: 1, step: 1, message: createToolResultMessage({ callId: CallId('structured-recovery-call'), content: [{ type: 'text', text: 'recovered answer' }], isError: false }), meta: marker }, { surfaceOp: 'append', sourceEventSeqs: [callEvent.seq] })
    agent.session.append('step/end', { turn: 1, step: 1 }); agent.session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    await repository.append(id, { type: 'message-delivery', messageId: message, deliveryOperationId: delivery, persona: 'wang-yangming', status: 'claimed', sessionMessageId: String(user.id), requestId: requestId('structured-recovery-delivery-claim') })
    await repository.append(id, { type: 'turn', turnOperationId: turn, messageId: message, persona: 'wang-yangming', status: 'claimed', requestId: requestId('structured-recovery-turn-claim') })
    const recovery = await ctx.manRoleplayer.reconcileMessage(
      id, { messageId: message, deliveryOperationId: delivery, turnOperationId: turn },
    )
    const events = await repository.readEvents(id)
    expect(userEvent.seq).toBeGreaterThan(-1)
    expect(recovery.timeline).toContainEqual(expect.objectContaining({ id: 'structured-recovery-message', status: 'delivered' }))
    expect(recovery.timeline).toContainEqual(expect.objectContaining({ id: 'structured-recovery-turn', status: 'completed', sourceEventId: String(toolEvent.seq) }))
    expect(events?.filter(event => event.type === 'claim-sidecar' && event.status === 'accepted')).toHaveLength(1)
  })

  it('reconciles identical texts by stable Session message ids after restart', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-identical-'))
    const sessionRoot = join(root, 'sessions'); const first = await loadComposition(sessionRoot)
    const adapter = new MockAdapter([personaSubmitResponse('same-submit-one', 'one'), textResponse('title-one'), personaSubmitResponse('same-submit-two', 'two'), textResponse('title-two')]); first.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('identical-loader'); const branch = { persona: 'wang-yangming' as const, sessionId: sessionId('identical-wang') }; const other = { persona: 'zeng-guofan' as const, sessionId: sessionId('identical-zeng') }; const branches = [branch, other] as const
    await first.manRoleplayer.create({ id, requestId: requestId('create-identical'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const text = 'same exact text'
    await first.manRoleplayer.submitMessage(id, { messageId: messageId('same-1'), deliveryOperationId: deliveryOperationId('same-d-1'), turnOperationId: turnOperationId('same-t-1'), text, requestId: requestId('same-r-1') })
    await first.manRoleplayer.submitMessage(id, { messageId: messageId('same-2'), deliveryOperationId: deliveryOperationId('same-d-2'), turnOperationId: turnOperationId('same-t-2'), text, requestId: requestId('same-r-2') })
    await materializeBranches(first)
    const domain = first.storageDomain.get('man_roleplayer_product')!; const table = domain.table('conversations'); const events = table.get(id) as readonly ProductEvent[]
    await table.put(id, events.filter(event => !(event.type === 'message-delivery' && event.status === 'delivered') && !(event.type === 'turn' && event.status === 'completed')))
    await first.fiber.dispose(); contexts.splice(contexts.indexOf(first), 1)
    const second = await loadComposition(sessionRoot); const recovery = new MockAdapter([]); second.llm.registerAdapter(['mock'], recovery); await second.manRoleplayer.resume(id, { provider: 'mock', model: 'mock' })
    await second.manRoleplayer.reconcileMessage(id, { messageId: messageId('same-1'), deliveryOperationId: deliveryOperationId('same-d-1'), turnOperationId: turnOperationId('same-t-1') })
    await second.manRoleplayer.reconcileMessage(id, { messageId: messageId('same-2'), deliveryOperationId: deliveryOperationId('same-d-2'), turnOperationId: turnOperationId('same-t-2') })
    expect(recovery.requests).toHaveLength(0)
    const restored = await (second.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    const deliveries = restored?.filter((event): event is Extract<ProductEvent, { type: 'message-delivery' }> => event.type === 'message-delivery' && event.status === 'delivered')
    const sessionEvents = second.agents.get(branch.sessionId)!.session.events.filter(event => event.type === 'user/message' && event.data.source.kind === 'user')
    expect(sessionEvents).toHaveLength(2)
    expect(deliveries).toHaveLength(2); expect(new Set(deliveries?.map(event => event.sessionMessageId)).size).toBe(2)
  })

  it('keeps cancellation terminal when a real Agent stream is aborted late', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-cancel-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const adapter = new MockAdapter(['hang']); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('cancel-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('cancel-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('cancel-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('create-cancel'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const submit = ctx.manRoleplayer.submitMessage(id, { messageId: messageId('cancel-message'), deliveryOperationId: deliveryOperationId('cancel-delivery'), turnOperationId: turnOperationId('cancel-turn'), text: 'cancel this', requestId: requestId('cancel-request') })
    for (let attempt = 0; attempt < 50 && adapter.requests.length === 0; attempt++) await new Promise(resolve => setTimeout(resolve, 5))
    await ctx.manRoleplayer.cancelMessage(id, messageId('cancel-message'), deliveryOperationId('cancel-delivery'), turnOperationId('cancel-turn'))
    await expect(submit).resolves.toBeDefined()
    const result = await ctx.manRoleplayer.read(id)
    expect(result?.timeline).toContainEqual(expect.objectContaining({ id: 'cancel-turn', status: 'cancelled' }))
    expect(result?.timeline).not.toContainEqual(expect.objectContaining({ id: 'cancel-turn', status: 'completed' }))
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(events?.some(event => event.type === 'state-analysis')).toBe(false)
    const deliveryTerminals = events?.filter(event => event.type === 'message-delivery' && event.deliveryOperationId === 'cancel-delivery' && ['delivered', 'failed', 'cancelled'].includes(event.status)) ?? []
    const turnTerminals = events?.filter(event => event.type === 'turn' && event.turnOperationId === 'cancel-turn' && ['completed', 'failed', 'cancelled'].includes(event.status)) ?? []
    expect(deliveryTerminals).toHaveLength(1)
    expect(deliveryTerminals[0]).toMatchObject({ status: 'cancelled' })
    expect(turnTerminals).toHaveLength(1)
    expect(turnTerminals[0]).toMatchObject({ status: 'cancelled' })
  })
  it('rejects a second message while the first lease is pending', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-lease-'))
    const ctx = await loadComposition(join(root, 'sessions')); const adapter = new MockAdapter(['hang']); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('lease-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('lease-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('lease-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('lease-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const first = ctx.manRoleplayer.submitMessage(id, { messageId: messageId('lease-a'), deliveryOperationId: deliveryOperationId('lease-da'), turnOperationId: turnOperationId('lease-ta'), text: 'A', requestId: requestId('lease-ra') })
    for (let attempt = 0; attempt < 50 && adapter.requests.length === 0; attempt++) await new Promise(resolve => setTimeout(resolve, 5))
    await expect(ctx.manRoleplayer.submitMessage(id, { messageId: messageId('lease-b'), deliveryOperationId: deliveryOperationId('lease-db'), turnOperationId: turnOperationId('lease-tb'), text: 'B', requestId: requestId('lease-rb') })).rejects.toThrow(/still running/)
    expect(adapter.requests).toHaveLength(1)
    await ctx.manRoleplayer.cancelMessage(id, messageId('lease-a'), deliveryOperationId('lease-da'), turnOperationId('lease-ta')); await expect(first).resolves.toBeDefined()
  })
  it('fails closed for forged evidence capabilities through the real Loader tool', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-evidence-capability-'))
    const ctx = await loadComposition(join(root, 'sessions')); const adapter = new MockAdapter(['hang']); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('evidence-capability-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('evidence-capability-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('evidence-capability-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('evidence-capability-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const submit = ctx.manRoleplayer.submitMessage(id, { messageId: messageId('evidence-capability-message'), deliveryOperationId: deliveryOperationId('evidence-capability-delivery'), turnOperationId: turnOperationId('evidence-capability-turn'), text: 'lookup evidence', requestId: requestId('evidence-capability-request') })
    for (let attempt = 0; attempt < 50 && adapter.requests.length === 0; attempt++) await new Promise(resolve => setTimeout(resolve, 5))
    await waitForActiveTurn(ctx, id)
    const actual = ctx.agents.get(branches[0].sessionId)!
    const other = ctx.agents.get(branches[1].sessionId)!
    const signal = new AbortController().signal
    let call = 0
    const invoke = (agent: typeof actual | undefined) => ctx.tools.execute({ callId: CallId(`evidence-${++call}`), name: 'evidence_lookup', arguments: { topic: '心', requestedCount: 1 }, ...agent === undefined ? {} : { agent }, signal })
    const forged = { ...actual, id: sessionId('forged-agent') }
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    const beforeUnauthorized = (await repository.readEvents(id))?.length ?? 0
    const directOther = await ctx.manRoleplayer.lookupEvidence(other, '心', 1)
    const directForged = await ctx.manRoleplayer.lookupEvidence(forged, '心', 1)
    const directAbsent = await ctx.manRoleplayer.lookupEvidence(undefined, '心', 1)
    for (const result of [directOther, directForged, directAbsent]) {
      expect(result).toEqual({ status: 'unauthorized', evidence: [] })
      expect(JSON.stringify(result)).not.toMatch(/source|text|title/iu)
    }
    expect((await repository.readEvents(id))?.length).toBe(beforeUnauthorized)
    const actualResult = await invoke(actual); const otherResult = await invoke(other)
    const forgedResult = await invoke(forged); const absentResult = await invoke(undefined)
    expect(actualResult).toMatchObject({ isError: false })
    expect(actualResult).toMatchObject({ value: { status: 'completed', evidence: [] } })
    expect(otherResult).toMatchObject({ isError: false })
    expect(otherResult).toMatchObject({ value: { status: 'unauthorized', evidence: [] } })
    // Product tools are Agent-scoped: an object with a copied id and no
    // product scope is an unknown tool, not an execution capability.
    expect(forgedResult).toMatchObject({ isError: true }); expect(absentResult).toMatchObject({ isError: true })
    const events = await repository.readEvents(id)
    expect(events?.filter(event => event.type === 'evidence-tool-claim')).toHaveLength(2)
    expect(await ctx.manRoleplayer.evidenceActivity(id)).toContainEqual(expect.objectContaining({ status: 'completed-zero-hit', returnedCount: 0 }))
    await ctx.manRoleplayer.cancelMessage(id, messageId('evidence-capability-message'), deliveryOperationId('evidence-capability-delivery'), turnOperationId('evidence-capability-turn')); await expect(submit).resolves.toBeDefined()
  })
  it('loads only the two configured official sources and binds lookup to each active persona', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-evidence-sources-'))
    const wangPath = join(root, '调研成果-王阳明.md'); const zengPath = join(root, '调研成果-曾国藩.md')
    const card = (persona: string, title: string) => `> persona_id：\`${persona}\`\n### 【事迹卡 1】\n- **title**：${title}\n- **full_text**：${title}事实\n- **source**：《正式史料》\n`
    await writeFile(wangPath, card('王阳明', '阳明可靠事迹')); await writeFile(zengPath, card('曾国藩', '曾国藩可靠事迹'))
    const ctx = await loadComposition(join(root, 'sessions'), { wangYangmingPath: wangPath, zengGuofanPath: zengPath }, { root: localPresetRoot, wangYangming: 'wang-yangming', zengGuofan: 'zeng-guofan' }); const adapter = new MockAdapter(['hang', 'hang']); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('evidence-sources-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('evidence-sources-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('evidence-sources-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('evidence-sources-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const invoke = (agent: ReturnType<typeof ctx.agents.get>) => ctx.tools.execute({ callId: CallId(`evidence-source-${agent?.id}`), name: 'evidence_lookup', arguments: { topic: '可靠', requestedCount: 1 }, ...agent === undefined ? {} : { agent }, signal: new AbortController().signal })
    const wangSubmit = ctx.manRoleplayer.submitMessage(id, { messageId: messageId('evidence-sources-wang-message'), deliveryOperationId: deliveryOperationId('evidence-sources-wang-delivery'), turnOperationId: turnOperationId('evidence-sources-wang-turn'), text: '王问题', requestId: requestId('evidence-sources-wang-request') })
    for (let attempt = 0; attempt < 50 && adapter.requests.length === 0; attempt++) await new Promise(resolve => setTimeout(resolve, 5))
    await waitForActiveTurn(ctx, id)
    const wangResult = await invoke(ctx.agents.get(branches[0].sessionId)); expect(wangResult).toMatchObject({ isError: false })
    await ctx.manRoleplayer.cancelMessage(id, messageId('evidence-sources-wang-message'), deliveryOperationId('evidence-sources-wang-delivery'), turnOperationId('evidence-sources-wang-turn')); await expect(wangSubmit).resolves.toBeDefined()
    await ctx.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('evidence-sources-switch'))
    const zengSubmit = ctx.manRoleplayer.submitMessage(id, { messageId: messageId('evidence-sources-zeng-message'), deliveryOperationId: deliveryOperationId('evidence-sources-zeng-delivery'), turnOperationId: turnOperationId('evidence-sources-zeng-turn'), text: '曾问题', requestId: requestId('evidence-sources-zeng-request') })
    for (let attempt = 0; attempt < 50 && adapter.requests.length < 2; attempt++) await new Promise(resolve => setTimeout(resolve, 5))
    const zengResult = await invoke(ctx.agents.get(branches[1].sessionId)); expect(zengResult).toMatchObject({ isError: false })
    await ctx.manRoleplayer.cancelMessage(id, messageId('evidence-sources-zeng-message'), deliveryOperationId('evidence-sources-zeng-delivery'), turnOperationId('evidence-sources-zeng-turn')); await expect(zengSubmit).resolves.toBeDefined()
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    const availableEvidence = events?.filter((event): event is Extract<ProductEvent, { type: 'evidence' }> => event.type === 'evidence' && event.status === 'available') ?? []
    expect(availableEvidence.map(event => event.persona)).toEqual(['wang-yangming', 'zeng-guofan'])
  })
  it('runs evidence lookup in the real Agent turn before accepting restricted attribution claims', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-evidence-tool-turn-'))
    const wangPath = join(root, '调研成果-王阳明.md'); const zengPath = join(root, '调研成果-曾国藩.md')
    const card = (persona: string, title: string, text: string) => `> persona_id：\`${persona}\`\n### 【事迹卡 1】\n- **title**：${title}\n- **full_text**：${text}\n- **source**：《待核史料》⚠️\n`
    await writeFile(wangPath, card('王阳明', '阳明背景', '人须在事上磨')); await writeFile(zengPath, card('曾国藩', '曾国藩背景', '曾国藩背景'))
    const ctx = await loadComposition(join(root, 'sessions'), { wangYangmingPath: wangPath, zengGuofanPath: zengPath }, { root: localPresetRoot, wangYangming: 'wang-yangming', zengGuofan: 'zeng-guofan' })
    const answer = 'answer text'
    const adapter = new MockAdapter([
      toolCallResponse('evidence-call', 'evidence_lookup', { topic: '请结合事上磨练谈谈我的选择', requestedCount: 1 }),
      textResponse(answer),
      toolCallResponse('evidence-finalizer', 'persona_turn_submit', personaSubmitArguments(answer, 'attribution', ['wang-yangming:research:1'])),
      textResponse('title'),
    ]); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('evidence-tool-turn-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('evidence-tool-turn-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('evidence-tool-turn-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('evidence-tool-turn-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('evidence-tool-turn-message'), deliveryOperationId: deliveryOperationId('evidence-tool-turn-delivery'), turnOperationId: turnOperationId('evidence-tool-turn-turn'), text: '请说明阳明', requestId: requestId('evidence-tool-turn-request') })
    expect(adapter.requests.some(request => request.messages.some(message => message.content.some(block => block.type === 'tool-call')))).toBe(true)
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    const evidence = events?.find(event => event.type === 'evidence' && event.status === 'available')
    expect(evidence).toMatchObject({ persona: 'wang-yangming', evidenceType: 'attribution', trustLevel: 'restricted' })
    const claims = events?.filter(event => event.type === 'evidence-tool-claim' && event.status === 'completed') ?? []
    expect(claims).toHaveLength(1)
    const evidenceId = evidence?.type === 'evidence' ? evidence.evidenceId : undefined
    expect(claims[0]).toMatchObject({ returnedEvidenceIds: [evidenceId] })
    expect((await ctx.manRoleplayer.acceptedAnswer(id, 'evidence-tool-turn-turn'))?.length).toBe(11)
    expect(events?.some(event => event.type === 'activity' && event.phase === 'finalizing')).toBe(true)
    const details = await ctx.manRoleplayer.evidenceStatus(id)
    expect(details).toContainEqual(expect.objectContaining({
      id: evidence?.type === 'evidence' ? evidence.evidenceId : undefined,
      title: '阳明背景', text: '人须在事上磨', source: '《待核史料》',
      evidenceType: 'attribution', trustLevel: 'restricted', status: 'available',
    }))
    expect(await ctx.manRoleplayer.evidenceActivity(id)).toContainEqual(expect.objectContaining({ status: 'completed-with-results', returnedCount: 1 }))
    await ctx.manRoleplayer.challengeEvidence(id, evidenceId!, requestId('evidence-tool-turn-challenge'))
    expect((await ctx.manRoleplayer.evidenceStatus(id)).find(item => item.id === evidenceId)?.status).toBe('challenged')
    await ctx.manRoleplayer.reviewEvidence(id, evidenceId!, requestId('evidence-tool-turn-review'))
    expect((await ctx.manRoleplayer.evidenceStatus(id)).find(item => item.id === evidenceId)?.status).toBe('available')
    await ctx.manRoleplayer.withdrawEvidence(id, evidenceId!, requestId('evidence-tool-turn-withdraw'))
    expect((await ctx.manRoleplayer.evidenceStatus(id)).find(item => item.id === evidenceId)?.status).toBe('withdrawn')
  })
  it('reports the cumulative distinct evidence count across two lookups in one turn', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-evidence-cumulative-'))
    const wangPath = join(root, '调研成果-王阳明.md'); const zengPath = join(root, '调研成果-曾国藩.md')
    await writeFile(wangPath, '> persona_id：`王阳明`\n### 【事迹卡 1】\n- **title**：alpha\n- **full_text**：alpha\n- **source**：《正式史料》\n### 【事迹卡 2】\n- **title**：beta\n- **full_text**：beta\n- **source**：《正式史料》\n')
    await writeFile(zengPath, '> persona_id：`曾国藩`\n### 【事迹卡 1】\n- **title**：曾国藩事迹\n- **full_text**：曾国藩经历\n- **source**：《正式史料》\n')
    const ctx = await loadComposition(join(root, 'sessions'), { wangYangmingPath: wangPath, zengGuofanPath: zengPath }, { root: localPresetRoot, wangYangming: 'wang-yangming', zengGuofan: 'zeng-guofan' })
    const answer = '结合两段资料继续分析。'
    const adapter = new MockAdapter([
      toolCallResponse('cumulative-first', 'evidence_lookup', { topic: 'alpha', requestedCount: 1 }),
      toolCallResponse('cumulative-second', 'evidence_lookup', { topic: 'beta', requestedCount: 1 }),
      personaSubmitResponse('cumulative-uncited', '只做现代推演'),
      toolCallResponse('cumulative-submit', 'persona_turn_submit', personaSubmitArguments(answer, 'historical-fact', ['wang-yangming:research:1', 'wang-yangming:research:2'])),
      textResponse('cumulative title'),
    ]); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('evidence-cumulative-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('evidence-cumulative-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('evidence-cumulative-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('evidence-cumulative-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('evidence-cumulative-message'), deliveryOperationId: deliveryOperationId('evidence-cumulative-delivery'), turnOperationId: turnOperationId('evidence-cumulative-turn'), text: '请结合两段经历', requestId: requestId('evidence-cumulative-request') })
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id) ?? []
    const completedLookups = events.filter((event): event is Extract<ProductEvent, { type: 'evidence-tool-claim' }> => event.type === 'evidence-tool-claim' && event.status === 'completed')
    expect(completedLookups.map(event => event.returnedEvidenceIds)).toEqual([['wang-yangming:research:1'], ['wang-yangming:research:2']])
    expect(adapter.requests.filter(request => request.purpose !== 'session-title')).toHaveLength(4)
    const conversation = await ctx.manRoleplayer.read(id)
    const activity = conversation?.activities?.find(item => item.turnOperationId === 'evidence-cumulative-turn')
    const reportedCounts = activity?.stages?.flatMap(stage => stage.phase === 'researching' && stage.count !== undefined ? [stage.count] : []) ?? []
    expect(reportedCounts.at(-1)).toBe(2)
    expect(Math.max(...reportedCounts)).toBe(2)
  })
  it('precharges evidence claims atomically per turn and recovers claimed work', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-evidence-budget-'))
    const sessionRoot = join(root, 'sessions'); const ctx = await loadComposition(sessionRoot); const adapter = new MockAdapter(['hang']); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('evidence-budget-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('evidence-budget-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('evidence-budget-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('evidence-budget-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const submit = ctx.manRoleplayer.submitMessage(id, { messageId: messageId('evidence-budget-message'), deliveryOperationId: deliveryOperationId('evidence-budget-delivery'), turnOperationId: turnOperationId('evidence-budget-turn'), text: 'budget', requestId: requestId('evidence-budget-request') })
    for (let attempt = 0; attempt < 50 && adapter.requests.length === 0; attempt++) await new Promise(resolve => setTimeout(resolve, 5))
    await waitForActiveTurn(ctx, id)
    const agent = ctx.agents.get(branches[0].sessionId)!; let call = 0
    const invoke = (topic: string, signal = new AbortController().signal, requestedCount = 1) => ctx.tools.execute({ callId: CallId(`budget-${++call}`), name: 'evidence_lookup', arguments: { topic, requestedCount }, agent, signal })
    const firstCalls = await Promise.all([invoke('心'), invoke('事')]); await invoke('心'); const exhausted = await invoke('人', undefined, 3)
    expect(firstCalls.map(result => (result.isError ? undefined : result.value))).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'completed' })]))
    expect(exhausted).toMatchObject({ isError: false, value: { status: 'budget-exhausted', evidence: [] } })
    const controller = new AbortController(); controller.abort(); await invoke('abort', controller.signal)
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    const claims = events?.filter((event): event is Extract<ProductEvent, { type: 'evidence-tool-claim' }> => event.type === 'evidence-tool-claim') ?? []
    expect(claims.filter(claim => claim.status === 'completed')).toHaveLength(2)
    expect(claims.some(claim => claim.status === 'failed')).toBe(true)
    for (const operation of new Set(claims.map(claim => claim.operationId))) expect(claims.filter(claim => claim.operationId === operation && claim.status !== 'claimed')).toHaveLength(1)
    await ctx.manRoleplayer.cancelMessage(id, messageId('evidence-budget-message'), deliveryOperationId('evidence-budget-delivery'), turnOperationId('evidence-budget-turn')); await expect(submit).resolves.toBeDefined()
    await materializeBranches(ctx); await ctx.fiber.dispose(); contexts.splice(contexts.indexOf(ctx), 1)
    const resumed = await loadComposition(sessionRoot); const recovery = new MockAdapter([]); resumed.llm.registerAdapter(['mock'], recovery); await resumed.manRoleplayer.resume(id, { provider: 'mock', model: 'mock' }); expect(recovery.requests).toHaveLength(0)
  })
  it('accepts only a valid same-turn Claim sidecar and keeps request idempotency', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-claims-'))
    const ctx = await loadComposition(join(root, 'sessions')); const adapter = new MockAdapter([personaSubmitResponse('claims-submit', 'answer text'), textResponse('title')]); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('claims-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('claims-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('claims-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('claims-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('claims-message'), deliveryOperationId: deliveryOperationId('claims-delivery'), turnOperationId: turnOperationId('claims-turn'), text: 'claim input', requestId: requestId('claims-request') })
    const accepted = [{ textRange: { start: 0, end: 11 }, kind: 'modern-inference' as const, evidenceIds: [] }]
    await ctx.manRoleplayer.submitClaims(id, turnOperationId('claims-turn'), accepted, requestId('claims-sidecar'))
    await ctx.manRoleplayer.submitClaims(id, turnOperationId('claims-turn'), accepted, requestId('claims-sidecar'))
    await expect(ctx.manRoleplayer.submitClaims(id, turnOperationId('claims-turn'), [{ ...accepted[0]!, kind: 'insufficient-evidence' }], requestId('claims-sidecar'))).rejects.toThrow(/conflicts/)
    await expect(ctx.manRoleplayer.submitClaims(id, turnOperationId('claims-turn'), [{ textRange: { start: 0, end: 11 }, kind: 'reliable-quote', evidenceIds: ['unknown'] }], requestId('claims-unknown'))).rejects.toThrow(/invalid/)
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(events?.filter(event => event.type === 'claim-sidecar' && event.status === 'accepted')).toHaveLength(2)
    expect(adapter.requests.filter(request => request.purpose === 'session-title')).toHaveLength(1)
  })
  it('preserves accepted Claim history while challenge-first and later review make current sidecars stale', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-claims-race-')); const sessionRoot = join(root, 'sessions'); const ctx = await loadComposition(sessionRoot)
    const id = dilemmaId('claims-race-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('claims-race-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('claims-race-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('claims-race-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    await repository.append(id, { type: 'evidence', evidenceId: 'evidence-race', persona: 'wang-yangming', evidenceType: 'research', trustLevel: 'reliable', sourceFingerprint: 'fp-race', status: 'available', requestId: requestId('evidence-race') })
    await repository.append(id, { type: 'turn', turnOperationId: turnOperationId('claims-race-turn'), messageId: messageId('claims-race-message'), persona: 'wang-yangming', status: 'completed', sessionEventId: 'claims-race-event', requestId: requestId('claims-race-turn') })
    const sidecar = { type: 'claim-sidecar' as const, turnOperationId: turnOperationId('claims-race-turn'), textRange: { start: 0, end: 1 }, kind: 'reliable-quote' as const, evidenceIds: ['evidence-race'], status: 'accepted' as const, requestId: requestId('claims-race-sidecar') }
    await repository.appendClaimSidecarsIfCurrent(id, turnOperationId('claims-race-turn'), 1, [sidecar])
    await repository.append(id, { type: 'evidence', evidenceId: 'evidence-race', persona: 'wang-yangming', evidenceType: 'research', trustLevel: 'reliable', sourceFingerprint: 'fp-race', status: 'challenged', requestId: requestId('claims-race-challenge') })
    await repository.appendClaimSidecarsIfCurrent(id, turnOperationId('claims-race-turn'), 1, [{ ...sidecar, requestId: requestId('claims-race-sidecar-late') }])
    const beforeReload = await repository.readEvents(id); expect(beforeReload?.filter(event => event.type === 'claim-sidecar')).toHaveLength(2)
    expect(beforeReload?.filter(event => event.type === 'claim-sidecar').map(event => event.status)).toEqual(['accepted', 'stale'])
    await materializeBranches(ctx); await ctx.fiber.dispose(); contexts.splice(contexts.indexOf(ctx), 1)
    const resumed = await loadComposition(sessionRoot); await resumed.manRoleplayer.resume(id, { provider: 'mock', model: 'mock' })
    const recoveryRepository = (resumed.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    const replay = await recoveryRepository.appendClaimSidecarsIfCurrent(id, turnOperationId('claims-race-turn'), 1, [sidecar]); expect(replay.accepted).toBe(false)
    const afterReload = await recoveryRepository.readEvents(id); expect(afterReload?.filter(event => event.type === 'claim-sidecar')).toHaveLength(2)
    expect((await resumed.manRoleplayer.read(id))?.title).toBeUndefined()
  })
  it('replays evidence lifecycle and never accepts sidecars after withdrawal', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-evidence-lifecycle-')); const sessionRoot = join(root, 'sessions'); const ctx = await loadComposition(sessionRoot)
    const id = dilemmaId('evidence-lifecycle-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('evidence-lifecycle-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('evidence-lifecycle-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('evidence-lifecycle-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    const evidence = { type: 'evidence' as const, evidenceId: 'evidence-lifecycle', persona: 'wang-yangming' as const, evidenceType: 'research', trustLevel: 'reliable', sourceFingerprint: 'fp-lifecycle', requestId: requestId('evidence-lifecycle-available') }
    await repository.append(id, { ...evidence, status: 'available' })
    await repository.append(id, { type: 'turn', turnOperationId: turnOperationId('evidence-lifecycle-turn'), messageId: messageId('evidence-lifecycle-message'), persona: 'wang-yangming', status: 'completed', sessionEventId: 'evidence-lifecycle-event', requestId: requestId('evidence-lifecycle-turn') })
    const sidecar = { type: 'claim-sidecar' as const, turnOperationId: turnOperationId('evidence-lifecycle-turn'), textRange: { start: 0, end: 1 }, kind: 'reliable-quote' as const, evidenceIds: ['evidence-lifecycle'], status: 'accepted' as const, requestId: requestId('evidence-lifecycle-sidecar') }
    await repository.appendClaimSidecarsIfCurrent(id, turnOperationId('evidence-lifecycle-turn'), 1, [sidecar])
    await repository.append(id, { ...evidence, status: 'challenged', requestId: requestId('evidence-lifecycle-challenge') })
    await repository.append(id, { ...evidence, status: 'available', requestId: requestId('evidence-lifecycle-review') })
    await repository.append(id, { ...evidence, status: 'withdrawn', requestId: requestId('evidence-lifecycle-withdraw') })
    await repository.appendClaimSidecarsIfCurrent(id, turnOperationId('evidence-lifecycle-turn'), 3, [{ ...sidecar, requestId: requestId('evidence-lifecycle-late') }])
    const events = await repository.readEvents(id); expect(events?.filter(event => event.type === 'claim-sidecar')).toHaveLength(2)
    expect(events?.filter(event => event.type === 'claim-sidecar').map(event => event.status)).toEqual(['accepted', 'stale'])
    const latestEvidence = events?.findLast((event): event is Extract<ProductEvent, { type: 'evidence' }> => event.type === 'evidence' && event.evidenceId === 'evidence-lifecycle')
    expect(latestEvidence?.status).toBe('withdrawn')
    await materializeBranches(ctx); await ctx.fiber.dispose(); contexts.splice(contexts.indexOf(ctx), 1)
    const resumed = await loadComposition(sessionRoot)
    const replay = await (resumed.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(replay?.filter(event => event.type === 'claim-sidecar')).toHaveLength(2)
  })
  it('rejects switching during a Wang operation and allows it after confirmed cancellation', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-switch-cancel-'))
    const ctx = await loadComposition(join(root, 'sessions')); const adapter = new MockAdapter(['hang']); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('switch-cancel-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('switch-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('switch-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('switch-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const submit = ctx.manRoleplayer.submitMessage(id, { messageId: messageId('switch-message'), deliveryOperationId: deliveryOperationId('switch-delivery'), turnOperationId: turnOperationId('switch-turn'), text: '王', requestId: requestId('switch-request') })
    for (let attempt = 0; attempt < 50 && adapter.requests.length === 0; attempt++) await new Promise(resolve => setTimeout(resolve, 5))
    await expect(ctx.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('switch-persona'))).rejects.toThrow(/still running/)
    const beforeCancel = await ctx.manRoleplayer.read(id)
    expect(beforeCancel?.activePersona).toBe('wang-yangming')
    expect(beforeCancel?.branches).toHaveLength(2)
    await ctx.manRoleplayer.cancelMessage(id, messageId('switch-message'), deliveryOperationId('switch-delivery'), turnOperationId('switch-turn')); await expect(submit).resolves.toBeDefined()
    await expect(ctx.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('switch-persona-after-cancel'))).resolves.toMatchObject({ activePersona: 'zeng-guofan' })
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(events?.filter(event => event.type === 'message-delivery' && event.deliveryOperationId === 'switch-delivery' && event.status === 'cancelled')).toHaveLength(1)
    expect(events?.filter(event => event.type === 'turn' && event.turnOperationId === 'switch-turn' && event.status === 'cancelled')).toHaveLength(1)
    expect(events?.filter(event => event.type === 'message-delivery' && event.deliveryOperationId === 'switch-delivery' && event.persona === 'zeng-guofan')).toHaveLength(0)
    expect(adapter.requests).toHaveLength(1)
  })
  it('keeps a stopping turn locked across a cold Loader restart', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-stopping-recovery-'))
    const sessionRoot = join(root, 'sessions')
    const first = await loadComposition(sessionRoot)
    const created = await first.manRoleplayer.createBlank({ requestId: requestId('stopping-recovery-create'), activePersona: 'wang-yangming', personas: ['wang-yangming'] })
    await materializeBranches(first)
    const repository = (first.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    await repository.append(created.id, { type: 'user-message', id: 'stopping-message', messageId: messageId('stopping-message'), deliveryOperationId: deliveryOperationId('stopping-delivery'), persona: 'wang-yangming', status: 'pending', content: 'stopping', requestId: requestId('stopping-user') })
    await repository.append(created.id, { type: 'message-delivery', messageId: messageId('stopping-message'), deliveryOperationId: deliveryOperationId('stopping-delivery'), persona: 'wang-yangming', status: 'cancelled', requestId: requestId('stopping-delivery') })
    await repository.append(created.id, { type: 'turn', turnOperationId: turnOperationId('stopping-turn'), messageId: messageId('stopping-message'), persona: 'wang-yangming', status: 'cancelled', requestId: requestId('stopping-turn') })
    await repository.append(created.id, { type: 'turn-execution', turnOperationId: turnOperationId('stopping-turn'), messageId: messageId('stopping-message'), persona: 'wang-yangming', state: 'stopping', requestId: requestId('stopping-execution') })
    await first.fiber.dispose(); contexts.splice(contexts.indexOf(first), 1)
    const resumed = await loadComposition(sessionRoot)
    await resumed.manRoleplayer.resume(created.id, { provider: 'mock', model: 'mock' })
    await expect(resumed.manRoleplayer.switchPersona(created.id, 'zeng-guofan', requestId('stopping-switch'))).rejects.toThrow(/still running|stopping/)
    const resumedRepository = (resumed.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    await resumedRepository.append(created.id, { type: 'turn-execution', turnOperationId: turnOperationId('stopping-turn'), messageId: messageId('stopping-message'), persona: 'wang-yangming', state: 'stopped', requestId: requestId('stopping-execution-stopped') })
    await expect(resumed.manRoleplayer.switchPersona(created.id, 'zeng-guofan', requestId('stopping-switch-after'))).resolves.toMatchObject({ activePersona: 'zeng-guofan' })
  })

  it('reconciles failed stop checkpoints after cold resume verifies the same agent is idle', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-cold-failed-'))
    const sessions = join(root, 'sessions')
    const first = await loadComposition(sessions)
    const created = await first.manRoleplayer.createBlank({ requestId: requestId('cold-failed-create'), activePersona: 'wang-yangming', personas: ['wang-yangming'] })
    await materializeBranches(first)
    const repository = (first.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    await repository.append(created.id, { type: 'user-message', id: 'cold-message', messageId: messageId('cold-message'), deliveryOperationId: deliveryOperationId('cold-delivery'), persona: 'wang-yangming', status: 'pending', content: '你好', requestId: requestId('cold-user') })
    await repository.append(created.id, { type: 'message-delivery', messageId: messageId('cold-message'), deliveryOperationId: deliveryOperationId('cold-delivery'), persona: 'wang-yangming', status: 'failed', requestId: requestId('cold-delivery-failed') })
    await repository.append(created.id, { type: 'turn', turnOperationId: turnOperationId('cold-turn'), messageId: messageId('cold-message'), persona: 'wang-yangming', status: 'failed', requestId: requestId('cold-turn-failed') })
    await repository.append(created.id, { type: 'turn-execution', turnOperationId: turnOperationId('cold-turn'), messageId: messageId('cold-message'), persona: 'wang-yangming', state: 'stop-failed', requestId: requestId('cold-stop-failed') })
    await first.fiber.dispose(); contexts.splice(contexts.indexOf(first), 1)
    const resumed = await loadComposition(sessions)
    await resumed.manRoleplayer.resume(created.id, { provider: 'mock', model: 'mock' })
    expect(await resumed.manRoleplayer.activeTurn(created.id)).toBeUndefined()
    resumed.llm.registerAdapter(['mock'], new MockAdapter([toolCallResponse('cold-submit', 'persona_turn_submit', { segments: [{ text: '请说说你的具体困惑。', kind: 'modern-inference', evidenceIds: [] }] }), textResponse('')]))
    const retried = await resumed.manRoleplayer.retryMessage(created.id, messageId('cold-message'), turnOperationId('cold-turn'), requestId('cold-retry'))
    expect(retried.timeline).toContainEqual(expect.objectContaining({ id: 'retry:cold-message:cold-retry', status: 'completed' }))
  })

  it('lets normal generation and finalization outlive the stop timeout', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-normal-duration-'))
    const ctx = await loadComposition(join(root, 'sessions'), undefined, undefined, { provider: 'mock', model: 'mock' }, false, {
      activeTimeoutMs: 2_000, requestTimeoutMs: 1_000, stopTimeoutMs: 10,
    })
    const adapter = new MockAdapter([
      textResponse('请先整理眼前最重要的一件事。'),
      toolCallResponse('slow-submit', 'persona_turn_submit', { segments: [{ text: '请先整理眼前最重要的一件事。', kind: 'modern-inference', evidenceIds: [] }] }),
      textResponse(''),
    ])
    const stream = adapter.stream.bind(adapter)
    vi.spyOn(adapter, 'stream').mockImplementation(async function* (options) {
      await new Promise(resolve => setTimeout(resolve, 30))
      yield* stream(options)
    })
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('normal-duration')
    await ctx.manRoleplayer.create({ id, requestId: requestId('normal-create'), branches: [{ persona: 'wang-yangming', sessionId: sessionId('normal-wang') }], activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const result = await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('normal-message'), deliveryOperationId: deliveryOperationId('normal-delivery'), turnOperationId: turnOperationId('normal-turn'), text: '你好', requestId: requestId('normal-submit') })
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'normal-turn', status: 'completed' }))
    expect(await ctx.manRoleplayer.activeTurn(id)).toBeUndefined()
  })

  it.each(['activeTimeoutMs', 'requestTimeoutMs'] as const)('stops an acknowledged background turn at its real %s budget and allows retry', async budget => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-real-timeout-'))
    const ctx = await loadComposition(join(root, 'sessions'), undefined, undefined, { provider: 'mock', model: 'mock' }, false, {
      activeTimeoutMs: 2_000, requestTimeoutMs: 1_000, stopTimeoutMs: 100, [budget]: 30,
    })
    const adapter = new MockAdapter(['hang', toolCallResponse('retry-submit', 'persona_turn_submit', { segments: [{ text: '先说说你的具体困惑。', kind: 'modern-inference', evidenceIds: [] }] }), textResponse('')])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId(`real-timeout-${budget}`)
    await ctx.manRoleplayer.create({ id, requestId: requestId('real-create'), branches: [{ persona: 'wang-yangming', sessionId: sessionId(`real-wang-${budget}`) }], activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('real-message'), deliveryOperationId: deliveryOperationId('real-delivery'), turnOperationId: turnOperationId('real-turn'), text: '你好', requestId: requestId('real-submit'), acknowledgeOnly: true })
    for (let attempt = 0; attempt < 100 && await ctx.manRoleplayer.activeTurn(id) !== undefined; attempt++) await new Promise(resolve => setTimeout(resolve, 5))
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    expect((await repository.readEvents(id))?.findLast(event => event.type === 'turn-budget')).toMatchObject({ status: 'budget-exhausted' })
    const retried = await ctx.manRoleplayer.retryMessage(id, messageId('real-message'), turnOperationId('real-turn'), requestId('real-retry'))
    expect(retried.timeline).toContainEqual(expect.objectContaining({ id: 'retry:real-message:real-retry', status: 'completed' }))
  })

  it('contains an acknowledged execution rejection and retries the failed attempt', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-ack-rejection-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const id = dilemmaId('ack-rejection')
    const branch = { persona: 'wang-yangming' as const, sessionId: sessionId('ack-rejection-wang') }
    await ctx.manRoleplayer.create({ id, requestId: requestId('ack-create'), branches: [branch], activePersona: branch.persona, agentOptions: { provider: 'mock', model: 'mock' } })
    const agent = ctx.agents.get(branch.sessionId)!
    vi.spyOn(agent, 'followup').mockImplementationOnce(() => { throw new Error('local followup failure') })
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('ack-message'), deliveryOperationId: deliveryOperationId('ack-delivery'), turnOperationId: turnOperationId('ack-turn'), text: '你好', requestId: requestId('ack-submit'), acknowledgeOnly: true })
    for (let attempt = 0; attempt < 100 && await ctx.manRoleplayer.activeTurn(id) !== undefined; attempt++) await new Promise(resolve => setTimeout(resolve, 5))
    ctx.llm.registerAdapter(['mock'], new MockAdapter([toolCallResponse('ack-retry-submit', 'persona_turn_submit', { segments: [{ text: '请说说你的具体困惑。', kind: 'modern-inference', evidenceIds: [] }] }), textResponse('')]))
    const retried = await ctx.manRoleplayer.retryMessage(id, messageId('ack-message'), turnOperationId('ack-turn'), requestId('ack-retry'))
    expect(retried.timeline).toContainEqual(expect.objectContaining({ id: 'retry:ack-message:ack-retry', status: 'completed' }))
  })

  it('records stop-failed when cancellation cannot quiesce before the stop timeout', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-stop-timeout-'))
    const ctx = await loadComposition(join(root, 'sessions'), undefined, undefined, { provider: 'mock', model: 'mock' }, false, {
      maxModelRequests: 8, maxToolCalls: 10, activeTimeoutMs: 5_000, requestTimeoutMs: 5_000, noProgressLimit: 2, stopTimeoutMs: 20,
    })
    const adapter = new MockAdapter(['hang-slow'])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('stop-timeout-loader')
    const branch = { persona: 'wang-yangming' as const, sessionId: sessionId('stop-timeout-wang') }
    await ctx.manRoleplayer.create({ id, requestId: requestId('stop-timeout-create'), branches: [branch], activePersona: branch.persona, agentOptions: { provider: 'mock', model: 'mock' } })
    const submit = ctx.manRoleplayer.submitMessage(id, { messageId: messageId('stop-timeout-message'), deliveryOperationId: deliveryOperationId('stop-timeout-delivery'), turnOperationId: turnOperationId('stop-timeout-turn'), text: 'stop slowly', requestId: requestId('stop-timeout-request') })
    for (let attempt = 0; attempt < 50 && adapter.requests.length === 0; attempt++) await new Promise(resolve => setTimeout(resolve, 5))
    await ctx.manRoleplayer.cancelMessage(id, messageId('stop-timeout-message'), deliveryOperationId('stop-timeout-delivery'), turnOperationId('stop-timeout-turn'))
    await expect(submit).resolves.toBeDefined()
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(events?.some(event => event.type === 'turn-execution' && event.turnOperationId === turnOperationId('stop-timeout-turn') && (event.state === 'stop-failed' || event.state === 'unknown'))).toBe(true)
    await expect(ctx.manRoleplayer.acceptPersonaTurnSubmission(ctx.agents.get(branch.sessionId), { segments: [{ text: '这是已经取消的旧回答。', kind: 'modern-inference', evidenceIds: [] }] })).rejects.toThrow(/no longer open/)
    await expect(ctx.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('stop-timeout-switch'))).rejects.toThrow(/still running|stop-failed|unknown/)
    for (let attempt = 0; attempt < 100 && await ctx.manRoleplayer.activeTurn(id) !== undefined; attempt++) await new Promise(resolve => setTimeout(resolve, 5))
    expect(await ctx.manRoleplayer.activeTurn(id)).toBeUndefined()
    expect((await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id))?.findLast(event => event.type === 'turn-execution')).toMatchObject({ state: 'stopped' })
  })

  it('stops a repeated invalid tool loop at the configured turn budget', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-turn-budget-'))
    const ctx = await loadComposition(join(root, 'sessions'), undefined, undefined, { provider: 'mock', model: 'mock' }, false, {
      maxModelRequests: 8, maxToolCalls: 10, activeTimeoutMs: 5_000, requestTimeoutMs: 5_000, noProgressLimit: 2,
    })
    const adapter = new MockAdapter(Array.from({ length: 8 }, (_, index) => toolCallResponse(`budget-invalid-${index}`, 'persona_turn_submit', { segments: [] })))
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('turn-budget-loader')
    const branch = { persona: 'wang-yangming' as const, sessionId: sessionId('turn-budget-wang') }
    await ctx.manRoleplayer.create({ id, requestId: requestId('turn-budget-create'), branches: [branch], activePersona: branch.persona, agentOptions: { provider: 'mock', model: 'mock' } })
    const result = await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('turn-budget-message'), deliveryOperationId: deliveryOperationId('turn-budget-delivery'), turnOperationId: turnOperationId('turn-budget-turn'), text: 'budget loop', requestId: requestId('turn-budget-request') })
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    const budgets = events?.filter((event): event is Extract<ProductEvent, { type: 'turn-budget' }> => event.type === 'turn-budget') ?? []
    expect(budgets.at(-1)).toMatchObject({ status: 'budget-exhausted', noProgressCount: 2 })
    expect(adapter.requests.length).toBeLessThanOrEqual(8)
    expect(result.timeline).toContainEqual(expect.objectContaining({ id: 'turn-budget-turn', status: 'failed' }))
  })

  it('counts provider request-error retries against the turn budget', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-provider-retry-budget-'))
    const ctx = await loadComposition(join(root, 'sessions'), undefined, undefined, { provider: 'mock', model: 'mock' }, false, {
      maxModelRequests: 3, maxToolCalls: 10, activeTimeoutMs: 5_000, requestTimeoutMs: 5_000, noProgressLimit: 2,
    })
    const failure = (): StreamChunk[] => [{ type: 'finish', reason: { kind: 'error', failure: { message: 'provider failure', code: 'SERVER' } } }]
    const adapter = new MockAdapter([failure(), failure()])
    ctx.llm.registerAdapter(['mock'], adapter)
    ctx.on('agent/request-error', async (_payload, next) => { await next(); return { kind: 'retry' } })
    const id = dilemmaId('provider-retry-budget-loader')
    const branch = { persona: 'wang-yangming' as const, sessionId: sessionId('provider-retry-budget-wang') }
    await ctx.manRoleplayer.create({ id, requestId: requestId('provider-retry-budget-create'), branches: [branch], activePersona: branch.persona, agentOptions: { provider: 'mock', model: 'mock' } })
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('provider-retry-budget-message'), deliveryOperationId: deliveryOperationId('provider-retry-budget-delivery'), turnOperationId: turnOperationId('provider-retry-budget-turn'), text: 'retry budget', requestId: requestId('provider-retry-budget-request') })
    await waitForBackgroundQuiet(ctx)
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(events?.findLast(event => event.type === 'turn-budget')).toMatchObject({ status: 'budget-exhausted', modelRequests: 3 })
  })

  it('replaces withdrawn shared context on the target persona Session surface', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-context-replace-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const adapter = new MockAdapter([
      personaSubmitResponse('context-wang-submit', '王回答'), textResponse('上下文标题'),
      personaSubmitResponse('context-zeng-submit', '曾回答'), personaSubmitResponse('context-zeng-after-submit', '曾撤回后回答'),
    ])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('context-replace-loader')
    const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('context-replace-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('context-replace-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('context-replace-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('context-replace-wang-message'), deliveryOperationId: deliveryOperationId('context-replace-wang-delivery'), turnOperationId: turnOperationId('context-replace-wang-turn'), text: '原始目标', requestId: requestId('context-replace-wang-request') })
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    await repository.append(id, { type: 'shared-state', item: { id: 'context-state', persona: 'wang-yangming', kind: 'goal', text: '旧目标', sourceEventIds: ['context-replace-wang-message'], status: 'confirmed', revision: 1, sourceOperationId: operationId('context-state-op') }, requestId: requestId('context-state-confirm') })
    await ctx.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('context-replace-switch'))
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('context-replace-zeng-message'), deliveryOperationId: deliveryOperationId('context-replace-zeng-delivery'), turnOperationId: turnOperationId('context-replace-zeng-turn'), text: '曾问题', requestId: requestId('context-replace-zeng-request') })
    const firstZengRequest = adapter.requests.findLast(request => request.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('曾问题'))))
    expect(firstZengRequest?.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('旧目标')))).toBe(true)
    await repository.append(id, { type: 'shared-state', item: { id: 'context-state', persona: 'wang-yangming', kind: 'goal', text: '旧目标', sourceEventIds: ['context-replace-wang-message'], status: 'withdrawn', revision: 2, sourceOperationId: operationId('context-state-withdraw') }, requestId: requestId('context-state-withdraw') })
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('context-replace-zeng-after-message'), deliveryOperationId: deliveryOperationId('context-replace-zeng-after-delivery'), turnOperationId: turnOperationId('context-replace-zeng-after-turn'), text: '撤回后', requestId: requestId('context-replace-zeng-after-request') })
    const afterRequest = adapter.requests.findLast(request => request.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('撤回后'))))
    expect(afterRequest?.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('旧目标')))).toBe(false)
    const zengContext = ctx.agents.get(branches[1].sessionId)!.session.events.filter(event => event.type === 'user/message' && event.data.source.kind === 'plugin' && event.data.source.plugin === 'man-roleplayer-context')
    expect(zengContext.length).toBeGreaterThanOrEqual(1)
  })

  it('resolves the built root, invariant, and product exports through the package manifest', async () => {
    const [rootExport, invariantExport, productExport] = await Promise.all([
      import('@deepseek-ai/dsh-man-roleplayer'),
      import('@deepseek-ai/dsh-man-roleplayer/invariant'),
      import('@deepseek-ai/dsh-man-roleplayer/product'),
    ])
    expect(rootExport.apply).toBeTypeOf('function')
    expect(invariantExport.apply).toBeTypeOf('function')
    expect(productExport.project).toBeTypeOf('function')
  })

  it('replays two private sessions after restart then deletes both histories and the product stream', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-loader-'))
    const sessionRoot = join(root, 'sessions')
    const first = await loadComposition(sessionRoot)
    const id = dilemmaId('dilemma-loader')
    const branches = [
      { persona: 'wang-yangming' as const, sessionId: sessionId('wang-loader') },
      { persona: 'zeng-guofan' as const, sessionId: sessionId('zeng-loader') },
    ] as const
    await first.manRoleplayer.create({ id, requestId: requestId('create-loader'), branches, activePersona: 'wang-yangming' })
    expect(first.agents.get(branches[0].sessionId)).toBeDefined()
    expect(first.agents.get(branches[1].sessionId)).toBeDefined()
    await materializeBranches(first)
    await first.fiber.dispose()
    contexts.splice(contexts.indexOf(first), 1)

    const second = await loadComposition(sessionRoot)
    await second.manRoleplayer.resume(id)
    expect(second.agents.get(branches[0].sessionId)).toBeDefined()
    expect(second.agents.get(branches[1].sessionId)).toBeDefined()
    await second.manRoleplayer.requestDeletion(id, {
      operationId: operationId('cancel-loader'), stage: 'requested', irreversible: false,
    }, requestId('request-cancel-loader'))
    await second.manRoleplayer.cancelDeletion(id, operationId('cancel-loader'), requestId('cancel-loader'))
    expect((await second.manRoleplayer.read(id))?.deletion).toBeUndefined()
    await second.manRoleplayer.requestDeletion(id, {
      operationId: operationId('delete-loader'), stage: 'requested', irreversible: false,
    }, requestId('request-delete-loader'))
    await expect(second.manRoleplayer.delete(id, operationId('delete-loader')))
      .resolves.toMatchObject({ stage: 'completed', irreversible: true })
    expect(second.agents.get(branches[0].sessionId)).toBeUndefined()
    expect(second.agents.get(branches[1].sessionId)).toBeUndefined()
    expect(await second.manRoleplayer.read(id)).toBeUndefined()
    expect(await second.sessionPersistence.list()).not.toContainEqual(expect.objectContaining({ id: branches[0].sessionId }))
    expect(await second.sessionPersistence.list()).not.toContainEqual(expect.objectContaining({ id: branches[1].sessionId }))
  })
  it('archives and restores one durable dilemma without deleting its history', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-archive-'))
    const sessionRoot = join(root, 'sessions')
    const ctx = await loadComposition(sessionRoot)
    const id = dilemmaId('archive-loader')
    const branches = [
      { persona: 'wang-yangming' as const, sessionId: sessionId('archive-wang') },
      { persona: 'zeng-guofan' as const, sessionId: sessionId('archive-zeng') },
    ] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('archive-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    await expect(ctx.manRoleplayer.restore(id, requestId('restore-active'))).rejects.toThrow(/not archived/)
    const archived = await ctx.manRoleplayer.archive(id, requestId('archive-request'))
    expect(archived.archived).toBe(true)
    expect(await ctx.manRoleplayer.list()).toHaveLength(0)
    expect(await ctx.manRoleplayer.list(true)).toHaveLength(1)
    await expect(ctx.manRoleplayer.submitMessage(id, {
      messageId: messageId('archive-message'), deliveryOperationId: deliveryOperationId('archive-delivery'),
      turnOperationId: turnOperationId('archive-turn'), text: 'blocked archived', requestId: requestId('archive-submit'),
    })).rejects.toThrow(/archived/)

    await materializeBranches(ctx)
    await ctx.fiber.dispose()
    contexts.splice(contexts.indexOf(ctx), 1)
    const resumed = await loadComposition(sessionRoot)
    expect(await resumed.manRoleplayer.read(id)).toMatchObject({ id, archived: true })
    expect(await resumed.manRoleplayer.list()).toHaveLength(0)
    expect(await resumed.manRoleplayer.list(true)).toHaveLength(1)
    await expect(resumed.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('archive-switch'))).rejects.toThrow(/archived/)
    const restored = await resumed.manRoleplayer.restore(id, requestId('archive-restore'))
    expect(restored.archived).toBeUndefined()
    expect(await resumed.manRoleplayer.list()).toHaveLength(1)
    const events = await (resumed.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(events?.filter(event => event.type === 'archived')).toHaveLength(1)
    expect(events?.filter(event => event.type === 'restored')).toHaveLength(1)
  })

  it('rejects lifecycle mutations once deletion is claimed and never resurrects after delete', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-delete-race-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const id = dilemmaId('delete-race-loader')
    const branches = [
      { persona: 'wang-yangming' as const, sessionId: sessionId('delete-race-wang') },
      { persona: 'zeng-guofan' as const, sessionId: sessionId('delete-race-zeng') },
    ] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('delete-race-create'), branches, activePersona: 'wang-yangming' })
    await ctx.manRoleplayer.requestDeletion(id, {
      operationId: operationId('delete-race-operation'), stage: 'requested', irreversible: false,
    }, requestId('delete-race-request'))
    await expect(ctx.manRoleplayer.archive(id, requestId('delete-race-archive'))).rejects.toThrow(/deleting/)
    await expect(ctx.manRoleplayer.restore(id, requestId('delete-race-restore'))).rejects.toThrow(/deleting/)
    await expect(ctx.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('delete-race-switch'))).rejects.toThrow(/deleting/)
    await expect(ctx.manRoleplayer.submitMessage(id, {
      messageId: messageId('delete-race-message'), deliveryOperationId: deliveryOperationId('delete-race-delivery'),
      turnOperationId: turnOperationId('delete-race-turn'), text: 'must not submit', requestId: requestId('delete-race-submit'),
    })).rejects.toThrow(/deleting/)
    await ctx.manRoleplayer.cancelDeletion(id, operationId('delete-race-operation'), requestId('delete-race-cancel'))
    await ctx.manRoleplayer.archive(id, requestId('delete-race-archive-after-cancel'))
    await ctx.manRoleplayer.restore(id, requestId('delete-race-restore-after-cancel'))
    await ctx.manRoleplayer.requestDeletion(id, {
      operationId: operationId('delete-race-final'), stage: 'requested', irreversible: false,
    }, requestId('delete-race-final-request'))
    await expect(ctx.manRoleplayer.delete(id, operationId('delete-race-final'))).resolves.toMatchObject({ stage: 'completed' })
    await expect(ctx.manRoleplayer.read(id)).resolves.toBeUndefined()
    await expect(ctx.manRoleplayer.restore(id, requestId('delete-race-after-delete'))).rejects.toThrow(/unknown dilemma/)
  })

  it('returns persisted reply relationships through Remote submit, projection, and Loader restart', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-reply-wire-'))
    const sessionsRoot = join(root, 'sessions')
    const ctx = await loadComposition(sessionsRoot)
    const adapter = new MockAdapter([
      personaSubmitResponse('reply-source-submit', '你担心毕业论文写得不够好，越想完成越不敢落笔。可以先选一个已经有材料的小节，用二十分钟写出粗稿，暂时允许表达不完整；完成后只检查论点是否清楚，再向导师请教一个具体问题。'),
      textResponse('论文拖延'),
      personaSubmitResponse('reply-answer-submit', '你准备先完成粗稿，又担心自己重新陷入反复修改。可以给这一轮写作设一个明确停止点：只写完一个小节的论点和证据，二十分钟结束就保存版本；把需要修改的地方单独记下来，下一轮再按重要性处理。'),
    ])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('reply-wire-loader')
    const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('reply-wire-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('reply-wire-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('reply-wire-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    await ctx.manRoleplayer.rename(id, '引用测试', requestId('reply-wire-title'))
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('reply-source'), deliveryOperationId: deliveryOperationId('reply-source-delivery'), turnOperationId: turnOperationId('reply-source-turn'), text: '我担心毕业论文写得不够好，总是拖延着不敢落笔，下一步应该怎么做？', requestId: requestId('reply-source-request') })
    const remote = ctx.get('manRoleplayerRemote')!
    const listed = await remote.list({ version: 1, includeArchived: true })
    if (!listed.ok || listed.value[0] === undefined) throw new Error('reply fixture projection missing')
    const before = listed.value[0]
    expect(before.timeline).toContainEqual(expect.objectContaining({ id: 'reply-source-turn', operationId: 'reply-source-turn', kind: 'persona-message', status: 'completed' }))
    const sent = await remote.submit({ version: 1, handle: before.handle, expectedRevision: before.revision,
      requestId: 'reply-wire-submit' as ManRoleplayerRequestId, messageId: 'reply-follow-up' as ManRoleplayerOperationId,
      deliveryOperationId: 'reply-follow-up-delivery' as ManRoleplayerOperationId, turnOperationId: 'reply-follow-up-turn' as ManRoleplayerOperationId,
      text: '我准备先完成粗稿，但担心又开始反复修改，应该怎样确定停止点？', replyToTimelineEventId: 'reply-source-turn',
    })
    expect(sent).toMatchObject({ ok: true, value: { timeline: expect.arrayContaining([expect.objectContaining({ id: 'reply-follow-up', replyToTimelineEventId: 'reply-source-turn' })]) } })
    await waitForBackgroundQuiet(ctx)
    await ctx.fiber.dispose()
    contexts.splice(contexts.indexOf(ctx), 1)
    const reloaded = await loadComposition(sessionsRoot)
    const restored = await reloaded.get('manRoleplayerRemote')!.getProjection({ version: 1, handle: before.handle })
    expect(restored).toMatchObject({ ok: true, value: { timeline: expect.arrayContaining([expect.objectContaining({ id: 'reply-follow-up', kind: 'user-message', status: 'delivered', text: '我准备先完成粗稿，但担心又开始反复修改，应该怎样确定停止点？', replyToTimelineEventId: 'reply-source-turn' })]) } })
    expect(JSON.stringify(restored)).not.toContain('sessionId')
  })

  it('serves an opaque redacted projection and revision-guards Remote mutations', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-remote-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const id = dilemmaId('remote-loader')
    const branches = [
      { persona: 'wang-yangming' as const, sessionId: sessionId('remote-wang') },
      { persona: 'zeng-guofan' as const, sessionId: sessionId('remote-zeng') },
    ] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('remote-create'), branches, activePersona: 'wang-yangming' })
    const remote = ctx.get('manRoleplayerRemote')
    if (remote === undefined) throw new Error('man-roleplayer remote service was not loaded')
    const listed = await remote.list({ version: 1, includeArchived: true })
    if (!listed.ok) throw new Error(listed.error.message)
    expect(listed.value).toHaveLength(1)
    const item = listed.value[0]
    if (item === undefined) throw new Error('remote fixture did not return a projection')
    expect(item.handle).toMatch(/^dilemma:/u)
    expect(JSON.stringify(item)).not.toContain('sessionId')
    expect(JSON.stringify(item)).not.toContain('sourceEventId')
    expect(JSON.stringify(item)).not.toContain('assistant/message')
    const stale = await remote.archive({ version: 1, handle: item.handle, requestId: 'remote-stale' as ManRoleplayerRequestId, expectedRevision: 0 })
    expect(stale).toMatchObject({ ok: false, error: { code: 'revision-conflict' } })
    const archived = await remote.archive({ version: 1, handle: item.handle, requestId: 'remote-archive' as ManRoleplayerRequestId, expectedRevision: item.revision })
    expect(archived).toMatchObject({ ok: true, value: { archived: true } })
    if (!archived.ok) throw new Error('remote archive fixture did not commit')
    const deleted = await remote.delete({ version: 1, handle: item.handle, requestId: 'remote-delete' as ManRoleplayerRequestId, expectedRevision: archived.value.revision, operationId: 'remote-delete-operation' as ManRoleplayerOperationId })
    expect(deleted).toMatchObject({ ok: true, value: { handle: item.handle, deleted: true } })
    const retry = await remote.delete({ version: 1, handle: item.handle, requestId: 'remote-delete-retry' as ManRoleplayerRequestId, expectedRevision: archived.value.revision, operationId: 'remote-delete-operation' as ManRoleplayerOperationId })
    expect(retry).toMatchObject({ ok: true, value: { handle: item.handle, deleted: true } })
    const receipt = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readDeletionReceipt(operationId('remote-delete-operation'))
    expect(receipt).toMatchObject({ operationId: 'remote-delete-operation', deleted: true })
    expect(JSON.stringify(receipt)).not.toContain('remote-loader')
    expect(await remote.getProjection({ version: 1, handle: item.handle })).toMatchObject({ ok: false, error: { code: 'unknown-dilemma' } })
    expect(await remote.list({ version: 1, includeArchived: true })).toMatchObject({ ok: true, value: [] })
    await ctx.fiber.dispose()
    contexts.splice(contexts.indexOf(ctx), 1)
    const reloaded = await loadComposition(join(root, 'sessions'))
    const reloadedRemote = reloaded.get('manRoleplayerRemote')
    if (reloadedRemote === undefined) throw new Error('reloaded man-roleplayer remote service was not loaded')
    expect(await reloadedRemote.delete({
      version: 1, handle: item.handle, requestId: 'remote-delete-reload' as ManRoleplayerRequestId,
      expectedRevision: archived.value.revision, operationId: 'remote-delete-operation' as ManRoleplayerOperationId,
    })).toMatchObject({ ok: true, value: { handle: item.handle, deleted: true } })
  })

  it('creates one blank product dilemma with two private sessions before the first accepted submit', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-product-entry-'))
    const ctx = await loadComposition(join(root, 'sessions'), undefined, undefined, { provider: 'mock', model: 'mock' })
    const adapter = new MockAdapter([personaSubmitResponse('product-entry-submit', '已校验回答')])
    ctx.llm.registerAdapter(['mock'], adapter)
    const remote = ctx.get('manRoleplayerRemote')
    if (remote === undefined) throw new Error('man-roleplayer remote service was not loaded')
    const created = await remote.create({ version: 1, requestId: 'product-entry-create' as ManRoleplayerRequestId, activePersona: 'wang-yangming' })
    if (!created.ok) throw new Error(created.error.message)
    expect(created.value.timeline).toEqual([])
    const internal = await ctx.manRoleplayer.list(true)
    expect(internal).toHaveLength(1)
    const conversation = internal[0]
    if (conversation === undefined) throw new Error('product entry did not create a dilemma')
    expect(conversation.branches).toHaveLength(2)
    expect(ctx.agents.list()).toHaveLength(2)
    expect(ctx.tools.schemas().map(tool => tool.name)).not.toEqual(expect.arrayContaining(['persona_turn_submit', 'evidence_lookup']))
    const productToolSchemas = ctx.tools.schemas(ctx.agents.list()[0])
    expect(productToolSchemas.map(tool => tool.name)).toEqual(expect.arrayContaining(['persona_turn_submit', 'evidence_lookup', 'ask_user_question']))
    const submitSchema = productToolSchemas.find(tool => tool.name === 'persona_turn_submit')
    expect(submitSchema?.parameters).toMatchObject({
      type: 'object',
      properties: {
        segments: {
          type: 'array', minItems: 1,
          items: {
            type: 'object', additionalProperties: false,
            required: ['text', 'kind', 'evidenceIds'],
            properties: {
              text: { type: 'string' },
              kind: { type: 'string', enum: ['reliable-quote', 'historical-fact', 'attribution', 'modern-inference', 'insufficient-evidence'] },
              evidenceIds: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    })
    const lookupSchema = productToolSchemas.find(tool => tool.name === 'evidence_lookup')
    expect(lookupSchema?.parameters).toMatchObject({ properties: { requestedCount: { minimum: 1, maximum: 3 } } })
    const submitted = await remote.submit({
      version: 1, handle: created.value.handle, expectedRevision: created.value.revision,
      requestId: 'product-entry-submit-request' as ManRoleplayerRequestId,
      messageId: 'product-entry-message' as ManRoleplayerOperationId,
      deliveryOperationId: 'product-entry-delivery' as ManRoleplayerOperationId,
      turnOperationId: 'product-entry-turn' as ManRoleplayerOperationId,
      text: '我的困惑',
    })
    if (!submitted.ok) throw new Error(submitted.error.message)
    // The Remote acknowledges the durable message/turn claim before the model
    // finishes.  Observe the terminal projection separately instead of making
    // this test reintroduce the old browser-blocking contract.
    expect(submitted.value.timeline.some(item => item.id === 'product-entry-message'
      && (item.status === 'pending' || item.status === 'delivered'))).toBe(true)
    const terminal = await (async (): Promise<DilemmaConversation> => {
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const current = await ctx.manRoleplayer.read(conversation.id)
        if (current?.timeline.some(item => item.id === 'product-entry-turn' && item.status === 'completed')) return current
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      throw new Error('product entry turn did not reach a terminal projection')
    })()
    expect(terminal.timeline).toContainEqual(expect.objectContaining({ id: 'product-entry-message', status: 'delivered' }))
    const projectedTerminal = await remote.getProjection({ version: 1, handle: created.value.handle })
    if (!projectedTerminal.ok) throw new Error(projectedTerminal.error.message)
    expect(projectedTerminal.value.timeline).toContainEqual(expect.objectContaining({ id: 'product-entry-turn', status: 'completed', text: '已校验回答' }))
    expect(ctx.tools.schemas(ctx.agents.list()[0]).map(tool => tool.name)).toContain('ask_user_question')
    const userTimeline = projectedTerminal.value.timeline.filter(item => item.kind === 'user-message' && item.id === 'product-entry-message')
    expect(userTimeline).toEqual([expect.objectContaining({ id: 'product-entry-message', text: '我的困惑', status: 'delivered' })])
    expect(JSON.stringify(submitted.value)).not.toContain('sessionId')
    expect(adapter.requests.filter(request => request.purpose === 'session-title')).toHaveLength(1)
    await waitForBackgroundQuiet(ctx)
    await ctx.fiber.dispose()
    contexts.splice(contexts.indexOf(ctx), 1)
    const reloaded = await loadComposition(join(root, 'sessions'))
    const replayed = await reloaded.manRoleplayer.read(conversation.id)
    expect(replayed?.timeline.filter(item => item.kind === 'user-message' && item.id === 'product-entry-message')).toEqual([
      expect.objectContaining({ id: 'product-entry-message', text: '我的困惑', status: 'delivered' }),
    ])
  })

  it('creates one branch through the Remote contract and adds a branch on switch', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-product-entry-single-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const remote = ctx.get('manRoleplayerRemote')
    if (remote === undefined) throw new Error('man-roleplayer remote service was not loaded')
    const created = await remote.create({ version: 1, requestId: 'product-entry-single-create' as ManRoleplayerRequestId, activePersona: 'wang-yangming', personas: ['wang-yangming'] })
    if (!created.ok) throw new Error(created.error.message)
    expect(created.value.branches).toEqual([{ persona: 'wang-yangming' }])
    const joined = await remote.switchPersona({ version: 1, handle: created.value.handle, requestId: 'product-entry-single-switch' as ManRoleplayerRequestId, expectedRevision: created.value.revision, persona: 'zeng-guofan' })
    expect(joined).toMatchObject({ ok: true, value: { branches: [{ persona: 'wang-yangming' }, { persona: 'zeng-guofan' }] } })
    expect(ctx.agents.list()).toHaveLength(2)
  })

  it('promotes a pending receipt after product removal without recovering content', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-receipt-recovery-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const id = dilemmaId('receipt-recovery-loader')
    const branches = [
      { persona: 'wang-yangming' as const, sessionId: sessionId('receipt-recovery-wang') },
      { persona: 'zeng-guofan' as const, sessionId: sessionId('receipt-recovery-zeng') },
    ] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('receipt-recovery-create'), branches, activePersona: 'wang-yangming' })
    const remote = ctx.get('manRoleplayerRemote')
    if (remote === undefined) throw new Error('man-roleplayer remote service was not loaded')
    const listed = await remote.list({ version: 1, includeArchived: true })
    if (!listed.ok) throw new Error(listed.error.message)
    const item = listed.value[0]
    if (item === undefined) throw new Error('receipt recovery fixture did not return a projection')
    const op = operationId('receipt-recovery-operation')
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    await repository.recordDeletionIntent({
      operationId: op,
      handleDigest: createHash('sha256').update(item.handle).digest('hex'),
      status: 'pending', deleted: true,
    })
    await repository.remove(id)
    const replay = await remote.delete({
      version: 1, handle: item.handle, requestId: 'receipt-recovery-retry' as ManRoleplayerRequestId,
      expectedRevision: 1, operationId: 'receipt-recovery-operation' as ManRoleplayerOperationId,
    })
    expect(replay).toMatchObject({ ok: true, value: { handle: item.handle, deleted: true } })
    expect(await repository.readDeletionReceipt(op)).toMatchObject({ status: 'completed', deleted: true })
    expect(await remote.getProjection({ version: 1, handle: item.handle })).toMatchObject({ ok: false, error: { code: 'unknown-dilemma' } })
  })

  it('keeps product-owned choices durable, answerable, and shared as user facts', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-choice-'))
    const ctx = await loadComposition(join(root, 'sessions'), undefined, undefined, undefined, false, { activeTimeoutMs: 800, requestTimeoutMs: 600 })
    const adapter = new MockAdapter([
      toolCallResponse('choice-call', 'ask_user_question', { questions: [
        { id: 'direction', question: '下一步如何推进？', options: [{ label: '继续探索' }, { label: '先暂停' }] },
        { id: 'signals', question: '选择关注点', options: [{ label: '行动' }, { label: '复盘' }], multi_select: true },
        { id: 'note', question: '还有什么补充？' },
        { id: 'skip', question: '暂时跳过？', options: [{ label: '回答' }] },
      ] }),
      personaSubmitResponse('choice-submit', 'choice accepted'),
      textResponse('choice title'),
      personaSubmitResponse('choice-zeng-submit', 'zeng sees choice'),
    ])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('choice-loader')
    const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('choice-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('choice-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('choice-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const submit = ctx.manRoleplayer.submitMessage(id, { messageId: messageId('choice-message'), deliveryOperationId: deliveryOperationId('choice-delivery'), turnOperationId: turnOperationId('choice-turn'), text: '请帮我做选择', requestId: requestId('choice-request') })
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    let pending: Extract<ProductEvent, { type: 'choice' }> | undefined
    for (let attempt = 0; attempt < 100 && pending === undefined; attempt++) {
      pending = (await repository.readEvents(id))?.findLast((event): event is Extract<ProductEvent, { type: 'choice' }> => event.type === 'choice' && event.status === 'pending')
      if (pending === undefined) await new Promise(resolve => setTimeout(resolve, 5))
    }
    expect(pending).toMatchObject({ status: 'pending', questions: [{ id: 'direction' }, { id: 'signals', multiSelect: true }, { id: 'note' }, { id: 'skip' }] })
    const operation = operationId('choice:choice-turn')
    // 超过整轮和单次模型请求时限后，等待用户的 choice 仍应保留。
    await new Promise(resolve => setTimeout(resolve, 900))
    const beforeInvalid = await repository.readEvents(id)
    expect(beforeInvalid?.filter(event => event.type === 'choice').map(event => event.status)).toEqual(['pending'])
    for (const invalid of [{ id: 'skip', selected: [] }, { id: 'skip', selected: [], custom: '   ' }, { id: 'skip', selected: ['回答'], skipped: true }]) {
      await expect(ctx.manRoleplayer.answerChoice(id, operation, [
        { id: 'direction', selected: ['继续探索'] }, { id: 'signals', selected: ['行动'] },
        { id: 'note', selected: [], custom: '补充' }, invalid,
      ], requestId('choice-invalid'))).rejects.toThrow('product choice answer is invalid')
      expect(await repository.readEvents(id)).toEqual(beforeInvalid)
    }
    const answered = await ctx.manRoleplayer.answerChoice(id, operation, [
      { id: 'direction', selected: ['继续探索'] }, { id: 'signals', selected: ['行动', '复盘'] },
      { id: 'note', selected: [], custom: '我的补充' }, { id: 'skip', selected: [], skipped: true },
    ], requestId('choice-answer'))
    expect(answered.choice).toMatchObject({ operationId: operation, status: 'answered', answers: [
      { id: 'direction', selected: ['继续探索'] }, { id: 'signals', selected: ['行动', '复盘'] },
      { id: 'note', selected: [], custom: '我的补充' }, { id: 'skip', selected: [], skipped: true },
    ] })
    await expect(submit).resolves.toMatchObject({ choice: { status: 'answered' } })
    expect((await repository.readEvents(id))?.findLast(event => event.type === 'turn')).toMatchObject({ status: 'completed' })
    const events = await repository.readEvents(id)
    const choiceAgent = ctx.agents.get(sessionId('choice-wang'))!
    const choiceResult = choiceAgent.session.events.find(event => event.type === 'tool/result' && JSON.stringify(event.data).includes('skipped'))
    expect(choiceResult).toBeDefined()
    expect(events?.filter((event): event is Extract<ProductEvent, { type: 'choice' }> => event.type === 'choice' && event.operationId === operation).map(event => event.status)).toEqual(['pending', 'answered'])
    expect(events?.some(event => event.type === 'shared-state')).toBe(false)
    await ctx.manRoleplayer.switchPersona(id, 'zeng-guofan', requestId('choice-switch'))
    await ctx.manRoleplayer.submitMessage(id, { messageId: messageId('choice-zeng-message'), deliveryOperationId: deliveryOperationId('choice-zeng-delivery'), turnOperationId: turnOperationId('choice-zeng-turn'), text: '请继续', requestId: requestId('choice-zeng-request') })
    const zengRequest = adapter.requests.findLast(request => request.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('sharedChoices'))))
    expect(zengRequest?.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('继续探索')))).toBe(true)
  })

  it('projects running after answering a choice while the model continues', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-choice-running-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    ctx.llm.registerAdapter(['mock'], new MockAdapter([
      toolCallResponse('choice-running-call', 'ask_user_question', { questions: [{ id: 'direction', question: '下一步？', options: [{ label: '继续' }] }] }),
      'hang',
    ]))
    const id = dilemmaId('choice-running-loader')
    await ctx.manRoleplayer.create({ id, requestId: requestId('choice-running-create'), branches: [{ persona: 'wang-yangming', sessionId: sessionId('choice-running-wang') }], activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const submit = ctx.manRoleplayer.submitMessage(id, { messageId: messageId('choice-running-message'), deliveryOperationId: deliveryOperationId('choice-running-delivery'), turnOperationId: turnOperationId('choice-running-turn'), text: '请询问我', requestId: requestId('choice-running-request') })
    await expect.poll(async () => (await ctx.manRoleplayer.activeTurn(id))?.status).toBe('waiting-choice')
    const answered = await ctx.manRoleplayer.answerChoice(id, operationId('choice:choice-running-turn'), [{ id: 'direction', selected: [], skipped: true }], requestId('choice-running-answer'))
    expect(answered.revision).toBe((await ctx.manRoleplayer.read(id))?.revision)
    expect(await ctx.manRoleplayer.activeTurn(id)).toMatchObject({ status: 'running', executionState: 'running' })
    await ctx.manRoleplayer.cancelMessage(id, messageId('choice-running-message'), deliveryOperationId('choice-running-delivery'), turnOperationId('choice-running-turn'))
    await submit
  })

  it('cancels a pending product choice and converges the owning persona turn', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-choice-cancel-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const adapter = new MockAdapter([toolCallResponse('choice-cancel-call', 'ask_user_question', { questions: [{ id: 'answer', question: '回答？', options: [{ label: '是' }] }] })])
    ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('choice-cancel-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('choice-cancel-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('choice-cancel-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('choice-cancel-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const submit = ctx.manRoleplayer.submitMessage(id, { messageId: messageId('choice-cancel-message'), deliveryOperationId: deliveryOperationId('choice-cancel-delivery'), turnOperationId: turnOperationId('choice-cancel-turn'), text: '请询问我', requestId: requestId('choice-cancel-request') })
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    const operation = operationId('choice:choice-cancel-turn')
    for (let attempt = 0; attempt < 100 && (await repository.readEvents(id))?.some(event => event.type === 'choice' && event.operationId === operation && event.status === 'pending') !== true; attempt++) await new Promise(resolve => setTimeout(resolve, 5))
    const agent = ctx.agents.get(sessionId('choice-cancel-wang')); if (agent === undefined) throw new Error('missing choice persona agent')
    const cancel = vi.spyOn(agent, 'cancel')
    const before = await repository.readEvents(id)
    await expect(ctx.manRoleplayer.cancelChoice(id, operation, requestId('choice-cancel-stale'), 1)).rejects.toThrow(/revision/)
    expect(cancel).not.toHaveBeenCalled(); expect(await repository.readEvents(id)).toEqual(before)
    await ctx.manRoleplayer.cancelChoice(id, operation, requestId('choice-cancel-answer'))
    await expect(submit).resolves.toMatchObject({ choice: { status: 'cancelled' } })
    const events = await repository.readEvents(id)
    expect(events?.filter((event): event is Extract<ProductEvent, { type: 'choice' }> => event.type === 'choice' && event.operationId === operation).map(event => event.status)).toEqual(['pending', 'cancelled'])
    expect(events?.filter((event): event is Extract<ProductEvent, { type: 'turn' }> => event.type === 'turn' && event.turnOperationId === turnOperationId('choice-cancel-turn')).map(event => event.status)).toContain('cancelled')
  })

  it('recovers a choice waiter as failed after a cold restart without replaying the Agent', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-choice-recovery-'))
    const sessionRoot = join(root, 'sessions'); const first = await loadComposition(sessionRoot)
    const id = dilemmaId('choice-recovery-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('choice-recovery-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('choice-recovery-zeng') }] as const
    await first.manRoleplayer.create({ id, requestId: requestId('choice-recovery-create'), branches, activePersona: 'wang-yangming' })
    const repository = (first.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    await repository.append(id, { type: 'choice', operationId: operationId('choice:recovery-turn'), turnOperationId: turnOperationId('recovery-turn'), persona: 'wang-yangming', status: 'pending', questions: [{ id: 'q', question: '继续？', options: [{ label: '继续' }] }], requestId: requestId('choice-recovery-pending') })
    await first.fiber.dispose(); contexts.splice(contexts.indexOf(first), 1)
    const second = await loadComposition(sessionRoot); const recovery = new MockAdapter([]); second.llm.registerAdapter(['mock'], recovery)
    const recovered = await second.manRoleplayer.read(id)
    expect(recovered?.choice).toMatchObject({ operationId: operationId('choice:recovery-turn'), status: 'failed' })
    const events = await (second.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(events?.filter((event): event is Extract<ProductEvent, { type: 'choice' }> => event.type === 'choice' && event.operationId === operationId('choice:recovery-turn')).map(event => event.status)).toEqual(['pending', 'failed'])
    expect(recovery.requests).toHaveLength(0)
  })

  it('pauses and resumes a discussion without creating a new dilemma', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-discussion-'))
    const ctx = await loadComposition(join(root, 'sessions')); const id = dilemmaId('discussion-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('discussion-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('discussion-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('discussion-create'), branches, activePersona: 'wang-yangming' })
    const paused = await ctx.manRoleplayer.pause(id, requestId('discussion-pause'), 1)
    expect(paused.discussionStatus).toBe('paused')
    await expect(ctx.manRoleplayer.submitMessage(id, { messageId: messageId('discussion-blocked-message'), deliveryOperationId: deliveryOperationId('discussion-blocked-delivery'), turnOperationId: turnOperationId('discussion-blocked-turn'), text: '暂停期间', requestId: requestId('discussion-blocked-request') })).rejects.toThrow(/discussion is paused/)
    const resumed = await ctx.manRoleplayer.resumeDiscussion(id, requestId('discussion-resume'), paused.lifecycleRevision)
    expect(resumed.discussionStatus).toBe('in_progress')
    expect(await ctx.manRoleplayer.list(true)).toHaveLength(1)
  })

  it('cancels an active persona turn before pausing the discussion', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-discussion-active-'))
    const ctx = await loadComposition(join(root, 'sessions')); const adapter = new MockAdapter(['hang']); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('discussion-active-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('discussion-active-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('discussion-active-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('discussion-active-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const submit = ctx.manRoleplayer.submitMessage(id, { messageId: messageId('discussion-active-message'), deliveryOperationId: deliveryOperationId('discussion-active-delivery'), turnOperationId: turnOperationId('discussion-active-turn'), text: '正在生成', requestId: requestId('discussion-active-request') })
    for (let attempt = 0; attempt < 100 && adapter.requests.length === 0; attempt++) await new Promise(resolve => setTimeout(resolve, 5))
    const paused = await ctx.manRoleplayer.pause(id, requestId('discussion-active-pause'))
    expect(paused.discussionStatus).toBe('paused')
    await expect(submit).resolves.toMatchObject({ discussionStatus: 'paused' })
    const events = await (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository.readEvents(id)
    expect(events?.some(event => event.type === 'turn' && event.turnOperationId === turnOperationId('discussion-active-turn') && event.status === 'cancelled')).toBe(true)
  })

  it('rejects stale cancellation controls without interrupting the active turn', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-stale-cancel-'))
    const ctx = await loadComposition(join(root, 'sessions')); const adapter = new MockAdapter(['hang']); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('stale-cancel-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('stale-cancel-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('stale-cancel-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('stale-cancel-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const agent = ctx.agents.get(sessionId('stale-cancel-wang')); if (agent === undefined) throw new Error('missing active persona agent')
    const cancel = vi.spyOn(agent, 'cancel')
    const message = messageId('stale-cancel-message'); const delivery = deliveryOperationId('stale-cancel-delivery'); const turn = turnOperationId('stale-cancel-turn')
    const submit = ctx.manRoleplayer.submitMessage(id, { messageId: message, deliveryOperationId: delivery, turnOperationId: turn, text: '正在生成', requestId: requestId('stale-cancel-request') })
    for (let attempt = 0; attempt < 100 && adapter.requests.length === 0; attempt++) await new Promise(resolve => setTimeout(resolve, 5))
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    const before = await repository.readEvents(id)
    await expect(ctx.manRoleplayer.cancelMessage(id, message, delivery, turn, 0)).rejects.toThrow(/revision/)
    await expect(ctx.manRoleplayer.pause(id, requestId('stale-cancel-pause'), 0)).rejects.toThrow(/revision/)
    await expect(ctx.manRoleplayer.endStage(id, requestId('stale-cancel-end'), 0)).rejects.toThrow(/revision/)
    expect(cancel).not.toHaveBeenCalled()
    const after = await repository.readEvents(id)
    expect(after).toEqual(before)
    await ctx.manRoleplayer.cancelMessage(id, message, delivery, turn)
    await expect(submit).resolves.toBeDefined()
  })

  it('retries one failed persona turn without duplicating the product user message', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-retry-'))
    const ctx = await loadComposition(join(root, 'sessions'))
    const adapter = new MockAdapter([textResponse('unstructured failure'), textResponse('still unstructured'), personaSubmitResponse('retry-submit', 'retry accepted'), textResponse('retry title')]); ctx.llm.registerAdapter(['mock'], adapter)
    const id = dilemmaId('retry-loader'); const branches = [{ persona: 'wang-yangming' as const, sessionId: sessionId('retry-wang') }, { persona: 'zeng-guofan' as const, sessionId: sessionId('retry-zeng') }] as const
    await ctx.manRoleplayer.create({ id, requestId: requestId('retry-create'), branches, activePersona: 'wang-yangming', agentOptions: { provider: 'mock', model: 'mock' } })
    const message = messageId('retry-message'); const failedTurn = turnOperationId('retry-turn')
    const failed = await ctx.manRoleplayer.submitMessage(id, { messageId: message, deliveryOperationId: deliveryOperationId('retry-delivery'), turnOperationId: failedTurn, text: '原始困惑', requestId: requestId('retry-request') })
    expect(failed.timeline.find(item => item.id === String(message))).toMatchObject({ status: 'failed', text: '原始困惑' })
    const retried = await ctx.manRoleplayer.retryMessage(id, message, failedTurn, requestId('retry-operation'), failed.lifecycleRevision)
    expect(retried.timeline.filter(item => item.kind === 'user-message' && item.id === String(message))).toHaveLength(1)
    expect(retried.timeline.some(item => item.kind === 'persona-message' && item.status === 'completed')).toBe(true)
    const remote = ctx.get('manRoleplayerRemote')
    if (remote === undefined) throw new Error('retry Remote was not loaded')
    const projection = await remote.list({ version: 1, includeArchived: true })
    if (!projection.ok) throw new Error(projection.error.message)
    expect(projection.value[0]?.timeline.some(item => item.kind === 'persona-message'
      && item.status === 'completed' && item.text === 'retry accepted')).toBe(true)
    const repository = (ctx.manRoleplayer as unknown as { repository: ProductConversationRepository }).repository
    const events = await repository.readEvents(id)
    expect(events?.filter(event => event.type === 'message-retry')).toHaveLength(1)
    expect(adapter.requests).toHaveLength(4)
    const replay = await ctx.manRoleplayer.retryMessage(id, message, failedTurn, requestId('retry-operation'), 0)
    expect(replay.timeline.some(item => item.kind === 'persona-message' && item.status === 'completed')).toBe(true)
    expect(adapter.requests).toHaveLength(4)
  })
})
