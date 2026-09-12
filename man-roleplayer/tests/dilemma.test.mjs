/**
 * 困惑状态机单元测试。
 * 覆盖 task_plan 验收标准：
 *  - candidate 在未确认前不升级为 confirmed（F001）；
 *  - confirmed/corrected 事件后状态正确转换；
 *  - user_raw 引用只增不改。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  foldDilemmaState,
  judgeFeedback,
  transition,
} from '../lib/domain.js'
import { initialDilemmaState } from '../lib/schema.js'

/** 构造一个 candidate 领域事件。 */
const candidate = (seq, text = '候选困惑', persona = 'alpha') => ({
  type: 'man-roles/dilemma/candidate',
  seq,
  data: { turnId: 't1', taskId: 'k1', invocationId: 'i1', persona, text },
})
const confirmed = (seq, text = '已确认困惑') => ({
  type: 'man-roles/dilemma/confirmed',
  seq,
  data: { turnId: 't1', taskId: 'k2', invocationId: 'i2', text },
})
const corrected = (seq, text = '已纠正困惑') => ({
  type: 'man-roles/dilemma/corrected',
  seq,
  data: { turnId: 't1', taskId: 'k3', invocationId: 'i3', text },
})
const userMsg = (seq) => ({ type: 'user/message', seq })

test('初始状态为 pending 且显式绑定人物', () => {
  const s = initialDilemmaState('alpha')
  assert.equal(s.phase, 'pending')
  assert.equal(s.activePersona, 'alpha')
  assert.deepEqual(s.userRawRefs, [])
})

test('candidate 事件使 pending → candidate（F001：不自动升级 confirmed）', () => {
  const s = foldDilemmaState([userMsg(0), candidate(1)], 'alpha')
  assert.equal(s.phase, 'candidate')
  assert.equal(s.candidateText, '候选困惑')
  assert.equal(s.confirmedText, null)
  assert.equal(s.updatedBySeq, 1)
})

test('confirmed 仅由用户确认事件触发；candidate 状态下才可升级', () => {
  // 只有 candidate、无 confirmed 事件 → 保持 candidate
  const onlyCandidate = foldDilemmaState([candidate(1)], 'alpha')
  assert.equal(onlyCandidate.phase, 'candidate')
  // candidate + confirmed → confirmed
  const s = foldDilemmaState([candidate(1), confirmed(2)], 'alpha')
  assert.equal(s.phase, 'confirmed')
  assert.equal(s.confirmedText, '已确认困惑')
  assert.equal(s.candidateText, null)
})

test('corrected 事件使 candidate → corrected', () => {
  const s = foldDilemmaState([candidate(1), corrected(2)], 'alpha')
  assert.equal(s.phase, 'corrected')
  assert.equal(s.correctedText, '已纠正困惑')
})

test('已确认/纠正后的新 candidate 不覆盖（已确认状态优先）', () => {
  const s = foldDilemmaState([candidate(1), confirmed(2), candidate(3, '后续推断')], 'alpha')
  assert.equal(s.phase, 'confirmed')
  assert.equal(s.confirmedText, '已确认困惑')
  assert.equal(s.candidateText, null)
})

test('confirmed 事件在非 candidate 状态被忽略（无用户确认则无升级）', () => {
  const s = foldDilemmaState([confirmed(1)], 'alpha')
  assert.equal(s.phase, 'pending')
  assert.equal(s.confirmedText, null)
})

test('user_raw 引用只增不改（重复事件跳过，不重复、不回写）', () => {
  const s = foldDilemmaState([userMsg(0), userMsg(0), userMsg(5)], 'alpha')
  assert.deepEqual(s.userRawRefs, [0, 5])
})

test('无关事件返回原引用（fold 幂等零工作）', () => {
  const s = initialDilemmaState('alpha')
  const next = transition(s, { type: 'assistant/message', seq: 1 })
  assert.equal(next, s)
})

test('judgeFeedback 语义判定：确认/纠正/未确认', () => {
  assert.equal(judgeFeedback('对，我就是困惑知行怎么合一。'), 'confirmed')
  assert.equal(judgeFeedback('不是这样，其实我想说的是……'), 'corrected')
  assert.equal(judgeFeedback('嗯，再想想。'), 'unconfirmed')
})
