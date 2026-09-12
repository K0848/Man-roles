/**
 * man-roles-roleplayer —— 领域事件定义与 session 事件映射。
 *
 * DSH 事件契约（阶段 3 实测源码确认）：
 *  - `SessionEventMap` 是 merge-extensible（声明合并），外部插件可扩展事件类型；
 *  - 自定义事件为 log-only（非 surface 事件，不带 surfaceOp）；
 *  - 持久化注意：仓库内 `KNOWN_SESSION_EVENT_TYPES` 不含插件事件，且
 *    `Session.append()` 不提供 `ignorable` 写入通道 → 自定义事件落盘后重启恢复
 *    会被 `session-persistence` 的 `assertEventsSupported` 拒绝（阶段 3 适配结论，
 *    详见 README；本阶段不修改 DSH Core）。
 */
import type { DilemmaDomainEvent } from './domain/schema.ts'
import type { PersonaId } from './domain/schema.ts'
import type { DilemmaFoldInput } from './domain/dilemma.ts'
import {
  dilemmaCandidateEventSchema,
  dilemmaConfirmedEventSchema,
  dilemmaCorrectedEventSchema,
} from './domain/schema.ts'

/** 自定义事件类型常量。 */
export const DILEMMA_CANDIDATE = 'man-roles/dilemma/candidate' as const
export const DILEMMA_CONFIRMED = 'man-roles/dilemma/confirmed' as const
export const DILEMMA_CORRECTED = 'man-roles/dilemma/corrected' as const

/**
 * 扩展 DSH 的 session 事件表（纯类型声明，构建时擦除）。
 * 让 `session.append('man-roles/dilemma/candidate', data)` 通过类型检查。
 */
declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    'man-roles/dilemma/candidate': {
      turnId: string
      taskId: string
      invocationId: string
      persona: PersonaId
      text: string
    }
    'man-roles/dilemma/confirmed': {
      turnId: string
      taskId: string
      invocationId: string
      text: string
    }
    'man-roles/dilemma/corrected': {
      turnId: string
      taskId: string
      invocationId: string
      text: string
    }
  }
}

/**
 * 把一条 session 事件映射为状态机 fold 输入。
 * @param event - session 事件（只读访问 type/seq/data）。
 * @returns fold 输入；无关事件返回 null。
 */
export function toFoldInput(event: {
  type: string
  seq: number
  data: unknown
}): DilemmaFoldInput | null {
  switch (event.type) {
    case 'user/message':
      return { type: 'user/message', seq: event.seq }
    case DILEMMA_CANDIDATE: {
      const parsed = dilemmaCandidateEventSchema.safeParse(event.data)
      if (!parsed.success) return null
      return { type: DILEMMA_CANDIDATE, seq: event.seq, data: parsed.data }
    }
    case DILEMMA_CONFIRMED: {
      const parsed = dilemmaConfirmedEventSchema.safeParse(event.data)
      if (!parsed.success) return null
      return { type: DILEMMA_CONFIRMED, seq: event.seq, data: parsed.data }
    }
    case DILEMMA_CORRECTED: {
      const parsed = dilemmaCorrectedEventSchema.safeParse(event.data)
      if (!parsed.success) return null
      return { type: DILEMMA_CORRECTED, seq: event.seq, data: parsed.data }
    }
    default:
      return null
  }
}

/** 类型助手：领域事件（含 seq）——供声明合并后的 append 调用与 E2E 使用。 */
export type { DilemmaDomainEvent }
