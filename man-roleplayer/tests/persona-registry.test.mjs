import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PersonaRegistry } from '../lib/persona-registry.js'

function fixture(manifest, root = mkdtempSync(join(tmpdir(), 'persona-registry-'))) {
  const dir = join(root, manifest.id); mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest))
  for (const [name, value] of [['persona.md', 'prompt'], ['anecdotes.json', []], ['quotes.json', []], ['blacklist.json', []]]) writeFileSync(join(dir, name), typeof value === 'string' ? value : JSON.stringify(value))
  return root
}
const manifest = (id, legacyIds = [`旧-${id}`]) => ({ id, displayName: id, status: 'active', legacyIds, content: { prompt: 'persona.md', anecdotes: 'anecdotes.json', quotes: 'quotes.json', blacklist: 'blacklist.json' } })

test('Registry deterministic list, normalize, and lifecycle guards', () => {
  const root = mkdtempSync(join(tmpdir(), 'persona-registry-')); fixture(manifest('beta'), root); fixture(manifest('alpha'), root)
  const registry = PersonaRegistry.fromDirectory(root)
  assert.deepEqual(registry.listActive().map((x) => x.id), ['alpha', 'beta'])
  assert.equal(registry.normalizePersistedId('旧-beta'), 'beta')
  assert.throws(() => registry.get('旧-beta'), /PersonaId|unknown/)
  assert.throws(() => registry.requireKnownForRestore('旧-beta'), /PersonaId|unknown/)
  assert.throws(() => registry.requireActiveForCreate('旧-beta'), /PersonaId|unknown/)
  assert.equal(registry.requireActiveForCreate('alpha').id, 'alpha')
  assert.throws(() => registry.get('missing'), /unknown PersonaId/)
})

test('Registry rejects duplicate canonical and legacy IDs', () => {
  const root = mkdtempSync(join(tmpdir(), 'persona-registry-')); fixture(manifest('alpha', ['same']), root); fixture(manifest('beta', ['same']), root)
  assert.throws(() => PersonaRegistry.fromDirectory(root), /duplicate legacy/)
  const root2 = mkdtempSync(join(tmpdir(), 'persona-registry-')); fixture(manifest('alpha', ['alpha']), root2)
  assert.throws(() => PersonaRegistry.fromDirectory(root2), /canonical.*legacy|duplicate legacy/)
})

test('Registry rejects traversal, absolute refs, missing files, directory mismatch and ownership mismatch', () => {
  const root = mkdtempSync(join(tmpdir(), 'persona-registry-')); const m = manifest('alpha'); m.content.prompt = '../secret.md'; fixture(m, root)
  assert.throws(() => PersonaRegistry.fromDirectory(root), /escapes package/)
  const root2 = mkdtempSync(join(tmpdir(), 'persona-registry-')); const m2 = manifest('alpha'); m2.content.prompt = join(root2, 'x'); fixture(m2, root2)
  assert.throws(() => PersonaRegistry.fromDirectory(root2), /relative/)
  const root3 = mkdtempSync(join(tmpdir(), 'persona-registry-')); const dir = join(root3, 'alpha'); mkdirSync(dir); writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest('beta')))
  assert.throws(() => PersonaRegistry.fromDirectory(root3), /does not match/)
})

test('retired definitions restore but cannot create', () => {
  const root = mkdtempSync(join(tmpdir(), 'persona-registry-')); const m = manifest('retired'); m.status = 'retired'; fixture(m, root)
  const registry = PersonaRegistry.fromDirectory(root)
  assert.equal(registry.requireKnownForRestore('retired').status, 'retired')
  assert.throws(() => registry.requireActiveForCreate('retired'), /retired/)
  assert.deepEqual(registry.listActive(), [])
})
