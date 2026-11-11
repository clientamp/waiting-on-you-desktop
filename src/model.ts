export interface TaskAction {
  id: string
  label: string
  confirm?: string
  style?: 'primary' | 'default' | 'danger'
  kind?: 'run' | 'details'
}

/** A Hermes project. Read-only here: Hermes owns projects. Keys are opaque. */
export interface TaskProject {
  key: string
  name: string
  color: string | null
}

export const TAG_COLORS = [
  'gray',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
] as const

export type TagColor = (typeof TAG_COLORS)[number]

export function normalizeTagColor(color: string | null | undefined): TagColor {
  return (TAG_COLORS as readonly string[]).includes(color ?? '') ? (color as TagColor) : 'gray'
}

export interface TaskTag {
  id: number
  name: string
  color: string
  source: 'manual' | 'auto'
}

export interface Task {
  chat_target?: { session_id: string; profile: string | null; connection: string | null } | null
  id: number
  chat_key: string
  agent: string
  chat_title: string
  ask: string
  topic: string
  quadrant: number
  status: string
  snooze_until: number | null
  source_msg_id: string | null
  source_msg_at?: number | null
  created_at: number
  updated_at: number
  fingerprint: string
  quadrant_locked: boolean
  archived_chat?: boolean
  project?: TaskProject | null
  tags?: TaskTag[]
  /** One line: what this is about, or what happens if you wait. */
  context?: string | null
  /** Epoch seconds. */
  due_at?: number | null
  urgency?: number | null
  importance?: number | null
  source_excerpt?: string | null
  title_override?: string | null
  /** The name you gave this chat's card (survives the card turning into a group and back). */
  chat_name?: string | null
  actions?: TaskAction[]
}

/** User-visible history includes age-cleared tasks, not just check-offs. */
export function isHistoryTask(task: Pick<Task, 'status'>): boolean {
  return task.status === 'done' || task.status === 'dismissed' || task.status === 'expired'
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
  chat_target?: { session_id: string; profile: string | null; connection: string | null } | null
}

export type QuadrantGroups = Record<1 | 2 | 3 | 4, Task[]>

export type QuadrantEntry =
  | { kind: 'task'; task: Task; sortAt: number }
  | { kind: 'group'; group: TaskGroup; tasks: Task[]; sortAt: number }

export type QuadrantEntryGroups = Record<1 | 2 | 3 | 4, QuadrantEntry[]>

export type SortOrder = 'newest' | 'oldest'

const QUADRANTS = [1, 2, 3, 4] as const

function fallbackGroupTitle(tasks: Task[]): string {
  if (tasks.length === 0) return ''
  const counts = new Map<string, number>()
  for (const t of tasks) {
    counts.set(t.topic, (counts.get(t.topic) ?? 0) + 1)
  }
  let best = tasks[0].topic
  let bestN = 0
  for (const [topic, n] of counts) {
    if (n > bestN) {
      best = topic
      bestN = n
    }
  }
  return best || tasks[0].chat_title
}

export function taskDisplayTitle(task: Task, nameAfterChat = false, nested = false): string {
  const override = task.title_override?.trim()
  if (override) return override
  // A standalone card shows the name you gave its chat, even when the scan
  // rewords the ask into a new task row. Nested asks sit under that name already.
  if (!nested) {
    const chatName = task.chat_name?.trim()
    if (chatName) return chatName
  }
  if (nameAfterChat) {
    const chat = task.chat_title?.trim()
    if (chat) return chat
  }
  const topic = task.topic?.trim()
  return topic || task.chat_title || ''
}

export function groupDisplayTitle(group: TaskGroup, nameAfterChat = false): string {
  if (group.title_locked) {
    const locked = group.title?.trim()
    if (locked) return locked
  }
  if (nameAfterChat) {
    const chat = group.chat_title?.trim()
    if (chat) return chat
  }
  const title = group.title?.trim()
  return title || group.chat_title || ''
}

export function buildQuadrantEntries(
  tasks: Task[],
  apiGroups: TaskGroup[],
  order: SortOrder = 'newest',
): QuadrantEntryGroups {
  const byChat = new Map<string, Task[]>()
  for (const task of tasks) {
    const list = byChat.get(task.chat_key) ?? []
    list.push(task)
    byChat.set(task.chat_key, list)
  }

  const groupMeta = new Map(apiGroups.map(g => [g.chat_key, g]))
  const entries: QuadrantEntry[] = []
  const childCmp =
    order === 'oldest'
      ? (a: Task, b: Task) => taskSortAt(a) - taskSortAt(b)
      : (a: Task, b: Task) => taskSortAt(b) - taskSortAt(a)

  for (const [chatKey, chatTasks] of byChat) {
    if (chatTasks.length >= 2) {
      const meta = groupMeta.get(chatKey)
      const sortedChildren = [...chatTasks].sort(childCmp)
      const sortAt =
        order === 'oldest'
          ? Math.min(...chatTasks.map(t => taskSortAt(t)))
          : Math.max(...chatTasks.map(t => taskSortAt(t)))
      const quadrant =
        meta?.quadrant ?? Math.min(...chatTasks.map(t => t.quadrant))
      const group: TaskGroup = {
        chat_key: chatKey,
        title: meta?.title ?? fallbackGroupTitle(chatTasks),
        title_locked: meta?.title_locked ?? false,
        quadrant,
        task_ids: sortedChildren.map(t => t.id),
        agent: chatTasks[0].agent,
        chat_title: chatTasks[0].chat_title,
        chat_target: meta?.chat_target ?? chatTasks.find(t => t.chat_target)?.chat_target ?? null,
      }
      entries.push({
        kind: 'group',
        group,
        tasks: sortedChildren,
        sortAt,
      })
    } else {
      for (const task of chatTasks) {
        entries.push({ kind: 'task', task, sortAt: taskSortAt(task) })
      }
    }
  }

  const result: QuadrantEntryGroups = { 1: [], 2: [], 3: [], 4: [] }
  const cmp =
    order === 'oldest'
      ? (a: QuadrantEntry, b: QuadrantEntry) => a.sortAt - b.sortAt
      : (a: QuadrantEntry, b: QuadrantEntry) => b.sortAt - a.sortAt
  for (const entry of entries) {
    const q = entry.kind === 'task' ? entry.task.quadrant : entry.group.quadrant
    if (q >= 1 && q <= 4) result[q as 1 | 2 | 3 | 4].push(entry)
  }
  for (const q of QUADRANTS) {
    result[q].sort(cmp)
  }
  return result
}

export function quadrantEntryTaskCount(entries: QuadrantEntry[]): number {
  let n = 0
  for (const entry of entries) {
    if (entry.kind === 'task') n += 1
    else n += entry.tasks.length
  }
  return n
}

export function groupByQuadrant(tasks: Task[], order: SortOrder = 'newest'): QuadrantGroups {
  const groups: QuadrantGroups = { 1: [], 2: [], 3: [], 4: [] }
  for (const task of tasks) {
    const q = task.quadrant
    if (q >= 1 && q <= 4) groups[q as 1 | 2 | 3 | 4].push(task)
  }
  const cmp =
    order === 'oldest'
      ? (a: Task, b: Task) => taskSortAt(a) - taskSortAt(b)
      : (a: Task, b: Task) => taskSortAt(b) - taskSortAt(a)
  for (const q of QUADRANTS) {
    groups[q].sort(cmp)
  }
  return groups
}

function atEightAmLocal(date: Date): number {
  const d = new Date(date)
  d.setHours(8, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

export function snoozeTimes(now: Date): { tomorrow: number; nextMonday: number; inWeek: number } {
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const nextMonday = new Date(now)
  const day = nextMonday.getDay()
  let daysUntilMonday = (8 - day) % 7
  if (daysUntilMonday === 0) daysUntilMonday = 7
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday)

  const inWeek = new Date(now)
  inWeek.setDate(inWeek.getDate() + 7)

  return {
    tomorrow: atEightAmLocal(tomorrow),
    nextMonday: atEightAmLocal(nextMonday),
    inWeek: atEightAmLocal(inWeek),
  }
}

export const QUADRANT_TITLES: Record<1 | 2 | 3 | 4, string> = {
  1: 'Urgent & Important',
  2: 'Important & Not Urgent',
  3: 'Urgent & Not Important',
  4: 'Not Urgent & Not Important',
}

export function quadrantTitle(q: number): string {
  if (q >= 1 && q <= 4) return QUADRANT_TITLES[q as 1 | 2 | 3 | 4]
  return `Quadrant ${q}`
}

/** `datetime-local` value (local, no timezone suffix) → epoch seconds. */
export function localInputToEpoch(value: string): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const ms = new Date(value).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.floor(ms / 1000)
}

/** Epoch seconds → `datetime-local` value in local time. */
export function epochToLocalInput(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function defaultCustomSnoozeInput(now: Date): string {
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(8, 0, 0, 0)
  return epochToLocalInput(Math.floor(tomorrow.getTime() / 1000))
}

export function formatSnoozeUntil(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Relative "last updated" label for task cards (not the same rules as relativeTime). */
/** When the source chat message was sent; falls back to plugin touch time. */
export function taskActivityAt(task: Task): number {
  const s = task.source_msg_at
  if (s != null && Number.isFinite(s) && s > 0) return s
  return task.updated_at
}

/** Sort key for newest/oldest: message time when known, else task creation. */
export function taskSortAt(task: Task): number {
  const s = task.source_msg_at
  if (s != null && Number.isFinite(s) && s > 0) return s
  return task.created_at
}

export function formatUpdated(epochSeconds: number, now: Date): string {
  if (!Number.isFinite(epochSeconds)) return ''
  const then = epochSeconds * 1000
  const diffMs = now.getTime() - then
  if (diffMs < 60_000) return 'just now'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const d = new Date(then)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: now.getFullYear() !== d.getFullYear() ? 'numeric' : undefined,
  })
}

export function formatUpdatedTitle(epochSeconds: number): string {
  if (!Number.isFinite(epochSeconds)) return ''
  return new Date(epochSeconds * 1000).toLocaleString(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
  })
}

export function groupUpdatedAt(tasks: Task[]): number {
  let max = 0
  for (const t of tasks) {
    const at = taskActivityAt(t)
    if (Number.isFinite(at) && at > max) max = at
  }
  return max
}

export function flattenQuadrantEntries(
  groups: QuadrantEntryGroups,
  order: SortOrder = 'newest',
): QuadrantEntry[] {
  const all: QuadrantEntry[] = [...groups[1], ...groups[2], ...groups[3], ...groups[4]]
  const cmp =
    order === 'oldest'
      ? (a: QuadrantEntry, b: QuadrantEntry) => a.sortAt - b.sortAt
      : (a: QuadrantEntry, b: QuadrantEntry) => b.sortAt - a.sortAt
  all.sort(cmp)
  return all
}

export function relativeTime(epochSeconds: number, now: Date): string {
  if (!Number.isFinite(epochSeconds)) return ''
  const then = epochSeconds * 1000
  const diffMs = now.getTime() - then
  if (diffMs < 60_000) return 'just now'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes} min ago`

  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  if (then >= startOfYesterday.getTime() && then < startOfToday.getTime()) return 'yesterday'

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`

  return new Date(then).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: now.getFullYear() !== new Date(then).getFullYear() ? 'numeric' : undefined,
  })
}

export function isLocalChat(chatKey: string): boolean {
  return !chatKey.includes(':')
}

export function quadrantCounts(tasks: Task[]): Record<string, number> {
  const counts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0 }
  for (const task of tasks) {
    const key = String(task.quadrant)
    if (key in counts) counts[key] += 1
  }
  return counts
}

export type AgentFilter = 'all' | string
/** A Hermes project key, or 'none' for tasks with no project. */
export type ProjectSel = string
export type ProjectFilter = 'all' | ProjectSel[]
/** Tag ids; a task must have every one (AND). Empty means no tag filter. */
export type TagFilter = number[]

export function taskProjectKey(task: Pick<Task, 'project'>): string | null {
  return task.project?.key ?? null
}

export function taskTags(task: Pick<Task, 'tags'>): TaskTag[] {
  return Array.isArray(task.tags) ? task.tags : []
}

/** Stored filter → key strings. Old numeric project ids are dropped (stale). */
export function parseStoredProjectFilter(raw: unknown): ProjectFilter {
  if (raw === 'all') return 'all'
  if (raw === 'none') return ['none']
  if (typeof raw === 'string' && raw.trim() !== '') return [raw]
  if (Array.isArray(raw)) {
    const out: ProjectSel[] = []
    for (const item of raw) {
      if (typeof item !== 'string' || item.trim() === '') continue
      if (out.includes(item)) continue
      out.push(item)
    }
    return out.length === 0 ? 'all' : out
  }
  return 'all'
}

/** Drop project keys that no longer exist. 'none' always stays. */
export function pruneProjectFilter(filter: ProjectFilter, knownKeys: Iterable<string>): ProjectFilter {
  if (filter === 'all') return 'all'
  const known = new Set(knownKeys)
  const next = filter.filter(sel => sel === 'none' || known.has(sel))
  if (next.length === filter.length) return filter
  return next.length === 0 ? 'all' : next
}

export function toggleProjectSel(filter: ProjectFilter, sel: ProjectSel): ProjectFilter {
  if (filter === 'all') return [sel]
  if (filter.includes(sel)) {
    const next = filter.filter(s => s !== sel)
    return next.length === 0 ? 'all' : next
  }
  return [...filter, sel]
}

export function parseStoredTagFilter(raw: unknown): TagFilter {
  if (!Array.isArray(raw)) return []
  const out: number[] = []
  for (const item of raw) {
    const n = typeof item === 'number' ? item : typeof item === 'string' ? Number(item) : NaN
    if (!Number.isInteger(n) || out.includes(n)) continue
    out.push(n)
  }
  return out
}

export function pruneTagFilter(filter: TagFilter, knownIds: Iterable<number>): TagFilter {
  const known = new Set(knownIds)
  const next = filter.filter(id => known.has(id))
  return next.length === filter.length ? filter : next
}

export function toggleTagSel(filter: TagFilter, id: number): TagFilter {
  return filter.includes(id) ? filter.filter(x => x !== id) : [...filter, id]
}

export function showProjectChips(filter: ProjectFilter): boolean {
  if (filter === 'all') return true
  return filter.length >= 2
}

/** Distinct projects across a group's tasks, in first-seen order. */
export function groupProjects(tasks: Pick<Task, 'project'>[]): TaskProject[] {
  const out: TaskProject[] = []
  const seen = new Set<string>()
  for (const t of tasks) {
    const p = t.project
    if (!p || seen.has(p.key)) continue
    seen.add(p.key)
    out.push(p)
  }
  return out
}

/** Distinct tags across tasks (a group card shows the union). */
export function unionTags(tasks: Pick<Task, 'tags'>[]): TaskTag[] {
  const out: TaskTag[] = []
  const seen = new Set<number>()
  for (const t of tasks) {
    for (const tag of taskTags(t)) {
      if (seen.has(tag.id)) continue
      seen.add(tag.id)
      out.push(tag)
    }
  }
  return out
}

export type TagCheckState = 'all' | 'some' | 'none'

export function tagCheckState(tasks: Pick<Task, 'tags'>[], tagId: number): TagCheckState {
  if (tasks.length === 0) return 'none'
  let n = 0
  for (const t of tasks) if (taskTags(t).some(tag => tag.id === tagId)) n += 1
  if (n === 0) return 'none'
  return n === tasks.length ? 'all' : 'some'
}

/** First `max` chips, plus how many are left for a "+N" chip. */
export function visibleTagChips<T>(tags: T[], max = 3): { shown: T[]; extra: number } {
  if (tags.length <= max) return { shown: tags, extra: 0 }
  return { shown: tags.slice(0, max), extra: tags.length - max }
}

export function taskPassesFilters(
  task: Pick<Task, 'agent' | 'project' | 'tags'>,
  agentFilter: AgentFilter,
  projectFilter: ProjectFilter,
  tagFilter: TagFilter = [],
): boolean {
  if (agentFilter !== 'all' && task.agent !== agentFilter) return false
  if (projectFilter !== 'all') {
    const key = taskProjectKey(task)
    if (!projectFilter.includes(key ?? 'none')) return false
  }
  if (tagFilter.length > 0) {
    const ids = new Set(taskTags(task).map(t => t.id))
    if (!tagFilter.every(id => ids.has(id))) return false
  }
  return true
}

export function filterOpenTasks(
  tasks: Task[],
  agentFilter: AgentFilter,
  projectFilter: ProjectFilter,
  tagFilter: TagFilter = [],
): Task[] {
  if (agentFilter === 'all' && projectFilter === 'all' && tagFilter.length === 0) return tasks
  return tasks.filter(t => taskPassesFilters(t, agentFilter, projectFilter, tagFilter))
}

export function agentCountsSorted(tasks: Task[]): { agent: string; count: number }[] {
  const map = new Map<string, number>()
  for (const t of tasks) {
    map.set(t.agent, (map.get(t.agent) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([agent, count]) => ({ agent, count }))
    .sort((a, b) => b.count - a.count || a.agent.localeCompare(b.agent))
}

/** Main tasks = one per chat (a nested group counts once); subtasks = asks
 *  inside chats that have two or more. Matches the cards on screen. */
export function mainAndSubCounts(tasks: Task[]): { main: number; sub: number } {
  const byChat = new Map<string, number>()
  for (const t of tasks) byChat.set(t.chat_key, (byChat.get(t.chat_key) ?? 0) + 1)
  let sub = 0
  for (const n of byChat.values()) if (n >= 2) sub += n
  return { main: byChat.size, sub }
}

export function entryMainAndSubCounts(entries: QuadrantEntry[]): { main: number; sub: number } {
  let sub = 0
  for (const e of entries) if (e.kind === 'group') sub += e.tasks.length
  return { main: entries.length, sub }
}

/** Label for a section of cards. The heading and its "Show all" button share it. */
export function sectionCountLabel(entries: QuadrantEntry[]): string {
  return formatMainSubCount(entryMainAndSubCounts(entries))
}

export function sectionShowAllLabel(entries: QuadrantEntry[]): string {
  return `Show all ${sectionCountLabel(entries)}`
}

/** "35 tasks, 73 subtasks"; just "35 tasks" when there are none. */
export function formatMainSubCount(c: { main: number; sub: number }): string {
  const main = `${c.main} ${c.main === 1 ? 'task' : 'tasks'}`
  if (c.sub === 0) return main
  return `${main}, ${c.sub} ${c.sub === 1 ? 'subtask' : 'subtasks'}`
}

export function formatAllAgentsLabel(counts: { main: number; sub: number }): string {
  return `All agents: ${formatMainSubCount(counts)}`
}

export function formatAgentOptionLabel(agent: string, counts: { main: number; sub: number }): string {
  return `${agent}: ${formatMainSubCount(counts)}`
}

export function agentMainSubCounts(tasks: Task[]): { agent: string; counts: { main: number; sub: number } }[] {
  const by = new Map<string, Task[]>()
  for (const t of tasks) by.set(t.agent, [...(by.get(t.agent) ?? []), t])
  return [...by.entries()]
    .map(([agent, list]) => ({ agent, counts: mainAndSubCounts(list) }))
    .sort((a, b) => b.counts.main - a.counts.main || a.agent.localeCompare(b.agent))
}

export type WouMode = 'auto' | 'hourly' | 'manual' | 'off'

export const SETTING_INT_KEYS = [
  'debounce_seconds',
  'sweep_minutes',
  'max_chats_per_scan',
  'daily_call_cap',
  'lookback_days',
  'retention_days',
] as const

export type SettingIntKey = (typeof SETTING_INT_KEYS)[number]

export const SETTING_INT_RANGES: Record<SettingIntKey, readonly [number, number]> = {
  debounce_seconds: [30, 600],
  sweep_minutes: [15, 240],
  max_chats_per_scan: [5, 100],
  daily_call_cap: [0, 2000],
  lookback_days: [1, 30],
  retention_days: [0, 365],
}

export function clampSettingInt(key: SettingIntKey, value: number): number {
  const [lo, hi] = SETTING_INT_RANGES[key]
  if (!Number.isFinite(value)) return lo
  const n = Math.trunc(value)
  if (n < lo) return lo
  if (n > hi) return hi
  return n
}

export function validateSettingInt(key: SettingIntKey, value: unknown): string | null {
  if (typeof value === 'string' && value.trim() === '') {
    return 'Must be a number'
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return 'Must be a whole number'
  }
  const [lo, hi] = SETTING_INT_RANGES[key]
  if (n < lo || n > hi) {
    return `Must be between ${lo} and ${hi}`
  }
  return null
}

/** Plain-English how often chats are checked (first-run copy). */
export function modeCheckDescription(mode: WouMode, sweepMinutes: number): string {
  switch (mode) {
    case 'auto':
      return `after each chat, plus a check every ${sweepMinutes} min`
    case 'hourly':
      return 'about every hour'
    case 'manual':
      return 'only when you tap Scan'
    case 'off':
      return 'only when you turn updates back on and scan'
  }
}

export function headerModeLabel(mode: WouMode): string | null {
  switch (mode) {
    case 'manual':
      return 'Manual'
    case 'hourly':
      return 'Hourly'
    case 'off':
      return 'Paused'
    default:
      return null
  }
}

export function isDailyCapReached(todayCalls: number, dailyCap: number): boolean {
  return dailyCap > 0 && todayCalls >= dailyCap
}

export function formatWithThousands(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return Math.trunc(n).toLocaleString('en-US')
}

export function formatTodayUsage(
  calls: number,
  promptTokens: number,
  completionTokens: number,
): string {
  const tokens = promptTokens + completionTokens
  return `Today: ${formatWithThousands(calls)} calls, ${formatWithThousands(tokens)} tokens`
}

export function formatTodayChecksLine(calls: number, dailyCap: number): string {
  const used = formatWithThousands(calls)
  if (dailyCap <= 0) return `Today: ${used} checks used of no limit`
  return `Today: ${used} checks used of ${formatWithThousands(dailyCap)}`
}

export function todayChecksProgress(calls: number, dailyCap: number): number {
  if (dailyCap <= 0) return 0
  return Math.min(1, Math.max(0, calls / dailyCap))
}

export function formatUsageDayLine(
  date: string,
  calls: number,
  promptTokens: number,
  completionTokens: number,
): string {
  const tokens = promptTokens + completionTokens
  return `${date}: ${formatWithThousands(calls)} calls, ${formatWithThousands(tokens)} tokens`
}

export function settingsFieldVisible(
  field: 'sweep_minutes' | 'debounce_seconds' | 'max_chats_per_scan',
  mode: WouMode,
): boolean {
  switch (field) {
    case 'debounce_seconds':
      return mode === 'auto'
    case 'sweep_minutes':
      return mode === 'auto' || mode === 'hourly'
    case 'max_chats_per_scan':
      return mode !== 'off'
  }
}

export function firstRunCapSentence(dailyCap: number): string {
  if (dailyCap <= 0) return 'There is no daily limit on model calls.'
  return `It stops after ${formatWithThousands(dailyCap)} model calls a day.`
}

export function normalizeForSearch(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function tokenizeQuery(q: string): string[] {
  const norm = normalizeForSearch(q.trim())
  if (!norm) return []
  return norm.split(/\s+/).filter(Boolean)
}

export interface TaskSearchContext {
  groupTitle?: string
  projectName?: string | null
  nameAfterChat?: boolean
}

function searchHaystack(parts: string[]): string {
  return normalizeForSearch(parts.filter(p => p != null && p !== '').join('\n'))
}

export function taskMatches(
  task: Task,
  tokens: string[],
  ctx: TaskSearchContext = {},
): boolean {
  if (tokens.length === 0) return true
  const displayTitle = ctx.nameAfterChat ? taskDisplayTitle(task, true) : task.topic
  const haystack = searchHaystack([
    displayTitle,
    task.topic,
    task.title_override ?? '',
    task.ask,
    task.chat_title,
    task.agent,
    task.project?.name ?? '',
    ...taskTags(task).map(t => t.name),
    task.context ?? '',
    ctx.groupTitle ?? '',
    ctx.projectName ?? '',
  ])
  return tokens.every(t => haystack.includes(t))
}

export function groupMetaMatches(
  group: Pick<TaskGroup, 'title' | 'chat_title' | 'agent' | 'title_locked'>,
  projectName: string | null | undefined,
  tokens: string[],
  nameAfterChat = false,
): boolean {
  if (tokens.length === 0) return false
  const displayTitle = groupDisplayTitle(group as TaskGroup, nameAfterChat)
  const haystack = searchHaystack([
    displayTitle,
    group.title,
    group.chat_title,
    group.agent,
    projectName ?? '',
  ])
  return tokens.every(t => haystack.includes(t))
}

export function filterQuadrantEntriesForSearch(
  entries: QuadrantEntry[],
  tokens: string[],
  /** Defaults to the names of the Hermes projects on the group's tasks. */
  resolveProjectName?: ((group: TaskGroup) => string | null) | null,
  nameAfterChat = false,
): QuadrantEntry[] {
  if (tokens.length === 0) return entries
  const result: QuadrantEntry[] = []
  for (const entry of entries) {
    if (entry.kind === 'task') {
      if (taskMatches(entry.task, tokens, { nameAfterChat })) result.push(entry)
      continue
    }
    const projectName = resolveProjectName
      ? resolveProjectName(entry.group)
      : groupProjects(entry.tasks).map(p => p.name).join(' ') || null
    const groupTitle = groupDisplayTitle(entry.group, nameAfterChat)
    const showAll = groupMetaMatches(entry.group, projectName, tokens, nameAfterChat)
    const tasks = showAll
      ? entry.tasks
      : entry.tasks.filter(t =>
          taskMatches(t, tokens, {
            groupTitle,
            projectName,
            nameAfterChat,
          }),
        )
    if (tasks.length > 0) {
      result.push({ ...entry, tasks })
    }
  }
  return result
}

function buildNormIndexMap(text: string): { norm: string; toOrig: number[] } {
  const toOrig: number[] = []
  let norm = ''
  for (let i = 0; i < text.length; i++) {
    const n = normalizeForSearch(text[i]!)
    if (!n) continue
    for (let j = 0; j < n.length; j++) {
      norm += n[j]
      toOrig.push(i)
    }
  }
  return { norm, toOrig }
}

export interface SessionOwner {
  connectionId: string
  profile: string
}

/** connection_id for API when the session lives on a different Hermes than ctx.rest. */
export function sessionConnectionIdForApi(
  owner: SessionOwner | null | undefined,
  activeConnectionId: string | null | undefined,
): string | undefined {
  const conn = owner?.connectionId?.trim()
  if (!conn || conn === 'local') return undefined
  const active = activeConnectionId?.trim()
  if (active && conn === active) return undefined
  return conn
}

/** Query params for GET /session-tasks and session-scoped POST /tasks. */
export function sessionQueryParams(
  sessionId: string,
  profile: string,
  owner: SessionOwner | null | undefined,
  activeConnectionId?: string | null,
): Record<string, string> {
  const params: Record<string, string> = {
    session_id: sessionId,
    profile: profile || 'default',
  }
  const conn = sessionConnectionIdForApi(owner, activeConnectionId)
  if (conn) params.connection_id = conn
  return params
}

export function sessionPostBody(
  sessionId: string,
  profile: string,
  owner: SessionOwner | null | undefined,
  activeConnectionId: string | null | undefined,
  fields: {
    ask?: string
    quadrant: number
    title?: string
  },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    session_id: sessionId,
    profile: profile || 'default',
    quadrant: fields.quadrant,
  }
  const conn = sessionConnectionIdForApi(owner, activeConnectionId)
  if (conn) body.connection_id = conn
  if (fields.ask != null && fields.ask !== '') body.ask = fields.ask
  if (fields.title != null && fields.title !== '') body.title = fields.title
  return body
}

export function sessionCurrentQuadrant(
  tasks: Task[],
  group: Pick<TaskGroup, 'quadrant'> | null,
): number {
  const gq = group?.quadrant
  if (gq != null && gq >= 1 && gq <= 4) return gq
  if (tasks.length > 0) {
    const tq = tasks[0].quadrant
    if (tq >= 1 && tq <= 4) return tq
  }
  return 2
}

export type ComposerPatchTarget =
  | { kind: 'task'; taskId: number }
  | { kind: 'group'; chatKey: string }

export function composerPatchTarget(
  tasks: Task[],
  chatKey: string,
): ComposerPatchTarget {
  if (tasks.length === 1) return { kind: 'task', taskId: tasks[0].id }
  return { kind: 'group', chatKey }
}

/** Task ids to send when closing a filtered group snapshot. */
export function groupCloseTaskIds(tasks: Task[]): number[] {
  return tasks.map(t => t.id)
}

export const TASKS_CHANGED_WINDOW_EVENT = 'waiting-on-you:tasks-changed'
export const SETTINGS_CHANGED_WINDOW_EVENT = 'waiting-on-you:settings-changed'

export function dispatchTasksChangedWindow() {
  if (typeof globalThis !== 'undefined' && 'dispatchEvent' in globalThis) {
    globalThis.dispatchEvent(new CustomEvent(TASKS_CHANGED_WINDOW_EVENT))
  }
}

export function dispatchSettingsChangedWindow() {
  if (typeof globalThis !== 'undefined' && 'dispatchEvent' in globalThis) {
    globalThis.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_WINDOW_EVENT))
  }
}

export function highlightRanges(text: string, tokens: string[]): [number, number][] {
  if (!text || tokens.length === 0) return []
  const { norm, toOrig } = buildNormIndexMap(text)
  if (!norm) return []

  const ranges: [number, number][] = []
  for (const token of tokens) {
    if (!token) continue
    let start = 0
    while (start <= norm.length - token.length) {
      const idx = norm.indexOf(token, start)
      if (idx === -1) break
      const origStart = toOrig[idx]!
      const origEnd = toOrig[idx + token.length - 1]! + 1
      ranges.push([origStart, origEnd])
      start = idx + 1
    }
  }

  ranges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const range of ranges) {
    const last = merged[merged.length - 1]
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1])
    } else {
      merged.push([range[0], range[1]])
    }
  }
  return merged
}

export type RenameCommitResult =
  | { action: 'close' }
  | { action: 'save'; value: string | null }

/** Decide task rename outcome from trimmed input vs display title and stored override. */
export function commitTaskRename(
  trimmedInput: string,
  displayTitle: string,
  titleOverride: string | null | undefined,
): RenameCommitResult {
  const next = trimmedInput.trim()
  const prev = titleOverride?.trim() ?? ''
  if (next === prev || (next === displayTitle.trim() && !titleOverride?.trim())) {
    return { action: 'close' }
  }
  return { action: 'save', value: next ? next : null }
}

/** Decide group rename outcome from trimmed input vs display title and lock state. */
export function commitGroupRename(
  trimmedInput: string,
  displayTitle: string,
  group: { title_locked?: boolean; title?: string | null },
): RenameCommitResult {
  const next = trimmedInput.trim()
  const hadLock = Boolean(group.title_locked)
  const prev = hadLock ? group.title?.trim() ?? '' : ''
  if (next === displayTitle.trim() && (!hadLock || next === prev)) {
    return { action: 'close' }
  }
  return { action: 'save', value: next ? next : null }
}

export type GroupBy = 'priority' | 'project' | 'none'

export function parseGroupBy(raw: unknown, showPriorities?: boolean): GroupBy {
  if (raw === 'priority' || raw === 'project' || raw === 'none') return raw
  return showPriorities === false ? 'none' : 'priority'
}

/** How the open list looks. Cards is the default. */
export type ListLayout = 'cards' | 'compact' | 'focus'

export function parseLayout(raw: unknown): ListLayout {
  return raw === 'compact' || raw === 'focus' ? raw : 'cards'
}

/** True when the list holds tasks from more than one agent, so the agent chip tells you something. */
export function hasSeveralAgents(tasks: Pick<Task, 'agent'>[]): boolean {
  const first = tasks[0]?.agent
  return tasks.some(t => t.agent !== first)
}

/**
 * The "Next up" pick: the first task of the first entry in list order
 * (sections when grouped, else the flat list). A group yields its first task.
 */
export function pickNextUp(
  sections: { entries: QuadrantEntry[] }[] | null,
  flat: QuadrantEntry[],
): { task: Task; group: TaskGroup | null; groupSize: number } | null {
  const lists = sections == null ? [flat] : sections.map(s => s.entries)
  for (const list of lists) {
    for (const entry of list) {
      if (entry.kind === 'task') return { task: entry.task, group: null, groupSize: 1 }
      const first = entry.tasks[0]
      if (first) return { task: first, group: entry.group, groupSize: entry.tasks.length }
    }
  }
  return null
}

/** ⌘⌥P: Priority ↔ None. From Project it goes back to Priority. */
export function nextGroupByForPriorityToggle(current: GroupBy): GroupBy {
  return current === 'priority' ? 'none' : 'priority'
}

export interface ListSection {
  /** Stable key, also the collapsed-state key ("1".."4", "project:<key>", "no-project"). */
  key: string
  title: string
  entries: QuadrantEntry[]
}

export const NO_PROJECT_SECTION_KEY = 'no-project'

export function projectSectionKey(projectKey: string | null): string {
  return projectKey == null ? NO_PROJECT_SECTION_KEY : `project:${projectKey}`
}

/** The project a card belongs to: the task's, or the first one found in a group. */
export function entryProject(entry: QuadrantEntry): TaskProject | null {
  if (entry.kind === 'task') return entry.task.project ?? null
  for (const t of entry.tasks) if (t.project) return t.project
  return null
}

export function entryChatKey(entry: QuadrantEntry): string {
  return entry.kind === 'group' ? entry.group.chat_key : entry.task.chat_key
}

/** One section per project, sorted by name; "No project" last. Keeps entry order inside. */
export function buildProjectSections(entries: QuadrantEntry[], noProjectTitle: string): ListSection[] {
  const byKey = new Map<string, ListSection>()
  const none: QuadrantEntry[] = []
  for (const entry of entries) {
    const project = entryProject(entry)
    if (!project) {
      none.push(entry)
      continue
    }
    const key = projectSectionKey(project.key)
    let section = byKey.get(key)
    if (!section) {
      section = { key, title: project.name, entries: [] }
      byKey.set(key, section)
    }
    section.entries.push(entry)
  }
  const sections = [...byKey.values()].sort(
    (a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) ||
      a.key.localeCompare(b.key),
  )
  if (none.length > 0) {
    sections.push({ key: NO_PROJECT_SECTION_KEY, title: noProjectTitle, entries: none })
  }
  return sections
}

export function buildQuadrantSections(
  groups: QuadrantEntryGroups,
  titles: Record<1 | 2 | 3 | 4, string> = QUADRANT_TITLES,
): ListSection[] {
  return QUADRANTS.map(q => ({ key: String(q), title: titles[q], entries: groups[q] }))
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'later'

function startOfLocalDay(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

/** Due chip text by local calendar day: Overdue, Due today, Due tomorrow, Due Fri, Due Nov 14. */
export function dueChipLabel(dueAt: number, now: Date): { label: string; tone: DueTone } | null {
  if (!Number.isFinite(dueAt) || dueAt <= 0) return null
  const due = new Date(dueAt * 1000)
  const dayMs = 24 * 60 * 60 * 1000
  const days = Math.round((startOfLocalDay(due) - startOfLocalDay(now)) / dayMs)
  if (days < 0) return { label: 'Overdue', tone: 'overdue' }
  if (days === 0) return { label: 'Due today', tone: 'today' }
  if (days === 1) return { label: 'Due tomorrow', tone: 'soon' }
  if (days < 7) {
    return { label: `Due ${due.toLocaleDateString('en-US', { weekday: 'short' })}`, tone: 'soon' }
  }
  const sameYear = due.getFullYear() === now.getFullYear()
  const date = due.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
  return { label: `Due ${date}`, tone: 'later' }
}

/** Earliest due date among tasks (for a group card), or null. */
export function earliestDueAt(tasks: Pick<Task, 'due_at'>[]): number | null {
  let best: number | null = null
  for (const t of tasks) {
    const d = t.due_at
    if (d == null || !Number.isFinite(d) || d <= 0) continue
    if (best == null || d < best) best = d
  }
  return best
}
