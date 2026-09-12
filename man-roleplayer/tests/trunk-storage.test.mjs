const registry = makePersonaRegistry(mkdtempSync(join(tmpdir(), 'shared-personas-')))
import { makePersonaRegistry } from './persona-fixture.mjs'
/**
 * TrunkStorage（方案 A 自持存储）单元测试。
 * 覆盖 task_plan 阶段 4 验收标准：追加写独立 JSONL + 启动恢复；
 * 困惑状态（candidate/confirmed）落盘后重启可读回；幂等（重复 seq 跳过）。
 */
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, existsSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  TrunkStorage,
  TRUNK_CREATED,
  TRUNK_USER_RAW_ADDED,
} from '../lib/storage.js'

let root
test('setup 临时目录', () => {
  root = mkdtempSync(join(tmpdir(), 'trunk-test-'))
})
after(() => {
  if (root) rmSync(root, { recursive: true, force: true })
})

const USER_RAW = '我既想坚持理想主义，又觉得现实处处碰壁，不知如何自处。'

test('create 写入 trunk/created 事件（seq=0）且 JSONL 文件存在', () => {
  const dir = join(root, 'create')
  const trunk = TrunkStorage.create('conv-a', dir, 'alpha', registry)
  assert.equal(trunk.state.conversationId, 'conv-a')
  assert.equal(trunk.state.activePersona, 'alpha')
  assert.deepEqual(trunk.state.userRaws, [])
  assert.ok(existsSync(trunk.filePath))
  const lines = readFileSync(trunk.filePath, 'utf8').split(/\r?\n/).filter(Boolean)
  assert.equal(lines.length, 1)
  assert.equal(JSON.parse(lines[0]).type, TRUNK_CREATED)
  assert.equal(JSON.parse(lines[0]).seq, 0)
})

test('addUserRaw + candidate 落盘后 load 恢复状态一致（方案 A 重启恢复）', () => {
  const dir = join(root, 'recover-candidate')
  const trunk = TrunkStorage.create('conv-b', dir, 'alpha', registry)
  const ref = trunk.addUserRaw('message-conv-b-0', USER_RAW, 'alpha')
  assert.equal(ref, 0)
  trunk.setDilemmaCandidate('用户可能困惑于知行合一', 'alpha')

  // 模拟重启：新实例 load 同一文件
  const restored = TrunkStorage.load('conv-b', dir, registry)
  assert.equal(restored.state.activePersona, 'alpha')
  assert.deepEqual(restored.state.userRaws, [{ ref: 0, text: USER_RAW, messageId: 'message-conv-b-0', rawRef: 'raw-conv-b-0', targetPersonaId: 'alpha' }])
  assert.equal(restored.state.dilemma.phase, 'candidate')
  assert.equal(restored.state.dilemma.candidateText, '用户可能困惑于知行合一')
  assert.equal(restored.state.dilemma.confirmedText, null)
  assert.deepEqual(restored.userRawRefs, [0])
  // 恢复后 seq 继续单调（新事件 seq 不与旧事件冲突）
  assert.equal(restored.nextSeq, 3)
})

test('confirmed 全链路恢复：candidate → confirmed（F001 规则在恢复重放中保持）', () => {
  const dir = join(root, 'recover-confirmed')
  const trunk = TrunkStorage.create('conv-c', dir, 'alpha', registry)
  trunk.addUserRaw('message-conv-c-0', USER_RAW, 'alpha')
  trunk.setDilemmaCandidate('候选A', 'alpha')
  trunk.setDilemmaConfirmed('知行合一的实践路径')
  trunk.setDilemmaCorrected('纠正后的困惑')

  const restored = TrunkStorage.load('conv-c', dir, registry)
  // 状态机规则：corrected 仅在 candidate 状态生效；confirmed 后 corrected 被忽略
  assert.equal(restored.state.dilemma.phase, 'confirmed')
  assert.equal(restored.state.dilemma.confirmedText, '知行合一的实践路径')
  assert.equal(restored.state.dilemma.correctedText, null)
  assert.equal(restored.state.dilemma.candidateText, null)
})

test('相同 message_id addUserRaw 返回已有 ref（不重复落盘、只增不改）', () => {
  const dir = join(root, 'dedupe')
  const trunk = TrunkStorage.create('conv-d', dir, 'alpha', registry)
  trunk.addUserRaw('message-conv-d-0', USER_RAW, 'alpha')
  const again = trunk.addUserRaw('message-conv-d-0', USER_RAW, 'alpha')
  assert.equal(again, 0)
  assert.equal(trunk.state.userRaws.length, 1)
  const restored = TrunkStorage.load('conv-d', dir, registry)
  assert.equal(restored.state.userRaws.length, 1)
})

test('activePersona + branchesIndex 落盘后恢复', () => {
  const dir = join(root, 'recover-branches')
  const trunk = TrunkStorage.create('conv-e', dir, 'alpha', registry)
  trunk.setActivePersona('beta')
  trunk.indexBranch('alpha', 'session-wang')
  trunk.indexBranch('beta', 'session-zeng')
  trunk.indexBranch('beta', 'session-zeng') // 幂等：同 persona 同 sessionId 重复写由调用方控制

  const restored = TrunkStorage.load('conv-e', dir, registry)
  assert.equal(restored.state.activePersona, 'beta')
  assert.deepEqual(restored.state.branchesIndex, { alpha: 'session-wang', beta: 'session-zeng' })
})

test('损坏行与重复 seq 在恢复时幂等跳过', () => {
  const dir = join(root, 'tolerant')
  const trunk = TrunkStorage.create('conv-f', dir, 'alpha', registry)
  trunk.addUserRaw('message-conv-f-0', USER_RAW, 'alpha')
  // 手工追加：损坏行 + 重复 seq（seq=1 是第二条 user-raw 的 seq）
  appendFileSync(trunk.filePath, '{broken json}\n')
  appendFileSync(trunk.filePath, JSON.stringify({ type: TRUNK_USER_RAW_ADDED, seq: 1, time: 'dup', data: { ref: 1, text: '重复seq' } }) + '\n')

  const restored = TrunkStorage.load('conv-f', dir, registry)
  // 损坏行跳过；重复 seq=1 跳过（不覆盖第一条 user-raw 的状态）
  assert.equal(restored.state.userRaws.length, 1)
  assert.equal(restored.state.dilemma.userRawRefs.length, 1)
  assert.equal(restored.nextSeq, 2)
})

test('flush 接口可用（追加写已即时落盘）', async () => {
  const dir = join(root, 'flush')
  const trunk = TrunkStorage.create('conv-g', dir, 'alpha', registry)
  await trunk.flush()
  assert.ok(existsSync(trunk.filePath))
})
