# Agent Note: Man-roles workspace root

Status: implemented

[English](2026-10-24-man-roles-workspace-root.md) | 中文

## Problem

嵌套源码目录使产品 Git 入口与 workspace、构建入口分离，产品归属不清，并让本机依赖链接依赖另一套目录布局。

## Decision

仓库根拥有 pnpm workspace、构建配置、产品启动器和人物资料。现有包分组保留相对布局与依赖身份。三个产品包在元信息中指向 Man-roles 仓库。上游归属记录在 [SOURCE.md](../../../../SOURCE.md) 和保留的许可证中。

根忽略文件排除本机凭据、运行状态、私有工作材料及生成产物，允许环境模板、源码、锁文件、必要回归样本与产品素材。[忽略检查](../../../../scripts/verify-publish-ignore.mjs) 验证代表性的排除及保留路径，并检测已经进入索引却被忽略的文件。仍需审查内容，因为忽略规则不能脱敏文件或 Git 历史。

## Alternatives considered

保留嵌套源码副本可以延续原目录，但需要分别定位构建入口并持续同步。把业务包单独移出 workspace 又会引入与仓库入口问题无关的依赖和编译修改。统一 workspace 根可以保留包之间的关系，避免这两种成本。

## Consequences

安装、构建、测试和提交在同一根目录执行。公开启动器在仓库内解析人物素材，并将新运行状态放在被忽略的 `.local/` 目录。现有用户数据不迁移。包重命名与依赖升级不属于本次布局修改。

## Testing

验证迁移中的文件保留、包归属信息、双语入口文档、最终索引的忽略行为、标准构建、产品定向回归，以及含五张人物卡的空数据浏览器启动。布局检查不需要真实模型请求。
