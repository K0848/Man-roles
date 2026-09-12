// src/client/product-controller.ts
function unwrap(value) {
  if ("value" in value) return value.value;
  if ("error" in value) return { ok: false, code: value.error?.message ?? "remote-failed" };
  return value;
}
var ProductController = class {
  constructor(remote) {
    this.remote = remote;
  }
  remote;
  async create(input) {
    return unwrap(await this.remote.manRolesProduct.create(input));
  }
  async view(input) {
    return unwrap(await this.remote.manRolesProduct.view(input));
  }
  async send(input) {
    return unwrap(await this.remote.manRolesProduct.send(input));
  }
  /** Navigation belongs to the caller and occurs only after ProductService has committed the switch. */
  async switchPersona(input, open) {
    const result = unwrap(await this.remote.manRolesProduct.switchPersona(input));
    if (result.ok && result.sessionId) open(result.sessionId);
    return result;
  }
  async feedback(input) {
    return unwrap(await this.remote.manRolesProduct.feedback(input));
  }
};
export {
  ProductController
};
//# sourceMappingURL=product-controller.js.map
