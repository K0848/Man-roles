/**
 * tools 层单元测试（阶段 6 验收：retrieve_anecdotes / fetch_anecdote 工具契约，
 * 处理器围栏化 + topK 预算 + runToolLoop 工具循环——模型一律 mock）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildContentLibraries,
  QUOTES,
  RETRIEVE_ANECDOTES_TOOL,
  FETCH_ANECDOTE_TOOL,
  ACTOR_TOOLS,
  makeRetrieveHandler,
  makeFetchHandler,
  makeActorHandlers,
  runActorTurnWithRetrieval,
} from '../lib/retrieval.js'
import { runToolLoop } from '../lib/llm.js'
import { normalizeTurnPolicyArgs, turnPolicyViolation } from '../lib/turn-state.js'

const libs = buildContentLibraries()
test('per-turn policy rejects legacy question caps but drops known closed controls', () => {
  const state = { policyConfigured: true, maxQuestions: 0, allowedControls: ['end'] }
  assert.match(turnPolicyViolation({ questions: ['多余问题'] }, state), /最多允许 0/)
  assert.equal(turnPolicyViolation({ offeredControls: ['continue'] }, state), undefined)
  assert.deepEqual(normalizeTurnPolicyArgs({ offeredControls: ['continue', 'correct', 'end'] }, state), { offeredControls: ['end'] })
  assert.deepEqual(normalizeTurnPolicyArgs({ offeredControls: ['unknown-control', 'end'] }, state), { offeredControls: ['unknown-control', 'end'] })
  assert.deepEqual(normalizeTurnPolicyArgs({ offeredControls: ['continue', 'correct', 'skip'] }, { policyConfigured: true, allowedControls: ['continue', 'end'] }), { offeredControls: ['continue'] })
  assert.equal(turnPolicyViolation({ questions: [], offeredControls: ['end'] }, state), undefined)
})
test('legacy actor state keeps global schema compatibility without turn policy', () => {
  assert.equal(turnPolicyViolation({ questions: ['1', '2', '3'] }, { policyConfigured: false, maxQuestions: 2, allowedControls: [] }), undefined)
})

/** 可编程 mock 模型客户端：按脚本依次返回响应；记录请求（含 tools 与 tool 结果消息）。 */
class MockLlmClient {
  constructor(script) {
    this.script = [...script]
    this.requests = []
  }

  async complete(request) {
    this.requests.push(request)
    const item = this.script.shift() ?? { text: '', toolCalls: [] }
    return {
      text: item.text ?? '',
      usage: item.usage ?? { inputTokens: 10, outputTokens: 5 },
      finishReason: item.finishReason ?? 'stop',
      provider: 'mock-provider',
      model: 'mock-model',
      ...(item.toolCalls !== undefined ? { toolCalls: item.toolCalls } : {}),
    }
  }
}

test('工具 schema：name/description/parameters 形状正确，演员工具清单含两个工具', () => {
  assert.equal(RETRIEVE_ANECDOTES_TOOL.name, 'retrieve_anecdotes')
  assert.equal(RETRIEVE_ANECDOTES_TOOL.parameters.type, 'object')
  assert.ok(RETRIEVE_ANECDOTES_TOOL.parameters.required.includes('query'))
  assert.equal(FETCH_ANECDOTE_TOOL.name, 'fetch_anecdote')
  assert.ok(FETCH_ANECDOTE_TOOL.parameters.required.includes('id'))
  assert.deepEqual(ACTOR_TOOLS.map((t) => t.name), ['retrieve_anecdotes', 'fetch_anecdote'])
})

test('submit schema：segments 为闭合嵌套对象并限制五类 kind', async () => {
  // 原生注册器依赖 DSH runtime；这里锁定源码契约，避免回退到开放 json items。
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/runtime/actor-tools.ts', import.meta.url), 'utf8'))
  assert.match(source, /name: 'submit_actor_reply'[\s\S]*?parameters: \{\s*segments:/)
  assert.match(source, /items:\s*\{\s*type: 'object',\s*additionalProperties: false/)
  assert.match(source, /kind: \{ type: 'string', enum: \['dialogue', 'historical_fact', 'verbatim_quote', 'thought_attribution', 'modern_inference'\]/)
  assert.doesNotMatch(source, /parameters: \{\s*type: 'object'/)
  assert.doesNotMatch(source, /required: \['kind', 'text'\]/)
  assert.doesNotMatch(source, /items: \{ type: 'json' \}/)
})

test('retrieve 处理器：正常参数 → 本人物 top-k（含 id/title/summary/source），topK 上限 5', () => {
  const handler = makeRetrieveHandler(libs, 'wang-yangming')
  const out = handler('{"query":"事上磨 知行合一","topK":9}')
  const payload = JSON.parse(out.content)
  assert.equal(payload.ok, true)
  assert.equal(payload.personaId, 'wang-yangming')
  assert.ok(payload.items.length >= 1 && payload.items.length <= 5, `topK 上限 5（实际 ${payload.items.length}）`)
  assert.ok(payload.items.every((i) => i.id.startsWith('wang-yangming-')), '围栏：结果全为本人物')
  assert.ok(payload.items.every((i) => typeof i.source === 'string' && i.source.length > 0), '每项携带真实出处')
})

test('retrieve 处理器：缺 query → isError；无命中 → 降级 note', () => {
  const handler = makeRetrieveHandler(libs, 'zeng-guofan')
  const missing = handler('{}')
  assert.equal(missing.isError, true)
  assert.ok(missing.content.includes('query'))
  const empty = handler('{"query":"量子力学"}')
  assert.equal(empty.isError, undefined)
  const payload = JSON.parse(empty.content)
  assert.equal(payload.total, 0)
  assert.ok(payload.note.includes('不上网、不编'), '降级路径明确：不上网、不编')
})

test('fetch 处理器：围栏——他人事迹 id 返回错误；本人事迹返回逐字 fullText', () => {
  const wangHandler = makeFetchHandler(libs, 'wang-yangming')
  const zengHandler = makeFetchHandler(libs, 'zeng-guofan')
  const fenced = zengHandler('{"id":"wang-yangming-12"}')
  assert.equal(fenced.isError, true)
  assert.ok(fenced.content.includes('围栏拦截'))
  const ok = wangHandler('{"id":"wang-yangming-12"}')
  assert.equal(ok.isError, undefined)
  const payload = JSON.parse(ok.content)
  assert.ok(payload.fullText.includes('人须在事上磨，方立得住'), '原文逐字返回')
  assert.equal(payload.source, '《传习录》卷上·陆澄录')
  const badId = wangHandler('{"id":"nope"}')
  assert.equal(badId.isError, true)
})

test('quote 工具：retrieve 返回当前人物真实出处，fetch 逐字返回并拒绝他人 id', () => {
  const wang = makeActorHandlers(libs, 'wang-yangming')
  const zeng = makeActorHandlers(libs, 'zeng-guofan')
  const retrieved = JSON.parse(wang.retrieve_quotes('{"query":"知行合一","topK":5}').content)
  assert.ok(retrieved.items.length > 0, 'quote retrieve 必须命中测试库')
  assert.ok(retrieved.items.every((item) => item.personaId === undefined || item.personaId === 'wang-yangming'))
  assert.ok(retrieved.items.every((item) => typeof item.source === 'string' && item.source.length > 0))
  const quoteId = retrieved.items[0].id
  const fetched = JSON.parse(wang.fetch_quote(JSON.stringify({ id: quoteId })).content)
  assert.equal(fetched.ok, true)
  assert.equal(fetched.id, quoteId)
  assert.equal(typeof fetched.text, 'string')
  assert.ok(fetched.text.length > 0)
  assert.ok(fetched.source.length > 0)
  const fenced = zeng.fetch_quote(JSON.stringify({ id: quoteId }))
  assert.equal(fenced.isError, true, 'quote fetch 必须保持人物围栏')
})

test('quote 工具：⚠️ 可信度严格保留于 retrieve/fetch，不得升格或跳过', () => {
  const warning = QUOTES.find((item) => item.credibility === '⚠️')
  assert.ok(warning, '测试库必须包含 ⚠️ 语录')
  const handlers = makeActorHandlers(libs, warning.personaId)
  const retrieved = JSON.parse(handlers.retrieve_quotes(JSON.stringify({ query: warning.text.slice(0, 8) })).content)
  const item = retrieved.items.find((candidate) => candidate.id === warning.id)
  assert.ok(item, 'retrieve 必须返回指定 ⚠️ 语录')
  assert.equal(item.credibility, '⚠️')
  const fetched = JSON.parse(handlers.fetch_quote(JSON.stringify({ id: warning.id })).content)
  assert.equal(fetched.ok, true)
  assert.equal(fetched.credibility, '⚠️')
})

test('runToolLoop：模型 tool-call 检索 → 处理器执行 → 结果回填 → 第二轮收敛文本', async () => {
  const script = [
    {
      text: '',
      finishReason: 'tool-calls',
      toolCalls: [{ id: 'call-1', name: 'retrieve_anecdotes', arguments: '{"query":"事上磨"}' }],
    },
    { text: '据《传习录》卷上·陆澄录，人须在事上磨，方立得住。' },
  ]
  const llm = new MockLlmClient(script)
  const result = await runToolLoop(
    (req) => llm.complete(req),
    { messages: [{ role: 'user', content: '如何自处？' }], tools: ACTOR_TOOLS },
    { retrieve_anecdotes: makeRetrieveHandler(libs, 'wang-yangming') },
  )
  assert.equal(result.truncated, false)
  assert.equal(result.trail.length, 1)
  assert.equal(result.trail[0].name, 'retrieve_anecdotes')
  assert.equal(result.trail[0].isError, false)
  assert.equal(result.response.text, '据《传习录》卷上·陆澄录，人须在事上磨，方立得住。')

  // 第二轮请求必须携带工具结果消息（role=tool，toolCallId 对应）
  const round2 = llm.requests[1]
  assert.deepEqual(round2.tools, ACTOR_TOOLS, 'tools 持续下发')
  const toolMsg = round2.messages.find((m) => m.role === 'tool')
  assert.ok(toolMsg, '存在 tool 结果消息')
  assert.equal(toolMsg.toolCallId, 'call-1')
  const payload = JSON.parse(toolMsg.content)
  assert.ok(payload.items.some((i) => i.id === 'wang-yangming-12'), '工具结果内容为检索结果')
  const assistantMsg = round2.messages.find((m) => m.role === 'assistant' && m.toolCalls)
  assert.equal(assistantMsg?.toolCalls?.[0].id, 'call-1')
})

test('runToolLoop：未知工具 → isError 结果回填，不中断循环', async () => {
  const llm = new MockLlmClient([
    { text: '', toolCalls: [{ id: 'c1', name: 'no_such_tool', arguments: '{}' }] },
    { text: 'ok' },
  ])
  const result = await runToolLoop((req) => llm.complete(req), { messages: [{ role: 'user', content: 'hi' }] }, {})
  assert.equal(result.trail.length, 1)
  assert.equal(result.trail[0].isError, true)
  assert.ok(result.trail[0].result.includes('未知工具'))
  assert.equal(result.response.text, 'ok')
})

test('runToolLoop：maxRounds 截断 → truncated=true', async () => {
  const llm = new MockLlmClient([
    { text: '', toolCalls: [{ id: 'c1', name: 'retrieve_anecdotes', arguments: '{"query":"事上磨"}' }] },
    { text: '', toolCalls: [{ id: 'c2', name: 'retrieve_anecdotes', arguments: '{"query":"修养"}' }] },
    { text: '', toolCalls: [{ id: 'c3', name: 'retrieve_anecdotes', arguments: '{"query":"立志"}' }] },
  ])
  const result = await runToolLoop(
    (req) => llm.complete(req),
    { messages: [{ role: 'user', content: 'hi' }] },
    { retrieve_anecdotes: makeRetrieveHandler(libs, 'wang-yangming') },
    2,
  )
  assert.equal(result.truncated, true)
  assert.equal(result.trail.length, 2)
})

test('runActorTurnWithRetrieval：请求附加 ACTOR_TOOLS，返回 reply/trail', async () => {
  const llm = new MockLlmClient([
    {
      text: '',
      toolCalls: [{ id: 'call-x', name: 'retrieve_anecdotes', arguments: '{"query":"逆境 龙场"}' }],
    },
    { text: '当年龙场之困，我在事上磨。' },
  ])
  const turn = await runActorTurnWithRetrieval(
    llm,
    { system: '你是 Alpha。', messages: [{ role: 'user', content: '如何自处？' }] },
    libs,
    'wang-yangming',
  )
  assert.equal(turn.reply, '当年龙场之困，我在事上磨。')
  assert.equal(turn.trail.length, 1)
  assert.equal(turn.truncated, false)
  assert.deepEqual(llm.requests[0].tools, ACTOR_TOOLS)
})
