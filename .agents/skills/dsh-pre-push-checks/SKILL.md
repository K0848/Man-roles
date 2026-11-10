---
name: dsh-pre-push-checks
description: 在已获授权的 Man-roles 提交或推送前，按实际改动选择最小充分验证并检查公开文件范围。
---

# Man-roles 提交前检查

先确认仓库、分支、已有改动和已授权的提交范围。用户只要求修改或审查时，不自动推送、合并、关闭 PR 或发布。

## Inspect the outgoing change

使用 `git status --short --branch` 和暂存差异确认范围；需要比较分支时使用已核实的本地基准，不猜测或自动 fetch。当前远端与 PR 状态只在任务需要且授权时核对。

## Select relevant evidence

- 行为修改运行所属测试与受影响消费方；可见输出检查相应快照或真实装配入口。
- 文档修改检查格式、链接、事实和必要预算，不要求翻译或 sidecar；涉及类型或生成文档时追加所属检查。
- 包导出、构建或交付入口修改，构建一次并验证实际消费路径。
- 真实提供商验证按凭据与费用授权执行，不输出密钥。

不重复已经充分通过且未受新改动影响的检查。检查失败先定位和修复，不能把本地失败转移给不存在的 CI。

## 提交与交付

布局或忽略规则变更执行 `node scripts/verify-publish-ignore.mjs`，另审暂存内容中的私人数据；保留 [来源与许可](../../../docs/reference/upstream/SOURCE.md)。已授权提交后检查 hook 产生的改动；已授权推送后核对远端 ref。合并与发布另按明确授权执行。

本仓库没有启用上游 CI 矩阵；有远端检查才报告其实际状态。Git hooks 的当前实现见 [开发说明](../../../docs/development/README.md#git-integrations)，不把 hook 成功当作产品验收。

## 历史改写

本技能不授权 rebase、强推或堆叠 PR 操作。确需改写时先按任务确认范围、保存可恢复状态并核实远端版本；禁止无保护的强推。
