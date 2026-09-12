/** Client-side product control plane. It intentionally has no session.prompt
 * dependency: product text must first receive a stable Trunk message identity. */
export type ProductRemote = {
  manRolesProduct: {
    create(input: { conversationId: string; personaId: string }): Promise<RemoteEnvelope<{ ok: boolean; code?: string; view?: ProductView }>>
    view(input: { conversationId: string }): Promise<RemoteEnvelope<{ ok: boolean; code?: string; view?: ProductView }>>
    send(input: { conversationId: string; messageId: string; text: string }): Promise<RemoteEnvelope<{ ok: boolean; code?: string }>>
    switchPersona(input: { conversationId: string; personaId: string; operationId: string }): Promise<RemoteEnvelope<{ ok: boolean; sessionId?: string; code?: string; view?: ProductView }>>
    feedback(input: { conversationId: string; itemId: string; action: string; operationId: string; replacement?: string }): Promise<RemoteEnvelope<{ ok: boolean; code?: string }>>
  }
}
export type ProductView = { conversationId: string; activePersonaId: string; activeBranchSessionId: string | null; branches: Array<{ personaId: string; sessionId: string }>; candidateItems: Array<{ id?: string }>; confirmedItems: unknown[] }
type RemoteEnvelope<T> = T | { ok: true; value: T } | { ok: false; error?: { message?: string } }
function unwrap<T extends { ok: boolean; code?: string }>(value: RemoteEnvelope<T>): T {
  if ('value' in value) return value.value
  if ('error' in value) return { ok: false, code: value.error?.message ?? 'remote-failed' } as T
  return value
}

export class ProductController {
  constructor(private readonly remote: ProductRemote) {}
  async create(input: { conversationId: string; personaId: string }): Promise<{ ok: boolean; code?: string; view?: ProductView }> { return unwrap(await this.remote.manRolesProduct.create(input)) }
  async view(input: { conversationId: string }): Promise<{ ok: boolean; code?: string; view?: ProductView }> { return unwrap(await this.remote.manRolesProduct.view(input)) }
  async send(input: { conversationId: string; messageId: string; text: string }): Promise<{ ok: boolean; code?: string }> {
    return unwrap(await this.remote.manRolesProduct.send(input))
  }
  /** Navigation belongs to the caller and occurs only after ProductService has committed the switch. */
  async switchPersona(input: { conversationId: string; personaId: string; operationId: string }, open: (sessionId: string) => void): Promise<{ ok: boolean; code?: string; view?: ProductView }> {
    const result = unwrap(await this.remote.manRolesProduct.switchPersona(input))
    if (result.ok && result.sessionId) open(result.sessionId)
    return result
  }
  async feedback(input: { conversationId: string; itemId: string; action: string; operationId: string; replacement?: string }): Promise<{ ok: boolean; code?: string }> {
    return unwrap(await this.remote.manRolesProduct.feedback(input))
  }
}
