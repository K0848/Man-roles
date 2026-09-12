// src/context/persona.ts
var PERSONA_RED_LINE_SECTIONS = ["\u8BED\u8A00\u7981\u5FCC\uFF08\u4E0D\u53EF\u8FDD\u53CD\uFF09", "\u51FA\u5904\u94C1\u5F8B\uFF08\u9632\u4F2A\u6258\uFF09"];
function parsePersonaMarkdown(markdown) {
  const sections = [];
  let current = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading !== null) {
      const title = heading[1];
      if (title === void 0) throw new Error("persona section heading is missing");
      current = { title: title.trim(), body: "" };
      sections.push(current);
    } else if (current !== null) {
      current.body += (current.body === "" ? "" : "\n") + line;
    }
  }
  return sections;
}
function personaSystemPromptFromSections(sections) {
  return sections.map((section) => `## ${section.title}

${section.body.trim()}`).join("\n\n");
}
function assertRedLineSections(id, sections) {
  for (const title of PERSONA_RED_LINE_SECTIONS) {
    const section = sections.find((s) => s.title === title);
    if (section === void 0 || section.body.trim() === "") {
      throw new Error(`persona ${id}: \u7EA2\u7EBF\u8282\u300C${title}\u300D\u7F3A\u5931\u6216\u4E3A\u7A7A\uFF08\u6210\u54C1\u88AB\u88C1\u526A\uFF0C\u62D2\u7EDD\u52A0\u8F7D\uFF09`);
    }
  }
}
function buildPersonaSpec(id, name, markdown) {
  const sections = parsePersonaMarkdown(markdown);
  assertRedLineSections(id, sections);
  return { id, name, systemPrompt: personaSystemPromptFromSections(sections) };
}
export {
  PERSONA_RED_LINE_SECTIONS,
  assertRedLineSections,
  buildPersonaSpec,
  parsePersonaMarkdown,
  personaSystemPromptFromSections
};
//# sourceMappingURL=persona.js.map
