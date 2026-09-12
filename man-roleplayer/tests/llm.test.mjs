/**
 * llm 层单元测试（阶段 5 验收：模型调用层输入输出契约——模型调用本身用 mock）。
 * 断言：judgeFeedbackSemantic 语义判定（含容错回退）、inferDirectorCandidate
 * 请求/输出契约、parseVerdict 边界（unconfirmed 含 confirmed 子串）、
 * estimateRequestTokens 预算估算。不消耗真实 API。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  judgeFeedbackSemantic,
  inferDirectorCandidate,
  parseVerdict,
  keywordFallbackVerdict,
  judgePrompt,
  JUDGE_SYSTEM_PROMPT,
  DIRECTOR_SYSTEM_PROMPT,
} from '../lib/llm.js'
import { estimateRequestTokens } from '../lib/llm.js'

/** 可编程 mock：按脚本依次返回文本；记录每次请求（输入输出契约断言）。 */
class MockLlmClient {
  constructor(script) {
    this.script = [...script]
    this.requests = []
  }

  async complete(request) {
    this.requests.push(request)
    const item = this.script.shift() ?? { text: '' }
    return {
      text: item.text,
      usage: item.usage ?? { inputTokens: 10, outputTokens: 5 },
      finishReason: item.finishReason ?? 'stop',
      provider: 'mock-provider',
      model: 'mock-model',
    }
  }
}

const CANDIDATE = '用户陷入理想主义与现实行动的冲突，可能困惑于知行合一的实践路径。'
const FEEDBACK = '对，我就是困惑知行怎么合一。'

test('judgeFeedbackSemantic：模型输出 confirmed → confirmed，请求契约正确', async () => {
  const llm = new MockLlmClient([{ text: 'confirmed' }])
  const verdict = await judgeFeedbackSemantic(FEEDBACK, CANDIDATE, llm)
  assert.equal(verdict, 'confirmed')
  assert.equal(llm.requests.length, 1)
  const req = llm.requests[0]
  assert.equal(req.system, JUDGE_SYSTEM_PROMPT)
  assert.equal(req.reasoningEffort, 'off')
  assert.equal(req.maxTokens, 16)
  assert.ok(req.messages[0].content.includes(CANDIDATE))
  assert.ok(req.messages[0].content.includes(FEEDBACK))
  assert.equal(req.messages[0].content, judgePrompt(FEEDBACK, CANDIDATE))
})

test('judgeFeedbackSemantic：corrected / unconfirmed 判定', async () => {
  assert.equal(await judgeFeedbackSemantic('不对，其实是理想和现实如何两全', CANDIDATE, new MockLlmClient([{ text: 'corrected' }])), 'corrected')
  assert.equal(await judgeFeedbackSemantic('再展开讲讲', CANDIDATE, new MockLlmClient([{ text: 'unconfirmed' }])), 'unconfirmed')
})

test('judgeFeedbackSemantic：模型输出含多余文本（如「答案是 confirmed。」）→ 仍正确解析', async () => {
  const llm = new MockLlmClient([{ text: '答案是 confirmed。' }])
  assert.equal(await judgeFeedbackSemantic(FEEDBACK, CANDIDATE, llm), 'confirmed')
})

test('judgeFeedbackSemantic：模型输出无法解析 → 用户反馈关键词回退（与 judgeFeedback 同语义）', async () => {
  assert.equal(await judgeFeedbackSemantic('我不确定怎么说', CANDIDATE, new MockLlmClient([{ text: '唔…' }])), 'unconfirmed')
  assert.equal(await judgeFeedbackSemantic('其实我想说的是另一回事', CANDIDATE, new MockLlmClient([{ text: '随便' }])), 'corrected')
  assert.equal(await judgeFeedbackSemantic('对', CANDIDATE, new MockLlmClient([{ text: '嗯嗯' }])), 'confirmed')
})

test('parseVerdict：unconfirmed 优先于 confirmed（子串陷阱）；无匹配返回 null', () => {
  assert.equal(parseVerdict('unconfirmed'), 'unconfirmed')
  assert.equal(parseVerdict('confirmed'), 'confirmed')
  assert.equal(parseVerdict('corrected'), 'corrected')
  assert.equal(parseVerdict('UNCONFIRMED'.toLowerCase()), 'unconfirmed')
  assert.equal(parseVerdict(''), null)
})

test('keywordFallbackVerdict：对用户反馈做关键词判定', () => {
  assert.equal(keywordFallbackVerdict('对，就是这样'), 'confirmed')
  assert.equal(keywordFallbackVerdict('其实我真正困惑的是'), 'corrected')
  assert.equal(keywordFallbackVerdict('再讲讲'), 'unconfirmed')
})

test('inferDirectorCandidate：请求=全部用户原话 + 导演指令；输出去空白', async () => {
  const raws = ['我既想坚持理想主义，又觉得现实处处碰壁，不知如何自处。', '我该坚持还是妥协？']
  const llm = new MockLlmClient([{ text: '  用户陷入理想主义与现实行动的冲突。  ' }])
  const candidate = await inferDirectorCandidate(raws, llm)
  assert.equal(candidate, '用户陷入理想主义与现实行动的冲突。')
  const req = llm.requests[0]
  assert.equal(req.system, DIRECTOR_SYSTEM_PROMPT)
  assert.deepEqual(req.messages.map((m) => m.content), raws)
  assert.equal(req.reasoningEffort, 'off')
  assert.equal(req.maxTokens, 128)
})

test('estimateRequestTokens：system + messages 计入估算（观测级）', () => {
  const n = estimateRequestTokens({
    system: '你是接缝探针。',
    messages: [{ role: 'user', content: '只回复四个字：接缝已通' }],
  })
  assert.ok(n >= 10, `估算应覆盖 system+messages（实际 ${n}）`)
  assert.ok(n < 1000, '短请求估算应远低于上下文预算')
})

test('LlmClient 契约：Mock 返回的 usage/finishReason/provider/model 字段完整', async () => {
  const llm = new MockLlmClient([{ text: 'ok', usage: { inputTokens: 3, outputTokens: 1 } }])
  const resp = await llm.complete({ messages: [{ role: 'user', content: 'hi' }] })
  assert.equal(resp.text, 'ok')
  assert.equal(resp.usage.inputTokens, 3)
  assert.equal(resp.usage.outputTokens, 1)
  assert.equal(resp.finishReason, 'stop')
  assert.equal(resp.provider, 'mock-provider')
  assert.equal(resp.model, 'mock-model')
})
