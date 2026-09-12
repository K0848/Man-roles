import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolRunContext, JsonValue, ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import type { ContentLibraries } from '../retrieval/retrieve.ts'
import type { PersonaId } from '../domain/schema.ts'
import { makeActorHandlers } from '../retrieval/tools.ts'
import { submitActorReply } from './submit-actor-reply.ts'
import { validateSubmitArgs, FINAL_ACTOR_TOOL_NAMES, missingEvidenceDetails } from './actor-tool-contract.ts'
import { ActorTurnStateRegistry, normalizeTurnPolicyArgs, turnPolicyViolation } from './turn-state.ts'
import { runWebSearchSeam } from './web-tool-seam.ts'
const output = { schema: { type: 'json' as const }, render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value) }] }
function canonical(result: { content: string; isError?: boolean }): JsonValue { try { const parsed = JSON.parse(result.content) as JsonValue; return result.isError && parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ok: false, ...parsed } : parsed } catch { return { ok: false, error: result.content } } }
function toJson(value: object): JsonValue { return JSON.parse(JSON.stringify(value)) as JsonValue }
/** Strictly redacted diagnostics for replay/reporting; never include submit text or parameters. */
export function sanitizeSubmitDiagnostics(attempt: number, payload: { ok?: boolean; errorCode?: string; repairable?: boolean; fallback?: boolean; concluded?: boolean; violations?: Array<{ code?: string; segmentIndex?: number }> }) {
  const accepted = payload.ok === true && payload.concluded === true
  return { attempt, accepted, errorCode: accepted ? 'ok' : payload.errorCode ?? (payload.fallback === true ? 'fixed-fallback' : payload.violations?.[0]?.code ?? 'invalid-submit'), repairable: payload.repairable === true, fallback: payload.fallback === true, concluded: payload.concluded === true, violations: (payload.violations ?? []).map((v) => ({ code: v.code ?? 'invalid-submit', ...(typeof v.segmentIndex === 'number' ? { segmentIndex: v.segmentIndex } : {}) })) }
}
export function registerActorTools(agentCtx: Context, libs: ContentLibraries, personaId: PersonaId, registry: ActorTurnStateRegistry, exposedToolNames?: readonly string[], webSearch?: (query: string) => Promise<Array<{ url: string; title?: string; snippet?: string }>>) {
  const state = (exec: ToolRunContext) => registry.stateForExecution(exec, personaId)
  const definitions: ToolDefinition[] = [
    defineTool({ name: 'retrieve_anecdotes', description: '检索当前人物事迹。', parameters: { query: { type: 'string', required: true }, topK: { type: 'number' } }, output, execute: async (args, exec) => { const current = state(exec); if (current.retrievalPolicy === 'deny') return { ok: false, errorCode: 'retrieval-not-authorized', detail: '当前 taskMode 禁止检索；请提交 dialogue/modern_inference，submit_actor_reply 仍可用。' }; return canonical(makeActorHandlers(libs, personaId, current.ledger).retrieve_anecdotes(JSON.stringify(args))) } }),
    defineTool({ name: 'fetch_anecdote', description: '读取当前人物事迹。', parameters: { id: { type: 'string', required: true } }, output, execute: async (args, exec) => { const current = state(exec); if (current.retrievalPolicy === 'deny') return { ok: false, errorCode: 'retrieval-not-authorized', detail: '当前 taskMode 禁止检索；请提交 dialogue/modern_inference，submit_actor_reply 仍可用。' }; return canonical(makeActorHandlers(libs, personaId, current.ledger).fetch_anecdote(JSON.stringify(args))) } }),
    defineTool({ name: 'retrieve_quotes', description: '检索当前人物语录。', parameters: { query: { type: 'string', required: true }, topK: { type: 'number' } }, output, execute: async (args, exec) => { const current = state(exec); if (current.retrievalPolicy === 'deny') return { ok: false, errorCode: 'retrieval-not-authorized', detail: '当前 taskMode 禁止检索；请提交 dialogue/modern_inference，submit_actor_reply 仍可用。' }; return canonical(makeActorHandlers(libs, personaId, current.ledger).retrieve_quotes(JSON.stringify(args))) } }),
    defineTool({ name: 'fetch_quote', description: '读取当前人物语录。', parameters: { id: { type: 'string', required: true } }, output, execute: async (args, exec) => { const current = state(exec); if (current.retrievalPolicy === 'deny') return { ok: false, errorCode: 'retrieval-not-authorized', detail: '当前 taskMode 禁止检索；请提交 dialogue/modern_inference，submit_actor_reply 仍可用。' }; return canonical(makeActorHandlers(libs, personaId, current.ledger).fetch_quote(JSON.stringify(args))) } }),
    defineTool({ name: 'web_search', description: '搜索现代外部资料；结果只作为当前回合来源。', parameters: { query: { type: 'string', required: true } }, output, execute: async (args, exec) => { if (webSearch === undefined) return { ok: false, errorCode: 'web-search-unavailable', detail: '搜索能力不可用，已保守降级。' }; const current = state(exec); const result = await runWebSearchSeam(webSearch, String((args as { query?: unknown }).query ?? ''), personaId, current.turnId, current.ledger); return result.ok ? result : { ...result, detail: '搜索超时或不可用，已保守降级。' } } }),
    defineTool({ name: 'submit_actor_reply', description: '提交证据校验后的回答。', parameters: {
        segments: {
          type: 'array',
          required: true,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['dialogue', 'historical_fact', 'verbatim_quote', 'thought_attribution', 'modern_inference'], required: true },
              text: { type: 'string', required: true },
              evidenceIds: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        turnIntent: { type: 'string', enum: ['answer', 'clarify', 'await-confirmation', 'reflect', 'offer-controls', 'pause', 'close'] },
        // DSH tool-schema DSL does not support maxItems; runtime只校验问题形状、
        // 去重和总预算，不按问题数量硬拒绝。
        questions: { type: 'array', items: { type: 'string' } },
        offeredControls: { type: 'array', items: { type: 'string', enum: ['confirm', 'partial-confirm', 'correct', 'skip', 'continue', 'pause', 'end', 'switch-persona', 'new-dilemma'] } },
    }, output: {
      ...output,
      presentationMeta: (args, value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
        const v = value as Record<string, JsonValue>
        return v.ok === true && v.concluded === true && typeof v.reply === 'string' && v.reply.length > 0
          ? { kind: 'actor-reply', reply: v.reply, evidence: Array.isArray(v.evidence) ? v.evidence : [], ...(typeof v.turnIntent === 'string' ? { turnIntent: v.turnIntent } : {}), ...(Array.isArray(v.questions) ? { questions: v.questions.map((q) => String(q).trim()) } : {}), ...(Array.isArray(v.controls) ? { controls: v.controls } : {}), ...(v.fallback === true ? { fallback: true } : {}) }
          : {}
      },
    }, execute: async (args, exec) => {
      const current = state(exec); const attempt = current.failures + 1
      const finish = (value: object) => toJson({ ...value, diagnostics: sanitizeSubmitDiagnostics(attempt, value as any) })
      const normalizedArgs = normalizeTurnPolicyArgs(args, current)
      const policyDetail = turnPolicyViolation(normalizedArgs, current)
      if (policyDetail) {
        current.failures++; current.repairDetails = `${policyDetail}不得原样重放上一参数。`
        if (current.failures >= 2) { exec.concludeTurn(); return finish({ ok: false, errorCode: 'turn-policy-violation', fallback: true, concluded: true, error: '提交连续失败，回合已结束。' }) }
        return finish({ ok: false, repairable: true, errorCode: 'turn-policy-violation', detail: policyDetail })
      }
      if (!validateSubmitArgs(normalizedArgs)) {
        current.failures++; const detail = missingEvidenceDetails(normalizedArgs); const errorCode = detail ? 'missing-evidence-ids' : 'invalid-submit'
        if (detail) current.repairDetails = detail
        if (current.failures >= 2) { exec.concludeTurn(); return finish({ ok: false, errorCode, fallback: true, concluded: true, error: '提交连续失败，回合已结束。' }) }
        return finish({ ok: false, repairable: true, errorCode, detail: detail ?? '提交结构无效，请修复后重试。' })
      }
      const result = submitActorReply(normalizedArgs, { ledger: current.ledger, libs, personaId })
      if (!result.ok) {
        current.failures++; const detail = result.violations?.map((v) => v.detail).join('；')
        if (detail) current.repairDetails = `${detail}。允许两条修复路径：绑定当前回合 ledger 中真实 evidence ID，或删除这些段/改为 dialogue 或 modern_inference；不得原样重放上一参数。`
        if (current.failures >= 2) { exec.concludeTurn(); return finish({ ok: false, errorCode: 'evidence-gate-rejected', violations: result.violations, fallback: true, concluded: true, error: '提交连续失败，回合已结束。' }) }
        return finish({ ok: false, repairable: true, errorCode: 'evidence-gate-rejected', violations: result.violations, detail: current.repairDetails })
      }
      exec.concludeTurn(); return finish(result)
    } }),
  ]
  const exposed = exposedToolNames ? new Set(exposedToolNames) : undefined
  const registered = exposed ? definitions.filter((definition) => exposed.has(definition.name)) : definitions
  for (const definition of registered) agentCtx.tools.register(definition)
  return registered
}
export { FINAL_ACTOR_TOOL_NAMES }
