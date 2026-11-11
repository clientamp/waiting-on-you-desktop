import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@hermes/plugin-sdk'
import { useEffect, useState } from 'react'
import type { Tag } from './api'
import { strings } from './strings'
import { globalStyles, ROOT_CLASS } from './styles'
import { ColorSwatches } from './TagChips'
import { restErrorFields } from './sessionApi'

function sentence(text: string): string {
  const t = text.trim()
  if (!t) return t
  const first = t.charAt(0).toUpperCase() + t.slice(1)
  return /[.!?]$/.test(first) ? first : `${first}.`
}

export interface NewTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Creates the tag. Throws (or returns null) when it fails; the dialog shows why. */
  createTag: (name: string, color: string) => Promise<Tag | null>
  onCreated?: (tag: Tag) => void
  /** True when the new tag also goes on the task the menu was opened from. */
  applies?: boolean
}

export function NewTagDialog({ open, onOpenChange, createTag, onCreated, applies }: NewTagDialogProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('gray')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName('')
    setColor('gray')
    setError(null)
    setSaving(false)
  }, [open])

  const submit = async () => {
    const trimmed = name.trim()
    if (saving) return
    if (trimmed.length < 1 || trimmed.length > 32) {
      setError(strings.tagNameInvalid)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await createTag(trimmed, color)
      if (!created) {
        setError(strings.tagSaveError)
        return
      }
      onCreated?.(created)
      onOpenChange(false)
    } catch (e) {
      const reason = restErrorFields(e).error
      setError(reason ? sentence(reason) : strings.tagSaveError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${ROOT_CLASS} wou-dialog`}>
        <style>{globalStyles}</style>
        <DialogHeader>
          <DialogTitle>{strings.tagNewTitle}</DialogTitle>
          <DialogDescription>
            {applies ? strings.tagNewDescriptionApply : strings.tagNewDescription}
          </DialogDescription>
        </DialogHeader>
        <div className="wou-composer-body">
          <label className="wou-field">
            <span className="wou-field-label">{strings.tagName}</span>
            <input
              type="text"
              value={name}
              maxLength={32}
              autoFocus
              disabled={saving}
              placeholder={strings.tagNamePlaceholder}
              onChange={e => {
                setName(e.target.value)
                setError(null)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void submit()
                }
              }}
            />
          </label>
          <div className="wou-field">
            <span className="wou-field-label">{strings.tagColor}</span>
            <ColorSwatches value={color} onChange={setColor} disabled={saving} label={strings.tagColor} />
          </div>
          {error ? <p className="wou-snooze-error" role="alert">{error}</p> : null}
        </div>
        <DialogFooter className="wou-composer-footer">
          <Button type="button" variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
            {strings.snoozeCancel}
          </Button>
          <Button type="button" disabled={saving || !name.trim()} onClick={() => void submit()}>
            {strings.tagCreate}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
