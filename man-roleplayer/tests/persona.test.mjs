/**
 * persona 成品加载单元测试（阶段 5 验收：systemPrompt 含语言禁忌/出处铁律原文）。
 * 断言两节正文与源文件逐字一致（红线：不得改写/裁剪）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parsePersonaMarkdown,
  personaSystemPromptFromSections,
  buildPersonaSpec,
  assertRedLineSections,
  PERSONA_RED_LINE_SECTIONS,
} from '../lib/persona.js'
import { buildPersonas, personaSpecFor } from '../lib/personas-data.js'
import { createRuntimeRegistry } from '../lib/runtime-registry.js'

const here = join(fileURLToPath(import.meta.url), '..', '..')
const contentDir = join(here, 'content', 'personas')

/** 用与 lib/persona.js 相同的 `## ` 规则从源文件切出指定节正文（独立实现，交叉验证逐字保留）。 */
function extractSection(markdown, title) {
  const lines = markdown.split(/\r?\n/)
  let collecting = false
  const buf = []
  for (const line of lines) {
    const m = /^##\s+(.+)$/.exec(line)
    if (m) {
      if (collecting) break
      if (m[1].trim() === title) collecting = true
    } else if (collecting) {
      buf.push(line)
    }
  }
  return buf.join('\n').trim()
}

test('parsePersonaMarkdown 按 `## ` 标题切片，丢弃 h1 与引言', () => {
  const md = readFileSync(join(contentDir, 'wang-yangming', 'persona.md'), 'utf8')
  const sections = parsePersonaMarkdown(md)
  assert.deepEqual(
    sections.map((s) => s.title),
    ['身份', '思想核心', '口吻', '语言禁忌（不可违反）', '出处铁律（防伪托）'],
  )
  // h1 与「> 依据：」引言不属任何章节
  assert.ok(!sections.some((s) => s.body.includes('systemPrompt 成品')))
  assert.ok(!sections.some((s) => s.body.includes('依据：')))
})

test('语言禁忌/出处铁律两节正文与源文件逐字一致（王阳明）', () => {
  const raw = readFileSync(join(contentDir, 'wang-yangming', 'persona.md'), 'utf8')
  const spec = buildPersonaSpec('wang-yangming', 'wang-yangming', raw)
  for (const title of PERSONA_RED_LINE_SECTIONS) {
    const body = extractSection(raw, title)
    assert.ok(body.length > 0, `${title} 源文件节非空`)
    assert.ok(
      spec.systemPrompt.includes(body),
      `systemPrompt 应逐字包含「${title}」节正文（当前缺失或被改写）`,
    )
    assert.ok(spec.systemPrompt.includes(`## ${title}`), `systemPrompt 应含「## ${title}」标题`)
  }
})

test('语言禁忌/出处铁律两节正文与源文件逐字一致（曾国藩）', () => {
  const raw = readFileSync(join(contentDir, 'zeng-guofan', 'persona.md'), 'utf8')
  const spec = buildPersonaSpec('zeng-guofan', 'zeng-guofan', raw)
  for (const title of PERSONA_RED_LINE_SECTIONS) {
    const body = extractSection(raw, title)
    assert.ok(spec.systemPrompt.includes(body), `systemPrompt 应逐字包含「${title}」节正文`)
    assert.ok(spec.systemPrompt.includes(`## ${title}`))
  }
})

test('红线自检：缺「出处铁律」节的 markdown 拒绝加载（不静默裁剪）', () => {
  const raw = readFileSync(join(contentDir, 'wang-yangming', 'persona.md'), 'utf8')
  const trimmed = raw.split('## 出处铁律（防伪托）')[0]
  assert.throws(() => buildPersonaSpec('wang-yangming', 'wang-yangming', trimmed), /出处铁律/)
})

test('assertRedLineSections：空正文（标题存在但无内容）视为被裁剪', () => {
  assert.throws(
    () => assertRedLineSections('x', [{ title: '语言禁忌（不可违反）', body: '   ' }]),
    /语言禁忌/,
  )
})

test('personaSystemPromptFromSections 按节序组装、保留正文', () => {
  const sections = [
    { title: '身份', body: '你是王守仁。' },
    { title: '语言禁忌（不可违反）', body: '- 不把话说死、说绝。' },
  ]
  assert.equal(
    personaSystemPromptFromSections(sections),
    '## 身份\n\n你是王守仁。\n\n## 语言禁忌（不可违反）\n\n- 不把话说死、说绝。',
  )
})

test('buildPersonas：artifact 人物成品可加载，id/name 正确，红线节齐备', () => {
  const personas = buildPersonas()
  const registry = createRuntimeRegistry()
  assert.deepEqual(Object.keys(personas), registry.listActive().map((entry) => entry.id))
  for (const entry of registry.listActive()) assert.equal(personas[entry.id].id, entry.id)
  for (const [name, spec] of Object.entries(personas)) {
    assert.ok(spec.systemPrompt.includes('语言禁忌（不可违反）'), `${name} 含语言禁忌`)
    assert.ok(spec.systemPrompt.includes('出处铁律（防伪托）'), `${name} 含出处铁律`)
    assert.ok(spec.systemPrompt.length > 200, `${name} systemPrompt 非占位（长度 ${spec.systemPrompt.length}）`)
  }
  for (const entry of registry.listActive()) {
    const raw = readFileSync(join(contentDir, entry.id, entry.manifest.content.prompt), 'utf8')
    assert.ok(personas[entry.id].systemPrompt.includes(extractSection(raw, '出处铁律（防伪托）')))
  }
})

test('personaSpecFor：单人物入口返回同一实例（惰性单例）', () => {
  const id = createRuntimeRegistry().listActive()[0].id
  assert.equal(personaSpecFor(id), personaSpecFor(id))
})
