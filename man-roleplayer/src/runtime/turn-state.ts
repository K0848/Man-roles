import type { PersonaId } from '../domain/schema.ts'
import { EvidenceLedger } from '../evidence/ledger.ts'
import { isDialogueControl } from '../dialogue/public-contract.ts'
export type RetrievalPolicy = 'allow' | 'deny'
export type ActorTurnPolicy = { retrievalPolicy: RetrievalPolicy; maxQuestions?: number; allowedControls: readonly string[] }
export function turnPolicyViolation(args: any, current: { policyConfigured: boolean; maxQuestions?: number; allowedControls: readonly string[] }): string | undefined {
  if (!current.policyConfigured) return undefined
  const questions = Array.isArray(args?.questions) ? args.questions : []
  if (current.maxQuestions !== undefined && questions.length > current.maxQuestions) return `本回合最多允许 ${current.maxQuestions} 个问题；请删除多余问题后重新提交。`
  return undefined
}

/**
 * 控制项只是回答后的 UI 建议，不得因为模型多提了当前状态不适用的已知控制项
 * 而丢弃整段人物回答。未知控制值仍保留给 submit schema fail-closed。
 */
export function normalizeTurnPolicyArgs<T>(args: T, current: { policyConfigured: boolean; allowedControls: readonly string[] }): T {
  if (!current.policyConfigured || typeof args !== 'object' || args === null) return args
  const offeredControls = (args as { offeredControls?: unknown }).offeredControls
  if (!Array.isArray(offeredControls)) return args
  const normalized = offeredControls.filter(control => !isDialogueControl(control) || current.allowedControls.includes(control))
  return normalized.length === offeredControls.length ? args : { ...args, offeredControls: normalized }
}
export class ActorTurnStateRegistry {
  private readonly states = new WeakMap<object, Map<string, { personaId: PersonaId; turnId: string; ledger: EvidenceLedger; failures: number; repairPrompted: boolean; submitted: boolean; retrievalPolicy: RetrievalPolicy; maxQuestions?: number; allowedControls: readonly string[]; policyConfigured: boolean; repairDetails?: string }>>()
  private readonly pendingPolicies = new WeakMap<object, Partial<ActorTurnPolicy>>()
  state(session: object, personaId: PersonaId, turnId: string) {
    let byTurn = this.states.get(session); if (!byTurn) { byTurn = new Map(); this.states.set(session, byTurn) }
    let value = byTurn.get(turnId)
    if (!value) { value = { personaId, turnId, ledger: new EvidenceLedger(personaId, turnId), failures: 0, repairPrompted: false, submitted: false, retrievalPolicy: 'allow', allowedControls: ['confirm', 'partial-confirm', 'correct', 'skip', 'continue', 'pause', 'end', 'switch-persona', 'new-dilemma'], policyConfigured: false }; byTurn.set(turnId, value) }
    return value
  }
  /** Coordinator/Actor boundary sets this before followup; tools enforce it again at execution. */
  setRetrievalPolicy(session: object, personaId: PersonaId, turnId: string, policy: RetrievalPolicy): void { this.state(session, personaId, turnId).retrievalPolicy = policy }
  setTurnPolicy(session: object, personaId: PersonaId, turnId: string, policy: ActorTurnPolicy): void { const current = this.state(session, personaId, turnId); current.retrievalPolicy = policy.retrievalPolicy; current.maxQuestions = policy.maxQuestions; current.allowedControls = [...new Set(policy.allowedControls)]; current.policyConfigured = true }
  setNextTurnPolicy(session: object, policy: ActorTurnPolicy): void { this.pendingPolicies.set(session, { retrievalPolicy: policy.retrievalPolicy, maxQuestions: policy.maxQuestions, allowedControls: [...new Set(policy.allowedControls)] }) }
  setNextTurnRetrievalPolicy(session: object, policy: RetrievalPolicy): void { this.pendingPolicies.set(session, { retrievalPolicy: policy }) }
  setRepairDetails(session: object, personaId: PersonaId, turnId: string, details: string): void { this.state(session, personaId, turnId).repairDetails = details }
  stateForExecution(exec: { agent?: { session?: object } }, personaId: PersonaId) {
    const session = exec.agent?.session
    if (!session) throw new Error('actor tool execution missing agent session')
    const turnId = openTurnId(session as { events?: readonly { type: string; data?: unknown }[] })
    if (turnId === undefined) throw new Error('actor tool execution has no open turn')
    const byTurn = this.states.get(session); if (byTurn) for (const key of byTurn.keys()) if (key !== turnId) byTurn.delete(key)
    const value = this.state(session, personaId, turnId)
    const pending = this.pendingPolicies.get(session)
    if (pending) { if (pending.retrievalPolicy) value.retrievalPolicy = pending.retrievalPolicy; if (pending.maxQuestions !== undefined) value.maxQuestions = pending.maxQuestions; if (pending.allowedControls !== undefined) value.allowedControls = [...new Set(pending.allowedControls)]; if (pending.maxQuestions !== undefined || pending.allowedControls !== undefined) value.policyConfigured = true; this.pendingPolicies.delete(session) }
    return value
  }
  clearSession(session: object): void { this.states.delete(session) }
  consumeRepairPrompt(session: object): string | false {
    const byTurn = this.states.get(session); if (!byTurn) return false
    const events = (session as { events?: readonly { type: string; data?: unknown }[] }).events ?? []
    const hasSuccess = events.some((event) => event.type === 'tool/result' && typeof event.data === 'object' && event.data !== null && typeof (event.data as { meta?: unknown }).meta === 'object' && (event.data as { meta?: { kind?: unknown } }).meta?.kind === 'actor-reply')
    for (const value of byTurn.values()) if (value.failures === 1 && !hasSuccess && !value.submitted && !value.repairPrompted) { value.repairPrompted = true; return value.repairDetails ?? '提交结构无效，请修复后重试。' }
    return false
  }
  markSubmitted(session: object): void { const byTurn = this.states.get(session); if (byTurn) for (const value of byTurn.values()) value.submitted = true }
  consumeEvidenceRecoveryPrompt(session: object): boolean {
    const byTurn = this.states.get(session); if (!byTurn) return false
    const events = (session as { events?: readonly { type: string; data?: unknown }[] }).events ?? []
    const hasSuccess = events.some((event) => event.type === 'tool/result' && typeof event.data === 'object' && event.data !== null && typeof (event.data as { meta?: unknown }).meta === 'object' && (event.data as { meta?: { kind?: unknown } }).meta?.kind === 'actor-reply')
    for (const value of byTurn.values()) if (value.failures === 0 && !hasSuccess && !value.submitted && !value.repairPrompted && value.ledger.entries().length > 0) { value.repairPrompted = true; return true }
    return false
  }
}
export function openTurnId(session: { events?: readonly { type: string; data?: unknown }[] }): string | undefined {
  let open: string | undefined
  for (const event of session.events ?? []) { const turn = (event.data as { turn?: unknown } | undefined)?.turn; if (event.type === 'turn/start' && typeof turn === 'number') open = String(turn); if (event.type === 'turn/end' && typeof turn === 'number' && open === String(turn)) open = undefined }
  return open
}
