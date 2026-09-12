// src/runtime/actor-context-filter.ts
function filterActorStepMessages(messages) {
  return messages.filter((message) => message.source?.kind === "user" || message.source?.kind === "plugin" && message.source.plugin === "man-roles-roleplayer");
}
export {
  filterActorStepMessages
};
//# sourceMappingURL=actor-context-filter.js.map
