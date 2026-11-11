import { toggleProjectSel, type ProjectFilter } from '../model'
import type { Project } from './api'
import { FilterMenu, FilterRow } from './FilterMenu'
import { strings } from './strings'

interface ProjectFilterMenuProps {
  filter: ProjectFilter
  projects: Project[]
  noProjectCount: number
  onChange: (filter: ProjectFilter) => void
  onOpen?: () => void
}

export function projectFilterButtonLabel(filter: ProjectFilter, projects: Project[]): string {
  if (filter === 'all') return strings.projectFilterAll
  if (filter.length === 1) {
    const sel = filter[0]
    if (sel === 'none') return strings.projectFilterNone
    return projects.find(p => p.key === sel)?.name ?? strings.projectFilterMany(1)
  }
  return strings.projectFilterMany(filter.length)
}

/** Projects grouped by the Hermes profile (or machine) they come from, in list order. */
function byProfile(projects: Project[]): { profile: string; projects: Project[] }[] {
  const out: { profile: string; projects: Project[] }[] = []
  for (const p of projects) {
    const profile = p.profile || 'default'
    let bucket = out.find(b => b.profile === profile)
    if (!bucket) {
      bucket = { profile, projects: [] }
      out.push(bucket)
    }
    bucket.projects.push(p)
  }
  return out
}

export function ProjectFilterMenu({ filter, projects, noProjectCount, onChange, onOpen }: ProjectFilterMenuProps) {
  const checked = (sel: string) => filter !== 'all' && filter.includes(sel)
  const buckets = byProfile(projects)
  const showHeaders = buckets.length > 1

  return (
    <FilterMenu
      label={strings.projectFilterLabel}
      buttonLabel={projectFilterButtonLabel(filter, projects)}
      onOpen={onOpen}
    >
      <FilterRow checked={filter === 'all'} onChange={() => onChange('all')}>
        {strings.projectFilterAll}
      </FilterRow>
      <FilterRow checked={checked('none')} onChange={() => onChange(toggleProjectSel(filter, 'none'))}>
        {strings.projectFilterNone} <span className="wou-filter-menu-count">({noProjectCount})</span>
      </FilterRow>
      {projects.length === 0 ? (
        <p className="wou-filter-menu-hint">{strings.projectFilterEmpty}</p>
      ) : null}
      {buckets.map(bucket => (
        <div key={bucket.profile} role="presentation">
          {showHeaders ? <div className="wou-filter-menu-heading">{bucket.profile}</div> : null}
          {bucket.projects.map(p => (
            <FilterRow key={p.key} checked={checked(p.key)} onChange={() => onChange(toggleProjectSel(filter, p.key))}>
              {p.name} <span className="wou-filter-menu-count">({p.open_count ?? 0})</span>
            </FilterRow>
          ))}
        </div>
      ))}
    </FilterMenu>
  )
}
