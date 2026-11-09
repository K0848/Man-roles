import { describe, expect, it } from 'vitest'
import { normalizeReadmeContractHeadings } from './readme-contract-headings.ts'

describe('README contract heading aliases', () => {
  it('maps Chinese and legacy English headings to the same ordered fields', () => {
    expect(normalizeReadmeContractHeadings([
      '## Model Experience', '#### 模型所见', '#### Token effect', '#### KV 缓存影响',
      '## 已知限制与延期工作',
    ].join('\n'))).toBe([
      '## 模型体验', '#### 模型看到的内容', '#### Token 影响', '#### KV Cache 影响',
      '## 已知限制与暂缓事项',
    ].join('\n'))
  })

  it('preserves invalid heading depth, unknown fields, and code literals for validation', () => {
    const source = '### Model Experience\n#### 未知字段\n```markdown\n## Model Experience\n```\n'
    expect(normalizeReadmeContractHeadings(source))
      .toBe('### 模型体验\n#### 未知字段\n```markdown\n## Model Experience\n```\n')
  })
})
