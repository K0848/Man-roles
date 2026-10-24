/** Browser object layer for the variable-branch dilemma projection and controls. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import { createElement } from 'react'
import { RoleplayerProjectionStore } from './store.ts'
import { RoleplayerView } from './RoleplayerView.tsx'
import { PersonaDeck } from './PersonaDeck.tsx'
import type { RoleplayerRemote } from './store.ts'

declare module '@deepseek-ai/cordis' {
  interface Context { manRoleplayerClient: RoleplayerProjectionStore }
}

/** Services required by the client projection owner. */
// The Remote namespace is optional at first. A missing Host must render the
// explicit unavailable state immediately; a later namespace registration is
// observed through the global service event below.
export const inject = ['slots']

export type {
  RoleplayerConversationSelector, RoleplayerDetailsSelector, RoleplayerRemote,
  RoleplayerSidebarSelector, RoleplayerStoreStatus, RoleplayerStoreView,
} from './store.ts'

/** Fail-closed product root when the Remote namespace is not mounted. */
export function RoleplayerUnavailableView() {
  return createElement('section', {
    'data-roleplayer-unavailable': 'true',
    'aria-label': '困惑产品暂不可用',
  }, createElement('p', null, '困惑产品暂不可用，请稍后重试'))
}

/** Install or replace the projection surface as the Host Remote namespace appears. */
export function apply(ctx: ClientContext): void {
  let disposeSurface: (() => void) | undefined
  let disposeStore: (() => Promise<void>) | undefined
  let disposeClientService: (() => void) | undefined

  const clearSurface = (): void => {
    disposeSurface?.()
    disposeSurface = undefined
    void disposeStore?.()
    disposeStore = undefined
    disposeClientService?.()
    disposeClientService = undefined
  }

  const mountSurface = (): void => {
    clearSurface()
    const remote = ctx.get('remote.manRoleplayerRemote') as RoleplayerRemote | undefined
    if (remote === undefined) {
      disposeSurface = ctx.slots.register({ name: 'root', priority: 20 }, RoleplayerUnavailableView)
      return
    }
    const selectionKey = 'man-roleplayer:selected'
    const store = new RoleplayerProjectionStore(remote, {
      read: () => {
        try { return localStorage.getItem(selectionKey) as import('@deepseek-ai/dsh-man-roleplayer/types').DilemmaHandle | null }
        catch { return null } // Browser privacy policies may disable persistence; in-memory selection remains usable.
      },
      write: (handle) => {
        try { if (handle === null) localStorage.removeItem(selectionKey); else localStorage.setItem(selectionKey, handle) }
        catch { /* Browser storage denial must not block the current conversation. */ }
      },
    })
    disposeClientService = ctx.provide('manRoleplayerClient', store)
    disposeStore = ctx.effect(() => {
      const description = (ctx.get('connection') as ConnectionHandle | undefined)?.hostDescription
      const syncConnection = (): void => { store.setConnected(description?.getSnapshot() !== undefined) }
      const stopConnection = description?.subscribe(syncConnection)
      if (description === undefined) void store.refresh(true)
      else syncConnection()
      return () => { stopConnection?.(); store.dispose() }
    }, 'man-roleplayer client projection')
    disposeSurface = ctx.slots.register({
      name: 'root', priority: 20,
      children: { 'manRoleplayer.personaDeck': { kind: 'single', scope: 'root' } },
      inject: () => ({ hooks: { roleplayer: store }, store }),
    }, RoleplayerView)
  }

  ctx.slots.inject('manRoleplayer.personaDeck', () => ctx.slots.register({ name: 'manRoleplayer.personaDeck' }, PersonaDeck))
  mountSurface()
  const stopServiceWatch = ctx.on('internal/service', (name) => {
    if (name === 'remote.manRoleplayerRemote') mountSurface()
  }, { global: true })
  ctx.effect(() => () => {
    stopServiceWatch()
    clearSurface()
  }, 'man-roleplayer client surface lifecycle')
}
