/** 为 Knip 解释 Cordis 装配元数据，不执行产品模块或 Loader 表达式。 */

import { globSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import type { KnipConfiguration, WorkspaceProjectConfig } from 'knip'
import { isCordisGroupEntry, loadCordisYaml } from './cordis-yaml.ts'

interface Manifest {
  name: string
  workspaces?: string[]
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  dsh?: { bundle?: { patch?: string } }
}

/** 产品装配元数据的位置；这些输入都属于公开源码。 */
export interface CordisKnipOptions {
  bundleDirectory: string
  inheritedWorkspace: string
  profileSource: string
  browserSeed: { owner: string; source: string }
}

function manifestAt(root: string, file: string): Manifest {
  return JSON.parse(readFileSync(resolve(root, file), 'utf8')) as Manifest
}

function packageName(specifier: string): string | undefined {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.includes(':')) return undefined
  return specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/')
}

function pluginPackages(source: string): Set<string> {
  const packages = new Set<string>()
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }
    if (typeof value !== 'object' || value === null) return
    const entry = value as Record<string, unknown>
    if (entry.disabled === true) return
    if (typeof entry.name === 'string') {
      const name = packageName(entry.name)
      if (name !== undefined) packages.add(name)
    }
    if (isCordisGroupEntry(entry)) visit(entry.config)
    if (Array.isArray(entry.insert)) visit(entry.insert)
    if (entry.name === '@deepseek-ai/cordis-plugin-include'
      && typeof entry.config === 'object' && entry.config !== null) {
      visit((entry.config as Record<string, unknown>).patches)
    }
  }
  // !!js 保留为数据；普通 config.name 不是 Loader 行，不能伪造依赖用途。
  visit(loadCordisYaml(source))
  return packages
}

function profileLayers(source: string, target: string): Set<string> {
  const file = ts.createSourceFile('profiles.ts', source, ts.ScriptTarget.Latest, true)
  const layers = new Set<string>()
  const declaration = file.statements.filter(ts.isVariableStatement)
    .flatMap(statement => [...statement.declarationList.declarations])
    .find(node => ts.isIdentifier(node.name) && node.name.text === 'PROFILE_TEMPLATES')
  if (declaration?.initializer === undefined || !ts.isObjectLiteralExpression(declaration.initializer)) {
    throw new Error('Knip: PROFILE_TEMPLATES must remain explicit static profile metadata')
  }
  for (const profile of declaration.initializer.properties) {
    if (!ts.isPropertyAssignment(profile) || !ts.isArrayLiteralExpression(profile.initializer)) {
      throw new Error('Knip: profile bundle layers must be explicit string arrays')
    }
    const names: string[] = []
    for (const element of profile.initializer.elements) {
      if (!ts.isStringLiteral(element)) throw new Error('Knip: profile bundle layers must be explicit string arrays')
      names.push(element.text)
    }
    if (names.includes(target)) for (const name of names) layers.add(name)
  }
  return layers
}

function importPackages(source: string, valuesOnly = false): Set<string> {
  const file = ts.createSourceFile('seed.ts', source, ts.ScriptTarget.Latest, true)
  const packages = new Set<string>()
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const clause = statement.importClause
    const bindings = clause?.namedBindings
    if (valuesOnly && (clause?.phaseModifier === ts.SyntaxKind.TypeKeyword
      || (clause !== undefined && clause.name === undefined && bindings !== undefined
        && ts.isNamedImports(bindings) && bindings.elements.every(element => element.isTypeOnly)))) continue
    const name = packageName(statement.moduleSpecifier.text)
    if (name !== undefined) packages.add(name)
  }
  return packages
}

function matchingPatterns(root: string, directory: string, patterns: string | string[] | undefined): string[] {
  const values = typeof patterns === 'string' ? [patterns] : patterns ?? []
  // 空 glob 不是永久删除：每次载入重新匹配，未来新增 tests 会自动恢复原扫描规则。
  return values.filter(pattern => pattern.startsWith('!') || globSync(pattern, { cwd: resolve(root, directory) }).length > 0)
}

/**
 * 在原扫描清单上补充一个产品 Bundle 的可验证动态用途。
 * @param root - 工程根；不读取用户数据或安装目录。
 * @param base - 原 Knip 扫描配置。
 * @param options - 公开 profile、Bundle 与浏览器 core seed 的位置。
 * @returns 保留所有原规则、只定向解释现存装配用途的 Knip 配置。
 */
export function configureCordisKnip(root: string, base: KnipConfiguration, options: CordisKnipOptions): KnipConfiguration {
  const config = structuredClone(base)
  const workspaces = config.workspaces ?? {}
  const inherited = workspaces[options.inheritedWorkspace]
  const existing = workspaces[options.bundleDirectory]
  if (inherited === undefined) throw new Error('Knip: active Bundle workspace scanning rules are required')
  const manifest = manifestAt(root, `${options.bundleDirectory}/package.json`)
  const ownPatch = manifest.dsh?.bundle?.patch
  if (ownPatch === undefined) throw new Error('Knip: product Bundle must declare its actual patch')
  const direct = pluginPackages(readFileSync(resolve(root, options.bundleDirectory, ownPatch), 'utf8'))
  const layers = profileLayers(readFileSync(resolve(root, options.profileSource), 'utf8'), manifest.name)
  const assembly = new Set(layers)
  const rootManifest = manifestAt(root, 'package.json')
  const manifests = new Map((rootManifest.workspaces ?? []).flatMap(pattern =>
    globSync(`${pattern}/package.json`, { cwd: root })).map((file) => {
    const entry = manifestAt(root, file)
    return [entry.name, { file, entry }] as const
  }))
  for (const name of layers) {
    const layer = manifests.get(name)
    if (layer === undefined) throw new Error(`Knip: profile Bundle ${name} has no workspace manifest`)
    const patch = layer.entry.dsh?.bundle?.patch
    if (patch === undefined) throw new Error(`Knip: profile Bundle ${name} has no patch declaration`)
    const file = resolve(root, layer.file, '..', patch)
    for (const dependency of pluginPackages(readFileSync(file, 'utf8'))) assembly.add(dependency)
  }
  if (layers.has(options.browserSeed.owner)) {
    for (const dependency of importPackages(readFileSync(resolve(root, options.browserSeed.source), 'utf8'), true)) {
      assembly.add(dependency)
    }
  }
  const used = [
    ...Object.keys(manifest.dependencies ?? {}).filter(name => direct.has(name)),
    ...Object.entries(manifest.devDependencies ?? {}).filter(([name, version]) =>
      manifest.peerDependencies?.[name] === version && assembly.has(name)).map(([name]) => name),
  ]
  const sourceImports = new Set(globSync('src/**/*.{ts,tsx}', { cwd: resolve(root, options.bundleDirectory) })
    .flatMap(file => [...importPackages(readFileSync(resolve(root, options.bundleDirectory, file), 'utf8'))]))
  const selected: WorkspaceProjectConfig = {
    ...inherited,
    ...existing,
    ignoreDependencies: [
      ...inherited.ignoreDependencies ?? [], ...existing?.ignoreDependencies ?? [],
      ...used.filter(name => !sourceImports.has(name)),
    ],
  }
  selected.entry = matchingPatterns(root, options.bundleDirectory, selected.entry)
  selected.project = matchingPatterns(root, options.bundleDirectory, selected.project)
  config.workspaces = { ...workspaces, [options.bundleDirectory]: selected }
  return config
}
