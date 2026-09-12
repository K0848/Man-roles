/**
 * verify 层单元测试（阶段 6 验收：出处回落校验 + 黑名单拦截）。
 * 不消耗真实 API；校验为确定性代码（红线 2 的确定性兜底）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildContentLibraries,
  verifyCitation,
  checkBlacklist,
  verifyReference,
  extractCitedSources,
} from '../lib/retrieval.js'

const libs = buildContentLibraries()

test('出处回落校验：引用库内出处通过，不存在出处被拒', () => {
  const ok = verifyCitation('《传习录》卷上·陆澄录', 'wang-yangming', libs)
  assert.equal(ok.ok, true)
  assert.deepEqual(ok.violations, [])

  const okZeng = verifyCitation('《清史稿》卷405《曾国藩传》', 'zeng-guofan', libs)
  assert.equal(okZeng.ok, true)

  const fake = verifyCitation('《资治通鉴》卷一百九十五', 'wang-yangming', libs)
  assert.equal(fake.ok, false)
  assert.equal(fake.violations[0].code, 'unknown-source')
})

test('出处回落校验：伪托书（《冰鉴》《挺经》）被拒', () => {
  for (const forged of ['《冰鉴》', '《挺经》']) {
    const r = verifyCitation(`${forged}卷三`, 'zeng-guofan', libs)
    assert.equal(r.ok, false, `${forged} 应被拒`)
    assert.equal(r.violations[0].code, 'forged-book-source')
  }
})

test('出处回落校验：围栏——王阳明语境不能用曾国藩出处', () => {
  const r = verifyCitation('《曾国藩全集·日记》道光二十二年', 'wang-yangming', libs)
  assert.equal(r.ok, false)
  assert.equal(r.violations[0].code, 'unknown-source')
})

test('黑名单拦截：❌ 误传/⚠️ 禁入流行语（always 模式）', () => {
  assert.ok(checkBlacklist('我此心不动，随机而动，任他风雨。', 'wang-yangming', libs, 'actor-reply'))
  assert.ok(checkBlacklist('吾心即是宇宙，宇宙便是吾心。', 'wang-yangming', libs))
  assert.ok(checkBlacklist('此心不动，随机而动。', 'wang-yangming', libs, 'actor-reply'))
  assert.ok(checkBlacklist('我唯有结硬寨，打呆仗。', 'zeng-guofan', libs, 'actor-reply'))
  assert.ok(checkBlacklist('轻财足以聚人，律己足以服人。', 'zeng-guofan', libs))
  assert.equal(checkBlacklist('人须在事上磨，方立得住。', 'wang-yangming', libs), undefined, '干净文本不误伤')
  assert.equal(checkBlacklist('我此心不动，随机而动。', 'zeng-guofan', libs), undefined, '跨人物不误伤')
})

test('黑名单拦截：史臣评价 first-person 模式——演员语境拦截、旁白语境放行', () => {
  const hit = checkBlacklist('事功本于学问，善以礼运。', 'zeng-guofan', libs, 'actor-reply')
  assert.ok(hit && hit.mode === 'first-person')
  const hit2 = checkBlacklist('其治军行政，务求蹈实。', 'zeng-guofan', libs, 'actor-reply')
  assert.ok(hit2 && hit2.mode === 'first-person')
  assert.equal(checkBlacklist('事功本于学问，善以礼运。', 'zeng-guofan', libs, 'any'), undefined, '旁白/历史坐标语境不拦截')
})

test('verifyReference 联合校验：干净引用通过，假出处+黑名单双违规', () => {
  const ok = verifyReference({ source: '《传习录》卷上·陆澄录', text: '人须在事上磨，方立得住。' }, 'wang-yangming', libs)
  assert.equal(ok.ok, true)

  const bad = verifyReference({ source: '《资治通鉴》', text: '我此心不动，随机而动。' }, 'wang-yangming', libs)
  assert.equal(bad.ok, false)
  const codes = bad.violations.map((v) => v.code)
  assert.ok(codes.includes('unknown-source'), `应含 unknown-source（实际 ${codes.join(',')}）`)
  assert.ok(codes.includes('blacklisted-quote'), `应含 blacklisted-quote（实际 ${codes.join(',')}）`)

  const firstPerson = verifyReference({ text: '史臣尝云：事功本于学问，善以礼运。' }, 'zeng-guofan', libs)
  assert.equal(firstPerson.ok, false)
  assert.equal(firstPerson.violations[0].code, 'forbidden-first-person')
})

test('extractCitedSources：书名号级粗提取（精确校验由 verifyCitation 库内回落完成）', () => {
  const text = '此心光明，如《传习录》卷上·陆澄录所言「人须在事上磨」。另见《清史稿》卷405。'
  assert.deepEqual(extractCitedSources(text), ['《传习录》', '《清史稿》'])
})
