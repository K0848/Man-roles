import test from 'node:test'
import assert from 'node:assert/strict'
import { runMvpHost } from '../lib/mvp-host.js'
import { validateMvpReport } from '../lib/mvp-report.js'

test('MVP host derives a zero-cost report from the normal ProductService path', async () => {
  const report = await runMvpHost()
  assert.equal(report.trace.productConversations, 1)
  assert.equal(report.trace.userRaws >= 5, true)
  assert.equal(report.trace.taskCalls, 1)
  assert.equal(report.providerNetworkUsed, false)
  assert.equal(report.tokenCost, 0)
})

test('MVP report rejects provider, token, and product trace mutation', () => {
  const base = { schemaVersion: 1, providerNetworkUsed: false, tokenCost: 0, scenarios: ['normal-product-send'], passed: true, trace: { productConversations: 1, userRaws: 1, branchEvents: 1, taskCalls: 0, firstAccepted: true, secondAccepted: true, switchedTo: 'persona', retryDidNotAppend: true, deliveryInterrupted: true, cancelLateResultRejected: true, budgetDurable: true, budgetPersonaIsOriginal: true } }
  assert.equal(validateMvpReport(base).passed, true)
  assert.throws(() => validateMvpReport({ ...base, providerNetworkUsed: true }))
  assert.throws(() => validateMvpReport({ ...base, tokenCost: 1 }))
  assert.throws(() => validateMvpReport({ ...base, trace: { ...base.trace, productConversations: 2 } }))
  assert.throws(() => validateMvpReport({ ...base, trace: { ...base.trace, budgetDurable: false } }))
})
