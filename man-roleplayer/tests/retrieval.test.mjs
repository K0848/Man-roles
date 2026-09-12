/**
 * retrieval 层单元测试（阶段 6 验收：内容入库逐字对齐 + 确定性检索 + 围栏化）。
 * 不消耗真实 API；内容库来自 lib/retrieval.js（构建期内联 content/*.json）。
 * 逐字校验：用独立提取器读调研成果 .md，与库内 full_text/source 对照（红线）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildContentLibraries,
  assertContentIntegrity,
  ANECDOTES,
  QUOTES,
  BLACKLIST_ENTRIES,
  ANECDOTE_COUNTS,
  QUOTE_COUNTS,
  BLACKLIST_COUNTS,
  retrieveAnecdotes,
  fetchAnecdote,
  fetchQuote,
  fetchSource,
  queryTerms,
  normalizeSource,
  sourceMatches,
  normalizeText,
} from '../lib/retrieval.js'

const here = join(fileURLToPath(import.meta.url), '..', '..')
const researchWang = readFileSync(join(here, '..', 'docs', 'research', '调研成果-王阳明.md'), 'utf8')
const researchZeng = readFileSync(join(here, '..', 'docs', 'research', '调研成果-曾国藩.md'), 'utf8')

/** 独立提取器：按 `### 【事迹卡 N】` 块切分，取 title → {full_text, source}（与库内逐字对照）。 */
function extractAnecdoteCards(md) {
  const map = new Map()
  const blocks = md.split(/### 【事迹卡 \d+】/).slice(1)
  for (const block of blocks) {
    const title = /^- \*\*title\*\*：(.+)$/m.exec(block)
    const full = /^- \*\*full_text\*\*：(.+)$/m.exec(block)
    const source = /^- \*\*source\*\*：(.+)$/m.exec(block)
    if (!title) continue
    map.set(title[1].trim(), { fullText: full ? full[1].trim() : null, source: source ? source[1].trim() : null })
  }
  return map
}

/** 独立提取器：解析 markdown 表格行（语录 C1/C2），返回 [{text, source, credibility}]。 */
function extractQuoteRows(md) {
  const rows = []
  for (const line of md.split(/\r?\n/)) {
    const m = /^\|\s*(C?\d+)\s*\|(.*)\|$/.exec(line)
    if (!m) continue
    const cells = m[2].split('|').map((c) => c.trim())
    if (cells.length < 4) continue
    const [text, source, keywords, credibility] = cells
    if (!text.startsWith('"') && !text.startsWith('“')) continue
    // markdown 格式规范化（与入库一致）：[label](url) → label（url）；去除 **
    const norm = (s) => s
      .replace(/\*\*/g, '')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1（$2）')
      .trim()
    // 尾部括号注记（如（晚年自述）（咏良知诗））与入库规则一致拆到 note，不留在 text
    const textCore = norm(text).replace(/（[^）]*）$/, '')
    rows.push({ text: textCore, source: norm(source), keywords: norm(keywords), credibility: norm(credibility) })
  }
  return rows
}

/** 归一化可信度对比：去掉空格与括号后，`✅ 可靠（…）` 与 `✅`+`可靠（…）` 视为一致。 */
function normCred(s) {
  return s.replace(/[\s（）()]/g, '')
}

test('内容库构造：条数 20/35/16/22 + 红线完整性断言通过', () => {
  assert.equal(ANECDOTE_COUNTS['wang-yangming'], 20)
  assert.equal(ANECDOTE_COUNTS['zeng-guofan'], 35)
  assert.equal(QUOTE_COUNTS['wang-yangming'], 16)
  assert.equal(QUOTE_COUNTS['zeng-guofan'], 22)
  assert.ok(BLACKLIST_COUNTS['wang-yangming'] >= 4 && BLACKLIST_COUNTS['zeng-guofan'] >= 10)
  assert.doesNotThrow(() => assertContentIntegrity())
  assert.equal(buildContentLibraries(), buildContentLibraries(), '惰性单例')
})

test('黑名单：两位人物均有真实条目，且误传条目不可进入可引用语录库', () => {
  const libs = buildContentLibraries()
  assert.ok(libs.blacklist.entries.length > 0, '黑名单不得为空')
  for (const persona of ['wang-yangming', 'zeng-guofan']) {
    assert.ok(libs.blacklist.byPersona(persona).length > 0, `${persona} 黑名单必须存在`)
  }
  const always = libs.blacklist.entries.filter((entry) => entry.mode === 'always' && entry.kind === 'quote')
  assert.ok(always.length > 0, '必须存在 always 模式误传/禁入语录')
  for (const entry of always) {
    assert.equal(libs.quotes.byId(entry.text), undefined)
  }
})

test('全部事迹 full_text/source 与调研成果逐字一致（王阳明 20 条）', () => {
  const cards = extractAnecdoteCards(researchWang)
  assert.equal(cards.size, 20, '调研成果王阳明 B 节共 20 张卡')
  for (const a of ANECDOTES.filter((x) => x.personaId === 'wang-yangming')) {
    const card = cards.get(a.title)
    assert.ok(card, `调研成果存在卡「${a.title}」`)
    assert.equal(a.fullText, card.fullText, `full_text 逐字一致（${a.title}）`)
    assert.equal(a.source, card.source, `source 逐字一致（${a.title}）`)
  }
})

test('全部事迹 full_text/source 与调研成果逐字一致（曾国藩 35 条实体卡）', () => {
  const cards = extractAnecdoteCards(researchZeng)
  assert.equal(cards.size, 35, '调研成果曾国藩 B 节实体卡 35 张（卡 30/38 已并入卡 3/8，卡 14 未在合并稿出现）')
  for (const a of ANECDOTES.filter((x) => x.personaId === 'zeng-guofan')) {
    const card = cards.get(a.title)
    assert.ok(card, `调研成果存在卡「${a.title}」`)
    assert.equal(a.fullText, card.fullText, `full_text 逐字一致（${a.title}）`)
    assert.equal(a.source, card.source, `source 逐字一致（${a.title}）`)
  }
})

test('语录 text/source/可信度与调研成果一致（王阳明 16 + 曾国藩 22）', () => {
  const wangRows = extractQuoteRows(researchWang)
  const zengRows = extractQuoteRows(researchZeng)
  assert.ok(wangRows.length >= 16 && zengRows.length >= 22, `表格行数 wang=${wangRows.length} zeng=${zengRows.length}`)
  const allRows = [...wangRows, ...zengRows]
  for (const q of QUOTES) {
    const row = allRows.find((r) => r.text === q.text)
    assert.ok(row, `调研成果表格存在语录「${q.text.slice(0, 20)}…」`)
    assert.equal(row.source, q.source, `source 一致（${q.id}）`)
    // 可信度标记（✅/✅*/⚠️）必须保留：单元格归一化后以标记开头
    // （单元格其余部分为注记，如「✅ 可靠（出处为书信）」「✅*（传记引文，原奏待核）」）
    assert.ok(normCred(row.credibility).startsWith(normCred(q.credibility)), `可信度标记保留（${q.id}）：单元格=${row.credibility} 标记=${q.credibility}`)
  }
})

test('❌ 误传只进黑名单：可引用库无 ❌，黑名单覆盖调研成果误传项', () => {
  assert.ok(QUOTES.every((q) => q.credibility !== '❌'), '语录库不含 ❌ 条目')
  // 王阳明：C1#10「此心不动，随机而动」（❌）+ D6「吾心即宇宙」（陆九渊语）
  // 曾国藩：C2 F1-F5（❌/⚠️）+ 史臣评价 21/22（first-person）+ 伪托书《冰鉴》《挺经》
  const blackTexts = BLACKLIST_ENTRIES.map((e) => normalizeText(e.text))
  for (const known of [
    '此心不动，随机而动。',
    '吾心即是宇宙，宇宙便是吾心。',
    '一生俯首拜阳明',
    '屡战屡败',
    '屡败屡战',
    '结硬寨，打呆仗。',
    '轻财足以聚人，律己足以服人，量宽足以得人，身先足以率人。',
    '物来顺应，未来不迎，当下不杂，既过不恋。',
    '打落牙齿和血吞。',
    '事功本于学问，善以礼运。',
    '其治军行政，务求蹈实。',
    '《冰鉴》',
    '《挺经》',
  ]) {
    assert.ok(blackTexts.some((t) => t.includes(normalizeText(known)) || normalizeText(known).includes(t)),
      `黑名单应覆盖「${known}」`)
  }
})

test('确定性检索：theme 精确匹配优先 + title/summary 关键词命中', () => {
  const libs = buildContentLibraries()
  const byTheme = retrieveAnecdotes('危局', 'wang-yangming', libs, 5)
  assert.ok(byTheme.length > 0 && byTheme.every((a) => a.theme === '危局/责任'), '「危局」theme 精确匹配命中危局/责任主题')
  const shiShangMo = retrieveAnecdotes('事上磨 静亦定 动亦定', 'wang-yangming', libs, 3)
  assert.ok(shiShangMo.some((a) => a.id === 'wang-yangming-12'), '「事上磨」命中事迹卡12')
  const lungChang = retrieveAnecdotes('逆境 挫折 龙场', 'wang-yangming', libs, 3)
  assert.ok(lungChang.some((a) => a.id === 'wang-yangming-02'), '「逆境 龙场」命中事迹卡2')
  const jingGang = retrieveAnecdotes('靖港 大败 自尽', 'zeng-guofan', libs, 3)
  assert.ok(jingGang.some((a) => a.id === 'zeng-guofan-02'), '「靖港」命中曾国藩事迹卡2')
})

test('确定性检索：无命中返回空；topK 上限 5', () => {
  const libs = buildContentLibraries()
  assert.deepEqual(retrieveAnecdotes('量子力学 星际航行', 'wang-yangming', libs, 3), [])
  const many = retrieveAnecdotes('zeng-guofan', 'zeng-guofan', libs, 99)
  assert.ok(many.length <= 5, `topK 上限 5（实际 ${many.length}）`)
})

test('围栏化：双人物互不可取（retrieve + fetchAnecdote）', () => {
  const libs = buildContentLibraries()
  const wang = retrieveAnecdotes('知行合一 修养 用人', 'wang-yangming', libs, 5)
  assert.ok(wang.length > 0 && wang.every((a) => a.id.startsWith('wang-yangming-')), '王阳明语境只返回王阳明事迹')
  const zeng = retrieveAnecdotes('知行合一 修养 用人', 'zeng-guofan', libs, 5)
  assert.ok(zeng.length > 0 && zeng.every((a) => a.id.startsWith('zeng-guofan-')), '曾国藩语境只返回曾国藩事迹')
  assert.equal(fetchAnecdote('wang-yangming-12', 'zeng-guofan', libs), undefined, '曾国藩语境取不到王阳明事迹原文')
  assert.equal(fetchAnecdote('zeng-guofan-02', 'wang-yangming', libs), undefined, '王阳明语境取不到曾国藩事迹原文')
  assert.ok(fetchAnecdote('wang-yangming-12', 'wang-yangming', libs) !== undefined, '本人语境可取到事迹原文')
  assert.ok(fetchAnecdote('wang-yangming-12', 'wang-yangming', libs)?.fullText.includes('人须在事上磨，方立得住'))
  assert.equal(fetchAnecdote('wang-yangming-999', 'wang-yangming', libs), undefined, '不存在 id 返回 undefined')
})

test('fetchQuote / fetchSource：按指针取原文、按出处回落库内', () => {
  const libs = buildContentLibraries()
  const q = fetchQuote('wang-yangming-q02', libs)
  assert.equal(q?.text, '"人须在事上磨，方立得住，方能静亦定、动亦定。"')
  assert.equal(q?.credibility, '✅')
  const src = fetchSource('《传习录》卷上·陆澄录', libs, 'wang-yangming')
  assert.ok(src.some((s) => s.kind === 'quote' && s.id === 'wang-yangming-q02'), '按出处回落语录')
  assert.ok(src.some((s) => s.kind === 'anecdote' && s.id === 'wang-yangming-12'), '按出处回落事迹')
})

test('queryTerms / normalizeSource / sourceMatches 边界', () => {
  assert.deepEqual(queryTerms('事上磨 静亦定 动亦定'), ['事上磨', '静亦定', '动亦定'])
  assert.deepEqual(queryTerms('abc 123'), [])
  assert.equal(normalizeSource('《传习录》卷下（及《年谱》），通行本记载；⚠️ 细节（天数、共格者）各书有出入'),
    '《传习录》卷下（及《年谱》），通行本记载')
  assert.equal(normalizeSource('《王阳明全集·与杨仕德薛尚谦书》（⚠️ 常被误标为《传习录》）'),
    '《王阳明全集·与杨仕德薛尚谦书》')
  assert.ok(sourceMatches('《传习录》卷上·陆澄录', '《传习录》卷上·陆澄录'), '相等匹配')
  assert.ok(sourceMatches('《清史稿》卷405', '《清史稿》卷405《曾国藩传》'), '前缀匹配')
  assert.ok(sourceMatches('《年谱》', '《阳明先生集要·年谱》正德十四年条；《王文成公全书》奏疏类'), '缩写包含匹配（演员引用《年谱》回落库内《阳明先生集要·年谱》）')
  assert.ok(sourceMatches('《传习录》', '《传习录》卷上·陆澄录'), '书级前缀匹配')
  assert.ok(!sourceMatches('《资治通鉴》卷一百九十五', '《清史稿》卷405《曾国藩传》'), '无关出处不匹配')
  assert.ok(!sourceMatches('《书》', '《传习录》卷上·徐爱引言'), '过短出处不匹配')
})
