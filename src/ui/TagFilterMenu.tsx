import { toggleTagSel, type TagFilter } from '../model'
import type { Tag } from './api'
import { FilterMenu, FilterRow } from './FilterMenu'
import { strings } from './strings'
import { tagColorClass } from './TagChips'

interface TagFilterMenuProps {
  filter: TagFilter
  tags: Tag[]
  onChange: (filter: TagFilter) => void
  onOpen?: () => void
}

export function tagFilterButtonLabel(filter: TagFilter, tags: Tag[]): string {
  if (filter.length === 0) return strings.tagFilterAll
  if (filter.length === 1) {
    return tags.find(t => t.id === filter[0])?.name ?? strings.tagFilterMany(1)
  }
  return strings.tagFilterMany(filter.length)
}

export function TagFilterMenu({ filter, tags, onChange, onOpen }: TagFilterMenuProps) {
  return (
    <FilterMenu label={strings.tagFilterLabel} buttonLabel={tagFilterButtonLabel(filter, tags)} onOpen={onOpen}>
      <FilterRow checked={filter.length === 0} onChange={() => onChange([])}>
        {strings.tagFilterAll}
      </FilterRow>
      {tags.length === 0 ? (
        <p className="wou-filter-menu-hint">{strings.tagFilterEmpty}</p>
      ) : (
        <>
          {tags.map(tag => (
            <FilterRow key={tag.id} checked={filter.includes(tag.id)} onChange={() => onChange(toggleTagSel(filter, tag.id))}>
              <span className={`wou-tag-dot ${tagColorClass(tag.color)}`} aria-hidden="true" />{' '}
              {tag.name} <span className="wou-filter-menu-count">({tag.open_count ?? 0})</span>
            </FilterRow>
          ))}
          <p className="wou-filter-menu-hint">{strings.tagFilterHint}</p>
        </>
      )}
    </FilterMenu>
  )
}
