# landlock-run 命令行契约

本文定义二进制与消费方之间的可观察协议；消费方通过入口包的 launcherPath/probe/grantArgs 使用。参数、状态和报告格式变化须同步包族版本及发布说明。

## 调用语法

```text
landlock-run [--ro <path>]... [--rw <path>]... -- <argv>...
landlock-run --probe
```

--ro 授予路径下的读取与执行；--rw 授予协商 ABI 可治理的全部文件系统访问。未授予访问被拒绝，非目录授权只保留兼容文件的访问位。-- 是必须的参数边界，后方 argv 经 execvp 执行且环境不变。--probe 不与授权或命令组合，不接受其他参数或环境输入。

## 退出与报告

启动器失败使用 `125`（LAUNCHER_FAILURE_EXIT），不会执行被包装命令。成功 exec 后子进程状态原样传回，包括 125；消费方须同时核对 125 和 `landlock-run: ` 致命报告，不能只凭状态归因。

probe 在内核可以完整或部分执行时为 0，不可用时为 125；执行能力由实际 probe 决定，不按内核版本推断。具体固定报告字符串和常量由 JS 入口与 C 实现共同拥有，不复制另一套解析器。

部分 ABI 执行只对已支持访问有效；消费方必须将 full、partial、unusable 区分，不能把 partial 扩写成全部访问已隔离。详见 [支持矩阵](support-matrix.md)。

## 固定报告与继承

probe 成功只输出一行 stdout：`landlock: fully enforced` 或 `landlock: partially enforced (older ABI)`，入口分别映射为 full/partial，非零状态映射 unusable。部分 ABI 的受限执行在 stderr 输出 `landlock-run: partial enforcement (older Landlock ABI)` 后继续；每个致命错误先输出以 `landlock-run: ` 开头的一行 stderr，再退出 125。

启动器设置 no_new_privs，在自身安装规则后 exec。规则跨 execve 继承，后代进程同受限制；本构建识别的文件系统访问最高到 ABI 5，运行 ABI 不认识的更高访问不受治理，这是 full 与 partial 的区别。
