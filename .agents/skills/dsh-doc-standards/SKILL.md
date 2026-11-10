---
name: dsh-doc-standards
description: 维护 Man-roles 文档的归属、教程顺序、文字密度、链接与定向验证；不要求双语镜像或自动翻译。
---

# 文档维护工作流

按 [文档规则](../../../docs/AGENTS.md) 确定事实拥有者和层级，再修改正文。中文是主要人工维护语言，正文只保留一份中文 canonical `.md`，代码、API 和必要原文保留，详见 [语言政策](../../../docs/development/language/README.md)。

## 维护顺序

1. 确认读者、用途和路径；教程按前置条件组织，参考页说明自身范围。
2. 检查相邻文档与入链，保留当前事实、必要契约及有维护价值的原因，合并重复规则。
3. 生成区域改拥有它的源码或生成器；类型围栏按 [开发说明](../../../docs/development/README.md#documenting-types-verbatim-ts-type-equiv) 维护。
4. 普通编辑只更新拥有者，不创建镜像、不维护 sidecar、不执行翻译回录。语言文件缺失不是文档完整性错误。
5. 非琐碎决策按 [Agent Note 规则](../../notes/README.md) 记录；历史材料按准确授权整理，保留仍有效的事实与独有理由，并修复入链。

## 定向验证

检查受影响文件的一段一行格式、相对链接和标题锚点；长期规则检查 [预算清单](../../../scripts/doc-budgets.manifest.json)，Agent Note 检查结构。涉及代码围栏、源码类型、生成区域或站点映射时追加对应拥有者的检查。普通文案不默认执行全仓 doc-sync、lint 或构建，记录实际结果及未验证项。

文字质量使用 [文字标准](../dsh-prose-standard/SKILL.md)；取消双语不降低事实、代码、类型及链接准确性要求。
