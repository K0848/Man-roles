import type { PersonaId } from '../domain/schema.ts'
import type { EvidenceGrant, EvidenceKind } from './types.ts'

/** 当前人物、当前回合的临时授权账本；只记录工具成功返回过的 ID。 */
export class EvidenceLedger {
  private readonly grants = new Map<string, EvidenceGrant>()
  constructor(readonly personaId: PersonaId, readonly turnId: string) {}

  grant(grant: EvidenceGrant): boolean {
    if (grant.personaId !== this.personaId || grant.turnId !== this.turnId || !grant.evidenceId) return false
    this.grants.set(grant.evidenceId, { ...grant })
    return true
  }

  hasCurrentGrant(evidenceId: string, kind?: EvidenceKind): boolean {
    const grant = this.grants.get(evidenceId)
    return grant !== undefined && grant.personaId === this.personaId && grant.turnId === this.turnId && (kind === undefined || grant.kind === kind)
  }

  get(evidenceId: string): EvidenceGrant | undefined { return this.grants.get(evidenceId) }
  entries(): EvidenceGrant[] { return [...this.grants.values()].map((g) => ({ ...g })) }
  clear(): void { this.grants.clear() }
}
