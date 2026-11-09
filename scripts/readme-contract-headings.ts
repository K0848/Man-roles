/** 将 README 约定标题的既有译名映射到同一检查字段，保留正文与代码原文。 */

import { markdownHeadingLines } from './markdown.ts'

const ALIASES: Readonly<Record<string, string>> = {
  'Model Experience': '模型体验',
  'Known Limitations and Deferred Work': '已知限制与暂缓事项',
  '已知限制与延期工作': '已知限制与暂缓事项',
  '已知限制与后续工作': '已知限制与暂缓事项',
  '已知限制与延后工作': '已知限制与暂缓事项',
  '已知限制与暂缓工作': '已知限制与暂缓事项',
  '已知限制与欠账': '已知限制与暂缓事项',
  '已知限制与待完成工作': '已知限制与暂缓事项',
  '已知局限与延后工作': '已知限制与暂缓事项',
  'What the model sees': '模型看到的内容',
  '模型看到什么': '模型看到的内容',
  '模型所见': '模型看到的内容',
  '模型所见内容': '模型看到的内容',
  'Token effect': 'Token 影响',
  'token 影响': 'Token 影响',
  '对 token 的影响': 'Token 影响',
  'KV Cache effect': 'KV Cache 影响',
  '对 KV Cache 的影响': 'KV Cache 影响',
  'KV 缓存影响': 'KV Cache 影响',
  'KV cache 影响': 'KV Cache 影响',
}

/**
 * 归一化已知标题译名，不改变标题层级、正文或代码围栏。
 * @param source - 单份 README 原文。
 * @returns 供结构检查使用的文本；行号与原文一致。
 */
export function normalizeReadmeContractHeadings(source: string): string {
  const lines = source.split('\n')
  for (const heading of markdownHeadingLines(source)) {
    const canonical = ALIASES[heading.text]
    if (canonical === undefined) continue
    const ending = lines[heading.index - 1]?.endsWith('\r') ? '\r' : ''
    lines[heading.index - 1] = `${'#'.repeat(heading.depth)} ${canonical}${ending}`
  }
  return lines.join('\n')
}
