import type { PersonaRegistry } from '../persona/registry.ts'
export function requireRuntimePersona(registry: PersonaRegistry, personaId: string) { return registry.get(personaId).id }
export function requireCreatePersona(registry: PersonaRegistry, personaId: string) { return registry.requireActiveForCreate(personaId).id }
