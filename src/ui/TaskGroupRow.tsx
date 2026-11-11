import { type PluginContext } from '@hermes/plugin-sdk'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  commitGroupRename,
  defaultCustomSnoozeInput,
  epochToLocalInput,
  localInputToEpoch,
  snoozeTimes,
  earliestDueAt,
  groupDisplayTitle,
  groupProjects,
  groupUpdatedAt,
  formatUpdated,
  formatUpdatedTitle,
  tagCheckState,
  unionTags,
  type Task,
  type TaskGroup,
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
import { TaskGroupContextMenu } from './TaskGroupContextMenu'
import { TaskOverflowMenu } from './TaskOverflowMenu'
import { TaskRow } from './TaskRow'
import { IconSparkle } from './icons'
import { notify, notifyError } from './notify'
import { useAiRename } from './useAiRename'
import { ChatPresenceIndicators } from './ChatPresenceIndicators'


import {
  canOpenGroupContextMenu,
  isGroupContextMenuTarget,
  shouldHandleShiftF10,
} from './groupContextClose'

const STORAGE_OPTION_TIP_DISMISSED = 'optionClickTipDismissed'

interface TaskGroupRowProps {
  ctx: PluginContext
  group: TaskGroup
  tasks: Task[]
  allTags: Tag[]
  nameAfterChat?: boolean
  expanded: boolean
  onToggleExpanded: (allGroups: boolean) => void
  pendingLabels: Record<number, string>
  checkboxDisabled?: boolean
  groupPending?: string
  confirmClose?: boolean
  /** Every task a group-wide action affects; can exceed `tasks` when the Next up box shows one of them. */
  actionTasks?: Task[]
  onConfirmClose: () => void
  onCancelClose: () => void
  onDoneAll: () => void
  onDismissAll: () => void
  onSnoozeAll: (until: number) => void
  onMoveQuadrant: (quadrant: number) => void
  onToggleTag: (tag: Pick<Tag, 'id' | 'name' | 'color'>, state: TagCheckState) => void
  onCreateTag: (name: string, color: string) => Promise<Tag | null>
  onProjectClick?: (project: TaskProject) => void
  onRenameGroup: (group: TaskGroup, title: string | null) => void
  onChildDone: (task: Task) => void
  onChildDismiss: (task: Task) => void
  onChildSnooze: (task: Task, until: number) => void
  onChildToggleTag: (task: Task, tag: Pick<Tag, 'id' | 'name' | 'color'>, state: TagCheckState) => void
  onChildRename: (task: Task, title: string | null) => void
  highlightTokens?: string[]
  followHighlighted?: boolean
  forceExpanded?: boolean
  showProjectChips?: boolean
  showPriorities?: boolean
  /** Off when every open task has the same agent. */
  showAgentChip?: boolean
  updatedNow?: Date
  onReload?: () => void
}

export function TaskGroupRow({
  ctx,
  group,
  tasks,
  allTags,
  nameAfterChat = false,
  expanded,
  onToggleExpanded,
  pendingLabels,
  checkboxDisabled,
  groupPending,
  confirmClose,
  actionTasks,
  onConfirmClose,
  onCancelClose,
  onDoneAll,
  onDismissAll,
  onSnoozeAll,
  onMoveQuadrant,
  onToggleTag,
  onCreateTag,
  onProjectClick,
  onRenameGroup,
  onChildDone,
  onChildDismiss,
  onChildSnooze,
  onChildToggleTag,
  onChildRename,
  highlightTokens = [],
  followHighlighted = false,
  forceExpanded = false,
  showProjectChips = false,
  showPriorities = true,
  showAgentChip = true,
  updatedNow = new Date(),
  onReload,
}: TaskGroupRowProps) {
  const showExpanded = forceExpanded || expanded
  const [menuOpen, setMenuOpen] = useState(false)
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [contextAnchorPoint, setContextAnchorPoint] = useState<{ x: number; y: number } | null>(null)
  const [customSnoozeOpen, setCustomSnoozeOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const ai = useAiRename(ctx, { chat_key: group.chat_key })
  const [aiQuick, setAiQuick] = useState(false)
  const [tipVisible, setTipVisible] = useState(
    () => !ctx.storage.get<boolean>(STORAGE_OPTION_TIP_DISMISSED, false),
  )
  const [newTagDialogOpen, setNewTagDialogOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [customValue, setCustomValue] = useState(() => defaultCustomSnoozeInput(new Date()))
  const [customError, setCustomError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuAnchorRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const contextAnchorRef = useRef<HTMLSpanElement>(null)
  const groupParentRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const pending = Boolean(groupPending)
  const canGroupContextMenu = canOpenGroupContextMenu({
    pending,
    confirmClose: Boolean(confirmClose),
    renameOpen,
    aiQuick,
    customSnoozeOpen,
    checkboxDisabled,
  })

  const restoreGroupParentFocusRef = useRef(false)

  const closeGroupContextMenu = (restoreFocus: boolean) => {
    setContextMenuOpen(false)
    if (restoreFocus) restoreGroupParentFocusRef.current = true
  }

  useLayoutEffect(() => {
    if (contextMenuOpen) return
    if (!restoreGroupParentFocusRef.current) return
    restoreGroupParentFocusRef.current = false
    groupParentRef.current?.focus({ preventScroll: true })
  }, [contextMenuOpen])

  const displayTitle = groupDisplayTitle(group, nameAfterChat)
  // Group-level summaries describe every task the group's actions touch; children below list `tasks`.
  const groupTasks = actionTasks ?? tasks
  const projectsShown = showProjectChips ? groupProjects(groupTasks) : []
  const tags = unionTags(groupTasks)
  const dueAt = earliestDueAt(groupTasks)

  useEffect(() => {
    if (!renameOpen) return
    const el = renameInputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [renameOpen])

  const openGroupContextMenu = (clientX: number, clientY: number) => {
    if (!canGroupContextMenu) return
    setMenuOpen(false)
    setContextAnchorPoint({ x: clientX, y: clientY })
    setContextMenuOpen(true)
  }

  useEffect(() => {
    if (canGroupContextMenu) return
    setMenuOpen(false)
    setContextMenuOpen(false)
  }, [canGroupContextMenu])

  useEffect(() => {
    if (!menuOpen && !contextMenuOpen) return
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (menuAnchorRef.current?.contains(target) || menuRef.current?.contains(target)) return
      if (contextAnchorRef.current?.contains(target) || contextMenuRef.current?.contains(target)) return
      setMenuOpen(false)
      if (contextMenuOpen) closeGroupContextMenu(true)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [menuOpen, contextMenuOpen])

  useEffect(() => {
    if (!menuOpen && !contextMenuOpen && !customSnoozeOpen && !renameOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        if (contextMenuOpen) closeGroupContextMenu(true)
        else setContextMenuOpen(false)
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
  }, [menuOpen, contextMenuOpen, customSnoozeOpen, renameOpen, displayTitle])

  const openChat = async () => {
    await openChatTarget(ctx, group.chat_key, group.chat_title, group.chat_target, groupTasks)
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
      const kept = (group.title_locked ? group.title?.trim() : '') || ''
      if (kept === title) {
        notify(strings.renameWithAiSame)
        return
      }
      onRenameGroup(group, title)
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
    const result = commitGroupRename(renameValue, displayTitle, group)
    if (result.action === 'close') {
      setRenameOpen(false)
      return
    }
    setRenameOpen(false)
    onRenameGroup(group, result.value ?? null)
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
    onSnoozeAll(epoch)
  }

  const notAChat = planOpen(group.chat_key, group.chat_target).kind === 'not-a-chat'
  const chatMeta = notAChat ? (
    <AgentHandleLink agent={group.agent} onClick={() => void openChat()} />
  ) : (
    <OpenSessionLink onClick={() => void openChat()} />
  )

  const groupUpdated = groupUpdatedAt(groupTasks)
  const updatedLabel = formatUpdated(groupUpdated, updatedNow)
  const updatedTitle = formatUpdatedTitle(groupUpdated)

  const groupTitleBlock = renameOpen ? (
    <input
      ref={renameInputRef}
      type="text"
      className="wou-inline-rename-input wou-group-title"
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
  ) : (
    <span className="wou-group-title">
      <HighlightText text={displayTitle} tokens={highlightTokens} />
      {/* Open groups list their asks right below, so the count only shows while collapsed. */}
      {showExpanded ? null : <span className="wou-group-count-pill">{strings.groupAsksCount(groupTasks.length)}</span>}
    </span>
  )

  const overflowMenu =
    canGroupContextMenu ? (
      <div style={{ position: 'relative' }} ref={menuAnchorRef}>
        <button
          type="button"
          className="wou-icon"
          aria-label={strings.menuMore}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          disabled={renameOpen || aiQuick}
          onClick={() => {
            setContextMenuOpen(false)
            setMenuOpen(v => !v)
          }}
        >
          …
        </button>
        <TaskOverflowMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          menuRef={menuRef}
          anchorRef={menuAnchorRef}
          onCloseAll={() => onConfirmClose()}
          onCloseAllNow={() => onDoneAll()}
          quadrant={group.quadrant}
          tags={allTags}
          tagState={tagId => tagCheckState(groupTasks, tagId)}
          showWhyHere={false}
          hidePriority={!showPriorities}
          onRename={openRename}
          onRenameWithAi={() => void renameWithAiNow()}
          onSnoozeTomorrow={() => onSnoozeAll(times.tomorrow)}
          onSnoozeMonday={() => onSnoozeAll(times.nextMonday)}
          onSnoozeWeek={() => onSnoozeAll(times.inWeek)}
          onCustomSnooze={openCustomSnooze}
          onToggleTag={onToggleTag}
          onNewTag={() => setNewTagDialogOpen(true)}
          onQuadrant={onMoveQuadrant}
          onWhyHere={() => {}}
          onDismiss={() => onDismissAll()}
          dismissLabel={strings.notATaskAll}
        />
      </div>
    ) : null

  return (
    <div
      className={`wou-group${pending ? ' wou-row-pending' : ''}${followHighlighted ? ' wou-group-follow-selected' : ''}`}
      data-wou-follow-key={group.chat_key}
    >
      <div
        ref={groupParentRef}
        className={`wou-row wou-group-parent${renameOpen ? ' wou-row-rename-open' : ''}${contextMenuOpen || menuOpen ? ' wou-row-menu-open' : ''}`}
        data-rename-open={renameOpen ? 'true' : undefined}
        tabIndex={canGroupContextMenu ? 0 : undefined}
        aria-haspopup={canGroupContextMenu ? 'menu' : undefined}
        onContextMenu={e => {
          const target = e.target instanceof HTMLElement ? e.target : null
          if (!isGroupContextMenuTarget(target)) return
          e.preventDefault()
          openGroupContextMenu(e.clientX, e.clientY)
        }}
        onKeyDown={e => {
          if (
            !shouldHandleShiftF10(e.key, e.shiftKey, e.target, e.currentTarget)
          ) {
            return
          }
          e.preventDefault()
          e.stopPropagation()
          const el = groupParentRef.current
          if (!el) return
          const r = el.getBoundingClientRect()
          openGroupContextMenu(r.left + r.width / 2, r.top + r.height / 2)
        }}
      >
        <button
          type="button"
          className="wou-group-chevron-btn"
          aria-expanded={showExpanded}
          aria-label={expanded ? strings.groupCollapse : strings.groupExpand}
          title={strings.groupChevronTip}
          onClick={e => onToggleExpanded(e.altKey)}
        >
          <span
            className={`wou-chevron${expanded ? '' : ' wou-chevron-collapsed'}`}
            aria-hidden="true"
          >
            ▼
          </span>
        </button>
        {!pending ? (
          <input
            type="checkbox"
            aria-label={strings.markGroupDone(displayTitle)}
            title={strings.groupCheckboxTip}
            disabled={checkboxDisabled || Boolean(confirmClose) || renameOpen}
            onClick={e => {
              e.preventDefault()
              // Option-click closes every task in the chat at once (undo still works).
              if (e.altKey) onDoneAll()
              else onConfirmClose()
            }}
            onChange={() => {}}
          />
        ) : (
          <span className="wou-group-checkbox-spacer" aria-hidden="true" />
        )}
        <div className="wou-row-body">
          <div className="wou-card-title-line wou-group-title-line">
            <div className="wou-card-title-main">{groupTitleBlock}</div>
            {!renameOpen && updatedLabel ? (
              <span className="wou-updated-at wou-muted" title={updatedTitle}>
                {updatedLabel}
              </span>
            ) : null}
            {!renameOpen && !notAChat && tasks[0] ? <ChatPresenceIndicators task={tasks[0]} /> : null}
            {!renameOpen ? <span className="wou-session-slot">{chatMeta}</span> : null}
            {overflowMenu}
          </div>
          {renameOpen ? (
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
          ) : null}
          {renameOpen && ai.error ? (
            <p className="wou-inline-rename-error" role="alert">{ai.error}</p>
          ) : null}
          {aiQuick ? (
            <div className="wou-pending-label" role="status">{strings.renameWithAiPending}</div>
          ) : null}
          {!showExpanded && !confirmClose && !groupPending && !customSnoozeOpen && !renameOpen ? (
            <p className="wou-group-collapsed-preview">{tasks[0]?.ask ?? ''}</p>
          ) : null}
          {confirmClose ? (
            <div
              className="wou-group-confirm"
              role="alertdialog"
              aria-label={strings.markAllDone(groupTasks.length)}
              onKeyDown={e => {
                if (e.key === 'Escape') onCancelClose()
              }}
            >
              <p className="wou-group-confirm-q">{strings.markAllDone(groupTasks.length)}</p>
              <div className="wou-group-confirm-actions">
                <button type="button" className="wou-group-confirm-yes" autoFocus onClick={() => onDoneAll()}>
                  {strings.markAllDoneYes(groupTasks.length)}
                </button>
                <button type="button" onClick={() => onCancelClose()}>{strings.renameCancel}</button>
              </div>
              {tipVisible ? (
                <div className="wou-group-confirm-hint">
                  <span>{strings.groupOptionClickHint}</span>
                  <button
                    type="button"
                    className="wou-tip-dismiss"
                    aria-label={strings.dismissTip}
                    title={strings.dismissTip}
                    onClick={() => {
                      ctx.storage.set(STORAGE_OPTION_TIP_DISMISSED, true)
                      setTipVisible(false)
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {groupPending ? (
            <div className="wou-pending-label" role="status">{groupPending}</div>
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
          {showAgentChip || (dueAt != null && !showExpanded) || projectsShown.length > 0 || tags.length > 0 ? (
          <div className="wou-meta">
            {showAgentChip ? <span className="wou-agent-chip">{group.agent}</span> : null}
            {showExpanded ? null : <DueChip dueAt={dueAt} now={updatedNow} />}
            {projectsShown.slice(0, 2).map(p => (
              <ProjectBadge key={p.key} project={p} onClick={onProjectClick} />
            ))}
            {projectsShown.length > 2 ? (
              <span className="wou-badge wou-project-chip">+{projectsShown.length - 2}</span>
            ) : null}
            <TagChips tags={tags} />
          </div>
          ) : null}
        </div>
        <span
          ref={contextAnchorRef}
          style={{
            position: 'fixed',
            left: contextAnchorPoint?.x ?? 0,
            top: contextAnchorPoint?.y ?? 0,
            width: 0,
            height: 0,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
        <TaskGroupContextMenu
          open={contextMenuOpen && canGroupContextMenu}
          onClose={reason => closeGroupContextMenu(reason === 'escape')}
          menuRef={contextMenuRef}
          anchorRef={contextAnchorRef}
          onConfirmClose={() => onConfirmClose()}
          onDoneAll={() => onDoneAll()}
        />
      </div>
      {showExpanded ? (
        <div className="wou-group-children">
          {tasks.map(task => (
            <TaskRow
              key={task.id}
              ctx={ctx}
              task={task}
              allTags={allTags}
              nameAfterChat={nameAfterChat}
              nested
              groupTitle={displayTitle}
              highlightTokens={highlightTokens}
              pendingLabel={pendingLabels[task.id]}
              checkboxDisabled={checkboxDisabled || Boolean(pendingLabels[task.id])}
              onDone={onChildDone}
              onDismiss={onChildDismiss}
              onSnooze={onChildSnooze}
              onMoveQuadrant={() => {}}
              onToggleTag={onChildToggleTag}
              onCreateTag={onCreateTag}
              onRename={onChildRename}
              onReload={onReload}
              showProjectChips={false}
              showPriorities={showPriorities}
              updatedNow={updatedNow}
            />
          ))}
        </div>
      ) : null}
      <NewTagDialog
        open={newTagDialogOpen}
        onOpenChange={setNewTagDialogOpen}
        createTag={onCreateTag}
        applies
        onCreated={created => onToggleTag(created, 'none')}
      />
    </div>
  )
}
