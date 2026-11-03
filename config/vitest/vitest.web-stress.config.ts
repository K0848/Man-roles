import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { vitestExecArgv } from './vitest.shared.ts'

/** Opt-in browser performance lane; no default Vitest config includes *.stress.ts. */
export default defineConfig({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  resolve: { tsconfigPaths: true },
  plugins: [],
  test: {
    execArgv: vitestExecArgv,
    include: ['apps/web/stress-tests/**/*.stress.ts'],
    testTimeout: 600_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
})
