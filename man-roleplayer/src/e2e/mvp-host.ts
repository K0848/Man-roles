import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRuntimeRegistry } from '../persona/runtime-registry.ts'
import { ConversationRepository, ManRolesProductService, type ProductTurnTaskFactory } from '../product/service.ts'
import { validateMvpReport } from '../validation/mvp-report.ts'
import { runDialogueTurnV2AfterDelivery } from '../dialogue/coordinator.ts'

/**
 * Zero-cost normal product-path host exercise.  This does not receive a
 * precomputed report or scenarios: it creates the real Registry/Repository/
 * ProductService and derives evidence from its own Trunk and Branch activity.
 */
export async function runMvpHost() {
  const storageDir = mkdtempSync(join(tmpdir(), 'man-roles-mvp-host-'))
  const registry = createRuntimeRegistry(); const personas = registry.listActive()
  const first = personas[0]?.id; const second = personas[1]?.id
  if (!first || !second) throw new Error('MVP host needs two active personas')
  let taskCalls = 0
  const taskFactory: ProductTurnTaskFactory = ({ aggregate, messageId, text, personaId, delivery }) => {
    if (messageId !== 'm-1') return undefined
    return {
      taskId: 'task-v2-m-1',
      run: async signal => {
        if (signal.aborted) throw new Error('cancelled before v2 turn')
        const result = await runDialogueTurnV2AfterDelivery({ raw: text, taskId: 'task-v2-m-1', personaId, messageId, eventPurposePrefix: 'mvp-host' }, {
          registry, trunk: aggregate.trunk, delivery: { session: { append() {} }, sessionId: aggregate.currentBranch()?.sessionId ?? 'missing-branch', flush: async () => undefined },
          interpreter: () => ({ feedback: null, responseNeeds: { answerKnowledge: true, acknowledgeEmotion: false, clarify: false, proposeCandidate: false, reflect: false, offerNewConversation: false }, safetyEscalation: 'none' }),
          director: async () => undefined,
          actor: { answerExists: () => false, loadExisting: () => ({ reply: '' }), run: async () => { taskCalls++; return { reply: 'scripted product actor reply', progressSummary: 'scripted progress' } } },
          loadCurrentBranchHistory: () => [],
        }, delivery)
        if (signal.aborted) throw new Error('cancelled after v2 turn')
        return result
      },
    }
  }
  const service = new ManRolesProductService(new ConversationRepository(storageDir, registry), undefined, taskFactory)
  service.create('mvp-host', first)
  const branchEvents: Array<{ persona: string; type: string; text: string }> = []
  const session = { append(type: 'user/message', data: { content?: Array<{ text?: string }> }) { branchEvents.push({ persona: service.viewConversation('mvp-host').activePersonaId, type, text: data.content?.[0]?.text ?? '' }) } }
  const flush = async () => undefined
  const firstSend = await service.send({ conversationId: 'mvp-host', messageId: 'm-1', text: '我在理想与现实之间犹豫。', session, flush })
  const branchEventsBeforeRetry = branchEvents.length
  const retry = await service.send({ conversationId: 'mvp-host', messageId: 'm-1', text: '我在理想与现实之间犹豫。', session, flush })
  const interrupted = await service.send({ conversationId: 'mvp-host', messageId: 'm-interrupted', text: '这条投递会中断。', session, flush: async () => { throw new Error('scripted delivery interruption') } })
  let releaseLate!: () => void
  const cancelled = await service.send({ conversationId: 'mvp-host', messageId: 'm-cancel', text: '这条任务会取消。', session, flush, task: { taskId: 'task-cancel', run: async () => new Promise(resolve => { releaseLate = () => resolve({ late: true }) }) } })
  const cancelAccepted = cancelled.ok && service.cancel('mvp-host', 'task-cancel'); releaseLate()
  await new Promise(resolve => setTimeout(resolve, 0))
  const cancelLateResultRejected = cancelAccepted && service.viewConversation('mvp-host').taskState?.status === 'cancelled'
  const budget = await service.send({ conversationId: 'mvp-host', messageId: 'm-budget', text: '这条任务会超预算。', session, flush, task: { taskId: 'task-budget', budgetMs: 1, run: async () => new Promise(() => {}) } })
  const switched = service.switchPersona('mvp-host', second)
  const secondSend = await service.send({ conversationId: 'mvp-host', messageId: 'm-2', text: '我想换一个角度想想。', session, flush })
  await new Promise(resolve => setTimeout(resolve, 15))
  const view = service.viewConversation('mvp-host')
  return validateMvpReport({
    schemaVersion: 1, providerNetworkUsed: false, tokenCost: 0, passed: true,
    scenarios: ['normal-product-send', 'product-persona-switch', 'delivery-interruption', 'same-message-retry', 'cancel-late-result', 'budget-blocked'],
    trace: { productConversations: service.list().length, userRaws: view.userRaws.length, branchEvents: branchEvents.length, taskCalls, firstAccepted: firstSend.ok, secondAccepted: secondSend.ok, switchedTo: switched.activePersonaId, retryDidNotAppend: retry.ok && branchEventsBeforeRetry === 1, deliveryInterrupted: !interrupted.ok, cancelLateResultRejected, budgetDurable: budget.ok && Boolean(service.conversations.get('mvp-host').taskOutcomes['task-budget']), budgetPersonaIsOriginal: service.conversations.get('mvp-host').taskOutcomes['task-budget']?.personaId === first },
  })
}
