/**
 * man-roles-roleplayer —— 误传黑名单（纯 TS，零 DSH 运行时依赖）。
 *
 * 阶段 6：把调研成果 D 章节（考据说明）与 C2 误传警示转写为 content/blacklist.json。
 * 黑名单拦截两类违规：
 *  - `always`：❌ 误传 / ⚠️ 禁入流行语——文本命中即拒（绝不进可引用库）；
 *  - `first-person`：禁作第一人称的史臣评价（《清史稿》论曰）——演员以第一人称
 *    说出即拒，但允许作为历史坐标/旁白引用；
 *  - `book`：伪托书（《冰鉴》《挺经》）——被引用为 source 即拒（出处校验用）。
 *
 * 文本命中采用归一化包含匹配：去掉空白/标点/引号后，黑名单文本被候选文本包含即命中。
 */
import type { PersonaId } from '../domain/schema.ts'

/** 黑名单条目类型：quote = 语录文本；book = 伪托书（source 校验用）。 */
export type BlacklistEntryKind = 'quote' | 'book'

/** 拦截模式：always = 一律拦截；first-person = 仅演员第一人称语境拦截。 */
export type BlacklistMode = 'always' | 'first-person'

/** 黑名单条目。 */
export interface BlacklistEntry {
  /** 归属人物；内容包只允许 canonical PersonaId。 */
  personaId: PersonaId
  /** 被拦截文本（quote = 语录原文；book = 书名）。 */
  text: string
  kind: BlacklistEntryKind
  /** 可信度（❌ 误传 / ⚠️ 待核禁入 / ✅ 评价语）。 */
  credibility: '❌' | '⚠️' | '✅'
  mode: BlacklistMode
  /** 拦截原因（含调研成果出处位置，逐字引用考据结论）。 */
  reason: string
}

/** 归一化：去空白与全部标点（仅保留中日韩/数字/拉丁字母），小写。供包含匹配使用。 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}“”‘’「」『』《》〈〉（）【】]/gu, '')
}

/**
 * 黑名单（不可变查询视图）。
 * @param entries - 全部条目（构建期由 data.ts 传入内联数据）。
 */
export class Blacklist {
  private readonly quoteEntries: BlacklistEntry[]
  private readonly bookEntries: BlacklistEntry[]

  constructor(readonly entries: readonly BlacklistEntry[]) {
    this.quoteEntries = entries.filter((e) => e.kind === 'quote')
    this.bookEntries = entries.filter((e) => e.kind === 'book')
    for (const e of entries) {
      if (e.text.trim() === '' || e.reason.trim() === '') {
        throw new Error(`黑名单条目不完整: ${JSON.stringify(e)}`)
      }
    }
  }

  /**
   * 文本命中检查：候选文本（如演员回答）是否包含黑名单语录。
   * @param text - 候选文本。
   * @param personaId - 当前人物（只检查该人物黑名单）。
   * @param context - 'actor-reply'：演员第一人称语境（first-person 模式也拦截）；
   *                  'any'（默认）：只拦截 always 模式。
   * @returns 命中的黑名单条目；未命中返回 undefined。
   */
  matchText(text: string, personaId: PersonaId, context: 'actor-reply' | 'any' = 'any'): BlacklistEntry | undefined {
    const norm = normalizeText(text)
    for (const entry of this.quoteEntries) {
      if (entry.personaId !== personaId) continue
      if (entry.mode === 'first-person' && context !== 'actor-reply') continue
      const entryNorm = normalizeText(entry.text)
      // 双向包含：候选完整引用条目，或候选是条目的部分（如只引《格言联璧》四句的前半）。
      // 候选过短（< 4 字）不做「条目包含候选」判断，避免误伤。
      if (entryNorm !== '' && (norm.includes(entryNorm) || (norm.length >= 4 && entryNorm.includes(norm)))) {
        return entry
      }
    }
    return undefined
  }

  /**
   * 伪托书拦截：候选 source 是否引用黑名单中的伪托书（《冰鉴》《挺经》）。
   * @param source - 候选出处文本。
   * @returns 命中的黑名单条目；未命中返回 undefined。
   */
  matchBookSource(source: string): BlacklistEntry | undefined {
    const norm = normalizeText(source)
    for (const entry of this.bookEntries) {
      if (normalizeText(entry.text) !== '' && norm.includes(normalizeText(entry.text))) return entry
    }
    return undefined
  }

  /** 某人物全部条目（测试/审计用）。 */
  byPersona(personaId: PersonaId): BlacklistEntry[] {
    return this.entries.filter((e) => e.personaId === personaId)
  }
}
