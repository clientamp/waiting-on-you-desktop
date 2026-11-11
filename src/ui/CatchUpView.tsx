import { host } from '@hermes/plugin-sdk'
import type { ReactNode } from 'react'
import type { Task } from '../model'
import type { Project } from './api'
import { catchUpChats, catchUpGroups, catchUpProjectKnown, catchUpViewEligible } from './catchUp'
import { strings } from './strings'

interface CatchUpViewProps {
  projects: Project[]
  projectKey: string | null
  onProjectChange: (key: string | null) => void
  tasks: Task[]
  ready: boolean
  offline: boolean
  consented: boolean
  projectsFetchSucceeded: boolean
  tasksFetchSucceeded: boolean
  projectsError: string | null
  onRetryProjects: () => void
  renderTask: (task: Task) => ReactNode
  onBack: () => void
}

/** Only WoU's own consent-scoped tasks are readable through the public plugin door. */
export function CatchUpView({
  projects,
  projectKey,
  onProjectChange,
  tasks,
  ready,
  offline,
  consented,
  projectsFetchSucceeded,
  tasksFetchSucceeded,
  projectsError,
  onRetryProjects,
  renderTask,
  onBack,
}: CatchUpViewProps) {
  const known = catchUpProjectKnown(projects, projectKey)
  const showChats = catchUpViewEligible({
    consented,
    projectsFetchSucceeded,
    tasksFetchSucceeded,
    offline,
    projects,
    projectKey,
  })
  const chats = showChats ? catchUpChats(tasks, projectKey) : { open: [], snoozed: 0 }
  const groups = catchUpGroups(chats.open)
  return (
    <div className="wou-settings-view">
      <div className="wou-settings-view-header">
        <button type="button" className="wou-link wou-settings-back" onClick={onBack}>Back</button>
        <h2 className="wou-settings-view-title">Catch up</h2>
      </div>
      <label className="wou-field">
        <span>Hermes project</span>
        <select className="wou-select" value={projectKey ?? ''} onChange={e => onProjectChange(e.target.value || null)}>
          <option value="">No project</option>
          {!known ? <option value={projectKey!}>Project unavailable</option> : null}
          {projects.map(p => <option key={p.key} value={p.key}>{p.name} · {p.profile}</option>)}
        </select>
      </label>
      <p className="wou-muted">All agents and tags in this project. Your list filters are unchanged.</p>
      <section className="wou-section" aria-labelledby="wou-cu-chats">
        <h3 className="wou-section-heading" id="wou-cu-chats">Waiting chats{ready && known && !offline ? ` (${groups.length})` : ''}</h3>
        {offline ? <p className="wou-muted" role="status">Waiting chats could not be refreshed. Return to the list and retry.</p>
          : !ready && projectsError ? (
            <p role="alert">
              {projectsError}{' '}
              <button type="button" className="wou-link" onClick={onRetryProjects}>{strings.retry}</button>
            </p>
          )
          : !ready ? <p className="wou-muted" role="status">Loading waiting chats…</p>
          : !known ? <p className="wou-muted" role="status">This project is no longer in the native catalog. Choose another project.</p>
          : <>
            {groups.length === 0 ? <p className="wou-muted" role="status">No waiting chats in this project. Board cards have not been checked.</p> : null}
            {groups.map(group => <div key={group.chatKey}>
              {group.tasks.length > 1 ? <h4>{group.tasks[0].chat_name || group.tasks[0].chat_title}</h4> : null}
              {group.tasks.map(task => renderTask(task))}
            </div>)}
            {chats.snoozed > 0 ? <p className="wou-muted">{chats.snoozed} snoozed {chats.snoozed === 1 ? 'ask is' : 'asks are'} hidden.</p> : null}
          </>}
      </section>
      <section className="wou-section" aria-labelledby="wou-cu-human">
        <h3 className="wou-section-heading" id="wou-cu-human">Human-blocked cards</h3>
        <p className="wou-muted">Board cards are not available through the Hermes public plugin API. Answers, comments, and unblocking must be handled in Kanban.</p>
      </section>
      <section className="wou-section" aria-labelledby="wou-cu-review">
        <h3 className="wou-section-heading" id="wou-cu-review">Review cards</h3>
        <p className="wou-muted">Review cards have not been checked. Open Kanban to review them.</p>
      </section>
      <button type="button" className="wou-link" onClick={() => host.navigate('/kanban')}>Open Kanban</button>
      <p className="wou-muted">Opens Kanban only, not a specific board or card.</p>
    </div>
  )
}
