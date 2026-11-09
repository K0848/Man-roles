/** Knip 的公开扫描清单与 Cordis 运行时装配证据。 */

import { fileURLToPath } from 'node:url'
import type { KnipConfiguration } from 'knip'
import base from './knip.json' with { type: 'json' }
import { configureCordisKnip } from '../../scripts/knip-cordis.ts'

// 装配-only 包保留既有 peer+dev 契约；不伪造 import，也不全局忽略工作区依赖。
export default configureCordisKnip(fileURLToPath(new URL('../../', import.meta.url)), base as KnipConfiguration, {
  bundleDirectory: 'packages/bundle/man-roleplayer-app',
  inheritedWorkspace: 'packages/*/*',
  profileSource: 'packages/boot/app-boot/src/profile.ts',
  browserSeed: { owner: '@deepseek-ai/dsh-web-app', source: 'packages/client/web/src/seed.ts' },
})
