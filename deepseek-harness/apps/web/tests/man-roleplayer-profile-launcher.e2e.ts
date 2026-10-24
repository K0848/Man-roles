/** C1: the product profile is booted by the real dsh launcher, not a scaffold overlay. */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execa } from 'execa'
import { chromium, type Browser } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { newEnglishPage } from './support.ts'
import type { Page } from 'playwright'

const ROOT = process.cwd()
const CLI = join(ROOT, 'apps/cli/lib/bin.js')
const PRESET_ROOT = fileURLToPath(new URL('../../../packages/extensions/man-roleplayer/presets/', import.meta.url))
const LLM_RUNTIME = pathToFileURL(join(ROOT, 'packages/llm/llm/lib/index.js')).href

function fakeProviderSource(): string {
  return `import { LlmAdapter } from ${JSON.stringify(LLM_RUNTIME)}
class LauncherFakeAdapter extends LlmAdapter {
  failedLauncherAttempts = 0
  providerInfo(provider) { return { id: provider, name: 'launcher fake' } }
  listModels(provider) { return Promise.resolve([{ provider, id: 'product-fake', name: 'launcher fake' }]) }
  resolveModel(provider, model) { return Promise.resolve({ provider, id: model, name: model }) }
  textChunks(text) {
    return [{ type: 'block-start', index: 0, blockType: 'text' }, ...Array.from(text, (character) => ({ type: 'text-delta', index: 0, text: character })), { type: 'block-end', index: 0, block: { type: 'text', text } }, { type: 'usage', usage: { inputTokens: 8, outputTokens: text.length } }, { type: 'finish', reason: { kind: 'stop' } }]
  }
  toolChunks(id, name, args) {
    const argumentsJson = JSON.stringify(args)
    return [{ type: 'block-start', index: 0, blockType: 'tool-call' }, { type: 'tool-call-delta', index: 0, id, name, argumentsDelta: argumentsJson }, { type: 'block-end', index: 0, block: { type: 'tool-call', id, name, arguments: argumentsJson } }, { type: 'usage', usage: { inputTokens: 8, outputTokens: 4 } }, { type: 'finish', reason: { kind: 'tool-calls' } }]
  }
  async *stream(options) {
    const prompt = options.messages.flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('\\n')
    const hasEvidenceToolCall = options.messages.some(message => message.content.some(block => block.type === 'tool-call' && block.name === 'evidence_lookup'))
    const hasChoiceToolCall = options.messages.some(message => message.content.some(block => block.type === 'tool-call' && block.name === 'ask_user_question'))
    if (options.purpose === 'session-title') {
      for (const chunk of this.textChunks('启动器标题')) yield chunk
      return
    }
    if (prompt.includes('分析以下可见事件')) {
      const match = /"id":"([^"]+)","type":"turn"/u.exec(prompt)
      const turnId = match?.[1] ?? 'launcher-turn'
      const state = JSON.stringify({ candidates: [{ id: 'launcher-state-goal', kind: 'goal', text: '保留调整空间', sourceEventIds: [turnId] }, { id: 'launcher-state-conflict', kind: 'conflict', text: '目标与手段仍需区分', sourceEventIds: [turnId] }], personaSnapshot: { persona: 'wang-yangming', sourceTurnOperationId: turnId, sourceEventIds: [turnId], currentUnderstanding: '正在厘清选择', coreView: '先区分目标与手段', advice: '保留调整空间' } })
      for (const chunk of this.textChunks(state)) yield chunk
      return
    }
    if (prompt.includes('启动器证据测试')) {
      if (!hasEvidenceToolCall) {
        for (const chunk of this.toolChunks('launcher-evidence-lookup', 'evidence_lookup', { topic: '阳明材料', requestedCount: 1 })) yield chunk
        return
      }
      const text = 'launcher evidence answer'
      for (const chunk of this.toolChunks('launcher-evidence-submit', 'persona_turn_submit', { segments: [{ text, kind: 'historical-fact', evidenceIds: ['wang-yangming:research:1'] }] })) yield chunk
      return
    }
    if (prompt.includes('启动器选择测试')) {
      if (!hasChoiceToolCall) {
        for (const chunk of this.toolChunks('launcher-choice-call', 'ask_user_question', { questions: [{ id: 'direction', question: '下一步？', options: [{ label: '继续探索' }, { label: '先暂停' }] }] })) yield chunk
        return
      }
      const text = 'launcher choice answer'
      for (const chunk of this.toolChunks('launcher-choice-submit', 'persona_turn_submit', { segments: [{ text, kind: 'modern-inference', evidenceIds: [] }] })) yield chunk
      return
    }
    if (prompt.includes('启动器失败测试') && this.failedLauncherAttempts < 2) {
      this.failedLauncherAttempts += 1
      for (const chunk of this.textChunks('未校验的启动器回答')) yield chunk
      return
    }
    if (prompt.includes('启动器失败测试')) {
      const text = 'launcher retry answer'
      for (const chunk of this.toolChunks('launcher-retry-submit', 'persona_turn_submit', { segments: [{ text, kind: 'modern-inference', evidenceIds: [] }] })) yield chunk
      return
    }
    const text = 'launcher accepted answer'
    for (const chunk of this.toolChunks('launcher-submit', 'persona_turn_submit', { segments: [{ text, kind: 'modern-inference', evidenceIds: [] }] })) yield chunk
  }
}

export const name = 'man-roleplayer-launcher-fake'
export const inject = ['llm']
export function apply(ctx) {
  ctx.effect(() => {
    const registration = ctx.llm.registerAdapter(['product-fake'], new LauncherFakeAdapter())
    return () => registration.dispose()
  }, 'launcher fake provider')
}
`
}

async function waitAcceptedAnswer(page: Page, text: string): Promise<void> {
  const answer = page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]')
  await answer.filter({ hasText: text }).last().waitFor({ state: 'visible', timeout: 30_000 })
}

interface LauncherChild {
  readonly stdout?: { on: (event: 'data', listener: (chunk: Buffer) => void) => unknown }
  readonly stderr?: { on: (event: 'data', listener: (chunk: Buffer) => void) => unknown }
  readonly kill: (signal: 'SIGTERM') => unknown
  readonly catch: (handler: (error: unknown) => unknown) => Promise<unknown>
}

async function waitForUrl(child: LauncherChild, output: { value: string }): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error(`launcher did not print a URL; output: ${output.value}`)) }, 30_000)
    const inspect = (): void => {
      const match = /dsh web: (http:\/\/127\.0\.0\.1:\d+)/u.exec(output.value)
      if (match?.[1] !== undefined) { clearTimeout(timer); resolve(match[1]) }
    }
    child.stdout?.on('data', (chunk: Buffer) => { output.value += chunk.toString(); inspect() })
    child.stderr?.on('data', (chunk: Buffer) => { output.value += chunk.toString(); inspect() })
    inspect()
  })
}

describe('man-roleplayer real profile launcher', () => {
  let home: string
  let research: string
  let profilePatch: string
  let child: LauncherChild
  let browser: Browser
  let page: Page
  const remoteCalls: { readonly path: string; readonly body: string }[] = []
  const output = { value: '' }

  beforeAll(async () => {
    home = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-profile-'))
    research = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-profile-research-'))
    await writeFile(join(research, '调研成果-王阳明.md'), '> persona_id：`王阳明`\n### 【事迹卡 1】\n- **title**：阳明材料\n- **full_text**：阳明材料\n- **source**：《正式史料》\n')
    await writeFile(join(research, '调研成果-曾国藩.md'), '> persona_id：`曾国藩`\n### 【事迹卡 1】\n- **title**：曾国藩材料\n- **full_text**：曾国藩材料\n- **source**：《正式史料》\n')
    const fake = join(home, 'launcher-fake.mjs')
    await writeFile(fake, fakeProviderSource())
    profilePatch = join(home, 'launcher-fake.patch.yml')
    await writeFile(profilePatch, `- insert:\n    - id: launcher-fake\n      name: ${pathToFileURL(fake).href}\n`)
    child = execa(process.execPath, [CLI, '--profile', 'man-roles-mvp-web', '--patch', profilePatch, '--no-open', '--port', '0'], {
      cwd: ROOT, reject: false, extendEnv: false,
      env: {
        DSH_HOME: home,
        DSH_MAN_ROLEPLAYER_PROVIDER: 'product-fake', DSH_MAN_ROLEPLAYER_MODEL: 'product-fake',
        DSH_MAN_ROLEPLAYER_WANG_PATH: join(research, '调研成果-王阳明.md'),
        DSH_MAN_ROLEPLAYER_ZENG_PATH: join(research, '调研成果-曾国藩.md'),
        DSH_MAN_ROLEPLAYER_PRESET_ROOT: PRESET_ROOT,
      },
    })
    const url = await waitForUrl(child, output)
    browser = await chromium.launch({ executablePath: process.env.DSH_PLAYWRIGHT_EXECUTABLE_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
    page = await newEnglishPage(browser)
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/')) {
        remoteCalls.push({ path: new URL(request.url()).pathname, body: request.postData() ?? '' })
      }
    })
    await page.goto(url, { waitUntil: 'load' })
    await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 })
  }, 90_000)

  afterAll(async () => {
    await browser?.close()
    child?.kill('SIGTERM')
    await child?.catch(() => undefined)
    if (research !== undefined) await rm(research, { recursive: true, force: true })
    if (home !== undefined) await rm(home, { recursive: true, force: true })
  })

  it('boots the manifest-selected product root, creates two private branches, and accepts one answer', async () => {
    const manifest = JSON.parse(await readFile(join(home, 'profiles', 'man-roles-mvp-web', 'package.json'), 'utf8')) as { dsh?: { profile?: { bundles?: string[] } } }
    expect(manifest.dsh?.profile?.bundles).toEqual([
      '@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-man-roleplayer-app',
    ])
    await page.getByRole('button', { name: '新建困惑' }).click()
    await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '王阳明', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '曾国藩', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '开始这份困惑', exact: true }).click()
    await page.getByRole('button', { name: '未命名困惑' }).waitFor({ timeout: 30_000 })
    expect(await page.getByRole('button', { name: '王阳明', exact: true }).count()).toBeGreaterThan(0)
    expect(await page.getByRole('button', { name: '曾国藩', exact: true }).count()).toBeGreaterThan(0)
    await page.getByRole('textbox', { name: '输入困惑' }).fill('启动器产品测试')
    await page.getByRole('button', { name: '发送' }).click()
    await waitAcceptedAnswer(page, 'launcher accepted answer')
    expect(await page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]').count()).toBe(1)
    expect(output.value).toContain('dsh web: http://127.0.0.1:')
  })

  it('keeps archive/restore/delete lifecycle durable and exposes only product Remote routes', async () => {
    const stateCandidate = page.locator('[data-roleplayer-state="candidate"]').first()
    await stateCandidate.waitFor({ timeout: 30_000 })
    await stateCandidate.getByRole('button', { name: '确认' }).click()
    await page.locator('[data-roleplayer-state="confirmed"]').first().waitFor({ timeout: 30_000 })
    await page.locator('[data-roleplayer-state="candidate"]').first().getByRole('button', { name: '拒绝' }).click()
    const stateHistory = page.locator('details').filter({ hasText: '历史记录' })
    await stateHistory.locator('summary').click()
    await page.locator('[data-roleplayer-state="rejected"]').waitFor({ timeout: 30_000 })
    const confirmedState = page.locator('[data-roleplayer-state="confirmed"]').first()
    await confirmedState.getByRole('button', { name: '修改' }).click()
    await confirmedState.getByRole('textbox', { name: '修改状态' }).fill('保留可调整空间（已修改）')
    await confirmedState.getByRole('button', { name: '保存修改' }).click()
    await page.locator('[data-roleplayer-state="confirmed"]').filter({ hasText: '保留可调整空间（已修改）' }).waitFor({ timeout: 30_000 })

    await page.getByRole('textbox', { name: '输入困惑' }).fill('启动器选择测试')
    await page.getByRole('button', { name: '发送' }).click()
    const choice = page.getByRole('region', { name: '结构化选择' })
    await choice.waitFor({ timeout: 30_000 })
    await choice.getByRole('radio', { name: '继续探索' }).check()
    await waitAcceptedAnswer(page, 'launcher choice answer')
    // answerChoice returns before the owning turn waiter settles; wait until
    // the store clears pending so its refresh loop cannot race persona switching.
    await page.waitForFunction(() => document.querySelector('button[type="submit"]')?.hasAttribute('disabled') === false, undefined, { timeout: 30_000 })

    const switchCallsBefore = remoteCalls.filter(call => call.path.endsWith('/manRoleplayerRemote/switchPersona')).length
    await page.locator('main header').getByRole('button', { name: '曾国藩', exact: true }).click()
    await page.locator('[data-roleplayer-persona="zeng-guofan"]').waitFor({ timeout: 30_000 })
    expect(remoteCalls.filter(call => call.path.endsWith('/manRoleplayerRemote/switchPersona')).length).toBeGreaterThan(switchCallsBefore)
    expect(await page.getByText('操作暂时失败，请重试', { exact: true }).count()).toBe(0)
    await page.locator('main header').getByRole('button', { name: '王阳明', exact: true }).click()
    await page.locator('[data-roleplayer-persona="wang-yangming"]').waitFor({ timeout: 30_000 })
    await page.getByRole('textbox', { name: '输入困惑' }).fill('启动器证据测试')
    await page.getByRole('button', { name: '发送' }).click()
    await waitAcceptedAnswer(page, 'launcher evidence answer')
    const availableEvidence = page.locator('[data-roleplayer-evidence="available"]').last()
    await availableEvidence.waitFor({ timeout: 30_000 })
    await availableEvidence.getByRole('button', { name: '质疑' }).click()
    const challengedEvidence = page.locator('[data-roleplayer-evidence="challenged"]').last()
    await challengedEvidence.waitFor({ timeout: 30_000 })
    await challengedEvidence.getByRole('button', { name: '人工复核' }).click()
    const reviewedEvidence = page.locator('[data-roleplayer-evidence="available"]').last()
    await reviewedEvidence.waitFor({ timeout: 30_000 })
    await reviewedEvidence.getByRole('button', { name: '撤回' }).click()
    await page.locator('[data-roleplayer-evidence="withdrawn"]').last().waitFor({ timeout: 30_000 })

    await page.getByRole('button', { name: '归档' }).click()
    await page.getByLabel('困惑详情').getByText('已归档', { exact: true }).waitFor({ timeout: 30_000 })
    await page.reload({ waitUntil: 'load' })
    await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 })
    expect(await page.getByText('启动器产品测试', { exact: true }).count()).toBeGreaterThan(0)
    await waitAcceptedAnswer(page, 'launcher accepted answer')
    await page.getByRole('button', { name: '恢复' }).click()
    await page.getByRole('button', { name: '归档' }).waitFor({ timeout: 30_000 })

    await page.getByRole('button', { name: '删除' }).click()
    const cancelDialog = page.getByRole('dialog', { name: '确认删除' })
    await cancelDialog.getByRole('button', { name: '取消' }).click()
    expect(remoteCalls.filter(call => call.path.endsWith('/manRoleplayerRemote/delete'))).toHaveLength(0)
    expect(await page.getByText('启动器产品测试', { exact: true }).count()).toBeGreaterThan(0)

    await page.getByRole('button', { name: '删除' }).click()
    const deleteDialog = page.getByRole('dialog', { name: '确认删除' })
    await deleteDialog.getByRole('button', { name: '确认删除' }).click()
    await deleteDialog.waitFor({ state: 'detached', timeout: 30_000 })
    await page.reload({ waitUntil: 'load' })
    await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 })
    expect(await page.getByText('启动器产品测试', { exact: true }).count()).toBe(0)

    const deleteCall = [...remoteCalls].reverse().find(call => call.path.endsWith('/manRoleplayerRemote/delete'))
    if (deleteCall === undefined) throw new Error('launcher browser did not capture the delete Remote call')
    const replay = await page.evaluate(async ({ path, body }) => {
      const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
      return { status: response.status, body: await response.text() }
    }, deleteCall)
    expect(replay.status).toBe(200)
    expect(replay.body).toContain('"deleted":true')

    const productCalls = remoteCalls.filter(call => call.path.startsWith('/api/manRoleplayerRemote/'))
    const endpoints = productCalls.map(call => call.path)
    expect(endpoints.some(path => path.endsWith('/manRoleplayerRemote/create'))).toBe(true)
    expect(endpoints.some(path => path.endsWith('/manRoleplayerRemote/submit'))).toBe(true)
    expect(endpoints.some(path => path.endsWith('/manRoleplayerRemote/archive'))).toBe(true)
    expect(endpoints.some(path => path.endsWith('/manRoleplayerRemote/restore'))).toBe(true)
    expect(endpoints.some(path => path.endsWith('/manRoleplayerRemote/delete'))).toBe(true)
    for (const method of [
      'switchPersona', 'confirmState', 'rejectState', 'modifyState',
      'challengeEvidence', 'reviewEvidence', 'withdrawEvidence',
    ]) {
      expect(endpoints.some(path => path.endsWith(`/manRoleplayerRemote/${method}`))).toBe(true)
    }
    const requestFor = (method: string): Record<string, unknown> => {
      const call = productCalls.find(item => item.path.endsWith(`/manRoleplayerRemote/${method}`))
      if (call === undefined) throw new Error(`launcher browser did not capture ${method} Remote call`)
      const envelope = JSON.parse(call.body) as { payload?: { args?: { request?: Record<string, unknown> } } }
      return envelope.payload?.args?.request ?? {}
    }
    const requestHasText = (method: string, key: string): boolean => {
      const value = requestFor(method)[key]
      return typeof value === 'string' && value.length > 0
    }
    expect(requestFor('switchPersona')).toMatchObject({ persona: 'zeng-guofan' })
    for (const method of ['confirmState', 'rejectState']) {
      expect(requestHasText(method, 'itemId')).toBe(true)
    }
    expect(requestHasText('modifyState', 'itemId')).toBe(true)
    expect(requestHasText('modifyState', 'kind')).toBe(true)
    expect(requestHasText('modifyState', 'text')).toBe(true)
    for (const method of ['challengeEvidence', 'reviewEvidence', 'withdrawEvidence']) {
      expect(requestHasText(method, 'evidenceId')).toBe(true)
    }
    expect(endpoints.some(path => path.endsWith('/manRoleplayerRemote/answerChoice'))).toBe(true)
    for (const call of productCalls) {
      expect(call.path).toMatch(/^\/api\/manRoleplayerRemote\//u)
      expect(call.body).not.toContain('sessionId')
      expect(call.body).not.toContain('sourceEventId')
      expect(call.body).not.toMatch(/toolcall|tool-call/u)
      const envelope = JSON.parse(call.body) as { payload?: { args?: Record<string, unknown> } }
      const args = envelope.payload?.args?.request as Record<string, unknown> | undefined ?? envelope.payload?.args ?? {}
      expect(Object.keys(args).filter(key => ![
        'version', 'requestId', 'activePersona', 'personas', 'includeArchived', 'handle', 'expectedRevision',
        'messageId', 'deliveryOperationId', 'turnOperationId', 'text', 'operationId', 'persona',
        'itemId', 'kind', 'evidenceId', 'choiceOperationId', 'answers', 'failedTurnOperationId',
      ].includes(key)), call.path).toEqual([])
    }
    expect(remoteCalls.some(call => /\/api\/session(?:s)?\/(?:create|send)/u.test(call.path))).toBe(false)
  })

  it('drives rename, pause/resume, end-stage, and failed-message retry through the real launcher', async () => {
    await page.getByRole('button', { name: '新建困惑' }).click()
    await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '王阳明', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '曾国藩', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '开始这份困惑', exact: true }).click()
    const blank = page.getByRole('button', { name: '未命名困惑' }).last()
    await blank.waitFor({ timeout: 30_000 })

    await page.getByRole('button', { name: '重命名' }).click()
    await page.getByRole('textbox', { name: '困惑标题' }).fill('启动器持久化标题')
    await page.getByRole('button', { name: '保存标题' }).click()
    await page.getByRole('heading', { name: '启动器持久化标题' }).waitFor({ timeout: 30_000 })
    await page.reload({ waitUntil: 'load' })
    await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 })
    await page.getByRole('button', { name: '启动器持久化标题', exact: true }).click()
    await page.getByRole('heading', { name: '启动器持久化标题' }).waitFor({ timeout: 30_000 })

    const lifecycleCreate = [...remoteCalls].reverse().find(call => call.path.endsWith('/manRoleplayerRemote/create'))
    if (lifecycleCreate === undefined) throw new Error('launcher lifecycle dilemma create call was not captured')
    const requestFrom = (method: string): Record<string, unknown> => {
      const call = [...remoteCalls].reverse().find(item => item.path.endsWith(`/manRoleplayerRemote/${method}`))
      if (call === undefined) throw new Error(`launcher browser did not capture ${method} Remote call`)
      const envelope = JSON.parse(call.body) as { payload?: { args?: { request?: Record<string, unknown> } } }
      return envelope.payload?.args?.request ?? {}
    }
    const createRequest = JSON.parse(lifecycleCreate.body) as { payload?: { args?: { request?: Record<string, unknown> } } }
    const lifecycleHandle = createRequest.payload?.args?.request?.handle
    expect(typeof lifecycleHandle).toBe('undefined')

    await page.getByRole('button', { name: '暂停讨论' }).click()
    await page.getByText('本阶段已暂停', { exact: true }).waitFor({ timeout: 30_000 })
    expect(await page.getByRole('button', { name: '发送', exact: true }).isDisabled()).toBe(true)
    await page.getByRole('button', { name: '继续讨论' }).click()
    await page.getByText('可以继续提交新的困惑', { exact: true }).waitFor({ timeout: 30_000 })
    await page.getByRole('button', { name: '结束本阶段' }).click()
    await page.getByText('本阶段已结束', { exact: true }).waitFor({ timeout: 30_000 })
    expect(await page.getByRole('button', { name: '发送', exact: true }).isDisabled()).toBe(true)
    await page.getByRole('button', { name: '继续讨论' }).click()
    await page.getByText('可以继续提交新的困惑', { exact: true }).waitFor({ timeout: 30_000 })

    const lifecycleHandleFrom = requestFrom('rename').handle
    expect(typeof lifecycleHandleFrom).toBe('string')
    for (const method of ['pause', 'resume', 'endStage']) expect(requestFrom(method).handle).toBe(lifecycleHandleFrom)
    expect(requestFrom('rename')).toMatchObject({ handle: lifecycleHandleFrom, title: '启动器持久化标题' })

    await page.getByRole('button', { name: '新建困惑' }).click()
    await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '王阳明', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '曾国藩', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '开始这份困惑', exact: true }).click()
    await page.getByRole('button', { name: '未命名困惑' }).last().waitFor({ timeout: 30_000 })
    await page.getByRole('textbox', { name: '输入困惑' }).fill('启动器失败测试')
    await page.getByRole('button', { name: '发送' }).click()
    await page.getByText('回答失败，请重试', { exact: true }).waitFor({ timeout: 30_000 })
    expect(await page.locator('[data-roleplayer-kind="user-message"]').count()).toBe(1)
    expect(await page.getByText('未校验的启动器回答', { exact: true }).count()).toBe(0)
    await page.getByRole('button', { name: '重试本次回答' }).click()
    await waitAcceptedAnswer(page, 'launcher retry answer')
    expect(await page.locator('[data-roleplayer-kind="user-message"]').count()).toBe(1)
    expect(await page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]').filter({ hasText: 'launcher retry answer' }).count()).toBe(1)

    for (const method of ['rename', 'pause', 'resume', 'endStage', 'retryMessage', 'answerChoice']) {
      expect(remoteCalls.some(call => call.path.endsWith(`/manRoleplayerRemote/${method}`))).toBe(true)
    }
    const retryRequest = requestFrom('retryMessage')
    expect(typeof retryRequest.messageId).toBe('string')
    expect(typeof retryRequest.failedTurnOperationId).toBe('string')
    const answerChoice = requestFrom('answerChoice')
    expect(answerChoice.choiceOperationId).toEqual(expect.any(String))
    expect(answerChoice.answers).toEqual(expect.any(Array))
  })
})
