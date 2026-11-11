import {
  host,
  useValue,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type PluginContext,
} from '@hermes/plugin-sdk'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  composerPatchTarget,
  groupCloseTaskIds,
  groupDisplayTitle,
  quadrantTitle,
  sessionCurrentQuadrant,
  taskDisplayTitle,
  type Task,
} from '../model'
import { fetchSettings, parseGroupByFromSettings, patchGroup, patchTask } from './api'
import { IconChecklist } from './icons'
import { afterSessionMutation, addSessionTask, fetchSessionTasks, isAlreadyGone, restErrorFields, type SessionTasksResponse } from './sessionApi'
import { getBackendAvailable, isConsentMiss, noteConsentMiss, subscribeBackendAvailable } from './backendGate'
import { strings } from './strings'
import { composerTriggerStyles, globalStyles, ROOT_CLASS } from './styles'
import { notify, notifyError } from './notify'
import { TASKS_CHANGED_EVENT } from './shortcuts'

const TASKS_CHANGED = TASKS_CHANGED_EVENT
const QUADRANTS = [1, 2, 3, 4] as const
const QUADRANT_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: strings.quadrantBar1,
  2: strings.quadrantBar2,
  3: strings.quadrantBar3,
  4: strings.quadrantBar4,
}

type FormMode = 'tracked' | 'add'

function taskListLine(task: Task, nameAfterChat: boolean): string {
  const ask = task.ask?.trim()
  if (ask) return ask
  const title = taskDisplayTitle(task, nameAfterChat)
  return title || strings.composerUntitled
}

function QuadrantGrid({
  value,
  disabled,
  onChange,
}: {
  value: number
  disabled?: boolean
  onChange: (q: number) => void
}) {
  return (
    <div className="wou-quadrant-grid" role="radiogroup" aria-label={strings.composerQuadrantLabel}>
      {QUADRANTS.map(q => (
        <label key={q} className="wou-quadrant-option">
          <input
            type="radio"
            name="wou-quadrant"
            value={q}
            checked={value === q}
            disabled={disabled}
            onChange={() => onChange(q)}
          />
          <span>{QUADRANT_LABELS[q]}</span>
        </label>
      ))}
    </div>
  )
}

export function ComposerButton({ ctx }: { ctx: PluginContext }) {
  const sessionAtom = host.state.focusedStoredSessionId
  const profileAtom = host.state.focusedSessionProfile
  const ownerAtom = host.state.focusedSessionOwner
  const connectionAtom = host.state.connectionId

  const sessionId = sessionAtom ? useValue(sessionAtom) : null
  const profile = profileAtom ? useValue(profileAtom) : 'default'
  const owner = ownerAtom ? useValue(ownerAtom) : null
  const activeConnectionId = connectionAtom ? useValue(connectionAtom) : null
  const backendAvailable = useSyncExternalStore(
    subscribeBackendAvailable,
    getBackendAvailable,
    getBackendAvailable,
  )

  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<SessionTasksResponse | null>(null)
  const [notFoundError, setNotFoundError] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<FormMode>('add')
  const [ask, setAsk] = useState('')
  const [quadrant, setQuadrant] = useState(2)
  const [saving, setSaving] = useState(false)
  const [fieldSaving, setFieldSaving] = useState(false)
  const [nameAfterChat, setNameAfterChat] = useState(false)
  const [showPriorities, setShowPriorities] = useState(true)
  const [nameValue, setNameValue] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  const refreshSession = useCallback(async (opts?: { notifyError?: boolean }) => {
    if (!sessionId) return
    try {
      const result = await fetchSessionTasks(ctx, sessionId, profile, owner, activeConnectionId)
      if (result.kind === 'not_found') {
        setNotFoundError(result.error)
        setSession(null)
        return
      }
      setNotFoundError(null)
      setSession(result.data)
    } catch {
      setNotFoundError(null)
      setSession(null)
      if (opts?.notifyError) notifyError(strings.loadError)
    }
  }, [ctx, sessionId, profile, owner, activeConnectionId])

  useEffect(() => {
    if (!sessionId) return
    void refreshSession()
  }, [sessionId, profile, owner, refreshSession])

  useEffect(() => {
    if (!sessionId) return
    const onChange = () => void refreshSession()
    const disposers: Array<() => void> = []
    if (ctx.onEvent) disposers.push(ctx.onEvent(TASKS_CHANGED, onChange))
    else if (host.onEvent) disposers.push(host.onEvent(TASKS_CHANGED, onChange))
    return () => {
      for (const d of disposers) d()
    }
  }, [ctx, sessionId, refreshSession])

  useEffect(() => {
    if (!open || !sessionId) return
    void refreshSession({ notifyError: true })
    void (async () => {
      try {
        const settingsBundle = await fetchSettings(ctx)
        setNameAfterChat(settingsBundle.settings.name_after_chat)
        setShowPriorities(parseGroupByFromSettings(settingsBundle.settings) !== 'none')
      } catch {
        notifyError(strings.loadError)
      }
    })()
  }, [open, sessionId, ctx, refreshSession])

  useEffect(() => {
    if (!open) return
    if (session?.tracked) {
      setFormMode('tracked')
      setQuadrant(sessionCurrentQuadrant(session.tasks, session.group))
    } else {
      setFormMode('add')
      setQuadrant(2)
      setAsk('')
    }
  }, [open, session?.tracked, session?.chat_key])

  const sessionDisplayName = useCallback(() => {
    if (!session || session.tasks.length === 0) return ''
    const target = composerPatchTarget(session.tasks, session.chat_key)
    if (target.kind === 'task') {
      return taskDisplayTitle(
        session.tasks.find(t => t.id === target.taskId) ?? session.tasks[0],
        nameAfterChat,
      )
    }
    if (session.group) return groupDisplayTitle(session.group, nameAfterChat)
    return taskDisplayTitle(session.tasks[0], nameAfterChat)
  }, [session, nameAfterChat])

  useEffect(() => {
    if (!open || formMode !== 'tracked' || !session) return
    setNameValue(sessionDisplayName())
  }, [open, formMode, session, sessionDisplayName, nameAfterChat])

  const saveDisplayName = async () => {
    if (!session || formMode !== 'tracked') return
    const trimmed = nameValue.trim()
    const current = sessionDisplayName().trim()
    if (trimmed === current) return
    const target = composerPatchTarget(session.tasks, session.chat_key)
    setNameSaving(true)
    try {
      if (target.kind === 'task') {
        await patchTask(ctx, target.taskId, { title: trimmed || null })
      } else {
        await patchGroup(ctx, target.chatKey, { title: trimmed || null })
      }
      afterSessionMutation()
      await refreshSession()
    } catch {
      notifyError(strings.patchError)
      setNameValue(sessionDisplayName())
    } finally {
      setNameSaving(false)
    }
  }

  if (!sessionAtom || !sessionId || !backendAvailable) return null

  const tracked = session?.tracked ?? false
  const openCount = session?.tasks.length ?? 0
  const showBadge = tracked && openCount > 0
  const title = showBadge
    ? strings.composerButtonTracked(openCount)
    : strings.composerButton

  const applySessionFields = async (
    fields: { quadrant?: number; status?: string },
  ) => {
    if (!session) return
    const target = composerPatchTarget(session.tasks, session.chat_key)
    setFieldSaving(true)
    try {
      if (target.kind === 'task') {
        await patchTask(ctx, target.taskId, fields)
      } else {
        await patchGroup(ctx, target.chatKey, fields)
      }
      afterSessionMutation()
      await refreshSession()
    } catch (e) {
      if (isConsentMiss(e)) {
        if (noteConsentMiss()) notify(strings.notOnThisProfile)
        setOpen(false)
      } else {
        notifyError(strings.patchError)
      }
    } finally {
      setFieldSaving(false)
    }
  }

  const onQuadrantChange = async (q: number) => {
    setQuadrant(q)
    if (formMode === 'tracked' && session) {
      await applySessionFields({ quadrant: q })
    }
  }

  const submitAdd = async () => {
    if (!sessionId) return
    setSaving(true)
    try {
      await addSessionTask(ctx, sessionId, profile, owner, activeConnectionId, {
        ask: ask.trim() || undefined,
        quadrant,
      })
      notify(strings.composerAdded)
      setOpen(false)
      setAsk('')
      await refreshSession()
    } catch (e: unknown) {
      const err = restErrorFields(e)
      if (isConsentMiss(e)) {
        if (noteConsentMiss()) notify(strings.notOnThisProfile)
        setOpen(false)
      } else if (err.status === 404) {
        setNotFoundError(err.error)
        setFormMode('add')
      } else {
        notifyError(strings.patchError)
      }
    } finally {
      setSaving(false)
    }
  }

  const markComplete = async () => {
    if (!session) return
    setSaving(true)
    const target = composerPatchTarget(session.tasks, session.chat_key)
    try {
      let alreadyClosed = false
      if (target.kind === 'task') {
        await patchTask(ctx, target.taskId, { status: 'done' })
      } else {
        const res = await patchGroup(ctx, target.chatKey, {
          status: 'done',
          task_ids: groupCloseTaskIds(session.tasks),
        })
        alreadyClosed = Boolean(res.already_closed)
      }
      afterSessionMutation()
      notify(alreadyClosed ? strings.alreadyCleared : strings.composerCompleted)
      setOpen(false)
      await refreshSession()
    } catch (e) {
      if (isConsentMiss(e)) {
        if (noteConsentMiss()) notify(strings.notOnThisProfile)
        setOpen(false)
      } else if (isAlreadyGone(e)) {
        notify(strings.alreadyCleared)
        setOpen(false)
        afterSessionMutation()
        await refreshSession()
      } else {
        notifyError(strings.patchError)
      }
    } finally {
      setSaving(false)
    }
  }

  const showAddForm = notFoundError != null ? false : !tracked || formMode === 'add'
  const dialogTitle = notFoundError
    ? strings.composerButton
    : showAddForm
      ? strings.composerAddTitle
      : strings.composerTrackedTitle

  return (
    <>
      <style>{composerTriggerStyles}</style>
      <button
        type="button"
        className={`${ROOT_CLASS} wou-icon-btn wou-composer-trigger`}
        aria-label={title}
        title={title}
        onClick={() => setOpen(true)}
      >
        <IconChecklist />
        {showBadge ? <span className="wou-composer-badge" aria-hidden="true" /> : null}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={`${ROOT_CLASS} wou-dialog`}>
          <style>{globalStyles}</style>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            {notFoundError ? (
              <DialogDescription className="wou-composer-error">{notFoundError}</DialogDescription>
            ) : showAddForm ? (
              <DialogDescription>{strings.composerAddDescription}</DialogDescription>
            ) : null}
          </DialogHeader>

          <div className="wou-composer-body">
            {notFoundError ? null : showAddForm ? (
              <>
                <label className="wou-field">
                  <span className="wou-field-label">{strings.composerAskLabel}</span>
                  <textarea
                    rows={3}
                    value={ask}
                    maxLength={300}
                    placeholder={strings.composerAskPlaceholder}
                    onChange={e => setAsk(e.target.value)}
                    disabled={saving}
                  />
                </label>
                {showPriorities ? (
                  <div className="wou-field">
                    <span className="wou-field-label">{strings.composerQuadrantLabel}</span>
                    <QuadrantGrid value={quadrant} disabled={saving} onChange={setQuadrant} />
                  </div>
                ) : null}
              </>
            ) : session ? (
              <>
                <label className="wou-field">
                  <span className="wou-field-label">{strings.renameLabel}</span>
                  <input
                    type="text"
                    value={nameValue}
                    maxLength={120}
                    disabled={nameSaving || fieldSaving || saving}
                    onChange={e => setNameValue(e.target.value)}
                    onBlur={() => void saveDisplayName()}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void saveDisplayName()
                      }
                    }}
                  />
                  {nameSaving ? (
                    <span className="wou-muted" role="status">{strings.scanning}</span>
                  ) : null}
                </label>
                <ul className="wou-composer-task-list">
                  {session.tasks.map(task => (
                    <li key={task.id} className="wou-composer-task-item">
                      <p className="wou-composer-task-primary">{taskListLine(task, nameAfterChat)}</p>
                      <p className="wou-composer-task-meta">
                        {task.project ? <span>{task.project.name}</span> : null}
                        <span>{quadrantTitle(task.quadrant)}</span>
                        {task.status === 'snoozed' ? (
                          <span className="wou-composer-tag">{strings.composerSnoozed}</span>
                        ) : null}
                      </p>
                    </li>
                  ))}
                </ul>
                {showPriorities ? (
                  <div className="wou-field">
                    <span className="wou-field-label">{strings.composerQuadrantLabel}</span>
                    <QuadrantGrid
                      value={quadrant}
                      disabled={fieldSaving || saving}
                      onChange={q => void onQuadrantChange(q)}
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  className="wou-link"
                  onClick={() => {
                    setFormMode('add')
                    setQuadrant(sessionCurrentQuadrant(session.tasks, session.group))
                    setAsk('')
                  }}
                >
                  {strings.composerAddAnother}
                </button>
              </>
            ) : null}
          </div>

          {notFoundError ? (
            <DialogFooter className="wou-composer-error-footer">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {strings.composerClose}
              </Button>
            </DialogFooter>
          ) : showAddForm ? (
            <DialogFooter className="wou-composer-footer">
              <Button type="button" variant="secondary" disabled={saving} onClick={() => setOpen(false)}>
                {strings.composerCancel}
              </Button>
              <Button type="button" disabled={saving} onClick={() => void submitAdd()}>
                {strings.composerAdd}
              </Button>
            </DialogFooter>
          ) : (
            <DialogFooter className="wou-composer-footer">
              <Button type="button" variant="secondary" disabled={saving || fieldSaving} onClick={() => setOpen(false)}>
                {strings.composerCancel}
              </Button>
              <Button type="button" disabled={saving || fieldSaving} onClick={() => void markComplete()}>
                {strings.composerMarkComplete}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
