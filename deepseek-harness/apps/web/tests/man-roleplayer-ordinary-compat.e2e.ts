/** C4: the ordinary Web profile stays independent from the product profile. */

import { createServer, type Server } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectFreshWorkspace, newEnglishPage } from './support.ts'

const ROOT = process.cwd()
const CLI = join(ROOT, 'apps/cli/lib/bin.js')

interface OrdinaryProviderRequest {
  readonly messages?: readonly { readonly role?: string; readonly content?: unknown }[]
  readonly tools?: readonly { readonly function?: { readonly name?: string } }[]
}

interface LauncherChild {
  readonly stdout?: { on: (event: 'data', listener: (chunk: Buffer) => void) => unknown }
  readonly stderr?: { on: (event: 'data', listener: (chunk: Buffer) => void) => unknown }
  readonly kill: (signal: 'SIGTERM') => unknown
  readonly catch: (handler: (error: unknown) => unknown) => Promise<unknown>
}

async function waitForUrl(child: LauncherChild): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => { reject(new Error(`ordinary web launcher did not print a URL; output: ${output}`)) }, 30_000)
    const inspect = (): void => {
      const match = /dsh web: (http:\/\/127\.0\.0\.1:\d+)/u.exec(output)
      if (match?.[1] !== undefined) { clearTimeout(timer); resolve(match[1]) }
    }
    child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString(); inspect() })
    child.stderr?.on('data', (chunk: Buffer) => { output += chunk.toString(); inspect() })
  })
}

async function ordinaryProvider(): Promise<{
  readonly server: Server
  readonly url: string
  readonly requests: OrdinaryProviderRequest[]
}> {
  const requests: OrdinaryProviderRequest[] = []
  const server = createServer((request, response) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => { body += chunk })
    request.on('end', () => {
      try { requests.push(JSON.parse(body) as OrdinaryProviderRequest) } catch { /* malformed provider input is outside this fixture */ }
      response.writeHead(200, { 'content-type': 'text/event-stream', connection: 'close' })
      response.end([
        'data: {"choices":[{"delta":{"role":"assistant","content":"ordinary fake provider answer"}}]}',
        'data: {"choices":[{"delta":{"content":""},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":4}}',
        'data: [DONE]',
        '',
      ].join('\n\n'))
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('ordinary fake provider did not bind a TCP port')
  return { server, url: `http://127.0.0.1:${address.port}`, requests }
}

async function currentPreset(page: Page): Promise<string | undefined> {
  return page.evaluate(async () => {
    const response = await fetch('/api/session.list', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'ordinary-preset-check', method: 'session.list', payload: {} }),
    })
    const body = await response.json() as { result?: { value?: { items?: readonly { agentPreset?: string }[] } } }
    return body.result?.value?.items?.at(-1)?.agentPreset
  })
}

describe('ordinary Web profile compatibility', () => {
  let home: string
  let browser: Browser
  let page: Page
  let child: LauncherChild
  let ordinaryPatch: string
  let provider: { readonly server: Server; readonly url: string; readonly requests: OrdinaryProviderRequest[] }

  beforeAll(async () => {
    home = await mkdtemp(join(tmpdir(), 'dsh-ordinary-profile-'))
    provider = await ordinaryProvider()
    ordinaryPatch = join(home, 'ordinary-browser-picker.patch.yml')
    await writeFile(ordinaryPatch, `- id: directory-picker
  disabled: true
- insert:
    - id: directory-picker-browse
      name: '@deepseek-ai/dsh-host-directory-picker-browse'
    - id: ui-directory-picker-browse
      name: '@deepseek-ai/dsh-client-ui-directory-picker-browse'
`)
    child = execa(process.execPath, [CLI, '--profile', 'web', '--patch', ordinaryPatch, '--no-open', '--port', '0'], {
      cwd: home,
      reject: false,
      env: {
        ...process.env,
        DSH_HOME: home,
        DSH_AGENTS_HOME: join(home, '.agents'),
        DEEPSEEK_API_KEY: 'ordinary-local-fake-key',
        DEEPSEEK_BASE_URL: provider.url,
      },
    })
    const url = await waitForUrl(child)
    browser = await chromium.launch({ executablePath: process.env.DSH_PLAYWRIGHT_EXECUTABLE_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
    page = await newEnglishPage(browser)
    await page.goto(url, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    const welcome = page.getByRole('dialog', { name: 'Internal Testing Notice' })
    await welcome.waitFor({ timeout: 15_000 })
    await welcome.getByRole('button', { name: 'Continue', exact: true }).click()
    await welcome.waitFor({ state: 'detached', timeout: 15_000 })
    await connectFreshWorkspace(page, home)
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    child?.kill('SIGTERM')
    await child?.catch(() => undefined)
    if (provider !== undefined) await new Promise<void>((resolve) => { provider.server.close(() => { resolve() }) })
    if (home !== undefined) await rm(home, { recursive: true, force: true })
  })

  it('uses ordinary preset precedence and completes a normal fake-provider turn without product capability', async () => {
    expect(await page.locator('[data-roleplayer-view="true"]').count()).toBe(0)
    expect(await page.locator('[data-roleplayer-unavailable="true"]').count()).toBe(0)

    const standard = page.getByRole('button', { name: 'Standard mode', exact: true })
    await standard.click()
    await page.getByRole('menuitem', { name: /Minimal mode/ }).click()
    await expect.poll(() => currentPreset(page), { timeout: 15_000 }).toBe('minimal')
    await page.getByRole('button', { name: 'Minimal mode', exact: true }).click()
    await page.getByRole('menuitem', { name: /^Standard mode/ }).first().click()
    await expect.poll(() => currentPreset(page), { timeout: 15_000 }).toBe('standard')

    const input = page.locator('textarea:enabled').last()
    await input.fill('ordinary profile compatibility')
    await input.press('Enter')
    await page.locator('p').filter({ hasText: 'ordinary fake provider answer' }).last().waitFor({ timeout: 60_000 })

    const body = await page.locator('body').textContent()
    expect(body).not.toContain('向古人问惑')
    expect(body).not.toContain('王阳明')
    expect(body).not.toContain('曾国藩')
    expect(await page.locator('[data-roleplayer-view="true"]').count()).toBe(0)
    const requestText = JSON.stringify(provider.requests)
    expect(requestText).not.toContain('persona_turn_submit')
    expect(requestText).not.toContain('evidence_lookup')
    expect(provider.requests.some(request => request.messages?.some(message => (
      typeof message.content === 'string' && message.content.includes('ordinary profile compatibility')
    )))).toBe(true)
  })
})
