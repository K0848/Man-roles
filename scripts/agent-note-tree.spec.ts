/** 单语决策记录的发现与字段验收，不依赖另一语言或 sidecar。 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { walkAgentNoteTree } from './agent-note-tree.ts'
import { agentNoteFormatProblems } from './verify-agent-note-format.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const chinese = '# Agent Note: 单语记录\n\nStatus: implemented\n\n## 问题\n\n问题。\n\n## 决策\n\n决策。\n\n## 后果\n\n影响。\n\n## 考虑过的替代方案\n\n方案。\n'

describe('single-language Agent Notes', () => {
  it('discovers and validates a Chinese-only note without a sidecar', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-note-'))
    roots.push(root)
    mkdirSync(join(root, 'implemented/process'), { recursive: true })
    const rel = 'implemented/process/2026-11-03-single-language.zh.md'
    writeFileSync(join(root, rel), chinese)
    const result = walkAgentNoteTree(root)
    expect(result.errors).toEqual([])
    expect(result.notes).toEqual([{ lifecycle: 'implemented', rel, date: '2026-11-03' }])
    expect(agentNoteFormatProblems(result.notes[0]!, chinese)).toEqual([])
  })

  it('discovers both languages independently and rejects a missing decision in either', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-note-'))
    roots.push(root)
    mkdirSync(join(root, 'implemented/process'), { recursive: true })
    for (const suffix of ['.md', '.zh.md']) {
      writeFileSync(join(root, `implemented/process/2026-11-03-two${suffix}`), chinese)
    }
    const { notes, errors } = walkAgentNoteTree(root)
    expect(errors).toEqual([])
    expect(notes).toHaveLength(2)
    for (const note of notes) {
      expect(agentNoteFormatProblems(note, chinese.replace('## 决策', '## 其他')))
        .toContain(`format: ${note.rel} — missing the required \`## Decision\` section`)
    }
  })

  it('rejects proposal-era headings and missing alternatives in a Chinese implemented note', () => {
    const note = { lifecycle: 'implemented', rel: 'implemented/process/2026-11-03-note.zh.md', date: '2026-11-03' }
    const errors = agentNoteFormatProblems(note, chinese.replace('## 考虑过的替代方案', '## 迁移计划'))
    expect(errors.some(error => error.includes('proposal-era heading'))).toBe(true)
    expect(errors.some(error => error.includes('missing `## Alternatives considered`'))).toBe(true)
  })

  it('accepts historical localized field labels while rejecting conflicting or duplicate status fields', () => {
    const note = { lifecycle: 'implemented', rel: 'implemented/process/2026-11-03-note.zh.md', date: '2026-11-03' }
    const localized = chinese.replace('# Agent Note: ', '# Agent Note：').replace('Status: implemented', '状态：已实现')
    expect(agentNoteFormatProblems(note, localized)).toEqual([])
    expect(agentNoteFormatProblems(note, localized.replace('已实现', 'proposed')).some(error => error.includes('status grammar'))).toBe(true)
    expect(agentNoteFormatProblems(note, `${localized}\nStatus: implemented\n`).some(error => error.includes('only one'))).toBe(true)
  })
})
