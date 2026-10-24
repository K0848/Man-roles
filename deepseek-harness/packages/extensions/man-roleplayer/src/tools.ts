/** Product-only Agent-scoped tools for the variable-branch dilemma surface. */

import { defineTool, type JsonValue, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ManRoleplayer } from './service.ts'
import { claimSegmentValueSchema, claimSidecarValueSchema } from './evidence.ts'

/** The author DSL has no minItems keyword; keep the model-facing segment
 * contract aligned with the Host parser. */
function requireSegmentArrayMinimum(tool: ToolDefinition): ToolDefinition {
  const properties = tool.parameters.properties
  if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) throw new Error('persona_turn_submit segment schema properties were not compiled as an object')
  const segments = (properties as Record<string, unknown>).segments
  if (segments === null || typeof segments !== 'object' || Array.isArray(segments)) throw new Error('persona_turn_submit segments were not compiled as an array')
  Object.assign(segments, { minItems: 1 })
  return tool
}

/** The author DSL cannot express numeric bounds; keep the model-facing schema
 * aligned with the runtime guard without weakening either boundary. */
function hardenEvidenceCount(tool: ToolDefinition): ToolDefinition {
  const properties = tool.parameters.properties
  if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) throw new Error('evidence_lookup schema properties were not compiled as an object')
  const count = (properties as Record<string, unknown>).requestedCount
  if (count === null || typeof count !== 'object' || Array.isArray(count)) throw new Error('evidence_lookup requestedCount schema was not compiled as a number')
  Object.assign(count, { minimum: 1, maximum: 3 })
  return tool
}

/** Build the two tools only after a product Agent has been created. */
export function productTools(product: ManRoleplayer): readonly ToolDefinition[] {
  const submit = requireSegmentArrayMinimum(defineTool({
    name: 'persona_turn_submit',
    description: 'Submit the complete final answer as ordered segments. Each segment supplies its own text, Claim kind, and evidenceIds; the Host concatenates segments and computes exact ranges. Never provide textRange or count characters. Use reliable-quote only for reliable authorial-text/quote evidence with firstPersonAllowed=true; use historical-fact only for reliable historical-account/historical-fact evidence; use attribution for textual-parable, disciple-record, another speaker, later evaluation, variants, or contested attribution. If returned evidence has firstPersonAllowed=false, describe it in third person and never rewrite it as “I/我/吾/余” lived experience. Modern advice uses modern-inference with no evidenceIds, but any biographical experience must remain in a separately cited evidence segment rather than being relabeled as modern inference. After any successful lookup, cite at least one compatible returned id instead of labeling all researched content as modern inference.',
    parameters: {
      segments: { type: 'array', items: claimSegmentValueSchema, required: true },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          accepted: { type: 'boolean' }, submissionId: { type: 'string' },
          turnOperationId: { type: 'string' }, text: { type: 'string' },
          claims: { type: 'array', items: claimSidecarValueSchema }, evidenceRevision: { type: 'integer' },
        },
      },
      render: (_args, value) => {
        const candidate = value as { readonly text?: unknown }
        const text = typeof candidate.text === 'string' ? candidate.text : ''
        return [{ type: 'text', text }]
      },
      presentationMeta: (_args, value) => ({ type: 'persona-turn-submit', ...(value as Record<string, JsonValue>) }),
    },
    execute: async (args, exec) => {
      const submission = await product.acceptPersonaTurnSubmission(exec.agent, args)
      exec.signal.throwIfAborted()
      exec.concludeTurn()
      return {
        accepted: true,
        submissionId: submission.submissionId,
        turnOperationId: String(submission.turnOperationId),
        text: submission.text,
        claims: submission.claims.map(claim => ({ ...claim, evidenceIds: [...claim.evidenceIds] })),
        evidenceRevision: submission.evidenceRevision,
      }
    },
  }))
  return [
    submit,
    hardenEvidenceCount(defineTool({
      name: 'evidence_lookup',
      description: 'Look up local evidence only when the answer needs a relevant historical quotation, fact, or attribution. Do not call for greetings, generic identity statements, or messages that need clarification. The caller supplies only a topic and bounded result count.',
      parameters: {
        topic: { type: 'string', required: true, description: 'Current persona research topic.' },
        requestedCount: { type: 'integer', required: true, description: 'Number of entries to request; integer from 1 through 3.' },
      },
      output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
      execute: (args, exec): Promise<JsonValue> => {
        const input = args as { readonly topic?: unknown; readonly requestedCount?: unknown }
        if (typeof input.topic !== 'string' || input.topic.trim() === ''
          || typeof input.requestedCount !== 'number' || !Number.isSafeInteger(input.requestedCount)
          || input.requestedCount < 1 || input.requestedCount > 3) {
          return Promise.resolve({ status: 'failed', evidence: [] } as unknown as JsonValue)
        }
        return product.lookupEvidence(exec.agent, input.topic, input.requestedCount, exec.signal) as unknown as Promise<JsonValue>
      },
    })),
    defineTool({
      name: 'ask_user_question',
      description: 'Ask the user a product-owned structured choice. Answers are retained as user-owned facts, not confirmed state.',
      parameters: {
        questions: {
          type: 'array', required: true, items: {
            type: 'object', additionalProperties: false,
            properties: {
              id: { type: 'string', required: true },
              question: { type: 'string', required: true },
              header: { type: 'string' }, detail: { type: 'string' },
              options: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { label: { type: 'string', required: true }, description: { type: 'string' } } } },
              multi_select: { type: 'boolean' },
            },
          },
        },
      },
      output: {
        schema: {
          type: 'object', additionalProperties: false,
          properties: { answers: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string', required: true }, selected: { type: 'array', required: true, items: { type: 'string' } }, custom: { type: 'string' }, skipped: { type: 'boolean' } } } } },
        },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      execute: async (args, exec) => {
        const questions = args.questions.map(question => ({
          id: question.id, question: question.question,
          ...(question.header === undefined ? {} : { header: question.header }),
          ...(question.detail === undefined ? {} : { detail: question.detail }),
          ...(question.options === undefined ? {} : { options: question.options }),
          ...(question.multi_select === undefined ? {} : { multiSelect: question.multi_select }),
        }))
        const answers = await product.askChoice(exec.agent, questions, exec.signal)
        return {
          answers: answers.map(answer => ({
            id: answer.id,
            selected: [...answer.selected],
            ...(answer.skipped === undefined ? {} : { skipped: answer.skipped }),
            ...(answer.custom === undefined ? {} : { custom: answer.custom }),
          })),
        }
      },
    }),
  ]
}

/** Register the product tools in the exact Agent scope; callers own the disposer. */
export function registerProductTools(agent: Agent, product: ManRoleplayer): () => void {
  // A few host lifecycle tests provide a deliberately minimal AgentHandle;
  // there is no scoped runtime to register into in that seam.
  const scoped = (agent as unknown as { readonly ctx?: { readonly tools?: { register(tool: ToolDefinition): () => void } } }).ctx
  const runtime = scoped?.tools
  if (runtime === undefined) return () => {}
  const tools = productTools(product)
  const dispose = tools.map(tool => runtime.register(tool))
  return () => { for (const unregister of dispose.reverse()) unregister() }
}
