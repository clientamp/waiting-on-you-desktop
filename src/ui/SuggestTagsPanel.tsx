import type { PluginContext } from '@hermes/plugin-sdk'
import { useState } from 'react'
import { suggestTags, type Tag } from './api'
import {
  editSuggestionName,
  initSuggestionRows,
  nameClashes,
  pendingSuggestionCount,
  rowsToAddAll,
  setSuggestionStatus,
  validateTagName,
  type SuggestionRow,
} from './priorityHelpers'
import { restErrorFields } from './sessionApi'
import { strings } from './strings'
import { tagColorClass } from './TagChips'

interface SuggestTagsPanelProps {
  ctx: PluginContext
  tags: Tag[]
  /** Creates the tag. Throws on failure so the row can show why. */
  onAddTag: (body: { name: string; color: string; hint: string }) => Promise<Tag>
}

export function SuggestTagsPanel({ ctx, tags, onAddTag }: SuggestTagsPanelProps) {
  const [rows, setRows] = useState<SuggestionRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const existingNames = tags.map(t => t.name)

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const suggestions = await suggestTags(ctx)
      setRows(initSuggestionRows(suggestions, existingNames))
    } catch (e) {
      // 409 carries the reason (for example, no model is set up).
      setError(restErrorFields(e).error || strings.tagSuggestError)
    } finally {
      setLoading(false)
    }
  }

  const addOne = async (row: SuggestionRow): Promise<void> => {
    const invalid = validateTagName(row.name)
    if (invalid) {
      setRows(prev => prev && setSuggestionStatus(prev, row.key, 'pending', invalid))
      return
    }
    if (nameClashes(row, existingNames)) {
      setRows(prev => prev && setSuggestionStatus(prev, row.key, 'pending', strings.tagSuggestTaken))
      return
    }
    setRows(prev => prev && setSuggestionStatus(prev, row.key, 'adding'))
    try {
      await onAddTag({ name: row.name.trim(), color: row.color, hint: row.hint })
      setRows(prev => prev && setSuggestionStatus(prev, row.key, 'added'))
    } catch (e) {
      setRows(
        prev =>
          prev && setSuggestionStatus(prev, row.key, 'pending', restErrorFields(e).error || strings.tagSaveError),
      )
    }
  }

  const addAll = async () => {
    if (!rows) return
    for (const row of rowsToAddAll(rows, existingNames)) {
      // One at a time so names stay unique and errors land on the right row.
      await addOne(row)
    }
  }

  const visible = rows?.filter(r => r.status !== 'skipped') ?? []
  const pending = rows ? pendingSuggestionCount(rows) : 0

  return (
    <div className="wou-suggest">
      <div className="wou-suggest-head">
        <button
          type="button"
          className="wou-btn-compact"
          onClick={() => void run()}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? strings.tagSuggesting : strings.tagSuggest}
        </button>
        {rows && pending > 1 ? (
          <button type="button" className="wou-btn-compact" onClick={() => void addAll()}>
            {strings.tagSuggestAddAll}
          </button>
        ) : null}
      </div>
      <p className="wou-muted wou-suggest-note">{strings.tagSuggestNote}</p>
      {error ? (
        <p className="wou-suggest-error" role="alert">
          {error}
        </p>
      ) : null}
      {rows && visible.length === 0 && !loading ? (
        <p className="wou-muted wou-settings-empty">{strings.tagSuggestEmpty}</p>
      ) : null}
      {visible.length > 0 ? (
        <ul className="wou-suggest-list">
          {visible.map(row => {
            const done = row.status === 'added'
            const busy = row.status === 'adding'
            return (
              <li key={row.key} className="wou-suggest-item">
                <div className="wou-suggest-main">
                  <span className={`wou-tag-swatch-btn ${tagColorClass(row.color)}`} aria-hidden="true" />
                  <input
                    type="text"
                    className="wou-tag-name-input"
                    value={row.name}
                    maxLength={32}
                    disabled={done || busy}
                    aria-label={strings.tagSuggestRename(row.name)}
                    onChange={e => setRows(prev => prev && editSuggestionName(prev, row.key, e.target.value))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void addOne(row)
                      }
                    }}
                  />
                  {done ? (
                    <span className="wou-muted wou-suggest-added">{strings.tagSuggestAdded}</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="wou-btn-compact"
                        disabled={busy}
                        onClick={() => void addOne(row)}
                      >
                        {strings.tagSuggestAdd}
                      </button>
                      <button
                        type="button"
                        className="wou-link wou-link-compact"
                        disabled={busy}
                        onClick={() => setRows(prev => prev && setSuggestionStatus(prev, row.key, 'skipped'))}
                      >
                        {strings.tagSuggestSkip}
                      </button>
                    </>
                  )}
                </div>
                {row.hint || row.example_count > 0 ? (
                  <p className="wou-muted wou-suggest-hint">
                    {row.hint}
                    {row.hint && row.example_count > 0 ? ' · ' : ''}
                    {row.example_count > 0 ? strings.tagSuggestExamples(row.example_count) : ''}
                  </p>
                ) : null}
                {row.error ? (
                  <p className="wou-field-error" role="alert">{row.error}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
