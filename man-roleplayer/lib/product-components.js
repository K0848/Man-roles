// src/client/components/product-components.ts
var ProductConversationList = (items) => ({ type: "conversation-list", items });
var ManRolesComposer = (state) => ({ type: "composer", ...state });
var PersonaSwitcher = (activePersona, personas) => ({ type: "persona-switcher", activePersona, personas });
var CandidateControls = (candidateId) => ({ type: "candidate-controls", candidateId });
var ResultPanel = (result) => ({ type: "result-panel", result });
export {
  CandidateControls,
  ManRolesComposer,
  PersonaSwitcher,
  ProductConversationList,
  ResultPanel
};
//# sourceMappingURL=product-components.js.map
