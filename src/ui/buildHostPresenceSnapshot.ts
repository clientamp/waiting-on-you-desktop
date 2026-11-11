import type { HostPresenceSnapshot } from './chatPresence'
import { hostPresenceCapabilities } from './chatPresence'
import type { FocusedChatSelection } from './followChat'

/** Pure snapshot from atom reads — shared by the hook and lifecycle tests. */
export function buildHostPresenceSnapshot(input: {
  capsState: unknown
  focusedStored: string | null
  focusedRuntime: string | null
  sessionActive: string | null
  profile: string | null
  owner: FocusedChatSelection['owner']
  busy: boolean
  awaitingResponse: boolean
  busyBySession: Record<string, boolean>
}): HostPresenceSnapshot {
  const caps = hostPresenceCapabilities(input.capsState)
  const selection: FocusedChatSelection = {
    sessionId: input.focusedStored ?? input.sessionActive,
    profile: input.profile,
    owner: input.owner,
  }
  return {
    caps,
    selection,
    busy: input.busy,
    awaitingResponse: input.awaitingResponse,
    busyBySession: input.busyBySession,
    focusedSessionId: input.focusedRuntime,
  }
}
