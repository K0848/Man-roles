export const TURN_INTENTS = ['answer', 'clarify', 'await-confirmation', 'reflect', 'offer-controls', 'pause', 'close'] as const
export const DIALOGUE_CONTROLS = ['confirm', 'partial-confirm', 'correct', 'skip', 'continue', 'pause', 'end', 'switch-persona', 'new-dilemma'] as const

export type TurnIntent = typeof TURN_INTENTS[number]
export type DialogueControl = typeof DIALOGUE_CONTROLS[number]

export function isTurnIntent(value: unknown): value is TurnIntent {
  return typeof value === 'string' && (TURN_INTENTS as readonly string[]).includes(value)
}

export function isDialogueControl(value: unknown): value is DialogueControl {
  return typeof value === 'string' && (DIALOGUE_CONTROLS as readonly string[]).includes(value)
}
