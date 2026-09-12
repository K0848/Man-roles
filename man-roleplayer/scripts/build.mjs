/**
 * man-roles-roleplayer 构建脚本：esbuild 打包 Host 面（lib/index.js）与
 * Client 面（lib/client.js）。@deepseek-ai/*、zod、react 保持 external。
 *
 * 使用 deepseek-harness 自带 esbuild（阶段 2 结论：pnpm ≥10 拦截 esbuild
 * postinstall，插件自身 node_modules 的 esbuild 二进制不可用）。harness 根
 * 默认相对本文件定位（../../deepseek-harness），可用环境变量
 * DSH_HARNESS_ROOT 覆盖。
 */
import { createRequire } from 'node:module'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve, relative, isAbsolute, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const harnessRoot = process.env.DSH_HARNESS_ROOT ?? join(here, '..', '..', '..', 'deepseek-harness')

/** 在 harness 的 .pnpm 目录中定位 esbuild（取最高版本）。 */
function locateHarnessEsbuild() {
  const pnpmDir = join(harnessRoot, 'node_modules', '.pnpm')
  const candidates = readdirSync(pnpmDir)
    .filter((d) => d.startsWith('esbuild@'))
    .sort((a, b) => (a.localeCompare(b, undefined, { numeric: true })))
  if (candidates.length === 0) {
    throw new Error(`未在 ${pnpmDir} 找到 esbuild@*；请检查 DSH_HARNESS_ROOT`)
  }
  return join(pnpmDir, candidates[candidates.length - 1], 'node_modules', 'esbuild')
}

const esbuildDir = locateHarnessEsbuild()
const require = createRequire(import.meta.url)
const { build: esbuildBuild } = require(join(esbuildDir, 'lib', 'main.js'))

const external = ['@deepseek-ai/*', 'zod', 'react', 'react-dom']

/**
 * Git checkout link 允许浏览器/Host 直接加载 lib；Windows 可能暂时保留
 * user-mapped section，使 esbuild 的 Go 写盘失败。所有 artifact 统一先在
 * 内存生成，再由 Node 原位写入同名目标，内容和 sourcemap 命名不变。
 */
async function build(options) {
  const result = await esbuildBuild({ ...options, write: false })
  for (const output of result.outputFiles ?? []) writeFileSync(output.path, output.contents)
  return result
}

mkdirSync(join(here, '..', 'lib'), { recursive: true })

// Manifest scan is a build gate: malformed packages fail before any artifact is emitted.
// The runtime bundle still inlines content; generated artifacts are never hand-maintained.
const personaRoot = join(here, '..', 'content', 'personas')
const manifestDirs = readdirSync(personaRoot).sort()
const manifests = []
const artifactEntries = []
const seenCanonical = new Set()
const seenLegacy = new Map()
for (const dir of manifestDirs) {
  const packageDir = join(personaRoot, dir)
  const manifest = JSON.parse(readFileSync(join(packageDir, 'manifest.json'), 'utf8'))
  if (manifest.id !== dir || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id)) throw new Error(`invalid persona manifest: ${dir}`)
  if (seenCanonical.has(manifest.id)) throw new Error(`duplicate canonical PersonaId: ${manifest.id}`)
  seenCanonical.add(manifest.id)
  for (const legacy of manifest.legacyIds ?? []) {
    if (seenLegacy.has(legacy) || seenCanonical.has(legacy)) throw new Error(`duplicate legacy PersonaId: ${legacy}`)
    seenLegacy.set(legacy, manifest.id)
  }
  const contentPath = (field) => {
    const value = manifest.content[field]
    if (typeof value !== 'string' || value.length === 0 || isAbsolute(value)) throw new Error(`invalid content path: ${manifest.id}.${field}`)
    const target = resolve(packageDir, value)
    const rel = relative(resolve(packageDir), target)
    if (rel === '..' || rel.startsWith(`..${sep}`)) throw new Error(`content path escapes package: ${manifest.id}.${field}`)
    return target
  }
  const readJson = (field) => JSON.parse(readFileSync(contentPath(field), 'utf8'))
  const prompt = readFileSync(contentPath('prompt'), 'utf8')
  const anecdotes = readJson('anecdotes')
  const quotes = readJson('quotes')
  const blacklist = readJson('blacklist')
  for (const entry of [...anecdotes, ...quotes, ...blacklist]) {
    const owner = entry.personaId
    if (owner !== undefined && owner !== manifest.id) throw new Error(`content ownership mismatch: ${manifest.id}`)
  }
  manifests.push(manifest)
  artifactEntries.push({ manifest, prompt, anecdotes, quotes, blacklist })
}
artifactEntries.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id))
writeFileSync(join(here, '..', 'src', 'persona', 'generated-artifact.ts'), `// Generated file; do not edit.\nexport const PERSONA_ARTIFACT = ${JSON.stringify(artifactEntries)} as const\n`)
// Deterministic generated metadata artifacts; source registration remains manifest-driven.
writeFileSync(join(here, '..', 'lib', 'registry-host.json'), JSON.stringify(manifests, null, 2) + '\n')
writeFileSync(join(here, '..', 'lib', 'registry-client.json'), JSON.stringify(manifests.filter((m) => m.status === 'active').map(({ id, displayName, status, legacyIds }) => ({ id, displayName, status, legacyIds })), null, 2) + '\n')
writeFileSync(join(here, '..', 'src', 'client', 'generated-metadata.ts'), `// Generated file; do not edit.\nexport const ACTIVE_PERSONAS = ${JSON.stringify(manifests.filter((m) => m.status === 'active').map(({ id, displayName, status }) => ({ id, displayName, status })))} as const\n`)

await build({
  entryPoints: [join(here, '..', 'src', 'index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external,
  loader: { '.md': 'text' }, // persona 成品（content/personas/*.md）构建期内联
  outfile: join(here, '..', 'lib', 'index.js'),
  sourcemap: true,
})

for (const [entry, out, extra] of [
  ['src/evidence/policy.ts', 'lib/evidence-policy.js', {}],
  ['src/evidence/ledger.ts', 'lib/evidence-ledger.js', {}],
  ['src/evidence/render.ts', 'lib/evidence-render.js', {}],
  ['src/runtime/submit-actor-reply.ts', 'lib/submit-actor-reply.js', {}],
  ['src/runtime/turn-budget.ts', 'lib/turn-budget.js', {}],
  ['src/runtime/actor-tools.ts', 'lib/actor-tools.js', {}],
  ['src/runtime/actor-tool-contract.ts', 'lib/actor-tool-contract.js', {}],
  ['src/runtime/actor-agent.ts', 'lib/actor-agent.js', { loader: { '.md': 'text' } }],
  ['src/runtime/turn-state.ts', 'lib/turn-state.js', {}],
  ['src/runtime/actor-reply-projection.ts', 'lib/actor-reply-projection.js', {}],
  ['src/runtime/actor-context-filter.ts', 'lib/actor-context-filter.js', {}],
  ['src/validation/native-evidence-report.ts', 'lib/native-evidence-report.js', {}],
  ['src/validation/task5-report.ts', 'lib/task5-report.js', {}],
  ['src/e2e/startup-retry.ts', 'lib/startup-retry.js', {}],
  ['src/e2e/batch-budget.ts', 'lib/batch-budget.js', {}],
  ['src/e2e/native-evidence-failure-replay.ts', 'lib/native-evidence-failure-replay.js', {}],
  ['src/e2e/delivery-probe.ts', 'lib/delivery-probe.js', {}],
  ['src/e2e/task5-host.ts', 'lib/task5-host.js', {}],
  ['src/e2e/phase7-task9-scripted.ts', 'lib/phase7-task9-scripted.js', {}],
  ['src/e2e/phase7-task9-real.ts', 'lib/phase7-task9-real.js', {}],
  ['src/runtime/task-outcome.ts', 'lib/task-outcome.js', {}],
  ['src/runtime/message-delivery.ts', 'lib/message-delivery.js', {}],
  ['src/runtime/recovery.ts', 'lib/recovery.js', {}],
]) {
  await build({ entryPoints: [join(here, '..', entry)], bundle: true, format: 'esm', platform: 'node', target: 'node22', external, loader: { '.md': 'text' }, ...(extra ?? {}), outfile: join(here, '..', out), sourcemap: true })
}

await build({ entryPoints: [join(here, '..', 'src', 'persona', 'registry.ts')], bundle: true, format: 'esm', platform: 'node', target: 'node22', external, loader: { '.md': 'text' }, outfile: join(here, '..', 'lib', 'persona-registry.js'), sourcemap: true })
await build({ entryPoints: [join(here, '..', 'src', 'persona', 'runtime-registry.ts')], bundle: true, format: 'esm', platform: 'node', target: 'node22', external, loader: { '.md': 'text' }, outfile: join(here, '..', 'lib', 'runtime-registry.js'), sourcemap: true })
await build({ entryPoints: [join(here, '..', 'src', 'persona', 'generator.ts')], bundle: true, format: 'esm', platform: 'node', target: 'node22', external, outfile: join(here, '..', 'lib', 'persona-generator.js'), sourcemap: true })

await build({
  entryPoints: [join(here, '..', 'src', 'client', 'index.ts')],
  bundle: true,
  // DSH Web loads plugin artifacts as registration scripts, not native ESM
  // modules.  CJS keeps external UI dependencies behind the loader-provided
  // require while this envelope publishes the package's client face.
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external,
  banner: { js: "window.__ModuleLoader__.load({ id: 'man-roles-roleplayer', factory: (require) => { var module = { exports: {} }; var exports = module.exports;" },
  footer: { js: 'return module.exports; } });' },
  outfile: join(here, '..', 'lib', 'client.js'),
  sourcemap: true,
})

await build({
  entryPoints: [join(here, '..', 'src', 'client', 'remote-probe.ts')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  external,
  outfile: join(here, '..', 'lib', 'client-remote-probe.js'),
  sourcemap: true,
})

await build({
  entryPoints: [join(here, '..', 'src', 'product', 'types.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external,
  outfile: join(here, '..', 'lib', 'product-types.js'),
  sourcemap: true,
})

// 纯逻辑模块独立 bundle（零 @deepseek-ai 运行时依赖）：单元测试直接 import，
// 避免整包 bundle 内的 e2e 触发 @deepseek-ai/* 解析。
await build({
  entryPoints: [join(here, '..', 'src', 'domain', 'schema.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external,
  outfile: join(here, '..', 'lib', 'schema.js'),
  sourcemap: true,
})
await build({
  entryPoints: [join(here, '..', 'src', 'domain', 'dilemma.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external,
  outfile: join(here, '..', 'lib', 'domain.js'),
  sourcemap: true,
})
await build({
  entryPoints: [join(here, '..', 'src', 'turn', 'ids.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external,
  outfile: join(here, '..', 'lib', 'turn.js'),
  sourcemap: true,
})
await build({
  entryPoints: [join(here, '..', 'src', 'context', 'assemble.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external,
  outfile: join(here, '..', 'lib', 'context.js'),
  sourcemap: true,
})

// ── 阶段 4 纯逻辑模块（零 @deepseek-ai 运行时依赖，供单元测试直接 import）──
for (const [entry, out] of [
  ['src/product/turn-runner.ts', 'lib/turn-runner.js'],
  ['src/product/branch-history.ts', 'lib/branch-history.js'],
  ['src/client/actor-reply-definition.ts', 'lib/actor-reply-definition.js'],
  ['src/product/native-actor-branch.ts', 'lib/native-actor-branch.js'],
  ['src/product/service.ts', 'lib/product-service.js'],
  ['src/client/product-controller.ts', 'lib/product-controller.js'],
  ['src/client/components/product-components.ts', 'lib/product-components.js'],
  ['src/validation/mvp-report.ts', 'lib/mvp-report.js'],
  ['src/e2e/mvp-host.ts', 'lib/mvp-host.js'],
  ['src/dialogue/turn-interpreter.ts', 'lib/turn-interpreter.js'],
  ['src/context/select-history.ts', 'lib/select-history.js'],
  ['src/evidence/web-collector.ts', 'lib/web-collector.js'],
  ['src/runtime/web-tool-seam.ts', 'lib/web-tool-seam.js'],
  ['src/dialogue/safety.ts', 'lib/dialogue-safety.js'],
  ['src/dialogue/control-classifier.ts', 'lib/dialogue-control.js'],
  ['src/dialogue/turn-policy.ts', 'lib/dialogue-policy.js'],
  ['src/dialogue/coordinator.ts', 'lib/dialogue-coordinator.js'],
  ['src/dialogue/director-update.ts', 'lib/dialogue-director.js'],
  ['src/dialogue/public-view.ts', 'lib/dialogue-view.js'],
  ['src/e2e/vertical-slice-dialogue-loop.ts', 'lib/dialogue-loop-e2e.js'],
  ['src/e2e/dialogue-loop-fixture.ts', 'lib/dialogue-loop-fixture.js'],
  ['src/storage/trunk-storage.ts', 'lib/storage.js'],
  ['src/aggregate/aggregate.ts', 'lib/aggregate.js'],
  ['src/branch/branch-manager.ts', 'lib/branch.js'],
  ['src/branch/message-source.ts', 'lib/message-source.js'],
  ['src/validation/control-loop-report.ts', 'lib/control-loop-report.js'],
  ['src/validation/dialogue-loop-report.ts', 'lib/dialogue-loop-report.js'],
  ['src/validation/phase7-task9-report.ts', 'lib/phase7-task9-report.js'],
]) {
  await build({
    entryPoints: [join(here, '..', entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    external,
    outfile: join(here, '..', out),
    sourcemap: true,
  })
}

// ── 阶段 5 纯逻辑模块（零 @deepseek-ai 运行时依赖，供单元测试直接 import）──
// persona 解析/组装（纯函数）；personas-data 内联 persona 成品文本（.md → text）；
// llm 层（client 契约 + judge/导演 模型化判定，judge.ts 为入口连带打包 client.ts）。
for (const [entry, out, extra] of [
  ['src/context/persona.ts', 'lib/persona.js', {}],
  ['src/context/personas-data.ts', 'lib/personas-data.js', { loader: { '.md': 'text' } }],
  ['src/llm/judge.ts', 'lib/llm.js', {}],
]) {
  await build({
    entryPoints: [join(here, '..', entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    external,
    ...extra,
    outfile: join(here, '..', out),
    sourcemap: true,
  })
}

// 阶段 5 运行时模块（DSH 接缝实现）：@deepseek-ai/dsh-llm 保持 external，
// 运行时经 $DSH_HOME/profiles/node_modules 回退解析；单元测试不 import 本文件。
await build({
  entryPoints: [join(here, '..', 'src', 'llm', 'dsh-client.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external,
  outfile: join(here, '..', 'lib', 'dsh-client.js'),
  sourcemap: true,
})

// ── 阶段 6 纯逻辑模块（零 @deepseek-ai 运行时依赖，供单元测试直接 import）──
// 内容库（data.ts 内联 content/*.json，esbuild json loader 默认支持）+ 确定性检索
// + 围栏化 + 出处校验 + 工具（tools.ts 连带 llm/client.ts 的 runToolLoop）。
await build({
  entryPoints: [join(here, '..', 'src', 'retrieval', 'index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external,
  loader: { '.md': 'text' },
  outfile: join(here, '..', 'lib', 'retrieval.js'),
  sourcemap: true,
})

console.log('[man-roleplayer] built lib/index.js (host) + lib/client.js (client)'
  + ' + lib/{schema,domain,turn,context,storage,aggregate,branch,control-loop-report,persona,personas-data,llm,dsh-client,retrieval}.js'
  + ' (pure/runtime) via', esbuildDir)
