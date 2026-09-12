// src/branch/branch-manager.ts
var BranchManager = class {
  branchesInternal = /* @__PURE__ */ new Map();
  activeInternal;
  registry;
  constructor(initialPersonaId, registry, existingIndex = {}) {
    this.registry = registry;
    this.activeInternal = registry.get(initialPersonaId).id;
    for (const [rawPersona, sessionId] of Object.entries(existingIndex)) {
      const persona = registry.normalizePersistedId(rawPersona);
      this.branchesInternal.set(persona, { persona, sessionId });
    }
    if (registry.get(this.activeInternal).status === "retired" && !this.branchesInternal.has(this.activeInternal)) {
      throw new Error(`retired active PersonaId requires an existing branch: ${this.activeInternal}`);
    }
  }
  /** 当前活跃人物。 */
  get activePersona() {
    return this.activeInternal;
  }
  /** 全部分支索引（只读快照）。 */
  get branches() {
    return this.branchesInternal;
  }
  /** 当前活跃分支记录（隔离层来源）。 */
  currentBranch() {
    return this.branchesInternal.get(this.activeInternal) ?? null;
  }
  /** 查询某人物分支的 sessionId（未登记返回 null）。 */
  sessionIdOf(persona) {
    return this.branchesInternal.get(persona)?.sessionId ?? null;
  }
  /**
   * 确保某人物分支存在：首次进入时调用 createSessionId() 建 Session 并登记；
   * 已存在则原样复用（返回时恢复不重建）。
   * @param persona - 目标人物。
   * @param createSessionId - 仅在该分支尚未登记时调用，返回新 Session id。
   * @returns { sessionId, created }——created=true 表示本次新建。
   */
  ensureBranch(persona, createSessionId) {
    const canonical = this.registry.get(persona).id;
    const existing = this.branchesInternal.get(canonical);
    if (existing !== void 0) return { sessionId: existing.sessionId, created: false };
    this.registry.requireActiveForCreate(canonical);
    const sessionId = createSessionId();
    this.branchesInternal.set(canonical, { persona: canonical, sessionId });
    return { sessionId, created: true };
  }
  /**
   * 切换当前活跃人物（只改活跃指针；其他分支仅隐藏、不删除、不合并）。
   * 若目标分支未登记，调用方应先 ensureBranch 再 activate。
   */
  activate(persona) {
    const canonical = this.registry.get(persona).id;
    if (!this.branchesInternal.has(canonical)) throw new Error(`cannot activate unindexed branch: ${canonical}`);
    this.activeInternal = canonical;
  }
};
export {
  BranchManager
};
//# sourceMappingURL=branch.js.map
