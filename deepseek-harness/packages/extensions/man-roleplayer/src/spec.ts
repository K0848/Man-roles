/** Durable storage declaration for product conversation facts. */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { DeletionReceipt, ProductEvent } from './product/index.ts'
import { PERSONA_IDS } from './types.ts'

const persona = z.enum(PERSONA_IDS)
const discussionStatus = z.enum(['in_progress', 'paused', 'stage_ended'])
const sessionId = z.string().min(1)
const requestId = z.string().min(1)
const operationId = z.string().min(1)
const messageId = z.string().min(1)
const executionState = z.enum(['running', 'waiting-user', 'stopping', 'stopped', 'stop-failed', 'unknown'])
const candidate = z.object({
  id: z.string().min(1), kind: z.enum(['fact', 'goal', 'conflict', 'unresolved', 'understanding']),
  text: z.string().min(1), sourceEventIds: z.array(z.string().min(1)),
  confirmation: z.enum(['explicit', 'needs-confirmation']).optional(), sourceQuote: z.string().min(1).optional(),
}).strict()
const sharedStateItem = z.object({
  id: z.string().min(1), persona, kind: z.enum(['fact', 'goal', 'conflict', 'unresolved', 'understanding']),
  text: z.string().min(1), sourceEventIds: z.array(z.string().min(1)).min(1),
  status: z.enum(['candidate', 'confirmed', 'rejected', 'superseded', 'withdrawn', 'resolved']),
  confirmation: z.enum(['explicit', 'needs-confirmation']).optional(),
  revision: z.number().int().nonnegative(), sourceOperationId: operationId,
}).strict()
const choiceOption = z.object({ label: z.string().min(1), description: z.string().min(1).optional() }).strict()
const choiceQuestion = z.object({
  id: z.string().min(1), question: z.string().min(1), header: z.string().min(1).optional(),
  detail: z.string().min(1).optional(), options: z.array(choiceOption).min(1).optional(), multiSelect: z.boolean().optional(),
}).strict()
const choiceAnswer = z.object({
  id: z.string().min(1), selected: z.array(z.string().min(1)), custom: z.string().min(1).optional(), skipped: z.boolean().optional(),
}).strict()
const personaSnapshot = z.object({
  persona, sourceTurnOperationId: operationId, sourceEventIds: z.array(z.string().min(1)).min(1),
  revision: z.number().int().nonnegative(), currentUnderstanding: z.string().min(1),
  coreView: z.string().min(1), advice: z.string().min(1).optional(),
}).strict()
const dilemmaId = z.string().min(1)
const presetIdentity = z.object({
  presetId: z.string().min(1), assemblyDigest: z.string().min(1), persona,
  researchFingerprint: z.string().min(1),
}).strict()
const branch = z.object({ persona, sessionId, presetIdentity: presetIdentity.optional() }).strict()
const branches = z.array(branch).min(1)
const branchAllocation = z.object({
  operationId, persona, sessionId, presetIdentity: presetIdentity.optional(),
  expectedLifecycleRevision: z.number().int().nonnegative(), status: z.enum(['claimed', 'ready', 'failed']),
}).strict()
const deletion = z.object({
  operationId,
  stage: z.union([
    z.literal('requested'), z.literal('stopping-agents'),
    z.literal('deleting-branch'), z.literal('deleting-first-branch'), z.literal('deleting-second-branch'),
    z.literal('deleting-wang'), z.literal('deleting-zeng'),
    z.literal('deleting-product'), z.literal('completed'), z.literal('failed'),
  ]),
  irreversible: z.boolean(),
  error: z.string().optional(),
  targets: z.array(branch).min(1).optional(),
  completedSessionIds: z.array(sessionId).optional(),
  currentSessionId: sessionId.optional(),
  resumeStage: z.union([
    z.literal('requested'), z.literal('stopping-agents'),
    z.literal('deleting-branch'), z.literal('deleting-first-branch'), z.literal('deleting-second-branch'),
    z.literal('deleting-wang'), z.literal('deleting-zeng'), z.literal('deleting-product'),
  ]).optional(),
}).strict()
const deletionReceipt = z.union([
  z.object({ operationId, handleDigest: z.string().min(1), status: z.literal('pending'), deleted: z.literal(true) }).strict(),
  z.object({ operationId, handleDigest: z.string().min(1), status: z.literal('completed'), completedAt: z.number().int().nonnegative(), deleted: z.literal(true) }).strict(),
]) as unknown as z.ZodType<DeletionReceipt>

/** Runtime validator for every append-only product fact at the durable boundary. */
export const productEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('created'), id: dilemmaId, branches, activePersona: persona, requestId }).strict(),
  z.object({ type: z.literal('branch-allocation'), allocation: branchAllocation, requestId }).strict(),
  z.object({ type: z.literal('branch-added'), operationId, branch, requestId }).strict(),
  z.object({ type: z.literal('persona-switched'), persona, requestId, timelineId: z.string().min(1) }).strict(),
  z.object({ type: z.literal('discussion-status'), status: discussionStatus, requestId }).strict(),
  z.object({ type: z.literal('archived'), requestId }).strict(),
  z.object({ type: z.literal('restored'), requestId }).strict(),
  z.object({ type: z.literal('user-message'), id: z.string().min(1), persona, requestId, content: z.string().optional(), messageId: messageId.optional(), deliveryOperationId: operationId.optional(), status: z.enum(['pending', 'claimed', 'delivered', 'failed', 'cancelled']).optional(), replyToTimelineEventId: z.string().min(1).optional(), sessionEventId: z.string().min(1).optional() }).strict(),
  z.object({ type: z.literal('message-retry'), messageId, previousTurnOperationId: operationId, previousDeliveryOperationId: operationId, turnOperationId: operationId, deliveryOperationId: operationId, requestId }).strict(),
  z.object({
    type: z.literal('persona-message'), id: z.string().min(1), persona, sessionId,
    sourceEventId: z.string().min(1), requestId,
  }).strict(),
  z.object({ type: z.literal('deletion'), operation: deletion, requestId }).strict(),
  z.object({ type: z.literal('deletion-cancelled'), operationId, requestId }).strict(),
  z.object({ type: z.literal('message-delivery'), messageId, deliveryOperationId: operationId, persona, status: z.enum(['pending', 'claimed', 'delivered', 'failed', 'cancelled']), sessionMessageId: z.string().min(1).optional(), sessionEventId: z.string().min(1).optional(), replyToTimelineEventId: z.string().min(1).optional(), requestId }).strict(),
  z.object({ type: z.literal('turn'), turnOperationId: operationId, messageId, persona, status: z.enum(['claimed', 'running', 'completed', 'failed', 'cancelled']), sessionEventId: z.string().min(1).optional(), requestId }).strict(),
  z.object({ type: z.literal('turn-execution'), turnOperationId: operationId, messageId, persona, state: executionState, error: z.string().max(300).optional(), requestId }).strict(),
  z.object({ type: z.literal('turn-budget'), turnOperationId: operationId, messageId, persona, modelRequests: z.number().int().nonnegative(), toolCalls: z.number().int().nonnegative(), noProgressCount: z.number().int().nonnegative(), inputTokens: z.number().int().nonnegative().optional(), outputTokens: z.number().int().nonnegative().optional(), cacheReadTokens: z.number().int().nonnegative().optional(), cacheWriteTokens: z.number().int().nonnegative().optional(), status: z.enum(['running', 'budget-exhausted', 'completed', 'failed', 'cancelled']), requestId }).strict(),
  z.object({ type: z.literal('activity'), id: operationId, messageId, turnOperationId: operationId, persona, phase: z.enum(['received', 'thinking', 'researching', 'evidence-check', 'finalizing', 'completed', 'failed', 'cancelled']), startedAt: z.number().int().nonnegative(), endedAt: z.number().int().nonnegative().optional(), durationMs: z.number().int().nonnegative().optional(), count: z.number().int().nonnegative().optional(), requestId }).strict(),
  z.object({ type: z.literal('context-projection'), projection: z.object({ operationId, persona, allowedEventIds: z.array(z.string()), excludedEventIds: z.array(z.string()), inputFingerprint: z.string().min(1).optional(), modelInputBytes: z.number().int().nonnegative().optional() }).strict(), requestId }).strict(),
  z.object({ type: z.literal('state-analysis'), operationId, inputWatermark: z.string().min(1), revision: z.number().int().nonnegative(), branchRevision: z.number().int().nonnegative(), contextRevision: z.number().int().nonnegative().optional(), status: z.enum(['claimed', 'running', 'completed', 'failed', 'stale']), failureCategory: z.enum(['provider', 'parse', 'context']).optional(), failureDetail: z.string().max(300).optional(), candidates: z.array(candidate).optional(), persona: persona.optional(), inputProjection: z.array(z.record(z.string(), z.unknown())).optional(), modelInputProjection: z.array(z.record(z.string(), z.unknown())).optional(), sourceOperationId: operationId.optional(), requestId }).strict(),
  z.object({ type: z.literal('shared-state'), item: sharedStateItem, requestId }).strict(),
  z.object({ type: z.literal('persona-snapshot'), snapshot: personaSnapshot, requestId }).strict(),
  z.object({ type: z.literal('title'), operationId, status: z.enum(['claimed', 'completed', 'fallback', 'stale', 'suppressed']), value: z.string().min(1).optional(), titleRevision: z.number().int().nonnegative().optional(), requestId }).strict(),
  z.object({ type: z.literal('renamed'), title: z.string().min(1), titleRevision: z.number().int().nonnegative().optional(), requestId }).strict(),
  z.object({ type: z.literal('evidence'), evidenceId: z.string().min(1), status: z.enum(['available', 'challenged', 'withdrawn']), persona: persona.optional(), evidenceType: z.string().min(1).optional(), trustLevel: z.string().min(1).optional(), source: z.string().min(1).optional(), sourceFingerprint: z.string().min(1).optional(), toolOperationId: operationId.optional(), requestId }).strict(),
  z.object({ type: z.literal('safety-blocked'), messageId, safetyOperationId: operationId, persona, content: z.string().min(1), kind: z.enum(['danger', 'professional']), reason: z.string().min(1), requestId }).strict(),
  z.object({ type: z.literal('system-safety-reply'), safetyOperationId: operationId, messageId, text: z.string().min(1), requestId }).strict(),
  z.object({ type: z.literal('persona-acknowledgement'), id: z.string().min(1), sourcePersona: persona, sourceUserMessageId: z.string().min(1), sourcePersonaMessageId: z.string().min(1), status: z.enum(['active', 'withdrawn']), requestId }).strict(),
  z.object({ type: z.literal('evidence-tool-claim'), operationId, turnOperationId: operationId, persona, sessionId, topic: z.string().min(1), requestedCount: z.number().int().positive().max(3), reservedCount: z.number().int().nonnegative(), reservedBytes: z.number().int().nonnegative(), deadline: z.number().int().nonnegative(), evidenceRevision: z.number().int().nonnegative(), fingerprint: z.string().min(1), returnedEvidenceIds: z.array(z.string().min(1)).optional(), status: z.enum(['claimed', 'completed', 'failed', 'cancelled']), requestId }).strict(),
  z.object({ type: z.literal('claim-sidecar'), turnOperationId: operationId, textRange: z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive() }).strict(), kind: z.enum(['reliable-quote', 'historical-fact', 'attribution', 'modern-inference', 'insufficient-evidence']), evidenceIds: z.array(z.string().min(1)), status: z.enum(['accepted', 'stale']), requestId }).strict(),
  z.object({
    type: z.literal('choice'), operationId, turnOperationId: operationId, persona,
    status: z.enum(['pending', 'answered', 'cancelled', 'failed']),
    questions: z.array(choiceQuestion).min(1).optional(), answers: z.array(choiceAnswer).optional(), requestId,
  }).strict(),
]) as unknown as z.ZodType<ProductEvent>

/** One durable append-only event list, keyed by dilemma id. */
export const productEventListSchema = z.array(productEventSchema)

/** Product event domain opened by the host-owned repository. */
export const manRoleplayerProductDomainSpec = defineDomain({
  name: 'man_roleplayer_product',
  version: 1,
  tables: {
    conversations: domainTable<string, readonly ProductEvent[]>(productEventListSchema),
    deletion_receipts: domainTable<string, DeletionReceipt>(deletionReceipt),
  },
})
