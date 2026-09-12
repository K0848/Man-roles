import { PersonaRegistry } from './registry.ts'
import type { PersonaArtifact } from './artifact.ts'
import type { PersonaManifest } from './manifest-schema.ts'

/** Pure scanner facade used by build and dynamic third-person tests. */
export function scanPersonaArtifact(rootDir: string): PersonaArtifact {
  const registry = PersonaRegistry.fromDirectory(rootDir)
  return registry.list().map((definition) => ({ manifest: definition.manifest, prompt: definition.prompt, anecdotes: definition.anecdotes, quotes: definition.quotes, blacklist: definition.blacklist }))
}
export interface GeneratedRegistryArtifacts { host: PersonaArtifact; client: readonly Pick<PersonaManifest, 'id' | 'displayName' | 'status'>[] }
export function generateRegistryArtifacts(rootDir: string): GeneratedRegistryArtifacts {
  const host = scanPersonaArtifact(rootDir)
  return { host, client: host.filter((entry) => entry.manifest.status === 'active').map(({ manifest }) => ({ id: manifest.id, displayName: manifest.displayName, status: manifest.status })) }
}
