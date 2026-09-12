/**
 * man-roles-roleplayer —— DSH 接缝实现：把 LlmClient 契约映射到
 * `ctx.llm.stream(GenerateOptions)`（@deepseek-ai/dsh-llm 的 LlmRuntime 服务）。
 *
 * 阶段 5 第一步验证的接缝形态（记录于 findings）：
 *  - 入口：`ctx.llm.stream(options: GenerateOptions): AsyncIterable<StreamChunk>`；
 *  - 块组装：`BlockAssembler`（push 每个 chunk → blocks()/usage/finish）；
 *  - token 计量：`usage` chunk（TokenUsage：inputTokens/outputTokens/
 *    cacheReadTokens/cacheWriteTokens/reasoningTokens）；
 *  - provider 路由：`deepseek-official`（dsh-base 装配的 llm-deepseek 适配器
 *    注册，凭据经 $DSH_HOME/.credentials.yaml 的 DEEPSEEK_API_KEY 每请求解析）；
 *  - 推理档位：GenerateOptions.reasoningEffort，默认 off（省 token 保预算）。
 *
 * 运行时依赖 @deepseek-ai/dsh-llm 保持 external（package.json 不声明，
 * 经 $DSH_HOME/profiles/node_modules 安装回退解析，见 findings 阶段 2）。
 * 本模块只被插件运行时（e2e/生产装配）引用，单元测试不 import。
 */
import {
  BlockAssembler,
  createAssistantMessage,
  createToolResultMessage,
  createUserMessage,
} from '@deepseek-ai/dsh-llm'
import type { CallId, GenerateOptions, Message, ReasoningEffortId, StreamChunk } from '@deepseek-ai/dsh-llm'
import type { LlmClient, LlmMessage, LlmRequest, LlmResponse } from './client.ts'

/** 默认路由（dsh-base 装配的 agent-default-model 同路由，见 settings.yaml）。 */
export const DEFAULT_PROVIDER = 'deepseek-official'
export const DEFAULT_MODEL = 'deepseek-v4-flash'

export interface DshLlmClientOptions {
  /**
   * 模型调用入口。生产传 `(options) => ctx.llm.stream(options)`；
   * 结构类型便于测试/替换（只要求 stream(GenerateOptions) 契约）。
   */
  stream: (options: GenerateOptions) => AsyncIterable<StreamChunk>
  /** provider 路由（默认 deepseek-official）。 */
  provider?: string
  /** 模型 id（默认 deepseek-v4-flash）。 */
  model?: string
  /** 推理档位默认（默认 off；可被单次请求覆盖）。 */
  reasoningEffort?: 'off' | 'low' | 'high' | 'max'
}

/** 一次调用失败的统一异常（带 finish failure 事实）。 */
export class LlmCallError extends Error {
  constructor(
    message: string,
    readonly kind: 'error' | 'aborted',
    readonly failureCode: string,
    readonly failureMessage: string,
  ) {
    super(message)
    this.name = 'LlmCallError'
  }
}

/**
 * DshLlmClient：一次 complete() = 一次 `ctx.llm.stream` 全量消费。
 * 返回最终文本 + 真实 token 使用量（BlockAssembler.usage）。
 */
export class DshLlmClient implements LlmClient {
  constructor(private readonly options: DshLlmClientOptions) {}

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const provider = this.options.provider ?? DEFAULT_PROVIDER
    const model = this.options.model ?? DEFAULT_MODEL
    const messages: Message[] = request.messages.map((m) => toDshMessage(m, provider, model))
    const options: GenerateOptions = {
      provider,
      model,
      messages,
      reasoningEffort: (request.reasoningEffort ?? this.options.reasoningEffort ?? 'off') as ReasoningEffortId,
      ...request.system === undefined ? {} : { system: request.system },
      ...request.tools === undefined ? {} : { tools: request.tools },
      ...request.temperature === undefined ? {} : { temperature: request.temperature },
      ...request.maxTokens === undefined ? {} : { maxTokens: request.maxTokens },
      ...request.signal === undefined ? {} : { signal: request.signal },
    }

    const assembler = new BlockAssembler()
    for await (const chunk of this.options.stream(options)) {
      assembler.push(chunk)
    }

    const finish = assembler.finish
    if (finish.kind === 'error' || finish.kind === 'aborted') {
      throw new LlmCallError(
        `llm call ${finish.kind}: ${finish.failure.code} ${finish.failure.message}`,
        finish.kind,
        finish.failure.code,
        finish.failure.message,
      )
    }

    const blocks = assembler.blocks()
    const text = blocks
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('')
    const toolCalls = blocks
      .filter((block): block is { type: 'tool-call'; id: string; name: string; arguments: string } => block.type === 'tool-call')
      .map((block) => ({ id: block.id, name: block.name, arguments: block.arguments }))
    const usage = assembler.usage
    return {
      text,
      usage: {
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        ...usage?.cacheReadTokens === undefined ? {} : { cacheReadTokens: usage.cacheReadTokens },
        ...usage?.cacheWriteTokens === undefined ? {} : { cacheWriteTokens: usage.cacheWriteTokens },
        ...usage?.reasoningTokens === undefined ? {} : { reasoningTokens: usage.reasoningTokens },
      },
      finishReason: finish.kind,
      provider,
      model,
      ...toolCalls.length > 0 ? { toolCalls } : {},
    }
  }
}

/** 把纯契约消息映射为 DSH Message（tool 结果 → createToolResultMessage；assistant 工具调用 → tool-call blocks）。 */
function toDshMessage(m: LlmMessage, provider: string, model: string): Message {
  if (m.role === 'tool') {
    return createToolResultMessage({
      callId: m.toolCallId as CallId,
      content: [{ type: 'text', text: m.content }],
      isError: m.isError ?? false,
    })
  }
  if (m.role === 'assistant' && 'toolCalls' in m && m.toolCalls.length > 0) {
    return createAssistantMessage({
      content: [
        ...(m.content !== '' ? [{ type: 'text' as const, text: m.content }] : []),
        ...m.toolCalls.map((tc) => ({
          type: 'tool-call' as const,
          id: tc.id as CallId,
          name: tc.name,
          arguments: tc.arguments,
        })),
      ],
      source: { provider, model },
    })
  }
  if (m.role === 'assistant') {
    return createAssistantMessage({
      content: [{ type: 'text', text: m.content }],
      source: { provider, model },
    })
  }
  return createUserMessage({
    content: [{ type: 'text', text: m.content }],
    source: { kind: 'user' },
  })
}
