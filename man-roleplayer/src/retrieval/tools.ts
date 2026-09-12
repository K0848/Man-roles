/**
 * man-roles-roleplayer —— 演员 tool-call 工具（检索/取原文，纯 TS 可单测）。
 *
 * 阶段 6：把 `retrieve_anecdotes` / `fetch_anecdote` 注册为演员生成时的
 * DSH tool（架构 §2.3 阶段 3 / §4 工具清单；v1.2 决策：检索由演员自主 tool-call，
 * analyze_dilemma 保持导演职责不动）。
 *
 * 机制：工具 JSON Schema（ToolSchema）随 GenerateOptions.tools 发给 provider
 * （llm-deepseek 适配器原生映射 tools 字段）；模型发出 tool-call block 后由
 * runToolLoop（llm/client.ts）执行本模块的处理器——处理器是确定性代码：
 *  - 围栏：只返回当前人物事迹（结构性隔离，演员不可绕过）；
 *  - 预算：top-k 上限 5、结果文本有长度上限（token 成本受控）；
 *  - 出处：summary 携带 source，演员引用后由 verify.ts 回落库内校验。
 */
import { runToolLoop } from '../llm/client.ts'
import type { LlmClient, LlmRequest, LlmResponse, ToolSchema, ToolTrailEntry } from '../llm/client.ts'
import type { PersonaId } from '../domain/schema.ts'
import { retrieveAnecdotes, fetchAnecdote } from './retrieve.ts'
import { fetchQuote } from './retrieve.ts'
import type { ContentLibraries } from './retrieve.ts'
import { EvidenceLedger } from '../evidence/ledger.ts'

/** retrieve_anecdotes 工具 schema（演员生成时 tool-call）。 */
export const RETRIEVE_ANECDOTES_TOOL: ToolSchema = {
  name: 'retrieve_anecdotes',
  description:
    '按困惑/主题关键词检索【当前人物】的事迹库，返回本人物相关事迹 top-k 的标题、主题、摘要与真实出处（书名·篇章）。'
    + '需要史实支撑时调用；只返回当前人物的事迹（围栏化），绝不含其他人物内容。'
    + '检索命中后，引用事迹/原话时必须标注其真实出处，且不得虚构出处。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '困惑/主题关键词，如「事上磨 知行合一」「逆境 挫折」「用人」等',
      },
      topK: {
        type: 'number',
        description: '最多返回条数（默认 3，上限 5）',
      },
    },
    required: ['query'],
  },
}

/** fetch_anecdote 工具 schema（演员取本人物事迹原文，可展开查看原文）。 */
export const FETCH_ANECDOTE_TOOL: ToolSchema = {
  name: 'fetch_anecdote',
  description:
    '按 id 取【当前人物】一条事迹的原文全文（full_text）与出处，供回答中展开原文/核对引文。'
    + '只能取当前人物的事迹（围栏化）；id 不存在或不属于当前人物会返回错误。',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: '事迹 id（来自 retrieve_anecdotes 返回的 id 字段）',
      },
    },
    required: ['id'],
  },
}

export const RETRIEVE_QUOTES_TOOL: ToolSchema = {
  name: 'retrieve_quotes', description: '检索当前人物语录；只返回稳定 ID、原文摘要、出处和可信度。',
  parameters: { type: 'object', properties: { query: { type: 'string' }, topK: { type: 'number' } }, required: ['query'] },
}
export const FETCH_QUOTE_TOOL: ToolSchema = {
  name: 'fetch_quote', description: '按当前人物语录 ID 读取库内 exact text、source、credibility。',
  parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
}

/** 演员可用工具清单（生成时随 GenerateOptions.tools 下发）。 */
/** 旧 runToolLoop 兼容清单；原生证据路径使用 EVIDENCE_ACTOR_TOOLS。 */
export const ACTOR_TOOLS: ToolSchema[] = [RETRIEVE_ANECDOTES_TOOL, FETCH_ANECDOTE_TOOL]
export const EVIDENCE_ACTOR_TOOLS: ToolSchema[] = [...ACTOR_TOOLS, RETRIEVE_QUOTES_TOOL, FETCH_QUOTE_TOOL]

/** 工具结果文本长度上限（token 预算受控；约 1200 中文字符）。 */
const TOOL_RESULT_MAX_CHARS = 1200

/** 解析模型产出的参数 JSON；失败返回空对象（工具执行不因坏参数崩溃）。 */
function parseArgs(argumentsText: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(argumentsText) as Record<string, unknown>
    return parsed !== null && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * retrieve_anecdotes 处理器工厂（围栏化：personaId 闭包固定当前人物）。
 * @param libs - 内容库。
 * @param personaId - 当前人物（演员语境；围栏只返回该人物事迹）。
 */
export function makeRetrieveHandler(libs: ContentLibraries, personaId: PersonaId, ledger?: EvidenceLedger) {
  return (argumentsText: string): { content: string; isError?: boolean } => {
    const args = parseArgs(argumentsText)
    const query = typeof args.query === 'string' ? args.query.trim() : ''
    if (query === '') {
      return { content: '参数缺失：query 为必填（困惑/主题关键词）', isError: true }
    }
    const topK = typeof args.topK === 'number' ? Math.floor(args.topK) : 3
    const items = retrieveAnecdotes(query, personaId, libs, topK)
    const payload = {
      ok: true,
      personaId,
      total: items.length,
      note: items.length === 0
        ? '本人物未找到与查询相关的事迹；如确需史实支撑，请基于已验证思想有限讨论，并诚实标注缺少对应亲历事迹（不上网、不编）。'
        : undefined,
      items: items.map((a) => ({ id: a.id, title: a.title, theme: a.theme, summary: a.summary, source: a.source })),
    }
    const content = JSON.stringify(payload)
    if (content.length > TOOL_RESULT_MAX_CHARS) {
      const bounded = { ...payload, items: payload.items.slice(0, 1) }
      const boundedText = JSON.stringify(bounded)
      if (boundedText.length > TOOL_RESULT_MAX_CHARS) return { content: JSON.stringify({ ok: true, personaId, total: 0, items: [] }) }
      for (const item of bounded.items) ledger?.grant({ evidenceId: item.id, kind: 'anecdote', personaId, turnId: ledger.turnId })
      return { content: boundedText }
    }
    for (const item of items) ledger?.grant({ evidenceId: item.id, kind: 'anecdote', personaId, turnId: ledger.turnId })
    return { content }
  }
}

/**
 * fetch_anecdote 处理器工厂（围栏化：非当前人物事迹返回错误，碰不到他人）。
 * @param libs - 内容库。
 * @param personaId - 当前人物。
 */
export function makeFetchHandler(libs: ContentLibraries, personaId: PersonaId, ledger?: EvidenceLedger) {
  return (argumentsText: string): { content: string; isError?: boolean } => {
    const args = parseArgs(argumentsText)
    const id = typeof args.id === 'string' ? args.id.trim() : ''
    if (id === '') {
      return { content: '参数缺失：id 为必填（事迹 id）', isError: true }
    }
    const anecdote = fetchAnecdote(id, personaId, libs)
    if (anecdote === undefined) {
      return { content: `围栏拦截：事迹 id「${id}」不存在或不属于当前人物（${personaId}），取不到他人事迹`, isError: true }
    }
    const content = JSON.stringify({
        ok: true,
        id: anecdote.id,
        personaId: anecdote.personaId,
        title: anecdote.title,
        theme: anecdote.theme,
        fullText: anecdote.fullText,
        source: anecdote.source,
      })
    if (content.length > TOOL_RESULT_MAX_CHARS) return { content: '事迹结果超出回合预算，未授予证据', isError: true }
    ledger?.grant({ evidenceId: anecdote.id, kind: 'anecdote', personaId, turnId: ledger.turnId })
    return { content }
  }
}

function makeQuoteHandlers(libs: ContentLibraries, personaId: PersonaId, ledger?: EvidenceLedger) {
  const retrieve = (argumentsText: string) => {
    const args = parseArgs(argumentsText); const query = typeof args.query === 'string' ? args.query.trim() : ''
    if (!query) return { content: '参数缺失：query 为必填', isError: true }
    const topK = Math.min(5, Math.max(1, Number.isFinite(args.topK as number) ? Math.floor(args.topK as number) : 3))
    const items = libs.quotes.search(query, personaId, topK)
    const visible = items.map((x) => ({ id: x.id, text: x.text, source: x.source, credibility: x.credibility }))
    const content = JSON.stringify({ ok: true, personaId, items: visible })
    if (content.length > TOOL_RESULT_MAX_CHARS) return { content: JSON.stringify({ ok: true, personaId, items: [] }) }
    for (const item of items) ledger?.grant({ evidenceId: item.id, kind: 'quote', personaId, turnId: ledger.turnId })
    return { content }
  }
  const fetch = (argumentsText: string) => {
    const args = parseArgs(argumentsText); const id = typeof args.id === 'string' ? args.id.trim() : ''
    const quote = id ? fetchQuote(id, libs) : undefined
    if (!quote || quote.personaId !== personaId) return { content: `围栏拦截：语录 id「${id}」不存在或不属于当前人物（${personaId}）`, isError: true }
    const content = JSON.stringify({ ok: true, id: quote.id, personaId, text: quote.text, source: quote.source, credibility: quote.credibility })
    if (content.length > TOOL_RESULT_MAX_CHARS) return { content: '语录结果超出回合预算，未授予证据', isError: true }
    ledger?.grant({ evidenceId: quote.id, kind: 'quote', personaId, turnId: ledger.turnId })
    return { content }
  }
  return { retrieve, fetch }
}

/** 演员 tool-call 处理器表（当前人物围栏化）。 */
export type ActorHandlers = {
  retrieve_anecdotes: (argumentsText: string) => { content: string; isError?: boolean }
  fetch_anecdote: (argumentsText: string) => { content: string; isError?: boolean }
  retrieve_quotes: (argumentsText: string) => { content: string; isError?: boolean }
  fetch_quote: (argumentsText: string) => { content: string; isError?: boolean }
}
export function makeActorHandlers(libs: ContentLibraries, personaId: PersonaId, ledger?: EvidenceLedger): ActorHandlers {
  const quotes = makeQuoteHandlers(libs, personaId, ledger)
  return {
    retrieve_anecdotes: makeRetrieveHandler(libs, personaId, ledger),
    fetch_anecdote: makeFetchHandler(libs, personaId, ledger),
    retrieve_quotes: quotes.retrieve,
    fetch_quote: quotes.fetch,
  }
}

/** 演员回合结果。 */
export interface ActorTurnResult {
  /** 最终回答文本（工具调用收敛后）。 */
  reply: string
  /** 工具调用轨迹（观察证据：检索了什么、结果如何）。 */
  trail: ToolTrailEntry[]
  /** 最后一轮模型响应（含 usage/toolCalls）。 */
  response: LlmResponse
  /** 达到最大轮数仍未收敛。 */
  truncated: boolean
}

/**
 * 演员回答回合（生成时自主 tool-call 检索）：把工具 schema 挂到请求上，
 * 跑 runToolLoop（处理器围栏化到 personaId），返回收敛后的最终回答与轨迹。
 * @param llm - 模型客户端。
 * @param request - 演员回合请求（system=persona + 对话消息；tools 由本函数附加）。
 * @param libs - 内容库。
 * @param personaId - 当前人物（围栏）。
 * @param maxRounds - 工具循环最大轮数（默认 3，防止模型无限 tool-call 烧 token）。
 */
export async function runActorTurnWithRetrieval(
  llm: LlmClient,
  request: LlmRequest,
  libs: ContentLibraries,
  personaId: PersonaId,
  maxRounds = 3,
): Promise<ActorTurnResult> {
  const withTools: LlmRequest = { ...request, tools: ACTOR_TOOLS }
  const { response, trail, truncated } = await runToolLoop(
    (req) => llm.complete(req),
    withTools,
    makeActorHandlers(libs, personaId),
    maxRounds,
  )
  return { reply: response.text.trim(), trail, response, truncated }
}
