import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { makePersonaRegistry } from './persona-fixture.mjs'
import { TrunkStorage } from '../lib/storage.js'
import { BranchManager } from '../lib/branch.js'
import { parseBranchUserMessageSource } from '../lib/message-source.js'
import { ConversationAggregate } from '../lib/aggregate.js'
import { personaSpecFor } from '../lib/personas-data.js'

test('legacy trunk replay normalizes every persona field without rewriting bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'legacy-persona-'))
  const registry = makePersonaRegistry(join(root, 'personas'))
  const dir = join(root, 'trunk'); mkdirSync(dir)
  const path = join(dir, 'c.jsonl')
  const lines = [
    { type: 'trunk/created', seq: 0, time: 't0', data: { conversationId: 'c' } },
    { type: 'trunk/user-raw-added', seq: 1, time: 't1', data: { ref: 0, text: 'raw', target_persona_id: '旧-alpha' } },
    { type: 'trunk/active-persona-set', seq: 2, time: 't2', data: { persona: '旧-beta' } },
    { type: 'trunk/branch-indexed', seq: 3, time: 't3', data: { persona: '旧-alpha', sessionId: 's-a' } },
    { type: 'trunk/branch-indexed', seq: 4, time: 't4', data: { persona: '旧-beta', sessionId: 's-b' } },
    { type: 'trunk/dilemma-candidate', seq: 5, time: 't5', data: { persona: '旧-alpha', text: 'candidate' } },
    { type: 'trunk/task-outcome-recorded', seq: 6, time: 't6', data: { taskId: 'task-1', personaId: '旧-beta', branchSessionId: 's-b', branchTurn: 1, status: 'blocked', reason: 'budget_exceeded', retryable: true } },
    { type: 'trunk/branch-delivery-committed', seq: 7, time: 't7', data: { conversation_id: 'c', persona_id: '旧-alpha', raw_ref: 'raw-c-0', message_id: 'm-0', session_id: 's-a' } },
  ]
  writeFileSync(path, lines.map(JSON.stringify).join('\n') + '\n')
  const before = readFileSync(path)
  const loaded = TrunkStorage.load('c', dir, registry)
  assert.deepEqual(loaded.state.userRaws[0].targetPersonaId, 'alpha')
  assert.equal(loaded.state.activePersona, 'beta')
  assert.deepEqual(loaded.state.branchesIndex, { alpha: 's-a', beta: 's-b' })
  assert.equal(loaded.state.dilemma.phase, 'candidate')
  assert.equal(loaded.state.taskOutcomes['task-1'].personaId, 'beta')
  assert.equal(loaded.state.deliveryCommitted[0].persona_id, 'alpha')
  assert.deepEqual(readFileSync(path), before)
})

test('unknown and retired lifecycle boundaries fail closed', () => {
  const root = mkdtempSync(join(tmpdir(), 'persona-life-')); const registry = makePersonaRegistry(join(root, 'personas'))
  assert.throws(() => TrunkStorage.create('x', join(root, 'x'), 'delta', registry), /retired/)
  const trunk = TrunkStorage.create('known', join(root, 'known'), 'alpha', registry)
  const before = readFileSync(trunk.filePath)
  assert.throws(() => trunk.recordTaskBudgetBlocked({ taskId: 't', personaId: 'missing', branchSessionId: 's', branchTurn: 1, status: 'blocked', reason: 'budget_exceeded', retryable: true }), /unknown PersonaId/)
  assert.deepEqual(readFileSync(trunk.filePath), before)
  assert.throws(() => trunk.commitBranchDelivery({ conversation_id: 'known', persona_id: 'missing', raw_ref: 'r', message_id: 'm', session_id: 's' }), /unknown PersonaId/)
  const manager = new BranchManager('alpha', registry, { delta: 'old-delta' })
  assert.equal(manager.ensureBranch('delta', () => 'new').created, false)
  const fresh = new BranchManager('alpha', registry)
  assert.throws(() => fresh.ensureBranch('delta', () => 'new'), /retired/)
  assert.throws(() => manager.ensureBranch('missing', () => 'new'), /unknown PersonaId/)
})

test('legacy branch source parser returns canonical source', () => {
  const root = mkdtempSync(join(tmpdir(), 'persona-source-')); const registry = makePersonaRegistry(join(root, 'personas'))
  assert.deepEqual(parseBranchUserMessageSource({ conversation_id: 'c', message_id: 'm', raw_ref: 'r', persona_id: '旧-beta' }, registry), { conversation_id: 'c', message_id: 'm', raw_ref: 'r', persona_id: 'beta' })
})

test('legacy IDs are rejected by every runtime/create boundary without mutation', () => {
  const root = mkdtempSync(join(tmpdir(), 'persona-runtime-boundary-'))
  const registry = makePersonaRegistry(join(root, 'personas'))
  assert.throws(() => registry.get('旧-alpha'), /PersonaId|unknown/)
  assert.throws(() => registry.requireActiveForCreate('旧-alpha'), /PersonaId|unknown/)
  assert.throws(() => ConversationAggregate.create('legacy', join(root, 'trunk'), '旧-alpha', registry), /PersonaId|unknown/)
  const aggregate = ConversationAggregate.create('canonical', join(root, 'trunk2'), 'alpha', registry)
  const before = readFileSync(aggregate.trunk.filePath)
  assert.throws(() => aggregate.addUserRaw('m-legacy', 'raw', '旧-alpha'), /PersonaId|unknown/)
  assert.throws(() => aggregate.setDilemmaCandidate('candidate', '旧-alpha'), /PersonaId|unknown/)
  assert.throws(() => aggregate.switchPersona('旧-alpha'), /PersonaId|unknown/)
  assert.throws(() => aggregate.indexBranch('旧-alpha', 's-legacy'), /PersonaId|unknown/)
  assert.throws(() => aggregate.trunk.setActivePersona('旧-alpha'), /PersonaId|unknown/)
  assert.throws(() => aggregate.trunk.recordTaskBudgetBlocked({ taskId: 'legacy-task', personaId: '旧-alpha', branchSessionId: 's', branchTurn: 1, status: 'blocked', reason: 'budget_exceeded', retryable: true }), /PersonaId|unknown/)
  assert.throws(() => aggregate.trunk.commitBranchDelivery({ conversation_id: 'canonical', persona_id: '旧-alpha', raw_ref: 'raw', message_id: 'm', session_id: 's' }), /PersonaId|unknown/)
  const manager = new BranchManager('alpha', registry)
  assert.throws(() => new BranchManager('旧-alpha', registry), /PersonaId|unknown/)
  assert.throws(() => manager.ensureBranch('旧-alpha', () => 's'), /PersonaId|unknown/)
  assert.throws(() => manager.activate('旧-alpha'), /PersonaId|unknown/)
  assert.throws(() => personaSpecFor('旧-alpha'), /unknown PersonaId/)
  assert.deepEqual(readFileSync(aggregate.trunk.filePath), before)
  assert.deepEqual([...aggregate.branchesIndex], [])
})
