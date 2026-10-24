# Agent Note：man-roleplayer 独立产品 profile

状态：已实现

[English](2026-09-04-man-roleplayer-independent-product-profile.md) | 中文

## 问题

产品需要一个不会悄悄进入普通 DSH Web 的浏览器入口。通用会话界面与产品人物能力分别拥有不同的所有权、投影和失败边界，不能共用普通 composer 的默认入口。

## 决策

双人物困惑界面是显式选择的独立 profile bundle，不是普通 Web roster 的额外 row。`@deepseek-ai/dsh-man-roleplayer-app` 覆盖 shipped Web composition，关闭通用 layout、侧栏、composer 与工具界面，并将 `@deepseek-ai/dsh-client-ui-man-roleplayer` 挂载为产品根界面。Host 显式提供两份调研路径、preset root 与 provider/model 引用。

产品 Remote 创建一份 Host 所有的困惑和两条私有 Agent Session，只暴露不透明 handle 与脱敏 projection。客户端由一个不可变 projection store 所有状态，并通过 selector 提供侧栏、对话与详情视图。产品工具注册在每条准确 Agent context 中，并随 AgentHandle 释放；普通全局工具目录保持不变。

没有活动产品 capability 的 Agent 会收到有明确类型且 evidence 为空的 unauthorized 证据检索结果。拒绝不包含正文或出处，也不会创建产品 claim/activity，因此普通 Session 不能建立没有困惑归属的产品关联。

人物回答通过校验后，产品 profile 会为该 turn 最多异步启动一次状态分析。严格的结构化结果只从已完成 turn 与允许的产品投影派生，持久化候选状态项目和当前人物 snapshot。候选在用户通过版本化 Remote 显式确认、修改、拒绝、撤回或解决前保持待处理；CAS 与 request id 支持安全重试，分析失败或过期都不会重放人物 turn。

证据详情在读取时从两份配置的正式调研索引派生。产品 wire 只暴露稳定证据元数据、受限标题/正文/出处字段、生命周期状态和脱敏检索活动；产品事件不保存第二份资料正文。质疑、显式复核和撤回通过带版本的 Remote 变更完成，依据持久化生命周期将被质疑或撤回的项目移出当前 allow-list。

`profile-boot` 只对内置 `web` 与 `headless` profile 名称保留 shipped preset-root 覆盖。因此自定义产品 profile 使用自己的显式 preset root，不改变普通 profile 的优先级。

## 验证

Loader 组合回归通过版本化 Remote 创建空白困惑，观察两条私有 live Agent，确认产品工具不在全局 schema 中但在准确产品 Agent scope 中可见，并提交结构化回答；返回 projection 不包含 Session id。client plugin 回归确认同一 store 通过 root slot 注入。普通 Web 配置断言产品 Host/client row 不存在。

没有修改 Agent Loop，也没有新增外部依赖；bundle 只依赖已有 workspace package。

## 备选方案

把产品 row 放进 shipped Web roster 会让普通会话看到产品控制和人物能力。复用通用 conversation composer 也会绕过不透明产品 Remote 及其两条 Session 的所有权边界，因此都不采用。

## 影响

操作员必须显式组合产品 bundle，并提供绝对的 preset/research 绑定。普通 Web 保持不变；产品浏览器测试使用 fake Provider 与隔离临时目录。
