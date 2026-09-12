import test from 'node:test'
import assert from 'node:assert/strict'
import { readUtf8, uniqueRequirementIds } from './helpers/mvp-v2-harness.mjs'

const prd = readUtf8(new URL('../../docs/需求文档.md', import.meta.url))
const architecture = readUtf8(new URL('../../docs/架构设计.md', import.meta.url))
const ids = uniqueRequirementIds(prd)

test('PRD contains 50 unique requirement IDs and architecture maps every ID', () => {
  assert.equal(ids.length, 50)
  for (const id of ids) assert.match(architecture, new RegExp(`\\| ${id} \\|`))
})

test('MVP scope preserves the confirmed 45/4/1 distribution', () => {
  const rows = architecture.split('\n').filter((line) => /^\| PRD-/.test(line))
  assert.equal(rows.filter((line) => line.includes('| Must |')).length, 45)
  assert.equal(rows.filter((line) => line.includes('| Simplified |')).length, 4)
  assert.equal(rows.filter((line) => line.includes('| Not now |')).length, 1)
})

test('v2 test entry points are zero-cost and do not invoke legacy real runs', () => {
  const pkg = JSON.parse(readUtf8(new URL('../package.json', import.meta.url)))
  assert.ok(pkg.scripts['test:mvp-v2'])
  assert.ok(pkg.scripts['test:legacy-contract'])
  assert.ok(pkg.scripts['validate:mvp-v2'])
  for (const name of ['test:mvp-v2', 'test:legacy-contract', 'validate:mvp-v2']) {
    assert.doesNotMatch(pkg.scripts[name], /task9:real|provider|attempt-[1-9]|dsh-home/i)
  }
})
