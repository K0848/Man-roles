# Agent Note: Two-session ownership for the dilemma product Host

Status: implemented

[English](2026-09-02-man-roleplayer-two-session-ownership.md) | 中文

## 问题

困惑产品需要一个可见对话，但王阳明与曾国藩的轮次必须留在彼此隔离的 DSH Session 历史中。产品级删除跨越两条历史和一条独立的产品事件流。若任一存储被当成另一存储的所有者，重启、重试和部分删除的语义都会变得不明确。

## 决策

`@deepseek-ai/dsh-man-roleplayer` 拥有产品事件 domain，并提供 `ctx.manRoleplayer`。它为每个产品对话创建或恢复恰好两个 AgentHandle 所有者，并在不可变的 `created` 事实中保存它们的 DSH `SessionId`。产品投影只保存稳定的 Session 事件引用，绝不复制模型可见的回答文本。

服务按困惑串行化操作。删除先持久化 `requested`，再在有限的本地时限内等待两个自有 handle 释放。超时会停在仍可逆的停止 checkpoint。两个 handle 都停稳后，服务记录不可逆的 Session 删除 checkpoint，删除王阳明历史，删除曾国藩历史，最后删除产品记录。重试使用持久化的 operation id 和失败恢复阶段。最终产品删除后无法再在被删除的流中追加 completed 事件，因此前一条 `deleting-product` checkpoint 是最后的持久化证明。

## 曾考虑的替代方案

**一条共享 DSH Session** —— 会把两个角色的历史放进模型可见 transcript，违反产品隔离要求。

**直接删除 JSONL 或 SQLite** —— 会绕过 SessionPersistence 对实时 Session、写后缓冲和未发布准备状态的协调。

**跨三套存储的数据库事务** —— 在可替换的 DSH Session provider 和 storage-domain medium 之间不可用；持久化 checkpoint 提供可恢复的顺序保证。

## 后果

产品 Host 具有真实 Loader 组合测试：创建两条 agent、物化它们的 JSONL 历史、重启、恢复两个所有者，并验证两条历史和产品记录均被删除。人物 preset composition、用户／回答事件桥接、Remote API 和浏览器 slot 仍是独立消费者，不能绕过这一所有权和删除路径。
