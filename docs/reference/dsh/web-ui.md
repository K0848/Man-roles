# DSH 通用 Web UI 参考

这份说明面向自行装配普通 DSH 编程 profile 的开发者。Man-roles 用户从 [产品快速开始](../../user/guide/index.md) 进入，无需把编程工作区配置当成人物对话的前置步骤。

<a id="use-the-web-ui"></a>

## 适用入口

普通 DSH 进程默认以调用目录作为文件系统位置；新的通用 Web UI 没有选中的工作区。具体 profile 的启动和权限来自其配置，不以本说明替代产品根启动器。

<a id="configure-a-model"></a>

## 配置模型

通用界面的 Settings → Models 可录入自己的模型账户，模型路由生效无需重启服务。其他提供方和自定义 OpenAI 兼容端点见 [模型配置](guide/providers.md)。

<a id="choose-a-workspace"></a>

## 选择工作区

在通用界面中选择或添加项目目录；未选工作区前，会话输入框不可用。工作区授权范围决定 agent 能访问的文件和操作，不能仅凭文档示例扩大到作者私有目录。

<a id="run-a-task"></a>

## 执行任务

创建会话并输入任务，例如“概述这个仓库，识别主要模块”。通用 agent 可以读取和修改文件、执行命令、委派任务并维护计划；需要批准的操作由当前权限政策决定。本说明不是对任意外部操作的授权。

<a id="continue"></a>

## 继续查询

开发架构见 [底座架构](architecture.md)，产品领域与界面的职责见 [产品架构](../../user/architecture.md)。使用和验证应以实际装配的 profile 为单位，不把通用 DSH 能力等同于人物产品默认能力。
