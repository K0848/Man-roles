/**
 * man-roles-roleplayer —— 导演推断与反馈判定的模型化实现（纯模块，依赖注入 LlmClient）。
 *
 * 阶段 5 生产化目标：
 *  - 导演推断：stub 固定文本 → 真实模型从用户原话提炼 candidate（一行候选表述）；
 *  - 反馈判定（judgeFeedback 生产化）：关键词匹配 → 真实模型语义判断
 *    （输入用户反馈 + 当前 candidate，输出 confirmed/corrected/unconfirmed）。
 * 阶段 3/4 的 `judgeFeedback(feedback)`（domain/dilemma.ts，同步关键词版）保留
 * 作为回归入口与无模型兜底；本模块的 `judgeFeedbackSemantic` 是生产路径。
 *
 * 单测用 MockLlmClient 断言输入输出契约（不消耗真实 API）。
 */
import type { FeedbackVerdict } from '../domain/dilemma.ts'
import type { LlmClient } from './client.ts'

// lib/llm.js 以本文件为 bundle 入口：把纯契约层的值/类型一并 re-export，
// 使单测可从一个产物同时拿到 judge/导演 与 client 契约（estimateRequestTokens、
// runToolLoop 等）。
export { estimateRequestTokens, runToolLoop } from './client.ts'
export type {
  LlmClient,
  LlmRequest,
  LlmResponse,
  LlmTokenUsage,
  LlmMessage,
  ToolSchema,
  LlmToolCall,
  ToolHandler,
  ToolLoopResult,
  ToolTrailEntry,
} from './client.ts'

/** 反馈判定任务指令（模型只输出一个词）。 */
export const JUDGE_SYSTEM_PROMPT = `你是「困惑确认裁判」。给定导演对用户困惑的推断原文与用户的反馈原话，判断用户意图属于哪一类：
- confirmed：用户认可该推断（如「对」「是的」「没错」「就是这样」「我困惑的正是这个」）；
- corrected：用户认为推断不准并提出修正（如「不对」「不是」「其实是」「我真正困惑的是」）；
- unconfirmed：用户既未确认也未纠正（如继续提问、补充背景、表达不确定）。
只输出一个词：confirmed / corrected / unconfirmed。不要输出任何其他内容。`

/** 构造裁判输入消息。 */
export function judgePrompt(feedback: string, candidateText: string): string {
  return `导演推断：${candidateText}\n用户反馈：${feedback}\n\n判定：`
}

/**
 * 从模型输出中解析判定词；无匹配返回 null（调用方回退到用户反馈关键词判定）。
 * 「unconfirmed」含子串「confirmed」：unconfirmed 必须排在前面。
 */
export function parseVerdict(text: string): FeedbackVerdict | null {
  const match = /(unconfirmed|confirmed|corrected)/.exec(text)
  return match === null ? null : (match[1] as FeedbackVerdict)
}

/** 关键词回退判定（与 domain/dilemma.judgeFeedback 同语义；输入为用户反馈原话）。 */
export function keywordFallbackVerdict(feedback: string): FeedbackVerdict {
  if (/(不对|不是|纠正|其实)/.test(feedback)) return 'corrected'
  if (/(对|是的|没错|确认|同意)/.test(feedback)) return 'confirmed'
  return 'unconfirmed'
}

/**
 * 反馈判定（生产路径）：真实模型语义判断；模型输出无法解析时
 * 回退到用户反馈关键词判定（无模型可用时行为与 judgeFeedback 一致）。
 * @param feedback - 用户本轮反馈原话。
 * @param candidateText - 当前导演 candidate（F001：未确认前不得升级）。
 * @param llm - 可注入模型客户端。
 * @returns 判定结果（confirmed / corrected / unconfirmed）。
 */
export async function judgeFeedbackSemantic(
  feedback: string,
  candidateText: string,
  llm: LlmClient,
): Promise<FeedbackVerdict> {
  const response = await llm.complete({
    system: JUDGE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: judgePrompt(feedback, candidateText) }],
    reasoningEffort: 'off',
    maxTokens: 16,
  })
  return parseVerdict(response.text) ?? keywordFallbackVerdict(feedback)
}

/** 导演推断任务指令（一行候选表述，第三人称，不给建议）。 */
export const DIRECTOR_SYSTEM_PROMPT = `你是「困惑导演」。从用户原话中提炼其尚未说清的核心困惑，输出一句候选表述：
- 用第三人称描述用户困惑（不要用「我」冒充用户）；
- 只提炼最核心的一条矛盾或问题；
- 不要给出建议、评价或解决方案；
- 保持陈述句，一句话完成。`

/**
 * 导演推断（生产路径）：真实模型提炼 candidate 文本。
 * @param userRaws - 用户原话（逐字，共享层全部；候选不进入——F001）。
 * @param llm - 可注入模型客户端。
 * @returns candidate 表述（单行文本）。
 */
export async function inferDirectorCandidate(userRaws: string[], llm: LlmClient): Promise<string> {
  const response = await llm.complete({
    system: DIRECTOR_SYSTEM_PROMPT,
    messages: userRaws.map((text) => ({ role: 'user' as const, content: text })),
    reasoningEffort: 'off',
    maxTokens: 128,
  })
  return response.text.trim()
}
