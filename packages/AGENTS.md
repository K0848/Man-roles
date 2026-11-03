# 包级工程规则

这些要求补充 [根工程规则](../AGENTS.md#conventions)。

- 服务包默认导出服务类；函数插件具名导出 `name`、`inject`、`Config`、`apply`，不混用 default。可选服务用 `ctx.get(name)`，只有声明的注入使用 `ctx.<name>`，详见 [Loader 复盘](../docs/reference/postmortem/0001-acp-default-export-drops-inject.md)。
- 产品可见插件至少有一次真实装配验证：通过 Loader 启动测试 `cordis.yml`，只模拟外部或非确定性输入，断言用户、模型或持久状态。手工 `ctx.plugin(...)` 不能替代装配证据，测试 opt-in 不混入正式默认配置。
- 发起者拥有的私有调用链在每个入口通过 `ctx.agents.withInitiator()` 恢复 Agent、导出 `agent.session`，局部 helper 可闭包捕获。生命周期、日志、服务、权限、worker/进程、持久化和协议接口仍显式传递 Agent/Session，不为隐藏参数把 Session 扩成 Context。
- 一个异步操作使用一个生命周期控制器或事务。额外的就绪、取消、预留、释放状态必须对应独立 owner 或结算点；简化时保留回滚、回调隔离和清理收敛。
- 服务定义覆盖全部当前消费方，工具 schema、Loader、UI、传输与提供方细节留在各自拥有者。只供单个内部调用方的公开方法优先改为私有能力闭包。抽象、状态、参数、防御拷贝、兼容分支和公共默认值都要有当前契约或真实消费证据。
- 提示、工具 schema、结果和诊断只包含模型完成任务需要的概念；稳定文本以快照固定，动态行为通过实际输出验证。拒绝规则落实在真正执行操作的地方，不能只靠 schema 隐藏、提示过滤、包装层或 listener 顺序。
- 操作成功后才发布通知与派生状态；缓存、提示、UI、回放和查询从同一权威源导出。限制作用于包含包装和元数据的最终结果，覆盖小值、边界、单个超大项与多字节字节限制。
- 注册贡献须证明 fiber dispose 后消失。每包拥有 `./invariant` 并登记 manifest 名称；检查真实事件/数据关系，没有合理关系时给出包级 `No runtime invariant:` 理由，不能生成无意义 companion 或忽略报告。

## 包布局与文档

包 tsconfig 继承根 `config/typescript/tsconfig.base.json`，Client 使用其 client 版本；`rootDir` 为 src、`outDir` 为 lib/types，引用 workspace 依赖及 runtime-diagnostics/invariants，并只登记一个聚合。只有 api/remotes 使用特定拆分，见 [TypeScript 布局](../docs/development/README.md#typescript-project-layout)。

`src/types.ts` 仅含类型；测试放在包级 `tests/`。行为、配置、默认值、错误码或协议字段变化同步包 README 与 JSDoc。包 README 保留 Model Experience，以及长期消费限制与非显然维护条件；机器识别章节要求见 [增加包指南](../docs/reference/cookbook/adding-a-package.md)。普通清理归 TODO 或 Agent Note，不伪造限制。文字审阅见 [文字标准](../.agents/skills/dsh-prose-standard/SKILL.md)。
