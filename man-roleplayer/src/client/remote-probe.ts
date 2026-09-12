import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'

type JsonRecord = Record<string, unknown>
function record(value: unknown): JsonRecord { if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('expected object'); return value as JsonRecord }
function string(value: unknown, field: string): string { if (typeof value !== 'string' || value.length === 0) throw new Error(`expected ${field}`); return value }
function exact(value: unknown, fields: readonly string[]): JsonRecord { const row = record(value); for (const key of Object.keys(row)) if (!fields.includes(key)) throw new Error(`unexpected ${key}`); return row }
function strict(typeSymbol: string, parse: (value: unknown) => unknown) { return { mode: 'strict' as const, typeSymbol, schema: { parse } } }
function request(fields: readonly string[]) { return strict(`man-roles-roleplayer#${fields.join('_')}Request`, value => { const row = exact(value, fields); for (const field of fields) string(row[field], field); return value }) }
function feedbackRequest(value: unknown) {
  const row = exact(value, ['conversationId', 'itemId', 'action', 'operationId', 'replacement'])
  for (const field of ['conversationId', 'itemId', 'action', 'operationId']) string(row[field], field)
  if (!['confirm', 'partial-confirm', 'correct', 'reject', 'skip'].includes(row.action as string)) throw new Error('invalid feedback action')
  if (row.replacement !== undefined) string(row.replacement, 'replacement')
  return value
}
function productView(value: unknown): unknown {
  const row = exact(value, ['conversationId', 'activePersonaId', 'lifecycle', 'activeBranchSessionId', 'branches', 'userRaws', 'candidateItems', 'confirmedItems', 'branchProgress', 'taskState'])
  string(row.conversationId, 'conversationId'); string(row.activePersonaId, 'activePersonaId')
  if (row.activeBranchSessionId !== null) string(row.activeBranchSessionId, 'activeBranchSessionId')
  if (!Array.isArray(row.branches) || !Array.isArray(row.userRaws) || !Array.isArray(row.candidateItems) || !Array.isArray(row.confirmedItems)) throw new Error('invalid product view collection')
  return value
}
function productResult(value: unknown): unknown {
  const row = record(value); if (row.ok !== true && row.ok !== false) throw new Error('invalid product result')
  if (row.ok === false) { string(row.code, 'code'); return value }
  if (row.view !== undefined) productView(row.view)
  if (row.sessionId !== undefined) string(row.sessionId, 'sessionId')
  if (row.rawRef !== undefined) string(row.rawRef, 'rawRef')
  if (row.taskId !== undefined) string(row.taskId, 'taskId')
  return value
}
const PRODUCT_RESULT = strict('man-roles-roleplayer#ProductResult', productResult)

/** The browser validates every Remote boundary before calling the Host. */
export const manRolesRemoteContribution: TypertRemoteContribution = Object.freeze({
  package: 'man-roles-roleplayer',
  descriptors: Object.freeze([{
    id: 'manRolesProbe/ping', service: 'manRolesProbe', namespace: 'manRolesProbe', method: 'ping', invocation: { kind: 'direct' as const },
    parameters: [{ name: 'probePingRequest', wire: 'probePingRequest', source: 'json' as const, codec: request(['nonce']) }],
    result: strict('man-roles-roleplayer#ProbeResult', value => { const row = exact(value, ['ok', 'nonce', 'service']); if (row.ok !== true || row.service !== 'manRolesProbe') throw new Error('invalid probe result'); string(row.nonce, 'nonce'); return value }),
  }, ...[
    ['create', ['conversationId', 'personaId']], ['view', ['conversationId']], ['switchPersona', ['conversationId', 'personaId', 'operationId']], ['send', ['conversationId', 'messageId', 'text']], ['feedback', ['conversationId', 'itemId', 'action', 'operationId', 'replacement']],
  ].map(([method, fields]) => ({
    id: `manRolesProduct/${method}`, service: 'manRolesProduct', namespace: 'manRolesProduct', method,
    invocation: { kind: 'direct' as const },
    parameters: [{ name: ({ create: 'productCreateRequest', view: 'productViewRequest', switchPersona: 'productSwitchRequest', send: 'productSendRequest', feedback: 'productFeedbackRequest' } as Record<string, string>)[String(method)]!, wire: ({ create: 'productCreateRequest', view: 'productViewRequest', switchPersona: 'productSwitchRequest', send: 'productSendRequest', feedback: 'productFeedbackRequest' } as Record<string, string>)[String(method)]!, source: 'json' as const, codec: method === 'feedback' ? strict('man-roles-roleplayer#productFeedbackRequest', feedbackRequest) : request(fields as string[]) }], result: PRODUCT_RESULT,
  }))]),
})

export async function mountManRolesRemote(ctx: { remote: { $mount(contribution: TypertRemoteContribution): Promise<() => Promise<void>> } }): Promise<() => Promise<void>> {
  return ctx.remote.$mount(manRolesRemoteContribution)
}
