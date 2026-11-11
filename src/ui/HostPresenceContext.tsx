import { createContext, useContext, type ReactNode } from 'react'
import { ABSENT_HOST_PRESENCE_SNAPSHOT, type HostPresenceSnapshot } from './chatPresence'
import { useHostPresenceSnapshot } from './useHostPresence'

const HostPresenceContext = createContext<HostPresenceSnapshot | null>(null)

export function HostPresenceProvider({ children }: { children: ReactNode }) {
  const snapshot = useHostPresenceSnapshot()
  return (
    <HostPresenceContext.Provider value={snapshot}>{children}</HostPresenceContext.Provider>
  )
}

export function useHostPresenceContext(): HostPresenceSnapshot {
  const value = useContext(HostPresenceContext)
  return value ?? ABSENT_HOST_PRESENCE_SNAPSHOT
}
