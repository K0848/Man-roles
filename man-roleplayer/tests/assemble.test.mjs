/**
 * 下一轮上下文装配单元测试。
 * 覆盖 task_plan 验收标准：user_raw 与原始输入逐字一致（未被摘要覆盖）；
 * 已确认状态进入上下文、candidate 不进上下文（F001）；token 预算观测（F005）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assembleNextTurn, estimateTokens } from '../lib/context.js'
import { initialDilemmaState } from '../lib/schema.js'

const USER_RAW = '我既想坚持理想主义，又觉得现实处处碰壁，不知如何自处。'

const persona = {
  id: 'alpha',
  name: 'alpha',
  systemPrompt: '你是 Alpha。以心学立场与用户对话。',
}

const base = {
  persona,
  userRaw: USER_RAW,
  lastReply: '知行本是一体。',
  dilemma: initialDilemmaState(),
}

test('user_raw 逐字出现在上下文中（未被任何摘要覆盖）', () => {
  const out = assembleNextTurn(base)
  const userMsg = out.messages.find((m) => m.role === 'user' && m.content === USER_RAW)
  assert.ok(userMsg !== undefined, 'user/message 内容必须与原始输入逐字一致')
})

test('上下文层次固定：system → (已确认状态) → user_raw → lastReply', () => {
  const out = assembleNextTurn(base)
  const roles = out.messages.map((m) => m.role)
  assert.deepEqual(roles, ['system', 'user', 'assistant'])
  assert.equal(out.messages[0].role, 'system')
  assert.ok(out.messages.some((m) => m.content === USER_RAW))
  assert.ok(out.messages.some((m) => m.content === '知行本是一体。'))
})

test('已确认困惑进入上下文（【已确认的困惑】前缀），且先于 user_raw', () => {
  const dilemma = {
    ...initialDilemmaState(),
    phase: 'confirmed',
    confirmedText: '知行合一的实践路径',
  }
  const out = assembleNextTurn({ ...base, dilemma })
  const idx = out.messages.findIndex((m) => m.content.startsWith('【已确认的困惑】'))
  const rawIdx = out.messages.findIndex((m) => m.content === USER_RAW)
  assert.ok(idx >= 0, '已确认状态必须进入上下文')
  assert.ok(idx < rawIdx, '已确认状态先于用户原话（F005 优先级）')
})

test('candidate 状态不进上下文（F001：推断不当事实）', () => {
  const dilemma = {
    ...initialDilemmaState(),
    phase: 'candidate',
    candidateText: '用户可能困惑于知行合一',
  }
  const out = assembleNextTurn({ ...base, dilemma })
  assert.ok(!out.messages.some((m) => m.content.includes('候选困惑') || m.content.includes('用户可能困惑')) ||
    out.messages.every((m) => !m.content.includes('【已确认的困惑】') && !m.content.includes('【用户纠正后的困惑】')),
    'candidate 文本不得以事实身份进入上下文')
  assert.ok(!out.messages.some((m) => m.content.startsWith('【已确认的困惑】')))
})

test('纠正状态以【用户纠正后的困惑】进入上下文', () => {
  const dilemma = {
    ...initialDilemmaState(),
    phase: 'corrected',
    correctedText: '理想与现实如何两全',
  }
  const out = assembleNextTurn({ ...base, dilemma })
  assert.ok(out.messages.some((m) => m.content.startsWith('【用户纠正后的困惑】')))
})

test('token 预算观测：used>0 且 ratio 在 (0,1)', () => {
  const out = assembleNextTurn(base)
  assert.ok(out.tokenEstimate > 0)
  assert.ok(out.budget.used > 0)
  assert.equal(out.budget.limit, 4000)
  assert.ok(out.budget.ratio > 0 && out.budget.ratio < 1)
})

test('estimateTokens：中文按字粗估', () => {
  assert.ok(estimateTokens('知行合一') >= 4)
  assert.equal(estimateTokens(''), 0)
})
