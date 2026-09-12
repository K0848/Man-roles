export type StartupFailureCode = 'MISSING_CREDENTIAL' | 'NO_ADAPTER' | string
export type StartupRetryAction = { kind: 'retry' } | undefined
export async function decideStartupRetry(agentMatches: boolean, code: StartupFailureCode | undefined, retryCount: number, wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))): Promise<StartupRetryAction> {
  if (!agentMatches || (code !== 'MISSING_CREDENTIAL' && code !== 'NO_ADAPTER') || retryCount >= 30) return undefined
  await wait(500)
  return { kind: 'retry' }
}
