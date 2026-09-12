import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { parseActorReplyMeta, type ActorReplyResult } from '../runtime/actor-reply-projection.ts'

declare module '@deepseek-ai/dsh-client-ui-conversation/client' { interface ChatNodeDataMap { 'man-roles-actor-reply': ActorReplyResult } }

interface ReplyState {
  turn: number
  step: number
  callId: string
  callSeq: number
  result?: ActorReplyResult
  resultSeq?: number
}

function eventData(event: any): any { return event.data }
function matchReply(event: any) {
  if (event.type !== 'tool/result' || event.surfaceOp !== 'append') return null
  const meta = parseActorReplyMeta(eventData(event)?.meta)
  const callId = eventData(event)?.message?.source?.callId
  return meta && typeof callId === 'string' ? { meta, callId } : null
}

/** 只把真实 submit 调用及其通过证据门的结果投影为人物回答节点。 */
export const actorReplyConversationNodeDefinition: ConversationNodeDefinition<ReplyState> = {
  kind: 'man-roles-actor-reply',
  target: 'chat',
  match: event => {
    const data: any = eventData(event)
    if (event.type === 'tool/call' && data?.name === 'submit_actor_reply' && typeof data.callId === 'string') {
      return { id: data.callId, role: 'start' }
    }
    const matched = matchReply(event)
    return matched ? { id: matched.callId, role: 'update' } : null
  },
  start: (_context, match) => {
    const data: any = eventData(match.event)
    if (match.event.type !== 'tool/call' || data?.name !== 'submit_actor_reply' || typeof data.callId !== 'string') {
      throw new Error('actor reply node start requires submit_actor_reply tool/call')
    }
    return { turn: data.turn, step: data.step, callId: data.callId, callSeq: match.event.seq }
  },
  update: (context, match) => {
    const matched = matchReply(match.event)
    return matched ? { ...context.state, result: matched.meta, resultSeq: match.event.seq } : context.state
  },
  publication: () => 'immediate',
  buildViewNode: context => context.state?.result === undefined ? null : {
    key: context.key,
    kind: 'man-roles-actor-reply',
    id: context.id,
    target: 'chat',
    anchorSeq: context.state.resultSeq ?? context.state.callSeq,
    location: context.start?.location ?? { kind: 'unresolved' },
    visibility: 'visible',
    data: context.state.result,
  },
}
