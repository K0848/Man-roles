import { branchUserMessageFromData, branchUserMessageSourceFromData } from '../branch/message-source.ts'
import { projectActorReply } from '../runtime/actor-reply-projection.ts'
export type BranchHistoryEvent = { type: string; seq?: number; data?: unknown }
function isRecord(value: unknown): value is Record<string, any> { return typeof value === 'object' && value !== null }
function userText(data: unknown): string | undefined {
  const message = branchUserMessageFromData(data)
  if (!message || !Array.isArray(message.content)) return undefined
  const text = message.content
    .filter(block => isRecord(block) && block.type === 'text' && typeof block.text === 'string')
    .map(block => String(block.text))
    .join('')
  return text || undefined
}
function userMessageId(data: unknown): string | undefined {
  const message = branchUserMessageFromData(data)
  if (!message) return undefined
  if (typeof message.id === 'string') return message.id
  const source = branchUserMessageSourceFromData(message)
  return isRecord(source) && typeof source.message_id === 'string' ? source.message_id : undefined
}
export function branchHistory(events: readonly BranchHistoryEvent[]): string[] { const lines: string[] = []; let activeTurn: number | undefined; for (const event of events) { if (event.type === 'turn/start' && isRecord(event.data) && typeof event.data.turn === 'number') { activeTurn = event.data.turn; continue } if (event.type === 'user/message') { const text = userText(event.data); if (text) lines.push(text) } if (event.type === 'turn/end' && activeTurn !== undefined) { const reply = projectActorReply(events, activeTurn); if (reply) lines.push(reply.reply); activeTurn = undefined } } return lines }
export function verifiedReplyForMessage(events: readonly BranchHistoryEvent[], messageId: string) { let activeTurn: number | undefined; let targetTurn: number | undefined; for (const event of events) { if (event.type === 'turn/start' && isRecord(event.data) && typeof event.data.turn === 'number') activeTurn = event.data.turn; if (event.type === 'user/message' && userMessageId(event.data) === messageId) targetTurn = activeTurn; if (event.type === 'turn/end' && activeTurn !== undefined) activeTurn = undefined } return targetTurn === undefined ? undefined : projectActorReply(events, targetTurn) }
