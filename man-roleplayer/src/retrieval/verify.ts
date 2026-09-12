/**
 * man-roles-roleplayer —— 出处校验 + 黑名单拦截（纯 TS，零 DSH 运行时依赖）。
 *
 * 阶段 6 验收核心（红线 2「引文必须挂库内真实出处」的确定性兜底）：
 *  - `verifyCitation`：引用 source 必须回落库内（语录/事迹出处归一化匹配）；
 *    引用伪托书（《冰鉴》《挺经》）→ forged-book-source；
 *  - `checkBlacklist`：演员回答文本命中黑名单语录 → 拦截
 *    （❌ 误传/⚠️ 禁入流行语 always 拦截；史臣评价 first-person 语境拦截）；
 *  - `verifyReference`：source + text 一并校验，返回违规清单（供 e2e 断言与日志）。
 *
 * 校验不调模型（确定性代码兜底）；演员回答是否自愈重生成属调用方决策（架构 §6 #2）。
 */
import type { PersonaId } from '../domain/schema.ts'
import type { BlacklistEntry } from './blacklist.ts'
import { sourceMatches } from './retrieve.ts'
import type { ContentLibraries } from './retrieve.ts'

/** 违规类型。 */
export type CitationViolationCode =
  /** 引用的 source 未回落库内（不存在或过于模糊）。 */
  | 'unknown-source'
  /** source 命中伪托书黑名单（《冰鉴》《挺经》）。 */
  | 'forged-book-source'
  /** 文本命中黑名单语录（❌ 误传 / ⚠️ 禁入流行语）。 */
  | 'blacklisted-quote'
  /** 文本命中禁作第一人称的史臣评价（仅演员第一人称语境）。 */
  | 'forbidden-first-person'

export interface CitationViolation {
  code: CitationViolationCode
  detail: string
}

export interface VerifyResult {
  ok: boolean
  violations: CitationViolation[]
}

function violation(code: CitationViolationCode, detail: string): CitationViolation {
  return { code, detail }
}

/**
 * 出处校验：source 必须回落库内（该人物语录/事迹出处）。
 * @param source - 候选出处文本。
 * @param personaId - 当前人物（围栏：只在该人物库内校验）。
 * @param libs - 内容库。
 */
export function verifyCitation(source: string, personaId: PersonaId, libs: ContentLibraries): VerifyResult {
  const violations: CitationViolation[] = []

  // 伪托书拦截（先于回落校验：命中即拒）
  const forged = libs.blacklist.matchBookSource(source)
  if (forged !== undefined) {
    violations.push(violation('forged-book-source', `引用的出处命中伪托书黑名单「${forged.text}」：${forged.reason}`))
    return { ok: false, violations }
  }

  const librarySources = [...libs.quotes.sources(personaId), ...libs.anecdotes.sources(personaId)]
  const matched = librarySources.some((libSource) => sourceMatches(source, libSource))
  if (!matched) {
    violations.push(violation('unknown-source', `引用的出处「${source}」未回落库内（该人物语录/事迹出处中不存在）`))
  }
  return { ok: violations.length === 0, violations }
}

/**
 * 黑名单文本拦截。
 * @param text - 候选文本（通常为演员回答全文）。
 * @param personaId - 当前人物。
 * @param libs - 内容库。
 * @param context - 'actor-reply'：演员第一人称语境（first-person 史臣评价也拦截）；
 *                  'any'（默认）：只拦截 always 模式。
 * @returns 命中的黑名单条目；未命中返回 undefined。
 */
export function checkBlacklist(
  text: string,
  personaId: PersonaId,
  libs: ContentLibraries,
  context: 'actor-reply' | 'any' = 'any',
): BlacklistEntry | undefined {
  return libs.blacklist.matchText(text, personaId, context)
}

/**
 * 引用校验（出处 + 文本一并）：供回答收尾断言——引用必须回落库内，
 * 回答不得含黑名单语录/禁作第一人称的史臣评价。
 * @param ref - { source?: 引用的出处；text?: 回答全文 }。
 * @param personaId - 当前人物。
 * @param libs - 内容库。
 */
export function verifyReference(
  ref: { source?: string; text?: string },
  personaId: PersonaId,
  libs: ContentLibraries,
): VerifyResult {
  const violations: CitationViolation[] = []
  if (ref.source !== undefined && ref.source.trim() !== '') {
    violations.push(...verifyCitation(ref.source, personaId, libs).violations)
  }
  if (ref.text !== undefined && ref.text.trim() !== '') {
    const hit = checkBlacklist(ref.text, personaId, libs, 'actor-reply')
    if (hit !== undefined) {
      violations.push(
        violation(
          hit.mode === 'first-person' ? 'forbidden-first-person' : 'blacklisted-quote',
          `回答命中黑名单「${hit.text}」（${hit.credibility} ${hit.mode}）：${hit.reason}`,
        ),
      )
    }
  }
  return { ok: violations.length === 0, violations }
}

/** 从回答文本中提取形如《书名·篇章》的出处引用（观测/校验用；正则粗提取）。 */
export function extractCitedSources(text: string): string[] {
  const matches = text.match(/《[^》]+》/g) ?? []
  return [...new Set(matches)]
}
