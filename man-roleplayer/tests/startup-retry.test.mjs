import test from 'node:test'
import assert from 'node:assert/strict'
import { decideStartupRetry } from '../lib/startup-retry.js'

test('startup retry only handles scoped credential/adapter races up to 30 attempts', async () => {
  const waits = []; const fakeWait = async (ms) => { waits.push(ms) }
  assert.deepEqual(await decideStartupRetry(true, 'MISSING_CREDENTIAL', 0, fakeWait), { kind: 'retry' })
  assert.deepEqual(await decideStartupRetry(true, 'NO_ADAPTER', 29, fakeWait), { kind: 'retry' })
  assert.deepEqual(waits, [500, 500])
  assert.equal(await decideStartupRetry(true, 'MISSING_CREDENTIAL', 30, fakeWait), undefined)
  assert.equal(await decideStartupRetry(true, 'RATE_LIMIT', 0, fakeWait), undefined)
  assert.equal(await decideStartupRetry(false, 'NO_ADAPTER', 0, fakeWait), undefined)
})
