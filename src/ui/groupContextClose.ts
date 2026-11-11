/** Pure helpers for group “Close all tasks” context / overflow entry points (tested in Node). */

export type CloseableTarget = { closest(selectors: string): CloseableTarget | null }

export function isGroupContextMenuTarget(target: CloseableTarget | null): boolean {
  if (!target) return false
  if (target.closest('.wou-group-children')) return false
  if (target.closest('button, a, input, textarea, select, [role="menu"], [role="alertdialog"]')) return false
  return true
}

export function canOpenGroupContextMenu(flags: {
  pending: boolean
  confirmClose: boolean
  renameOpen: boolean
  aiQuick: boolean
  customSnoozeOpen: boolean
  checkboxDisabled?: boolean
}): boolean {
  return (
    !flags.pending &&
    !flags.confirmClose &&
    !flags.renameOpen &&
    !flags.aiQuick &&
    !flags.customSnoozeOpen &&
    !flags.checkboxDisabled
  )
}

/** Shift-F10 is only for the focused group card surface, not bubbled from chevron/body controls. */
export function shouldHandleShiftF10(
  key: string,
  shiftKey: boolean,
  target: unknown,
  currentTarget: unknown,
): boolean {
  if (key !== 'F10' || !shiftKey) return false
  return target === currentTarget
}

export type GroupCloseChoice = 'confirm' | 'done-all'

export function groupCloseChoiceFromModifiers(altKey: boolean): GroupCloseChoice {
  return altKey ? 'done-all' : 'confirm'
}

export function activateGroupCloseChoice(
  choice: GroupCloseChoice,
  onConfirmClose: () => void,
  onDoneAll: () => void,
): void {
  if (choice === 'done-all') onDoneAll()
  else onConfirmClose()
}

export type ContextMenuKey =
  | { action: 'escape' }
  | { action: 'activate'; altKey: boolean }
  | { action: 'tab-dismiss' }

/** Keyboard handling for the single-item group context menu. */
export function contextMenuItemKeyAction(
  key: string,
  altKey: boolean,
  focusedOnMenuItem: boolean,
): ContextMenuKey | null {
  if (key === 'Escape') return { action: 'escape' }
  if (key === 'Tab') return { action: 'tab-dismiss' }
  if (key === 'Enter' && focusedOnMenuItem) return { action: 'activate', altKey }
  return null
}
