import type { PersonaManifest, PersonaId } from './manifest-schema.ts'

export interface PersonaArtifactEntry {
  readonly manifest: PersonaManifest
  prompt: string
  anecdotes: readonly unknown[]
  quotes: readonly unknown[]
  blacklist: readonly unknown[]
}
export type PersonaArtifact = readonly PersonaArtifactEntry[]
export function artifactById(artifact: PersonaArtifact): ReadonlyMap<PersonaId, PersonaArtifactEntry> {
  return new Map(artifact.map((entry) => [entry.manifest.id, entry]))
}
