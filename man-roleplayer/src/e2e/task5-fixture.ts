import { PersonaRegistry } from '../persona/registry.ts'
import type { PersonaManifest } from '../persona/manifest-schema.ts'

/** Generic, local-only fixture for restart tests. Production content is not used. */
export const TASK5_FIXTURE_IDS = ['alpha', 'beta', 'gamma'] as const

export function createTask5FixtureRegistry(): PersonaRegistry {
  return new PersonaRegistry(TASK5_FIXTURE_IDS.map((id) => {
    const manifest: PersonaManifest = {
      id, displayName: id, status: 'active', legacyIds: [`legacy-${id}`],
      content: { prompt: 'persona.md', anecdotes: 'anecdotes.json', quotes: 'quotes.json', blacklist: 'blacklist.json' },
    }
    const entry = { personaId: id, id: `${id}-fixture`, text: `fixture-${id}`, source: `fixture-${id}` }
    return { manifest, prompt: `fixture prompt ${id}`, anecdotes: [entry], quotes: [entry], blacklist: [entry] }
  }))
}
