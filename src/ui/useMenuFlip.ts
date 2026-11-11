import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'

const MARGIN = 8
const GAP = 4

/** Position an open menu with position: fixed against the window, so no pane or list
 *  container can clip it. It opens below the anchor when it fits, otherwise above, and only
 *  gets a max-height (and so a scroll bar) when the window is too short for the whole menu. */
export function useMenuFlip(
  open: boolean,
  menuRef: RefObject<HTMLElement | null>,
  anchorRef: RefObject<HTMLElement | null>,
): CSSProperties | null {
  const [style, setStyle] = useState<CSSProperties | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null)
      return
    }
    const place = () => {
      const menu = menuRef.current
      const anchor = anchorRef.current
      if (!menu || !anchor) return
      const a = anchor.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      // Natural height: measure with no max-height applied.
      const prevMax = menu.style.maxHeight
      menu.style.maxHeight = 'none'
      const h = menu.scrollHeight
      const w = menu.offsetWidth
      menu.style.maxHeight = prevMax
      const below = vh - a.bottom - GAP - MARGIN
      const above = a.top - GAP - MARGIN
      let top: number
      let maxHeight: number | undefined
      if (h <= below) top = a.bottom + GAP
      else if (h <= above) top = a.top - GAP - h
      else if (below >= above) {
        top = a.bottom + GAP
        maxHeight = below
      } else {
        top = MARGIN
        maxHeight = above
      }
      const left = Math.max(MARGIN, Math.min(a.right - w, vw - w - MARGIN))
      setStyle({ top, left, maxHeight })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, menuRef, anchorRef])

  return style
}
