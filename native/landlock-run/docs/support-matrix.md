# 原生支持范围

## 有对应平台包

| 平台包 | 上游原生构建设计 | 二进制 |
| --- | --- | --- |
| `@deepseek-ai/node-addon-landlock-run-linux-x64` | ubuntu-24.04 | 静态 musl，适用于 glibc/musl |
| `@deepseek-ai/node-addon-landlock-run-linux-arm64` | ubuntu-24.04-arm | 静态 musl，适用于 glibc/musl |

本项目未启用这些上游 CI 工作流，也未由此获得平台验收结论。运行还需内核启用 Landlock；实际协商 probe 是权威依据，不按版本号推断。已知访问全受控为 full，旧 ABI 只覆盖子集为 partial，没有或禁用 Landlock 为 unusable，启动器拒绝执行命令。

## 未提供的平台包

macOS 通常使用系统 Seatbelt/sandbox-exec，属于不同机制；Windows 隔离启动器也不是此 Landlock 工具的简单移植。其他 Linux 架构需配套原生构建与验证设计后才能加入，不能只加 manifest。

不支持的平台解析到不存在的启动器，probe 为 unusable 并拒绝无约束运行；这是一种明确退化，不代表程序可以跳过隔离继续。
