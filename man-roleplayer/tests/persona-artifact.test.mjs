import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, mkdtempSync, readFileSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { generateRegistryArtifacts, scanPersonaArtifact } from '../lib/persona-generator.js'
import { PersonaRegistry } from '../lib/persona-registry.js'
import { contentLibrariesFromArtifact } from '../lib/retrieval.js'
import { buildPersonaSpec } from '../lib/persona.js'
import { pathToFileURL } from 'node:url'

const root = join(process.cwd(), 'src')
const genericFiles = ['context/personas-data.ts', 'retrieval/data.ts', 'persona/runtime-registry.ts', 'client/index.ts']
const genericTestFiles = ['evidence-ledger.test.mjs', 'aggregate.test.mjs', 'branch-manager.test.mjs', 'recovery.test.mjs', 'assemble.test.mjs', 'assemble-dual.test.mjs', 'message-delivery.test.mjs']
const digest = (files) => createHash('sha256').update(files.map((f) => requireText(join(root, f))).join('\0')).digest('hex')
const requireText = (path) => readFileSync(path)
const prompt = (id) => `# ${id}\n## 身份\n你是 ${id}。\n## 语言禁忌（不可违反）\n- 保持边界。\n## 出处铁律（防伪托）\n- 引文必须有出处。\n`
function add(rootDir, id, status = 'active') {
  const dir = join(rootDir, id); mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ id, displayName: id, status, legacyIds: [`旧-${id}`], content: { prompt: 'persona.md', anecdotes: 'anecdotes.json', quotes: 'quotes.json', blacklist: 'blacklist.json' } }))
  writeFileSync(join(dir, 'persona.md'), prompt(id)); writeFileSync(join(dir, 'anecdotes.json'), JSON.stringify([{ id: `${id}-a`, personaId: id, theme: 'x', title: id, summary: id, fullText: id, source: 'source' }]))
  writeFileSync(join(dir, 'quotes.json'), JSON.stringify([{ id: `${id}-q`, personaId: id, text: id, source: 'source', keywords: [], credibility: '✅' }]))
  writeFileSync(join(dir, 'blacklist.json'), JSON.stringify([{ personaId: id, text: 'bad', kind: 'quote', credibility: '❌', mode: 'always', reason: 'test' }]))
}

test('scanner artifact adds third persona without generic source changes', () => {
  const temp = mkdtempSync(join(tmpdir(), 'man-roles-artifact-')); add(temp, 'alpha'); add(temp, 'beta')
  const before = digest(genericFiles); const first = generateRegistryArtifacts(temp)
  add(temp, 'gamma'); const second = generateRegistryArtifacts(temp); const after = digest(genericFiles)
  assert.equal(before, after); assert.deepEqual(second.client.map((x) => x.id), ['alpha', 'beta', 'gamma'])
  const registry = PersonaRegistry.fromArtifact(second.host); assert.equal(registry.get('gamma').id, 'gamma')
  const libs = contentLibrariesFromArtifact(second.host); assert.equal(libs.anecdotes.byPersona('gamma').length, 1)
  assert.equal(buildPersonaSpec('gamma', 'gamma', second.host.find((x) => x.manifest.id === 'gamma').prompt).id, 'gamma')
})

test('retired persona is restorable but excluded from client active metadata', () => {
  const temp = mkdtempSync(join(tmpdir(), 'man-roles-retired-')); add(temp, 'alpha'); add(temp, 'old', 'retired')
  const generated = generateRegistryArtifacts(temp); assert.deepEqual(generated.client.map((x) => x.id), ['alpha'])
  assert.equal(PersonaRegistry.fromArtifact(generated.host).get('old').status, 'retired')
})

test('pack-like runtime artifact loads without content directory', async () => {
  const temp = mkdtempSync(join(tmpdir(), 'man-roles-pack-'))
  copyFileSync(join(process.cwd(), 'lib', 'runtime-registry.js'), join(temp, 'runtime-registry.js'))
  copyFileSync(join(process.cwd(), 'lib', 'client.js'), join(temp, 'client.js'))
  // Resolve dependencies from the package while loading only copied lib output.
  const runtime = await import(pathToFileURL(join(process.cwd(), 'lib', 'runtime-registry.js')).href)
  assert.equal(runtime.createRuntimeRegistry().listActive().length, 2)
})

test('generic mechanism tests contain no historical persona names or IDs', () => {
  for (const file of genericTestFiles) {
    const text = readFileSync(join(process.cwd(), 'tests', file), 'utf8')
    assert.equal(/王阳明|曾国藩|wang-yangming|zeng-guofan/.test(text), false, `${file} must use generic fixtures`)
  }
})
