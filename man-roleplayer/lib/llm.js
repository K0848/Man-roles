// src/context/assemble.ts
function estimateTokens(text) {
  const compact = text.replace(/\s+/g, "");
  const cjk = compact.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const rest = compact.length - cjk;
  return cjk + Math.ceil(rest / 4);
}

// src/llm/client.ts
async function runToolLoop(complete, request, handlers, maxRounds = 3) {
  let messages = [...request.messages];
  const trail = [];
  let response;
  for (let round = 1; round <= maxRounds; round++) {
    response = await complete(request.tools === void 0 ? { ...request, messages } : { ...request, messages, tools: request.tools });
    const calls = response.toolCalls ?? [];
    if (calls.length === 0) {
      return { response, trail, truncated: false };
    }
    const results = [];
    for (const call of calls) {
      const handler = handlers[call.name];
      let result;
      if (handler === void 0) {
        result = { content: `\u672A\u77E5\u5DE5\u5177\uFF1A${call.name}\uFF08\u53EF\u7528\u5DE5\u5177\uFF1A${Object.keys(handlers).join("\u3001")}\uFF09`, isError: true };
      } else {
        try {
          const out = handler(call.arguments);
          result = { content: out.content, isError: out.isError ?? false };
        } catch (error) {
          result = { content: `\u5DE5\u5177\u6267\u884C\u5931\u8D25\uFF1A${String(error)}`, isError: true };
        }
      }
      results.push(result);
      trail.push({
        round,
        name: call.name,
        arguments: call.arguments,
        result: result.content,
        isError: result.isError
      });
    }
    if (results.some((result) => result === void 0)) throw new Error("tool result missing");
    messages = [
      ...messages,
      { role: "assistant", content: "", toolCalls: calls },
      ...calls.map((call, i) => {
        const result = results[i];
        if (result === void 0) throw new Error(`tool result missing for ${call.name}`);
        return { role: "tool", toolCallId: call.id, content: result.content, isError: result.isError };
      })
    ];
  }
  return { response, trail, truncated: true };
}
function estimateRequestTokens(request) {
  return (request.system === void 0 ? 0 : estimateTokens(request.system)) + request.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

// src/llm/judge.ts
var JUDGE_SYSTEM_PROMPT = `\u4F60\u662F\u300C\u56F0\u60D1\u786E\u8BA4\u88C1\u5224\u300D\u3002\u7ED9\u5B9A\u5BFC\u6F14\u5BF9\u7528\u6237\u56F0\u60D1\u7684\u63A8\u65AD\u539F\u6587\u4E0E\u7528\u6237\u7684\u53CD\u9988\u539F\u8BDD\uFF0C\u5224\u65AD\u7528\u6237\u610F\u56FE\u5C5E\u4E8E\u54EA\u4E00\u7C7B\uFF1A
- confirmed\uFF1A\u7528\u6237\u8BA4\u53EF\u8BE5\u63A8\u65AD\uFF08\u5982\u300C\u5BF9\u300D\u300C\u662F\u7684\u300D\u300C\u6CA1\u9519\u300D\u300C\u5C31\u662F\u8FD9\u6837\u300D\u300C\u6211\u56F0\u60D1\u7684\u6B63\u662F\u8FD9\u4E2A\u300D\uFF09\uFF1B
- corrected\uFF1A\u7528\u6237\u8BA4\u4E3A\u63A8\u65AD\u4E0D\u51C6\u5E76\u63D0\u51FA\u4FEE\u6B63\uFF08\u5982\u300C\u4E0D\u5BF9\u300D\u300C\u4E0D\u662F\u300D\u300C\u5176\u5B9E\u662F\u300D\u300C\u6211\u771F\u6B63\u56F0\u60D1\u7684\u662F\u300D\uFF09\uFF1B
- unconfirmed\uFF1A\u7528\u6237\u65E2\u672A\u786E\u8BA4\u4E5F\u672A\u7EA0\u6B63\uFF08\u5982\u7EE7\u7EED\u63D0\u95EE\u3001\u8865\u5145\u80CC\u666F\u3001\u8868\u8FBE\u4E0D\u786E\u5B9A\uFF09\u3002
\u53EA\u8F93\u51FA\u4E00\u4E2A\u8BCD\uFF1Aconfirmed / corrected / unconfirmed\u3002\u4E0D\u8981\u8F93\u51FA\u4EFB\u4F55\u5176\u4ED6\u5185\u5BB9\u3002`;
function judgePrompt(feedback, candidateText) {
  return `\u5BFC\u6F14\u63A8\u65AD\uFF1A${candidateText}
\u7528\u6237\u53CD\u9988\uFF1A${feedback}

\u5224\u5B9A\uFF1A`;
}
function parseVerdict(text) {
  const match = /(unconfirmed|confirmed|corrected)/.exec(text);
  return match === null ? null : match[1];
}
function keywordFallbackVerdict(feedback) {
  if (/(不对|不是|纠正|其实)/.test(feedback)) return "corrected";
  if (/(对|是的|没错|确认|同意)/.test(feedback)) return "confirmed";
  return "unconfirmed";
}
async function judgeFeedbackSemantic(feedback, candidateText, llm) {
  const response = await llm.complete({
    system: JUDGE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: judgePrompt(feedback, candidateText) }],
    reasoningEffort: "off",
    maxTokens: 16
  });
  return parseVerdict(response.text) ?? keywordFallbackVerdict(feedback);
}
var DIRECTOR_SYSTEM_PROMPT = `\u4F60\u662F\u300C\u56F0\u60D1\u5BFC\u6F14\u300D\u3002\u4ECE\u7528\u6237\u539F\u8BDD\u4E2D\u63D0\u70BC\u5176\u5C1A\u672A\u8BF4\u6E05\u7684\u6838\u5FC3\u56F0\u60D1\uFF0C\u8F93\u51FA\u4E00\u53E5\u5019\u9009\u8868\u8FF0\uFF1A
- \u7528\u7B2C\u4E09\u4EBA\u79F0\u63CF\u8FF0\u7528\u6237\u56F0\u60D1\uFF08\u4E0D\u8981\u7528\u300C\u6211\u300D\u5192\u5145\u7528\u6237\uFF09\uFF1B
- \u53EA\u63D0\u70BC\u6700\u6838\u5FC3\u7684\u4E00\u6761\u77DB\u76FE\u6216\u95EE\u9898\uFF1B
- \u4E0D\u8981\u7ED9\u51FA\u5EFA\u8BAE\u3001\u8BC4\u4EF7\u6216\u89E3\u51B3\u65B9\u6848\uFF1B
- \u4FDD\u6301\u9648\u8FF0\u53E5\uFF0C\u4E00\u53E5\u8BDD\u5B8C\u6210\u3002`;
async function inferDirectorCandidate(userRaws, llm) {
  const response = await llm.complete({
    system: DIRECTOR_SYSTEM_PROMPT,
    messages: userRaws.map((text) => ({ role: "user", content: text })),
    reasoningEffort: "off",
    maxTokens: 128
  });
  return response.text.trim();
}
export {
  DIRECTOR_SYSTEM_PROMPT,
  JUDGE_SYSTEM_PROMPT,
  estimateRequestTokens,
  inferDirectorCandidate,
  judgeFeedbackSemantic,
  judgePrompt,
  keywordFallbackVerdict,
  parseVerdict,
  runToolLoop
};
//# sourceMappingURL=llm.js.map
