export type TeachAvailability = 'checking' | 'ready' | 'empty' | 'error'

interface TeachStorage {
  get<T>(key: string, fallback: T): T
  set<T>(key: string, value: T): void
}

export function isTeachCardResolved(storage: TeachStorage): boolean {
  return storage.get<boolean>('teach-card', false) === true
}

export function resolveTeachCard(storage: TeachStorage, action: 'not-now' | 'dismiss' | 'session', sorted = 0): boolean {
  if (action === 'session' && !(sorted > 0)) return false
  storage.set('teach-card', true)
  return true
}

export interface TeachCardConditions {
  desktop: boolean
  consented: boolean
  scanned: boolean
  availability: TeachAvailability
  resolved: boolean
  onboarding: boolean
  settings: boolean
  teaching: boolean
  searching: boolean
  closed: boolean
}

export function showTeachCard(c: TeachCardConditions): boolean {
  return c.desktop && c.consented && c.scanned && c.availability === 'ready' &&
    !c.resolved && !c.onboarding && !c.settings && !c.teaching && !c.searching && !c.closed
}

/** A failed scan/check must never trap setup. Finish remains available. */
export function firstRunTeachState(scanning: boolean, availability: TeachAvailability) {
  if (scanning || availability === 'checking') return 'waiting'
  return availability === 'ready' ? 'ready' : 'empty'
}
