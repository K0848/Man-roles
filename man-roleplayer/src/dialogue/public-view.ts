import type { PersonaId, TrunkState, DilemmaItem } from '../domain/schema.ts'
import type { PersonaRegistry } from '../persona/registry.ts'
export interface ActorContext { personaId: PersonaId; currentRaw: string; currentRawRef: string; selectedHistoricalRawRefs: string[]; raw: string; historicalRaws: string[]; currentBranchHistory: readonly string[]; confirmedItems: DilemmaItem[]; candidateItems: Array<DilemmaItem & { unconfirmed: true }>; branchProgress: TrunkState['branchProgress'][string] | null; persona: { id: PersonaId; displayName: string; status: string; prompt: string } }
export interface PublicDialogueView { dilemmaItems: DilemmaItem[]; branchProgress: TrunkState['branchProgress'][string] | null; dialogue: TrunkState['dialogue']; branches: Record<string, { progress: TrunkState['branchProgress'][string] | null }> }
function canonical(id: string, registry: PersonaRegistry): PersonaId { return registry.get(id).id }
/** Validate and canonicalize user-selected historical pointers before any model or actor work. */
export function validateSelectedHistoricalRawRefs(state: TrunkState, refs: readonly string[]): string[] {
  const unique = [...new Set(refs)]
  if (unique.some((ref) => !state.userRaws.some((raw) => raw.rawRef === ref))) throw new Error('historical raw ref missing')
  return unique.sort((a, b) => {
    const ar = state.userRaws.find((raw) => raw.rawRef === a)?.ref ?? Number.MAX_SAFE_INTEGER
    const br = state.userRaws.find((raw) => raw.rawRef === b)?.ref ?? Number.MAX_SAFE_INTEGER
    return ar - br || a.localeCompare(b)
  })
}
export function buildActorContext(state: TrunkState, persona: string, registry: PersonaRegistry, currentRawRef: string, selectedHistoricalRawRefs: string[] = [], currentBranchHistory: readonly string[] = []): ActorContext {
  const personaId = canonical(persona, registry); const definition = registry.get(personaId)
  if (!currentRawRef) throw new Error('currentRawRef is required')
  const current = state.userRaws.find((r) => r.rawRef === currentRawRef)
  if (!current) throw new Error(`current raw ref missing: ${currentRawRef}`)
  const refs = validateSelectedHistoricalRawRefs(state, selectedHistoricalRawRefs)
  const raws = refs.map((ref) => { const raw = state.userRaws.find((r) => r.rawRef === ref); if (!raw) throw new Error(`historical raw ref missing: ${ref}`); return raw })
  return { personaId, currentRaw: current.text, currentRawRef, selectedHistoricalRawRefs: refs, raw: current.text, historicalRaws: raws.map((r) => r.text), currentBranchHistory, persona: { id: definition.id, displayName: definition.displayName, status: definition.status, prompt: definition.prompt }, confirmedItems: state.dilemmaItems.filter((x) => x.status === 'confirmed' && x.visibility === 'shared-confirmed' && !x.supersededBy), candidateItems: state.dilemmaItems.filter((x) => x.status === 'candidate' && x.visibility === 'origin-persona-only' && x.proposedByPersona === personaId && !x.supersededBy).map((x) => ({ ...x, unconfirmed: true as const })), branchProgress: state.branchProgress[personaId] ?? null }
}
export function publicDialogueView(state: TrunkState, persona: string, registry: PersonaRegistry): PublicDialogueView {
  const id = canonical(persona, registry); const branches: Record<string, { progress: TrunkState['branchProgress'][string] | null }> = {}
  for (const key of Object.keys(state.branchesIndex)) branches[key] = { progress: state.branchProgress[key] ?? null }
  return { dilemmaItems: state.dilemmaItems.filter((x) => (x.status === 'confirmed' && x.visibility === 'shared-confirmed' && !x.supersededBy) || (x.status === 'candidate' && x.proposedByPersona === id && !x.supersededBy)), branchProgress: state.branchProgress[id] ?? null, dialogue: state.dialogue, branches }
}
