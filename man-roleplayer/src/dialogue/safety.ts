import { z } from 'zod'
import type { SafetyReason } from './types.ts'
export const safetyResultSchema = z.object({ disposition: z.enum(['allow', 'professional-boundary', 'urgent-help', 'refuse']), reason: z.enum(['none', 'medical', 'mental-health', 'legal', 'financial', 'self-harm', 'imminent-danger', 'sexual', 'illegal-assistance']), message: z.string() }).strict().superRefine((v, ctx) => {
  const allowed: Record<string, string[]> = { allow: ['none'], 'professional-boundary': ['medical', 'mental-health', 'legal', 'financial'], 'urgent-help': ['self-harm', 'imminent-danger'], refuse: ['sexual', 'illegal-assistance'] }
  if (!(allowed[v.disposition] ?? []).includes(v.reason)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'safety reason does not match disposition' })
  if (v.disposition === 'allow' && v.message !== '') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'allow must have empty message' })
  if (v.disposition !== 'allow' && v.message.trim() === '') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'nonallow must have non-empty message' })
})
export type SafetyResult = z.infer<typeof safetyResultSchema>
// 只拦截当前、明确的风险表达；学术引用或泛泛讨论不应被误判为危机。
const urgent = [/(?:我|我现在|我准备|我想要|打算|今晚).{0,16}(?:自杀|自傷|自伤|割腕|结束生命|想死|伤害自己|殺了自己|suicid|kill myself|end my life)/i, /马上伤害某人/i, /(?:有人|他人|对方).{0,16}(?:要杀|杀人|伤害他人|hurt someone).{0,16}(?:现在|马上|现实|imminent|now)/i, /(?:现实危险|imminent danger)/i]
const professional: Array<[SafetyReason, RegExp]> = [['medical', /诊断|治疗方案|用药|药物剂量|medical advice|diagnos/i], ['mental-health', /心理咨询|精神疾病|心理治疗|我是不是.{0,6}(?:抑郁|焦虑|双相)|mental health|therapy/i], ['legal', /法律意见|诉讼|起诉|律师|legal advice|lawsuit/i], ['financial', /投资建议|买股票|收益保证|借贷决策|financial advice|guaranteed return/i]]
const refuse: Array<[SafetyReason, RegExp]> = [['sexual', /露骨色情|色情描写|pornograph|explicit sex/i], ['illegal-assistance', /制毒|炸弹制作|制作炸弹|入侵系统|盗窃方案|违法协助|make a bomb|how to hack/i]]
export function deterministicSafetyGate(text: string): SafetyResult {
  if (urgent.some((r) => r.test(text))) return { disposition: 'urgent-help', reason: /自杀|自傷|自伤|伤害自己|殺了自己|suicid/i.test(text) ? 'self-harm' : 'imminent-danger', message: '这件事涉及现实安全风险，请立即联系当地急救服务、危机热线或身边可信任的人；本产品不会以人物对话替代紧急支持。' }
  for (const [reason, pattern] of professional) if (pattern.test(text)) return { disposition: 'professional-boundary', reason, message: '这属于专业高风险问题，请咨询合格的专业人士；本产品不能提供诊断、法律结论或财务决策。' }
  for (const [reason, pattern] of refuse) if (pattern.test(text)) return { disposition: 'refuse', reason, message: '抱歉，我不能协助这类内容。' }
  return { disposition: 'allow', reason: 'none', message: '' }
}
export function mergeSafetyDecision(deterministic: SafetyResult, classified: SafetyResult | Pick<SafetyResult, 'disposition' | 'reason'>): SafetyResult {
  if (deterministic.disposition !== 'allow') return deterministic
  const candidate = { ...classified, message: classified.disposition === 'allow' ? '' : classified.disposition === 'urgent-help' ? '请优先联系当地急救服务、危机热线或身边可信任的人。' : classified.disposition === 'professional-boundary' ? '请咨询合格的专业人士；本产品不能替代专业意见。' : '抱歉，我不能协助这类内容。' }
  const parsed = safetyResultSchema.safeParse(candidate)
  return parsed.success ? parsed.data : deterministic
}
