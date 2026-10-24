/** H2.8 production browser gate: real profile launcher + system Chrome. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execa } from 'execa'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT = process.cwd(); const CLI = join(ROOT, 'apps/cli/lib/bin.js')
const PRESET_ROOT = fileURLToPath(new URL('../../../packages/extensions/man-roleplayer/presets/', import.meta.url))
const LLM_RUNTIME = pathToFileURL(join(ROOT, 'packages/llm/llm/lib/index.js')).href
const ACCEPTED = 'H28 accepted answer'
const fakeProvider = (runtime: string): string => `import { LlmAdapter } from ${JSON.stringify(runtime)}
class H28Fake extends LlmAdapter {
  providerInfo(provider) { return { id: provider, name: 'h28 fake' } }
  listModels(provider) { return Promise.resolve([{ provider, id: provider, name: provider }]) }
  resolveModel(provider, model) { return Promise.resolve({ provider, id: model, name: model }) }
  chunks(id, name, args) { const argumentsJson = JSON.stringify(args); return [{ type: 'block-start', index: 0, blockType: 'tool-call' }, { type: 'tool-call-delta', index: 0, id, name, argumentsDelta: argumentsJson.slice(0, 5) }, { type: 'tool-call-delta', index: 0, argumentsDelta: argumentsJson.slice(5) }, { type: 'block-end', index: 0, block: { type: 'tool-call', id, name, arguments: argumentsJson } }, { type: 'usage', usage: { inputTokens: 3, outputTokens: 4 } }, { type: 'finish', reason: { kind: 'tool-calls' } }] }
  async *stream(options) {
    const prompt = options.messages.flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('\\n')
    const hasChoiceResult = options.messages.some(message => message.content.some(block => block.type === 'tool-result'))
    const choice = prompt.includes('H28') || prompt.includes('选择')
    if (choice && !hasChoiceResult) {
      const multi = prompt.includes('H28多选')
      yield* this.chunks('h28-choice-' + Date.now(), 'ask_user_question', { questions: [{ id: 'direction', question: '下一步如何推进？', ...(multi ? { multi_select: true } : {}), options: [{ label: '继续探索' }, { label: '先暂停' }] }] })
      return
    }
    const text = ${JSON.stringify(ACCEPTED)}
    yield* this.chunks('h28-submit-' + Date.now(), 'persona_turn_submit', { segments: [{ text, kind: 'modern-inference', evidenceIds: [] }] })
  }
}
export const name = 'man-roles-mvp-web-h28-fake'; export const inject = ['llm']; export function apply(ctx) { ctx.effect(() => ctx.llm.registerAdapter(['h28-fake'], new H28Fake()), 'h28 fake') }
`

describe('H2.8 production man-roleplayer browser gate', () => {
  let home: string; let research: string; let browser: Browser; let page: Page
  let child: { stdout?: { on: (event: 'data', listener: (chunk: Buffer) => void) => unknown }; stderr?: { on: (event: 'data', listener: (chunk: Buffer) => void) => unknown }; kill: (signal: 'SIGTERM') => unknown; catch: (handler: (error: unknown) => unknown) => Promise<unknown> }
  const remoteCalls: { path: string; body: string }[] = []
  const browserDiagnostics: string[] = []
  beforeAll(async () => {
    home = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-h28-')); research = await mkdtemp(join(tmpdir(), 'dsh-man-roleplayer-h28-research-'))
    await writeFile(join(research, '调研成果-王阳明.md'), '> persona_id：`王阳明`\n### 【事迹卡 1】\n- **title**：材料\n- **full_text**：材料\n- **source**：《史料》\n'); await writeFile(join(research, '调研成果-曾国藩.md'), '> persona_id：`曾国藩`\n### 【事迹卡 1】\n- **title**：材料\n- **full_text**：材料\n- **source**：《史料》\n')
    const fake = join(home, 'h28-fake.mjs'); await writeFile(fake, fakeProvider(LLM_RUNTIME)); const patch = join(home, 'h28.patch.yml'); await writeFile(patch, `- insert:\n    - id: h28-fake\n      name: ${pathToFileURL(fake).href}\n`)
    child = execa(process.execPath, [CLI, '--profile', 'man-roles-mvp-web', '--patch', patch, '--no-open', '--port', '0'], { cwd: ROOT, reject: false, extendEnv: false, env: { DSH_HOME: home, DSH_MAN_ROLEPLAYER_PROVIDER: 'h28-fake', DSH_MAN_ROLEPLAYER_MODEL: 'h28-fake', DSH_MAN_ROLEPLAYER_WANG_PATH: join(research, '调研成果-王阳明.md'), DSH_MAN_ROLEPLAYER_ZENG_PATH: join(research, '调研成果-曾国藩.md'), DSH_MAN_ROLEPLAYER_PRESET_ROOT: PRESET_ROOT } }) as unknown as typeof child
    let output = ''; const url = await new Promise<string>((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`H2.8 launcher timeout: ${output}`)), 30_000); const inspect = (): void => { const match = /dsh web: (http:\/\/127\.0\.0\.1:\d+)/u.exec(output); if (match?.[1]) { clearTimeout(timer); resolve(match[1]) } }; child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString(); inspect() }); child.stderr?.on('data', (chunk: Buffer) => { output += chunk.toString(); inspect() }) })
    browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' }); page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); page.on('request', (request) => { if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/')) remoteCalls.push({ path: new URL(request.url()).pathname, body: request.postData() ?? '' }) }); page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') browserDiagnostics.push(`console ${message.type()}: ${message.text()}`) }); page.on('pageerror', (error) => { browserDiagnostics.push(`pageerror: ${error.message}`) }); await page.goto(url, { waitUntil: 'load' }); await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 })
  }, 90_000)
  afterAll(async () => { await browser?.close(); child?.kill('SIGTERM'); await child?.catch(() => undefined); if (research) await rm(research, { recursive: true, force: true }); if (home) await rm(home, { recursive: true, force: true }) })
  const createDilemma = async (): Promise<void> => {
    const before = remoteCalls.filter(call => call.path.endsWith('/manRoleplayerRemote/create')).length
    await page.getByRole('button', { name: '新建困惑', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '选择首位人物' })
    await dialog.getByRole('button', { name: '王阳明', exact: true }).click()
    await dialog.waitFor({ state: 'detached', timeout: 30_000 })
    await expect.poll(() => remoteCalls.filter(call => call.path.endsWith('/manRoleplayerRemote/create')).length).toBe(before + 1)
    await page.getByRole('textbox', { name: '输入困惑' }).waitFor({ timeout: 30_000 })
  }
  it('has one create entry, Escape cancels without Remote create, and selection focuses blank composer', async () => {
    const createCount = () => remoteCalls.filter(call => call.path.endsWith('/manRoleplayerRemote/create')).length
    expect(await page.getByRole('button', { name: '新建困惑', exact: true }).count()).toBe(1)
    await page.getByRole('button', { name: '新建困惑', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '选择首位人物' })
    expect(await dialog.getAttribute('aria-modal')).toBe('true')
    expect(await dialog.locator('h2').textContent()).toBe('选择首位人物')
    await dialog.getByRole('button', { name: '王阳明', exact: true }).waitFor()
    await expect.poll(async () => await page.evaluate(() => document.activeElement?.textContent)).toBe('王阳明')
    await page.keyboard.press('Shift+Tab')
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('取消')
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('王阳明')
    const before = createCount()
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached' })
    expect(createCount()).toBe(before)
    expect(await page.getByRole('button', { name: '新建困惑', exact: true }).evaluate(element => element === document.activeElement)).toBe(true)
    await page.getByRole('button', { name: '新建困惑', exact: true }).click()
    await page.getByRole('dialog', { name: '选择首位人物' }).getByRole('button', { name: '王阳明', exact: true }).click()
    await page.getByRole('button', { name: '未命名困惑', exact: true }).waitFor({ timeout: 30_000 })
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('输入困惑')
  })
  it('fits target viewports and opens/closes narrow status overlay without squeezing main', async () => {
    // 每个行为用例独立创建困惑，避免依赖前序用例共享的页面状态。
    await createDilemma()
    const viewports = [
      { width: 1440, height: 900 }, { width: 1280, height: 720 },
      { width: 1024, height: 768 }, { width: 390, height: 844 },
    ]
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      const layout = await page.evaluate(() => ({
        innerWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      }))
      expect(layout.documentScrollWidth <= layout.innerWidth && layout.bodyScrollWidth <= layout.innerWidth,
        `viewport ${viewport.width}x${viewport.height}: ${JSON.stringify(layout)}`).toBe(true)
      if (viewport.width <= 1024) {
        const mainWidth = await page.locator('main').evaluate(el => el.getBoundingClientRect().width)
        const button = page.getByRole('button', { name: '状态面板', exact: true })
        await button.click()
        await page.getByRole('button', { name: '关闭状态面板' }).waitFor()
        expect(await page.locator('main').evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(mainWidth * .9)
        await page.keyboard.press('Escape')
        await expect.poll(async () => await page.locator('aside').evaluate(el => ({
          open: el.classList.contains('mobileAsideOpen'), left: el.getBoundingClientRect().left, width: window.innerWidth,
        }))).toMatchObject({ open: false })
        await expect.poll(async () => await page.locator('aside').evaluate(el => ({
          closed: el.getBoundingClientRect().left >= window.innerWidth - 1,
        }))).toMatchObject({ closed: true })
        expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('状态面板')
      }
    }
  })
  it('keeps Shift+Enter as newline and submits exactly once with accepted provider output only', async () => {
    await createDilemma(); await page.setViewportSize({ width: 1440, height: 900 }); const input = page.getByRole('textbox', { name: '输入困惑' }); await input.fill('第一行'); await input.press('Shift+Enter'); expect(await input.inputValue()).toBe('第一行\n'); const before = await page.locator('[data-roleplayer-kind="user-message"]').count(); await input.press('Enter'); const answer = page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]').filter({ hasText: ACCEPTED }); await answer.waitFor({ timeout: 60_000 }); expect(await page.locator('[data-roleplayer-kind="user-message"]').count()).toBe(before + 1); expect(await answer.count()).toBe(1); expect(await answer.locator('[data-claim-status="accepted"]').count()).toBe(0); const body = await page.locator('[data-roleplayer-view="true"]').textContent(); expect(body).not.toContain('sessionId'); expect(body).not.toMatch(/tool[- ]?call/iu); expect(body).not.toContain('未校验')
  })
  it('archives read-only dilemma and restores it from archived group after refresh', async () => {
    // 归档必须覆盖已有时间线的恢复，不能只证明空困惑的状态切换。
    await createDilemma(); await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('textbox', { name: '输入困惑' }).fill('归档前回答')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]')
      .filter({ hasText: ACCEPTED }).waitFor({ timeout: 60_000 })
    await page.getByRole('button', { name: '归档', exact: true }).click()
    await page.getByRole('navigation', { name: '困惑列表' }).getByRole('button').filter({ hasText: '已归档' }).waitFor({ timeout: 30_000 })
    for (const name of ['重命名', '王阳明', '曾国藩', '输入困惑', '暂停讨论', '结束本阶段', '确认', '拒绝', '修改', '撤回', '质疑', '人工复核', '写入']) {
      const role = name === '输入困惑' ? 'textbox' : 'button'
      expect(await page.getByRole(role, { name, exact: true }).count(), `archived control must be absent: ${role} ${name}`).toBe(0)
    }
    expect(await page.getByRole('button', { name: /恢复困惑|恢复/ }).count()).toBe(1)
    expect(await page.getByRole('button', { name: /永久删除|删除/ }).count()).toBe(1)
    await page.reload({ waitUntil: 'load' })
    await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 })
    await page.getByRole('navigation', { name: '困惑列表' }).getByRole('button').filter({ hasText: '已归档' }).click()
    await page.getByRole('button', { name: /恢复困惑|恢复/ }).click()
    await page.getByRole('button', { name: '归档', exact: true }).waitFor({ timeout: 30_000 })
    await page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]')
      .filter({ hasText: ACCEPTED }).waitFor({ timeout: 30_000 })
    const body = await page.locator('[data-roleplayer-view="true"]').textContent(); expect(body).not.toContain('sessionId'); expect(body).not.toMatch(/tool[- ]?trace|tool[- ]?call/iu)
  })
  it('submits single-select immediately and keeps the product Remote body scoped', async () => {
    await createDilemma()
    await page.getByRole('textbox', { name: '输入困惑' }).fill('H28选择'); await page.getByRole('button', { name: '发送', exact: true }).click()
    const choice = page.getByRole('region', { name: '结构化选择' }); await choice.waitFor({ timeout: 30_000 }); await choice.getByRole('radio', { name: '继续探索' }).check(); await page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]').filter({ hasText: ACCEPTED }).last().waitFor({ timeout: 30_000 })
    const call = [...remoteCalls].reverse().find(item => item.path.endsWith('/answerChoice')); if (call === undefined) throw new Error('answerChoice Remote call missing')
    const body = JSON.parse(call.body) as { payload?: { args?: { request?: Record<string, unknown> } } }; expect(body.payload?.args?.request?.answers).toEqual([{ id: 'direction', selected: ['继续探索'] }]); expect(call.body).not.toMatch(/sessionId|tool[- ]?call/iu)
  })

  it('submits multi-select, custom input, and skips empty answers as product operations', async () => {
    for (const [prompt, action] of [['H28多选', 'multi'], ['H28自定义', 'custom'], ['H28跳过', 'skip']] as const) {
      await createDilemma(); await page.getByRole('textbox', { name: '输入困惑' }).fill(prompt); await page.getByRole('button', { name: '发送', exact: true }).click()
      const choice = page.getByRole('region', { name: '结构化选择' }); await expect.poll(async () => await choice.count(), { timeout: 30_000, message: `choice region for ${prompt}/${action}` }).toBe(1)
      if (action === 'multi') { await choice.getByRole('checkbox', { name: '继续探索' }).check(); await choice.getByRole('checkbox', { name: '先暂停' }).check(); await choice.getByRole('button', { name: '提交选择' }).click() }
      else if (action === 'custom') { const direction = choice.locator('fieldset').filter({ hasText: '下一步如何推进？' }); await direction.getByRole('button', { name: '我还有其他考虑' }).click(); await direction.getByRole('textbox', { name: '补充 direction' }).fill('补充考虑'); await choice.getByRole('button', { name: '提交选择' }).click() }
      else await choice.getByRole('button', { name: '跳过此问' }).click()
      await expect.poll(async () => await page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]').filter({ hasText: ACCEPTED }).count(), { timeout: 30_000, message: `accepted answer after ${prompt}/${action}` }).toBeGreaterThan(0)
      const call = [...remoteCalls].reverse().find(item => item.path.endsWith('/answerChoice')); if (call === undefined) throw new Error(`answerChoice Remote call missing for ${prompt}`); const body = JSON.parse(call.body) as { payload?: { args?: { request?: Record<string, unknown> } } }; const answers = body.payload?.args?.request?.answers as Array<{ id: string; selected: string[]; custom?: string }>; expect(answers).toEqual(action === 'multi' ? [{ id: 'direction', selected: ['继续探索', '先暂停'] }] : action === 'custom' ? [{ id: 'direction', selected: [], custom: '补充考虑' }] : [{ id: 'direction', selected: [] }]); expect(call.body).not.toMatch(/sessionId|tool[- ]?call/iu)
    }
  })

  it('cancels a pending structured question and restores the main composer', async () => {
    await createDilemma(); await page.getByRole('textbox', { name: '输入困惑' }).fill('H28取消'); await page.getByRole('button', { name: '发送', exact: true }).click()
    const choice = page.getByRole('region', { name: '结构化选择' }); await choice.waitFor({ timeout: 30_000 }); await choice.getByRole('button', { name: '取消提问' }).click(); await choice.waitFor({ state: 'detached', timeout: 30_000 }); await page.getByRole('textbox', { name: '输入困惑' }).waitFor(); await expect.poll(async () => await page.getByRole('button', { name: '发送', exact: true }).isDisabled(), { timeout: 30_000 }).toBe(false)
    const call = [...remoteCalls].reverse().find(item => item.path.endsWith('/cancelChoice')); if (call === undefined) throw new Error('cancelChoice Remote call missing'); expect(call.body).not.toMatch(/sessionId|tool[- ]?call/iu)
  })
  it('finishes the production browser flow without console warnings, errors, or page exceptions', async () => {
    expect(browserDiagnostics, browserDiagnostics.join('\n')).toEqual([])
    for (const call of remoteCalls.filter(call => call.path.startsWith('/api/manRoleplayerRemote/'))) {
      expect(call.body).not.toMatch(/sessionId|tool[- ]?call/iu)
    }
  })
})
