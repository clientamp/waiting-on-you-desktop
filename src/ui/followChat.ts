/** Pure helpers for “follow selected chat” in the Desktop pane. No SDK imports. */

import type { Task, TaskGroup, QuadrantEntry, ListSection, TaskProject, TaskTag } from '../model'
import type { AgentFilter, ProjectFilter, TagFilter } from '../model'
import { entryChatKey, taskPassesFilters } from '../model'
import { planOpen, type ChatTarget } from './chatRoute'

export interface FocusedChatSelection {
  sessionId: string | null
  profile?: string | null
  owner?: { connectionId: string; profile: string } | null
}

export interface TaskForFollowMatch {
  chat_key: string
  chat_target?: ChatTarget | null
  status: string
}

export function normalizeFollowProfile(profile: string | null | undefined): string {
  const p = profile?.trim()
  return (p ? p : 'default').toLowerCase()
}

/** True when the host gave enough context to disambiguate profile / remote chats. */
export function hostProvidesOwnerContext(sel: FocusedChatSelection): boolean {
  const conn = sel.owner?.connectionId?.trim()
  if (conn && conn !== 'local') return true
  if (normalizeFollowProfile(sel.owner?.profile) !== 'default') return true
  if (normalizeFollowProfile(sel.profile) !== 'default') return true
  return false
}

function connectionIdsForPlan(plan: {
  connection: string | null
  aliases?: string[]
}): Set<string> {
  const ids = new Set<string>()
  if (plan.connection) ids.add(plan.connection)
  for (const a of plan.aliases ?? []) {
    const t = a.trim()
    if (t) ids.add(t)
  }
  return ids
}

export function profileChatOwnerMatches(
  plan: { profile: string; connection: string | null; aliases?: string[] },
  sel: FocusedChatSelection,
): boolean {
  const focusProfile = normalizeFollowProfile(sel.owner?.profile ?? sel.profile)
  const planProfile = normalizeFollowProfile(plan.profile)
  if (focusProfile !== planProfile) return false

  const focusConn = sel.owner?.connectionId?.trim()
  if (!focusConn || focusConn === 'local') {
    return !plan.connection
  }

  const taskIds = connectionIdsForPlan(plan)
  if (taskIds.size === 0) return true
  return taskIds.has(focusConn)
}

/** Whether an open task (not done/dismissed) belongs to the sidebar-selected chat. */
export function taskMatchesFocusedSession(
  task: TaskForFollowMatch,
  sel: FocusedChatSelection,
): boolean {
  if (!sel.sessionId) return false
  if (task.status === 'done' || task.status === 'dismissed') return false

  const plan = planOpen(task.chat_key, task.chat_target)
  if (plan.kind === 'not-a-chat') return false
  if (plan.sessionId !== sel.sessionId) return false

  if (plan.kind === 'main') return true
  if (!hostProvidesOwnerContext(sel)) return true
  return profileChatOwnerMatches(plan, sel)
}

/**
 * Stricter than {@link taskMatchesFocusedSession} for row presence: a main/default chat row
 * must not inherit focus from a profile-scoped sidebar selection (same stored session id).
 */
export function taskMatchesFocusedSessionForPresence(
  task: TaskForFollowMatch,
  sel: FocusedChatSelection,
): boolean {
  if (!taskMatchesFocusedSession(task, sel)) return false
  const plan = planOpen(task.chat_key, task.chat_target)
  if (plan.kind === 'main' && hostProvidesOwnerContext(sel)) return false
  return true
}

export interface FollowTarget {
  chatKey: string
  quadrant: number
  agent: string
  project: TaskProject | null
  /** Every tag on any of the chat's open tasks. */
  tags: TaskTag[]
  kind: 'task' | 'group'
}

export function findFollowTargetInTasks(
  tasks: readonly Task[],
  groups: readonly TaskGroup[],
  sel: FocusedChatSelection,
): FollowTarget | null {
  const matches = tasks.filter(t => taskMatchesFocusedSession(t, sel))
  if (matches.length === 0) return null

  const chatKey = matches[0].chat_key
  const chatTasks = matches.filter(t => t.chat_key === chatKey)
  const groupMeta = groups.find(g => g.chat_key === chatKey)
  const quadrant =
    groupMeta?.quadrant ??
    Math.min(...chatTasks.map(t => t.quadrant))
  const agent = chatTasks[0].agent
  const project = groupMeta?.project ?? chatTasks.find(t => t.project)?.project ?? null
  const tags: TaskTag[] = []
  for (const t of chatTasks) {
    for (const tag of t.tags ?? []) if (!tags.some(x => x.id === tag.id)) tags.push(tag)
  }

  return {
    chatKey,
    quadrant,
    agent,
    project,
    tags,
    kind: chatTasks.length >= 2 ? 'group' : 'task',
  }
}

export function followSelectionKey(sel: FocusedChatSelection): string | null {
  if (!sel.sessionId) return null
  const profile = normalizeFollowProfile(sel.owner?.profile ?? sel.profile)
  const conn = sel.owner?.connectionId?.trim() ?? ''
  return `${sel.sessionId}\0${profile}\0${conn}`
}

export interface FollowUnhideState {
  agentFilter: AgentFilter
  projectFilter: ProjectFilter
  tagFilter?: TagFilter
  searchActive: boolean
  collapsed: Record<string, boolean>
  expandedSections: Record<string, boolean>
  groupExpanded: Record<string, boolean>
}

export interface FollowUnhideActions {
  agentFilter?: AgentFilter
  projectFilter?: ProjectFilter
  tagFilter?: TagFilter
  closeSearch?: boolean
  collapsed?: Record<string, boolean>
  expandedSections?: Record<string, boolean>
  groupExpanded?: Record<string, boolean>
}

export function targetPassesFilters(
  target: Pick<FollowTarget, 'agent' | 'project' | 'tags'>,
  agentFilter: AgentFilter,
  projectFilter: ProjectFilter,
  tagFilter: TagFilter = [],
): boolean {
  return taskPassesFilters(target, agentFilter, projectFilter, tagFilter)
}

function findSection(
  sections: ListSection[] | null,
  chatKey: string,
): { section: ListSection; index: number } | null {
  if (!sections) return null
  for (const section of sections) {
    const index = section.entries.findIndex(e => entryChatKey(e) === chatKey)
    if (index >= 0) return { section, index }
  }
  return null
}

/** sections: the visible list sections, or null for one flat list. */
export function computeFollowUnhideActions(
  target: FollowTarget,
  sections: ListSection[] | null,
  state: FollowUnhideState,
  sectionPreview = 15,
): FollowUnhideActions {
  const actions: FollowUnhideActions = {}

  if (!targetPassesFilters(target, state.agentFilter, state.projectFilter, state.tagFilter ?? [])) {
    actions.agentFilter = 'all'
    actions.projectFilter = 'all'
    actions.tagFilter = []
  }

  if (state.searchActive) {
    actions.closeSearch = true
  }

  const found = findSection(sections, target.chatKey)
  if (found) {
    const key = found.section.key
    if (state.collapsed[key]) {
      actions.collapsed = { ...state.collapsed, [key]: false }
    }
    if (found.index >= sectionPreview && !state.expandedSections[key]) {
      actions.expandedSections = { ...state.expandedSections, [key]: true }
    }
  }

  if (target.kind === 'group' && state.groupExpanded[target.chatKey] === false) {
    actions.groupExpanded = { ...state.groupExpanded, [target.chatKey]: true }
  }

  return actions
}

export function entryVisibleForFollow(
  target: FollowTarget,
  sections: ListSection[] | null,
  flatEntries: QuadrantEntry[],
  sectionPreview: number,
  expandedSections: Record<string, boolean>,
  collapsed: Record<string, boolean>,
): boolean {
  if (!sections) {
    return flatEntries.some(e => entryChatKey(e) === target.chatKey)
  }
  const found = findSection(sections, target.chatKey)
  if (!found) return false
  const key = found.section.key
  if (collapsed[key]) return false
  if (expandedSections[key]) return true
  return found.index < sectionPreview
}
