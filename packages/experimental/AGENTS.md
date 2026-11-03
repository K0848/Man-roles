# 实验包规则

遵守 [包级规则](../AGENTS.md)，设计依据见 [实验 Agent Teams 决策](../../.agents/notes/implemented/architecture/2026-08-18-experimental-agent-teams-packages.md)。

只有完整公共契约均属实验或内部用途的包才放在此处；正式包内的实验选项仍由其产品职责拥有。包名使用 `@deepseek-ai/dsh-experimental-*`，设置 `private: true`，不声明 `publishConfig`，不属于正式发布集合。

正式包和 app 不得通过 dependencies、optionalDependencies 或 peerDependencies 依赖本目录。实验包可依赖正式包或其他实验包；测试可将实验包作为开发依赖，示例可以显式加载。

实验状态不降低安全、生命周期、测试、不变量、快照或文档要求。转正式时按产品职责迁移、去掉 npm 名称中的实验前缀，同步全部导入及配置，并审阅公共契约、限制、验证、发布载荷和稳定 owner。
