// src/product/native-actor-branch.ts
function nativeActorDeliveryBridge(actor, flush) {
  return {
    session: actor.session,
    flush,
    queueUserMessage: (message) => actor.send(message, "next-turn", false),
    wakePending: () => actor.wakePending()
  };
}
export {
  nativeActorDeliveryBridge
};
//# sourceMappingURL=native-actor-branch.js.map
