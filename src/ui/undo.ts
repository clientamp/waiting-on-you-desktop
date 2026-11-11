import type { Task } from '../model'

export type UndoKind = 'done' | 'dismissed' | 'snooze' | 'quadrant' | 'rename' | 'tags'

export type TaskPatch = {
  priority_restore?: import('./api').PriorityRestore
  status?: string
  quadrant?: number
  quadrant_locked?: boolean
  restore?: boolean
  snooze_until?: number | null
  title?: string | null
}

/** Undo for a tag change: per task, what to add back and what to take off. */
export type TagRestore = { taskId: number; add: number[]; remove: number[] }

export type UndoEntry =
  | {
      scope: 'task'
      task: Task
      kind: UndoKind
      message: string
      patch: TaskPatch
    }
  | {
      scope: 'group'
      tasks: Task[]
      kind: UndoKind
      message: string
      patches: { task: Task; patch: TaskPatch }[]
      groupRestore?: { chat_key: string; patch: TaskPatch }
    }
  | {
      scope: 'tags'
      kind: 'tags'
      message: string
      restore: TagRestore[]
    }

/** Empty changed IDs mean success without an undoable mutation. */
export function narrowGroupUndo(entry: UndoEntry, closedIds: number[] | undefined): UndoEntry | null {
  if (entry.scope !== 'group' || !Array.isArray(closedIds)) return entry
  const keep = new Set(closedIds)
  if (keep.size === 0) return null
  if (entry.patches.every(p => keep.has(p.task.id))) return entry
  return {
    ...entry,
    tasks: entry.tasks.filter(t => keep.has(t.id)),
    patches: entry.patches.filter(p => keep.has(p.task.id)),
  }
}

export const UNDO_MS = 10_000
export const PENDING_MS = 1500
export const CHECKBOX_GUARD_MS = 600
export const MAX_UNDO_STACK = 20

let undoHandler: (() => void) | null = null
let scanHandler: (() => void) | null = null
let toggleAllGroupsHandler: (() => void) | null = null

export function registerUndoHandler(fn: (() => void) | null): void {
  undoHandler = fn
}

export function runRegisteredUndo(): void {
  undoHandler?.()
}

export function registerScanHandler(fn: (() => void) | null): void {
  scanHandler = fn
}

export function runRegisteredScan(): void {
  scanHandler?.()
}

export function registerToggleAllGroupsHandler(fn: (() => void) | null): void {
  toggleAllGroupsHandler = fn
}

export function runRegisteredToggleAllGroups(): void {
  toggleAllGroupsHandler?.()
}

let toggleAnswerBarsHandler: (() => void) | null = null

export function registerToggleAnswerBarsHandler(fn: (() => void) | null): void {
  toggleAnswerBarsHandler = fn
}

export function runRegisteredToggleAnswerBars(): void {
  toggleAnswerBarsHandler?.()
}

let teachHandler: (() => void) | null = null
let teachRequested = false

/** The panel registers this. A request made before it mounts runs once it does. */
export function registerTeachHandler(fn: (() => void) | null): void {
  teachHandler = fn
  if (fn && teachRequested) {
    teachRequested = false
    fn()
  }
}

export function requestTeach(): void {
  if (teachHandler) {
    teachRequested = false
    teachHandler()
  } else {
    teachRequested = true
  }
}
