/**
 * ConversationAggregate（产品层聚合）单元测试。
 * 覆盖 task_plan 阶段 4 验收标准：聚合器映射（conversation_id ↔ branches ↔
 * active_persona）；switchPersona 切换（首次建分支/返回复用）；load 恢复
 * （branchesIndex、activePersona、confirmed 全部读回）；共享层注入。
 */
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConversationAggregate } from '../lib/aggregate.js'
import { makePersonaRegistry } from './persona-fixture.mjs'

let root
let registry
test('setup 临时目录', () => {
  root = mkdtempSync(join(tmpdir(), 'agg-test-'))
  registry = makePersonaRegistry(join(root, 'personas'))
})
after(() => {
  if (root) rmSync(root, { recursive: true, force: true })
})

const USER_RAW = '我既想坚持理想主义，又觉得现实处处碰壁，不知如何自处。'
const SESSION_ALPHA = 'session-alpha'
const SESSION_BETA = 'session-beta'
const SESSION_WANG = SESSION_ALPHA
const SESSION_ZENG = SESSION_BETA

test('create 初始状态：activePersona=alpha、无分支、共享层为空', () => {
  const agg = ConversationAggregate.create('conv-1', join(root, 'a'), 'alpha', registry)
  assert.equal(agg.conversationId, 'conv-1')
  assert.equal(agg.activePersona, 'alpha')
  assert.equal(agg.currentBranch(), null)
  assert.deepEqual(agg.sharedLayer.userRaws, [])
  assert.equal(agg.sharedLayer.dilemma.phase, 'pending')
})

test('addUserRaw → 共享层含逐字原文（只增不改）', () => {
  const agg = ConversationAggregate.create('conv-2', join(root, 'b'), 'alpha', registry)
  const ref = agg.addUserRaw('message-conv-2-0', USER_RAW, 'alpha')
  assert.equal(ref, 0)
  assert.deepEqual(agg.sharedLayer.userRaws, [{ ref: 0, text: USER_RAW, messageId: 'message-conv-2-0', rawRef: 'raw-conv-2-0', targetPersonaId: 'alpha' }])
})

test('switchPersona 首次进入创建分支并登记索引 + 持久化 activePersona', () => {
  const agg = ConversationAggregate.create('conv-3', join(root, 'c'), 'alpha', registry)
  const zeng = agg.switchPersona('beta', () => SESSION_BETA)
  assert.equal(zeng.created, true)
  assert.equal(zeng.sessionId, SESSION_ZENG)
  assert.equal(agg.activePersona, 'beta')
  assert.equal(agg.branchesIndex.get('beta')?.sessionId, SESSION_BETA)
  // trunk 已持久化：load 恢复 activePersona + branchesIndex
  const restored = ConversationAggregate.load('conv-3', join(root, 'c'), registry)
  assert.equal(restored.activePersona, 'beta')
  assert.equal(restored.branchesIndex.get('beta')?.sessionId, SESSION_BETA)
})

test('switchPersona 返回复用：已存在分支不重建（created=false、sessionId 不变）', () => {
  const agg = ConversationAggregate.create('conv-4', join(root, 'd'), 'alpha', registry)
  agg.switchPersona('alpha', () => SESSION_ALPHA)
  agg.switchPersona('beta', () => SESSION_BETA)
  const back = agg.switchPersona('alpha', () => 'should-not-create')
  assert.equal(back.created, false)
  assert.equal(back.sessionId, SESSION_ALPHA)
  // 同 persona 重复切换不重复写 active-persona-set 事件（trunk 只增关键变更）
  agg.switchPersona('alpha', () => SESSION_ALPHA)
  const lines = readFileSync(agg.trunk.filePath, 'utf8').split(/\r?\n/).filter(Boolean)
  const activeEvents = lines.filter((l) => JSON.parse(l).type === 'trunk/active-persona-set')
  assert.equal(activeEvents.length, 2, '仅两次真实切换（beta + alpha），重复切换不追加')
})

test('load 恢复完整聚合：userRaws + dilemma confirmed + 双分支索引', () => {
  const dir = join(root, 'e')
  const agg = ConversationAggregate.create('conv-5', dir, 'alpha', registry)
  agg.addUserRaw('message-conv-5-0', USER_RAW, 'alpha')
  agg.setDilemmaCandidate('候选A', 'alpha')
  agg.setDilemmaConfirmed('知行合一的实践路径')
  agg.switchPersona('beta', () => SESSION_BETA)
  agg.switchPersona('alpha', () => SESSION_ALPHA)

  const restored = ConversationAggregate.load('conv-5', dir, registry)
  assert.equal(restored.activePersona, 'alpha')
  assert.deepEqual(restored.sharedLayer.userRaws, [{ ref: 0, text: USER_RAW, messageId: 'message-conv-5-0', rawRef: 'raw-conv-5-0', targetPersonaId: 'alpha' }])
  assert.equal(restored.sharedLayer.dilemma.phase, 'confirmed')
  assert.equal(restored.sharedLayer.dilemma.confirmedText, '知行合一的实践路径')
  assert.equal(restored.branchesIndex.get('alpha')?.sessionId, SESSION_ALPHA)
  assert.equal(restored.branchesIndex.get('beta')?.sessionId, SESSION_BETA)
})

test('sharedLayer.dilemma 保留 candidate 相位（F001 过滤在 assemble 层，此处断言相位不升级）', () => {
  const agg = ConversationAggregate.create('conv-6', join(root, 'f'), 'alpha', registry)
  agg.setDilemmaCandidate('用户可能困惑', 'alpha')
  assert.equal(agg.sharedLayer.dilemma.phase, 'candidate')
  assert.equal(agg.sharedLayer.dilemma.confirmedText, null)
})

test('indexBranch 显式登记（幂等：同 sessionId 不重复写事件）', () => {
  const agg = ConversationAggregate.create('conv-7', join(root, 'g'), 'alpha', registry)
  const first = agg.indexBranch('alpha', SESSION_ALPHA)
  const second = agg.indexBranch('alpha', SESSION_ALPHA)
  assert.ok(first >= 0)
  assert.equal(second, -1)
  assert.equal(agg.branchesIndex.get('alpha')?.sessionId, SESSION_ALPHA)
})
