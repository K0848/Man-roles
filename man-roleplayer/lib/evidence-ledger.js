// src/evidence/ledger.ts
var EvidenceLedger = class {
  constructor(personaId, turnId) {
    this.personaId = personaId;
    this.turnId = turnId;
  }
  personaId;
  turnId;
  grants = /* @__PURE__ */ new Map();
  grant(grant) {
    if (grant.personaId !== this.personaId || grant.turnId !== this.turnId || !grant.evidenceId) return false;
    this.grants.set(grant.evidenceId, { ...grant });
    return true;
  }
  hasCurrentGrant(evidenceId, kind) {
    const grant = this.grants.get(evidenceId);
    return grant !== void 0 && grant.personaId === this.personaId && grant.turnId === this.turnId && (kind === void 0 || grant.kind === kind);
  }
  get(evidenceId) {
    return this.grants.get(evidenceId);
  }
  entries() {
    return [...this.grants.values()].map((g) => ({ ...g }));
  }
  clear() {
    this.grants.clear();
  }
};
export {
  EvidenceLedger
};
//# sourceMappingURL=evidence-ledger.js.map
