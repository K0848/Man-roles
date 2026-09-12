// src/llm/dsh-client.ts
import {
  BlockAssembler,
  createAssistantMessage,
  createToolResultMessage,
  createUserMessage
} from "@deepseek-ai/dsh-llm";
var DEFAULT_PROVIDER = "deepseek-official";
var DEFAULT_MODEL = "deepseek-v4-flash";
var LlmCallError = class extends Error {
  constructor(message, kind, failureCode, failureMessage) {
    super(message);
    this.kind = kind;
    this.failureCode = failureCode;
    this.failureMessage = failureMessage;
    this.name = "LlmCallError";
  }
  kind;
  failureCode;
  failureMessage;
};
var DshLlmClient = class {
  constructor(options) {
    this.options = options;
  }
  options;
  async complete(request) {
    const provider = this.options.provider ?? DEFAULT_PROVIDER;
    const model = this.options.model ?? DEFAULT_MODEL;
    const messages = request.messages.map((m) => toDshMessage(m, provider, model));
    const options = {
      provider,
      model,
      messages,
      reasoningEffort: request.reasoningEffort ?? this.options.reasoningEffort ?? "off",
      ...request.system === void 0 ? {} : { system: request.system },
      ...request.tools === void 0 ? {} : { tools: request.tools },
      ...request.temperature === void 0 ? {} : { temperature: request.temperature },
      ...request.maxTokens === void 0 ? {} : { maxTokens: request.maxTokens },
      ...request.signal === void 0 ? {} : { signal: request.signal }
    };
    const assembler = new BlockAssembler();
    for await (const chunk of this.options.stream(options)) {
      assembler.push(chunk);
    }
    const finish = assembler.finish;
    if (finish.kind === "error" || finish.kind === "aborted") {
      throw new LlmCallError(
        `llm call ${finish.kind}: ${finish.failure.code} ${finish.failure.message}`,
        finish.kind,
        finish.failure.code,
        finish.failure.message
      );
    }
    const blocks = assembler.blocks();
    const text = blocks.filter((block) => block.type === "text").map((block) => block.text).join("");
    const toolCalls = blocks.filter((block) => block.type === "tool-call").map((block) => ({ id: block.id, name: block.name, arguments: block.arguments }));
    const usage = assembler.usage;
    return {
      text,
      usage: {
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        ...usage?.cacheReadTokens === void 0 ? {} : { cacheReadTokens: usage.cacheReadTokens },
        ...usage?.cacheWriteTokens === void 0 ? {} : { cacheWriteTokens: usage.cacheWriteTokens },
        ...usage?.reasoningTokens === void 0 ? {} : { reasoningTokens: usage.reasoningTokens }
      },
      finishReason: finish.kind,
      provider,
      model,
      ...toolCalls.length > 0 ? { toolCalls } : {}
    };
  }
};
function toDshMessage(m, provider, model) {
  if (m.role === "tool") {
    return createToolResultMessage({
      callId: m.toolCallId,
      content: [{ type: "text", text: m.content }],
      isError: m.isError ?? false
    });
  }
  if (m.role === "assistant" && "toolCalls" in m && m.toolCalls.length > 0) {
    return createAssistantMessage({
      content: [
        ...m.content !== "" ? [{ type: "text", text: m.content }] : [],
        ...m.toolCalls.map((tc) => ({
          type: "tool-call",
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments
        }))
      ],
      source: { provider, model }
    });
  }
  if (m.role === "assistant") {
    return createAssistantMessage({
      content: [{ type: "text", text: m.content }],
      source: { provider, model }
    });
  }
  return createUserMessage({
    content: [{ type: "text", text: m.content }],
    source: { kind: "user" }
  });
}
export {
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  DshLlmClient,
  LlmCallError
};
//# sourceMappingURL=dsh-client.js.map
