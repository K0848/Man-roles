/**
 * man-roles-roleplayer —— ConversationAggregate（产品层对话聚合，纯 TS）。
 *
 * 一个产品对话 = 1 个 TrunkStorage（共享层，方案 A 自持 JSONL）
 *              + N 个 BranchSession（隔离层，独立 DSH Session，经 BranchManager 索引）。
 *
 * 目标架构（task_plan 阶段 4）：
 *   ConversationAggregate
 *   ├─ TrunkStorage（插件自持 JSONL）—— 共享层
 *   │   ├─ conversation_id / active_persona_id / user_raw_refs[]
 *   │   ├─ dilemma { phase, candidate_text, confirmed_text, corrected_text }
 *   │   └─ branches_index { PersonaId: session_id }
 *   └─ BranchSession：每个已注册人物独立持有 —— 隔离层
 *
 * 共享/隔离规则（红线）：
 *  - 用户原话 + 已确认/纠正困惑 → TrunkStorage（跨人物共享）；
 *  - 各人物回答/进度 → 各自 BranchSession（结构性隔离，绝不含他人内容）；
 *  - candidate（未确认）不进上下文（F001，由 assemble 层过滤）。
 *
 * 零 @deepseek-ai 运行时依赖（可单测）；DSH Session 对象的创建/append 由
 * 调用方（E2E 驱动/生产装配层）基于 BranchManager 返回的 sessionId 完成。
 */
import { TrunkStorage } from '../storage/trunk-storage.ts'
import { BranchManager } from '../branch/branch-manager.ts'
import type { BranchRecord } from '../branch/branch-manager.ts'
import type { PersonaId, DilemmaState, TrunkUserRaw, TaskOutcome } from '../domain/schema.ts'
import type { PersonaRegistry } from '../persona/registry.ts'

/** 共享层快照（跨人物注入的上下文来源）。 */
export interface SharedLayer {
  /** 用户原话本体（逐字，只增不改；ref = 稳定指针）。 */
  userRaws: TrunkUserRaw[]
  /** 困惑状态（candidate 不进上下文——F001，由 assemble 层过滤）。 */
  dilemma: DilemmaState
}

/** 默认 sessionId 生成：`session-man-roles-<persona>`（e2e/生产可注入自定义生成器）。 */
export function defaultSessionIdFor(persona: PersonaId): string {
  return `session-man-roles-${persona}`
}

/**
 * 产品层对话聚合：一个 conversation 一个实例。创建（create）或恢复（load）
 * 后即可进行 addUserRaw / setDilemma* / switchPersona 等操作。
 */
export class ConversationAggregate {
  readonly conversationId: string
  readonly trunk: TrunkStorage
  readonly branches: BranchManager

  private constructor(conversationId: string, trunk: TrunkStorage, branches: BranchManager) {
    this.conversationId = conversationId
    this.trunk = trunk
    this.branches = branches
  }

  /** 新建对话（写 trunk/created 事件）。 */
  static create(conversationId: string, storageDir: string, initialPersonaId: PersonaId, registry: PersonaRegistry): ConversationAggregate {
    registry.requireActiveForCreate(initialPersonaId)
    const trunk = TrunkStorage.create(conversationId, storageDir, initialPersonaId, registry)
    return new ConversationAggregate(conversationId, trunk, new BranchManager(initialPersonaId, registry))
  }

  /** 从磁盘恢复对话（启动恢复：重放 trunk JSONL；branches 索引与 active 一并恢复）。 */
  static load(conversationId: string, storageDir: string, registry: PersonaRegistry): ConversationAggregate {
    const trunk = TrunkStorage.load(conversationId, storageDir, registry)
    const branches = new BranchManager(trunk.state.activePersona, registry, trunk.state.branchesIndex)
    return new ConversationAggregate(conversationId, trunk, branches)
  }

  /** 当前人物。 */
  get activePersona(): PersonaId {
    return this.branches.activePersona
  }

  /** 共享层（user_raw 本体 + 困惑状态）。 */
  get sharedLayer(): SharedLayer {
    return { userRaws: this.trunk.state.userRaws, dilemma: this.trunk.state.dilemma }
  }
  get taskOutcomes(): Readonly<Record<string, TaskOutcome>> { return this.trunk.state.taskOutcomes }
  recordTaskBudgetBlocked(outcome: TaskOutcome): number { return this.trunk.recordTaskBudgetBlocked(outcome) }

  /** 人物 ↔ session_id 索引（只读快照）。 */
  get branchesIndex(): ReadonlyMap<PersonaId, BranchRecord> {
    return this.branches.branches
  }

  /** 当前活跃分支记录。 */
  currentBranch(): BranchRecord | null {
    return this.branches.currentBranch()
  }

  /**
   * 追加用户原话（共享层）。返回 ref（稳定指针）；重试按 message_id 返回既有 ref。
   * 调用方还需把该原话 append 到**当前**人物 BranchSession（其对话历史），
   * 但跨人物共享只依赖 trunk（目标架构：branch 历史含 user/message + assistant/message）。
   */
  addUserRaw(messageId: string, text: string, targetPersonaId: PersonaId): number {
    return this.trunk.addUserRaw(messageId, text, targetPersonaId)
  }

  /** 导演推断候选（未确认；F001）。persona 默认当前人物。 */
  setDilemmaCandidate(text: string, persona: PersonaId): number {
    return this.trunk.setDilemmaCandidate(text, persona)
  }

  /** 用户确认后的困惑（共享事实）。 */
  setDilemmaConfirmed(text: string): number {
    return this.trunk.setDilemmaConfirmed(text)
  }

  /** 用户纠正后的困惑（共享事实）。 */
  setDilemmaCorrected(text: string): number {
    return this.trunk.setDilemmaCorrected(text)
  }

  /**
   * 切换当前人物（产品语义：用户无感知底层切换、当前分支独立可见）。
   * 切换 = 确保目标分支存在（首次进入创建 Session 并登记索引）+
   *       trunk 记录 active-persona-set（方案 A 持久化）+
   *       BranchManager.activate（进程内活跃指针）。
   * 其他分支仅隐藏、不删除、不合并；切回时复用原 sessionId，不重建。
   * @param persona - 目标人物。
   * @param createSessionId - 仅首次进入该分支时调用，返回新 Session id。
   * @returns 目标分支 { sessionId, created }。
   */
  switchPersona(persona: PersonaId, createSessionId: (p: PersonaId) => string = defaultSessionIdFor): {
    sessionId: string
    created: boolean
  } {
    const branch = this.branches.ensureBranch(persona, () => createSessionId(persona))
    // 索引登记幂等：sessionId 已一致则跳过（不重复写事件）
    if (this.trunk.state.branchesIndex[persona] !== branch.sessionId) {
      this.trunk.indexBranch(persona, branch.sessionId)
    }
    if (this.branches.activePersona !== persona) {
      this.trunk.setActivePersona(persona)
      this.branches.activate(persona)
    }
    return branch
  }

  /** 显式登记分支（调用方在外部创建 Session 后同步索引；幂等）。 */
  indexBranch(persona: PersonaId, sessionId: string): number {
    this.branches.ensureBranch(persona, () => sessionId)
    if (this.trunk.state.branchesIndex[persona] !== sessionId) {
      return this.trunk.indexBranch(persona, sessionId)
    }
    return -1
  }

  /** trunk 落盘收尾（追加写已即时落盘；接口保留）。 */
  async flush(): Promise<void> {
    await this.trunk.flush()
  }
}
