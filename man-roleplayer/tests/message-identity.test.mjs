const registry = makePersonaRegistry(mkdtempSync(join(tmpdir(), 'shared-personas-')))
import { makePersonaRegistry } from './persona-fixture.mjs'
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TrunkStorage, TRUNK_USER_RAW_ADDED } from '../lib/storage.js'
import { ConversationAggregate } from '../lib/aggregate.js'

let root
test('setup 临时目录', () => { root = mkdtempSync(join(tmpdir(), 'message-id-')) })
after(() => { if (root) rmSync(root, { recursive: true, force: true }) })

test('同文本不同 message_id 按发送顺序保存两条原话', () => {
  const trunk = TrunkStorage.create('same-text', join(root, 'same-text'), 'alpha', registry)
  assert.equal(trunk.addUserRaw('message-1', '相同原话', 'alpha'), 0)
  assert.equal(trunk.addUserRaw('message-2', '相同原话', 'alpha'), 1)
  assert.deepEqual(trunk.state.userRaws.map(({ text, messageId }) => ({ text, messageId })), [
    { text: '相同原话', messageId: 'message-1' },
    { text: '相同原话', messageId: 'message-2' },
  ])
})

test('同 message_id 重试返回原 ref，JSONL 不新增事件', () => {
  const trunk = TrunkStorage.create('retry', join(root, 'retry'), 'alpha', registry)
  const first = trunk.addUserRaw('message-1', '第一次内容', 'alpha')
  const before = readFileSync(trunk.filePath, 'utf8')
  assert.equal(trunk.addUserRaw('message-1', '第一次内容', 'alpha'), first)
  assert.equal(readFileSync(trunk.filePath, 'utf8'), before)
  assert.equal(trunk.state.userRaws.length, 1)
})

test('同 message_id 携带不同文本时拒绝冲突且不改变 JSONL/state', () => {
  const trunk = TrunkStorage.create('conflict', join(root, 'conflict'), 'alpha', registry)
  trunk.addUserRaw('message-1', '第一次内容', 'alpha')
  const beforeBytes = readFileSync(trunk.filePath)
  const beforeState = structuredClone(trunk.state)

  assert.throws(
    () => trunk.addUserRaw('message-1', '被篡改的内容', 'alpha'),
    (error) => error instanceof Error && error.code === 'message_id_conflict',
  )
  assert.deepEqual(trunk.state, beforeState)
  assert.deepEqual(readFileSync(trunk.filePath), beforeBytes)
})

test('接收边界拒绝缺失、空白或非字符串 message_id', () => {
  const trunk = TrunkStorage.create('invalid', join(root, 'invalid'), 'alpha', registry)
  for (const id of ['', '   ', null, undefined, 42]) {
    assert.throws(() => trunk.addUserRaw(id, '原话', 'alpha'), /message.?id/i)
  }
  assert.equal(trunk.state.userRaws.length, 0)
})

test('raw_ref 由 Trunk 分配且 load 后保持稳定', () => {
  const dir = join(root, 'raw-ref')
  const trunk = TrunkStorage.create('raw-ref', dir, 'alpha', registry)
  const ref = trunk.addUserRaw('message-1', '原话', 'alpha')
  const rawRef = trunk.state.userRaws[ref].rawRef
  assert.ok(rawRef)
  assert.equal(trunk.addUserRaw('message-1', '原话', 'alpha'), ref)
  const restored = TrunkStorage.load('raw-ref', dir, registry)
  assert.equal(restored.state.userRaws[ref].rawRef, rawRef)
  const event = JSON.parse(readFileSync(trunk.filePath, 'utf8').split(/\r?\n/).filter(Boolean).at(-1))
  assert.equal(event.type, TRUNK_USER_RAW_ADDED)
  assert.equal(event.data.raw_ref, rawRef)
})

test('legacy JSONL 可读且 replay 不改写旧文件', () => {
  const dir = join(root, 'legacy')
  const trunk = TrunkStorage.create('legacy', dir, 'alpha', registry)
  appendFileSync(trunk.filePath, JSON.stringify({ type: TRUNK_USER_RAW_ADDED, seq: 1, time: 'old', data: { ref: 0, text: '旧原话' } }) + '\n')
  const before = readFileSync(trunk.filePath, 'utf8')
  const restored = TrunkStorage.load('legacy', dir, registry)
  assert.deepEqual(restored.state.userRaws[0], { ref: 0, text: '旧原话', messageId: 'legacy-message-legacy-0', rawRef: 'legacy-raw-legacy-0' })
  assert.equal(readFileSync(trunk.filePath, 'utf8'), before)
})

test('ConversationAggregate 接收边界显式传入 message_id', () => {
  const aggregate = ConversationAggregate.create('aggregate', join(root, 'aggregate'), 'alpha', registry)
  assert.equal(aggregate.addUserRaw('message-1', '逐字原话', 'alpha'), 0)
  assert.equal(aggregate.sharedLayer.userRaws[0].messageId, 'message-1')
})
