/** Pure helpers for opening a chat. No SDK imports, so tests can load them. */

export interface ChatTarget {
  session_id: string
  profile: string | null
  connection: string | null
  /** Every Desktop connection id this host may be saved under on a client Mac. */
  connection_aliases?: string[]
}

/** Credential-free route descriptor as returned by host.profileRoutes(). */
export interface ProfileRoute {
  connectionId: string
  mode: 'local' | 'remote'
  primary?: true
  profile: string
  targetProfile: string
}

export type OpenPlan =
  | { kind: 'main'; sessionId: string }
  | { kind: 'profile'; sessionId: string; profile: string; connection: string | null; aliases?: string[] }
  | { kind: 'not-a-chat'; source: string }

/** Decide how to open a task's chat. Keys with no colon are main-profile chats;
 *  keys with a prefix but no target come from a non-chat source (e.g. mail history). */
export function planOpen(chatKey: string, target: ChatTarget | null | undefined): OpenPlan {
  if (target) {
    if (!target.profile && !target.connection) return { kind: 'main', sessionId: target.session_id }
    return {
      kind: 'profile',
      sessionId: target.session_id,
      profile: target.profile ?? 'default',
      connection: target.connection,
      ...(target.connection_aliases?.length ? { aliases: target.connection_aliases } : {}),
    }
  }
  if (!chatKey.includes(':')) return { kind: 'main', sessionId: chatKey }
  // Agent chats whose target was lost on the way: rebuild from the key.
  const [prefix, rest] = [chatKey.slice(0, chatKey.indexOf(':')), chatKey.slice(chatKey.indexOf(':') + 1)]
  if (/^\d{8}_\d{6}_[0-9a-f]+$|^[0-9a-f]{12}$|^local-[0-9a-f]{64}$/i.test(rest)) {
    return { kind: 'profile', sessionId: rest, profile: prefix.toLowerCase(), connection: null }
  }
  return { kind: 'not-a-chat', source: chatKey.split(':', 1)[0] }
}

/** Profile + connection for Desktop's session window. A registered route wins
 *  (its `profile` is the Desktop-side profile key for that connection). */
export function windowOptions(
  plan: { profile: string; connection: string | null },
  route: ProfileRoute | null,
  activeConnectionId: string | null = null,
): { profile: string; connectionId: string | null } {
  if (route) return { profile: route.profile, connectionId: route.connectionId }
  return { profile: plan.profile, connectionId: plan.connection ?? activeConnectionId }
}

export interface ContextAction {
  id: string
  label: string
  confirm?: string
  style?: 'primary' | 'default' | 'danger'
  kind?: 'run' | 'details'
}

export interface ContextItem {
  topic?: string
  ask: string
  source_excerpt?: string | null
  actions?: ContextAction[]
}

const SOURCE_NAMES: Record<string, string> = {
  mailhist: 'support mail history',
  ntfy: 'an ntfy alert',
}

/** Starter text for a new chat about a task that did not come from a chat. */
export function contextDraft(source: string, title: string, items: readonly ContextItem[]): string {
  const from = SOURCE_NAMES[source.toLowerCase()] ?? source
  const lines = [`From Waiting On You (${from}): ${title}`, '']
  for (const item of items) {
    const ask = item.ask.trim()
    if (!ask) continue
    const topic = item.topic?.trim()
    lines.push(`- ${topic && topic !== title ? `${topic}: ` : ''}${ask}`)
    const excerpt = item.source_excerpt?.trim()
    if (excerpt) {
      lines.push('  Source:')
      for (const line of excerpt.split('\n')) {
        lines.push(`    ${line}`)
      }
    }
    const runLabels = (item.actions ?? [])
      .filter(a => (a.kind ?? 'run') === 'run')
      .map(a => a.label)
    if (runLabels.length > 0) {
      lines.push(`  Options on the card: ${runLabels.join(', ')}`)
    }
  }
  lines.push('', 'Help me handle this.')
  return lines.join('\n')
}

/** Pick the registered Desktop route for a chat. With a connection id, match that
 *  connection; without one (another profile on the same Hermes), prefer the
 *  route on the connection Desktop is using now, then the primary. */
export function pickRoute(
  routes: readonly ProfileRoute[],
  profile: string,
  connection: string | null,
  activeConnectionId: string | null,
  aliases: readonly string[] = [],
): ProfileRoute | null {
  const want = profile.trim().toLowerCase() || 'default'
  const matches = routes.filter(r => (r.targetProfile || r.profile || '').toLowerCase() === want)
  if (connection) {
    for (const id of [connection, ...aliases]) {
      const hit = matches.find(r => r.connectionId === id)
      if (hit) return hit
    }
    return null
  }
  return (
    (activeConnectionId ? matches.find(r => r.connectionId === activeConnectionId) : undefined) ??
    matches.find(r => r.primary) ??
    null
  )
}
