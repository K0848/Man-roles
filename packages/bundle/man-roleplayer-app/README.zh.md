# `@deepseek-ai/dsh-man-roleplayer-app`

[English](README.md) | 中文

这是 `@deepseek-ai/dsh-man-roleplayer` 的独立产品 Web profile 覆盖层，应在独立 profile 中与 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app` 组合。它关闭通用侧栏、输入框、会话、工具界面，只挂载产品客户端根界面；普通 `web` 与 `headless` profile 不受影响。

Host 配置必须显式提供 `DSH_MAN_ROLEPLAYER_PRESET_ROOT` 和 `DSH_MAN_ROLEPLAYER_PERSONAS_JSON`；后者是由统一人物注册表生成的数组，每项包含 `id`、`researchPath`、`presetId`，覆盖已启用的人物资料。缺失、重复或无效绑定会安全失败，不使用当前目录或网络兜底。`DSH_MAN_ROLEPLAYER_PROVIDER` 与 `DSH_MAN_ROLEPLAYER_MODEL` 是必填部署引用；测试 Harness 可以显式绑定 `mock`。产品 profile 同时为每个人物回合配置模型请求数、工具调用数、主动时间、请求超时和无进展停止上限。

浏览器只接收不透明的困惑句柄和脱敏产品投影。产品先创建一份困惑和首位人物私有 Session，后续人物通过版本化产品 Remote 按需加入，只渲染经过结构化校验的人物回答；原始 Session id、内部工具名和内部错误不会进入用户文案。
