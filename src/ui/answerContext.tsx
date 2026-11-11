import { createContext, useContext } from 'react'
import type { Task } from '../model'
import type { AnswerKind } from './answers'
import type { AnswerPhase } from './answerQueue'

/** What the panel gives every task row so it can show and run the answer bar.
 *  A context (not props) so rows nested inside chat groups get it too. */
export interface AnswerControls {
  activeId: number | null
  /** ⌘⌥A: show the bar on every task, not just the selected one. */
  showAll: boolean
  /** Desktop can send into a chat from here. */
  canSubmit: boolean
  /** Bumped when R is pressed: the active row opens its reply box. */
  replyRequest: { taskId: number; n: number } | null
  phase: (taskId: number) => AnswerPhase | null
  answerLabel: (taskId: number) => string | null
  activate: (task: Task) => void
  answer: (task: Task, kind: AnswerKind, reply?: string) => void
  cancel: (task: Task) => void
  later: (task: Task) => void
  open: (task: Task) => void
}

export const AnswerContext = createContext<AnswerControls | null>(null)

export function useAnswerControls(): AnswerControls | null {
  return useContext(AnswerContext)
}
