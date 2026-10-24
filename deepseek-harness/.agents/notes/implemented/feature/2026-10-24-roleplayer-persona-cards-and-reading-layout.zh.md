# Agent Note: Roleplayer persona cards and reading layout

Status: implemented

[English](2026-10-24-roleplayer-persona-cards-and-reading-layout.md) | 中文

## Problem

困惑界面需要让用户充分了解人物后再选择，并在可读对话中分开检索活动、共享状态与人物独立理解。视觉改版必须保留产品权威生命周期以及已修复的选择和连接行为。

## Decision

页面把公开 Button、Input、Menu、Pill 和 StateDot 基础组件组合为产品卡片。菜单通过 portal 避免侧栏裁切；产品负责键盘进入与焦点恢复。人物元数据属于展示文案，状态数量、讨论状态与资料可用性均从 store 派生。CSS 保留公共按钮变体，不统一覆盖所有后代按钮样式。

产品保留自身root并注册私有人物卡子slot。卡片消费Host人物目录及本地展示元数据；浏览、翻面、选定属于界面状态，明确确认后才调用已有create或switch操作。阅读布局使用可收起导航及独立的状态、人物视角、资料依据标签。Remote失败仍然可见，草稿按困惑保留。

肖像以PNG文件随Web前端public目录发布，使用已有静态fallback。它们是原创艺术演绎，不主张历史真容。PNG MIME条目服务实际发布的这一类素材。客户端bundle只包含URL，不包含base64图像，不新增插件资源路由或运行依赖。

显式回复使用已有持久化回复ID。客户端发送前验证目标为当前困惑、当前人物已完成回答；产品与Remote投影在重放时保留关联。切换人物清除回复对象。状态操作仍是带版本的Host变更，界面不通过恢复本地业务快照伪造撤销。

产品root挂载期间拥有文档浅色呈现，卸载时恢复原外观。卡册自行设置border-box尺寸，因为公开Modal基础组件通过portal挂在产品root的CSS范围之外。

## Alternatives considered

启用普通DSH布局和会话插件会恢复编码工作区行为并产生root所有权竞争；导入它们的内部组件则绕过slot契约。因此产品复用公开基础组件和主题令牌，自行拥有领域布局。新增通用插件资源路由或把所有肖像嵌入JavaScript会扩大共享基础设施或启动负载；已有前端素材管线足以提供所需文件。

## Consequences

前端发布物必须随UI bundle包含肖像目录。即使展示元数据包含更多已知人物，动态目录的可用性仍由Host决定。后端确认、状态沿革、依据失效、等待选择、取消未停稳与删除checkpoint仍是验收依据，原型交互不能替代这些操作。该决定补充仍有效的连接恢复和显式选择记录，不取代其生命周期规则。

## Testing

组件测试覆盖卡片明确确认、失败与离线、响应式面板焦点、草稿保留与界面操作。Store与真实Loader测试验证出站请求的回复ID，拒绝失效或跨人物目标，并重载持久化关联。静态服务Loader测试核验PNG字节和MIME。组装后浏览器验证使用产品profile与固定本地端口。
