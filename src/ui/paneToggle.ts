export type PaneToggleAction = 'hide' | 'show' | 'reveal' | 'navigate'

export function decidePaneToggle({
  registered,
  visible,
  hasActiveSession,
}: {
  registered: boolean
  visible: boolean
  hasActiveSession: boolean
}): PaneToggleAction {
  if (registered && visible) return 'hide'
  if (!hasActiveSession && !(registered && visible)) return 'navigate'
  if (registered && !visible) return 'reveal'
  return 'show'
}

let paneRegistered = false
const paneRegisteredListeners = new Set<() => void>()

export function getPaneRegistered(): boolean {
  return paneRegistered
}

export function setPaneRegistered(registered: boolean): void {
  if (paneRegistered === registered) return
  paneRegistered = registered
  for (const listener of paneRegisteredListeners) listener()
}

export function subscribePaneRegistered(listener: () => void): () => void {
  paneRegisteredListeners.add(listener)
  return () => paneRegisteredListeners.delete(listener)
}
