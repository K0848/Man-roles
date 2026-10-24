/** H3 browser gate: durable acknowledgement, independent drafts and safe wire. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execa } from 'execa'
import { chromium, type Browser, type ConsoleMessage, type Page, type Request } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT = process.cwd(); const CLI = join(ROOT, 'apps/cli/lib/bin.js'); const PRESET_ROOT = fileURLToPath(new URL('../../../packages/extensions/man-roleplayer/presets/', import.meta.url)); const LLM = pathToFileURL(join(ROOT, 'packages/llm/llm/lib/index.js')).href
const fake = (runtime: string): string => `import { LlmAdapter } from ${JSON.stringify(runtime)}
class H3Fake extends LlmAdapter { counter=0; looked=new Set(); providerInfo(provider){return {id:provider,name:'h3 fake'}} listModels(provider){return Promise.resolve([{provider,id:provider,name:provider}])} resolveModel(provider,model){return Promise.resolve({provider,id:model,name:model})} chunks(id,name,args,reasoning){const json=JSON.stringify(args); return [{type:'block-start',index:0,blockType:'reasoning'},{type:'reasoning-delta',index:0,text:reasoning},{type:'block-end',index:0,block:{type:'reasoning',text:reasoning}},{type:'block-start',index:1,blockType:'tool-call'},{type:'tool-call-delta',index:1,id,name,argumentsDelta:json.slice(0,5)},{type:'tool-call-delta',index:1,argumentsDelta:json.slice(5)},{type:'block-end',index:1,block:{type:'tool-call',id,name,arguments:json}},{type:'usage',usage:{inputTokens:3,outputTokens:4}},{type:'finish',reason:{kind:'tool-calls'}}]} async *stream(options){const text=options.messages.flatMap(m=>m.content).filter(b=>b.type==='text').map(b=>b.text).join('\\n'); await new Promise(r=>setTimeout(r,text.includes('H3慢')?5500:5)); if(options.purpose==='session-title'){yield {type:'text-delta',text:'H3标题'}; yield {type:'usage',usage:{inputTokens:1,outputTokens:1}}; yield {type:'finish',reason:{kind:'stop'}}; return} if(text.includes('H3选择')){const skip=options.messages.flatMap(m=>m.content).some(b=>b.type==='tool-result'&&b.content.some(c=>c.type==='text'&&c.text.includes('\"skipped\":true'))); if(skip){await new Promise(r=>setTimeout(r,1500));yield* this.chunks('h3-choice-submit','persona_turn_submit',{segments:[{text:'H3 explicit skip accepted',kind:'modern-inference',evidenceIds:[]}]},'尊重用户跳过');return} if(this.looked.has('choice'))throw new Error('explicit skip did not reach the model tool result');this.looked.add('choice');yield* this.chunks('h3-choice-ask','ask_user_question',{questions:[{id:'direction',question:'H3 下一步选择？',options:[{label:'继续探索'},{label:'先休息'}]}]},'等待补充偏好');return} if(text.includes('H3收口')&&!text.includes('上一条 assistant 文本只是未提交草稿')){yield {type:'block-start',index:0,blockType:'text'}; yield {type:'text-delta',index:0,text:'H3 private unsubmitted draft'}; yield {type:'block-end',index:0,block:{type:'text',text:'H3 private unsubmitted draft'}}; yield {type:'usage',usage:{inputTokens:1,outputTokens:1}}; yield {type:'finish',reason:{kind:'stop'}}; return} if(text.includes('H3收口')){const answer='H3 finalized answer'; yield* this.chunks('h3-finalized-'+(++this.counter),'persona_turn_submit',{segments:[{text:answer,kind:'modern-inference',evidenceIds:[]}]},'整理正式回答'); return} if(text.includes('H3失败')){yield {type:'block-start',index:0,blockType:'reasoning'}; yield {type:'reasoning-delta',index:0,text:'失败前仍在分析'}; yield {type:'block-end',index:0,block:{type:'reasoning',text:'失败前仍在分析'}}; yield {type:'block-start',index:1,blockType:'text'}; yield {type:'text-delta',index:1,text:'H3 failed unstructured answer'}; yield {type:'block-end',index:1,block:{type:'text',text:'H3 failed unstructured answer'}}; yield {type:'usage',usage:{inputTokens:1,outputTokens:1}}; yield {type:'finish',reason:{kind:'stop'}}; return} const slowKey=text.includes('H3慢 第二条')?'second':text.includes('H3慢 第一条')?'first':undefined; if(slowKey!==undefined&&!this.looked.has(slowKey)){this.looked.add(slowKey);yield* this.chunks('h3-evidence-'+slowKey,'evidence_lookup',{topic:'材料',requestedCount:1},'先查阅人物资料');return} const answer='H3 accepted answer'; const researched=slowKey!==undefined; yield* this.chunks('h3-submit-'+(++this.counter),'persona_turn_submit',{segments:[{text:answer,kind:researched?'historical-fact':'modern-inference',evidenceIds:researched?['wang-yangming:research:1']:[]}]},researched?'根据资料组织回答':'直接组织回答'); return} }
export const name='h3-fake'; export const inject=['llm']; export function apply(ctx){ctx.effect(()=>ctx.llm.registerAdapter(['h3-fake'],new H3Fake()),'h3 fake')}`

describe('H3 real product browser gate', () => {
  interface LauncherChild {
    readonly stdout?: { on: (event: 'data', listener: (chunk: Buffer) => void) => unknown }
    readonly stderr?: { on: (event: 'data', listener: (chunk: Buffer) => void) => unknown }
    readonly kill: (signal: 'SIGTERM') => unknown
    readonly catch: (handler: (error: unknown) => unknown) => Promise<unknown>
  }
  interface RemoteCall { readonly path: string; readonly body: string }
  let home: string
  let research: string
  let browser: Browser
  let page: Page
  let child: LauncherChild
  const calls: RemoteCall[] = []
  const diagnostics: string[] = []
  beforeAll(async () => {
    home = await mkdtemp(join(tmpdir(), 'dsh-h3-'))
    research = await mkdtemp(join(tmpdir(), 'dsh-h3-research-'))
    await writeFile(join(research, '调研成果-王阳明.md'), '> persona_id：`王阳明`\n### 【事迹卡 1】\n- **title**：材料\n- **full_text**：材料\n- **source**：《史料》\n')
    await writeFile(join(research, '调研成果-曾国藩.md'), '> persona_id：`曾国藩`\n### 【事迹卡 1】\n- **title**：材料\n- **full_text**：材料\n- **source**：《史料》\n')
    const providerFile = join(home, 'h3.mjs')
    await writeFile(providerFile, fake(LLM))
    const patch = join(home, 'h3.patch.yml')
    await writeFile(patch, `- insert:\n    - id: h3-fake\n      name: ${pathToFileURL(providerFile).href}\n`)
    child = execa(process.execPath,
      [CLI, '--profile', 'man-roles-mvp-web', '--patch', patch, '--no-open', '--port', '0'], {
        cwd: ROOT, reject: false, extendEnv: false,
        env: {
          DSH_HOME: home, DSH_MAN_ROLEPLAYER_PROVIDER: 'h3-fake', DSH_MAN_ROLEPLAYER_MODEL: 'h3-fake',
          DSH_MAN_ROLEPLAYER_WANG_PATH: join(research, '调研成果-王阳明.md'),
          DSH_MAN_ROLEPLAYER_ZENG_PATH: join(research, '调研成果-曾国藩.md'),
          DSH_MAN_ROLEPLAYER_PRESET_ROOT: PRESET_ROOT,
        },
      })
    let output = ''
    const url = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => { reject(new Error(output)) }, 30_000)
      const inspect = (): void => {
        const value = /dsh web: (http:\/\/127\.0\.0\.1:\d+)/u.exec(output)?.[1]
        if (value !== undefined) { clearTimeout(timer); resolve(value) }
      }
      child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString(); inspect() })
      child.stderr?.on('data', (chunk: Buffer) => { output += chunk.toString(); inspect() })
    })
    browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    page.on('request', (request: Request) => {
      const path = new URL(request.url()).pathname
      if (request.method() === 'POST' && path.startsWith('/api/')) calls.push({ path, body: request.postData() ?? '' })
    })
    page.on('console', (message: ConsoleMessage) => {
      if (['error', 'warning'].includes(message.type())) diagnostics.push(message.text())
    })
    page.on('pageerror', (error: Error) => { diagnostics.push(error.message) })
    await page.goto(url, { waitUntil: 'load' })
    await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 })
  }, 90_000)
  afterAll(async () => {
    await browser?.close()
    child?.kill('SIGTERM')
    await child?.catch(() => undefined)
    if (research) await rm(research, { recursive: true, force: true })
    if (home) await rm(home, { recursive: true, force: true })
  })
  const create = async (persona = '王阳明'): Promise<void> => {
    const before = calls.filter(call => call.path.endsWith('/manRoleplayerRemote/create')).length
    await page.getByRole('button', { name: '新建困惑', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '选择一位人物' })
    await dialog.getByRole('button', { name: `翻看${persona}人物卡`, exact: true }).click()
    expect(calls.filter(call => call.path.endsWith('/manRoleplayerRemote/create'))).toHaveLength(before)
    await dialog.getByRole('button', { name: `选择${persona}`, exact: true }).click()
    await dialog.getByRole('button', { name: '开始这份困惑', exact: true }).click()
    await dialog.waitFor({ state: 'detached', timeout: 30_000 })
    await expect.poll(() => calls.filter(call => call.path.endsWith('/manRoleplayerRemote/create')).length).toBe(before + 1)
    await page.getByRole('textbox', { name: '输入困惑' }).waitFor({ timeout: 30_000 })
  }
  it('binds real progress to each turn, keeps the answer visible, and restores the completed summary', async () => {
    await create()
    const input = page.getByRole('textbox', { name: '输入困惑' })
    await input.fill('H3慢 第一条')
    const submittedAt = Date.now()
    await page.getByRole('button', { name: '发送', exact: true }).click()
    const firstUser = page.locator('[data-roleplayer-kind="user-message"]').filter({ hasText: 'H3慢 第一条' })
    await firstUser.waitFor({ timeout: 2_000 })
    expect(Date.now() - submittedAt).toBeLessThan(500)
    const running = firstUser.locator('summary').filter({ hasText: '思考中 · 已用时' })
    await running.waitFor({ timeout: 2_000 })
    await firstUser.getByText('已接收问题', { exact: true }).waitFor({ timeout: 2_000 })
    const initialSeconds = Number((await running.innerText()).match(/(\d+) 秒/u)?.[1] ?? 0)
    await page.waitForTimeout(2_200)
    const advancedSeconds = Number((await running.innerText()).match(/(\d+) 秒/u)?.[1] ?? 0)
    expect(advancedSeconds).toBeGreaterThan(initialSeconds)
    const liveReasoningSummary = firstUser.getByText('思考过程', { exact: true }).locator('..')
    await liveReasoningSummary.waitFor({ timeout: 10_000 })
    const liveReasoning = liveReasoningSummary.locator('..')
    expect(await liveReasoning.evaluate(element => (element as HTMLDetailsElement).open)).toBe(false)
    expect(await liveReasoningSummary.innerText()).toContain('先查阅人物资料')
    expect(await firstUser.getByRole('button', { name: '取消', exact: true }).count()).toBe(0)
    expect(await page.getByRole('button', { name: '取消', exact: true }).count()).toBe(1)
    await expect.poll(() => input.inputValue()).toBe('')
    await input.fill('下一条草稿')
    await expect.poll(async () => await page.locator('[data-roleplayer-kind="persona-message"]').count(), { timeout: 30_000 }).toBe(1)
    const firstAnswer = page.locator('[data-roleplayer-kind="persona-message"]').first()
    await firstAnswer.waitFor({ state: 'visible' })
    expect(await firstAnswer.innerText()).toContain('H3 accepted answer')
    const firstActivity = firstAnswer.locator('details').first()
    const firstActivitySummary = firstActivity.locator(':scope > summary')
    await expect.poll(() => firstActivitySummary.innerText()).toMatch(/^本轮过程 · 用时 [1-9]\d* 秒 · 查阅 1 条资料$/u)
    const firstSummary = await firstActivitySummary.innerText()
    expect(firstSummary).toMatch(/^本轮过程 · 用时 [1-9]\d* 秒 · 查阅 1 条资料$/u)
    await firstActivity.locator(':scope > summary').click()
    for (const label of ['已接收问题', '正在思考/组织回答', '查阅资料', '核对回答依据', '回答结束']) {
      await firstActivity.getByText(label, { exact: true }).waitFor()
    }
    const completedReasoning = firstActivity.getByText('思考过程', { exact: true }).locator('..').locator('..')
    expect(await completedReasoning.evaluate(element => (element as HTMLDetailsElement).open)).toBe(false)
    await completedReasoning.locator(':scope > summary').click()
    expect(await completedReasoning.innerText()).toContain('根据资料组织回答')

    await input.fill('H3慢 第二条')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    const secondUser = page.locator('[data-roleplayer-kind="user-message"]').filter({ hasText: 'H3慢 第二条' })
    await secondUser.locator('summary').filter({ hasText: '思考中 · 已用时' }).waitFor({ timeout: 2_000 })
    await expect.poll(async () => await page.locator('[data-roleplayer-kind="persona-message"]').count(), { timeout: 30_000 }).toBe(2)
    const answers = page.locator('[data-roleplayer-kind="persona-message"]')
    expect(await answers.nth(0).locator('details').count()).toBe(2)
    expect(await answers.nth(1).locator('details').count()).toBe(2)
    expect(await page.locator('[data-roleplayer-timeline="true"] > details').count()).toBe(0)
    expect(await answers.nth(0).innerText()).toContain('H3 accepted answer')
    expect(await answers.nth(1).innerText()).toContain('H3 accepted answer')
    // 每次外部生成延迟超过默认停止时限；转录只保留界面中的确定性正文与终态。
    const transcript = await page.locator('[data-roleplayer-kind]').evaluateAll(elements => elements
      .filter(element => ['user-message', 'persona-message'].includes(element.getAttribute('data-roleplayer-kind') ?? ''))
      .map(element => ({
        kind: element.getAttribute('data-roleplayer-kind'),
        status: element.getAttribute('data-roleplayer-status'),
        text: element.textContent?.match(/H3慢 [第一二]+条|H3 accepted answer/u)?.[0],
      })))
    expect(transcript).toMatchInlineSnapshot(`
      [
        {
          "kind": "user-message",
          "status": "delivered",
          "text": "H3慢 第一条",
        },
        {
          "kind": "persona-message",
          "status": "completed",
          "text": "H3 accepted answer",
        },
        {
          "kind": "user-message",
          "status": "delivered",
          "text": "H3慢 第二条",
        },
        {
          "kind": "persona-message",
          "status": "completed",
          "text": "H3 accepted answer",
        },
      ]
    `)

    await page.reload({ waitUntil: 'load' })
    await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout: 30_000 })
    expect(await page.locator('[data-roleplayer-kind="persona-message"]').first().locator('details').first().locator(':scope > summary').innerText()).toBe(firstSummary)
    expect(await input.inputValue()).toBe('')
    expect(diagnostics).toEqual([])
  })
  it('preserves an unanswered choice and carries explicit skip through RPC and the model-visible transcript', async () => {
    await create()
    await page.getByRole('textbox', { name: '输入困惑' }).fill('H3选择')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    const card = page.getByRole('region', { name: '结构化选择' })
    await card.waitFor({ timeout: 30_000 })
    const responses: string[] = []
    page.on('response', async response => { if (response.url().endsWith('/manRoleplayerRemote/answerChoice')) responses.push(await response.text()) })
    const before = calls.filter(call => call.path.endsWith('/manRoleplayerRemote/answerChoice')).length
    await card.getByRole('button', { name: '提交选择', exact: true }).click()
    await card.getByRole('alert').waitFor()
    expect(await card.getByRole('alert').innerText()).toBe('请为每个问题选择至少一个选项，或填写其他考虑；也可以选择“跳过此问”。')
    expect(calls.filter(call => call.path.endsWith('/manRoleplayerRemote/answerChoice'))).toHaveLength(before)
    expect(await card.isVisible()).toBe(true)
    await card.getByRole('button', { name: '跳过此问', exact: true }).click()
    await card.waitFor({ state: 'detached', timeout: 10_000 }).catch(async error => { throw new Error(String(error) + '\n' + JSON.stringify({ responses, calls: calls.filter(call => call.path.endsWith('/manRoleplayerRemote/answerChoice')) }) + '\n' + await card.innerText()) })
    expect(await page.getByText('等待你选择', { exact: true }).count()).toBe(0)
    const answer = page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]').filter({ hasText: 'H3 explicit skip accepted' })
    await answer.waitFor({ timeout: 30_000 }).catch(async error => { throw new Error(String(error) + '\n' + JSON.stringify(responses) + '\n' + await page.locator('[data-roleplayer-view]').innerText()) })
    expect(await card.count()).toBe(0)
    const skipCall = calls.filter(call => call.path.endsWith('/manRoleplayerRemote/answerChoice')).at(-1)
    expect(skipCall?.body).toContain('"skipped":true')
    expect(calls.filter(call => call.path.endsWith('/manRoleplayerRemote/answerChoice'))).toHaveLength(before + 1)
    // 外部替身只有读到真实模型请求中的工具结果 skipped:true 才会提交此正文。
    const transcript = await page.locator('[data-roleplayer-kind]').evaluateAll(elements => elements
      .filter(element => ['user-message', 'choice-answer', 'persona-message'].includes(element.getAttribute('data-roleplayer-kind') ?? ''))
      .map(element => ({
        kind: element.getAttribute('data-roleplayer-kind'),
        status: element.getAttribute('data-roleplayer-status'),
        text: element.textContent?.match(/H3选择|已记录选择|H3 explicit skip accepted/u)?.[0],
      })))
    expect(transcript).toMatchInlineSnapshot(`
      [
        {
          "kind": "user-message",
          "status": "delivered",
          "text": "H3选择",
        },
        {
          "kind": "choice-answer",
          "status": "completed",
          "text": "已记录选择",
        },
        {
          "kind": "persona-message",
          "status": "completed",
          "text": "H3 explicit skip accepted",
        },
      ]
    `)
    expect(diagnostics).toEqual([])
  })
  it('isolates two dilemma drafts and excludes internal wire fields',async()=>{await create(); const a=page.getByRole('textbox',{ name:'输入困惑' }); await a.fill('A草稿'); await page.getByRole('button',{ name:'重命名',exact:true }).click(); await page.getByRole('textbox',{ name:'困惑标题' }).fill('H3-A'); await page.getByRole('button',{ name:'保存标题',exact:true }).click(); await create('曾国藩'); const b=page.getByRole('textbox',{ name:'输入困惑' }); await b.fill('B草稿'); await page.getByRole('button',{ name:'重命名',exact:true }).click(); await page.getByRole('textbox',{ name:'困惑标题' }).fill('H3-B'); await page.getByRole('button',{ name:'保存标题',exact:true }).click(); await page.getByRole('button',{ name:'H3-A',exact:true }).click(); expect(await page.getByRole('textbox',{ name:'输入困惑' }).inputValue()).toBe('A草稿'); await page.getByRole('button',{ name:'H3-B',exact:true }).click(); expect(await page.getByRole('textbox',{ name:'输入困惑' }).inputValue()).toBe('B草稿'); expect(await page.locator('[data-roleplayer-view="true"]').textContent()).not.toMatch(/sessionId|tool[- ]?call|prompt|api[-_ ]?key/iu); for(const c of calls)expect(c.body).not.toMatch(/sessionId|tool[- ]?call|prompt|api[-_ ]?key/iu)})
  it('finalizes one private ordinary draft without exposing or duplicating it',async()=>{await create(); const input=page.getByRole('textbox',{ name:'输入困惑' }); await input.fill('H3收口'); await page.getByRole('button',{ name:'发送',exact:true }).click(); const answer=page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]').filter({ hasText:'H3 finalized answer' }); await answer.waitFor({ timeout:30000 }); expect(await page.locator('[data-roleplayer-kind="user-message"]').filter({ hasText:'H3收口' }).count()).toBe(1); expect(await page.locator('[data-roleplayer-view="true"]').textContent()).not.toContain('H3 private unsubmitted draft'); const activity=answer.locator('details').first(); await activity.locator(':scope > summary').click(); await activity.getByText('正在整理正式回答',{ exact:true }).waitFor(); expect(await page.locator('[data-roleplayer-status="failed"]').filter({ hasText:'回答失败，请重试' }).count()).toBe(0); expect(diagnostics).toEqual([])})
  it('keeps failed answer state and its folded reasoning through reload without accepting unstructured text',async()=>{await create(); await page.getByRole('button',{ name:'重命名',exact:true }).click(); await page.getByRole('textbox',{ name:'困惑标题' }).fill('H3-失败恢复'); await page.getByRole('button',{ name:'保存标题',exact:true }).click(); const input=page.getByRole('textbox',{ name:'输入困惑' }); await input.fill('H3失败'); await page.getByRole('button',{ name:'发送',exact:true }).click(); const failed=page.locator('[data-roleplayer-status="failed"]').filter({ hasText:'回答失败，请重试' }); await failed.waitFor({ timeout:30000 }); expect(await page.locator('[data-roleplayer-kind="persona-message"][data-roleplayer-status="completed"]').count()).toBe(0); expect(await page.getByRole('button',{ name:'取消',exact:true }).count()).toBe(0); const failedUser=page.locator('[data-roleplayer-kind="user-message"]').filter({ hasText:'H3失败' }); const failedActivity=failedUser.locator('details').first(); await failedActivity.locator(':scope > summary').click(); const failedReasoning=failedUser.getByText('思考过程 · 未完成',{ exact:true }).locator('..').locator('..'); expect(await failedReasoning.evaluate(element=>(element as HTMLDetailsElement).open)).toBe(false); await failedReasoning.locator(':scope > summary').click(); expect(await failedReasoning.innerText()).toContain('失败前仍在分析'); await page.reload({ waitUntil:'load' }); await page.locator('[data-roleplayer-view="true"]').waitFor({ timeout:30000 }); await page.getByRole('button',{ name:'H3-失败恢复',exact:true }).click(); const restoredFailedUser=page.locator('[data-roleplayer-kind="user-message"]').filter({ hasText:'H3失败' }); await restoredFailedUser.locator('details').first().locator(':scope > summary').click(); await restoredFailedUser.getByText('思考过程 · 未完成',{ exact:true }).waitFor(); expect(diagnostics).toEqual([])})
})
