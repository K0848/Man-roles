/**
 * man-roles-roleplayer —— BranchManager（人物分支 Session 管理，纯 TS）。
 *
 * 隔离由数据结构保证（用户 2026-08-23 确认）：每个 PersonaId 对应一个独立
 * DSH Session（隔离层），BranchManager 只维护「人物 ↔ session_id」索引与当前
 * 活跃人物；模型调用前，当前人物上下文只读自己分支的会话历史——本模块不提供
 * 任何「读他人分支」的路径，结构性保证隔离（不靠 Prompt 约束）。
 *
 * 与 DSH Session 对象的对接由调用方（E2E 驱动 / 生产装配层）完成：本模块只
 * 持有 sessionId 字符串与活跃状态，零 @deepseek-ai 运行时依赖（可单测）。
 */
import type { PersonaId } from '../domain/schema.ts'
import type { PersonaRegistry } from '../persona/registry.ts'

/** 一个分支的索引记录。 */
export interface BranchRecord {
  persona: PersonaId
  /** 该人物的独立 DSH Session id（首次进入创建，返回复用不重建）。 */
  sessionId: string
}

/**
 * 人物分支索引管理器。
 *  - 每个人物恰有一条分支记录（sessionId 唯一）；
 *  - 同一时刻只有一个活跃人物（PersonaId）；
 *  - 切换 = activate(persona)，只改活跃指针，其他分支不删除、不合并（仅隐藏）。
 */
export class BranchManager {
  private readonly branchesInternal = new Map<PersonaId, BranchRecord>()
  private activeInternal: PersonaId
  readonly registry: PersonaRegistry

  constructor(initialPersonaId: PersonaId, registry: PersonaRegistry, existingIndex: Readonly<Record<string, string>> = {}) {
    this.registry = registry
    // The active pointer is already canonicalized by TrunkStorage.load; do not
    // widen this runtime constructor to accept persisted aliases.
    this.activeInternal = registry.get(initialPersonaId).id
    for (const [rawPersona, sessionId] of Object.entries(existingIndex)) {
      const persona = registry.normalizePersistedId(rawPersona)
      this.branchesInternal.set(persona, { persona, sessionId })
    }
    if (registry.get(this.activeInternal).status === 'retired' && !this.branchesInternal.has(this.activeInternal)) {
      throw new Error(`retired active PersonaId requires an existing branch: ${this.activeInternal}`)
    }
  }

  /** 当前活跃人物。 */
  get activePersona(): PersonaId {
    return this.activeInternal
  }

  /** 全部分支索引（只读快照）。 */
  get branches(): ReadonlyMap<PersonaId, BranchRecord> {
    return this.branchesInternal
  }

  /** 当前活跃分支记录（隔离层来源）。 */
  currentBranch(): BranchRecord | null {
    return this.branchesInternal.get(this.activeInternal) ?? null
  }

  /** 查询某人物分支的 sessionId（未登记返回 null）。 */
  sessionIdOf(persona: PersonaId): string | null {
    return this.branchesInternal.get(persona)?.sessionId ?? null
  }

  /**
   * 确保某人物分支存在：首次进入时调用 createSessionId() 建 Session 并登记；
   * 已存在则原样复用（返回时恢复不重建）。
   * @param persona - 目标人物。
   * @param createSessionId - 仅在该分支尚未登记时调用，返回新 Session id。
   * @returns { sessionId, created }——created=true 表示本次新建。
   */
  ensureBranch(persona: PersonaId, createSessionId: () => string): { sessionId: string; created: boolean } {
    const canonical = this.registry.get(persona).id
    const existing = this.branchesInternal.get(canonical)
    if (existing !== undefined) return { sessionId: existing.sessionId, created: false }
    this.registry.requireActiveForCreate(canonical)
    const sessionId = createSessionId()
    this.branchesInternal.set(canonical, { persona: canonical, sessionId })
    return { sessionId, created: true }
  }

  /**
   * 切换当前活跃人物（只改活跃指针；其他分支仅隐藏、不删除、不合并）。
   * 若目标分支未登记，调用方应先 ensureBranch 再 activate。
   */
  activate(persona: PersonaId): void {
    const canonical = this.registry.get(persona).id
    if (!this.branchesInternal.has(canonical)) throw new Error(`cannot activate unindexed branch: ${canonical}`)
    this.activeInternal = canonical
  }
}
