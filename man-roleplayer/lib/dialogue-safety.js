// src/dialogue/safety.ts
import { z } from "zod";
var safetyResultSchema = z.object({ disposition: z.enum(["allow", "professional-boundary", "urgent-help", "refuse"]), reason: z.enum(["none", "medical", "mental-health", "legal", "financial", "self-harm", "imminent-danger", "sexual", "illegal-assistance"]), message: z.string() }).strict().superRefine((v, ctx) => {
  const allowed = { allow: ["none"], "professional-boundary": ["medical", "mental-health", "legal", "financial"], "urgent-help": ["self-harm", "imminent-danger"], refuse: ["sexual", "illegal-assistance"] };
  if (!(allowed[v.disposition] ?? []).includes(v.reason)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "safety reason does not match disposition" });
  if (v.disposition === "allow" && v.message !== "") ctx.addIssue({ code: z.ZodIssueCode.custom, message: "allow must have empty message" });
  if (v.disposition !== "allow" && v.message.trim() === "") ctx.addIssue({ code: z.ZodIssueCode.custom, message: "nonallow must have non-empty message" });
});
var urgent = [/(?:我|我现在|我准备|我想要|打算|今晚).{0,16}(?:自杀|自傷|自伤|割腕|结束生命|想死|伤害自己|殺了自己|suicid|kill myself|end my life)/i, /马上伤害某人/i, /(?:有人|他人|对方).{0,16}(?:要杀|杀人|伤害他人|hurt someone).{0,16}(?:现在|马上|现实|imminent|now)/i, /(?:现实危险|imminent danger)/i];
var professional = [["medical", /诊断|治疗方案|用药|药物剂量|medical advice|diagnos/i], ["mental-health", /心理咨询|精神疾病|心理治疗|我是不是.{0,6}(?:抑郁|焦虑|双相)|mental health|therapy/i], ["legal", /法律意见|诉讼|起诉|律师|legal advice|lawsuit/i], ["financial", /投资建议|买股票|收益保证|借贷决策|financial advice|guaranteed return/i]];
var refuse = [["sexual", /露骨色情|色情描写|pornograph|explicit sex/i], ["illegal-assistance", /制毒|炸弹制作|制作炸弹|入侵系统|盗窃方案|违法协助|make a bomb|how to hack/i]];
function deterministicSafetyGate(text) {
  if (urgent.some((r) => r.test(text))) return { disposition: "urgent-help", reason: /自杀|自傷|自伤|伤害自己|殺了自己|suicid/i.test(text) ? "self-harm" : "imminent-danger", message: "\u8FD9\u4EF6\u4E8B\u6D89\u53CA\u73B0\u5B9E\u5B89\u5168\u98CE\u9669\uFF0C\u8BF7\u7ACB\u5373\u8054\u7CFB\u5F53\u5730\u6025\u6551\u670D\u52A1\u3001\u5371\u673A\u70ED\u7EBF\u6216\u8EAB\u8FB9\u53EF\u4FE1\u4EFB\u7684\u4EBA\uFF1B\u672C\u4EA7\u54C1\u4E0D\u4F1A\u4EE5\u4EBA\u7269\u5BF9\u8BDD\u66FF\u4EE3\u7D27\u6025\u652F\u6301\u3002" };
  for (const [reason, pattern] of professional) if (pattern.test(text)) return { disposition: "professional-boundary", reason, message: "\u8FD9\u5C5E\u4E8E\u4E13\u4E1A\u9AD8\u98CE\u9669\u95EE\u9898\uFF0C\u8BF7\u54A8\u8BE2\u5408\u683C\u7684\u4E13\u4E1A\u4EBA\u58EB\uFF1B\u672C\u4EA7\u54C1\u4E0D\u80FD\u63D0\u4F9B\u8BCA\u65AD\u3001\u6CD5\u5F8B\u7ED3\u8BBA\u6216\u8D22\u52A1\u51B3\u7B56\u3002" };
  for (const [reason, pattern] of refuse) if (pattern.test(text)) return { disposition: "refuse", reason, message: "\u62B1\u6B49\uFF0C\u6211\u4E0D\u80FD\u534F\u52A9\u8FD9\u7C7B\u5185\u5BB9\u3002" };
  return { disposition: "allow", reason: "none", message: "" };
}
function mergeSafetyDecision(deterministic, classified) {
  if (deterministic.disposition !== "allow") return deterministic;
  const candidate = { ...classified, message: classified.disposition === "allow" ? "" : classified.disposition === "urgent-help" ? "\u8BF7\u4F18\u5148\u8054\u7CFB\u5F53\u5730\u6025\u6551\u670D\u52A1\u3001\u5371\u673A\u70ED\u7EBF\u6216\u8EAB\u8FB9\u53EF\u4FE1\u4EFB\u7684\u4EBA\u3002" : classified.disposition === "professional-boundary" ? "\u8BF7\u54A8\u8BE2\u5408\u683C\u7684\u4E13\u4E1A\u4EBA\u58EB\uFF1B\u672C\u4EA7\u54C1\u4E0D\u80FD\u66FF\u4EE3\u4E13\u4E1A\u610F\u89C1\u3002" : "\u62B1\u6B49\uFF0C\u6211\u4E0D\u80FD\u534F\u52A9\u8FD9\u7C7B\u5185\u5BB9\u3002" };
  const parsed = safetyResultSchema.safeParse(candidate);
  return parsed.success ? parsed.data : deterministic;
}
export {
  deterministicSafetyGate,
  mergeSafetyDecision,
  safetyResultSchema
};
//# sourceMappingURL=dialogue-safety.js.map
