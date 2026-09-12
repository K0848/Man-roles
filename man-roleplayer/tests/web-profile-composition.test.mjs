import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const profile = join(import.meta.dirname, '..', 'profile', 'mvp-web')
const plugin = join(import.meta.dirname, '..')
test('project-owned Web profile composes plugin and disables workspace sidebar occupant', () => {
  const manifest = JSON.parse(readFileSync(join(profile, 'package.json'), 'utf8'))
  const patch = readFileSync(join(profile, 'cordis.patch.yml'), 'utf8')
  assert.deepEqual(manifest.dsh.profile.bundles, ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'man-roles-roleplayer'])
  assert.match(manifest.dependencies['man-roles-roleplayer'], /^link:/)
  assert.match(patch, /id:\s+ui-workspace[\s\S]*disabled:\s*true/)
  assert.doesNotMatch(patch, /api-remotes|deepseek-harness|dsh-core/i)
})

test('daily launcher builds and verifies checkout links without copy installation', () => {
  const launcher = readFileSync(join(plugin, 'scripts', 'start-man-roles.ps1'), 'utf8')
  const prepare = readFileSync(join(plugin, 'scripts', 'dsh-runtime', 'prepare-local-runtime.ps1'), 'utf8')
  assert.match(launcher, /npm run build/)
  assert.match(launcher, /Man-roles profile plugin link/)
  assert.match(launcher, /Man-roles local DSH dependency bridge/)
  assert.match(prepare, /pluginMode = 'link'/)
  assert.doesNotMatch(prepare, /package-import-method=copy/)
  assert.doesNotMatch(prepare, /Copy-Item[^\n]+fallbackPluginDirectory/)
})
