import { mkdirSync } from 'node:fs'
import { PersonaRegistry } from '../persona/registry.ts'
import { TrunkStorage } from '../storage/trunk-storage.ts'
import type { PersonaId, TrunkState } from '../domain/schema.ts'
import type { ActorResult } from '../runtime/submit-actor-reply.ts'
import type { ActorContext } from '../dialogue/public-view.ts'

export const FIXTURE_PERSONA_IDS = ['alpha', 'beta', 'gamma'] as const
export type FixturePersonaId = typeof FIXTURE_PERSONA_IDS[number]

export interface ProviderObservation { kind: 'classifier' | 'director' | 'actor' | 'retrieval'; requestId: string; personaId?: PersonaId; usage: { inputTokens: number; outputTokens: number; totalTokens: number }; network: false; }
export type FixtureProviderRequest = ProviderObservation
export interface FixtureBranchEvent { type: 'user/message' | 'assistant/message'; personaId: PersonaId; text: string; rawRef?: string }
export interface FixtureBranchMessage { content?: Array<{ type?: string; text?: string }>; source?: { raw_ref?: string } }
export interface FixtureTraceEntry { seq: number; kind: 'trunk' | 'branch' | 'loader' | 'context'; type: string; personaId?: FixturePersonaId; }
export interface FixtureBranch { personaId: FixturePersonaId; sessionId: string; events: FixtureBranchEvent[]; append(type: 'user/message', data: FixtureBranchMessage): void; flush(): Promise<void> }
export interface ActorContextObservation { personaId: FixturePersonaId; currentRawRef: string; candidateItems: ActorContext['candidateItems']; confirmedItems: ActorContext['confirmedItems']; selectedHistoricalRawRefs: readonly string[]; branchHistory: readonly string[]; branchProgress: ActorContext['branchProgress']; }
export interface ActorResultObservation { personaId: FixturePersonaId; messageId: string; questions: readonly string[]; controls: readonly string[]; retrievalCalls: number; replyMarker: string }
export interface DialogueFixture { root: string; registry: PersonaRegistry; trunk: TrunkStorage; branches: Record<FixturePersonaId, FixtureBranch>; answers: Map<string, ActorResult>; observations: ProviderObservation[]; actorContexts: ActorContextObservation[]; actorResults: ActorResultObservation[]; providerRequests: FixtureProviderRequest[]; globalTrace: FixtureTraceEntry[]; loaderRequests: { personaId: FixturePersonaId; sessionId: string; target: FixturePersonaId }[]; }

export function createDialogueFixture(root: string, conversationId = 'dialogue-loop'): DialogueFixture {
  const registry = new PersonaRegistry(FIXTURE_PERSONA_IDS.map((id) => ({ manifest:{id,displayName:id,status:'active',legacyIds:[],content:{prompt:'fixture',anecdotes:'fixture',quotes:'fixture',blacklist:'fixture'}}, prompt:'fixture', anecdotes:[], quotes:[], blacklist:[] })))
  mkdirSync(root, { recursive: true })
  const trunk = TrunkStorage.create(conversationId, root, 'alpha', registry)
  const branches = Object.fromEntries(FIXTURE_PERSONA_IDS.map((personaId) => {
    const branch: FixtureBranch = { personaId, sessionId: `fixture-${conversationId}-${personaId}`, events: [], append(type, data) { branch.events.push({ type, personaId, text: data.content?.[0]?.text ?? '', rawRef: data.source?.raw_ref }) }, async flush() {} }
    trunk.indexBranch(personaId, branch.sessionId)
    return [personaId, branch]
  })) as Record<FixturePersonaId, FixtureBranch>
  return { root, registry, trunk, branches, answers: new Map(), observations: [], actorContexts: [], actorResults: [], providerRequests: [], globalTrace: [], loaderRequests: [] }
}

export function branchHistory(branch: FixtureBranch): string[] { return branch.events.map((e) => `${e.type}:${e.text}`) }
export function fixtureState(fixture: DialogueFixture): TrunkState { return fixture.trunk.state }
