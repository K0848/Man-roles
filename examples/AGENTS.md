# 可运行示例规则

`examples/` 是一个 workspace 成员，也是可运行和测试 Cordis 配置的模块解析根，不是单独构建目标。[package.json](package.json) 声明配置加载的包，叶目录私有 manifest 仅保留元数据。可复用逻辑归 `packages/`，示例保留装配、演示资源与 e2e/快照场景，启动代码归 app bin。

## 装配验证

无密钥场景通过 Loader 启动真实 `cordis.yml`，驱动行为并断言输出与清理退出；不能用手工挂载插件代替。真实模型场景需要独立授权、凭据和费用范围，检查外部状态，不相信模型自述；无密钥时跳过对应真实调用。

进程冒烟使用 `@deepseek-ai/dsh-loader-smoke` 解析 Loader 启动，终端测试在其外层提供伪终端。测试自带路径、环境、输入和断言。测试 Cordis 配置放在对应示例叶目录；包自有配置归 `examples/<agent>/tests/fixtures/<group>/<package>/cordis.yml`，驱动及断言仍由包拥有，所用包在示例依赖和正确聚合配置登记。

不在此手写测试清单；实际 tests 目录与根脚本是事实入口。装配注释只说明非显然的接线、顺序、安全、回放与配置范围。整体关系见 [底座架构](../docs/reference/dsh/architecture.md)，工程要求见 [根规则](../AGENTS.md)。
