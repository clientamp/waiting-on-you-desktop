/** Answers wait a few seconds (so a misclick can be undone), then go one at a
 *  time: each send opens a chat, and two at once would fight over the main pane.
 *  No SDK imports; the panel injects timers and delivery. */

import { sameAnswerWindowScope, type AnswerWindowScope } from './answers'

export interface AnswerItem {
  taskId: number
  sessionId: string
  chatKey: string
  /** Desktop window scope when the answer was queued. */
  scope: AnswerWindowScope
  /** Exact message text sent to the chat. */
  text: string
  /** Short label for the row and toasts ("Yes", "No", "Reply"). */
  label: string
  chatTitle: string
}

export type AnswerPhase = 'waiting' | 'sending'
export type AnswerFailure = 'gone' | 'not-delivered' | 'error'

export interface AnswerQueueDeps {
  delayMs: number
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (handle: unknown) => void
  /** Checked right before sending: the ask must still be open. */
  isStillOpen: (taskId: number) => boolean
  /** Put the text in the chat. True only when Desktop accepted it. Must give up
   *  (resolve false) without sending once `signal.aborted` is set. */
  deliver: (item: AnswerItem, signal: { aborted: boolean }) => Promise<boolean>
  /** Tasks with an answer pending, shared by every queue in this window, so a
   *  panel that closes and reopens can't answer the same ask twice. */
  claims?: Set<number>
  onSent: (item: AnswerItem) => void
  onFailed: (item: AnswerItem, reason: AnswerFailure) => void
  /** Any phase change (for re-rendering). */
  onChange: () => void
}

export interface AnswerQueue {
  /** False when this task already has an answer pending (or the queue is closed). */
  enqueue: (item: AnswerItem) => boolean
  /** Cancel a waiting answer. False once it is sending. */
  cancel: (taskId: number) => boolean
  /** Cancel the most recent waiting answer (for ⌘Z). */
  cancelLatest: () => AnswerItem | null
  /** Drop waiting answers that do not match the window's current scope. Returns count removed. */
  cancelOutOfScope: (current: AnswerWindowScope) => number
  phase: (taskId: number) => AnswerPhase | null
  get: (taskId: number) => AnswerItem | null
  size: () => number
  dispose: () => void
}

interface Entry {
  item: AnswerItem
  phase: AnswerPhase
  due: boolean
  timer: unknown
  signal: { aborted: boolean }
}

export function createAnswerQueue(deps: AnswerQueueDeps): AnswerQueue {
  // Insertion order = answer order.
  const entries = new Map<number, Entry>()
  const claims = deps.claims ?? new Set<number>()
  let busy = false
  let closed = false

  const pump = () => {
    if (busy || closed) return
    const next = [...entries.values()].find(e => e.phase === 'waiting' && e.due)
    if (!next) return
    busy = true
    next.phase = 'sending'
    deps.onChange()
    const { item, signal } = next
    const finish = (result: 'sent' | AnswerFailure) => {
      entries.delete(item.taskId)
      claims.delete(item.taskId)
      busy = false
      // After dispose, only a send that really went out still reports (so its
      // ask gets checked off); a stopped one stays quiet and stays open.
      if (closed) {
        if (result === 'sent') deps.onSent(item)
        return
      }
      if (result === 'sent') deps.onSent(item)
      else deps.onFailed(item, result)
      deps.onChange()
      pump()
    }
    let open = false
    try {
      open = deps.isStillOpen(item.taskId)
    } catch {
      open = false
    }
    if (!open) {
      finish('gone')
      return
    }
    deps.deliver(item, signal).then(
      ok => finish(ok ? 'sent' : 'not-delivered'),
      () => finish('error'),
    )
  }

  const removeWaiting = (entry: Entry) => {
    deps.clearTimer(entry.timer)
    entries.delete(entry.item.taskId)
    claims.delete(entry.item.taskId)
    deps.onChange()
  }

  return {
    enqueue(item) {
      if (closed || entries.has(item.taskId) || claims.has(item.taskId)) return false
      claims.add(item.taskId)
      const entry: Entry = { item, phase: 'waiting', due: false, timer: null, signal: { aborted: false } }
      entry.timer = deps.setTimer(() => {
        entry.due = true
        pump()
      }, deps.delayMs)
      entries.set(item.taskId, entry)
      deps.onChange()
      return true
    },
    cancel(taskId) {
      const entry = entries.get(taskId)
      if (!entry || entry.phase !== 'waiting') return false
      removeWaiting(entry)
      return true
    },
    cancelLatest() {
      const waiting = [...entries.values()].filter(e => e.phase === 'waiting')
      const last = waiting[waiting.length - 1]
      if (!last) return null
      removeWaiting(last)
      return last.item
    },
    cancelOutOfScope(current) {
      let removed = 0
      for (const entry of [...entries.values()]) {
        if (sameAnswerWindowScope(entry.item.scope, current)) continue
        if (entry.phase === 'waiting') {
          removeWaiting(entry)
          deps.onFailed(entry.item, 'not-delivered')
          removed++
        } else if (entry.phase === 'sending' && !entry.signal.aborted) {
          entry.signal.aborted = true
          removed++
        }
      }
      if (removed) pump()
      return removed
    },
    phase: taskId => entries.get(taskId)?.phase ?? null,
    get: taskId => entries.get(taskId)?.item ?? null,
    size: () => entries.size,
    dispose() {
      closed = true
      for (const [id, entry] of [...entries]) {
        if (entry.phase === 'waiting') {
          deps.clearTimer(entry.timer)
          entries.delete(id)
          claims.delete(id)
        } else {
          // Sending: stop before submit. Its claim clears when deliver settles.
          entry.signal.aborted = true
        }
      }
    },
  }
}
