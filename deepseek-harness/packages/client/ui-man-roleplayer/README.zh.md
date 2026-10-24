# `@deepseek-ai/dsh-client-ui-man-roleplayer`

[English](README.md) | 中文

可变人物分支困惑产品的浏览器投影客户端。一个 `RoleplayerProjectionStore` 拥有 Host 投影、选择、重载和带版本的生命周期操作；sidebar、conversation、details 三个 selector 都从同一份不可变快照派生，组件不维护第二份业务缓存，wire 响应也不暴露 DSH Session id。

插件消费带版本的 `manRoleplayerRemote` namespace，通过已有 root slot 注册产品根界面，并让侧栏、对话、详情与服务面共享同一 store。Host 变更携带 opaque 困惑 handle、request id 和期望 lifecycle revision。传输或业务失败会保留在 store 中；删除只在 Host 返回明确 deleted acknowledgement 后从本地投影移除。

details selector 也会显示最新的状态分析状态、当前人物 snapshot 与共享状态项目。状态项目在用户通过 Host Remote 显式确认、修改、拒绝、撤回或解决前保持候选状态；每次操作都带版本并可安全重试。

证据详情是 Host 根据已配置调研索引派生的只读元数据。界面显示安全的标题、受限正文、出处、类型和可信状态，以及脱敏的检索活动。质疑、人工复核和撤回都通过带版本的 Remote 变更完成；界面不渲染 Session id、fingerprint、工具名或内部错误。

## 界面与人物素材

页面操作采用公开 ui-primitives 的 Button、Input、Menu、Pill 和 StateDot，按钮以 primary/outline/ghost 区分提交、辅助与低频操作。困惑菜单通过 portal 避免侧栏裁切。人物身份、对谈状态、共享信息和资料依据按真实投影组合成独立卡片；页面样式负责布局，公共组件负责基础控件状态。

产品root拥有可收起的困惑导航、居中对话，以及状态、人物视角、资料依据标签。私有 `manRoleplayer.personaDeck` 子槽只渲染Host返回的人物目录。翻面和选定不改变困惑；明确确认后才创建单个初始分支或调用已有切换操作。失败保留选择，离线禁用确认，回合仍在执行或未确认停止时禁止切换人物。肖像为原创艺术演绎，通过 `/man-roleplayer/portraits/<persona-id>.png` 提供；Web前端从public目录发布，不将图像字节嵌入客户端JavaScript。

回复控件仅指向当前困惑、当前人物已完成的回答。客户端通过现有 `replyToTimelineEventId` 字段提交稳定时间线ID，Host投影在重载后保留关联。切换人物清除回复对象但保留该困惑草稿。状态和资料操作等待Host确认，界面不使用本地快照模拟逆向状态变更。结构化选择来自Host，不使用演示问题。

产品root通过已有主题令牌呈现已确认的浅色视觉，卸载时恢复此前的文档外观，不持久修改普通DSH的外观偏好。

## Model Experience

### 投影与生命周期操作

#### What the model sees

无。本包只负责浏览器投影，不参与模型 prompt 组装或 Agent 执行。

#### Token effect

无。

#### KV Cache effect

无。

## Profile 边界

- 产品 bundle 会关闭通用 layout、侧栏和 composer，并拥有 root 界面。普通 Web 与 headless profile 不会加载此 package，除非操作员显式组合产品 bundle。

H3 将已发送消息的接收确认与下一条可编辑草稿分开。进度来自产品所有的事实；原始 reasoning 则从对应人物 Session 与产品轮次只读派生，运行中持续更新、始终默认折叠，并保留完成、取消或失败终态。Provider 没有输出 reasoning 时不伪造展示。界面不渲染 Prompt、工具参数、凭据、Session 标识或另一人物私有内容；正式回答仍只有通过结构化 Claim 与证据校验后才显示。

## H2.8 生产行为

单一 projection store 将 active turn operation 保存在其发起的不透明困惑 handle 与人物下，轮询、取消、选择回答和刷新恢复都遵循该归属。Host 投影区分运行中、停止中和未知执行状态，界面不会把取消请求直接当作可以提前切换人物。状态重试复用失败 operation 的持久化输入并使用一个稳定 retry operation。删除只能继续相同的不可逆 operation；归档投影可浏览但不提供写操作。已接受消息按 Host 校验的 Claim 范围渲染并显示派生证据状态；stale 关联仍作为历史保留。产品根界面与普通 DSH UI 和 Session 路由隔离。

投影对象订阅现有连接的 Host 描述来源。断线时停止活动计时、禁用远程操作并保留输入草稿；重连后先读取 Host 权威投影，再恢复可用控件。过期连接代际的响应不能覆盖重连结果。浏览器在本机保存选中的不透明困惑句柄，每次加载时核对是否有效，无效时安全回退；本机存储不可用时仍可使用当前对话。新建及最近选择的困惑显示在前。证据类型和可信度以中文标签呈现，来源正文保持原样。

待处理的结构化选择始终绑定 Host 操作 ID。浏览器按操作 ID 保存选项和自定义文字草稿；正常提交前要求每个问题至少包含一个选项或非空自定义文字。只有显式跳过操作才会为每个问题发送跳过标记。Host 轮次等待选择时，顶部和详情状态会明确提示等待，对话不会把该轮呈现为仍在思考。

单选题的自定义文字和 radio 选项互为替代：输入自定义文字会清除 radio 选择；切回选项作答时，界面保留文字草稿，但不会将其一起提交。多选题仍可同时提交已选选项与自定义文字。
