# 向古人问惑 · Man-roles

[English](README.md) | 中文

基于 DeepSeek Harness 的本地历史人物对话原型。选择王阳明、曾国藩、庄子、苏轼或朱熹，围绕自己的困惑展开对话；人物资料和 preset 共同约束角色表达。回答由模型生成，不能视为历史人物原话或专业意见。

本仓库是统一工程根目录。后续直接在此继续开发；安装、构建与测试均从本目录执行。

## 产品源码

| 路径 | 职责 |
| --- | --- |
| `packages/extensions/man-roleplayer/` | 产品领域、会话生命周期和人物 preset |
| `packages/client/ui-man-roleplayer/` | 浏览器界面与交互控制 |
| `packages/bundle/man-roleplayer-app/` | 产品 profile 与模块装配 |
| `research/调研成果-*.md` | 五位人物的资料 |
| `apps/`、其他 `packages/`、`scripts/` | 共用的 DSH 底座、工具与测试 |
| `start-man-roles.ps1` / `.cmd` | Windows 本地启动入口 |

## 安装与构建

需要 Windows PowerShell、Node.js `^22.19.0 || >=24.0.0` 和 pnpm `11.7.0`，以根目录 `package.json` 为准。依赖安装需要网络。在仓库根目录执行，并等待每一步成功：

```powershell
pnpm install --frozen-lockfile
pnpm run build
```

安装或构建失败时先处理错误，再启动。锁文件固定依赖解析；平台与原生依赖支持仍须在自己的机器验证。

## 启动

在当前 PowerShell 进程设置自己的 API key：

```powershell
$env:DEEPSEEK_API_KEY = '<YOUR_DEEPSEEK_API_KEY>'
.\start-man-roles.ps1
```

也可在已设置环境变量的命令行执行 `start-man-roles.cmd`。不要提交真实密钥。默认 Provider 为 `deepseek-official`，模型为 `deepseek-v4-flash`；账户须支持所选模型，API 调用可能产生费用。可通过 `-Model` 选择其他受支持模型，底座适配器还读取可选的 `DEEPSEEK_BASE_URL`。

启动器绑定 `http://127.0.0.1:3085/`，前台运行，按 Ctrl+C 停止。端口占用会报错，不会停止其他进程。

```powershell
.\start-man-roles.ps1 -NoOpen
.\start-man-roles.ps1 -Port 3086 -Model 'deepseek-v4-flash'
```

源码、preset 与资料均相对本根目录定位。首次启动由 DSH 创建 `man-roles-mvp-web` profile，装配 base、web-app 和 man-roleplayer-app。请使用空数据目录和自己的凭据；本仓库不携带原开发环境的用户 profile、设置、对话或运行数据库。

## 本地数据与隐私

默认数据目录为 `.local/dsh-home/`，保存生成的 profile、会话和设置。保持 `.local/` 在 Git 忽略范围内。`-DshHome '其他本地目录'` 可选择独立位置；自定义目录须另外确保不进入版本控制。启动器不持久化 API key；底座凭据、设置功能和自行创建的文件仍须妥善保管。

对话文本和所需人物上下文会发送给配置的模型服务，不要输入不应提供给该服务的敏感内容。`.gitignore` 只保护匹配的未跟踪路径，无法清除已跟踪内容或历史提交；新 fixture 和截图仍须审查隐私内容。本仓库不携带原环境的凭据、浏览器状态、备份或私人工作记录。

## 检查与开发

配置检查不监听端口、不调用模型，但会在指定数据目录初始化 profile：

```powershell
.\start-man-roles.ps1 -DumpConfig -DshHome "$env:TEMP\man-roles-config-check"
```

这只能证明配置可装配。后续个人设置可能出现在输出中，分享前须检查。修改产品或底座代码后，在本根目录重新构建，再重启原验收端口。

从本根目录运行相关测试，参见[测试说明](docs/testing.zh.md)和 `apps/web/tests/man-roleplayer-*.e2e.ts`。`pnpm test` 执行单元测试；浏览器测试的独立配置和前置条件见该说明。两种语言 README 做等价修改后，运行 `pnpm run verify-translation-pairing --write README.md`。

安装、真实模型调用、浏览器流程和长期运行仍须在使用者环境中验证。本次源码交付不代表生产部署、旧数据迁移或跨平台完整验收。

## 来源与许可

修改仓库布局或 `.gitignore` 后，提交前运行 `node scripts/verify-publish-ignore.mjs`。它检查应排除和应提交的路径，并报告与忽略规则冲突的已跟踪文件；实际暂存内容仍需单独审查私人信息。

底座来自 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，来源与维护边界见 [SOURCE.md](SOURCE.md)。原版权声明、[MIT 许可证](LICENSE)、[vendor 声明](vendor/README.md)及适用的第三方许可证均保留。人物资料为项目整理材料，引用内容的权利仍归原权利人。
