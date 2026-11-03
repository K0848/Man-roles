/**
 * Enforce Agent Note headers, lifecycle-specific sections, alternatives, and retired
 * marker rules. Classification and filenames belong to the sibling tree gate;
 * each existing language document is checked independently. Exact format and
 * grandfathering rules live in `.agents/notes/README.md`.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { agentNoteRoot, walkAgentNoteTree } from './agent-note-tree.ts'
import type { AgentNote } from './agent-note-tree.ts'

/** The date these format rules took effect; the grandfather comment is valid only before it. */
const FORMAT_ADOPTED = '2026-07-05'

/** The exact comment a pre-format Agent Note carries in place of `## Alternatives considered`. */
const GRANDFATHER = '<!-- agent-note-format: alternatives-not-recorded (pre-format Agent Note) -->'

/** The retired debt marker that flagged pre-format bodies; banned so it cannot creep back. */
const LEGACY_MARKERS = ['XXX: legacy ADR/RFC body format', 'XXX: legacy ADR/Agent Note body format']

/** Status-line grammar per lifecycle folder. */
const STATUS: Record<string, RegExp> = {
  proposed: /^Status: proposed$/,
  implemented: /^Status: implemented$/,
  rejected: /^Status: rejected — .+$/,
}

/** Required `##` headings per lifecycle, beyond the universal `## Problem` opener. */
const REQUIRED: Record<string, string[]> = {
  proposed: ['## Proposal', '## Acceptance criteria', '## Risks'],
  implemented: ['## Decision', '## Consequences'],
  rejected: ['## Proposal'],
}

/** Headings banned in `implemented/` — proposal-era spec-speak per the slop checklist. */
const BANNED_IMPLEMENTED = /^## (?:Proposal\b|Plan\b|Migration plan\b|Acceptance criteria\b)/i

/** 只归一化结构字段名，中文正文与机器状态标记仍按当前文件逐项检查。 */
const HEADING_ALIASES: Record<string, string> = {
  '问题': 'Problem',
  '提案': 'Proposal',
  '提议': 'Proposal',
  '方案': 'Proposal',
  '验收标准': 'Acceptance criteria',
  '接受标准': 'Acceptance criteria',
  '风险': 'Risks',
  '决策': 'Decision',
  '决定': 'Decision',
  '后果': 'Consequences',
  '影响': 'Consequences',
  '结果': 'Consequences',
  '考虑过的替代方案': 'Alternatives considered',
  '曾考虑的替代方案': 'Alternatives considered',
  '已考虑的替代方案': 'Alternatives considered',
  '备选方案': 'Alternatives considered',
  '考虑过的备选方案': 'Alternatives considered',
  '考虑过的备选': 'Alternatives considered',
  '被否决的替代方案': 'Alternatives considered',
  '权衡的替代方案': 'Alternatives considered',
  '计划': 'Plan',
  '迁移计划': 'Migration plan',
}

/**
 * 校验一份决策记录的必需字段；语言副本不替代当前文件的检查。
 * @param note - 已通过目录结构检查的记录。
 * @param content - 当前文件内容。
 * @returns 缺失或无效的决策字段。
 */
export function agentNoteFormatProblems(note: AgentNote, content: string): string[] {
  const errors: string[] = []
  const fail = (msg: string): void => {
    errors.push(`format: ${note.rel} — ${msg}`)
  }
  const lines = content.split('\n')
  // 旧中文记录已有全角标点和状态翻译；只归一化相同字段，仍拒绝状态与目录不符。
  const statusLine = (line: string): string => line.replace(/^状态[:：]\s*/, 'Status: ').replace(/^Status: 已实现$/, 'Status: implemented')
  // Format tokens inside fenced examples are not document structure.
  let inFence = false
  const prose = lines.filter((l) => {
    if (l.startsWith('```')) {
      inFence = !inFence
      return false
    }
    return !inFence
  })

  if (!/^# Agent Note(?:（agent 决策记录）)?[:：]\s*\S/.test(lines[0] ?? '')) fail('line 1 must be `# Agent Note: <title>`')
  if (lines[1] !== '') fail('line 2 must be blank')
  const status = STATUS[note.lifecycle]
  if (status !== undefined && !status.test(statusLine(lines[2] ?? ''))) {
    fail(`line 3 must match the ${note.lifecycle} status grammar (${String(status)})`)
  }
  if (lines[3] !== '') fail('line 4 must be blank')
  const statusLines = prose.map(statusLine).filter(line => line.startsWith('Status:'))
  if (statusLines.length !== 1) {
    fail('the line-3 `Status:` line must be the only one in the file')
  }

  const h2s = prose.filter(l => l.startsWith('## ')).map((line) => {
    const title = line.slice(3).trimEnd().replace(/（[^）]*）$/, '')
    return `## ${HEADING_ALIASES[title] ?? title}`
  })
  if (h2s[0] !== '## Problem') fail(`the first section must be \`## Problem\` (got ${JSON.stringify(h2s[0] ?? '<none>')})`)
  for (const required of REQUIRED[note.lifecycle] ?? []) {
    if (!h2s.includes(required)) fail(`missing the required \`${required}\` section`)
  }
  if (note.lifecycle === 'implemented') {
    for (const h2 of h2s.filter(h => BANNED_IMPLEMENTED.test(h))) {
      fail(`\`${h2}\` is a proposal-era heading; an implemented Agent Note states what is (fold it into Decision/Consequences/Testing)`)
    }
  }

  const hasSection = h2s.includes('## Alternatives considered')
  const hasGrandfather = prose.includes(GRANDFATHER)
  if (hasSection && hasGrandfather) fail('carries both `## Alternatives considered` and the grandfather comment — drop the comment')
  if (!hasSection && !hasGrandfather) fail('missing `## Alternatives considered` (a pre-format Agent Note whose alternatives are not reconstructible carries the grandfather comment instead — see .agents/notes/README.md § The file format)')
  if (hasGrandfather && note.date >= FORMAT_ADOPTED) fail(`the grandfather comment is only valid for Agent Notes dated before ${FORMAT_ADOPTED}`)

  if (prose.some(line => LEGACY_MARKERS.some(marker => line.includes(marker)))) fail('carries the retired legacy-format debt marker')
  return errors
}

/** 校验活动决策记录，不修改封存的历史文件。 */
function main(): void {
  const { notes, errors } = walkAgentNoteTree()
  for (const note of notes) {
    errors.push(...agentNoteFormatProblems(note, readFileSync(resolve(agentNoteRoot, note.rel), 'utf8')))
  }
  if (errors.length === 0) {
    console.log(`verify-agent-note-format: ${notes.length} Agent Note(s) checked, all conform to .agents/notes/README.md § The file format.`)
    process.exit(0)
  }

  console.error('verify-agent-note-format: violations found:')
  for (const e of errors) console.error(`  ${e}`)
  process.exit(1)
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) main()
