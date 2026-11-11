import type { Task } from '../model'

export type CatchUpViewEligibility = {
  consented: boolean
  projectsFetchSucceeded: boolean
  tasksFetchSucceeded: boolean
  offline: boolean
  projects: ReadonlyArray<{ key: string }>
  projectKey: string | null
}

export function catchUpProjectKnown(
  projects: ReadonlyArray<{ key: string }>,
  projectKey: string | null,
): boolean {
  return projectKey == null || projects.some(p => p.key === projectKey)
}

/** Same gates as CatchUpView waiting-chat rows and panel keyboard scope. */
export function catchUpViewEligible(view: CatchUpViewEligibility): boolean {
  if (!view.consented) return false
  if (!view.projectsFetchSucceeded || !view.tasksFetchSucceeded) return false
  if (view.offline) return false
  if (!catchUpProjectKnown(view.projects, view.projectKey)) return false
  return true
}

/** Opaque Hermes keys, never legacy classifier ids or project names. */
export function catchUpChats(tasks: Task[], projectKey: string | null): { open: Task[]; snoozed: number } {
  const matching = tasks.filter(t => (t.project?.key ?? null) === projectKey)
  return {
    open: matching.filter(t => t.status === 'open'),
    snoozed: matching.filter(t => t.status === 'snoozed').length,
  }
}

export function catchUpGroups(tasks: Task[]): { chatKey: string; tasks: Task[] }[] {
  const groups = new Map<string, Task[]>()
  for (const task of tasks) {
    const group = groups.get(task.chat_key) ?? []
    group.push(task)
    groups.set(task.chat_key, group)
  }
  return [...groups].map(([chatKey, tasks]) => ({ chatKey, tasks }))
}

/** Display order for catch-up rows: open asks in this project only (matches CatchUpView). */
export function catchUpVisibleTaskOrder(tasks: Task[], projectKey: string | null): number[] {
  const open = catchUpChats(tasks, projectKey).open
  return catchUpGroups(open).flatMap(g => g.tasks.map(t => t.id))
}

/** Resolve the keyboard/active target only when it belongs to the current catch-up project. */
export function catchUpVisibleTask(
  tasks: Task[],
  projectKey: string | null,
  activeId: number | null,
): Task | null {
  if (activeId == null) return null
  if (!catchUpVisibleTaskOrder(tasks, projectKey).includes(activeId)) return null
  return tasks.find(t => t.id === activeId) ?? null
}

export function catchUpVisibleTaskOrderForView(
  tasks: Task[],
  view: CatchUpViewEligibility,
): number[] {
  if (!catchUpViewEligible(view)) return []
  return catchUpVisibleTaskOrder(tasks, view.projectKey)
}

export function catchUpActiveTask(
  tasks: Task[],
  view: CatchUpViewEligibility,
  activeId: number | null,
): Task | null {
  if (!catchUpViewEligible(view)) return null
  return catchUpVisibleTask(tasks, view.projectKey, activeId)
}
