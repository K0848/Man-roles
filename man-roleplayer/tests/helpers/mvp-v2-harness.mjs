import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * MVP v2 零费用测试夹具。
 *
 * Provider 是禁止调用探针，而不是模型替身；任何属性被当作方法调用都会留下
 * 可观察记录并立即失败，防止契约测试误触真实模型或把自由生成当成确定性证据。
 */
export function createMvpV2Harness(prefix = 'man-roles-mvp-v2-') {
  const root = mkdtempSync(join(tmpdir(), prefix))
  const externalCalls = []
  let tokenCost = 0
  let cleaned = false
  const provider = new Proxy({}, {
    get(_target, property) {
      if (property === 'then') return undefined
      return (...args) => {
        externalCalls.push({ method: String(property), argumentCount: args.length })
        throw new Error(`provider call is forbidden in zero-cost tests: ${String(property)}`)
      }
    },
  })

  return {
    root,
    provider,
    recordTokenCost(value) {
      if (!Number.isFinite(value) || value < 0) throw new TypeError('token cost must be a non-negative finite number')
      tokenCost += value
    },
    get observation() {
      return {
        providerNetworkUsed: externalCalls.length > 0,
        tokenCost,
        externalCalls: externalCalls.map((call) => ({ ...call })),
      }
    },
    cleanup() {
      if (cleaned) return
      cleaned = true
      rmSync(root, { recursive: true, force: true })
    },
  }
}

export function assertZeroCost(assert, observation) {
  assert.equal(observation.providerNetworkUsed, false)
  assert.equal(observation.tokenCost, 0)
  assert.deepEqual(observation.externalCalls, [])
}

export function readUtf8(url) {
  return readFileSync(url, 'utf8')
}

export function uniqueRequirementIds(markdown) {
  return [...new Set([...markdown.matchAll(/PRD-[A-Z]+-\d{3}/g)].map((match) => match[0]))]
}
