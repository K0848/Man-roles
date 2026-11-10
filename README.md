# 向古人问惑 · Man-roles

本文件是产品的主要维护入口；中文使用说明直接维护在此，不要求英文镜像。

基于 DeepSeek Harness 的本地历史人物对话原型。选择王阳明、曾国藩、庄子、苏轼或朱熹，围绕自己的困惑展开对话；人物资料和 preset 共同约束角色表达。回答由模型生成，不能视为历史人物原话或专业意见。

本仓库是统一工程根目录。后续直接在此继续开发；安装、构建与测试均从本目录执行。

<a id="product-source"></a>

## 产品源码

| 路径 | 职责 |
| --- | --- |
| [packages/extensions/man-roleplayer/](packages/extensions/man-roleplayer/) | 产品领域、会话生命周期和人物 preset |
| [packages/client/ui-man-roleplayer/](packages/client/ui-man-roleplayer/) | 浏览器界面与交互控制 |
| [packages/bundle/man-roleplayer-app/](packages/bundle/man-roleplayer-app/) | 产品 profile 与模块装配 |
| [research/](research/) | 五位人物的正式运行资料 |
| `apps/`、其他 `packages/`、`scripts/` | 共用的 DSH 底座、工具与测试 |
| [start-man-roles.cmd](start-man-roles.cmd) | Windows 本地启动入口，实现位于 [scripts/start-man-roles.ps1](scripts/start-man-roles.ps1) |

<a id="run-from-source"></a>

<a id="install-and-build"></a>

## 安装与构建

需要 Git、Windows PowerShell、Node.js `^22.19.0 || >=24.0.0` 和 pnpm `11.7.0`，版本约束以根目录 `package.json` 为准。推荐保留 Git 元数据获取源码：

```powershell
git clone https://github.com/K0848/Man-roles.git
cd Man-roles
```

构建读取源码提交信息。若使用 ZIP 或不含 `.git` 的源码副本，先按该副本的真实来源提交 SHA 设置 `DSH_CLIENT_COMMIT_HASH`；不要填随机值、占位 SHA 或与该源码不符的旧提交。Git checkout 可用 `git rev-parse HEAD` 查询真实提交，ZIP 接收者应使用提供者注明的来源 SHA。此值是公开构建元数据，不是私人凭据。设置后再执行下面的安装和构建。

依赖安装需要网络。在仓库根目录执行，并等待每一步成功：

```powershell
pnpm install --frozen-lockfile
pnpm run build
```

安装或构建失败时先处理错误，再启动。锁文件固定依赖解析；平台与原生依赖支持仍须在自己的机器验证。

<a id="run"></a>

## 启动

在当前 PowerShell 进程设置自己的 API key：

```powershell
$env:DEEPSEEK_API_KEY = '<YOUR_DEEPSEEK_API_KEY>'
.\start-man-roles.cmd
```

默认使用 `start-man-roles.cmd` 作为 Windows 入口，参数会传给 `scripts/start-man-roles.ps1`。不要提交真实密钥。默认 Provider 为 `deepseek-official`，模型为 `deepseek-v4-flash`；账户须支持所选模型，API 调用可能产生费用。可通过 `-Model` 选择其他受支持模型，底座适配器还读取可选的 `DEEPSEEK_BASE_URL`。

启动器绑定 `http://127.0.0.1:3085/`，前台运行，按 Ctrl+C 停止。普通启动复用已核验的同产品服务；其他进程占用端口时会报错。`-Update` 先构建，成功后再次核验并仅重启原产品进程；构建失败时保留正在运行的服务。

```powershell
.\start-man-roles.cmd -NoOpen
.\start-man-roles.cmd -Update -NoOpen
.\start-man-roles.cmd -Port 3086 -Model 'deepseek-v4-flash'
```

源码、preset 与资料均相对本根目录定位。首次启动由 DSH 创建 `man-roles-mvp-web` profile，装配 base、web-app 和 man-roleplayer-app。请使用空数据目录和自己的凭据；本仓库不携带原开发环境的用户 profile、设置、对话或运行数据库。

<a id="local-data-and-privacy"></a>

## 本地数据与隐私

默认数据目录为 `.local/dsh-home/`，保存生成的 profile、会话和设置。保持 `.local/` 在 Git 忽略范围内。`-DshHome '其他本地目录'` 可选择独立位置；自定义目录须另外确保不进入版本控制。启动器不持久化 API key；底座凭据、设置功能和自行创建的文件仍须妥善保管。

可选的 `.local/launch.json` 保存本机 `Port`、`Provider`、`Model`、`DshHome` 和 `CredentialPatch` 绑定；显式参数优先于本地文件，本地文件优先于默认值。文件中的相对路径以工程根为起点。`CredentialPatch` 指向本机凭据补丁，空值可禁用补丁。本地配置和真实补丁不进入源码交付，接收者使用自己的凭据与数据。`.private/` 保存内部工作资料，`.claude/` 保存本地任务台账，两者均排除 Git 和源码交付。

对话文本和所需人物上下文会发送给配置的模型服务，不要输入不应提供给该服务的敏感内容。`.gitignore` 只保护匹配的未跟踪路径，无法清除已跟踪内容或历史提交；新 fixture 和截图仍须审查隐私内容。本仓库不携带原环境的凭据、浏览器状态、备份或私人工作记录。

<a id="checks-and-development"></a>

## 检查与开发

修改产品或底座代码后，在本根目录重新构建，再用 `start-man-roles.cmd -Update` 更新原验收入口。

从本根目录运行相关测试，参见[测试说明](docs/development/testing.md)和 `apps/web/tests/man-roleplayer-*.e2e.ts`。`pnpm test` 执行单元测试；浏览器测试的独立配置和前置条件见该说明。文档修改按实际范围检查格式、链接和事实，不需要语言配对或回录。

安装、真实模型调用、浏览器流程和长期运行仍须在使用者环境中验证。本次源码交付不代表生产部署、旧数据迁移或跨平台完整验收。

<a id="origin-and-license"></a>

## 来源与许可

修改仓库布局或 `.gitignore` 后，提交前运行 `node scripts/verify-publish-ignore.mjs`。它检查应排除和应提交的路径，并报告与忽略规则冲突的已跟踪文件；实际暂存内容仍需单独审查私人信息。

底座来自 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，来源与维护边界见[源码来源](docs/reference/upstream/SOURCE.md)。原版权声明、[MIT 许可证](LICENSE)、[第三方声明](docs/legal/THIRD_PARTY_NOTICES.md)、[vendor 声明](vendor/README.md)及适用的第三方许可证均保留。人物资料为项目整理材料，引用内容的权利仍归原权利人。
