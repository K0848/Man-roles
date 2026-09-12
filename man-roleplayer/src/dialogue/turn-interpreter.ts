import { z } from 'zod'

export const turnInterpretationSchema = z.object({
  responseNeeds: z.object({ answerKnowledge: z.boolean(), acknowledgeEmotion: z.boolean(), clarify: z.boolean(), proposeCandidate: z.boolean() }).strict(),
  safetyEscalation: z.enum(['none', 'professional-boundary', 'urgent-help', 'refuse']),
  feedback: z.enum(['none','confirm','partial-confirm','correct','reject','skip','pause','end','continue']),
}).strict()
export type TurnInterpretation = z.infer<typeof turnInterpretationSchema>

/** Deterministic fallback used after the semantic adapter fails. */
export function interpretTurn(raw: string): TurnInterpretation {
  const text = raw.trim()
  const knowledge = /知行|思想|原话|事迹|何谓|怎么理解/.test(text)
  const emotion = /害怕|担心|焦虑|难过|不安|痛苦|犹豫/.test(text)
  const control = /暂停|先到这里/.test(text) ? 'pause' : /结束|再见/.test(text) ? 'end' : 'none'
  return { responseNeeds: { answerKnowledge: knowledge, acknowledgeEmotion: emotion, clarify: !knowledge || emotion, proposeCandidate: (emotion || !knowledge) && text.length > 8 }, safetyEscalation: 'none', feedback: control }
}
