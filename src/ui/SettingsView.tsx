import { host, type PluginContext } from '@hermes/plugin-sdk'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clampSettingInt,
  formatTodayChecksLine,
  formatWithThousands,
  settingsFieldVisible,
  todayChecksProgress,
  validateSettingInt,
  parseGroupBy,
  parseLayout,
  type GroupBy,
  type ListLayout,
  type SettingIntKey,
  type WouMode,
} from '../model'
import {
  patchSettings,
  type HermesModelInfo,
  type PluginSettings,
  type SettingsBundle,
  type Tag,
  type UsageDay,
} from './api'
import { NewTagDialog } from './NewTagDialog'
import { createSettingsSaveQueue } from './settingsSaves'
import { ColorSwatches, tagColorClass } from './TagChips'
import { Switch } from './Switch'
import { strings } from './strings'
import { notifyError } from './notify'
import { SETTINGS_SHORTCUT_ROWS, comboToKeyCaps } from './shortcuts'
import { SatellitesSection } from './SatellitesSection'
import { DecisionModelControls } from './DecisionModelControls'
import { SuggestTagsPanel } from './SuggestTagsPanel'
import { PRIORITIES_NOTE_MAX, charCounter } from './priorityHelpers'

const DEBOUNCE_MS = 500
const STORAGE_ADVANCED = 'settingsAdvancedOpen'

interface SettingsViewProps {
  ctx: PluginContext
  bundle: SettingsBundle
  tags: Tag[]
  onCreateTag: (name: string, color: string) => Promise<Tag | null>
  onPatchTag: (id: number, body: { name?: string; color?: string; hint?: string }) => Promise<boolean>
  onDeleteTag: (tag: Tag) => void
  onAddSuggestedTag: (body: { name: string; color: string; hint: string }) => Promise<Tag>
  onBundleChange: (bundle: SettingsBundle) => void
  onOpenTeach: () => void
  onBack: () => void
}

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'priority', label: strings.groupByPriority },
  { value: 'project', label: strings.groupByProject },
  { value: 'none', label: strings.groupByNone },
]

const LAYOUT_OPTIONS: { value: ListLayout; label: string }[] = [
  { value: 'cards', label: strings.layoutCards },
  { value: 'compact', label: strings.layoutCompact },
  { value: 'focus', label: strings.layoutFocus },
]

function TagSettingsRow({
  tag,
  onPatch,
  onDelete,
}: {
  tag: Tag
  onPatch: (id: number, body: { name?: string; color?: string; hint?: string }) => Promise<boolean>
  onDelete: (tag: Tag) => void
}) {
  const [name, setName] = useState(tag.name)
  const [hint, setHint] = useState(tag.hint ?? '')
  const [colorsOpen, setColorsOpen] = useState(false)

  useEffect(() => setName(tag.name), [tag.name])
  useEffect(() => setHint(tag.hint ?? ''), [tag.hint])

  const saveName = async () => {
    const next = name.trim()
    if (next === tag.name) {
      setName(tag.name)
      return
    }
    if (next.length < 1 || next.length > 32) {
      notifyError(strings.tagNameInvalid)
      setName(tag.name)
      return
    }
    if (!(await onPatch(tag.id, { name: next }))) setName(tag.name)
  }

  const saveHint = async () => {
    const next = hint.trim()
    if (next === (tag.hint ?? '').trim()) return
    if (!(await onPatch(tag.id, { hint: next }))) setHint(tag.hint ?? '')
  }

  return (
    <li className="wou-tag-list-item">
      <div className="wou-tag-list-main">
        <button
          type="button"
          className={`wou-tag-swatch-btn ${tagColorClass(tag.color)}`}
          aria-label={strings.tagChangeColor(tag.name)}
          title={strings.tagChangeColor(tag.name)}
          aria-expanded={colorsOpen}
          onClick={() => setColorsOpen(v => !v)}
        />
        <input
          type="text"
          className="wou-tag-name-input"
          value={name}
          maxLength={32}
          aria-label={strings.tagRename(tag.name)}
          onChange={e => setName(e.target.value)}
          onBlur={() => void saveName()}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
            if (e.key === 'Escape') {
              setName(tag.name)
              e.currentTarget.blur()
            }
          }}
        />
        <span className="wou-muted wou-tag-open-count">{strings.tagOpenCount(tag.open_count ?? 0)}</span>
        <button type="button" className="wou-link wou-link-compact" onClick={() => onDelete(tag)}>
          {strings.tagDelete}
        </button>
      </div>
      {colorsOpen ? (
        <ColorSwatches
          value={tag.color}
          label={strings.tagColor}
          onChange={color => {
            setColorsOpen(false)
            if (color !== tag.color) void onPatch(tag.id, { color })
          }}
        />
      ) : null}
      <label className="wou-tag-hint-row">
        <span className="wou-muted wou-tag-hint-label">{strings.tagHintLabel}</span>
        <input
          type="text"
          value={hint}
          maxLength={200}
          placeholder={strings.tagHintPlaceholder}
          onChange={e => setHint(e.target.value)}
          onBlur={() => void saveHint()}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
        />
      </label>
    </li>
  )
}

const MODE_OPTIONS: { mode: WouMode; title: string; description: (sweep: number) => string }[] = [
  {
    mode: 'auto',
    title: strings.settingsModeAutoTitle,
    description: m => strings.settingsModeAutoDesc(m),
  },
  {
    mode: 'hourly',
    title: strings.settingsModeHourlyTitle,
    description: () => strings.settingsModeHourlyDesc,
  },
  {
    mode: 'manual',
    title: strings.settingsModeManualTitle,
    description: () => strings.settingsModeManualDesc,
  },
  {
    mode: 'off',
    title: strings.settingsModeOffTitle,
    description: () => strings.settingsModeOffDesc,
  },
]

function fieldErrorFromMessage(msg: string, key: SettingIntKey): string | null {
  if (msg.includes(key)) return msg
  return null
}

export function SettingsView({
  ctx,
  bundle,
  tags,
  onCreateTag,
  onPatchTag,
  onDeleteTag,
  onAddSuggestedTag,
  onBundleChange,
  onOpenTeach,
  onBack,
}: SettingsViewProps) {
  const [newTagOpen, setNewTagOpen] = useState(false)
  const [local, setLocal] = useState(bundle.settings)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SettingIntKey | 'mode', string>>>(
    {},
  )
  const [advancedOpen, setAdvancedOpen] = useState(() =>
    ctx.storage.get<boolean>(STORAGE_ADVANCED, false),
  )
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPatch = useRef<Partial<PluginSettings>>({})
  const ctxRef = useRef(ctx)
  const bundleRef = useRef(bundle)
  const onBundleChangeRef = useRef(onBundleChange)
  ctxRef.current = ctx
  bundleRef.current = bundle
  onBundleChangeRef.current = onBundleChange
  const [saver] = useState(() => createSettingsSaveQueue<PluginSettings>(
    async patch => (await patchSettings(ctxRef.current, patch)).settings,
  ))

  useEffect(() => {
    setLocal(saver.merge(bundle.settings))
  }, [bundle.settings, saver])

  const flushPatch = useCallback(async () => {
    const patch = { ...pendingPatch.current }
    pendingPatch.current = {}
    if (Object.keys(patch).length === 0) return
    try {
      const saved = await saver.save(patch)
      const settings = saver.merge(saved)
      const next = { ...bundleRef.current, settings }
      bundleRef.current = next
      onBundleChangeRef.current(next)
      setLocal(settings)
      setFieldErrors(prev => {
        const next = { ...prev }
        for (const key of Object.keys(patch)) delete next[key as keyof typeof next]
        return next
      })
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? strings.patchError
      const errors: Partial<Record<SettingIntKey | 'mode', string>> = {}
      for (const key of Object.keys(patch)) {
        const error = fieldErrorFromMessage(msg, key as SettingIntKey)
        if (error) errors[key as SettingIntKey] = error
      }
      if (Object.keys(errors).length === 0) notifyError(msg)
      else setFieldErrors(prev => ({ ...prev, ...errors }))
      // Keep the draft visible, but do not retry invalid or failed input in a loop.
    }
  }, [saver])
  const flushPatchRef = useRef(flushPatch)
  flushPatchRef.current = flushPatch

  const schedulePatch = useCallback((patch: Partial<PluginSettings>) => {
    saver.edit(patch)
    pendingPatch.current = { ...pendingPatch.current, ...patch }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      void flushPatchRef.current()
    }, DEBOUNCE_MS)
  }, [saver])

  const patchNow = useCallback((patch: Partial<PluginSettings>) => {
    saver.edit(patch)
    pendingPatch.current = { ...pendingPatch.current, ...patch }
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    void flushPatchRef.current()
  }, [saver])

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = null
    void flushPatchRef.current()
  }, [])

  const handleBack = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = null
    void flushPatchRef.current()
    onBack()
  }

  const groupBy = parseGroupBy(local.group_by, local.show_priorities)
  const setGroupBy = (value: GroupBy) => {
    setLocal(prev => ({ ...prev, group_by: value, show_priorities: value !== 'none' }))
    patchNow({ group_by: value })
  }

  const layout = parseLayout(local.layout)
  const setLayout = (value: ListLayout) => {
    setLocal(prev => ({ ...prev, layout: value }))
    patchNow({ layout: value })
  }

  const setMode = (mode: WouMode) => {
    setLocal(prev => ({ ...prev, mode }))
    setFieldErrors(prev => ({ ...prev, mode: undefined }))
    patchNow({ mode })
  }

  const setBool = (
    key:
      | 'archive_chat_on_done'
      | 'auto_tag'
      | 'name_after_chat'
      | 'show_project_badges'
      | 'follow_selected_chat'
      | 'decision_gate'
      | 'decision_priority',
    checked: boolean,
  ) => {
    setLocal(prev => ({ ...prev, [key]: checked }))
    patchNow({ [key]: checked })
  }

  // Number boxes keep what the person typed (even empty) while they edit, so
  // clearing the last digit works. Only valid values are saved; leaving the
  // box restores the saved value if what's left is not valid.
  const [intDrafts, setIntDrafts] = useState<Partial<Record<SettingIntKey, string>>>({})

  const onIntChange = (key: SettingIntKey, raw: string) => {
    setIntDrafts(prev => ({ ...prev, [key]: raw }))
    const err = validateSettingInt(key, raw)
    setFieldErrors(prev => ({ ...prev, [key]: err ?? undefined }))
    if (err) return
    const n = clampSettingInt(key, Number(raw))
    setLocal(prev => ({ ...prev, [key]: n }))
    schedulePatch({ [key]: n })
  }

  const onIntBlur = (key: SettingIntKey) => {
    setIntDrafts(prev => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
    setFieldErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  const intValue = (key: SettingIntKey): string => intDrafts[key] ?? String(local[key])

  // The note keeps its own draft so a save landing mid-typing does not undo keystrokes.
  const savedNote = local.priorities_note ?? ''
  const [noteDraft, setNoteDraft] = useState(savedNote)
  const noteFocused = useRef(false)
  useEffect(() => {
    if (!noteFocused.current) setNoteDraft(savedNote)
  }, [savedNote])
  const noteCounter = charCounter(noteDraft, PRIORITIES_NOTE_MAX)
  const onNoteChange = (value: string) => {
    setNoteDraft(value)
    if (charCounter(value, PRIORITIES_NOTE_MAX).over) return
    schedulePatch({ priorities_note: value })
  }
  const onNoteBlur = () => {
    noteFocused.current = false
    if (noteCounter.over) return
    if (noteDraft !== savedNote || 'priorities_note' in pendingPatch.current) {
      setLocal(prev => ({ ...prev, priorities_note: noteDraft }))
      patchNow({ priorities_note: noteDraft })
    }
  }

  const toggleAdvanced = () => {
    const next = !advancedOpen
    setAdvancedOpen(next)
    ctx.storage.set(STORAGE_ADVANCED, next)
  }

  const model: HermesModelInfo = bundle.model
  const today = bundle.usage.today
  const history: UsageDay[] = bundle.usage.history
  const cap = local.daily_call_cap
  const progress = todayChecksProgress(today.calls, cap)
  const maxHistoryCalls = Math.max(1, ...history.map(d => d.calls))

  return (
    <div className="wou-settings-view">
      <div className="wou-settings-view-header">
        <button type="button" className="wou-link wou-settings-back" onClick={handleBack}>
          {strings.settingsBack}
        </button>
        <h2 className="wou-settings-view-title">{strings.settings}</h2>
      </div>

      <div className="wou-settings-stack">
        <section className="wou-settings-card" aria-labelledby="wou-set-titles">
          <h3 id="wou-set-titles">{strings.settingsTaskTitlesSection}</h3>
          <div className="wou-settings-select-row">
            <div className="wou-settings-select-text">
              <span id="wou-set-layout-label" className="wou-settings-row-label">
                {strings.layoutLabel}
              </span>
              <span className="wou-muted wou-settings-row-desc">{strings.layoutHelp}</span>
            </div>
            <div className="wou-segmented" role="radiogroup" aria-labelledby="wou-set-layout-label">
              {LAYOUT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={layout === opt.value}
                  onClick={() => setLayout(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <Switch
            id="wou-set-name-after-chat"
            checked={local.name_after_chat}
            onChange={v => setBool('name_after_chat', v)}
            label={strings.nameAfterChat}
            description={strings.nameAfterChatHelp}
          />
          <div className="wou-settings-select-row">
            <div className="wou-settings-select-text">
              <span id="wou-set-group-by-label" className="wou-settings-row-label">
                {strings.groupByLabel}
              </span>
              <span className="wou-muted wou-settings-row-desc">{strings.groupByHelp}</span>
            </div>
            <div className="wou-segmented" role="radiogroup" aria-labelledby="wou-set-group-by-label">
              {GROUP_BY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={groupBy === opt.value}
                  onClick={() => setGroupBy(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <Switch
            id="wou-set-show-project-badges"
            checked={local.show_project_badges}
            onChange={v => setBool('show_project_badges', v)}
            label={strings.showProjectBadges}
            description={strings.showProjectBadgesHelp}
          />
          <Switch
            id="wou-set-follow-selected-chat"
            checked={local.follow_selected_chat}
            onChange={v => setBool('follow_selected_chat', v)}
            label={strings.followSelectedChat}
            description={strings.followSelectedChatHelp}
          />
          <Switch
            id="wou-set-archive-chat"
            checked={local.archive_chat_on_done}
            onChange={v => setBool('archive_chat_on_done', v)}
            label={strings.archiveChatOnDone}
            description={strings.archiveChatHelp}
          />
        </section>

        <section className="wou-settings-card" aria-labelledby="wou-set-priorities-note">
          <h3 id="wou-set-priorities-note">{strings.prioritiesNoteSection}</h3>
          <label className="wou-field">
            <span className="wou-muted">{strings.prioritiesNoteHelp}</span>
            <textarea
              value={noteDraft}
              rows={3}
              placeholder={strings.prioritiesNotePlaceholder}
              aria-label={strings.prioritiesNoteLabel}
              aria-invalid={noteCounter.over}
              onFocus={() => {
                noteFocused.current = true
              }}
              onChange={e => onNoteChange(e.target.value)}
              onBlur={onNoteBlur}
            />
            <span
              className={`wou-char-count${noteCounter.over ? ' wou-char-count-over' : ''}`}
              aria-live={noteCounter.near ? 'polite' : 'off'}
            >
              {noteCounter.label}
            </span>
            {noteCounter.over ? (
              <span className="wou-field-error" role="alert">{strings.prioritiesNoteTooLong}</span>
            ) : null}
          </label>
          <div className="wou-settings-inline-action">
            <button type="button" className="wou-btn-compact" onClick={onOpenTeach}>
              {strings.teachFromSettings}
            </button>
            <span className="wou-muted wou-settings-row-desc">{strings.teachFromSettingsHelp}</span>
          </div>
        </section>

        <section className="wou-settings-card" aria-labelledby="wou-set-decision">
          <h3 id="wou-set-decision">{strings.decisionSection}</h3>
          <p className="wou-muted wou-settings-empty wou-decision-intro">{strings.decisionIntro}</p>
          <DecisionModelControls ctx={ctx} />
          <Switch
            id="wou-set-decision-gate"
            checked={local.decision_gate ?? true}
            onChange={v => setBool('decision_gate', v)}
            label={strings.decisionGate}
            description={strings.decisionGateHelp}
          />
          <Switch
            id="wou-set-decision-priority"
            checked={local.decision_priority ?? true}
            onChange={v => setBool('decision_priority', v)}
            label={strings.decisionPriority}
            description={strings.decisionPriorityHelp}
          />
          <p className="wou-muted wou-settings-empty">{strings.decisionNeedsModel}</p>
        </section>

        <section className="wou-settings-card" aria-labelledby="wou-set-tags">
          <h3 id="wou-set-tags">{strings.tagsSection}</h3>
          <p className="wou-muted wou-settings-empty">{strings.tagsIntro}</p>
          <Switch
            id="wou-set-auto-tag"
            checked={local.auto_tag}
            onChange={v => setBool('auto_tag', v)}
            label={strings.autoTag}
            description={`${strings.autoTagHelp} ${strings.autoTagDecisionNote}`}
          />
          {tags.length === 0 ? (
            <p className="wou-muted wou-settings-empty">{strings.tagsEmpty}</p>
          ) : (
            <ul className="wou-tag-list">
              {tags.map(tag => (
                <TagSettingsRow key={tag.id} tag={tag} onPatch={onPatchTag} onDelete={onDeleteTag} />
              ))}
            </ul>
          )}
          <button type="button" className="wou-btn-compact" onClick={() => setNewTagOpen(true)}>
            {strings.tagAdd}
          </button>
          <NewTagDialog
            open={newTagOpen}
            onOpenChange={setNewTagOpen}
            createTag={onCreateTag}
          />
          <SuggestTagsPanel ctx={ctx} tags={tags} onAddTag={onAddSuggestedTag} />
        </section>

        <SatellitesSection ctx={ctx} />

        <section className="wou-settings-card" aria-labelledby="wou-set-shortcuts">
          <h3 id="wou-set-shortcuts">{strings.settingsShortcutsSection}</h3>
          <ul className="wou-shortcuts-list">
            {SETTINGS_SHORTCUT_ROWS.map(row => (
              <li key={row.id} className="wou-shortcuts-row">
                <span className="wou-shortcuts-label">{row.label}</span>
                <span className="wou-shortcuts-keys">
                  {row.display.kind === 'combo' ? (
                    comboToKeyCaps(row.display.combo).map((cap, i) => (
                      <kbd key={`${row.id}-${i}`} className="wou-keycap">{cap}</kbd>
                    ))
                  ) : (
                    <span className="wou-shortcuts-hint">{row.display.text}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="wou-muted wou-shortcuts-footer">{strings.settingsShortcutsFooter}</p>
        </section>

        <section className="wou-settings-card" aria-labelledby="wou-set-frequency">
          <h3 id="wou-set-frequency">{strings.settingsFrequencySection}</h3>
          <div className="wou-mode-cards" role="radiogroup" aria-label={strings.settingsFrequencySection}>
            {MODE_OPTIONS.map(opt => {
              const selected = local.mode === opt.mode
              return (
                <button
                  key={opt.mode}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`wou-mode-card${selected ? ' wou-mode-card-selected' : ''}`}
                  onClick={() => setMode(opt.mode)}
                >
                  <span className="wou-mode-card-title">{opt.title}</span>
                  <span className="wou-muted wou-mode-card-desc">
                    {opt.description(local.sweep_minutes)}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="wou-settings-card" aria-labelledby="wou-set-usage">
          <h3 id="wou-set-usage">{strings.settingsUsageSection}</h3>
          <p className="wou-settings-usage-line">{formatTodayChecksLine(today.calls, cap)}</p>
          {cap > 0 && today.calls > cap ? (
            <p className="wou-muted wou-settings-usage-over">
              {strings.settingsUsageOver(today.manual_calls ?? 0)}
            </p>
          ) : null}
          {cap > 0 ? (
            <div
              className="wou-usage-bar"
              role="progressbar"
              aria-valuenow={today.calls}
              aria-valuemin={0}
              aria-valuemax={cap}
              aria-label={formatTodayChecksLine(today.calls, cap)}
            >
              <div
                className="wou-usage-bar-fill"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          ) : null}
          <ul className="wou-usage-bars" aria-label={strings.settingsUsageHistory}>
            {history.map(day => (
              <li key={day.date} title={day.date}>
                <span className="wou-usage-bar-mini" aria-hidden="true">
                  <span
                    className="wou-usage-bar-mini-fill"
                    style={{ height: `${Math.round((day.calls / maxHistoryCalls) * 100)}%` }}
                  />
                </span>
                <span className="wou-muted wou-usage-bar-day">{day.date.slice(5)}</span>
              </li>
            ))}
          </ul>
          <p className="wou-muted wou-settings-model-line">
            {strings.settingsUsageModel(model.label)}
          </p>
        </section>

        <section className="wou-settings-card wou-settings-advanced">
          <button
            type="button"
            className="wou-settings-advanced-toggle"
            aria-expanded={advancedOpen}
            onClick={toggleAdvanced}
          >
            <span className="wou-settings-advanced-chevron" aria-hidden="true">
              {advancedOpen ? '▾' : '▸'}
            </span>
            {strings.settingsAdvanced}
          </button>
          {advancedOpen ? (
            <div className="wou-settings-advanced-body">
              {settingsFieldVisible('sweep_minutes', local.mode) ? (
                <label className="wou-field">
                  <span className="wou-field-label">{strings.settingsSweep}</span>
                  <input
                    type="number"
                    min={15}
                    max={240}
                    value={intValue('sweep_minutes')}
                    onBlur={() => onIntBlur('sweep_minutes')}
                    onChange={e => onIntChange('sweep_minutes', e.target.value)}
                    aria-label={strings.settingsSweep}
                    aria-invalid={Boolean(fieldErrors.sweep_minutes)}
                  />
                  {fieldErrors.sweep_minutes ? (
                    <span className="wou-field-error" role="alert">{fieldErrors.sweep_minutes}</span>
                  ) : null}
                </label>
              ) : null}
              {settingsFieldVisible('debounce_seconds', local.mode) ? (
                <label className="wou-field">
                  <span className="wou-field-label">{strings.settingsDebounce}</span>
                  <input
                    type="number"
                    min={30}
                    max={600}
                    value={intValue('debounce_seconds')}
                    onBlur={() => onIntBlur('debounce_seconds')}
                    onChange={e => onIntChange('debounce_seconds', e.target.value)}
                    aria-label={strings.settingsDebounce}
                    aria-invalid={Boolean(fieldErrors.debounce_seconds)}
                  />
                  {fieldErrors.debounce_seconds ? (
                    <span className="wou-field-error" role="alert">{fieldErrors.debounce_seconds}</span>
                  ) : null}
                </label>
              ) : null}
              {settingsFieldVisible('max_chats_per_scan', local.mode) ? (
                <label className="wou-field">
                  <span className="wou-field-label">{strings.settingsMaxChats}</span>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={intValue('max_chats_per_scan')}
                    onBlur={() => onIntBlur('max_chats_per_scan')}
                    onChange={e => onIntChange('max_chats_per_scan', e.target.value)}
                    aria-label={strings.settingsMaxChats}
                    aria-invalid={Boolean(fieldErrors.max_chats_per_scan)}
                  />
                  {fieldErrors.max_chats_per_scan ? (
                    <span className="wou-field-error" role="alert">{fieldErrors.max_chats_per_scan}</span>
                  ) : null}
                </label>
              ) : null}
              <label className="wou-field">
                <span className="wou-field-label">{strings.settingsDailyCap}</span>
                <input
                  type="number"
                  min={0}
                  max={2000}
                  value={intValue('daily_call_cap')}
                  onBlur={() => onIntBlur('daily_call_cap')}
                  onChange={e => onIntChange('daily_call_cap', e.target.value)}
                  aria-label={strings.settingsDailyCap}
                  aria-invalid={Boolean(fieldErrors.daily_call_cap)}
                />
                <span className="wou-muted">{strings.settingsDailyCapHint}</span>
                {fieldErrors.daily_call_cap ? (
                  <span className="wou-field-error" role="alert">{fieldErrors.daily_call_cap}</span>
                ) : null}
              </label>
              <label className="wou-field">
                <span className="wou-field-label">{strings.settingsLookback}</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={intValue('lookback_days')}
                  onBlur={() => onIntBlur('lookback_days')}
                  onChange={e => onIntChange('lookback_days', e.target.value)}
                  aria-label={strings.settingsLookback}
                  aria-invalid={Boolean(fieldErrors.lookback_days)}
                />
                {fieldErrors.lookback_days ? (
                  <span className="wou-field-error" role="alert">{fieldErrors.lookback_days}</span>
                ) : null}
              </label>
              <label className="wou-field">
                <span className="wou-field-label">{strings.settingsRetention}</span>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={intValue('retention_days')}
                  onBlur={() => onIntBlur('retention_days')}
                  onChange={e => onIntChange('retention_days', e.target.value)}
                  aria-label={strings.settingsRetention}
                  aria-invalid={Boolean(fieldErrors.retention_days)}
                />
                <span className="wou-muted">{strings.settingsRetentionHint}</span>
                {fieldErrors.retention_days ? (
                  <span className="wou-field-error" role="alert">{fieldErrors.retention_days}</span>
                ) : null}
              </label>
              <div className="wou-field">
                <span className="wou-field-label">{strings.settingsModel}</span>
                <p className="wou-field-readonly">{model.label}</p>
                <p className="wou-muted">{strings.settingsModelHint}</p>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
