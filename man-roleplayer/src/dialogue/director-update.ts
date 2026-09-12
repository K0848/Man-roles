import { createHash } from 'node:crypto'
import { z } from 'zod'
import { dilemmaItemSchema, type PersonaId, type TrunkState } from '../domain/schema.ts'
import { personaIdSchema } from '../persona/manifest-schema.ts'
import type { TrunkStorage } from '../storage/trunk-storage.ts'
import type { PersonaRegistry } from '../persona/registry.ts'

const proposalSchema = z.object({ id: z.string().min(1).optional(), kind: z.enum(['fact', 'inference', 'goal', 'value-conflict', 'core-conflict']), text: z.string().min(1), sourceRawRefs: z.array(z.string().min(1)).min(1), proposedByPersona: personaIdSchema }).strict()
export const directorUpdateSchema = z.object({ propose: z.array(proposalSchema), coreCandidateId: z.string().min(1).optional() }).strict()
export type CandidateProposal = z.infer<typeof proposalSchema>
export type DirectorUpdate = z.infer<typeof directorUpdateSchema>
const idFor = (p: CandidateProposal): string => `candidate-${createHash('sha256').update(JSON.stringify([p.kind, p.text, p.sourceRawRefs, p.proposedByPersona])).digest('hex').slice(0, 20)}`
export function validateDirectorUpdate(value: unknown, state: TrunkState, personaId: PersonaId, registry: PersonaRegistry): DirectorUpdate {
  registry.get(personaId)
  const parsed = directorUpdateSchema.parse(value); const seen = new Set<string>()
  const propose = parsed.propose.map((raw) => {
    if (raw.proposedByPersona !== personaId) throw new Error('director proposal must belong to current persona')
    registry.get(raw.proposedByPersona)
    if (raw.sourceRawRefs.some((ref) => !state.userRaws.some((u) => u.rawRef === ref))) throw new Error('candidate source raw_ref missing')
    const canonicalRefs = [...new Set(raw.sourceRawRefs)].sort((a, b) => (state.userRaws.find((u) => u.rawRef === a)?.ref ?? Number.MAX_SAFE_INTEGER) - (state.userRaws.find((u) => u.rawRef === b)?.ref ?? Number.MAX_SAFE_INTEGER))
    const canonicalProposal = { ...raw, sourceRawRefs: canonicalRefs, proposedByPersona: personaId }
    const item = { ...canonicalProposal, id: raw.id ?? idFor(canonicalProposal) }
    if (seen.has(item.id)) throw new Error('duplicate candidate id'); seen.add(item.id); return item
  })
  if (parsed.coreCandidateId !== undefined && (!seen.has(parsed.coreCandidateId) || propose.find((p) => p.id === parsed.coreCandidateId)?.kind !== 'core-conflict')) throw new Error('coreCandidateId must reference this batch core-conflict')
  return { propose, ...(parsed.coreCandidateId === undefined ? {} : { coreCandidateId: parsed.coreCandidateId }) }
}
export interface DirectorCommitInput { update: unknown; state: TrunkState; personaId: PersonaId; trunk: TrunkStorage; messageId: string; taskId: string; eventPurpose: string; sourceRawRefs: string[] }
export function commitDirectorUpdate(input: DirectorCommitInput): { itemIds: string[]; coreCandidateId?: string } {
  const update = validateDirectorUpdate(input.update, input.state, input.personaId, input.trunk.registry); const itemIds: string[] = []
  const canonicalRefs = (refs: string[]) => [...new Set(refs)].sort((a, b) => {
    const ar = input.state.userRaws.find((raw) => raw.rawRef === a)?.ref ?? Number.MAX_SAFE_INTEGER
    const br = input.state.userRaws.find((raw) => raw.rawRef === b)?.ref ?? Number.MAX_SAFE_INTEGER
    return ar - br || a.localeCompare(b)
  })
  const items = update.propose.map((proposal) => {
    // The item owns only the refs explicitly cited by the director proposal.
    // Current-turn refs belong to the durable event metadata, not the item.
    const normalized = { ...proposal, sourceRawRefs: canonicalRefs(proposal.sourceRawRefs), status: 'candidate' as const, visibility: 'origin-persona-only' as const, revision: 1 }
    return dilemmaItemSchema.parse({ ...normalized, id: proposal.id ?? idFor({ kind: normalized.kind, text: normalized.text, sourceRawRefs: normalized.sourceRawRefs, proposedByPersona: normalized.proposedByPersona }) })
  })
  // Preflight every business key before the first append. This prevents a
  // predictable collision in a later proposal from partially committing a batch.
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`duplicate candidate id: ${item.id}`)
    ids.add(item.id)
    const existing = input.state.dilemmaItems.find((x) => x.id === item.id)
    if (existing && JSON.stringify(existing) !== JSON.stringify(item)) throw new Error(`dilemma item conflict: ${item.id}`)
  }
  for (const item of items) {
    const eventRefs = canonicalRefs([...input.sourceRawRefs, ...item.sourceRawRefs])
    input.trunk.preflightDialogueEvent('trunk/dilemma-item-proposed', { messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurpose}:${item.id}`, sourceRawRefs: eventRefs, item, personaId: item.proposedByPersona })
  }
  for (const item of items) {
    const eventRefs = canonicalRefs([...input.sourceRawRefs, ...item.sourceRawRefs])
    input.trunk.proposeDilemmaItem(item, { messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurpose}:${item.id}`, sourceRawRefs: eventRefs }); itemIds.push(item.id)
  }
  return { itemIds, ...(update.coreCandidateId === undefined ? {} : { coreCandidateId: update.coreCandidateId }) }
}
export const commitDirectorProposals = commitDirectorUpdate
