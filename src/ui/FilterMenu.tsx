import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

interface FilterMenuProps {
  label: string
  buttonLabel: string
  onOpen?: () => void
  children: ReactNode
}

/** A select-looking button that opens a floating checkbox list. */
export function FilterMenu({ label, buttonLabel, onOpen, children }: FilterMenuProps) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // The menu floats (position: fixed) so no header or list container can clip it.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const btn = wrapRef.current?.querySelector('button')
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const vw = window.innerWidth
      const width = Math.min(Math.max(r.width, 240), 360, vw - 24)
      const left = Math.max(12, Math.min(r.left, vw - width - 12))
      setMenuPos({ top: r.bottom + 4, left, width })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      const el = wrapRef.current
      if (el && !el.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="wou-project-filter-wrap" ref={wrapRef}>
      <button
        type="button"
        className="wou-select wou-project-filter-btn"
        aria-label={label}
        title={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.()
          setOpen(v => !v)
        }}
      >
        <span className="wou-project-filter-btn-label">{buttonLabel}</span>
      </button>
      {open ? (
        <div
          className="wou-menu wou-project-filter-menu"
          style={menuPos ? { top: menuPos.top, left: menuPos.left, width: menuPos.width } : { visibility: 'hidden' }}
          role="group"
          aria-label={label}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function FilterRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: () => void
  children: ReactNode
}) {
  return (
    <label className="wou-project-filter-row">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{children}</span>
    </label>
  )
}
