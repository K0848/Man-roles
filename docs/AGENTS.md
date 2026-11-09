# 文档维护规则

## Document structure

先确定读者、用途和文档位置，再写内容。教程按前置知识组织到可验证结果；参考页说明当前行为和适用范围。各文档完整解释自己的主题，只概述直属子主题并链接其拥有者。事故经过归复盘，决策理由归 Agent Note，当前使用说明不混入实施过程。

## The tier taxonomy: one home per fact

| 位置 | 负责内容 |
| --- | --- |
| 根和子目录 `AGENTS.md` | 长期生效且影响当前工作的规则 |
| [产品 README](../README.md)、[用户入口](user/index.md) | 安装、构建、启动、使用及数据边界 |
| [architecture.md](reference/dsh/architecture.md) | 装配、核心能力、状态关系和扩展点 |
| [subsystems](reference/subsystems/README.md)、包 README | 类型、语义、配置、限制与包契约 |
| [development.md](development/README.md)、[testing.md](development/testing.md) | 工程结构、检查选择和验证前置条件 |
| [cookbook](reference/cookbook/adding-a-package.md) | 有结果与验证步骤的操作指南 |
| [Agent Notes](../.agents/notes/README.md) | 决策、真实替代方案、代价和验证边界 |
| 生成目录与生成区域 | 从源码重建的 API、工具、配置、持久化和模块参考 |

事实只设一个维护位置，其余链接过去。不要手写重复的包清单、事件目录或测试状态。生成区域改其源码或生成器，不手改输出；英文生成规范路径可保留，生成器按实际存在文件处理语言投影，不要求人工补齐另一语言。

## Writing rules

- 活动正文只维护一份中文普通 `.md`，不保留英文镜像或 `.zh.md` 跳转。只修改负责当前事实的文件，不新增 `.zh.md` 镜像、不维护 `.i18n.yaml`、不运行翻译配对或回录。确有翻译交付要求时才处理指定目标，详见 [语言政策](development/language/README.md)。
- 每个自然段保持一个物理行，使用编辑器软换行。链接使用可检查的相对 Markdown 路径，修改标题或移动文件时修复入链与锚点。
- 说明当前行为、错误、时序、所有权和限制；删去代码复述、推理过程、评审对话及无用历史。保留理解或维护所必需的原因，编辑判断见 [文字标准](../.agents/skills/dsh-prose-standard/SKILL.md)。
- `ts` 代码围栏必须能通过对应代码检查。粘贴源码类型和 JSDoc 使用 `ts type-equiv`；公开类投影用 `ts public-api`，按 [开发说明](development/README.md#documenting-types-verbatim-ts-type-equiv) 登记。保留代码、类型与链接正确性，不以取消双语为由跳过检查。
- 非琐碎维护决策新增或更新一份 Agent Note；正文可只用中文，机器识别的 header 与标准小标题保留。归档文件永久冻结；旧活动决策被取代时交叉链接到当前说明，删除或归档另按授权范围执行。

## Wordcount Budgets

[预算清单](../scripts/doc-budgets.manifest.json) 限制长期规则文档。超限先把内容放回正确层级，再精简；确需扩额时说明内容用途。预算是上限，不是删减目标；中文规则也要靠人工审阅密度，不能用空白词数代替可读性。

## The slop checklist

检查重复规则、过期路径、无来源状态或 CI 承诺、把生成结果手写成清单、无用过程描述及一次承载过多规则的段落。不要因年代、长度或语言而删去仍约束当前行为的决策；不修改 `.agents/notes/archived/`。

## Cross-reference with machine-checkable links, never free prose

按改动范围检查 Markdown 格式与链接、预算及 Agent Note 结构；涉及类型围栏、生成文档或站点路由时追加对应检查。入口见 [文档工作流](../.agents/skills/dsh-doc-standards/SKILL.md)。普通文案修改不默认触发全仓 `doc-sync`、lint、构建或文档站；记录实际运行结果和未验证范围。
