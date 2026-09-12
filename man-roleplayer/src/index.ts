/**
 * man-roles-roleplayer —— Host 面插件入口（阶段 3 单人物最小垂直切片）。
 *
 * 职责：
 *  1. 注册困惑状态 Projection 单元（key=man-roles/dilemma）；
 *  2. `MAN_ROLES_RP_E2E=1` 时运行 headless 端到端垂直切片（stub 模型）。
 *
 * 运行时依赖（@deepseek-ai/cordis、dsh-session、dsh-session-projection、
 * dsh-llm、zod）由插件包自身 node_modules 提供（$DSH_HOME/profiles/node_modules
 * 安装回退，版本与源码一致 0.1.1-rc.2）；package.json 不声明 @deepseek-ai/* 依赖
 * （registry 缺 0.1.1-rc.2，见 findings 阶段 2 执行事实）。
 */
import type { Context } from '@deepseek-ai/cordis'
import { join } from 'node:path'
import { dilemmaProjectionDefinition, DILEMMA_PROJECTION_KEY } from './projection/dilemma-projection.ts'
import { runVerticalSlice } from './e2e/vertical-slice.ts'
import { runDualVerticalSlice } from './e2e/vertical-slice-dual.ts'
import { runRealModelSlice } from './e2e/vertical-slice-real.ts'
import { runRetrievalSlice } from './e2e/vertical-slice-retrieval.ts'
import { runControlLoopCompatibilitySlice } from './e2e/control-loop-compat.ts'
import { runNativeEvidenceSlice } from './e2e/vertical-slice-native-evidence.ts'
import { runDeliveryProbe } from './e2e/delivery-probe.ts'
import { runTask5Host } from './e2e/task5-host.ts'
import { runDialogueLoopE2E } from './e2e/vertical-slice-dialogue-loop.ts'
import { runPhase7Task9Scripted } from './e2e/phase7-task9-scripted.ts'
import { runPhase7Task9Real } from './e2e/phase7-task9-real.ts'
import { runMvpNativeProductHost, installMvpScriptedProductLlm } from './e2e/mvp-native-product-host.ts'
import { ManRolesProbeService, ManRolesProductRemote, configureManRolesProductService } from './product/remote-probe.ts'
export { ManRolesProbeService, ManRolesProductRemote, configureManRolesProductService }
export { manRolesProbeRequestSchema, manRolesProbeResponseSchema } from './product/types.ts'
export { validateTask5Report } from './validation/task5-report.ts'

/** 稳定插件名（loader 以此标识行）。 */
export const name = 'man-roles-roleplayer'

/** 插件 apply 前必须可用的服务（agents/systemPrompt/persistence：AgentLoop 兼容性切片）。 */
export const inject = ['sessions', 'sessionProjections', 'llm', 'agents', 'agentLoop', 'systemPrompt', 'sessionPersistence']

/** 插件 apply：注册投影单元；E2E 模式开关（MAN_ROLES_RP_E2E=1 单人物 / =dual 双人物 / =real 真实模型）。
 * real 模式返回 Promise：cordis fiber 会 await apply 返回的 promise（见 cordis
 * lib effect 的 `"then" in effect` 分支），保证真实模型 e2e 切片在进程退出前完成。 */
export async function apply(ctx: Context): Promise<void> {
  console.log('[man-roles-roleplayer] 插件已加载 (name=%s)，已注入服务: %j', name, inject)

  // Host Remote is an ordinary plugin-owned service; the API gateway discovers
  // its Typert binding without changing the shared DSH api-remotes assembly.
  // Keep product persistence plugin-owned and out of DSH_HOME: a caller may
  // supply an isolated run directory, otherwise the plugin uses a local work
  // directory rather than a user's shared profile or credentials.
  configureManRolesProductService(process.env.MAN_ROLES_STORAGE_DIR ?? join(process.cwd(), '.man-roles'), ctx)
  if (process.env.MAN_ROLES_PRODUCT_SCRIPTED === '1') ctx.effect(() => installMvpScriptedProductLlm(ctx), 'man-roles zero-cost product stream')
  await ctx.plugin(ManRolesProbeService)
  await ctx.plugin(ManRolesProductRemote)

  // 注册困惑状态投影单元（先注册，后续事件才会被 eager drive）
  ctx.sessionProjections.register(dilemmaProjectionDefinition())
  console.log('[man-roles-roleplayer] Projection 单元已注册 key=%s (stateVersion=1)', DILEMMA_PROJECTION_KEY)

  // 端到端垂直切片（仅验证模式；默认 headless 正常运行不受影响）
  if (process.env.MAN_ROLES_RP_E2E === '1') {
    console.log('[man-roles-roleplayer] E2E 模式开启，运行单人物垂直切片…')
    runVerticalSlice(ctx)
  } else if (process.env.MAN_ROLES_RP_E2E === 'dual') {
    console.log('[man-roles-roleplayer] E2E 模式开启，运行双人物切换垂直切片（阶段 4，方案 A）…')
    runDualVerticalSlice(ctx)
  } else if (process.env.MAN_ROLES_RP_E2E === 'real') {
    console.log('[man-roles-roleplayer] E2E 模式开启，运行真实模型垂直切片（阶段 5，真实 DeepSeek API）…')
    await runRealModelSlice(ctx)
  } else if (process.env.MAN_ROLES_RP_E2E === 'retrieval') {
    console.log('[man-roles-roleplayer] E2E 模式开启，运行阶段 6 检索垂直切片（真实模型 tool-call + 围栏 + 出处校验）…')
    await runRetrievalSlice(ctx)
  } else if (process.env.MAN_ROLES_RP_E2E === 'loop-compat') {
    console.log('[man-roles-roleplayer] E2E 模式开启，运行 DSH AgentLoop 控制循环兼容性切片（本地脚本流，零 token）…')
    return runControlLoopCompatibilitySlice(ctx)
  } else if (process.env.MAN_ROLES_RP_E2E === 'native-evidence') {
    console.log('[man-roles-roleplayer] 原生 AgentLoop + Evidence Ledger 切片开启…')
    return runNativeEvidenceSlice(ctx)
  } else if (process.env.MAN_ROLES_RP_E2E === 'delivery-probe') {
    return runDeliveryProbe(ctx)
  } else if (process.env.MAN_ROLES_RP_E2E === 'task5-restart-stage1') {
    return runTask5Host(ctx, 'stage1')
  } else if (process.env.MAN_ROLES_RP_E2E === 'task5-restart-stage2') {
    return runTask5Host(ctx, 'stage2')
  } else if (process.env.MAN_ROLES_RP_E2E === 'dialogue-loop') {
    const report = await runDialogueLoopE2E()
    console.log('[man-roles-roleplayer] dialogue-loop local E2E', JSON.stringify(report))
  } else if (process.env.MAN_ROLES_RP_E2E === 'mvp-native-product-host') {
    await runMvpNativeProductHost(ctx)
  } else if (process.env.MAN_ROLES_RP_E2E === 'phase7-task9-scripted') {
    await runPhase7Task9Scripted(ctx, process.env.MAN_ROLES_TASK9_OUTPUT ?? join(process.env.DSH_HOME ?? '.validation', 'man-roles', 'phase7-task9-scripted'))
  } else if (process.env.MAN_ROLES_RP_E2E === 'phase7-task9-real') {
    await runPhase7Task9Real(ctx, process.env.MAN_ROLES_TASK9_OUTPUT ?? join(process.env.DSH_HOME ?? '.validation', 'man-roles', 'phase7-task9-real'), process.env.MAN_ROLES_TASK9_MARKER ?? '', process.env.MAN_ROLES_TASK9_MARKER_SHA256 ?? '')
  }
}
export { runDialogueLoopE2E } from './e2e/vertical-slice-dialogue-loop.ts'

// ── 纯函数 re-export（供单元测试直接 import 构建产物 lib/index.js）──────
export { transition, foldDilemmaState, judgeFeedback, deriveLegacyDilemma } from './domain/dilemma.ts'
export type { DilemmaFoldInput, FeedbackVerdict } from './domain/dilemma.ts'
export {
  personaIdSchema,
  dilemmaStateSchema,
  dilemmaCandidateEventSchema,
  dilemmaConfirmedEventSchema,
  dilemmaCorrectedEventSchema,
  initialDilemmaState,
  trunkStateSchema,
  trunkEventRecordSchema,
  trunkUserRawAddedEventSchema,
  trunkDilemmaCandidateEventSchema,
  trunkDilemmaConfirmedEventSchema,
  trunkDilemmaCorrectedEventSchema,
  trunkActivePersonaEventSchema,
  trunkBranchIndexEventSchema,
  initialTrunkState,
  dilemmaItemSchema, dialogueControlStateSchema, branchProgressSchema,
  dialogueEventMetaSchema, taskRoutedEventSchema, dialoguePhaseSetEventSchema,
  dilemmaItemProposedEventSchema, dilemmaItemReviewedEventSchema, dilemmaCoreSelectedEventSchema,
  branchProgressUpdatedEventSchema, actionRecordedEventSchema, sessionControlRecordedEventSchema,
  dialogueCommitSchema,
} from './domain/schema.ts'
export type {
  PersonaId,
  DilemmaPhase,
  DilemmaState,
  DilemmaCandidateEventData,
  DilemmaConfirmedEventData,
  DilemmaCorrectedEventData,
  TrunkState,
  TrunkEventRecord,
  TrunkUserRaw,
  DilemmaItem, DialogueControlState, BranchProgress, DialogueEventMeta, DialogueCommit,
} from './domain/schema.ts'
export { IdempotencyRegistry, newTurnIds } from './turn/ids.ts'
export type { IdempotentRun, TurnIds } from './turn/ids.ts'
export { assembleNextTurn, assembleBranchTurn, estimateTokens, CONTEXT_TOKEN_LIMIT } from './context/assemble.ts'
export type { AssembleInput, AssembleOutput, BranchTurnInput, PersonaSpec } from './context/assemble.ts'
export { toFoldInput, DILEMMA_CANDIDATE, DILEMMA_CONFIRMED, DILEMMA_CORRECTED } from './events.ts'
export { ConversationAggregate, defaultSessionIdFor } from './aggregate/aggregate.ts'
export type { SharedLayer } from './aggregate/aggregate.ts'
export { BranchManager } from './branch/branch-manager.ts'
export type { BranchRecord } from './branch/branch-manager.ts'
export { branchUserMessageSourceSchema } from './branch/message-source.ts'
export type { BranchUserMessageSource } from './branch/message-source.ts'
export {
  TrunkStorage,
  TRUNK_CREATED,
  TRUNK_USER_RAW_ADDED,
  TRUNK_DILEMMA_CANDIDATE,
  TRUNK_DILEMMA_CONFIRMED,
  TRUNK_DILEMMA_CORRECTED,
  TRUNK_ACTIVE_PERSONA_SET,
  TRUNK_BRANCH_INDEXED,
  TRUNK_TASK_ROUTED, TRUNK_DIALOGUE_PHASE_SET, TRUNK_DILEMMA_ITEM_PROPOSED, TRUNK_DILEMMA_ITEM_REVIEWED, TRUNK_DILEMMA_CORE_SELECTED, TRUNK_BRANCH_PROGRESS_UPDATED, TRUNK_ACTION_RECORDED, TRUNK_SESSION_CONTROL_RECORDED,
  TRUNK_PRODUCT_LIFECYCLE, TRUNK_PRODUCT_RESULT,
} from './storage/trunk-storage.ts'
export {
  parsePersonaMarkdown,
  personaSystemPromptFromSections,
  buildPersonaSpec,
  assertRedLineSections,
  PERSONA_RED_LINE_SECTIONS,
} from './context/persona.ts'
export type { PersonaSection } from './context/persona.ts'
export { PersonaRegistry } from './persona/registry.ts'
export { createRuntimeRegistry } from './persona/runtime-registry.ts'
export type { PersonaDefinition } from './persona/registry.ts'
export type { PersonaArtifact, PersonaArtifactEntry } from './persona/artifact.ts'
export { scanPersonaArtifact, generateRegistryArtifacts } from './persona/generator.ts'
export { personaManifestSchema, personaStatusSchema, personaContentManifestSchema } from './persona/manifest-schema.ts'
export type { PersonaManifest, PersonaStatus } from './persona/manifest-schema.ts'
export {
  buildPersonas,
  personaSpecFor,
} from './context/personas-data.ts'
export { estimateRequestTokens } from './llm/client.ts'
export type {
  LlmClient,
  LlmRequest,
  LlmResponse,
  LlmTokenUsage,
  LlmMessage,
} from './llm/client.ts'
export {
  DshLlmClient,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  LlmCallError,
} from './llm/dsh-client.ts'
export type { DshLlmClientOptions } from './llm/dsh-client.ts'
export {
  judgeFeedbackSemantic,
  inferDirectorCandidate,
  parseVerdict,
  keywordFallbackVerdict,
  judgePrompt,
  JUDGE_SYSTEM_PROMPT,
  DIRECTOR_SYSTEM_PROMPT,
} from './llm/judge.ts'
export { runToolLoop } from './llm/client.ts'
export type { ToolHandler, ToolLoopResult, ToolTrailEntry, ToolSchema, LlmToolCall } from './llm/client.ts'
// ── 阶段 6：内容库 + 检索 + 围栏 + 出处校验 + 工具（纯逻辑，零 DSH 运行时依赖）──
export {
  AnecdoteStore,
  QuoteStore,
  Blacklist,
  retrieveAnecdotes,
  fetchAnecdote,
  fetchQuote,
  fetchSource,
  normalizeSource,
  sourceMatches,
  verifyCitation,
  checkBlacklist,
  verifyReference,
  extractCitedSources,
  RETRIEVE_ANECDOTES_TOOL,
  FETCH_ANECDOTE_TOOL,
  ACTOR_TOOLS,
  makeRetrieveHandler,
  makeFetchHandler,
  makeActorHandlers,
  runActorTurnWithRetrieval,
  CONTENT_VERSION,
  ANECDOTES,
  QUOTES,
  BLACKLIST_ENTRIES,
  ANECDOTE_COUNTS,
  QUOTE_COUNTS,
  BLACKLIST_COUNTS,
  buildContentLibraries,
  assertContentIntegrity,
} from './retrieval/index.ts'
export { EvidenceLedger } from './evidence/ledger.ts'
export { validateActorReply } from './evidence/policy.ts'
export { renderVerifiedReply } from './evidence/render.ts'
export type { ActorReplySegment, EvidenceGrant, EvidenceViolation, EvidenceValidationResult } from './evidence/types.ts'
export { submitActorReply, submitWithOneRepair } from './runtime/submit-actor-reply.ts'
export type { ActorResult } from './runtime/submit-actor-reply.ts'
export { createTurnBudget } from './runtime/turn-budget.ts'
export { FINAL_ACTOR_TOOL_NAMES, registerActorTools } from './runtime/actor-tools.ts'
export { FINAL_ACTOR_TOOL_NAMES as ACTOR_TOOL_CONTRACT_NAMES, validateSubmitArgs } from './runtime/actor-tool-contract.ts'
export { evaluateControlLoopEvidence } from './validation/control-loop-report.ts'
export type {
  CapturedLoopRequest,
  ControlLoopEvidence,
  ControlLoopMarkers,
  ValidationCheck,
  ControlLoopValidationSummary,
} from './validation/control-loop-report.ts'
export type {
  Anecdote,
  SearchOptions,
  Quote,
  QuoteCredibility,
  BlacklistEntry,
  BlacklistEntryKind,
  BlacklistMode,
  ContentLibraries,
  RetrievedAnecdote,
  CitationViolation,
  CitationViolationCode,
  VerifyResult,
  ActorTurnResult,
} from './retrieval/index.ts'
export type { TaskOutcome } from './domain/schema.ts'
export { TRUNK_TASK_OUTCOME_RECORDED } from './storage/trunk-storage.ts'
export { TRUNK_BRANCH_DELIVERY_COMMITTED } from './storage/trunk-storage.ts'
export { projectTaskOutcome, TASK_BUDGET_BLOCKED_MESSAGE } from './runtime/task-outcome.ts'
export { deliverCurrentUserMessage } from './runtime/message-delivery.ts'
export { recoverPendingDeliveries, compensateDerivedState, runRecoveryStartup } from './runtime/recovery.ts'
export { deterministicSafetyGate, mergeSafetyDecision, safetyResultSchema } from './dialogue/safety.ts'
export { createControlClassifier, parseControlDecision } from './dialogue/control-classifier.ts'
export { decideTurn } from './dialogue/turn-policy.ts'
export { interpretTurn, turnInterpretationSchema } from './dialogue/turn-interpreter.ts'
export { selectHistory } from './context/select-history.ts'
export { collectWebEvidence, evidenceForTurn, searchWithFallback } from './evidence/web-collector.ts'
export { runDialogueTurn, runDialogueTurnV2, runDialogueTurnV2AfterDelivery } from './dialogue/coordinator.ts'
export { TurnRunner } from './product/turn-runner.ts'
export { nativeActorDeliveryBridge } from './product/native-actor-branch.ts'
export type { NativeActorBranch } from './product/native-actor-branch.ts'
export { ProductRepository, ConversationRepository, ManRolesProductService } from './product/service.ts'
export { ProductController } from './client/product-controller.ts'
export { ProductConversationList, ManRolesComposer, PersonaSwitcher, CandidateControls, ResultPanel } from './client/components/product-components.ts'
export { mvpReportSchema, validateMvpReport } from './validation/mvp-report.ts'
export { runMvpHostSmoke } from './e2e/mvp-host.ts'
export { validateDialogueLoopReport, dialogueLoopReportSchema } from './validation/dialogue-loop-report.ts'
export { validateDirectorUpdate, commitDirectorUpdate, commitDirectorProposals, directorUpdateSchema } from './dialogue/director-update.ts'
export type { CandidateProposal, DirectorUpdate, DirectorCommitInput } from './dialogue/director-update.ts'
export { commitFeedback, applyFeedbackCommit, feedbackPayloadSchema } from './dialogue/feedback-commit.ts'
export type { FeedbackCommitInput, FeedbackPayload } from './dialogue/feedback-commit.ts'
export { publicDialogueView, buildActorContext, validateSelectedHistoricalRawRefs } from './dialogue/public-view.ts'
export type { ActorContext, PublicDialogueView } from './dialogue/public-view.ts'
export { taskModeSchema, safetyDispositionSchema, safetyReasonSchema, dialoguePhaseSchema, feedbackKindSchema, turnIntentSchema, dialogueControlSchema, turnControlDecisionSchema } from './dialogue/types.ts'
export type { TurnControlDecision, TaskMode, SafetyDisposition, DialoguePhase, FeedbackKind, TurnInstruction } from './dialogue/types.ts'
export type { RecoveryStartupInput } from './runtime/recovery.ts'
export type { RecoveryBranch, PendingRecoveryInput, RecoveryItem, DerivedStateCompensationInput } from './runtime/recovery.ts'
export { phase7Task9ReportSchema, validatePhase7Task9Report, claimSingleAttempt, readAttemptMarker, sha256, usageFullTotal, PHASE7_TASK9_SCENARIOS } from './validation/phase7-task9-report.ts'
export { runPhase7Task9Scripted } from './e2e/phase7-task9-scripted.ts'
export type { Phase7Task9Report, Phase7Task9Scenario } from './validation/phase7-task9-report.ts'
export type {
  BranchSessionWriter,
  BranchSessionFlush,
  DeliveryStatus,
  DeliveryStatusSnapshot,
  DeliverCurrentUserMessageInput,
  DeliveryResult,
} from './runtime/message-delivery.ts'
