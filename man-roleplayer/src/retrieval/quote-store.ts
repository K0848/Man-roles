/**
 * man-roles-roleplayer —— 语录索引存储（纯 TS，零 DSH 运行时依赖）。
 *
 * 阶段 6：把调研成果 C 章节转写为 content/quotes/*.json。
 * 每条语录带可信度标记（✅ / ✅* / ⚠️ / ❌）——❌ 误传条目**只进黑名单**，
 * 本库不接收 ❌（data.ts 的 assertContentIntegrity 强制校验）。
 * 语录可被引用（text + source 回落库内校验），亦可作为出处指针的取回对象。
 */
import type { PersonaId } from '../domain/schema.ts'

/** 可信度标记（与调研成果一致：✅ 可靠 / ✅* 传记引文待核 / ⚠️ 待核；❌ 不进入本库）。 */
export type QuoteCredibility = '✅' | '✅*' | '⚠️'

/** 语录条目（对齐调研成果 C 节：text/source/keywords/credibility）。 */
export interface Quote {
  id: string
  personaId: PersonaId
  /** 语录原文（逐字，含原文引号）。 */
  text: string
  /** 出处（书名·篇章；与调研成果逐字一致）。 */
  source: string
  /** 检索关键词（调研成果「关键词」列拆分）。 */
  keywords: string[]
  /** 可信度标记（✅ / ✅* / ⚠️）。 */
  credibility: QuoteCredibility
  /** 可信度/考据注记（如「待核（篇目已确认答周道通书，文字版本待核）」）。 */
  note?: string
  /** 文本单元格尾部括号注记（如（晚年自述）（咏良知诗），逐字保留，不进 text）。 */
  textNote?: string
}

/** 语录库（不可变查询视图）。 */
export class QuoteStore {
  private readonly byIdMap = new Map<string, Quote>()

  constructor(readonly items: readonly Quote[]) {
    for (const item of items) {
      if (this.byIdMap.has(item.id)) {
        throw new Error(`语录库 id 重复: ${item.id}`)
      }
      this.byIdMap.set(item.id, item)
    }
  }

  byId(id: string): Quote | undefined {
    return this.byIdMap.get(id)
  }

  byPersona(personaId: PersonaId): Quote[] {
    return this.items.filter((q) => q.personaId === personaId)
  }

  search(query: string, personaId: PersonaId, topK = 3): Quote[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    return this.byPersona(personaId).map((q) => ({ q, score: terms.reduce((n, t) => n + (`${q.text} ${q.keywords.join(' ')}`.toLowerCase().includes(t) ? 1 : 0), 0) }))
      .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.min(5, Math.max(1, topK))).map((x) => x.q)
  }

  /** 某人物全部去重出处（source 原文）。 */
  sources(personaId: PersonaId): string[] {
    return [...new Set(this.byPersona(personaId).map((q) => q.source))]
  }
}
