# 原生包打包

包族包含一个 JS 入口和平台 optional 包，不划分 Node ABI 或 backend；平台载荷仅含 prebuilds.json 声明的静态可执行文件。

## 包与平台矩阵

入口为 `@deepseek-ai/node-addon-landlock-run`，平台包为其 linux-x64、linux-arm64 版本。不支持的平台不加入 optionalDependencies，原因见 [支持矩阵](support-matrix.md)。

入口 manifest 列平台可选依赖，平台 manifest 声明 os/cpu，prebuilds.json 声明 tool/kind/path。无需 libc 字段，静态产物适用于 glibc 和 musl。矩阵变化同步这些元数据、锁文件和说明；github-matrix 脚本从元数据派生矩阵，build 脚本只构建当前架构。

## 运行选择

安装器按 os/cpu 选择平台包，launcherPath 解析 bin/landlock-run；找不到则返回确定的不存在路径。probe 将缺产物与不支持隔离的内核统一为 unusable，消费方拒绝无约束 fallback。

入口没有安装脚本，也不在使用者机器编译。编译 fallback 会额外要求 musl 工具链，并把明确拒绝变成取决于环境的结果；打包安装检查约束这一点。

## 打包与消费验证

平台包使用 npm pack，入口使用 pnpm pack；此前 pnpm 11.7.0 的平台打包路径会丢可执行位，而入口需要其 workspace 依赖转换，故二者不能互换。正式路径由 pack-release 脚本拥有。

平台 prepack 检查全部声明二进制存在、可执行、ELF e_machine 匹配 cpu，且 bin 无多余载荷；入口检查已构建 lib。verify-packed-install 从 tarball 临时安装、比较与构建源的字节、核对安装后可执行位，并做真实限制验证，不能只按 manifest 判断可用。
