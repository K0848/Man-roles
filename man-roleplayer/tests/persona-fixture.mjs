import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PersonaRegistry } from '../lib/persona-registry.js'

/** Shared generic registry for domain tests; no historical names or aliases. */
export function makePersonaRegistry(root, { includeRetired = true } = {}) {
  const ids = ['alpha', 'beta', 'gamma', ...(includeRetired ? ['delta'] : [])]
  for (const id of ids) {
    const dir = join(root, id)
    mkdirSync(dir, { recursive: true })
    const manifest = {
      id, displayName: id, status: id === 'delta' ? 'retired' : 'active', legacyIds: [`旧-${id}`],
      content: { prompt: 'persona.md', anecdotes: 'anecdotes.json', quotes: 'quotes.json', blacklist: 'blacklist.json' },
    }
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest))
    writeFileSync(join(dir, 'persona.md'), `prompt-${id}`)
    writeFileSync(join(dir, 'anecdotes.json'), '[]')
    writeFileSync(join(dir, 'quotes.json'), '[]')
    writeFileSync(join(dir, 'blacklist.json'), '[]')
  }
  return PersonaRegistry.fromDirectory(root)
}

export function fixtureRoot(prefix = 'persona-domain-') {
  return join(process.env.TMPDIR ?? process.env.TEMP ?? '.', `${prefix}${Date.now()}-${Math.random().toString(16).slice(2)}`)
}
