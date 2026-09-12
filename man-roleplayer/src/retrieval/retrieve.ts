/**
 * man-roles-roleplayer —— 检索与取回（纯 TS，零 DSH 运行时依赖）。
 *
 * 阶段 6 核心 API：
 *  - `retrieveAnecdotes(query, personaId, libs)`：按困惑检索**本人物**事迹 top-k（围栏化）；
 *  - `fetchAnecdote(id, personaId, libs)`：取本人物事迹原文（围栏化，碰不到他人；
 *    架构 §4 fetch_anecdote 演员取原文）；
 *  - `fetchQuote(id, libs)`：按指针取语录原文；
 *  - `fetchSource(source, libs, personaId?)`：按出处文本回落库内条目（原文按需取回）。
 *
 * 降级路径（架构 §6 失败处理 #1/#7）：无命中 → 返回空（调用方诚实标注
 * 「缺少对应亲历事迹」，不上网、不编）；原文取不到 → 降级展示 summary。
 */
import type { PersonaId } from '../domain/schema.ts'
import { AnecdoteStore } from './anecdote-store.ts'
import { QuoteStore } from './quote-store.ts'
import { Blacklist } from './blacklist.ts'

/** 检索依赖（构建期由 data.ts 提供内联数据）。 */
export interface ContentLibraries {
  anecdotes: AnecdoteStore
  quotes: QuoteStore
  blacklist: Blacklist
}

/** 检索结果条目（tool result 的 summary 形态：摘要进上下文，原文留库）。 */
export interface RetrievedAnecdote {
  id: string
  title: string
  theme: string
  summary: string
  source: string
}

/**
 * 按困惑检索本人物事迹 top-k（围栏化 + 确定性匹配）。
 * @param query - 困惑/主题关键词。
 * @param personaId - 当前人物（只返回该人物事迹）。
 * @param libs - 内容库。
 * @param topK - 最多返回条数（默认 3，上限 5）。
 */
export function retrieveAnecdotes(
  query: string,
  personaId: PersonaId,
  libs: ContentLibraries,
  topK = 3,
): RetrievedAnecdote[] {
  return libs.anecdotes.search(query, personaId, { topK }).map((a) => ({
    id: a.id,
    title: a.title,
    theme: a.theme,
    summary: a.summary,
    source: a.source,
  }))
}

/**
 * 取本人物事迹原文（围栏化）：id 不存在或不属于当前人物 → undefined（碰不到他人）。
 * 原文不进上下文，供「出处可展开查看原文」追溯。
 */
export function fetchAnecdote(
  id: string,
  personaId: PersonaId,
  libs: ContentLibraries,
): { id: string; personaId: PersonaId; title: string; theme: string; summary: string; fullText: string; source: string } | undefined {
  const anecdote = libs.anecdotes.byId(id)
  if (anecdote === undefined || anecdote.personaId !== personaId) return undefined
  return anecdote
}

/** 按指针取语录原文。 */
export function fetchQuote(id: string, libs: ContentLibraries): QuoteStore['items'][number] | undefined {
  return libs.quotes.byId(id)
}

/**
 * 按出处文本回落库内条目（语录 + 事迹；供出处校验与原文取回）。
 * @param source - 候选出处（如《传习录》卷上·陆澄录）。
 * @param libs - 内容库。
 * @param personaId - 可选：只在该人物范围内回落。
 */
export function fetchSource(
  source: string,
  libs: ContentLibraries,
  personaId?: PersonaId,
): Array<{ kind: 'quote' | 'anecdote'; id: string; text: string; source: string }> {
  const matched: Array<{ kind: 'quote' | 'anecdote'; id: string; text: string; source: string }> = []
  const quotes = personaId === undefined ? libs.quotes.items : libs.quotes.byPersona(personaId)
  const anecdotes = personaId === undefined ? libs.anecdotes.items : libs.anecdotes.byPersona(personaId)
  for (const q of quotes) {
    if (sourceMatches(source, q.source)) {
      matched.push({ kind: 'quote', id: q.id, text: q.text, source: q.source })
    }
  }
  for (const a of anecdotes) {
    if (sourceMatches(source, a.source)) {
      matched.push({ kind: 'anecdote', id: a.id, text: a.summary, source: a.source })
    }
  }
  return matched
}

/**
 * 出处归一化：去掉前后空白、截掉「；⚠/，⚠/（⚠」之后的版本注记、去掉句末句号。
 * 保留书名·篇章主体，供「引用 source 必须回落库内」校验。
 */
export function normalizeSource(source: string): string {
  let s = source.trim()
  const caveat = s.search(/[；;，]⚠|（⚠/)
  if (caveat !== -1) s = s.slice(0, caveat)
  s = s.replace(/[。\s]+$/, '')
  return s
}

/**
 * 出处匹配：候选出处与库内出处归一化后相等，或互为前后缀；
 * 或剥离书名号后候选被库内出处包含（允许演员缩写——
 * 如「《年谱》」→ 库内「《阳明先生集要·年谱》」）。
 * 剥离书名号后候选 < 2 字（如「《书》」）视为过于模糊，不匹配（防误放行）。
 */
export function sourceMatches(candidate: string, librarySource: string): boolean {
  const c = normalizeSource(candidate)
  const k = normalizeSource(librarySource)
  if (c === '' || k === '') return false
  const cBare = c.replace(/[《》]/g, '')
  const kBare = k.replace(/[《》]/g, '')
  if (cBare === '' || cBare.length < 2) return false
  if (c === k || c.startsWith(k) || k.startsWith(c)) return true
  if (kBare !== '' && kBare.includes(cBare)) return true
  return false
}
