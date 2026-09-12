import { PersonaRegistry } from './registry.ts'
import { CONTENT_PACK } from './content-pack.ts'

/** Runtime/e2e registry source; manifests remain the only registration data. */
export function createRuntimeRegistry(): PersonaRegistry {
  return PersonaRegistry.fromArtifact(CONTENT_PACK)
}
