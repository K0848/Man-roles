# Agent Note：H2.6.1 产品生命周期操作

状态：已实现

[English](2026-09-05-man-roleplayer-h261-title-choice-lifecycle.md) | 中文

## 问题

产品浏览器界面需要生命周期操作，但不能暴露普通 DSH Session/问题身份。自动标题还会与用户重命名竞争，无法在恢复后证明用户标题所有权。

## 决策

产品 Remote 负责仅活动困惑可用的重命名、暂停/继续/阶段结束、不透明结构化选择和失败轮次重试。选择事实持久化在产品事件流，Agent 作用域适配器只结算或取消一个等待者；冷恢复会将待答问题关闭为 failed，不重放人物轮次。重命名递增标题 revision 并标记用户所有；标题 claim 捕获该 revision，迟到的成功/降级结果只结算为 stale 或 suppressed，不改变标题，也不再次调用 Provider。

## 验证

产品、仓储、客户端 store 和 Loader 组合聚焦测试通过（72 项）；产品包和客户端 TypeScript 项目均通过 `--noEmit`。既有 accepted-only 投影和普通 DSH 路径仍由原测试覆盖。

## 影响

wire projection 只包含标题所有权元数据和产品 operation handle。用户回答在显式状态操作前仍是用户表达；原始 Session id 和 tool-call id 始终留在内部。
