import type { CSSProperties } from 'react'
import {
  TAG_COLORS,
  dueChipLabel,
  normalizeTagColor,
  visibleTagChips,
  type TaskProject,
  type TaskTag,
} from '../model'
import { IconSparkle } from './icons'
import { strings } from './strings'

const MAX_TAG_CHIPS = 3

export function tagColorClass(color: string | null | undefined): string {
  return `wou-tc-${normalizeTagColor(color)}`
}

/** Project colors come from Hermes: an allowed name, or a hex value. Anything else is ignored. */
function projectColorProps(color: string | null): { className: string; style?: CSSProperties } {
  if (!color) return { className: '' }
  if ((TAG_COLORS as readonly string[]).includes(color)) return { className: tagColorClass(color) }
  if (/^#[0-9a-f]{3,8}$/i.test(color)) {
    return { className: '', style: { '--wou-tag-hue': color } as CSSProperties }
  }
  return { className: '' }
}

export function TagChip({ tag }: { tag: TaskTag }) {
  const auto = tag.source === 'auto'
  return (
    <span
      className={`wou-tag-chip ${tagColorClass(tag.color)}`}
      title={auto ? `${tag.name} · ${strings.tagAddedByAi}` : tag.name}
    >
      {auto ? (
        <span aria-label={strings.tagAddedByAi} role="img" style={{ display: 'inline-flex' }}>
          <IconSparkle />
        </span>
      ) : null}
      <span className="wou-tag-chip-name">{tag.name}</span>
    </span>
  )
}

export function TagChips({ tags }: { tags: TaskTag[] }) {
  if (tags.length === 0) return null
  const { shown, extra } = visibleTagChips(tags, MAX_TAG_CHIPS)
  const rest = tags.slice(shown.length).map(t => t.name).join(', ')
  return (
    <>
      {shown.map(tag => (
        <TagChip key={tag.id} tag={tag} />
      ))}
      {extra > 0 ? (
        <span className="wou-tag-chip wou-tag-chip-more" title={strings.tagMoreTitle(rest)}>
          +{extra}
        </span>
      ) : null}
    </>
  )
}

export function ProjectBadge({
  project,
  onClick,
}: {
  project: TaskProject
  onClick?: (project: TaskProject) => void
}) {
  const color = projectColorProps(project.color)
  const dot = project.color && (color.className || color.style) ? (
    <span className={`wou-project-dot ${color.className}`} style={color.style} aria-hidden="true" />
  ) : null
  if (!onClick) {
    return (
      <span className="wou-badge wou-project-chip">
        {dot}
        {project.name}
      </span>
    )
  }
  return (
    <button
      type="button"
      className="wou-badge wou-project-chip"
      title={strings.projectBadgeTip(project.name)}
      onClick={() => onClick(project)}
    >
      {dot}
      <span className="wou-tag-chip-name">{project.name}</span>
    </button>
  )
}

export function DueChip({ dueAt, now }: { dueAt: number | null | undefined; now: Date }) {
  if (dueAt == null) return null
  const due = dueChipLabel(dueAt, now)
  if (!due) return null
  const full = new Date(dueAt * 1000).toLocaleString(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
  })
  return (
    <span className={`wou-due-chip wou-due-${due.tone}`} title={full}>
      {due.label}
    </span>
  )
}

export function ColorSwatches({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
  label: string
}) {
  const current = normalizeTagColor(value)
  return (
    <div className="wou-swatches" role="radiogroup" aria-label={label}>
      {TAG_COLORS.map(color => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={current === color}
          aria-label={strings.tagColorName(color)}
          title={strings.tagColorName(color)}
          className={`wou-swatch ${tagColorClass(color)}`}
          disabled={disabled}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  )
}
