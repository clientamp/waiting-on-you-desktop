import { type PluginContext } from '@hermes/plugin-sdk'
import { useState } from 'react'
import type { Task, TaskAction } from '../model'
import { runTaskAction } from './api'
import { notify, notifyError } from './notify'
import { strings } from './strings'

interface TaskCardActionsProps {
  ctx: PluginContext
  task: Task
  excerptOpen: boolean
  onToggleExcerpt: (open: boolean) => void
  onReload: () => void
  disabled?: boolean
}

export function TaskCardActions({
  ctx,
  task,
  excerptOpen,
  onToggleExcerpt,
  onReload,
  disabled = false,
}: TaskCardActionsProps) {
  const actions = task.actions ?? []
  const [runningId, setRunningId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (actions.length === 0) return null

  const busy = runningId != null
  const allDisabled = disabled || busy

  const run = async (action: TaskAction) => {
    setRunningId(action.id)
    setConfirmId(null)
    try {
      const res = await runTaskAction(ctx, task.id, action.id)
      if (res.ok) {
        notify(res.message)
        onReload()
      } else {
        notifyError(res.message)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      notifyError(msg)
    } finally {
      setRunningId(null)
    }
  }

  const onActionClick = (action: TaskAction) => {
    if (allDisabled) return
    const kind = action.kind ?? 'run'
    if (kind === 'details') {
      onToggleExcerpt(!excerptOpen)
      return
    }
    if (action.confirm?.trim()) {
      setConfirmId(action.id)
      return
    }
    void run(action)
  }

  const confirming = actions.find(a => a.id === confirmId)

  return (
    <div className="wou-card-actions">
      {actions.map(action => {
        const kind = action.kind ?? 'run'
        const style = action.style ?? 'default'
        const isRunning = runningId === action.id
        const className = [
          'wou-action-btn',
          style === 'primary' ? 'wou-action-btn-primary' : '',
          style === 'danger' ? 'wou-action-btn-danger' : '',
        ]
          .filter(Boolean)
          .join(' ')
        const label =
          isRunning ? `${action.label}${strings.actionRunningSuffix}` : action.label
        const pressed = kind === 'details' && excerptOpen
        return (
          <button
            key={action.id}
            type="button"
            className={className}
            disabled={allDisabled}
            aria-pressed={pressed || undefined}
            onClick={() => onActionClick(action)}
          >
            {label}
          </button>
        )
      })}
      {confirming?.confirm ? (
        <div className="wou-action-confirm" role="alertdialog">
          <span className="wou-action-confirm-text">{confirming.confirm}</span>
          <button
            type="button"
            className="wou-action-btn wou-action-btn-primary"
            disabled={allDisabled}
            onClick={() => void run(confirming)}
          >
            {strings.yes}
          </button>
          <button
            type="button"
            className="wou-action-btn"
            disabled={allDisabled}
            onClick={() => setConfirmId(null)}
          >
            {strings.renameCancel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
