# Agent Note: 精简 Man-roles 根目录入口

Status: implemented

## Problem

历史材料清理和教程分类减少了子目录内容，但没有明显减少 GitHub 根目录入口。根目录仍并列来源说明、第三方声明、编辑器配置、启动实现及工具配置，产品入口不突出。

## Decision

保留[统一工程根](../architecture/2026-10-24-man-roles-workspace-root.md)及现有包布局，把四份文件归位，并将重复的 Python 测试配置合入 SDK 已有拥有者。根文件入口由21个降到16个，不增加顶层目录。

| 原根入口 | 当前拥有者 |
| --- | --- |
| SOURCE.md | [源码来源](../../../../docs/reference/upstream/SOURCE.md) |
| THIRD_PARTY_NOTICES.md | [第三方声明](../../../../docs/legal/THIRD_PARTY_NOTICES.md)，由现有生成器重建 |
| 向古人问惑.code-workspace | [编辑器工作区](../../../../config/editor/向古人问惑.code-workspace) |
| start-man-roles.ps1 | [启动实现](../../../../scripts/start-man-roles.ps1)，根 CMD 入口负责转发 |
| pytest.ini | 合入 [SDK pytest 配置](../../../../python/sdk/pyproject.toml)；官方测试命令显式指定该配置 |

启动实现以 scripts 的父目录定位工程根，人物资料、本机配置和运行数据的相对基准不变。根 CMD 保留参数与退出码转发，PowerShell 保留 Windows PowerShell 5 所需的 UTF-8 BOM。

工作区的单个 folder 通过 `../..` 指回仓库根，文件排除规则继续相对该 folder 生效。第三方声明生成器和 Python 发布脚本使用新源位置；wheel 内的 LICENSE、THIRD_PARTY_NOTICES.md 名称及许可元数据不变。

## Alternatives considered

**删除所有根工具配置。** 会失去直接 Vitest 调用的默认项目、路径和排除配置；Oxlint 的文件规则又以配置目录为基准且不支持本次所需的跨目录模式。保留默认入口可以避免为少量文件引入额外 wrapper 或降低检查覆盖。

**仅把文件改为隐藏名称或隐藏工作区目录。** GitHub 仍展示这些路径，也没有改变内容归属。实际迁移到已有 docs、config、scripts，并合并重复配置，才减少根入口。

**拆出完整 DSH 底座。** 会改变源码交付、依赖解析和构建边界，超出当前根目录归整范围。现有底座与平台能力按真实依赖保留。

## Consequences

安装、构建、默认 Node 测试和产品启动仍从仓库根执行。Python SDK 使用贡献者说明中的显式 `-c python/sdk/pyproject.toml` 命令，不再依靠根目录裸 pytest 的收集限制。README、规则、生成器、发布脚本和实际入链随迁移同步，必要许可与上游归属继续交付。

## Verification

12项启动回归、26项法务生成测试、11项 Python 发布测试通过；SDK 显式配置收集到62项测试，未执行真实 Provider。编辑器单根和排除规则解析一致，标准完整构建通过并生成207项客户端产物。文档链接、格式和公开文件排除按实际迁移范围检查，不以本轮结果声明跨平台或独立运行包验收完成。
