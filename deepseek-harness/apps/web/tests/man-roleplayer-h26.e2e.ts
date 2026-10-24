/** H2.6 product profile browser proof over the real Web Loader composition. */

import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LlmAdapter, type GenerateOptions, type LlmResolvedModelInfo, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { composeEntries, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { launchWebScaffold, type WebScaffold } from './scaffold.ts'
import { newEnglishPage } from './support.ts'
import { textResponse, toolCallResponse } from '../../../packages/core/agent-loop/tests/mock-adapter.ts'
import { operationId, requestId, turnOperationId } from '../../../packages/extensions/man-roleplayer/src/product/index.ts'

const ROOT = process.cwd()
const PRODUCT_PATCH = join(ROOT, 'packages/bundle/man-roleplayer-app/cordis.patch.yml')
const PRESET_ROOT = fileURLToPath(new URL('../../../packages/extensions/man-roleplayer/presets/', import.meta.url))
const WEB_PATCH = join(ROOT, 'packages/bundle/web-app/cordis.patch.yml')
const BASE_PATCH = join(ROOT, 'packages/bundle/base/cordis.patch.yml')

function installedChromium(): string | undefined {
  const programFiles = process.env.ProgramFiles
  const programFilesX86 = process.env['ProgramFiles(x86)']
  const candidates = [process.env.DSH_PLAYWRIGHT_EXECUTABLE_PATH, process.env.CHROME_PATH,
    programFiles === undefined ? undefined : join(programFiles, 'Google/Chrome/Application/chrome.exe'),
    programFilesX86 === undefined ? undefined : join(programFilesX86, 'Google/Chrome/Application/chrome.exe')]
  return candidates.find(path => path !== undefined && existsSync(path))
}

/** Deterministic fake Provider used only by this browser test; no network path exists. */
class ProductFakeAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model })
  }

  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    if (options.purpose === 'session-title') {
      yield* textResponse('产品标题')
      return
    }
    const prompt = options.messages.flatMap(message => message.content)
      .filter(block => block.type === 'text').map(block => block.text).join('\n')
    if (prompt.includes('分析以下可见事件')) {
      const turnId = /"id":"([^"]+)","type":"turn"/u.exec(prompt)?.[1] ?? 'missing-turn'
      yield* textResponse(JSON.stringify({
        candidates: [
          { id: 'browser-state-goal', kind: 'goal', text: '保留可调整空间', sourceEventIds: [turnId] },
          { id: 'browser-state-conflict', kind: 'conflict', text: '目标与手段仍需区分', sourceEventIds: [turnId] },
        ],
        personaSnapshot: {
          persona: 'wang-yangming', sourceTurnOperationId: turnId, sourceEventIds: [turnId],
          currentUnderstanding: '正在厘清选择', coreView: '先区分目标与手段', advice: '保留调整空间',
        },
      }))
      return
    }
    const hasToolResult = options.messages.some(message => message.content.some(block => block.type === 'tool-result'))
    if (prompt.includes('普通文本失败')) {
      yield* textResponse('未校验的普通回答')
      return
    }
    if (prompt.includes('格式错误')) {
      if (!hasToolResult) {
        yield* toolCallResponse('browser-malformed-submit', 'persona_turn_submit', {
          segments: [{ text: '', kind: 'modern-inference', evidenceIds: [] }],
        })
      } else yield* textResponse('未校验的普通回答')
      return
    }
    if (prompt.includes('无匹配')) {
      if (!hasToolResult) {
        yield* toolCallResponse('browser-zero-lookup', 'evidence_lookup', { topic: '不存在的资料主题', requestedCount: 1 })
      } else {
        const text = '暂无匹配资料，我先保留问题'
        yield* toolCallResponse('browser-zero-submit', 'persona_turn_submit', {
          segments: [{ text, kind: 'modern-inference', evidenceIds: [] }],
        })
      }
      return
    }
    if (prompt.includes('取消测试')) {
      await new Promise(resolve => setTimeout(resolve, 10_000))
      const text = '迟到的回答'
      yield* toolCallResponse('browser-late-submit', 'persona_turn_submit', {
        segments: [{ text, kind: 'modern-inference', evidenceIds: [] }],
      })
      return
    }
    if (prompt.includes('请结合事上磨练') && !hasToolResult) {
      yield* toolCallResponse('browser-evidence-lookup', 'evidence_lookup', { topic: '请结合事上磨练谈谈我的选择', requestedCount: 1 })
      return
    }
    if (prompt.includes('请结合事上磨练') && hasToolResult) {
      const text = '人须在事上磨练'
      yield* toolCallResponse('browser-evidence-submit', 'persona_turn_submit', {
        segments: [{ text, kind: 'historical-fact', evidenceIds: ['wang-yangming:research:1'] }],
      })
      return
    }
    const text = '这是经过校验的产品回答'
    yield* toolCallResponse('product-submit', 'persona_turn_submit', {
      segments: [{ text, kind: 'modern-inference', evidenceIds: [] }],
    })
  }
}

describe('H2.6 independent man-roleplayer product profile', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let researchRoot: string
  let fake: ProductFakeAdapter
  let harnessHome: string
  let ordinaryScaffold: WebScaffold
  let ordinaryBrowser: Browser
  let ordinaryPage: Page
  let unavailableScaffold: WebScaffold
  let unavailableBrowser: Browser
  let unavailablePage: Page
  let unavailableHome: string

  beforeAll(async () => {
    researchRoot = await mkdtemp(join(ROOT, 'tmp-man-roleplayer-h26-research-'))
    harnessHome = await mkdtemp(join(ROOT, 'tmp-man-roleplayer-h26-home-'))
    const packageLinkRoot = join(harnessHome, 'profiles', 'node_modules', '@deepseek-ai')
    await mkdir(packageLinkRoot, { recursive: true })
    await symlink(join(ROOT, 'packages/client/ui-man-roleplayer'), join(packageLinkRoot, 'dsh-client-ui-man-roleplayer'), 'junction')
    await writeFile(join(researchRoot, '调研成果-王阳明.md'), '> persona_id：`王阳明`\n### 【事迹卡 1】\n- **title**：人须在事上磨\n- **full_text**：人须在事上磨练，方能增长本领\n- **source**：《正式史料》\n')
    await writeFile(join(researchRoot, '调研成果-曾国藩.md'), '> persona_id：`曾国藩`\n### 【事迹卡 1】\n- **title**：曾国藩材料\n- **full_text**：曾国藩材料\n- **source**：《正式史料》\n')
    const previous = {
      provider: process.env.DSH_MAN_ROLEPLAYER_PROVIDER,
      model: process.env.DSH_MAN_ROLEPLAYER_MODEL,
      wang: process.env.DSH_MAN_ROLEPLAYER_WANG_PATH,
      zeng: process.env.DSH_MAN_ROLEPLAYER_ZENG_PATH,
      preset: process.env.DSH_MAN_ROLEPLAYER_PRESET_ROOT,
    }
    process.env.DSH_MAN_ROLEPLAYER_PROVIDER = 'product-fake'
    process.env.DSH_MAN_ROLEPLAYER_MODEL = 'product-fake'
    process.env.DSH_MAN_ROLEPLAYER_WANG_PATH = join(researchRoot, '调研成果-王阳明.md')
    process.env.DSH_MAN_ROLEPLAYER_ZENG_PATH = join(researchRoot, '调研成果-曾国藩.md')
    process.env.DSH_MAN_ROLEPLAYER_PRESET_ROOT = PRESET_ROOT
    try {
      scaffold = await launchWebScaffold({
        extraOverlayPath: PRODUCT_PATCH,
        harnessHome,
        welcomeNoticePending: true,
        agentPresets: { roots: [{ path: PRESET_ROOT, trust: 'system' }], default: 'wang-yangming' },
      })
    } finally {
      for (const [key, value] of Object.entries({
        DSH_MAN_ROLEPLAYER_PROVIDER: previous.provider,
        DSH_MAN_ROLEPLAYER_MODEL: previous.model,
        DSH_MAN_ROLEPLAYER_WANG_PATH: previous.wang,
        DSH_MAN_ROLEPLAYER_ZENG_PATH: previous.zeng,
        DSH_MAN_ROLEPLAYER_PRESET_ROOT: previous.preset,
      })) {
        if (value === undefined) Reflect.deleteProperty(process.env, key)
        else process.env[key] = value
      }
    }
    fake = new ProductFakeAdapter()
    scaffold.ctx.llm.registerAdapter(['product-fake'], fake)
    const executablePath = installedChromium()
    browser = await chromium.launch(executablePath === undefined ? {} : { executablePath })
    page = await newEnglishPage(browser)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 })
    ordinaryScaffold = await launchWebScaffold({ welcomeNoticePending: true })
    const ordinaryExecutablePath = installedChromium()
    ordinaryBrowser = await chromium.launch(ordinaryExecutablePath === undefined ? {} : { executablePath: ordinaryExecutablePath })
    ordinaryPage = await newEnglishPage(ordinaryBrowser)
    await ordinaryPage.goto(ordinaryScaffold.baseUrl, { waitUntil: 'load' })
    await ordinaryPage.locator('body').waitFor({ state: 'attached', timeout: 30_000 })
    unavailableHome = await mkdtemp(join(ROOT, 'tmp-man-roleplayer-h26-unavailable-'))
    const unavailablePackageLinkRoot = join(unavailableHome, 'profiles', 'node_modules', '@deepseek-ai')
    await mkdir(unavailablePackageLinkRoot, { recursive: true })
    await symlink(join(ROOT, 'packages/client/ui-man-roleplayer'), join(unavailablePackageLinkRoot, 'dsh-client-ui-man-roleplayer'), 'junction')
    const unavailableOverlay = join(unavailableHome, 'unavailable.cordis.patch.yml')
    await writeFile(unavailableOverlay, `${await readFile(PRODUCT_PATCH, 'utf8')}\n- id: man-roleplayer\n  disabled: true\n`)
    const unavailableEnv = {
      DSH_MAN_ROLEPLAYER_PROVIDER: 'product-fake', DSH_MAN_ROLEPLAYER_MODEL: 'product-fake',
      DSH_MAN_ROLEPLAYER_WANG_PATH: join(researchRoot, '调研成果-王阳明.md'),
      DSH_MAN_ROLEPLAYER_ZENG_PATH: join(researchRoot, '调研成果-曾国藩.md'), DSH_MAN_ROLEPLAYER_PRESET_ROOT: PRESET_ROOT,
    }
    const previousUnavailable = Object.fromEntries(Object.keys(unavailableEnv).map(key => [key, process.env[key]]))
    Object.assign(process.env, unavailableEnv)
    try {
      unavailableScaffold = await launchWebScaffold({
        extraOverlayPath: unavailableOverlay, harnessHome: unavailableHome, welcomeNoticePending: true,
      })
    } finally {
      for (const [key, value] of Object.entries(previousUnavailable)) {
        if (value === undefined) Reflect.deleteProperty(process.env, key)
        else process.env[key] = value
      }
    }
    unavailableBrowser = await chromium.launch(installedChromium() === undefined ? {} : { executablePath: installedChromium() })
    unavailablePage = await newEnglishPage(unavailableBrowser)
    await unavailablePage.goto(unavailableScaffold.baseUrl, { waitUntil: 'load' })
    await unavailablePage.locator('[data-roleplayer-unavailable="true"]').waitFor({ timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
    await ordinaryBrowser?.close()
    await ordinaryScaffold?.close()
    await unavailableBrowser?.close()
    await unavailableScaffold?.close()
    if (researchRoot !== undefined) await rm(researchRoot, { recursive: true, force: true })
    if (harnessHome !== undefined) await rm(harnessHome, { recursive: true, force: true })
    if (unavailableHome !== undefined) await rm(unavailableHome, { recursive: true, force: true })
  })

  it('creates a blank dilemma, keeps two sessions private, and renders only accepted structured text', async () => {
    await page.getByRole('button', { name: '新建困惑' }).click()
    await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '王阳明', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '曾国藩', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '开始这份困惑', exact: true }).click()
    const createdButton = page.getByRole('button', { name: '未命名困惑' })
    await createdButton.waitFor({ state: 'visible', timeout: 30_000 })
    expect(await createdButton.count()).toBe(1)
    const conversations = await scaffold.ctx.manRoleplayer.list(true)
    expect(conversations).toHaveLength(1)
    const created = conversations[0]
    if (created === undefined) throw new Error('product dilemma was not persisted')
    expect(created.branches).toHaveLength(2)
    expect(new Set(created.branches.map(branch => String(branch.sessionId))).size).toBe(2)
    expect(scaffold.ctx.agents.list()).toHaveLength(2)
    const submitSchema = scaffold.ctx.tools.schemas(scaffold.ctx.agents.get(created.branches[0].sessionId))
      .find(tool => tool.name === 'persona_turn_submit')
    expect(submitSchema?.parameters).toMatchObject({
      type: 'object', properties: { segments: { type: 'array', minItems: 1, items: {
        required: ['text', 'kind', 'evidenceIds'],
        properties: { text: { type: 'string' }, kind: { enum: ['reliable-quote', 'historical-fact', 'attribution', 'modern-inference', 'insufficient-evidence'] } },
      } } },
    })
    expect(JSON.stringify(submitSchema?.parameters)).not.toContain('textRange')
    if (fake === undefined) throw new Error('H2.6 fake adapter was not installed')
    await page.getByRole('textbox', { name: '输入困惑' }).fill('我想更清楚地面对选择')
    await page.getByRole('button', { name: '发送' }).click()
    const answer = page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]')
    await answer.waitFor({ state: 'visible', timeout: 30_000 })
    expect(await answer.textContent()).toContain('这是经过校验的产品回答')
    const firstUser = page.locator('[data-roleplayer-kind="user-message"]')
    expect(await firstUser.count()).toBe(1)
    expect(await firstUser.first().textContent()).toContain('我想更清楚地面对选择')
    expect(fake.requests.length).toBeGreaterThanOrEqual(1)
    expect(JSON.stringify(await page.locator('[data-roleplayer-view="true"]').textContent())).not.toContain('persona_turn_submit')
    expect(JSON.stringify(await page.locator('[data-roleplayer-view="true"]').textContent())).not.toContain('sessionId')
    await page.reload({ waitUntil: 'load' })
    await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 })
    expect(await page.locator('[data-roleplayer-kind="user-message"]').count()).toBe(1)
    expect(await page.locator('[data-roleplayer-kind="user-message"]').first().textContent()).toContain('我想更清楚地面对选择')
    await page.locator('[data-roleplayer-state="candidate"]').first().waitFor({ timeout: 30_000 })
    const stateCandidates = page.locator('[data-roleplayer-state="candidate"]')
    expect(await stateCandidates.count()).toBe(2)
    await stateCandidates.nth(0).getByRole('button', { name: '确认' }).click()
    await page.locator('[data-roleplayer-state="confirmed"]').first().waitFor({ timeout: 30_000 })
    await page.locator('[data-roleplayer-state="candidate"]').first().getByRole('button', { name: '拒绝' }).click()
    const stateHistory = page.locator('details').filter({ hasText: '历史记录' })
    await stateHistory.locator('summary').click()
    await page.locator('[data-roleplayer-state="rejected"]').waitFor({ timeout: 30_000 })
    const confirmedState = page.locator('[data-roleplayer-state="confirmed"]').first()
    await confirmedState.getByRole('button', { name: '修改' }).click()
    await confirmedState.getByRole('textbox', { name: '修改状态' }).fill('明确可调整的下一步')
    await confirmedState.getByRole('button', { name: '保存修改' }).click()
    await page.locator('[data-roleplayer-state="confirmed"]').filter({ hasText: '明确可调整的下一步' }).waitFor({ timeout: 30_000 })
    await page.getByRole('button', { name: '曾国藩', exact: true }).click()
    await page.getByRole('textbox', { name: '输入困惑' }).fill('请从曾国藩的角度再看一次')
    await page.getByRole('button', { name: '发送' }).click()
    const secondAnswer = page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]')
    await page.waitForFunction(() => document.querySelectorAll('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]').length === 2, undefined, { timeout: 30_000 })
    const secondAgent = scaffold.ctx.agents.get(created.branches[1].sessionId)
    expect(await secondAnswer.count()).toBe(2)
    expect(secondAgent?.session.events.some(event => event.type === 'user/message'
      && event.data.source.kind === 'user'
      && event.data.content.some(block => block.type === 'text' && block.text === '请从曾国藩的角度再看一次'))).toBe(true)
  })

  it('projects evidence lookup details and keeps challenge, review, withdraw stable after reload', async () => {
    await page.getByRole('button', { name: '新建困惑' }).click()
    await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '王阳明', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '曾国藩', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '开始这份困惑', exact: true }).click()
    const blank = page.getByRole('button', { name: '未命名困惑' }).last()
    await blank.waitFor({ state: 'visible', timeout: 30_000 })
    await blank.click()
    await page.getByRole('textbox', { name: '输入困惑' }).fill('请结合事上磨练谈谈我的选择')
    await page.getByRole('button', { name: '发送' }).click()
    await page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]')
      .filter({ hasText: '人须在事上磨练' }).waitFor({ timeout: 30_000 })
    const available = page.locator('[data-roleplayer-evidence="available"]').last()
    await available.waitFor({ state: 'visible', timeout: 30_000 })
    expect(await available.textContent()).toContain('人须在事上磨')
    expect(await available.textContent()).toContain('正式史料')
    expect(await page.locator('[aria-label="证据检索活动"]').textContent()).toContain('已找到 1 条')
    await available.getByRole('button', { name: '质疑' }).click()
    const challenged = page.locator('[data-roleplayer-evidence="challenged"]').last()
    await challenged.waitFor({ state: 'visible', timeout: 30_000 })
    expect(await challenged.textContent()).toContain('已被质疑/待复核')
    await page.getByRole('button', { name: '人工复核', exact: true }).last().click()
    const reviewed = page.locator('[data-roleplayer-evidence="available"]').last()
    await reviewed.waitFor({ state: 'visible', timeout: 30_000 })
    await reviewed.getByRole('button', { name: '撤回' }).click()
    const withdrawn = page.locator('[data-roleplayer-evidence="withdrawn"]').last()
    await withdrawn.waitFor({ state: 'visible', timeout: 30_000 })
    expect(await withdrawn.textContent()).toContain('已撤回')
    await page.reload({ waitUntil: 'load' })
    await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 })
    await page.getByRole('button', { name: '产品标题' }).last().click()
    await page.locator('[data-roleplayer-evidence="withdrawn"]').last().waitFor({ timeout: 30_000 })
    expect(await page.locator('[data-roleplayer-evidence="withdrawn"]').count()).toBeGreaterThan(0)
    expect(await page.locator('[data-roleplayer-evidence="withdrawn"]').last().textContent()).toContain('已撤回')
    await page.getByRole('button', { name: '新建困惑' }).click()
    await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '王阳明', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '曾国藩', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '开始这份困惑', exact: true }).click()
    const zeroBlank = page.getByRole('button', { name: '未命名困惑' }).last()
    await zeroBlank.waitFor({ state: 'visible', timeout: 30_000 }); await zeroBlank.click()
    await page.getByRole('textbox', { name: '输入困惑' }).fill('无匹配')
    await page.getByRole('button', { name: '发送' }).click()
    await page.locator('[aria-label="证据检索活动"]').getByText('未找到匹配资料', { exact: true }).waitFor({ timeout: 30_000 })
    const zeroConversation = (await scaffold.ctx.manRoleplayer.list(true)).at(-1)
    if (zeroConversation === undefined) throw new Error('zero-hit browser dilemma was not persisted')
    const repository = (scaffold.ctx.manRoleplayer as unknown as {
      repository: { append: (id: unknown, event: unknown) => Promise<unknown> }
    }).repository
    const activityBranch = zeroConversation.branches[0]
    if (activityBranch === undefined) throw new Error('zero-hit browser dilemma has no branch')
    for (const [suffix, status, reservedCount] of [
      ['failed', 'failed', 1], ['cancelled', 'cancelled', 1], ['budget', 'failed', 0],
    ] as const) {
      const operation = operationId(`browser-activity-${suffix}`)
      await repository.append(zeroConversation.id, {
        type: 'evidence-tool-claim', operationId: operation, turnOperationId: turnOperationId(`browser-activity-turn-${suffix}`),
        persona: activityBranch.persona, sessionId: activityBranch.sessionId, topic: `browser ${suffix}`, requestedCount: 1,
        reservedCount, reservedBytes: reservedCount, deadline: Date.now(), evidenceRevision: 0,
        fingerprint: 'browser-activity', status, requestId: requestId(`browser-activity-${suffix}`),
      })
    }
    await page.reload({ waitUntil: 'load' })
    await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 })
    await page.getByRole('button', { name: '产品标题' }).last().click()
    const activity = page.locator('[aria-label="证据检索活动"]')
    await activity.getByText('检索失败', { exact: true }).waitFor({ timeout: 30_000 })
    await activity.getByText('检索已取消', { exact: true }).waitFor({ timeout: 30_000 })
    await activity.getByText('本轮检索次数已用完', { exact: true }).waitFor({ timeout: 30_000 })
  })

  it('maps an accepted claim textRange to its evidence drawer and preserves the answer when evidence becomes stale', async () => {
    await page.getByRole('button', { name: '新建困惑' }).click()
    await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '王阳明', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '曾国藩', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '开始这份困惑', exact: true }).click()
    const blank = page.getByRole('button', { name: '未命名困惑' }).last()
    await blank.waitFor({ state: 'visible', timeout: 30_000 }); await blank.click()
    const prompt = '请结合事上磨练谈谈我的选择'
    await page.getByRole('textbox', { name: '输入困惑' }).fill(prompt)
    await page.getByRole('button', { name: '发送' }).click()
    const answer = page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]').filter({ hasText: '人须在事上磨练' }).last()
    await answer.waitFor({ timeout: 30_000 })
    const claim = answer.locator('[data-claim-status="accepted"][data-claim-text-range]')
    await claim.waitFor({ timeout: 30_000 })
    const claimRange = await claim.evaluate(element => ({ start: element.getAttribute('data-claim-start'), end: element.getAttribute('data-claim-end'), range: element.getAttribute('data-claim-text-range') }))
    expect(claimRange).toEqual({ start: '0', end: String('人须在事上磨练'.length), range: `0:${'人须在事上磨练'.length}` })
    const triggerText = await claim.textContent()
    expect(triggerText).toContain('查看史实依据')
    await claim.click()
    const drawer = page.getByRole('dialog', { name: '证据详情' })
    await drawer.waitFor({ state: 'visible', timeout: 30_000 })
    expect(await drawer.getAttribute('aria-modal')).toBe('true')
    await expect.poll(() => drawer.evaluate(element => element.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await drawer.waitFor({ state: 'detached', timeout: 30_000 })
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-claim-text-range'))).toBe(claimRange.range)
    await page.getByRole('button', { name: '质疑', exact: true }).last().click()
    const staleClaim = answer.locator('[data-claim-status="stale"][data-claim-text-range]')
    await staleClaim.waitFor({ timeout: 30_000 })
    expect(await staleClaim.getAttribute('data-claim-text-range')).toBe(claimRange.range)
    expect(await answer.textContent()).toContain('人须在事上磨练')
    expect(await answer.textContent()).toContain('查看史实依据')
  })

  it('recovers a persisted deletion checkpoint as read-only and retries the same operation identity', async () => {
    await page.getByRole('button', { name: '新建困惑' }).click()
    await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '王阳明', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '曾国藩', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '开始这份困惑', exact: true }).click()
    const blank = page.getByRole('button', { name: '未命名困惑' }).last()
    await blank.waitFor({ timeout: 30_000 })
    await blank.click()
    await page.getByRole('button', { name: '重命名' }).click()
    await page.getByRole('textbox', { name: '困惑标题' }).fill('浏览器删除检查点')
    await page.getByRole('button', { name: '保存标题' }).click()
    await page.getByRole('button', { name: '浏览器删除检查点', exact: true }).waitFor({ timeout: 30_000 })
    const conversation = (await scaffold.ctx.manRoleplayer.list(true)).at(-1); if (conversation === undefined) throw new Error('checkpoint dilemma missing')
    const repository = (scaffold.ctx.manRoleplayer as unknown as {
      repository: { append: (id: unknown, event: unknown) => Promise<unknown> }
    }).repository
    const checkpoint = operationId('browser-delete-checkpoint')
    await repository.append(conversation.id, { type: 'deletion', operation: { operationId: checkpoint, stage: 'stopping-agents', irreversible: false }, requestId: requestId('browser-delete-checkpoint') })
    await page.reload({ waitUntil: 'load' }); await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 }); await page.getByRole('button', { name: '浏览器删除检查点', exact: true }).click()
    await page.getByRole('status').filter({ hasText: '删除阶段：stopping-agents' }).waitFor({ timeout: 30_000 })
    expect(await page.getByRole('textbox', { name: '输入困惑' }).count()).toBe(0); expect(await page.getByRole('button', { name: '删除', exact: true }).count()).toBe(0); expect(await page.getByRole('button', { name: '重试未完成步骤', exact: true }).count()).toBe(1)
    const request = page.waitForRequest(item => item.method() === 'POST' && new URL(item.url()).pathname.endsWith('/manRoleplayerRemote/delete'))
    await page.getByRole('button', { name: '重试未完成步骤', exact: true }).click(); const deleteRequest = await request; const requestBody = deleteRequest.postData() ?? ''; expect(requestBody).toContain('browser-delete-checkpoint'); const response = await deleteRequest.response(); if (response === null) throw new Error('delete Remote response missing'); const body = await response.text(); expect(response.status(), body).toBe(200); expect(body).toContain('"deleted":true')
    expect(body).not.toMatch(/sessionId|tool[- ]?call/iu)
  })

  it('resumes an irreversible failed deletion checkpoint after refresh with the same operation', async () => {
    await page.getByRole('button', { name: '新建困惑' }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '王阳明', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '曾国藩', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '开始这份困惑', exact: true }).click(); const blank = page.getByRole('button', { name: '未命名困惑' }).last(); await blank.waitFor({ timeout: 30_000 }); await blank.click(); await page.getByRole('button', { name: '重命名' }).click(); await page.getByRole('textbox', { name: '困惑标题' }).fill('浏览器不可逆删除'); await page.getByRole('button', { name: '保存标题' }).click(); await page.getByRole('button', { name: '浏览器不可逆删除', exact: true }).waitFor({ timeout: 30_000 })
    const product = scaffold.ctx.manRoleplayer as unknown as { persistence: { delete: (id: string) => Promise<void> } }; const originalDelete = product.persistence.delete.bind(product.persistence); let calls = 0; product.persistence.delete = async (id: string): Promise<void> => { calls += 1; if (calls === 2) throw new Error('injected second session delete failure'); await originalDelete(id) }
    try {
      const firstRequest = page.waitForRequest(item => item.method() === 'POST' && new URL(item.url()).pathname.endsWith('/manRoleplayerRemote/delete')); await page.getByRole('button', { name: '删除', exact: true }).click(); await page.getByRole('dialog', { name: '确认删除' }).getByRole('button', { name: '确认删除' }).click(); const first = await firstRequest; const firstBody = first.postData() ?? ''; const firstOperation = JSON.parse(firstBody) as { payload?: { args?: { request?: { operationId?: string } } } }; const operation = firstOperation.payload?.args?.request?.operationId; if (typeof operation !== 'string') throw new Error(`delete operation missing: ${firstBody}`)
      await page.getByRole('status').filter({ hasText: '删除阶段：failed' }).waitFor({ timeout: 30_000 }); await page.reload({ waitUntil: 'load' }); await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 }); await page.getByRole('button', { name: '浏览器不可逆删除', exact: true }).click(); expect(await page.getByRole('textbox', { name: '输入困惑' }).count()).toBe(0); expect(await page.getByRole('button', { name: '删除', exact: true }).count()).toBe(0); expect(await page.getByRole('button', { name: '重试未完成步骤', exact: true }).count()).toBe(1)
      product.persistence.delete = originalDelete; const secondRequest = page.waitForRequest(item => item.method() === 'POST' && new URL(item.url()).pathname.endsWith('/manRoleplayerRemote/delete')); await page.getByRole('button', { name: '重试未完成步骤', exact: true }).click(); const secondBody = (await secondRequest).postData() ?? ''; const secondOperation = JSON.parse(secondBody) as { payload?: { args?: { request?: { operationId?: string } } } }; expect(secondOperation.payload?.args?.request?.operationId).toBe(operation); await page.getByRole('button', { name: '浏览器不可逆删除', exact: true }).waitFor({ state: 'detached', timeout: 30_000 })
    } finally { product.persistence.delete = originalDelete }
  })

  it('recovers a pending delivery after refresh and cancels only the owning dilemma', async () => {
    await page.getByRole('button', { name: '新建困惑' }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '王阳明', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '曾国藩', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '开始这份困惑', exact: true }).click(); const first = page.getByRole('button', { name: '未命名困惑' }).last(); await first.waitFor({ timeout: 30_000 }); await first.click(); await page.getByRole('button', { name: '重命名' }).click(); await page.getByRole('textbox', { name: '困惑标题' }).fill('浏览器待取消A'); await page.getByRole('button', { name: '保存标题' }).click(); await page.getByRole('button', { name: '浏览器待取消A', exact: true }).waitFor({ timeout: 30_000 })
    const conversation = (await scaffold.ctx.manRoleplayer.list(true)).at(-1); if (conversation === undefined) throw new Error('pending dilemma missing'); const repository = (scaffold.ctx.manRoleplayer as unknown as { repository: { append: (id: unknown, event: unknown) => Promise<unknown> } }).repository
    const message = 'browser-pending-message'; const delivery = operationId('browser-pending-delivery'); const turn = operationId('browser-pending-turn')
    await repository.append(conversation.id, { type: 'user-message', id: message, messageId: message, deliveryOperationId: delivery, status: 'pending', content: '待取消问题', persona: 'wang-yangming', requestId: requestId('browser-pending-message') })
    await repository.append(conversation.id, { type: 'message-delivery', messageId: message, deliveryOperationId: delivery, persona: 'wang-yangming', status: 'claimed', sessionMessageId: 'private-session', requestId: requestId('browser-pending-delivery') })
    await repository.append(conversation.id, { type: 'turn', turnOperationId: turn, messageId: message, persona: 'wang-yangming', status: 'running', requestId: requestId('browser-pending-turn') })
    const activeTurn = await scaffold.ctx.manRoleplayer.activeTurn(conversation.id); if (activeTurn === undefined) throw new Error(`activeTurn missing: ${JSON.stringify(await repository.readEvents(conversation.id))}`); expect(activeTurn).toMatchObject({ messageId: message, deliveryOperationId: delivery, turnOperationId: turn, status: 'running' })
    await page.reload({ waitUntil: 'load' })
    await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 })
    await page.getByRole('button', { name: '浏览器待取消A', exact: true }).click()
    await page.getByRole('button', { name: '取消', exact: true }).waitFor({ timeout: 30_000 })
    const draft = page.getByRole('textbox', { name: '输入困惑' })
    await draft.fill('保留的草稿')

    await page.locator('main header').getByRole('button', { name: '曾国藩', exact: true }).click()
    let switchDialog = page.getByRole('dialog', { name: '停止当前对话？' })
    await switchDialog.waitFor({ timeout: 30_000 })
    await switchDialog.getByRole('button', { name: '继续当前对话' }).click()
    await switchDialog.waitFor({ state: 'detached', timeout: 30_000 })
    expect(await page.locator('[data-roleplayer-persona="wang-yangming"]').count()).toBe(1)
    expect(await draft.inputValue()).toBe('保留的草稿')

    await page.locator('main header').getByRole('button', { name: '曾国藩', exact: true }).click()
    switchDialog = page.getByRole('dialog', { name: '停止当前对话？' })
    await switchDialog.waitFor({ timeout: 30_000 })
    await page.keyboard.press('Escape')
    await switchDialog.waitFor({ state: 'detached', timeout: 30_000 })
    expect(await draft.inputValue()).toBe('保留的草稿')

    await page.locator('main header').getByRole('button', { name: '曾国藩', exact: true }).click()
    switchDialog = page.getByRole('dialog', { name: '停止当前对话？' })
    await switchDialog.getByRole('button', { name: '停止并切换' }).click()
    await page.getByText('操作暂时失败，请重试', { exact: true }).waitFor({ timeout: 30_000 })
    expect(await page.locator('[data-roleplayer-persona="wang-yangming"]').count()).toBe(1)
    expect(await draft.inputValue()).toBe('保留的草稿')
    await page.keyboard.press('Escape')
    await switchDialog.waitFor({ state: 'detached', timeout: 30_000 })

    await page.getByRole('button', { name: '新建困惑' }).click()
    await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '王阳明', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '曾国藩', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '开始这份困惑', exact: true }).click()
    const second = page.getByRole('button', { name: '未命名困惑', exact: true }).last()
    await second.waitFor({ timeout: 30_000 }); await second.click()
    expect(await page.getByRole('button', { name: '取消', exact: true }).count()).toBe(0)
    await page.getByRole('button', { name: '浏览器待取消A', exact: true }).click(); const cancelRequest = page.waitForRequest(item => item.method() === 'POST' && new URL(item.url()).pathname.endsWith('/manRoleplayerRemote/cancel')); const cancelResponse = page.waitForResponse(async item => item.request().method() === 'POST' && new URL(item.url()).pathname.endsWith('/manRoleplayerRemote/cancel')); await page.getByRole('button', { name: '取消', exact: true }).click(); const requestBody = (await cancelRequest).postData() ?? ''; expect(requestBody).toMatch(/browser-pending-message|browser-pending-delivery|browser-pending-turn/u); const cancel = await cancelResponse; const cancelBody = await cancel.text(); expect(cancel.status(), cancelBody).toBe(200); expect(cancelBody).not.toMatch(/sessionId|tool[- ]?call/iu)
  })

  it('retries a failed state analysis without duplicating the accepted conversation timeline', async () => {
    await page.getByRole('button', { name: '新建困惑' }).click()
    await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '王阳明', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '曾国藩', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '开始这份困惑', exact: true }).click()
    const blank = page.getByRole('button', { name: '未命名困惑' }).last()
    await blank.waitFor({ timeout: 30_000 }); await blank.click()
    await page.getByRole('button', { name: '重命名' }).click()
    await page.getByRole('textbox', { name: '困惑标题' }).fill('浏览器状态重试')
    await page.getByRole('button', { name: '保存标题' }).click()
    await page.getByRole('button', { name: '浏览器状态重试', exact: true }).waitFor({ timeout: 30_000 })
    await page.getByRole('textbox', { name: '输入困惑' }).fill('状态重试前的回答')
    await page.getByRole('button', { name: '发送' }).click()
    await page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]').last().waitFor({ timeout: 30_000 })
    await page.locator('[data-roleplayer-state="candidate"]').first().waitFor({ timeout: 30_000 })

    const conversation = (await scaffold.ctx.manRoleplayer.list(true)).find(item => item.title === '浏览器状态重试')
    if (conversation === undefined) throw new Error('state retry dilemma missing')
    const repository = (scaffold.ctx.manRoleplayer as unknown as { repository: {
      append: (id: unknown, event: unknown) => Promise<unknown>
      readEvents: (id: unknown) => Promise<Array<Record<string, unknown>> | undefined>
    } }).repository
    const events = await repository.readEvents(conversation.id) ?? []
    const sourceTurn = events.findLast(event => event.type === 'turn' && event.status === 'completed')
    if (sourceTurn === undefined || typeof sourceTurn.turnOperationId !== 'string' || typeof sourceTurn.sessionEventId !== 'string') throw new Error('state retry source turn missing')
    const sourceUser = events.findLast(event => event.type === 'user-message' && event.status === 'delivered')
    const operation = operationId('browser-state-retry')
    const inputProjection = [{ id: sourceTurn.turnOperationId, type: 'turn', persona: 'wang-yangming', sessionEventId: sourceTurn.sessionEventId }]
    const stateCalls = (): number => fake.requests.filter(request => request.messages.flatMap(message => message.content)
      .some(block => block.type === 'text' && block.text.includes('分析以下可见事件'))).length
    const stateCallsBefore = stateCalls()
    await repository.append(conversation.id, {
      type: 'state-analysis', operationId: operation,
      inputWatermark: typeof sourceUser?.id === 'string' ? sourceUser.id : String(conversation.id),
      revision: conversation.revision,
      branchRevision: events.filter(event => event.type === 'turn' && event.status === 'completed' && event.persona === 'wang-yangming').length,
      status: 'failed', persona: 'wang-yangming', inputProjection,
      sourceOperationId: sourceTurn.turnOperationId, requestId: requestId('browser-state-retry'),
    })

    await page.reload({ waitUntil: 'load' })
    await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 })
    await page.getByRole('button', { name: '浏览器状态重试', exact: true }).click()
    await page.getByRole('button', { name: '重试状态整理', exact: true }).waitFor({ timeout: 30_000 })
    const usersBefore = await page.locator('[data-roleplayer-kind="user-message"]').count()
    const answersBefore = await page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]').count()
    const retryRequest = page.waitForRequest(item => item.method() === 'POST' && new URL(item.url()).pathname.endsWith('/manRoleplayerRemote/retryState'))
    await page.getByRole('button', { name: '重试状态整理', exact: true }).click()
    const retry = await retryRequest
    const retryBody = retry.postData() ?? ''
    expect(retryBody).toContain('browser-state-retry')
    const retryResponse = await retry.response()
    if (retryResponse === null) throw new Error('retryState response missing')
    const retryResponseBody = await retryResponse.text()
    expect(retryResponse.status(), retryResponseBody).toBe(200)
    expect(retryResponseBody, retryResponseBody).not.toContain('"ok":false')
    await expect.poll(async () => {
      const retryEvents = await repository.readEvents(conversation.id) ?? []
      const retryClaim = retryEvents.find(event => event.type === 'state-analysis' && event.sourceOperationId === operation)
      return retryClaim !== undefined && retryEvents.some(event => event.type === 'state-analysis'
        && event.operationId === retryClaim.operationId && ['completed', 'failed', 'stale'].includes(String(event.status)))
    }, { timeout: 30_000 }).toBe(true)
    expect(stateCalls()).toBe(stateCallsBefore + 1)
    expect(await page.locator('[data-roleplayer-kind="user-message"]').count()).toBe(usersBefore)
    expect(await page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]').count()).toBe(answersBefore)
    expect(retryBody).not.toMatch(/sessionId|tool[- ]?call/iu)
    const replay = await page.evaluate(async ({ path, body }) => {
      const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
      return { status: response.status, body: await response.text() }
    }, { path: new URL(retry.url()).pathname, body: retryBody })
    expect(replay.status, replay.body).toBe(200)
    expect(stateCalls()).toBe(stateCallsBefore + 1)
  })

  it('keeps malformed, ordinary, and cancelled late answers out of the product timeline', async () => {
    for (const text of ['普通文本失败', '格式错误']) {
      await page.getByRole('button', { name: '新建困惑' }).click()
      await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '王阳明', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '曾国藩', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '开始这份困惑', exact: true }).click()
      const blank = page.getByRole('button', { name: '未命名困惑' }).last()
      await blank.waitFor({ state: 'visible', timeout: 30_000 }); await blank.click()
      await page.getByRole('textbox', { name: '输入困惑' }).fill(text)
      await page.getByRole('button', { name: '发送' }).click()
      await page.locator('[data-roleplayer-status="failed"]').last().waitFor({ state: 'visible', timeout: 30_000 })
      expect(await page.locator('[data-roleplayer-view="true"]').textContent()).not.toContain('未校验的普通回答')
    }
    await page.getByRole('button', { name: '新建困惑' }).click()
    await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '王阳明', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '曾国藩', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '开始这份困惑', exact: true }).click()
    const blank = page.getByRole('button', { name: '未命名困惑' }).last()
    await blank.waitFor({ state: 'visible', timeout: 30_000 }); await blank.click()
    await page.getByRole('textbox', { name: '输入困惑' }).fill('取消测试')
    await page.getByRole('button', { name: '发送' }).click()
    await page.getByRole('button', { name: '取消', exact: true }).waitFor({ state: 'visible', timeout: 30_000 })
    await page.getByRole('button', { name: '取消', exact: true }).evaluate((element) => { (element as HTMLButtonElement).click() })
    await page.locator('[data-roleplayer-status="cancelled"]').last().waitFor({ state: 'visible', timeout: 30_000 })
    expect(await page.locator('[data-roleplayer-view="true"]').textContent()).not.toContain('迟到的回答')
  })

  it('requires local delete confirmation and preserves the projection when cancelled', async () => {
    await page.getByRole('button', { name: '新建困惑' }).click()
    await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '王阳明', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '曾国藩', exact: true }).click(); await page.getByRole('dialog', { name: '选择两位人物' }).getByRole('button', { name: '开始这份困惑', exact: true }).click()
    const blank = page.getByRole('button', { name: '未命名困惑' }).last()
    await blank.waitFor({ state: 'visible', timeout: 30_000 }); await blank.click()
    await page.getByRole('button', { name: '删除', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '确认删除' })
    await dialog.waitFor({ state: 'visible', timeout: 30_000 })
    await dialog.getByRole('button', { name: '取消' }).click()
    await page.getByRole('dialog', { name: '确认删除' }).waitFor({ state: 'detached', timeout: 30_000 })
    expect(await blank.count()).toBe(1)
    await page.getByRole('button', { name: '删除', exact: true }).click()
    const confirmedDialog = page.getByRole('dialog', { name: '确认删除' })
    await confirmedDialog.getByRole('button', { name: '确认删除' }).click()
    await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 })
    await page.getByRole('dialog', { name: '确认删除' }).waitFor({ state: 'detached', timeout: 30_000 })
  })


  it('keeps an ordinary Web browser surface free of product controls and persona sessions', async () => {
    expect(await ordinaryPage.locator('[data-roleplayer-view="true"]').count()).toBe(0)
    expect(await ordinaryPage.getByRole('textbox', { name: '输入困惑' }).count()).toBe(0)
    expect(ordinaryScaffold.ctx.agents.list()).toHaveLength(0)
    expect(ordinaryScaffold.ctx.sessions.list()).toHaveLength(0)
    expect(ordinaryScaffold.ctx.tools.schemas().map(tool => tool.name)).not.toEqual(expect.arrayContaining(['persona_turn_submit', 'evidence_lookup']))
  })

  it('shows an unavailable product root without mounting the generic composer when Remote is absent', async () => {
    expect(await unavailablePage.locator('[data-roleplayer-unavailable="true"]').count()).toBe(1)
    expect(await unavailablePage.locator('[data-roleplayer-unavailable="true"]').textContent()).toContain('困惑产品暂不可用')
    expect(await unavailablePage.locator('[data-roleplayer-view="true"]').count()).toBe(0)
    expect(await unavailablePage.getByRole('textbox', { name: '输入困惑' }).count()).toBe(0)
  })
})

it('keeps ordinary Web composition free of the product Host/client rows', () => {
  const rows = composeEntries([
    loadOverlayPatches('H2.6 ordinary profile', BASE_PATCH),
    loadOverlayPatches('H2.6 ordinary profile', WEB_PATCH),
  ])
  const names = rows.flatMap(row => typeof row.name === 'string' ? [row.name] : [])
  expect(names).not.toContain('@deepseek-ai/dsh-man-roleplayer')
  expect(names).not.toContain('@deepseek-ai/dsh-client-ui-man-roleplayer')
})
