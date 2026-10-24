# 向古人问惑 · Man-roles

基于 DeepSeek Harness 的历史人物对话原型。选择王阳明、曾国藩、庄子、苏轼或朱熹，围绕自己的困惑展开对话；人物资料和 preset 共同约束角色表达。界面与会话能力由本仓库的产品模块和 DSH 底座共同提供。

这是供本地运行和继续开发的源码交付。人物回答由模型生成，不能视为历史人物原话或专业意见。当前没有把原开发环境的密钥、对话、设置或运行数据库迁入本仓库。

## 目录

- `research/调研成果-*.md`：五位人物的正式资料。
- `deepseek-harness/packages/extensions/man-roleplayer/`：业务逻辑与人物 preset。
- `deepseek-harness/packages/client/ui-man-roleplayer/`：产品界面。
- `deepseek-harness/packages/bundle/man-roleplayer-app/`：产品配置装配。
- `deepseek-harness/`：所依赖的 DSH 源码、底座修改、锁文件、构建配置和测试。
- `start-man-roles.ps1` / `.cmd`：Windows 本地启动入口。

## 安装与构建

需要 Windows PowerShell、Node.js `^22.19.0 || >=24.0.0` 和 pnpm `11.7.0`（以 `deepseek-harness/package.json` 为准），以及可访问依赖仓库的网络。构建可能耗时，须等待每一步成功后继续。

从仓库根目录进入 PowerShell：

```powershell
cd deepseek-harness
pnpm install --frozen-lockfile
pnpm run build
cd ..
```

DSH 以子目录嵌入本仓库，安装时会明确跳过仅适用于独立 DSH 仓库根目录的 Git 钩子与合并驱动配置。

构建失败时先处理错误，不跳过失败步骤直接启动。锁文件固定依赖解析；系统平台与原生依赖仍可能影响安装，本交付不代表所有平台均已验收。

## 启动

在当前 PowerShell 中设置自己的 DeepSeek API key，然后运行启动器：

```powershell
$env:DEEPSEEK_API_KEY = '替换为你自己的 API key'
.\start-man-roles.ps1
```

也可在已设置该环境变量的命令行中执行 `start-man-roles.cmd`。不要将实际密钥写进脚本或提交至 Git。默认模型是源码内置的 `deepseek-v4-flash`，默认 Provider 为 `deepseek-official`；账户须能访问所选模型，调用可能产生 API 费用。若模型不可用，可按供应商支持情况传入 `-Model`。可选环境变量 `DEEPSEEK_BASE_URL` 由底座适配器读取。

默认仅绑定 `http://127.0.0.1:3085/`，前台运行；按 Ctrl+C 停止。端口被占用会报错，不自动停止其他进程。

```powershell
.\start-man-roles.ps1 -NoOpen
.\start-man-roles.ps1 -Port 3086 -Model 'deepseek-v4-flash'
```

启动器从仓库内的相对位置寻找源码和五份资料，并将绝对路径仅在运行时传给产品配置。首次使用会由 DSH 自动创建 `man-roles-mvp-web` profile，依次装配 base、web-app 和 man-roleplayer-app。无需复制原作者的 profile 或凭据补丁。

## 本地数据与隐私

默认数据目录为仓库内 `.local/dsh-home/`，包含首次生成的 profile、会话、设置等本地状态；`.local/` 必须保持在 Git 忽略范围。可用 `-DshHome '其他本地目录'` 指定独立目录，此时自行确保该目录不进入版本控制。启动器不将 API key 持久化；底座的设置或凭据管理功能与用户自行创建的文件仍须单独保管。

对话内容和所需人物上下文会发送至配置的模型服务。不要输入不应提供给该服务的敏感内容。源码交付不包含原开发环境的用户数据、真实密钥、浏览器状态、备份和归档；不要把这些文件加入 Git。

## 检查与开发

配置检查不监听端口、不调用模型，仍会在指定数据目录初始化 profile：

```powershell
.\start-man-roles.ps1 -DumpConfig -DshHome "$env:TEMP\man-roles-config-check"
```

配置输出只能证明组合后的配置可生成，不能证明真实 API 调用或浏览器交互成功。配置可能包含个人后续写入的设置，分享前自行检查。修改产品或底座后，在 `deepseek-harness/` 重新执行上述构建，再停止并重新启动原端口。测试入口见 [DSH 测试说明](deepseek-harness/docs/testing.md) 和 `deepseek-harness/apps/web/tests/man-roleplayer-*.e2e.ts`。

当前仍需由使用者在自己的机器和账户验证安装、真实模型请求、浏览器流程及长期运行；未提供生产部署、旧数据格式迁移或跨平台完整验收承诺。已有会话格式的兼容性遵循 DSH 当前版本规则，升级前自行保留需要的数据。

## 上游与许可

底座来自 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，版本来源与维护规则见 [SOURCE.md](SOURCE.md)。其源码与许可证保留在 `deepseek-harness/`。上游采用 MIT，见 [LICENSE](deepseek-harness/LICENSE)；vendored 代码和依赖须遵守各自保留的版权及许可证声明，见 [vendor 说明](deepseek-harness/vendor/README.md)。人物资料为项目整理材料，其中引用内容的权利仍归原权利人。
