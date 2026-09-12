import type { BranchSessionWriter } from '../runtime/message-delivery.ts'

/** Public DSH Agent subset required by the reliable product delivery bridge. */
export interface NativeActorBranch {
  readonly session: BranchSessionWriter
  send(message: unknown, target: 'next-turn', wakeup: false): void
  wakePending(): boolean
}

/**
 * Adapts a native Agent without reading its inbox or private driver state.
 * Queueing is durable only after the injected session flush; waking stays a
 * separate post-commit action owned by TurnRunner.
 */
export function nativeActorDeliveryBridge(actor: NativeActorBranch, flush: (session: BranchSessionWriter) => Promise<unknown> | unknown) {
  return {
    session: actor.session,
    flush,
    queueUserMessage: (message: unknown): void => actor.send(message, 'next-turn', false),
    wakePending: (): boolean => actor.wakePending(),
  }
}
