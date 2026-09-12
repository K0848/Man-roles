import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ChatNodeViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { createElement } from 'react'
import { actorReplyConversationNodeDefinition } from './actor-reply-definition.ts'
export { actorReplyConversationNodeDefinition } from './actor-reply-definition.ts'

function ActorReplyNodeView({ node }: ChatNodeViewProps<'man-roles-actor-reply'>) {
  return createElement('div', { 'data-man-roles-actor-reply': 'true' }, node.data.reply)
}

export function registerActorReplyNode(ctx: ClientContext): void {
  ctx.conversationEvents.register(actorReplyConversationNodeDefinition)
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'man-roles-actor-reply' }, ActorReplyNodeView))
}
