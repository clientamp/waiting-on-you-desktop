import type { PluginContext } from '@hermes/plugin-sdk'
import { dispatchSettingsChangedWindow, parseGroupBy, type GroupBy, type ListLayout, type Task, type TaskProject, type WouMode } from '../model'
import {
  QUIZ_BATCH,
  parseQuizItems,
  parseSuggestions,
  type DecisionTestResult,
  type Quadrant,
  type QuizItem,
  type TagSuggestion,
} from './priorityHelpers'

export interface LastScan {
  at: number
  chats_seen?: number
  attempted?: number
  succeeded?: number
  failed?: number
  model_unreachable?: boolean
  skipped_chats?: number
  classification_errors?: string[]
  classified?: number
  added?: number
  resolved?: number
  expired?: number
  errors?: string[]
}

export type ScanSkipReason = 'consent' | 'off' | 'locked' | 'manual'

export interface ScanSummary extends LastScan {
  skipped?: ScanSkipReason
  capped?: boolean
}

export interface TaskGroup {
  chat_key: string
  title: string
  title_locked?: boolean
  quadrant: number
  task_ids: number[]
  agent: string
  chat_title: string
  project?: TaskProject | null
  chat_target?: import('./openChat').ChatTarget | null
}

export interface TasksResponse {
  tasks: Task[]
  groups: TaskGroup[]
  counts: Record<string, number>
  last_scan: LastScan | null
}

export interface PriorityRestore {
  group: { quadrant: number | null; quadrant_locked: boolean } | null
  children: { id: number; quadrant: number; quadrant_locked: boolean }[]
}

export interface PatchGroupResult {
  priority_restore?: PriorityRestore
  closed_task_ids: number[]
  chat_archived: boolean
  already_closed?: boolean
}

export async function fetchTasks(ctx: PluginContext, includeClosed = false): Promise<TasksResponse> {
  const path = includeClosed ? '/tasks?include_closed=1' : '/tasks'
  return ctx.rest<TasksResponse>(path)
}

export interface PatchTaskResult {
  task: Task
  chat_archived: boolean
}

export interface PluginSettings {
  mode: WouMode
  debounce_seconds: number
  sweep_minutes: number
  max_chats_per_scan: number
  daily_call_cap: number
  lookback_days: number
  retention_days: number
  consented: boolean
  archive_chat_on_done: boolean
  auto_tag: boolean
  name_after_chat: boolean
  group_by: GroupBy
  /** How the open list looks. Older servers omit it (treated as cards). */
  layout?: ListLayout
  /** Read-only: derived from group_by. Write group_by instead. */
  show_priorities: boolean
  show_project_badges: boolean
  follow_selected_chat: boolean
  /** Free text that guides sorting. Up to 1000 characters. Older servers omit it. */
  priorities_note?: string
  /** Ask the decision model whether a chat has anything waiting before the main model reads it. */
  decision_gate?: boolean
  /** Rate urgency and importance with the decision model. */
  decision_priority?: boolean
}

export interface UsageDay {
  date: string
  calls: number
  manual_calls?: number
  prompt_tokens: number
  completion_tokens: number
}

export interface UsageToday {
  calls: number
  /** Checks you started yourself (Scan anyway, name with AI). These can pass the limit. */
  manual_calls?: number
  prompt_tokens: number
  completion_tokens: number
}

export interface HermesModelInfo {
  provider: string | null
  model: string | null
  label: string
}

export interface SettingsBundle {
  settings: PluginSettings
  usage: {
    today: UsageToday
    history: UsageDay[]
  }
  model: HermesModelInfo
}

/** A Hermes project (read-only). */
export interface Project {
  key: string
  name: string
  slug?: string
  color: string | null
  profile: string
  open_count: number
}

export interface ProjectsResponse {
  projects: Project[]
  no_project_count: number
}

export interface Tag {
  id: number
  name: string
  color: string
  hint: string | null
  open_count: number
}

export async function patchGroup(
  ctx: PluginContext,
  chatKey: string,
  body: {
    status?: string
    quadrant?: number
    title?: string | null
    task_ids?: number[]
    priority_restore?: PriorityRestore
    tags_add?: number[]
    tags_remove?: number[]
  },
): Promise<PatchGroupResult> {
  const encoded = encodeURIComponent(chatKey)
  return ctx.rest<PatchGroupResult>(`/groups/${encoded}`, { method: 'PATCH', body })
}

/** Ask the model for a name from the chat. Does not save; the caller saves via PATCH so undo works. */
export async function fetchAiTitle(
  ctx: PluginContext,
  target: { task_id: number } | { chat_key: string },
): Promise<string> {
  const res = await ctx.rest<{ title: string }>('/ai-title', {
    method: 'POST',
    body: target,
    timeoutMs: 60_000,
  })
  return res.title
}

export interface RunTaskActionResult {
  ok: boolean
  message: string
  closed: boolean
  task: Task
}

export async function runTaskAction(
  ctx: PluginContext,
  taskId: number,
  actionId: string,
): Promise<RunTaskActionResult> {
  return ctx.rest<RunTaskActionResult>(`/tasks/${taskId}/actions/${actionId}`, {
    method: 'POST',
    timeoutMs: 120_000,
  })
}

export async function patchTask(
  ctx: PluginContext,
  id: number,
  body: {
    status?: string
    quadrant?: number
    snooze_until?: number | null
    title?: string | null
  },
): Promise<PatchTaskResult> {
  return ctx.rest<PatchTaskResult>(`/tasks/${id}`, { method: 'PATCH', body })
}

export async function fetchProjects(ctx: PluginContext): Promise<ProjectsResponse> {
  const res = await ctx.rest<Partial<ProjectsResponse>>('/projects')
  return {
    projects: Array.isArray(res.projects) ? res.projects : [],
    no_project_count: typeof res.no_project_count === 'number' ? res.no_project_count : 0,
  }
}

export async function fetchTags(ctx: PluginContext): Promise<Tag[]> {
  const res = await ctx.rest<{ tags?: Tag[] }>('/tags')
  return Array.isArray(res.tags) ? res.tags : []
}

export async function createTag(
  ctx: PluginContext,
  body: { name: string; color?: string; hint?: string },
): Promise<Tag> {
  const res = await ctx.rest<{ tag: Tag }>('/tags', { method: 'POST', body })
  return res.tag
}

export async function patchTag(
  ctx: PluginContext,
  id: number,
  body: { name?: string; color?: string; hint?: string },
): Promise<Tag> {
  const res = await ctx.rest<{ tag: Tag }>(`/tags/${id}`, { method: 'PATCH', body })
  return res.tag
}

export async function deleteTag(ctx: PluginContext, id: number): Promise<void> {
  await ctx.rest<{ ok: boolean }>(`/tags/${id}`, { method: 'DELETE' })
}

export async function setTaskTags(
  ctx: PluginContext,
  taskId: number,
  body: { add?: number[]; remove?: number[] },
): Promise<Task> {
  const payload: { add?: number[]; remove?: number[] } = {}
  if (body.add && body.add.length > 0) payload.add = body.add
  if (body.remove && body.remove.length > 0) payload.remove = body.remove
  const res = await ctx.rest<{ task: Task }>(`/tasks/${taskId}/tags`, { method: 'POST', body: payload })
  return res.task
}

export async function fetchSettings(ctx: PluginContext): Promise<SettingsBundle> {
  return ctx.rest<SettingsBundle>('/settings')
}

export async function patchSettings(
  ctx: PluginContext,
  body: Partial<PluginSettings>,
): Promise<{ settings: PluginSettings }> {
  const res = await ctx.rest<{ settings: PluginSettings }>('/settings', { method: 'PATCH', body })
  dispatchSettingsChangedWindow()
  return res
}

export async function triggerScan(
  ctx: PluginContext,
  options?: { force?: boolean },
): Promise<ScanSummary> {
  const body = options?.force ? { force: true } : {}
  return ctx.rest<ScanSummary>('/scan', { method: 'POST', body, timeoutMs: 180_000 })
}

export interface SatelliteStatus {
  enabled: boolean
  reason: string
  routes: string[]
}

export interface Satellite {
  id: string
  name: string
  agent_name: string
  connections: string[]
  desktop_profile: string | null
  created_at: number
  last_seen: number | null
  last_push_count: number | null
  revoked_at: number | null
}

export interface PairCodeResult {
  code: string
  expires_at: number
}

export async function fetchSatelliteStatus(ctx: PluginContext): Promise<SatelliteStatus> {
  return ctx.rest<SatelliteStatus>('/satellite/status')
}

export async function fetchSatellites(ctx: PluginContext): Promise<Satellite[]> {
  const res = await ctx.rest<{ satellites: Satellite[] }>('/satellites')
  return res.satellites
}

export async function createPairCode(
  ctx: PluginContext,
  body: {
    name: string
    agent_name?: string
    connections?: string[]
    desktop_profile?: string
  },
): Promise<PairCodeResult> {
  return ctx.rest<PairCodeResult>('/satellite/pair-codes', { method: 'POST', body })
}

export async function revokeSatellite(ctx: PluginContext, id: string): Promise<void> {
  await ctx.rest<{ ok: boolean }>(`/satellites/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ---- Teach priorities ----

export async function fetchQuiz(ctx: PluginContext, limit = QUIZ_BATCH): Promise<QuizItem[]> {
  const res = await ctx.rest<unknown>(`/quiz?limit=${limit}`)
  return parseQuizItems(res)
}

export async function answerQuiz(ctx: PluginContext, taskId: number, quadrant: Quadrant): Promise<void> {
  await ctx.rest<unknown>(`/quiz/${taskId}`, { method: 'POST', body: { quadrant } })
}

export async function skipQuiz(ctx: PluginContext, taskId: number): Promise<void> {
  await ctx.rest<unknown>(`/quiz/${taskId}/skip`, { method: 'POST', body: {} })
}

// ---- Decision model ----

export interface DecisionProvider {
  id: string
  label: string
  default_model: string
  needs_key: boolean
  needs_account_id: boolean
  needs_base_url: boolean
  note: string
}

export interface DecisionInfo {
  /** '' means off. */
  provider: string
  model: string
  base_url: string
  cloudflare_account_id: string
  key_set: boolean
  key_name: string | null
  native_available: boolean
  providers: DecisionProvider[]
  usage_today: { calls: number; input_tokens: number }
  last_error: string | null
}

export type DecisionPatch = Partial<
  Pick<DecisionInfo, 'provider' | 'model' | 'base_url' | 'cloudflare_account_id'>
>

function normalizeDecision(raw: Partial<DecisionInfo> | null | undefined): DecisionInfo {
  const r = raw ?? {}
  return {
    provider: typeof r.provider === 'string' ? r.provider : '',
    model: typeof r.model === 'string' ? r.model : '',
    base_url: typeof r.base_url === 'string' ? r.base_url : '',
    cloudflare_account_id: typeof r.cloudflare_account_id === 'string' ? r.cloudflare_account_id : '',
    key_set: Boolean(r.key_set),
    key_name: typeof r.key_name === 'string' && r.key_name ? r.key_name : null,
    native_available: Boolean(r.native_available),
    providers: Array.isArray(r.providers) ? r.providers : [],
    usage_today: {
      calls: typeof r.usage_today?.calls === 'number' ? r.usage_today.calls : 0,
      input_tokens: typeof r.usage_today?.input_tokens === 'number' ? r.usage_today.input_tokens : 0,
    },
    last_error: typeof r.last_error === 'string' && r.last_error ? r.last_error : null,
  }
}

export async function fetchDecision(ctx: PluginContext): Promise<DecisionInfo> {
  return normalizeDecision(await ctx.rest<Partial<DecisionInfo>>('/decision'))
}

export async function patchDecision(ctx: PluginContext, body: DecisionPatch): Promise<DecisionInfo> {
  const res = await ctx.rest<Partial<DecisionInfo>>('/decision', { method: 'PATCH', body })
  dispatchSettingsChangedWindow()
  return normalizeDecision(res)
}

export async function testDecision(ctx: PluginContext): Promise<DecisionTestResult> {
  const res = await ctx.rest<Partial<DecisionTestResult>>('/decision/test', {
    method: 'POST',
    body: {},
    timeoutMs: 60_000,
  })
  return {
    ok: Boolean(res?.ok),
    code: typeof res?.code === 'string' ? res.code : null,
    latency_ms: typeof res?.latency_ms === 'number' ? res.latency_ms : null,
    model: typeof res?.model === 'string' ? res.model : null,
  }
}

// ---- Tag suggestions ----

/** One AI call; saves nothing. Rejects with 409 {error} when no model is available. */
export async function suggestTags(ctx: PluginContext, limit?: number): Promise<TagSuggestion[]> {
  const res = await ctx.rest<unknown>('/tags/suggest', {
    method: 'POST',
    body: limit ? { limit } : {},
    timeoutMs: 90_000,
  })
  return parseSuggestions(res)
}

export function parseGroupByFromSettings(settings: Pick<PluginSettings, 'group_by' | 'show_priorities'>): GroupBy {
  return parseGroupBy(settings.group_by, settings.show_priorities)
}
