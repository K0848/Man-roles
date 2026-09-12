export const FINAL_ACTOR_TOOL_NAMES = ['retrieve_anecdotes', 'fetch_anecdote', 'retrieve_quotes', 'fetch_quote', 'web_search', 'submit_actor_reply'] as const
import { z } from 'zod'
import type { ActorReplySegment } from '../evidence/types.ts'
import { dialogueControlSchema, turnIntentSchema } from '../dialogue/types.ts'
export type SubmitContractArgs = { segments: ActorReplySegment[]; turnIntent?: import('../dialogue/types.ts').TurnInstruction['intent']; questions?: string[]; offeredControls?: Array<import('../dialogue/types.ts').TurnInstruction['allowedControls'][number]> }
const segmentSchema = z.object({ kind: z.enum(['dialogue', 'historical_fact', 'verbatim_quote', 'thought_attribution', 'modern_inference', 'modern_external_fact']), text: z.string().trim().min(1), evidenceIds: z.array(z.string().min(1)).optional() }).strict().superRefine((s, ctx) => { if (['historical_fact', 'verbatim_quote', 'thought_attribution', 'modern_external_fact'].includes(s.kind) && (!s.evidenceIds || s.evidenceIds.length === 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'evidence required' }) })
export const submitArgsSchema = z.object({ segments: z.array(segmentSchema).min(1), turnIntent: turnIntentSchema.optional(), questions: z.array(z.string().trim().min(1)).refine((x) => new Set(x).size === x.length, 'duplicate questions').optional(), offeredControls: z.array(dialogueControlSchema).max(9).refine((x) => new Set(x).size === x.length, 'duplicate controls').optional() }).strict()
export function validateSubmitArgsDetailed(value: unknown): { ok: true; data: SubmitContractArgs } | { ok: false; code: 'invalid_intent' | 'invalid_questions' | 'invalid_controls' | 'invalid_segments' } {
  if (!value || typeof value !== 'object') return { ok: false, code: 'invalid_segments' }
  const v = value as Record<string, unknown>
  if ('turnIntent' in v && !turnIntentSchema.safeParse(v.turnIntent).success) return { ok: false, code: 'invalid_intent' }
  if ('questions' in v && (!Array.isArray(v.questions) || new Set(v.questions).size !== v.questions.length || v.questions.some((q) => typeof q !== 'string' || !q.trim()))) return { ok: false, code: 'invalid_questions' }
  if ('offeredControls' in v && (!Array.isArray(v.offeredControls) || new Set(v.offeredControls).size !== v.offeredControls.length || v.offeredControls.some((c) => !dialogueControlSchema.safeParse(c).success))) return { ok: false, code: 'invalid_controls' }
  const parsed = submitArgsSchema.safeParse(value)
  return parsed.success ? { ok: true, data: parsed.data as SubmitContractArgs } : { ok: false, code: 'invalid_segments' }
}
export function validateSubmitArgs(value: unknown): value is SubmitContractArgs {
  if (!value || typeof value !== 'object' || !Object.hasOwn(value, 'segments') || Object.keys(value).some((k) => !['segments', 'turnIntent', 'questions', 'offeredControls'].includes(k))) return false
  const segments = (value as { segments?: unknown }).segments
  if (!Array.isArray(segments) || segments.length === 0) return false
  const extra = value as { turnIntent?: unknown; questions?: unknown; offeredControls?: unknown }
  if (extra.turnIntent !== undefined && !turnIntentSchema.safeParse(extra.turnIntent).success) return false
  if (extra.questions !== undefined && (!Array.isArray(extra.questions) || new Set(extra.questions).size !== extra.questions.length || extra.questions.some((q) => typeof q !== 'string' || !q.trim()))) return false
  if (extra.offeredControls !== undefined && (!Array.isArray(extra.offeredControls) || new Set(extra.offeredControls).size !== extra.offeredControls.length || extra.offeredControls.some((c) => !dialogueControlSchema.safeParse(c).success))) return false
  return segments.every((s): s is ActorReplySegment => {
    if (!s || typeof s !== 'object' || Object.keys(s).some((k) => !['kind', 'text', 'evidenceIds'].includes(k))) return false
    const x = s as { kind?: unknown; text?: unknown; evidenceIds?: unknown }
    if (!['dialogue', 'historical_fact', 'verbatim_quote', 'thought_attribution', 'modern_inference', 'modern_external_fact'].includes(String(x.kind)) || typeof x.text !== 'string' || !x.text.trim()) return false
    if (x.evidenceIds !== undefined && (!Array.isArray(x.evidenceIds) || x.evidenceIds.some((id) => typeof id !== 'string' || !id))) return false
    return !['historical_fact', 'verbatim_quote', 'thought_attribution', 'modern_external_fact'].includes(String(x.kind)) || (Array.isArray(x.evidenceIds) && x.evidenceIds.length > 0)
  })
}
export function missingEvidenceDetails(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { segments?: unknown }).segments)) return undefined
  const missing = (value as { segments: unknown[] }).segments.flatMap((segment, index) => {
    if (!segment || typeof segment !== 'object') return []
    const item = segment as { kind?: unknown; evidenceIds?: unknown }
    if (['historical_fact', 'verbatim_quote', 'thought_attribution'].includes(String(item.kind)) && (!Array.isArray(item.evidenceIds) || item.evidenceIds.length === 0)) return [`segments[${index}](${String(item.kind)})`]
    return []
  })
  return missing.length === 0 ? undefined : `以下史实/引文段缺少 evidenceIds：${missing.join('、')}。允许两条修复路径：绑定当前回合 ledger 中真实 evidence ID，或删除这些段/改为 dialogue 或 modern_inference；不得原样重放上一参数。`
}
