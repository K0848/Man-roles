# Landlock 启动器规则

本目录维护先限制自身再 exec 的 Landlock 启动器、平台二进制包及 JS 入口，属于根 pnpm workspace。平台发布设计是底座参考；本仓库未启用相应上游工作流，不能把文档中的 runner 或发布步骤视为已有验证。

## 运行安全

- 规则集无法创建或内核不能执行时必须以非零状态退出，禁止无隔离 fallback 后继续执行命令。
- 二进制与入口包不读取环境变量来决定使用哪个安全启动器；测试注入通过参数，NALR_* 仅用于构建和测试编排。
- 内核 UAPI 定义保留在 C 源码，不依赖工具链头文件版本；仅依赖 libc，并以 musl 静态链接。
- CLI 参数、退出码和报告行是跨消费方契约，变化需版本及发布说明同步。消费方通过 JS 入口解析，不各自复制协议。
- 不提供安装时编译 fallback；缺少平台包时返回不存在的路径，probe 判为不可用并拒绝无约束运行。

## 布局与检查

`packages/entry/` 保存入口 API、协议常量及 C 源码；`packages/linux-*/` 只包含声明的预构建静态二进制。源码、打包和测试的拥有者见 [架构](docs/architecture.md)，平台范围见 [支持矩阵](docs/support-matrix.md)。

在根工作区安装依赖，原生编译需要对应 Linux 架构及 musl 工具链。修改只运行受影响入口或内核行为验证；不因 Windows 无法运行 Linux 隔离测试而宣称失败或通过。平台二进制、库、发布目录和 tsbuildinfo 不入 Git。

## 打包与文档

平台矩阵以各包 manifest 的 os/cpu、prebuilds.json 和支持矩阵为准；每个平台包只含其声明的二进制，名字不含工具变体或 libc 后缀。构建采用各架构原生编译，不引入交叉工具链。

平台包使用 npm pack 保留可执行位；入口包使用 pnpm pack 转换 workspace 依赖。prepack 检查二进制存在、可执行、ELF 架构及入口 lib；已打包安装验证核对真实载荷和限制效果。说明见 [打包](docs/packaging.md)。

人工说明统一中文普通 Markdown，不保留语言镜像；API 名称和必要源码原文保留。产品安装入口仍以根 README 为准，本目录的 [发布参考](docs/release.md) 不授权任何远端发布。
