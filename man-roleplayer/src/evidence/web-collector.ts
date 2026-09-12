export interface WebEvidence { id: string; url: string; title: string; snippet: string; personaId: string; turnId: string }
export function collectWebEvidence(input: { personaId: string; turnId: string; results: Array<{ url: string; title?: string; snippet?: string }> }): WebEvidence[] {
  return input.results.filter(x => /^https?:\/\//i.test(x.url)).map((x, i) => ({ id: `web-${input.turnId}-${i}`, url: x.url, title: x.title ?? '', snippet: x.snippet ?? '', personaId: input.personaId, turnId: input.turnId }))
}
export function evidenceForTurn(evidence: WebEvidence[], personaId: string, turnId: string): WebEvidence[] { return evidence.filter(x => x.personaId === personaId && x.turnId === turnId) }
/** Bounded adapter wrapper: timeout/unavailable search degrades without ledger pollution. */
export async function searchWithFallback<T>(search: () => Promise<T>, timeoutMs = 5000): Promise<{ ok: true; value: T } | { ok: false; reason: 'timeout' | 'unavailable' }> {
  try {
    const value = await Promise.race([search(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))])
    return { ok: true, value }
  } catch (error) {
    return { ok: false, reason: error instanceof Error && error.message === 'timeout' ? 'timeout' : 'unavailable' }
  }
}
