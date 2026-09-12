const registry = makePersonaRegistry(mkdtempSync(join(tmpdir(), 'shared-personas-')))
import { makePersonaRegistry } from './persona-fixture.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TrunkStorage, TRUNK_BRANCH_DELIVERY_COMMITTED, TRUNK_USER_RAW_ADDED } from '../lib/storage.js'
import { trunkUserRawAddedEventSchema, trunkBranchDeliveryCommittedEventSchema } from '../lib/schema.js'
import { branchUserMessageExtra, branchUserMessageSourceFromData, branchUserMessageSourceSchema } from '../lib/message-source.js'

test('6.2 contract carries message_id/raw_ref and persona delivery identity', () => {
  assert.equal(trunkUserRawAddedEventSchema.safeParse({ ref: 0, text: 'x', message_id: 'm-1', raw_ref: 'raw-m-1' }).success, true)
  assert.equal(trunkBranchDeliveryCommittedEventSchema.safeParse({ conversation_id: 'c', persona_id: 'alpha', raw_ref: 'raw-m-1', message_id: 'm-1', session_id: 's' }).success, true)
})

test('legacy user-raw JSONL remains readable and derives stable identity without rewrite', () => {
  const dir = mkdtempSync(join(tmpdir(), 'contract-'))
  const trunk = TrunkStorage.create('legacy', dir, 'alpha', registry)
  trunk.append(TRUNK_USER_RAW_ADDED, { ref: 0, text: 'old text' })
  const before = readFileSync(trunk.filePath, 'utf8')
  const restored = TrunkStorage.load('legacy', dir, registry)
  assert.equal(restored.state.userRaws[0].messageId, 'legacy-message-legacy-0')
  assert.equal(restored.state.userRaws[0].rawRef, 'legacy-raw-legacy-0')
  const restoredAgain = TrunkStorage.load('legacy', dir, registry)
  assert.deepEqual(restoredAgain.state.userRaws[0], restored.state.userRaws[0])
  restored.append(TRUNK_USER_RAW_ADDED, { ref: 1, text: 'new text', message_id: 'm-new', raw_ref: 'raw-m-new' })
  const after = readFileSync(trunk.filePath, 'utf8')
  assert.ok(after.startsWith(before))
  assert.equal(JSON.parse(after.split(/\r?\n/).filter(Boolean).at(-1)).type, 'trunk/user-raw-added')
})

test('BranchSession user/message source requires conversation_id/message_id/raw_ref', () => {
  const source = { conversation_id: 'c', message_id: 'm', raw_ref: 'r', persona_id: 'alpha' }
  assert.equal(branchUserMessageSourceSchema.safeParse(source).success, true)
  assert.equal(branchUserMessageSourceSchema.safeParse({ ...source, raw_ref: '' }).success, false)
  assert.equal(branchUserMessageSourceSchema.safeParse({ conversation_id: 'c', message_id: 'm' }).success, false)
  const current = { id: 'm', source: { kind: 'user' }, extra: branchUserMessageExtra(source) }
  assert.deepEqual(branchUserMessageSourceFromData(current), source)
  assert.deepEqual(branchUserMessageSourceFromData({ source: { kind: 'plugin', plugin: 'man-roles-roleplayer', ...source } }), { kind: 'plugin', plugin: 'man-roles-roleplayer', ...source })
})

test('delivery committed is persona+raw_ref keyed and replay idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'contract-'))
  const trunk = TrunkStorage.create('c', dir, 'alpha', registry)
  trunk.append(TRUNK_USER_RAW_ADDED, { ref: 0, text: 'x', message_id: 'm', raw_ref: 'raw-m' })
  assert.deepEqual(trunk.state.userRaws[0], { ref: 0, text: 'x', messageId: 'm', rawRef: 'raw-m' })
  const data = { conversation_id: 'c', persona_id: 'alpha', raw_ref: 'raw-m', message_id: 'm', session_id: 's' }
  trunk.commitBranchDelivery(data)
  trunk.append(TRUNK_BRANCH_DELIVERY_COMMITTED, data)
  assert.equal(trunk.state.deliveryCommitted.length, 1)
  assert.equal(trunk.isBranchDeliveryCommitted('alpha', 'raw-m'), true)
})
