import { type PluginContext } from '@hermes/plugin-sdk'
import { useEffect, useRef, useState } from 'react'
import {
  commitTaskRename,
  defaultCustomSnoozeInput,
  epochToLocalInput,
  formatUpdated,
  formatUpdatedTitle,
  localInputToEpoch,
  snoozeTimes,
  taskActivityAt,
  taskDisplayTitle,
  taskTags,
  tagCheckState,
  type Task,
  type TagCheckState,
  type TaskProject,
} from '../model'
import type { Tag } from './api'
import { HighlightText } from './HighlightText'
import { NewTagDialog } from './NewTagDialog'
import { DueChip, ProjectBadge, TagChips } from './TagChips'
import { strings } from './strings'
import { planOpen } from './chatRoute'
import { openChat as openChatTarget } from './openChat'
import { AgentHandleLink, OpenSessionLink } from './OpenSessionLink'
import { TaskCardActions } from './TaskCardActions'
import { AnswerBar } from './AnswerBar'
import { useAnswerControls } from './answerContext'
import { canAnswerInPanel, isYesNoAsk, unsupportedAnswerReason } from './answers'
import { TaskOverflowMenu } from './TaskOverflowMenu'
import { IconSparkle } from './icons'
import { notify, notifyError } from './notify'
import { useAiRename } from './useAiRename'
import { ChatPresenceIndicators } from './ChatPresenceIndicators'

interface TaskRowProps {
  ctx: PluginContext
  task: Task
  allTags: Tag[]
  nameAfterChat?: boolean
  closed?: boolean
  nested?: boolean
  groupTitle?: string
  pendingLabel?: string
  checkboxDisabled?: boolean
  onDone: (task: Task) => void
  onDismiss: (task: Task) => void
  onSnooze: (task: Task, until: number) => void
  onMoveQuadrant: (task: Task, quadrant: number) => void
  onToggleTag: (task: Task, tag: Pick<Tag, 'id' | 'name' | 'color'>, state: TagCheckState) => void
  onCreateTag: (name: string, color: string) => Promise<Tag | null>
  onProjectClick?: (project: TaskProject) => void
  onRename: (task: Task, title: string | null) => void
  onReopen?: (task: Task) => void
  onReload?: () => void
  highlightTokens?: string[]
  followHighlighted?: boolean
  showProjectChips?: boolean
  showPriorities?: boolean
  /** Off when every open task has the same agent: the chip would say nothing. */
  showAgentChip?: boolean
  /** Start with the context line open (the Next up box). */
  defaultDetailsOpen?: boolean
  /** The Next up box always shows the answer bar, with a plain Done. */
  inNextUp?: boolean
  updatedNow?: Date
}

export function TaskRow({
  ctx,
  task,
  allTags,
  nameAfterChat = false,
  closed,
  nested,
  groupTitle,
  pendingLabel,
  checkboxDisabled,
  onDone,
  onDismiss,
  onSnooze,
  onMoveQuadrant,
  onToggleTag,
  onCreateTag,
  onProjectClick,
  onRename,
  onReopen,
  onReload,
  highlightTokens = [],
  followHighlighted = false,
  showProjectChips = false,
  showPriorities = true,
  showAgentChip = true,
  defaultDetailsOpen = false,
  inNextUp = false,
  updatedNow = new Date(),
}: TaskRowProps) {
  const answers = useAnswerControls()
  const [menuOpen, setMenuOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(defaultDetailsOpen)
  const [excerptOpen, setExcerptOpen] = useState(false)
  const excerpt = task.source_excerpt?.trim() ?? ''
  const [customSnoozeOpen, setCustomSnoozeOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [newTagDialogOpen, setNewTagDialogOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [customValue, setCustomValue] = useState(() => defaultCustomSnoozeInput(new Date()))
  const [customError, setCustomError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuAnchorRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const pending = Boolean(pendingLabel)

  const displayTitle = taskDisplayTitle(task, nameAfterChat, Boolean(nested))
  const ai = useAiRename(ctx, { task_id: task.id })
  // Option-click Rename: name it straight away, no editor.
  const [aiQuick, setAiQuick] = useState(false)

  useEffect(() => {
    if (!renameOpen) return
    const el = renameInputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [renameOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuAnchorRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen && !customSnoozeOpen && !renameOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setCustomSnoozeOpen(false)
        if (renameOpen) {
          ai.cancel()
          setRenameOpen(false)
          setRenameValue(displayTitle)
        }
        setCustomError(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen, customSnoozeOpen, renameOpen, displayTitle])

  const openChat = async () => {
    await openChatTarget(ctx, task.chat_key, task.chat_title, task.chat_target, [task])
  }

  const times = snoozeTimes(new Date())
  const minDatetime = epochToLocalInput(Math.floor(Date.now() / 1000))

  const openCustomSnooze = () => {
    setMenuOpen(false)
    setCustomValue(defaultCustomSnoozeInput(new Date()))
    setCustomError(null)
    setCustomSnoozeOpen(true)
  }

  const openRename = () => {
    setMenuOpen(false)
    ai.cancel()
    setAiQuick(false)
    setRenameValue(displayTitle)
    setRenameOpen(true)
  }

  const cancelRename = () => {
    ai.cancel()
    setRenameOpen(false)
    setRenameValue(displayTitle)
  }

  /** In the editor: fill the field with an AI name, selected, so Enter saves it. */
  const fillWithAi = async () => {
    if (ai.busy) return
    const title = await ai.generate()
    if (!title) return
    setRenameValue(title)
    requestAnimationFrame(() => {
      const el = renameInputRef.current
      if (!el) return
      el.focus()
      el.select()
    })
  }

  /** Option-click Rename: generate and save in one go (undo toast still offered). */
  const renameWithAiNow = async () => {
    setMenuOpen(false)
    if (ai.busy) return
    setAiQuick(true)
    try {
      const title = await ai.generate()
      if (!title) return
      // Save even when it matches what the card shows, so the name is kept from now on.
      const kept = task.title_override?.trim() || (!nested ? task.chat_name?.trim() : '') || ''
      if (kept === title) {
        notify(strings.renameWithAiSame)
        return
      }
      onRename(task, title)
    } finally {
      setAiQuick(false)
    }
  }

  useEffect(() => {
    if (!aiQuick && ai.error && !renameOpen) {
      notifyError(strings.renameWithAiFailed, ai.error)
      ai.setError(null)
    }
  }, [aiQuick, ai.error, renameOpen])

  const submitRename = () => {
    const result = commitTaskRename(renameValue, displayTitle, task.title_override)
    if (result.action === 'close') {
      setRenameOpen(false)
      return
    }
    setRenameOpen(false)
    onRename(task, result.value ?? null)
  }

  const submitCustomSnooze = () => {
    const epoch = localInputToEpoch(customValue)
    const nowSec = Math.floor(Date.now() / 1000)
    if (epoch == null || epoch <= nowSec) {
      setCustomError(strings.snoozePast)
      return
    }
    setCustomSnoozeOpen(false)
    setCustomError(null)
    onSnooze(task, epoch)
  }

  const showPriority = !nested && showPriorities
  const showChips = showProjectChips && !nested
  const activityAt = taskActivityAt(task)
  const updatedLabel = !nested ? formatUpdated(activityAt, updatedNow) : ''
  const updatedTitle = !nested ? formatUpdatedTitle(activityAt) : ''
  const topicTrimmed = displayTitle.trim()
  const hideNestedTopic =
    nested &&
    !renameOpen &&
    (!topicTrimmed ||
      (groupTitle != null &&
        topicTrimmed.toLowerCase() === groupTitle.trim().toLowerCase()))
  const askForLabel = task.ask.trim()
  const askLabelStart =
    askForLabel.length > 60 ? `${askForLabel.slice(0, 60).trimEnd()}…` : askForLabel

  const projectChip =
    showChips && task.project ? <ProjectBadge project={task.project} onClick={onProjectClick} /> : null
  const tags = taskTags(task)
  const contextLine = task.context?.trim() ?? ''
  // The meta row only appears when it has something to say. Open session sits on the title line.
  const metaHasChips =
    showAgentChip || Boolean(projectChip) || tags.length > 0 || Boolean(closed) || task.due_at != null

  const notAChat = planOpen(task.chat_key, task.chat_target).kind === 'not-a-chat'
  const isActive = Boolean(answers) && !closed && answers?.activeId === task.id
  const answerBar =
    answers && !closed ? (
      <AnswerBar
        task={task}
        controls={answers}
        visible={!pending && !renameOpen && (inNextUp || isActive || answers.showAll)}
        canAnswer={canAnswerInPanel(task, answers.canSubmit)}
        yesNo={isYesNoAsk(task.ask)}
        openLabel={notAChat ? strings.handleWithAgent(task.agent) : strings.openSession}
        unsupportedNote={unsupportedAnswerReason(task) ? strings.answerUnsupported : null}
        onDone={inNextUp ? () => onDone(task) : undefined}
        disabled={pending || Boolean(checkboxDisabled)}
      />
    ) : null
  const chatMeta = notAChat ? (
    <AgentHandleLink agent={task.agent} onClick={() => void openChat()} />
  ) : (
    <OpenSessionLink onClick={() => void openChat()} />
  )

  const cardActions =
    !closed && (task.actions?.length ?? 0) > 0 && onReload ? (
      <TaskCardActions
        ctx={ctx}
        task={task}
        excerptOpen={excerptOpen}
        onToggleExcerpt={setExcerptOpen}
        onReload={onReload}
        disabled={pending || renameOpen}
      />
    ) : null

  const titleBlock = renameOpen ? (
    <div className="wou-inline-rename">
      <input
        ref={renameInputRef}
        type="text"
        className="wou-inline-rename-input wou-topic"
        value={renameValue}
        maxLength={120}
        placeholder={displayTitle}
        disabled={ai.busy}
        onChange={e => setRenameValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (!ai.busy) submitRename()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            cancelRename()
          }
        }}
      />
      <div className="wou-inline-rename-actions">
        <button
          type="button"
          className="wou-inline-rename-save"
          disabled={ai.busy}
          onClick={() => submitRename()}
        >
          {strings.renameSave}
        </button>
        <button
          type="button"
          className="wou-inline-rename-ai"
          disabled={ai.busy}
          aria-busy={ai.busy}
          title={strings.renameWithAiTip}
          onClick={() => void fillWithAi()}
        >
          <IconSparkle />
          <span>{ai.busy ? strings.renameWithAiBusy : strings.renameWithAi}</span>
        </button>
        <button type="button" onClick={() => cancelRename()}>
          {strings.renameCancel}
        </button>
        <span className="wou-inline-rename-hint">{strings.renameKeyboardHint}</span>
      </div>
      {ai.error ? (
        <p className="wou-inline-rename-error" role="alert">{ai.error}</p>
      ) : null}
    </div>
  ) : hideNestedTopic ? null : (
    <span className="wou-topic">
      <HighlightText text={displayTitle} tokens={highlightTokens} />
    </span>
  )

  const overflowMenu =
    !closed && !pending ? (
      <div className="wou-menu-anchor" style={{ position: 'relative' }} ref={menuAnchorRef}>
        <button
          type="button"
          className={nested ? 'wou-icon wou-icon-nested' : 'wou-icon'}
          aria-label={
            nested ? strings.menuMoreForAsk(askLabelStart) : strings.menuMore
          }
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          disabled={renameOpen || aiQuick}
          onClick={() => setMenuOpen(v => !v)}
        >
          …
        </button>
        <TaskOverflowMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          menuRef={menuRef}
          anchorRef={menuAnchorRef}
          quadrant={task.quadrant}
          tags={allTags}
          tagState={tagId => tagCheckState([task], tagId)}
          showWhyHere={Boolean(excerpt)}
          hidePriority={!showPriority}
          onRename={openRename}
          onRenameWithAi={() => void renameWithAiNow()}
          onSnoozeTomorrow={() => onSnooze(task, times.tomorrow)}
          onSnoozeMonday={() => onSnooze(task, times.nextMonday)}
          onSnoozeWeek={() => onSnooze(task, times.inWeek)}
          onCustomSnooze={openCustomSnooze}
          onToggleTag={(tag, state) => onToggleTag(task, tag, state)}
          onNewTag={() => setNewTagDialogOpen(true)}
          onQuadrant={q => onMoveQuadrant(task, q)}
          onWhyHere={() => setExcerptOpen(v => !v)}
          onDismiss={() => onDismiss(task)}
          dismissLabel={strings.notATask}
        />
      </div>
    ) : null

  return (
    <div
      className={`wou-row${nested ? ' wou-row-nested' : ''}${closed ? ' wou-closed-row' : ''}${pending ? ' wou-row-pending' : ''}${menuOpen ? ' wou-row-menu-open' : ''}${renameOpen ? ' wou-row-rename-open' : ''}${followHighlighted && !nested ? ' wou-row-follow-selected' : ''}${isActive ? ' wou-row-active' : ''}`}
      data-rename-open={renameOpen ? 'true' : undefined}
      data-wou-follow-key={!nested ? task.chat_key : undefined}
      data-wou-task-id={answers && !closed ? task.id : undefined}
      aria-current={isActive ? 'true' : undefined}
      tabIndex={answers && !closed ? -1 : undefined}
      onClick={answers && !closed ? () => answers.activate(task) : undefined}
    >
      {!closed ? (
        <input
          type="checkbox"
          aria-label={strings.markDone(displayTitle)}
          disabled={checkboxDisabled || pending || renameOpen}
          onChange={() => {
            if (checkboxDisabled || pending || renameOpen) return
            onDone(task)
          }}
        />
      ) : null}
      <div className="wou-row-body">
        {nested ? (
          titleBlock
        ) : (
          <div className="wou-card-title-line">
            <div className="wou-card-title-main">{titleBlock}</div>
            {updatedLabel ? (
              <span className="wou-updated-at wou-muted" title={updatedTitle}>
                {updatedLabel}
              </span>
            ) : null}
            {!nested && !closed && !notAChat ? <ChatPresenceIndicators task={task} /> : null}
            {/* With answer controls, Open session lives in the answer bar. */}
            {!closed && !renameOpen && !answers ? <span className="wou-session-slot">{chatMeta}</span> : null}
            {overflowMenu}
          </div>
        )}
        {contextLine ? (
          <button
            type="button"
            className={`wou-ask wou-ask-toggle${hideNestedTopic && !renameOpen ? ' wou-ask-only' : ''}`}
            aria-expanded={detailsOpen}
            title={detailsOpen ? strings.askHideDetails : strings.askShowDetails}
            onClick={() => setDetailsOpen(v => !v)}
          >
            <HighlightText text={task.ask} tokens={highlightTokens} />
          </button>
        ) : (
          <div className={`wou-ask${hideNestedTopic && !renameOpen ? ' wou-ask-only' : ''}`}>
            <HighlightText text={task.ask} tokens={highlightTokens} />
          </div>
        )}
        {task.status === 'expired' ? (
          <p className="wou-muted">{strings.statusExpired}</p>
        ) : null}
        {contextLine && detailsOpen ? (
          <div className="wou-task-context wou-task-context-open">{contextLine}</div>
        ) : null}
        {pendingLabel ? (
          <div className="wou-pending-label" role="status">{pendingLabel}</div>
        ) : aiQuick ? (
          <div className="wou-pending-label" role="status">{strings.renameWithAiPending}</div>
        ) : null}
        {answerBar}
        {cardActions}
        {excerptOpen && excerpt ? (
          <blockquote className="wou-source-excerpt">{excerpt}</blockquote>
        ) : null}
        {customSnoozeOpen ? (
          <form
            className="wou-snooze-form"
            onSubmit={e => {
              e.preventDefault()
              submitCustomSnooze()
            }}
          >
            <label className="wou-muted">
              <span className="wou-snooze-form-label">{strings.snoozeCustomShort}</span>
              <input
                type="datetime-local"
                value={customValue}
                min={minDatetime}
                onChange={e => {
                  setCustomValue(e.target.value)
                  setCustomError(null)
                }}
              />
            </label>
            {customError ? <p className="wou-snooze-error" role="alert">{customError}</p> : null}
            <div className="wou-snooze-actions">
              <button type="submit">{strings.snoozeSubmit}</button>
              <button
                type="button"
                onClick={() => {
                  setCustomSnoozeOpen(false)
                  setCustomError(null)
                }}
              >
                {strings.snoozeCancel}
              </button>
            </div>
          </form>
        ) : null}
        {!nested && metaHasChips ? (
          <div className="wou-meta">
            {showAgentChip ? <span className="wou-agent-chip">{task.agent}</span> : null}
            {closed ? null : <DueChip dueAt={task.due_at} now={updatedNow} />}
            {projectChip}
            <TagChips tags={tags} />
            {closed ? chatMeta : null}
            {closed && onReopen ? (
              <button type="button" onClick={() => onReopen(task)}>{strings.reopen}</button>
            ) : null}
          </div>
        ) : tags.length > 0 || task.due_at ? (
          <div className="wou-nested-meta">
            <DueChip dueAt={task.due_at} now={updatedNow} />
            <TagChips tags={tags} />
            {closed && onReopen ? (
              <button type="button" onClick={() => onReopen(task)}>{strings.reopen}</button>
            ) : null}
          </div>
        ) : closed && onReopen ? (
          <div className="wou-meta">
            {closed && onReopen ? (
              <button type="button" onClick={() => onReopen(task)}>{strings.reopen}</button>
            ) : null}
          </div>
        ) : null}
      </div>
      {nested ? overflowMenu : null}
      <NewTagDialog
        open={newTagDialogOpen}
        onOpenChange={setNewTagDialogOpen}
        createTag={onCreateTag}
        applies
        onCreated={created => onToggleTag(task, created, 'none')}
      />
    </div>
  )
}
