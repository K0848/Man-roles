# Man-roles 工程规则

## 工程与资料入口

本目录是向古人问惑的 Git、pnpm workspace、开发和构建根。产品领域位于 `packages/extensions/man-roleplayer/`，界面位于 `packages/client/ui-man-roleplayer/`，装配位于 `packages/bundle/man-roleplayer-app/`；`research/` 的五份文件是正式人物资料。安装、构建和启动见 [README](README.md)，源码来源与补丁维护见 [SOURCE](docs/reference/upstream/SOURCE.md)。

存在本地 `.claude/task_plan.md` 时先恢复计划、进度和发现。`.claude/`、`.private/`、`.validation/`、`.local/` 是私有材料，不进入源码交付；不提交凭据、用户对话、数据库、截图或机器专属配置。发布布局或忽略规则改动前运行 `node scripts/verify-publish-ignore.mjs`，另审实际暂存内容；忽略检查不能证明内容安全。

## Commands

命令和版本以 [package.json](package.json) 为准；所有命令在本根目录执行。

| 用途 | 命令 |
| --- | --- |
| 安装锁定依赖 | `pnpm install --frozen-lockfile` |
| 完整构建 | `pnpm run build` |
| 本地启动或更新 | `start-man-roles.cmd`、`start-man-roles.cmd -Update`；实现位于 `scripts/start-man-roles.ps1` |
| 单元测试 | `pnpm test`，按文件或用例缩小范围 |
| 类型或 lint | `pnpm run typecheck`、`pnpm run lint` |
| 文档检查 | 按受影响内容选择 [文档规则](docs/AGENTS.md) 中的检查 |

## Run relevant checks locally

按行为和交付范围选择一次充分的验证：纯文案检查格式、链接和事实；类型或生成契约检查对应生成与类型链；模型或用户可见行为检查真实装配入口和必要快照；发布产物检查构建及消费路径。已通过的检查只有在相关代码再次变化或暴露新风险时重跑。不默认运行全仓检查或真实 API；真实调用需要凭据并产生费用。

本仓库的源码交付没有启用上游 CI 工作流。上游文档中的矩阵、发布流程、标签与官方贡献承诺是底座参考，不作为本项目已执行的验证。推送前按 [本地验证流程](.agents/skills/dsh-pre-push-checks/SKILL.md) 检查实际改动；合并或发布另按用户授权执行。

## Conventions

- 修改 `packages/` 前读 [架构](docs/reference/dsh/architecture.md) 和 [包规则](packages/AGENTS.md)。能力通过插件与既有扩展点接入；改 agent-loop 同步更新其架构说明。保留 `@deepseek-ai/dsh-*` 与 vendored 包身份，避免破坏 workspace 解析。
- 使用严格 TypeScript 和 ESM；本地相对导入带 `.ts`，跨包使用包名。Host 与 Client 保持独立聚合，根 solution 不展开为同一个 TypeScript program。源码检查解析 `src`，消费 `lib` 的检查显式完成构建；生成契约遵循 [开发说明](docs/development/README.md#typescript-project-layout)。
- 注册必须通过 `ctx.effect()`、`ctx.on()` 或返回 disposer 的注册 API；所有权在可重入发布前建立。waterfall listener 调用 `next()` 才会继续传递。生命周期、并发、进程和 teardown 修改先读 [防御模式](docs/development/defensive-patterns.md)。
- 模型可见内容必须能从会话日志重建；新增模型输入同步定义会话事件。闭合联合用 `assertNever`，扩展联合保留有依据的默认分支；事件、服务和参数契约随实现同步。
- 在配置、持久化、模型或工具 JSON、队列、进程及网络入口验证外部数据；不为同进程已受类型保证的调用重复添加防御。配置缺失及失败及时报错；空 catch 解释具体吞掉的错误和范围。部署可变参数归属配置，不硬编码业务选择。
- 运行不变量检查事件或可变状态之间的真实关系；服务存在、方法存在或固定示例不替代关系检查。没有合理关系时保留说明明确的空 companion，避免发明验收条件。
- 公共行为变更同步所属 README 与 JSDoc；类型变更更新所属子系统及类型等价清单。模型或用户可见变化保留真实装配的 keyless 快照；SDK、持久化或协议变化检查其受影响消费方。测试策略见 [testing](docs/development/testing.md)。
- 活动文档统一为一份中文 canonical `.md`，不保留英文镜像或 `.zh.md` 跳转；代码、API 标识、源码 JSDoc 与必要许可保留相应边界。遵守 [文档规则](docs/AGENTS.md) 与 [语言政策](docs/development/language/README.md)。非琐碎决策新增或更新一份 [Agent Note](.agents/notes/README.md)；历史材料按仍有效的事实与准确授权范围整理。

<a id="pre-release-stance-foundation-over-blast-radius"></a>

## 持久化与兼容

底座 SQLite 通过 `SCHEMA_VERSION` 标识结构，会话日志使用 `SESSION_FORMAT_VERSION`；不认识的持久化格式应拒绝读取。兼容与迁移需要显式设计和验证，不把现有本机数据库视为可随源码分发或自动迁移。底座历史 pre-release 取舍用于解释现有行为，不表示用户数据可以丢弃。

## Vendoring policy

`vendor/` 是固定来源的 Cordis 及基础库，并包含有效本地修补。保留上游版权和许可；修改先读 [vendor 规则](vendor/AGENTS.md) 与 [来源、差异和同步流程](vendor/README.md)。每项源码差异记入维护日志；不能直接用上游或 registry 包覆盖本地修补。更新后验证相关行为与构建，不把 SHA 声明当成已完成上游 diff 的证据。
