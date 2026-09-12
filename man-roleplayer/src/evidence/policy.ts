import type { PersonaId } from '../domain/schema.ts'
import type { ContentLibraries } from '../retrieval/retrieve.ts'
import { EvidenceLedger } from './ledger.ts'
import type { ActorReplySegment, EvidenceValidationResult } from './types.ts'

export function validateActorReply(segments: ActorReplySegment[], ledger: EvidenceLedger, libs: ContentLibraries, personaId: PersonaId): EvidenceValidationResult {
  const violations: EvidenceValidationResult['violations'] = []
  if (ledger.personaId !== personaId) violations.push({ code: 'persona-mismatch', detail: '证据账本人物与当前人物不一致' })
  segments.forEach((segment, index) => {
    const ids = segment.evidenceIds ?? []
    if (segment.kind === 'historical_fact' || segment.kind === 'thought_attribution' || segment.kind === 'modern_external_fact') {
      if (!ids.some((id) => ledger.hasCurrentGrant(id))) violations.push({ code: 'missing-current-grant', segmentIndex: index, detail: `${segment.kind} 缺少当前人物当前回合证据授权` })
    }
    if (segment.kind === 'modern_external_fact' && !ids.some((id) => ledger.hasCurrentGrant(id, 'web'))) violations.push({ code: 'missing-web-grant', segmentIndex: index, detail: '现代外部事实必须绑定当前回合 web evidence' })
    if (segment.kind !== 'modern_external_fact' && ids.some((id) => ledger.get(id)?.kind === 'web')) violations.push({ code: 'web-evidence-kind-mismatch', segmentIndex: index, detail: 'web evidence 只能支持 modern_external_fact' })
    if (segment.kind === 'historical_fact' && !ids.some((id) => ledger.hasCurrentGrant(id, 'anecdote'))) {
      violations.push({ code: 'missing-anecdote-grant', segmentIndex: index, detail: '历史事迹必须由当前人物当前回合的 anecdote evidence 授权' })
    }
    if (segment.kind === 'verbatim_quote') {
      const quoteIds = ids.filter((id) => ledger.hasCurrentGrant(id, 'quote'))
      if (quoteIds.length === 0) violations.push({ code: 'missing-quote-grant', segmentIndex: index, detail: '原话缺少当前回合语录证据授权' })
      else if (quoteIds.length !== 1 || ids.length !== 1) violations.push({ code: 'ambiguous-quote-evidence', segmentIndex: index, detail: '逐字原话必须由唯一当前回合语录 evidence ID 确定' })
      else if (!quoteIds.some((id) => {
        const q = libs.quotes.byId(id)
        return q !== undefined && q.personaId === personaId
      })) violations.push({ code: 'unknown-quote-id', segmentIndex: index, detail: '语录 evidence ID 不属于当前人物库' })
    }
    for (const id of ids) {
      const grant = ledger.get(id)
      if (grant === undefined || grant.personaId !== personaId || grant.turnId !== ledger.turnId) violations.push({ code: 'invalid-evidence-grant', segmentIndex: index, detail: `证据 ID 未由当前人物当前回合工具授予: ${id}` })
      else if (grant.kind === 'quote' && libs.quotes.byId(id) === undefined || grant.kind === 'anecdote' && libs.anecdotes.byId(id) === undefined) violations.push({ code: 'unknown-evidence-id', segmentIndex: index, detail: `未知证据 ID: ${id}` })
    }
  })
  // Canonicalize quote text before blacklist and rendering. The submitted
  // text is untrusted model output and must never become public text.
  const canonicalSegments = segments.map((segment) => {
    const [evidenceId] = segment.evidenceIds ?? []
    if (segment.kind !== 'verbatim_quote' || segment.evidenceIds?.length !== 1 || evidenceId === undefined) return segment
    const quote = libs.quotes.byId(evidenceId)
    return quote && quote.personaId === personaId ? { ...segment, text: quote.text } : segment
  })
  const whole = canonicalSegments.map((s) => s.text).join('\n')
  const hit = libs.blacklist.matchText(whole, personaId, 'actor-reply')
  if (hit) violations.push({ code: hit.mode === 'first-person' ? 'forbidden-first-person' : 'blacklisted-quote', detail: `回答命中黑名单: ${hit.text}` })
  return { ok: violations.length === 0, violations, segments: canonicalSegments }
}
