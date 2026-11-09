# 启动器命名

入口包使用 `@deepseek-ai/node-addon-landlock-run`，平台包添加操作系统与架构后缀，例如 linux-x64。工具变体留在 prebuilds.json，不加入包名；静态 musl 二进制不另加 libc 后缀。

NALR_* 仅供构建和测试编排。运行二进制与入口不读取环境变量覆盖路径或策略，详见 [安全规则](../AGENTS.md)。

C 启动器采用单文件和静态链接，无公开符号命名空间；本地定义的内核 UAPI 常量保留其内核名称，并以 LL_ 区分。

`NALR_REQUIRE_LANDLOCK` 只用于测试：不能执行限制的内核使测试失败，而非跳过。环境变量名不带 npm scope；平台二进制固定发布在 `bin/landlock-run`。
