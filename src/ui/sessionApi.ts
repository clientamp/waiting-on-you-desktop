import type { PluginContext } from '@hermes/plugin-sdk'
import type { Task, TaskGroup } from '../model'
import {
  dispatchTasksChangedWindow,
  sessionPostBody,
  sessionQueryParams,
  type SessionOwner,
} from '../model'

export interface SessionTasksResponse {
  chat_key: string
  tracked: boolean
  tasks: Task[]
  group: TaskGroup | null
}

export type SessionTasksFetch =
  | { kind: 'ok'; data: SessionTasksResponse }
  | { kind: 'not_found'; error: string }

type RestError = {
  status?: number
  message?: string
  body?: { error?: string; detail?: string }
}

function textField(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Desktop's bridge rejects with Error('<status>: <body>') (statusCode may not survive IPC),
 *  so read the status and JSON `error` / `detail` from the message as well as from fields. */
export function restErrorFields(e: unknown): { status: number; error: string } {
  const err = (e ?? {}) as RestError & { statusCode?: number }
  let status =
    typeof err.status === 'number' ? err.status : typeof err.statusCode === 'number' ? err.statusCode : 0
  let error = textField(err.body?.error) || textField(err.body?.detail)
  const msg = typeof err.message === 'string' ? err.message : ''
  const m = /(\d{3}): (.*)$/s.exec(msg)
  if (m) {
    if (!status) status = Number(m[1])
    if (!error) {
      try {
        const parsed = JSON.parse(m[2]) as { error?: unknown; detail?: unknown }
        error = textField(parsed.error) || textField(parsed.detail)
      } catch {
        // not JSON
      }
    }
  }
  return { status, error: error || msg }
}

/** A task or group that closed on the server before this action reached it. */
export function isAlreadyGone(e: unknown): boolean {
  const { status, error } = restErrorFields(e)
  return status === 404 && /^(task|group) not found$/i.test(error.trim())
}

/** Gateway consent gate, not a missing task. Body is `{"detail": "Plugin not found"}`. */
export function isPluginConsentMiss(e: unknown): boolean {
  const { status, error } = restErrorFields(e)
  return status === 404 && /plugin not found/i.test(error)
}

export async function fetchSessionTasks(
  ctx: PluginContext,
  sessionId: string,
  profile: string,
  owner: SessionOwner | null | undefined,
  activeConnectionId?: string | null,
): Promise<SessionTasksFetch> {
  const params = sessionQueryParams(sessionId, profile, owner, activeConnectionId)
  const qs = new URLSearchParams(params).toString()
  try {
    const data = await ctx.rest<SessionTasksResponse>(`/session-tasks?${qs}`)
    return { kind: 'ok', data }
  } catch (e: unknown) {
    const { status, error } = restErrorFields(e)
    if (status === 404) return { kind: 'not_found', error: error || 'Not found' }
    throw e
  }
}

export async function addSessionTask(
  ctx: PluginContext,
  sessionId: string,
  profile: string,
  owner: SessionOwner | null | undefined,
  activeConnectionId: string | null | undefined,
  fields: {
    ask?: string
    quadrant: number
    title?: string
  },
): Promise<Task> {
  const body = sessionPostBody(sessionId, profile, owner, activeConnectionId, fields)
  const res = await ctx.rest<{ task: Task }>('/tasks', { method: 'POST', body })
  dispatchTasksChangedWindow()
  return res.task
}

export function afterSessionMutation() {
  dispatchTasksChangedWindow()
}
