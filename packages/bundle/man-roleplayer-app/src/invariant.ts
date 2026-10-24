/** Package-owned invariant companion for the man-roleplayer Web profile. */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-man-roleplayer-app'
export const name = 'man-roleplayer-app-invariant'
export const inject = ['invariants']
// No runtime invariant: this bundle only carries a patch list; the Host and
// client packages own the runtime state and their own invariant companions.
const install: InvariantInstaller = () => {}
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
