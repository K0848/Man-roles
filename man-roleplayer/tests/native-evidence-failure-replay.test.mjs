import test from 'node:test'
import assert from 'node:assert/strict'
import { loadHistoricalFailureFixtures, replayHistoricalFailures } from '../lib/native-evidence-failure-replay.js'

test('historical real reports are replayed from a stable sanitized fixture', () => {
  const fixtures = loadHistoricalFailureFixtures()
  assert.equal(fixtures.length, 6)
  assert.ok(fixtures.every((fixture) => fixture.sourceRunId.startsWith('real-')))
  assert.ok(fixtures.every((fixture) => fixture.totalTokens >= 0 && fixture.tokenLimit === 20_000))
  assert.deepEqual(fixtures.map((fixture) => fixture.kind), [
    'cacheRead-budget-overrun', 'evidence-followed-by-raw-text', 'repair-followed-by-raw-text',
    'duplicate-successful-submit', 'quote-normalization-mismatch', 'cross-person-fence-rejection',
  ])
})

test('replay identifies all known failures and does not claim real-model success', () => {
  const replay = replayHistoricalFailures()
  assert.equal(replay.length, 6)
  assert.ok(replay.every((item) => item.identified && item.historicalReportReplay && !item.scriptedNativeAgentLoop))
  assert.equal(replay.find((item) => item.kind === 'cacheRead-budget-overrun').state, 'budget-blocked')
  assert.equal(replay.find((item) => item.kind === 'evidence-followed-by-raw-text').state, 'repairable')
  assert.equal(replay.find((item) => item.kind === 'repair-followed-by-raw-text').state, 'repairable')
  assert.equal(replay.find((item) => item.kind === 'duplicate-successful-submit').state, 'rejected')
  assert.equal(replay.find((item) => item.kind === 'quote-normalization-mismatch').state, 'pass-after-normalization')
  assert.equal(replay.find((item) => item.kind === 'cross-person-fence-rejection').state, 'pass-after-fence')
})
