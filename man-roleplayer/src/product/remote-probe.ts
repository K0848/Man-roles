import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { Context } from '@deepseek-ai/cordis'
import {
  manRolesProbeRequestSchema,
  manRolesProbeResponseSchema,
  type ManRolesProbeRequest,
  type ManRolesProbeResponse,
} from './types.ts'
import {
  productCreateRequestSchema,
  productSendRequestSchema,
  productSwitchRequestSchema,
  productViewRequestSchema,
  type ProductCreateRequest,
  type ProductSendRequest,
  type ProductSwitchRequest,
  type ProductViewRequest,
  productFeedbackRequestSchema,
  type ProductFeedbackRequest,
} from './types.ts'
import { ConversationRepository, ManRolesProductService } from './service.ts'
import { createRuntimeRegistry } from '../persona/runtime-registry.ts'
import { NativeActorProductRuntime } from './native-actor-runtime.ts'

/** The Host configures this once during apply; the Remote never owns storage. */
let productService: ManRolesProductService | undefined
let nativeActors: NativeActorProductRuntime | undefined
export function configureManRolesProductService(storageDir: string, hostCtx?: Context): ManRolesProductService {
  const registry = createRuntimeRegistry()
  if (hostCtx && !nativeActors) nativeActors = new NativeActorProductRuntime(hostCtx, registry)
  if (productService) return productService
  productService = new ManRolesProductService(
    new ConversationRepository(storageDir, registry),
    undefined,
    input => nativeActors?.taskFactory()(input),
  )
  return productService
}
function unavailable() { return { ok: false as const, code: 'product-service-unavailable' as const } }

/** Host-owned Remote proving an ordinary external plugin can expose a typed endpoint. */
export class ManRolesProbeService extends TypertRemoteService {
  constructor(private readonly hostCtx: Context) {
    super(hostCtx, 'manRolesProbe')
  }

  @Remote('ping')
  ping(probePingRequest: ManRolesProbeRequest): ManRolesProbeResponse {
    const input = manRolesProbeRequestSchema.parse(probePingRequest)
    return manRolesProbeResponseSchema.parse({ ok: true, nonce: input.nonce, service: 'manRolesProbe' })
  }

  @Remote('create')
  create(probeCreateRequest: ProductCreateRequest) {
    const input = productCreateRequestSchema.parse(probeCreateRequest)
    if (!productService) return unavailable()
    try { return { ok: true as const, view: productService.create(input.conversationId, input.personaId) } } catch (error) { return { ok: false as const, code: error instanceof Error ? error.message : 'create-failed' } }
  }

  @Remote('view')
  view(probeViewRequest: ProductViewRequest) {
    const input = productViewRequestSchema.parse(probeViewRequest)
    if (!productService) return unavailable()
    try { return { ok: true as const, view: productService.viewConversation(input.conversationId) } } catch (error) { return { ok: false as const, code: error instanceof Error ? error.message : 'view-failed' } }
  }

  @Remote('switchPersona')
  switchPersona(probeSwitchRequest: ProductSwitchRequest) {
    const input = productSwitchRequestSchema.parse(probeSwitchRequest)
    if (!productService) return unavailable()
    try { const view = productService.switchPersona(input.conversationId, input.personaId); return { ok: true as const, sessionId: view.branches.find(branch => branch.personaId === view.activePersonaId)?.sessionId, view } } catch (error) { return { ok: false as const, code: error instanceof Error ? error.message : 'switch-failed' } }
  }

  @Remote('send')
  async send(probeSendRequest: ProductSendRequest) {
    const input = productSendRequestSchema.parse(probeSendRequest)
    if (!productService) return unavailable()
    if (!nativeActors) return { ok: false as const, code: 'native-actor-unavailable' as const }
    try {
      const bridge = await nativeActors.branch(productService.conversations.get(input.conversationId))
      return await productService.send({ conversationId: input.conversationId, messageId: input.messageId, text: input.text, ...bridge, findUserMessageByRawRef: rawRef => nativeActors!.hasDurableDelivery(bridge.actor, rawRef) })
    } catch (error) { return { ok: false as const, code: error instanceof Error ? error.message : 'send-failed' } }
  }

  @Remote('feedback')
  async feedback(probeFeedbackRequest: ProductFeedbackRequest) {
    const input = productFeedbackRequestSchema.parse(probeFeedbackRequest)
    if (!productService) return unavailable()
    return productService.feedback(input)
  }
}

/**
 * The production namespace.  The historical probe stays registered for the
 * Task 2 compatibility contract, while Product Client code mounts and calls
 * this separate service; both delegate to the same application owner.
 */
export class ManRolesProductRemote extends TypertRemoteService {
  constructor(private readonly hostCtx: Context) { super(hostCtx, 'manRolesProduct') }
  @Remote('create')
  async create(productCreateRequest: ProductCreateRequest) {
    const input = productCreateRequestSchema.parse(productCreateRequest)
    if (!productService) return unavailable()
    if (!nativeActors) return { ok: false as const, code: 'native-actor-unavailable' as const }
    try {
      const view = productService.create(input.conversationId, input.personaId)
      // The Client opens the product Branch immediately after create; create
      // its Actor/session here rather than fabricating a session client-side.
      await nativeActors.branch(productService.conversations.get(input.conversationId))
      return { ok: true as const, view: productService.viewConversation(input.conversationId) }
    } catch (error) { return { ok: false as const, code: error instanceof Error ? error.message : 'create-failed' } }
  }
  @Remote('view')
  view(productViewRequest: ProductViewRequest) {
    const input = productViewRequestSchema.parse(productViewRequest)
    if (!productService) return unavailable()
    try { return { ok: true as const, view: productService.viewConversation(input.conversationId) } } catch (error) { return { ok: false as const, code: error instanceof Error ? error.message : 'view-failed' } }
  }
  @Remote('switchPersona')
  async switchPersona(productSwitchRequest: ProductSwitchRequest) {
    const input = productSwitchRequestSchema.parse(productSwitchRequest)
    if (!productService) return unavailable()
    if (!nativeActors) return { ok: false as const, code: 'native-actor-unavailable' as const }
    try {
      productService.switchPersona(input.conversationId, input.personaId)
      await nativeActors.branch(productService.conversations.get(input.conversationId))
      const view = productService.viewConversation(input.conversationId)
      return { ok: true as const, sessionId: view.activeBranchSessionId ?? undefined, view }
    } catch (error) { return { ok: false as const, code: error instanceof Error ? error.message : 'switch-failed' } }
  }
  @Remote('send')
  async send(productSendRequest: ProductSendRequest) {
    const input = productSendRequestSchema.parse(productSendRequest)
    if (!productService) return unavailable()
    if (!nativeActors) return { ok: false as const, code: 'native-actor-unavailable' as const }
    try {
      const bridge = await nativeActors.branch(productService.conversations.get(input.conversationId))
      return await productService.send({ conversationId: input.conversationId, messageId: input.messageId, text: input.text, ...bridge, findUserMessageByRawRef: rawRef => nativeActors!.hasDurableDelivery(bridge.actor, rawRef) })
    } catch (error) { return { ok: false as const, code: error instanceof Error ? error.message : 'send-failed' } }
  }
  @Remote('feedback')
  async feedback(productFeedbackRequest: ProductFeedbackRequest) {
    const input = productFeedbackRequestSchema.parse(productFeedbackRequest)
    return productService ? productService.feedback(input) : unavailable()
  }
}

export default ManRolesProbeService
