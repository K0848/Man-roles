import type { PersonaId } from '../domain/schema.ts'
import { renderVerifiedReply } from '../evidence/render.ts'
import { validateActorReply } from '../evidence/policy.ts'
import { EvidenceLedger } from '../evidence/ledger.ts'
import type { ActorReplySegment } from '../evidence/types.ts'
import type { ContentLibraries } from '../retrieval/retrieve.ts'
import { validateSubmitArgsDetailed } from './actor-tool-contract.ts'

export interface SubmitActorReplyArgs { segments: ActorReplySegment[]; turnIntent?: import('../dialogue/types.ts').TurnInstruction['intent']; questions?: string[]; offeredControls?: Array<import('../dialogue/types.ts').TurnInstruction['allowedControls'][number]> }
/** Typed actor boundary: actor may propose intent/controls, but never commits trunk state. */
export interface ActorResult { reply: string; turnIntent?: import('../dialogue/types.ts').TurnInstruction['intent']; questions?: string[]; controls?: Array<import('../dialogue/types.ts').TurnInstruction['allowedControls'][number]>; evidence?: Array<{ id: string; kind: 'quote' | 'anecdote'; source: string }>; retrievalCalls?: number; progressSummary?: string | null }
export interface SubmitActorReplyResult { ok: boolean; reply?: string; turnIntent?: SubmitActorReplyArgs['turnIntent']; questions?: string[]; controls?: SubmitActorReplyArgs['offeredControls']; evidence?: Array<{ id: string; kind: 'quote' | 'anecdote'; source: string; credibility?: string; title?: string }>; violations?: ReturnType<typeof validateActorReply>['violations']; repaired?: boolean; fallback?: boolean; concluded?: boolean; diagnostics?: { attempt: number; errorCode: string; repairable: boolean; fallback: boolean; concluded: boolean; violations: Array<{ code: string; segmentIndex?: number }> } }

/** 提交门：最多一次修复；仍失败时只结束执行，不替人物生成系统话术。 */
export function submitActorReply(args: SubmitActorReplyArgs, deps: { ledger: EvidenceLedger; libs: ContentLibraries; personaId: PersonaId; concludeTurn?: () => void; diagnosticAttempt?: number }): SubmitActorReplyResult {
  const shape = validateSubmitArgsDetailed(args)
  if (!shape.ok) return { ok: false, violations: [{ code: shape.code, detail: `invalid submit field: ${shape.code}` }], concluded: false }
  args = { ...args, ...(args.questions === undefined ? {} : { questions: args.questions.map((q) => q.trim()) }) }
  const checked = validateActorReply(args.segments, deps.ledger, deps.libs, deps.personaId)
  if (!checked.ok) return { ok: false, violations: checked.violations, concluded: false, diagnostics: { attempt: deps.diagnosticAttempt ?? 1, errorCode: checked.violations[0]?.code ?? 'invalid-submit', repairable: true, fallback: false, concluded: false, violations: checked.violations.map((v) => ({ code: v.code, ...(v.segmentIndex === undefined ? {} : { segmentIndex: v.segmentIndex }) })) } }
  const evidence = [...new Set(checked.segments.flatMap((s) => s.evidenceIds ?? []))].map((id) => { const q = deps.libs.quotes.byId(id); if (q) return { id, kind: 'quote' as const, source: q.source, credibility: q.credibility }; const a = deps.libs.anecdotes.byId(id); return a ? { id, kind: 'anecdote' as const, source: a.source, title: a.title } : undefined }).filter((x): x is NonNullable<typeof x> => Boolean(x))
  deps.concludeTurn?.()
  return { ok: true, reply: renderVerifiedReply(checked.segments, deps.libs, args.questions), ...(args.turnIntent === undefined ? {} : { turnIntent: args.turnIntent }), ...(args.questions === undefined ? {} : { questions: args.questions }), ...(args.offeredControls === undefined ? {} : { controls: args.offeredControls }), evidence, concluded: true, repaired: false }
}

export function submitWithOneRepair(initial: SubmitActorReplyArgs, repair: (violations: NonNullable<SubmitActorReplyResult['violations']>) => SubmitActorReplyArgs | undefined, deps: Parameters<typeof submitActorReply>[1]): SubmitActorReplyResult {
  const first = submitActorReply(initial, deps)
  if (first.ok || !repair || !first.violations) return first
  const repaired = repair(first.violations)
  if (!repaired) { deps.concludeTurn?.(); return { ...first, fallback: true, concluded: true } }
  const second = submitActorReply(repaired, deps)
  if (second.ok) return { ...second, repaired: true }
  deps.concludeTurn?.()
  return second.violations ? { ok: false, fallback: true, concluded: true, violations: second.violations } : { ok: false, fallback: true, concluded: true }
}
