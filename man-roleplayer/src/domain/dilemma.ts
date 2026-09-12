/**
 * man-roles-roleplayer —— 困惑状态机（纯函数，无 DSH 运行时依赖）。
 *
 * 覆盖 task_plan 验收标准：
 *  - `dilemma_candidate` 在未确认前不升级为 confirmed（F001）；
 *  - 确认/纠正事件后状态正确转换；
 *  - `user_raw` 引用只增不改。
 *
 * 事件来源：session 事件流（自定义事件 `man-roles/dilemma/*` + `user/message`）。
 * 本模块只做纯 fold，不接触 session 对象，便于单元测试。
 */
import type {
  DilemmaDomainEvent,
  DilemmaState,
} from './schema.ts'
import { initialDilemmaState } from './schema.ts'
import type { DilemmaItem } from './schema.ts'

/** Compatibility view derived exclusively from the revision collection. */
export function deriveLegacyDilemma(items: readonly DilemmaItem[]): { phase: 'pending'|'candidate'|'confirmed'; candidateText: string|null; confirmedText: string|null } {
  const active = [...items].filter((item) => item.status !== 'superseded').sort((a, b) => b.revision - a.revision)
  const confirmed = active.find((item) => item.status === 'confirmed' && item.visibility === 'shared-confirmed')
  if (confirmed) return { phase: 'confirmed', candidateText: null, confirmedText: confirmed.text }
  const candidate = active.find((item) => item.status === 'candidate' && item.visibility === 'origin-persona-only')
  if (candidate) return { phase: 'candidate', candidateText: candidate.text, confirmedText: null }
  return { phase: 'pending', candidateText: null, confirmedText: null }
}

/** 用户消息事件在 fold 中的投影形态（只取状态机需要的字段）。 */
export interface UserRawEventRef {
  type: 'user/message'
  seq: number
}

/** fold 输入：领域事件或 user/message 引用。 */
export type DilemmaFoldInput = DilemmaDomainEvent | UserRawEventRef

/**
 * 折叠一个事件到困惑状态。
 * @param state - 当前状态（不可变，返回新状态；无关事件返回原引用）。
 * @param event - 下一个事件。
 * @returns 下一状态。
 */
export function transition(state: DilemmaState, event: DilemmaFoldInput): DilemmaState {
  switch (event.type) {
    case 'user/message':
      // user_raw 引用只增：seq 已记录则跳过，否则追加（事件日志 append-only，
      // 这里只维护索引，绝不改写任何 user/message 内容）。
      if (state.userRawRefs.includes(event.seq)) return state
      return { ...state, userRawRefs: [...state.userRawRefs, event.seq] }

    case 'man-roles/dilemma/candidate': {
      // F001：候选仅在 pending 时进入 candidate；已确认/纠正的状态不被候选覆盖。
      if (state.phase !== 'pending') return state
      return {
        ...state,
        phase: 'candidate',
        activePersona: event.data.persona,
        candidateText: event.data.text,
        updatedBySeq: event.seq ?? state.updatedBySeq,
      }
    }

    case 'man-roles/dilemma/confirmed': {
      // 用户确认前置：只有 candidate 状态才可升级为 confirmed。
      if (state.phase !== 'candidate') return state
      return {
        ...state,
        phase: 'confirmed',
        candidateText: null,
        confirmedText: event.data.text,
        updatedBySeq: event.seq ?? state.updatedBySeq,
      }
    }

    case 'man-roles/dilemma/corrected': {
      // 用户纠正前置：只有 candidate 状态才可转为 corrected。
      if (state.phase !== 'candidate') return state
      return {
        ...state,
        phase: 'corrected',
        candidateText: null,
        correctedText: event.data.text,
        updatedBySeq: event.seq ?? state.updatedBySeq,
      }
    }

    default:
      return state
  }
}

/**
 * 从事件序列折叠出状态（纯 fold，测试与投影共用语义）。
 * @param events - 有序事件列表（session 事件顺序）。
 * @param persona - 初始人物。
 * @returns fold 结果状态。
 */
export function foldDilemmaState(
  events: readonly DilemmaFoldInput[],
  persona: Parameters<typeof initialDilemmaState>[0],
): DilemmaState {
  let state = initialDilemmaState(persona)
  for (const event of events) state = transition(state, event)
  return state
}

/** 语义判断辅助：把用户反馈文本归类为「确认 / 纠正 / 未确认」（不固定措辞，演示级关键词匹配）。 */
export type FeedbackVerdict = 'confirmed' | 'corrected' | 'unconfirmed'

const CONFIRM_MARKERS = ['对', '是的', '没错', '就是这样', '正是', '对，我困惑', '同意', '确认']
const CORRECT_MARKERS = ['不对', '不是', '纠正', '其实是', '我想说的是', '不完全是', '改一下', '重新说']

/**
 * 由用户反馈文本做语义判断（阶段 3 为演示级关键词匹配；生产需换模型判断，接缝不变）。
 * @param feedback - 用户本轮反馈原话。
 * @returns 判定结果。
 */
export function judgeFeedback(feedback: string): FeedbackVerdict {
  if (CORRECT_MARKERS.some((m) => feedback.includes(m))) return 'corrected'
  if (CONFIRM_MARKERS.some((m) => feedback.includes(m))) return 'confirmed'
  return 'unconfirmed'
}
