/**
 * man-roles-roleplayer —— 困惑状态 Projection 单元。
 *
 * 复用阶段 2 实测形态：`ctx.sessionProjections.register({key, stateSchema, init,
 * apply, wire, stateVersion})`。apply 为纯同步 fold：把 session 事件映射为
 * 领域事件后走 domain 状态机；无关事件返回原引用（零下游工作）。
 *
 * 注册即生效：registry 订阅 `session/event`，本插件 append 的自定义事件
 * 会驱动本单元前进，`snapshot()` 输出 `{asOfSeq, values}`（client 可见，
 * 经 wire view 校验），供 UI 与下一轮上下文读取。
 */
import { dilemmaStateSchema } from '../domain/schema.ts'
import type { DilemmaState } from '../domain/schema.ts'
import { transition } from '../domain/dilemma.ts'
import { toFoldInput } from '../events.ts'

/**
 * 扩展投影类型表（纯类型声明，构建时擦除）：
 * host fold 状态（SessionProjectionStateMap）与 client 视图（SessionProjectionMap）
 * 共用同一形状。
 */
declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    'man-roles/dilemma': DilemmaState
  }
  interface SessionProjectionMap {
    'man-roles/dilemma': DilemmaState
  }
}

/** 投影单元 key。 */
export const DILEMMA_PROJECTION_KEY = 'man-roles/dilemma'

/** 返回本插件的 ProjectionDefinition（类型注释来自 @deepseek-ai/dsh-session-projection）。 */
export function dilemmaProjectionDefinition(): {
  key: string
  stateSchema: typeof dilemmaStateSchema
  init: () => DilemmaState
  apply: (state: DilemmaState, event: unknown) => DilemmaState
  wire: { viewSchema: typeof dilemmaStateSchema; view: (state: DilemmaState) => DilemmaState }
  stateVersion: number
} {
  return {
    key: DILEMMA_PROJECTION_KEY,
    stateSchema: dilemmaStateSchema,
    init: () => ({
      phase: 'pending',
      // A projection can exist before any persona-bearing event arrives. Keep
      // this explicitly uninitialized instead of inventing a default person.
      activePersona: null,
      candidateText: null,
      confirmedText: null,
      correctedText: null,
      userRawRefs: [],
      updatedBySeq: -1,
    }),
    apply: (state, event) => {
      // event 是 session 事件（只读 {type, seq, data}）；无关事件返回原引用。
      if (typeof event !== 'object' || event === null) return state
      const input = toFoldInput(event as { type: string; seq: number; data: unknown })
      return input === null ? state : transition(state, input)
    },
    wire: {
      viewSchema: dilemmaStateSchema,
      view: (state) => state,
    },
    stateVersion: 1,
  }
}
