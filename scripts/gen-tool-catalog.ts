/**
 * Generate `docs/tool-catalog.md` from schemas collected by booting each tool
 * plugin. Runtime registration is the source of truth for computed schemas;
 * the manifest is checked against every on-disk `tool-*` package. `--check`
 * verifies the committed artifact. Rationale and ownership live in
 * `.agents/notes/implemented/process/2026-07-02-tool-schema-catalog.md`.
 */

import { globSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { ToolSchema } from '@deepseek-ai/dsh-llm'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createScope } from '@deepseek-ai/dsh-scope'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SqliteSessionQueryEngine from '@deepseek-ai/dsh-session-query-sqlite'
import GoalService from '@deepseek-ai/dsh-goal'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { type Config as ToolsConfig } from '@deepseek-ai/dsh-tools'
import LocalBashExecutor from '@deepseek-ai/dsh-bash-local'
import * as BashEnvPlugin from '@deepseek-ai/dsh-shell-env'
import { PwshLocalExecutor } from '@deepseek-ai/dsh-pwsh-local'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentLimits, ImageAttachmentRef, SaveImageAttachment, StoredImageAttachment } from '@deepseek-ai/dsh-attachment'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import PlanModeController from '@deepseek-ai/dsh-plan-mode'
import WebRuntime from '@deepseek-ai/dsh-web'
import * as WebSearchExa from '@deepseek-ai/dsh-web-search-exa'
import * as WebFetchLocal from '@deepseek-ai/dsh-web-fetch-http'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import type { SubagentProvider, SubagentReportDelivery } from '@deepseek-ai/dsh-subagent'
import * as ToolSubagentControl from '@deepseek-ai/dsh-tool-subagent-control'
import * as ToolSubagentListAgents from '@deepseek-ai/dsh-tool-subagent-control/list-agents'
import * as ToolSubagentReport from '@deepseek-ai/dsh-tool-subagent-report'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import * as SkillFileSystem from '@deepseek-ai/dsh-skill-filesystem'
import LocalJobRegistry from '@deepseek-ai/dsh-jobs-local'
import * as ToolAskUser from '@deepseek-ai/dsh-tool-ask-user'
import * as ToolBash from '@deepseek-ai/dsh-tool-bash'
import * as ToolPwsh from '@deepseek-ai/dsh-tool-pwsh'
import * as ToolBashPersistent from '@deepseek-ai/dsh-tool-bash-persistent'
import * as ToolPwshPersistent from '@deepseek-ai/dsh-tool-pwsh-persistent'
import CordisHostRunner from '@deepseek-ai/dsh-cordis-host-runner'
import * as ToolCordis from '@deepseek-ai/dsh-tool-cordis'
import * as ToolFs from '@deepseek-ai/dsh-tool-fs'
import * as ToolFsSearch from '@deepseek-ai/dsh-tool-fs-search'
import * as ToolStrReplaceEditor from '@deepseek-ai/dsh-tool-str-replace-editor'
import TerminalSessionService from '@deepseek-ai/dsh-terminal'
import * as ToolPty from '@deepseek-ai/dsh-tool-terminal'
import * as ToolGoal from '@deepseek-ai/dsh-tool-goal'
import * as ToolSchedule from '@deepseek-ai/dsh-schedule'
import Lsp from '@deepseek-ai/dsh-lsp'
import * as ToolLsp from '@deepseek-ai/dsh-tool-lsp'
import * as ToolSkill from '@deepseek-ai/dsh-tool-skill'
import * as ToolSessionQuery from '@deepseek-ai/dsh-tool-session-query'
import * as ToolTasks from '@deepseek-ai/dsh-tool-jobs'
import type TeamService from '@deepseek-ai/dsh-experimental-agent-team'
import * as ToolTeam from '@deepseek-ai/dsh-experimental-tool-agent-team'
import * as ToolTodo from '@deepseek-ai/dsh-tool-todo'
import * as ToolSubagent from '@deepseek-ai/dsh-tool-subagent'
import * as ToolWeb from '@deepseek-ai/dsh-tool-web'
import VmWorkflowEngine from '@deepseek-ai/dsh-workflow-worker-thread'
import * as ToolRalph from '@deepseek-ai/dsh-tool-ralph'
import * as ToolWorkflow from '@deepseek-ai/dsh-tool-workflow'
import { githubSlug } from './verify-md-links.ts'

/** Attachment seam marker that makes the attachments-conditional `read_image` schema harvestable. */
class CatalogAttachmentStore extends AttachmentStore {
  readonly imageLimits: ImageAttachmentLimits = Object.freeze({
    maxImageBytes: 1,
    maxImagesPerMessage: 1,
    maxMessageImageBytes: 1,
    maxImagePixels: 1,
    maxImageDimension: 1,
    mediaTypes: Object.freeze(['image/png'] as const),
  })

  override validateImage(_input: SaveImageAttachment): Promise<void> {
    return Promise.reject(new Error('gen-tool-catalog: attachment validation is unreachable during schema harvest'))
  }

  override saveImage(_input: SaveImageAttachment): Promise<ImageAttachmentRef> {
    return Promise.reject(new Error('gen-tool-catalog: attachment writes are unreachable during schema harvest'))
  }

  override readImage(_ref: ImageAttachmentRef): Promise<StoredImageAttachment> {
    return Promise.reject(new Error('gen-tool-catalog: attachment reads are unreachable during schema harvest'))
  }
}

import { documentationPath, relocateGeneratedDocument } from './documentation-paths.ts'

const root = resolve(import.meta.dirname, '..')
const LEGACY_OUT = 'docs/tool-catalog.md'
const OUT = documentationPath(LEGACY_OUT)

/**
 * Register the descriptor needed to mount schema-producing consumers. Declares
 * the full capability set of the shipped in-process providers so consumers
 * mount under their shipped defaults (tool-subagent's default numeric maxDepth
 * requires `depthLimit`).
 */
function registerCatalogSubagentProvider(ctx: Context, name: string): void {
  const provider: SubagentProvider = {
    name,
    capabilities: { outputSchema: true, depthLimit: true, toolFilter: true, persona: true },
    inheritsParentContext: false,
    start: () => Promise.reject(new Error('tool-catalog provider cannot start a child')),
    // Declared so consumers configured for continuable background mode mount.
    prepareContinuable: () => Promise.reject(new Error('tool-catalog provider cannot prepare a child')),
  }
  ctx.subagents.registerProvider(provider)
}

/** Minted child-scope keys for packages whose tools are never global. */
const catalogChildScopes = new WeakMap<Context, Agent>()

/**
 * Install one scope-local tool package into an agent-like child scope for
 * schema harvest, without starting a model, Agent loop, or persistence backend.
 * @param ctx - catalog context owning the scope.
 * @param mountScoped - package installer for the scoped context.
 * @param key - agent-like scope key exposed to the package's scope selector.
 * @param inject - services the package installer must await before mounting.
 */
async function mountCatalogChildScope(
  ctx: Context,
  mountScoped: (childCtx: Context) => void,
  key: Agent = { id: SessionId('tool-catalog-child') } as Agent,
  inject: string[] = ['tools', 'systemPrompt', 'subagents'],
): Promise<void> {
  await ctx.plugin(Object.assign((inner: Context) => {
    mountScoped(createScope(inner, key).ctx)
  }, { inject }))
  catalogChildScopes.set(ctx, key)
}

/**
 * Tool package plus its hand-maintained boot recipe. The caller mounts the
 * prompt and registry; each recipe supplies only package-specific seams and
 * config, while `dir` participates in the completeness check.
 */
export interface ToolPackage {
  /** The npm package name, used as the catalog section heading. */
  pkg: string
  /** The `packages/<group>/<dir>` leaf name — matched by the completeness guard. */
  dir: string
  /**
   * Repo-relative implementation source linked per harvested tool. Packages
   * whose tools share one plugin may use a string; split plugins map each tool
   * name to its own source.
   */
  source: string | Readonly<Record<string, string>>
  /** Services or owning runtimes the package requires at execution time. */
  requires: string[]
  /** Session events or other visible state the tools write or affect. */
  writes: string[]
  /** Additional model-visible names shipped by example/app config. */
  shippedNames?: string[]
  /** Plug the injected seams + the tool plugin onto a context that already
   * carries `systemPrompt` + `tools`. */
  mount: (ctx: Context) => Promise<void>
  /** Agent-like scope key whose tool view is catalogued instead of the global view. */
  scope?: (ctx: Context) => Agent
  /**
   * Config for the caller's `ToolRuntime` mount. The registry itself ships a
   * model-facing tool (`run_code`, registered under a non-native `mode`), so
   * ITS catalog entry boots the registry in the mode that exposes it;
   * every other entry uses the default (native) registry.
   */
  toolsConfig?: ToolsConfig
  /**
   * A deployment note rendered after the package's tools, for a fact that
   * booting the package alone cannot show. The registered tool NAME can be a
   * load-time config (`tool-subagent`'s `toolName`), so one package may appear
   * under several names across deployments — the boot yields the package
   * DEFAULT, and this note records the shipped alternatives the model sees.
   */
  note?: string
}

/**
 * The boot manifest: every shipped tool package (a `tool-*` leaf under
 * `packages/`). Ordered by package name (the render order); the completeness
 * guard proves it is exhaustive against the on-disk glob.
 */
const TOOL_PACKAGES: ToolPackage[] = [
  {
    pkg: '@deepseek-ai/dsh-tool-ask-user',
    dir: 'tool-ask-user',
    source: 'packages/interaction/tool-ask-user/src/index.ts',
    requires: ['ctx.tools', 'ctx.userQuestions'],
    writes: ['tool/call', 'tool/result after a UI/provider answers the question'],
    async mount(ctx) {
      await ctx.plugin(UserQuestionService)
      await ctx.plugin(ToolAskUser)
    },
    note:
      'ask_user_question 会暂停工具调用，直到当前 UI 提供方返回人类答案。',
  },
  {
    pkg: '@deepseek-ai/dsh-tools',
    dir: 'tools',
    source: 'packages/core/tools/src/code-mode.ts',
    requires: ['ctx.tools', 'ctx.codeRuntime (execution time)', 'ctx.systemPrompt'],
    writes: ['tool/call', 'one tool/code-dispatch-start + tool/code-dispatch pair per bridged sub-call', 'tool/result'],
    // The registry's OWN tool: run_code exists only under a non-native mode
    // (the registry registers it in its constructor; the code runtime is read
    // at assembly/execution time, so the schema harvest needs none mounted).
    toolsConfig: { mode: 'code' },
    async mount() {},
    note:
      '在 `mode: code`／`mode: both` 下，它由工具注册表所有，作为可过滤能力层之外的保留传输机制（参见 Code Mode Agent Note）。在 `code` 下，它是注册表对协议格式（wire format）的唯一贡献；其他可见能力在使用已加载运行时语言生成的 SDK 章节中声明。程序通过 binding 调用这些能力，调用按照原生并发约定调度：启动顺序和策略遵循提交顺序，并发安全的函数体最多重叠执行 `maxParallelSubCalls` 个。调用会重新进入完整且受守卫保护的工具流水线，并将每个嵌套执行关联到此外层结果。',
  },
  {
    pkg: '@deepseek-ai/dsh-plan-mode',
    dir: 'plan-mode',
    source: 'packages/plan/plan-mode/src/index.ts',
    requires: ['ctx.tools', 'ctx.systemPrompt', 'ctx.userQuestions (execution time, opportunistic)'],
    writes: ['tool/call', 'plan/mode inactive on an approved review', 'tool/result'],
    async mount(ctx) {
      await ctx.plugin(PlanModeController, { section: 'Tool catalog schema harvest.' })
    },
    note:
      '规划未激活时，exit_plan_mode 仍保留在面向模型的 schema 中，这样状态转换不会在规划策略变更之外额外造成工具目录变动。其执行路径会拒绝规划模式之外的调用；在规划模式下，它通过用户交互 seam 提交计划（批准／根据反馈继续规划），批准后会在步骤边界记录规划模式已停用。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-bash',
    dir: 'tool-bash',
    source: 'packages/shell/tool-bash/src/index.ts',
    requires: ['ctx.tools', 'ctx.shell', 'ctx.systemPrompt', 'ctx.shellEnv', 'ctx.jobs at call time for run_in_background'],
    writes: ['tool/call', 'tool/result'],
    async mount(ctx) {
      await ctx.plugin(LocalSubprocessRuntime)
      await ctx.plugin(BashEnvPlugin)
      await ctx.plugin(LocalBashExecutor)
      await ctx.plugin(ToolBash)
    },
    note:
      'bash 工具是 bash 执行器 seam 面向模型的消费方。使用 `run_in_background` 的运行会注册到通用 `ctx.jobs` 运行时，并通过 `job_*` 工具（来自 `@deepseek-ai/dsh-tool-jobs`）收集／停止；禁用 `enableRunInBackground` 配置（默认为 true）后，该参数会被完全移除。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-pwsh',
    dir: 'tool-pwsh',
    source: 'packages/shell/tool-pwsh/src/index.ts',
    requires: ['ctx.tools', 'ctx.shell', 'ctx.systemPrompt', 'ctx.shellEnv', 'ctx.jobs at call time for run_in_background'],
    writes: ['tool/call', 'tool/result'],
    async mount(ctx) {
      // The pwsh tool consumes the bash executor seam; the schema harvest
      // mounts the pwsh-local implementation so the inject resolves without
      // executing anything (registration never spawns a process).
      await ctx.plugin(LocalSubprocessRuntime)
      await ctx.plugin(BashEnvPlugin)
      await ctx.plugin(PwshLocalExecutor)
      await ctx.plugin(ToolPwsh)
    },
    note:
      'pwsh 工具是 Windows 组合中 bash 执行器 seam 的 PowerShell 方言消费方（由 `@deepseek-ai/dsh-pwsh-local` 等 PowerShell 执行器为 `ctx.shell` 提供后端）；除沙箱接口外，它逐项对应 bash 工具调用。使用 `run_in_background` 的运行会注册到通用 `ctx.jobs` 运行时，并通过 `job_*` 工具收集／停止；托管的 `DSH_*` 环境来自 `@deepseek-ai/dsh-shell-env`。每次调用都在新进程中运行，不使用持久 PTY 会话。路径采用原生 `C:\\...` 形式，变量采用 `$env:NAME`。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-cordis',
    dir: 'tool-cordis',
    source: 'packages/extensions/tool-cordis/src/index.ts',
    requires: ['ctx.tools', 'ctx.dynamicCordisRunner'],
    writes: ['tool/call', 'tool/result', 'process-local dynamic package lifecycle'],
    async mount(ctx) {
      await ctx.plugin(CordisHostRunner)
      await ctx.plugin(ToolCordis)
    },
    note:
      '不在任何随产品发布的树中，需要显式选择启用；动态 Package 代码可以访问真实运行时，见 .agents/notes/implemented/feature/2026-07-08-self-referential-cordis-toolset.md。该工具集注入 `@deepseek-ai/dsh-cordis-host-runner` 提供的 `ctx.dynamicCordisRunner`，后者拥有定义注册表和 vm 沙箱；组合缺少它时这些工具不会激活。运行中的 Package 在停止、undefine 或 DSH 重启前可以注册**额外的**模型可见工具；发生这类工具集变化时，系统会记录完整且有变动的请求头。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-bash-persistent',
    dir: 'tool-bash-persistent',
    source: 'packages/shell/tool-bash-persistent/src/index.ts',
    requires: ['ctx.tools', 'ctx.terminals', 'an owning Agent at execution time'],
    writes: ['tool/call', 'PTY shell state', 'tool/result'],
    async mount(ctx) {
      await ctx.plugin(TerminalSessionService)
      await ctx.plugin(ToolBashPersistent)
    },
    note:
      '一个按所有者隔离的持久 bash 工具；部署组合提供 PTY 后端，并可覆盖面向模型的环境描述。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-pwsh-persistent',
    dir: 'tool-pwsh-persistent',
    source: 'packages/shell/tool-pwsh-persistent/src/index.ts',
    requires: ['ctx.tools', 'ctx.terminals', 'an owning Agent at execution time'],
    writes: ['tool/call', 'PTY shell state', 'tool/result'],
    async mount(ctx) {
      await ctx.plugin(TerminalSessionService)
      await ctx.plugin(ToolPwshPersistent)
    },
    note:
      '一个按所有者隔离的持久 pwsh 工具，持久 bash 工具的 Windows 对应物；部署组合提供 pwsh 方言的 PTY 后端，并可覆盖面向模型的环境描述。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-str-replace-editor',
    dir: 'tool-str-replace-editor',
    source: 'packages/fs/tool-str-replace-editor/src/index.ts',
    requires: ['ctx.tools', 'ctx.fs'],
    writes: ['tool/call', 'fs/observed after view presence/absence, edit absence, or successful mutation', 'tool/result'],
    async mount(ctx) {
      await ctx.plugin(LocalFileSystem)
      await ctx.plugin(ToolStrReplaceEditor)
    },
    note:
      '基于文件系统 seam 的独立查看／创建／唯一字面量替换／按行插入工具；可与任何 shell 或终端接口组合。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-fs',
    dir: 'tool-fs',
    source: 'packages/fs/tool-fs/src/index.ts',
    requires: ['ctx.tools', 'ctx.fs', 'ctx.systemPrompt', 'ctx.attachments (image-tool registration)', 'ctx.llm + an image-capable route (image-tool execution)'],
    writes: ['tool/call', 'fs/write-intent or fs/edit-intent for mutations', 'fs/observed after read presence/absence or successful file operation', 'durable attachment (read_image)', 'tool/result'],
    async mount(ctx) {
      // The tool needs `fs`; the bare provider is sufficient because policy
      // changes behavior, not schema shape. The catalog seam marker opts into
      // the attachments-conditional image schema without attachment I/O.
      await ctx.plugin(LocalFileSystem)
      await ctx.plugin(CatalogAttachmentStore)
      await ctx.plugin(ToolFs)
    },
    note:
      '先读后写／编辑策略由 `@deepseek-ai/dsh-fs-observation-policy` 添加；它是一个 `fs/*` 事件门禁插件，不会改变 schema。加载这些工具的部署按预期也应加载该插件。没有 `ctx.attachments` 时图片工具不会注册；其 schema 与路由无关，执行时除非确切路由的模型声明图片输入，否则拒绝。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-fs-search',
    dir: 'tool-fs-search',
    source: 'packages/fs/tool-fs-search/src/index.ts',
    requires: ['ctx.tools', 'ctx.subprocess', 'ctx.systemPrompt'],
    writes: ['tool/call', 'tool/result'],
    async mount(ctx) {
      // The tools inject `subprocess` (search spawns the packaged ripgrep
      // binary through the seam, not ctx.fs); registration itself never
      // spawns, so the real local service is inert here. `ctx.spillStore` is
      // optional (read via ctx.get) and does not affect the schemas, so no
      // spill backend is mounted.
      await ctx.plugin(LocalSubprocessRuntime)
      await ctx.plugin(ToolFsSearch, { sampleOverCapGlobResults: true })
    },
    note:
      'glob 和 grep 是无条件可用的发现工具，通过 ctx.subprocess spawn 随包提供的 ripgrep 二进制文件（`@vscode/ripgrep`），并作为普通前台调用运行，绝不作为后台任务；无需在宿主机安装 `rg`，也不经过 shell 层。本目录使用 `sampleOverCapGlobResults: true`；部署必须显式选择该行为。结果超过上限时，会通过可选的 ctx.spillStore 后端保存完整的格式化列表；在共置部署中，如果后端公开本地路径，返回的定位信息可供后续读取／搜索。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-terminal',
    dir: 'tool-terminal',
    source: 'packages/terminal/tool-terminal/src/index.ts',
    requires: ['ctx.tools', 'ctx.terminals', 'ctx.systemPrompt', 'ctx.jobs at call time for run_in_background'],
    writes: ['tool/call', 'tool/result'],
    async mount(ctx) {
      await ctx.plugin(TerminalSessionService)
      await ctx.plugin(ToolPty)
    },
    note:
      '这 6 个终端工具需要选择启用，用于补充一次性 bash／文件系统工具。`terminal_send(run_in_background: true)` 会注册到 `ctx.jobs`；schema 不包含 TUI、具名按键序列、BEL、调整尺寸、自动启动和跨 agent 共享。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-goal',
    dir: 'tool-goal',
    source: 'packages/goal/tool-goal/src/index.ts',
    requires: ['ctx.tools', 'ctx.agents', 'ctx.goals', 'ctx.systemPrompt', 'a calling Agent in an authorized open turn'],
    writes: ['tool/call', 'goal/change for mutations', 'tool/result'],
    async mount(ctx) {
      await ctx.plugin(AgentRegistry)
      await ctx.plugin(GoalService)
      await ctx.plugin(ToolGoal)
    },
    note:
      'create、edit、pause 和 resume 要求直接来自人类的根权限；complete 和 blocked 也接受确切的当前 Goal Round。blocked 的默认下限是 3 个获准的 Round。',
  },
  {
    pkg: '@deepseek-ai/dsh-schedule',
    dir: 'schedule',
    source: 'packages/schedule/schedule/src/tools.ts',
    requires: ['ctx.tools', 'ctx.sessions', 'Session persistence', 'a future live root Agent'],
    writes: ['tool/call', 'schedule/change create or delete', 'tool/result'],
    async mount(ctx) {
      await ctx.plugin(SessionStore)
      const session = ctx.sessions.create(SessionId('tool-catalog-schedule'))
      const agent = { id: session.id, session } as Agent
      await mountCatalogChildScope(ctx, (childCtx) => {
        ToolSchedule.registerScheduleTools(ctx, childCtx, agent, () => {})
      }, agent, ['tools', 'systemPrompt'])
    },
    scope: ctx => catalogChildScopes.get(ctx) as Agent,
    note:
      '仅在选择启用的 Schedule 插件加载后创建的 live 根 Agent scope 内注册。版本 1 接受 after_seconds、显式绝对 at 和有界固定速率 every_seconds，并披露 session-local 交付；管理读取与变更必须通过共享的 Session 持久化 barrier。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-lsp',
    dir: 'tool-lsp',
    source: 'packages/lsp/tool-lsp/src/index.ts',
    requires: ['ctx.tools', 'ctx.lsp', 'ctx.systemPrompt'],
    writes: ['tool/call', 'tool/result'],
    async mount(ctx) {
      // The tool registers from the seam alone; the schema does not depend on any provider.
      await ctx.plugin(Lsp)
      await ctx.plugin(ToolLsp)
    },
    note:
      'lsp 工具将提供方选择和语言服务器子进程置于 ctx.lsp 之后，因此其模型可见 schema 在更换提供方时保持稳定。运行时要求已注册提供方，例如 `@deepseek-ai/dsh-lsp-stdio`；如果没有提供方，查询会返回结构化 `LSP_UNAVAILABLE` 错误，而不会改变 schema。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-ralph',
    dir: 'tool-ralph',
    source: 'packages/workflow/tool-ralph/src/index.ts',
    requires: ['ctx.tools', 'ctx.workflowEngine', 'ctx.subagents', 'ctx.systemPrompt', 'a calling Agent (exec.agent parents every fresh round)'],
    writes: ['tool/call', 'tool/result', 'workflow and child session events during execution'],
    async mount(ctx) {
      await ctx.plugin(SubagentRuntime)
      registerCatalogSubagentProvider(ctx, 'mock')
      await ctx.plugin(VmWorkflowEngine, { provider: 'mock' })
      await ctx.plugin(ToolRalph, { subagentProvider: 'mock' })
    },
    note:
      '固定的前台工作流会在每个 Round 启动一个全新的结构化子级；模型只能选择不可变目标和可选的 Round 上限。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-skill',
    dir: 'tool-skill',
    source: 'packages/skill/tool-skill/src/index.ts',
    requires: ['ctx.tools', 'ctx.agents', 'ctx.skills'],
    writes: ['tool/call', 'tool/result', 'user/message replacement catalogs via agent.inject()'],
    async mount(ctx) {
      await ctx.plugin(AgentRegistry)
      await ctx.plugin(SkillRegistry)
      await ctx.plugin(SkillFileSystem, {
        dshHome: resolve(root, '.tmp/tool-catalog/.dsh'),
        agentsHome: resolve(root, '.tmp/tool-catalog/.agents'),
      })
      await ctx.plugin(ToolSkill)
    },
  },
  {
    pkg: '@deepseek-ai/dsh-tool-session-query',
    dir: 'tool-session-query',
    source: 'packages/session-query/tool-session-query/src/index.ts',
    requires: ['ctx.tools', 'ctx.systemPrompt', 'ctx.sessionQuery', 'a calling Agent for workspace authority'],
    writes: ['tool/call', 'tool/result'],
    async mount(ctx) {
      await ctx.plugin(SessionStore)
      await ctx.plugin(SqliteSessionQueryEngine, { path: ':memory:' })
      await ctx.plugin(ToolSessionQuery)
    },
    note:
      '这 5 个只读工具会隐藏提供方游标，并根据不可变的调用 agent 会话为每个结果授权。该包需要选择启用；需要强制截止时间或限制行内输出的组合还会挂载通用超时或 spill 策略。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-subagent',
    dir: 'tool-subagent',
    source: 'packages/subagent/tool-subagent/src/index.ts',
    requires: ['ctx.tools', 'ctx.subagents', 'ctx.systemPrompt'],
    writes: ['tool/call', 'tool/result', 'child session events through the chosen provider'],
    shippedNames: ['subagent', 'subagent_fork'],
    async mount(ctx) {
      await ctx.plugin(SubagentRuntime)
      registerCatalogSubagentProvider(ctx, 'mock')
      await ctx.plugin(ToolSubagent, { provider: 'mock' })
    },
    note:
      '注册的工具名称取决于加载时 `toolName` 配置（默认为 `subagent`）；上述 schema 对应默认值。随产品发布的组合会为每个 subagent 后端加载一次该包，因此模型还会看到绑定到 fork 后端的 `subagent_fork`。每个实例的描述、`run_in_background` 参数与 system prompt 策略取决于它自己的 `backgroundMode` 和 `enableRunInBackground`，因此两个随附 schema 并不相同：`subagent` 为 `continuable`，省略参数时默认后台运行，并由 runtime 自动投递结束结果；`subagent_fork` 保持 `one-shot`，省略参数时默认前台运行。详见 `packages/bundle/base/cordis.patch.yml` 和 `examples/acp-agent/cordis.yml`。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-subagent-control',
    dir: 'tool-subagent-control',
    source: {
      interrupt_agent: 'packages/subagent/tool-subagent-control/src/index.ts',
      list_agents: 'packages/subagent/tool-subagent-control/src/list-agents.ts',
      send_message: 'packages/subagent/tool-subagent-control/src/index.ts',
    },
    requires: ['ctx.tools', 'ctx.subagents', 'ctx.agents and ctx.sessionProjections (list_agents only)'],
    writes: ['tool/call', 'tool/result', 'child session events through ctx.subagents'],
    async mount(ctx) {
      await ctx.plugin(SubagentRuntime)
      await ctx.plugin(LocalJobRegistry)
      await ctx.plugin(AgentRegistry)
      await ctx.plugin(SessionStore)
      await ctx.plugin(SessionProjectionRegistry)
      await ctx.plugin(ToolSubagentControl)
      await ctx.plugin(ToolSubagentListAgents)
    },
    note:
      '这些是控制可继续后台 subagent 的全局命名工具：绑定提供方的 `tool-subagent` 实例注册不同的委派工具；本包注册一次 `send_message` 和 `interrupt_agent`，另由 `list_agents` 通过单独加载的 `/list-agents` 插件提供，其目录行使用 sessionProjections 和实时 Agent 注册表。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-subagent-report',
    dir: 'tool-subagent-report',
    source: 'packages/subagent/tool-subagent-report/src/index.ts',
    requires: ['ctx.subagents', 'ctx.systemPrompt', 'a live continuable in-process child Agent'],
    writes: ['tool/call', 'tool/result', 'a user-role message in the direct parent session'],
    async mount(ctx) {
      await ctx.plugin(AgentRegistry)
      await ctx.plugin(SubagentRuntime)
      const { reportDelivery } = ToolSubagentReport.Config({}) as { reportDelivery: SubagentReportDelivery }
      await mountCatalogChildScope(ctx, (childCtx) => {
        ToolSubagentReport.installReportTool(childCtx, ctx, reportDelivery)
      })
    },
    scope: ctx => catalogChildScopes.get(ctx) as Agent,
    note:
      '按可继续的进程内子级注册，而非全局注册，因此该 schema 仅在这种子级内部可见，并且不受其全局 `toolFilter` 影响。同一份贡献还会安装子级作用域的 `tool:report` 系统提示词 section，本目录不渲染该 section。面向父级的 `send_message` 工具单独安装。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-jobs',
    dir: 'tool-jobs',
    source: 'packages/jobs/tool-jobs/src/index.ts',
    requires: ['ctx.tools', 'ctx.jobs', 'ctx.systemPrompt'],
    writes: ['tool/call', 'tool/result', 'user/message via agent.inject() for background completion notices'],
    async mount(ctx) {
      await ctx.plugin(LocalJobRegistry)
      await ctx.plugin(ToolTasks)
    },
    note:
      '与任务种类无关的后台任务控制器：后台 bash 命令、PTY 发送和 subagent 都通过相同的 3 个工具读取、列出和终止。加载该插件会挂接控制器，从而启用生产方的 `ctx.jobs.start()`。',
  },
  {
    pkg: '@deepseek-ai/dsh-experimental-tool-agent-team',
    dir: 'tool-agent-team',
    source: 'packages/experimental/tool-agent-team/src/index.ts',
    requires: ['ctx.tools', 'ctx.systemPrompt', 'ctx.agentTeams', 'an exact live Team member Agent'],
    writes: ['tool/call', 'team/member', 'team/message/queued', 'team/message/delivered', 'team/task', 'tool/result'],
    async mount(ctx) {
      await ctx.plugin(AgentRegistry)
      await ctx.plugin(SessionStore)
      const session = ctx.sessions.create(SessionId('tool-catalog-team-lead'))
      let agent!: Agent
      const membership = {
        get root() { return agent },
        id: session.id,
        role: 'lead' as const,
        name: 'lead',
      }
      ctx.provide('agentTeams', {
        tryMembership: (candidate: Agent) => candidate === agent ? membership : undefined,
        membership: () => membership,
      } as unknown as TeamService)
      await ctx.plugin(Object.assign((inner: Context) => {
        agent = {
          id: session.id,
          session,
          options: {},
          status: 'idle',
        } as unknown as Agent
        Object.assign(agent, { ctx: createScope(inner, agent).ctx })
        inner.agents.register(agent)
      }, { inject: ['tools', 'systemPrompt', 'agents', 'agentTeams'] }))
      await ctx.plugin(ToolTeam)
      catalogChildScopes.set(ctx, agent)
    },
    scope: ctx => catalogChildScopes.get(ctx) as Agent,
    note:
      '这 10 个工具限定于隐式 Team Lead 与持久 teammate 作用域。随产品发布的 dsh-base bundle 默认禁用该包；文档中的 Agent Teams profile patch 会启用它，并禁用旧 continuable child 的同名控制工具。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-todo',
    dir: 'tool-todo',
    source: 'packages/todo/tool-todo/src/index.ts',
    requires: ['ctx.tools', 'owning Agent session'],
    writes: ['tool/call', 'todo/write', 'tool/result'],
    async mount(ctx) {
      await ctx.plugin(ToolTodo, { allowParallelInProgress: true })
    },
    note:
      'todo_write 是会话所有的状态；UI 将最新的 todo/write 事件渲染为检查清单。`allowParallelInProgress` 是没有默认值的必填项，因此本目录明确选择 `true`，对应描述允许同时存在多个 `in_progress` 项。选择 `false` 的部署会获得同一工具，但描述会要求只能有 1 个活动任务。',
  },
  {
    pkg: '@deepseek-ai/dsh-tool-workflow',
    dir: 'tool-workflow',
    source: 'packages/workflow/tool-workflow/src/index.ts',
    requires: ['ctx.tools', 'ctx.workflowEngine', 'ctx.systemPrompt', 'a calling Agent (exec.agent parents the script children)'],
    writes: ['tool/call', 'tool/result'],
    async mount(ctx) {
      // The tool injects `workflows`; boot the vm engine over a scripted
      // subagent provider to satisfy it. The schema does not depend on which
      // provider backs the engine.
      await ctx.plugin(SubagentRuntime)
      registerCatalogSubagentProvider(ctx, 'mock')
      await ctx.plugin(VmWorkflowEngine, { provider: 'mock' })
      await ctx.plugin(ToolWorkflow)
    },
  },
  {
    pkg: '@deepseek-ai/dsh-tool-web',
    dir: 'tool-web',
    source: 'packages/web/tool-web/src/index.ts',
    requires: ['ctx.tools', 'ctx.web', 'ctx.systemPrompt'],
    writes: ['tool/call', 'tool/result'],
    async mount(ctx) {
      // Mount search and fetch providers so both tools register. Their schemas
      // do not depend on provider identity or availability.
      await ctx.plugin(WebRuntime)
      await ctx.plugin(WebSearchExa)
      await ctx.plugin(WebFetchLocal)
      await ctx.plugin(ToolWeb)
    },
    note:
      'web_search 和 web_fetch 将提供方选择置于 ctx.web 之后，使模型可见 schema 在更换后端时保持稳定。',
  },
]

/** One package's contribution to the catalog: its schemas plus attribution. */
interface CatalogPackage {
  pkg: string
  sources: Readonly<Record<string, string>>
  requires: string[]
  writes: string[]
  shippedNames?: string[]
  schemas: ToolSchema[]
  /** A deployment note (see {@link ToolPackage.note}), rendered after the tools. */
  note?: string
}

/** The whole catalog: one entry per booted tool package, in manifest order. */
export type ToolCatalog = CatalogPackage[]

/**
 * Assert the boot manifest covers every shipped tool package on disk (a
 * `tool-*` leaf under `packages/`).
 * Booting has no source declaration to enumerate, so this glob restores the
 * "a new tool cannot be silently undocumented" guarantee: an unlisted package
 * fails the generator (and the freshness gate) until it is added to
 * {@link TOOL_PACKAGES}. Exported for a direct negative test.
 *
 * `scanRoot` defaults to the repo root; a test may point it at a fixture tree.
 */
export function assertManifestComplete(packages: ToolPackage[] = TOOL_PACKAGES, scanRoot: string = root): void {
  const onDisk = globSync('packages/*/tool-*', { cwd: scanRoot }).map(p => basename(p)).sort()
  const listed = new Set(packages.map(p => p.dir))
  const missing = onDisk.filter(dir => !listed.has(dir))
  if (missing.length > 0) {
    throw new Error(
      `gen-tool-catalog: ${missing.length} tool package(s) not in the boot manifest: ${missing.join(', ')}. `
      + 'Add each to TOOL_PACKAGES in scripts/gen-tool-catalog.ts so its schema is catalogued.',
    )
  }
}

/**
 * Assert one manifest entry actually registered a tool.
 *
 * A tool package that boots without registering anything is a broken boot, not
 * an empty catalog section. The usual cause is an `inject` the entry's `mount`
 * does not satisfy: cordis leaves the plugin PENDING, every step here still
 * succeeds, and the generator writes a catalog missing that package's tools —
 * with the freshness gate green on it, because the omission is now what the
 * generator produces. {@link assertManifestComplete} cannot see this: the
 * package IS listed, it just contributed nothing.
 * @param entry - the manifest entry that was booted.
 * @param harvested - how many schemas its boot registered.
 * @throws when the boot registered no tool at all.
 */
export function assertToolsHarvested(entry: ToolPackage, harvested: number): void {
  if (harvested > 0) return
  throw new Error(
    `gen-tool-catalog: ${entry.pkg} booted without registering a single tool. `
    + 'Its plugin is most likely PENDING on a service this manifest entry does not mount — '
    + `compare the plugin's inject with mount() and requires: ${entry.requires.join(', ')}.`,
  )
}

/**
 * Boot each tool package on a fresh Context and harvest its model-facing
 * schemas. A fresh Context per package keeps attribution clean (each entry's
 * schemas come from exactly that package) and isolates a boot failure to its
 * own entry. Disposed after harvest so no executor/provider outlives the run.
 */
export async function collectToolCatalog(packages: ToolPackage[] = TOOL_PACKAGES): Promise<ToolCatalog> {
  assertManifestComplete(packages)
  const catalog: ToolCatalog = []
  for (const entry of packages) {
    const ctx = new Context()
    // Dispose in `finally` so a throw from `mount`/`schemas()` after earlier
    // plugins mounted still tears the context down (no leaked executor/provider
    // fiber) — the repo's "dispose must reach quiescence" rule.
    try {
      await ctx.plugin(SystemPrompt)
      await ctx.plugin(ToolRuntime, entry.toolsConfig ?? {})
      await entry.mount(ctx)
      const schemas = ctx.tools.schemas(entry.scope?.(ctx)).sort((a, b) => a.name.localeCompare(b.name))
      assertToolsHarvested(entry, schemas.length)
      catalog.push({
        pkg: entry.pkg,
        sources: Object.fromEntries(schemas.map(schema => [
          schema.name,
          toolSource(entry, schema.name),
        ])),
        requires: entry.requires,
        writes: entry.writes,
        schemas,
        ...entry.shippedNames !== undefined ? { shippedNames: entry.shippedNames } : {},
        ...entry.note !== undefined ? { note: entry.note } : {},
      })
    } finally {
      await ctx.fiber.dispose()
    }
  }
  return catalog
}

/** Resolve one harvested tool to the plugin source that registered it. */
function toolSource(entry: ToolPackage, toolName: string): string {
  if (typeof entry.source === 'string') return entry.source
  const source = entry.source[toolName]
  if (source === undefined) {
    throw new Error(
      `gen-tool-catalog: ${entry.pkg} has no source mapping for harvested tool ${toolName}`,
    )
  }
  return source
}

/** Render one tool's entry: name, description, JSON-Schema parameters, source. */
function renderTool(schema: ToolSchema, source: string): string[] {
  const out = [`### \`${schema.name}\``, '']
  if (schema.description) out.push(schema.description, '')
  out.push('```json', JSON.stringify(schema.parameters, null, 2), '```', '')
  out.push(`源码：[\`${source}\`](../${source})`, '')
  return out
}

function codeList(values: string[] | undefined): string {
  return values?.length ? values.map(value => `\`${value}\``).join(', ') : '-'
}

function tableCell(value: string | undefined): string {
  return value ? value.replace(/\|/g, '\\|').replace(/\n/g, '<br>') : '-'
}

/** Render the full catalog (pure, deterministic given the manifest-ordered input). */
export function render(catalog: ToolCatalog): string {
  const lines: string[] = [
    '<!-- Generated by scripts/gen-tool-catalog.ts — do not edit by hand.',
    '     Run `pnpm run gen-tool-catalog` to regenerate. -->',
    '',
    '# 工具 Schema 目录',
    '',
    '已发布插件向 `ctx.tools` 提供的所有面向模型的工具：模型通过系统提示词组装获得的 `name`、`description` 和 JSON Schema `parameters`。本目录是[子系统页面](subsystems/core.zh.md)（类型及每页生成的 `cordis-surface` 接线区域）的补充；本页列出的是向 agent（智能体）提供的*工具*。',
    '',
    '本页由 `scripts/gen-tool-catalog.ts` 生成，由 `pnpm run verify-tool-catalog` 校验新鲜度。生成器在真实上下文启动各工具插件并读取 `ctx.tools.schemas()`，保留模型实际接收的名称、描述和 JSON Schema；完整性检查确保 `packages/*/tool-*` 未被启动清单遗漏。请修改源码或生成器，不要手改生成正文。',
    '',
    '范围：`packages/*/tool-*` 下已发布的产品工具，每个工具均使用其**默认**配置启动；但如果某个 Config 字段是**必填项**且没有默认值，生成器就必须作出选择，对应包的说明会记录本页展示的是哪个分支。注册的工具**名称**可以是加载时配置，例如 `tool-subagent` 的 `toolName`，因此部署可能以不同名称或额外名称提供某个包；如果存在随产品发布的别名，对应包的说明会予以记录。`examples/` 中的演示工具（例如 `echo`）不在范围内，这与 Cordis 目录仅涵盖包的范围一致。',
    '',
    '<a id="tool-package-map"></a>\n\n## 工具包映射',
    '',
    '本表连接模型可见的工具名、插件包及其服务依赖。完整 JSON Schema 见下方各包小节。',
    '',
    '| 工具包 | 模型可见名称 | 依赖 | 写入或影响 | 发布别名 | 部署说明 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...catalog.map(entry => `| \`${entry.pkg}\` | ${codeList(entry.schemas.map(schema => schema.name))} | ${codeList(entry.requires)} | ${codeList(entry.writes)} | ${codeList(entry.shippedNames)} | ${tableCell(entry.note)} |`),
    '',
  ]
  for (const entry of catalog) {
    lines.push(`<a id="${githubSlug(entry.pkg)}"></a>`, '', `## \`${entry.pkg}\``, '')
    for (const schema of entry.schemas) {
      // Collection validated that every harvested schema has a source.
      const source = entry.sources[schema.name] as string
      lines.push(...renderTool(schema, source))
    }
    if (entry.note) lines.push(entry.note, '')
  }
  return relocateGeneratedDocument(lines.join('\n'), LEGACY_OUT)
}

/** CLI entry: default writes the catalog, `--check` fails if the committed copy
 * is stale. Guarded behind an entry-point check so importing this module for
 * tests neither regenerates the committed file nor calls process.exit. */
async function main(): Promise<void> {
  const content = render(await collectToolCatalog())
  if (process.argv.includes('--check')) {
    let committed: string | null = null
    try {
      committed = readFileSync(resolve(root, OUT), 'utf8')
    } catch {
      // Only ENOENT (not yet generated) is expected; a present-but-unreadable
      // file is not a state this repo produces. Either way the remedy is the
      // same — regenerate — so treat a read failure as "stale".
      committed = null
    }
    if (committed === content) {
      console.log(`gen-tool-catalog: ${OUT} is up to date.`)
      process.exit(0)
    }
    console.error(`gen-tool-catalog: ${OUT} is stale. Run \`pnpm run gen-tool-catalog\` and commit ${OUT}.`)
    const committedLines = committed?.split('\n') ?? []
    const generatedLines = content.split('\n')
    const lineCount = Math.max(committedLines.length, generatedLines.length)
    for (let index = 0; index < lineCount; index += 1) {
      if (committedLines[index] === generatedLines[index]) continue
      console.error(`gen-tool-catalog: first difference at line ${index + 1}`)
      console.error(`  committed: ${JSON.stringify(committedLines[index])}`)
      console.error(`  generated: ${JSON.stringify(generatedLines[index])}`)
      break
    }
    process.exit(1)
  }

  writeFileSync(resolve(root, OUT), content)
  console.log(`gen-tool-catalog: wrote ${OUT}.`)
}

// Run only when invoked as a script, not when imported by a test.
if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  await main()
}
