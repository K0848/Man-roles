/**
 * man-roles-roleplayer —— 内容数据注册表（构建期内联，纯 TS）。
 *
 * content/anecdotes/*.json、content/quotes/*.json、content/blacklist.json 经
 * esbuild json loader（默认支持）在构建期内联为 JS 对象，随 lib/retrieval.js
 * 分发：copy 安装只带 lib/src（package.json files），运行时**不能**读 content/
 * 磁盘，故结构化数据必须打包进 bundle（与阶段 5 personas-data 的 .md 内联同模式）。
 *
 * 红线校验（assertContentIntegrity，构建期/测试期执行）：
 *  - 事迹 full_text / source 与调研成果逐字一致（转写抽查见 tests/retrieval.test.mjs）；
 *  - 语录可信度标记完整保留，❌ 误传**只进黑名单**、不进可引用库；
 *  - 黑名单条目绝不进入可引用库（文本互斥断言）。
 */
import { CONTENT_PACK } from '../persona/content-pack.ts'
import { AnecdoteStore, type Anecdote } from './anecdote-store.ts'
import { QuoteStore, type Quote } from './quote-store.ts'
import { Blacklist, type BlacklistEntry, normalizeText } from './blacklist.ts'
import type { ContentLibraries } from './retrieve.ts'
import type { PersonaArtifact } from '../persona/artifact.ts'

/** 内容版本戳（与调研成果版本对齐；转写后 +1）。 */
export const CONTENT_VERSION = '2026-08-23-phase6-v1'

/** 全部事迹；条目数量由内容包决定，真实性断言位于内容专用测试。 */
export const ANECDOTES: Anecdote[] = CONTENT_PACK.flatMap((p) => p.anecdotes) as Anecdote[]

/** 全部语录；误传条目只允许存在于黑名单内容包。 */
export const QUOTES: Quote[] = CONTENT_PACK.flatMap((p) => p.quotes) as Quote[]

/** 全部黑名单条目（❌ 误传 / ⚠️ 禁入流行语 / 伪托书 / 禁作第一人称史臣评价）。 */
export const BLACKLIST_ENTRIES: BlacklistEntry[] = CONTENT_PACK.flatMap((p) => p.blacklist) as BlacklistEntry[]

/** 各人物事迹条数（由 artifact 派生，供观测与内容测试使用）。 */
export const ANECDOTE_COUNTS: Record<string, number> = Object.fromEntries(CONTENT_PACK.map((p) => [p.manifest.id, ANECDOTES.filter((a) => a.personaId === p.manifest.id).length]))

/** 各人物语录条数。 */
export const QUOTE_COUNTS: Record<string, number> = Object.fromEntries(CONTENT_PACK.map((p) => [p.manifest.id, QUOTES.filter((q) => q.personaId === p.manifest.id).length]))

let cached: ContentLibraries | undefined

/** 构建内容库（惰性单例；构造即校验 id 唯一）。 */
export function buildContentLibraries(): ContentLibraries {
  if (cached !== undefined) return cached
  cached = {
    anecdotes: new AnecdoteStore(ANECDOTES),
    quotes: new QuoteStore(QUOTES),
    blacklist: new Blacklist(BLACKLIST_ENTRIES),
  }
  return cached
}

/** Construct isolated libraries for scanner-generated artifacts (tests/tools). */
export function contentLibrariesFromArtifact(artifact: PersonaArtifact): ContentLibraries {
  return {
    anecdotes: new AnecdoteStore(artifact.flatMap((p) => p.anecdotes) as Anecdote[]),
    quotes: new QuoteStore(artifact.flatMap((p) => p.quotes) as Quote[]),
    blacklist: new Blacklist(artifact.flatMap((p) => p.blacklist) as BlacklistEntry[]),
  }
}

/** 内容完整性断言（红线）：任何一项失败即抛错，阻止加载。 */
export function assertContentIntegrity(): void {
  // 1. 条数与人物归属

  // 2. 字段完整性（全字段非空）
  for (const a of ANECDOTES) {
    for (const field of ['id', 'personaId', 'theme', 'title', 'summary', 'fullText', 'source'] as const) {
      if (typeof a[field] !== 'string' || a[field].trim() === '') {
        throw new Error(`事迹字段缺失: ${a.id}.${field}`)
      }
    }
  }
  for (const q of QUOTES) {
    for (const field of ['id', 'personaId', 'text', 'source', 'credibility'] as const) {
      if (typeof q[field] !== 'string' || q[field].trim() === '') {
        throw new Error(`语录字段缺失: ${q.id}.${field}`)
      }
    }
    if (!['✅', '✅*', '⚠️'].includes(q.credibility)) {
      throw new Error(`语录可信度非法（❌ 不得入库）: ${q.id} credibility=${q.credibility}`)
    }
  }
  for (const e of BLACKLIST_ENTRIES) {
    if (e.text.trim() === '' || e.reason.trim() === '') {
      throw new Error(`黑名单条目不完整: ${JSON.stringify(e)}`)
    }
    if (!['quote', 'book'].includes(e.kind) || !['always', 'first-person'].includes(e.mode)) {
      throw new Error(`黑名单条目字段非法: ${JSON.stringify(e)}`)
    }
  }

  // 3. 黑名单与可引用库互斥（红线：❌ 误传/禁入流行语绝不进入可引用库；
  //    仅限 always 模式——first-person 史臣评价是「双安置」设计：
  //    可引用库允许其作历史坐标/旁白，黑名单拦截演员第一人称说出）
  const quoteTexts = QUOTES.map((q) => normalizeText(q.text)).filter((t) => t !== '')
  for (const e of BLACKLIST_ENTRIES) {
    if (e.kind !== 'quote' || e.mode !== 'always') continue
    const entryNorm = normalizeText(e.text)
    if (entryNorm === '') continue
    for (const qt of quoteTexts) {
      if (qt.includes(entryNorm) || entryNorm.includes(qt)) {
        throw new Error(`红线冲突：黑名单语录「${e.text}」与可引用库语录重复（误传进了可引用库）`)
      }
    }
  }

  // 4. 伪托书条目必须存在（《冰鉴》《挺经》）
  const books = BLACKLIST_ENTRIES.filter((e) => e.kind === 'book').map((e) => e.text)
  for (const required of ['《冰鉴》', '《挺经》']) {
    if (!books.includes(required)) {
      throw new Error(`伪托书黑名单缺失: ${required}`)
    }
  }
}

/** 各人物黑名单条目数（观测用）。 */
export const BLACKLIST_COUNTS: Record<string, number> = Object.fromEntries(CONTENT_PACK.map((p) => [p.manifest.id, BLACKLIST_ENTRIES.filter((e) => e.personaId === p.manifest.id).length]))
