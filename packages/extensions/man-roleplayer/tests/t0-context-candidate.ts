/** T0-only context projection candidate shared by the recovery harness cases. */
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { createHash } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SessionEvent } from '@deepseek-ai/dsh-session'

export type Projection = {
  readonly source: string
  readonly revision: number
  readonly generation: number
  readonly seq?: number
  readonly applied: boolean
}

export type SummaryDependency = {
  readonly kind: 'shared-state' | 'user-message'
  readonly id: string
  readonly revision: number
}
export type SummaryMetadata = {
  readonly summaryId: string
  readonly revision: number
  readonly dependsOn: readonly SummaryDependency[]
  readonly body: string
}
export type ExpectedProjection = {
  readonly fingerprint: string
  readonly body: string
  readonly revision: number
  readonly invalidSummarySeqs: readonly number[]
  readonly restoredUserSources: readonly { readonly id: string; readonly revision: number; readonly text: string }[]
}

type StateItem = {
  id: string
  persona: string
  revision: number
  text: string
  status: string
  sourceEventIds: readonly string[]
  sourceOperationId: string
}
type SourceRecord = {
  readonly id: string
  readonly revision: number
  readonly sourceEventIds: readonly string[]
  readonly sourceOperationId: string
  readonly scope: 'shared-user-state'
  readonly sourcePersona: string
  readonly targetPersona: string
  readonly adoptionReason: string
}
type SummaryExcluded = { readonly kind: 'summary'; readonly id: string; readonly revision: number | undefined; readonly seq: number }
type ProductEvent = { type?: string; item?: StateItem }
type Section = { name: string; text: string }

function sectionsOf(source: unknown): readonly Section[] {
  if (typeof source !== 'object' || source === null || !('sections' in source)) return []
  const sections = (source as { sections?: unknown }).sections
  return Array.isArray(sections) ? sections.filter((item): item is Section => {
    if (typeof item !== 'object' || item === null) return false
    const candidate = item as { name?: unknown; text?: unknown }
    return typeof candidate.name === 'string' && typeof candidate.text === 'string'
  }) : []
}

function sectionText(source: unknown, name: string): string | undefined {
  return sectionsOf(source).find(section => section.name === name)?.text
}

function isUserMessageEvent(event: SessionEvent): event is SessionEvent<'user/message'> {
  return event.type === 'user/message'
}

function messageText(event: SessionEvent<'user/message'>): string {
  return event.data?.content?.flatMap(block => block.type === 'text' && block.text !== undefined ? [block.text] : []).join('') ?? ''
}

/** 持久化一个带严格依赖元数据的摘要；调用方必须传入真实消息 id。 */
export function appendSummaryProjection(
  agent: Agent,
  metadata: SummaryMetadata,
  surfaceOp: 'append' | { readonly op: 'replace'; readonly start: number; readonly end: number },
  sourceEventSeqs?: readonly number[],
): number {
  const message = createUserMessage({
    content: [{ type: 'text', text: metadata.body }],
    source: { kind: 'plugin', plugin: 't0-summary', form: 'snapshot', sections: [{ name: 'summary', text: JSON.stringify(metadata) }] },
  })
  const intent = sourceEventSeqs === undefined ? { surfaceOp } : { surfaceOp, sourceEventSeqs: [...sourceEventSeqs] }
  return agent.session.append('user/message', message, intent).seq
}

function parseSummary(source: unknown, body: string): SummaryMetadata | undefined {
  const raw = sectionText(source, 'summary')
  if (raw === undefined) return undefined
  try {
    const parsedValue: unknown = JSON.parse(raw)
    if (typeof parsedValue !== 'object' || parsedValue === null || Array.isArray(parsedValue)) return undefined
    const parsed = parsedValue as Partial<SummaryMetadata>
    if (typeof parsed.summaryId !== 'string' || typeof parsed.revision !== 'number' || !Number.isSafeInteger(parsed.revision) || !Array.isArray(parsed.dependsOn) || typeof parsed.body !== 'string') return undefined
    const dependsOn = parsed.dependsOn.filter((item): item is SummaryDependency => {
      if (typeof item !== 'object' || item === null) return false
      const dependency = item as Partial<SummaryDependency>
      return (dependency.kind === 'shared-state' || dependency.kind === 'user-message')
        && typeof dependency.id === 'string' && Number.isSafeInteger(dependency.revision)
    })
    if (dependsOn.length !== parsed.dependsOn.length || parsed.body !== body) return undefined
    return { summaryId: parsed.summaryId, revision: parsed.revision, dependsOn, body: parsed.body }
  } catch (error) {
    if (error instanceof SyntaxError) return undefined
    throw error
  }
}

function dependencyIsStale(dependency: SummaryDependency, states: Map<string, StateItem>, agent: Agent): boolean {
  if (dependency.kind === 'shared-state') {
    const item = states.get(dependency.id)
    return item === undefined || item.status !== 'confirmed' || item.revision !== dependency.revision
  }
  return !agent.session.events.some(event => event.type === 'user/message' && event.data.id === dependency.id
    && event.data.source.kind === 'user' && dependency.revision === 1)
}

/**
 * Mounts the candidate on the real pre-step extension point. The expected
 * projection is computed from durable product/session events before it is
 * appended or replaced; the same `project` function is used by recovery tests.
 */
export function mountCandidate(ctx: Context): {
  readonly projections: Projection[]
  readonly project: (agent: Agent) => Promise<void>
} {
  const projections: Projection[] = []
  const repository = (ctx.manRoleplayer as unknown as {
    repository: { readEvents: (id: string) => Promise<readonly unknown[] | undefined> }
  }).repository
  const computeExpectedProjection = async (agent: Agent): Promise<ExpectedProjection> => {
    const events = await repository.readEvents('t0-context') ?? []
    const states = new Map<string, StateItem>()
    for (const event of events) {
      if (typeof event === 'object' && event !== null && 'type' in event && 'item' in event && (event as ProductEvent).type === 'shared-state') {
        const item = (event as ProductEvent).item
        if (item === undefined || typeof item.id !== 'string' || !Number.isSafeInteger(item.revision)
          || typeof item.text !== 'string' || typeof item.status !== 'string' || typeof item.persona !== 'string'
          || !Array.isArray(item.sourceEventIds) || item.sourceEventIds.some(sourceId => typeof sourceId !== 'string')
          || typeof item.sourceOperationId !== 'string') {
          throw new Error('T0 shared-state fixture is missing stable source metadata')
        }
        states.set(item.id, item)
      }
    }
    if (events.length === 0) throw new Error('T0 context fixture has no durable product events')
    const latest = [...states.values()].reverse().find(item => item.status === 'confirmed')
    const revision = Math.max(0, ...[...states.values()].map(item => item.revision))
    const created = events.find(event => typeof event === 'object' && event !== null && 'type' in event
      && (event as { type?: string }).type === 'created') as {
        branches?: readonly { sessionId?: string; persona?: string }[]
      } | undefined
    const targetPersona = created?.branches?.find(branch => branch.sessionId === String(agent.id))?.persona
    if (targetPersona === undefined) throw new Error(`T0 context fixture has no branch for agent '${String(agent.id)}'`)

    const invalidSummarySeqs: number[] = []
    const restoredUserSources = new Map<string, { readonly id: string; readonly revision: number; readonly text: string }>()
    const visibleUserIds = new Set(agent.session.events.filter((event): event is SessionEvent<'user/message'> => isUserMessageEvent(event)
      && event.data.source.kind === 'user' && agent.session.surface.nodes.includes(event.seq)).map(event => String(event.data.id)))
    const validSummaries: SummaryMetadata[] = []
    const excludedSummaries = new Map<string, SummaryExcluded>()
    const summaries = agent.session.events.filter((event): event is SessionEvent<'user/message'> => isUserMessageEvent(event)
      && event.data.source.kind === 'plugin' && event.data.source.plugin === 't0-summary')
    for (const summary of summaries) {
      const metadata = parseSummary(summary.data.source, messageText(summary))
      const invalid = metadata === undefined || metadata.dependsOn.length === 0
        || metadata.dependsOn.some(dependency => dependencyIsStale(dependency, states, agent))
      if (invalid) {
        invalidSummarySeqs.push(...(agent.session.surface.nodes.includes(summary.seq) ? [summary.seq] : []))
        const id = metadata?.summaryId ?? `summary-seq:${String(summary.seq)}`
        excludedSummaries.set(`${id}@${String(metadata?.revision ?? '')}`, { kind: 'summary', id, revision: metadata?.revision, seq: summary.seq })
        for (const dependency of metadata?.dependsOn ?? []) {
          if (dependency.kind !== 'user-message' || dependency.revision !== 1) continue
          const original = agent.session.events.find((event): event is SessionEvent<'user/message'> => isUserMessageEvent(event)
            && event.data.id === dependency.id && event.data.source.kind === 'user')
          if (original !== undefined && !visibleUserIds.has(dependency.id)) {
            restoredUserSources.set(dependency.id, { id: dependency.id, revision: dependency.revision, text: messageText(original) })
          }
        }
      } else if (agent.session.surface.nodes.includes(summary.seq)) validSummaries.push(metadata)
    }
    for (const marker of agent.session.events.filter((event): event is SessionEvent<'user/message'> => isUserMessageEvent(event)
      && event.data.source.kind === 'plugin' && event.data.source.plugin === 't0-summary-invalidation')) {
      const seq = Number(sectionText(marker.data.source, 'invalidates'))
      const summary = summaries.find(event => event.seq === seq)
      const metadata = summary === undefined ? undefined : parseSummary(summary.data.source, messageText(summary))
      const id = metadata?.summaryId ?? `summary-seq:${String(seq)}`
      excludedSummaries.set(`${id}@${String(metadata?.revision ?? '')}`, { kind: 'summary', id, revision: metadata?.revision, seq })
    }
    const sourceRecord: SourceRecord | undefined = latest === undefined ? undefined : {
      id: latest.id,
      revision: latest.revision,
      sourceEventIds: latest.sourceEventIds,
      sourceOperationId: latest.sourceOperationId,
      scope: 'shared-user-state' as const,
      sourcePersona: latest.persona,
      targetPersona,
      adoptionReason: 'confirmed-current' as const,
    }
    const adopted: readonly SourceRecord[] = sourceRecord === undefined ? [] : [sourceRecord]
    const excludedStates: SourceRecord[] = [...states.values()].filter(item => item !== latest).map(item => ({
      id: item.id, revision: item.revision, sourceEventIds: item.sourceEventIds,
      sourceOperationId: item.sourceOperationId, scope: 'shared-user-state' as const,
      sourcePersona: item.persona, targetPersona, adoptionReason: 'superseded-or-not-current' as const,
    }))
    const excludedSummariesList = [...excludedSummaries.values()].sort((left, right) =>
      left.id.localeCompare(right.id) || left.seq - right.seq)
    const excluded = [...excludedStates].sort((left, right) => left.id.localeCompare(right.id))
    const currentSummary = validSummaries.find(summary => summary.dependsOn.some(dependency => dependency.kind === 'shared-state'
      && dependency.id === latest?.id && dependency.revision === latest.revision))
    const effective = currentSummary === undefined
      ? latest?.text ?? null
      : { summaryId: currentSummary.summaryId, revision: currentSummary.revision }
    const body = JSON.stringify({ type: 't0-context', source: 'shared-state', revision, effective, target: String(agent.id), adopted, excluded, excludedSummaries: excludedSummariesList })
    const bodyHash = createHash('sha256').update(JSON.stringify({ body, summaries: validSummaries })).digest('hex')
    const fingerprint = JSON.stringify({ source: 'shared-state', target: String(agent.id), revision, adopted, excluded, excludedSummaries: excludedSummariesList, bodyHash })
    const restored = [...restoredUserSources.values()].sort((left, right) => left.id.localeCompare(right.id))
    return { fingerprint, revision, invalidSummarySeqs, restoredUserSources: restored, body }
  }

  const applyExpectedProjection = async (agent: Agent, expected: ExpectedProjection): Promise<void> => {
    const legacyPlugins = new Set(['man-roleplayer-context', 'man-roleplayer-state', 'man-roleplayer-choice'])
    for (const legacy of agent.session.events.filter((event): event is SessionEvent<'user/message'> => isUserMessageEvent(event)
      && event.data.source.kind === 'plugin' && legacyPlugins.has(event.data.source.plugin)
      && agent.session.surface.nodes.includes(event.seq))) {
      agent.session.append('user/message', createUserMessage({
        content: [{ type: 'text', text: 'legacy context projection migrated' }],
        source: { kind: 'plugin', plugin: 't0-context-migration', form: 'snapshot', sections: [{ name: 'replacedSeq', text: String(legacy.seq) }] },
      }), { surfaceOp: { op: 'replace', start: legacy.seq, end: legacy.seq }, sourceEventSeqs: [legacy.seq] })
    }
    for (const seq of expected.invalidSummarySeqs) {
      if (!agent.session.surface.nodes.includes(seq)) continue
      agent.session.append('user/message', createUserMessage({
        content: [{ type: 'text', text: JSON.stringify({ type: 'summary-invalidated', reason: 'durable dependency superseded',
          restoredUserSources: expected.restoredUserSources.map(({ id, revision }) => ({ id, revision })) }) }],
        source: {
          kind: 'plugin', plugin: 't0-summary-invalidation', form: 'snapshot',
          sections: [
            { name: 'invalidates', text: String(seq) },
            { name: 'restoredUserSources', text: JSON.stringify(expected.restoredUserSources.map(({ id, revision }) => ({ id, revision }))) },
          ],
        },
      }), { surfaceOp: { op: 'replace', start: seq, end: seq }, sourceEventSeqs: [seq] })
    }
    for (const restored of expected.restoredUserSources) {
      const original = agent.session.events.find((event): event is SessionEvent<'user/message'> => isUserMessageEvent(event)
        && event.data.source.kind === 'user' && event.data.id === restored.id)
      if (original === undefined) throw new Error('T0 summary dependency disappeared before restoration')
      // 复用原文身份；marker 只保存引用，避免把同一原文再复制进模型输入。
      agent.session.append('user/message', original.data, { surfaceOp: 'append', sourceEventSeqs: [original.seq] })
    }
    const old = [...agent.session.events].reverse().find((event): event is SessionEvent<'user/message'> => isUserMessageEvent(event)
      && event.data.source.kind === 'plugin' && event.data.source.plugin === 't0-context'
      && agent.session.surface.nodes.includes(event.seq))
    const oldFingerprint = old === undefined ? undefined : sectionText(old.data.source, 'fingerprint')
    if (old !== undefined && oldFingerprint === expected.fingerprint) {
      projections.push({
        source: 'shared-state', revision: expected.revision,
        generation: agent.session.surface.replaceGeneration, seq: old.seq, applied: false,
      })
      return
    }
    const intent = old === undefined
      ? { surfaceOp: 'append' as const }
      : { surfaceOp: { op: 'replace' as const, start: old.seq, end: old.seq }, sourceEventSeqs: [old.seq] }
    const event = agent.session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: expected.body }],
      source: { kind: 'plugin', plugin: 't0-context', form: 'snapshot', sections: [{ name: 'fingerprint', text: expected.fingerprint }] },
    }), intent)
    projections.push({ source: 'shared-state', revision: expected.revision, generation: agent.session.surface.replaceGeneration, seq: event.seq, applied: true })
  }
  const project = async (agent: Agent): Promise<void> => {
    const expected = await computeExpectedProjection(agent)
    await applyExpectedProjection(agent, expected)
    // 请求放行前先越过真实 JSONL 持久屏障，不能只依赖内存日志已经追加。
    if (!await ctx.sessions.flush(agent.session)) throw new Error('T0 projection requires active Session persistence')
  }
  ctx.on('agent/pre-step', async ({ agent, signal }, next) => {
    const decision = await next()
    if (decision.kind === 'reject' || signal.aborted) return decision
    await project(agent)
    return decision
  }, { prepend: true })
  return { projections, project }
}
