# Agent Note: 可恢复的人物上下文测试夹具

Status: implemented

[English](2026-09-22-man-roleplayer-context-recovery-harness.md) | 中文

## 问题

上下文替换测试不能只从内存事件数组重建 Session，就据此证明重启安全。产品事件和 Session 历史分别由不同模块拥有；没有默认 agent（智能体）选项的库组合在打开产品仓储时，不会自动恢复人物 agent。把缺少活动 agent 当成持久数据丢失，会混淆启动与存储恢复。

## 决策

[T0 Loader fixture（测试前置数据）](../../../../packages/extensions/man-roleplayer/tests/t0-loader-support.ts) 为每个测试拥有独立的临时 JSONL 根目录和产品存储介质。重开时保留这些介质，同时替换 Loader 和后端实例。测试先通过产品服务显式恢复已持久化的困惑，再驱动恢复后的人物 agent。最终清理先释放 Loader，再删除本测试拥有的目录和存储介质。

[上下文候选](../../../../packages/extensions/man-roleplayer/tests/t0-context-candidate.ts) 分离计算与落地，并在模型请求前和恢复检查点使用相同的投影路径。投影是否复用由已持久化的内容和来源元数据决定；内存中的 generation 计数器不能证明重放等价。摘要依赖引用持久状态标识和不可变的用户消息标识；依赖缺失或失效时，摘要随之失效。[测试](../../../../packages/extensions/man-roleplayer/tests/t0-context-harness.spec.ts) 同时检查实际请求、产品事件和 Session 事件。

## 考虑过的替代方案

**只做内存 Session 重放。** 它能检查事件投影，但跳过 Loader 启动、JSONL 读取及产品与 Session 的关联，不能证明所需的恢复行为。

**为满足测试而修改生产启动行为。** 产品已区分仓储打开与 agent 启动。显式启动由测试负责，修改应用默认值会扩大被测行为。

**全局共享测试介质。** 一个测试的清理会影响另一个测试的恢复。每个临时根目录因此拥有自己的介质，仅在该测试的多个 Loader 实例之间保留。

## 影响

测试覆盖状态提交与投影提交间隔的两侧，并检查重放不会追加等价替换或额外模型请求。产品存储在 Loader 实例间使用已有测试后端，Session 历史使用真实 JSONL 文件。这不能证明生产数据库在操作系统杀进程后的持久性、真实 Provider 缓存节省或上下文候选的生产接入。
