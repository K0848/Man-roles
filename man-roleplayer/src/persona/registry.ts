import { readFileSync, readdirSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { personaIdSchema, personaManifestSchema, type PersonaId, type PersonaManifest } from './manifest-schema.ts'
import type { PersonaArtifact } from './artifact.ts'

export interface PersonaDefinition {
  manifest: PersonaManifest
  prompt: string
  anecdotes: readonly unknown[]
  quotes: readonly unknown[]
  blacklist: readonly unknown[]
  readonly id: PersonaId
  readonly displayName: string
  readonly status: PersonaManifest['status']
  readonly legacyIds: readonly string[]
}

export type PersonaDefinitionInput = Omit<PersonaDefinition, 'id' | 'displayName' | 'status' | 'legacyIds'>

function safeContentPath(packageDir: string, value: string, field: string): string {
  if (isAbsolute(value)) throw new Error(`persona content ${field} must be relative: ${value}`)
  const root = resolve(packageDir)
  const target = resolve(root, value)
  const rel = relative(root, target)
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`persona content ${field} escapes package: ${value}`)
  }
  return target
}

function loadJson(path: string, field: string): readonly unknown[] {
  let value: unknown
  try { value = JSON.parse(readFileSync(path, 'utf8')) } catch (error) {
    throw new Error(`cannot load persona ${field} content ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!Array.isArray(value)) throw new Error(`persona ${field} content must be an array: ${path}`)
  return value
}

function assertEntryOwnership(entries: readonly unknown[], id: PersonaId, field: string): void {
  for (const entry of entries) {
      if (field === 'blacklist') {
      if (!entry || typeof entry !== 'object' || !('personaId' in entry) || (entry as { personaId: unknown }).personaId !== id) {
        throw new Error(`persona ${id} ${field} entry ownership mismatch`)
      }
      } else if (field === 'anecdotes' || field === 'quotes') {
      if (!entry || typeof entry !== 'object' || !('personaId' in entry) || (entry as { personaId: unknown }).personaId !== id) {
        throw new Error(`persona ${id} ${field} entry ownership mismatch`)
      }
    }
  }
}

export class PersonaRegistry {
  private readonly definitions: ReadonlyMap<PersonaId, PersonaDefinition>
  private readonly legacyToCanonical: ReadonlyMap<string, PersonaId>

  constructor(definitions: readonly PersonaDefinitionInput[]) {
    const canonical = new Map<PersonaId, PersonaDefinition>()
    const legacy = new Map<string, PersonaId>()
    for (const definition of definitions) {
      const parsed = personaManifestSchema.parse(definition.manifest)
      if (canonical.has(parsed.id)) throw new Error(`duplicate canonical PersonaId: ${parsed.id}`)
      const normalized: PersonaDefinition = {
        ...definition,
        id: parsed.id,
        displayName: parsed.displayName,
        status: parsed.status,
        legacyIds: parsed.legacyIds,
      }
      assertEntryOwnership(normalized.anecdotes, parsed.id, 'anecdotes')
      assertEntryOwnership(normalized.quotes, parsed.id, 'quotes')
      assertEntryOwnership(normalized.blacklist, parsed.id, 'blacklist')
      canonical.set(parsed.id, normalized)
      for (const legacyId of parsed.legacyIds) {
        if (legacy.has(legacyId) || canonical.has(legacyId)) throw new Error(`duplicate legacy PersonaId: ${legacyId}`)
        legacy.set(legacyId, parsed.id)
      }
    }
    for (const [id] of canonical) {
      if (legacy.has(id)) throw new Error(`canonical PersonaId conflicts with legacy ID: ${id}`)
    }
    this.definitions = canonical
    this.legacyToCanonical = legacy
  }

  static fromArtifact(artifact: PersonaArtifact): PersonaRegistry {
    return new PersonaRegistry(artifact)
  }

  get(id: string): PersonaDefinition {
    // Runtime/domain callers must provide canonical IDs. Persisted legacy IDs
    // are normalized only by explicit load/replay boundaries below.
    const canonical = personaIdSchema.parse(id)
    const definition = this.definitions.get(canonical)
    if (!definition) throw new Error(`unknown PersonaId: ${id}`)
    return definition
  }

  normalizePersistedId(id: string): PersonaId {
    const parsed = personaIdSchema.safeParse(id)
    if (parsed.success && this.definitions.has(parsed.data)) return parsed.data
    const canonical = this.legacyToCanonical.get(id)
    if (canonical) return canonical
    throw new Error(`unknown PersonaId: ${id}`)
  }

  listActive(): PersonaDefinition[] {
    return [...this.definitions.values()].filter((d) => d.manifest.status === 'active')
      .sort((a, b) => a.manifest.id.localeCompare(b.manifest.id))
  }

  list(): PersonaDefinition[] { return [...this.definitions.values()].sort((a, b) => a.manifest.id.localeCompare(b.manifest.id)) }

  canCreate(id: string): boolean { return this.get(id).manifest.status === 'active' }

  requireKnownForRestore(id: string): PersonaDefinition { return this.get(id) }

  requireActiveForCreate(id: string): PersonaDefinition {
    const definition = this.get(id)
    if (definition.manifest.status !== 'active') throw new Error(`retired PersonaId cannot be created: ${id}`)
    return definition
  }

  static fromDirectory(rootDir: string): PersonaRegistry {
    const root = resolve(rootDir)
    const names = readdirSync(root).filter((name) => statSafe(join(root, name))?.isDirectory()).sort()
    const definitions = names.map((name) => {
      const packageDir = join(root, name)
      const manifestPath = join(packageDir, 'manifest.json')
      let manifest: PersonaManifest
      try { manifest = personaManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8'))) } catch (error) {
        throw new Error(`invalid persona manifest ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`)
      }
      if (manifest.id !== name) throw new Error(`manifest id ${manifest.id} does not match package directory ${name}`)
      const promptPath = safeContentPath(packageDir, manifest.content.prompt, 'prompt')
      const anecdotesPath = safeContentPath(packageDir, manifest.content.anecdotes, 'anecdotes')
      const quotesPath = safeContentPath(packageDir, manifest.content.quotes, 'quotes')
      const blacklistPath = safeContentPath(packageDir, manifest.content.blacklist, 'blacklist')
      const definition = { manifest, prompt: readFileChecked(promptPath), anecdotes: loadJson(anecdotesPath, 'anecdotes'), quotes: loadJson(quotesPath, 'quotes'), blacklist: loadJson(blacklistPath, 'blacklist') }
      assertEntryOwnership(definition.anecdotes, manifest.id, 'anecdotes')
      assertEntryOwnership(definition.quotes, manifest.id, 'quotes')
      assertEntryOwnership(definition.blacklist, manifest.id, 'blacklist')
      return definition
    })
    return new PersonaRegistry(definitions)
  }
}

function readFileChecked(path: string): string {
  try { return readFileSync(path, 'utf8') } catch (error) { throw new Error(`missing persona content ${path}: ${error instanceof Error ? error.message : String(error)}`) }
}
function statSafe(path: string) { try { return statSync(path) } catch { return undefined } }
