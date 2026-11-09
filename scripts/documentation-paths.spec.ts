import { describe, expect, it } from 'vitest'
import { documentationPath, relocateGeneratedDocument } from './documentation-paths.ts'

describe('canonical documentation paths', () => {
  it('maps development, reference and generated documentation without moving frozen history', () => {
    expect(documentationPath('docs/subsystems/core.zh.md')).toBe('docs/reference/subsystems/core.md')
    expect(documentationPath('docs/development.md')).toBe('docs/development/README.md')
    expect(documentationPath('docs/i18n/README.md')).toBe('docs/development/language/README.md')
    expect(documentationPath('docs/tool-catalog.md')).toBe('docs/reference/generated/tool-catalog.md')
    expect(documentationPath('.agents/notes/archived/process/old.zh.md')).toBe('.agents/notes/archived/process/old.zh.md')
  })

  it('preserves source declarations while projecting document and source links with their suffixes', () => {
    const code = '```ts\n/** [source](../source.md) */\ninterface Original {}\n```\n'
    const input = '[类型](subsystems/core.zh.md#types) [源码](../packages/core/agent/src/index.ts)\n' + code
    expect(relocateGeneratedDocument(input, 'docs/tool-catalog.md')).toBe(
      '[类型](../subsystems/core.md#types) [源码](../../../packages/core/agent/src/index.ts)\n' + code,
    )
  })

  it('keeps fragment-only and query-only destinations attached to the current document', () => {
    const content = '[局部](#类型) [查询](?view=raw) [组合](?view=raw#类型)\n'
    expect(relocateGeneratedDocument(content, 'docs/tool-catalog.md')).toBe(content)
  })
})
