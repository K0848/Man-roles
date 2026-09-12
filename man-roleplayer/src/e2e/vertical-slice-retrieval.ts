/**
 * man-roles-roleplayer —— 阶段 6 真实模型端到端垂直切片（检索/围栏/出处校验/黑名单）。
 *
 * 由插件 apply 在 `MAN_ROLES_RP_E2E=retrieval` 时调用（专用无 runner profile
 * man-roles-rp-e2e，与阶段 5 真实链路同 profile）。覆盖 task_plan 阶段 6 验收：
 *  1. 内容入库完整性（55 事迹实体卡 + 38 语录 + 14 黑名单；❌ 只进黑名单）；
 *  2. 演员生成时自主 tool-call `retrieve_anecdotes`（真实模型，DSH tools 原生映射），
 *     确定性检索返回本人物事迹 top-k（围栏化：不含他人事迹）；
 *  3. 演员引用真实出处 → 回落库内校验通过；确定性断言「引不存在的出处」被拒、
 *     「引黑名单语录」被拒、伪托书被拒、围栏化（取不到他人事迹）；
 *  4. token 真实记录，单链路在预算内（默认 2 万）。
 *
 * 单测一律 mock 模型；本文件只在显式 E2E 模式下消耗真实 API。analyze_dilemma
 * 保持导演职责（阶段 5 已实现，本阶段不动）。
 */
import type { Context } from '@deepseek-ai/cordis'
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { DshLlmClient, LlmCallError } from '../llm/dsh-client.ts'
import { personaSpecFor } from '../context/personas-data.ts'
import {
  ANECDOTE_COUNTS,
  BLACKLIST_COUNTS,
  QUOTE_COUNTS,
  CONTENT_VERSION,
  assertContentIntegrity,
  buildContentLibraries,
} from '../retrieval/index.ts'
import { retrieveAnecdotes, fetchAnecdote } from '../retrieval/index.ts'
import { runActorTurnWithRetrieval } from '../retrieval/tools.ts'
import { verifyCitation, verifyReference, checkBlacklist, extractCitedSources } from '../retrieval/verify.ts'
import type { LlmClient, LlmRequest, LlmResponse } from '../llm/client.ts'

const TAG = '[man-roles-roleplayer:e2e-retrieval]'

/** E2E 固定 conversation id（与阶段 5 隔离，独立证据文件）。 */
const CONVERSATION_ID = 'conversation-retrieval-e2e'

/** token 预算（task_plan：约 2 万上限；超出即停）。 */
const TOKEN_BUDGET = 20000

/** 王阳明回合用户原话（引导演员以史实支撑回答，触发 tool-call 检索）。 */
const USER_RAW_WANG = '我既想坚持理想主义，又觉得现实处处碰壁，不知如何自处。你当年龙场那般绝境，是如何在事上磨过来的？'

/** 曾国藩回合用户原话（引导演员以史实支撑回答）。 */
const USER_RAW_ZENG = '我做事总想一步到位，稍遇挫折就自责不已，又怕自己只是空谈努力。你靖港、湖口连番大败时，是靠什么撑过来的？'

/** 追加到 persona systemPrompt 之后的工具使用指令（仅 e2e 注入，不改 persona 成品）。 */
function toolInstruction(): string {
  return ''
    + '【工具使用】需要史实支撑时，请先调用 retrieve_anecdotes 检索本人物事迹（可用 fetch_anecdote 取原文）。'
    + '引用事迹或原话必须标注库内真实出处（书名·篇章），不得虚构出处，不得引用他人事迹。'
}

function evidenceDir(): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'man-roles', 'e2e')
}

/** 记账模型客户端：记录每次调用（含工具循环各轮）的 token/文本；预算控制。 */
class LedgerLlmClient implements LlmClient {
  readonly calls: Array<{
    seq: number
    stage: string
    provider: string
    model: string
    inputTokens: number
    outputTokens: number
    finishReason: string
    text: string
  }> = []
  private nextSeq = 1

  constructor(private readonly inner: LlmClient) {}

  mark(stage: string): void {
    if (this.calls.length === 0) return
    this.calls[this.calls.length - 1].stage = stage
  }

  get totalTokens(): number {
    return this.calls.reduce((sum, c) => sum + c.inputTokens + c.outputTokens, 0)
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const resp = await this.inner.complete(request)
    this.calls.push({
      seq: this.nextSeq++,
      stage: '?',
      provider: resp.provider,
      model: resp.model,
      inputTokens: resp.usage.inputTokens,
      outputTokens: resp.usage.outputTokens,
      finishReason: resp.finishReason,
      text: resp.text,
    })
    return resp
  }
}

/** 启动竞态重试包装：仅对 MISSING_CREDENTIAL / NO_ADAPTER（网络前失败，零 token 成本）重试。 */
class StartupRetryLlmClient implements LlmClient {
  constructor(private readonly inner: LlmClient, private readonly attempts = 30, private readonly delayMs = 500) {}

  async complete(request: LlmRequest): Promise<LlmResponse> {
    let lastError: unknown
    for (let attempt = 1; attempt <= this.attempts; attempt++) {
      try {
        return await this.inner.complete(request)
      } catch (error) {
        lastError = error
        if (error instanceof LlmCallError
          && (error.failureCode === 'MISSING_CREDENTIAL' || error.failureCode === 'NO_ADAPTER')) {
          console.log(`${TAG} 启动竞态: ${error.failureCode}（第 ${attempt}/${this.attempts} 次尝试），`
            + `等待 ${this.delayMs}ms 后重试（无网络调用，零 token 成本）`)
          await new Promise((resolve) => setTimeout(resolve, this.delayMs))
          continue
        }
        throw error
      }
    }
    throw lastError
  }
}

function assertBudget(ledger: LedgerLlmClient): void {
  const total = ledger.totalTokens
  console.log(`${TAG} token 台账: 累计=${total}/${TOKEN_BUDGET}`
    + ` (${total > TOKEN_BUDGET ? '❌ 超预算' : '✅ 预算内'})`)
  if (total > TOKEN_BUDGET) {
    throw new Error(`阶段6 token 预算超限：${total} > ${TOKEN_BUDGET}，停止后续模型调用`)
  }
}

function check(ok: boolean, label: string): void {
  console.log(`${TAG} ${ok ? '✅' : '❌'} ${label}`)
  if (!ok) throw new Error(`阶段6 e2e 断言失败: ${label}`)
}

/** 确定性断言（不调模型）：入库完整性 + 检索/围栏 + 出处回落 + 黑名单拦截。 */
function runDeterministicAsserts(libs: ReturnType<typeof buildContentLibraries>): void {
  console.log(`${TAG} 内容库完整性（assertContentIntegrity 通过 = 红线校验通过）`)
  assertContentIntegrity()
  check(ANECDOTE_COUNTS['wang-yangming'] === 20 && ANECDOTE_COUNTS['zeng-guofan'] === 35, `事迹条数 王阳明=${ANECDOTE_COUNTS['wang-yangming']} 曾国藩=${ANECDOTE_COUNTS['zeng-guofan']}（合计 ${ANECDOTE_COUNTS['wang-yangming'] + ANECDOTE_COUNTS['zeng-guofan']} 实体卡）`)
  check(QUOTE_COUNTS['wang-yangming'] === 16 && QUOTE_COUNTS['zeng-guofan'] === 22, `语录条数 王阳明=${QUOTE_COUNTS['wang-yangming']} 曾国藩=${QUOTE_COUNTS['zeng-guofan']}`)
  check(BLACKLIST_COUNTS['wang-yangming'] >= 4 && BLACKLIST_COUNTS['zeng-guofan'] >= 10, `黑名单条数 王阳明=${BLACKLIST_COUNTS['wang-yangming']} 曾国藩=${BLACKLIST_COUNTS['zeng-guofan']}`)

  // 检索匹配正确性（theme/keywords 确定性匹配）
  const wangShiShangMo = retrieveAnecdotes('事上磨 静亦定 动亦定', 'wang-yangming', libs, 3)
  check(wangShiShangMo.some((a) => a.id === 'wang-yangming-12'), `检索「事上磨」命中事迹卡12（人须在事上磨）`)
  const wangLungChang = retrieveAnecdotes('逆境 挫折 龙场', 'wang-yangming', libs, 3)
  check(wangLungChang.some((a) => a.id === 'wang-yangming-02'), `检索「逆境 龙场」命中事迹卡2（龙场悟道）`)
  const zengJingGang = retrieveAnecdotes('靖港 大败 自尽', 'zeng-guofan', libs, 3)
  check(zengJingGang.some((a) => a.id === 'zeng-guofan-02'), `检索「靖港」命中曾国藩事迹卡2（靖港之败）`)
  check(retrieveAnecdotes('量子力学 星际航行', 'wang-yangming', libs, 3).length === 0, '无关查询返回空（降级路径：不上网、不编）')

  // 围栏化断言：王阳明语境只能取王阳明事迹，曾国藩语境只能取曾国藩事迹
  const fenceWang = retrieveAnecdotes('知行合一 修养 用人', 'wang-yangming', libs, 5)
  check(fenceWang.length > 0 && fenceWang.every((a) => a.id.startsWith('wang-yangming-')), '围栏：王阳明检索结果全部为王阳明事迹')
  const fenceZeng = retrieveAnecdotes('知行合一 修养 用人', 'zeng-guofan', libs, 5)
  check(fenceZeng.length > 0 && fenceZeng.every((a) => a.id.startsWith('zeng-guofan-')), '围栏：曾国藩检索结果全部为曾国藩事迹')
  check(fetchAnecdote('wang-yangming-12', 'zeng-guofan', libs) === undefined, '围栏：曾国藩语境取不到王阳明事迹原文（fetchAnecdote 返回 undefined）')
  check(fetchAnecdote('zeng-guofan-02', 'wang-yangming', libs) === undefined, '围栏：王阳明语境取不到曾国藩事迹原文（fetchAnecdote 返回 undefined）')
  check(fetchAnecdote('wang-yangming-12', 'wang-yangming', libs)?.fullText.includes('人须在事上磨'), '王阳明语境可取到本人事迹原文（含逐字 fullText）')

  // 出处回落校验
  check(verifyCitation('《传习录》卷上·陆澄录', 'wang-yangming', libs).ok, '出处回落：引用《传习录》卷上·陆澄录 通过')
  check(verifyCitation('《清史稿》卷405《曾国藩传》', 'zeng-guofan', libs).ok, '出处回落：引用《清史稿》卷405《曾国藩传》 通过')
  const fake = verifyCitation('《资治通鉴》卷一百九十五', 'wang-yangming', libs)
  check(!fake.ok && fake.violations.some((v) => v.code === 'unknown-source'), '出处回落：引用不存在的《资治通鉴》被拒（unknown-source）')
  const forged = verifyCitation('《冰鉴》相人术', 'zeng-guofan', libs)
  check(!forged.ok && forged.violations.some((v) => v.code === 'forged-book-source'), '出处回落：引用伪托书《冰鉴》被拒（forged-book-source）')

  // 黑名单拦截
  check(checkBlacklist('我此心不动，随机而动，任他风雨。', 'wang-yangming', libs, 'actor-reply') !== undefined, '黑名单：王阳明回答引用「此心不动，随机而动」被拦截')
  check(checkBlacklist('吾心即是宇宙，宇宙便是吾心，此乃心学真谛。', 'wang-yangming', libs, 'actor-reply') !== undefined, '黑名单：张冠李戴「吾心即宇宙」（陆九渊语）被拦截')
  check(checkBlacklist('我唯有结硬寨，打呆仗。', 'zeng-guofan', libs, 'actor-reply') !== undefined, '黑名单：曾国藩回答引用「结硬寨，打呆仗」被拦截')
  check(checkBlacklist('轻财足以聚人，律己足以服人。', 'zeng-guofan', libs, 'actor-reply') !== undefined, '黑名单：《格言联璧》误归曾国藩句被拦截')
  const firstPerson = checkBlacklist('事功本于学问，善以礼运。', 'zeng-guofan', libs, 'actor-reply')
  check(firstPerson !== undefined && firstPerson.mode === 'first-person', '黑名单：史臣评价以第一人称说出被拦截（forbidden-first-person）')
  check(checkBlacklist('事功本于学问，善以礼运。', 'zeng-guofan', libs, 'any') === undefined, '史臣评价在非第一人称语境（历史坐标/旁白）不拦截')

  // 出处 + 文本联合校验
  const okRef = verifyReference({ source: '《传习录》卷上·陆澄录', text: '人须在事上磨，方立得住。' }, 'wang-yangming', libs)
  check(okRef.ok, '联合校验：真实出处 + 干净文本 通过')
  const badRef = verifyReference({ source: '《资治通鉴》', text: '我此心不动，随机而动。' }, 'wang-yangming', libs)
  check(!badRef.ok && badRef.violations.some((v) => v.code === 'unknown-source') && badRef.violations.some((v) => v.code === 'blacklisted-quote'), '联合校验：假出处 + 黑名单语录 双违规')
}

/** 真实演员回合：携带工具让演员 tool-call 检索本人物事迹，回答引用真实出处。 */
async function runActorTurn(
  llm: LedgerLlmClient,
  personaName: 'wang-yangming' | 'zeng-guofan',
  userRaw: string,
  stageLabel: string,
  libs: ReturnType<typeof buildContentLibraries>,
): Promise<{ reply: string; retrievedPersonaIds: string[]; citedSources: string[] }> {
  const persona = personaSpecFor(personaName)
  const system = `${persona.systemPrompt}\n\n${toolInstruction()}`
  console.log(`${TAG} ${stageLabel}: 演员回合开始 persona=${personaName}（system 含红线两节 + 工具使用指令）`)

  const turn = await runActorTurnWithRetrieval(llm, {
    system,
    messages: [{ role: 'user', content: userRaw }],
    reasoningEffort: 'off',
    maxTokens: 1024,
  }, libs, personaName)
  llm.mark(`${stageLabel}-actor`)

  // 围栏断言：轨迹中所有检索结果的 personaId 都是当前人物
  const retrievedPersonaIds: string[] = []
  for (const entry of turn.trail) {
    try {
      const payload = JSON.parse(entry.result) as { personaId?: string; items?: Array<{ id: string }> }
      if (payload.personaId !== undefined) retrievedPersonaIds.push(payload.personaId)
      if (Array.isArray(payload.items)) {
        for (const item of payload.items) {
          const full = fetchAnecdote(item.id, personaName, libs)
          if (full === undefined) {
            check(false, `${stageLabel} 围栏：轨迹中事迹 id ${item.id} 不属于当前人物 ${personaName}`)
          }
        }
      }
    } catch {
      // 错误结果（如围栏拦截）不算检索 payload
    }
  }
  check(turn.trail.length > 0, `${stageLabel}: 演员自主 tool-call 检索（轨迹 ${turn.trail.length} 条: ${turn.trail.map((t) => t.name).join(', ')})`)
  check(retrievedPersonaIds.every((p) => p === personaName), `${stageLabel}: 围栏断言 检索结果全部为 ${personaName}（实际 ${JSON.stringify(retrievedPersonaIds)}）`)

  // 引用出处回落校验：回答中所有《...》引用必须回落库内
  const citedSources = extractCitedSources(turn.reply)
  console.log(`${TAG} ${stageLabel}: 演员回答=${JSON.stringify(turn.reply.slice(0, 120))}… 引用出处=${JSON.stringify(citedSources)}`)
  if (citedSources.length > 0) {
    for (const source of citedSources) {
      const result = verifyCitation(source, personaName, libs)
      check(result.ok, `${stageLabel}: 引用「${source}」回落库内通过（违规=${JSON.stringify(result.violations)}）`)
    }
  } else {
    console.log(`${TAG} ${stageLabel}: ⚠️ 演员回答未提取到《》出处（引用缺失，仅记录不判定失败；红线两节仍由 system 约束）`)
  }
  // 回答文本黑名单拦截（演员第一人称语境）
  const blackHit = checkBlacklist(turn.reply, personaName, libs, 'actor-reply')
  check(blackHit === undefined, `${stageLabel}: 回答文本未命中黑名单${blackHit === undefined ? '' : `（命中「${blackHit.text}」）`}`)

  console.log(`${TAG} ${stageLabel}: 演员回合完成 reply=${JSON.stringify(turn.reply.slice(0, 40))}… truncated=${turn.truncated}`)
  return { reply: turn.reply, retrievedPersonaIds, citedSources }
}

/** 写观察证据 JSONL（每行一次模型调用 + 末尾汇总；无 BOM UTF-8）。 */
function writeEvidence(ledger: LedgerLlmClient, summary: Record<string, unknown>): string {
  const dir = evidenceDir()
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${CONVERSATION_ID}.jsonl`)
  try {
    writeFileSync(file, '', { encoding: 'utf8' })
    for (const call of ledger.calls) {
      appendFileSync(file, `${JSON.stringify(call)}\n`, { encoding: 'utf8' })
    }
    appendFileSync(file, `${JSON.stringify({ type: 'summary', totalTokens: ledger.totalTokens, ...summary })}\n`, { encoding: 'utf8' })
    console.log(`${TAG} 观察证据已写入 ${file} (${ledger.calls.length} 次调用 + 1 行汇总)`)
    return file
  } catch (error) {
    console.error(`${TAG} 观察证据写入失败`, error)
    return ''
  }
}

/**
 * 阶段 6 真实模型垂直切片入口：内容完整性 + 确定性断言（零模型）+ 双人物
 * 真实演员 tool-call 回合 + 出处回落/黑名单/围栏断言 + token 台账 + 观察证据。
 * 完成后显式 appExit(0) 优雅退出（无 runner profile）。
 * @param ctx - cordis 上下文（提供 llm / appExit）。
 */
export async function runRetrievalSlice(ctx: Context): Promise<void> {
  const libs = buildContentLibraries()
  const ledger = new LedgerLlmClient(new StartupRetryLlmClient(new DshLlmClient({ stream: (options) => ctx.llm.stream(options) })))
  console.log(`${TAG} 阶段6 e2e 开始 conversation=${CONVERSATION_ID} contentVersion=${CONTENT_VERSION}`
    + ` token 预算=${TOKEN_BUDGET}（模型客户端=DshLlmClient(ctx.llm.stream)）`)

  // ── 阶段0：确定性断言（不调模型；入库/检索/围栏/出处/黑名单）──────────
  runDeterministicAsserts(libs)

  // ── 阶段1：王阳明真实演员回合（tool-call 检索本人物事迹 + 引用真实出处）──
  const wang = await runActorTurn(ledger, 'wang-yangming', USER_RAW_WANG, '阶段1', libs)
  assertBudget(ledger)

  // ── 阶段2：曾国藩真实演员回合 ──────────────────────────────────────
  const zeng = await runActorTurn(ledger, 'zeng-guofan', USER_RAW_ZENG, '阶段2', libs)
  assertBudget(ledger)

  // ── 阶段3：汇总 + 观察证据 ─────────────────────────────────────────
  for (const call of ledger.calls) {
    console.log(`${TAG} 调用台账 seq${call.seq} [${call.stage}] provider=${call.provider} model=${call.model}`
      + ` in=${call.inputTokens} out=${call.outputTokens} finish=${call.finishReason}`
      + ` text=${JSON.stringify(call.text.slice(0, 32))}…`)
  }
  assertBudget(ledger)
  const evidenceFile = writeEvidence(ledger, {
    conversationId: CONVERSATION_ID,
    contentVersion: CONTENT_VERSION,
    budget: TOKEN_BUDGET,
    anecdotes: ANECDOTE_COUNTS,
    quotes: QUOTE_COUNTS,
    blacklist: BLACKLIST_COUNTS,
    actorTurns: {
      wang: { userRaw: USER_RAW_WANG, citedSources: wang.citedSources, retrievedPersonaIds: wang.retrievedPersonaIds },
      zeng: { userRaw: USER_RAW_ZENG, citedSources: zeng.citedSources, retrievedPersonaIds: zeng.retrievedPersonaIds },
    },
    deterministicAsserts: 'all-passed',
  })
  console.log(`${TAG} 结论: 阶段6 真实模型检索链路完成 ✅ 模型调用=${ledger.calls.length} 次`
    + ` 累计 token=${ledger.totalTokens} 预算=${TOKEN_BUDGET}`
    + ` 证据=${evidenceFile || '(写入失败)'}`)

  const appExit = ctx.get('appExit')
  if (typeof appExit === 'function') {
    console.log(`${TAG} 请求优雅退出（appExit(0)）…`)
    appExit(0)
  }
}
