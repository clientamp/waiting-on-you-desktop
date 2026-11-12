import { host, type PluginContext } from '@hermes/plugin-sdk'
import {
  contextDraft,
  pickRoute,
  planOpen,
  type ChatTarget,
  type ContextItem,
  type ProfileRoute,
} from './chatRoute'
import { strings } from './strings'
import { notify, notifyError } from './notify'

export type { ChatTarget, ContextItem } from './chatRoute'

type OpenSession = (id: string, opts?: Record<string, unknown>) => Promise<unknown>

interface HostExtras {
  openSession?: OpenSession
  profileRoutes?: () => Promise<ProfileRoute[]>
  composer?: {
    getDraft?: (sessionId: string | null) => Promise<string | null>
    setDraft?: (sessionId: string | null, text: string) => Promise<boolean>
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
    promise.then(
      value => { clearTimeout(timer); resolve(value) },
      error => { clearTimeout(timer); reject(error) },
    )
  })
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export type NewChatComposer = {
  getDraft?: (sessionId: string | null) => Promise<string | null>
  setDraft?: (sessionId: string | null, text: string) => Promise<boolean>
}

/** Open a fresh chat and put the task's context in the composer (not sent). */
export async function openNewChatWithContext(
  navigate: (path: string) => void,
  composer: NewChatComposer | null | undefined,
  text: string,
  onReady: () => void,
  onBlockedDraft: () => void,
): Promise<void> {
  navigate('/')
  const setDraft = composer?.setDraft
  const getDraft = composer?.getDraft
  if (typeof setDraft !== 'function' || typeof getDraft !== 'function') {
    throw new Error('could not fill the new chat')
  }
  const draftBlocks = async (): Promise<boolean> => {
    const existing = await getDraft('new')
    if (typeof existing === 'string' && existing.trim()) {
      onBlockedDraft()
      return true
    }
    return false
  }
  if (await draftBlocks()) return
  // The new-chat composer mounts after the route change; retry briefly.
  for (let attempt = 0; attempt < 15; attempt++) {
    await sleep(attempt === 0 ? 50 : 150)
    if (await draftBlocks()) return
    if (await setDraft('new', text)) {
      onReady()
      return
    }
  }
  throw new Error('could not fill the new chat')
}

/** Open one of this window's own chats in the main pane, the same door the
 *  sidebar uses. For sending an answer; errors reach the caller. */
export async function openChatInPlace(sessionId: string): Promise<void> {
  const open = (host as unknown as HostExtras).openSession
  if (typeof open === 'function') await open(sessionId, { intent: 'in-place' })
  else host.navigate(`/${sessionId}`)
}

/** Open a task's chat in Desktop. Tasks from non-chat sources (support mail,
 *  ntfy) open a new chat with the context pre-filled. Never copies to the
 *  clipboard; when a chat cannot be opened, say why. */
export async function openChat(
  _ctx: PluginContext,
  chatKey: string,
  chatTitle: string,
  target: ChatTarget | null | undefined,
  items: readonly ContextItem[] = [],
): Promise<void> {
  const plan = planOpen(chatKey, target)
  const extras = host as unknown as HostExtras
  const open = extras.openSession

  try {
    if (plan.kind === 'not-a-chat') {
      await openNewChatWithContext(
        path => host.navigate(path),
        extras.composer,
        contextDraft(plan.source, chatTitle, items),
        () => notify(strings.chatContextReady),
        () => notify(strings.chatNewDraftBlocked),
      )
      return
    }

    if (plan.kind === 'main') {
      // Same door the sidebar uses; plain route change only on old hosts.
      if (typeof open === 'function') await open(plan.sessionId, { intent: 'in-place' })
      else host.navigate(`/${plan.sessionId}`)
      return
    }

    let route: ProfileRoute | null = null
    if (typeof extras.profileRoutes === 'function') {
      // Desktop builds this list by probing every connection; a flaky one can
      // stall it. Never let that block the click.
      const routes = await withTimeout(extras.profileRoutes(), 3000).catch(error => {
        notify(`Could not list profile routes (${errorText(error)}); trying defaults.`)
        return [] as ProfileRoute[]
      })
      route = pickRoute(routes, plan.profile, plan.connection, host.state.connectionId.get(), plan.aliases)
    }

    // Let the public SDK carry the owning profile/connection into a new window.
    // Old hosts without this SDK door retain the plain in-place fallback.
    if (typeof open !== 'function') {
      host.navigate(`/${plan.sessionId}`)
      return
    }
    const opts: Record<string, unknown> = {
      intent: 'window',
      profile: plan.profile,
    }
    if (route) opts.route = route
    await open(plan.sessionId, opts)
  } catch (error) {
    console.warn('[waiting-on-you] open chat failed', { chatKey, target, error: errorText(error) })
    notifyError(strings.chatOpenFailed(chatTitle, errorText(error)), JSON.stringify({ chatKey, target }))
  }
}
