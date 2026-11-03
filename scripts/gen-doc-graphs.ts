/**
 * Generate the relationship layer above the module, Cordis, and tool catalogs.
 * Enumerable facts come from source; hybrid graphs add manifests for policy the
 * source cannot infer, while curated graphs explain flow and ownership.
 * `--check` verifies the generated set.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import ts from 'typescript'
import { projectCordisCatalog } from '@deepseek-ai/dsh-typert-generator'
import { CORDIS_CATALOG_POLICY } from './gen-cordis-catalog.ts'
import type { EventEntry, ServiceEntry } from '@deepseek-ai/dsh-typert-generator'
import {
  collectPackageGraph,
  escapeMermaidLabel as escLabel,
  graphNodeId as nodeId,
  type PackageGraphNode,
} from './package-graph.ts'
import { TypeScriptProject } from './ts-project.ts'

import { documentationPath, relocateGeneratedDocument } from './documentation-paths.ts'

const root = resolve(import.meta.dirname, '..')
type Pkg = PackageGraphNode

interface GraphDoc {
  rel: string
  content: string
}

interface ServiceRole {
  key: string
  pkg: string
  title: string
  mode: 'core' | 'seam' | 'bundle'
  implementations?: string[]
  consumers?: string[]
  companions?: string[]
  note: string
}

interface ExamplePlugin {
  id: string
  name: string
}

interface EventRelation {
  dispatchers: Map<string, Set<string>>
  listeners: Set<string>
}

/** One scanned package source file and its owning package short name. */
export interface PackageSource {
  /** Repository-relative path. */
  rel: string
  /** Package short name from the `packages/<group>/<pkg>/src` path. */
  pkg: string
  /** The bound program source file. */
  sourceFile: ts.SourceFile
}

type EventReceiverKind = 'context' | 'agent-dispatch' | 'events-service'

const GROUP_ORDER = [
  'util',
  'attachment',
  'llm',
  'core',
  'typert',
  'goal',
  'experimental',
  'process',
  'bash',
  'pty',
  'sandbox',
  'e2b',
  'fs',
  'skill',
  'compact',
  'subagent',
  'tasks',
  'workflow',
  'web',
  'spill',
  'todo',
  'plan',
  'cordis',
  'hooks',
  'session-persistence',
  'session-query',
  'session-title',
  'telemetry',
  'storage',
  'workspace',
  'support',
  'acp',
  'ui',
]

const SERVICE_ROLES: ServiceRole[] = [
  {
    key: 'attachments',
    pkg: 'attachment',
    title: '持久二进制附件存储',
    mode: 'seam',
    implementations: ['attachment-local'],
    consumers: ['host-runtime', 'llm-pi-ai'],
    note: '宿主会在会话事件之前提交已接受的图片；提供方适配器将已授权的持久引用解析为提供方原生内容。',
  },
  {
    key: 'llm',
    pkg: 'llm',
    title: 'LLM 适配器注册表',
    mode: 'seam',
    implementations: ['llm-deepseek', 'llm-pi-ai', 'llm-replay'],
    consumers: ['agent-loop', 'compaction-basic'],
    note: '适配器注册提供方实现；agent loop（智能体循环）与压缩功能调用提供方无关的流服务。',
  },
  {
    key: 'tokenMeter',
    pkg: 'token-meter',
    title: '重放 Token 计量',
    mode: 'core',
    consumers: ['compaction-basic'],
    note: '拥有按会话隔离的回放折叠区；压力消费方共享不可变且带修订版本的测量结果。',
  },
  {
    key: 'toolResultPruner',
    pkg: 'compaction-tool-result-pruner',
    title: '无模型工具结果裁剪',
    mode: 'core',
    consumers: ['compaction-basic'],
    note: '在摘要压缩前，通过可回放的单节点表层替换来改写过大的当前工具结果。',
  },
  {
    key: 'sessions',
    pkg: 'session',
    title: '内存会话存储',
    mode: 'core',
    consumers: ['agent-loop', 'agent', 'session-persistence', 'session-query', 'session-query-sqlite', 'subagent-inprocess', 'invariants', 'message-feedback'],
    note: '拥有仅追加的 Session 实例，并发出持久的会话事件流。',
  },
  {
    key: 'invariants',
    pkg: 'invariants',
    title: '包所属不变量注册表',
    mode: 'core',
    consumers: ['session', 'agent', 'scope', 'agent-loop'],
    note: '配套子路径注册所属包本地的检查；该服务负责选择、唯一性、子 fiber，以及标明所属包的失败。',
  },
  {
    key: 'typert',
    pkg: 'typert-registry',
    title: '运行时类型注册表',
    mode: 'core',
    consumers: ['typert-loader', 'api-gateway'],
    note: '插件直接或通过 dsh-typert-loader 注册实时 zod 贡献；API 网关消费调用描述符和提供方，其他运行时消费方则在各自边界查询 schema 与反射元数据。',
  },
  {
    key: 'typertGateway',
    pkg: 'api-gateway',
    title: 'Typert Host 调用网关',
    mode: 'core',
    note: '将生成的 Remote 描述符与实时 Cordis 服务关联，解析已注册的身份，并通过共享的 Connection RPC 载体提供一元调用。',
  },
  {
    key: 'sessionPersistence',
    pkg: 'session-persistence',
    title: '持久会话存储边界',
    mode: 'seam',
    implementations: ['session-persistence-jsonl', 'session-persistence-sqlite'],
    consumers: ['agent-loop', 'tool-bash', 'hooks-claude-code', 'hooks-codex', 'session-query', 'session-query-sqlite', 'message-feedback'],
    note: '各后端持久化同一套 SessionEvent 词汇；应用在组合时选择后端。',
  },
  {
    key: 'settings',
    pkg: 'settings',
    title: '用户设置边界',
    mode: 'seam',
    implementations: ['settings-file'],
    consumers: ['llm-deepseek', 'llm-pi-ai', 'apiproxy'],
    note: '插件注册命名空间 schema 并解析分层值；提供方存储原始文档。LLM（大语言模型）适配器在用户分区下将其入口配置注册为组合基础；Web 网关提供经过脱敏的分层描述符，并写入用户层。',
  },
  {
    key: 'credentials',
    pkg: 'credentials',
    title: '凭据边界',
    mode: 'seam',
    implementations: ['credentials-local'],
    consumers: ['llm-deepseek', 'llm-pi-ai', 'apiproxy'],
    note: '配置携带对机密信息的引用；提供方拥有实际值。消费方按操作解析，因此轮换后的凭据会在紧接着的下一次请求中生效；Web 网关提供不含实际值的视图和只写存储。',
  },
  {
    key: 'authorization',
    pkg: 'authorization',
    title: '授权流程注册表',
    mode: 'seam',
    implementations: [],
    consumers: ['llm-pi-ai'],
    note: 'flow 由知道如何取得某份凭据的插件注册，并以其写入的记录为键；seam 拥有这段对话与"每个键同时只跑一次尝试"的生命周期，而非协议本身。',
  },
  {
    key: 'sessionTelemetry',
    pkg: 'session-telemetry',
    title: '会话遥测边界',
    mode: 'seam',
    implementations: ['session-telemetry-otel'],
    consumers: [],
    note: '该 seam 捕获会话记录、进行脱敏并交给一个后端；没有其他组件消费该服务，其输出会离开当前进程。',
  },
  {
    key: 'storage',
    pkg: 'storage',
    title: '会话外存储中心',
    mode: 'seam',
    implementations: ['storage-json', 'storage-sqlite'],
    consumers: ['storage-domain'],
    note: '各后端以不同名称并列注册；数据形态（领域优先）挂载到枢纽上，并将类型化操作转换为不透明的 KV 单元原语。',
  },
  {
    key: 'storageDomain',
    pkg: 'storage-domain',
    title: '领域数据能力',
    mode: 'core',
    consumers: ['workspace', 'message-feedback'],
    note: '等待所有已配置后端就绪，然后将领域形态发布为一个受生命周期约束的服务，用于类型化持久状态。',
  },
  {
    key: 'messageFeedback',
    pkg: 'message-feedback',
    title: '生命周期绑定的消息反馈',
    mode: 'core',
    note: '拥有本地逐 assistant 消息反馈、生命周期与目标校验、逐条目 compare-and-set 及 Host 一元 Remote 契约，且不进入 Session 历史或遥测。',
  },
  {
    key: 'manRoleplayer',
    pkg: 'man-roleplayer',
    title: '历史人物困惑领域',
    mode: 'core',
    consumers: ['man-roleplayer-app'],
    note: '在既有 Session 与持久化能力之上，负责持久产品事实、私有人物 Agent 执行、证据接受及删除检查点。',
  },
  {
    key: 'manRoleplayerRemote',
    pkg: 'man-roleplayer',
    title: '困惑浏览器 Remote 门面',
    mode: 'core',
    consumers: ['api-remotes', 'client-ui-man-roleplayer'],
    note: '将不透明浏览器句柄与稳定命令身份映射到产品领域，返回脱敏投影及类型化业务失败。',
  },
  {
    key: 'workspaceRegistry',
    pkg: 'workspace',
    title: '工作区实体注册表',
    mode: 'core',
    consumers: ['apiproxy'],
    note: '通过领域设施拥有带 WorkspaceId 品牌类型的记录；稳定的 sessionIds 账户驱动 Host RPC 与 GUI 投影。',
  },
  {
    key: 'sessionQuery',
    pkg: 'session-query',
    title: '会话读取、追踪、过滤与搜索',
    mode: 'seam',
    implementations: ['session-query-sqlite'],
    consumers: ['session-reference', 'tool-session-query'],
    note: '该接口提供精确读取、过滤和追踪；具体后端还提供全文协调、排序、摘要片段和游标世代，而模型消费方负责工作区权限与不含游标的渲染。',
  },
  {
    key: 'fileReferences',
    pkg: 'file-reference',
    title: '文件引用发现',
    mode: 'seam',
    implementations: ['file-reference-local'],
    note: '该接口通过其一元 Remote 契约返回指定 Agent cwd 内仅含路径的补全候选；提供方负责命名空间访问和排序，但不会读取文件内容。',
  },
  {
    key: 'sessionReferenceResolver',
    pkg: 'session-reference',
    title: '跨会话快照准备',
    mode: 'core',
    note: '将当前表层中有界的对话快照投影为持久但不可信的消息上下文；Host 适配器负责提及语法。',
  },
  {
    key: 'sessionTitle',
    pkg: 'session-title',
    title: '基于日志的会话标题',
    mode: 'seam',
    implementations: ['session-title-first-prompt-llm', 'session-title-all-prompts-llm'],
    note: '负责确定性回退、最新标题折叠区，以及唯一的可选异步提供方注册。',
  },
  {
    key: 'systemPrompt',
    pkg: 'system-prompt',
    title: '系统提示词组装注册表',
    mode: 'core',
    consumers: ['agent-loop', 'tools', 'tool-fs', 'tool-terminal', 'tool-web'],
    note: '为每个步骤收集提示词各部分和面向模型的工具 schema。',
  },
  {
    key: 'tools',
    pkg: 'tools',
    title: '工具注册与受保护执行流程',
    mode: 'core',
    consumers: ['agent-loop', 'tool-ask-user', 'tool-bash', 'tool-cordis', 'tool-fs', 'tool-terminal', 'tool-skill', 'tool-subagent', 'tool-todo', 'tool-web'],
    note: '注册能力，负责 Code Mode 传输，并让调用依次经过策略前处理、单调守卫、环绕分派、策略后处理和最终结果观测。',
  },
  {
    key: 'userQuestions',
    pkg: 'user-questions',
    title: '人类问答边界',
    mode: 'seam',
    consumers: ['tool-ask-user'],
    note: 'UI 前端提供当前生效的人工回答提供方；tool-ask-user 在提供方无关的 ask() promise 上暂停工具调用。',
  },
  {
    key: 'planMode',
    pkg: 'plan-mode',
    title: '计划协作状态',
    mode: 'core',
    note: '折叠已记录的计划／模式状态，在轮次边界刷新用户选择，渲染由部署方拥有的指导信息，注册 /plan，并在状态转换期间保持计划退出 schema 稳定。',
  },
  {
    key: 'agentPresets',
    pkg: 'agent-presets',
    title: '按会话装配 Agent',
    mode: 'core',
    note: '在受信任根目录与用户创作根目录上发现 preset 目录，并在创建期把一份 preset cordis.yml 挂载到 agent 作用域之下，拒绝始终未激活或向根服务 realm 发布服务的行。',
  },
  {
    key: 'commands',
    pkg: 'commands',
    title: '人类命令注册表',
    mode: 'core',
    note: '插件注册直接面向人的命令，而不会把调用发送给模型。',
  },
  {
    key: 'sessionProjections',
    pkg: 'session-projection',
    title: '会话投影单元',
    mode: 'core',
    consumers: ['tool-todo', 'session-title', 'host-apiproxy'],
    note: '各领域注册由状态驱动的折叠单元；主动驱动过程维护每个会话的水位状态，api-proxy 提供基线并推送发生变化的值。',
  },
  {
    key: 'sessionProjectionCache',
    pkg: 'session-projection-cache',
    title: '持久化投影缓存',
    mode: 'core',
    consumers: ['host-apiproxy'],
    note: '按会话持久保存投影单元状态的检查点（节流检查点，以及轮次／结束／分离时的必选检查点），并提供冷读取阶梯：缓存行加持久化尾部回放，因此列表读取永远不需要加载完整日志。',
  },
  {
    key: 'skills',
    pkg: 'skill',
    title: 'Skill 提供方注册表',
    mode: 'seam',
    implementations: ['skill-badge', 'skill-filesystem'],
    consumers: ['tool-skill'],
    note: '合并提供方的 skill（技能）目录；tool-skill 渲染会话前缀目录，并加载完整的 skill 正文。',
  },
  {
    key: 'agents',
    pkg: 'agent',
    title: 'Agent 服务',
    mode: 'core',
    consumers: ['agent-loop', 'acp', 'subagent-inprocess'],
    note: '拥有实时 Agent 句柄、创建／恢复工厂 seam，以及进程本地的发起方传播。',
  },
  {
    key: 'agentDefaultModel',
    pkg: 'agent-default-model',
    title: '默认 Agent 模型选择',
    mode: 'core',
    consumers: ['headless', 'host-apiproxy'],
    note: '通过 settings 分层默认 `ModelSelection`，让直接入口与 Host 支撑的 Agent 入口共享同一个状态所有者。',
  },
  {
    key: 'agentLoop',
    pkg: 'agent-loop',
    title: '具体循环驱动',
    mode: 'bundle',
    consumers: ['agent-spine-demo'],
    note: '唯一的具体循环插件；扩展包依赖 dsh-agent 的事件和服务，而不依赖此包。',
  },
  {
    key: 'goals',
    pkg: 'goal',
    title: '同会话目标领域',
    mode: 'core',
    note: '从会话日志折叠带修订版本的目标状态，并将实时延续激活保留在进程本地。',
  },
  {
    key: 'e2b',
    pkg: 'e2b',
    title: 'E2B 沙箱生命周期归属',
    mode: 'core',
    consumers: ['fs-e2b', 'subprocess-e2b'],
    note: '拥有一个共享的 E2B SDK 句柄、远程工作目录和最终沙箱处置，使两个基础 E2B 提供方处于同一个 Linux 运行时中。',
  },
  {
    key: 'subprocess',
    pkg: 'subprocess',
    title: '子进程边界',
    mode: 'seam',
    implementations: ['subprocess-local', 'subprocess-e2b'],
    consumers: ['bash-local', 'bash-sandbox', 'terminal-bash', 'lsp-stdio', 'subagent-acp', 'subagent-codex', 'subagent-claude-code'],
    note: 'Bash 执行器、PTY shell 后端、LSP Host，以及进程外 ACP、Codex 和 Claude Code subagent 后端都通过 ctx.subprocess 执行 spawn；该服务负责进程坐标、进程树／会话生命周期、stdio 处置、终端机制和 kill 升级。',
  },
  {
    key: 'shell',
    pkg: 'shell',
    title: 'Bash 执行器边界',
    mode: 'seam',
    implementations: ['bash-local', 'bash-sandbox', 'pwsh-local'],
    consumers: ['tool-bash', 'tool-pwsh', 'hooks-claude-code', 'hooks-codex'],
    note: '面向模型的 shell 工具和钩子桥接消费此 seam；沙箱、远程或 PowerShell 执行器可以替换 bash-local，而无需改动这些消费方。',
  },
  {
    key: 'shellEnv',
    pkg: 'shell-env',
    title: '托管 Bash 环境注册表',
    mode: 'core',
    consumers: ['tool-bash', 'tool-pwsh'],
    note: '插件声明限定于 effect 作用域的 DSH_* 事实；每个 shell 工具在每次执行时收集一份可信快照，其执行器据此重建命名空间。',
  },
  {
    key: 'terminals',
    pkg: 'terminal',
    title: '持久 PTY 会话注册表',
    mode: 'seam',
    implementations: ['terminal-bash'],
    consumers: ['tool-terminal'],
    note: '注册表负责精确到 Agent 的会话身份和清理；后端负责终端机制，tool-terminal 则提供限定于所有者作用域的模型接口。',
  },
  {
    key: 'sandbox',
    pkg: 'sandbox',
    title: '进程沙箱边界',
    mode: 'seam',
    implementations: ['sandbox-local'],
    consumers: ['bash-sandbox', 'terminal-bash'],
    note: '消费方交出即将执行 spawn 的确切 argv；与宿主共享文件系统和内核的后端按每次调用的策略包装该 argv，并报告强制执行情况。',
  },
  {
    key: 'sandboxPolicy',
    pkg: 'sandbox-policy',
    title: '沙箱策略归属',
    mode: 'core',
    implementations: [],
    consumers: ['bash-sandbox', 'fs-sandbox', 'terminal-bash'],
    note: '统一保存部署默认模式和工作区根目录；只有沙箱执行器和提供方读取该服务（工具层使用它同时导出的纯 `sandbox/mode` 折叠区）。两类强制执行组件都读取该服务，因此 bash 与 fs 不会限制到不同的根目录。',
  },
  {
    key: 'approval',
    pkg: 'approval',
    title: '审批边界',
    mode: 'seam',
    implementations: ['acp'],
    consumers: ['tools', 'tool-bash'],
    note: '一次性权限决策通过 `approval/request` waterfall（瀑布式事件）分派；回答方是监听器（即 ACP 为自身 agent 提供的桥接），没有回答方时以 `unavailable` 关闭失败。',
  },
  {
    key: 'permissionPresets',
    pkg: 'permission-presets',
    title: '权限预设',
    mode: 'core',
    implementations: [],
    note: '面向用户的预设表（`workspace-write`／`danger-full-access`），将沙箱模式与审批策略选项组合在一起；一次切换会写入一个 `permission/preset` 事件，并贯通到两个选项事件。',
  },
  {
    key: 'codeRuntime',
    pkg: 'code-runtime',
    title: '代码执行边界',
    mode: 'seam',
    implementations: ['code-runtime-worker'],
    consumers: ['tools'],
    note: '使用 Host 提供的异步绑定运行一段由模型编写的程序；各后端采用不同的基础环境和语言（工具注册表在 Code Mode 下消费该服务）。',
  },
  {
    key: 'fs',
    pkg: 'fs',
    title: '文件系统提供方边界',
    mode: 'seam',
    implementations: ['fs-local', 'fs-sandbox', 'fs-e2b'],
    consumers: ['tool-fs'],
    companions: ['fs-observation-policy'],
    note: 'tool-fs 通过 ctx.fs 执行读取／写入／编辑；fs-sandbox 按共享沙箱模式限制变更；fs-observation-policy 通过 fs/* 事件门禁贡献基于观测状态的检查。',
  },
  {
    key: 'compaction',
    pkg: 'compaction',
    title: '上下文压缩边界',
    mode: 'seam',
    implementations: ['compaction-basic'],
    consumers: ['compaction-basic'],
    note: '基础后端消费步骤后的压力事件和请求错误恢复事件；不存在面向模型的压缩工具。',
  },
  {
    key: 'subagents',
    pkg: 'subagent',
    title: '子 Agent 提供方与续接服务',
    mode: 'seam',
    implementations: ['subagent-spawn-in-process', 'subagent-fork-in-process', 'subagent-acp', 'subagent-codex', 'subagent-claude-code', 'subagent-dsh-sdk'],
    consumers: ['tool-subagent', 'tool-subagent-control', 'tool-ralph'],
    note: '提供方实现传输；该服务还负责可选的、基于 Activation 的延续编排，tool-subagent 选择一次性或可延续委派，tool-subagent-control 传递后续消息，而 tool-ralph 要求一条全新的结构化输出路由。',
  },
  {
    key: 'agentTeams',
    pkg: 'agent-team',
    title: 'Agent Teams 协调领域',
    mode: 'core',
    consumers: ['tool-agent-team'],
    note: '负责隐式 Root roster、持久 peer mailbox、共享任务 DAG 与 continuable child 生命周期；tool-agent-team 提供作用域化模型策略和控制工具。',
  },
  {
    key: 'jobs',
    pkg: 'jobs',
    title: '后台任务注册表',
    mode: 'seam',
    implementations: ['jobs-local'],
    consumers: ['tool-bash', 'tool-terminal', 'tool-subagent', 'tool-jobs'],
    note: '生产方（后台 bash、PTY 发送和 subagent 委派）登记正在运行的工作；tool-jobs 是面向模型的控制器，用于读取、列出和终止这些工作；jobs-local 是进程本地注册表。',
  },
  {
    key: 'web',
    pkg: 'web',
    title: 'Web 访问提供方注册表',
    mode: 'seam',
    implementations: ['web-search-exa', 'web-search-perplexity', 'web-search-deepseek', 'web-fetch-http'],
    consumers: ['tool-web'],
    note: '搜索和抓取提供方注册到同一个 ctx.web seam；tool-web 负责稳定的面向模型名称。',
  },
  {
    key: 'spillStore',
    pkg: 'spill',
    title: '溢出存储边界',
    mode: 'seam',
    implementations: ['spill-local'],
    consumers: ['spill-policy'],
    note: '后端保存过大的工具文本，并返回面向模型的定位信息和取回提示；spill-policy 是 tools/post-execute 消费方，负责决定何时 spill。',
  },
  {
    key: 'directoryPicker',
    pkg: 'directory-picker',
    title: '工作区目录选择边界',
    mode: 'seam',
    implementations: ['directory-picker-native', 'directory-picker-browse'],
    consumers: ['apiproxy'],
    note: '带判别标记的交互能力：原生后端在 Host 显示设备上打开一个操作系统选择器，浏览后端为应用内浏览器提供列表与创建原语；双端后端通过其浏览器侧填充 ui-workspace 目录流程的 slot（不通过协议发布）。',
  },
  {
    key: 'webServer',
    pkg: 'webserver',
    title: 'HTTP 路由注册',
    mode: 'core',
    consumers: ['connection', 'modules', 'hmr'],
    note: '普通的 node:http 载体：具名路由注册表、索引转换 tap，以及静态 dist 回退；Web 传输插件注册自己的路由。',
  },
  {
    key: 'clientModules',
    pkg: 'modules',
    title: '客户端插件图 Host',
    mode: 'core',
    consumers: ['hmr'],
    note: '通过增量 `dsh.client` 扫描组合 __DSH_BOOT__ 入口图，提供插件组合包，并通知重建／图变更订阅方。',
  },
  {
    key: 'workflowEngine',
    pkg: 'workflow',
    title: '工作流脚本引擎',
    mode: 'seam',
    implementations: ['workflow-worker-thread'],
    consumers: ['tool-workflow', 'tool-ralph'],
    note: '每个上下文使用一个引擎，与 bash 相同，且没有具名提供方注册表；通用工作流与固定 Ralph 消费方启动运行，其中的 agent() 调用通过 ctx.subagents 扇出。',
  },
  {
    key: 'lsp',
    pkg: 'lsp',
    title: '语言服务器导航边界',
    mode: 'seam',
    implementations: ['lsp-local'],
    consumers: ['tool-lsp'],
    note: '提供方注册与选择，加上恰好四种操作的标准化查询执行；该 seam 不提供协议逃生口，后端必须转换为标准化请求和结果。',
  },
  {
    key: 'apiProxy',
    pkg: 'apiproxy',
    title: 'Host API 分发',
    mode: 'core',
    consumers: ['connection'],
    note: '与传输无关的 Host 网关接口：它分派浏览器 API 调用，每条打开的 Host 流自行订阅转发事件，而不是由广播方法向其推送。',
  },
  {
    key: 'dynamicCordisRunner',
    pkg: 'cordis-host-runner',
    title: '动态 Cordis 包 Host 执行器',
    mode: 'core',
    consumers: ['tool-cordis'],
    note: '拥有内存定义注册表、Host 半的 vm 沙箱和 request-run 往返流程；浏览器页面通过其 Remote 命名空间在线访问同一服务。',
  },
  {
    key: 'cordisInspect',
    pkg: 'cordis-host-runner',
    title: '动态 Cordis 检查注册表',
    mode: 'core',
    consumers: ['tool-cordis'],
    note: '注册 Host inspect 提供方、镜像 Client 提供方 manifest，并通过动态 Cordis 传输路由 Client 查询。',
  },
]

function generatedHeader(title: string): string[] {
  const titles: Record<string, string> = {
    'Capability Seams And Core Services': '能力边界与核心服务',
    'Event Producer And Consumer Matrix': '事件发送与监听关系',
    'Agent Turn And Step Lifecycle': 'Agent 轮次与步骤生命周期',
    'Tool Execution Pipeline': '工具执行流程',
    'Documentation Graph Index': '文档图谱索引',
    'DSH Base Composition': 'DSH 基础装配',
    'Headless Agent Snapshot Composition': 'Headless Agent 快照装配',
    'ACP Automation App Composition': 'ACP 自动化应用装配',
  }
  return [
    '<!-- Generated by scripts/gen-doc-graphs.ts - do not edit by hand.',
    '     Run `pnpm run gen-doc-graphs` to regenerate. -->',
    '',
    `# ${titles[title] ?? title}`,
    '',
  ]
}

function maintenanceFooter(source: string): string[] {
  return [`维护方式：${source}。`, '']
}

function graphIndexLink(rel: string): string {
  return relative('docs', rel).replaceAll('\\', '/')
}

function linkFromDoc(docRel: string, targetRel: string): string {
  return relative(dirname(docRel), targetRel).replaceAll('\\', '/')
}

function mermaidCode(value: string): string {
  return `<code>${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`
}

function repoLink(path: string, label: string, up = '..'): string {
  return `[${label}](${up}/${path})`
}

function sourceLink(source: string, up = '..'): string {
  return repoLink(source.split(':')[0] ?? source, `\`${source}\``, up)
}

function pkgLink(pkg: Pkg | undefined, fallback: string, up = '..'): string {
  return pkg ? repoLink(pkg.rel, `\`${pkg.short}\``, up) : `\`${fallback}\``
}

function pkgList(names: string[] | undefined, pkgsByShort: Map<string, Pkg>): string {
  if (!names || names.length === 0) return '-'
  return names.map(name => pkgLink(pkgsByShort.get(name), name)).join(', ')
}

function tableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, '<br>')
}

function assertServiceRolesComplete(services: readonly ServiceEntry[]): void {
  const discovered = new Set(services.map(service => service.key))
  const classified = new Set(SERVICE_ROLES.map(role => role.key))
  const missing = [...discovered].filter(key => !classified.has(key)).sort()
  const stale = [...classified].filter(key => !discovered.has(key)).sort()
  if (missing.length || stale.length) {
    throw new Error([
      missing.length ? `missing service role classification: ${missing.join(', ')}` : '',
      stale.length ? `stale service role classification: ${stale.join(', ')}` : '',
    ].filter(Boolean).join('; '))
  }
}

function renderCapabilitySeams(pkgs: Pkg[], services: readonly ServiceEntry[]): string {
  assertServiceRolesComplete(services)
  const pkgsByShort = new Map(pkgs.map(pkg => [pkg.short, pkg]))
  const maintenance = '混合生成：从 Cordis 声明发现服务；接口、实现和使用方由 `scripts/gen-doc-graphs.ts` 分类并接受完整性检查'
  const nodes = new Map<string, string>()
  const edges = new Set<string>()
  const companionEdges = new Set<string>()
  const addNode = (id: string, label: string): void => {
    if (!nodes.has(id)) nodes.set(id, `  ${id}["${escLabel(label)}"]`)
  }
  const addEdge = (from: string, to: string): void => { edges.add(`  ${from} --> ${to}`) }
  const lines = generatedHeader('Capability Seams And Core Services')
  lines.push(
    '服务可以是核心主干服务、可替换的能力 seam，也可以是组合包／组合点。下图展示了拥有服务声明的包、已知实现包，以及直接消费该服务的包。',
    '',
    '```mermaid',
    'flowchart LR',
  )
  for (const role of SERVICE_ROLES) {
    const svc = nodeId('svc', role.key)
    const owner = nodeId('pkg', role.pkg)
    addNode(owner, role.pkg)
    addNode(svc, `ctx.${role.key}<br/>${role.title}`)
    addEdge(owner, svc)
    for (const impl of role.implementations ?? []) {
      addNode(nodeId('pkg', impl), impl)
      addEdge(nodeId('pkg', impl), svc)
    }
    for (const consumer of role.consumers ?? []) {
      addNode(nodeId('pkg', consumer), consumer)
      addEdge(svc, nodeId('pkg', consumer))
    }
    for (const companion of role.companions ?? []) {
      addNode(nodeId('pkg', companion), companion)
      companionEdges.add(`  ${svc} -. 事件协作 .-> ${nodeId('pkg', companion)}`)
    }
  }
  lines.push(...nodes.values(), ...[...edges].sort(), ...[...companionEdges].sort())
  lines.push('```', '', '| ctx 键 | 角色 | 所属包 | 实现 | 直接使用方 | 配套插件 | 说明 |', '| --- | --- | --- | --- | --- | --- | --- |')
  for (const role of SERVICE_ROLES) {
    lines.push(`| \`ctx.${role.key}\` | \`${role.mode}\` | ${pkgLink(pkgsByShort.get(role.pkg), role.pkg)} | ${pkgList(role.implementations, pkgsByShort)} | ${pkgList(role.consumers, pkgsByShort)} | ${pkgList(role.companions, pkgsByShort)} | ${tableCell(role.note)} |`)
  }
  lines.push('', ...maintenanceFooter(maintenance))
  return lines.join('\n')
}

function parseExampleCordis(rel: string): ExamplePlugin[] {
  const text = readFileSync(resolve(root, rel), 'utf8')
  const plugins: ExamplePlugin[] = []
  let current: { id: string; name?: string } | null = null
  const flush = (): void => {
    if (current?.name) plugins.push({ id: current.id, name: current.name })
  }
  for (const line of text.split('\n')) {
    // Top-level rows (`- id:`) and bundle-patch insert rows (`    - id:`).
    const id = /^\s*-\s+id:\s+(.+?)\s*$/.exec(line)
    if (id?.[1] !== undefined) {
      flush()
      current = { id: stripYamlScalar(id[1]) }
      continue
    }
    const name = /^\s+name:\s+(.+?)\s*$/.exec(line)
    if (name?.[1] !== undefined && current) current.name = stripYamlScalar(name[1])
  }
  flush()
  return plugins
}

function stripYamlScalar(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '')
}

const APP_EXAMPLES = [
  {
    id: 'dsh_base',
    rel: 'apps/cli/composition.md',
    title: 'DSH Base Composition',
    label: 'packages/bundle/base/cordis.patch.yml',
    config: 'packages/bundle/base/cordis.patch.yml',
    summary: '每个 profile 先应用 dsh-base 组合包补丁，再叠加 dsh-web-app、dsh-headless 等模式组合包和用户 profile 层。',
  },
  {
    id: 'headless',
    rel: 'examples/headless-agent/composition.md',
    title: 'Headless Agent Snapshot Composition',
    label: 'examples/headless-agent',
    config: 'examples/headless-agent/cordis.yml',
    summary: 'headless 快照组合装配真实 DeepSeek 适配器、编程能力与显式配置的持久顶层 Agent；JSONL 驱动仅用于测试。',
  },
  {
    id: 'acp',
    rel: 'examples/acp-agent/composition.md',
    title: 'ACP Automation App Composition',
    label: 'examples/acp-agent',
    config: 'examples/acp-agent/cordis.yml',
    summary: 'ACP 示例通过 JSON-RPC stdio 向程序客户端提供使用基准提示词的新会话，不装配 stdout 日志、人类界面或预建 Agent。',
  },
]

type AppExample = typeof APP_EXAMPLES[number]

function renderAppExpansion(lines: string[], appNode: string, pluginName: string): void {
  const agentCore = nodeId('bundle', 'agent_core')
  const jsonl = nodeId('bundle', 'jsonl')
  lines.push(`  ${appNode} --> ${agentCore}["@deepseek-ai/dsh-agent-spine-demo"]`)
  lines.push(`  ${appNode} --> ${jsonl}["@deepseek-ai/dsh-session-persistence-jsonl"]`)
  if (pluginName === '@deepseek-ai/dsh-acp-demo') {
    lines.push(`  ${appNode} --> ${nodeId('entrypoint', 'acp')}["@deepseek-ai/dsh-acp<br/>automation-only JSON-RPC stdio<br/>fresh sessions created by client"]`)
  }
  lines.push(
    `  ${agentCore} --> ${nodeId('spine', 'llm')}["ctx.llm"]`,
    `  ${agentCore} --> ${nodeId('spine', 'sessions')}["ctx.sessions"]`,
    `  ${agentCore} --> ${nodeId('spine', 'tools')}["ctx.tools + tool-bash"]`,
    `  ${agentCore} --> ${nodeId('spine', 'loop')}["ctx.agents + ctx.agentLoop"]`,
  )
}

function renderAppComposition(example: AppExample): string {
  const plugins = parseExampleCordis(example.config)
  const maintenance = '混合生成：叶子插件清单来自 `cordis.yml`，应用包展开由包源码维护'
  const lines = generatedHeader(example.title)
  lines.push(
    example.summary,
    '',
    '```mermaid',
    'flowchart LR',
    `  cfg["${escLabel(example.label)}<br/>cordis.yml"]`,
  )
  for (const plugin of plugins) {
    const pluginNode = nodeId(`plugin_${example.id}`, plugin.id)
    lines.push(`  ${pluginNode}["${escLabel(plugin.id)}<br/>${escLabel(plugin.name)}"]`)
    lines.push(`  cfg --> ${pluginNode}`)
    if (plugin.name === '@deepseek-ai/dsh-acp-demo') {
      renderAppExpansion(lines, pluginNode, plugin.name)
    }
  }
  lines.push(
    '```',
    '',
    '| 插件 id | 包或模块 |',
    '| --- | --- |',
    ...plugins.map(plugin => `| \`${plugin.id}\` | \`${plugin.name}\` |`),
    '',
    `源码配置：[\`${example.config}\`](${linkFromDoc(example.rel, example.config)}).`,
  )
  lines.push('', ...maintenanceFooter(maintenance))
  return lines.join('\n')
}

type CallSiteIndex = Map<ts.SignatureDeclaration | ts.JSDocSignature, ts.CallExpression[]>

/**
 * The only method names visitSource classifies; receiver typing runs on these
 * alone. Obligation: every method name matched by a branch inside visitSource
 * must appear here — the prefilter drops non-members before any branch runs,
 * so a branch for an unlisted name is silently dead.
 */
const EVENT_API_METHODS = new Set(['on', 'once', 'emit', 'parallel', 'serial', 'waterfall', 'dispatch'])

/**
 * Collect event dispatch/listener relations from real cross-file receiver types.
 *
 * TODO: the program is seeded from the host aggregate alone (ts-project.ts
 * documents why: one program cannot hold both faces' Context merges), so a
 * Client package enters only when a host file imports it. Client-face
 * listeners on client-face events are therefore under-reported —
   * `connection/reset` omits `ui-skill`/`ui-agent-preset`. Closing it needs a
   * second Client program whose relations merge into these, not a wider seed.
 */
export class EventRelationCollector {
  private readonly relations = new Map<string, EventRelation>()
  private readonly fileCallSites = new Map<ts.SourceFile, CallSiteIndex>()
  private readonly localCalleeProofs = new Map<ts.FunctionDeclaration, boolean>()
  private globalCallSites: CallSiteIndex | null = null
  private readonly contextType: ts.Type
  private readonly agentDispatchType: ts.Type
  private readonly eventsServiceType: ts.Type
  private readonly packageSourceFiles: ReadonlySet<ts.SourceFile>

  constructor(
    private readonly project: TypeScriptProject,
    private readonly sources: readonly PackageSource[],
  ) {
    this.contextType = this.declaredType('vendor/cordis/src/context.ts', 'Context')
    this.agentDispatchType = this.declaredType('packages/core/agent/src/dispatch.ts', 'AgentEventDispatch')
    this.eventsServiceType = this.declaredType('vendor/cordis/src/events.ts', 'EventsService')
    this.packageSourceFiles = new Set(sources.map(source => source.sourceFile))
  }

  /** Return all event relations discovered from the Program. */
  collect(): Map<string, EventRelation> {
    for (const source of this.sources) this.visitSource(source)
    return this.relations
  }

  /** Resolve one named class/interface declaration to its merged instance type. */
  private declaredType(relativePath: string, name: string): ts.Type {
    const sourceFile = this.project.sourceFile(relativePath)
    const declaration = sourceFile.statements.find((statement): statement is ts.ClassDeclaration | ts.InterfaceDeclaration => {
      return (ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement)) && statement.name?.text === name
    })
    const symbol = declaration?.name && this.project.checker.getSymbolAtLocation(declaration.name)
    if (!symbol) throw new Error(`cannot resolve TypeScript type ${name} from ${relativePath}`)
    return this.project.checker.getDeclaredTypeOfSymbol(symbol)
  }

  /** Index resolved function calls in the given files for narrow argument-flow recovery. */
  private buildCallSiteIndex(files: Iterable<ts.SourceFile>): CallSiteIndex {
    const index: CallSiteIndex = new Map()
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const declaration = this.project.checker.getResolvedSignature(node)?.declaration
        if (declaration) {
          const calls = index.get(declaration) ?? []
          calls.push(node)
          index.set(declaration, calls)
        }
      }
      ts.forEachChild(node, visit)
    }
    for (const file of files) visit(file)
    return index
  }

  /**
   * Return every indexed call resolving to one local helper declaration.
   * Fast path: when every same-file reference to the non-exported helper is
   * provably a direct callee, module scoping confines all of its calls to that
   * file, so only that file is indexed. Any other reference form may alias
   * the function value outward, so the original full package-source index
   * decides instead.
   */
  private callSitesFor(owner: ts.FunctionDeclaration): ts.CallExpression[] {
    if (!this.globalCallSites && !this.provenLocalCallee(owner)) {
      this.globalCallSites = this.buildCallSiteIndex(this.packageSourceFiles)
    }
    if (this.globalCallSites) return this.globalCallSites.get(owner) ?? []
    const file = owner.getSourceFile()
    let index = this.fileCallSites.get(file)
    if (!index) {
      index = this.buildCallSiteIndex([file])
      this.fileCallSites.set(file, index)
    }
    return index.get(owner) ?? []
  }

  /**
   * Prove every same-file reference to one helper is a direct callee. The
   * proof owns its premises: an exported helper or a helper in a global
   * script file (no import/export means program-wide scope, callable from
   * another file with no same-file reference at all) fails immediately.
   * Alias escapes (re-export statements, default exports, value reads)
   * resolve back to the owner symbol at a non-callee position and fail the
   * proof, as does anything the scan cannot positively classify.
   */
  private provenLocalCallee(owner: ts.FunctionDeclaration): boolean {
    const cached = this.localCalleeProofs.get(owner)
    if (cached !== undefined) return cached
    if (hasExportModifier(owner) || !ts.isExternalModule(owner.getSourceFile())) {
      this.localCalleeProofs.set(owner, false)
      return false
    }
    const name = owner.name
    const ownerSymbol = name && this.project.checker.getSymbolAtLocation(name)
    let proven = !!ownerSymbol
    const refersToOwner = (identifier: ts.Identifier): boolean => {
      // Shorthand properties resolve to the property symbol; ask for the value side.
      const local = ts.isShorthandPropertyAssignment(identifier.parent)
        ? this.project.checker.getShorthandAssignmentValueSymbol(identifier.parent)
        : this.project.checker.getSymbolAtLocation(identifier)
      if (!local) return false
      const symbol = local.flags & ts.SymbolFlags.Alias
        ? this.project.checker.getAliasedSymbol(local)
        : local
      return symbol === ownerSymbol
    }
    const visit = (node: ts.Node): void => {
      if (!proven) return
      if (ts.isIdentifier(node) && node !== name && node.text === name?.text
        && !isDirectCallee(node) && refersToOwner(node)) {
        proven = false
        return
      }
      ts.forEachChild(node, visit)
    }
    visit(owner.getSourceFile())
    this.localCalleeProofs.set(owner, proven)
    return proven
  }

  /** Walk one package source file and classify event API calls by receiver type. */
  private visitSource(source: PackageSource): void {
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        if (this.isAgentEventEmitter(node.expression)) {
          const event = node.arguments[2]
          if (event) {
            for (const name of this.finiteStringValues(event) ?? []) {
              this.addDispatcher(name, source.pkg, 'emitAgentEvent')
            }
          }
        } else if (ts.isPropertyAccessExpression(node.expression) && EVENT_API_METHODS.has(node.expression.name.text)) {
          const receiverKind = this.receiverKind(node.expression.expression)
          const method = node.expression.name.text
          if (receiverKind === 'events-service' && method === 'dispatch') {
            const argumentList = node.arguments[1]
            if (argumentList) {
              for (const event of this.eventNamesFromArgumentList(argumentList, new Set())) {
                this.addDispatcher(event, source.pkg, 'events.dispatch')
              }
            }
          } else if (receiverKind === 'context' || receiverKind === 'agent-dispatch') {
            const eventNames = this.eventNamesFromCall(node, receiverKind)
            if (method === 'on' || method === 'once') {
              for (const event of eventNames) this.ensure(event).listeners.add(source.pkg)
            } else if (method === 'emit' || method === 'parallel' || method === 'serial' || method === 'waterfall') {
              for (const event of eventNames) this.addDispatcher(event, source.pkg, method)
            }
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source.sourceFile)
  }

  /** Match the exported contained-notification helper by declaration identity. */
  private isAgentEventEmitter(expression: ts.Expression): boolean {
    if (!ts.isIdentifier(expression)) return false
    const local = this.project.checker.getSymbolAtLocation(expression)
    if (!local) return false
    const symbol = local.flags & ts.SymbolFlags.Alias
      ? this.project.checker.getAliasedSymbol(local)
      : local
    const declarations = symbol.declarations ?? []
    return declarations.some((declaration) => {
      return ts.isFunctionDeclaration(declaration)
        && declaration.name?.text === 'emitAgentEvent'
        && this.project.relativePath(declaration.getSourceFile()) === 'packages/core/agent/src/dispatch.ts'
    })
  }

  /** Classify a receiver using assignability to the repository's actual event API types. */
  private receiverKind(receiver: ts.Expression): EventReceiverKind | undefined {
    const type = this.project.checker.getTypeAtLocation(receiver)
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) return undefined
    if (this.project.checker.isTypeAssignableTo(type, this.eventsServiceType)) return 'events-service'
    if (this.project.checker.isTypeAssignableTo(type, this.contextType)) return 'context'
    if (this.project.checker.isTypeAssignableTo(type, this.agentDispatchType)) return 'agent-dispatch'
    return undefined
  }

  /** Resolve the event-name argument for Context and fused agent dispatch calls. */
  private eventNamesFromCall(call: ts.CallExpression, receiverKind: Exclude<EventReceiverKind, 'events-service'>): Set<string> {
    const candidates = receiverKind === 'context' ? call.arguments.slice(0, 2) : call.arguments.slice(0, 1)
    for (const candidate of candidates) {
      const values = this.finiteStringValues(candidate)
      if (values) return values
    }
    return new Set()
  }

  /** Recover the event slot from the argument array handed to EventsService.dispatch(). */
  private eventNamesFromArgumentList(expression: ts.Expression, seen: Set<ts.Node>): Set<string> {
    const current = unwrapExpression(expression)
    if (seen.has(current)) return new Set()
    seen.add(current)

    if (ts.isArrayLiteralExpression(current)) {
      for (const element of current.elements.slice(0, 2)) {
        if (ts.isOmittedExpression(element) || ts.isSpreadElement(element)) continue
        const values = this.finiteStringValues(element)
        if (values) return values
      }
      return new Set()
    }
    if (ts.isConditionalExpression(current)) {
      return unionSets(
        this.eventNamesFromArgumentList(current.whenTrue, new Set(seen)),
        this.eventNamesFromArgumentList(current.whenFalse, new Set(seen)),
      )
    }
    if (!ts.isIdentifier(current)) return new Set()

    const symbol = this.project.checker.getSymbolAtLocation(current)
    if (!symbol) return new Set()
    const events = new Set<string>()
    for (const declaration of symbol.declarations ?? []) {
      if (ts.isVariableDeclaration(declaration) && declaration.initializer && isConstDeclaration(declaration)) {
        addAll(events, this.eventNamesFromArgumentList(declaration.initializer, new Set(seen)))
      } else if (ts.isParameter(declaration)) {
        addAll(events, this.eventNamesFromParameter(declaration, seen))
      }
    }
    return events
  }

  /** Follow a non-exported local helper parameter back to every resolved call site. */
  private eventNamesFromParameter(parameter: ts.ParameterDeclaration, seen: Set<ts.Node>): Set<string> {
    const owner = parameter.parent
    if (!ts.isFunctionDeclaration(owner) || hasExportModifier(owner)) return new Set()
    const index = owner.parameters.indexOf(parameter)
    if (index < 0) return new Set()
    const events = new Set<string>()
    for (const call of this.callSitesFor(owner)) {
      const argument = call.arguments[index]
      if (argument) addAll(events, this.eventNamesFromArgumentList(argument, new Set(seen)))
    }
    return events
  }

  /** Return a finite string-literal value set, rejecting widened and generic strings. */
  private finiteStringValues(expression: ts.Expression): Set<string> | undefined {
    const current = unwrapExpression(expression)
    if (ts.isStringLiteralLike(current)) return new Set([current.text])
    if (this.isForwardedAgentEventParameter(current)) return undefined
    return finiteStringTypeValues(this.project.checker.getTypeAtLocation(current))
  }

  /** Reject the contextual parameter inside the AgentEventDispatch forwarding object. */
  private isForwardedAgentEventParameter(expression: ts.Expression): boolean {
    if (!ts.isIdentifier(expression)) return false
    const declarations = this.project.checker.getSymbolAtLocation(expression)?.declarations ?? []
    return declarations.some((declaration) => {
      if (!ts.isParameter(declaration)) return false
      const method = declaration.parent
      if (!ts.isMethodDeclaration(method) || !ts.isObjectLiteralExpression(method.parent)) return false
      const contextualType = this.project.checker.getContextualType(method.parent)
      return contextualType !== undefined
        && this.project.checker.isTypeAssignableTo(contextualType, this.agentDispatchType)
    })
  }

  /** Get or create one relation row. */
  private ensure(event: string): EventRelation {
    const existing = this.relations.get(event)
    if (existing) return existing
    const relation = { dispatchers: new Map<string, Set<string>>(), listeners: new Set<string>() }
    this.relations.set(event, relation)
    return relation
  }

  /** Add one dispatcher method without duplicating package/method labels. */
  private addDispatcher(event: string, pkg: string, method: string): void {
    const relation = this.ensure(event)
    const methods = relation.dispatchers.get(pkg) ?? new Set<string>()
    methods.add(method)
    relation.dispatchers.set(pkg, methods)
  }
}

/** Return whether an identifier is the callee of a call, seen through value-preserving wrappers. */
function isDirectCallee(identifier: ts.Identifier): boolean {
  let current: ts.Node = identifier
  while (
    ts.isParenthesizedExpression(current.parent)
    || ts.isAsExpression(current.parent)
    || ts.isTypeAssertionExpression(current.parent)
    || ts.isNonNullExpression(current.parent)
    || ts.isSatisfiesExpression(current.parent)
  ) {
    current = current.parent
  }
  return ts.isCallExpression(current.parent) && current.parent.expression === current
}

/** Peel syntax-only wrappers that do not change an expression's runtime value. */
function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression
  while (
    ts.isParenthesizedExpression(current)
    || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isNonNullExpression(current)
    || ts.isSatisfiesExpression(current)
  ) {
    current = current.expression
  }
  return current
}

/** Return every value only when a type is a closed string-literal union. */
function finiteStringTypeValues(type: ts.Type): Set<string> | undefined {
  if (type.flags & ts.TypeFlags.StringLiteral) {
    return new Set([(type as ts.StringLiteralType).value])
  }
  if (type.flags & ts.TypeFlags.Never) return new Set()
  if (!type.isUnion()) return undefined
  const values = new Set<string>()
  for (const member of type.types) {
    const memberValues = finiteStringTypeValues(member)
    if (!memberValues) return undefined
    addAll(values, memberValues)
  }
  return values
}

/** Return whether a variable declaration belongs to a const declaration list. */
function isConstDeclaration(declaration: ts.VariableDeclaration): boolean {
  return (declaration.parent.flags & ts.NodeFlags.Const) !== 0
}

/** Return whether a declaration is visible to callers outside its source module. */
function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node)?.some((modifier) => {
    return modifier.kind === ts.SyntaxKind.ExportKeyword || modifier.kind === ts.SyntaxKind.DefaultKeyword
  }) ?? false)
}

/** Add every member of source to target. */
function addAll<T>(target: Set<T>, source: ReadonlySet<T>): void {
  for (const value of source) target.add(value)
}

/** Return the union of two sets without mutating either input. */
function unionSets<T>(left: ReadonlySet<T>, right: ReadonlySet<T>): Set<T> {
  const out = new Set(left)
  addAll(out, right)
  return out
}

/**
 * Select the package source files of one project in deterministic order.
 * @param project - the loaded repository TypeScript project.
 * @returns `packages/<group>/<pkg>/src` files tagged with their package name.
 */
export function collectPackageSources(project: TypeScriptProject): PackageSource[] {
  return project.sourceFiles().flatMap((sourceFile): PackageSource[] => {
    const rel = project.relativePath(sourceFile)
    const match = /^packages\/[^/]+\/([^/]+)\/src\/.+\.ts$/.exec(rel)
    return match?.[1] ? [{ rel, pkg: match[1], sourceFile }] : []
  }).sort((left, right) => left.rel.localeCompare(right.rel))
}

function collectEventRelations(): Map<string, EventRelation> {
  const project = new TypeScriptProject(root)
  return new EventRelationCollector(project, collectPackageSources(project)).collect()
}

function relationPackages(map: Map<string, Set<string>>, pkgsByShort: Map<string, Pkg>): string {
  if (map.size === 0) return '-'
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pkg, methods]) => `${pkgLink(pkgsByShort.get(pkg), pkg)} (${[...methods].sort().map(m => `\`${m}\``).join(', ')})`)
    .join(', ')
}

function listenerPackages(listeners: Set<string>, pkgsByShort: Map<string, Pkg>): string {
  if (listeners.size === 0) return '-'
  return [...listeners].sort().map(pkg => pkgLink(pkgsByShort.get(pkg), pkg)).join(', ')
}

function renderEventRelations(pkgs: Pkg[], events: readonly EventEntry[]): string {
  const relations = collectEventRelations()
  const pkgsByShort = new Map(pkgs.map(pkg => [pkg.short, pkg]))
  const maintenance = '自动生成：从仓库 TypeScript Program 解析 Cordis 事件声明及发送、监听关系'
  const lines = generatedHeader('Event Producer And Consumer Matrix')
  lines.push(
    '本矩阵展示哪些包会派发各个 harness 自有事件，以及哪些包会监听这些事件。事件之间存在多对多关系，因此密集的关系数据以表格而非一张大型关系图呈现。接收方和事件名称类型还涵盖有意绕过 `ctx.emit` 的内含派发位置，例如 subagent 生命周期封装。',
    '',
    '| 事件 | 分发模式 | 声明位置 | 发送方 | 监听方 |',
    '| --- | --- | --- | --- | --- |',
  )
  for (const event of [...events].sort((a, b) => a.name.localeCompare(b.name))) {
    const relation = relations.get(event.name) ?? { dispatchers: new Map<string, Set<string>>(), listeners: new Set<string>() }
    lines.push(`| \`${event.name}\` | \`${event.mode}\` | ${sourceLink(event.source)} | ${relationPackages(relation.dispatchers, pkgsByShort)} | ${listenerPackages(relation.listeners, pkgsByShort)} |`)
  }
  // Every declared event needs a dispatcher: zero means dead vocabulary or an
  // unrecognized semantic dispatch form. Listener-free extension points remain
  // valid. Client-declared events are exempt: the relation scan seeds the HOST
  // aggregate program only (host+client cannot share one program — the cordis
  // Context merges collide), so client dispatch sites are structurally
  // invisible here; their rows stay in the table for the declarations' sake.
  const undispatched = [...events]
    .filter(event => !event.source.startsWith('packages/client/'))
    .filter(event => (relations.get(event.name)?.dispatchers.size ?? 0) === 0)
    .map(event => event.name)
    .sort()
  if (undispatched.length > 0) {
    throw new Error(
      `event-producer-consumer matrix: no dispatcher found for declared event${undispatched.length > 1 ? 's' : ''} `
      + `${undispatched.map(name => `"${name}"`).join(', ')} — dead vocabulary, or a dispatch form the semantic scan misses `
      + '(teach scripts/gen-doc-graphs.ts that form)',
    )
  }
  const declared = new Set(events.map(event => event.name))
  const extra = [...relations.keys()].filter(event => !declared.has(event)).sort()
  if (extra.length > 0) {
    lines.push('', '## 包源码中出现的非 harness 或未声明事件字符串', '', '| 事件字符串 | 发送方 | 监听方 |', '| --- | --- | --- |')
    for (const event of extra) {
      const relation = relations.get(event)
      if (!relation) continue
      lines.push(`| \`${event}\` | ${relationPackages(relation.dispatchers, pkgsByShort)} | ${listenerPackages(relation.listeners, pkgsByShort)} |`)
    }
  }
  lines.push('', ...maintenanceFooter(maintenance))
  return lines.join('\n')
}

function renderLifecycle(): string {
  const maintenance = '维护的 Mermaid 时序图；精确事件签名以生成的 Cordis 目录为准'
  return [
    ...generatedHeader('Agent Turn And Step Lifecycle'),
    '此时序图是 [architecture.md](architecture.zh.md#turn-flow) 的配套图示。持久的回放事实保存在 `session/event` 中，实时控制与状态则保存在 `agent/*` 中。',
    '',
    '```mermaid',
    'sequenceDiagram',
    '  participant User as 用户',
    '  participant Agent',
    '  participant Driver as 执行驱动',
    '  participant Hooks as 钩子监听器',
    '  participant Prompt as ctx.systemPrompt',
    '  participant LLM as ctx.llm',
    '  participant Tools as ctx.tools',
    '  participant Session',
    '  participant SDK as 界面或 SDK 监听器',
    '  User->>Agent: followup(content)',
    `  Agent-->>SDK: ${mermaidCode('agent/inbox/spliced')}`,
    `  Agent-->>SDK: ${mermaidCode('agent/inbox/inserted')} { message }`,
    '  Agent->>Driver: 排队任务唤醒驱动',
    `  Driver-->>SDK: ${mermaidCode('agent/status')} running`,
    `  Driver->>Session: ${mermaidCode('turn/start')}`,
    '  Note over Agent,Driver: 认领下一步骤输入及一个排队提示',
    `  Driver-->>SDK: ${mermaidCode('agent/inbox/spliced')} 纯删除`,
    `  Driver-->>SDK: ${mermaidCode('agent/inbox/claimed')} { message, turn } 逐条消息`,
    `  Driver->>Hooks: ${mermaidCode('agent/pre-step')} waterfall`,
    '  Hooks-->>Driver: 返回权威 reject 或 enter(messages) 决策',
    '  alt 候选步骤被拒绝或 pre-step 失败',
    '    Driver-->>Driver: 保持已认领批次移除，当前轮次不消耗步骤',
    '  else 进入候选步骤',
    `  Driver->>Session: ${mermaidCode('step/start')}`,
    `  Driver->>Session: ${mermaidCode('user/message')} 逐条已进入消息`,
    `  Driver->>Prompt: ${mermaidCode('system-prompt/assemble')} waterfall`,
    `  Driver->>LLM: ${mermaidCode('agent/request')} waterfall，随后 ${mermaidCode('llm/stream')} waterfall`,
    '  LLM-->>Driver: StreamChunk*',
    `  Driver->>Session: ${mermaidCode('assistant/chunk')}*`,
    `  Session-->>SDK: ${mermaidCode('session/event')} ${mermaidCode('assistant/chunk')}*`,
    '  alt 适配器终止或请求带内终止失败',
    `    Driver->>Session: ${mermaidCode('step/end')}`,
    `    Driver->>Hooks: ${mermaidCode('agent/request-error')} waterfall`,
    '    Hooks-->>Driver: 返回重试动作或保留原错误',
    '  else 模型请求成功',
    `  Driver->>Session: ${mermaidCode('assistant/message')}`,
    '  Driver->>Tools: 按 executionMode 分类待执行调用',
    '  loop 屏障与有界滚动池，启动前重新分类',
    '    opt 调用启动',
    `      Driver->>Session: ${mermaidCode('tool/call')}`,
    '      Driver->>Tools: 有序 pre，并发 execute',
    '      Tools-->>Session: 按需写入工具所属事件',
    '    end',
    '    opt 下一个模型顺序结果就绪',
    '      Driver->>Tools: 有序 post',
    `      Driver->>Session: ${mermaidCode('tool/result')}`,
    '    end',
    '  end',
    `  Driver->>Session: ${mermaidCode('step/end')}`,
    '  opt 自然停止且下一步骤收件箱为空',
    `    Driver->>Hooks: ${mermaidCode('agent/turn-stopping')} 串行终止检查点`,
    '  end',
    '  opt 存在下一步骤输入',
    '    Driver-->>Driver: 认领下一步骤输入',
    `    Driver-->>SDK: ${mermaidCode('agent/inbox/claimed')} { message, turn } 逐条消息`,
    `    Driver->>Hooks: ${mermaidCode('agent/pre-step')} waterfall`,
    '    Hooks-->>Driver: 返回权威 reject 或 enter(messages) 决策',
    '  end',
    '  end',
    '  end',
    `  Driver->>Session: ${mermaidCode('turn/end')}`,
    `  Driver-->>SDK: ${mermaidCode('agent/status')} idle`,
    '```',
    '',
    '`assistant/message` 事件会记录每次成功的提供方调用，包括返回空内容或以 `max-tokens` 结束的调用。空内容不会进入派生历史，但该持久事件仍会保留用量，并通过 `sourceEventSeqs` 精确列出对应的 `assistant/chunk` 事件，包括显式空列表。',
    '',
    '`dsh-compaction-basic` 在派生请求之前通过 `agent/pre-step` 处理压力，而 `agent/request-error` 仅用于规范的上下文溢出。任一触发条件满足后，系统都会先执行可选的工具结果剪枝，再选择摘要。恢复发生在失败步骤结束之后、失败轮次结束之前；只有当剪枝或摘要生成推进了 surface replacement generation 时，系统才会开启一个全新的重试轮次，否则仍以原始请求错误为准。',
    '',
    '以返回的 `agent/pre-step` 决策为准；通过包装 `next()` 的监听器会保留下游消息，除非有意替换这些消息。steering（中途引导）和注入的上下文在后续的认领操作取得其下一步骤批次后，会经过同一 waterfall（瀑布式事件）。',
    '',
    '需要可回放 transcript（文本记录）数据的 SDK 用户应当消费 `session/event`；`agent/*` 是用于队列与状态、提示词拦截、请求构造、steering、继续执行和错误处理的实时协调接口。',
    '',
    ...maintenanceFooter(maintenance),
  ].join('\n')
}

function renderToolPipeline(): string {
  const maintenance = '维护的 Mermaid 流程图；精确工具 Schema 与事件签名以生成目录为准'
  return [
    ...generatedHeader('Tool Execution Pipeline'),
    '此图展示策略、钩子、沙箱、文件系统守卫、结果重写、最终结果观察和 UI 渲染在不改变循环的情况下何时运行。`tools/pre-execute` waterfall（瀑布式事件）首先运行，随后是单调守卫，然后运行 `tools/execute` 和 `tools/post-execute` waterfall；这三个 waterfall 可以改写一次调用。由定义自身控制的 `finalizeContent` 和 `tools/result` 在此之后运行。',
    '',
    '```mermaid',
    'flowchart TD',
    '  model["助手消息包含 tool-call 块"]',
    `  toolCall["会话事件： ${mermaidCode('tool/call')}<br/>执行前记录"]`,
    '  presentCall["界面待处理卡片<br/>presentCall(args)"]',
    `  pre["${mermaidCode('tools/pre-execute')} waterfall<br/>钩子、权限与沙箱"]`,
    '  guards["已注册的单调守卫<br/>拒绝或弃权；保护调用身份"]',
    '  denied["策略拒绝或审批拒绝<br/>跳过工具体"]',
    `  approval["${mermaidCode('ctx.approval')} 单次审批请求<br/>缺失或无法回答时拒绝"]`,
    `  around["${mermaidCode('tools/execute')} waterfall<br/>分发外围的超时、重试与指标"]`,
    '  toolBody["已注册工具的 execute() 体"]',
    `  fsGate["${mermaidCode('fs/write-intent')} or ${mermaidCode('fs/edit-intent')}<br/>仅限 tool-fs 变更"]`,
    `  owned["工具所属会话事件<br/>${mermaidCode('todo/write')}, ${mermaidCode('fs/observed')}, ${mermaidCode('hook/invoked')}, ${mermaidCode('hook/result')}, ${mermaidCode('tool/code-dispatch')}"]`,
    `  post["${mermaidCode('tools/post-execute')} waterfall<br/>接受、阻止、替换或补充上下文"]`,
    '  normalized["注册表外围规范化<br/>流水线或结果快照异常转成 isError"]',
    '  finalize["ToolDefinition.finalizeContent<br/>最后的仅内容不变量"]',
    `  final["${mermaidCode('tools/result')} 同步通知<br/>冻结的权威结果"]`,
    '  context["当前批次 additionalContexts FIFO<br/>已记录工具结果后注入 user/message"]',
    `  toolResult["会话事件： ${mermaidCode('tool/result')}<br/>单一模型可见结果"]`,
    '  allResults["工具批次已收敛<br/>tool/result 事件已完整记录"]',
    '  presentResult["界面完成卡片<br/>presentResult(args, result)"]',
    '  model --> toolCall',
    '  toolCall --> presentCall',
    '  toolCall --> pre',
    '  pre -->|allow| guards',
    '  guards -->|allow| around',
    '  guards -->|deny| denied',
    '  guards -.->|throw| normalized',
    '  around --> toolBody',
    '  pre -->|deny| denied',
    '  pre -->|ask| approval',
    '  approval -->|本次允许| guards',
    '  approval -->|拒绝、取消或不可用| denied',
    '  approval -.->|throw| normalized',
    '  denied --> post',
    '  pre -.->|throw| normalized',
    '  toolBody --> fsGate',
    '  fsGate --> toolBody',
    '  toolBody --> owned',
    '  toolBody --> around',
    '  around --> post',
    '  around -.->|包装器抛错| normalized',
    '  post -.->|throw| normalized',
    '  post --> finalize',
    '  normalized --> finalize',
    '  finalize --> final',
    '  final --> toolResult',
    '  toolResult --> presentResult',
    '  toolResult --> allResults',
    '  allResults --> context',
    '```',
    '',
    '文件系统的先读后编辑检查位于 `tool-fs` 之下，通过 `fs/*` 事件实现。通用的前置／后置 waterfall 承载钩子与审批策略；`ctx.approval` 在单调守卫之前处理询问，而不得重新排序的所有者策略仍作为已注册的守卫。超时等环绕分发关注点对 `tools/execute` 进行包装。注册表会对候选结果进行无损快照；如果快照失败，则会先将失败规范化，之后再由可见定义中已随快照固定的 `finalizeContent` 回调强制执行其同步且仅限内容的不变式。随后，`tools/result` 会观察不可变、可由 JSON 无损表示的结果。这样一来，钩子便可跨越不同工具系列，而无需让工具与某个策略服务耦合。Code Mode 会将保留的 `run_code` 传输及其序列化子调用都送入流水线；子调用携带父级 token、记录 `tool/code-dispatch`、将拒绝呈现为具有约束力的驳回，并省略 `additionalContexts`，以保持调用与结果相邻。',
    '',
    ...maintenanceFooter(maintenance),
  ].join('\n')
}

function renderDocs(): GraphDoc[] {
  const pkgs = collectPackageGraph(root, GROUP_ORDER, 'gen-doc-graphs')
  const { model } = projectCordisCatalog(root, CORDIS_CATALOG_POLICY)
  const docs: GraphDoc[] = [
    { rel: 'docs/capability-seams.md', content: renderCapabilitySeams(pkgs, model.services) },
    ...APP_EXAMPLES.map(example => ({ rel: example.rel, content: renderAppComposition(example) })),
    { rel: 'docs/event-producer-consumer.md', content: renderEventRelations(pkgs, model.events) },
    { rel: 'docs/agent-lifecycle.md', content: renderLifecycle() },
    { rel: 'docs/tool-execution-pipeline.md', content: renderToolPipeline() },
  ]
  docs.unshift({ rel: 'docs/graph-atlas.md', content: renderIndex(docs) })
  return docs.map(({ rel, content }) => ({ rel: documentationPath(rel), content: relocateGeneratedDocument(content, rel) }))
}

function renderIndex(docs: GraphDoc[]): string {
  const labels: Record<string, string> = {
    'docs/capability-seams.md': '能力边界与核心服务',
    'apps/cli/composition.md': 'DSH 共享基础装配',
    'examples/headless-agent/composition.md': 'headless-agent 应用装配',
    'examples/cordis-agent/composition.md': 'cordis-agent 应用装配',
    'examples/acp-agent/composition.md': 'acp-agent 应用装配',
    'docs/event-producer-consumer.md': '事件发送与监听关系',
    'docs/agent-lifecycle.md': 'Agent 轮次与步骤生命周期',
    'docs/tool-execution-pipeline.md': '工具执行流程',
  }
  const modes: Record<string, string> = {
    'docs/capability-seams.md': '混合生成',
    'apps/cli/composition.md': '混合生成',
    'examples/headless-agent/composition.md': '混合生成',
    'examples/cordis-agent/composition.md': '混合生成',
    'examples/acp-agent/composition.md': '混合生成',
    'docs/event-producer-consumer.md': '混合生成',
    'docs/agent-lifecycle.md': '人工维护',
    'docs/tool-execution-pipeline.md': '人工维护',
  }
  const rows = [
    '| [模块依赖图](module-graph.md) | `自动生成` |',
    '| [工具 Schema 目录与包映射](tool-catalog.md) | `自动生成` |',
    ...docs.map((doc) => {
      const link = graphIndexLink(doc.rel)
      return `| [${labels[doc.rel] ?? link}](${link}) | \`${modes[doc.rel] ?? '自动生成'}\` |`
    }),
  ]
  const maintenance = '各页面分别声明自动生成、混合生成或人工维护方式'
  return [
    ...generatedHeader('Documentation Graph Index'),
    '这些图展示生成目录未包含的关系。可以用它们查找包之间的关系、能力 seam、事件流、面向模型的工具、应用组合和运行时生命周期路径。精确签名和类型定义仍以[子系统页面](subsystems/core.zh.md)（类型和生成的 `cordis-surface` 区域）及[工具目录](tool-catalog.zh.md)为准。',
    '',
    '本索引背后的流程决策记录在[文档图 Agent Note](../.agents/notes/archived/process/2026-07-03-documentation-graph-atlas.md)中。',
    '',
    '| 图谱 | 维护方式 |',
    '| --- | --- |',
    ...rows,
    '',
    '运行 `pnpm run gen-doc-graphs` 生成本页，运行 `pnpm run verify-doc-graphs` 验证新鲜度。每个主题仅维护一份规范正文。',
    '',
    ...maintenanceFooter(maintenance),
  ].join('\n')
}

function main(): void {
  const docs = renderDocs()
  if (process.argv.includes('--check')) {
    const stale: string[] = []
    for (const doc of docs) {
      const abs = resolve(root, doc.rel)
      const committed = existsSync(abs) ? readFileSync(abs, 'utf8') : null
      if (committed !== doc.content) stale.push(doc.rel)
    }
    if (stale.length === 0) {
      console.log(`gen-doc-graphs: ${docs.length} graph doc(s) are up to date.`)
      return
    }
    console.error(`gen-doc-graphs: stale graph doc(s): ${stale.join(', ')}. Run \`pnpm run gen-doc-graphs\` and commit the result.`)
    process.exit(1)
  }

  for (const doc of docs) {
    mkdirSync(dirname(resolve(root, doc.rel)), { recursive: true })
    writeFileSync(resolve(root, doc.rel), doc.content)
  }
  console.log(`gen-doc-graphs: wrote ${docs.length} graph doc(s).`)
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  main()
}
