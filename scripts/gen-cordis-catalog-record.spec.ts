/** 区域生成不依赖翻译副本或 sidecar，保留标记及链接正确性检查。 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { localizePageRegion, REGION_BEGIN, REGION_END, spliceRegion, subsystemRegionOutputs } from './gen-cordis-catalog.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'cordis-region-'))
  roots.push(root)
  mkdirSync(join(root, 'docs/reference/subsystems'), { recursive: true })
  return root
}

function page(prose: string): string {
  return `# Fix\n\n${prose}\n\n${REGION_BEGIN}\nold\n${REGION_END}\n`
}

describe('spliceRegion', () => {
  it('replaces exactly the cordis-surface region', () => {
    const doc = `# T\n\nprose\n\n${REGION_BEGIN}\nold\n${REGION_END}\ntail\n`
    expect(spliceRegion(doc, `${REGION_BEGIN}\nnew\n${REGION_END}`))
      .toBe(`# T\n\nprose\n\n${REGION_BEGIN}\nnew\n${REGION_END}\ntail\n`)
  })

  it('fails loud on a page carrying only some other generator\'s region', () => {
    // Another generator's markers satisfy the generic region grammar but must
    // never be overwritten by THIS generator's splice.
    const foreign = '# T\n\n<!-- BEGIN GENERATED other-surface (other-gen.ts) — do not edit between markers -->\ntheirs\n<!-- END GENERATED other-surface -->\n'
    expect(() => spliceRegion(foreign, `${REGION_BEGIN}\nnew\n${REGION_END}`))
      .toThrow('expected exactly 1 cordis-surface region, found 0 BEGIN/0 END')
  })

  it('fails loud on duplicate cordis-surface markers', () => {
    const doubled = `${REGION_BEGIN}\na\n${REGION_END}\n${REGION_BEGIN}\nb\n${REGION_END}\n`
    expect(() => spliceRegion(doubled, `${REGION_BEGIN}\nnew\n${REGION_END}`))
      .toThrow('found 2 BEGIN/2 END')
  })
})

describe('subsystemRegionOutputs', () => {
  const region = `${REGION_BEGIN}\nnew\n${REGION_END}`

  it('updates only the canonical Chinese page and leaves a legacy sibling untouched', () => {
    const root = fixture()
    writeFileSync(join(root, 'docs/reference/subsystems/fix.md'), page('中文说明。'))
    writeFileSync(join(root, 'docs/reference/subsystems/fix.zh.md'), 'legacy sibling\n')
    expect(subsystemRegionOutputs('fix.md', region, root)).toEqual([
      ['docs/reference/subsystems/fix.md', page('中文说明。').replace('\nold\n', '\nnew\n')],
    ])
    expect(readFileSync(join(root, 'docs/reference/subsystems/fix.zh.md'), 'utf8')).toBe('legacy sibling\n')
  })

  it('rejects an absent canonical owner and invalid markers', () => {
    const root = fixture()
    writeFileSync(join(root, 'docs/reference/subsystems/fix.zh.md'), page('旧副本不能代替规范页。'))
    expect(() => subsystemRegionOutputs('fix.md', region, root)).toThrow('canonical subsystems page does not exist')
    writeFileSync(join(root, 'docs/reference/subsystems/fix.md'), '# 缺少标记\n')
    expect(() => subsystemRegionOutputs('fix.md', region, root)).toThrow('expected exactly 1 cordis-surface region')
  })
})

describe('localizePageRegion', () => {
  it('projects canonical document and source links without rewriting declarations', () => {
    const region = '[类型](target.zh.md?q=1#api) [源码](../../packages/core/agent/src/index.ts)\n'
      + '```ts\n/** target.zh.md */\ninterface Original {}\n```\n'
    expect(localizePageRegion(region, 'docs/subsystems/fix.md')).toBe(
      '[类型](target.md?q=1#api) [源码](../../../packages/core/agent/src/index.ts)\n'
      + '```ts\n/** target.zh.md */\ninterface Original {}\n```\n',
    )
  })
})
