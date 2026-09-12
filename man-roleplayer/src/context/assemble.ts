/**
 * man-roles-roleplayer —— 下一轮上下文装配（纯 TS，F005）。
 *
 * 固定上下文层次（F005：按优先级分级加载并观测成本）：
 *  1. system：当前人物（角色设定）；
 *  2. 已确认/纠正的困惑状态（用户已确认的事实，最高优先级——先于新一轮输入）；
 *  3. 用户原话（user_raw，逐字，不被任何摘要替代）；
 *  4. 当前人物自己的分支历史（最近 N 条，供延续；**只含当前人物分支**——
 *     隔离由调用方保证只传入 currentBranch 历史，结构性不接触他人回答）。
 *
 * 阶段 4 扩展：`assembleBranchTurn` 支持共享层（多条 user_raw + trunk 困惑状态）
 * 与分支历史（BranchSession 的 user/message + assistant/message）；`assembleNextTurn`
 * 保留为单轮便捷入口（委托实现，阶段 3 单测回归兼容）。
 *
 * token 预算观测：中文字符按 1 字 ≈ 1 token 粗略估算（阶段 3 观测级，
 * 不引入真实 tokenizer；生产可替换为真实计量）。输出 used/limit/ratio 供调用方记录。
 */
import type { DilemmaState, TrunkUserRaw } from '../domain/schema.ts'
import { selectHistory } from './select-history.ts'

/** 人物规格；具体人物由内容 artifact 提供。 */
export interface PersonaSpec {
  id: string
  name: string
  /** 角色设定（简短；生产由事迹库/摘要装配）。 */
  systemPrompt: string
}

/** 装配输入（单轮便捷入口，阶段 3 兼容）。 */
export interface AssembleInput {
  persona: PersonaSpec
  /** 用户原话（逐字，来自 user/message content）。 */
  userRaw: string
  /** 当前人物上一轮回答（assistant/message text）。 */
  lastReply: string
  /** 已确认/纠正的困惑状态（candidate 不进入上下文，避免把推断当事实——F001）。 */
  dilemma: DilemmaState
}

/** 分支装配输入（阶段 4：共享层 + 分支历史）。 */
export interface BranchTurnInput {
  persona: PersonaSpec
  /** TrunkStorage 共享层：全部用户原话（逐字）+ 困惑状态。 */
  sharedLayer: {
    userRaws: TrunkUserRaw[]
    dilemma: DilemmaState
  }
  /** 当前人物自己的分支历史（时间序；user/message + assistant/message 文本）。 */
  branchHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  /** 分支历史最多取最近 N 条（默认 4）。 */
  maxHistoryTurns?: number
  /** v2 selector input; omitted by legacy callers. */
  historyBudgetTokens?: number
}

/** 装配输出。 */
export interface AssembleOutput {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  /** 粗略 token 估算（1 中文字符 ≈ 1 token）。 */
  tokenEstimate: number
  budget: { used: number; limit: number; ratio: number }
}

/** 预算上限（阶段 3 观测用；生产按模型窗口配置）。 */
export const CONTEXT_TOKEN_LIMIT = 4000

/** 粗略估算 token 数：非空白字符数（中文按字，英文按词近似）。 */
export function estimateTokens(text: string): number {
  const compact = text.replace(/\s+/g, '')
  // 中文字符按 1 token；其余字符按 4 字符 ≈ 1 token 粗估。
  const cjk = compact.match(/[\u4e00-\u9fff]/g)?.length ?? 0
  const rest = compact.length - cjk
  return cjk + Math.ceil(rest / 4)
}

/**
 * 装配下一轮模型输入（阶段 4 核心）：当前人物 persona + 共享层
 * （全部 user_raw + confirmed/corrected；candidate 不进——F001）+ 当前人物分支历史。
 * 隔离红线：branchHistory 必须只来自当前人物 BranchSession——本函数只按传入数组
 * 装配，不接触任何其他分支数据（结构性保证）。
 */
export function assembleBranchTurn(input: BranchTurnInput): AssembleOutput {
  const messages: AssembleOutput['messages'] = []

  // 1. 人物 system
  messages.push({ role: 'system', content: input.persona.systemPrompt })

  // 2. 已确认/纠正的困惑状态（F001：candidate 不进上下文；只有 confirmed/corrected 才作为事实）
  const dilemma = input.sharedLayer.dilemma
  if (dilemma.phase === 'confirmed' && dilemma.confirmedText !== null) {
    messages.push({
      role: 'user',
      content: `【已确认的困惑】${dilemma.confirmedText}（这是用户已经确认的理解，回答时应以此为前提）`,
    })
  } else if (dilemma.phase === 'corrected' && dilemma.correctedText !== null) {
    messages.push({
      role: 'user',
      content: `【用户纠正后的困惑】${dilemma.correctedText}（以此为准，忽略此前推断）`,
    })
  }

  // 3. 用户原话（全部，逐字，按 ref 顺序；不可摘要）
  const raws = input.historyBudgetTokens === undefined ? input.sharedLayer.userRaws : selectHistory({ currentRaw: input.sharedLayer.userRaws.at(-1)!, candidates: input.sharedLayer.userRaws, confirmedRawRefs: dilemma.phase === 'confirmed' ? input.sharedLayer.userRaws.map(x => x.rawRef) : [], personaId: input.persona.id, budgetTokens: input.historyBudgetTokens }).selected
  for (const raw of raws) {
    messages.push({ role: 'user', content: raw.text })
  }

  // 4. 当前人物自己的分支历史（最近 N 条，供延续）
  const history = input.branchHistory.slice(-(input.maxHistoryTurns ?? 4))
  for (const h of history) {
    messages.push({ role: h.role, content: h.content })
  }

  const used = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
  const ratio = used / CONTEXT_TOKEN_LIMIT
  return { messages, tokenEstimate: used, budget: { used, limit: CONTEXT_TOKEN_LIMIT, ratio } }
}

/**
 * 装配下一轮模型输入（单轮便捷入口，阶段 3 兼容）：委托 assembleBranchTurn。
 * userRaw → 单条共享层原话；lastReply → 单条分支历史。
 */
export function assembleNextTurn(input: AssembleInput): AssembleOutput {
  const history = input.lastReply === '' ? [] : [{ role: 'assistant' as const, content: input.lastReply }]
  return assembleBranchTurn({
    persona: input.persona,
    sharedLayer: {
      userRaws: [{ ref: 0, text: input.userRaw, messageId: 'fixture-message-0', rawRef: 'fixture-raw-0' }],
      dilemma: input.dilemma,
    },
    branchHistory: history,
    maxHistoryTurns: 1,
  })
}
