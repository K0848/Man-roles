# `@deepseek-ai/dsh-man-roleplayer-app`

这是 `@deepseek-ai/dsh-man-roleplayer` 的独立产品 Web profile 覆盖层，应在独立 profile 中与 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app` 组合。它关闭通用侧栏、输入框、会话、工具界面，只挂载产品客户端根界面；普通 `web` 与 `headless` profile 不受影响。

Host 配置必须显式提供 `DSH_MAN_ROLEPLAYER_PRESET_ROOT` 和 `DSH_MAN_ROLEPLAYER_PERSONAS_JSON`；后者是由统一人物注册表生成的数组，每项包含 `id`、`researchPath`、`presetId`，覆盖已启用的人物资料。缺失、重复或无效绑定会安全失败，不使用当前目录或网络兜底。`DSH_MAN_ROLEPLAYER_PROVIDER` 与 `DSH_MAN_ROLEPLAYER_MODEL` 是必填部署引用；测试 Harness 可以显式绑定 `mock`。产品 profile 同时为每个人物回合配置模型请求数、工具调用数、主动时间、请求超时和无进展停止上限。

浏览器只接收不透明的困惑句柄和脱敏产品投影。产品先创建一份困惑和首位人物私有 Session，后续人物通过版本化产品 Remote 按需加入，只渲染经过结构化校验的人物回答；原始 Session id、内部工具名和内部错误不会进入用户文案。

## Model Experience

### 组合后的人物执行

#### What the model sees

本覆盖层不直接生成 prompt 或工具文字；人物 preset、证据工具、标题与状态分析提示由 [man-roleplayer](../../extensions/man-roleplayer/README.md) 负责。覆盖层设置 `stateAnalysis: true` 并为人物回合配置执行预算。

#### Token effect

本覆盖层不直接添加 token。所组合的产品插件执行人物对话、标题与状态分析时会产生模型请求和 token 消耗；人物请求的输出上限为 8,192 token。

#### KV Cache effect

本覆盖层不控制缓存键或缓存复用；具体效果取决于所组合插件的 prompt 和 Provider 行为。

## Known Limitations and Deferred Work

- 这不是独立运行时；必须与 base、web-app、所需 Provider 和人物部署绑定一起组合。
- 模型请求、工具调用和时间预算可能在答案被接受前终止回合；启用状态分析不保证生成有效状态结果。
