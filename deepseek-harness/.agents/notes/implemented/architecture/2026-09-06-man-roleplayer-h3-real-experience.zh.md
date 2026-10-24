# Agent Note：man-roleplayer H3 真实体验防护

状态：已实现

[English](2026-09-06-man-roleplayer-h3-real-experience.md) | 中文

## 决策

证据检索工具声明字符串 topic 与整数 requestedCount，并在说明中明确 1～3 的边界；运行时校验仍是最终闸门。本轮取得可用资料后，结构化回答至少引用一个已返回的 evidence id 才能通过。

产品在每个轮次周围记录非敏感的思考活动事实，并只投影允许的阶段、时间、人物和 operation 关联。运行中活动归属对应提问，终态活动折叠进对应回答并展示累计去重资料数。原始 reasoning 继续由人物 Session 拥有，不进入产品事件。Host 通过精确产品 attempt、投递、人物分支、Session 用户消息和所属 DSH turn 派生，只投影文本、人物、产品轮次与状态；界面始终默认折叠，取消/失败前缀仍可回看，Provider 未输出时不生成展示。

状态分析同时持久化 Host 权威投影和实际发给模型的别名脱敏投影。模型看到由同一份 Zod 契约生成的 JSON Schema，只能引用已提供的短别名，也不能决定目标轮次。初次分析、重试和 claimed 恢复均在重建别名前按权威事件去重。自动标题只接受一个纯文本候选；生成说明、备选和 Markdown 会被移除，不合法输出降级为首条用户原话。

## 边界

产品继续保持 accepted-only 回答、人物/Session 隔离、证据所有权和普通 DSH 隔离。非法检索参数产生有界失败，不创建成功证据 claim。fenced 解析和模型可见 JSON Schema 都不会放宽 Host 的严格 schema、别名、来源、当前轮次或生命周期校验。按轮次注入的身份规则不改变持久 preset 组合身份。

## 验证

受影响范围 Loader 通过 55/55，man-roleplayer 客户端通过 17/17，系统 Chrome H3 通过 3/3，Host/Client/Web 构建与 `git diff --check` 通过。测试覆盖真实脏标题样本、pending + delivered 重复用户事实、旧重复输入重试、多轮当前目标、证据引用门、累计去重资料数、可靠接收、活动归属、实时计时、终态恢复、已结算 + 流式多 Step reasoning、重试 attempt 隔离、默认折叠、失败前缀恢复、无输出不伪造，以及 wire 不暴露 Session/工具/Prompt 身份。

固定 3085 profile 也使用 `deepseek-official / deepseek-v4-flash` 完成真实探针。身份问题在 167 秒后得到包含王阳明身份、帮助说明和有效资料引用的回答，活动摘要累计 4 条去重资料。旧状态失败输入从 3 条去重为 2 条；模型获得完整 JSON Schema 后，重试成功且未重生成人物回答。新建“你好”探针在 45 秒后完成，引用 1 条资料，模型投影为 2 条，状态快照完成，标题安全降级为纯文本“你好”。五题价值验证、双人物比较与单位成功成本决策仍不属于本实现门禁。
