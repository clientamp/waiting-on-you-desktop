import { host, useValue, type PluginContext } from '@hermes/plugin-sdk'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Task } from '../model'
import { fetchTasks, type LastScan, type TaskGroup } from './api'
import { TASKS_CHANGED_WINDOW_EVENT } from '../model'
import { strings } from './strings'
import { notifyError } from './notify'
import { useRetryUntilSuccess } from './useRetryUntilSuccess'
import { getBackendAvailable, isConsentMiss, setBackendAvailable, subscribeBackendAvailable } from './backendGate'
import { TASKS_CHANGED_EVENT } from './shortcuts'

const TASKS_CHANGED = TASKS_CHANGED_EVENT
const POLL_MS = 30_000

export function useTasks(ctx: PluginContext, pollVisible = true) {
  const profile = useValue(host.state.profile)
  const focusedProfile = host.state.focusedSessionProfile
    ? useValue(host.state.focusedSessionProfile)
    : profile
  const backendAvailable = useSyncExternalStore(
    subscribeBackendAvailable,
    getBackendAvailable,
    getBackendAvailable,
  )
  const [tasks, setTasks] = useState<Task[]>([])
  const [groups, setGroups] = useState<TaskGroup[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [lastScan, setLastScan] = useState<LastScan | null>(null)
  const [includeClosed, setIncludeClosed] = useState(false)
  const [loading, setLoading] = useState(true)
  const loadGen = useRef(0)
  // Background refreshes fail quietly; only a run of failures shows a label.
  const failures = useRef(0)
  const [offline, setOffline] = useState(false)
  const [fetchSucceeded, setFetchSucceeded] = useState(false)

  const reload = useCallback(async (opts?: { userAction?: boolean }) => {
    if (!getBackendAvailable()) return false
    const gen = ++loadGen.current
    try {
      const data = await fetchTasks(ctx, includeClosed)
      if (gen !== loadGen.current) return true
      setTasks(data.tasks)
      setGroups(data.groups ?? [])
      setCounts(data.counts)
      setLastScan(data.last_scan)
      failures.current = 0
      setOffline(false)
      setFetchSucceeded(true)
      return true
    } catch (e) {
      if (gen !== loadGen.current) return false
      if (isConsentMiss(e)) {
        setBackendAvailable(false)
        return false
      }
      failures.current += 1
      if (opts?.userAction) notifyError(strings.loadError)
      else if (failures.current >= 3) setOffline(true)
      return false
    } finally {
      if (gen === loadGen.current) setLoading(false)
    }
  }, [ctx, includeClosed])

  useEffect(() => {
    if (!backendAvailable) {
      setTasks([])
      setGroups([])
      setCounts({})
      setOffline(false)
      setFetchSucceeded(true)
      setLoading(false)
      return
    }
    setFetchSucceeded(false)
    setLoading(true)
    void reload()
  }, [reload, profile, focusedProfile, backendAvailable])

  useRetryUntilSuccess(reload, fetchSucceeded)

  useEffect(() => {
    const disposers: Array<() => void> = []
    const onChange = () => void reload()
    if (ctx.onEvent) disposers.push(ctx.onEvent(TASKS_CHANGED, onChange))
    else if (host.onEvent) disposers.push(host.onEvent(TASKS_CHANGED, onChange))
    if (ctx.addEventListener && typeof window !== 'undefined') {
      disposers.push(ctx.addEventListener(window, TASKS_CHANGED_WINDOW_EVENT, onChange))
    }

    const tick = () => {
      if (pollVisible && backendAvailable) void reload()
    }
    const id = setInterval(tick, POLL_MS)
    disposers.push(() => clearInterval(id))

    return () => {
      for (const d of disposers) d()
    }
  }, [ctx, reload, pollVisible, backendAvailable])

  return {
    tasks,
    setTasks,
    groups,
    setGroups,
    counts,
    lastScan,
    loading,
    fetchSucceeded,
    offline,
    includeClosed,
    setIncludeClosed,
    reload,
  }
}
