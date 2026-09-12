export interface ProjectedEvidence { id: string; kind: 'quote' | 'anecdote'; source: string; credibility?: string; title?: string }
import { isDialogueControl, isTurnIntent } from '../dialogue/public-contract.ts'
export interface ActorReplyResult { kind: 'actor-reply'; reply: string; evidence: ProjectedEvidence[]; turnIntent?: string; questions?: string[]; controls?: string[]; fallback?: boolean }
interface SessionEvent { type: string; data?: unknown }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
function callIdFromSource(source: unknown): string | undefined { if (!isRecord(source) || typeof source.callId !== 'string') return undefined; return source.callId }
function toolCallIdFromContent(content: unknown): string | undefined { if (!Array.isArray(content)) return undefined; const first: unknown = content[0]; return isRecord(first) && typeof first.toolCallId === 'string' ? first.toolCallId : undefined }
function isProjectedEvidence(value: unknown): value is ProjectedEvidence { if (!isRecord(value) || typeof value.id !== 'string' || (value.kind !== 'quote' && value.kind !== 'anecdote') || typeof value.source !== 'string') return false; return (value.credibility === undefined || typeof value.credibility === 'string') && (value.title === undefined || typeof value.title === 'string') }
function isProjectedEvidenceArray(value: unknown): value is ProjectedEvidence[] { return Array.isArray(value) && value.every(isProjectedEvidence) }
function isPublicMeta(value: Record<string, unknown>): boolean { return (value.turnIntent === undefined || isTurnIntent(value.turnIntent)) && (value.questions === undefined || (Array.isArray(value.questions) && value.questions.every((q) => typeof q === 'string'))) && (value.controls === undefined || (Array.isArray(value.controls) && value.controls.every(isDialogueControl))) }
export function parseActorReplyMeta(value: unknown): ActorReplyResult | undefined {
  if (!isRecord(value) || value.kind !== 'actor-reply' || typeof value.reply !== 'string' || !isProjectedEvidenceArray(value.evidence) || !isPublicMeta(value)) return undefined
  return { kind: 'actor-reply', reply: value.reply, evidence: value.evidence, ...(typeof value.turnIntent === 'string' ? { turnIntent: value.turnIntent } : {}), ...(Array.isArray(value.questions) ? { questions: value.questions as string[] } : {}), ...(Array.isArray(value.controls) ? { controls: value.controls as string[] } : {}), ...(value.fallback === true ? { fallback: true } : {}) }
}
export function projectActorReply(events: readonly SessionEvent[], turn: number): ActorReplyResult | undefined {
  const calls = new Set<string>(); let result: ActorReplyResult | undefined; let active: number | undefined
  for (const event of events) { const data = event.data; if (!isRecord(data)) continue; const turnValue = data.turn; if (event.type === 'turn/start' && typeof turnValue === 'number') active = turnValue; if (event.type === 'turn/end' && turnValue === active) { active = undefined; continue } if (active !== turn) continue; if (event.type === 'tool/call' && data.name === 'submit_actor_reply' && typeof data.callId === 'string') calls.add(data.callId); if (event.type === 'tool/result') { const message = isRecord(data.message) ? data.message : undefined; const callId = callIdFromSource(message?.source) ?? toolCallIdFromContent(data.content); if (!callId || !calls.has(callId)) continue; const parsed = parseActorReplyMeta(data.meta); if (!parsed) continue; if (result) return undefined; result = parsed } }
  return result
}
