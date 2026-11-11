import { isPluginConsentMiss } from './sessionApi'

/**
 * The desktop half is app-wide, so the sidebar stays when the focused chat
 * belongs to a Hermes that never enabled this plugin. ctx.rest follows that
 * chat, and the gateway answers 404 {"detail": "Plugin not found"}. Hide the
 * chrome instead of leaving a list that cannot be checked off.
 */

let available = true
const listeners = new Set<() => void>()

export function getBackendAvailable(): boolean {
  return available
}

export function setBackendAvailable(next: boolean): void {
  if (available === next) return
  available = next
  for (const listener of listeners) listener()
}

export function subscribeBackendAvailable(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Click path: hide the plugin. Returns true the first time, so the caller can
 *  say why once instead of toasting the raw 404. */
export function noteConsentMiss(): boolean {
  const was = available
  setBackendAvailable(false)
  return was
}

export function isConsentMiss(e: unknown): boolean {
  return isPluginConsentMiss(e)
}

type ScopeAtom = { subscribe?: (listener: () => void) => () => void } | undefined

export function watchRequestScope(
  atoms: readonly ScopeAtom[],
  onChange: () => void,
): () => void {
  const stops = atoms.map(atom =>
    atom && typeof atom.subscribe === 'function' ? atom.subscribe(onChange) : () => {},
  )
  return () => {
    for (const stop of stops) stop()
  }
}

let probeGen = 0

/** Ask the focused chat's host. A consent-gate 404 hides the plugin.
 *  Any other failure leaves the last answer alone. */
export async function probeBackend(rest: (path: string, options?: { timeoutMs?: number }) => Promise<unknown>): Promise<void> {
  const gen = ++probeGen
  try {
    await rest('/settings', { timeoutMs: 8_000 })
    if (gen !== probeGen) return
    setBackendAvailable(true)
  } catch (e) {
    if (gen !== probeGen) return
    if (isPluginConsentMiss(e)) setBackendAvailable(false)
  }
}
