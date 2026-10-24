# `@deepseek-ai/dsh-man-roleplayer`

[English](README.md) | 中文

这是可变人物分支困惑对话的产品 Host 包。新困惑只持久化首位人物，后续人物通过持久化且幂等的分支分配按需加入。它拥有确定性的产品事件、消息投递和人物轮次状态、独立的执行停稳检查点、按人物隔离并可替换的 Session 上下文、带 revision 闸门的状态结果、证据撤回、按人物绑定且带每轮预算的本地证据检索与 Claim sidecar、回合级请求预算和无进展停止、带显式撤回的认同关系事实、安全退出、标题降级、统一时间线稳定引用、请求 ID 去重和覆盖全部分支的删除状态机。

Host 插件提供 `ctx.manRoleplayer`。它创建和恢复一个或多个按人物绑定的 AgentHandle 所有者，打开产品事件 domain，并协调永久删除。`archive()` 与 `restore()` 追加幂等的生命周期事实：归档会把困惑移出默认 `list()`，但 `read()` 和 `list(true)` 仍保留其投影；归档期间提交和切换会拒绝，只有显式恢复后才能继续。删除会先持久化包含全部已参与/已认领分支的 stopping 检查点，再在锁外等待 Agent/Session 清理，因此删除进行中归档、恢复、提交和切换都会得到稳定的 deleting 错误，删除完成后也不能复活困惑。它会在调用任一分支的 `ctx.sessionPersistence.delete()` 前先释放全部 handle。有限的停稳等待会在 agent 未完成时保留可逆的失败 checkpoint；首条 Session 删除开始后，重试必须沿用同一 operation id。全部目标历史均删除后，产品事件才会删除。人物回答只用 Session 与事件引用表示，绝不复制进产品时间线。

Host 配置可以使用统一的 `personas` 绑定数组；每项必须包含注册的人物 id、显式绝对资料路径和对应 preset id。绑定数量至少为两人，不能重复，资料文件名必须匹配注册表；单个新困惑仍可只持久化首位分支。文件缺失、来源格式错误或 preset 不匹配都会 fail-closed。本包不会回退到当前工作目录，也不会读取未绑定的调研文件。本包在 `presets/` 下提供可审计的本地组合资产；Host 必须把该目录加入 preset roster。每个新建或加入的 branch 会记录 preset id、组合内容 digest、人物标识和资料 fingerprint；恢复时重新计算并比较这四项，因此 preset 缺失、被编辑或跨 branch 替换都不会静默改变已产生历史的人物身份。

`ProductConversationRepository` 是由 Host 持有的持久化 seam。它打开经过 zod 校验的 `man_roleplayer_product` storage domain，以每个困惑对话一条 append-only 事件列表保存事实，串行化变更，并在写入前按 request id 去重。调用方负责 `open()` 和 `close()` 生命周期；`read()` 与 `list()` 每次打开后都通过 `project()` 重放持久事件列表，因此重启后的 medium 是恢复来源，仓储本身不维护第二份内存事件真源。

删除会在每个阶段前持久化检查点。执行开始前可以取消；第一次 DSH 删除会使操作不可撤销，此后只能用相同 operation id 恢复。最小的产品级删除 receipt 会在删除产品前记录 pending intent，只有全部目标 Session 历史和产品流都删除成功后才变为 completed。它只包含 operation id、opaque handle digest、状态、完成时的时间和 `deleted: true`，因此响应丢失时可以重试而不会恢复或读取已删除内容。

人物正常生成及提交修复共用配置的整轮活动预算和单次请求预算。等待用户选择期间暂停累计活动时间预算，回答后继续使用剩余时间；单次模型流仍受请求时限约束。选择答案必须包含选项、非空白自定义内容或显式 `skipped: true`；跳过不能夹带答案，拒绝的提交不改变待回答选择。只有取消或预算耗尽请求停止后，才开始计算 `stopTimeoutMs`。停止超时保留运行占用，直到 Agent 真正空闲后记录 `stopped`；新消息和重试不能与该操作重叠。冷恢复只有在同一 Session 的恢复 Agent 已证实空闲后，才修复失败轮次的执行状态。Remote 确认接收后，正文继续后台生成；Host 观察后台 Promise 拒绝，同时保留等待完成的调用方可收到的失败结果。

客户端可见的产品类型通过 `@deepseek-ai/dsh-session/types` 引入 Session 标识；导入 Host 根入口会把 `SessionStore` 上下文声明混入浏览器编译。

## Model Experience

间接影响于 `ctx.manRoleplayer` 选择一个或多个人物专属 DSH Session 所有者。Host 只加载显式配置的正式调研文件，并提供带每轮预算的人物绑定 `evidence_lookup` 能力。只有规范化后的精确认同短句才会创建包含来源引用的持久认同关系；安全命中的原话跨轮都不会进入上下文。本包不记录人物回答正文，也绝不把人物回答复制到产品时间线。

没有活动产品 capability 的 Agent 会收到有明确类型的 `{ status: 'unauthorized', evidence: [] }` 检索结果。该拒绝不携带证据正文或出处，也不会创建产品 claim/activity，因此普通 Session 不能建立没有困惑归属的产品关联。

#### KV Cache effect

无：本包只拥有确定性的产品事实，不改变任何模型请求。

接受一条人物回答后，配置了产品 profile 时会为该 turn 最多异步启动一次状态分析。分析只接受包含 candidates 与人物绑定 snapshot 的严格对象，输入来自已完成 turn 和允许的产品投影。claimed/running/completed/failed/stale 事件可恢复，恢复不会重放人物 turn。候选默认保持 `candidate`，用户可通过版本化 Remote 显式确认、拒绝、修改、撤回或解决；修改会将旧项目标记为 superseded，并保留 request id 与来源引用。

证据详情在读取时从已配置人物绑定的正式调研索引派生。wire projection 可以安全包含稳定证据 id、人物、生命周期状态、类型、可信度、标题、受限正文和出处，并投影脱敏的检索活动状态（`completed-with-results`、`completed-zero-hit`、`budget-exhausted`、`cancelled` 或 `failed`）。证据事件只持久化生命周期元数据和稳定 provenance；被质疑的证据会退出当前 allow-list，只有显式复核才能恢复；已撤回证据不能通过复核恢复。

H2.6.1 产品 Remote 还负责仅对活动困惑开放的重命名、暂停/继续/阶段结束、产品作用域结构化选择，以及失败人物回答的原轮次重试。重命名会递增标题 revision 并标记为用户所有；迟到的自动标题结果只记录为 stale 或 suppressed，不能覆盖用户标题，也不会再次调用 Provider。选择框使用 opaque 产品 operation handle：待答问题、回答、取消、重连和冷恢复都不会暴露原始 DSH Session 或 tool-call id；回答在用户明确确认前仍只是用户表达，不会自动成为状态。

每个人物回合都会收到写入 Session 日志的沟通规则，优先遵守用户明确要求的回应范围、方式和长度，同时保留人物视角与证据要求。倾听或按要求给一个历史例子不需要主动追加行动方案。用户只要一条短文本时，输出内容即止，不自报字数或追加解释、史例和建议；证据检索服务于当轮确需提出的史实断言，不为展示人物身份主动添加历史佐证。规则区分已陈述事实与暂时理解，禁止把未知动机或现实条件当成事实。人物 preset 装配身份及历史分支保持有效；建议答复仍须包含相关的现代推论并拒绝校验占位，但不设固定最低字数。这些结构检查不能精确判断语义效用或强制执行用户指定的字数上限；实际质量仍需对话评测。

## Known Limitations and Deferred Work

- 独立产品 profile 默认启用状态分析；普通 library composition 保持通过 Host 配置选择性启用，以便调用方控制模型预算。分析失败或过期时不会重放人物 turn。
- 产品 snapshot 只包含当前人物的结构化理解、核心视角、可选建议和稳定来源引用，不会把私有 Session 的人物回答正文复制进产品事件。

## H2.8 生产投影契约

浏览器投影只要持久化 delivery/turn 或未解决的执行检查点仍存在，就提供 `activeTurn`，并将消息、delivery operation、turn operation、人物和执行状态绑定到同一个不透明困惑 handle。只有执行状态已停稳后，完成、失败、取消或选择结算才会移除它；停止中、停止失败和未知状态都会继续锁定人物切换。`retryState` 复用失败 operation 的持久化过滤输入，并按 request id 与 retry operation 幂等；不会重跑人物、标题、证据或普通 Session。删除提供稳定 operation id、阶段、不可逆和可重试字段，首条 Session 删除后只能继续同一 operation。归档困惑仍可读取但在恢复前严格只读，普通 DSH profile 保持隔离。已接受正文携带 Host 校验的 Claim 范围、类型和 evidence id；证据被质疑或撤回后关联标记为 stale，产品事件不复制资料正文。

H3 面向模型的证据检索声明字符串 topic 与整数 `requestedCount`，模型可见 JSON Schema 明确包含 `minimum: 1`、`maximum: 3`，运行时再次执行同一边界。每轮预算按已完成的检索请求计算，活动摘要展示本轮累计去重后的资料数；本轮只要取得可用资料，最终通过的结构化回答就必须至少引用一个已返回的 evidence id。每轮使用一个持久 activity id，按真实生命周期记录脱敏的 `received`、`thinking`、`researching`、`evidence-check` 与终态，并保留真实时间戳；运行中活动归属对应提问，完成后归属对应回答。原始 reasoning 不复制进产品事件：Host 通过产品轮次、投递 operation、人物分支、Session 用户消息和所属 DSH turn 定位精确 attempt，只投影 reasoning 文本、人物、产品轮次与终态。已结算 Step 使用组装后的 assistant message，只有未结算 Step 才使用 reasoning delta。界面在运行中更新并始终默认折叠；取消/失败前缀可回看，Provider 无 reasoning 时不生成展示。Prompt、工具参数、凭据、Session 身份和另一人物私有内容仍被排除。Remote 在 delivery/turn 事实持久写入后确认接收，人物任务继续在后台运行。身份类短问会按轮次注入包含当前人物身份的产品规则，并至少说明人物身份及可提供的帮助，不能只返回寒暄；该规则不改变既有 preset 组合身份。状态分析按稳定 id 去重权威事实，同时持久化 Host 权威输入和模型实际看到的别名脱敏输入，并把同一份 Zod 契约生成的 JSON Schema 提供给模型；模型只能引用这些别名，Host 固定本轮目标并在允许集校验前映射回权威事件，恢复与重试会正规化并复用已保存的权威输入。失败会持久记录非敏感归因（`provider`、`parse` 或 `context`）；自动标题只接受一个纯文本候选，会移除 Markdown 和备选说明，不合法结果降级为首条用户原话；严格 schema 与来源校验前只去除最外层 fenced JSON。

状态分析只使用每条共享状态的最新已确认版本。已经进入状态历史的逐字片段从其原用户消息输入中移除，用户修订通过当前已确认状态提供。候选落地按相同种类、规范化原文和重合的事件来源谱系去重，包含已拒绝、已撤回及已替代的历史项。新的用户消息来源仍可产生新状态；模型复用旧状态 ID 时派生本次操作范围内的新 ID，不覆盖用户决策。自动确认核对本次有效分析输入中的原文；模型推断仍需用户确认。
