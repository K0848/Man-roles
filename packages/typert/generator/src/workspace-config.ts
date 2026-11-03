/** Resolve independent compiler faces from a workspace's solution references. */

import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import ts from 'typescript'
import type { TypertFace } from './model.ts'

/**
 * Find one face without flattening the root solution into a program.
 * @param root - workspace root containing the optional solution config.
 * @param face - independent compiler face to resolve.
 * @returns solution-owned path, or the conventional name used by standalone workspaces.
 */
export function workspaceFaceConfig(root: string, face: TypertFace): string {
  const conventional = `tsconfig.${face}.json`
  const solution = join(root, 'tsconfig.json')
  if (!existsSync(solution)) return conventional
  const parsed = ts.readConfigFile(solution, path => ts.sys.readFile(path))
  if (parsed.error !== undefined) {
    throw new Error(`typert-generator: ${ts.flattenDiagnosticMessageText(parsed.error.messageText, '\n')}`)
  }
  const config = parsed.config as { references?: { path: string }[] }
  // 根 solution 是目录布局的权威入口；独立调用方仍可显式指定自己的编译配置。
  return config.references?.find(reference => basename(reference.path) === conventional)?.path ?? conventional
}
