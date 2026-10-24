/** Package-owned invariant companion for `@deepseek-ai/dsh-man-roleplayer`. */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-man-roleplayer'

/** Cordis companion plugin name. */
export const name = 'man-roleplayer-invariant'
/** The invariant registry owns the companion lifecycle. */
export const inject = ['invariants']

/**
 * No runtime invariant: the product event domain is opened and replayed by an
 * owner-held repository, without a cross-service event relation for the
 * invariant registry to observe. Projection and durable replay are asserted
 * by the repository composition suite.
 */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
