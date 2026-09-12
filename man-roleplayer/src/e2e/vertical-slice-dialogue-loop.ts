import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { runDialogueTurn } from '../dialogue/coordinator.ts'
import { createControlClassifier } from '../dialogue/control-classifier.ts'
import type { DialogueCoordinatorDeps, DialogueTurnInput } from '../dialogue/coordinator.ts'
import type { ActorResult } from '../runtime/submit-actor-reply.ts'
import type { ActorContext } from '../dialogue/public-view.ts'
import { createDialogueFixture, branchHistory, FIXTURE_PERSONA_IDS, type DialogueFixture, type FixturePersonaId, type ActorContextObservation, type ProviderObservation } from './dialogue-loop-fixture.ts'
import { validateDialogueLoopReport, type DialogueLoopReport, type DialogueScenarioReport } from '../validation/dialogue-loop-report.ts'

export interface DialogueLoopE2EOptions { outputDir?: string }
export const dialogueScenarioNames = ['knowledge','dilemma','partial-confirm','correct','review-reality-changed','skip','urgent','switch-isolation','restart-idempotency'] as const
type ScenarioName = typeof dialogueScenarioNames[number]
type Mode = 'knowledge' | 'dilemma' | 'review'
const zero = () => ({ inputTokens: 0, outputTokens: 0, totalTokens: 0 })
const sha = (s: Buffer) => createHash('sha256').update(s).digest('hex')

function observe(f: DialogueFixture, kind: ProviderObservation['kind'], personaId?: FixturePersonaId): void {
  const request: ProviderObservation = { kind, requestId: `${f.root.split(/[\\/]/).pop()}-${kind}-${f.providerRequests.length + 1}`, ...(personaId ? { personaId } : {}), usage: zero(), network: false }
  f.providerRequests.push(request); f.observations.push(request); f.globalTrace.push({ seq: f.globalTrace.length, kind: 'trunk', type: `provider/${kind}`, ...(personaId ? { personaId } : {}) })
}
function makeDeps(f: DialogueFixture, personaId: FixturePersonaId, mode: Mode, feedbackKind: string): DialogueCoordinatorDeps {
  let activeMessageId = ''
  const classifier = createControlClassifier(async () => { observe(f, 'classifier', personaId); return { safety: 'allow', safetyReason: 'none', taskMode: mode, confidence: 'high', emotionPriority: false, feedbackKind, independentNewDilemma: false } })
  const actor = {
    answerExists: ({ messageId, personaId: id }: { messageId: string; personaId: string }) => f.answers.has(`${messageId}:${id}`),
    loadExisting: ({ messageId, personaId: id }: { messageId: string; personaId: string }) => f.answers.get(`${messageId}:${id}`) as ActorResult,
    run: async ({ context }: { context: ActorContext }): Promise<ActorResult> => {
      const result: ActorResult = { reply: `stub-${personaId}-${context.currentRaw}`, progressSummary: `progress-${personaId}`, questions: [], retrievalCalls: 0 }
      const snapshot: ActorContextObservation = { personaId, currentRawRef: context.currentRawRef, candidateItems: context.candidateItems, confirmedItems: context.confirmedItems, selectedHistoricalRawRefs: context.selectedHistoricalRawRefs, branchHistory: context.currentBranchHistory, branchProgress: context.branchProgress }
      f.actorContexts.push(snapshot); f.globalTrace.push({ seq: f.globalTrace.length, kind: 'context', type: 'actor-context', personaId })
      f.answers.set(`${activeMessageId}:${personaId}`, result); f.actorResults.push({ personaId, messageId: activeMessageId, questions: result.questions ?? [], controls: result.controls ?? [], retrievalCalls: result.retrievalCalls ?? 0, replyMarker: result.reply }); f.branches[personaId].events.push({ type: 'assistant/message', personaId, text: result.reply }); observe(f, 'actor', personaId)
      return result
    },
  }
  const deps: DialogueCoordinatorDeps = { registry: f.registry, trunk: f.trunk, delivery: { session: f.branches[personaId], sessionId: f.branches[personaId].sessionId, flush: async (session) => session.flush(), findUserMessageByRawRef: (ref) => f.branches[personaId].events.some((event) => event.rawRef === ref) }, classifier, actor,
    director: async ({ currentRawRef }) => { observe(f, 'director', personaId); return { propose: [{ id: `candidate-${personaId}`, kind: 'core-conflict', text: `${personaId} conflict`, sourceRawRefs: [currentRawRef], proposedByPersona: personaId }] } },
    loadCurrentBranchHistory: async ({ personaId: target, sessionId }) => { f.loaderRequests.push({ personaId: target as FixturePersonaId, sessionId, target: personaId }); f.globalTrace.push({ seq: f.globalTrace.length, kind: 'loader', type: 'branch-history-loaded', personaId: target as FixturePersonaId }); return branchHistory(f.branches[target as FixturePersonaId]) },
  }
  Object.defineProperty(deps, '__setMessageId', { value: (id: string) => { activeMessageId = id } })
  return deps
}
async function turn(f: DialogueFixture, personaId: FixturePersonaId, raw: string, id: string, mode: Mode = 'dilemma', feedbackKind = 'none', feedback?: DialogueTurnInput['feedback'], selectedHistoricalRawRefs?: string[]) {
  const deps = makeDeps(f, personaId, mode, feedbackKind); (deps as DialogueCoordinatorDeps & { __setMessageId: (id: string) => void }).__setMessageId(`message-${id}`)
  return runDialogueTurn({ raw, taskId: `task-${id}`, personaId, messageId: `message-${id}`, eventPurposePrefix: `turn-${id}`, ...(feedback ? { feedback } : {}), ...(selectedHistoricalRawRefs ? { selectedHistoricalRawRefs } : {}) }, deps)
}
function reportScenario(f: DialogueFixture, name: ScenarioName, result: { status: string; error?: { code?: string }; restart?: DialogueScenarioReport['restart'] }): DialogueScenarioReport {
  const lines = readFileSync(f.trunk.filePath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { type: string; seq: number })
  const calls = { classifier: 0, director: 0, actor: 0, retrieval: 0 }; for (const request of f.providerRequests) calls[request.kind]++
  const contexts = Object.fromEntries(FIXTURE_PERSONA_IDS.map((persona) => [persona, f.actorContexts.filter((x) => x.personaId === persona)]))
  const histories = Object.fromEntries(FIXTURE_PERSONA_IDS.map((persona) => [persona, branchHistory(f.branches[persona])]))
  const branchTypes = FIXTURE_PERSONA_IDS.flatMap((persona) => f.branches[persona].events.map((event) => event.type))
  return { name, status: name === 'urgent' || result.status !== 'ok' ? 'blocked' : 'passed', providerRequests: [...f.providerRequests], actorResults: f.actorResults.map((a) => ({ ...a, messageId: `${name}:${a.messageId}` })), calls, eventTypes: [...lines.map((line) => line.type), ...branchTypes], eventSeqs: lines.map((line) => line.seq), candidateStatuses: f.trunk.state.dilemmaItems.map((item) => item.status), revisionLineage: f.trunk.state.dilemmaItems.map((item) => ({ id: item.id, text: item.text, status: item.status, visibility: item.visibility, ...(item.supersedes ? { supersedes: item.supersedes } : {}), ...(item.supersededBy ? { supersededBy: item.supersededBy } : {}) })), contexts, branchHistories: histories, globalTrace: [...f.globalTrace], loaderRequests: [...f.loaderRequests], urgentDownstreamCalls: name === 'urgent' ? f.providerRequests.length : 0, ...(result.error?.code ? { error: result.error.code } : {}), ...(result.restart ? { restart: result.restart } : {}) }
}
async function scenario(name: ScenarioName): Promise<DialogueScenarioReport> {
  const root = mkdtempSync(join(tmpdir(), `dialogue-${name}-`)); const f = createDialogueFixture(root, `conversation-${name}`)
  try {
    let result: { status: string; error?: { code?: string }; restart?: DialogueScenarioReport['restart'] }
    if (name === 'urgent') result = await turn(f, 'alpha', '我想自杀', 'urgent')
    else if (name === 'knowledge') result = await turn(f, 'alpha', 'knowledge question', 'knowledge', 'knowledge')
    else if (name === 'dilemma') result = await turn(f, 'alpha', 'dilemma question', 'dilemma')
    else if (name === 'partial-confirm' || name === 'correct' || name === 'skip') {
      await turn(f, 'alpha', `${name} first`, 'first'); const item = f.trunk.state.dilemmaItems[0]; const kind = name === 'skip' ? 'skip' : name; const replacement = name === 'skip' ? undefined : { ...item, id: `${item.id}-r2`, status: 'confirmed' as const, visibility: 'shared-confirmed' as const, revision: 2, text: `${name} revised`, supersedes: item.id }
      result = await turn(f, 'alpha', `${name} feedback`, 'feedback', 'dilemma', kind, { kind, itemId: item.id, ...(replacement ? { replacement } : {}) })
    } else if (name === 'review-reality-changed') result = await turn(f, 'alpha', 'review reality changed', 'review', 'review', 'reality-changed')
    else if (name === 'switch-isolation') {
      await turn(f, 'alpha', 'alpha branch', 'switch-a'); const alphaRaw = f.trunk.state.userRaws[0].rawRef; const alphaItem = f.trunk.state.dilemmaItems[0]; await turn(f, 'alpha', 'confirm alpha', 'switch-confirm', 'dilemma', 'confirm', { kind: 'confirm', itemId: alphaItem.id, replacement: { ...alphaItem, revision: alphaItem.revision + 1, status: 'confirmed', visibility: 'shared-confirmed', supersedes: alphaItem.id, id: `${alphaItem.id}-confirmed` } }); f.trunk.setActivePersona('beta'); await turn(f, 'beta', 'beta branch', 'switch-b', 'dilemma', 'none', undefined, [alphaRaw]); f.trunk.setActivePersona('gamma'); result = await turn(f, 'gamma', 'gamma branch', 'switch-c', 'dilemma', 'none', undefined, [alphaRaw])
    } else {
      const deps = makeDeps(f, 'alpha', 'dilemma', 'none'); const input = { raw: 'restart candidate', taskId: 'task-restart', personaId: 'alpha' as const, messageId: 'message-restart', eventPurposePrefix: 'turn-restart' }; (deps as DialogueCoordinatorDeps & { __setMessageId: (id: string) => void }).__setMessageId(input.messageId); const original = f.trunk.updateBranchProgress.bind(f.trunk); let failOnce = true; f.trunk.updateBranchProgress = (...args: Parameters<typeof original>) => { if (failOnce) { failOnce = false; throw new Error('progress unavailable') } return original(...args) }
      const first = await runDialogueTurn(input, deps); const before = readFileSync(f.trunk.filePath); const count = (kind: ProviderObservation['kind']) => f.providerRequests.filter((request) => request.kind === kind).length; const eventCount = (type: string) => readFileSync(f.trunk.filePath, 'utf8').split(/\r?\n/).filter(Boolean).filter((line) => JSON.parse(line).type === type).length
      const beforeCounts = { actor: count('actor'), classifier: count('classifier'), director: count('director'), raw: f.trunk.state.userRaws.length, answer: f.answers.size, branch: f.branches.alpha.events.length, progress: eventCount('trunk/branch-progress-updated') }
      const loaded = (await import('../storage/trunk-storage.ts')).TrunkStorage.load(f.trunk.state.conversationId, f.root, f.registry); const loadBytes = readFileSync(f.trunk.filePath); f.trunk = loaded
      const resumed = makeDeps(f, 'alpha', 'dilemma', 'none'); (resumed as DialogueCoordinatorDeps & { __setMessageId: (id: string) => void }).__setMessageId(input.messageId); const second = await runDialogueTurn(input, resumed); const after = readFileSync(f.trunk.filePath)
      const afterCounts = { actor: count('actor'), classifier: count('classifier'), director: count('director'), raw: f.trunk.state.userRaws.length, answer: f.answers.size, branch: f.branches.alpha.events.length, progress: eventCount('trunk/branch-progress-updated') }
      result = { ...second, restart: { before: { actor: beforeCounts.actor, classifier: beforeCounts.classifier, director: beforeCounts.director, rawCount: beforeCounts.raw, answerCount: beforeCounts.answer, branchCount: beforeCounts.branch, progressCount: beforeCounts.progress, bytesHash: sha(before) }, after: { actor: afterCounts.actor, classifier: afterCounts.classifier, director: afterCounts.director, rawCount: afterCounts.raw, answerCount: afterCounts.answer, branchCount: afterCounts.branch, progressCount: afterCounts.progress, bytesHash: sha(after) }, progressCompensated: first.status === 'failed' && second.status === 'ok', loadBytesUnchanged: before.equals(loadBytes), actorDelta: afterCounts.actor - beforeCounts.actor, classifierDelta: afterCounts.classifier - beforeCounts.classifier, directorDelta: afterCounts.director - beforeCounts.director, rawDelta: afterCounts.raw - beforeCounts.raw, answerDelta: afterCounts.answer - beforeCounts.answer, branchDelta: afterCounts.branch - beforeCounts.branch, progressDelta: afterCounts.progress - beforeCounts.progress, loadedHash: sha(loadBytes), finalHash: sha(after) } }
    }
    return reportScenario(f, name, result)
  } finally { rmSync(root, { recursive: true, force: true }) }
}
export async function runDialogueLoopE2E(options: DialogueLoopE2EOptions = {}): Promise<DialogueLoopReport> {
  const scenarios: DialogueScenarioReport[] = []; for (const name of dialogueScenarioNames) scenarios.push(await scenario(name)); const providerRequests = scenarios.flatMap((entry) => entry.providerRequests); const totalCalls = scenarios.reduce((sum, entry) => sum + Object.values(entry.calls).reduce((a, b) => a + b, 0), 0); const report = { schemaVersion: 3 as const, providerNetworkUsed: providerRequests.some((request) => request.network), tokenCost: providerRequests.reduce((sum, request) => sum + request.usage.totalTokens, 0), providerRequests, scenarios, totalCalls, expectedPersonaIds: [...FIXTURE_PERSONA_IDS], passed: true }; const validation = validateDialogueLoopReport(report, dialogueScenarioNames, FIXTURE_PERSONA_IDS); const finalReport = { ...report, passed: validation.ok }; if (options.outputDir) { mkdirSync(options.outputDir, { recursive: true }); writeFileSync(join(options.outputDir, 'dialogue-loop-report.json'), JSON.stringify(finalReport, null, 2) + '\n') } return finalReport
}
