/**
 * man-roles-roleplayer —— persona 成品加载（content/personas/*.md → PersonaSpec.systemPrompt）。
 *
 * 阶段 5：把阶段 4 的占位 systemPrompt 替换为 persona 成品。
 * 红线（不可违反，规划会话产出后不得改写）：
 *  - 「语言禁忌（不可违反）」「出处铁律（防伪托）」两节**原文逐字保留**；
 *  - 解析按 `## ` 标题切片、组装按原节标题+正文重建，不裁剪、不改写正文；
 *  - 单测断言两节原文与源文件一致（逐字）。
 *
 * 纯函数（零 DSH 运行时依赖）：输入 markdown 字符串，输出 PersonaSpec；
 * 成品文本由 src/context/personas-data.ts 在构建时内联（copy 安装不含 content/）。
 */
import type { PersonaSpec } from './assemble.ts'

/** 解析出的 persona 章节（title = `## ` 后的标题，body = 该节正文逐字）。 */
export interface PersonaSection {
  title: string
  body: string
}

/** 红线两节的标题（与 persona 成品文件一致，不得改写）。 */
export const PERSONA_RED_LINE_SECTIONS = ['语言禁忌（不可违反）', '出处铁律（防伪托）'] as const

/** 按 `## ` 标题把 persona markdown 切成章节；`# ` 标题与引言（如「> 依据：」）不属任何章节，丢弃。 */
export function parsePersonaMarkdown(markdown: string): PersonaSection[] {
  const sections: PersonaSection[] = []
  let current: PersonaSection | null = null
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+(.+)$/.exec(line)
    if (heading !== null) {
      const title = heading[1]
      if (title === undefined) throw new Error('persona section heading is missing')
      current = { title: title.trim(), body: '' }
      sections.push(current)
    } else if (current !== null) {
      current.body += (current.body === '' ? '' : '\n') + line
    }
  }
  return sections
}

/**
 * 由章节组装 systemPrompt：`## 标题` + 正文（逐字）。节序 = 文件顺序。
 * @param sections - parsePersonaMarkdown 的结果。
 * @returns 直接作为模型 system prompt 的文本。
 */
export function personaSystemPromptFromSections(sections: PersonaSection[]): string {
  return sections
    .map((section) => `## ${section.title}\n\n${section.body.trim()}`)
    .join('\n\n')
}

/**
 * 红线自检：两节必须存在且正文非空（缺失即视为成品被裁剪，抛错）。
 * @param id - persona id（报错用）。
 * @param sections - 解析出的章节。
 */
export function assertRedLineSections(id: string, sections: PersonaSection[]): void {
  for (const title of PERSONA_RED_LINE_SECTIONS) {
    const section = sections.find((s) => s.title === title)
    if (section === undefined || section.body.trim() === '') {
      throw new Error(`persona ${id}: 红线节「${title}」缺失或为空（成品被裁剪，拒绝加载）`)
    }
  }
}

/**
 * 构建 PersonaSpec：解析 markdown 成品 → systemPrompt（两节逐字保留）。
 * @param id - canonical persona id。
 * @param name - 内容包显示名。
 * @param markdown - persona 成品全文。
 */
export function buildPersonaSpec(id: string, name: PersonaSpec['name'], markdown: string): PersonaSpec {
  const sections = parsePersonaMarkdown(markdown)
  assertRedLineSections(id, sections)
  return { id, name, systemPrompt: personaSystemPromptFromSections(sections) }
}
