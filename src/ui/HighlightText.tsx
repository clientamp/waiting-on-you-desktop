import { useMemo, type ReactNode } from 'react'
import { highlightRanges } from '../model'

interface HighlightTextProps {
  text: string
  tokens: string[]
  className?: string
}

export function HighlightText({ text, tokens, className }: HighlightTextProps) {
  const ranges = useMemo(() => highlightRanges(text, tokens), [text, tokens])
  if (ranges.length === 0) {
    return <span className={className}>{text}</span>
  }
  const parts: ReactNode[] = []
  let last = 0
  for (const [start, end] of ranges) {
    if (start > last) parts.push(text.slice(last, start))
    parts.push(
      <mark key={start} className="wou-search-mark">
        {text.slice(start, end)}
      </mark>,
    )
    last = end
  }
  if (last < text.length) parts.push(text.slice(last))
  return <span className={className}>{parts}</span>
}
