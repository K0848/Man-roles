import { CONTENT_PACK } from '../persona/content-pack.ts'
import type { PersonaId } from '../domain/schema.ts'
import type { PersonaSpec } from './assemble.ts'
import { buildPersonaSpec } from './persona.ts'

let cached: Record<string, PersonaSpec> | undefined
export function buildPersonas(): Record<string, PersonaSpec> {
  if (cached !== undefined) return cached
  cached = Object.fromEntries(CONTENT_PACK.map((entry) => {
    const { id, displayName } = entry.manifest
    return [id, buildPersonaSpec(id, displayName, entry.prompt)]
  }))
  return cached
}
export function personaSpecFor(id: PersonaId): PersonaSpec {
  const spec = buildPersonas()[id]
  if (spec === undefined) throw new Error(`unknown PersonaId: ${id}`)
  return spec
}
