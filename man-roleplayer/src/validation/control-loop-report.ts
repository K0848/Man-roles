/**
 * DSH AgentLoop 兼容性切片的纯逻辑判定器。
 *
 * 这里不判断自然语言语义，只核对产品红线是否在真实请求和持久化结果中成立：
 * 共享用户原话/纠正状态必须可见，另一人物回答必须不可见，候选不得越权共享，
 * 恢复后历史必须连续，取消必须留下 aborted 终态。
 */

export interface CapturedLoopRequest {
  label: 'A1' | 'B1' | 'B2' | 'A2' | 'A3' | 'A_CANCEL'
  persona: '王阳明' | '曾国藩'
  sessionId: string
  system: string
  messages: Array<{ role: string; text: string }>
}

export interface ControlLoopMarkers {
  initialUserRaw: string
  correctionUserRaw: string
  candidateText: string
  correctedText: string
  wangReply1: string
  zengReply1: string
  zengReply2: string
}

export interface ControlLoopEvidence {
  requests: CapturedLoopRequest[]
  branchLogs: {
    王阳明: string
    曾国藩: string
  }
  restoredTrunk: {
    userRaws: string[]
    dilemmaPhase: string
    correctedText: string | null
  }
  cancelTurnEndKinds: string[]
}

export interface ValidationCheck {
  id: string
  category: 'shared-context' | 'persona-isolation' | 'recovery' | 'lifecycle'
  gate: boolean
  passed: boolean
  detail: string
}

export interface ControlLoopValidationSummary {
  passed: boolean
  hardGateFailures: string[]
  checks: ValidationCheck[]
}

function requestText(request: CapturedLoopRequest | undefined): string {
  if (request === undefined) return ''
  return [request.system, ...request.messages.map(message => message.text)].join('\n')
}

function has(text: string, marker: string): boolean {
  return marker !== '' && text.includes(marker)
}

/**
 * 对固定兼容性场景做红线判定。所有检查都是字符串可证伪的结构检查，
 * 不用关键词推断用户意图，也不参与业务状态解释。
 */
export function evaluateControlLoopEvidence(
  evidence: ControlLoopEvidence,
  markers: ControlLoopMarkers,
): ControlLoopValidationSummary {
  const byLabel = new Map(evidence.requests.map(request => [request.label, request]))
  const text = (label: CapturedLoopRequest['label']) => requestText(byLabel.get(label))
  const checks: ValidationCheck[] = []

  const add = (
    id: string,
    category: ValidationCheck['category'],
    passed: boolean,
    detail: string,
    gate = true,
  ): void => {
    checks.push({ id, category, gate, passed, detail })
  }

  add('A1.sees-initial-user-raw', 'shared-context', has(text('A1'), markers.initialUserRaw),
    '王阳明首轮必须看到用户逐字原话')
  add('A1.candidate-not-promoted', 'shared-context', !has(text('A1'), markers.candidateText),
    '未经确认的 candidate 不得作为演员上下文事实')

  add('B1.sees-initial-user-raw', 'shared-context', has(text('B1'), markers.initialUserRaw),
    '曾国藩首次进入必须无感接续同一困惑的用户原话')
  add('B1.no-wang-reply', 'persona-isolation', !has(text('B1'), markers.wangReply1),
    '曾国藩不得看到王阳明回答')
  add('B1.no-candidate', 'persona-isolation', !has(text('B1'), markers.candidateText),
    '曾国藩不得把未确认导演候选当共享事实')

  add('B2.sees-correction-raw', 'shared-context', has(text('B2'), markers.correctionUserRaw),
    '用户纠正原话必须进入当前人物下一轮输入')
  add('B2.sees-corrected-state', 'shared-context', has(text('B2'), markers.correctedText),
    '纠正后的共享状态必须在下一轮生成前生效')
  add('B2.no-wang-reply', 'persona-isolation', !has(text('B2'), markers.wangReply1),
    '纠正后仍不得泄露王阳明回答')

  add('A2.sees-correction-raw', 'shared-context', has(text('A2'), markers.correctionUserRaw),
    '切回王阳明后必须看到跨人物共享的用户纠正原话')
  add('A2.sees-corrected-state', 'shared-context', has(text('A2'), markers.correctedText),
    '切回王阳明后必须看到纠正后的共享状态')
  add('A2.keeps-own-history', 'persona-isolation', has(text('A2'), markers.wangReply1),
    '切回王阳明后必须恢复王阳明自己的历史')
  add('A2.no-zeng-replies', 'persona-isolation',
    !has(text('A2'), markers.zengReply1) && !has(text('A2'), markers.zengReply2),
    '王阳明不得看到曾国藩回答')

  add('branch.wang-no-zeng-replies', 'persona-isolation',
    !has(evidence.branchLogs.王阳明, markers.zengReply1)
      && !has(evidence.branchLogs.王阳明, markers.zengReply2),
    '王阳明 BranchSession 日志不得含曾国藩回答')
  add('branch.zeng-no-wang-reply', 'persona-isolation',
    !has(evidence.branchLogs.曾国藩, markers.wangReply1),
    '曾国藩 BranchSession 日志不得含王阳明回答')

  add('A3.resume-keeps-own-history', 'recovery', has(text('A3'), markers.wangReply1),
    'AgentLoop resume 后必须恢复王阳明历史')
  add('A3.resume-keeps-correction', 'recovery',
    has(text('A3'), markers.correctionUserRaw) && has(text('A3'), markers.correctedText),
    'AgentLoop resume 后必须继续读取纠正原话与纠正状态')
  add('A3.resume-no-zeng-replies', 'recovery',
    !has(text('A3'), markers.zengReply1) && !has(text('A3'), markers.zengReply2),
    'AgentLoop resume 后仍不得泄露曾国藩回答')

  add('trunk.raw-append-only-recovered', 'recovery',
    evidence.restoredTrunk.userRaws.length === 2
      && evidence.restoredTrunk.userRaws[0] === markers.initialUserRaw
      && evidence.restoredTrunk.userRaws[1] === markers.correctionUserRaw,
    'Trunk 重放后应按原顺序逐字保留两条用户原话')
  add('trunk.corrected-state-recovered', 'recovery',
    evidence.restoredTrunk.dilemmaPhase === 'corrected'
      && evidence.restoredTrunk.correctedText === markers.correctedText,
    'Trunk 重放后应恢复 corrected 状态')

  add('agent-loop.cancel-aborted', 'lifecycle', evidence.cancelTurnEndKinds.includes('aborted'),
    'AgentLoop 中途取消必须以 aborted turn/end 收束')

  const hardGateFailures = checks.filter(check => check.gate && !check.passed).map(check => check.id)
  return { passed: hardGateFailures.length === 0, hardGateFailures, checks }
}
