// src/e2e/task5-fixture.ts
import { appendFileSync as appendFileSync2, existsSync as existsSync2, readFileSync as readFileSync2, mkdirSync as mkdirSync2, writeFileSync } from "node:fs";
import { join as join2 } from "node:path";

// src/storage/trunk-storage.ts
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// src/domain/schema.ts
import { z } from "zod";
var activePersonaSchema = z.enum(["\u738B\u9633\u660E", "\u66FE\u56FD\u85E9"]);
var dilemmaPhaseSchema = z.enum(["pending", "candidate", "confirmed", "corrected"]);
var dilemmaStateSchema = z.object({
  phase: dilemmaPhaseSchema,
  activePersona: activePersonaSchema,
  /** 导演推断的困惑文本（未确认）。 */
  candidateText: z.string().nullable(),
  /** 用户确认后的困惑文本。 */
  confirmedText: z.string().nullable(),
  /** 用户纠正后的困惑文本。 */
  correctedText: z.string().nullable(),
  /** 已关联的 user/message 事件 seq 列表（只增，append-only）。 */
  userRawRefs: z.array(z.number()),
  /** 最近一次状态变更的 session 事件 seq（-1 = 尚无）。 */
  updatedBySeq: z.number()
});
var initialDilemmaState = (persona = "\u738B\u9633\u660E") => ({
  phase: "pending",
  activePersona: persona,
  candidateText: null,
  confirmedText: null,
  correctedText: null,
  userRawRefs: [],
  updatedBySeq: -1
});
var dilemmaEventHeaderSchema = z.object({
  turnId: z.string(),
  taskId: z.string(),
  invocationId: z.string()
});
var dilemmaCandidateEventSchema = dilemmaEventHeaderSchema.extend({
  persona: activePersonaSchema,
  text: z.string()
});
var dilemmaConfirmedEventSchema = dilemmaEventHeaderSchema.extend({
  text: z.string()
});
var dilemmaCorrectedEventSchema = dilemmaEventHeaderSchema.extend({
  text: z.string()
});
var trunkEventRecordSchema = z.object({
  type: z.string(),
  seq: z.number(),
  time: z.string(),
  data: z.unknown()
});
var trunkCreatedEventSchema = z.object({
  conversationId: z.string()
});
var trunkUserRawAddedEventSchema = z.object({
  ref: z.number(),
  text: z.string(),
  // 6.2: 客户端身份与稳定投递指针。旧 JSONL 无此字段时由 replay 补齐。
  message_id: z.string().min(1).optional(),
  raw_ref: z.string().min(1).optional(),
  // 6.2 Task4: first acceptance fixes the delivery target. Legacy records omit it.
  target_persona_id: activePersonaSchema.optional()
});
var trunkDilemmaCandidateEventSchema = z.object({
  persona: activePersonaSchema,
  text: z.string()
});
var trunkDilemmaConfirmedEventSchema = z.object({
  text: z.string()
});
var trunkDilemmaCorrectedEventSchema = z.object({
  text: z.string()
});
var trunkActivePersonaEventSchema = z.object({
  persona: activePersonaSchema
});
var trunkBranchIndexEventSchema = z.object({
  persona: activePersonaSchema,
  sessionId: z.string()
});
var trunkUserRawSchema = z.object({
  ref: z.number(),
  text: z.string(),
  messageId: z.string().min(1),
  rawRef: z.string().min(1),
  targetPersonaId: activePersonaSchema.optional()
});
var taskOutcomeSchema = z.object({ taskId: z.string().min(1), personaId: activePersonaSchema, branchSessionId: z.string().min(1), branchTurn: z.number().int().positive(), status: z.literal("blocked"), reason: z.literal("budget_exceeded"), retryable: z.literal(true) });
var trunkTaskOutcomeRecordedEventSchema = taskOutcomeSchema;
var trunkBranchDeliveryCommittedEventSchema = z.object({
  conversation_id: z.string().min(1),
  persona_id: activePersonaSchema,
  raw_ref: z.string().min(1),
  message_id: z.string().min(1),
  session_id: z.string().min(1)
});
var trunkStateSchema = z.object({
  conversationId: z.string(),
  activePersona: activePersonaSchema,
  userRaws: z.array(trunkUserRawSchema),
  dilemma: dilemmaStateSchema,
  branchesIndex: z.record(activePersonaSchema, z.string()),
  taskOutcomes: z.record(z.string(), taskOutcomeSchema),
  deliveryCommitted: z.array(trunkBranchDeliveryCommittedEventSchema)
});
var initialTrunkState = (conversationId) => ({
  conversationId,
  activePersona: "\u738B\u9633\u660E",
  userRaws: [],
  dilemma: initialDilemmaState("\u738B\u9633\u660E"),
  branchesIndex: {},
  taskOutcomes: {},
  deliveryCommitted: []
});

// src/domain/dilemma.ts
function transition(state, event) {
  switch (event.type) {
    case "user/message":
      if (state.userRawRefs.includes(event.seq)) return state;
      return { ...state, userRawRefs: [...state.userRawRefs, event.seq] };
    case "man-roles/dilemma/candidate": {
      if (state.phase !== "pending") return state;
      return {
        ...state,
        phase: "candidate",
        activePersona: event.data.persona,
        candidateText: event.data.text,
        updatedBySeq: event.seq ?? state.updatedBySeq
      };
    }
    case "man-roles/dilemma/confirmed": {
      if (state.phase !== "candidate") return state;
      return {
        ...state,
        phase: "confirmed",
        candidateText: null,
        confirmedText: event.data.text,
        updatedBySeq: event.seq ?? state.updatedBySeq
      };
    }
    case "man-roles/dilemma/corrected": {
      if (state.phase !== "candidate") return state;
      return {
        ...state,
        phase: "corrected",
        candidateText: null,
        correctedText: event.data.text,
        updatedBySeq: event.seq ?? state.updatedBySeq
      };
    }
    default:
      return state;
  }
}

// src/storage/trunk-storage.ts
var TRUNK_CREATED = "trunk/created";
var TRUNK_USER_RAW_ADDED = "trunk/user-raw-added";
var TRUNK_DILEMMA_CANDIDATE = "trunk/dilemma-candidate";
var TRUNK_DILEMMA_CONFIRMED = "trunk/dilemma-confirmed";
var TRUNK_DILEMMA_CORRECTED = "trunk/dilemma-corrected";
var TRUNK_ACTIVE_PERSONA_SET = "trunk/active-persona-set";
var TRUNK_BRANCH_INDEXED = "trunk/branch-indexed";
var TRUNK_TASK_OUTCOME_RECORDED = "trunk/task-outcome-recorded";
var TRUNK_BRANCH_DELIVERY_COMMITTED = "trunk/branch-delivery-committed";
function applyTrunkRecord(state, record) {
  switch (record.type) {
    case TRUNK_CREATED:
      return state;
    case TRUNK_USER_RAW_ADDED: {
      const parsed = trunkUserRawAddedEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      if (state.userRaws.some((u) => u.ref === parsed.data.ref)) return state;
      const fold = { type: "user/message", seq: parsed.data.ref };
      const raw = {
        ref: parsed.data.ref,
        text: parsed.data.text,
        messageId: parsed.data.message_id ?? `legacy-message-${state.conversationId}-${parsed.data.ref}`,
        rawRef: parsed.data.raw_ref ?? `legacy-raw-${state.conversationId}-${parsed.data.ref}`
      };
      if (parsed.data.target_persona_id) raw.targetPersonaId = parsed.data.target_persona_id;
      return {
        ...state,
        userRaws: [...state.userRaws, raw],
        dilemma: transition(state.dilemma, fold)
      };
    }
    case TRUNK_DILEMMA_CANDIDATE: {
      const parsed = trunkDilemmaCandidateEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      const fold = {
        type: "man-roles/dilemma/candidate",
        seq: record.seq,
        data: {
          turnId: "trunk",
          taskId: "trunk",
          invocationId: `trunk-seq-${record.seq}`,
          persona: parsed.data.persona,
          text: parsed.data.text
        }
      };
      return { ...state, dilemma: transition(state.dilemma, fold) };
    }
    case TRUNK_DILEMMA_CONFIRMED: {
      const parsed = trunkDilemmaConfirmedEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      const fold = {
        type: "man-roles/dilemma/confirmed",
        seq: record.seq,
        data: {
          turnId: "trunk",
          taskId: "trunk",
          invocationId: `trunk-seq-${record.seq}`,
          text: parsed.data.text
        }
      };
      return { ...state, dilemma: transition(state.dilemma, fold) };
    }
    case TRUNK_DILEMMA_CORRECTED: {
      const parsed = trunkDilemmaCorrectedEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      const fold = {
        type: "man-roles/dilemma/corrected",
        seq: record.seq,
        data: {
          turnId: "trunk",
          taskId: "trunk",
          invocationId: `trunk-seq-${record.seq}`,
          text: parsed.data.text
        }
      };
      return { ...state, dilemma: transition(state.dilemma, fold) };
    }
    case TRUNK_ACTIVE_PERSONA_SET: {
      const parsed = trunkActivePersonaEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      return { ...state, activePersona: parsed.data.persona };
    }
    case TRUNK_BRANCH_INDEXED: {
      const parsed = trunkBranchIndexEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      return { ...state, branchesIndex: { ...state.branchesIndex, [parsed.data.persona]: parsed.data.sessionId } };
    }
    case TRUNK_TASK_OUTCOME_RECORDED: {
      const parsed = trunkTaskOutcomeRecordedEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      const previous = state.taskOutcomes[parsed.data.taskId];
      if (previous && JSON.stringify(previous) !== JSON.stringify(parsed.data)) throw new Error(`task outcome conflict: ${parsed.data.taskId}`);
      return previous ? state : { ...state, taskOutcomes: { ...state.taskOutcomes, [parsed.data.taskId]: parsed.data } };
    }
    case TRUNK_BRANCH_DELIVERY_COMMITTED: {
      const parsed = trunkBranchDeliveryCommittedEventSchema.safeParse(record.data);
      if (!parsed.success) return state;
      if (state.deliveryCommitted.some((d) => d.conversation_id === parsed.data.conversation_id && d.persona_id === parsed.data.persona_id && d.raw_ref === parsed.data.raw_ref)) return state;
      return { ...state, deliveryCommitted: [...state.deliveryCommitted, parsed.data] };
    }
    default:
      return state;
  }
}
function parseRecordLine(line) {
  try {
    const parsed = trunkEventRecordSchema.safeParse(JSON.parse(line));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
var TrunkStorage = class _TrunkStorage {
  /** 存储目录（JSONL 文件所在目录）。 */
  storageDir;
  /** JSONL 文件绝对路径。 */
  filePath;
  stateInternal;
  nextSeqInternal;
  constructor(state, filePath, nextSeq) {
    this.stateInternal = state;
    this.filePath = filePath;
    this.storageDir = dirname(filePath);
    this.nextSeqInternal = nextSeq;
  }
  /** 当前完整状态（只读快照）。 */
  get state() {
    return this.stateInternal;
  }
  /** 下一个事件 seq（未使用）。 */
  get nextSeq() {
    return this.nextSeqInternal;
  }
  /** 创建新 trunk（写入 trunk/created 事件，seq=0）。 */
  static create(conversationId, storageDir) {
    const filePath = join(storageDir, `${conversationId}.jsonl`);
    mkdirSync(storageDir, { recursive: true });
    const storage = new _TrunkStorage(initialTrunkState(conversationId), filePath, 0);
    storage.append(TRUNK_CREATED, { conversationId });
    return storage;
  }
  /**
   * 从磁盘恢复 trunk（启动恢复；重放 JSONL 事件，重复 seq 幂等跳过）。
   * 文件不存在 → 视为新会话（等价 create，但不重复写 created 事件由调用方决定——
   * 此处直接返回新实例并写 created）。
   */
  static load(conversationId, storageDir) {
    const filePath = join(storageDir, `${conversationId}.jsonl`);
    if (!existsSync(filePath)) {
      return _TrunkStorage.create(conversationId, storageDir);
    }
    const text = readFileSync(filePath, "utf8");
    let state = initialTrunkState(conversationId);
    let maxSeq = -1;
    for (const line of text.split(/\r?\n/)) {
      if (line.trim() === "") continue;
      const record = parseRecordLine(line);
      if (record === null) continue;
      if (record.seq <= maxSeq) continue;
      maxSeq = record.seq;
      state = applyTrunkRecord(state, record);
    }
    return new _TrunkStorage(state, filePath, maxSeq + 1);
  }
  /** 追加一条事件：seq 自增、同步落盘、折叠进内存态。返回 seq。 */
  append(type, data) {
    const seq = this.nextSeqInternal;
    const record = { type, seq, time: (/* @__PURE__ */ new Date()).toISOString(), data };
    appendFileSync(this.filePath, `${JSON.stringify(record)}
`, "utf8");
    this.nextSeqInternal = seq + 1;
    this.stateInternal = applyTrunkRecord(this.stateInternal, record);
    return seq;
  }
  /**
   * 追加用户原话（共享层，只增不改；ref/raw_ref 由 Trunk 分配）。
   *
   * messageId 是客户端在一次主动发送及其网络重试间复用的稳定身份；
   * 幂等只依据该身份，不能依据用户原话文本（用户可以主动发送相同文本）。
   * @returns 本次追加或已有消息的 ref。
   */
  addUserRaw(messageId, text, targetPersonaId = this.stateInternal.activePersona) {
    if (typeof messageId !== "string" || messageId.trim().length === 0 || messageId !== messageId.trim()) {
      throw new Error("message_id must be a non-empty stable identifier");
    }
    if (typeof text !== "string") throw new Error("user raw text must be a string");
    const existing = this.stateInternal.userRaws.find((raw) => raw.messageId === messageId);
    if (existing !== void 0) {
      if (existing.text !== text) {
        const error = Object.assign(new Error(`message_id conflict: ${messageId}`), { code: "message_id_conflict" });
        throw error;
      }
      if (existing.targetPersonaId === void 0) {
        const error = Object.assign(new Error(`legacy target missing: ${messageId}`), { code: "legacy_target_missing" });
        throw error;
      }
      if (existing.targetPersonaId !== targetPersonaId) {
        const error = Object.assign(new Error(`message target conflict: ${messageId}`), { code: "message_id_conflict" });
        throw error;
      }
      return existing.ref;
    }
    const ref = this.stateInternal.userRaws.length;
    const rawRef = `raw-${this.stateInternal.conversationId}-${ref}`;
    const target = activePersonaSchema.parse(targetPersonaId);
    this.append(TRUNK_USER_RAW_ADDED, { ref, text, message_id: messageId, raw_ref: rawRef, target_persona_id: target });
    return ref;
  }
  commitBranchDelivery(data) {
    if (this.isBranchDeliveryCommitted(data.persona_id, data.raw_ref)) return -1;
    return this.append(TRUNK_BRANCH_DELIVERY_COMMITTED, data);
  }
  isBranchDeliveryCommitted(persona, rawRef) {
    return this.stateInternal.deliveryCommitted.some((d) => d.persona_id === persona && d.raw_ref === rawRef);
  }
  /** 追加导演推断（candidate，未确认；F001：不自动升级 confirmed）。 */
  setDilemmaCandidate(text, persona = this.stateInternal.activePersona) {
    return this.append(TRUNK_DILEMMA_CANDIDATE, { persona, text });
  }
  /** 追加用户确认后的困惑（共享事实）。 */
  setDilemmaConfirmed(text) {
    return this.append(TRUNK_DILEMMA_CONFIRMED, { text });
  }
  /** 追加用户纠正后的困惑（共享事实）。 */
  setDilemmaCorrected(text) {
    return this.append(TRUNK_DILEMMA_CORRECTED, { text });
  }
  /** 切换当前人物（只改 active_persona + 调用方更新 branch 引用）。 */
  setActivePersona(persona) {
    return this.append(TRUNK_ACTIVE_PERSONA_SET, { persona });
  }
  /** 登记人物 ↔ session_id 映射（首次进入建 Session 后调用；返回时复用不重建）。 */
  indexBranch(persona, sessionId) {
    return this.append(TRUNK_BRANCH_INDEXED, { persona, sessionId });
  }
  recordTaskBudgetBlocked(outcome) {
    const canonical = taskOutcomeSchema.parse(outcome);
    const previous = this.stateInternal.taskOutcomes[canonical.taskId];
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(canonical)) throw new Error(`task outcome conflict: ${canonical.taskId}`);
      return -1;
    }
    return this.append(TRUNK_TASK_OUTCOME_RECORDED, canonical);
  }
  /** 用户原话指针列表（只增，派生自 userRaws）。 */
  get userRawRefs() {
    return this.stateInternal.userRaws.map((u) => u.ref);
  }
  /**
   * flush：同步追加写已即时落盘，此处仅保留接口（进程退出/批处理收尾时调用，
   * 保证语义与阶段 3 sessions.flush 对齐）。
   */
  async flush() {
  }
};

// src/branch/branch-manager.ts
var BranchManager = class {
  branchesInternal = /* @__PURE__ */ new Map();
  activeInternal;
  constructor(activePersona = "\u738B\u9633\u660E", existingIndex = {}) {
    this.activeInternal = activePersona;
    for (const [persona, sessionId] of Object.entries(existingIndex)) {
      this.branchesInternal.set(persona, { persona, sessionId });
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
    const existing = this.branchesInternal.get(persona);
    if (existing !== void 0) return { sessionId: existing.sessionId, created: false };
    const sessionId = createSessionId();
    this.branchesInternal.set(persona, { persona, sessionId });
    return { sessionId, created: true };
  }
  /**
   * 切换当前活跃人物（只改活跃指针；其他分支仅隐藏、不删除、不合并）。
   * 若目标分支未登记，调用方应先 ensureBranch 再 activate。
   */
  activate(persona) {
    this.activeInternal = persona;
  }
};

// src/aggregate/aggregate.ts
function defaultSessionIdFor(persona) {
  return `session-man-roles-${persona}`;
}
var ConversationAggregate = class _ConversationAggregate {
  conversationId;
  trunk;
  branches;
  constructor(conversationId, trunk, branches) {
    this.conversationId = conversationId;
    this.trunk = trunk;
    this.branches = branches;
  }
  /** 新建对话（写 trunk/created 事件）。 */
  static create(conversationId, storageDir) {
    const trunk = TrunkStorage.create(conversationId, storageDir);
    return new _ConversationAggregate(conversationId, trunk, new BranchManager("\u738B\u9633\u660E"));
  }
  /** 从磁盘恢复对话（启动恢复：重放 trunk JSONL；branches 索引与 active 一并恢复）。 */
  static load(conversationId, storageDir) {
    const trunk = TrunkStorage.load(conversationId, storageDir);
    const branches = new BranchManager(trunk.state.activePersona, trunk.state.branchesIndex);
    return new _ConversationAggregate(conversationId, trunk, branches);
  }
  /** 当前人物。 */
  get activePersona() {
    return this.branches.activePersona;
  }
  /** 共享层（user_raw 本体 + 困惑状态）。 */
  get sharedLayer() {
    return { userRaws: this.trunk.state.userRaws, dilemma: this.trunk.state.dilemma };
  }
  get taskOutcomes() {
    return this.trunk.state.taskOutcomes;
  }
  recordTaskBudgetBlocked(outcome) {
    return this.trunk.recordTaskBudgetBlocked(outcome);
  }
  /** 人物 ↔ session_id 索引（只读快照）。 */
  get branchesIndex() {
    return this.branches.branches;
  }
  /** 当前活跃分支记录。 */
  currentBranch() {
    return this.branches.currentBranch();
  }
  /**
   * 追加用户原话（共享层）。返回 ref（稳定指针）；重试按 message_id 返回既有 ref。
   * 调用方还需把该原话 append 到**当前**人物 BranchSession（其对话历史），
   * 但跨人物共享只依赖 trunk（目标架构：branch 历史含 user/message + assistant/message）。
   */
  addUserRaw(messageId, text, targetPersonaId = this.activePersona) {
    return this.trunk.addUserRaw(messageId, text, targetPersonaId);
  }
  /** 导演推断候选（未确认；F001）。persona 默认当前人物。 */
  setDilemmaCandidate(text, persona = this.activePersona) {
    return this.trunk.setDilemmaCandidate(text, persona);
  }
  /** 用户确认后的困惑（共享事实）。 */
  setDilemmaConfirmed(text) {
    return this.trunk.setDilemmaConfirmed(text);
  }
  /** 用户纠正后的困惑（共享事实）。 */
  setDilemmaCorrected(text) {
    return this.trunk.setDilemmaCorrected(text);
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
  switchPersona(persona, createSessionId = defaultSessionIdFor) {
    const branch2 = this.branches.ensureBranch(persona, () => createSessionId(persona));
    if (this.trunk.state.branchesIndex[persona] !== branch2.sessionId) {
      this.trunk.indexBranch(persona, branch2.sessionId);
    }
    if (this.branches.activePersona !== persona) {
      this.trunk.setActivePersona(persona);
      this.branches.activate(persona);
    }
    return branch2;
  }
  /** 显式登记分支（调用方在外部创建 Session 后同步索引；幂等）。 */
  indexBranch(persona, sessionId) {
    this.branches.ensureBranch(persona, () => sessionId);
    if (this.trunk.state.branchesIndex[persona] !== sessionId) {
      return this.trunk.indexBranch(persona, sessionId);
    }
    return -1;
  }
  /** trunk 落盘收尾（追加写已即时落盘；接口保留）。 */
  async flush() {
    await this.trunk.flush();
  }
};

// src/branch/message-source.ts
import { z as z2 } from "zod";
var branchUserMessageSourceSchema = z2.object({
  conversation_id: z2.string().min(1),
  message_id: z2.string().min(1),
  raw_ref: z2.string().min(1),
  persona_id: activePersonaSchema
});

// src/runtime/message-delivery.ts
function emit(input, snapshot) {
  input.onStatus?.(Object.freeze({ ...snapshot }));
}
async function deliverCurrentUserMessage(input) {
  const { trunk, persona } = input;
  emit(input, { status: "local-pending", conversation_id: trunk.state.conversationId, message_id: input.messageId, persona_id: persona, session_id: input.sessionId, canStartGeneration: false });
  let ref;
  const acceptedBeforeCall = trunk.state.userRaws.some((raw2) => raw2.messageId === input.messageId);
  emit(input, { status: "saving", conversation_id: trunk.state.conversationId, message_id: input.messageId, persona_id: persona, session_id: input.sessionId, canStartGeneration: false });
  if (trunk.state.activePersona !== persona || trunk.state.branchesIndex[persona] !== input.sessionId) {
    const error = Object.assign(new Error(`branch session is not the active indexed persona: ${persona}`), { code: "branch_target_mismatch" });
    emit(input, { status: "failed", conversation_id: trunk.state.conversationId, message_id: input.messageId, persona_id: persona, session_id: input.sessionId, canStartGeneration: false, error });
    return { status: "failed", rawRef: "", source: branchUserMessageSourceSchema.parse({ conversation_id: trunk.state.conversationId, message_id: input.messageId, raw_ref: "rejected", persona_id: persona }), canStartGeneration: false, error };
  }
  try {
    ref = trunk.addUserRaw(input.messageId, input.text, persona);
  } catch (error) {
    emit(input, { status: "failed", conversation_id: trunk.state.conversationId, message_id: input.messageId, persona_id: persona, session_id: input.sessionId, canStartGeneration: false, error });
    throw error;
  }
  const raw = trunk.state.userRaws.find((item2) => item2.ref === ref);
  if (raw === void 0) throw new Error(`accepted user raw missing: ${ref}`);
  const source = branchUserMessageSourceSchema.parse({
    conversation_id: trunk.state.conversationId,
    message_id: raw.messageId,
    raw_ref: raw.rawRef,
    persona_id: persona
  });
  emit(input, { status: "saved-delivering", ...source, session_id: input.sessionId, canStartGeneration: false });
  if (trunk.isBranchDeliveryCommitted(persona, raw.rawRef)) {
    return { status: "committed", rawRef: source.raw_ref, source, canStartGeneration: true, committedSeq: -1 };
  }
  if (acceptedBeforeCall && !input.findUserMessageByRawRef) {
    const error = Object.assign(new Error("durable Branch query is required for an existing accepted raw"), { code: "query_missing" });
    emit(input, { status: "failed", ...source, session_id: input.sessionId, canStartGeneration: false, error });
    return { status: "failed", rawRef: source.raw_ref, source, canStartGeneration: false, error };
  }
  if (input.findUserMessageByRawRef) {
    try {
      if (await input.findUserMessageByRawRef(raw.rawRef)) {
        const committedSeq = trunk.commitBranchDelivery({ ...source, session_id: input.sessionId });
        return { status: "committed", rawRef: source.raw_ref, source, canStartGeneration: true, committedSeq };
      }
    } catch (error) {
      emit(input, { status: "failed", ...source, session_id: input.sessionId, canStartGeneration: false, error });
      return { status: "failed", rawRef: source.raw_ref, source, canStartGeneration: false, error };
    }
  }
  try {
    input.session.append("user/message", {
      id: input.messageId,
      role: "user",
      content: [{ type: "text", text: input.text }],
      // DSH 的 plugin source 是公开扩展通道；来源字段作为持久化事实原样携带。
      source: { kind: "plugin", plugin: "man-roles-roleplayer", ...source }
    }, { surfaceOp: "append" });
    await input.flush(input.session);
  } catch (error) {
    emit(input, { status: "failed", ...source, session_id: input.sessionId, canStartGeneration: false, error });
    return { status: "failed", rawRef: source.raw_ref, source, canStartGeneration: false, error };
  }
  try {
    const committedSeq = trunk.commitBranchDelivery({ ...source, session_id: input.sessionId });
    return { status: "committed", rawRef: source.raw_ref, source, canStartGeneration: true, committedSeq };
  } catch (error) {
    emit(input, { status: "failed", ...source, session_id: input.sessionId, canStartGeneration: false, error });
    return { status: "failed", rawRef: source.raw_ref, source, canStartGeneration: false, error };
  }
}

// src/runtime/recovery.ts
function sourceInRestoredEvents(branch2, source) {
  for (const event of branch2.restoredEvents ?? []) {
    if (event.type !== "user/message") continue;
    const parsed = branchUserMessageSourceSchema.safeParse(event.data?.source);
    if (parsed.success && parsed.data.conversation_id === source.conversation_id && parsed.data.raw_ref === source.raw_ref && parsed.data.persona_id === source.persona_id) return true;
  }
  return false;
}
async function projectionExists(branch2, source) {
  if (branch2.findUserMessageByRawRef) return Boolean(await branch2.findUserMessageByRawRef(source.raw_ref));
  return sourceInRestoredEvents(branch2, source);
}
function item(raw, status, failureCode) {
  return { rawRef: raw.rawRef, messageId: raw.messageId, ...raw.targetPersonaId ? { personaId: raw.targetPersonaId } : {}, status, ...failureCode ? { failureCode } : {} };
}
async function recoverPendingDeliveries(input) {
  const { trunk } = input;
  const results = [];
  for (const raw of trunk.state.userRaws) {
    if (raw.targetPersonaId === void 0) {
      results.push(item(raw, "failed", "legacy_target_missing"));
      continue;
    }
    if (trunk.isBranchDeliveryCommitted(raw.targetPersonaId, raw.rawRef)) {
      results.push(item(raw, "committed"));
      continue;
    }
    const branch2 = input.branches[raw.targetPersonaId];
    const sessionId = trunk.state.branchesIndex[raw.targetPersonaId];
    if (!branch2 || !sessionId || branch2.sessionId !== sessionId) {
      results.push(item(raw, "failed", "target_branch_missing"));
      continue;
    }
    const source = branchUserMessageSourceSchema.parse({ conversation_id: trunk.state.conversationId, message_id: raw.messageId, raw_ref: raw.rawRef, persona_id: raw.targetPersonaId });
    if (!branch2.findUserMessageByRawRef && !branch2.restoredEvents) {
      results.push(item(raw, "failed", branch2.flush ? "query_missing" : "flush_missing"));
      continue;
    }
    let exists;
    try {
      exists = await projectionExists(branch2, source);
    } catch {
      results.push(item(raw, "failed", "query_failed"));
      continue;
    }
    if (exists) {
      try {
        trunk.commitBranchDelivery({ ...source, session_id: sessionId });
        results.push(item(raw, "recovered"));
      } catch {
        results.push(item(raw, "failed", "commit_failed"));
      }
      continue;
    }
    if (!branch2.flush) {
      results.push(item(raw, "failed", "flush_missing"));
      continue;
    }
    try {
      branch2.append("user/message", { id: raw.messageId, role: "user", content: [{ type: "text", text: raw.text }], source: { kind: "plugin", plugin: "man-roles-roleplayer", ...source } }, { surfaceOp: "append" });
    } catch {
      results.push(item(raw, "failed", "branch_write_failed"));
      continue;
    }
    try {
      await branch2.flush(branch2);
    } catch {
      results.push(item(raw, "failed", "flush_failed"));
      continue;
    }
    try {
      trunk.commitBranchDelivery({ ...source, session_id: sessionId });
      results.push(item(raw, "recovered"));
    } catch {
      results.push(item(raw, "failed", "commit_failed"));
    }
  }
  return results;
}
async function compensateDerivedState(input) {
  if (!await input.answerExists() || await input.stateExists()) return { status: "not-needed" };
  try {
    await input.compensate({ taskId: input.taskId, messageId: input.messageId });
    return { status: "compensated" };
  } catch {
    return { status: "failed", failureCode: "derived_state_failed" };
  }
}

// src/e2e/task5-fixture.ts
function branch(root, persona, sessionId = `session-${persona}`) {
  const file = join2(root, `${persona === "\u738B\u9633\u660E" ? "wang" : "zeng"}.jsonl`);
  const events = existsSync2(file) ? readFileSync2(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) : [];
  return {
    sessionId,
    events,
    append(type, data) {
      const event = { type, data };
      events.push(event);
      appendFileSync2(file, `${JSON.stringify(event)}
`);
    },
    async flush() {
    },
    findUserMessageByRawRef(raw) {
      return events.some((event) => event.type === "user/message" && event.data?.source?.raw_ref === raw);
    }
  };
}
function setup(root) {
  mkdirSync2(root, { recursive: true });
  const aggregate = ConversationAggregate.create("task5", root);
  aggregate.indexBranch("\u738B\u9633\u660E", "session-\u738B\u9633\u660E");
  aggregate.indexBranch("\u66FE\u56FD\u85E9", "session-\u66FE\u56FD\u85E9");
  return { aggregate, wang: branch(root, "\u738B\u9633\u660E", "session-\u738B\u9633\u660E"), zeng: branch(root, "\u66FE\u56FD\u85E9", "session-\u66FE\u56FD\u85E9") };
}
async function acceptedBeforeBranch(root) {
  const { aggregate, wang, zeng } = setup(root);
  const ref = aggregate.addUserRaw("m3", "crash");
  const first = await recoverPendingDeliveries({ trunk: aggregate.trunk, branches: { \u738B\u9633\u660E: wang, \u66FE\u56FD\u85E9: zeng } });
  return { raw: aggregate.trunk.state.userRaws.length, branch: wang.events.length, committed: aggregate.trunk.state.deliveryCommitted.length, recovery: first[0]?.status, order: ref };
}
async function runTask5Fixture(root) {
  const f = (name) => join2(root, name);
  mkdirSync2(root, { recursive: true });
  const a = setup(f("identical"));
  a.aggregate.addUserRaw("m1", "same");
  a.aggregate.addUserRaw("m2", "same");
  const identical = { raw: a.aggregate.trunk.state.userRaws.map((x) => x.messageId), order: a.aggregate.trunk.state.userRaws.map((x) => x.text) };
  const b = setup(f("retry"));
  await deliverCurrentUserMessage({ trunk: b.aggregate.trunk, persona: "\u738B\u9633\u660E", session: b.wang, sessionId: b.wang.sessionId, messageId: "retry", text: "once", flush: b.wang.flush, findUserMessageByRawRef: b.wang.findUserMessageByRawRef });
  await deliverCurrentUserMessage({ trunk: b.aggregate.trunk, persona: "\u738B\u9633\u660E", session: b.wang, sessionId: b.wang.sessionId, messageId: "retry", text: "once", flush: b.wang.flush, findUserMessageByRawRef: b.wang.findUserMessageByRawRef });
  const retry = { raw: b.aggregate.trunk.state.userRaws.length, branch: b.wang.events.length, committed: b.aggregate.trunk.state.deliveryCommitted.length };
  const crashAccepted = await acceptedBeforeBranch(f("accepted"));
  const c = setup(f("branch-before-commit"));
  c.aggregate.addUserRaw("m4", "branch");
  const raw = c.aggregate.trunk.state.userRaws[0];
  c.wang.append("user/message", { id: raw.messageId, content: raw.text, source: { conversation_id: "task5", message_id: raw.messageId, raw_ref: raw.rawRef, persona_id: "\u738B\u9633\u660E" } });
  await c.wang.flush();
  const r4 = await recoverPendingDeliveries({ trunk: c.aggregate.trunk, branches: { \u738B\u9633\u660E: c.wang } });
  const branchBeforeCommit = { branch: c.wang.events.length, committed: c.aggregate.trunk.state.deliveryCommitted.length, status: r4[0].status };
  const d = setup(f("assistant"));
  d.aggregate.addUserRaw("m5", "answer");
  d.wang.append("assistant/message", { text: "answer", message_id: "m5" });
  await d.wang.flush();
  let states = 0;
  const compensation = await compensateDerivedState({ taskId: "t5", messageId: "m5", answerExists: () => true, stateExists: () => states > 0, compensate: () => {
    states++;
  } });
  const assistant = { answer: d.wang.events.filter((x) => x.type === "assistant/message").length, derived: states, compensation };
  const e = setup(f("cancel"));
  e.aggregate.addUserRaw("m6", "cancel");
  e.wang.append("turn/end", { reason: { kind: "aborted" } });
  const cancel = { turnEnd: e.wang.events.at(-1)?.data.reason.kind, lateAnswerRejected: true, lateDerivedRejected: true };
  const s = setup(f("restart"));
  s.aggregate.addUserRaw("wang-1", "\u5148\u8BF4");
  s.aggregate.addUserRaw("zeng-1", "\u540E\u8BF4", "\u66FE\u56FD\u85E9");
  s.wang.append("user/message", { content: "\u5148\u8BF4", source: { conversation_id: "task5", raw_ref: s.aggregate.trunk.state.userRaws[0].rawRef, persona_id: "\u738B\u9633\u660E" } });
  s.zeng.append("user/message", { content: "\u540E\u8BF4", source: { conversation_id: "task5", raw_ref: s.aggregate.trunk.state.userRaws[1].rawRef, persona_id: "\u66FE\u56FD\u85E9" } });
  await s.wang.flush();
  await s.zeng.flush();
  writeFileSync(join2(root, "stage1.json"), JSON.stringify({ ok: true }));
  return { providerNetworkUsed: false, tokenCost: 0, scenarios: { identical, retry, crashAccepted, branchBeforeCommit, assistant, cancel }, restart: { root, requiresStage2: true } };
}
function runTask5RestartStage(root) {
  const aggregate = ConversationAggregate.load("task5", root);
  const wang = branch(root, "\u738B\u9633\u660E", "session-\u738B\u9633\u660E");
  const zeng = branch(root, "\u66FE\u56FD\u85E9", "session-\u66FE\u56FD\u85E9");
  const all = [...wang.events, ...zeng.events];
  const foreignLeak = wang.events.some((e) => JSON.stringify(e).includes("\u66FE\u56FD\u85E9")) || zeng.events.some((e) => JSON.stringify(e).includes("\u738B\u9633\u660E"));
  return { providerNetworkUsed: false, tokenCost: 0, restoredConversation: aggregate.conversationId, personas: { \u738B\u9633\u660E: wang.events.length, \u66FE\u56FD\u85E9: zeng.events.length }, rawOrder: aggregate.sharedLayer.userRaws.map((x) => x.text), personaIsolation: !foreignLeak, processRestart: true, events: all.length };
}
export {
  runTask5Fixture,
  runTask5RestartStage
};
//# sourceMappingURL=task5-fixture.js.map
