import { host, useValue } from '@hermes/plugin-sdk'
import { useMemo } from 'react'
import { buildHostPresenceSnapshot } from './buildHostPresenceSnapshot'
import { hostPresenceCapabilities } from './chatPresence'
import { HOST_PRESENCE_FALLBACK_ATOMS } from './hostPresenceFallbacks'

/** Live snapshot of the host conversation atoms WoU may read (public SDK only). */
export function useHostPresenceSnapshot() {
  const focusedStoredAtom =
    host.state.focusedStoredSessionId ?? HOST_PRESENCE_FALLBACK_ATOMS.focusedStoredSessionId
  const focusedRuntimeAtom =
    host.state.focusedSessionId ?? HOST_PRESENCE_FALLBACK_ATOMS.focusedSessionId
  const profileAtom =
    host.state.focusedSessionProfile ?? HOST_PRESENCE_FALLBACK_ATOMS.focusedSessionProfile
  const ownerAtom =
    host.state.focusedSessionOwner ?? HOST_PRESENCE_FALLBACK_ATOMS.focusedSessionOwner
  const busyAtom = host.state.busy ?? HOST_PRESENCE_FALLBACK_ATOMS.busy
  const awaitingAtom = host.state.awaitingResponse ?? HOST_PRESENCE_FALLBACK_ATOMS.awaitingResponse
  const busyMapAtom = host.state.busyBySession ?? HOST_PRESENCE_FALLBACK_ATOMS.busyBySession

  const focusedStored = useValue(focusedStoredAtom)
  const focusedRuntime = useValue(focusedRuntimeAtom)
  const sessionActive = useValue(host.state.activeSessionId)
  const profile = useValue(profileAtom)
  const owner = useValue(ownerAtom)
  const busy = useValue(busyAtom)
  const awaitingResponse = useValue(awaitingAtom)
  const busyBySession = useValue(busyMapAtom)

  const caps = hostPresenceCapabilities(host.state)

  return useMemo(
    () =>
      buildHostPresenceSnapshot({
        capsState: host.state,
        focusedStored,
        focusedRuntime,
        sessionActive,
        profile,
        owner,
        busy,
        awaitingResponse,
        busyBySession,
      }),
    [
      focusedStored,
      focusedRuntime,
      sessionActive,
      profile,
      owner,
      busy,
      awaitingResponse,
      busyBySession,
      caps.busy,
      caps.awaitingResponse,
      caps.busyBySession,
      caps.focusedSessionId,
      caps.focusedStoredSessionId,
    ],
  )
}
