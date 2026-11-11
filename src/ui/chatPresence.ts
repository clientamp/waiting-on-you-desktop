/** Host conversation presence for a WoU chat row — public SDK atoms only; no timestamp guesses. */

import type { Task } from '../model'
import { planOpen } from './chatRoute'
import {
  taskMatchesFocusedSessionForPresence,
  type FocusedChatSelection,
} from './followChat'

export type HostPresenceCapabilities = {
  busy: boolean
  awaitingResponse: boolean
  busyBySession: boolean
  focusedStoredSessionId: boolean
  focusedSessionId: boolean
}

export type HostPresenceSnapshot = {
  caps: HostPresenceCapabilities
  selection: FocusedChatSelection
  busy: boolean
  awaitingResponse: boolean
  busyBySession: Record<string, boolean>
  focusedSessionId: string | null
}

/** Safe default when optional presence is unavailable (no provider or host atoms). */
export const ABSENT_HOST_PRESENCE_SNAPSHOT: HostPresenceSnapshot = {
  caps: {
    busy: false,
    awaitingResponse: false,
    busyBySession: false,
    focusedStoredSessionId: false,
    focusedSessionId: false,
  },
  selection: { sessionId: null, profile: null, owner: null },
  busy: false,
  awaitingResponse: false,
  busyBySession: {},
  focusedSessionId: null,
}

export type ChatPresenceCopy = {
  presenceWorking: string
  presenceWorkingAria: (chat: string) => string
  presenceResponded: string
  presenceRespondedAria: (chat: string) => string
  presenceRespondedUnavailable: string
  presenceRespondedUnavailableAria: string
  presenceReadUnavailable: string
  presenceReadUnavailableAria: string
}

export type ChatPresenceIndicator =
  | { kind: 'working'; label: string; ariaLabel: string }
  | { kind: 'responded'; label: string; ariaLabel: string; available: boolean }
  | { kind: 'read'; label: string; ariaLabel: string; available: boolean }

export function hostPresenceCapabilities(state: unknown): HostPresenceCapabilities {
  const s = (state ?? {}) as Record<string, unknown>
  return {
    busy: typeof s.busy !== 'undefined',
    awaitingResponse: typeof s.awaitingResponse !== 'undefined',
    busyBySession: typeof s.busyBySession !== 'undefined',
    focusedStoredSessionId: typeof s.focusedStoredSessionId !== 'undefined',
    focusedSessionId: typeof s.focusedSessionId !== 'undefined',
  }
}

/**
 * Mid-turn for the focused stored session only — uses host focus-scoped `busy` when
 * exposed, else the focused runtime id in `busyBySession`. Never reads a global busy
 * flag for a non-focused chat row (row match is enforced before calling).
 */
function focusedSessionBusy(snapshot: HostPresenceSnapshot): boolean | null {
  if (!snapshot.caps.busy && !(snapshot.caps.busyBySession && snapshot.caps.focusedSessionId)) {
    return null
  }
  if (snapshot.caps.busy) return snapshot.busy
  if (snapshot.caps.focusedSessionId && snapshot.focusedSessionId) {
    return Boolean(snapshot.busyBySession[snapshot.focusedSessionId])
  }
  return false
}

/** Indicators to render for one task's chat. Never claims idle for non-focused sessions. */
export function chatPresenceIndicators(
  task: Pick<Task, 'chat_key' | 'chat_target' | 'status' | 'chat_title' | 'topic'>,
  snapshot: HostPresenceSnapshot,
  copy: ChatPresenceCopy,
  opts?: { showReadUnavailable?: boolean },
): ChatPresenceIndicator[] {
  const plan = planOpen(task.chat_key, task.chat_target)
  if (plan.kind === 'not-a-chat') return []

  const chatLabel = (task.chat_title || task.topic || task.chat_key).trim() || 'chat'
  const focused = taskMatchesFocusedSessionForPresence(task, snapshot.selection)
  if (!focused) return []

  const showReadUnavailable = opts?.showReadUnavailable !== false
  const out: ChatPresenceIndicator[] = []
  const working = focusedSessionBusy(snapshot)
  if (working === true) {
    out.push({
      kind: 'working',
      label: copy.presenceWorking,
      ariaLabel: copy.presenceWorkingAria(chatLabel),
    })
  }

  // `awaitingResponse` is "true from send until the first assistant payload" on the
  // focused chat (Hermes sdk/index.ts). `!awaitingResponse && busy` only means that
  // payload started while the turn is still live — not user-answer ack, read, or a
  // completed reply. WoU never shows a confident "Responded" from these atoms alone.
  if (!snapshot.caps.awaitingResponse && working === true) {
    out.push({
      kind: 'responded',
      label: copy.presenceRespondedUnavailable,
      ariaLabel: copy.presenceRespondedUnavailableAria,
      available: false,
    })
  }

  if (showReadUnavailable && working === true) {
    out.push({
      kind: 'read',
      label: copy.presenceReadUnavailable,
      ariaLabel: copy.presenceReadUnavailableAria,
      available: false,
    })
  }

  return out
}
