# Web 客户端规则

适用于 `packages/client/*` 和 `apps/web`，补充 [根规则](../../AGENTS.md#conventions) 与 [包规则](../AGENTS.md)。包名为 `@deepseek-ai/dsh-client-<name>`。修改 slot、props、store 或插件结构前读 [slot 模型](../../.agents/notes/implemented/architecture/2026-07-22-slot-type-chain-implementation.md) 与 [客户端架构](../../.agents/notes/implemented/architecture/2026-07-19-gui-web-client-architecture.md)。

## Slot 与 props

1. UI 只通过 `ctx.slots.register({ name, children?, store?, inject? }, Component)` 装配；只有 shell 渲染 root，没有额外 slot 定义、白名单 face 或 face 生成器。
2. children 同时声明和授权可渲染的洞，键与 kind/scope 必须准确。不得渲染未声明 slot 或重复声明别人的 slot；名称反映组合路径，如 `tool.call.toolview`。
3. props 由 `PropsRuntime`、`PropsRenderSlots`、`PropsStore` 与 inject face 四部分派生，不手写重复字段或本地重定义。框架提供 useSession、useSessions、useWorkspaces、useStore、renderSlot 及绑定的 useName hook；业务代码传普通数据与回调，不把自造订阅 hook 作为 prop。
4. 数据渠道按拥有者选择：父级已知用 owner props，组件私有用本地状态，跨入口或需跨重挂载保留的交互状态用注册 store。派生值使用框架数据的纯计算，不另建订阅。
5. store 通过 `props.useStore` 读取、`props.actions.*` 写入；工厂导出为 createXXXStore，在 apply 创建 handle 并共享，禁止模块级单例。测试可直接工厂创建，不要求渲染机制。
6. inject 从 apply 的 ctx 闭包导出普通数据与回调，不导出整个服务、ReactNode 生产器或自造 hook。私有响应式值放在保留 hooks 分区，由 renderer 绑定，组件看不到源对象；只访问 inject 已声明的依赖。

## 响应式读取与数据契约

渲染期间会被 React 外部改变的数据必须经框架 hook 订阅，事件处理可以读即时 snapshot。业务组件不写 useSyncExternalStore、手工 subscribe 或镜像外部 snapshot；按私有 hooks、共享 store、标准 session provide 的次序确定拥有者。

跨 UI 域只共享 JSON 兼容数据与其回调；ReactNode 通过 slot 传递，不新增 ReactNode prop/inject 成员。已有 accessory/overlay/leftItems/rightItems 的迁移另按实际契约处理。observable 源身份稳定，未变化时 snapshot 引用也稳定；重建发布值的拥有者在同一步通过同一源重新发布，后加入注册也要通知已有消费方。

## 导出与 ctx

浏览器入口只导出 Cordis 加载所需 apply/inject/Config、组件通过类型消费的 store 工厂及共享类型；组件、私有 helper、常量和 handle 保持内部。新增公开值导出需要明确产品或接口取舍，不能为了测试方便扩大 API。同包测试直接引用内部源码；跨插件通过 slot 或服务协作，不直接导入对方实现。

ctx 只属于 apply 及其闭包。业务 TSX 组件只经四部分 props 取得数据与回调，不访问 ctx、不导入服务类探测、不读取 React context；BindingContext 等属于 renderer 内部。需要新数据时从 owner、store 或 inject 传入。

## 分层与通知

runtime 数据对象层不导入 React；ConnectionController、SessionManager、Session 拥有业务、重连和流状态，store 引擎提供普通 observable。ui-renderer 拥有 slot、SessionProvider 及所有 ctx/React 绑定。展示组件消费 props，不持有业务逻辑；生产业务代码不依赖 ui-renderer 值。

业务数据不进入仅用于选择、草稿和面板宽度的交互 store。rpcId 由发起者生成、响应方原样返回，业务只接收 RpcRequest。用户手势可直接 notifyNow，结构变化用 markDirty，流片段用累计 markFrameDirty。绘制数据不进入 Session 日志；Host 按帧计算或实时推送，回放重新计算；新增模型可见输入仍需要会话事件。

## 依赖与构建

每个客户端包的 Cordis peer/dev 范围一致。动态包之间的值、类型、module augmentation 及 dsh.client.inject 关系声明为 peer+dev；仅测试依赖为 dev。静态输入与 shell 预载 React 等属于动态消费包的 dev，不放入 dependencies/peer；普通第三方实现库放 dependencies。动态包不把内部 dsh 包放 dependencies。

浏览器和 Node face 独立决定 external，不能因 npm 栏目迁移静默改变 bundle 内容；所有相对运行时导入与资源必须被 files 覆盖。使用 [客户端包检查](../../scripts/verify-client-packages.ts) 核对真实关系。

## 公开浏览器环境

源码静态读取的 DSH_CLIENT_* 都是公开产物内容；共享 helper 将构建进程中的相同值送给 Vite 和动态包，未设置为 undefined，不支持动态查找或枚举。完整构建记录公开值及全部客户端产物摘要，消费方拒绝缺失或过期记录。构建后可变选择属于运行时配置。

<a id="shared-modules-and-the-module-graph"></a>

## 共享模块与模块图

[platform.ts](web/src/platform.ts) 拥有 PLATFORM_MODULES 和 PRELOADED_CLIENT_EXTERNALS。动态 bundle 的基线 external 隐式生效，不重复声明 React、Cordis、runtime 或静态 UI 基线；dsh.client.external 只增加确需模块表身份的非基线值导入，specifier 必须准确，只有尾部 /client 可别名到包行。未声明的普通第三方库可私有打包，import type 不产生运行请求。

模块请求只能由动态包自身行或准确静态表键供应，不存在 dsh.client.provide。构建与客户端检查拒绝未声明 workspace 值导入、缺失提供方、重复请求及同步模块环。

Cordis inject 等待服务，可保持 PENDING 并允许服务环；模块 external 在同步 factory require 前就必须满足，不能等待且拒绝环。dsh.client.inject 的包依赖边仅作展示和 HMR 信息，不排序 activation。模块先按拓扑注册，Cordis 再按服务依赖激活；一个 provider 可先注册后激活。web shell 不是 Loader entry，静态导入负责基线，其余预加载行仍是普通 Loader entry 与 lib/client.js。

## Conversation Node

业务功能注册 ConversationNodeDefinition 及对应 conversation.chat.node renderer，不在 Session、SessionManager 或中央 dispatcher 添加业务 switch/fold。match 只读当前事件，多事件 Context 各自携带或导出同一稳定业务 ID，update 按 seq 确定回放。追加热路径与渲染不扫描完整窗口、Contexts 或 Nodes；状态累计后通过 buildLocationData 发布同 Turn/Step 信息。见 [操作指南](../../docs/reference/cookbook/adding-a-conversation-node.md)。

## 目录与样式

每个 UI 业务能力一个插件包。多域包用 contract 作为唯一共享 API，域间不直接导入，在 apply.ts 单点装配；注册不发生在模块顶层。规则由 [域图检查](../../scripts/verify-client-domain-graph.ts) 约束。

样式遵循 [样式说明](../../docs/development/web-styling.md)，共用 token 和全局表在 ui-theme，组件使用语义 CSS Modules 与 clsx，不硬写颜色、不另引组件库或 Tailwind。产品文案及人工说明使用中文，API 标识与既有源码 JSDoc 可保留原语言。

## 测试与新增能力

按改动选择对应 runtime、组件或真实浏览器层验证；组件断言用户可见行为，不断言类名、hook 内部或渲染次数。jsdom 由文件首行 pragma 指定，共用配置仍为 node。coverage 豁免必须解释不可达原因。完整策略见 [测试说明](../../docs/development/testing.md)，不把上游 CI 当成本项目证据。

新增插件同时核对：package manifest/exports/files、包内 tsconfig 与 tsdown.config.ts、正确聚合的 references、web-app profile 条目和其依赖；runtime-diagnostics/invariants 依赖与 README 契约保持。跨包 slot 用 slots.inject 等待真实声明，多个贡献需原子安装时返回生成器；不要用无关服务依赖替代声明等待。

新增组件仍从 SlotMap、父 children、slot 注册及四部分 props 推导类型。包内配置文件保持在包内，根聚合位于 config/typescript；重建后再用实际 lib/client.js 验收，不以源码检查代替发布产物。
