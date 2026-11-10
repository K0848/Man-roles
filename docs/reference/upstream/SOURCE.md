# 源码来源与维护

本仓库基于 DeepSeek Harness 上游提交 `8fcdee854e9a27d9e2060abd127445769bff3cc2`，包含 Man-roles 产品模块和必要本地集成修改。[上游仓库](https://github.com/deepseek-ai/deepseek-harness) 的版权、MIT 许可和第三方声明保留。本仓库从新的源码提交开始，不附带上游 Git 历史。上述 SHA 是来源声明，不表示本轮完成了上游基线差异比对。

仓库根目录是统一 pnpm 工作区、开发和构建根，没有嵌套源码 checkout。根配置保留工具必要入口，分类配置位于 `config/`；文档从 [导航](../../README.md) 进入。启动器读取根 `research/` 的五份正式人物资料，随源码交付必需代码、锁文件、测试和产品资源。

公开更新前审查 `git status --short` 与暂存差异，执行实际改动所需验证及交付构建，并检查私人内容。`.gitignore` 只能排除匹配的未跟踪文件，不能清除已跟踪正文或历史。新 fixture 和截图仍需内容审阅；测试回归数据不能混入真实用户对话。

本次源码交付未启用上游 CI 工作流，不代表独立 exe、全新机器、跨平台、生产部署或旧数据迁移已经通过验收。运行数据由使用者在被忽略的 `.local/` 或自行排除的独立目录生成；使用自己的凭据和空数据目录，不附带作者的用户 profile、设置、对话或运行数据库。

可选 `.local/launch.json` 保存机器本地的启动设置和凭据补丁路径，显式参数优先。`.private/`、`.claude/`、`.validation/` 和 `.local/` 不属于公开文件集合；交付从审阅过的版本控制文件集合组装，不复制整个本机目录。

产品领域位于 `packages/extensions/man-roleplayer/`，界面位于 `packages/client/ui-man-roleplayer/`，装配位于 `packages/bundle/man-roleplayer-app/`。保留现有包名和依赖身份以维持解析兼容。源码和配置路径迁移不等于重新实现或替换底座。

活动文档只维护一份中文 canonical `.md`，代码、API 标识、源码 JSDoc、必要许可和 vendor 上游原文保留原语言。更新底座前核对真实差异，保护 [vendor 本地修补](../../../vendor/README.md)、依赖补丁及 [MIT 许可](../../../LICENSE)、[第三方声明](../../legal/THIRD_PARTY_NOTICES.md)。
