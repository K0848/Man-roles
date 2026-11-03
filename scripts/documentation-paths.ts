/** 文档分层的规范路径与生成链接投影；代码围栏和源码 JSDoc 原文保持不变。 */

import { posix } from 'node:path'
import { isExternalOrAbsoluteMarkdownUrl, markdownDestination, parseMarkdown, splitMarkdownUrlTarget, visitMarkdown } from './markdown.ts'

const DEVELOPMENT = new Set(['testing.md', 'defensive-patterns.md', 'web-styling.md'])
const DSH = new Set(['architecture.md', 'api-gateway.md', 'cordis-primer.md', 'glossary.md', 'rescope.md'])
const GENERATED = new Set([
  'agent-lifecycle.md', 'capability-seams.md', 'config-catalog.md', 'event-producer-consumer.md', 'graph-atlas.md',
  'module-graph.md', 'persistence-catalog.md', 'tool-catalog.md', 'tool-execution-pipeline.md',
])
const REFERENCE_TREES = new Set(['cookbook', 'cordis-api', 'cordis-tutorial', 'subsystems', 'postmortem'])

/**
 * 返回单份正文的规范路径；历史封存文件不参与迁移。
 * @param path - 仓库相对路径。
 * @returns 当前文档目录中的规范路径。
 */
export function documentationPath(path: string): string {
  if (path.startsWith('.agents/notes/archived/')) return path
  const canonical = path.replace(/\.zh\.md$/, '.md')
  if (canonical === 'CONTRIBUTING.md') return '.github/CONTRIBUTING.md'
  if (canonical === 'BRAND_GUIDELINES.md' || canonical === 'BENCHMARK.md') return `docs/reference/upstream/${canonical}`
  if (canonical === 'docs/development.md') return 'docs/development/README.md'
  if (!canonical.startsWith('docs/')) return canonical
  const inside = canonical.slice('docs/'.length)
  if (DEVELOPMENT.has(inside)) return `docs/development/${inside}`
  if (DSH.has(inside)) return `docs/reference/dsh/${inside}`
  if (GENERATED.has(inside)) return `docs/reference/generated/${inside}`
  if (inside === 'i18n') return 'docs/development/language'
  if (inside.startsWith('i18n/')) return `docs/development/language/${inside.slice('i18n/'.length)}`
  const tree = inside.split('/')[0] ?? ''
  return REFERENCE_TREES.has(tree) ? `docs/reference/${inside}` : canonical
}

/**
 * 将旧模板的相对链接投影到分层后的输出位置，只替换 Markdown 目的地址。
 * @param markdown - 含规范代码与源码说明的生成内容。
 * @param legacyPath - 模板原先使用的仓库相对输出路径。
 * @returns 单份规范文档的内容。
 */
export function relocateGeneratedDocument(markdown: string, legacyPath: string): string {
  const destinationPath = documentationPath(legacyPath)
  const replacements: { start: number; end: number; value: string }[] = []
  visitMarkdown(parseMarkdown(markdown), (node) => {
    if (node.type !== 'link' && node.type !== 'image' && node.type !== 'definition') return
    if (isExternalOrAbsoluteMarkdownUrl(node.url)) return
    const destination = markdownDestination(markdown, node)
    const { path, suffix } = splitMarkdownUrlTarget(destination.url)
    if (path === '') return
    let decoded: string
    try {
      decoded = decodeURIComponent(path)
    } catch {
      // 链接检查器负责报告坏编码；迁移不能猜测目标。
      return
    }
    const target = posix.normalize(posix.join(posix.dirname(legacyPath), decoded))
    if (target.startsWith('../') || posix.isAbsolute(target)) return
    const relative = posix.relative(posix.dirname(destinationPath), documentationPath(target))
    const encoded = relative.split('/').map(segment => encodeURIComponent(segment).replace(/[!'()*]/g,
      character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)).join('/')
    const projected = path.startsWith('./') && !encoded.startsWith('.') ? `./${encoded}` : encoded
    replacements.push({ start: destination.start, end: destination.end, value: `${projected}${suffix}` })
  })
  let output = markdown
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    output = output.slice(0, replacement.start) + replacement.value + output.slice(replacement.end)
  }
  return output
}
