/** Stable read-only fallbacks when optional host.state keys are absent (older desktops). */

type Subscribable<T> = {
  get(): T
  subscribe(listener: (value: T) => void): () => void
}

const noopSub = () => () => {}

function constantAtom<T>(value: T): Subscribable<T> {
  return { get: () => value, subscribe: noopSub }
}

const EMPTY_BUSY_MAP: Record<string, boolean> = {}

export const HOST_PRESENCE_FALLBACK_ATOMS = {
  focusedStoredSessionId: constantAtom<string | null>(null),
  focusedSessionId: constantAtom<string | null>(null),
  focusedSessionProfile: constantAtom<string | null>(null),
  focusedSessionOwner: constantAtom<{ connectionId: string; profile: string } | null>(null),
  busy: constantAtom(false),
  awaitingResponse: constantAtom(false),
  busyBySession: constantAtom(EMPTY_BUSY_MAP),
} as const
