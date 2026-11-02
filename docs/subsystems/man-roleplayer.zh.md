# Man-roleplayer 产品

[English](man-roleplayer.md) | 中文

本页是 [man-roleplayer](../../packages/extensions/man-roleplayer/README.zh.md) 历史人物困惑领域的参考，说明产品身份、持久状态、证据接受，以及 Host 调用与浏览器 Remote 命令的区别。[客户端 README](../../packages/client/ui-man-roleplayer/README.zh.md) 负责浏览器交互，[profile README](../../packages/bundle/man-roleplayer-app/README.zh.md) 负责组合与部署。

源码：[产品事实](../../packages/extensions/man-roleplayer/src/product/index.ts)、[wire 类型](../../packages/extensions/man-roleplayer/src/types.ts)、[Host 服务](../../packages/extensions/man-roleplayer/src/service.ts)、[Remote facade](../../packages/extensions/man-roleplayer/src/remote.ts)及[证据校验](../../packages/extensions/man-roleplayer/src/evidence.ts)。精确字段与签名由这些声明及生成的 API 小节维护；本页解释它们之间的关系。

## Identity and ownership

| 类型族 | 范围与含义 |
| --- | --- |
| `DilemmaId` | 一份持久产品日志及其人物分支的 Host 身份，区别于 DSH Session 身份。浏览器获得不透明的 `DilemmaHandle`。 |
| `PersonaId` | 部署绑定、分支成员和浏览器选择共用的已注册人物。可用性来自 Host 人物目录；展示元数据不能授权分支。 |
| `RequestId` | 变更的稳定去重身份。复用表示重放同一请求，而不是发出新命令。空白创建在分配困惑前先检查既有对话。 |
| `OperationId` | 选择、分析、删除等产品操作的持久身份，在单次网络响应结束后继续保留。 |
| `ProductMessageId` | Host 服务签名中产品模块导出的 `MessageId` 的局部别名，标识多次尝试共用的持久产品用户消息，区别于核心 LLM 消息身份；产品导出仍名为 `MessageId`。 |
| `DeliveryOperationId`、`TurnOperationId` | 向人物 Session 投递消息及执行其轮次的不同尝试。重试保留原消息身份，并分配新的尝试身份。 |

品牌化辅助函数不校验或分配身份。Remote 转换浏览器的请求与操作品牌类型，不提供原始 Session 访问权。只有 Host 服务同时持有产品与 Session 的关系，以及删除前必须停止的 live Agent。

## Durable conversation and execution

`DilemmaConversation` 从仅追加的产品事实重放，包括分支成员、分配检查点、标题所有权、讨论准入、时间线引用和当前状态。人物回答正文保留在私有 Session；产品时间线引用已接受来源事件，不另存回答副本。

分析 revision 与 `lifecycleRevision` 用途不同。浏览器的 `RoleplayerProjection.revision` 是用于乐观变更检查的生命周期版本。活动、执行、预算、上下文投影和状态分析进度不递增该版本；已接受的产品变更会递增。自动标题另有自己的版本与用户所有权检查，避免迟到的生成结果替换明确重命名的标题。

`ExecutionState` 区分运行、等待用户、停止中、已停止、停止失败和未知执行，与轮次完成、失败或取消的结果独立。取消不能证明 Agent 已静止；活动或未确定停止的执行期间不能切换人物。暂停和阶段结束的讨论须明确恢复，才能发起下一轮。

## Evidence and structured choices

`EvidenceLookupResult` 区分已完成检索与未授权、预算耗尽、取消和失败的尝试。只有所属 live 人物执行能使用其配置索引。已完成但为空是有效的零命中结果；失败不是成功检索。产品事实保留证据身份及生命周期状态，展示的来源正文从索引派生。

`ClaimSidecarInput` 用连续 UTF-16 范围、Claim 分类及证据引用划分完整回答。引文、史实和归属说明须使用本轮实际返回且获准使用的证据；现代推断和证据不足段落不能附加证据 ID。Host 还检查人物、来源类型、可信度及当前可用性。质疑或撤回会使相关历史 Claim 变为 stale，但不改写其正文。

`PersonaTurnSubmission` 是 Host 为一个精确 live 轮次接受的结构化提交，包括正文、计算所得 Claim 范围和捕获的证据版本；它不是任意 assistant 文字或浏览器输入。模型提交顺序文本段，Host 计算范围。相同提交重复出现时返回原提交；同一 lease 的第二份不同提交会被拒绝。最终结算仍检查证据是否有效。

`ChoiceAnswer` 结算属于某个人物轮次操作的待处理产品选择题。选中标签、自定义文字与明确跳过含义不同；空答案本身不代表跳过。结算只唤醒匹配的 live 等待者。冷恢复将未结算等待者关闭为失败，不重放人物轮次。

## Shared state and persona snapshots

`SharedStateItem` 是有来源、带版本的事实、目标、冲突、未解决问题或理解，其生命周期受用户控制。模型提议通常保持候选。自动确认需要 Host 核验来自一条允许用户表达的精确事实或目标原话；模型确认标签本身不足以触发确认。只有已确认项目进入共享上下文。拒绝、替代、撤回或解决会保留历史，同时改变后续用途。

`PersonaSnapshot` 记录一个人物从已完成轮次获得的当前理解、核心观点和可选建议，并关联来源。它不是共享的用户事实，也不是另一人物的私有回答。分析结果提交前须匹配捕获的输入水位、产品版本和已完成分支版本。分析重试使用持久输入，不重放人物回答。

`StateItemModifyOptions` 包含用户编写的修正与可选分类。修改用具有独立身份、已确认的替代记录取代候选或已确认项目，不覆盖原记录，也不恢复浏览器快照。

## Host calls and recovery

`CreateDilemmaOptions` 提供 Host 拥有的困惑 ID、稳定请求及明确隔离的人物分支 Session；浏览器空白创建则要求 Host 分配它们。分支人物须互不相同且包含当前人物；缺失分支先获得持久分配 claim，再发布成员关系。

`SubmitMessageOptions` 区分消息、投递和轮次身份，并可引用已接受回答作为回复对象。普通 Host 调用等待执行结果；浏览器 Remote 提交使用 `acknowledgeOnly`，在持久投递与轮次 claim 写入后返回，回答在后台继续。因此成功证明收到确认，不证明回答已完成或被接受；后续 Host 投影与终态事实决定完成状态。

`ReconcileMessageOptions` 指定已经 claimed 的消息、投递、轮次三元组。恢复检查对应 Session 事实和结构化提交，再结算既有操作，不增加用户消息。Host 调用可能因生命周期、执行、模型或持久化错误而拒绝；返回检查点的方法也可能以返回值表达持久失败操作。

## Remote commands and results

浏览器命令使用受支持的协议版本。`RoleplayerListRequest` 控制是否包含归档，`RoleplayerHandleRequest` 解析不透明句柄。`RoleplayerCreateRequest` 携带稳定创建请求，明确选择一个初始人物。未提供选择时为旧调用方保留原始双人物组合；Remote 拒绝显式创建多个人物。

`RoleplayerMutationRequest` 增加稳定请求与预期生命周期版本。Facade 先检查已接受请求身份，再报告版本冲突；重放返回最新投影。携带过期版本的新命令须重载并重新判断所需变更。直接 Host 方法有各自的检查顺序和可选版本参数，并非全部具有 facade 先重放再检查版本的行为。

| 命令数据族 | 所需关系 |
| --- | --- |
| `RoleplayerRenameRequest`、`RoleplayerSwitchRequest` | 用户所有的标题或目标人物，受生命周期及轮次已停止要求约束。 |
| `RoleplayerSubmitRequest`、`RoleplayerRetryRequest`、`RoleplayerCancelRequest` | 精确消息与执行尝试。重试指定失败尝试，不重复用户消息；取消使用匹配的 live 消息、投递、轮次 lease，忽略提交前的过期版本。 |
| `RoleplayerChoiceAnswerRequest`、`RoleplayerChoiceCancelRequest` | 匹配的待处理选择操作，不使用原始 DSH 问题或 tool-call 身份。 |
| `RoleplayerStateRequest`、`RoleplayerStateModifyRequest`、`RoleplayerStateRetryRequest` | 稳定状态项目或失败分析身份；分析重试还携带稳定重试操作。 |
| `RoleplayerEvidenceRequest` | 质疑、明确复核或撤回的证据身份。复核恢复被质疑证据，不能恢复已撤回证据。 |
| `RoleplayerDeleteRequest` | 在检查点与响应丢失恢复中保留的同一删除操作。 |

`RoleplayerListResult` 与 `RoleplayerRosterResult` 分别返回脱敏对话及可选人物名称，`RoleplayerProjectionResult` 返回一份当前投影。它们区分成功与浏览器安全失败，不公开 Host 异常。传输错误，以及操作错误映射之外的读取或投影组装错误，仍可能使 Promise 拒绝。调用方须处理结果失败与 Promise 拒绝。

## Deletion checkpoints and receipts

`DeletionOperation` 在破坏性 Session 删除前捕获分支目标与已完成移除。请求态删除可在执行开始前取消；不可逆操作只能继续同一身份，失败时保留重试阶段。删除分支历史前须停止 Agent；所有捕获分支移除后，才能移除产品事实。

`DeletionReceipt` 是保留在已删除对话之外的产品全局证明。pending/completed 状态与不透明句柄摘要支持响应丢失恢复，无须保留对话正文。仅有 pending 不代表完成；恢复须确认移除后才能成功。`RoleplayerDeleteResult` 在完成或有效回执重放时仅返回句柄与 `deleted: true`；失败返回带重试信息的类型化结果，不返回空对话投影。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxmanroleplayer--manroleplayer"></a>

### `ctx.manRoleplayer` — `ManRoleplayer`

Host-owned service for product events and variable private DSH agent lifecycles.

```ts cordis-catalog
/** Open the product event medium before publishing the service. */
async open(): Promise<void>

/**
 * Create one Host-owned blank dilemma; request ids make retries return the same record.
 * @param request - Idempotency key, initial active persona, and optional distinct persona roster; omission uses the legacy pair.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the persona roster is empty, duplicated, or excludes its active persona, or Agent creation fails.
 */
async createBlank(request: { readonly requestId: RequestId readonly activePersona: PersonaId readonly personas?: readonly PersonaId[] }): Promise<DilemmaConversation>

/**
 * Create the requested isolated DSH agents, then commit their product relationship.
 * @param options - Dilemma identity, request id, isolated persona branches, and optional model options.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the identity already belongs to another request, branches conflict, or Agent/persistence setup fails.
 */
create(options: CreateDilemmaOptions): Promise<DilemmaConversation>

/**
 * Recreate the configured persona Agent owners and reconcile interrupted operations without replaying a turn.
 * @param id - Owning durable dilemma id.
 * @param agentOptions - Model options for resumed Agents; omission leaves selection to the Agent registry.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the dilemma is missing/deleting, preset identity changed, or recovery fails.
 */
async resume(id: DilemmaId, agentOptions?: AgentOptions): Promise<DilemmaConversation>

/**
 * Persist a reversible delete request. A repeated user request is deduplicated by its request id.
 * @param id - Owning durable dilemma id.
 * @param operation - Reversible requested deletion checkpoint; another active operation is rejected.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the dilemma is missing, its revision conflicts, or the deletion is not reversible and requested.
 */
requestDeletion( id: DilemmaId, operation: DeletionOperation, userRequestId: RequestId, expectedRevision?: number, ): Promise<DilemmaConversation>

/**
 * Cancel only the still-reversible deletion request, preserving append-only history.
 * @param id - Owning durable dilemma id.
 * @param operationId - Stable deletion operation id; retries must reuse the original id.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @returns The durable conversation after cancelling the matching still-requested checkpoint.
 * @throws If the matching deletion is absent or execution already started.
 */
cancelDeletion(id: DilemmaId, operationId: OperationId, userRequestId: RequestId): Promise<DilemmaConversation>

/**
 * Execute or recover the one persisted deletion operation. The durable
 * checkpoint is claimed under the dilemma serializer; stopping agents and
 * deleting sessions happen after that short critical section so lifecycle
 * callers can observe and reject while deletion is in progress.
 * @param id - Owning durable dilemma id.
 * @param operationId - Stable deletion operation id; retries must reuse the original id.
 * @returns The completed or failed checkpoint; concurrent calls for this operation share one execution.
 * @throws If the operation or receipt does not belong to the dilemma, or persisting a checkpoint fails.
 */
delete(id: DilemmaId, operationId: OperationId): Promise<DeletionOperation>

/**
 * Read only the deletion proof needed to retry a lost remote response.
 * @param operationId - Stable deletion operation id; retries must reuse the original id.
 * @returns The minimal retained deletion receipt, or undefined when none exists.
 */
readDeletionReceipt(operationId: OperationId): Promise<DeletionReceipt | undefined>

/**
 * Promote a pending receipt only when its product conversation is already absent.
 * @param operationId - Stable deletion operation id; retries must reuse the original id.
 * @param handleDigest - Digest of the opaque dilemma handle that must match the receipt.
 * @returns True for an already completed receipt or one completed after proving the product record is absent.
 */
async recoverDeletionReceipt(operationId: OperationId, handleDigest: string): Promise<boolean>

/**
 * Read the durable projection; it never returns a live mutable cache.
 * @param id - Owning durable dilemma id.
 * @returns The replayed conversation after recoverable title/state/evidence/safety repairs, or undefined if absent.
 * @throws If durable reads or recovery writes fail.
 */
read(id: DilemmaId): Promise<DilemmaConversation | undefined>

/**
 * Archive a dilemma without deleting its product or private Session facts.
 * @param id - Owning durable dilemma id.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the dilemma is missing, deleting, or its expected revision conflicts.
 */
async archive(id: DilemmaId, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation>

/**
 * Restore only an archived dilemma; deletion checkpoints cannot be resurrected.
 * @param id - Owning durable dilemma id.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the dilemma is missing, deleting, not archived, or its expected revision conflicts.
 */
async restore(id: DilemmaId, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation>

/**
 * List active dilemmas by default; archived records remain available through read/restore.
 * @param includeArchived - Include archived conversations when true; defaults to false.
 * @returns Replayed durable conversations matching the archive filter.
 */
async list(includeArchived: boolean = false): Promise<readonly DilemmaConversation[]>

/**
 * Read only the accepted structured answer referenced by one completed turn.
 * @param id - Owning durable dilemma id.
 * @param timelineId - Completed product turn id used by the persona timeline entry.
 * @returns Accepted answer text, or undefined if its completed turn, live Agent, or exact submission reference is unavailable.
 */
async acceptedAnswer(id: DilemmaId, timelineId: string): Promise<string | undefined>

/**
 * Return accepted answer text and the same-turn validated claim sidecars.
 * @param id - Owning durable dilemma id.
 * @param timelineId - Completed product turn id used by the persona timeline entry.
 * @returns Accepted text and still-accepted sidecars, or undefined if the exact completed submission cannot be resolved.
 */
async acceptedAnswerWithClaims(id: DilemmaId, timelineId: string): Promise<{ readonly text: string readonly claims: readonly ClaimSidecarInput[] } | undefined>

/**
 * Reconstruct the currently live turn and its durable stop state.
 * @param id - Owning durable dilemma id.
 * @returns The live delivery/turn or unresolved execution checkpoint, or undefined once no such operation remains.
 */
async activeTurn(id: DilemmaId): Promise<{ readonly messageId: ProductMessageId; readonly deliveryOperationId: DeliveryOperationId; readonly turnOperationId: TurnOperationId; readonly persona: PersonaId; readonly status: 'running' | 'waiting-choice'; readonly executionState: ExecutionState } | undefined>

/**
 * Project only the reasoning belonging to one product turn. The delivery's
 * sessionMessageId is the ownership fence: first locate that exact user
 * message in its persona branch, then use its enclosing DSH turn. This
 * prevents either persona branch (or an unrelated model turn) crossing into
 * the browser projection while keeping Session ids and raw tool metadata out.
 * @param id - Owning durable dilemma id.
 * @param requestedTurn - Exact product turn attempt, including a distinct retry turn when applicable.
 * @returns Only that attempt's reasoning and status, or undefined when its Session references or reasoning are unavailable.
 */
async reasoning(id: DilemmaId, requestedTurn: TurnOperationId): Promise<{ readonly persona: PersonaId readonly turnOperationId: string readonly status: 'running' | 'completed' | 'failed' | 'cancelled' readonly text: string } | undefined>

/**
 * Derive current evidence details from durable lifecycle facts and the configured research index.
 * @param id - Owning durable dilemma id.
 * @returns Latest evidence lifecycle entries, with source text/details only when the configured index still contains the evidence.
 */
async evidenceStatus(id: DilemmaId): Promise<readonly { readonly id: string readonly persona: PersonaId readonly status: 'available' | 'challenged' | 'withdrawn' readonly evidenceType?: string readonly trustLevel?: string readonly title?: string readonly text?: string readonly source?: string }[]>

/**
 * Project redacted, durable evidence lookup activity without exposing tool internals.
 * @param id - Owning durable dilemma id.
 * @returns Settled evidence lookup statuses and result counts; pending tool claims are omitted.
 */
async evidenceActivity(id: DilemmaId): Promise<readonly { readonly operationId: string readonly status: 'completed-with-results' | 'completed-zero-hit' | 'budget-exhausted' | 'cancelled' | 'failed' readonly returnedCount: number }[]>

/**
 * Return the latest durable state-analysis status and validated candidates.
 * @param id - Owning durable dilemma id.
 * @returns Latest analysis status, current state items and active-persona snapshot, or undefined before any analysis.
 */
async stateStatus(id: DilemmaId): Promise<{ readonly operationId: OperationId readonly retryable: boolean readonly failureCategory?: 'provider' | 'parse' | 'context' | 'stale' readonly status: 'claimed' | 'running' | 'completed' | 'failed' | 'stale' readonly candidates?: readonly { readonly id: string; readonly kind: string; readonly text: string }[] readonly sharedStateItems?: readonly SharedStateItem[] readonly personaSnapshot?: PersonaSnapshot } | undefined>

/**
 * Confirm a model candidate explicitly; model output never self-confirms.
 * @param id - Owning durable dilemma id.
 * @param itemId - Stable shared-state item id to transition.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the item is not a candidate, the revision conflicts, or the dilemma is missing/deleting.
 */
confirmState(id: DilemmaId, itemId: string, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation>

/**
 * Reject a candidate without deleting its append-only history.
 * @param id - Owning durable dilemma id.
 * @param itemId - Stable shared-state item id to transition.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the item is not a candidate, the revision conflicts, or the dilemma is missing/deleting.
 */
rejectState(id: DilemmaId, itemId: string, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation>

/**
 * Withdraw a confirmed item from future context while retaining its history.
 * @param id - Owning durable dilemma id.
 * @param itemId - Stable shared-state item id to transition.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the item is not confirmed, the revision conflicts, or the dilemma is missing/deleting.
 */
withdrawState(id: DilemmaId, itemId: string, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation>

/**
 * Resolve an unresolved item explicitly.
 * @param id - Owning durable dilemma id.
 * @param itemId - Stable shared-state item id to transition.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the item is not an unresolved candidate, the revision conflicts, or the dilemma is missing/deleting.
 */
resolveState(id: DilemmaId, itemId: string, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation>

/**
 * Modify a candidate or confirmed item; the old id becomes superseded.
 * @param id - Owning durable dilemma id.
 * @param itemId - Stable shared-state item id to transition.
 * @param options - Nonblank replacement text and optional replacement kind; the new version is user-confirmed.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the item is not modifiable, the text is blank, the revision conflicts, or the dilemma is deleting.
 */
modifyState( id: DilemmaId, itemId: string, options: StateItemModifyOptions, userRequestId: RequestId, expectedRevision?: number, ): Promise<DilemmaConversation>

/**
 * Switch the active branch without exposing DSH Session identities to the product consumer.
 * @param id - Owning durable dilemma id.
 * @param persona - Registered target persona; a missing branch is durably allocated before activation.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the dilemma is archived/deleting, any turn has not stopped, or branch allocation fails.
 */
async switchPersona( id: DilemmaId, persona: PersonaId, userRequestId: RequestId, expectedRevision?: number, ): Promise<DilemmaConversation>

/**
 * Replace the generated title with an explicit user-selected title.
 * @param id - Owning durable dilemma id.
 * @param title - Nonblank user-selected title; surrounding whitespace is removed.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the title is blank, the revision conflicts, or the dilemma is archived/deleting.
 */
async rename(id: DilemmaId, title: string, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation>

/**
 * Pause a discussion after cancelling its active persona turn, if any.
 * @param id - Owning durable dilemma id.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The paused projection after requesting cancellation and awaiting the active run within the stop timeout.
 * @throws If the revision conflicts or the dilemma is missing, deleting, or already stage-ended.
 */
async pause(id: DilemmaId, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation>

/**
 * Resume a paused or stage-ended discussion without creating a new dilemma or turn.
 * @param id - Owning durable dilemma id.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the revision conflicts or the dilemma is missing/deleting.
 */
async resumeDiscussion(id: DilemmaId, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation>

/**
 * Mark the current discussion stage ended; it remains readable and explicitly resumable.
 * @param id - Owning durable dilemma id.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The stage-ended projection after requesting cancellation and a bounded wait for the active run.
 * @throws If the revision conflicts or the dilemma is missing/deleting.
 */
async endStage(id: DilemmaId, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation>

/**
 * Validate and wait for one product-owned structured choice from the active Agent turn.
 * @param agent - Actual live Agent identity owning the product turn; omission cannot acquire product authority.
 * @param questions - Untrusted structured questions validated against the product choice schema.
 * @param signal - Optional cancellation signal for the current tool call.
 * @returns Validated user answers; repeated calls for the same pending operation share its waiter.
 * @throws If no live product lease owns the Agent, questions are invalid, or the choice is closed/cancelled.
 */
async askChoice(agent: Agent | undefined, questions: unknown, signal?: AbortSignal): Promise<readonly ChoiceAnswer[]>

/**
 * Answer one pending product choice and wake its waiting Agent turn.
 * @param id - Owning durable dilemma id.
 * @param choiceOperationId - Pending product choice operation belonging to this dilemma.
 * @param answers - Untrusted answers matched to the pending questions; explicit skip cannot contain answer content.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The conversation after the answer and resumed execution state are persisted.
 * @throws If the choice is not pending, answers are invalid, or the expected revision conflicts.
 */
async answerChoice( id: DilemmaId, choiceOperationId: OperationId, answers: unknown, userRequestId: RequestId, expectedRevision?: number, ): Promise<DilemmaConversation>

/**
 * Cancel a pending product choice and stop the owning Agent turn.
 * @param id - Owning durable dilemma id.
 * @param choiceOperationId - Pending product choice operation belonging to this dilemma.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The current projection after cancelling a pending choice and a bounded wait for its owning run.
 * @throws If the expected revision conflicts or the waiter does not belong to the claimed message lease.
 */
async cancelChoice( id: DilemmaId, choiceOperationId: OperationId, userRequestId: RequestId, expectedRevision?: number, ): Promise<DilemmaConversation>

/**
 * Mark a derived evidence entry challenged; only an explicit review restores it.
 * @param id - Owning durable dilemma id.
 * @param evidenceId - Stable evidence id from the configured research index.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @returns The conversation after persisting the challenge; a settled challenge cannot be submitted again directly.
 * @throws If evidence is unknown or its recorded lifecycle is no longer available.
 */
async challengeEvidence(id: DilemmaId, evidenceId: string, userRequestId: RequestId): Promise<DilemmaConversation>

/**
 * Withdraw evidence permanently from the current allow-list.
 * @param id - Owning durable dilemma id.
 * @param evidenceId - Stable evidence id from the configured research index.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If evidence is unknown or a different request already withdrew it.
 */
async withdrawEvidence(id: DilemmaId, evidenceId: string, userRequestId: RequestId): Promise<DilemmaConversation>

/**
 * Query available persona evidence through an Agent-bound capability, retaining its source trust and voice permissions.
 * @param agent - Actual live Agent identity owning the product turn; omission cannot acquire product authority.
 * @param topic - Search topic ranked only within the owning persona's configured evidence.
 * @param requestedCount - Requested result count; must be an integer from one to three.
 * @param signal - Optional cancellation signal for the current tool call.
 * @returns A bounded lookup outcome; unauthorized, exhausted, cancelled, and failed results contain no evidence.
 * @throws If durable evidence-claim reads or writes fail.
 */
async lookupEvidence( agent: Agent | undefined, topic: string, requestedCount: number, signal?: AbortSignal, ): Promise<EvidenceLookupResult>

/**
 * Restore challenged evidence only through an explicit review action.
 * @param id - Owning durable dilemma id.
 * @param evidenceId - Stable evidence id from the configured research index.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @returns The conversation after restoring challenged evidence; direct replay requires it to be challenged again.
 * @throws If the configured evidence is missing or its latest lifecycle is not challenged.
 */
async reviewEvidence(id: DilemmaId, evidenceId: string, userRequestId: RequestId): Promise<DilemmaConversation>

/**
 * Analyze the durable conversation once; concurrent callers share one run.
 * @param id - Owning durable dilemma id.
 * @param stateOperationId - Stable state-analysis operation id.
 * @returns The durable conversation after analysis settlement; late results remain stale and terminal ids do not rerun the provider.
 * @throws If the dilemma/Agent is unavailable or claiming/persisting analysis fails; model/parse failures become durable failed facts.
 */
async analyzeState(id: DilemmaId, stateOperationId: OperationId = operationId(`state:${id}`)): Promise<DilemmaConversation>

/**
 * Retry only a failed state-analysis operation using its durable input watermark.
 * @param id - Owning durable dilemma id.
 * @param stateOperationId - Stable state-analysis operation id.
 * @param retryOperationId - New durable retry identity; repeated use returns that attempt without another provider request.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the source analysis is not failed or lacks the persisted persona/input needed for retry.
 */
async retryState(id: DilemmaId, stateOperationId: OperationId, retryOperationId: OperationId): Promise<DilemmaConversation>

/**
 * Validate and persist structured claims against the private assistant event for one turn.
 * @param id - Owning durable dilemma id.
 * @param turnId - Completed turn whose exact structured submission is still available.
 * @param claims - Complete contiguous UTF-16 answer ranges with claim kinds and same-turn evidence ids.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the turn/submission, evidence permission, claim partition, or evidence revision is invalid.
 */
async submitClaims( id: DilemmaId, turnId: TurnOperationId, claims: readonly ClaimSidecarInput[], userRequestId: RequestId, ): Promise<DilemmaConversation>

/**
 * Withdraw one active cross-persona acknowledgement without rewriting history.
 * @param id - Owning durable dilemma id.
 * @param acknowledgementId - Active acknowledgement id whose cross-persona context permission is withdrawn.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @returns The conversation after withdrawing the active acknowledgement; repeating the transition directly is rejected.
 * @throws If no active acknowledgement has that id.
 */
async withdrawPersonaAcknowledgement(id: DilemmaId, acknowledgementId: string, userRequestId: RequestId): Promise<DilemmaConversation>

/**
 * Accept one structured final answer from the actual Agent owning the live turn lease.
 * @param agent - Actual live Agent identity owning the product turn; omission cannot acquire product authority.
 * @param input - Untrusted ordered answer segments; Host derives text ranges and validates same-turn evidence.
 * @returns The accepted immutable in-memory submission; identical submissions reuse the existing value.
 * @throws If the Agent lease is missing/closed, input or evidence is invalid, or a different submission was already accepted.
 */
async acceptPersonaTurnSubmission(agent: Agent | undefined, input: unknown): Promise<PersonaTurnSubmission>

/**
 * Persist one user message, drive only its target Agent, then reconcile Session event ids.
 * @param id - Owning durable dilemma id.
 * @param options - Stable message/delivery/turn/request ids, text, optional reply target, and optional durable-acknowledgement mode.
 * @returns The durable claim projection when acknowledgeOnly is true; otherwise the settled persona-turn projection.
 * @throws If lifecycle/revision/lease checks fail or execution fails; blocked safety input instead records a provider-free reply.
 */
async submitMessage(id: DilemmaId, options: SubmitMessageOptions): Promise<DilemmaConversation>

/**
 * Retry one failed persona attempt without appending another product user message.
 * @param id - Owning durable dilemma id.
 * @param message - Original product user message id; retry does not append another user message.
 * @param failedTurn - Failed turn attempt to retry; the prior delivery must also have failed.
 * @param userRequestId - Stable request id used to deduplicate the product mutation.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The durable conversation after the accepted mutation or an idempotent replay.
 * @throws If the source attempt is not retryable, another run is active, or the dilemma is archived/deleting.
 */
async retryMessage( id: DilemmaId, message: ProductMessageId, failedTurn: TurnOperationId, userRequestId: RequestId, expectedRevision?: number, ): Promise<DilemmaConversation>

/**
 * Cancel the active target Agent and publish the durable terminal turn state.
 * @param id - Owning durable dilemma id.
 * @param messageId - Product message identity bound to the live operation.
 * @param deliveryId - Matching delivery operation identity.
 * @param turnId - Matching turn operation identity.
 * @param expectedRevision - Optional expected lifecycle revision; a mismatch rejects the mutation.
 * @returns The durable terminal projection after a bounded stop wait; stop-failed/unknown stays locked until actual quiescence.
 * @throws If identities do not match the claimed lease, the turn is not cancellable, or the revision conflicts.
 */
async cancelMessage( id: DilemmaId, messageId: ProductMessageId, deliveryId: DeliveryOperationId, turnId: TurnOperationId, expectedRevision?: number, ): Promise<DilemmaConversation>

/**
 * Reconcile a claimed operation from existing Session events without calling the model.
 * @param id - Owning durable dilemma id.
 * @param options - Claimed message, delivery, and turn identities to recover from their existing Session facts.
 * @returns The reconciled projection; absent Session user events leave it unchanged and invalid submissions settle as failed.
 * @throws If the claimed message or owning live Agent is unavailable, or durable reconciliation fails.
 */
async reconcileMessage(id: DilemmaId, options: ReconcileMessageOptions): Promise<DilemmaConversation>

/** Stop owned agents and release the product medium during plugin teardown. */
async close(): Promise<void>
```

Types: [Agent](core.zh.md) · [AgentOptions](core.zh.md)

Source: [`packages/extensions/man-roleplayer/src/service.ts`](../../packages/extensions/man-roleplayer/src/service.ts)

<a id="ctxmanroleplayerremote--manroleplayerremoteservice"></a>

### `ctx.manRoleplayerRemote` — `ManRoleplayerRemoteService`

Remote service exposing only redacted product projections and handles. Request and operation failures are mapped to typed results; reads/projection failures outside the operation mapper can reject the returned promise and must be handled by the transport caller.

```ts cordis-catalog
/**
 * List the audited persona roster without exposing deployment bindings.
 * @param request - Protocol version; only version 1 is accepted.
 * @returns The persona roster, or invalid-request for an unsupported version.
 */
@Remote('listPersonas') listPersonas(request: { readonly version: number }): Promise<RoleplayerRosterResult>

/**
 * List redacted dilemma projections, excluding archived records unless requested.
 * @param request - Protocol version and optional archive inclusion.
 * @returns Redacted projections or a typed request/Host failure.
 */
@Remote('list') async list(request: RoleplayerListRequest): Promise<RoleplayerListResult>

/**
 * Create an idempotent blank dilemma with one explicitly selected persona or the omitted legacy pair.
 * @param request - Protocol version, request id, active persona, and optional single-persona selection.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('create') async create(request: RoleplayerCreateRequest): Promise<RoleplayerProjectionResult>

/**
 * Resolve an opaque handle to its current redacted product projection.
 * @param request - Protocol version and opaque dilemma handle.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('getProjection') async getProjection(request: RoleplayerHandleRequest): Promise<RoleplayerProjectionResult>

/**
 * Archive a dilemma while retaining its readable history.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('archive') async archive(request: RoleplayerMutationRequest): Promise<RoleplayerProjectionResult>

/**
 * Restore an archived dilemma for mutations.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('restore') async restore(request: RoleplayerMutationRequest): Promise<RoleplayerProjectionResult>

/**
 * Persist a user-owned title and suppress late automatic title replacement.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('rename') async rename(request: RoleplayerRenameRequest): Promise<RoleplayerProjectionResult>

/**
 * Pause the discussion and request cancellation of its active turn.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('pause') async pause(request: RoleplayerMutationRequest): Promise<RoleplayerProjectionResult>

/**
 * Resume a paused or ended discussion without replaying a persona turn.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('resume') async resume(request: RoleplayerMutationRequest): Promise<RoleplayerProjectionResult>

/**
 * End the current stage and request cancellation of its active turn.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('endStage') async endStage(request: RoleplayerMutationRequest): Promise<RoleplayerProjectionResult>

/**
 * Activate a persona after the current turn has stopped, allocating its branch when needed.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('switchPersona') async switchPersona(request: RoleplayerSwitchRequest): Promise<RoleplayerProjectionResult>

/**
 * Persist validated answers and wake the matching product choice waiter.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('answerChoice') async answerChoice(request: RoleplayerChoiceAnswerRequest): Promise<RoleplayerProjectionResult>

/**
 * Cancel the matching pending choice and request its Agent to stop.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('cancelChoice') async cancelChoice(request: RoleplayerChoiceCancelRequest): Promise<RoleplayerProjectionResult>

/**
 * Confirm a candidate for future shared context.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('confirmState') async confirmState(request: RoleplayerStateRequest): Promise<RoleplayerProjectionResult>

/**
 * Supersede a candidate or confirmed item with a user-confirmed correction.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('modifyState') async modifyState(request: RoleplayerStateModifyRequest): Promise<RoleplayerProjectionResult>

/**
 * Reject a candidate while retaining its durable history.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('rejectState') async rejectState(request: RoleplayerStateRequest): Promise<RoleplayerProjectionResult>

/**
 * Withdraw a confirmed item from future shared context.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('withdrawState') async withdrawState(request: RoleplayerStateRequest): Promise<RoleplayerProjectionResult>

/**
 * Resolve an unresolved candidate without deleting history.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('resolveState') async resolveState(request: RoleplayerStateRequest): Promise<RoleplayerProjectionResult>

/**
 * Remove challenged evidence from the current allow-list.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('challengeEvidence') async challengeEvidence(request: RoleplayerEvidenceRequest): Promise<RoleplayerProjectionResult>

/**
 * Restore only explicitly challenged evidence after user review.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('reviewEvidence') async reviewEvidence(request: RoleplayerEvidenceRequest): Promise<RoleplayerProjectionResult>

/**
 * Withdraw evidence so review cannot restore it.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('withdrawEvidence') async withdrawEvidence(request: RoleplayerEvidenceRequest): Promise<RoleplayerProjectionResult>

/**
 * Acknowledge durable delivery/turn claims while the persona answer continues in the background.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('submit') async submit(request: RoleplayerSubmitRequest): Promise<RoleplayerProjectionResult>

/**
 * Retry one failed persona attempt without appending another product user message.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('retryMessage') async retryMessage(request: RoleplayerRetryRequest): Promise<RoleplayerProjectionResult>

/**
 * Retry failed analysis using its persisted input and a stable retry id.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('retryState') async retryState(request: RoleplayerStateRetryRequest): Promise<RoleplayerProjectionResult>

/**
 * Cancel the matching live message lease without requiring the stale pre-submit revision.
 * @param request - Protocol version, handle, and matching live message/delivery/turn identities; expectedRevision is ignored.
 * @returns The redacted product projection on success, or a typed request/lifecycle/Host failure.
 */
@Remote('cancel') async cancel(request: RoleplayerCancelRequest): Promise<RoleplayerProjectionResult>

/**
 * Delete all dilemma branch histories and product facts using a recoverable operation and minimal receipt.
 * @param request - Versioned request with an opaque handle, idempotency key, expected lifecycle revision, and operation fields.
 * @returns A minimal deleted acknowledgement on completion/replay, or a typed failure with a retryable deletion checkpoint.
 */
@Remote('delete') async delete(request: RoleplayerDeleteRequest): Promise<RoleplayerDeleteResult>
```

Source: [`packages/extensions/man-roleplayer/src/remote.ts`](../../packages/extensions/man-roleplayer/src/remote.ts)
<!-- END GENERATED cordis-surface -->
