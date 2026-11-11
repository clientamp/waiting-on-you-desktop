import { type PluginContext } from '@hermes/plugin-sdk'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAiTitle } from './api'
import { restErrorFields } from './sessionApi'
import { strings } from './strings'

export type AiRenameTarget = { task_id: number } | { chat_key: string }

/** One AI naming request at a time per card. `cancel()` makes a late reply a no-op. */
export function useAiRename(ctx: PluginContext, target: AiRenameTarget) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runId = useRef(0)
  const mounted = useRef(true)
  const targetRef = useRef(target)
  targetRef.current = target

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      runId.current += 1
    }
  }, [])

  const cancel = useCallback(() => {
    runId.current += 1
    setBusy(false)
    setError(null)
  }, [])

  /** Resolves to the title, or null when it failed (error is set) or was cancelled. */
  const generate = useCallback(async (): Promise<string | null> => {
    const id = ++runId.current
    setBusy(true)
    setError(null)
    try {
      const title = (await fetchAiTitle(ctx, targetRef.current)).trim()
      if (!mounted.current || id !== runId.current) return null
      if (!title) {
        setError(strings.renameWithAiFailed)
        return null
      }
      return title
    } catch (e) {
      if (!mounted.current || id !== runId.current) return null
      setError(restErrorFields(e).error || strings.renameWithAiFailed)
      return null
    } finally {
      if (mounted.current && id === runId.current) setBusy(false)
    }
  }, [ctx])

  return { busy, error, setError, generate, cancel }
}
