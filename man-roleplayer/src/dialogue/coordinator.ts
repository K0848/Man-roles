import { deterministicSafetyGate, mergeSafetyDecision } from './safety.ts'
import { type ControlClassifier } from './control-classifier.ts'
import { decideTurn } from './turn-policy.ts'
import { commitFeedback, feedbackPayloadSchema, type FeedbackPayload } from './feedback-commit.ts'
import { commitDirectorUpdate } from './director-update.ts'
import { buildActorContext, validateSelectedHistoricalRawRefs } from './public-view.ts'
import type { ActorResult } from '../runtime/submit-actor-reply.ts'
import type { PersonaId } from '../domain/schema.ts'
import type { TrunkStorage } from '../storage/trunk-storage.ts'
import type { PersonaRegistry } from '../persona/registry.ts'
import type { DeliverCurrentUserMessageInput, DeliveryResult } from '../runtime/message-delivery.ts'
import { deliverCurrentUserMessage } from '../runtime/message-delivery.ts'
import { interpretTurn, type TurnInterpretation } from './turn-interpreter.ts'
import { selectHistory } from '../context/select-history.ts'
export { feedbackPayloadSchema, commitFeedback } from './feedback-commit.ts'

export interface ActorExecutionBoundary { answerExists(input: { messageId: string; personaId: PersonaId }): Promise<boolean> | boolean; loadExisting(input: { messageId: string; personaId: PersonaId }): Promise<ActorResult> | ActorResult; run(input: { context: ReturnType<typeof buildActorContext>; policy: ReturnType<typeof decideTurn>; candidates: ReturnType<typeof buildActorContext>['candidateItems'] }): Promise<ActorResult> }
export interface DialogueCoordinatorDeps { registry: PersonaRegistry; trunk: TrunkStorage; delivery: Omit<DeliverCurrentUserMessageInput, 'trunk' | 'persona' | 'messageId' | 'text'>; classifier: ControlClassifier; director: (input: { raw: string; personaId: PersonaId; currentRawRef: string }) => Promise<unknown>; actor: ActorExecutionBoundary; loadCurrentBranchHistory: (input: { personaId: PersonaId; sessionId: string }) => Promise<readonly string[]> | readonly string[] }
export interface DialogueTurnInput { raw: string; taskId: string; personaId: PersonaId; messageId: string; eventPurposePrefix: string; selectedHistoricalRawRefs?: string[]; feedback?: FeedbackPayload }
export interface V2DialogueDeps extends Omit<DialogueCoordinatorDeps, 'classifier'> { interpreter?: (raw: string) => TurnInterpretation; contextBudgetTokens?: number }
const meta = (input: DialogueTurnInput, refs: string[], suffix: string) => ({ messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurposePrefix}:${suffix}`, sourceRawRefs: refs })
const fail = (code: string, error: unknown, calls: Record<string, number>) => ({ status: 'failed' as const, error: { code, message: error instanceof Error ? error.message : String(error) }, calls })

/**
 * V2 no longer writes legacy task/phase events, but the Actor tool still
 * needs one deterministic policy. Derive its intent and allowed controls from
 * the V2 interpretation, but do not create a question-count gate: relevance
 * plus turn/token/payload budgets govern clarification depth.
 */
function v2TurnInstruction(interpretation: TurnInterpretation): ReturnType<typeof decideTurn> {
  if (interpretation.feedback === 'end') return { intent: 'close', allowedControls: [], shouldRunDirector: false, shouldOfferNewConversation: false }
  if (interpretation.feedback === 'pause') return { intent: 'pause', allowedControls: ['continue', 'end'], shouldRunDirector: false, shouldOfferNewConversation: false }
  if (interpretation.responseNeeds.clarify) return { intent: 'clarify', allowedControls: ['continue', 'skip', 'pause', 'end'], shouldRunDirector: false, shouldOfferNewConversation: false }
  return { intent: 'answer', allowedControls: ['continue', 'end'], shouldRunDirector: false, shouldOfferNewConversation: false }
}

/** Required product command: no receive-only or optional dependency bypass exists. */
export async function runDialogueTurn(input: DialogueTurnInput, deps: DialogueCoordinatorDeps) {
  const calls = { director: 0, actor: 0, retrieval: 0 }
  const personaId = deps.registry.get(input.personaId).id
  let delivered: DeliveryResult
  try { delivered = await deliverCurrentUserMessage({ ...deps.delivery, trunk: deps.trunk, persona: personaId, messageId: input.messageId, text: input.raw }) } catch (error) { return fail('delivery-failed', error, calls) }
  if (delivered.status !== 'committed' || !delivered.canStartGeneration) return { ...fail('delivery_not_committed', delivered.error ?? 'delivery pending', calls), delivery: delivered }
  const refs = [delivered.rawRef]
  const gate = deterministicSafetyGate(input.raw)
  if (gate.disposition !== 'allow') return { status: gate.disposition, safety: gate, calls, reply: gate.message, delivery: delivered }
  let selectedHistoricalRawRefs: string[]
  try { selectedHistoricalRawRefs = validateSelectedHistoricalRawRefs(deps.trunk.state, input.selectedHistoricalRawRefs ?? []) } catch (error) {
    return { ...fail('historical-raw-invalid', error, calls), delivery: delivered }
  }
  const existingAnswerBeforeControl = await deps.actor.answerExists({ messageId: input.messageId, personaId })
  if (existingAnswerBeforeControl) {
    const loaded = await deps.actor.loadExisting({ messageId: input.messageId, personaId })
    if (loaded === undefined) return { ...fail('existing-answer-missing', 'answerExists=true but loadExisting returned undefined', calls) }
    if (loaded.progressSummary !== undefined && loaded.progressSummary !== null && deps.trunk.state.branchProgress[personaId]?.summary !== loaded.progressSummary) {
      try { deps.trunk.updateBranchProgress({ personaId, summary: loaded.progressSummary, lastSemanticSeq: deps.trunk.nextSeq }, meta(input, [delivered.rawRef], 'progress')) } catch (error) { return { ...fail('progress-failed', error, calls), reply: loaded } }
    }
    calls.retrieval = 0
    return { status: 'ok' as const, reply: loaded, calls, delivery: delivered }
  }
  const control = await deps.classifier.classify({ raw: input.raw, phase: deps.trunk.state.dialogue?.phase ?? 'responding' })
  const classifiedSafety = mergeSafetyDecision(deterministicSafetyGate(input.raw), { disposition: control.safety, reason: control.safetyReason })
  if (classifiedSafety.disposition !== 'allow') return { status: classifiedSafety.disposition, control, safety: classifiedSafety, calls, reply: classifiedSafety.message, delivery: delivered }
  let feedback: FeedbackPayload
  try { feedback = feedbackPayloadSchema.parse(input.feedback ?? { kind: control.feedbackKind }) } catch (error) { return { ...fail('feedback-invalid', error, calls), control } }
  if (feedback.kind !== control.feedbackKind) return { ...fail('feedback_kind_mismatch', 'feedback payload kind differs from classifier', calls), control }
  try { deps.trunk.recordTaskRouted({ ...meta(input, refs, 'route'), taskMode: control.taskMode, confidence: control.confidence }) } catch (error) { return { ...fail('route-failed', error, calls), control } }
  try {
    if (feedback.kind !== 'none' && feedback.kind !== 'unclear') {
      commitFeedback({ trunk: deps.trunk, state: deps.trunk.state, kind: feedback.kind, personaId, messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurposePrefix}:feedback`, sourceRawRefs: refs, ...(feedback.itemId === undefined ? {} : { itemId: feedback.itemId }), ...(feedback.replacement === undefined ? {} : { replacement: feedback.replacement }), ...(feedback.details === undefined ? {} : { details: feedback.details }) })
    }
  } catch (error) { return { ...fail('feedback-deferred', error, calls), control } }
  const existingCandidate = deps.trunk.state.dilemmaItems.some((item) => item.status === 'candidate' && item.proposedByPersona === personaId && !item.supersededBy)
  const policy = decideTurn({ taskMode: control.taskMode, feedbackKind: control.feedbackKind, phase: deps.trunk.state.dialogue?.phase ?? 'responding', hasCandidate: existingCandidate, hasConfirmed: deps.trunk.state.dilemmaItems.some((item) => item.status === 'confirmed' && !item.supersededBy), noProgressCount: deps.trunk.state.dialogue?.noProgressCount ?? 0, emotionPriority: control.emotionPriority, independentNewDilemma: control.independentNewDilemma })
  const phaseByIntent = policy.intent === 'pause' ? 'paused' : policy.intent === 'close' ? 'closed' : policy.intent === 'clarify' ? 'clarifying' : policy.intent === 'await-confirmation' ? 'awaiting-confirmation' : policy.intent === 'reflect' ? 'reflecting' : 'responding'
  const nextControl = { taskMode: control.taskMode, phase: phaseByIntent, noProgressCount: deps.trunk.state.dialogue?.noProgressCount ?? 0, lastControlSeq: deps.trunk.state.dialogue?.lastControlSeq ?? -1, ...(feedback.kind === 'none' ? {} : { selectedAction: feedback.kind }) }
  const phaseKey = `${input.messageId}\u0000${input.taskId}\u0000${input.eventPurposePrefix}:phase`
  try { if (!deps.trunk.state.dialogueCommits[phaseKey] && (!deps.trunk.state.dialogue || deps.trunk.state.dialogue.phase !== nextControl.phase || deps.trunk.state.dialogue.taskMode !== nextControl.taskMode)) deps.trunk.setDialogueControl(nextControl, meta(input, refs, 'phase')) } catch (error) { return { ...fail('phase-failed', error, calls), control, policy } }
  const current = deps.trunk.state.userRaws.find((r) => r.rawRef === delivered.rawRef)
  if (!current) return { ...fail('current_raw_missing', delivered.rawRef, calls), control, policy }
  let candidateItems = deps.trunk.state.dilemmaItems.filter((x) => x.status === 'candidate' && x.proposedByPersona === personaId && x.visibility === 'origin-persona-only' && !x.supersededBy).map((x) => ({ ...x, unconfirmed: true as const }))
  let directorError: string | undefined
  if (policy.shouldRunDirector) { calls.director++; try { const update = await deps.director({ raw: current.text, personaId, currentRawRef: delivered.rawRef }); commitDirectorUpdate({ update, state: deps.trunk.state, personaId, trunk: deps.trunk, messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurposePrefix}:director`, sourceRawRefs: refs }); candidateItems = deps.trunk.state.dilemmaItems.filter((x) => x.status === 'candidate' && x.proposedByPersona === personaId && x.visibility === 'origin-persona-only' && !x.supersededBy).map((x) => ({ ...x, unconfirmed: true as const })) } catch (error) { directorError = error instanceof Error ? error.message : String(error) } }
  const sessionId = deps.trunk.state.branchesIndex[personaId]
  if (!sessionId) return { ...fail('branch-session-missing', personaId, calls), control, policy }
  let branchHistory: readonly string[]
  try { branchHistory = await deps.loadCurrentBranchHistory({ personaId, sessionId }) } catch (error) { return { ...fail('branch-history-failed', error, calls), control, policy } }
  const context = buildActorContext(deps.trunk.state, personaId, deps.registry, delivered.rawRef, selectedHistoricalRawRefs, branchHistory)
  let reply: ActorResult
  calls.actor++; try { reply = await deps.actor.run({ context, policy, candidates: candidateItems }) } catch (error) { return { ...fail('actor-failed', error, calls), control, policy } }
  const summary = reply.progressSummary ?? null
  if (summary !== null && deps.trunk.state.branchProgress[personaId]?.summary !== summary) {
    try { deps.trunk.updateBranchProgress({ personaId, summary, lastSemanticSeq: deps.trunk.nextSeq }, meta(input, refs, 'progress')) } catch (error) { return { ...fail('progress-failed', error, calls), control, policy, reply } }
  }
  calls.retrieval = reply.retrievalCalls ?? 0
  return { status: 'ok' as const, control, policy, reply, candidate: candidateItems, ...(directorError ? { directorError } : {}), calls, delivery: delivered }
}

/** Product v2 entry. Legacy task routing/semantic phase events are deliberately absent. */
export async function runDialogueTurnV2(input: DialogueTurnInput, deps: V2DialogueDeps) {
  const calls = { director: 0, actor: 0, retrieval: 0, interpreter: 0 }
  const personaId = deps.registry.get(input.personaId).id
  let delivery: DeliveryResult
  try { delivery = await deliverCurrentUserMessage({ ...deps.delivery, trunk: deps.trunk, persona: personaId, messageId: input.messageId, text: input.raw }) } catch (error) { return fail('delivery-failed', error, calls) }
  if (delivery.status !== 'committed' || !delivery.canStartGeneration) return { ...fail('delivery-not-committed', delivery.error ?? 'delivery pending', calls), delivery }
  return runDialogueTurnV2AfterDelivery(input, deps, delivery)
}

/**
 * Product task entry after the durable Branch delivery boundary.  Host
 * ProductService uses this form so retry/recovery never appends the user raw a
 * second time before running the Actor.
 */
export async function runDialogueTurnV2AfterDelivery(input: DialogueTurnInput, deps: V2DialogueDeps, delivery: DeliveryResult) {
  const calls = { director: 0, actor: 0, retrieval: 0, interpreter: 0 }
  const personaId = deps.registry.get(input.personaId).id
  if (delivery.status !== 'committed' || !delivery.canStartGeneration) return { ...fail('delivery-not-committed', delivery.error ?? 'delivery pending', calls), delivery }
  const safety = deterministicSafetyGate(input.raw)
  if (safety.disposition !== 'allow') return { status: safety.disposition, safety, calls, delivery, reply: safety.message }
  const current = deps.trunk.state.userRaws.find(raw => raw.rawRef === delivery.rawRef)
  if (!current) return { ...fail('current-raw-missing', delivery.rawRef, calls), delivery }
  const existingAnswer = await deps.actor.answerExists({ messageId: input.messageId, personaId })
  if (existingAnswer) {
    const loaded = await deps.actor.loadExisting({ messageId: input.messageId, personaId })
    if (loaded === undefined) return { ...fail('existing-answer-missing', 'answerExists=true but loadExisting returned undefined', calls), delivery }
    if (loaded.progressSummary !== undefined && loaded.progressSummary !== null && deps.trunk.state.branchProgress[personaId]?.summary !== loaded.progressSummary) {
      try { deps.trunk.updateBranchProgress({ personaId, summary: loaded.progressSummary, lastSemanticSeq: deps.trunk.nextSeq }, { messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurposePrefix}:progress`, sourceRawRefs: [delivery.rawRef] }) } catch (error) { return { ...fail('progress-failed', error, calls), reply: loaded, delivery } }
    }
    return { status: 'ok' as const, calls, delivery, reply: loaded }
  }
  calls.interpreter++
  const interpretation = (deps.interpreter ?? interpretTurn)(current.text)
  if (interpretation.safetyEscalation !== 'none') return { status: interpretation.safetyEscalation, interpretation, calls, delivery }
  const hasCandidate = deps.trunk.state.dilemmaItems.some(item => item.status === 'candidate' && item.proposedByPersona === personaId && !item.supersededBy)
  let candidates = deps.trunk.state.dilemmaItems.filter(item => item.status === 'candidate' && item.proposedByPersona === personaId && !item.supersededBy).map(item => ({ ...item, unconfirmed: true as const }))
  if (interpretation.responseNeeds.proposeCandidate && !hasCandidate) {
    calls.director++
    try {
      const update = await deps.director({ raw: current.text, personaId, currentRawRef: delivery.rawRef })
      // Candidate remains origin-persona-only until explicit Product feedback.
      // A malformed/failed director is isolated so the Actor can still reply.
      if (update !== undefined) commitDirectorUpdate({ update, state: deps.trunk.state, personaId, trunk: deps.trunk, messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurposePrefix}:director`, sourceRawRefs: [delivery.rawRef] })
    } catch { /* candidate failure is isolated from actor */ }
    candidates = deps.trunk.state.dilemmaItems.filter(item => item.status === 'candidate' && item.proposedByPersona === personaId && !item.supersededBy).map(item => ({ ...item, unconfirmed: true as const }))
  }
  const sessionId = deps.trunk.state.branchesIndex[personaId]
  if (!sessionId) return { ...fail('branch-session-missing', personaId, calls), interpretation, delivery }
  const history = await deps.loadCurrentBranchHistory({ personaId, sessionId })
  const historyItems = history.map((text, index) => ({ rawRef: `branch-${personaId}-${index}`, text, personaId }))
  const selected = selectHistory({ currentRaw: current, candidates: deps.trunk.state.userRaws, confirmedRawRefs: deps.trunk.state.dilemmaItems.filter(item => item.status === 'confirmed').flatMap(item => item.sourceRawRefs), budgetTokens: deps.contextBudgetTokens ?? 4000, personaId, branchHistory: historyItems })
  const trunkRefs = new Set(deps.trunk.state.userRaws.map(raw => raw.rawRef))
  const context = buildActorContext(deps.trunk.state, personaId, deps.registry, delivery.rawRef, selected.selectedRawRefs.filter(ref => ref !== delivery.rawRef && trunkRefs.has(ref)), history)
  const policy = v2TurnInstruction(interpretation)
  calls.actor++
  let reply: ActorResult
  try { reply = await deps.actor.run({ context, policy, candidates }) } catch (error) { return { ...fail('actor-failed', error, calls), interpretation, context, delivery } }
  calls.retrieval = reply.retrievalCalls ?? 0
  if (reply.progressSummary !== undefined && deps.trunk.state.branchProgress[personaId]?.summary !== reply.progressSummary) deps.trunk.updateBranchProgress({ personaId, summary: reply.progressSummary, lastSemanticSeq: deps.trunk.nextSeq }, { messageId: input.messageId, taskId: input.taskId, eventPurpose: `${input.eventPurposePrefix}:progress`, sourceRawRefs: [delivery.rawRef] })
  return { status: 'ok' as const, interpretation, context, candidate: candidates, reply, calls, delivery }
}
