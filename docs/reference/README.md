# 底座与上游参考

这些资料解释 Man-roles 使用的 DeepSeek Harness、Cordis、工具与发布机制；产品安装和启动以 [产品 README](../../README.md) 为准。参考中保留的底座能力不表示人物产品默认启用了全部能力，也不构成已经完成的多平台或发布验证。

| 主题 | 入口 |
| --- | --- |
| DSH 架构、术语及框架装配 | [架构](dsh/architecture.md)、[术语](dsh/glossary.md)、[Cordis 入门](dsh/cordis-primer.md) |
| 通用编程 Web UI | [通用 Web 参考](dsh/web-ui.md) |
| DSH 模型提供方与 Python SDK | [模型配置](dsh/guide/providers.md)、[Python SDK](dsh/python-sdk.md) |
| DSH 插件开发 | [第一个插件](dsh/develop/basic/index.md)、[插件与生命周期](dsh/develop/framework/index.md)、[能力拆分](dsh/develop/practice/index.md) |
| 包级类型和语义 | [子系统](subsystems/README.md) |
| Cordis API 与教学 | [API](cordis-api/context.md)、[教程](cordis-tutorial/index.md) |
| 增加包、工具及其他扩展 | [扩展操作](cookbook/extension-cookbook.md) |
| 生成的能力与持久化目录 | [工具目录](generated/tool-catalog.md)、[配置目录](generated/config-catalog.md)、[持久化目录](generated/persistence-catalog.md)、[模块图](generated/module-graph.md) |
| 已知事故与设计边界 | [事故复盘](postmortem/README.md) |
| 上游标识与独立评测参考 | [品牌说明](upstream/BRAND_GUIDELINES.md)、[基准测试](upstream/BENCHMARK.md) |

生成区域由源码与生成器拥有。历史决策位于 [Agent Notes](../../.agents/notes/README.md)，冻结归档用于了解原设计，不替代当前工程规则。
