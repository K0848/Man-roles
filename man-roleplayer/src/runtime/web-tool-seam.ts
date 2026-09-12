import { collectWebEvidence } from '../evidence/web-collector.ts'
import type { EvidenceLedger } from '../evidence/ledger.ts'
export async function runWebSearchSeam(search: (query: string) => Promise<Array<{ url: string; title?: string; snippet?: string }>>, query: string, personaId: string, turnId: string, ledger: EvidenceLedger): Promise<{ ok: true; results: ReturnType<typeof collectWebEvidence> } | { ok: false; errorCode: 'web-search-unavailable' }> {
  try { const results = collectWebEvidence({ personaId, turnId, results: await search(query) }); for (const item of results) ledger.grant({ evidenceId: item.id, kind: 'web', personaId: personaId as never, turnId }); return { ok: true, results } } catch { return { ok: false, errorCode: 'web-search-unavailable' } }
}
