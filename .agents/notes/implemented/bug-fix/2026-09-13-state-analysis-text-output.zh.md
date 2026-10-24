# Agent Note: 状态分析为结构化文本保留输出预算

Status: implemented

[English](2026-09-13-state-analysis-text-output.md) | 中文

## Problem

真实 `deepseek-v4-flash` 人物回答能够完成，但所有分离执行的状态分析都以 Provider 错误失败。产品事件没有保留有界的底层错误，重试无法区分传输失败、空响应或格式错误。增加诊断后的真实重试证明：Provider 没有返回文本，而调用只有 2,048 Token 输出上限，并继承了模型的 reasoning 模式。

## Decision

状态分析在调用前解析所选模型的能力。模型声明支持 `off` reasoning effort 时，状态专用调用显式选择它，把有界输出预算留给所需 JSON 文本；不声明该能力的模型继续使用原调用配置，不接收不支持的覆盖值。

失败的内部 `state-analysis` 事件可以持久化最长 300 字的 `failureDetail`，只包含错误名称、基础类型的 code/status 和空白归一化后的消息。它不包含请求消息、Prompt、凭据、用户正文或 Session 身份，产品 Remote 也不会将它投影到浏览器。

既有的分离 operation、输入水位、revision 校验和显式重试 operation 保持不变。成功重试使用已持久化的权威输入发布状态，不重新生成已经接受的人物回答。

## Alternatives considered

**把 reasoning delta 当作 JSON 回答。** reasoning 不是模型最终响应契约，可能包含不完整、被修正或私有的中间内容。提升它会同时破坏结构化校验和 reasoning 边界。

**提高状态分析 Token 上限。** 扩大 reasoning 与文本共享的预算会增加成本，却不能保证最终文本出现。该操作需要的是结构化文本，不是更多隐藏推理。

**自动重试所有 Provider 失败。** 盲目重试会重复收费并掩盖持续配置错误。产品继续采用显式重试，并先记录有界原因。

## Consequences

固定端口真实重试现已完成状态分析，同时保留原人物回答。人物轮次的 reasoning 能力不受影响，因为只有分离状态分析调用请求 `off`。

诊断属于持久内部数据，必须保持有界且不进入 Remote 投影。无法关闭 reasoning 的 Provider 仍可能不给文本；这类失败继续通过同一分类和诊断暴露，而不会放宽 JSON Schema。
