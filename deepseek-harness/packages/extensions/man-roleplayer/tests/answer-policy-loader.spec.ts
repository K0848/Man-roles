/** Real Loader regression for per-turn communication and persisted persona identity. */
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Include from '../../../../vendor/include/src/index.ts'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import LlmRuntime, { type StreamChunk } from '@deepseek-ai/dsh-llm'
import SessionStore from '@deepseek-ai/dsh-session'
import SessionPersistenceJsonl from '@deepseek-ai/dsh-session-persistence-jsonl'
import Storage, { storageBackendServiceKey } from '@deepseek-ai/dsh-storage'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import AgentPresets from '@deepseek-ai/dsh-agent-presets'
import * as Persona from '@deepseek-ai/dsh-persona'
import type {} from '../src/index.ts'
import { deliveryOperationId, messageId, requestId, turnOperationId } from '../src/product/index.ts'
import { MemoryMediaPool, MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import { MockAdapter, textResponse, toolCallResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'

let root: string | undefined
const contexts: Context[] = []
const pool = new MemoryMediaPool()
const localPresetRoot = fileURLToPath(new URL('../presets/', import.meta.url))

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


afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
  pool.media.clear(); pool.versions.clear()
})

function submitResponse(call: string, text: string, evidenceIds: string[] = []): StreamChunk[] {
  return toolCallResponse(call, 'persona_turn_submit', { segments: [{ text, kind: evidenceIds.length > 0 ? 'reliable-quote' : 'modern-inference', evidenceIds }] })
}

describe('per-turn communication policy through the real Loader', () => {
  it('keeps a persisted preset branch usable and logs the current communication policy without weakening evidence validation', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-answer-policy-'))
    const research = { wangYangmingPath: join(root, '调研成果-王阳明.md'), zengGuofanPath: join(root, '调研成果-曾国藩.md') }
    await writeFile(research.wangYangmingPath, '> persona_id：`王阳明`\n| 编号 | 语录 | 出处 | 可信度 |\n|---|---|---|---|\n| 1 | "知行合一" | 《传习录》 | ✅ |\n')
    await writeFile(research.zengGuofanPath, '> persona_id：`曾国藩`\n| 编号 | 语录 | 出处 | 可信度 |\n|---|---|---|---|\n| 1 | "结硬寨" | 《家书》 | ✅ |\n')
    const presets = { root: localPresetRoot, wangYangming: 'wang-yangming', zengGuofan: 'zeng-guofan' }
    const sessionRoot = join(root, 'sessions')
    const first = await loadComposition(sessionRoot, research, presets)
    const created = await first.manRoleplayer.createBlank({ requestId: requestId('answer-policy-create'), activePersona: 'wang-yangming', personas: ['wang-yangming', 'zeng-guofan'] })
    const identities = created.branches.map(branch => branch.presetIdentity)
    expect(identities.every(identity => identity !== undefined)).toBe(true)
    await materializeBranches(first)
    await first.fiber.dispose(); contexts.splice(contexts.indexOf(first), 1)
    const resumed = await loadComposition(sessionRoot, research, presets)
    const answer = '我听见你在努力解释，却越说越急。我们先停在这里。'
    const adapter = new MockAdapter([
      submitResponse('unsupported-quote', '不能冒充有出处的话。', ['unknown-evidence']),
      submitResponse('listening-answer', answer),
      textResponse('课程练习'),
      submitResponse('second-listening-answer', '好，先听你把这段经历讲完。'),
    ])
    resumed.llm.registerAdapter(['mock'], adapter)
    const restored = await resumed.manRoleplayer.resume(created.id, { provider: 'mock', model: 'mock' })
    expect(restored.branches.map(branch => branch.presetIdentity)).toEqual(identities)
    const send = (suffix: string, text: string) => resumed.manRoleplayer.submitMessage(created.id, {
      messageId: messageId(`answer-policy-${suffix}`), deliveryOperationId: deliveryOperationId(`answer-policy-${suffix}`),
      turnOperationId: turnOperationId(`answer-policy-${suffix}`), requestId: requestId(`answer-policy-${suffix}`), text,
    })
    await send('first', '老师说我步骤太杂，先听我说，不用建议，别超过150字。')
    expect(await resumed.manRoleplayer.acceptedAnswer(created.id, 'answer-policy-first')).toBe(answer)
    const requests = adapter.requests.filter(request => request.purpose !== 'session-title')
    // 第一次无来源引文被真实工具拒绝，模型收到错误后才能提交有效短答。
    expect(requests).toHaveLength(2)
    expect(JSON.stringify(requests[1]?.messages)).toContain('every cited id must come from this turn')
    await send('second', '我还想继续讲，你先听着。')
    const allRequests = adapter.requests.filter(request => request.purpose !== 'session-title')
    const policyText = allRequests.map(request => JSON.stringify(request.messages))
    expect(policyText.every(text => text.includes('man-roleplayer-communication-policy'))).toBe(true)
    expect(policyText[0]).toContain('优先遵守用户明确要求的回应方式、范围和长度')
    expect(policyText[0]).toContain('不得凭一句话断言用户或第三方的动机')
    expect(policyText[0]).toContain('保持当前人物的视角与表达')
    expect(policyText[0]).toContain('直接输出所要的内容并停止，不附字数自报、解释、史例或额外建议')
    expect(policyText[0]).toContain('不得仅为体现人物身份或给短文本补充底气而主动检索和添加史例')
    expect(policyText.at(-1)).toContain('我还想继续讲，你先听着。')
    const agent = resumed.agents.get(restored.branches[0]!.sessionId)!
    const messages = agent.session.events.filter(event => event.type === 'user/message')
    expect(JSON.stringify(messages)).toContain('man-roleplayer-communication-policy')
    expect((await resumed.manRoleplayer.read(created.id))?.branches.map(branch => branch.presetIdentity)).toEqual(identities)
  })
  it('accepts a concise relevant opening while still rejecting bare history, unrelated advice, and validation filler', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-short-advice-'))
    const ctx = await loadComposition(join(root, 'sessions'), undefined, undefined, { provider: 'mock', model: 'mock' })
    const created = await ctx.manRoleplayer.createBlank({ requestId: requestId('short-advice-create'), activePersona: 'wang-yangming', personas: ['wang-yangming'] })
    const user = '我该如何在课堂上说明自己的练习？请只给一句不超过30字的开场白。'
    const answer = '我的练习虽有多种步骤，始终围绕观察材料、完成作品。'
    const adapter = new MockAdapter([
      toolCallResponse('bare-history', 'persona_turn_submit', { segments: [{ text: '史书上有人遭贬。', kind: 'insufficient-evidence', evidenceIds: [] }] }),
      submitResponse('unrelated-advice', '花盆放在窗边。'),
      submitResponse('validation-filler', '校验占位：课程练习已经通过本轮提交校验。'),
      submitResponse('concise-opening', answer),
      textResponse('课堂开场白'),
    ])
    ctx.llm.registerAdapter(['mock'], adapter)
    await ctx.manRoleplayer.submitMessage(created.id, {
      messageId: messageId('short-advice-message'), deliveryOperationId: deliveryOperationId('short-advice-delivery'),
      turnOperationId: turnOperationId('short-advice-turn'), requestId: requestId('short-advice-request'), text: user,
    })
    const accepted = await ctx.manRoleplayer.acceptedAnswer(created.id, 'short-advice-turn')
    expect({ user, answer: accepted }).toMatchInlineSnapshot(`
      {
        "answer": "我的练习虽有多种步骤，始终围绕观察材料、完成作品。",
        "user": "我该如何在课堂上说明自己的练习？请只给一句不超过30字的开场白。",
      }
    `)
    const requests = adapter.requests.filter(request => request.purpose !== 'session-title')
    expect(requests).toHaveLength(4)
    const retryMessages = JSON.stringify(requests.at(-1)?.messages)
    expect(retryMessages).toContain('does not yet apply the material')
    expect(retryMessages).toContain('does not yet connect its advice')
    expect(retryMessages).toContain('validation-oriented filler')
  })

})
