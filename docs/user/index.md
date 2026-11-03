---
layout: false
head:
  - - meta
    - http-equiv: refresh
      content: 0; url=./guide/quickstart
---

# 向古人问惑使用入口

向古人问惑是基于 DeepSeek Harness 的本地历史人物对话原型。可以选择王阳明、曾国藩、庄子、苏轼或朱熹，围绕自己的困惑展开对话。回答由模型生成，人物资料与 preset 约束表达，不保证历史人物原话。

## 安装、构建与启动

从 [产品 README](../../README.md#run-from-source) 开始。Windows PowerShell 启动器使用仓库内源码、人物资料与装配配置；使用者提供自己的 API 凭据和数据目录，不需要作者本机资料。安装依赖后完整构建，再在仓库根运行启动器。

首次进入后新建困惑、选择人物并输入问题。发送内容会交给所配置的模型服务；费用和支持模型取决于自己的账户。具体启动参数、默认端口、更新行为和数据位置以 [README](../../README.md#run) 为准。

## 底座参考

[DSH 快速入门](../reference/dsh/web-ui.md) 和同目录其他指南解释通用 Harness、SDK 与插件能力，它们不是 Man-roles 产品的默认启动流程。开发者从 [工程规则](../../AGENTS.md) 与 [开发说明](../development/README.md) 继续。
