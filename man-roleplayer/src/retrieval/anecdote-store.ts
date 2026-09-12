/**
 * man-roles-roleplayer —— 事迹库存储与确定性检索（纯 TS，零 DSH 运行时依赖）。
 *
 * 阶段 6：把调研成果 B 章节转写为内容包事迹数据。
 * 转写为 content/anecdotes/*.json 的结构化事迹库，本模块负责：
 *  - 加载与校验（构建期由 data.ts 内联 JSON；此处提供类型与查询）；
 *  - 确定性匹配（theme 精确匹配优先 → title 命中 → summary 关键词命中，取 top-k），
 *    不耗模型 token（架构 §4：检索的预算/围栏由确定性代码强制）；
 *  - 围栏化：按 personaId 过滤，当前语境只能取当前人物事迹（结构性隔离）。
 *
 * 红线（转写规则，见 task_plan 阶段 6）：
 *  - full_text / source 与调研成果逐字一致（不得改写/润色）；
 *  - source 完整保留「书名·篇章/卷数」及 ⚠️ 版本差异注记（不得缩写）。
 */
import type { PersonaId } from '../domain/schema.ts'

/** 事迹条目（对齐架构 §3 anecdote schema：id/persona_id/theme/title/summary/full_text/source）。 */
export interface Anecdote {
  id: string
  personaId: PersonaId
  theme: string
  title: string
  /** 摘要（3~5 句，进演员上下文）。 */
  summary: string
  /** 原文（不进上下文，可追溯；与调研成果逐字一致）。 */
  fullText: string
  /** 出处（书名·篇章/卷数，含版本注记；与调研成果逐字一致）。 */
  source: string
}

/** 检索选项。 */
export interface SearchOptions {
  /** 最多返回条数（默认 3；上限 5，超限截断）。 */
  topK?: number
}

/** 从查询文本中提取 CJK 连续片段（长度 ≥ 2）作为检索词；其余字符忽略。 */
export function queryTerms(query: string): string[] {
  const runs = query.match(/[\u4e00-\u9fff]{2,}/g) ?? []
  return [...new Set(runs)]
}

/** 单条事迹的确定性评分：theme 精确命中 +4/标签；title 命中 +3/词；summary 命中 +1/词。 */
export function scoreAnecdote(anecdote: Anecdote, terms: string[], query: string): number {
  let score = 0
  for (const themeLabel of anecdote.theme.split('/')) {
    if (query.includes(themeLabel)) score += 4
  }
  for (const term of terms) {
    if (anecdote.title.includes(term)) score += 3
    if (anecdote.summary.includes(term)) score += 1
  }
  return score
}

/**
 * 事迹库（不可变查询视图）。
 * @param items - 全部事迹（构建期由 data.ts 传入内联数据）。
 */
export class AnecdoteStore {
  private readonly byIdMap = new Map<string, Anecdote>()

  constructor(readonly items: readonly Anecdote[]) {
    for (const item of items) {
      if (this.byIdMap.has(item.id)) {
        throw new Error(`事迹库 id 重复: ${item.id}`)
      }
      this.byIdMap.set(item.id, item)
    }
  }

  /** 按 id 取事迹（不围栏；调用方决定是否校验 persona）。 */
  byId(id: string): Anecdote | undefined {
    return this.byIdMap.get(id)
  }

  /** 某人物全部事迹。 */
  byPersona(personaId: PersonaId): Anecdote[] {
    return this.items.filter((a) => a.personaId === personaId)
  }

  /** 某人物全部去重出处（source 原文，含版本注记）。 */
  sources(personaId: PersonaId): string[] {
    return [...new Set(this.byPersona(personaId).map((a) => a.source))]
  }

  /**
   * 确定性检索（围栏化）：只在本人物事迹内匹配，按评分降序取 top-k。
   * @param query - 困惑/主题关键词（模型 tool-call 参数或直接查询）。
   * @param personaId - 当前人物（围栏：只返回该人物事迹）。
   * @param options - topK（默认 3，上限 5）。
   * @returns 匹配到的事迹（评分 > 0，按评分降序、id 升序稳定排序）。
   */
  search(query: string, personaId: PersonaId, options: SearchOptions = {}): Anecdote[] {
    const topK = Math.min(Math.max(options.topK ?? 3, 1), 5)
    const terms = queryTerms(query)
    const scored = this.byPersona(personaId)
      .map((a) => ({ anecdote: a, score: scoreAnecdote(a, terms, query) }))
      .filter((s) => s.score > 0)
      .sort((x, y) => y.score - x.score || (x.anecdote.id < y.anecdote.id ? -1 : 1))
    return scored.slice(0, topK).map((s) => s.anecdote)
  }
}
