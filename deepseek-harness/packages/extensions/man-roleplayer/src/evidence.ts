/** Fail-closed parser for registered, audited persona research Markdown files. */

import type { PersonaId } from './product/index.ts'
import { personaDefinition } from './types.ts'
import { z } from 'zod'

/** One Claim vocabulary is shared by the model-facing tool and Host parser. */
export const CLAIM_KINDS = ['reliable-quote', 'historical-fact', 'attribution', 'modern-inference', 'insufficient-evidence'] as const
export const claimSidecarSchema = z.object({
  textRange: z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive() }).strict(),
  kind: z.enum(CLAIM_KINDS),
  evidenceIds: z.array(z.string().trim().min(1)),
}).strict()
export const claimSidecarArraySchema = z.array(claimSidecarSchema).min(1)

/** Model-facing answer segment. Host concatenates these strings and owns the
 * exact UTF-16 ranges so the model never has to count offsets. */
export const claimSegmentSchema = z.object({
  text: z.string().min(1),
  kind: z.enum(CLAIM_KINDS),
  evidenceIds: z.array(z.string().trim().min(1)),
}).strict()
export const claimSegmentArraySchema = z.array(claimSegmentSchema).min(1)

/** Author-facing DSL node; `defineTool` compiles this to the model JSON schema. */
export const claimSegmentValueSchema = {
  type: 'object' as const,
  additionalProperties: false as const,
  properties: {
    text: { type: 'string' as const, required: true as const },
    kind: { type: 'string' as const, enum: CLAIM_KINDS, required: true as const },
    evidenceIds: { type: 'array' as const, items: { type: 'string' as const }, required: true as const },
  },
} as const

export const claimSidecarValueSchema = {
  type: 'object' as const,
  additionalProperties: false as const,
  properties: {
    textRange: {
      type: 'object' as const,
      additionalProperties: false as const,
      properties: {
        start: { type: 'integer' as const, required: true as const },
        end: { type: 'integer' as const, required: true as const },
      },
      required: true as const,
    },
    kind: { type: 'string' as const, enum: CLAIM_KINDS, required: true as const },
    evidenceIds: { type: 'array' as const, items: { type: 'string' as const }, required: true as const },
  },
} as const

export const RESEARCH_EVIDENCE_KINDS = [
  'authorial-text', 'disciple-record', 'historical-account', 'textual-parable',
  'quoted-other-speaker', 'later-evaluation', 'variant-reading', 'contested-attribution',
  'modern-interpretation', 'quote', 'historical-fact', 'attribution',
] as const
export type ResearchEvidenceKind = typeof RESEARCH_EVIDENCE_KINDS[number]

export interface ResearchEvidence {
  readonly id: string
  readonly persona: PersonaId
  readonly title: string
  readonly text: string
  readonly source: string
  readonly evidenceType: ResearchEvidenceKind
  readonly trust: 'reliable' | 'restricted'
  readonly firstPersonAllowed: boolean
}

export interface ClaimSidecarInput {
  readonly textRange: { readonly start: number; readonly end: number }
  readonly kind: 'reliable-quote' | 'historical-fact' | 'attribution' | 'modern-inference' | 'insufficient-evidence'
  readonly evidenceIds: readonly string[]
}

/** Validate a complete Claim[] partition against the private assistant text and current tool results. */
export function validateClaimSidecar(
  text: string,
  claims: readonly ClaimSidecarInput[],
  returnedEvidenceIds: ReadonlySet<string>,
): boolean {
  let cursor = 0
  for (const claim of claims) {
    const { start, end } = claim.textRange
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start !== cursor || end <= start || end > text.length) return false
    const reliable = claim.kind === 'reliable-quote' || claim.kind === 'historical-fact'
    const attribution = claim.kind === 'attribution'
    if ((reliable || attribution)
      && (claim.evidenceIds.length === 0 || claim.evidenceIds.some(id => !returnedEvidenceIds.has(id)))) return false
    if (!reliable && !attribution && claim.evidenceIds.length > 0) return false
    cursor = end
  }
  return claims.length > 0 && cursor === text.length
}

/** Convert the research document's human-readable evidence labels to one runtime vocabulary. */
function evidenceKindOf(value: string | undefined, source: string, text: string): ResearchEvidenceKind {
  const label = `${value ?? ''} ${source} ${text}`
  if (/寓言文本|内篇|外篇|杂篇|文本人物/u.test(label)) return 'textual-parable'
  if (/门人记录|朱子语类|弟子记录/u.test(label)) return 'disciple-record'
  if (/他人语|柔奴|寓娘|旁人回答/u.test(label)) return 'quoted-other-speaker'
  if (/史臣|后世评价|后人评价|评曰/u.test(label)) return 'later-evaluation'
  if (/异文|版本/u.test(label)) return 'variant-reading'
  if (/争议|待核|归属未定/u.test(label)) return 'contested-attribution'
  if (/产品化|现实映照|现代阐释|解释/u.test(label) && !/本人作品|亲笔|定本/u.test(label)) return 'modern-interpretation'
  if (/本人作品|本人定本|亲笔/u.test(label)) return 'authorial-text'
  if (/史传记载|史实|正史|史记|宋史/u.test(label)) return 'historical-account'
  return 'historical-fact'
}

function firstPersonAllowedFor(kind: ResearchEvidenceKind, source: string, text: string, restricted: boolean): boolean {
  if (restricted || kind === 'textual-parable' || kind === 'disciple-record' || kind === 'historical-account'
    || kind === 'quoted-other-speaker' || kind === 'later-evaluation' || kind === 'variant-reading'
    || kind === 'contested-attribution' || kind === 'modern-interpretation') return false
  return kind === 'authorial-text' || kind === 'quote' || kind === 'historical-fact'
    ? !/他人语|门人|寓言|史传|史臣|待核|异文|争议/u.test(`${source} ${text}`)
    : false
}

function researchPersonaMarkers(markdown: string): readonly string[] {
  return [...markdown.matchAll(/persona_id：`([^`]+)`/gu)].map(match => match[1] ?? '')
}

/** Parse numbered cards and quote rows from any registered audited persona document. */
export function parseResearchEvidence(markdown: string, persona: PersonaId): readonly ResearchEvidence[] {
  const definition = personaDefinition(persona)
  const markers = researchPersonaMarkers(markdown)
  if (markers.length !== 1 || markers[0] !== definition.displayName) return []
  const cards = markdown.split(/^###\s+/mu).slice(1)
  const result: ResearchEvidence[] = []
  const ids = new Set<string>()
  for (const card of cards) {
    const sourceLine = card.match(/(?:^|\n)-\s*\*\*source\*\*：([^\n]+)/u)?.[1]
    if (sourceLine === undefined || /❌|误传|伪托/u.test(sourceLine)) continue
    const title = card.match(/(?:^|\n)-\s*\*\*title\*\*：([^\n]+)/u)?.[1]?.trim()
    const fullText = card.match(/(?:^|\n)-\s*\*\*full_text\*\*：([^\n]+)/u)?.[1]?.trim()
    const summary = card.match(/(?:^|\n)-\s*\*\*summary\*\*：([^\n]+)/u)?.[1]?.trim()
    const text = fullText === undefined || /无统一语录|无统一原话/u.test(fullText) ? summary : fullText
    const declaredKind = card.match(/(?:^|\n)-\s*\*\*evidence_kind\*\*：([^\n]+)/u)?.[1]?.trim()
    const source = sourceLine.replace(/[✅⚠️❌]/gu, '').trim()
    const number = card.match(/【事迹卡\s*(\d+)】/u)?.[1]
    if (title === undefined || text === undefined || source.length === 0 || /\?{3,}/u.test(source) || number === undefined) continue
    const id = `${persona}:research:${number}`
    if (ids.has(id)) return []
    ids.add(id)
    if (/MAYBE|UNKNOWN|不确定/u.test(sourceLine)) continue
    const restricted = sourceLine.includes('⚠️') || /\*/u.test(sourceLine) || /待核|争议|须分开/u.test(declaredKind ?? '')
    const evidenceType = declaredKind === undefined && restricted ? 'attribution' : evidenceKindOf(declaredKind, source, text)
    result.push({ id, persona, title, text, source, evidenceType, trust: restricted ? 'restricted' : 'reliable', firstPersonAllowed: firstPersonAllowedFor(evidenceType, source, text, restricted) })
  }
  const lines = markdown.split(/\r?\n/u)
  const quoteHeader = lines.findIndex(line => /^\|\s*(?:#|编号)\s*\|/u.test(line) && line.includes('可信度'))
  const quoteColumns = quoteHeader < 0 ? 0 : lines[quoteHeader]?.split('|').length ?? 0
  for (const row of (quoteHeader < 0 ? [] : lines.slice(quoteHeader + 1)).filter(line => /^\|\s*\d+\s*\|/u.test(line))) {
    const cells = row.split('|').map(cell => cell.trim())
    const quote = cells[2]?.replace(/^"|"$/gu, '').trim(); const sourceCell = cells[3]?.trim(); const source = sourceCell?.replace(/[✅⚠️❌*]/gu, '').trim(); const marker = cells.at(-2)?.trim() ?? ''
    const number = cells[1]
    if (quoteColumns === 0 || cells.length !== quoteColumns || number === undefined || quote === undefined
      || sourceCell === undefined || source === undefined || quote.length === 0 || source.length === 0 || /\?{3,}/u.test(source)
      || /❌|误传|伪托/u.test(`${sourceCell} ${marker}`)) continue
    if (!/^(?:✅\*?|⚠️)/u.test(marker)) continue
    const id = `${persona}:research:quote:${number}`; if (ids.has(id)) return []
    ids.add(id)
    const restricted = marker.startsWith('✅*') || marker.startsWith('⚠️')
    const evidenceType = persona === 'zhuangzi'
      ? 'textual-parable'
      : evidenceKindOf(undefined, `${source} ${marker}`, quote)
    const kind = evidenceType === 'historical-fact' ? 'quote' : evidenceType
    result.push({ id, persona, title: quote, text: quote, source, evidenceType: kind, trust: restricted ? 'restricted' : 'reliable', firstPersonAllowed: firstPersonAllowedFor(kind, source, quote, restricted) })
  }
  return result
}
