/**
 * man-roles-roleplayer —— 模型调用层纯契约（零 DSH 运行时依赖，可单测）。
 *
 * 阶段 5 目标：把 stub 替换为真实模型调用，同时保持「模型调用可注入」——
 * 单测用 MockLlmClient（断言输入输出契约），生产用 DshLlmClient
 * （src/llm/dsh-client.ts，封装 DSH 的 `ctx.llm.stream(GenerateOptions)` 接缝）。
 *
 * 调用形态（任务规划：人物回答 / 导演推断 / 反馈判定三种用途共用一次完整调用）：
 *  - system：persona systemPrompt / 任务指令（进 GenerateOptions.system 槽位）；
 *  - messages：对话消息（纯 {role, content}，由实现层转成 DSH Message[]）；
 *  - 返回：最终文本 + 真实 token 使用量（usage，供预算观测）。
 */
import { estimateTokens } from '../context/assemble.ts'

export type LlmMessageRole = 'system' | 'user' | 'assistant' | 'tool'

/**
 * 工具 JSON Schema（与 DSH @deepseek-ai/dsh-llm 的 ToolSchema 结构一致；
 * 在纯契约层自声明，避免纯模块依赖 DSH 包——实现层直接透传）。
 */
export interface ToolSchema {
  name: string
  description: string
  /** JSON Schema 对象（参数校验）。 */
  parameters: Record<string, unknown>
}

/** 模型发出的工具调用（tool-call block 的纯文本形态）。 */
export interface LlmToolCall {
  id: string
  name: string
  /** 原始 JSON 参数字符串（由模型产出）。 */
  arguments: string
}

/** 基础对话消息（system/user/assistant 纯文本）。 */
export interface LlmMessageBase {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 携带工具调用的 assistant 消息（tool-call 循环下一轮的输入）。 */
export interface LlmAssistantToolMessage {
  role: 'assistant'
  content: string
  toolCalls: LlmToolCall[]
}

/** 工具结果消息（映射到 DSH createToolResultMessage；content 为结果文本）。 */
export interface LlmToolResultMessage {
  role: 'tool'
  toolCallId: string
  content: string
  isError?: boolean
}

/** 对话消息（基础形态向后兼容阶段 3-5 单测）。 */
export type LlmMessage = LlmMessageBase | LlmAssistantToolMessage | LlmToolResultMessage

/** 一次模型调用的输入（实现无关的纯文本形态）。 */
export interface LlmRequest {
  /** 系统提示（persona systemPrompt 或任务指令）。 */
  system?: string
  /** 对话消息（有序）。 */
  messages: LlmMessage[]
  /** 工具 JSON Schema（供模型 tool-call；实现层映射到 provider tools 字段）。 */
  tools?: ToolSchema[]
  temperature?: number
  /** 输出上限（token）。 */
  maxTokens?: number
  /**
   * 推理档位（DeepSeek 适配器支持 off/low/high/max）。
   * 默认 off：persona 对话/判定不需要深度推理，省 token 保预算。
   */
  reasoningEffort?: 'off' | 'low' | 'high' | 'max'
  signal?: AbortSignal
}

/** 一次调用的真实 token 使用量（provider 计量；缓存/推理字段可选）。 */
export interface LlmTokenUsage {
  /** 未命中缓存的输入 token。 */
  inputTokens: number
  /** 输出 token。 */
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
}

/** 一次完整调用的结果。 */
export interface LlmResponse {
  /** 最终可见文本（text block 拼接；纯 tool-call 回合可为空串）。 */
  text: string
  /** 真实 token 计量。 */
  usage: LlmTokenUsage
  /** 结束原因（stop / tool-calls / max-tokens / error / aborted）。 */
  finishReason: string
  /** 实际使用的 provider 路由。 */
  provider: string
  /** 实际使用的模型 id。 */
  model: string
  /** 模型发出的工具调用（如有；否则缺省）。 */
  toolCalls?: LlmToolCall[]
}

/** 可注入的模型客户端（生产 = DshLlmClient，测试 = Mock）。 */
export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResponse>
}

/** 工具调用轨迹条目（观察证据：每轮工具名/参数/结果）。 */
export interface ToolTrailEntry {
  round: number
  name: string
  arguments: string
  result: string
  isError: boolean
}

/** 工具循环结果。 */
export interface ToolLoopResult {
  /** 最后一轮（无工具调用）的模型响应。 */
  response: LlmResponse
  /** 全部工具调用轨迹（按执行顺序）。 */
  trail: ToolTrailEntry[]
  /** 达到 maxRounds 仍未收敛（还有工具调用未执行完）。 */
  truncated: boolean
}

/** 工具处理器：输入模型产出的原始参数字符串，返回结果文本 + 是否错误。 */
export type ToolHandler = (argumentsText: string) => { content: string; isError?: boolean }

/**
 * 工具调用循环（纯编排，零 DSH 依赖；complete 可注入 mock）：
 * 1. 携带 tools 调用模型；
 * 2. 若响应含 tool-call → 依次执行处理器（确定性代码），把 assistant 工具调用消息
 *    + tool 结果消息追加进 messages，继续下一轮；
 * 3. 无工具调用 → 返回最终响应。
 * 预算/围栏由处理器实现（tools.ts 的 retrieve/fetch 处理器强制 top-k + 本人物 only）。
 */
export async function runToolLoop(
  complete: (request: LlmRequest) => Promise<LlmResponse>,
  request: LlmRequest,
  handlers: Record<string, ToolHandler>,
  maxRounds = 3,
): Promise<ToolLoopResult> {
  let messages: LlmMessage[] = [...request.messages]
  const trail: ToolTrailEntry[] = []
  let response: LlmResponse | undefined

  for (let round = 1; round <= maxRounds; round++) {
    response = await complete(request.tools === undefined ? { ...request, messages } : { ...request, messages, tools: request.tools })
    const calls = response.toolCalls ?? []
    if (calls.length === 0) {
      return { response, trail, truncated: false }
    }

    // 依次执行本轮全部工具调用，收集结果
    const results: Array<{ content: string; isError: boolean }> = []
    for (const call of calls) {
      const handler = handlers[call.name]
      let result: { content: string; isError: boolean }
      if (handler === undefined) {
        result = { content: `未知工具：${call.name}（可用工具：${Object.keys(handlers).join('、')}）`, isError: true }
      } else {
        try {
          const out = handler(call.arguments)
          result = { content: out.content, isError: out.isError ?? false }
        } catch (error) {
          result = { content: `工具执行失败：${String(error)}`, isError: true }
        }
      }
      results.push(result)
      trail.push({
        round,
        name: call.name,
        arguments: call.arguments,
        result: result.content,
        isError: result.isError,
      })
    }

    // 追加 assistant 工具调用消息 + 各 tool 结果消息，进入下一轮
    if (results.some((result) => result === undefined)) throw new Error('tool result missing')
    messages = [
      ...messages,
      { role: 'assistant', content: '', toolCalls: calls },
      ...calls.map((call, i) => {
        const result = results[i]
        if (result === undefined) throw new Error(`tool result missing for ${call.name}`)
        return { role: 'tool' as const, toolCallId: call.id, content: result.content, isError: result.isError }
      }),
    ]
  }

  return { response: response as LlmResponse, trail, truncated: true }
}

/** 请求文本粗略 token 估算（观测级；真实计量以返回的 usage 为准）。 */
export function estimateRequestTokens(request: LlmRequest): number {
  return (request.system === undefined ? 0 : estimateTokens(request.system))
    + request.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
}
