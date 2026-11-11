import type { ReactNode, RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { TagCheckState } from '../model'
import type { Tag } from './api'
import {
  IconCalendar,
  IconCalendarPlus,
  IconCheck,
  IconClock,
  IconInfoCircle,
  IconPencil,
  IconPlus,
  IconSparkle,
  IconSun,
  IconTrash,
} from './icons'
import { strings } from './strings'
import { useMenuFlip } from './useMenuFlip'
import { tagColorClass } from './TagChips'

const QUADRANTS = [1, 2, 3, 4] as const

export interface TaskOverflowMenuProps {
  open: boolean
  onClose: () => void
  menuRef: RefObject<HTMLDivElement | null>
  anchorRef: RefObject<HTMLElement | null>
  quadrant: number
  /** Every tag you made. */
  tags: Tag[]
  /** Whether a tag is on this task (or on all / some of a group's tasks). */
  tagState: (tagId: number) => TagCheckState
  showWhyHere: boolean
  hidePriority?: boolean
  onRename: () => void
  /** Option-click on Rename: skip the editor and name it with AI. */
  onRenameWithAi?: () => void
  onSnoozeTomorrow: () => void
  onSnoozeMonday: () => void
  onSnoozeWeek: () => void
  onCustomSnooze: () => void
  onToggleTag: (tag: Tag, state: TagCheckState) => void
  onNewTag: () => void
  onQuadrant: (q: number) => void
  onWhyHere: () => void
  /** Group cards: same flow as the checkbox — confirm, or Option to skip the prompt. */
  onCloseAll?: () => void
  onCloseAllNow?: () => void
  onDismiss: () => void
  dismissLabel: string
}

function MenuSep() {
  return <div className="wou-menu-sep" role="presentation" />
}

function MenuHeader({ children }: { children: ReactNode }) {
  return (
    <div className="wou-menu-section" role="presentation">
      {children}
    </div>
  )
}

function MenuRow({
  icon,
  label,
  trailing,
  danger,
  onActivate,
  role = 'menuitem',
  'aria-checked': ariaChecked,
  altAction,
  title,
}: {
  altAction?: string
  title?: string
  icon: ReactNode
  label: ReactNode
  trailing?: ReactNode
  danger?: boolean
  onActivate: (e: { altKey: boolean }) => void
  role?: string
  'aria-checked'?: boolean | 'mixed'
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={ariaChecked}
      data-alt-action={altAction}
      title={title}
      className={`wou-menu-row${danger ? ' wou-menu-row-danger' : ''}`}
      onClick={e => onActivate({ altKey: e.altKey })}
    >
      <span className="wou-menu-row-icon" aria-hidden="true">{icon}</span>
      <span className="wou-menu-row-label">{label}</span>
      {trailing ? <span className="wou-menu-row-trail">{trailing}</span> : null}
    </button>
  )
}

function PriorityIcon({ quadrant }: { quadrant: number }) {
  return (
    <span
      className={`wou-menu-priority-sq wou-quadrant-dot-${quadrant}`}
      aria-hidden="true"
    />
  )
}

export function TaskOverflowMenu({
  open,
  onClose,
  menuRef,
  anchorRef,
  quadrant,
  tags,
  tagState,
  showWhyHere,
  hidePriority = false,
  onRename,
  onRenameWithAi,
  onSnoozeTomorrow,
  onSnoozeMonday,
  onSnoozeWeek,
  onCustomSnooze,
  onToggleTag,
  onNewTag,
  onQuadrant,
  onWhyHere,
  onCloseAll,
  onCloseAllNow,
  onDismiss,
  dismissLabel,
}: TaskOverflowMenuProps) {
  const menuStyle = useMenuFlip(open, menuRef, anchorRef)
  // Read through a ref so a parent re-render (e.g. after a tag toggle) does not refocus row one.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  // macOS alternate menu item: holding Option turns Rename into Rename with AI.
  const [altHeld, setAltHeld] = useState(false)

  useEffect(() => {
    if (!open || !onRenameWithAi) {
      setAltHeld(false)
      return
    }
    const sync = (e: KeyboardEvent | MouseEvent) => setAltHeld(e.altKey)
    const clear = () => setAltHeld(false)
    window.addEventListener('keydown', sync, true)
    window.addEventListener('keyup', sync, true)
    window.addEventListener('mousemove', sync, true)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', sync, true)
      window.removeEventListener('keyup', sync, true)
      window.removeEventListener('mousemove', sync, true)
      window.removeEventListener('blur', clear)
    }
  }, [open, onRenameWithAi])

  useEffect(() => {
    if (!open) return
    const menu = menuRef.current
    if (!menu) return

    const rows = () =>
      Array.from(menu.querySelectorAll<HTMLButtonElement>('button.wou-menu-row'))

    const focusAt = (index: number) => {
      const list = rows()
      if (list.length === 0) return
      const i = ((index % list.length) + list.length) % list.length
      list[i]?.focus()
    }

    const raf = requestAnimationFrame(() => focusAt(0))

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      const list = rows()
      if (list.length === 0) return
      const active = document.activeElement
      const idx = list.findIndex(el => el === active)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        focusAt(idx < 0 ? 0 : idx + 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        focusAt(idx < 0 ? list.length - 1 : idx - 1)
      } else if (e.key === 'Enter' && idx >= 0) {
        e.preventDefault()
        const row = list[idx]
        if (e.altKey && row?.dataset.altAction === 'rename-ai') {
          row.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }))
        } else {
          row?.click()
        }
      }
    }

    menu.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(raf)
      menu.removeEventListener('keydown', onKeyDown)
    }
  }, [open, menuRef])

  if (!open) return null

  const close = () => onClose()

  return (
    <div
      className="wou-menu wou-menu-floating wou-menu-notion"
      style={menuStyle ?? { visibility: 'hidden' }}
      ref={menuRef}
      role="menu"
    >
      {onCloseAll ? (
        <MenuRow
          icon={<IconCheck />}
          label={strings.closeAllTasks}
          trailing={<kbd className="wou-menu-kbd">{strings.renameAltHint}</kbd>}
          title={strings.groupCheckboxTip}
          onActivate={e => {
            close()
            if (onCloseAllNow && (e.altKey || altHeld)) onCloseAllNow()
            else onCloseAll()
          }}
        />
      ) : null}
      {onCloseAll ? <MenuSep /> : null}

      <MenuRow
        icon={altHeld ? <IconSparkle /> : <IconPencil />}
        label={altHeld ? strings.renameWithAi : strings.rename}
        trailing={onRenameWithAi && !altHeld ? <kbd className="wou-menu-kbd">{strings.renameAltHint}</kbd> : undefined}
        altAction={onRenameWithAi ? 'rename-ai' : undefined}
        title={onRenameWithAi ? strings.renameWithAiTip : undefined}
        onActivate={e => {
          close()
          if (onRenameWithAi && (e.altKey || altHeld)) onRenameWithAi()
          else onRename()
        }}
      />

      <MenuSep />

      <MenuHeader>{strings.menuSectionSnooze}</MenuHeader>
      <MenuRow
        icon={<IconSun />}
        label={strings.snoozeTomorrowShort}
        onActivate={() => {
          close()
          onSnoozeTomorrow()
        }}
      />
      <MenuRow
        icon={<IconCalendar />}
        label={strings.snoozeMondayShort}
        onActivate={() => {
          close()
          onSnoozeMonday()
        }}
      />
      <MenuRow
        icon={<IconCalendarPlus />}
        label={strings.snoozeWeekShort}
        onActivate={() => {
          close()
          onSnoozeWeek()
        }}
      />
      <MenuRow
        icon={<IconClock />}
        label={strings.snoozeCustomShort}
        onActivate={() => {
          close()
          onCustomSnooze()
        }}
      />

      <MenuSep />

      <MenuHeader>{strings.menuSectionTags}</MenuHeader>
      {tags.length > 0 ? (
        <div
          className={`wou-menu-tag-list${tags.length > 6 ? ' wou-menu-tag-list-scroll' : ''}`}
          role="presentation"
        >
          {tags.map(tag => {
            const state = tagState(tag.id)
            return (
              <MenuRow
                key={tag.id}
                role="menuitemcheckbox"
                aria-checked={state === 'all' ? true : state === 'some' ? 'mixed' : false}
                icon={<span className={`wou-tag-dot ${tagColorClass(tag.color)}`} />}
                label={tag.name}
                trailing={
                  state === 'all' ? (
                    <IconCheck />
                  ) : state === 'some' ? (
                    <span className="wou-menu-tag-check">–</span>
                  ) : undefined
                }
                // Stays open so you can toggle several tags in a row.
                onActivate={() => onToggleTag(tag, state)}
              />
            )
          })}
        </div>
      ) : null}
      <MenuRow
        icon={<IconPlus />}
        label={strings.tagNew}
        onActivate={() => {
          close()
          onNewTag()
        }}
      />

      {hidePriority ? null : (
        <>
          <MenuSep />
          <MenuHeader>{strings.menuSectionPriority}</MenuHeader>
          {QUADRANTS.map(q => (
            <MenuRow
              key={q}
              role="menuitemradio"
              aria-checked={q === quadrant}
              icon={<PriorityIcon quadrant={q} />}
              label={strings[`quadrantBar${q}` as 'quadrantBar1']}
              trailing={q === quadrant ? <IconCheck /> : undefined}
              onActivate={() => {
                if (q === quadrant) return
                close()
                onQuadrant(q)
              }}
            />
          ))}
        </>
      )}

      {showWhyHere ? (
        <>
          <MenuSep />
          <MenuRow
            icon={<IconInfoCircle />}
            label={strings.whyHere}
            onActivate={() => {
              close()
              onWhyHere()
            }}
          />
        </>
      ) : null}

      <MenuSep />
      <MenuRow
        icon={<IconTrash />}
        label={dismissLabel}
        danger
        onActivate={() => {
          close()
          onDismiss()
        }}
      />
    </div>
  )
}
