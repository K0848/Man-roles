import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TrunkStorage } from '../lib/storage.js'
import { commitDirectorUpdate, validateDirectorUpdate } from '../lib/dialogue-director.js'
import { makePersonaRegistry } from './persona-fixture.mjs'
const registry = makePersonaRegistry(mkdtempSync(join(tmpdir(), 'director-registry-'))); const root = mkdtempSync(join(tmpdir(), 'director-trunk-'))
test.after(() => rmSync(root, { recursive: true, force: true }))
function setup(id) { const trunk = TrunkStorage.create(id, root, 'alpha', registry); trunk.indexBranch('alpha', 'alpha-session'); trunk.addUserRaw(`message-${id}`, '我在选择中反复犹豫', 'alpha'); return trunk }
function proposal(trunk, overrides = {}) { return { kind: 'core-conflict', text: '我害怕选择后承担责任', sourceRawRefs: [trunk.state.userRaws[0].rawRef], proposedByPersona: 'alpha', ...overrides } }
function update(trunk, items = [proposal(trunk)], coreCandidateId) { return { propose: items, ...(coreCandidateId ? { coreCandidateId } : {}) } }
function commit(t, id, items, core) { return commitDirectorUpdate({ update: update(t, items, core), state: t.state, personaId: 'alpha', trunk: t, messageId: `m-${id}`, taskId: `t-${id}`, eventPurpose: 'director', sourceRawRefs: [t.state.userRaws[0].rawRef] }) }
test('director commits valid candidate batch before actor', () => { const t = setup('valid'); const p = proposal(t, { id: 'candidate-valid' }); assert.deepEqual(commit(t, 'valid', [p], p.id).itemIds, ['candidate-valid']); assert.equal(t.state.dilemmaItems[0].status, 'candidate') })
test('director rejects foreign beta proposal without append', () => { const t = setup('foreign'); const before = readFileSync(t.filePath, 'utf8'); assert.throws(() => commitDirectorUpdate({ update: update(t, [proposal(t, { proposedByPersona: 'beta' })]), state: t.state, personaId: 'alpha', trunk: t, messageId: 'm', taskId: 't', eventPurpose: 'director', sourceRawRefs: [t.state.userRaws[0].rawRef] })); assert.equal(readFileSync(t.filePath, 'utf8'), before) })
test('director rejects legacy persona at validation boundary', () => { const t = setup('legacy'); assert.throws(() => validateDirectorUpdate(update(t), t.state, '旧-alpha', registry), /PersonaId|unknown/) })
test('director rejects unknown proposal persona', () => { const t = setup('unknown'); assert.throws(() => validateDirectorUpdate(update(t, [proposal(t, { proposedByPersona: 'delta' })]), t.state, 'alpha', registry), /unknown|PersonaId|current persona/) })
test('director rejects missing source raw_ref', () => { const t = setup('missing'); assert.throws(() => validateDirectorUpdate(update(t, [proposal(t, { sourceRawRefs: ['raw-missing'] })]), t.state, 'alpha', registry), /source/) })
test('director rejects duplicate IDs before first append', () => { const t = setup('duplicate'); const before = readFileSync(t.filePath, 'utf8'); const p = proposal(t, { id: 'same-id' }); assert.throws(() => commit(t, 'duplicate', [p, { ...p, text: '不同解释' }])); assert.equal(readFileSync(t.filePath, 'utf8'), before) })
test('director rejects confirmed and shared proposal output', () => { const t = setup('status'); assert.throws(() => validateDirectorUpdate(update(t, [proposal(t, { status: 'confirmed', visibility: 'shared-confirmed' })]), t.state, 'alpha', registry)) })
test('director rejects coreCandidateId outside current batch', () => { const t = setup('core'); assert.throws(() => validateDirectorUpdate(update(t, [proposal(t, { id: 'not-core', kind: 'inference' })], 'not-core'), t.state, 'alpha', registry), /coreCandidateId/) })
test('director rejects extra output field', () => { const t = setup('extra'); assert.throws(() => validateDirectorUpdate({ ...update(t), invented: true }, t.state, 'alpha', registry), /unrecognized|extra|strict/) })
test('director IDs are deterministic for equal proposals', () => { const t = setup('ids'); assert.equal(validateDirectorUpdate(update(t), t.state, 'alpha', registry).propose[0].id, validateDirectorUpdate(update(t), t.state, 'alpha', registry).propose[0].id) })
test('director retry with identical business key is idempotent', () => { const t = setup('retry'); const p = proposal(t, { id: 'retry-id' }); assert.equal(commit(t, 'retry', [p]).itemIds[0], 'retry-id'); assert.equal(commit(t, 'retry', [p]).itemIds[0], 'retry-id'); assert.equal(t.state.dilemmaItems.length, 1) })
test('director existing item collision cannot overwrite', () => { const t = setup('collision'); commit(t, 'seed', [proposal(t, { id: 'collision-id' })]); assert.throws(() => commit(t, 'collision', [proposal(t, { id: 'collision-id', text: '新文本' })]), /conflict/) })
test('director preflights later collision and leaves fresh item absent', () => { const t = setup('atomic'); const taken = proposal(t, { id: 'taken-id' }); commit(t, 'seed', [taken]); const before = readFileSync(t.filePath, 'utf8'); assert.throws(() => commit(t, 'atomic', [proposal(t, { id: 'fresh-id' }), { ...taken, text: '冲突内容' }]), /conflict/); assert.equal(readFileSync(t.filePath, 'utf8'), before); assert.equal(t.state.dilemmaItems.some((x) => x.id === 'fresh-id'), false) })
