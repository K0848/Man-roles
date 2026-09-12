import type { DialoguePhase, TurnControlDecision, TurnInstruction } from './types.ts'
export function decideTurn(input: Pick<TurnControlDecision, 'taskMode' | 'feedbackKind'> & { phase: DialoguePhase; hasCandidate?: boolean; hasConfirmed?: boolean; noProgressCount?: number; emotionPriority?: boolean; independentNewDilemma?: boolean }): TurnInstruction {
  const { taskMode, feedbackKind, phase, hasCandidate = false, hasConfirmed = false, noProgressCount = 0, emotionPriority = false, independentNewDilemma = false } = input
  if (feedbackKind === 'end' || phase === 'closed') return { intent: 'close', maxQuestions: 0, allowedControls: [], shouldRunDirector: false, shouldOfferNewConversation: false }
  if (feedbackKind === 'pause' || phase === 'paused') return { intent: 'pause', maxQuestions: 0, allowedControls: ['continue', 'end'], shouldRunDirector: false, shouldOfferNewConversation: false }
  if (noProgressCount >= 2) return { intent: 'offer-controls', maxQuestions: 0, allowedControls: ['correct', 'skip', 'switch-persona', 'end'], shouldRunDirector: false, shouldOfferNewConversation: false }
  if (taskMode === 'knowledge') return { intent: 'answer', maxQuestions: 0, allowedControls: ['continue', 'end'], shouldRunDirector: false, shouldOfferNewConversation: false }
  if (independentNewDilemma) return { intent: 'offer-controls', maxQuestions: 0, allowedControls: ['new-dilemma', 'continue', 'end'], shouldRunDirector: false, shouldOfferNewConversation: true }
  if (taskMode === 'review' || feedbackKind === 'reality-changed') return { intent: 'reflect', maxQuestions: 1, allowedControls: ['continue', 'correct', 'end'], shouldRunDirector: false, shouldOfferNewConversation: false }
  if (hasCandidate && feedbackKind === 'none') return { intent: 'await-confirmation', maxQuestions: 0, allowedControls: ['confirm', 'partial-confirm', 'correct', 'skip', 'end'], shouldRunDirector: false, shouldOfferNewConversation: false }
  // 反馈已提交后进入回应/反思，不再次把用户置于 awaiting 状态。
  if (feedbackKind === 'confirm' || feedbackKind === 'partial-confirm' || feedbackKind === 'correct') return { intent: 'reflect', maxQuestions: 0, allowedControls: ['continue', 'end'], shouldRunDirector: false, shouldOfferNewConversation: false }
  if (feedbackKind === 'skip') return { intent: 'clarify', maxQuestions: emotionPriority ? 1 : 2, allowedControls: ['continue', 'pause', 'end'], shouldRunDirector: false, shouldOfferNewConversation: false }
  const allowedControls = ['continue', 'skip', 'pause', 'end'] as const
  return { intent: 'clarify', maxQuestions: emotionPriority ? 1 : 2, allowedControls: [...allowedControls], shouldRunDirector: !hasCandidate && !hasConfirmed, shouldOfferNewConversation: false }
}
