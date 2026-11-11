import type { RefObject } from 'react'
import { useEffect, useRef } from 'react'
import {
  activateGroupCloseChoice,
  contextMenuItemKeyAction,
  groupCloseChoiceFromModifiers,
} from './groupContextClose'
import { IconCheck } from './icons'
import { strings } from './strings'
import { useMenuFlip } from './useMenuFlip'

export type GroupContextMenuDismiss = 'escape' | 'tab' | 'activate'

export interface TaskGroupContextMenuProps {
  open: boolean
  onClose: (reason: GroupContextMenuDismiss) => void
  menuRef: RefObject<HTMLDivElement | null>
  anchorRef: RefObject<HTMLElement | null>
  onConfirmClose: () => void
  onDoneAll: () => void
}

export function TaskGroupContextMenu({
  open,
  onClose,
  menuRef,
  anchorRef,
  onConfirmClose,
  onDoneAll,
}: TaskGroupContextMenuProps) {
  const menuStyle = useMenuFlip(open, menuRef, anchorRef)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onConfirmCloseRef = useRef(onConfirmClose)
  onConfirmCloseRef.current = onConfirmClose
  const onDoneAllRef = useRef(onDoneAll)
  onDoneAllRef.current = onDoneAll

  const pickAndRun = (altKey: boolean) => {
    onCloseRef.current('activate')
    activateGroupCloseChoice(
      groupCloseChoiceFromModifiers(altKey),
      onConfirmCloseRef.current,
      onDoneAllRef.current,
    )
  }

  useEffect(() => {
    if (!open) return
    const menu = menuRef.current
    if (!menu) return

    const row = () => menu.querySelector<HTMLButtonElement>('button.wou-menu-row')
    const raf = requestAnimationFrame(() => row()?.focus())

    const onKeyDown = (e: KeyboardEvent) => {
      const item = row()
      const focusedOnMenuItem = Boolean(item && document.activeElement === item)
      const action = contextMenuItemKeyAction(e.key, e.altKey, focusedOnMenuItem)
      if (!action) return
      if (action.action === 'escape') {
        e.preventDefault()
        onCloseRef.current('escape')
        return
      }
      if (action.action === 'tab-dismiss') {
        onCloseRef.current('tab')
        return
      }
      if (action.action === 'activate') {
        e.preventDefault()
        pickAndRun(action.altKey)
      }
    }

    menu.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(raf)
      menu.removeEventListener('keydown', onKeyDown)
    }
  }, [open, menuRef])

  if (!open) return null

  return (
    <div
      className="wou-menu wou-menu-floating wou-menu-notion"
      style={menuStyle ?? { visibility: 'hidden' }}
      ref={menuRef}
      role="menu"
      aria-label={strings.closeAllTasks}
    >
      <button
        type="button"
        role="menuitem"
        className="wou-menu-row"
        title={strings.groupCheckboxTip}
        onClick={e => pickAndRun(e.altKey)}
      >
        <span className="wou-menu-row-icon" aria-hidden="true">
          <IconCheck />
        </span>
        <span className="wou-menu-row-label">{strings.closeAllTasks}</span>
        <span className="wou-menu-row-trail">
          <kbd className="wou-menu-kbd">{strings.renameAltHint}</kbd>
        </span>
      </button>
    </div>
  )
}
