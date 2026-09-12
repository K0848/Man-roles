/**
 * BranchManager（人物分支索引）单元测试。
 * 覆盖 task_plan 阶段 4 验收标准：首次进入建 Session、返回复用不重建；
 * 切换只改活跃指针；结构性隔离（不同人物不同 sessionId，currentBranch 仅活跃）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BranchManager } from '../lib/branch.js'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { makePersonaRegistry } from './persona-fixture.mjs'
const registry = makePersonaRegistry(mkdtempSync(join(tmpdir(), 'branch-personas-')))

const SESSION_ALPHA = 'session-alpha'
const SESSION_BETA = 'session-beta'
const SESSION_WANG = SESSION_ALPHA

test('初始：activePersona=alpha、无分支', () => {
  const mgr = new BranchManager('alpha', registry)
  assert.equal(mgr.activePersona, 'alpha')
  assert.equal(mgr.currentBranch(), null)
  assert.equal(mgr.sessionIdOf('alpha'), null)
})

test('ensureBranch 首次创建（createSessionId 被调用）、再次复用（不重建）', () => {
  const mgr = new BranchManager('alpha', registry)
  let calls = 0
  const first = mgr.ensureBranch('alpha', () => {
    calls += 1
    return SESSION_ALPHA
  })
  const second = mgr.ensureBranch('alpha', () => {
    calls += 1
    return 'should-not-create'
  })
  assert.equal(first.created, true)
  assert.equal(first.sessionId, SESSION_ALPHA)
  assert.equal(second.created, false)
  assert.equal(second.sessionId, SESSION_WANG)
  assert.equal(calls, 1, 'createSessionId 只在首次调用（返回复用不重建）')
})

test('activate 切换当前分支（只改活跃指针，其他分支保留）', () => {
  const mgr = new BranchManager('alpha', registry)
  mgr.ensureBranch('alpha', () => SESSION_ALPHA)
  mgr.ensureBranch('beta', () => SESSION_BETA)
  assert.equal(mgr.currentBranch()?.sessionId, SESSION_ALPHA)
  mgr.activate('beta')
  assert.equal(mgr.activePersona, 'beta')
  assert.equal(mgr.currentBranch()?.sessionId, SESSION_BETA)
  // alpha分支仍在（仅隐藏、不删除）
  assert.equal(mgr.sessionIdOf('alpha'), SESSION_ALPHA)
  assert.equal(mgr.branches.size, 2)
})

test('结构性隔离：不同人物 sessionId 不同；currentBranch 只返回活跃分支', () => {
  const mgr = new BranchManager('alpha', registry)
  mgr.ensureBranch('alpha', () => SESSION_ALPHA)
  mgr.ensureBranch('beta', () => SESSION_BETA)
  assert.notEqual(mgr.sessionIdOf('alpha'), mgr.sessionIdOf('beta'))
  // 当前分支上下文来源 = currentBranch（active）——绝不会指向他人分支
  assert.equal(mgr.currentBranch()?.persona, 'alpha')
  mgr.activate('beta')
  assert.equal(mgr.currentBranch()?.persona, 'beta')
})

test('从已有索引构造（load 恢复场景）', () => {
  const mgr = new BranchManager('beta', registry, { alpha: SESSION_ALPHA, beta: SESSION_BETA })
  assert.equal(mgr.activePersona, 'beta')
  assert.equal(mgr.sessionIdOf('alpha'), SESSION_ALPHA)
  assert.equal(mgr.currentBranch()?.sessionId, SESSION_BETA)
})
