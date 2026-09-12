import type { UserMessage } from '@deepseek-ai/dsh-session'
export function filterActorStepMessages(messages: readonly UserMessage[]): UserMessage[] {
  return messages.filter((message) => message.source?.kind === 'user' || (message.source?.kind === 'plugin' && message.source.plugin === 'man-roles-roleplayer'))
}
