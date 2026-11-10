/**
 * Generate `docs/legal/THIRD_PARTY_NOTICES.md` from the workspace manifests: every
 * external dependency named by a workspace `package.json`, the vendored-package
 * manifest in `vendor/README.md`, the Python `pyproject.toml` files, and the
 * pnpm patch list. License and repository metadata come from the installed
 * store, so the tree must be installed. `--check` verifies the committed
 * artifact. Tier policy and ownership live in
 * `.agents/notes/implemented/process/2026-07-30-generated-third-party-notices.md`.
 */

import { existsSync, globSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as yaml from 'js-yaml'
import { parse as parseToml, type TomlTableWithoutBigInt, type TomlValueWithoutBigInt } from 'smol-toml'
import parseSpdx from 'spdx-expression-parse'

const root = resolve(import.meta.dirname, '..')
const OUT = 'docs/legal/THIRD_PARTY_NOTICES.md'

/** Dependency-declaration kinds a consumer resolves at runtime. */
const RUNTIME_KINDS = ['dependencies', 'optionalDependencies'] as const
/** All manifest sections that name an external package this file must disclose. */
const ALL_KINDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const

/**
 * Workspace areas that never reach a user: repository tooling and gates (the
 * root manifest), test infrastructure, the documentation site, the runnable
 * demo leaves, and the native launcher's build workspace. A runtime
 * declaration by anything outside these areas is a disclosure-relevant
 * runtime dependency because any plugin package can be mounted from a user's
 * `cordis.yml`.
 */
const DEV_ONLY_AREAS = [
  'package.json',
  'packages/test-support/',
  'packages/test-support/client-runtime/',
  'website/',
  'examples/',
  'native/',
] as const

/** First-party public native packages: reachable at runtime but not third-party. */
const FIRST_PARTY = new Set([
  '@deepseek-ai/node-addon-landlock-run',
  '@deepseek-ai/node-addon-landlock-run-linux-arm64',
  '@deepseek-ai/node-addon-landlock-run-linux-x64',
])

/** Official SDK identity covered by the project's narrow owner authorization. */
export const CLAUDE_AGENT_SDK_PACKAGE = '@anthropic-ai/claude-agent-sdk'
const CLAUDE_PLATFORM_PACKAGE_PREFIX = `${CLAUDE_AGENT_SDK_PACKAGE}-`
const CLAUDE_PLATFORM_DECLARED_LICENSE = 'SEE LICENSE IN LICENSE.md'

/**
 * Whether a non-permissive runtime declaration has an identity-scoped owner
 * authorization. This does not reclassify its terms as permissive.
 * @param name - exact npm package identity.
 * @returns true only for the official Claude Agent SDK package.
 */
export function isOwnerAuthorizedRuntime(name: string): boolean {
  return name === CLAUDE_AGENT_SDK_PACKAGE
}

/**
 * Metadata overrides where the installed manifest is wrong or unreachable.
 * Each entry documents why the store cannot answer.
 */
const OVERRIDES: Record<string, { license?: string; repo?: string }> = {
  // Rust workspaces publishing npm bins without `license` in package.json.
  'oxlint': { license: 'MIT', repo: 'https://github.com/oxc-project/oxc' },
  'oxlint-tsgolint': { license: 'MIT', repo: 'https://github.com/oxc-project/tsgolint' },
  // `license: SEE LICENSE IN LICENSE`: the servers repo is mid MIT→Apache-2.0
  // relicensing, so the effective terms are per-contribution.
  '@modelcontextprotocol/server-everything': { license: 'MIT / Apache-2.0', repo: 'https://github.com/modelcontextprotocol/servers' },
  '@modelcontextprotocol/server-filesystem': { license: 'MIT / Apache-2.0', repo: 'https://github.com/modelcontextprotocol/servers' },
  // No repository field in the published manifest.
  'node-addon-require-builtin': { repo: 'https://www.npmjs.com/package/node-addon-require-builtin' },
}

/**
 * Python dependencies are few and named directly in `pyproject.toml` files
 * without installed metadata to harvest, so license/repo are recorded here and
 * the generator fails when a manifest names a package this map misses.
 */
const PYTHON_METADATA: Record<string, { license: string; repo: string; role: string }> = {
  pydantic: { license: 'MIT', repo: 'https://github.com/pydantic/pydantic', role: '`deepseek-harness-sdk` 运行时依赖' },
  hatchling: { license: 'MIT', repo: 'https://github.com/pypa/hatch', role: '构建后端' },
  pytest: { license: 'MIT', repo: 'https://github.com/pytest-dev/pytest', role: '仅测试使用' },
}

type PythonMetadata = typeof PYTHON_METADATA

/** Tools fetched by scripts at build time, keyed by the pin the script owns. */
const BUILD_TIME_TOOLS = [
  {
    name: '@yao-pkg/pkg',
    license: 'MIT',
    repo: 'https://github.com/yao-pkg/pkg',
    role: '由 `scripts/build-exe-for-python-sdk.ts` 调用，组装单文件 SDK runtime 可执行文件',
    pinSource: 'scripts/build-exe-for-python-sdk.ts',
  },
]

/** The `package.json` fields this generator reads. */
export interface Manifest {
  name?: string
  version?: string
  private?: boolean
  license?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

/** One disclosed external npm dependency. */
interface ExternalDep {
  name: string
  license: string
  repo: string
  /** True when some shipped workspace consumer reaches it through runtime dependency edges. */
  runtime: boolean
}

/** Read and parse a workspace-relative `package.json`. */
function readManifest(rel: string): Manifest {
  return JSON.parse(readFileSync(resolve(root, rel), 'utf8')) as Manifest
}

/**
 * Manifest globs, derived from the workspace declarations rather than listed
 * here, so a new member area (`tools/*`) is read the day it is declared.
 * @returns one glob per manifest-bearing location, repository-relative.
 */
export function manifestPatterns(rootMembers: readonly string[]): string[] {
  return [
    'package.json',
    ...rootMembers.map(member => `${member}/package.json`),
    // The demo leaves join the workspace through `examples/package.json`, so
    // their own manifests are members of nothing and no glob above reaches them.
    'examples/*/package.json',
  ]
}

/** The `packages:` member globs declared by one pnpm workspace file. */
function workspaceMembers(rel: string): string[] {
  const declared = (yaml.load(readFileSync(resolve(root, rel), 'utf8')) as { packages?: unknown }).packages
  if (!Array.isArray(declared) || declared.length === 0) {
    throw new Error(`gen-third-party-notices: ${rel} declares no workspace members; the manifest set cannot be derived.`)
  }
  return declared.map(member => String(member))
}

/**
 * Every workspace manifest, keyed by repository-relative path, plus the set of
 * workspace package names. Paths are normalized to `/` at ingestion: Node's
 * `fs.globSync` returns OS-native separators, and the area matching in
 * `tierExternalDeps` compares `/`-suffixed prefixes, so Windows backslashes
 * would silently push dev-area manifests into the runtime tier.
 */
function loadWorkspaceManifests(): { manifests: Map<string, Manifest>; names: Set<string> } {
  const patterns = manifestPatterns(workspaceMembers('pnpm-workspace.yaml'))
  const manifests = new Map<string, Manifest>()
  const names = new Set<string>()
  for (const pattern of patterns) {
    for (const path of globSync(pattern, { cwd: root })) {
      const normalized = path.replaceAll('\\', '/')
      const manifest = readManifest(normalized)
      manifests.set(normalized, manifest)
      if (manifest.name !== undefined) names.add(manifest.name)
    }
  }
  if (manifests.size < 100) throw new Error(`gen-third-party-notices: only ${manifests.size} workspace manifests found; the glob set is stale.`)
  return { manifests, names }
}

type VirtualManifest = Manifest & {
  claudeCodeVersion?: string
  license?: string
  repository?: string | { url?: string }
  homepage?: string
}

/** One platform payload declared by the official Claude Agent SDK. */
export interface ClaudePlatformPayload {
  readonly name: string
  readonly version: string
}

/** Current SDK and CLI distribution facts derived from the installed SDK manifest. */
export interface ClaudeDistribution {
  readonly sdkVersion: string
  readonly claudeCodeVersion: string
  readonly payloads: ClaudePlatformPayload[]
}

function requiredManifestString(
  value: string | undefined,
  field: string,
): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`gen-third-party-notices: ${CLAUDE_AGENT_SDK_PACKAGE} has no ${field}.`)
  }
  return value
}

/**
 * Derive the official platform payload set without a version or platform
 * allowlist. Only identities in the SDK's own package namespace are covered.
 * @param manifest - installed official SDK manifest.
 * @returns current SDK, CLI, and optional platform payload facts.
 */
export function claudeDistributionFromManifest(
  manifest: VirtualManifest,
): ClaudeDistribution {
  if (manifest.name !== CLAUDE_AGENT_SDK_PACKAGE) {
    throw new Error(
      `gen-third-party-notices: expected ${CLAUDE_AGENT_SDK_PACKAGE} manifest, got ${JSON.stringify(manifest.name)}.`,
    )
  }
  const sdkVersion = requiredManifestString(manifest.version, 'version')
  const claudeCodeVersion = requiredManifestString(
    manifest.claudeCodeVersion,
    'claudeCodeVersion',
  )
  const entries = Object.entries(manifest.optionalDependencies ?? {})
  if (entries.length === 0) {
    throw new Error(
      `gen-third-party-notices: ${CLAUDE_AGENT_SDK_PACKAGE} declares no optional platform payloads.`,
    )
  }
  const payloads = entries.map(([name, version]) => {
    if (!name.startsWith(CLAUDE_PLATFORM_PACKAGE_PREFIX)) {
      throw new Error(
        `gen-third-party-notices: ${CLAUDE_AGENT_SDK_PACKAGE} optional dependency ${name} is outside its authorized platform-payload identity.`,
      )
    }
    return {
      name,
      version: requiredManifestString(version, `${name} optional dependency version`),
    }
  }).sort((left, right) => left.name.localeCompare(right.name))
  return { sdkVersion, claudeCodeVersion, payloads }
}

/**
 * Resolve one package's manifest inside a pnpm virtual store. The prefix scan
 * matches ordinary `@scope+name@version` directory names; pnpm 11 truncates
 * long names (a peer-suffixed name past the length limit becomes
 * `<prefix>_<hash>`), so a content scan falls back over the whole store when
 * the prefix misses.
 *
 * @param virtual - the `.pnpm` virtual store directory to scan.
 * @param name - the external package name, exactly as `node_modules` spells it.
 * @returns the parsed manifest, or `undefined` when neither the prefix match
 *   nor the content scan finds the package's `package.json`.
 */
export function virtualManifest(virtual: string, name: string): VirtualManifest | undefined {
  const prefix = `${name.replace('/', '+')}@`
  const entry = readdirSync(virtual).find(dir => dir.startsWith(prefix))
  if (entry !== undefined) {
    return JSON.parse(readFileSync(resolve(virtual, entry, 'node_modules', name, 'package.json'), 'utf8')) as VirtualManifest
  }
  for (const dir of readdirSync(virtual)) {
    const candidate = resolve(virtual, dir, 'node_modules', name, 'package.json')
    if (existsSync(candidate)) {
      return JSON.parse(readFileSync(candidate, 'utf8')) as VirtualManifest
    }
  }
  return undefined
}

/** Resolve one installed external package manifest from either pnpm store. */
function installedManifest(name: string): VirtualManifest | undefined {
  let manifest: (Manifest & { license?: string; repository?: string | { url?: string }; homepage?: string }) | undefined
  // Workspace-local link farms can expose a dependency that is not linked at
  // the repository root; both are backed by the root workspace's lockfile.
  for (const store of ['node_modules', 'native/landlock-run/node_modules']) {
    const direct = resolve(root, store, name, 'package.json')
    if (existsSync(direct)) {
      manifest = JSON.parse(readFileSync(direct, 'utf8')) as typeof manifest
      break
    }
    const virtual = resolve(root, store, '.pnpm')
    if (!existsSync(virtual)) continue
    manifest = virtualManifest(virtual, name)
    if (manifest !== undefined) break
  }
  return manifest
}

/** License and repository URL for an installed external package, from the pnpm store. */
function installedMetadata(name: string): { license: string; repo: string } {
  const override = OVERRIDES[name]
  const manifest = installedManifest(name)
  const license = override?.license ?? manifest?.license
  const rawRepo = typeof manifest?.repository === 'string' ? manifest.repository : manifest?.repository?.url ?? manifest?.homepage
  const repo = override?.repo ?? normalizeRepo(rawRepo)
  if (license === undefined || repo === undefined) {
    throw new Error(`gen-third-party-notices: cannot resolve ${license === undefined ? 'license' : 'repository'} for ${name}; run \`pnpm install\`, or add an OVERRIDES entry.`)
  }
  return { license, repo }
}

function collectClaudeDistribution(): ClaudeDistribution {
  const manifest = installedManifest(CLAUDE_AGENT_SDK_PACKAGE)
  if (manifest === undefined) {
    throw new Error(
      `gen-third-party-notices: cannot resolve ${CLAUDE_AGENT_SDK_PACKAGE}; run \`pnpm install\`.`,
    )
  }
  const distribution = claudeDistributionFromManifest(manifest)
  let installedPayloads = 0
  for (const payload of distribution.payloads) {
    const installed = installedManifest(payload.name)
    if (installed === undefined) continue
    installedPayloads += 1
    if (
      installed.name !== payload.name
      || installed.version !== payload.version
      || installed.license !== CLAUDE_PLATFORM_DECLARED_LICENSE
    ) {
      throw new Error(
        `gen-third-party-notices: installed ${payload.name} does not match its SDK-declared version and ${CLAUDE_PLATFORM_DECLARED_LICENSE} license field.`,
      )
    }
  }
  if (installedPayloads === 0) {
    throw new Error(
      'gen-third-party-notices: no SDK-declared Claude platform payload is installed; install optional dependencies before regenerating.',
    )
  }
  return distribution
}

/** Normalize a manifest repository/homepage value to a browsable https URL. */
function normalizeRepo(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === '') return undefined
  let url = raw
    .replace(/^git\+ssh:\/\/git@/, 'https://')
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^github:/, 'https://github.com/')
    .replace(/\.git$/, '')
  if (!url.startsWith('http')) url = `https://github.com/${url}`
  return url
}

/**
 * External npm dependencies, tiered by which workspace area declares them at
 * runtime: a package is runtime when any manifest outside `DEV_ONLY_AREAS`
 * names it in `dependencies`/`optionalDependencies`. A package declared only
 * by tooling, test infrastructure, the website, or the demo leaves — whatever
 * the declaring section is called — is development-only.
 */
function collectNpmDeps(): ExternalDep[] {
  const { manifests, names } = loadWorkspaceManifests()
  return [...tierExternalDeps(manifests, names)]
    .filter(([name]) => !FIRST_PARTY.has(name))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, runtime]) => ({ name, ...installedMetadata(name), runtime }))
}

/**
 * Tier every external dependency the workspace declares.
 * @param manifests - workspace manifests keyed by repository-relative path.
 * @param names - every workspace package name, which never counts as external.
 * @returns each external package mapped to whether it is a runtime dependency.
 */
export function tierExternalDeps(manifests: Map<string, Manifest>, names: Set<string>): Map<string, boolean> {
  const tiers = new Map<string, boolean>()
  // `tsx` is runtime by fiat: the root source-run scripts execute through its ESM hook.
  tiers.set('tsx', true)
  for (const [path, manifest] of manifests) {
    const devOnly = DEV_ONLY_AREAS.some(area => (area.endsWith('/') ? path.startsWith(area) : path === area))
    for (const kind of ALL_KINDS) {
      for (const [dep, range] of Object.entries(manifest[kind] ?? {})) {
        if (names.has(dep) || range.startsWith('workspace:')) continue
        const runtime = !devOnly && (RUNTIME_KINDS as readonly string[]).includes(kind)
        tiers.set(dep, (tiers.get(dep) ?? false) || runtime)
      }
    }
  }
  return tiers
}

/** A vendored package row parsed out of the `vendor/README.md` manifest table. */
export interface VendoredRow {
  npmName: string
  /** The name this package carries upstream; MIT attribution names the fork's origin, not our scope. */
  upstreamName: string
  upstream: string
}

/**
 * Parse the vendored-package manifest table out of `vendor/README.md`.
 * @param text - the complete `vendor/README.md` contents.
 * @returns one row per manifest-table entry, in table order.
 */
export function parseVendoredRows(text: string): VendoredRow[] {
  const rows: VendoredRow[] = []
  for (const line of text.split('\n')) {
    const match = new RegExp(String.raw`^\| \x60\S+\/\x60 \| \x60([^\x60]+)\x60 \| \x60([^\x60]+)\x60 \| \S+ \| `
      + String.raw`(https:\/\/\S+?)(?: \([^)]*\))? \| \x60[0-9a-f]+\x60 \|$`).exec(line)
    if (match === null) continue
    const [, npmName, upstreamName, upstream] = match
    if (npmName === undefined || upstreamName === undefined || upstream === undefined) continue
    rows.push({ npmName, upstreamName, upstream })
  }
  return rows
}

/**
 * Parse the vendored manifest table and confirm it accounts for every vendored
 * directory. The `vendor/` tree — not the table — is the set that must be
 * disclosed, so a row that stops matching the table format is a hard error
 * rather than a package that quietly vanishes from the notices.
 */
function collectVendored(): VendoredRow[] {
  const rows = parseVendoredRows(readFileSync(resolve(root, 'vendor/README.md'), 'utf8'))
  const onDisk = new Map<string, string>()
  for (const entry of readdirSync(resolve(root, 'vendor'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const manifest = readManifest(`vendor/${entry.name}/package.json`)
    if (manifest.name !== undefined) onDisk.set(manifest.name, entry.name)
  }

  const parsed = new Set(rows.map(row => row.npmName))
  const missing = [...onDisk.keys()].filter(name => !parsed.has(name))
  if (missing.length > 0) {
    throw new Error(`gen-third-party-notices: vendor/README.md has no manifest-table row for ${missing.join(', ')}; its table format changed or the sync is incomplete.`)
  }
  for (const row of rows) {
    const dir = onDisk.get(row.npmName)
    if (dir === undefined) throw new Error(`gen-third-party-notices: vendored package ${row.npmName} from vendor/README.md has no vendor/ directory.`)
    const license = readManifest(`vendor/${dir}/package.json`).license
    if (license !== 'MIT') {
      throw new Error(`gen-third-party-notices: vendored ${row.npmName} declares license ${JSON.stringify(license)}; the vendored section assumes MIT throughout.`)
    }
  }
  return rows
}

/** Whether a parsed TOML value is a table rather than an array or scalar. */
function isTomlTable(value: TomlValueWithoutBigInt | undefined): value is TomlTableWithoutBigInt {
  return value !== undefined && typeof value === 'object' && !Array.isArray(value)
}

/** Parse one PEP 508 requirement string into its distribution name. */
function parsePythonRequirement(requirement: string): string {
  const name = /^\s*([a-zA-Z][a-zA-Z0-9._-]*)\s*(?:\[[^\]]*\])?\s*(?:[<>=!~;@].*)?$/.exec(requirement)?.[1]
  if (name === undefined) {
    throw new Error(`gen-third-party-notices: cannot read a distribution name from the requirement ${JSON.stringify(requirement)}.`)
  }
  return name
}

/** Add the string requirements from one parsed TOML array. */
function collectPythonRequirementArray(
  names: string[],
  value: TomlValueWithoutBigInt | undefined,
  location: string,
  allowGroupIncludes = false,
): void {
  if (value === undefined) return
  if (!Array.isArray(value)) {
    throw new Error(`gen-third-party-notices: ${location} must be an array.`)
  }
  for (const item of value) {
    if (typeof item === 'string') {
      names.push(parsePythonRequirement(item))
      continue
    }
    if (allowGroupIncludes && isTomlTable(item) && typeof item['include-group'] === 'string' && Object.keys(item).length === 1) {
      continue
    }
    throw new Error(`gen-third-party-notices: ${location} contains an unsupported requirement entry.`)
  }
}

/** Read an optional TOML table and reject a present non-table value. */
function optionalTomlTable(value: TomlValueWithoutBigInt | undefined, location: string): TomlTableWithoutBigInt | undefined {
  if (value === undefined || isTomlTable(value)) return value
  throw new Error(`gen-third-party-notices: ${location} must be a table.`)
}

/**
 * Parse a `pyproject.toml` project identity and every requirement it declares:
 * `requires` under
 * `[build-system]`, `dependencies` under `[project]`, and every key under
 * `[project.optional-dependencies]` and `[dependency-groups]`. A TOML parser
 * owns comments, quoted keys, escapes, and array boundaries; unsupported
 * requirement forms fail instead of disappearing from the notices.
 * @param text - the complete `pyproject.toml` contents.
 * @returns the local project name and declared requirement names.
 */
function parsePyproject(text: string): { projectName?: string; requirements: string[] } {
  const names: string[] = []
  const document = parseToml(text, { integersAsBigInt: false })
  const buildSystem = optionalTomlTable(document['build-system'], '[build-system]')
  const project = optionalTomlTable(document.project, '[project]')
  const projectName = project?.name
  if (projectName !== undefined && typeof projectName !== 'string') {
    throw new Error('gen-third-party-notices: [project].name must be a string.')
  }
  collectPythonRequirementArray(names, buildSystem?.requires, '[build-system].requires')
  collectPythonRequirementArray(names, project?.dependencies, '[project].dependencies')

  const optional = optionalTomlTable(project?.['optional-dependencies'], '[project.optional-dependencies]')
  for (const [group, requirements] of Object.entries(optional ?? {})) {
    collectPythonRequirementArray(names, requirements, `[project.optional-dependencies].${group}`)
  }

  const groups = optionalTomlTable(document['dependency-groups'], '[dependency-groups]')
  for (const [group, requirements] of Object.entries(groups ?? {})) {
    collectPythonRequirementArray(names, requirements, `[dependency-groups].${group}`, true)
  }
  return projectName === undefined
    ? { requirements: names }
    : { projectName, requirements: names }
}

/**
 * Read every requirement name declared by one `pyproject.toml`.
 * @param text - the complete `pyproject.toml` contents.
 * @returns each declared requirement's distribution name, in file order.
 */
export function parsePyprojectRequirements(text: string): string[] {
  return parsePyproject(text).requirements
}

/** Normalize a Python distribution name according to the packaging name rule. */
function normalizePythonDistributionName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-')
}

/**
 * Resolve external Python dependencies after excluding local project names.
 * @param pyprojects - complete local `pyproject.toml` contents.
 * @param metadata - disclosure metadata for every external dependency.
 * @returns disclosed dependencies in normalized name order.
 */
export function collectPythonDependencies(
  pyprojects: string[],
  metadata: PythonMetadata = PYTHON_METADATA,
): { name: string; license: string; repo: string; role: string }[] {
  const parsed = pyprojects.map(parsePyproject)
  const firstParty = new Set(parsed.flatMap(({ projectName }) => (
    projectName === undefined ? [] : [normalizePythonDistributionName(projectName)]
  )))
  const found = new Set(parsed
    .flatMap(({ requirements }) => requirements.map(normalizePythonDistributionName))
    .filter(name => !firstParty.has(name)))
  return [...found].sort((a, b) => a.localeCompare(b)).map((name) => {
    const entry = metadata[name]
    if (entry === undefined) throw new Error(`gen-third-party-notices: python dependency ${name} is missing from PYTHON_METADATA.`)
    return { name, ...entry }
  })
}

/** Direct Python dependencies named by the `pyproject.toml` manifests under `python/`. */
function collectPython(): { name: string; license: string; repo: string; role: string }[] {
  const manifests = globSync('python/*/pyproject.toml', { cwd: root })
  if (manifests.length === 0) throw new Error('gen-third-party-notices: no python/*/pyproject.toml found; the Python tree moved.')
  return collectPythonDependencies(manifests.map(path => readFileSync(resolve(root, path), 'utf8')))
}

/** pnpm-patched external packages, from `pnpm-workspace.yaml`. */
function collectPatched(): { spec: string; patch: string }[] {
  const workspace = yaml.load(readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8')) as { patchedDependencies?: Record<string, string> }
  return Object.entries(workspace.patchedDependencies ?? {}).map(([spec, patch]) => ({ spec, patch }))
}

/** Verify each build-time tool pin still appears in its owning script. */
function verifyBuildTimePins(): void {
  for (const tool of BUILD_TIME_TOOLS) {
    const text = readFileSync(resolve(root, tool.pinSource), 'utf8')
    if (!text.includes(tool.name)) {
      throw new Error(`gen-third-party-notices: ${tool.pinSource} no longer references ${tool.name}; update BUILD_TIME_TOOLS.`)
    }
  }
}

/** SPDX identifiers this project may ship without further review. */
const PERMISSIVE_LICENSES = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'Unlicense', 'CC0-1.0', 'BlueOak-1.0.0', 'Python-2.0'])

/** Evaluate a parsed SPDX expression under the repository's license policy. */
function isPermissiveSpdx(expression: ReturnType<typeof parseSpdx>): boolean {
  if ('conjunction' in expression) {
    return expression.conjunction === 'and'
      ? isPermissiveSpdx(expression.left) && isPermissiveSpdx(expression.right)
      : isPermissiveSpdx(expression.left) || isPermissiveSpdx(expression.right)
  }
  return expression.plus !== true
    && expression.exception === undefined
    && PERMISSIVE_LICENSES.has(expression.license)
}

/**
 * Whether an SPDX expression grants terms this project may ship under.
 * `OR` needs one permissive alternative, because the consumer chooses; `AND`
 * needs all of them, because every obligation applies. Anything that is not a
 * recognized permissive identifier — copyleft, an exception clause, or a
 * license this list has never seen — evaluates to false, so an unfamiliar
 * expression fails closed rather than passing on a partial match.
 * @param license - the SPDX expression from the package manifest.
 * @returns true when the expression's obligations are all permissive.
 */
export function isPermissive(license: string): boolean {
  // Some npm manifests use a slash for a choice despite SPDX requiring `OR`.
  const normalized = license.replace(/\s*\/\s*/g, ' OR ').trim()
  try {
    return isPermissiveSpdx(parseSpdx(normalized))
  } catch {
    return false
  }
}

/**
 * Render the sentence that isolates non-permissive development tooling, or
 * nothing at all when every development dependency is permissive.
 * @param deps - development dependencies whose license is not permissive.
 * @returns the paragraph to place after the development table.
 */
function renderNonPermissiveNote(deps: ExternalDep[]): string {
  if (deps.length === 0) return ''
  const named = deps.map(dep => `\`${dep.name}\` (${dep.license})`)
  const subject = named.length === 1 ? named[0] : `${named.slice(0, -1).join(', ')} 及 ${named.at(-1)}`
  return `\n${subject} 仅用于开发工具，其代码不会链接或分发到 DeepSeek Harness 交付产物中。\n`
}

/** Render one npm dependency table. */
function renderNpmTable(deps: ExternalDep[]): string {
  const lines = ['| 包 | 许可证 |', '| --- | --- |']
  for (const dep of deps) lines.push(`| [\`${dep.name}\`](${dep.repo}) | ${dep.license} |`)
  return lines.join('\n')
}

function renderClaudeDistribution(
  distribution: ClaudeDistribution | undefined,
): string {
  if (distribution === undefined) return ''
  const rows = distribution.payloads.map(payload =>
    `| [\`${payload.name}\`](https://www.npmjs.com/package/${payload.name}) | ${payload.version} | ${CLAUDE_PLATFORM_DECLARED_LICENSE} |`,
  )
  return `
## 官方 Claude Code 平台载荷

项目所有者授权分发官方 \`${CLAUDE_AGENT_SDK_PACKAGE}\` 包的各版本及各版本通过 \`optionalDependencies\` 声明的官方 Claude Code CLI／平台载荷。授权仅覆盖这些包的身份，不将其条款视为宽松许可证，也不覆盖无关运行时包；版本、声明许可证或载荷集合变化仍须按通常流程审查依赖、锁文件、兼容性、条款与声明。

已安装 SDK ${distribution.sdkVersion} 声明下列可选平台包，每个包携带官方 Claude Code ${distribution.claudeCodeVersion} 可执行文件。包身份与版本来自 SDK manifest；许可证声明字段根据当前主机已安装的平台载荷核对。

| 可选平台包 | 版本 | 声明的许可证 |
| --- | --- | --- |
${rows.join('\n')}
`
}

/**
 * Render the complete notices document.
 * @returns the exact bytes `docs/legal/THIRD_PARTY_NOTICES.md` must hold.
 */
export function render(): string {
  verifyBuildTimePins()
  const npm = collectNpmDeps()
  const runtimeDeps = npm.filter(dep => dep.runtime)
  const devDeps = npm.filter(dep => !dep.runtime)
  const vendored = collectVendored()
  const python = collectPython()
  const patched = collectPatched()
  const claudeDistribution = runtimeDeps.some(
    dep => dep.name === CLAUDE_AGENT_SDK_PACKAGE,
  )
    ? collectClaudeDistribution()
    : undefined
  const nonPermissiveDev = devDeps.filter(dep => !isPermissive(dep.license))
  // A copyleft license reaching a shipped surface is a distribution decision,
  // not a rendering detail; the notices cannot quietly absorb it.
  const nonPermissiveRuntime = runtimeDeps.filter(dep =>
    !isPermissive(dep.license)
    && !isOwnerAuthorizedRuntime(dep.name),
  )
  if (nonPermissiveRuntime.length > 0) {
    throw new Error(`gen-third-party-notices: runtime ${nonPermissiveRuntime.map(dep => `${dep.name} (${dep.license})`).join(', ')} is not a permissive license; review the distribution terms and record the decision before regenerating.`)
  }
  const patchedLines = patched.map(({ spec, patch }) => `- \`${spec}\` — [\`${patch}\`](../../${patch})`)

  return `<!-- Generated by scripts/gen-third-party-notices.ts — do not edit by hand.
     Run \`pnpm run gen-third-party-notices\` to regenerate. -->

# 第三方软件声明

DeepSeek Harness 使用 [MIT](../../LICENSE) 许可证，并依赖下列第三方软件。各项目继续适用其自身许可证，本文件不改变任何许可条款。

本文件列出工作区声明的**直接依赖**和已明确披露的官方 Claude Code 平台载荷闭包，由 \`scripts/gen-third-party-notices.ts\` 根据工作区清单生成。pre-commit hook 在输入文件发生暂存变更时更新本页；测试断言提交内容与生成结果一致。清单删除不会触发该 hook，由测试断言兜底；独立检查命令为 \`pnpm run verify-third-party-notices\`。

完整 npm 传递依赖闭包（包括 Landlock launcher 工作区）及精确版本记录在 [\`pnpm-lock.yaml\`](../../pnpm-lock.yaml)，可运行 \`pnpm licenses list\` 查看。Python 闭包单独记录在 [\`python/sdk/uv.lock\`](../../python/sdk/uv.lock)。

## 内置上游源码（\`vendor/\`）

Cordis 框架及基础库以源码形式纳入本仓库，并使用 \`@deepseek-ai\` scope 发布。这些库均使用 MIT 许可证，每个目录保留上游 \`LICENSE\`。具体上游提交和本地修改见 [\`vendor/README.md\`](../../vendor/README.md)。

| 包 | 上游名称 | 上游仓库 | 许可证 |
| --- | --- | --- | --- |
${vendored.map(row => `| \`${row.npmName}\` | \`${row.upstreamName}\` | [${row.upstream.replace('https://', '')}](${row.upstream}) | MIT |`).join('\n')}

## 运行时 npm 依赖

本节列出工作区包在运行时解析的外部依赖，覆盖用户可从 \`cordis.yml\` 装配的全部插件，包括默认 CLI、Web UI 和 Python SDK runtime 之外的插件。

${renderNpmTable(runtimeDeps)}

pnpm 在安装时对下列包应用本地补丁，交付产物因此包含修改后的副本；每个补丁文件记录完整修改：

${patchedLines.join('\n')}
${renderClaudeDistribution(claudeDistribution)}

## 仅由开发工具直接声明的 npm 依赖

本节列出仅由仓库工具、测试设施、文档站、示例或原生 launcher 构建工作区**直接声明**的外部包。交付入口本身不直接声明它们，但运行时依赖仍可能间接引入；完整闭包以 \`pnpm-lock.yaml\` 为准。因此本节记录声明归属，不代表最终打包内容。

${renderNpmTable(devDeps)}
${renderNonPermissiveNote(nonPermissiveDev)}
## Python SDK 依赖（\`python/\`）

各 \`pyproject.toml\` 的直接依赖，以及开发工作流工具 \`uv\`。

| 包 | 许可证 | 用途 |
| --- | --- | --- |
${python.map(dep => `| [\`${dep.name}\`](${dep.repo}) | ${dep.license} | ${dep.role} |`).join('\n')}
| [\`uv\`](https://github.com/astral-sh/uv) | MIT / Apache-2.0 | 开发工作流工具 |

## 构建时获取的工具

| 包 | 许可证 | 用途 |
| --- | --- | --- |
${BUILD_TIME_TOOLS.map(tool => `| [\`${tool.name}\`](${tool.repo}) | ${tool.license} | ${tool.role} |`).join('\n')}

## 本仓库原生包

\`@deepseek-ai/node-addon-landlock-run\` 及其平台包由本仓库构建和发布，使用 BSD 3-Clause 许可证。为完整性列于此处，其归属为本仓库软件。
`
}

/** CLI entry: default writes the notices, `--check` fails if the committed copy
 * is stale. Guarded behind an entry-point check so importing this module for
 * tests neither regenerates the committed file nor calls process.exit. */
function main(): void {
  const content = render()
  if (process.argv.includes('--check')) {
    let committed: string | null = null
    try {
      committed = readFileSync(resolve(root, OUT), 'utf8')
    } catch {
      // Only ENOENT (not yet generated) is expected; a present-but-unreadable
      // file is not a state this repo produces, and the remedy is the same.
      committed = null
    }
    if (committed === content) {
      console.log(`gen-third-party-notices: ${OUT} is up to date.`)
      process.exit(0)
    }
    console.error(`gen-third-party-notices: ${OUT} is stale. Run \`pnpm run gen-third-party-notices\` and commit ${OUT}.`)
    process.exit(1)
  }

  writeFileSync(resolve(root, OUT), content)
  console.log(`gen-third-party-notices: wrote ${OUT}.`)
}

// Run only when invoked as a script, not when imported by a test.
if (process.argv[1] !== undefined && import.meta.filename === resolve(process.argv[1])) {
  main()
}
