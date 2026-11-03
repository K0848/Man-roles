# 向古人问惑产品架构

产品由同一 pnpm 工作区中的领域模块、浏览器界面与 profile 装配组成。安装和启动见 [README](../../README.md)，底座的完整插件体系见 [DSH 架构](../reference/dsh/architecture.md)。

| 部分 | 源码与职责 |
| --- | --- |
| 产品领域 | `packages/extensions/man-roleplayer/`：困惑、人物分支、消息与状态，以及人物 preset |
| 浏览器界面 | `packages/client/ui-man-roleplayer/`：用户操作、状态展示与产品 Remote 调用 |
| 产品装配 | `packages/bundle/man-roleplayer-app/`：将领域、界面和所需底座能力组合到产品 profile |
| 人物资料 | 根 `research/` 的五份正式文件：随产品使用的人物资料来源 |
| 本地入口 | 根 `start-man-roles.ps1` / `.cmd`：读取仓库内资源及使用者自己的设置，启动或更新已核验的产品实例 |

启动器从工程根定位源码、preset 和人物资料，运行时在自己的数据目录生成 profile、设置和会话。界面经产品 Remote 接口调用领域能力，领域模块使用底座会话、模型和持久化能力；源码目录与使用者数据目录分别管理。

运行需要自己的模型账户与凭据。对话内容和必要人物上下文会发送给所配置的服务；人物材料约束角色表达，不保证输出等同于历史原话。源码交付不包含作者本机数据库、私有评审、凭据或运行台账。

开发时保持领域、界面和装配职责，变化同步相应包 README、契约及受影响测试。具体类型见 [人物子系统参考](../reference/subsystems/man-roleplayer.md)，验证选择见 [测试说明](../development/testing.md)。
