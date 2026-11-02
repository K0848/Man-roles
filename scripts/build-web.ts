/** Build the web application with the package manager selected by the parent lifecycle. */

import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pnpmInvocation } from './pnpm-invocation.ts'

// 嵌套构建沿用 npm_execpath，避免 PATH 中的全局 pnpm 覆盖项目锁定版本。
const invocation = pnpmInvocation(['--filter', '@deepseek-ai/dsh-web-frontend', 'run', 'build'])
const result = spawnSync(invocation.command, invocation.args, {
  cwd: resolve(import.meta.dirname, '..'),
  env: process.env,
  stdio: 'inherit',
})
if (result.error !== undefined) throw result.error
if (result.status !== 0) {
  throw new Error(`build:web exited with ${String(result.status ?? result.signal)}`)
}
