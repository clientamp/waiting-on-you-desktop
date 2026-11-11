/** Delays (ms) after each failed load before the next retry. */
export const LOAD_RETRY_BACKOFF_MS = [2000, 5000, 10000, 30000] as const

/** Delay before retry attempt `failureCount` (0 = first retry after initial failure). */
export function loadRetryDelayMs(failureCount: number): number {
  const i = Math.min(
    Math.max(failureCount, 0),
    LOAD_RETRY_BACKOFF_MS.length - 1,
  )
  return LOAD_RETRY_BACKOFF_MS[i]
}

/**
 * Pane is considered visible for polling/follow when the host says so, or when the
 * panel root intersects the viewport and the document is visible.
 * `rootIntersecting` null = IntersectionObserver unavailable or not yet measured.
 */
export function combinePaneVisible(
  hostPaneVisible: boolean,
  rootIntersecting: boolean | null,
  documentVisible: boolean,
): boolean {
  if (hostPaneVisible) return true
  if (rootIntersecting !== true) return false
  return documentVisible
}
