/**
 * 分支上下文装配（assembleBranchTurn）单元测试（阶段 4 扩展）。
 * 覆盖 task_plan 验收标准：切换后上下文 = 当前人物 persona + 共享层
 * （全部 user_raw + confirmed/corrected；candidate 不进——F001）+ 当前人物
 * 分支历史；历史只取最近 N 条；assembleNextTurn 委托回归（阶段 3 兼容）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assembleBranchTurn, assembleNextTurn, estimateTokens } from '../lib/context.js'
import { initialDilemmaState } from '../lib/schema.js'

const USER_RAW = '我既想坚持理想主义，又觉得现实处处碰壁，不知如何自处。'
const WANG_REPLY = '知行本是一体，未曾真知而行，亦未曾实行而知。'
const ZENG_REPLY = '天下事在人为，逆境正是磨炼处。'

const wangPersona = {
  id: 'alpha',
  name: 'alpha',
  systemPrompt: '你是Alpha。以心学立场与用户对话。',
}
const zengPersona = {
  id: 'beta',
  name: 'beta',
  systemPrompt: '你是Beta。以经世致用立场与用户对话。（占位 persona）',
}

const confirmedDilemma = {
  ...initialDilemmaState(),
  phase: 'confirmed',
  confirmedText: '知行合一的实践路径',
}
const candidateDilemma = {
  ...initialDilemmaState(),
  phase: 'candidate',
  candidateText: '用户可能困惑于知行合一',
}

test('共享层 + 分支历史装配：system → confirmed → 全部 user_raw → 历史', () => {
  const out = assembleBranchTurn({
    persona: zengPersona,
    sharedLayer: {
      userRaws: [
        { ref: 0, text: USER_RAW },
        { ref: 1, text: '我又想辞职创业，又怕失败。' },
      ],
      dilemma: confirmedDilemma,
    },
    branchHistory: [{ role: 'assistant', content: ZENG_REPLY }],
  })
  const roles = out.messages.map((m) => m.role)
  assert.deepEqual(roles, ['system', 'user', 'user', 'user', 'assistant'])
  assert.equal(out.messages[0].content, zengPersona.systemPrompt)
  assert.ok(out.messages.some((m) => m.content.startsWith('【已确认的困惑】')))
  // 全部 user_raw 逐字出现（未被摘要覆盖）
  assert.ok(out.messages.some((m) => m.content === USER_RAW))
  assert.ok(out.messages.some((m) => m.content === '我又想辞职创业，又怕失败。'))
  // 历史（当前人物自己的）在末尾
  assert.equal(out.messages[out.messages.length - 1].content, ZENG_REPLY)
})

test('candidate 不进上下文（F001：推断不当事实）', () => {
  const out = assembleBranchTurn({
    persona: wangPersona,
    sharedLayer: { userRaws: [{ ref: 0, text: USER_RAW }], dilemma: candidateDilemma },
    branchHistory: [],
  })
  assert.ok(!out.messages.some((m) => m.content.startsWith('【已确认的困惑】')))
  assert.ok(!out.messages.some((m) => m.content.includes('用户可能困惑于知行合一')))
  // 只装配了 user_raw（candidate 相位不产生额外 user message）
  assert.equal(out.messages.filter((m) => m.role === 'user').length, 1)
})

test('分支历史只取最近 maxHistoryTurns 条（token 预算控制，F005）', () => {
  const history = [
    { role: 'user', content: '第一轮输入' },
    { role: 'assistant', content: '第一轮回答' },
    { role: 'user', content: '第二轮输入' },
    { role: 'assistant', content: '第二轮回答' },
  ]
  const out = assembleBranchTurn({
    persona: wangPersona,
    sharedLayer: { userRaws: [{ ref: 0, text: USER_RAW }], dilemma: initialDilemmaState() },
    branchHistory: history,
    maxHistoryTurns: 2,
  })
  const historyMsgs = out.messages.filter((m) => m.role !== 'system' && m.content !== USER_RAW)
  assert.deepEqual(
    historyMsgs.map((m) => m.content),
    ['第二轮输入', '第二轮回答'],
    '只保留最近 2 条分支历史',
  )
})

test('隔离契约：装配结果只含传入的当前分支历史（结构性保证，无他人内容）', () => {
  // 传入的 branchHistory 是调用方从 currentBranch 提取的；本函数不接触其他分支
  const out = assembleBranchTurn({
    persona: zengPersona,
    sharedLayer: {
      userRaws: [{ ref: 0, text: USER_RAW }],
      dilemma: confirmedDilemma,
    },
    branchHistory: [{ role: 'assistant', content: ZENG_REPLY }],
  })
  const text = out.messages.map((m) => m.content).join('\n')
  assert.ok(text.includes(ZENG_REPLY), '含当前人物（Beta）自己的回答')
  assert.ok(!text.includes(WANG_REPLY), '绝不含他人（Alpha）回答')
})

test('assembleNextTurn 委托回归（阶段 3 兼容）：层次固定 + user_raw 逐字', () => {
  const out = assembleNextTurn({
    persona: wangPersona,
    userRaw: USER_RAW,
    lastReply: WANG_REPLY,
    dilemma: confirmedDilemma,
  })
  const roles = out.messages.map((m) => m.role)
  assert.deepEqual(roles, ['system', 'user', 'user', 'assistant'])
  assert.equal(out.messages[1].content, '【已确认的困惑】知行合一的实践路径（这是用户已经确认的理解，回答时应以此为前提）')
  assert.ok(out.messages.some((m) => m.content === USER_RAW))
  assert.equal(out.messages[out.messages.length - 1].content, WANG_REPLY)
})

test('estimateTokens 保持不变（中文按字粗估）', () => {
  assert.ok(estimateTokens('知行合一') >= 4)
  assert.equal(estimateTokens(''), 0)
})
