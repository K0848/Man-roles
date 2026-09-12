/**
 * turn/task/invocation 幂等单元测试。
 * 覆盖 task_plan 验收标准：重复提交同一轮输入不产生重复落盘/重复模型调用。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IdempotencyRegistry, newTurnIds } from '../lib/turn.js'

test('newTurnIds 生成三元组且互不相同', () => {
  const a = newTurnIds('t')
  const b = newTurnIds('t')
  assert.ok(a.turnId.startsWith('t-turn-'))
  assert.ok(a.taskId.startsWith('t-task-'))
  assert.ok(a.invocationId.startsWith('t-inv-'))
  assert.notEqual(a.turnId, b.turnId)
  assert.notEqual(a.taskId, b.taskId)
})

test('同 (task, invocation) 重复提交 → 第二次 skipped 且返回首次结果', () => {
  const reg = new IdempotencyRegistry()
  let calls = 0
  const fn = () => {
    calls += 1
    return 'result-1'
  }
  const first = reg.tryRun('task-1', 'inv-1', fn)
  const second = reg.tryRun('task-1', 'inv-1', fn)
  assert.equal(first.status, 'ran')
  assert.equal(first.value, 'result-1')
  assert.equal(second.status, 'skipped')
  assert.equal(second.value, 'result-1')
  assert.equal(calls, 1, 'fn 只执行一次（不重复模型调用）')
})

test('不同 invocation_id 不互相去重（task 可含多次调用）', () => {
  const reg = new IdempotencyRegistry()
  const a = reg.tryRun('task-1', 'inv-1', () => 1)
  const b = reg.tryRun('task-1', 'inv-2', () => 2)
  assert.equal(a.status, 'ran')
  assert.equal(b.status, 'ran')
  assert.equal(b.value, 2)
})

test('失败 invocation 被记住：重放同键返回 failed 而非重试', () => {
  const reg = new IdempotencyRegistry()
  let calls = 0
  const first = reg.tryRun('task-1', 'inv-1', () => {
    calls += 1
    throw new Error('boom')
  })
  const second = reg.tryRun('task-1', 'inv-1', () => {
    calls += 1
    return 'should-not-run'
  })
  assert.equal(first.status, 'failed')
  assert.equal(second.status, 'failed')
  assert.equal(calls, 1, '失败不自动重试整段（由调用方决定新 invocation_id 重试）')
})

test('has 反映已完成键', () => {
  const reg = new IdempotencyRegistry()
  assert.equal(reg.has('t', 'i'), false)
  reg.tryRun('t', 'i', () => 1)
  assert.equal(reg.has('t', 'i'), true)
})
