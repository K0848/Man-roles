import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { KnipConfiguration } from 'knip'
import { afterEach, describe, expect, it } from 'vitest'
import { configureCordisKnip } from './knip-cordis.ts'
import { removeFixtureSafely } from './test-fixture-cleanup.ts'

const cli = fileURLToPath(new URL('../node_modules/knip/bin/knip.js', import.meta.url))
const roots: string[] = []
const options = {
  bundleDirectory: 'packages/product', inheritedWorkspace: 'packages/*', profileSource: 'profiles.ts',
  browserSeed: { owner: '@fixture/web', source: 'seed.ts' },
}

function write(root: string, file: string, value: string | object): void {
  mkdirSync(dirname(join(root, file)), { recursive: true })
  writeFileSync(join(root, file), typeof value === 'string' ? value : JSON.stringify(value, null, 2))
}

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'knip-cordis-'))
  roots.push(root)
  write(root, 'package.json', { name: 'fixture-root', private: true, workspaces: ['packages/*'] })
  for (const name of ['product', 'host', 'web', 'api', 'seed', 'spare']) {
    write(root, `packages/${name}/package.json`, { name: `@fixture/${name}`, version: '1.0.0', main: 'src/index.ts' })
    write(root, `packages/${name}/src/index.ts`, 'export {}\n')
  }
  write(root, 'packages/product/package.json', {
    name: '@fixture/product', version: '1.0.0', main: 'src/index.ts', dsh: { bundle: { patch: 'cordis.patch.yml' } },
    dependencies: { '@fixture/host': 'workspace:*' },
    peerDependencies: { '@fixture/web': 'workspace:*', '@fixture/api': 'workspace:*', '@fixture/seed': 'workspace:*' },
    devDependencies: { '@fixture/web': 'workspace:*', '@fixture/api': 'workspace:*', '@fixture/seed': 'workspace:*' },
  })
  write(root, 'packages/web/package.json', {
    name: '@fixture/web', version: '1.0.0', main: 'src/index.ts', dsh: { bundle: { patch: 'cordis.patch.yml' } },
  })
  write(root, 'packages/product/cordis.patch.yml', '- insert:\n    - name: "@fixture/host"\n      config:\n        probe: !!js process.exit(99)\n')
  write(root, 'packages/web/cordis.patch.yml', '- insert:\n    - name: "@fixture/api"\n')
  write(root, 'profiles.ts', 'throw new Error("profile metadata must not execute")\nexport const PROFILE_TEMPLATES = { product: ["@fixture/web", "@fixture/product"] }\n')
  write(root, 'seed.ts', 'import * as Seed from "@fixture/seed"\n')
  return root
}

function run(root: string): { status: number | null; output: string } {
  const base: KnipConfiguration = { workspaces: {
    '.': { entry: [], project: [] },
    'packages/*': { entry: ['tests/**/*.spec.ts'], project: ['src/**/*.ts', 'tests/**/*.ts'] },
    ...Object.fromEntries(['host', 'web', 'api', 'seed', 'spare'].map(name => [
      `packages/${name}`, { entry: [], project: ['src/**/*.ts'] },
    ])),
  } }
  write(root, 'knip.json', configureCordisKnip(root, base, options))
  const result = spawnSync(process.execPath, [cli, '--config', join(root, 'knip.json'),
    '--reporter', 'json', '--reporter', 'symbols', '--treat-config-hints-as-errors'], {
    cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

interface FixtureManifest {
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
  devDependencies: Record<string, string>
}

function editManifest(root: string, edit: (manifest: FixtureManifest) => void): void {
  const file = 'packages/product/package.json'
  const manifest = JSON.parse(readFileSync(join(root, file), 'utf8')) as FixtureManifest
  edit(manifest)
  write(root, file, manifest)
}

afterEach(() => {
  for (const root of roots.splice(0)) removeFixtureSafely(root)
})

describe('Cordis dependency evidence through real Knip', { timeout: 60_000 }, () => {
  it('recognizes actual YAML dependencies but reports new unused dependencies and removed Loader rows', () => {
    const root = fixture()
    const clean = run(root)
    expect(clean.status, clean.output).toBe(0)
    editManifest(root, (manifest) => { manifest.dependencies['@fixture/spare'] = 'workspace:*' })
    const unused = run(root)
    expect(unused.status, unused.output).toBe(1)
    expect(unused.output).toContain('@fixture/spare')
    // config.name 是业务数据，不是实际 Loader 行；不能让陈旧声明永久获得豁免。
    write(root, 'packages/product/cordis.patch.yml', '- id: settings\n  config:\n    name: "@fixture/host"\n')
    const removed = run(root)
    expect(removed.status, removed.output).toBe(1)
    expect(removed.output).toContain('@fixture/host')
  })

  it('does not treat type-only seed imports or unrelated peer mirrors as runtime evidence', () => {
    const root = fixture()
    write(root, 'seed.ts', 'import type * as Seed from "@fixture/seed"\n')
    editManifest(root, (manifest) => {
      manifest.peerDependencies['@fixture/spare'] = 'workspace:*'
      manifest.devDependencies['@fixture/spare'] = 'workspace:*'
    })
    const unused = run(root)
    expect(unused.status, unused.output).toBe(1)
    expect(unused.output).toContain('@fixture/seed')
    expect(unused.output).toContain('@fixture/spare')
    write(root, 'profiles.ts', 'export const PROFILE_TEMPLATES = { product: ["@fixture/product"] }\n')
    const noWeb = run(root)
    expect(noWeb.status, noWeb.output).toBe(1)
    expect(noWeb.output).toContain('@fixture/web')
    expect(noWeb.output).toContain('@fixture/api')
  })

  it('automatically scans future tests and continues reporting unused source files', () => {
    const root = fixture()
    editManifest(root, (manifest) => { manifest.devDependencies['@fixture/spare'] = 'workspace:*' })
    const unused = run(root)
    expect(unused.status, unused.output).toBe(1)
    expect(unused.output).toContain('@fixture/spare')
    write(root, 'packages/product/tests/future.spec.ts', 'import "@fixture/spare"\n')
    const tested = run(root)
    expect(tested.status, tested.output).toBe(0)
    write(root, 'packages/product/src/orphan.ts', 'export const orphan = 1\n')
    const orphan = run(root)
    expect(orphan.status, orphan.output).toBe(1)
    expect(orphan.output).toContain('src/orphan.ts')
  })
})
