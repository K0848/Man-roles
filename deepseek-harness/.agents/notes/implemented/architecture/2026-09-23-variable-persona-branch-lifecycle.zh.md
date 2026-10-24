# Agent Note: 可变人物分支的持久分配与恢复

Status: implemented

[English](2026-09-23-variable-persona-branch-lifecycle.md) | 中文

## Problem

产品人物名册多于单个困惑实际需要的人物数量，但旧产品事件和服务路径要求固定两条分支，无法支持困惑从一位人物开始、完整回合后再加入人物、部分创建 Session 后恢复，或在进程中断后删除所有已参与历史。

## Decision

新的 `created` 事件保存非空且人物互异的分支数组。新的 Remote 请求可以显式选择一位或多位人物；省略该字段仍为旧调用方保留王阳明/曾国藩默认创建行为。客户端从一位首选人物开始，用户首次选择未参与人物时才由 `switchPersona` 分配新分支。

分支分配是持久且幂等的。Host 先追加带稳定 operation id 和预分配 Session id 的 `branch-allocation`，再创建或恢复指定 Session、核对 preset identity，最后追加 `branch-added`，随后才发布 `persona-switched`。关联失败会以同一分配记录失败；重试复用原 Session id 和 operation id，不再创建第二条分支。重启时按持久 Session id 和身份核对 claimed allocation；Session 缺失或结果未知时保持失败，不猜测为有效分支。

删除会把全部已发布分支以及已认领但尚未发布的分配纳入不可变目标。它持久化通用的 `deleting-branch` checkpoint 和已完成 Session id；读取旧数据时继续接受 `deleting-wang`、`deleting-zeng`、`deleting-first-branch`、`deleting-second-branch` 阶段，并以同一 operation id 续做剩余目标。只有持久化层明确返回目标不存在时，缺失 Session 才按已不存在处理。全部目标完成核对后才删除产品事实。

Remote 只向客户端暴露可变长度的 persona id `branches` 数组。客户端显示已有分支，并从未参与的人物名册中提供加入操作；不暴露原始 Session id，也不按数组位置猜人物身份。

## Alternatives considered

**每个困惑创建整个人物名册。** 这会创建用户未请求的 Session，增加模型与存储成本，并让首次操作产生多余工作。

**产品事件继续保存两条分支，把新增人物放在事件流之外。** 这会形成第二个事实来源，使重启、删除和 Remote 投影对参与关系产生分歧。

**每次重试都重新分配 Session。** 进程中断或关联失败后会遗留孤儿 Session，恢复时还可能出现重复人物历史。

**只删除已经发布的分支。** 首次加入中断后会遗留已认领但未发布的 Session，因此删除目标同时覆盖已发布和已认领分支。

## Consequences

已有双分支事件仍可读取，历史删除阶段仍可恢复。新困惑可以从一位人物增长到多位人物，不改变人物名册权威来源。分配 claim 会增加持久事件数量，并要求重启时核对 Session 身份，但能避免重复副作用并使部分失败可观察。Host 配置仍需至少两个人物绑定才能形成有用名册；这条配置规则与单个困惑持久化多少分支是两件事。

