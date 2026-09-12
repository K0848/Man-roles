import { z } from 'zod'
import { DIALOGUE_CONTROLS, TURN_INTENTS, type DialogueControl, type TurnIntent } from './public-contract.ts'

export const taskModeSchema = z.enum(['knowledge', 'dilemma', 'review'])
export const safetyDispositionSchema = z.enum(['allow', 'professional-boundary', 'urgent-help', 'refuse'])
export const safetyReasonSchema = z.enum(['none', 'medical', 'mental-health', 'legal', 'financial', 'self-harm', 'imminent-danger', 'sexual', 'illegal-assistance'])
export const dialoguePhaseSchema = z.enum(['responding', 'clarifying', 'awaiting-confirmation', 'reflecting', 'action-defined', 'paused', 'closed'])
export const feedbackKindSchema = z.enum(['none', 'confirm', 'partial-confirm', 'correct', 'reject', 'new-information', 'reality-changed', 'disagree-persona', 'not-helpful', 'question-evidence', 'action-feedback', 'skip', 'continue', 'pause', 'end', 'unclear'])
export const turnIntentSchema = z.enum(TURN_INTENTS)
export const dialogueControlSchema = z.enum(DIALOGUE_CONTROLS)
export const turnControlDecisionSchema = z.object({
  safety: safetyDispositionSchema, safetyReason: safetyReasonSchema, taskMode: taskModeSchema,
  confidence: z.enum(['high', 'low']), emotionPriority: z.boolean(), feedbackKind: feedbackKindSchema,
  independentNewDilemma: z.boolean(),
}).strict()
export type TaskMode = z.infer<typeof taskModeSchema>
export type SafetyDisposition = z.infer<typeof safetyDispositionSchema>
export type SafetyReason = z.infer<typeof safetyReasonSchema>
export type DialoguePhase = z.infer<typeof dialoguePhaseSchema>
export type FeedbackKind = z.infer<typeof feedbackKindSchema>
export type TurnControlDecision = z.infer<typeof turnControlDecisionSchema>
export type { TurnInterpretation } from './turn-interpreter.ts'

export const defaultControlDecision = (): TurnControlDecision => ({ safety: 'allow', safetyReason: 'none', taskMode: 'dilemma', confidence: 'low', emotionPriority: false, feedbackKind: 'unclear', independentNewDilemma: false })

/** `maxQuestions` is legacy-policy compatibility only. When omitted, relevance
 * plus turn/token/payload budgets govern clarification depth rather than a
 * product question-count gate. */
export interface TurnInstruction { intent: TurnIntent; maxQuestions?: number; allowedControls: DialogueControl[]; shouldRunDirector: boolean; shouldOfferNewConversation: boolean }
