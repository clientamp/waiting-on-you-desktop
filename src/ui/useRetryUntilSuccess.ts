import { useEffect, useRef } from 'react'
import { loadRetryDelayMs } from './panelLoad'

/** Repeatedly calls `attemptLoad` with backoff until it returns true or `done` becomes true. */
export function useRetryUntilSuccess(
  attemptLoad: () => Promise<boolean>,
  done: boolean,
): void {
  const attemptRef = useRef(attemptLoad)
  attemptRef.current = attemptLoad

  useEffect(() => {
    if (done) return
    let cancelled = false
    let failures = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = async () => {
      if (cancelled) return
      const ok = await attemptRef.current()
      if (cancelled || ok) return
      const delay = loadRetryDelayMs(failures)
      failures += 1
      timer = setTimeout(() => void run(), delay)
    }

    void run()
    return () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [done, attemptLoad])
}
