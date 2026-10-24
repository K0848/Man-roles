/** Host entry for the deterministic variable-branch product orchestrator. */

import { createHash } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { AgentPreset, AgentPresets } from '@deepseek-ai/dsh-agent-presets'
import type { AgentOptions } from '@deepseek-ai/dsh-agent'
import { readComposition } from '@deepseek-ai/dsh-agent-presets'
import { readFile } from 'node:fs/promises'
import { basename, isAbsolute } from 'node:path'
import { DEFAULT_TURN_BUDGET, ManRoleplayer } from './service.ts'
import ManRoleplayerRemoteService from './remote.ts'
import { parseResearchEvidence } from './evidence.ts'
import type { ResearchEvidence } from './evidence.ts'
import type { PersonaId, PersonaPresetIdentity } from './product/index.ts'
import { isPersonaId, personaDefinition } from './types.ts'

/** Cordis plugin name. */
export const name = 'man-roleplayer'
/** Required host capabilities: product ownership, live agents, and coordinated durable deletion. */
export const inject = ['agents', 'llm', 'sessionPersistence', 'storageDomain', 'tools']

/** One explicit deployment binding for an audited persona. */
export interface PersonaBindingConfig {
  readonly id: PersonaId
  readonly researchPath: string
  readonly presetId: string
}

/** Host-owned bindings for the audited persona roster. */
export interface Config {
  readonly personas?: readonly PersonaBindingConfig[] | string
  /** Legacy two-person test/deployment shape. New product profiles use `personas`. */
  readonly research?: { readonly wangYangmingPath?: string; readonly zengGuofanPath?: string }
  /** Legacy two-person test/deployment shape. New product profiles use `personas`. */
  readonly presets?: { readonly wangYangming?: string; readonly zengGuofan?: string }
  readonly agentOptions?: AgentOptions
  /** Product profile enables one asynchronous state analysis per completed turn. */
  readonly stateAnalysis?: boolean
  /** Finite model/tool/active-time limits for one persona turn. */
  readonly turnBudget?: Partial<import('./types.ts').TurnBudget>
  /** Product bundles opt into fail-closed provider/model binding. */
  readonly requireExplicitModel?: boolean
}

interface LoadedResearch {
  readonly evidence: readonly ResearchEvidence[]
  readonly fingerprints: ReadonlyMap<PersonaId, string>
}

/** Open and provide the H2 product orchestrator. */
export async function apply(ctx: Context, config?: Config): Promise<void> {
  if (config?.requireExplicitModel === true
    && (config.agentOptions?.provider === undefined || config.agentOptions.provider.trim() === ''
      || config.agentOptions.model === undefined || config.agentOptions.model.trim() === '')) {
    throw new Error('man-roleplayer product profile requires explicit provider and model bindings')
  }
  const bindings = personaBindings(config)
  const research = bindings === undefined ? undefined : await loadResearchEvidence(bindings)
  const presetIdentities = bindings === undefined || research === undefined
    ? undefined
    : await loadPresetIdentities(ctx.get('agentPresets'), bindings, research.fingerprints)
  const product = new ManRoleplayer(
    ctx, ctx.sessionPersistence, config?.turnBudget?.stopTimeoutMs, research?.evidence ?? [], presetIdentities, config?.agentOptions,
    config?.stateAnalysis === true,
    { ...DEFAULT_TURN_BUDGET, ...config?.turnBudget },
  )
  await product.open()
  const unprovide = ctx.provide('manRoleplayer', product)
  await ctx.plugin(ManRoleplayerRemoteService)
  ctx.effect(() => async () => {
    unprovide()
    await product.close()
  }, 'manRoleplayer lifecycle')
}

function personaBindings(config: Config | undefined): readonly PersonaBindingConfig[] | undefined {
  // A profile may carry legacy fields for older test overlays; the generic registry binding is authoritative when present.
  if (typeof config?.personas === 'string') {
    let parsed: unknown
    try {
      parsed = JSON.parse(config.personas)
    } catch (error) {
      throw new Error('persona bindings JSON is invalid', { cause: error })
    }
    if (!Array.isArray(parsed)) throw new Error('persona bindings JSON must be an array')
    return parsed as PersonaBindingConfig[]
  }
  if (config?.personas !== undefined) return config.personas
  const research = config?.research
  const presets = config?.presets
  const hasLegacyResearch = research?.wangYangmingPath !== undefined || research?.zengGuofanPath !== undefined
  const hasLegacyPresets = presets?.wangYangming !== undefined || presets?.zengGuofan !== undefined
  if (hasLegacyResearch !== hasLegacyPresets) throw new Error('persona presets and research bindings must be configured together')
  if (research?.wangYangmingPath === undefined || research.zengGuofanPath === undefined
    || presets?.wangYangming === undefined || presets.zengGuofan === undefined) return undefined
  return [
    { id: 'wang-yangming', researchPath: research.wangYangmingPath, presetId: presets.wangYangming },
    { id: 'zeng-guofan', researchPath: research.zengGuofanPath, presetId: presets.zengGuofan },
  ]
}

async function loadResearchEvidence(bindings: readonly PersonaBindingConfig[]): Promise<LoadedResearch> {
  if (bindings.length < 2) throw new Error('at least two persona bindings are required')
  const ids = new Set<PersonaId>()
  const paths = new Set<string>()
  for (const binding of bindings) {
    if (!isPersonaId(binding.id) || ids.has(binding.id)) throw new Error('persona binding ids must be unique and registered')
    if (!isAbsolute(binding.researchPath)) throw new Error('research paths must be absolute')
    const definition = personaDefinition(binding.id)
    if (basename(binding.researchPath) !== definition.researchFileName) throw new Error(`research path for '${binding.id}' must name ${definition.researchFileName}`)
    if (paths.has(binding.researchPath)) throw new Error('research paths must identify distinct files')
    if (binding.presetId.trim() === '') throw new Error(`persona '${binding.id}' requires a preset id`)
    ids.add(binding.id)
    paths.add(binding.researchPath)
  }
  const sources = await Promise.all(bindings.map(async binding => ({
    binding, markdown: await readFile(binding.researchPath, 'utf8'),
  })))
  const evidence: ResearchEvidence[] = []
  const fingerprints = new Map<PersonaId, string>()
  for (const { binding, markdown } of sources) {
    const parsed = parseResearchEvidence(markdown, binding.id)
    if (parsed.length === 0) {
      throw new Error(`research file for '${binding.id}' must contain matching-persona evidence`)
    }
    evidence.push(...parsed)
    fingerprints.set(binding.id, createHash('sha256').update(markdown).digest('hex'))
  }
  return { evidence, fingerprints }
}

async function loadPresetIdentities(
  registry: AgentPresets | undefined,
  bindings: readonly PersonaBindingConfig[],
  fingerprints: ReadonlyMap<PersonaId, string>,
): Promise<readonly PersonaPresetIdentity[]> {
  if (registry === undefined) throw new Error('man-roleplayer preset bindings require @deepseek-ai/dsh-agent-presets')
  const presetIds = new Set(bindings.map(binding => binding.presetId))
  if (presetIds.size !== bindings.length) throw new Error('persona preset ids must be distinct')
  const resolve = async (persona: PersonaId, presetId: string): Promise<PersonaPresetIdentity> => {
    const preset: AgentPreset = await registry.resolve(presetId)
    const composition = await readComposition(preset)
    const researchFingerprint = fingerprints.get(persona)
    if (researchFingerprint === undefined) throw new Error(`persona '${persona}' has no research fingerprint`)
    return {
      presetId: preset.id,
      assemblyDigest: createHash('sha256').update(composition).digest('hex'),
      persona,
      researchFingerprint,
    }
  }
  return Promise.all(bindings.map(binding => resolve(binding.id, binding.presetId)))
}
export { DeletionMachine, isActivePersonaAcknowledgement, project, dilemmaId, requestId, operationId, sessionId } from './product/index.ts'
export type * from './product/index.ts'
export { parseResearchEvidence, validateClaimSidecar } from './evidence.ts'
export type { ClaimSidecarInput, ResearchEvidence } from './evidence.ts'
export { ManRoleplayerRemoteService } from './remote.ts'
export { AgentStopTimeoutError, awaitStopWithin, DEFAULT_STOP_TIMEOUT_MS, DEFAULT_TURN_BUDGET, ManRoleplayer } from './service.ts'
export type { CreateDilemmaOptions, EvidenceLookupResult, EvidenceLookupStatus } from './service.ts'
