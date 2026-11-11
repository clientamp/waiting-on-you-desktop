import { type PluginContext } from '@hermes/plugin-sdk'
import type { ReactNode } from 'react'
import { snoozeTimes, type Task } from '../model'
import { planOpen } from './chatRoute'
import { openChat as openChatTarget } from './openChat'
import { strings } from './strings'
import { useAnswerControls } from './answerContext'

interface NextUpCardProps {
  ctx: PluginContext
  task: Task
  /** The task's normal row, so its menu, card actions and follow target all still work. */
  children: ReactNode
  pendingLabel?: string
  disabled?: boolean
  onDone: (task: Task) => void
  onSnooze: (task: Task, until: number) => void
}

/** "Next up" layout: the first task in list order, its full row, and three big actions. */
export function NextUpCard({
  ctx,
  task,
  children,
  pendingLabel,
  disabled,
  onDone,
  onSnooze,
}: NextUpCardProps) {
  // With answer controls, the row's own answer bar (Yes · No · Reply · Done · Later · Open) replaces these.
  const answers = useAnswerControls()
  const busy = Boolean(disabled || pendingLabel)
  const notAChat = planOpen(task.chat_key, task.chat_target).kind === 'not-a-chat'
  const openLabel = notAChat ? strings.handleWithAgent(task.agent) : strings.openSession

  return (
    <section className="wou-next-up" aria-label={strings.nextUpRegion}>
      <div className="wou-next-up-kicker">
        <span>{strings.nextUpKicker}</span>
      </div>
      {children}
      {pendingLabel || answers ? null : (
        <div className="wou-next-up-actions">
          <button type="button" className="wou-next-up-primary" disabled={busy} onClick={() => onDone(task)}>
            {strings.nextUpDone}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void openChatTarget(ctx, task.chat_key, task.chat_title, task.chat_target, [task])}
          >
            {openLabel}
          </button>
          <button
            type="button"
            title={strings.nextUpLaterTip}
            disabled={busy}
            onClick={() => onSnooze(task, snoozeTimes(new Date()).tomorrow)}
          >
            {strings.nextUpLater}
          </button>
        </div>
      )}
    </section>
  )
}
