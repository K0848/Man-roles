import { branchUserMessageExtra, branchUserMessageSourceFromData, branchUserMessageSourceSchema } from '../branch/message-source.ts'
import type { BranchUserMessageSource } from '../branch/message-source.ts'
import type { PersonaId, TrunkUserRaw } from '../domain/schema.ts'
import type { TrunkStorage } from '../storage/trunk-storage.ts'
import type { BranchSessionWriter } from './message-delivery.ts'

export interface RecoveryBranch extends BranchSessionWriter {
  sessionId: string
  /** Required durable boundary. An omitted boundary fails closed. */
  flush?: (session: RecoveryBranch) => unknown | Promise<unknown>
  /** Optional public seam supplied by a DSH adapter; no Core changes are needed. */
  findUserMessageByRawRef?: (rawRef: string) => boolean | Promise<boolean>
  /** Events read from a newly restored session, not the live in-memory event list. */
  restoredEvents?: Iterable<{ type?: string; data?: unknown }>
}

export interface PendingRecoveryInput {
  trunk: TrunkStorage
  branches: Partial<Record<PersonaId, RecoveryBranch>>
  /** At most one pass is performed; callers may schedule a later pass explicitly. */
}

export type RecoveryItem = {
  rawRef: string
  messageId: string
  personaId?: PersonaId
  status: 'committed' | 'recovered' | 'failed'
  failureCode?: 'legacy_target_missing' | 'target_branch_missing' | 'query_missing' | 'query_failed' | 'flush_missing' | 'branch_write_failed' | 'flush_failed' | 'commit_failed'
}

function sourceInRestoredEvents(branch: RecoveryBranch, source: BranchUserMessageSource): boolean {
  for (const event of branch.restoredEvents ?? []) {
    if (event.type !== 'user/message') continue
    const parsed = branchUserMessageSourceSchema.safeParse(branchUserMessageSourceFromData(event.data))
    if (parsed.success && parsed.data.conversation_id === source.conversation_id && parsed.data.raw_ref === source.raw_ref && parsed.data.persona_id === source.persona_id) return true
  }
  return false
}

async function projectionExists(branch: RecoveryBranch, source: BranchUserMessageSource): Promise<boolean> {
  if (branch.findUserMessageByRawRef) return Boolean(await branch.findUserMessageByRawRef(source.raw_ref))
  return sourceInRestoredEvents(branch, source)
}

function item(raw: TrunkUserRaw, status: RecoveryItem['status'], failureCode?: RecoveryItem['failureCode']): RecoveryItem {
  return { rawRef: raw.rawRef, messageId: raw.messageId, ...(raw.targetPersonaId ? { personaId: raw.targetPersonaId } : {}), status, ...(failureCode ? { failureCode } : {}) }
}

/**
 * Replays accepted raws and repairs only the missing delivery side effects.
 * This is a bounded, single-pass compensator: it never invokes generation.
 */
export async function recoverPendingDeliveries(input: PendingRecoveryInput): Promise<RecoveryItem[]> {
  const { trunk } = input
  const results: RecoveryItem[] = []
  for (const raw of trunk.state.userRaws as TrunkUserRaw[]) {
    if (raw.targetPersonaId === undefined) {
      results.push(item(raw, 'failed', 'legacy_target_missing'))
      continue
    }
    if (trunk.isBranchDeliveryCommitted(raw.targetPersonaId, raw.rawRef)) {
      results.push(item(raw, 'committed'))
      continue
    }
    const branch = input.branches[raw.targetPersonaId]
    const sessionId = trunk.state.branchesIndex[raw.targetPersonaId]
    if (!branch || !sessionId || branch.sessionId !== sessionId) {
      results.push(item(raw, 'failed', 'target_branch_missing'))
      continue
    }
    const source = branchUserMessageSourceSchema.parse({ conversation_id: trunk.state.conversationId, message_id: raw.messageId, raw_ref: raw.rawRef, persona_id: raw.targetPersonaId })
    if (!branch.findUserMessageByRawRef && !branch.restoredEvents) {
      results.push(item(raw, 'failed', branch.flush ? 'query_missing' : 'flush_missing'))
      continue
    }
    let exists: boolean
    try {
      exists = await projectionExists(branch, source)
    } catch {
      results.push(item(raw, 'failed', 'query_failed'))
      continue
    }
    if (exists) {
      try {
        trunk.commitBranchDelivery({ ...source, session_id: sessionId })
        results.push(item(raw, 'recovered'))
      } catch {
        results.push(item(raw, 'failed', 'commit_failed'))
      }
      continue
    }
    if (!branch.flush) {
      results.push(item(raw, 'failed', 'flush_missing'))
      continue
    }
    try {
      branch.append('user/message', { id: raw.messageId, role: 'user', content: [{ type: 'text', text: raw.text }], source: { kind: 'user' }, extra: branchUserMessageExtra(source) }, { surfaceOp: 'append' })
    } catch {
      results.push(item(raw, 'failed', 'branch_write_failed'))
      continue
    }
    try {
      await branch.flush(branch)
    } catch {
      // A failed flush is not evidence that the projection is durable.
      results.push(item(raw, 'failed', 'flush_failed'))
      continue
    }
    try {
      trunk.commitBranchDelivery({ ...source, session_id: sessionId })
      results.push(item(raw, 'recovered'))
    } catch {
      results.push(item(raw, 'failed', 'commit_failed'))
    }
  }
  return results
}

/**
 * Host/plugin startup seam. It only invokes delivery and derived-state
 * coordinators supplied by the host; neither callback receives an AgentLoop.
 */
export interface RecoveryStartupInput {
  delivery?: PendingRecoveryInput
  compensation?: DerivedStateCompensationInput
}

/**
 * Explicit plugin startup coordinator. The host calls this after restoring its
 * concrete trunk/Branch adapters; there is no guessed lifecycle event and no
 * AgentLoop/generation dependency in this call graph.
 */
export async function runRecoveryStartup(input: RecoveryStartupInput): Promise<{ deliveries: RecoveryItem[]; compensation?: Awaited<ReturnType<typeof compensateDerivedState>> }> {
  const deliveries = input.delivery ? await recoverPendingDeliveries(input.delivery) : []
  const compensation = input.compensation ? await compensateDerivedState(input.compensation) : undefined
  return { deliveries, ...(compensation ? { compensation } : {}) }
}

export interface DerivedStateCompensationInput {
  taskId: string
  messageId: string
  answerExists: () => boolean | Promise<boolean>
  stateExists: () => boolean | Promise<boolean>
  compensate: (key: { taskId: string; messageId: string }) => unknown | Promise<unknown>
}

/** Answer persistence is authoritative: only retry the derived-state callback. */
export async function compensateDerivedState(input: DerivedStateCompensationInput): Promise<{ status: 'not-needed' | 'compensated' | 'failed'; failureCode?: 'derived_state_failed' }> {
  if (!await input.answerExists() || await input.stateExists()) return { status: 'not-needed' }
  try { await input.compensate({ taskId: input.taskId, messageId: input.messageId }); return { status: 'compensated' } } catch { return { status: 'failed', failureCode: 'derived_state_failed' } }
}
