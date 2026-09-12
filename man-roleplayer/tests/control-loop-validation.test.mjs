import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateControlLoopEvidence } from '../lib/control-loop-report.js'

const markers = {
  initialUserRaw: 'RAW-INITIAL',
  correctionUserRaw: 'RAW-CORRECTION',
  candidateText: 'CANDIDATE-PRIVATE',
  correctedText: 'STATE-CORRECTED',
  wangReply1: 'WANG-PRIVATE-1',
  zengReply1: 'ZENG-PRIVATE-1',
  zengReply2: 'ZENG-PRIVATE-2',
}

function request(label, persona, content) {
  return { label, persona, sessionId: `session-${persona}`, system: '', messages: [{ role: 'user', text: content }] }
}

function passingEvidence() {
  return {
    requests: [
      request('A1', 'alpha', 'RAW-INITIAL'),
      request('B1', 'beta', 'RAW-INITIAL'),
      request('B2', 'beta', 'RAW-CORRECTION STATE-CORRECTED ZENG-PRIVATE-1'),
      request('A2', 'alpha', 'RAW-CORRECTION STATE-CORRECTED WANG-PRIVATE-1'),
      request('A3', 'alpha', 'RAW-INITIAL RAW-CORRECTION STATE-CORRECTED WANG-PRIVATE-1'),
      request('A_CANCEL', 'alpha', 'cancel'),
    ],
    branchLogs: {
      王阳明: 'RAW-INITIAL RAW-CORRECTION WANG-PRIVATE-1',
      曾国藩: 'RAW-INITIAL RAW-CORRECTION ZENG-PRIVATE-1 ZENG-PRIVATE-2',
    },
    restoredTrunk: {
      userRaws: ['RAW-INITIAL', 'RAW-CORRECTION'],
      dilemmaPhase: 'corrected',
      correctedText: 'STATE-CORRECTED',
    },
    cancelTurnEndKinds: ['completed', 'aborted'],
  }
}

test('兼容性判定器：共享、隔离、恢复和取消证据齐全时通过', () => {
  const summary = evaluateControlLoopEvidence(passingEvidence(), markers)
  assert.equal(summary.passed, true)
  assert.deepEqual(summary.hardGateFailures, [])
})

test('兼容性判定器：另一人物回答进入请求时触发硬门槛失败', () => {
  const evidence = passingEvidence()
  evidence.requests.find(item => item.label === 'B1').messages[0].text += ' WANG-PRIVATE-1'
  const summary = evaluateControlLoopEvidence(evidence, markers)
  assert.equal(summary.passed, false)
  assert.ok(summary.hardGateFailures.includes('B1.no-wang-reply'))
})

test('兼容性判定器：candidate 被注入演员上下文时触发硬门槛失败', () => {
  const evidence = passingEvidence()
  evidence.requests.find(item => item.label === 'A1').messages[0].text += ' CANDIDATE-PRIVATE'
  const summary = evaluateControlLoopEvidence(evidence, markers)
  assert.equal(summary.passed, false)
  assert.ok(summary.hardGateFailures.includes('A1.candidate-not-promoted'))
})

test('兼容性判定器：Trunk 原话顺序或逐字内容变化时触发硬门槛失败', () => {
  const evidence = passingEvidence()
  evidence.restoredTrunk.userRaws.reverse()
  const summary = evaluateControlLoopEvidence(evidence, markers)
  assert.equal(summary.passed, false)
  assert.ok(summary.hardGateFailures.includes('trunk.raw-append-only-recovered'))
})
