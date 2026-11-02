# Man-roleplayer product

English | [中文](man-roleplayer.zh.md)

Reference for the historical-persona dilemma domain in [man-roleplayer](../../packages/extensions/man-roleplayer/README.md): product identity, durable state, evidence acceptance, and Host calls versus browser Remote commands. The [client README](../../packages/client/ui-man-roleplayer/README.md) owns browser interaction; the [profile README](../../packages/bundle/man-roleplayer-app/README.md) owns composition and deployment.

Sources: [product facts](../../packages/extensions/man-roleplayer/src/product/index.ts), [wire types](../../packages/extensions/man-roleplayer/src/types.ts), [Host service](../../packages/extensions/man-roleplayer/src/service.ts), [Remote facade](../../packages/extensions/man-roleplayer/src/remote.ts), and [evidence validation](../../packages/extensions/man-roleplayer/src/evidence.ts). These declarations and generated API sections own exact fields and signatures; this page explains their relationships.

## Identity and ownership

| Type family | Scope and meaning |
| --- | --- |
| `DilemmaId` | Host identity for one durable product log and its persona branches, distinct from DSH Session identity. The browser receives an opaque `DilemmaHandle`. |
| `PersonaId` | Registered persona shared by deployment bindings, branch membership and browser selection. Availability comes from the Host roster; presentation metadata cannot authorize a branch. |
| `RequestId` | Stable mutation deduplication identity. Reuse means replaying the same request, not issuing a new command. Blank creation checks existing conversations before allocating a dilemma. |
| `OperationId` | Durable identity for a choice, analysis, deletion or other product operation, retained beyond one network response. |
| `ProductMessageId` | Local alias in the Host service signatures for the product module's exported `MessageId`. It identifies the durable product user message shared across attempts, distinct from the core LLM message identity; the product export remains named `MessageId`. |
| `DeliveryOperationId`, `TurnOperationId` | Separate attempts to deliver a message into its persona Session and execute its turn. Retry preserves the original message identity but allocates new attempts. |

Branding helpers neither validate nor allocate identities. The Remote converts browser request and operation brands without granting raw Session access. Only the Host service holds both the product-to-Session relationship and the live Agents it must stop before deletion.

## Durable conversation and execution

`DilemmaConversation` is replayed from append-only product facts: branch membership, allocation checkpoints, title ownership, discussion admission, timeline references and current state. Persona answer bodies remain in private Sessions; the product timeline references accepted source events instead of keeping another answer copy.

The analysis revision and `lifecycleRevision` have different purposes. Browser `RoleplayerProjection.revision` is the lifecycle revision used for optimistic mutation checks. Activity, execution, budget, context-projection and state-analysis progress do not advance it; accepted product mutations do. Automatic titles have a separate revision and user-ownership check, preventing late generation from replacing an explicit rename.

`ExecutionState` distinguishes running, waiting-user, stopping, stopped, stop-failed and unknown execution from the completed/failed/cancelled turn outcome. Cancellation does not prove Agent quiescence. Persona switching remains unavailable during active or unsettled execution. Paused or stage-ended discussions require explicit resume before another turn.

## Evidence and structured choices

`EvidenceLookupResult` distinguishes completed research from unauthorized, budget-exhausted, cancelled and failed attempts. Only the owning live persona execution can use its configured index. A completed empty result is a valid zero-hit lookup; failure is not successful research. Product facts retain evidence identities and lifecycle status; displayed source text is derived from the index.

`ClaimSidecarInput` partitions a complete answer into contiguous UTF-16 ranges, claim categories and evidence references. Quotes, historical facts and attribution require permitted evidence actually returned to that turn. Modern inference and insufficient-evidence segments cannot attach evidence ids. Host checks also enforce persona, source kind, trust and current availability. Challenge or withdrawal makes affected historical claims stale without rewriting their text.

`PersonaTurnSubmission` is the Host-accepted structured submission for one exact live turn, with text, computed Claim ranges and captured evidence revision; it is not arbitrary assistant text or browser input. The model submits ordered text segments and the Host computes their ranges. Identical resubmission returns the existing submission; a different second submission for that lease is rejected. Final settlement still checks evidence freshness.

`ChoiceAnswer` settles one question in a pending product choice belonging to a persona-turn operation. Selected labels, custom text and explicit skip are distinct; an empty answer alone is not skip. Settlement wakes only the matching live waiter. Cold recovery fails an unresolved waiter instead of replaying the persona turn.

## Shared state and persona snapshots

`SharedStateItem` is a sourced, versioned fact, goal, conflict, unresolved issue or understanding with a user-governed lifecycle. Model proposals normally remain candidates. Automatic confirmation requires an exact fact/goal quote from one allowed user expression verified by the Host; the model's confirmation label alone is insufficient. Only confirmed items enter shared context. Rejecting, superseding, withdrawing or resolving preserves history while changing future use.

`PersonaSnapshot` records one persona's current understanding, core view and optional advice from a completed turn, with source references. It is neither shared user truth nor another persona's private answer. Analysis results must match the captured input watermark, product revision and completed-branch revision before committing. Analysis retry uses persisted input without replaying the persona answer.

`StateItemModifyOptions` contains a user-authored correction and optional classification. Modification supersedes a candidate or confirmed item with a separately identified, confirmed replacement; it does not overwrite the original or restore a browser snapshot.

## Host calls and recovery

`CreateDilemmaOptions` supplies a Host-owned dilemma id, stable request and explicit isolated branch Sessions. Browser blank creation instead asks the Host to allocate them. Branch personas must be distinct and include the active persona; a missing branch receives a durable allocation claim before membership is published.

`SubmitMessageOptions` separates message, delivery and turn identities, optionally referencing an accepted answer as a reply target. Normal Host calls wait for execution results. Browser Remote submission uses `acknowledgeOnly` to return after durable delivery/turn claims while the answer continues in the background. Success proves acknowledgement, not answer completion or acceptance; subsequent Host projections and terminal facts determine completion.

`ReconcileMessageOptions` identifies an already claimed message/delivery/turn tuple. Recovery verifies corresponding Session facts and structured submission, then settles existing operations without another user message. Host calls can reject on lifecycle, execution, model or persistence failures; checkpoint-returning methods can also return durable failed operations as values.

## Remote commands and results

Browser commands use the supported protocol version. `RoleplayerListRequest` controls archive inclusion and `RoleplayerHandleRequest` resolves an opaque handle. `RoleplayerCreateRequest` explicitly selects one initial persona with a stable creation request. Omission retains the legacy pair for older callers; explicit multi-persona creation is rejected by the Remote.

`RoleplayerMutationRequest` adds a stable request and expected lifecycle revision. The facade checks accepted request identities before reporting revision conflicts and returns a fresh projection for replay. A new command with a stale revision must reload and reconsider its mutation. Direct Host methods have operation-specific ordering and optional revision arguments; they do not all provide the facade's replay-before-revision behavior.

| Command data family | Required relationship |
| --- | --- |
| `RoleplayerRenameRequest`, `RoleplayerSwitchRequest` | User-owned title or target persona under lifecycle and stopped-turn requirements. |
| `RoleplayerSubmitRequest`, `RoleplayerRetryRequest`, `RoleplayerCancelRequest` | Exact message and execution attempt. Retry names a failed attempt without duplicating the user message. Cancel uses the matching live message/delivery/turn lease and ignores the stale pre-submit revision. |
| `RoleplayerChoiceAnswerRequest`, `RoleplayerChoiceCancelRequest` | Matching pending choice operation, not raw DSH question or tool-call identity. |
| `RoleplayerStateRequest`, `RoleplayerStateModifyRequest`, `RoleplayerStateRetryRequest` | Stable state item or failed analysis identity; analysis retry also carries its stable retry operation. |
| `RoleplayerEvidenceRequest` | Evidence identity for challenge, explicit review or withdrawal. Review restores challenged evidence, never withdrawn evidence. |
| `RoleplayerDeleteRequest` | One deletion operation retained through checkpoints and response-loss recovery. |

`RoleplayerListResult` and `RoleplayerRosterResult` return redacted conversations and selectable persona names; `RoleplayerProjectionResult` returns one current projection. They discriminate success and browser-safe failure instead of exposing Host exceptions. Transport errors and reads/projection assembly outside the operation error mapper can still reject the promise. Callers handle both result failures and promise rejection.

## Deletion checkpoints and receipts

`DeletionOperation` captures branch targets and completed removals before destructive Session deletion. Requested deletion can be cancelled before execution starts. An irreversible operation can only resume the same identity; failure retains its retry stage. Agents must stop before branch histories are removed, and all captured branches must be gone before product facts are removed.

`DeletionReceipt` is product-global proof retained outside the deleted conversation. Its pending/completed status and opaque-handle digest support response-loss recovery without keeping conversation text. Pending alone is not completion: recovery establishes removal before success. `RoleplayerDeleteResult` returns only the handle and `deleted: true` on completion or valid receipt replay; failure returns typed retry information rather than an empty conversation projection.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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

Types: [Agent](core.md) · [AgentOptions](core.md)

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
