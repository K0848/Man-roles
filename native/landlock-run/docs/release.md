# 原生启动器发布参考

这是底座包族的发布设计参考，不是本仓库已启用的工作流，也不授权实际发布、打 tag、提交或推送。当前工程源码交付和平台验证边界见 [根 SOURCE](../../../SOURCE.md)。

## 版本与本地准备

workspace 根与三个公开包采用同一版本。原有 release:bump 帮助器更新 manifest、根锁文件并运行 release:verify；可指定 patch/minor/major 或完整 semver。源码保留 workspace:*，由打包转换具体版本。预发布应使用独立 dist-tag，不能让 latest 指向测试版本。

```sh
pnpm install --frozen-lockfile
pnpm --dir native/landlock-run build:ts
pnpm --dir native/landlock-run typecheck
pnpm --dir native/landlock-run test:entry
```

Linux 原生环境需要另外构建二进制、运行 launcher 测试并通过 pack-release 和 verify-packed-install 做当前平台 tarball 演练。不能把 Windows 上入口测试成功视为 Linux 限制已经验证。

## 发布顺序与权限

平台包先于入口发布，确保入口 optionalDependencies 不超前引用不存在版本。二进制应由对应架构原生构建，最终发布的是已经验证的 tarball，不能直接用 pnpm publish 跳过保留可执行位的打包路径。

上游设计使用与版本一致的 landlock-run-vX.Y.Z tag、先演练再正式发布，以及受控 npm 凭据或可信发布身份。启用这些机制需要实际仓库和 npm 权限配置及独立授权；不把参考中的 CI 或 OIDC 当作本项目现状。不得提交含 token 或 registry 覆盖的 .npmrc。
