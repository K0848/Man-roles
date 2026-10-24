# Agent Note：man-roleplayer H2.8 生产 UI 投影

状态：已实现

[English](2026-09-06-man-roleplayer-h28-production-ui.md) | 中文

## 原因

产品 UI 需要由产品所有的持久投影，在保持普通 DSH Session 隔离的同时，为恢复和验证提供足够的 operation 与证据关联。

## 行为

客户端由一个 Host projection store 渲染。活动轮次携带不透明困惑 handle，以及真实的消息、delivery、turn 和人物关联。状态重试复用失败分析的输入与稳定 retry operation。删除暴露阶段检查点，不可逆后只能继续同一 operation。归档投影仍可读取但严格只读。已接受正文按 Host 校验的 Claim 范围和当前证据状态渲染；证据被质疑或撤回后关联变为 stale，历史正文保留。

## 边界

浏览器不会接收原始 DSH Session id、工具轨迹或普通 Session 正文。证据正文和出处在读取时从配置的调研索引派生，产品事件不复制资料。普通 DSH profile 不加载该根界面。

客户端可见的产品类型通过 `@deepseek-ai/dsh-session/types` 解析 Session 标识。Host 根入口还声明 `ctx.sessions: SessionStore`，浏览器类型导入该入口会与客户端运行时的会话服务冲突。客户端安全入口保留相同的品牌标识和构造函数，同时避免引入 Host 上下文声明。

## 验证

实现已运行 Host 与 client TypeScript 检查、包测试、生产 bundle 构建、系统 Chrome 产品 profile 测试、H2.8 浏览器测试、H2.6 回归、普通 profile 隔离测试及 `git diff --check`。
