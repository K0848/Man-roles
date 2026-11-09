/** Experimental-package publication and dependency constraints. */

import { describe, expect, it } from 'vitest'
import {
  checkExperimentalDependencyIsolation,
  checkExperimentalManifest,
  checkReleaseRepository,
  type WorkspaceManifest,
} from './check-workspace-constraints.ts'

const experimental: WorkspaceManifest = {
  dir: 'packages/experimental/prototype',
  manifest: { name: '@deepseek-ai/dsh-experimental-prototype', private: true },
}

describe('release source ownership', () => {
  const productPackages = [
    ['packages/bundle/man-roleplayer-app', '@deepseek-ai/dsh-man-roleplayer-app'],
    ['packages/client/ui-man-roleplayer', '@deepseek-ai/dsh-client-ui-man-roleplayer'],
    ['packages/extensions/man-roleplayer', '@deepseek-ai/dsh-man-roleplayer'],
  ] as const
  const productUrl = 'https://github.com/K0848/Man-roles.git'
  const upstreamUrl = 'git+https://github.com/deepseek-ai/deepseek-harness.git'

  it.each(productPackages)('accepts the owned identity and source for %s', (dir, name) => {
    expect(checkReleaseRepository({ dir, manifest: {
      name, repository: { type: 'git', url: productUrl, directory: dir },
    } })).toEqual([])
  })

  it.each([upstreamUrl, 'https://github.com/example/unrelated.git'])(
    'rejects a substituted repository on product packages: %s', (url) => {
      for (const [dir, name] of productPackages) {
        expect(checkReleaseRepository({ dir, manifest: {
          name, repository: { type: 'git', url, directory: dir },
        } })).toHaveLength(1)
      }
    },
  )

  it('rejects a different package identity or repository directory', () => {
    const [dir, name] = productPackages[0]
    expect(checkReleaseRepository({ dir, manifest: {
      name: '@deepseek-ai/dsh-impostor', repository: { type: 'git', url: productUrl, directory: dir },
    } })).toEqual([`@deepseek-ai/dsh-impostor: product package directory ${dir} must declare name ${name}`])
    expect(checkReleaseRepository({ dir, manifest: {
      name, repository: { type: 'git', url: productUrl, directory: 'packages/elsewhere' },
    } })).toHaveLength(1)
  })

  it.each(['packages/core/session', 'vendor/cordis'])(
    'retains the strict upstream source rule for %s', (dir) => {
      expect(checkReleaseRepository({ dir, manifest: {
        name: '@deepseek-ai/dsh-probe', repository: { type: 'git', url: upstreamUrl, directory: dir },
      } })).toEqual([])
      expect(checkReleaseRepository({ dir, manifest: {
        name: '@deepseek-ai/dsh-man-roleplayer', repository: { type: 'git', url: productUrl, directory: dir },
      } })).toHaveLength(1)
    },
  )
})

describe('experimental workspace constraints', () => {
  it('requires the experimental package-name prefix', () => {
    expect(checkExperimentalManifest({
      ...experimental,
      manifest: { ...experimental.manifest, name: '@deepseek-ai/dsh-prototype' },
    })).toEqual([
      '@deepseek-ai/dsh-prototype: experimental package name must start with "@deepseek-ai/dsh-experimental-"',
    ])
  })

  it('requires private manifests without publication metadata', () => {
    expect(checkExperimentalManifest(experimental)).toEqual([])
    expect(checkExperimentalManifest({
      ...experimental,
      manifest: { ...experimental.manifest, private: false, publishConfig: { access: 'public' } },
    })).toEqual([
      '@deepseek-ai/dsh-experimental-prototype: experimental package must set "private": true',
      '@deepseek-ai/dsh-experimental-prototype: experimental package must omit publishConfig',
    ])
  })

  it.each(['dependencies', 'optionalDependencies', 'peerDependencies'] as const)(
    'rejects release %s on an experimental package',
    (section) => {
      expect(checkExperimentalDependencyIsolation([experimental, {
        dir: 'packages/core/consumer',
        manifest: {
          name: '@deepseek-ai/dsh-consumer',
          [section]: { '@deepseek-ai/dsh-experimental-prototype': 'workspace:^' },
        },
      }])).toEqual([
        `@deepseek-ai/dsh-consumer: ${section}.@deepseek-ai/dsh-experimental-prototype must not reference an experimental package`,
      ])
    },
  )

  it('allows development and experimental consumers but rejects the Python release runtime', () => {
    const manifests: WorkspaceManifest[] = [experimental, {
      dir: 'packages/core/test-only',
      manifest: {
        name: '@deepseek-ai/dsh-test-only',
        devDependencies: { '@deepseek-ai/dsh-experimental-prototype': 'workspace:^' },
      },
    }, {
      dir: 'packages/experimental/consumer',
      manifest: {
        name: '@deepseek-ai/dsh-experimental-consumer',
        dependencies: { '@deepseek-ai/dsh-experimental-prototype': 'workspace:^' },
      },
    }, {
      dir: 'python/sdk-runtime',
      manifest: {
        name: '@deepseek-ai/dsh-python-runtime',
        dependencies: { '@deepseek-ai/dsh-experimental-prototype': 'workspace:^' },
      },
    }]

    expect(checkExperimentalDependencyIsolation(manifests)).toEqual([
      '@deepseek-ai/dsh-python-runtime: dependencies.@deepseek-ai/dsh-experimental-prototype must not reference an experimental package',
    ])
  })
})
