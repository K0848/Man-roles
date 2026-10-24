/**
 * Host orchestration for durable variable-branch dilemma conversations.
 *
 * The product log owns the conversation relation and deletion checkpoints;
 * DSH owns each private Session and AgentHandle. This service is the only
 * bridge allowed to hold both handles, so it can stop them before invoking
 * SessionPersistence deletion.
 */

import { createHash, randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent, AgentCancelCause, AgentHandle, AgentOptions } from '@deepseek-ai/dsh-agent'
import { readComposition } from '@deepseek-ai/dsh-agent-presets'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence'
import { createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { z } from 'zod'
import { DeletionMachine, dilemmaId, messageId, requestId, sessionId } from './product/index.ts'
import type {
  DeletionOperation, DeletionReceipt, DilemmaConversation, DilemmaId, OperationId, PersonaId,
  PersonaBranch, PersonaPresetIdentity, RequestId, PersonaSnapshot, SharedStateItem, SharedStateItemStatus, StateCandidate,
  ChoiceAnswer, ChoiceQuestion, ContextProjection, ExecutionState,
} from './product/index.ts'
import { PERSONA_DISPLAY_NAMES, PERSONA_IDS, LEGACY_PERSONAS } from './types.ts'
import type { TurnBudget } from './types.ts'
import { allowedContext, deliveredUserMessageIds, fallbackTitle, isActivePersonaAcknowledgement, operationId, project, safetyDecision, turnOperationId, visibleTurnStatus } from './product/index.ts'
import type { DeliveryOperationId, MessageId, ProductEvent, TurnOperationId } from './product/index.ts'
import { ProductConversationRepository } from './repository.ts'
import type { ClaimSidecarInput, ResearchEvidence } from './evidence.ts'
import { claimSegmentArraySchema, claimSidecarArraySchema, validateClaimSidecar } from './evidence.ts'
import { registerProductTools } from './tools.ts'

/** The finite pre-delete wait. A timeout preserves the reversible checkpoint. */
export const DEFAULT_STOP_TIMEOUT_MS = 5_000
export const DEFAULT_TURN_BUDGET: TurnBudget = Object.freeze({
  maxModelRequests: 8, maxToolCalls: 12, activeTimeoutMs: 120_000,
  requestTimeoutMs: 60_000, noProgressLimit: 2, stopTimeoutMs: DEFAULT_STOP_TIMEOUT_MS,
})
const EVIDENCE_TOOL_DEADLINE_MS = 3_000
const EVIDENCE_MAX_CALLS = 2
const EVIDENCE_MAX_ENTRIES_PER_CALL = 3
const EVIDENCE_MAX_ENTRY_BYTES = 1_200
const EVIDENCE_MAX_TOTAL_BYTES = 4_800

function evidenceTerms(value: string): ReadonlySet<string> {
  const normalized = value.normalize('NFKC').toLocaleLowerCase()
  const terms = new Set(normalized.match(/[a-z0-9]+/giu) ?? [])
  for (const run of normalized.match(/[\p{Script=Han}]+/gu) ?? []) {
    if (run.length === 1) terms.add(run)
    for (let size = 2; size <= Math.min(4, run.length); size++) {
      for (let start = 0; start + size <= run.length; start++) terms.add(run.slice(start, start + size))
    }
  }
  return terms
}

/** Bounded local diagnostic for provider failures. It deliberately excludes
 * request messages, prompts, credentials, and Session identities. */
function providerFailureDiagnostic(error: unknown): string {
  if (!(error instanceof Error)) return typeof error
  const scalar = (value: unknown): string | undefined => typeof value === 'string' || typeof value === 'number'
    || typeof value === 'boolean' || typeof value === 'bigint' ? String(value) : undefined
  const codeValue: unknown = Reflect.get(error, 'code')
  const statusValue: unknown = Reflect.get(error, 'status')
  const code = scalar(codeValue)
  const status = scalar(statusValue)
  const tags = [code === undefined ? undefined : `code=${code}`, status === undefined ? undefined : `status=${status}`]
    .filter((tag): tag is string => tag !== undefined).join(' ')
  const message = error.message.replace(/\s+/gu, ' ').slice(0, 240)
  return `${error.name}${tags === '' ? '' : ` ${tags}`}: ${message}`
}

interface TurnBudgetRun {
  readonly dilemmaId: DilemmaId
  readonly turnOperationId: TurnOperationId
  readonly messageId: MessageId
  readonly persona: PersonaId
  readonly agent: Agent
  modelRequests: number
  toolCalls: number
  noProgressCount: number
  exhausted: boolean
  activeRemainingMs: number
  activeStartedAt: number
  activeTimer?: ReturnType<typeof setTimeout>
  readonly fingerprints: Map<string, number>
}

function normalizedArguments(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return JSON.stringify(value)
  const record = value as Record<string, unknown>
  return JSON.stringify(Object.fromEntries(Object.keys(record).sort().map(key => [key, record[key]])))
}

function evidenceTopicScore(item: ResearchEvidence, topic: string): number {
  const query = evidenceTerms(topic)
  if (query.size === 0) return 0
  const title = evidenceTerms(item.title)
  const body = evidenceTerms(item.text)
  let best = 0
  for (const term of query) {
    const length = term.length
    const score = title.has(term) ? 100_000 + length * 1_000 : body.has(term) ? length * 1_000 : 0
    best = Math.max(best, score)
  }
  return best
}

/** Keep Claim permissions derived from the audited source kind, not filename or persona. */
function claimCanUseEvidence(kind: ClaimSidecarInput['kind'], evidence: ResearchEvidence): boolean {
  if (kind === 'reliable-quote') {
    return evidence.trust === 'reliable'
      && (evidence.evidenceType === 'quote' || evidence.evidenceType === 'authorial-text')
      && evidence.firstPersonAllowed
  }
  if (kind === 'historical-fact') {
    return evidence.trust === 'reliable'
      && (evidence.evidenceType === 'historical-fact' || evidence.evidenceType === 'historical-account')
  }
  return kind === 'attribution' && evidence.evidenceType !== 'modern-interpretation' && !evidence.firstPersonAllowed
}

/** Evidence that cannot support the persona's own voice must stay wholly in
 * third person outside quoted source text. Advice belongs in a separate,
 * uncited modern-inference segment and is therefore unaffected. */
function usesUnsupportedFirstPersonNarration(text: string): boolean {
  const prose = text.replace(/[「『“"][^」』”"]*[」』”"]/gu, '')
  return /[我吾余]/u.test(prose)
}

/** Modern inference may carry the persona's advisory voice, but it cannot be
 * used to smuggle uncited biographical experience around the evidence gate. */
function usesUncitedBiographicalSelfClaim(text: string): boolean {
  const prose = text.replace(/[「『“"][^」』”"]*[」』”"]/gu, '')
  return /(?:我|吾|余)(?:这一生|一生|当年|早年|晚年|曾经?|尝|后来(?:又)?(?:被|遭|贬|任|到|在)|(?:被|遭|贬|任|到|在)[\p{Script=Han}]{1,10})/u.test(prose)
}

/** Stable model-facing outcome; denial statuses never include research rows. */
export type EvidenceLookupStatus = 'completed' | 'unauthorized' | 'budget-exhausted' | 'cancelled' | 'failed'
export interface EvidenceLookupResult {
  readonly status: EvidenceLookupStatus
  readonly evidence: readonly ResearchEvidence[]
}

/** Thrown when live agents have not reached disposal quiescence before the configured deadline. */
export class AgentStopTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`dilemma agents did not stop within ${timeoutMs}ms`)
    this.name = 'AgentStopTimeoutError'
  }
}

/** Await one owned disposal, keeping its promise available for a later recovery retry. */
export async function awaitStopWithin<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(new AgentStopTimeoutError(timeoutMs)) }, timeoutMs)
  })
  try {
    return await Promise.race([operation, timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** Normalize unknown cleanup rejections before they cross this public lifecycle boundary. */
function toCloseError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error('man-roleplayer close failed', { cause: reason })
}

function isPersonaAcknowledgementText(text: string): boolean {
  const normalized = text.replace(/\s+/gu, ' ').trim()
  return normalized === '你说得对' || normalized === '我认同' || normalized === '我赞同'
}

function validTitle(value: string): string | undefined {
  let title = value.replace(/```(?:markdown|text)?/giu, '').replace(/\s+/gu, ' ').trim()
  title = title.replace(/^\s*(?:\*{2})?(?:简短标题建议|标题建议|标题)\s*[:：]\s*(?:\*{2})?\s*/u, '').trim()
  // 标题模型有时会在主标题后继续解释或给出备选；产品只接受第一个标题，而不是把生成说明展示给用户。
  title = title
    .replace(/^>\s*/u, '')
    .replace(/\s*[（(]\s*(?:或(?:者)?|更简版|备选)[^）)]*[）)]\s*$/u, '')
    .replace(/\s*[；;|｜]\s*(?:或(?:者)?|更简版|备选)(?:标题)?\s*[:：]?.*$/u, '')
    .replace(/[\*_`#]/gu, '')
    .replace(/^[“「『](.+)[”」』]$/u, '$1')
    .trim()
  return title.length > 0 && title.length <= 48 ? title : undefined
}

function isIdentityQuestion(text: string): boolean {
  return /^\s*(?:你是谁(?:呀|呢)?[？?！!。．.]?|你是(?:什么人|真人|人吗)[？?！!。．.]?)\s*$/u.test(text)
}

/** Low-information openings should ask for the real dilemma without spending a
 * research or state-analysis call. Keep this deterministic and deliberately
 * narrow; meaningful short statements such as “我想离职” must still pass. */
function isLowInformationMessage(text: string): boolean {
  const normalized = text.normalize('NFKC').replace(/\s+/gu, '').replace(/[。．.!！?？]+$/gu, '')
  return /^(?:你好|您好|嗨|哈喽|hello|hi|嗯|哦|在吗|我是(?:一个)?人|我是个人|我只是个人)$/iu.test(normalized)
}

const ADVICE_RELEVANCE_STOP_TERMS = new Set([
  '一个', '这个', '事情', '什么', '怎么', '如何', '怎样', '怎么办', '我该',
  '应该', '是否', '可以', '自己', '真的', '很多', '已经', '还是', '避免',
])

/** Only advice-shaped wording activates the deterministic usefulness floor.
 * Pure factual questions keep their existing concise-answer behavior. */
function isAdviceSeekingMessage(text: string): boolean {
  const normalized = text.normalize('NFKC').replace(/\s+/gu, '')
  return /(?:如何|怎样|怎么办|我该(?:如何|怎样|怎么|做什么)|该不该|要不要)/u.test(normalized)
}

function isDirectUserStateCandidate(candidate: StateCandidate, input: readonly Record<string, unknown>[]): boolean {
  if (candidate.confirmation !== 'explicit' || candidate.sourceQuote === undefined
    || (candidate.kind !== 'fact' && candidate.kind !== 'goal')
    || candidate.text !== candidate.sourceQuote || candidate.sourceEventIds.length !== 1) return false
  const source = input.find(event => event.type === 'user-message' && event.id === candidate.sourceEventIds[0])
  if (typeof source?.content === 'string') return source.content.includes(candidate.sourceQuote)
  return Array.isArray(source?.remainingFragments) && source.remainingFragments.some(fragment =>
    typeof fragment === 'string' && fragment.includes(candidate.sourceQuote!))
}

/** Resolve model references to the user/event sources retained by each state version. */
function stateSourceIds(ids: readonly string[], items: ReadonlyMap<string, SharedStateItem>): Set<string> {
  const sources = new Set<string>(); const visited = new Set<string>(); const queue = [...ids]
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index]!
    if (visited.has(id)) continue
    visited.add(id)
    const item = items.get(id)
    if (item === undefined) sources.add(id)
    else queue.push(...item.sourceEventIds)
  }
  return sources
}

function stateTextKey(text: string): string {
  return text.normalize('NFKC').replace(/\s+/gu, '').replace(/[。．.!！?？]+$/gu, '')
}

/** User decisions remain authoritative even when a later model assigns a fresh candidate id. */
function stateCandidateAlreadyHandled(candidate: StateCandidate, items: ReadonlyMap<string, SharedStateItem>): boolean {
  const sources = stateSourceIds(candidate.sourceEventIds, items)
  return [...items.values()].some(item => item.kind === candidate.kind
    && stateTextKey(item.text) === stateTextKey(candidate.text)
    && [...stateSourceIds(item.sourceEventIds, items)].some(source => sources.has(source)))
}

function assertMinimumPersonaAnswer(
  lease: TurnSubmissionLease,
  text: string,
  claims: readonly ClaimSidecarInput[],
  events: readonly ProductEvent[],
): void {
  const user = events.find(event => event.type === 'user-message' && event.messageId === lease.messageId)
  if (user?.type !== 'user-message' || user.content === undefined) return
  if (isIdentityQuestion(user.content)) {
    const personaName = PERSONA_DISPLAY_NAMES[lease.persona]
    if (!text.includes(personaName) || !/(?:可以|能够|帮助|请问|困惑|问题)/u.test(text)) {
      throw new Error(`persona turn answer must identify ${personaName} and describe available help for identity questions`)
    }
    return
  }
  if (!isAdviceSeekingMessage(user.content)) return
  const guidance = claims.filter(claim => claim.kind === 'modern-inference')
    .map(claim => text.slice(claim.textRange.start, claim.textRange.end)).join('')
  if (guidance === '') {
    throw new Error('persona turn answer does not yet apply the material to the user\'s situation')
  }
  if (/(?:校验占位|本轮提交|提交链路|通过.{0,8}(?:要求|校验|下限)|字符(?:数量|下限)|可以被接受)/u.test(text)) {
    throw new Error('persona turn answer contains validation-oriented filler instead of a user-facing response')
  }
  const guidanceTerms = evidenceTerms(guidance)
  const topicTerms = [...evidenceTerms(user.content)].filter(term => term.length >= 2 && !ADVICE_RELEVANCE_STOP_TERMS.has(term))
  if (topicTerms.length > 0 && !topicTerms.some(term => guidanceTerms.has(term))) {
    throw new Error('persona turn answer does not yet connect its advice to the user\'s stated situation')
  }
}

function aliasProjection(projection: readonly Record<string, unknown>[]): {
  readonly projection: readonly Record<string, unknown>[]
  readonly aliases: ReadonlyMap<string, string>
} {
  const aliases = new Map<string, string>(); const reverse = new Map<string, string>()
  const alias = (value: string): string => { const existing = reverse.get(value); if (existing !== undefined) return existing; const next = `e${aliases.size}`; aliases.set(next, value); reverse.set(value, next); return next }
  const projected = projection.map(item => Object.fromEntries(Object.entries(item).flatMap(([key, value]) => {
    if (key === 'sessionEventId') return []
    if ((key === 'id' || key.endsWith('Id')) && typeof value === 'string') return [[key, alias(value)]]
    if (key.endsWith('Ids') && Array.isArray(value)) return [[key, value.map(id => alias(String(id)))]]
    return [[key, value]]
  })))
  return { projection: projected, aliases }
}

function dedupeProjection(projection: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>()
  return projection.filter((item) => {
    const id = typeof item.id === 'string' ? item.id : undefined
    if (id === undefined || seen.has(id)) return false
    seen.add(id); return true
  })
}

/** Count durable facts that can change the effective context, excluding progress and analysis bookkeeping. */
function contextRevision(events: readonly ProductEvent[]): number {
  return events.filter(event => !['activity', 'context-projection', 'state-analysis', 'title', 'turn-execution'].includes(event.type)).length
}

function samePresetIdentity(left: PersonaPresetIdentity, right: PersonaPresetIdentity): boolean {
  return left.presetId === right.presetId && left.assemblyDigest === right.assemblyDigest
    && left.persona === right.persona && left.researchFingerprint === right.researchFingerprint
}

function latestSharedStateItem(events: readonly ProductEvent[], itemId: string): SharedStateItem | undefined {
  return events.findLast((event): event is Extract<ProductEvent, { type: 'shared-state' }> => event.type === 'shared-state' && event.item.id === itemId)?.item
}

function answersMatchQuestions(questions: readonly ChoiceQuestion[], answers: readonly ChoiceAnswer[]): boolean {
  if (questions.length !== answers.length) return false
  const seen = new Set<string>()
  return answers.every((answer) => {
    if (seen.has(answer.id)) return false
    seen.add(answer.id)
    const question = questions.find(item => item.id === answer.id)
    if (question === undefined || new Set(answer.selected).size !== answer.selected.length) return false
    if (answer.skipped === true) return answer.selected.length === 0 && answer.custom === undefined
    if (answer.selected.length === 0 && answer.custom === undefined) return false
    if (question.multiSelect !== true && answer.selected.length > 1) return false
    if (question.multiSelect !== true && answer.custom !== undefined && answer.selected.length > 0) return false
    const labels = new Set(question.options?.map(option => option.label) ?? [])
    if (!answer.selected.every(label => labels.has(label))) return false
    return answer.custom === undefined || answer.custom.trim() !== ''
  })
}

/** Derive the opaque client handle from one product identity. */
export function dilemmaHandle(id: DilemmaId): string {
  return `dilemma:${createHash('sha256').update(id).digest('hex')}`
}

/** Derive the deletion receipt's non-reversible handle digest. */
export function deletionHandleDigest(id: DilemmaId): string {
  return createHash('sha256').update(dilemmaHandle(id)).digest('hex')
}

const stateCandidateSchema = z.object({
  id: z.string().trim().min(1), kind: z.enum(['fact', 'goal', 'conflict', 'unresolved', 'understanding']),
  text: z.string().trim().min(1), sourceEventIds: z.array(z.string().trim().min(1)).min(1),
  confirmation: z.enum(['explicit', 'needs-confirmation']).optional(),
  sourceQuote: z.string().trim().min(1).optional(),
}).strict()

const personaSnapshotSchema = z.object({
  persona: z.enum(PERSONA_IDS),
  sourceTurnOperationId: z.string().min(1).optional(), sourceEventIds: z.array(z.string().min(1)).min(1),
  currentUnderstanding: z.string().trim().min(1), coreView: z.string().trim().min(1),
  advice: z.string().trim().min(1).optional(),
}).strict()

const stateAnalysisOutputSchema = z.object({
  candidates: z.array(stateCandidateSchema), personaSnapshot: personaSnapshotSchema,
}).strict()
const stateAnalysisOutputJsonSchema = JSON.stringify(z.toJSONSchema(stateAnalysisOutputSchema))

const personaTurnSubmitInputSchema = z.object({
  segments: claimSegmentArraySchema,
}).strict()

const choiceOptionSchema = z.object({ label: z.string().trim().min(1), description: z.string().trim().min(1).optional() }).strict()
const choiceQuestionSchema = z.object({
  id: z.string().trim().min(1), question: z.string().trim().min(1), header: z.string().trim().min(1).optional(),
  detail: z.string().trim().min(1).optional(), options: z.array(choiceOptionSchema).min(1).optional(), multiSelect: z.boolean().optional(),
}).strict()
const choiceQuestionsSchema = z.array(choiceQuestionSchema).min(1)
const choiceAnswerSchema = z.object({
  id: z.string().trim().min(1),
  selected: z.array(z.string().trim().min(1)),
  custom: z.string().trim().min(1).optional(),
  skipped: z.boolean().optional(),
}).strict()
const choiceAnswersSchema = z.array(choiceAnswerSchema).min(1)

function normalizeChoiceQuestions(questions: z.infer<typeof choiceQuestionsSchema>): readonly ChoiceQuestion[] {
  return questions.map(question => ({
    id: question.id, question: question.question,
    ...(question.header === undefined ? {} : { header: question.header }),
    ...(question.detail === undefined ? {} : { detail: question.detail }),
    ...(question.options === undefined ? {} : { options: question.options.map(option => ({
      label: option.label, ...(option.description === undefined ? {} : { description: option.description }),
    })) }),
    ...(question.multiSelect === undefined ? {} : { multiSelect: question.multiSelect }),
  }))
}

function normalizeChoiceAnswers(answers: z.infer<typeof choiceAnswersSchema>): readonly ChoiceAnswer[] {
  return answers.map(answer => ({
    id: answer.id, selected: [...answer.selected],
    ...(answer.skipped === undefined ? {} : { skipped: answer.skipped }),
    ...(answer.custom === undefined ? {} : { custom: answer.custom }),
  }))
}

const personaTurnSubmitMetaSchema = z.object({
  type: z.literal('persona-turn-submit'),
  accepted: z.literal(true),
  submissionId: z.string().min(1),
  turnOperationId: z.string().min(1),
  text: z.string().min(1),
  claims: claimSidecarArraySchema,
  evidenceRevision: z.number().int().nonnegative(),
}).strict()

/** Input for one explicit user-created dilemma. Agent ids are DSH Session ids. */
export interface CreateDilemmaOptions {
  readonly id: DilemmaId
  readonly requestId: RequestId
  readonly branches: readonly PersonaBranch[]
  readonly activePersona: PersonaId
  readonly agentOptions?: AgentOptions
}

export interface StateItemModifyOptions {
  readonly text: string
  readonly kind?: StateCandidate['kind']
}

/** Durable input accepted by {@link ManRoleplayer.submitMessage}. */
export interface SubmitMessageOptions {
  readonly messageId: MessageId
  readonly deliveryOperationId: DeliveryOperationId
  readonly turnOperationId: TurnOperationId
  readonly text: string
  readonly requestId: RequestId
  readonly replyToTimelineEventId?: string
  readonly expectedRevision?: number
  /** Existing product message being retried; skips a second pending user fact. */
  readonly retryOf?: TurnOperationId
  /** Remote callers may return once the durable delivery/turn claim is written. */
  readonly acknowledgeOnly?: boolean
}

/** Durable input for recovery of a previously claimed message. */
export interface ReconcileMessageOptions {
  readonly messageId: MessageId
  readonly deliveryOperationId: DeliveryOperationId
  readonly turnOperationId: TurnOperationId
}

interface LiveDilemma {
  readonly handles: AgentHandle[]
  stopping?: Promise<void>
}

interface MessageRunToken {
  readonly requestId: RequestId
  readonly messageId: MessageId
  readonly deliveryOperationId: DeliveryOperationId
  readonly turnOperationId: TurnOperationId
  readonly persona: PersonaId
  readonly sessionMessageId: string
  readonly agent: AgentHandle['agent']
  readonly user: ReturnType<typeof createUserMessage>
  readonly lowInformation: boolean
  readonly replyToTimelineEventId?: string
}

interface MessageRunLease {
  readonly token: MessageRunToken
  readonly promise: Promise<DilemmaConversation>
  readonly resolve: (result: DilemmaConversation) => void
  readonly reject: (reason: unknown) => void
  started: boolean
}

interface MessageRunOutcome {
  readonly error?: unknown
  readonly userEvent?: AgentHandle['agent']['session']['events'][number]
  readonly assistantEvent?: AgentHandle['agent']['session']['events'][number]
  readonly submission?: PersonaTurnSubmission
  readonly submissionEvent?: AgentHandle['agent']['session']['events'][number]
  readonly interrupted: boolean
}

interface PersonaTurnSubmission {
  readonly submissionId: string
  readonly turnOperationId: TurnOperationId
  readonly persona: PersonaId
  readonly sessionId: string
  readonly text: string
  readonly claims: readonly ClaimSidecarInput[]
  readonly evidenceRevision: number
}

interface ChoiceWaiter {
  readonly operationId: OperationId
  readonly agent: Agent
  readonly promise: Promise<readonly ChoiceAnswer[]>
  readonly resolve: (answer: readonly ChoiceAnswer[]) => void
  readonly reject: (error: unknown) => void
}

interface TurnSubmissionLease extends Omit<PersonaTurnSubmission, 'submissionId' | 'text' | 'claims'> {
  readonly dilemmaId: DilemmaId
  readonly messageId: MessageId
  submission?: PersonaTurnSubmission
}

type PersonaTurnSubmitMeta = z.infer<typeof personaTurnSubmitMetaSchema>

function personaTurnSubmitMeta(event: SessionEvent): PersonaTurnSubmitMeta | undefined {
  if (event.type !== 'tool/result') return undefined
  const parsed = personaTurnSubmitMetaSchema.safeParse(event.data.meta)
  return parsed.success ? parsed.data : undefined
}

function findPersonaTurnSubmitEvent(
  agent: Agent,
  turnOperationId: TurnOperationId,
  submissionId?: string,
): { readonly event: SessionEvent; readonly meta: PersonaTurnSubmitMeta } | undefined {
  for (const event of [...agent.session.events].reverse()) {
    const meta = personaTurnSubmitMeta(event)
    if (meta?.turnOperationId !== String(turnOperationId)) continue
    if (submissionId !== undefined && meta.submissionId !== submissionId) continue
    return { event, meta }
  }
  return undefined
}

/** Host-owned service for product events and variable private DSH agent lifecycles. */
export class ManRoleplayer {
  private readonly repository: ProductConversationRepository
  private readonly live = new Map<DilemmaId, LiveDilemma>()
  private readonly tails = new Map<DilemmaId, Promise<void>>()
  private readonly messageRuns = new Map<DilemmaId, MessageRunLease>()
  private readonly retryRuns = new Map<string, Promise<DilemmaConversation>>()
  private readonly deletionRuns = new Map<string, Promise<DeletionOperation>>()
  private readonly stateRuns = new Map<string, Promise<DilemmaConversation>>()
  private readonly choiceWaiters = new Map<string, ChoiceWaiter>()
  private readonly evidenceCapabilities = new WeakMap<Agent, { readonly dilemmaId: DilemmaId; readonly persona: PersonaId }>()
  private readonly turnSubmissionLeases = new WeakMap<Agent, TurnSubmissionLease>()
  private readonly turnStops = new WeakMap<Agent, AbortController>()
  private readonly turnBudgetRuns = new Map<string, TurnBudgetRun>()
  private readonly evidenceRuns = new Map<string, {
    readonly dilemmaId: DilemmaId
    readonly persona: PersonaId
    readonly sessionId: string
    readonly turnOperationId: TurnOperationId
    readonly evidenceRevision: number
    readonly allowEvidence: boolean
  }>()
  private closing = false

  constructor(
    private readonly ctx: Context,
    private readonly persistence: SessionPersistence,
    private readonly stopTimeoutMs = DEFAULT_STOP_TIMEOUT_MS,
    private readonly evidence: readonly ResearchEvidence[] = [],
    private readonly presetIdentities?: readonly PersonaPresetIdentity[],
    private readonly defaultAgentOptions?: AgentOptions,
    private readonly autoStateAnalysis: boolean = false,
    private readonly turnBudget: TurnBudget = DEFAULT_TURN_BUDGET,
  ) {
    if (!Number.isSafeInteger(stopTimeoutMs) || stopTimeoutMs <= 0) {
      throw new Error('man-roleplayer: stopTimeoutMs must be a positive safe integer')
    }
    for (const [name, value] of Object.entries(turnBudget)) {
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`man-roleplayer: turnBudget.${name} must be a positive safe integer`)
    }
    this.repository = new ProductConversationRepository(ctx.storageDomain)
  }

  /** Open the product event medium before publishing the service. */
  async open(): Promise<void> {
    if (this.closing) throw new Error('man-roleplayer is closed')
    await this.repository.open()
    this.ctx.on('agent/request', async ({ agent }, next) => {
      const run = this.turnBudgetRuns.get(String(agent.id))
      if (run === undefined) return next()
      run.modelRequests += 1
      if (run.modelRequests > this.turnBudget.maxModelRequests) {
        run.exhausted = true
        this.cancelOwnedAgent(agent, { kind: 'hook', reason: 'persona turn model-request budget exhausted' })
        throw new Error('persona turn model-request budget exhausted')
      }
      return next()
    })
    this.ctx.on('agent/request-error', async ({ agent }, next) => {
      const run = this.turnBudgetRuns.get(String(agent.id))
      const action = await next()
      if (run === undefined || action?.kind !== 'retry') return action
      if (run.modelRequests >= this.turnBudget.maxModelRequests) {
        run.exhausted = true
        this.cancelOwnedAgent(agent, { kind: 'hook', reason: 'persona turn provider-retry budget exhausted' })
        return undefined
      }
      return action
    })
    this.ctx.on('tools/pre-execute', (exec, next) => {
      const run = exec.agent === undefined ? undefined : this.turnBudgetRuns.get(String(exec.agent.id))
      if (run === undefined) return next()
      run.toolCalls += 1
      if (run.toolCalls > this.turnBudget.maxToolCalls) {
        run.exhausted = true
        exec.agent !== undefined && this.cancelOwnedAgent(exec.agent, { kind: 'hook', reason: 'persona turn tool-call budget exhausted' })
        return Promise.resolve({ kind: 'deny', reason: 'persona turn tool-call budget exhausted' })
      }
      return next()
    })
    this.ctx.on('tools/result', (exec, result) => {
      const run = exec.agent === undefined ? undefined : this.turnBudgetRuns.get(String(exec.agent.id))
      if (run === undefined) return undefined
      const evidenceRevision = this.evidenceRuns.get(String(exec.agent?.id))?.evidenceRevision ?? 0
      const fingerprint = `${exec.name}|${normalizedArguments(exec.arguments)}|${result.isError ? 'error' : 'ok'}|${String(evidenceRevision)}`
      const count = (run.fingerprints.get(fingerprint) ?? 0) + 1
      run.fingerprints.set(fingerprint, count)
      if (count > 1) run.noProgressCount += 1
      if (run.noProgressCount >= this.turnBudget.noProgressLimit) {
        run.exhausted = true
        exec.agent !== undefined && this.cancelOwnedAgent(exec.agent, { kind: 'hook', reason: 'persona turn made no progress' })
      }
      return undefined
    })
    this.ctx.on('llm/stream', (options, next) => {
      const run = options.sessionId === undefined ? undefined : this.turnBudgetRuns.get(String(options.sessionId))
      if (run === undefined) return next()
      const timer = setTimeout(() => {
        run.exhausted = true
        this.cancelOwnedAgent(run.agent, { kind: 'hook', reason: 'persona turn request timeout' })
      }, this.turnBudget.requestTimeoutMs)
      const source = next()
      return (async function* () {
        try {
          for await (const chunk of source) yield chunk
        } finally {
          clearTimeout(timer)
        }
      })()
    })
    this.ctx.on('agent/pre-step', async ({ agent, signal }, next) => {
      const lease = this.turnSubmissionLeases.get(agent)
      const decision = await next()
      if (lease === undefined || decision.kind === 'reject' || signal.aborted || this.closing) return decision
      await this.projectAgentContext(lease.dilemmaId, agent, lease.persona, lease.turnOperationId)
      return decision
    })
    await this.recoverPendingChoices()
    // A configured product profile owns its persisted persona sessions. A
    // plain library composition may intentionally omit defaults and remains
    // cold until its caller explicitly creates/resumes a dilemma.
    if (this.defaultAgentOptions !== undefined) {
      for (const conversation of await this.repository.list()) {
        if (conversation.deletion === undefined) await this.resume(conversation.id, this.defaultAgentOptions)
      }
    }
  }

  /** A pending product choice has no transferable waiter after restart; close it without replaying the Agent. */
  private async recoverPendingChoices(): Promise<void> {
    for (const conversation of await this.repository.list()) {
      const events = await this.repository.readEvents(conversation.id) ?? []
      const pending = events.findLast(event => event.type === 'choice' && event.status === 'pending')
      if (pending?.type !== 'choice') continue
      const terminal = events.findLast(event => event.type === 'choice' && event.operationId === pending.operationId && event.status !== 'pending')
      if (terminal !== undefined) continue
      await this.repository.append(conversation.id, {
        type: 'choice', operationId: pending.operationId, turnOperationId: pending.turnOperationId,
        persona: pending.persona, status: 'failed',
        ...(pending.questions === undefined ? {} : { questions: pending.questions }),
        requestId: requestId(`choice-recovery-failed:${pending.operationId}`),
      })
    }
  }

  /** Create one Host-owned blank dilemma; request ids make retries return the same record. */
  async createBlank(request: {
    readonly requestId: RequestId
    readonly activePersona: PersonaId
    readonly personas?: readonly PersonaId[]
  }): Promise<DilemmaConversation> {
    return this.serial(dilemmaId('__man-roleplayer-create__'), async () => {
      const existing = (await this.repository.list()).find(item => item.seenRequests.includes(request.requestId))
      if (existing !== undefined) return existing
      const id = dilemmaId(`dilemma-${randomUUID()}`)
      const personas = request.personas ?? LEGACY_PERSONAS
      if (personas.length < 1 || new Set(personas).size !== personas.length || !personas.includes(request.activePersona)) {
        throw new Error('dilemma creation requires distinct personas including the active persona')
      }
      return this.create({
        id, requestId: request.requestId, activePersona: request.activePersona,
        branches: personas.map(persona => ({ persona, sessionId: sessionId(`man-roleplayer:${id}:${persona}:${randomUUID()}`) })),
      })
    })
  }

  /** Create the requested isolated DSH agents, then commit their product relationship. */
  create(options: CreateDilemmaOptions): Promise<DilemmaConversation> {
    return this.serial(options.id, async () => {
      this.assertOpen()
      if (options.branches.length === 0 || new Set(options.branches.map(branch => branch.persona)).size !== options.branches.length) throw new Error('dilemma personas must be distinct')
      if (!options.branches.some(branch => branch.persona === options.activePersona)) {
        throw new Error('active persona must belong to the dilemma branches')
      }
      const existing = await this.repository.read(options.id)
      if (existing !== undefined) {
        if (existing.seenRequests.includes(options.requestId)) {
          this.assertPresetIdentities(existing.branches)
          return existing
        }
        throw new Error(`dilemma '${options.id}' already exists`)
      }
      const branches = this.bindPresetIdentities(options.branches)
      const handles = await this.createHandles(branches, options.agentOptions ?? this.defaultAgentOptions)
      try {
        this.assertHandlePresetIdentities(handles, branches)
        const conversation = await this.repository.create({
          type: 'created', id: options.id, branches,
          activePersona: options.activePersona, requestId: options.requestId,
        })
        this.bindProductTools(handles)
        this.live.set(options.id, { handles: [...handles] })
        handles.forEach((handle, index) => {
          const branch = options.branches[index]
          if (branch !== undefined) this.evidenceCapabilities.set(handle.agent, { dilemmaId: options.id, persona: branch.persona })
        })
        return conversation
      } catch (error) {
        await Promise.all(handles.map(handle => handle.dispose()))
        throw error
      }
    })
  }

  /** Recreate both DSH agent owners around one non-deleting durable conversation. */
  async resume(id: DilemmaId, agentOptions?: AgentOptions): Promise<DilemmaConversation> {
    let conversation: DilemmaConversation
    try {
      conversation = await this.serial(id, async () => {
        this.assertOpen()
        let conversation = await this.requireConversation(id)
        if (conversation.deletion !== undefined) throw new Error(`dilemma '${id}' is deleting and cannot resume`)
        if (this.live.has(id)) return conversation
        await this.recoverBranchAllocations(id, conversation, agentOptions)
        conversation = await this.requireConversation(id)
        await this.recoverUnsettledTurns(id)
        conversation = await this.requireConversation(id)
        this.assertPresetIdentities(conversation.branches)
        const handles = await this.resumeHandles(conversation.branches, agentOptions)
        try {
          this.assertHandlePresetIdentities(handles, conversation.branches)
          // 冷启动已重新取得同一 Session 的 Agent；失败轮次不能因旧停止检查点永久锁住对话。
          const recoveredEvents = await this.repository.readEvents(id) ?? []
          const executions = new Map<string, Extract<ProductEvent, { type: 'turn-execution' }>>()
          for (const event of recoveredEvents) if (event.type === 'turn-execution') executions.set(String(event.turnOperationId), event)
          for (const execution of executions.values()) {
            if (execution.state === 'stopped' || visibleTurnStatus(recoveredEvents, execution.turnOperationId) !== 'failed') continue
            const agent = handles.find(handle => conversation.branches.some(branch => branch.persona === execution.persona && String(branch.sessionId) === String(handle.agent.id)))?.agent
            if (agent === undefined || agent.status !== 'idle') continue
            await awaitStopWithin(agent.whenIdle(), this.stopTimeoutMs)
            await this.repository.append(id, {
              type: 'turn-execution', turnOperationId: execution.turnOperationId, messageId: execution.messageId,
              persona: execution.persona, state: 'stopped', requestId: requestId(`turn-execution-cold-stopped:${execution.turnOperationId}`),
            })
          }
          conversation = await this.requireConversation(id)
          this.bindProductTools(handles)
          this.live.set(id, { handles: [...handles] })
        } catch (error) {
          await Promise.all(handles.map(handle => handle.dispose()))
          throw error
        }
        handles.forEach((handle, index) => {
          const branch = conversation.branches[index]
          if (branch !== undefined) this.evidenceCapabilities.set(handle.agent, { dilemmaId: id, persona: branch.persona })
        })
        return conversation
      })
    } catch (error) {
      try { await this.recoverClaimedTitle(id) } catch { /* Preserve the original resume error; recovery remains observable on read. */ }
      throw error
    }
    try { await this.recoverClaimedTitle(id) } catch { /* Preserve resume success; title recovery is retried by the next read. */ }
    return conversation
  }

  /** Reconcile a persisted branch claim before rebuilding the complete live roster. */
  private async recoverBranchAllocations(
    id: DilemmaId,
    conversation: DilemmaConversation,
    agentOptions?: AgentOptions,
  ): Promise<void> {
    const known = new Set(conversation.branches.map(branch => branch.persona))
    for (const allocation of conversation.branchAllocations.filter(item => item.status !== 'failed' && !known.has(item.persona))) {
      let handle: AgentHandle | undefined
      const branch: PersonaBranch = {
        persona: allocation.persona,
        sessionId: allocation.sessionId,
        ...(allocation.presetIdentity === undefined ? {} : { presetIdentity: allocation.presetIdentity }),
      }
      try {
        const setup = this.agentPresetSetup(branch.presetIdentity)
        handle = await this.ctx.agents.resume({
          resumeSessionId: allocation.sessionId,
          ...(agentOptions === undefined ? {} : { agentOptions }),
          ...(setup === undefined ? {} : { setup }),
        })
        this.assertHandlePresetIdentities([handle], [branch])
        await this.repository.append(id, { type: 'branch-added', operationId: allocation.operationId, branch, requestId: requestId(`branch-recover-added:${allocation.operationId}`) })
      } catch (error) {
        await this.repository.append(id, { type: 'branch-allocation', allocation: { ...allocation, status: 'failed' }, requestId: requestId(`branch-recover-failed:${allocation.operationId}`) })
        if (error instanceof Error && /not found|unknown|missing/iu.test(error.message)) continue
        continue
      } finally {
        if (handle !== undefined) await handle.dispose()
      }
    }
  }

  /** Persist a reversible delete request. A repeated user request is deduplicated by its request id. */
  requestDeletion(
    id: DilemmaId, operation: DeletionOperation, userRequestId: RequestId, expectedRevision?: number,
  ): Promise<DilemmaConversation> {
    return this.serial(id, async () => {
      this.assertOpen()
      const conversation = await this.requireConversation(id)
      this.assertExpectedRevision(conversation, expectedRevision)
      if (conversation.deletion !== undefined && conversation.deletion.operationId !== operation.operationId) {
        throw new Error(`dilemma '${id}' already has a deletion operation`)
      }
      if (conversation.deletion !== undefined) return conversation
      if (operation.stage !== 'requested' || operation.irreversible) {
        throw new Error('a deletion request must start at the reversible requested stage')
      }
      return (await this.repository.append(id, { type: 'deletion', operation, requestId: userRequestId })).conversation
    })
  }

  /** Cancel only the still-reversible deletion request, preserving append-only history. */
  cancelDeletion(id: DilemmaId, operationId: OperationId, userRequestId: RequestId): Promise<DilemmaConversation> {
    return this.serial(id, async () => {
      this.assertOpen()
      const conversation = await this.requireConversation(id)
      if (conversation.deletion?.operationId !== operationId || conversation.deletion.stage !== 'requested') {
        throw new Error(`dilemma '${id}' has no reversible deletion operation '${operationId}'`)
      }
      return (await this.repository.append(id, {
        type: 'deletion-cancelled', operationId, requestId: userRequestId,
      })).conversation
    })
  }

  /** Execute or recover the one persisted deletion operation. The durable
   * checkpoint is claimed under the dilemma serializer; stopping agents and
   * deleting sessions happen after that short critical section so lifecycle
   * callers can observe and reject while deletion is in progress. */
  delete(id: DilemmaId, operationId: OperationId): Promise<DeletionOperation> {
    const key = `${id}:${operationId}`
    const existingRun = this.deletionRuns.get(key)
    if (existingRun !== undefined) return existingRun
    const run = (async () => {
      const receipt = await this.repository.readDeletionReceipt(operationId)
      if (receipt !== undefined) {
        if (receipt.handleDigest !== deletionHandleDigest(id)) throw new Error(`deletion receipt '${operationId}' does not belong to dilemma '${id}'`)
        if (receipt.status === 'completed') return { operationId, stage: 'completed' as const, irreversible: true }
        if (await this.repository.read(id) === undefined) {
          await this.repository.completeDeletionReceipt(operationId, receipt.handleDigest, Date.now())
          return { operationId, stage: 'completed' as const, irreversible: true }
        }
      }
      const operation = await this.serial(id, async () => {
        this.assertOpen()
        const conversation = await this.requireConversation(id)
        const current = conversation.deletion
        if (current?.operationId !== operationId) throw new Error(`dilemma '${id}' has no deletion operation '${operationId}'`)
        if (current.stage !== 'requested') return current
        const next = (await this.repository.append(id, {
          type: 'deletion',
          operation: { ...current, stage: 'stopping-agents' },
          requestId: requestId(`delete-start:${current.operationId}`),
        })).conversation.deletion
        if (next === undefined) throw new Error(`dilemma '${id}' lost its deletion checkpoint`)
        return next
      })
      const deletionConversation = await this.requireConversation(id)
      const publishedPersonas = new Set(deletionConversation.branches.map(branch => branch.persona))
      const deletionTargets: readonly PersonaBranch[] = [
        ...deletionConversation.branches,
        ...deletionConversation.branchAllocations
          .filter(allocation => !publishedPersonas.has(allocation.persona))
          .map(allocation => ({
            persona: allocation.persona,
            sessionId: allocation.sessionId,
            ...(allocation.presetIdentity === undefined ? {} : { presetIdentity: allocation.presetIdentity }),
          })),
      ]
      const machine = new DeletionMachine(id, deletionTargets, async (checkpoint) => {
        await this.repository.append(id, {
          type: 'deletion', operation: checkpoint,
          requestId: requestId(`delete:${checkpoint.operationId}:${randomUUID()}`),
        })
      })
      return machine.run(operation, {
        stopAgents: () => this.stopAgents(id),
        deleteSession: async (sessionId) => {
          try {
            await this.persistence.delete(sessionId)
          } catch (error) {
            const code: unknown = error !== null && typeof error === 'object' && 'code' in error
              ? (error as { readonly code?: unknown }).code : undefined
            if (code === 'SESSION_NOT_FOUND' || (error instanceof Error && /session.*not found/iu.test(error.message))) return
            throw error
          }
        },
        deleteProduct: async (dilemma) => {
          const handleDigest = deletionHandleDigest(dilemma)
          await this.repository.recordDeletionIntent({ operationId, handleDigest, status: 'pending', deleted: true })
          const removed = await this.repository.remove(dilemma)
          if (!removed) {
            const pending = await this.repository.readDeletionReceipt(operationId)
            if (pending?.status !== 'pending' || pending.handleDigest !== handleDigest) {
              throw new Error(`deletion product '${dilemma}' was not removed`)
            }
          }
          await this.repository.completeDeletionReceipt(operationId, handleDigest, Date.now())
        },
      })
    })()
    this.deletionRuns.set(key, run)
    void run.then(() => {
      if (this.deletionRuns.get(key) === run) this.deletionRuns.delete(key)
    }, () => {
      if (this.deletionRuns.get(key) === run) this.deletionRuns.delete(key)
    })
    return run
  }

  /** Read only the deletion proof needed to retry a lost remote response. */
  readDeletionReceipt(operationId: OperationId): Promise<DeletionReceipt | undefined> {
    return this.repository.readDeletionReceipt(operationId)
  }

  /** Promote a pending receipt only when its product conversation is already absent. */
  async recoverDeletionReceipt(operationId: OperationId, handleDigest: string): Promise<boolean> {
    const receipt = await this.repository.readDeletionReceipt(operationId)
    if (receipt === undefined || receipt.handleDigest !== handleDigest) return false
    if (receipt.status === 'completed') return true
    const stillPresent = (await this.repository.list()).some(conversation => deletionHandleDigest(conversation.id) === handleDigest)
    if (stillPresent) return false
    await this.repository.completeDeletionReceipt(operationId, handleDigest, Date.now())
    return true
  }

  /** Read the durable projection; it never returns a live mutable cache. */
  read(id: DilemmaId): Promise<DilemmaConversation | undefined> {
    return this.recoverClaimedTitle(id)
      .then(() => this.recoverRunningState(id))
      .then(() => this.recoverEvidenceClaims(id))
      .then(() => this.recoverSafetyReplies(id))
      .then(() => this.repository.read(id))
  }

  /** Archive a dilemma without deleting its product or private Session facts. */
  async archive(id: DilemmaId, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation> {
    return this.serial(id, async () => {
      const conversation = await this.requireConversation(id)
      if (conversation.seenRequests.includes(userRequestId)) return conversation
      this.assertExpectedRevision(conversation, expectedRevision)
      if (conversation.deletion !== undefined) throw new Error(`dilemma '${id}' is deleting and cannot archive`)
      if (conversation.archived === true) return conversation
      return (await this.repository.append(id, { type: 'archived', requestId: userRequestId })).conversation
    })
  }

  /** Restore only an archived dilemma; deletion checkpoints cannot be resurrected. */
  async restore(id: DilemmaId, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation> {
    return this.serial(id, async () => {
      const conversation = await this.requireConversation(id)
      this.assertExpectedRevision(conversation, expectedRevision)
      if (conversation.deletion !== undefined) throw new Error(`dilemma '${id}' is deleting and cannot restore`)
      if (conversation.archived !== true) {
        if (conversation.seenRequests.includes(userRequestId)) return conversation
        throw new Error(`dilemma '${id}' is not archived and cannot restore`)
      }
      return (await this.repository.append(id, { type: 'restored', requestId: userRequestId })).conversation
    })
  }

  /** List active dilemmas by default; archived records remain available through read/restore. */
  async list(includeArchived: boolean = false): Promise<readonly DilemmaConversation[]> {
    const conversations = await this.repository.list()
    return includeArchived ? conversations : conversations.filter(conversation => conversation.archived !== true)
  }

  /** Read only the accepted structured answer referenced by one completed turn. */
  async acceptedAnswer(id: DilemmaId, timelineId: string): Promise<string | undefined> {
    return (await this.acceptedAnswerWithClaims(id, timelineId))?.text
  }

  /** Return accepted answer text and the same-turn validated claim sidecars. */
  async acceptedAnswerWithClaims(id: DilemmaId, timelineId: string): Promise<{
    readonly text: string
    readonly claims: readonly ClaimSidecarInput[]
  } | undefined> {
    const events = await this.repository.readEvents(id) ?? []
    const turn = events.findLast(event => event.type === 'turn' && String(event.turnOperationId) === timelineId && event.status === 'completed')
    if (turn?.type !== 'turn' || turn.sessionEventId === undefined) return undefined
    const branch = (await this.requireConversation(id)).branches.find(item => item.persona === turn.persona)
    const agent = branch === undefined ? undefined : this.ctx.agents.get(branch.sessionId)
    if (agent === undefined) return undefined
    const submitted = findPersonaTurnSubmitEvent(agent, turn.turnOperationId)
    if (submitted === undefined || String(submitted.event.seq) !== turn.sessionEventId) return undefined
    const claims = events.filter((event): event is Extract<ProductEvent, { type: 'claim-sidecar' }> => event.type === 'claim-sidecar' && String(event.turnOperationId) === timelineId && event.status === 'accepted')
    return { text: submitted.meta.text, claims: claims.map(({ textRange, kind, evidenceIds }) => ({ textRange, kind, evidenceIds })) }
  }

  /** Reconstruct the currently live turn and its durable stop state. */
  async activeTurn(id: DilemmaId): Promise<{ readonly messageId: MessageId; readonly deliveryOperationId: DeliveryOperationId; readonly turnOperationId: TurnOperationId; readonly persona: PersonaId; readonly status: 'running' | 'waiting-choice'; readonly executionState: ExecutionState } | undefined> {
    const events = await this.repository.readEvents(id) ?? []
    const latestDeliveries = new Map<string, Extract<ProductEvent, { type: 'message-delivery' }>>()
    for (const event of events) if (event.type === 'message-delivery') latestDeliveries.set(String(event.deliveryOperationId), event)
    const deliveries = [...latestDeliveries.values()].filter(event => event.status === 'pending' || event.status === 'claimed')
    const live = deliveries.map((delivery) => {
      const turns = events.filter((event): event is Extract<ProductEvent, { type: 'turn' }> => event.type === 'turn' && event.messageId === delivery.messageId)
      const turn = turns.at(-1)
      const terminal = turns.some(item => item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled')
      return terminal || turn === undefined || (turn.status !== 'claimed' && turn.status !== 'running') ? undefined : { delivery, turn }
    }).filter((item): item is { delivery: Extract<ProductEvent, { type: 'message-delivery' }>; turn: Extract<ProductEvent, { type: 'turn' }> } => item !== undefined).at(-1)
    const executionEvents = new Map<string, Extract<ProductEvent, { type: 'turn-execution' }>>()
    for (const event of events) if (event.type === 'turn-execution') executionEvents.set(String(event.turnOperationId), event)
    const unsettledExecution = [...executionEvents.values()].findLast(event => event.state !== 'stopped')
    if (live === undefined) {
      if (unsettledExecution === undefined) return undefined
      const turn = events.findLast(event => event.type === 'turn' && event.turnOperationId === unsettledExecution.turnOperationId)
      const delivery = events.findLast(event => event.type === 'message-delivery' && event.messageId === unsettledExecution.messageId)
      if (turn?.type !== 'turn' || delivery?.type !== 'message-delivery') return undefined
      return { messageId: messageId(String(delivery.messageId)), deliveryOperationId: delivery.deliveryOperationId, turnOperationId: turn.turnOperationId, persona: turn.persona, status: 'running', executionState: unsettledExecution.state }
    }
    const { delivery, turn } = live
    const choice = events.findLast(event => event.type === 'choice' && event.turnOperationId === turn.turnOperationId)
    const waiting = choice?.type === 'choice' && choice.status === 'pending'
    const execution = executionEvents.get(String(turn.turnOperationId))
    return { messageId: messageId(String(delivery.messageId)), deliveryOperationId: delivery.deliveryOperationId, turnOperationId: turn.turnOperationId, persona: turn.persona, status: waiting ? 'waiting-choice' : 'running', executionState: execution?.state ?? 'running' }
  }

  /**
   * Project only the reasoning belonging to one product turn. The delivery's
   * sessionMessageId is the ownership fence: first locate that exact user
   * message in its persona branch, then use its enclosing DSH turn. This
   * prevents either persona branch (or an unrelated model turn) crossing into
   * the browser projection while keeping Session ids and raw tool metadata out.
   */
  async reasoning(id: DilemmaId, requestedTurn: TurnOperationId): Promise<{
    readonly persona: PersonaId
    readonly turnOperationId: string
    readonly status: 'running' | 'completed' | 'failed' | 'cancelled'
    readonly text: string
  } | undefined> {
    const productEvents = await this.repository.readEvents(id) ?? []
    const turn = productEvents.findLast(event => event.type === 'turn' && event.turnOperationId === requestedTurn)
    if (turn?.type !== 'turn') return undefined
    const retry = productEvents.findLast(event => event.type === 'message-retry' && event.turnOperationId === requestedTurn)
    const original = productEvents.find(event => event.type === 'user-message'
      && (event.messageId ?? messageId(event.id)) === turn.messageId
      && event.deliveryOperationId !== undefined)
    const targetDeliveryOperationId = retry?.type === 'message-retry' ? retry.deliveryOperationId : original?.type === 'user-message' ? original.deliveryOperationId : undefined
    const delivery = targetDeliveryOperationId === undefined ? undefined : productEvents.findLast(event => event.type === 'message-delivery'
      && event.deliveryOperationId === targetDeliveryOperationId
      && event.persona === turn.persona
      && event.sessionMessageId !== undefined)
    const branch = (await this.requireConversation(id)).branches.find(item => item.persona === turn.persona)
    const agent = branch === undefined ? undefined : this.ctx.agents.get(branch.sessionId)
    if (delivery?.type !== 'message-delivery' || agent === undefined || delivery.sessionMessageId === undefined) return undefined
    const sessionEvents = agent.session.events
    const user = sessionEvents.find(event => event.type === 'user/message' && String(event.data.id) === delivery.sessionMessageId)
    if (user?.type !== 'user/message') return undefined
    // A user message is enclosed by the nearest preceding turn/start and its
    // matching turn/end. Step numbers are local to that DSH turn.
    const start = [...sessionEvents].reverse().find(event => event.type === 'turn/start' && event.seq <= user.seq)
    if (start?.type !== 'turn/start') return undefined
    const dshTurn = start.data.turn
    const end = sessionEvents.find(event => event.type === 'turn/end' && event.data.turn === dshTurn && event.seq > user.seq)
    const assistantEvents = sessionEvents.filter((event): event is SessionEvent<'assistant/message' | 'assistant/chunk'> => event.seq > user.seq
      && (end === undefined || event.seq < end.seq)
      && (event.type === 'assistant/message' || event.type === 'assistant/chunk')
      && event.data.turn === dshTurn)
    const steps = [...new Set(assistantEvents.map(event => event.data.step))].sort((left, right) => left - right)
    const stepTexts = steps.flatMap((step) => {
      const settled = assistantEvents.findLast((event): event is SessionEvent<'assistant/message'> => event.type === 'assistant/message' && event.data.step === step)
      if (settled !== undefined) {
        const blocks = settled.data.message.content.filter(block => block.type === 'reasoning').map(block => block.text).filter(text => text !== '')
        return blocks.length === 0 ? [] : [blocks.join('\n\n')]
      }
      const blockDeltas = new Map<number, string>()
      for (const event of assistantEvents) {
        if (event.type !== 'assistant/chunk' || event.data.step !== step || event.data.chunk.type !== 'reasoning-delta') continue
        blockDeltas.set(event.data.chunk.index, (blockDeltas.get(event.data.chunk.index) ?? '') + event.data.chunk.text)
      }
      const blocks = [...blockDeltas.entries()].sort(([left], [right]) => left - right).map(([, text]) => text).filter(text => text !== '')
      return blocks.length === 0 ? [] : [blocks.join('\n\n')]
    })
    const text = stepTexts.join('\n\n')
    if (text.length === 0) return undefined
    const status = turn.status === 'completed' ? 'completed' : turn.status === 'failed' ? 'failed' : turn.status === 'cancelled' ? 'cancelled' : 'running'
    return { persona: turn.persona, turnOperationId: String(requestedTurn), status, text }
  }

  /** Return only redacted evidence lifecycle metadata for product details. */
  async evidenceStatus(id: DilemmaId): Promise<readonly {
    readonly id: string
    readonly persona: PersonaId
    readonly status: 'available' | 'challenged' | 'withdrawn'
    readonly evidenceType?: string
    readonly trustLevel?: string
    readonly title?: string
    readonly text?: string
    readonly source?: string
  }[]> {
    const events = await this.repository.readEvents(id) ?? []
    const latest = new Map<string, Extract<ProductEvent, { type: 'evidence' }>>()
    for (const event of events) if (event.type === 'evidence') latest.set(event.evidenceId, event)
    return [...latest.values()].flatMap((event) => {
      const derived = this.evidence.find(item => item.id === event.evidenceId)
      const persona = event.persona ?? derived?.persona
      if (persona === undefined) return []
      const evidenceType = event.evidenceType ?? derived?.evidenceType
      const trustLevel = event.trustLevel ?? derived?.trust
      return [{
        id: event.evidenceId, persona, status: event.status,
        ...(evidenceType === undefined ? {} : { evidenceType }),
        ...(trustLevel === undefined ? {} : { trustLevel }),
        ...(derived === undefined ? {} : { title: derived.title, text: derived.text, source: derived.source }),
      }]
    })
  }

  /** Project redacted, durable evidence lookup activity without exposing tool internals. */
  async evidenceActivity(id: DilemmaId): Promise<readonly {
    readonly operationId: string
    readonly status: 'completed-with-results' | 'completed-zero-hit' | 'budget-exhausted' | 'cancelled' | 'failed'
    readonly returnedCount: number
  }[]> {
    const events = await this.repository.readEvents(id) ?? []
    const latest = new Map<string, Extract<ProductEvent, { type: 'evidence-tool-claim' }>>()
    for (const event of events) if (event.type === 'evidence-tool-claim') latest.set(String(event.operationId), event)
    return [...latest.values()].filter(event => event.status !== 'claimed').map(event => ({
      operationId: String(event.operationId),
      status: event.status === 'completed'
        ? (event.returnedEvidenceIds?.length === 0 ? 'completed-zero-hit' as const : 'completed-with-results' as const)
        : event.status === 'cancelled' ? 'cancelled' as const
          : event.reservedCount === 0 ? 'budget-exhausted' as const : 'failed' as const,
      returnedCount: event.returnedEvidenceIds?.length ?? 0,
    }))
  }

  /** Return the latest durable state-analysis status and validated candidates. */
  async stateStatus(id: DilemmaId): Promise<{
    readonly operationId: OperationId
    readonly retryable: boolean
    readonly failureCategory?: 'provider' | 'parse' | 'context' | 'stale'
    readonly status: 'claimed' | 'running' | 'completed' | 'failed' | 'stale'
    readonly candidates?: readonly { readonly id: string; readonly kind: string; readonly text: string }[]
    readonly sharedStateItems?: readonly SharedStateItem[]
    readonly personaSnapshot?: PersonaSnapshot
  } | undefined> {
    const events = await this.repository.readEvents(id) ?? []
    const latest = events.findLast(event => event.type === 'state-analysis')
    if (latest?.type !== 'state-analysis') return undefined
    const items = new Map<string, SharedStateItem>()
    const snapshots = new Map<PersonaId, PersonaSnapshot>()
    for (const event of events) {
      if (event.type === 'shared-state') items.set(event.item.id, event.item)
      if (event.type === 'persona-snapshot') snapshots.set(event.snapshot.persona, event.snapshot)
    }
    const snapshot = snapshots.get((await this.requireConversation(id)).activePersona)
    return {
      status: latest.status,
      operationId: latest.operationId,
      retryable: latest.status === 'failed',
      ...(latest.status === 'failed' && latest.failureCategory !== undefined ? { failureCategory: latest.failureCategory } : latest.status === 'stale' ? { failureCategory: 'stale' as const } : {}),
      ...(latest.candidates === undefined ? {} : {
        candidates: latest.candidates.map(candidate => ({
          id: candidate.id, kind: candidate.kind, text: candidate.text,
        })),
      }),
      ...(items.size === 0 ? {} : { sharedStateItems: [...items.values()] }),
      ...(snapshot === undefined ? {} : { personaSnapshot: snapshot }),
    }
  }

  /** Confirm a model candidate explicitly; model output never self-confirms. */
  confirmState(id: DilemmaId, itemId: string, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation> {
    return this.transitionSharedState(id, itemId, 'confirm', userRequestId, expectedRevision)
  }

  /** Reject a candidate without deleting its append-only history. */
  rejectState(id: DilemmaId, itemId: string, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation> {
    return this.transitionSharedState(id, itemId, 'reject', userRequestId, expectedRevision)
  }

  /** Withdraw a confirmed item from future context while retaining its history. */
  withdrawState(id: DilemmaId, itemId: string, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation> {
    return this.transitionSharedState(id, itemId, 'withdraw', userRequestId, expectedRevision)
  }

  /** Resolve an unresolved item explicitly. */
  resolveState(id: DilemmaId, itemId: string, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation> {
    return this.transitionSharedState(id, itemId, 'resolve', userRequestId, expectedRevision)
  }

  /** Modify a candidate or confirmed item; the old id becomes superseded. */
  modifyState(
    id: DilemmaId, itemId: string, options: StateItemModifyOptions,
    userRequestId: RequestId, expectedRevision?: number,
  ): Promise<DilemmaConversation> {
    return this.serial(id, async () => {
      const conversation = await this.requireConversation(id)
      if (conversation.seenRequests.includes(userRequestId)) return conversation
      this.assertExpectedRevision(conversation, expectedRevision)
      if (conversation.deletion !== undefined) throw new Error(`dilemma '${id}' is deleting and cannot modify state`)
      const events = await this.repository.readEvents(id) ?? []
      const current = latestSharedStateItem(events, itemId)
      if (current === undefined || (current.status !== 'candidate' && current.status !== 'confirmed')) {
        throw new Error(`state item '${itemId}' is not modifiable`)
      }
      const text = options.text.trim()
      if (text === '') throw new Error('state item text must not be empty')
      const replacementId = `${itemId}:modified:${createHash('sha256').update(String(userRequestId)).digest('hex').slice(0, 16)}`
      const replacement: SharedStateItem = {
        ...current, id: replacementId, kind: options.kind ?? current.kind, text,
        // User-authored corrections are authoritative; requiring a second
        // confirmation repeats the action the user just completed.
        status: 'confirmed', confirmation: 'explicit', revision: conversation.lifecycleRevision + 2,
      }
      const superseded: SharedStateItem = { ...current, status: 'superseded', revision: conversation.lifecycleRevision + 1 }
      await this.repository.appendSharedStateIfCurrent(id, conversation.lifecycleRevision, [
        { type: 'shared-state', item: superseded, requestId: requestId(`${userRequestId}:supersede`) },
        { type: 'shared-state', item: replacement, requestId: userRequestId },
      ])
      return this.requireConversation(id)
    })
  }

  private transitionSharedState(
    id: DilemmaId, itemId: string, action: 'confirm' | 'reject' | 'withdraw' | 'resolve',
    userRequestId: RequestId, expectedRevision?: number,
  ): Promise<DilemmaConversation> {
    return this.serial(id, async () => {
      const conversation = await this.requireConversation(id)
      if (conversation.seenRequests.includes(userRequestId)) return conversation
      this.assertExpectedRevision(conversation, expectedRevision)
      if (conversation.deletion !== undefined) throw new Error(`dilemma '${id}' is deleting and cannot modify state`)
      const current = latestSharedStateItem(await this.repository.readEvents(id) ?? [], itemId)
      if (current === undefined) throw new Error(`unknown state item '${itemId}'`)
      const nextStatus: Record<typeof action, SharedStateItemStatus> = {
        confirm: 'confirmed', reject: 'rejected', withdraw: 'withdrawn', resolve: 'resolved',
      }
      const allowed: Record<typeof action, SharedStateItemStatus[]> = {
        confirm: ['candidate'], reject: ['candidate'], withdraw: ['confirmed'], resolve: ['candidate'],
      }
      if (!allowed[action].includes(current.status) || (action === 'resolve' && current.kind !== 'unresolved')) throw new Error(`state item '${itemId}' cannot ${action}`)
      const item: SharedStateItem = { ...current, status: nextStatus[action], revision: conversation.lifecycleRevision + 1 }
      await this.repository.appendSharedStateIfCurrent(id, conversation.lifecycleRevision, [{ type: 'shared-state', item, requestId: userRequestId }])
      return this.requireConversation(id)
    })
  }

  /** Switch the active branch without exposing DSH Session identities to the product consumer. */
  async switchPersona(
    id: DilemmaId, persona: PersonaId, userRequestId: RequestId, expectedRevision?: number,
  ): Promise<DilemmaConversation> {
    return this.serial(id, async () => {
      const current = await this.requireConversation(id)
      this.assertExpectedRevision(current, expectedRevision)
      if (current.deletion !== undefined) throw new Error(`dilemma '${id}' is deleting and cannot switch persona`)
      if (current.archived === true) throw new Error(`dilemma '${id}' is archived and cannot switch persona`)
      const activeTurn = await this.activeTurn(id)
      if (activeTurn !== undefined || this.messageRuns.has(id)) {
        throw new Error(`dilemma '${id}' turn is still running (${activeTurn?.executionState ?? 'running'}); stop and await it before switching persona`)
      }
      if (current.activePersona === persona) return current
      if (current.seenRequests.includes(userRequestId)) return current
      const existing = current.branches.find(branch => branch.persona === persona)
      if (existing !== undefined) {
        return (await this.repository.append(id, { type: 'persona-switched', persona, timelineId: `switch:${persona}:${randomUUID()}`, requestId: userRequestId })).conversation
      }
      const allocationOperation = operationId(`branch:${id}:${persona}:${userRequestId}`)
      const priorAllocation = current.branchAllocations.find(allocation => allocation.persona === persona)
      const allocationBase = priorAllocation ?? {
        operationId: allocationOperation, persona,
        sessionId: sessionId(`man-roleplayer:${id}:${persona}:${randomUUID()}`),
        expectedLifecycleRevision: current.lifecycleRevision, status: 'claimed' as const,
      }
      const branch = this.bindPresetIdentities([{
        persona,
        sessionId: allocationBase.sessionId,
        ...(allocationBase.presetIdentity === undefined ? {} : { presetIdentity: allocationBase.presetIdentity }),
      }])[0]
      if (branch === undefined) throw new Error(`persona branch '${persona}' could not be bound`)
      const allocation = { ...allocationBase, ...(branch.presetIdentity === undefined ? {} : { presetIdentity: branch.presetIdentity }), status: 'claimed' as const }
      if (priorAllocation === undefined || priorAllocation.status === 'failed') {
        await this.repository.append(id, {
          type: 'branch-allocation', allocation,
          requestId: requestId(`branch-claim:${allocation.operationId}:${priorAllocation === undefined ? 'first' : 'retry'}`),
        })
      }
      let handles: readonly AgentHandle[] = []
      try {
        const live = this.live.get(id)
        const branchAgentOptions = live?.handles[0]?.agent.options ?? this.defaultAgentOptions
        handles = await this.createHandles([branch], branchAgentOptions)
        this.assertHandlePresetIdentities(handles, [branch])
        await this.repository.append(id, { type: 'branch-added', operationId: allocation.operationId, branch, requestId: requestId(`branch-added:${allocation.operationId}`) })
        if (handles[0] !== undefined) {
          this.bindProductTools(handles)
          this.evidenceCapabilities.set(handles[0].agent, { dilemmaId: id, persona })
          if (live === undefined) await handles[0].dispose()
          else live.handles.push(handles[0])
        }
      } catch (error) {
        await Promise.all(handles.map(handle => handle.dispose()))
        await this.repository.append(id, { type: 'branch-allocation', allocation: { ...allocation, status: 'failed' }, requestId: requestId(`branch-failed:${allocation.operationId}`) })
        throw error
      }
      return (await this.repository.append(id, { type: 'persona-switched', persona, timelineId: `switch:${persona}:${randomUUID()}`, requestId: userRequestId })).conversation
    })
  }

  /** Replace the generated title with an explicit user-selected title. */
  async rename(id: DilemmaId, title: string, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation> {
    return this.serial(id, async () => {
      const conversation = await this.requireConversation(id)
      if (conversation.seenRequests.includes(userRequestId)) return conversation
      this.assertExpectedRevision(conversation, expectedRevision)
      if (title.trim().length === 0) throw new Error('title must not be empty')
      if (conversation.deletion !== undefined) throw new Error(`dilemma '${id}' is deleting and cannot rename`)
      if (conversation.archived === true) throw new Error(`dilemma '${id}' is archived and cannot rename`)
      return (await this.repository.append(id, { type: 'renamed', title: title.trim(), titleRevision: conversation.titleRevision + 1, requestId: userRequestId })).conversation
    })
  }

  /** Pause a discussion after cancelling its active persona turn, if any. */
  async pause(id: DilemmaId, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation> {
    const active = this.messageRuns.get(id)
    let cancelledLease: MessageRunLease | undefined
    const result = await this.serial(id, async () => {
      const conversation = await this.requireConversation(id)
      this.assertExpectedRevision(conversation, expectedRevision)
      if (conversation.deletion !== undefined) throw new Error(`dilemma '${id}' is deleting and cannot pause`)
      if (conversation.discussionStatus === 'paused') return conversation
      if (conversation.discussionStatus === 'stage_ended') throw new Error(`dilemma '${id}' stage has ended; resume it before pausing`)
      const current = this.messageRuns.get(id)
      if (current !== undefined) {
        await this.cancelMessageInSerial(id, current)
        cancelledLease = current
      }
      return (await this.repository.append(id, { type: 'discussion-status', status: 'paused', requestId: userRequestId })).conversation
    })
    await this.awaitCancelledRun(cancelledLease ?? active)
    return result
  }

  /** Resume a paused or stage-ended discussion without creating a new dilemma or turn. */
  async resumeDiscussion(id: DilemmaId, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation> {
    return this.serial(id, async () => {
      const conversation = await this.requireConversation(id)
      this.assertExpectedRevision(conversation, expectedRevision)
      if (conversation.deletion !== undefined) throw new Error(`dilemma '${id}' is deleting and cannot resume`)
      if (conversation.discussionStatus === 'in_progress') return conversation
      return (await this.repository.append(id, { type: 'discussion-status', status: 'in_progress', requestId: userRequestId })).conversation
    })
  }

  /** Mark the current discussion stage ended; it remains readable and explicitly resumable. */
  async endStage(id: DilemmaId, userRequestId: RequestId, expectedRevision?: number): Promise<DilemmaConversation> {
    const active = this.messageRuns.get(id)
    let cancelledLease: MessageRunLease | undefined
    const result = await this.serial(id, async () => {
      const conversation = await this.requireConversation(id)
      this.assertExpectedRevision(conversation, expectedRevision)
      if (conversation.deletion !== undefined) throw new Error(`dilemma '${id}' is deleting and cannot end the stage`)
      if (conversation.discussionStatus === 'stage_ended') return conversation
      const current = this.messageRuns.get(id)
      if (current !== undefined) {
        await this.cancelMessageInSerial(id, current)
        cancelledLease = current
      }
      return (await this.repository.append(id, { type: 'discussion-status', status: 'stage_ended', requestId: userRequestId })).conversation
    })
    await this.awaitCancelledRun(cancelledLease ?? active)
    return result
  }

  /** Await an already requested cancellation outside the conversation lock. */
  private async awaitCancelledRun(active: MessageRunLease | undefined): Promise<void> {
    if (active === undefined) return
    try { await awaitStopWithin(active.promise, this.stopTimeoutMs) } catch {
      // The product terminal is durable; a cancellation rejection is expected.
    }
  }

  /** Cancel and settle a claimed message while the conversation owner is held. */
  private async cancelMessageInSerial(id: DilemmaId, lease: MessageRunLease): Promise<void> {
    const { messageId, deliveryOperationId, turnOperationId, persona, agent } = lease.token
    const events = await this.repository.readEvents(id) ?? []
    const turn = events.findLast(event => event.type === 'turn' && event.turnOperationId === turnOperationId && event.messageId === messageId)
    const message = events.findLast(event => event.type === 'user-message' && event.messageId === messageId)
    if (message?.type !== 'user-message' || message.deliveryOperationId !== deliveryOperationId
      || turn?.type !== 'turn' || turn.persona !== persona || turn.status === 'completed' || turn.status === 'failed') return
    if (turn.status !== 'claimed' && turn.status !== 'running') return
    // This is deliberately synchronous and follows all validation: awaiting
    // Agent completion while holding the serializer would deadlock its
    // terminal settlement on this same owner.
    await this.repository.append(id, {
      type: 'turn-execution', turnOperationId, messageId, persona, state: 'stopping',
      requestId: requestId(`turn-execution-stopping:${turnOperationId}`),
    })
    await this.repository.settleMessageOperationIfOpen(id, deliveryOperationId, turnOperationId,
      { type: 'message-delivery', messageId, deliveryOperationId, persona, status: 'cancelled', requestId: requestId(`delivery-cancel:${deliveryOperationId}`) },
      { type: 'turn', turnOperationId, messageId, persona, status: 'cancelled', requestId: requestId(`turn-cancel:${turnOperationId}`) })
    this.cancelOwnedAgent(agent, { kind: 'user' })
  }

  /** Validate and wait for one product-owned structured choice from the active Agent turn. */
  async askChoice(agent: Agent | undefined, questions: unknown, signal?: AbortSignal): Promise<readonly ChoiceAnswer[]> {
    if (agent === undefined) throw new Error('product choice requires the live Agent execution identity')
    const lease = this.turnSubmissionLeases.get(agent)
    const messageLease = [...this.messageRuns.values()].find(item => item.token.agent === agent)
    if (lease === undefined || messageLease === undefined
      || lease.turnOperationId !== messageLease.token.turnOperationId
      || lease.messageId !== messageLease.token.messageId || lease.persona !== messageLease.token.persona) {
      throw new Error('product choice is not bound to a live message lease')
    }
    const parsedQuestions = choiceQuestionsSchema.safeParse(questions)
    if (!parsedQuestions.success) throw new Error('product choice questions are invalid')
    const normalizedQuestions = normalizeChoiceQuestions(parsedQuestions.data)
    const dilemmaIdValue = lease.dilemmaId
    const operation = operationId(`choice:${lease.turnOperationId}`)
    const existing = await this.serial(dilemmaIdValue, async () => {
      const events = await this.repository.readEvents(dilemmaIdValue) ?? []
      const current = events.findLast(event => event.type === 'choice' && event.operationId === operation)
      if (current?.type === 'choice' && current.status === 'answered') return current.answers ?? []
      if (current?.type === 'choice' && current.status !== 'pending') throw new Error(`product choice '${operation}' is no longer open`)
      if (current === undefined) {
        await this.repository.append(dilemmaIdValue, {
          type: 'choice', operationId: operation, turnOperationId: lease.turnOperationId,
          persona: lease.persona, status: 'pending', questions: normalizedQuestions,
          requestId: requestId(`choice-pending:${operation}`),
        })
        await this.repository.append(dilemmaIdValue, {
          type: 'turn-execution', turnOperationId: lease.turnOperationId, messageId: lease.messageId,
          persona: lease.persona, state: 'waiting-user', requestId: requestId(`turn-execution-waiting:${operation}`),
        })
      }
      return undefined
    })
    if (existing !== undefined) return existing
    const waiter = this.choiceWaiters.get(String(operation))
    if (waiter !== undefined) {
      // A repeated model call for the same operation shares the first waiter's durable answer.
      return waiter.promise
    }
    const budgetRun = this.turnBudgetRuns.get(String(agent.id))
    if (budgetRun !== undefined) {
      // 人在选择时不消耗模型工作预算；恢复后继续使用原轮次的剩余时间。
      clearTimeout(budgetRun.activeTimer)
      budgetRun.activeRemainingMs = Math.max(0, budgetRun.activeRemainingMs - (performance.now() - budgetRun.activeStartedAt))
    }
    let resolve!: (answer: readonly ChoiceAnswer[]) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<readonly ChoiceAnswer[]>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise
      reject = rejectPromise
    })
    this.choiceWaiters.set(String(operation), { operationId: operation, agent, promise, resolve, reject })
    const abort = (): void => { void this.cancelChoice(dilemmaIdValue, operation, requestId(`choice-abort:${operation}`)).catch(reject) }
    signal?.addEventListener('abort', abort, { once: true })
    void promise.finally(() => {
      signal?.removeEventListener('abort', abort)
      if (budgetRun !== undefined && !signal?.aborted && !this.closing) this.resumeActiveBudget(budgetRun)
      if (this.choiceWaiters.get(String(operation))?.resolve === resolve) this.choiceWaiters.delete(String(operation))
    }).catch(() => undefined)
    return promise
  }

  /** Answer one pending product choice and wake its waiting Agent turn. */
  async answerChoice(
    id: DilemmaId,
    choiceOperationId: OperationId,
    answers: unknown,
    userRequestId: RequestId,
    expectedRevision?: number,
  ): Promise<DilemmaConversation> {
    return this.serial(id, async () => {
      const conversation = await this.requireConversation(id)
      this.assertExpectedRevision(conversation, expectedRevision)
      const events = await this.repository.readEvents(id) ?? []
      const current = events.findLast(event => event.type === 'choice' && event.operationId === choiceOperationId)
      if (current?.type !== 'choice' || current.status !== 'pending' || current.questions === undefined) throw new Error(`product choice '${choiceOperationId}' is not pending`)
      const parsed = choiceAnswersSchema.safeParse(answers)
      if (!parsed.success) throw new Error('product choice answer is invalid')
      const normalizedAnswers = normalizeChoiceAnswers(parsed.data)
      if (!answersMatchQuestions(current.questions, normalizedAnswers)) throw new Error('product choice answer is invalid')
      await this.repository.append(id, { type: 'choice', operationId: choiceOperationId, turnOperationId: current.turnOperationId, persona: current.persona, status: 'answered', questions: current.questions, answers: normalizedAnswers, requestId: userRequestId })
      const result = await this.repository.append(id, {
        type: 'turn-execution', turnOperationId: current.turnOperationId, messageId: (await this.requireTurnMessageId(id, current.turnOperationId)),
        persona: current.persona, state: 'running', requestId: requestId(`turn-execution-running-choice:${choiceOperationId}`),
      })
      this.choiceWaiters.get(String(choiceOperationId))?.resolve(normalizedAnswers)
      return result.conversation
    })
  }

  /** Cancel a pending product choice and stop the owning Agent turn. */
  async cancelChoice(
    id: DilemmaId,
    choiceOperationId: OperationId,
    userRequestId: RequestId,
    expectedRevision?: number,
  ): Promise<DilemmaConversation> {
    const currentWaiter = this.choiceWaiters.get(String(choiceOperationId))
    const active = this.messageRuns.get(id)
    const result = await this.serial(id, async () => {
      const conversation = await this.requireConversation(id)
      this.assertExpectedRevision(conversation, expectedRevision)
      const events = await this.repository.readEvents(id) ?? []
      const current = events.findLast(event => event.type === 'choice' && event.operationId === choiceOperationId)
      if (current?.type !== 'choice' || current.status !== 'pending') return conversation
      const lease = this.messageRuns.get(id)
      if (currentWaiter !== undefined && (lease === undefined || lease.token.agent !== currentWaiter.agent
        || lease.token.turnOperationId !== current.turnOperationId)) {
        throw new Error('cancel operation does not match the claimed choice lease')
      }
      currentWaiter !== undefined && this.cancelOwnedAgent(currentWaiter.agent, { kind: 'user' })
      await this.repository.append(id, {
        type: 'turn-execution', turnOperationId: current.turnOperationId, messageId: await this.requireTurnMessageId(id, current.turnOperationId),
        persona: current.persona, state: 'stopping', requestId: requestId(`turn-execution-stopping-choice:${choiceOperationId}`),
      })
      const result = await this.repository.append(id, { type: 'choice', operationId: choiceOperationId, turnOperationId: current.turnOperationId, persona: current.persona, status: 'cancelled', ...(current.questions === undefined ? {} : { questions: current.questions }), requestId: userRequestId })
      currentWaiter?.reject(new Error('product choice was cancelled'))
      return result.conversation
    })
    await this.awaitCancelledRun(active)
    return result
  }

  /** Mark a derived evidence entry challenged; only an explicit review restores it. */
  async challengeEvidence(id: DilemmaId, evidenceId: string, userRequestId: RequestId): Promise<DilemmaConversation> {
    return this.serial(id, async () => {
      const evidence = this.evidence.find(item => item.id === evidenceId)
      if (evidence === undefined) throw new Error(`unknown evidence '${evidenceId}'`)
      const events = await this.repository.readEvents(id) ?? []
      const current = events.findLast(event => event.type === 'evidence' && event.evidenceId === evidenceId)
      if (current?.type === 'evidence' && current.status !== 'available') throw new Error(`evidence '${evidenceId}' is not available for challenge`)
      return (await this.repository.append(id, { type: 'evidence', evidenceId, persona: evidence.persona, evidenceType: evidence.evidenceType, trustLevel: evidence.trust, source: evidence.source, status: 'challenged', requestId: userRequestId })).conversation
    })
  }

  /** Withdraw evidence permanently from the current allow-list. */
  async withdrawEvidence(id: DilemmaId, evidenceId: string, userRequestId: RequestId): Promise<DilemmaConversation> {
    return this.serial(id, async () => {
      const evidence = this.evidence.find(item => item.id === evidenceId)
      if (evidence === undefined) throw new Error(`unknown evidence '${evidenceId}'`)
      const events = await this.repository.readEvents(id) ?? []
      const current = events.findLast(event => event.type === 'evidence' && event.evidenceId === evidenceId)
      if (current?.type === 'evidence' && current.status === 'withdrawn') {
        if (events.some(event => event.requestId === userRequestId)) return this.requireConversation(id)
        throw new Error(`evidence '${evidenceId}' is already withdrawn`)
      }
      return (await this.repository.append(id, {
        type: 'evidence', evidenceId, persona: evidence.persona, evidenceType: evidence.evidenceType,
        trustLevel: evidence.trust, source: evidence.source, status: 'withdrawn', requestId: userRequestId,
      })).conversation
    })
  }

  /** Query only reliable available evidence through an Agent-bound capability. */
  async lookupEvidence(
    agent: Agent | undefined,
    topic: string,
    requestedCount: number,
    signal?: AbortSignal,
  ): Promise<EvidenceLookupResult> {
    if (agent === undefined) return { status: 'unauthorized', evidence: [] }
    const run = this.evidenceRuns.get(String(agent.id)); const capability = this.evidenceCapabilities.get(agent)
    if (run === undefined || capability === undefined
      || run.dilemmaId !== capability.dilemmaId || run.persona !== capability.persona) return { status: 'unauthorized', evidence: [] }
    // The tool remains Agent-scoped, but a low-information turn cannot acquire
    // a research claim or expose evidence even if the model ignores its policy.
    if (!run.allowEvidence) return { status: 'completed', evidence: [] }
    if (!Number.isSafeInteger(requestedCount) || requestedCount < 1 || requestedCount > EVIDENCE_MAX_ENTRIES_PER_CALL) return { status: 'failed', evidence: [] }
    const toolOperationId = operationId(`evidence-tool:${run.turnOperationId}:${topic.trim()}`)
    const canonicalEvidence = this.evidence.map(item => ({
      id: item.id, persona: item.persona, type: item.evidenceType, trust: item.trust,
      firstPerson: item.firstPersonAllowed, title: item.title, text: item.text, source: item.source,
    }))
    const fingerprint = createHash('sha256').update(JSON.stringify(canonicalEvidence)).digest('hex')
    const claimed = await this.serial(capability.dilemmaId, async () => {
      const priorEvents = await this.repository.readEvents(capability.dilemmaId) ?? []
      const prior = priorEvents.findLast(event => event.type === 'evidence-tool-claim' && event.operationId === toolOperationId)
      if (prior?.type === 'evidence-tool-claim' && prior.status !== 'claimed') return false
      if (prior?.type === 'evidence-tool-claim') return false
      const latestClaims = new Map<string, Extract<ProductEvent, { type: 'evidence-tool-claim' }>>()
      for (const event of priorEvents) if (event.type === 'evidence-tool-claim' && event.turnOperationId === run.turnOperationId) latestClaims.set(String(event.operationId), event)
      const calls = [...latestClaims.values()].filter(event => event.status === 'claimed' || event.status === 'completed')
      const bytes = calls.reduce((total, event) => total + event.reservedBytes, 0)
      if (calls.length >= EVIDENCE_MAX_CALLS || bytes + requestedCount * EVIDENCE_MAX_ENTRY_BYTES > EVIDENCE_MAX_TOTAL_BYTES) {
        await this.repository.append(capability.dilemmaId, { type: 'evidence-tool-claim', operationId: toolOperationId, turnOperationId: run.turnOperationId, persona: run.persona, sessionId: agent.id, topic: topic.trim(), requestedCount, reservedCount: 0, reservedBytes: 0, deadline: Date.now(), evidenceRevision: run.evidenceRevision, fingerprint, status: 'failed', requestId: requestId(`evidence-tool-budget-failed:${toolOperationId}`) })
        return false
      }
      await this.repository.append(capability.dilemmaId, { type: 'evidence-tool-claim', operationId: toolOperationId, turnOperationId: run.turnOperationId, persona: run.persona, sessionId: agent.id, topic: topic.trim(), requestedCount, reservedCount: requestedCount, reservedBytes: requestedCount * EVIDENCE_MAX_ENTRY_BYTES, deadline: Date.now() + EVIDENCE_TOOL_DEADLINE_MS, evidenceRevision: run.evidenceRevision, fingerprint, status: 'claimed', requestId: requestId(`evidence-tool-claim:${toolOperationId}`) })
      return true
    })
    if (!claimed) {
      const prior = (await this.repository.readEvents(capability.dilemmaId) ?? []).findLast(event => event.type === 'evidence-tool-claim' && event.operationId === toolOperationId)
      return prior?.type === 'evidence-tool-claim' && prior.status === 'failed' && prior.reservedCount === 0
        ? { status: 'budget-exhausted', evidence: [] } : { status: 'completed', evidence: [] }
    }
    if (signal?.aborted === true) {
      await this.repository.settleEvidenceToolClaimIfOpen(capability.dilemmaId, toolOperationId, { type: 'evidence-tool-claim', operationId: toolOperationId, turnOperationId: run.turnOperationId, persona: run.persona, sessionId: agent.id, topic: topic.trim(), requestedCount, reservedCount: 0, reservedBytes: 0, deadline: Date.now(), evidenceRevision: run.evidenceRevision, fingerprint, status: 'cancelled', requestId: requestId(`evidence-tool-cancelled:${toolOperationId}`) })
      return { status: 'cancelled', evidence: [] }
    }
    await this.updateTurnActivityForTurn(capability.dilemmaId, run.turnOperationId, 'researching', undefined, `${toolOperationId}:start`)
    const events = await this.repository.readEvents(capability.dilemmaId) ?? []
    const statuses = new Map<string, Extract<ProductEvent, { type: 'evidence' }>>()
    for (const event of events) if (event.type === 'evidence') statuses.set(event.evidenceId, event)
    const normalizedTopic = topic.trim().toLowerCase()
    const results = this.evidence.filter(item => item.persona === capability.persona
      && evidenceTopicScore(item, normalizedTopic) > 0 && Buffer.byteLength(item.text, 'utf8') <= EVIDENCE_MAX_ENTRY_BYTES)
      .filter(item => statuses.get(item.id)?.status === 'available' || statuses.get(item.id) === undefined)
      .sort((left, right) => {
        const scoreDifference = evidenceTopicScore(right, normalizedTopic) - evidenceTopicScore(left, normalizedTopic)
        if (scoreDifference !== 0) return scoreDifference
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
      })
      .slice(0, requestedCount)
    const latest = (await this.repository.readEvents(capability.dilemmaId) ?? []).findLast(event => event.type === 'evidence-tool-claim' && event.operationId === toolOperationId)
    if (latest?.type === 'evidence-tool-claim' && latest.status !== 'claimed') {
      return latest.status === 'completed' ? { status: 'completed', evidence: [] } : { status: 'failed', evidence: [] }
    }
    if (latest?.type === 'evidence-tool-claim' && latest.deadline <= Date.now()) {
      await this.repository.settleEvidenceToolClaimIfOpen(capability.dilemmaId, toolOperationId, { ...latest, status: 'failed', requestId: requestId(`evidence-tool-deadline:${toolOperationId}`) })
      return { status: 'failed', evidence: [] }
    }
    const provenance = results.map(item => ({
      type: 'evidence' as const, evidenceId: item.id, persona: item.persona, evidenceType: item.evidenceType,
      trustLevel: item.trust, sourceFingerprint: fingerprint, toolOperationId, status: 'available' as const,
      requestId: requestId(`evidence-use:${toolOperationId}:${item.id}`),
    }))
    const completionEvidenceRevision = (await this.repository.readEvents(capability.dilemmaId) ?? []).filter(event => event.type === 'evidence').length
    const settled = await this.repository.completeEvidenceToolClaimIfOpen(capability.dilemmaId, toolOperationId, provenance, {
      type: 'evidence-tool-claim', operationId: toolOperationId, turnOperationId: run.turnOperationId,
      persona: run.persona, sessionId: agent.id, topic: topic.trim(), requestedCount,
      reservedCount: results.length,
      reservedBytes: results.reduce((total, item) => total + item.text.length, 0),
      returnedEvidenceIds: results.map(item => item.id),
      deadline: Date.now(), evidenceRevision: run.evidenceRevision, fingerprint, status: 'completed',
      requestId: requestId(`evidence-tool-completed:${toolOperationId}`),
    }, completionEvidenceRevision)
    const currentEvents = await this.repository.readEvents(capability.dilemmaId) ?? []
    const cumulativeEvidenceCount = new Set(currentEvents.filter((event): event is Extract<ProductEvent, { type: 'evidence-tool-claim' }> => event.type === 'evidence-tool-claim'
      && event.turnOperationId === run.turnOperationId && event.status === 'completed').flatMap(event => event.returnedEvidenceIds ?? [])).size
    // The user-facing count is the number of distinct sources consulted in this
    // turn, not the largest single lookup result or a sum containing duplicates.
    await this.updateTurnActivityForTurn(capability.dilemmaId, run.turnOperationId, 'researching', cumulativeEvidenceCount, `${toolOperationId}:result`)
    return settled.accepted && settled.status === 'completed'
      ? { status: 'completed', evidence: results }
      : { status: 'failed', evidence: [] }
  }

  /** Restore challenged evidence only through an explicit review action. */
  async reviewEvidence(id: DilemmaId, evidenceId: string, userRequestId: RequestId): Promise<DilemmaConversation> {
    return this.serial(id, async () => {
      const evidence = this.evidence.find(item => item.id === evidenceId)
      const events = await this.repository.readEvents(id) ?? []
      const current = events.findLast(event => event.type === 'evidence' && event.evidenceId === evidenceId)
      if (evidence === undefined || current?.type !== 'evidence' || current.status !== 'challenged') throw new Error(`challenged evidence '${evidenceId}' was not found`)
      return (await this.repository.append(id, { type: 'evidence', evidenceId, persona: evidence.persona, evidenceType: evidence.evidenceType, trustLevel: evidence.trust, source: evidence.source, status: 'available', requestId: userRequestId })).conversation
    })
  }

  /** Analyze the durable conversation once; concurrent callers share one run. */
  async analyzeState(id: DilemmaId, stateOperationId: OperationId = operationId(`state:${id}`)): Promise<DilemmaConversation> {
    const key = `${id}:${stateOperationId}`
    const existing = this.stateRuns.get(key)
    if (existing !== undefined) return existing
    const run = this.runStateAnalysis(id, stateOperationId)
    this.stateRuns.set(key, run)
    void run.then(() => {
      if (this.stateRuns.get(key) === run) this.stateRuns.delete(key)
    }, () => {
      if (this.stateRuns.get(key) === run) this.stateRuns.delete(key)
    })
    return run
  }

  /** Retry only a failed state-analysis operation using its durable input watermark. */
  async retryState(id: DilemmaId, stateOperationId: OperationId, retryOperationId: OperationId): Promise<DilemmaConversation> {
    await this.serial(id, async () => {
      const events = await this.repository.readEvents(id) ?? []
      const prior = events.findLast(event => event.type === 'state-analysis' && event.operationId === stateOperationId)
      if (prior?.type !== 'state-analysis' || prior.status !== 'failed' || prior.inputProjection === undefined || prior.persona === undefined) {
        throw new Error('state analysis is not retryable')
      }
      const existing = events.find(event => event.type === 'state-analysis' && event.operationId === retryOperationId)
      if (existing !== undefined) return
      const stableInputProjection = dedupeProjection(prior.inputProjection)
      const modelInputProjection = aliasProjection(stableInputProjection).projection
      const retryContextRevision = prior.contextRevision ?? contextRevision(events)
      // The retry claim is the durable hand-off: it copies the failed
      // operation's authority input, but normalizes legacy duplicate facts
      // before recording the exact model input used by this new attempt.
      await this.repository.append(id, {
        type: 'state-analysis', operationId: retryOperationId,
        inputWatermark: prior.inputWatermark, revision: prior.revision, branchRevision: prior.branchRevision,
        contextRevision: retryContextRevision,
        persona: prior.persona, inputProjection: stableInputProjection, modelInputProjection, sourceOperationId: stateOperationId,
        status: 'claimed', requestId: requestId(`state-retry-claim:${retryOperationId}`),
      })
    })
    return this.analyzeState(id, retryOperationId)
  }

  /** Analyze the durable conversation once; late results are retained as stale facts. */
  private async runStateAnalysis(id: DilemmaId, stateOperationId: OperationId): Promise<DilemmaConversation> {
    const claim = await this.serial(id, async () => {
      const events = await this.repository.readEvents(id) ?? []
      const prior = events.findLast(event => event.type === 'state-analysis' && event.operationId === stateOperationId)
      // A retry operation id is durable. Once that operation reaches any
      // terminal state, replaying the same id must only recover its projection
      // and never invoke the Provider a second time (including after a cold
      // restart). A new retry id is the explicit user action that authorizes
      // another attempt against the persisted watermark.
      if (prior?.type === 'state-analysis' && ['completed', 'failed', 'stale'].includes(prior.status)) return undefined
      if (prior?.type === 'state-analysis' && prior.status === 'claimed' && prior.sourceOperationId !== undefined && prior.persona !== undefined && prior.inputProjection !== undefined) {
        const stableInputProjection = dedupeProjection(prior.inputProjection)
        const aliased = aliasProjection(stableInputProjection)
        await this.repository.append(id, { ...prior, inputProjection: stableInputProjection, modelInputProjection: aliased.projection, status: 'running', requestId: requestId(`state-running:${stateOperationId}`) })
        const branch = (await this.requireConversation(id)).branches.find(item => item.persona === prior.persona)
        const agent = branch === undefined ? undefined : this.ctx.agents.get(branch.sessionId)
        if (agent === undefined) throw new Error(`persona agent '${prior.persona}' is not live`)
        const targetTurnOperationId = stableInputProjection.findLast(event => event.type === 'turn')?.id
        return {
          inputWatermark: prior.inputWatermark, branchRevision: prior.branchRevision,
          revision: prior.revision, contextRevision: prior.contextRevision ?? contextRevision(events), persona: prior.persona,
          targetTurnOperationId: String(targetTurnOperationId), agent,
          allowedEventIds: stableInputProjection.map(event => String(event.id)),
          allowedProjection: stableInputProjection, modelProjection: aliased.projection, aliases: aliased.aliases,
        }
      }
      if (prior?.type === 'state-analysis' && (prior.status === 'claimed' || prior.status === 'running')) {
        await this.repository.append(id, { type: 'state-analysis', operationId: stateOperationId, inputWatermark: prior.inputWatermark, revision: prior.revision, branchRevision: prior.branchRevision, ...(prior.contextRevision === undefined ? {} : { contextRevision: prior.contextRevision }), ...(prior.persona === undefined ? {} : { persona: prior.persona }), ...(prior.inputProjection === undefined ? {} : { inputProjection: prior.inputProjection }), ...(prior.modelInputProjection === undefined ? {} : { modelInputProjection: prior.modelInputProjection }), status: 'failed', failureCategory: 'provider', requestId: requestId(`state-recovery-failed:${stateOperationId}`) })
        return undefined
      }
      const conversation = await this.requireConversation(id)
      const delivered = deliveredUserMessageIds(events)
      const deliveredMessageIds = new Set(delivered)
      const userMessages = events.filter((event): event is Extract<ProductEvent, { type: 'user-message' }> => event.type === 'user-message' && event.content !== undefined && deliveredMessageIds.has(event.messageId ?? event.id))
      const inputWatermark = userMessages.at(-1)?.id ?? String(id)
      const branchRevision = events.filter(event => event.type === 'turn' && event.persona === conversation.activePersona && event.status === 'completed').length
      const effectiveContextRevision = contextRevision(events)
      const context = allowedContext(events, conversation.activePersona)
      const allowedEventIds = new Set(context.allowedEventIds)
      const latestState = new Map<string, SharedStateItem>()
      for (const event of events) if (event.type === 'shared-state') latestState.set(event.item.id, event.item)
      const inputProjection: Record<string, unknown>[] = []
      for (const event of events) {
        if (event.type === 'user-message' && allowedEventIds.has(event.id) && deliveredMessageIds.has(event.messageId ?? event.id)) {
          const content = event.content ?? ''
          let remainingFragments = [content]
          for (const state of events) if (state.type === 'shared-state'
            && stateSourceIds(state.item.sourceEventIds, latestState).has(event.id)) {
            remainingFragments = remainingFragments.flatMap(fragment => fragment.split(state.item.text))
          }
          // 被处理片段的两侧不能拼接成新的用户原话；保留各连续片段，并明确告知模型这是部分历史来源。
          inputProjection.push({ id: event.id, type: event.type, persona: event.persona,
            ...(remainingFragments.length === 1 && remainingFragments[0] === content ? { content }
              : { contentStatus: 'partially-processed', remainingFragments: remainingFragments.filter(fragment => /[\p{L}\p{N}]/u.test(fragment)) }),
          })
        }
        if (event.type === 'persona-acknowledgement' && allowedEventIds.has(event.id)) inputProjection.push({ id: event.id, type: event.type, sourcePersona: event.sourcePersona, sourceUserMessageId: event.sourceUserMessageId, sourcePersonaMessageId: event.sourcePersonaMessageId })
        if (event.type === 'shared-state' && latestState.get(event.item.id) === event.item && event.item.status === 'confirmed' && allowedEventIds.has(event.item.id)) inputProjection.push({ id: event.item.id, type: event.type, persona: event.item.persona, kind: event.item.kind, text: event.item.text, sourceEventIds: event.item.sourceEventIds })
        if (event.type === 'turn' && event.persona === conversation.activePersona && event.status === 'completed' && event.sessionEventId !== undefined) inputProjection.push({ id: String(event.turnOperationId), type: event.type, persona: event.persona, sessionEventId: event.sessionEventId })
      }
      const stableInputProjection = dedupeProjection(inputProjection)
      const aliased = aliasProjection(stableInputProjection)
      await this.repository.append(id, { type: 'state-analysis', operationId: stateOperationId, inputWatermark, revision: conversation.revision, branchRevision, contextRevision: effectiveContextRevision, persona: conversation.activePersona, inputProjection: stableInputProjection, modelInputProjection: aliased.projection, status: 'claimed', requestId: requestId(`state-claim:${stateOperationId}`) })
      await this.repository.append(id, { type: 'state-analysis', operationId: stateOperationId, inputWatermark, revision: conversation.revision, branchRevision, contextRevision: effectiveContextRevision, persona: conversation.activePersona, inputProjection: stableInputProjection, modelInputProjection: aliased.projection, status: 'running', requestId: requestId(`state-running:${stateOperationId}`) })
      const branch = conversation.branches.find(item => item.persona === conversation.activePersona)
      const agent = branch === undefined ? undefined : this.ctx.agents.get(branch.sessionId)
      if (agent === undefined) {
        await this.repository.append(id, { type: 'state-analysis', operationId: stateOperationId, inputWatermark, revision: conversation.revision, branchRevision, contextRevision: effectiveContextRevision, persona: conversation.activePersona, inputProjection: stableInputProjection, modelInputProjection: aliased.projection, status: 'failed', requestId: requestId(`state-failed:${stateOperationId}`) })
        throw new Error(`persona agent '${conversation.activePersona}' is not live`)
      }
      const targetTurnOperationId = stableInputProjection.findLast(event => event.type === 'turn')?.id
      return {
        inputWatermark, branchRevision, revision: conversation.revision, contextRevision: effectiveContextRevision,
        persona: conversation.activePersona, targetTurnOperationId: String(targetTurnOperationId), agent,
        allowedEventIds: stableInputProjection.map(event => String(event.id)),
        allowedProjection: stableInputProjection, modelProjection: aliased.projection, aliases: aliased.aliases,
      }
    })
    if (claim === undefined) return (await this.requireConversation(id))
    let candidates: readonly StateCandidate[] | undefined
    let snapshot: PersonaSnapshot | undefined
    let failure = false
    let failureCategory: 'provider' | 'parse' | 'context' | undefined
    let failureDetail: string | undefined
    try {
      const provider = claim.agent.options.provider; const model = claim.agent.options.model
      if (provider === undefined || model === undefined) throw new Error('state analysis model is not configured')
      const modelInfo = await this.ctx.llm.resolveModelInfo(provider, model)
      const supportsReasoningOff = modelInfo.reasoning?.efforts.some(effort => effort.id === 'off') === true
      let text = ''
      const context = JSON.stringify(claim.modelProjection)
      // 真实 Provider 不能从“返回 JSON”猜出字段契约；直接投影同一份 Zod schema，避免 Prompt 与 Host 校验漂移。
      const prompt = `分析以下可见事件。输出必须是符合所给 JSON Schema 的唯一 JSON 对象，不要解释、不要 Markdown 代码块。shared-state 是用户当前有效且已确认的信息，优先于历史消息；不得重复提取已有状态，也不得推断被移除的历史片段。contentStatus 为 partially-processed 的用户来源只保留 remainingFragments 中彼此独立的连续原文片段，其他内容已经进入状态处理；这些片段不是完整用户消息，不得拼接，不得据此推断用户没有说清、遗漏信息或表达不完整。理解完整处境时使用当前 shared-state；只有剩余片段本身明确提供新信息时才提取候选。仅提取对后续理解困惑有持续价值的信息；寒暄、泛化身份陈述、同义反复或没有形成处境/目标的信息必须返回空 candidates。当前人物由 Host 固定为 ${claim.persona}，personaSnapshot.persona 必须逐字输出该 ID，不得翻译、改名或选择其他人物。仅可使用输入中的短别名（如 e0），不得输出原始事件 id；候选项和 personaSnapshot.sourceEventIds 必须引用这些别名。当前目标 turn 会由系统固定为最新完成 turn，无需生成 sourceTurnOperationId。对于用户明确说出、无需推断的 fact/goal，confirmation 写 explicit，text 必须逐字等于同一条用户消息中的连续原文，并把该原文同时写入 sourceQuote；任何摘要改写、推断、指代补全、冲突、未解决项或阶段理解都写 needs-confirmation，且不得填写 sourceQuote。Host 只会自动确认可核验的逐字原文，模型置信度本身无效。没有候选项时 candidates 返回空数组，但 personaSnapshot 仍须完整。\nJSON Schema:\n${stateAnalysisOutputJsonSchema}\n可见事件:\n${context}`
      for await (const chunk of this.ctx.llm.stream({
        provider, model, maxTokens: 2_048,
        ...(supportsReasoningOff ? { reasoningEffort: ReasoningEffortId('off') } : {}),
        messages: [createUserMessage({ content: [{ type: 'text', text: prompt }], source: { kind: 'user' } })],
      })) if (chunk.type === 'text-delta') text += chunk.text
      if (text.trim() === '') throw new Error('state analysis provider returned no output')
      try {
        const jsonText = text.trim().replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '')
        const parsed = stateAnalysisOutputSchema.parse(JSON.parse(jsonText))
        const mapAliases = (values: readonly string[]): string[] => values.map((value) => { const mapped = claim.aliases.get(value); if (mapped === undefined) throw new Error('state analysis references an unknown event alias'); return mapped })
        const mappedCandidates: StateCandidate[] = parsed.candidates.map((item) => {
          const sourceEventIds = [...new Set(mapAliases(item.sourceEventIds))]
          if (sourceEventIds.some(sourceEventId => !claim.allowedEventIds.includes(sourceEventId))) throw new Error('state analysis candidate references an event outside its input')
          return {
            id: item.id, kind: item.kind, text: item.text, sourceEventIds,
            ...(item.confirmation === undefined ? {} : { confirmation: item.confirmation }),
            ...(item.sourceQuote === undefined ? {} : { sourceQuote: item.sourceQuote }),
          }
        })
        if (new Set(mappedCandidates.map(candidate => candidate.id)).size !== mappedCandidates.length) throw new Error('state analysis candidate ids must be unique')
        candidates = mappedCandidates
        const snapshotSourceEventIds = [...new Set(mapAliases(parsed.personaSnapshot.sourceEventIds))]
        if (parsed.personaSnapshot.persona !== claim.persona) throw new Error(`state analysis persona mismatch: expected '${claim.persona}'`)
        if (claim.targetTurnOperationId === 'undefined') throw new Error('state analysis has no completed target turn')
        if (snapshotSourceEventIds.some(sourceEventId => !claim.allowedEventIds.includes(sourceEventId))) throw new Error('state analysis persona snapshot references an event outside its input')
        snapshot = {
          persona: parsed.personaSnapshot.persona,
          sourceTurnOperationId: turnOperationId(claim.targetTurnOperationId),
          sourceEventIds: snapshotSourceEventIds,
          revision: claim.revision,
          currentUnderstanding: parsed.personaSnapshot.currentUnderstanding,
          coreView: parsed.personaSnapshot.coreView,
          ...(parsed.personaSnapshot.advice === undefined ? {} : { advice: parsed.personaSnapshot.advice }),
        }
      } catch (error) {
        failure = true
        failureCategory = error instanceof Error && /outside|scoped|persona|source|allowed|unique|alias/iu.test(error.message) ? 'context' : 'parse'
        failureDetail = providerFailureDiagnostic(error)
      }
    } catch (error) {
      failure = true
      failureCategory = 'provider'
      failureDetail = providerFailureDiagnostic(error)
    }
    return this.serial(id, async () => {
      const current = await this.requireConversation(id); const events = await this.repository.readEvents(id) ?? []
      const delivered = deliveredUserMessageIds(events)
      const currentMessages = events.filter((event): event is Extract<ProductEvent, { type: 'user-message' }> => event.type === 'user-message' && event.content !== undefined && delivered.includes(event.id))
      const currentWatermark = currentMessages.at(-1)?.id ?? String(id)
      const currentBranchRevision = events.filter(event => event.type === 'turn' && event.persona === current.activePersona && event.status === 'completed').length
      const currentContextRevision = contextRevision(events)
      const currentStatus = failure ? 'failed' as const : currentWatermark === claim.inputWatermark && current.revision === claim.revision && currentBranchRevision === claim.branchRevision && currentContextRevision === claim.contextRevision ? 'completed' as const : 'stale' as const
      const result = {
        type: 'state-analysis' as const, operationId: stateOperationId, inputWatermark: claim.inputWatermark,
        revision: claim.revision, branchRevision: claim.branchRevision, contextRevision: claim.contextRevision,
        persona: claim.persona, inputProjection: claim.allowedProjection, modelInputProjection: claim.modelProjection,
        status: currentStatus, ...(failureCategory === undefined || currentStatus !== 'failed' ? {} : { failureCategory }),
        ...(failureDetail === undefined || currentStatus !== 'failed' ? {} : { failureDetail }),
        requestId: requestId(`state-${currentStatus}:${stateOperationId}`), ...(candidates === undefined ? {} : { candidates }),
      }
      await this.repository.append(id, result)
      if (currentStatus === 'completed' && snapshot !== undefined) {
        await this.repository.append(id, {
          type: 'persona-snapshot', snapshot,
          requestId: requestId(`persona-snapshot:${stateOperationId}`),
        })
        const latestState = new Map<string, SharedStateItem>()
        for (const event of events) if (event.type === 'shared-state') latestState.set(event.item.id, event.item)
        for (const candidate of candidates ?? []) {
          if (stateCandidateAlreadyHandled(candidate, latestState)) continue
          const direct = isDirectUserStateCandidate(candidate, claim.allowedProjection)
          const item: SharedStateItem = {
            id: latestState.has(candidate.id) ? `${stateOperationId}:${candidate.id}` : candidate.id, persona: snapshot.persona, kind: candidate.kind, text: candidate.text,
            sourceEventIds: candidate.sourceEventIds, status: direct ? 'confirmed' : 'candidate',
            confirmation: direct ? 'explicit' : 'needs-confirmation', revision: current.lifecycleRevision + 1,
            sourceOperationId: stateOperationId,
          }
          await this.repository.append(id, { type: 'shared-state', item, requestId: requestId(`shared-state:${stateOperationId}:${candidate.id}`) })
          latestState.set(item.id, item)
        }
      }
      return this.requireConversation(id)
    })
  }

  /** Validate and persist structured claims against the private assistant event for one turn. */
  async submitClaims(
    id: DilemmaId,
    turnId: TurnOperationId,
    claims: readonly ClaimSidecarInput[],
    userRequestId: RequestId,
  ): Promise<DilemmaConversation> {
    return this.serial(id, async () => {
      const conversation = await this.requireConversation(id)
      const claimInput = claimSidecarArraySchema.safeParse(claims)
      if (!claimInput.success) throw new Error('claim sidecar input is invalid')
      const events = await this.repository.readEvents(id) ?? []
      const turn = events.findLast(event => event.type === 'turn' && event.turnOperationId === turnId && event.status === 'completed')
      const branch = turn?.type === 'turn' ? conversation.branches.find(item => item.persona === turn.persona) : undefined
      const agent = branch === undefined ? undefined : this.ctx.agents.get(branch.sessionId)
      const submissionEvent = turn?.type === 'turn' && agent !== undefined
        ? findPersonaTurnSubmitEvent(agent, turnId)
        : undefined
      if (turn?.type !== 'turn' || submissionEvent === undefined || String(submissionEvent.event.seq) !== turn.sessionEventId) throw new Error(`completed turn '${turnId}' has no structured submission`)
      const text = submissionEvent.meta.text
      const toolClaims = events.filter((event): event is Extract<ProductEvent, { type: 'evidence-tool-claim' }> => event.type === 'evidence-tool-claim' && event.turnOperationId === turnId && event.status === 'completed')
      const evidenceStatus = new Map(events.filter((event): event is Extract<ProductEvent, { type: 'evidence' }> => event.type === 'evidence').map(event => [event.evidenceId, event.status]))
      const returnedEvidenceIds = new Set(toolClaims.flatMap(claim => claim.returnedEvidenceIds ?? []).filter((evidenceId) => {
        const derived = this.evidence.find(item => item.id === evidenceId && item.persona === turn.persona)
        return derived !== undefined && evidenceStatus.get(evidenceId) !== 'challenged' && evidenceStatus.get(evidenceId) !== 'withdrawn'
      }))
      const claimedEvidenceIds = new Set(toolClaims.flatMap(claim => claim.returnedEvidenceIds ?? []))
      const compatibleEvidence = claims.every(claim => claim.evidenceIds.every((evidenceId) => {
        const evidence = this.evidence.find(item => item.id === evidenceId)
        const claimText = text.slice(claim.textRange.start, claim.textRange.end)
        return evidence?.persona === turn.persona && claimCanUseEvidence(claim.kind, evidence)
          && (evidence.firstPersonAllowed || !usesUnsupportedFirstPersonNarration(claimText))
      }))
      if (!validateClaimSidecar(text, claims, returnedEvidenceIds)
        || !compatibleEvidence
        || claims.some(claim => claim.kind === 'modern-inference'
          && usesUncitedBiographicalSelfClaim(text.slice(claim.textRange.start, claim.textRange.end)))
        || claims.some(claim => claim.evidenceIds.some(evidenceId => !claimedEvidenceIds.has(evidenceId)))) throw new Error('claim sidecar is invalid or lacks a completed evidence lookup')
      const expectedRevision = events.filter(event => event.type === 'evidence').length
      const sidecars = claims.map(claim => ({ type: 'claim-sidecar' as const, turnOperationId: turnId, ...claim, status: 'accepted' as const, requestId: requestId(`${userRequestId}:${claim.textRange.start}:${claim.textRange.end}`) }))
      await this.repository.appendClaimSidecarsIfCurrent(id, turnId, expectedRevision, sidecars)
      return this.requireConversation(id)
    })
  }

  /** Withdraw one active cross-persona acknowledgement without rewriting history. */
  async withdrawPersonaAcknowledgement(id: DilemmaId, acknowledgementId: string, userRequestId: RequestId): Promise<DilemmaConversation> {
    return this.serial(id, async () => {
      const events = await this.repository.readEvents(id) ?? []
      const acknowledgement = events.findLast(event => event.type === 'persona-acknowledgement' && event.id === acknowledgementId)
      if (acknowledgement?.type !== 'persona-acknowledgement' || acknowledgement.status !== 'active') throw new Error(`active persona acknowledgement '${acknowledgementId}' was not found`)
      return (await this.repository.append(id, { ...acknowledgement, status: 'withdrawn', requestId: userRequestId })).conversation
    })
  }

  /** Accept one structured final answer from the actual Agent owning the live turn lease. */
  async acceptPersonaTurnSubmission(agent: Agent | undefined, input: unknown): Promise<PersonaTurnSubmission> {
    if (agent === undefined) throw new Error('persona turn submission requires the live Agent execution identity')
    const lease = this.turnSubmissionLeases.get(agent)
    const live = lease === undefined ? undefined : this.live.get(lease.dilemmaId)
    if (lease === undefined || live === undefined || !live.handles.some(handle => handle.agent === agent)) {
      throw new Error('persona turn submission is not bound to a live message lease')
    }
    if (this.turnStops.get(agent)?.signal.aborted) throw new Error('persona turn is no longer open for structured submission')
    const parsed = personaTurnSubmitInputSchema.safeParse(input)
    if (!parsed.success) throw new Error('persona turn submission input is invalid')
    let cursor = 0
    const claims: ClaimSidecarInput[] = parsed.data.segments.map((segment) => {
      const start = cursor
      cursor += segment.text.length
      return { textRange: { start, end: cursor }, kind: segment.kind, evidenceIds: segment.evidenceIds }
    })
    const text = parsed.data.segments.map(segment => segment.text).join('')
    if (text.trim() === '') throw new Error('persona turn submission input is invalid')
    const submissionId = createHash('sha256').update(JSON.stringify({ turn: lease.turnOperationId, text, claims })).digest('hex')
    if (lease.submission !== undefined) {
      if (lease.submission.submissionId === submissionId) return lease.submission
      throw new Error('persona turn already has a different structured submission')
    }
    const events = await this.repository.readEvents(lease.dilemmaId) ?? []
    const currentTurn = events.findLast(event => event.type === 'turn' && event.turnOperationId === lease.turnOperationId && event.messageId === lease.messageId)
    if (currentTurn?.type !== 'turn' || (currentTurn.status !== 'claimed' && currentTurn.status !== 'running')) {
      throw new Error('persona turn is no longer open for structured submission')
    }
    // 不同提交尝试可能对应不同证据修订；将活动请求键绑定到提交载荷，允许
    // 无效提交后继续有效提交，同时保持同一载荷重试的幂等性。
    await this.updateTurnActivityForTurn(lease.dilemmaId, lease.turnOperationId, 'evidence-check', undefined, submissionId)
    this.assertPersonaTurnSubmission(lease, text, claims, events)
    if (this.turnStops.get(agent)?.signal.aborted) throw new Error('persona turn is no longer open for structured submission')
    const submission = Object.freeze({
      submissionId, turnOperationId: lease.turnOperationId, persona: lease.persona,
      sessionId: lease.sessionId, text, claims,
      evidenceRevision: events.filter(event => event.type === 'evidence').length,
    })
    lease.submission = submission
    return submission
  }

  private assertPersonaTurnSubmission(
    lease: TurnSubmissionLease,
    text: string,
    claims: readonly ClaimSidecarInput[],
    events: readonly ProductEvent[],
  ): void {
    const completedClaims = events.filter((event): event is Extract<ProductEvent, { type: 'evidence-tool-claim' }> => event.type === 'evidence-tool-claim'
      && event.turnOperationId === lease.turnOperationId && event.persona === lease.persona
      && String(event.sessionId) === lease.sessionId && event.evidenceRevision === lease.evidenceRevision
      && event.status === 'completed')
    const claimOperationIds = new Set(completedClaims.map(event => String(event.operationId)))
    const provenanceCount = events.filter((event): event is Extract<ProductEvent, { type: 'evidence' }> => event.type === 'evidence'
      && event.toolOperationId !== undefined && claimOperationIds.has(String(event.toolOperationId))).length
    if (events.filter(event => event.type === 'evidence').length !== lease.evidenceRevision + provenanceCount) {
      throw new Error('persona turn submission evidence revision is stale')
    }
    const evidenceStatus = new Map(events.filter((event): event is Extract<ProductEvent, { type: 'evidence' }> => event.type === 'evidence').map(event => [event.evidenceId, event.status]))
    const returnedEvidenceIds = new Set(completedClaims
      .flatMap(event => event.returnedEvidenceIds ?? [])
      .filter(evidenceId => evidenceStatus.get(evidenceId) === undefined || evidenceStatus.get(evidenceId) === 'available'))
    if (returnedEvidenceIds.size > 0 && !claims.some(claim => claim.evidenceIds.length > 0)) {
      throw new Error('persona turn looked up evidence but did not cite any returned evidence')
    }
    if (!validateClaimSidecar(text, claims, returnedEvidenceIds)) {
      throw new Error('persona turn submission must cover the complete answer with contiguous non-empty segments, and every cited id must come from this turn')
    }
    const compatibilityIssues: string[] = []
    for (const [claimIndex, claim] of claims.entries()) {
      for (const evidenceId of claim.evidenceIds) {
        const evidence = this.evidence.find(item => item.id === evidenceId)
        if (evidence === undefined || evidence.persona !== lease.persona) {
          compatibilityIssues.push(`segment ${claimIndex + 1}: evidence '${evidenceId}' is not available for the current persona`)
          continue
        }
        if (!claimCanUseEvidence(claim.kind, evidence)) {
          compatibilityIssues.push(`segment ${claimIndex + 1}: evidence '${evidenceId}' with source type '${evidence.evidenceType}', trust '${evidence.trust}', and firstPersonAllowed=${String(evidence.firstPersonAllowed)} cannot support claim kind '${claim.kind}'`)
          continue
        }
        const claimText = text.slice(claim.textRange.start, claim.textRange.end)
        if (!evidence.firstPersonAllowed && usesUnsupportedFirstPersonNarration(claimText)) {
          compatibilityIssues.push(`segment ${claimIndex + 1}: evidence '${evidenceId}' requires wholly third-person attribution outside quoted source text`)
        }
      }
    }
    if (compatibilityIssues.length > 0) throw new Error([...new Set(compatibilityIssues)].join('; '))
    if (claims.some(claim => claim.kind === 'modern-inference'
      && usesUncitedBiographicalSelfClaim(text.slice(claim.textRange.start, claim.textRange.end)))) {
      throw new Error('persona turn modern advice contains an uncited biographical self-claim')
    }
    assertMinimumPersonaAnswer(lease, text, claims, events)
  }

  /** Rebuild the effective shared context on the Session surface before each product step. */
  private async projectAgentContext(
    id: DilemmaId,
    agent: Agent,
    persona: PersonaId,
    turnOperationId: TurnOperationId,
  ): Promise<void> {
    const events = await this.repository.readEvents(id)
    if (events === undefined) return
    const context: ContextProjection = allowedContext(events, persona)
    const allowedIds = new Set(context.allowedEventIds)
    const sharedUserMessages = events.filter((event): event is Extract<ProductEvent, { type: 'user-message' }> =>
      event.type === 'user-message' && event.content !== undefined && allowedIds.has(event.id),
    ).map(event => ({ id: event.id, persona: event.persona, content: event.content }))
    const sharedStates = events.filter((event): event is Extract<ProductEvent, { type: 'shared-state' }> =>
      event.type === 'shared-state' && event.item.status === 'confirmed' && allowedIds.has(event.item.id),
    ).map(event => event.item)
    const sharedChoices = events.filter((event): event is Extract<ProductEvent, { type: 'choice' }> =>
      event.type === 'choice' && event.status === 'answered' && allowedIds.has(String(event.operationId)),
    ).map(event => ({ operationId: String(event.operationId), answers: event.answers ?? [] }))
    const acknowledgements = events.filter((event): event is Extract<ProductEvent, { type: 'persona-acknowledgement' }> =>
      event.type === 'persona-acknowledgement' && event.status === 'active' && event.sourcePersona !== persona
        && isActivePersonaAcknowledgement(events, event),
    ).map(event => ({
      id: event.id, sourcePersona: event.sourcePersona, sourceUserMessageId: event.sourceUserMessageId,
      sourcePersonaMessageId: event.sourcePersonaMessageId,
    }))
    const body = JSON.stringify({
      type: 'man-roleplayer-context', persona, allowedEventIds: context.allowedEventIds, excludedEventIds: context.excludedEventIds,
      sharedUserMessages, sharedStates, sharedChoices, acknowledgements,
    })
    const inputFingerprint = createHash('sha256').update(body).digest('hex')
    const projectionOperationId = operationId(`context:${turnOperationId}:${inputFingerprint}`)
    const projectionRequestId = requestId(`context:${turnOperationId}:${inputFingerprint}`)
    await this.repository.append(id, {
      type: 'context-projection',
      projection: {
        ...context, operationId: projectionOperationId, inputFingerprint,
        modelInputBytes: Buffer.byteLength(body, 'utf8'),
      },
      requestId: projectionRequestId,
    })
    const legacyPlugins = new Set(['man-roleplayer-context', 'man-roleplayer-state', 'man-roleplayer-choice', 'man-roleplayer-acknowledgement', 'man-roleplayer-context-migration'])
    const active = agent.session.events.filter((event): event is SessionEvent<'user/message'> => {
      if (event.type !== 'user/message' || event.data.source.kind !== 'plugin' || !legacyPlugins.has(event.data.source.plugin)) return false
      return agent.session.surface.nodes.includes(event.seq)
    })
    const existing = active.find(event => event.data.source.kind === 'plugin' && event.data.source.plugin === 'man-roleplayer-context')
    const existingSource = existing?.data.source
    const existingSections: unknown = existingSource?.kind === 'plugin'
      ? (existingSource as unknown as { readonly sections?: unknown }).sections : undefined
    const fingerprintSection = Array.isArray(existingSections)
      ? existingSections.find((section): section is { readonly name?: unknown; readonly text?: unknown } => {
        return typeof section === 'object' && section !== null
          && Reflect.get(section, 'name') === 'fingerprint' && typeof Reflect.get(section, 'text') === 'string'
      }) : undefined
    const existingFingerprint = typeof fingerprintSection?.text === 'string' ? fingerprintSection.text : undefined
    if (active.length === 1 && existingFingerprint === inputFingerprint) return
    const appendMigration = (event: SessionEvent<'user/message'>): void => {
      agent.session.append('user/message', createUserMessage({
        content: [{ type: 'text', text: '旧人物上下文投影已替换' }],
        source: { kind: 'plugin', plugin: 'man-roleplayer-context-migration', form: 'snapshot', sections: [{ name: 'replacedSeq', text: String(event.seq) }] },
      }), { surfaceOp: { op: 'replace', start: event.seq, end: event.seq }, sourceEventSeqs: [event.seq] })
    }
    const first = active[0]
    if (first === undefined) {
      agent.session.append('user/message', createUserMessage({
        content: [{ type: 'text', text: body }],
        source: { kind: 'plugin', plugin: 'man-roleplayer-context', form: 'snapshot', sections: [{ name: 'fingerprint', text: inputFingerprint }] },
      }), { surfaceOp: 'append' })
    } else {
      agent.session.append('user/message', createUserMessage({
        content: [{ type: 'text', text: body }],
        source: { kind: 'plugin', plugin: 'man-roleplayer-context', form: 'snapshot', sections: [{ name: 'fingerprint', text: inputFingerprint }] },
      }), { surfaceOp: { op: 'replace', start: first.seq, end: first.seq }, sourceEventSeqs: [first.seq] })
      for (const old of active.slice(1)) appendMigration(old)
    }
  }

  /** Persist one user message, drive only its target Agent, then reconcile Session event ids. */
  async submitMessage(id: DilemmaId, options: SubmitMessageOptions): Promise<DilemmaConversation> {
    const leaseOrConversation = await this.serial(id, async (): Promise<MessageRunLease | DilemmaConversation> => {
      this.assertOpen()
      const conversation = await this.requireConversation(id)
      this.assertExpectedRevision(conversation, options.expectedRevision)
      if (conversation.deletion !== undefined) throw new Error(`dilemma '${id}' is deleting and cannot submit a message`)
      if (conversation.archived === true) throw new Error(`dilemma '${id}' is archived and cannot submit a message`)
      if (conversation.discussionStatus !== 'in_progress') throw new Error(`dilemma '${id}' discussion is ${conversation.discussionStatus}`)
      const activeLease = this.messageRuns.get(id)
      if (activeLease !== undefined) {
        const sameOperation = activeLease.token.requestId === options.requestId && activeLease.token.messageId === options.messageId
          && activeLease.token.deliveryOperationId === options.deliveryOperationId
          && activeLease.token.turnOperationId === options.turnOperationId
        if (sameOperation) return activeLease
        throw new Error(`message operation '${activeLease.token.turnOperationId}' is still running; cancel or await it before submitting another message`)
      }
      const existing = conversation.timeline.find(item => item.id === options.messageId)
      if (existing?.status === 'delivered' || existing?.status === 'completed') return conversation
      if (conversation.seenRequests.includes(options.requestId)) return conversation
      const branch = conversation.branches.find(item => item.persona === conversation.activePersona)
      if (branch === undefined) throw new Error(`unknown active persona '${conversation.activePersona}'`)
      const safety = safetyDecision(options.text)
      if (!safety.allowed) {
        const safetyOperationId = operationId(`safety:${options.messageId}`)
        await this.repository.append(id, { type: 'safety-blocked', messageId: options.messageId, safetyOperationId, persona: conversation.activePersona, content: options.text, kind: safety.kind, reason: safety.reason, requestId: requestId(`safety:${options.messageId}`) })
        await this.repository.append(id, { type: 'system-safety-reply', safetyOperationId, messageId: options.messageId, text: safety.reason, requestId: requestId(`safety-reply:${options.messageId}`) })
        return (await this.requireConversation(id))
      }
      if (options.retryOf === undefined) await this.repository.append(id, { type: 'user-message', id: options.messageId, messageId: options.messageId, deliveryOperationId: options.deliveryOperationId, status: 'pending', content: options.text, persona: conversation.activePersona, ...(options.replyToTimelineEventId === undefined ? {} : { replyToTimelineEventId: options.replyToTimelineEventId }), requestId: options.requestId })
      const agent = this.ctx.agents.get(branch.sessionId)
      if (agent === undefined) throw new Error(`persona agent '${branch.sessionId}' is not live`)
      const rawEvents = await this.repository.readEvents(id)
      if (rawEvents === undefined) throw new Error(`dilemma '${id}' disappeared during message submission`)
      await this.projectAgentContext(id, agent, conversation.activePersona, options.turnOperationId)
      agent.inject(createUserMessage({ content: [{ type: 'text', text: '当前 persona_turn_submit 只接收顺序 segments：每段分别提供 text、kind、evidenceIds；不要提供 textRange，也不要手算字符位置。Host 会按 segments 顺序拼接最终正文并生成连续范围。' }], source: { kind: 'plugin', plugin: 'man-roleplayer-submit-contract' } }))
      // 逐轮沟通要求写入 Session，让已有分支也能使用，保持人物 preset 身份稳定。
      agent.inject(createUserMessage({ content: [{ type: 'text', text: '本轮沟通契约：优先遵守用户明确要求的回应方式、范围和长度；人物口吻与思考方式服务于本轮需求，不必每次走完辨析、史例和现实行动。用户只想被倾听时先承接感受，不主动展开方案；只要一个有出处的例子时给出例子及必要出处后停止，不追加长篇建议。用户只要一句话、一条开场白或其他单条短文本时，直接输出所要的内容并停止，不附字数自报、解释、史例或额外建议。只有本轮回答确实需要史实断言时才查找并附必要证据；不得仅为体现人物身份或给短文本补充底气而主动检索和添加史例。区分用户已陈述的事实、史料支持的内容与自己的暂时理解；不得凭一句话断言用户或第三方的动机、性格、现实条件，不把历史遭遇与现实处境的相似当成动机相同的证据。信息不足时保留不确定性，必要时再问，不以安慰为由替任何人下定论。保持当前人物的视角与表达，不把所有人物写成同一种现代说教口吻；仍须遵守安全规则和证据归属要求。' }], source: { kind: 'plugin', plugin: 'man-roleplayer-communication-policy' } }))
      if (isLowInformationMessage(options.text)) {
        agent.inject(createUserMessage({ content: [{ type: 'text', text: '本轮只是低信息开场或泛化身份陈述：不要调用 evidence_lookup，不要引入史料或扩写用户处境；请用当前人物的克制口吻简短承接，并询问用户想讨论的具体困惑。' }], source: { kind: 'plugin', plugin: 'man-roleplayer-answer-policy' } }))
      } else if (isIdentityQuestion(options.text)) {
        const personaName = PERSONA_DISPLAY_NAMES[conversation.activePersona]
        agent.inject(createUserMessage({ content: [{ type: 'text', text: `本轮是身份短问：请自然说明当前对话人物是${personaName}，并说明你能如何帮助用户梳理当前困惑；不得只回复寒暄。` }], source: { kind: 'plugin', plugin: 'man-roleplayer-answer-policy' } }))
      } else if (isAdviceSeekingMessage(options.text)) {
        agent.inject(createUserMessage({ content: [{ type: 'text', text: '本轮含有寻求判断或行动建议的表达：在用户明确要求的回应范围和长度内回应现实处境，不因建议型措辞擅自追加整套方案；不能只提交关于校验规则的占位说明。需要现实建议时，将历史材料与面向用户的判断或下一步分段；现实建议使用不携带 evidenceIds 的 modern-inference segment。' }], source: { kind: 'plugin', plugin: 'man-roleplayer-answer-policy' } }))
      }
      const user = createUserMessage({ content: [{ type: 'text', text: options.text }], source: { kind: 'user' } })
      await this.repository.append(id, { type: 'message-delivery', messageId: options.messageId, deliveryOperationId: options.deliveryOperationId, persona: conversation.activePersona, status: 'claimed', sessionMessageId: String(user.id), requestId: requestId(`delivery-claim:${options.deliveryOperationId}`) })
      await this.repository.append(id, { type: 'turn', turnOperationId: options.turnOperationId, messageId: options.messageId, persona: conversation.activePersona, status: 'claimed', requestId: requestId(`turn-claim:${options.turnOperationId}`) })
      await this.repository.append(id, {
        type: 'turn-execution', turnOperationId: options.turnOperationId, messageId: options.messageId,
        persona: conversation.activePersona, state: 'running',
        requestId: requestId(`turn-execution-running:${options.turnOperationId}`),
      })
      await this.repository.append(id, { type: 'activity', id: options.turnOperationId, messageId: options.messageId, turnOperationId: options.turnOperationId, persona: conversation.activePersona, phase: 'received', startedAt: Date.now(), requestId: requestId(`activity-received:${options.turnOperationId}`) })
      if (options.replyToTimelineEventId !== undefined && isPersonaAcknowledgementText(options.text)) {
        const target = rawEvents.find(event => event.type === 'turn' && event.turnOperationId === options.replyToTimelineEventId && event.persona === conversation.activePersona && event.status === 'completed')
        if (target?.type === 'turn') {
          await this.repository.append(id, { type: 'persona-acknowledgement', id: `persona-acknowledgement:${options.messageId}:${options.replyToTimelineEventId}`, sourcePersona: conversation.activePersona, sourceUserMessageId: target.messageId, sourcePersonaMessageId: options.replyToTimelineEventId, status: 'active', requestId: requestId(`persona-acknowledgement:${options.messageId}:${options.replyToTimelineEventId}`) })
        }
      }
      const sessionMessageId = String(user.id)
      const tokenFields = {
        requestId: options.requestId,
        messageId: options.messageId,
        deliveryOperationId: options.deliveryOperationId,
        turnOperationId: options.turnOperationId,
        persona: conversation.activePersona,
        sessionMessageId,
        agent,
        user,
        lowInformation: isLowInformationMessage(options.text),
        ...(options.replyToTimelineEventId === undefined ? {} : { replyToTimelineEventId: options.replyToTimelineEventId }),
      }
      const token: MessageRunToken = Object.freeze(tokenFields)
      let resolve!: (result: DilemmaConversation) => void
      let reject!: (reason: unknown) => void
      const promise = new Promise<DilemmaConversation>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
      })
      // Remote 只等待持久化确认时，后台失败仍由本服务观察；原 Promise 保留给等待完成的调用方。
      void promise.catch(() => undefined)
      const lease = { token, promise, resolve, reject, started: false }
      this.messageRuns.set(id, lease)
      return lease
    })
    if (!('token' in leaseOrConversation)) return leaseOrConversation
    const lease = leaseOrConversation
    if (lease.started) return lease.promise
    lease.started = true
    void this.executeMessageRun(id, lease).catch(lease.reject)
    // The product Remote's acknowledgement boundary is the durable claims
    // written above; callers that only need that boundary must not wait for
    // the provider task. Internal callers retain completion semantics.
    return options.acknowledgeOnly ? this.requireConversation(id) : lease.promise
  }

  /** Retry one failed persona attempt without appending another product user message. */
  async retryMessage(
    id: DilemmaId,
    message: MessageId,
    failedTurn: TurnOperationId,
    userRequestId: RequestId,
    expectedRevision?: number,
  ): Promise<DilemmaConversation> {
    const key = `${id}:${userRequestId}`
    const running = this.retryRuns.get(key)
    if (running !== undefined) return running
    const run = (async () => {
      const claim = await this.serial(id, async () => {
        const conversation = await this.requireConversation(id)
        if (conversation.deletion !== undefined) throw new Error(`dilemma '${id}' is deleting and cannot retry`)
        if (conversation.archived === true) throw new Error(`dilemma '${id}' is archived and cannot retry`)
        const events = await this.repository.readEvents(id) ?? []
        const existing = events.find(event => event.type === 'message-retry' && event.requestId === userRequestId)
        const existingUser = events.findLast(event => event.type === 'user-message' && event.messageId === message && event.content !== undefined)
        if (existing?.type === 'message-retry') {
          if (existing.previousTurnOperationId !== failedTurn || existingUser?.type !== 'user-message' || existingUser.content === undefined) {
            throw new Error(`retry request '${userRequestId}' conflicts with its existing attempt`)
          }
          return {
            ...existing, text: existingUser.content, persona: existingUser.persona,
            replyToTimelineEventId: existingUser.replyToTimelineEventId,
          }
        }
        this.assertExpectedRevision(conversation, expectedRevision)
        const priorTurn = events.findLast(event => event.type === 'turn' && event.turnOperationId === failedTurn && event.messageId === message)
        const priorDelivery = events.findLast(event => event.type === 'message-delivery' && event.messageId === message)
        const user = existingUser
        if (priorTurn?.type !== 'turn' || priorTurn.status !== 'failed' || priorDelivery?.type !== 'message-delivery' || priorDelivery.status !== 'failed' || user?.type !== 'user-message' || user.content === undefined) {
          throw new Error(`message '${message}' is not a failed persona turn`)
        }
        if (this.messageRuns.has(id)) throw new Error(`message operation '${message}' is still running; cancel or await it before retrying`)
        const nextTurn = turnOperationId(`retry:${message}:${userRequestId}`)
        const nextDelivery = operationId(`retry-delivery:${message}:${userRequestId}`) as DeliveryOperationId
        await this.repository.append(id, {
          type: 'message-retry', messageId: message, previousTurnOperationId: failedTurn,
          previousDeliveryOperationId: priorDelivery.deliveryOperationId, turnOperationId: nextTurn,
          deliveryOperationId: nextDelivery, requestId: userRequestId,
        })
        return {
          text: user.content, persona: user.persona, replyToTimelineEventId: user.replyToTimelineEventId,
          turnOperationId: nextTurn, deliveryOperationId: nextDelivery,
        }
      })
      const result = await this.submitMessage(id, {
        messageId: message, deliveryOperationId: claim.deliveryOperationId, turnOperationId: claim.turnOperationId,
        text: claim.text, requestId: requestId(`retry-submit:${userRequestId}`), retryOf: failedTurn,
        ...(claim.replyToTimelineEventId === undefined ? {} : { replyToTimelineEventId: claim.replyToTimelineEventId }),
      })
      return result
    })()
    this.retryRuns.set(key, run)
    void run.finally(() => {
      if (this.retryRuns.get(key) === run) this.retryRuns.delete(key)
    }).catch(() => undefined)
    return run
  }

  private async executeMessageRun(id: DilemmaId, lease: MessageRunLease): Promise<void> {
    const { token } = lease
    const stop = new AbortController()
    this.turnStops.set(token.agent, stop)
    let outcome: MessageRunOutcome
    let executionStopFailure: 'stop-failed' | 'unknown' | undefined
    const capability = this.evidenceCapabilities.get(token.agent)
    const eventsBeforeRun = await this.repository.readEvents(id) ?? []
    const turnLease: TurnSubmissionLease = {
      dilemmaId: id, messageId: token.messageId, turnOperationId: token.turnOperationId,
      persona: token.persona, sessionId: String(token.agent.id),
      evidenceRevision: eventsBeforeRun.filter(event => event.type === 'evidence').length,
    }
    this.turnSubmissionLeases.set(token.agent, turnLease)
    const budgetRun: TurnBudgetRun = {
      dilemmaId: id, turnOperationId: token.turnOperationId, messageId: token.messageId, persona: token.persona,
      agent: token.agent, modelRequests: 0, toolCalls: 0, noProgressCount: 0, exhausted: false, fingerprints: new Map(),
      activeRemainingMs: this.turnBudget.activeTimeoutMs, activeStartedAt: performance.now(),
    }
    this.turnBudgetRuns.set(String(token.agent.id), budgetRun)
    this.resumeActiveBudget(budgetRun)
    await this.serial(id, async () => {
      await this.repository.append(id, {
        type: 'turn-budget', turnOperationId: token.turnOperationId, messageId: token.messageId, persona: token.persona,
        modelRequests: 0, toolCalls: 0, noProgressCount: 0, status: 'running', requestId: requestId(`turn-budget-running:${token.turnOperationId}`),
      })
    })
    try {
      await this.updateTurnActivity(id, token, 'thinking')
      const events = await this.repository.readEvents(id) ?? []
      const revision = events.filter(event => event.type === 'evidence').length
      if (capability !== undefined) this.evidenceRuns.set(String(token.agent.id), {
        ...capability, sessionId: String(token.agent.id), turnOperationId: token.turnOperationId, evidenceRevision: revision,
        allowEvidence: !token.lowInformation,
      })
      if (stop.signal.aborted) throw new Error('persona turn stopped before generation')
      token.agent.followup(token.user)
      await this.awaitMessageIdle(token.agent, stop.signal)
      const userEvent = token.agent.session.events.find(event => event.type === 'user/message' && event.data.id === token.user.id)
      if (userEvent === undefined) throw new Error(`user message '${token.messageId}' was not committed to Session`)
      let assistantEvent = token.agent.session.events.findLast(event => event.type === 'assistant/message' && event.seq > userEvent.seq)
      let submission = turnLease.submission
      const hasUnsubmittedDraft = assistantEvent?.type === 'assistant/message'
        && assistantEvent.data.message.content.some(block => block.type === 'text' && block.text.trim() !== '')
      if (submission === undefined && hasUnsubmittedDraft) {
        const finalizer = createUserMessage({
          content: [{ type: 'text', text: '上一条 assistant 文本只是未提交草稿。不要继续解释、不要重新检索资料、不要提问，也不要输出普通正文；请复用已有草稿和本轮已有证据，立即调用 persona_turn_submit。只提交按顺序排列的 segments，每段包含 text、kind、evidenceIds；Host 会拼接正文并计算字符区间。若没有史实主张，使用 modern-inference。' }],
          source: { kind: 'plugin', plugin: 'man-roleplayer-finalizer' },
        })
        // Claim the repair and start its Agent side effect under the same
        // dilemma owner. A cancellation that won first suppresses repair; a
        // cancellation that follows will observe and abort the started Agent.
        const finalizationStarted = await this.serial(id, async () => {
          const productEvents = await this.repository.readEvents(id) ?? []
          if (stop.signal.aborted || visibleTurnStatus(productEvents, token.turnOperationId) !== undefined) return false
          const evidenceRun = this.evidenceRuns.get(String(token.agent.id))
          if (evidenceRun !== undefined) this.evidenceRuns.set(String(token.agent.id), { ...evidenceRun, allowEvidence: false })
          const prior = productEvents.findLast((event): event is Extract<ProductEvent, { type: 'activity' }> => event.type === 'activity' && event.id === token.turnOperationId)
          await this.repository.append(id, {
            type: 'activity', id: token.turnOperationId, messageId: token.messageId, turnOperationId: token.turnOperationId,
            persona: token.persona, phase: 'finalizing', startedAt: prior?.startedAt ?? Date.now(),
            ...(prior?.count === undefined ? {} : { count: prior.count }), requestId: requestId(`activity-finalizing:${token.turnOperationId}`),
          })
          // A model-visible instruction is not a deterministic postcondition.
          // Keep accepted-only, but give one bounded same-operation chance.
          token.agent.followup(finalizer)
          return true
        })
        if (finalizationStarted) {
          await this.awaitMessageIdle(token.agent, stop.signal)
          assistantEvent = token.agent.session.events.findLast(event => event.type === 'assistant/message' && event.seq > userEvent.seq)
          submission = turnLease.submission
        }
      }
      const submissionEvent = submission === undefined
        ? undefined
        : findPersonaTurnSubmitEvent(token.agent, token.turnOperationId, submission.submissionId)
      outcome = {
        userEvent,
        ...(assistantEvent === undefined ? {} : { assistantEvent }),
        ...(submissionEvent === undefined ? {} : { submission, submissionEvent: submissionEvent.event }),
        interrupted: false,
      }
    } catch (error) {
      if (error instanceof AgentStopTimeoutError) executionStopFailure = 'stop-failed'
      outcome = { error, interrupted: token.agent.session.events.some(event => event.type === 'turn/end' && event.data.reason.kind === 'aborted') }
    }

    let result: DilemmaConversation
    try {
      result = await this.serial(id, async () => {
        await this.requireConversation(id)
        const events = await this.repository.readEvents(id) ?? []
        const winner = visibleTurnStatus(events, token.turnOperationId)
        const choiceCancelled = events.some(event => event.type === 'choice' && event.turnOperationId === token.turnOperationId && event.status === 'cancelled')
        const status = winner ?? (choiceCancelled ? 'cancelled' : outcome.interrupted ? 'cancelled' : outcome.error !== undefined ? 'failed' : outcome.submission === undefined || outcome.submissionEvent === undefined ? 'failed' : 'completed')
        const deliveryStatus = status === 'completed' ? 'delivered' : status === 'cancelled' ? 'cancelled' : 'failed'
        const sidecars = outcome.submission === undefined ? [] : outcome.submission.claims.map((claim, index) => ({
          type: 'claim-sidecar' as const, turnOperationId: token.turnOperationId, ...claim,
          status: 'accepted' as const, requestId: requestId(`claim-sidecar:${outcome.submission?.submissionId}:${index}`),
        }))
        const settlement = await this.repository.settleMessageOperationIfOpen(
          id, token.deliveryOperationId, token.turnOperationId,
          { type: 'message-delivery', messageId: token.messageId, deliveryOperationId: token.deliveryOperationId, persona: token.persona, status: deliveryStatus, ...(deliveryStatus === 'delivered' && outcome.userEvent !== undefined ? { sessionMessageId: token.sessionMessageId, sessionEventId: String(outcome.userEvent.seq) } : {}), requestId: requestId(`delivery-${deliveryStatus}:${token.deliveryOperationId}`) },
          { type: 'turn', turnOperationId: token.turnOperationId, messageId: token.messageId, persona: token.persona, status, ...(status === 'completed' && outcome.submissionEvent !== undefined ? { sessionEventId: String(outcome.submissionEvent.seq) } : {}), requestId: requestId(`turn-${status}:${token.turnOperationId}`) },
          status === 'completed' ? sidecars : [], outcome.submission?.evidenceRevision,
        )
        const executionEvents = await this.repository.readEvents(id) ?? []
        const execution = executionEvents.findLast(event => event.type === 'turn-execution' && event.turnOperationId === token.turnOperationId)
        if (execution?.type !== 'turn-execution' || (execution.state !== 'stop-failed' && execution.state !== 'unknown' && execution.state !== 'stopped')) {
          await this.repository.append(id, {
            type: 'turn-execution', turnOperationId: token.turnOperationId, messageId: token.messageId,
            persona: token.persona, state: executionStopFailure ?? 'stopped',
            ...(executionStopFailure === undefined ? {} : { error: 'Agent did not reach quiescence before the stop timeout' }),
            requestId: requestId(`turn-execution-${executionStopFailure ?? 'stopped'}:${token.turnOperationId}`),
          })
        }
        const usage = token.agent.session.events
          .filter((event): event is SessionEvent<'assistant/message'> => event.type === 'assistant/message' && (outcome.userEvent === undefined || event.seq > outcome.userEvent.seq))
          .map(event => event.data.usage)
          .filter((value): value is NonNullable<typeof value> => value !== undefined)
          .reduce((total, value) => ({
            inputTokens: total.inputTokens + value.inputTokens,
            outputTokens: total.outputTokens + value.outputTokens,
            cacheReadTokens: (total.cacheReadTokens ?? 0) + (value.cacheReadTokens ?? 0),
            cacheWriteTokens: (total.cacheWriteTokens ?? 0) + (value.cacheWriteTokens ?? 0),
          }), { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })
        const budgetStatus = budgetRun.exhausted ? 'budget-exhausted' as const : status === 'completed' ? 'completed' as const : status === 'cancelled' ? 'cancelled' as const : 'failed' as const
        await this.repository.append(id, {
          type: 'turn-budget', turnOperationId: token.turnOperationId, messageId: token.messageId, persona: token.persona,
          modelRequests: budgetRun.modelRequests, toolCalls: budgetRun.toolCalls, noProgressCount: budgetRun.noProgressCount,
          inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
          ...(usage.cacheReadTokens === 0 ? {} : { cacheReadTokens: usage.cacheReadTokens }),
          ...(usage.cacheWriteTokens === 0 ? {} : { cacheWriteTokens: usage.cacheWriteTokens }),
          status: budgetStatus, requestId: requestId(`turn-budget-${budgetStatus}:${token.turnOperationId}`),
        })
        const activityStartedAt = (await this.repository.readEvents(id) ?? []).findLast((event): event is Extract<ProductEvent, { type: 'activity' }> => event.type === 'activity' && event.id === token.turnOperationId)?.startedAt ?? Date.now()
        const activityEndedAt = Date.now()
        await this.repository.append(id, { type: 'activity', id: token.turnOperationId, messageId: token.messageId, turnOperationId: token.turnOperationId, persona: token.persona, phase: status === 'completed' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'failed', startedAt: activityStartedAt, endedAt: activityEndedAt, durationMs: Math.max(0, activityEndedAt - activityStartedAt), requestId: requestId(`activity-terminal:${token.turnOperationId}`) })
        if (deliveryStatus === 'delivered') await this.repository.append(id, { type: 'user-message', id: token.messageId, messageId: token.messageId, deliveryOperationId: token.deliveryOperationId, status: 'delivered', persona: token.persona, ...(token.replyToTimelineEventId === undefined ? {} : { replyToTimelineEventId: token.replyToTimelineEventId }), ...(outcome.userEvent === undefined ? {} : { sessionEventId: String(outcome.userEvent.seq) }), requestId: requestId(`user-delivered:${token.messageId}`) })
        if (executionStopFailure === undefined) this.messageRuns.delete(id)
        this.evidenceRuns.delete(String(token.agent.id))
        const result = settlement.conversation
        if (outcome.error !== undefined && status !== 'cancelled') throw toCloseError(outcome.error)
        return result
      })
    } finally {
      clearTimeout(budgetRun.activeTimer)
      const release = (): void => {
        this.turnSubmissionLeases.delete(token.agent)
        this.turnStops.delete(token.agent)
        this.turnBudgetRuns.delete(String(token.agent.id))
      }
      if (executionStopFailure === undefined) release()
      else {
        // 停止超时不代表底层已停；保留占用，直到真实 idle 后才允许新轮次取得同一个 Agent。
        void token.agent.whenIdle().then(async () => {
          await this.serial(id, async () => {
            await this.repository.append(id, {
              type: 'turn-execution', turnOperationId: token.turnOperationId, messageId: token.messageId,
              persona: token.persona, state: 'stopped', requestId: requestId(`turn-execution-quiesced:${token.turnOperationId}`),
            })
            if (this.messageRuns.get(id) === lease) this.messageRuns.delete(id)
            release()
          })
        }).catch(error => { console.error('man-roleplayer: failed to record eventual turn stop', toCloseError(error)) })
      }
    }
    await this.maybeGenerateTitle(id, token.agent)
    lease.resolve(result)
    if (this.autoStateAnalysis && !token.lowInformation
      && visibleTurnStatus(await this.repository.readEvents(id) ?? [], token.turnOperationId) === 'completed') {
      // State analysis is deliberately detached from the user-facing answer:
      // a slow or failed analysis must not delay an already validated turn.
      void this.analyzeState(id, operationId(`state:${id}:${token.turnOperationId}`)).catch(() => {
        // The operation itself records provider/parse failures; this boundary
        // only prevents an unexpected recovery error from becoming unhandled.
      })
    }
  }

  private resumeActiveBudget(run: TurnBudgetRun): void {
    run.activeStartedAt = performance.now()
    run.activeTimer = setTimeout(() => {
      run.exhausted = true
      this.cancelOwnedAgent(run.agent, { kind: 'hook', reason: 'persona turn active-time budget exhausted' })
    }, run.activeRemainingMs)
  }

  /** 正常生成由轮次预算约束；只有停止请求之后才计算停止等待时限。 */
  private async awaitMessageIdle(agent: Agent, signal: AbortSignal): Promise<void> {
    const idle = agent.whenIdle()
    let onStop!: () => void
    const stopped = new Promise<void>(resolve => { onStop = resolve })
    if (signal.aborted) onStop()
    else signal.addEventListener('abort', onStop, { once: true })
    try {
      await Promise.race([idle, stopped])
      if (signal.aborted) await awaitStopWithin(idle, this.stopTimeoutMs)
    } finally {
      signal.removeEventListener('abort', onStop)
    }
  }

  private cancelOwnedAgent(agent: Agent, cause: AgentCancelCause): void {
    this.turnStops.get(agent)?.abort(cause)
    agent.cancel(cause)
  }

  /** Append a redacted lifecycle snapshot under the same turn-owned activity id. */
  private async updateTurnActivity(id: DilemmaId, token: MessageRunToken, phase: Extract<ProductEvent, { type: 'activity' }>['phase'], count?: number): Promise<void> {
    await this.serial(id, async () => {
      const events = await this.repository.readEvents(id) ?? []
      const turn = events.findLast(event => event.type === 'turn' && event.turnOperationId === token.turnOperationId)
      const prior = events.findLast((event): event is Extract<ProductEvent, { type: 'activity' }> => event.type === 'activity' && event.id === token.turnOperationId)
      const terminal = phase === 'completed' || phase === 'failed' || phase === 'cancelled'
      if (!terminal && (turn?.type !== 'turn' || turn.status === 'completed' || turn.status === 'failed' || turn.status === 'cancelled' || prior?.phase === 'completed' || prior?.phase === 'failed' || prior?.phase === 'cancelled')) return
      if (terminal && (prior?.phase === 'completed' || prior?.phase === 'failed' || prior?.phase === 'cancelled')) return
      await this.repository.append(id, {
        type: 'activity', id: token.turnOperationId, messageId: token.messageId, turnOperationId: token.turnOperationId,
        persona: token.persona, phase, startedAt: prior?.startedAt ?? Date.now(),
        ...(count === undefined ? (prior?.count === undefined ? {} : { count: prior.count }) : { count }),
        requestId: requestId(`activity-${phase}:${token.turnOperationId}`),
      })
    })
  }

  private async updateTurnActivityForTurn(id: DilemmaId, turnOperationId: OperationId, phase: Extract<ProductEvent, { type: 'activity' }>['phase'], count?: number, requestSuffix = String(turnOperationId)): Promise<void> {
    await this.serial(id, async () => {
      const events = await this.repository.readEvents(id) ?? []
      const turn = events.findLast(event => event.type === 'turn' && event.turnOperationId === turnOperationId)
      if (turn?.type !== 'turn') return
      const prior = events.findLast((event): event is Extract<ProductEvent, { type: 'activity' }> => event.type === 'activity' && event.id === turnOperationId)
      const terminal = phase === 'completed' || phase === 'failed' || phase === 'cancelled'
      if (!terminal && (turn.status === 'completed' || turn.status === 'failed' || turn.status === 'cancelled' || prior?.phase === 'completed' || prior?.phase === 'failed' || prior?.phase === 'cancelled')) return
      if (terminal && (prior?.phase === 'completed' || prior?.phase === 'failed' || prior?.phase === 'cancelled')) return
      await this.repository.append(id, {
        type: 'activity', id: turnOperationId, messageId: turn.messageId, turnOperationId: turn.turnOperationId,
        persona: turn.persona, phase, startedAt: prior?.startedAt ?? Date.now(),
        ...(count === undefined ? (prior?.count === undefined ? {} : { count: prior.count }) : { count }),
        requestId: requestId(`activity-${phase}:${requestSuffix}`),
      })
    })
  }

  private async maybeGenerateTitle(id: DilemmaId, agent: AgentHandle['agent']): Promise<void> {
    const claim = await this.serial(id, async () => {
      const events = await this.repository.readEvents(id) ?? []
      if (events.some(event => event.type === 'title' && event.status !== 'claimed')) return undefined
      if (events.some(event => event.type === 'title' && event.status === 'claimed')) {
        await this.appendFallbackTitle(id, events)
        return undefined
      }
      const turn = events.find(event => event.type === 'turn' && event.status === 'completed')
      if (turn?.type !== 'turn') return undefined
      const user = events.find(event => event.type === 'user-message' && event.messageId === turn.messageId)
      if (user?.type !== 'user-message' || user.content === undefined) return undefined
      const operationIdValue = operationId(`title:${id}`)
      const titleRevision = project(events).titleRevision
      await this.repository.append(id, { type: 'title', operationId: operationIdValue, status: 'claimed', titleRevision, requestId: requestId(`title-claim:${id}`) })
      return { operationIdValue, firstMessage: user.content, titleRevision }
    })
    if (claim === undefined) return
    let generated: string | undefined
    if (!isLowInformationMessage(claim.firstMessage)) {
      try {
        const provider = agent.options.provider; const model = agent.options.model
        if (provider === undefined || model === undefined) throw new Error('title model is not configured')
        let text = ''
        const stream = this.ctx.llm.stream({ provider, model, maxTokens: 64, messages: [createUserMessage({ content: [{ type: 'text', text: `请为这段困惑生成简短标题：${claim.firstMessage}` }], source: { kind: 'user' } })], purpose: 'session-title' })
        for await (const chunk of stream) if (chunk.type === 'text-delta') text += chunk.text
        generated = validTitle(text)
      } catch { generated = undefined }
    }
    await this.serial(id, async () => {
      const current = await this.requireConversation(id)
      const stale = current.titleUserOwned || current.titleRevision !== claim.titleRevision
      const status = stale ? (current.titleUserOwned ? 'suppressed' as const : 'stale' as const) : generated === undefined ? 'fallback' as const : 'completed' as const
      await this.repository.append(id, { type: 'title', operationId: claim.operationIdValue, status, ...(stale ? {} : { value: generated ?? fallbackTitle(claim.firstMessage) }), titleRevision: claim.titleRevision, requestId: requestId(`title-${status}:${id}`) })
    })
  }

  private async recoverClaimedTitle(id: DilemmaId): Promise<void> {
    await this.appendFallbackTitle(id, await this.repository.readEvents(id) ?? [])
  }

  private async appendFallbackTitle(id: DilemmaId, events: readonly ProductEvent[]): Promise<void> {
    const claimed = events.find(event => event.type === 'title' && event.status === 'claimed')
    const first = events.find(event => event.type === 'user-message' && event.content !== undefined)
    if (claimed?.type !== 'title' || first?.type !== 'user-message' || first.content === undefined) return
    const current = project(events)
    const stale = current.titleUserOwned || current.titleRevision !== (claimed.titleRevision ?? current.titleRevision)
    await this.repository.append(id, { type: 'title', operationId: claimed.operationId, status: stale ? (current.titleUserOwned ? 'suppressed' : 'stale') : 'fallback', ...(stale ? {} : { value: fallbackTitle(first.content) }), titleRevision: claimed.titleRevision ?? current.titleRevision, requestId: requestId(`title-recovery-${stale ? 'stale' : 'fallback'}:${id}`) })
  }

  private async recoverRunningState(id: DilemmaId): Promise<void> {
    const events = await this.repository.readEvents(id) ?? []
    const running = events.findLast(event => event.type === 'state-analysis' && (event.status === 'running' || event.status === 'claimed'))
    if (running?.type !== 'state-analysis') return
    const terminal = events.find(event => event.type === 'state-analysis' && event.operationId === running.operationId && ['completed', 'failed', 'stale'].includes(event.status))
    if (terminal !== undefined) return
    await this.repository.append(id, { type: 'state-analysis', operationId: running.operationId, inputWatermark: running.inputWatermark, revision: running.revision, branchRevision: running.branchRevision, contextRevision: running.contextRevision ?? contextRevision(events), ...(running.persona === undefined ? {} : { persona: running.persona }), ...(running.inputProjection === undefined ? {} : { inputProjection: running.inputProjection }), ...(running.modelInputProjection === undefined ? {} : { modelInputProjection: running.modelInputProjection }), status: 'failed', failureCategory: 'provider', requestId: requestId(`state-recovery-failed:${running.operationId}`) })
  }

  /** Mark an execution checkpoint unknown after a cold restart; never replay a model turn implicitly. */
  private async recoverUnsettledTurns(id: DilemmaId): Promise<void> {
    const events = await this.repository.readEvents(id) ?? []
    const latest = new Map<string, Extract<ProductEvent, { type: 'turn-execution' }>>()
    for (const event of events) if (event.type === 'turn-execution') latest.set(String(event.turnOperationId), event)
    for (const execution of latest.values()) {
      if (execution.state === 'stopped' || execution.state === 'unknown' || execution.state === 'stop-failed') continue
      await this.repository.append(id, {
        type: 'turn-execution', turnOperationId: execution.turnOperationId, messageId: execution.messageId,
        persona: execution.persona, state: 'unknown', error: 'execution state requires cold-restart reconciliation',
        requestId: requestId(`turn-execution-recovery-unknown:${execution.turnOperationId}`),
      })
    }
    const budgets = new Map<string, Extract<ProductEvent, { type: 'turn-budget' }>>()
    for (const event of events) if (event.type === 'turn-budget') budgets.set(String(event.turnOperationId), event)
    for (const budget of budgets.values()) {
      if (budget.status !== 'running') continue
      await this.repository.append(id, {
        ...budget, status: 'failed', requestId: requestId(`turn-budget-recovery-failed:${budget.turnOperationId}`),
      })
    }
  }

  private async recoverEvidenceClaims(id: DilemmaId): Promise<void> {
    const events = await this.repository.readEvents(id) ?? []
    for (const claim of events.filter((event): event is Extract<ProductEvent, { type: 'evidence-tool-claim' }> => event.type === 'evidence-tool-claim' && event.status === 'claimed' && event.deadline <= Date.now())) {
      const terminal = events.find(event => event.type === 'evidence-tool-claim' && event.operationId === claim.operationId && event.status !== 'claimed')
      if (terminal !== undefined) continue
      await this.repository.settleEvidenceToolClaimIfOpen(id, claim.operationId, { ...claim, status: 'failed', requestId: requestId(`evidence-tool-recovery-failed:${claim.operationId}`) })
    }
  }

  private async recoverSafetyReplies(id: DilemmaId): Promise<void> {
    const events = await this.repository.readEvents(id) ?? []
    for (const blocked of events.filter((event): event is Extract<ProductEvent, { type: 'safety-blocked' }> => event.type === 'safety-blocked')) {
      if (events.some(event => event.type === 'system-safety-reply' && event.safetyOperationId === blocked.safetyOperationId)) continue
      await this.repository.append(id, { type: 'system-safety-reply', safetyOperationId: blocked.safetyOperationId, messageId: blocked.messageId, text: blocked.reason, requestId: requestId(`safety-reply:${blocked.safetyOperationId}`) })
    }
  }

  /** Cancel the active target Agent and publish the durable terminal turn state. */
  async cancelMessage(
    id: DilemmaId,
    messageId: MessageId,
    deliveryId: DeliveryOperationId,
    turnId: TurnOperationId,
    expectedRevision?: number,
  ): Promise<DilemmaConversation> {
    let leaseToAwait: MessageRunLease | undefined
    await this.serial(id, async () => {
      const conversation = await this.requireConversation(id)
      this.assertExpectedRevision(conversation, expectedRevision)
      const activeLease = this.messageRuns.get(id)
      const raw = await this.repository.readEvents(id)
      const message = raw?.find(event => event.type === 'user-message' && event.messageId === messageId)
      const turn = raw?.find(event => event.type === 'turn' && event.turnOperationId === turnId && event.messageId === messageId && ['completed', 'cancelled', 'failed'].includes(event.status))
        ?? raw?.find(event => event.type === 'turn' && event.turnOperationId === turnId && event.messageId === messageId)
      if (message?.type !== 'user-message' || message.deliveryOperationId !== deliveryId || turn?.type !== 'turn' || message.persona !== turn.persona) throw new Error('cancel operation does not match the message and turn')
      if (turn.status === 'cancelled') return conversation
      if (turn.status === 'completed') return conversation
      const branch = conversation.branches.find(item => item.persona === turn.persona)
      const matchesLease = activeLease !== undefined && branch !== undefined
        && activeLease.token.persona === turn.persona && activeLease.token.messageId === messageId
        && activeLease.token.deliveryOperationId === deliveryId && activeLease.token.turnOperationId === turnId
      if (branch === undefined || !matchesLease) throw new Error('cancel operation does not match the claimed message lease')
      if (turn.status !== 'claimed' && turn.status !== 'running') throw new Error('turn is no longer cancellable')
      await this.repository.append(id, {
        type: 'turn-execution', turnOperationId: turnId, messageId, persona: turn.persona, state: 'stopping',
        requestId: requestId(`turn-execution-stopping:${turnId}`),
      })
      await this.repository.settleMessageOperationIfOpen(id, deliveryId, turnId, { type: 'message-delivery', messageId, deliveryOperationId: deliveryId, persona: turn.persona, status: 'cancelled', requestId: requestId(`delivery-cancel:${deliveryId}`) }, { type: 'turn', turnOperationId: turnId, messageId, persona: turn.persona, status: 'cancelled', requestId: requestId(`turn-cancel:${turnId}`) })
      // The durable terminal wins before interrupting Agent, so a crash or
      // late accepted result cannot reopen this operation.
      leaseToAwait = activeLease
      this.cancelOwnedAgent(activeLease.token.agent, { kind: 'user' })
      return (await this.requireConversation(id))
    })
    if (leaseToAwait !== undefined) {
      try {
        await awaitStopWithin(leaseToAwait.promise, this.stopTimeoutMs)
      } catch (error) {
        await this.serial(id, async () => {
          const current = await this.requireConversation(id)
          const prior = (await this.repository.readEvents(id) ?? []).findLast(event => event.type === 'turn-execution' && event.turnOperationId === turnId)
          if (prior?.type === 'turn-execution' && prior.state !== 'stopped') {
            await this.repository.append(id, {
              type: 'turn-execution', turnOperationId: turnId, messageId, persona: prior.persona,
              state: error instanceof AgentStopTimeoutError ? 'stop-failed' : 'unknown',
              error: error instanceof Error ? error.message.slice(0, 300) : 'turn stop failed',
              requestId: requestId(`turn-execution-stop-failed:${turnId}`),
            })
          }
          return current
        })
      }
    }
    return this.requireConversation(id)
  }

  /** Reconcile a claimed operation from existing Session events without calling the model. */
  async reconcileMessage(id: DilemmaId, options: ReconcileMessageOptions): Promise<DilemmaConversation> {
    return this.serial(id, async () => {
      const conversation = await this.requireConversation(id)
      const raw = await this.repository.readEvents(id)
      const message = raw?.find(event => event.type === 'user-message' && event.messageId === options.messageId)
      if (message?.type !== 'user-message') throw new Error(`unknown claimed message '${options.messageId}'`)
      const branch = conversation.branches.find(item => item.persona === message.persona)
      const agent = branch === undefined ? undefined : this.ctx.agents.get(branch.sessionId)
      if (agent === undefined) throw new Error(`persona agent '${message.persona}' is not live`)
      const delivery = raw?.find((event): event is Extract<ProductEvent, { type: 'message-delivery' }> => event.type === 'message-delivery' && event.messageId === options.messageId && event.deliveryOperationId === options.deliveryOperationId && event.sessionMessageId !== undefined)
      const userEvent = delivery?.type === 'message-delivery' && delivery.sessionMessageId !== undefined
        ? agent.session.events.find(event => event.type === 'user/message' && event.data.id === delivery.sessionMessageId)
        : undefined
      if (userEvent === undefined) return conversation
      const submissionEvent = findPersonaTurnSubmitEvent(agent, options.turnOperationId)
      const persistedSubmission = submissionEvent !== undefined && submissionEvent.event.seq > userEvent.seq
        ? submissionEvent.meta : undefined
      const currentTurn = visibleTurnStatus(await this.repository.readEvents(id) ?? [], options.turnOperationId)
      if (currentTurn === 'cancelled') {
        await this.repository.settleMessageOperationIfOpen(id, options.deliveryOperationId, options.turnOperationId, { type: 'message-delivery', messageId: options.messageId, deliveryOperationId: options.deliveryOperationId, persona: message.persona, status: 'cancelled', ...(delivery?.sessionMessageId === undefined ? {} : { sessionMessageId: delivery.sessionMessageId }), requestId: requestId(`reconcile-delivery-cancelled:${options.deliveryOperationId}`) }, { type: 'turn', turnOperationId: options.turnOperationId, messageId: options.messageId, persona: message.persona, status: 'cancelled', requestId: requestId(`reconcile-turn-cancelled:${options.turnOperationId}`) })
        await this.repository.append(id, { type: 'turn-execution', turnOperationId: options.turnOperationId, messageId: options.messageId, persona: message.persona, state: 'stopped', requestId: requestId(`turn-execution-reconciled-stopped:${options.turnOperationId}`) })
        return (await this.requireConversation(id))
      }
      let structuredSubmission: PersonaTurnSubmission | undefined
      if (persistedSubmission !== undefined) {
        const recoveryLease: TurnSubmissionLease = {
          dilemmaId: id, messageId: options.messageId, turnOperationId: options.turnOperationId,
          persona: message.persona, sessionId: String(agent.id), evidenceRevision: persistedSubmission.evidenceRevision,
        }
        try {
          this.assertPersonaTurnSubmission(recoveryLease, persistedSubmission.text, persistedSubmission.claims, raw ?? [])
          structuredSubmission = {
            submissionId: persistedSubmission.submissionId, turnOperationId: options.turnOperationId,
            persona: message.persona, sessionId: String(agent.id), text: persistedSubmission.text,
            claims: persistedSubmission.claims, evidenceRevision: persistedSubmission.evidenceRevision,
          }
        } catch {
          // A persisted marker that no longer passes the current evidence gate is
          // an observable failed recovery, not permission to replay the model.
        }
      }
      const turnStatus = structuredSubmission === undefined ? 'failed' as const : 'completed' as const
      const deliveryStatus = turnStatus === 'completed' ? 'delivered' as const : 'failed' as const
      if (deliveryStatus === 'delivered') await this.repository.append(id, { type: 'user-message', id: options.messageId, messageId: options.messageId, deliveryOperationId: options.deliveryOperationId, status: 'delivered', persona: message.persona, ...(message.content === undefined ? {} : { content: message.content }), ...(message.replyToTimelineEventId === undefined ? {} : { replyToTimelineEventId: message.replyToTimelineEventId }), sessionEventId: String(userEvent.seq), requestId: requestId(`reconcile-user-delivered:${options.messageId}`) })
      const sidecars = structuredSubmission === undefined ? [] : structuredSubmission.claims.map((claim, index) => ({
        type: 'claim-sidecar' as const,
        turnOperationId: options.turnOperationId,
        ...claim,
        status: 'accepted' as const,
        requestId: requestId(`claim-sidecar:${structuredSubmission.submissionId}:${index}`),
      }))
      await this.repository.settleMessageOperationIfOpen(id, options.deliveryOperationId, options.turnOperationId, { type: 'message-delivery', messageId: options.messageId, deliveryOperationId: options.deliveryOperationId, persona: message.persona, status: deliveryStatus, ...(delivery?.sessionMessageId === undefined ? {} : { sessionMessageId: delivery.sessionMessageId }), sessionEventId: String(userEvent.seq), requestId: requestId(`reconcile-delivery:${options.deliveryOperationId}`) }, { type: 'turn', turnOperationId: options.turnOperationId, messageId: options.messageId, persona: message.persona, status: turnStatus, ...(structuredSubmission === undefined ? {} : { sessionEventId: String(submissionEvent?.event.seq) }), requestId: requestId(`reconcile-turn:${options.turnOperationId}`) }, structuredSubmission === undefined ? [] : sidecars, structuredSubmission?.evidenceRevision)
      await this.repository.append(id, { type: 'turn-execution', turnOperationId: options.turnOperationId, messageId: options.messageId, persona: message.persona, state: 'stopped', requestId: requestId(`turn-execution-reconciled-stopped:${options.turnOperationId}`) })
      return (await this.requireConversation(id))
    })
  }

  /** Stop owned agents and release the product medium during plugin teardown. */
  async close(): Promise<void> {
    if (this.closing) return
    this.closing = true
    this.evidenceRuns.clear()
    for (const waiter of this.choiceWaiters.values()) waiter.reject(new Error('man-roleplayer is closing'))
    this.choiceWaiters.clear()
    let stopFailure: unknown
    try {
      await Promise.all([...this.live.keys()].map(id => this.stopAgents(id)))
    } catch (error) {
      stopFailure = error
    }
    try {
      await this.repository.close()
    } catch (closeError) {
      if (stopFailure !== undefined) {
        throw new AggregateError([stopFailure, closeError], 'man-roleplayer close failed')
      }
      throw toCloseError(closeError)
    }
    if (stopFailure !== undefined) throw toCloseError(stopFailure)
  }

  private async createHandles(branches: readonly PersonaBranch[], agentOptions?: AgentOptions): Promise<readonly AgentHandle[]> {
    const handles: AgentHandle[] = []
    try {
      for (const branch of branches) {
        handles.push(await this.ctx.agents.create({
          sessionId: branch.sessionId,
          ...(agentOptions === undefined ? {} : { agentOptions }),
          ...this.agentCreateComposition(branch),
        }))
      }
      return handles
    } catch (error) {
      await Promise.all(handles.map(handle => handle.dispose()))
      throw error
    }
  }

  /** Product capabilities live in each exact Agent scope and disappear with its handle. */
  private bindProductTools(handles: readonly AgentHandle[]): void {
    for (const handle of handles) registerProductTools(handle.agent, this)
  }

  private async resumeHandles(branches: readonly PersonaBranch[], agentOptions?: AgentOptions): Promise<readonly AgentHandle[]> {
    const handles: AgentHandle[] = []
    try {
      for (const branch of branches) {
        const setup = this.agentPresetSetup(branch.presetIdentity)
        handles.push(await this.ctx.agents.resume({
          resumeSessionId: branch.sessionId,
          ...(agentOptions === undefined ? {} : { agentOptions }),
          ...(setup === undefined ? {} : { setup }),
        }))
      }
      return handles
    } catch (error) {
      await Promise.all(handles.map(handle => handle.dispose()))
      throw error
    }
  }

  private async stopAgents(id: DilemmaId): Promise<void> {
    const live = this.live.get(id)
    if (live === undefined) return
    live.stopping ??= Promise.all(live.handles.map(handle => handle.dispose())).then(() => {
      if (this.live.get(id) === live) this.live.delete(id)
    })
    await awaitStopWithin(live.stopping, this.stopTimeoutMs)
  }

  private bindPresetIdentities(branches: readonly PersonaBranch[]): readonly PersonaBranch[] {
    const identities = this.presetIdentities
    if (identities === undefined) {
      if (branches.some(branch => branch.presetIdentity !== undefined)) throw new Error('persisted persona preset identity requires current Host bindings')
      return branches
    }
    return branches.map((branch) => {
      const identity = identities.find(item => item.persona === branch.persona)
      if (identity === undefined) throw new Error(`persona branch '${branch.persona}' has no Host binding`)
      if (branch.presetIdentity !== undefined && !samePresetIdentity(branch.presetIdentity, identity)) {
        throw new Error(`persona branch '${branch.persona}' preset identity conflicts with Host configuration`)
      }
      return { ...branch, presetIdentity: identity }
    })
  }

  private assertPresetIdentities(branches: readonly PersonaBranch[]): void {
    if (this.presetIdentities === undefined) {
      if (branches.some(branch => branch.presetIdentity !== undefined)) throw new Error('persisted persona preset identity requires current Host bindings')
      return
    }
    for (const branch of branches) {
      const expected = this.presetIdentities.find(item => item.persona === branch.persona)
      if (expected === undefined || branch.presetIdentity === undefined || !samePresetIdentity(branch.presetIdentity, expected)) {
        throw new Error(`persona branch '${branch.persona}' preset identity is not the configured current identity`)
      }
    }
  }

  private agentCreateComposition(branch: PersonaBranch): {
    readonly meta?: { readonly agentPreset: string }
    readonly setup?: (agentCtx: Context) => Promise<void>
  } {
    const identity = branch.presetIdentity
    if (identity === undefined) return {}
    const setup = this.agentPresetSetup(identity)
    if (setup === undefined) throw new Error(`persona preset '${identity.presetId}' has no setup`)
    return { meta: { agentPreset: identity.presetId }, setup }
  }

  private agentPresetSetup(identity: PersonaPresetIdentity | undefined): ((agentCtx: Context) => Promise<void>) | undefined {
    if (identity === undefined) return undefined
    return async (agentCtx: Context): Promise<void> => {
      const registry = this.ctx.get('agentPresets')
      if (registry === undefined) throw new Error('persona preset registry is not configured')
      const preset = await registry.mount(agentCtx, identity.presetId)
      const composition = await readComposition(preset)
      const assemblyDigest = createHash('sha256').update(composition).digest('hex')
      if (preset.id !== identity.presetId || assemblyDigest !== identity.assemblyDigest) {
        throw new Error(`persona preset '${identity.presetId}' changed while the Agent was being composed`)
      }
    }
  }

  private assertHandlePresetIdentities(
    handles: readonly AgentHandle[],
    branches: readonly PersonaBranch[],
  ): void {
    for (const [index, handle] of handles.entries()) {
      const identity = branches[index]?.presetIdentity
      if (identity !== undefined && handle.agent.session.header.agentPreset !== identity.presetId) {
        throw new Error(`Session '${handle.agent.id}' does not carry preset '${identity.presetId}'`)
      }
    }
  }

  private async requireConversation(id: DilemmaId): Promise<DilemmaConversation> {
    const conversation = await this.repository.read(id)
    if (conversation === undefined) throw new Error(`unknown dilemma '${id}'`)
    return conversation
  }

  /** Resolve the product message attached to a turn before writing execution facts. */
  private async requireTurnMessageId(id: DilemmaId, turnOperationId: OperationId): Promise<MessageId> {
    const event = (await this.repository.readEvents(id) ?? []).findLast(item => item.type === 'turn' && item.turnOperationId === turnOperationId)
    if (event?.type !== 'turn') throw new Error(`unknown turn '${turnOperationId}'`)
    return event.messageId
  }

  private assertExpectedRevision(conversation: DilemmaConversation, expectedRevision: number | undefined): void {
    if (expectedRevision !== undefined && expectedRevision !== conversation.lifecycleRevision) {
      throw new Error(`dilemma '${conversation.id}' revision ${conversation.lifecycleRevision} does not match expected ${expectedRevision}`)
    }
  }

  private serial<T>(id: DilemmaId, operation: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(id) ?? Promise.resolve()
    const next = previous.then(operation)
    const settled = next.then(() => {}, () => {})
    this.tails.set(id, settled)
    return next.finally(() => {
      if (this.tails.get(id) === settled) this.tails.delete(id)
    })
  }

  private assertOpen(): void {
    if (this.closing) throw new Error('man-roleplayer is closed')
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    manRoleplayer: ManRoleplayer
  }
}
