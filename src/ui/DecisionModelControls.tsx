import type { PluginContext } from '@hermes/plugin-sdk'
import { useCallback, useEffect, useRef, useState } from 'react'
import { mergeDecisionDrafts, type TextKey } from './decisionDrafts'
import {
  fetchDecision,
  patchDecision,
  testDecision,
  type DecisionInfo,
  type DecisionPatch,
} from './api'
import { decisionTestMessage } from './priorityHelpers'
import { restErrorFields } from './sessionApi'
import { strings } from './strings'

interface DecisionModelControlsProps {
  ctx: PluginContext
  /** First-run: hide usage and the last problem line. */
  compact?: boolean
}


export function DecisionModelControls({ ctx, compact }: DecisionModelControlsProps) {
  const [info, setInfo] = useState<DecisionInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<TextKey, string>>({
    model: '',
    base_url: '',
    cloudflare_account_id: '',
  })
  const sequence = useRef(0)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)

  const applyInfo = useCallback(
    (next: DecisionInfo) => {
      setInfo(next)
      setDrafts({
        model: next.model,
        base_url: next.base_url,
        cloudflare_account_id: next.cloudflare_account_id,
      })
    },
    [],
  )

  const load = useCallback(async () => {
    try {
      applyInfo(await fetchDecision(ctx))
      setLoadError(null)
    } catch (e) {
      setLoadError(restErrorFields(e).error || strings.decisionLoadError)
    }
  }, [ctx, applyInfo])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (patch: DecisionPatch) => {
    const request = ++sequence.current
    const sent = { ...drafts }
    const baseline = info ? { model: info.model, base_url: info.base_url, cloudflare_account_id: info.cloudflare_account_id } : sent
    setSaveError(null)
    setTestResult(null)
    try {
      const next = await patchDecision(ctx, patch)
      if (request !== sequence.current) return
      setInfo(next)
      setDrafts(current => mergeDecisionDrafts(current, sent, baseline, patch, next, request, sequence.current))
    } catch (e) {
      if (request === sequence.current) setSaveError(restErrorFields(e).error || strings.decisionSaveError)
    }
  }

  if (!info) {
    return loadError ? (
      <p className="wou-muted" role="alert">
        {loadError}{' '}
        <button type="button" className="wou-link" onClick={() => void load()}>
          {strings.retry}
        </button>
      </p>
    ) : (
      <p className="wou-muted" role="status">{strings.settingsLoading}</p>
    )
  }

  const provider = info.providers.find(p => p.id === info.provider) ?? null

  const onProviderChange = (id: string) => {
    if (id === info.provider) return
    const next = info.providers.find(p => p.id === id)
    void save(next ? { provider: id, model: next.default_model } : { provider: '' })
  }

  const saveText = (key: TextKey) => {
    const value = drafts[key].trim()
    if (value === info[key]) return
    void save({ [key]: value })
  }

  const textField = (key: TextKey, label: string, placeholder?: string) => (
    <label className="wou-field">
      <span className="wou-field-label">{label}</span>
      <input
        type="text"
        value={drafts[key]}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={e => setDrafts(prev => ({ ...prev, [key]: e.target.value }))}
        onBlur={() => saveText(key)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
      />
    </label>
  )

  const runTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await testDecision(ctx)
      setTestResult({ ok: res.ok, text: decisionTestMessage(res) })
    } catch (e) {
      setTestResult({ ok: false, text: restErrorFields(e).error || strings.decisionTestFailedPlain })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="wou-decision">
      {info.native_available ? <p className="wou-decision-native">{strings.decisionNative}</p> : null}
      <label className="wou-field">
        <span className="wou-field-label">{strings.decisionProvider}</span>
        <select value={info.provider} onChange={e => onProviderChange(e.target.value)}>
          <option value="">{strings.decisionProviderOff}</option>
          {info.providers.map(p => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {provider?.note ? <span className="wou-muted">{provider.note}</span> : null}
      </label>
      {provider ? (
        <>
          {textField('model', strings.decisionModel, provider.default_model)}
          {provider.needs_base_url ? textField('base_url', strings.decisionBaseUrl, 'https://') : null}
          {provider.needs_account_id ? textField('cloudflare_account_id', strings.decisionAccountId) : null}
          {provider.needs_key ? (
            <p className="wou-decision-key">
              <span className={info.key_set ? 'wou-decision-key-ok' : 'wou-decision-key-missing'}>
                {info.key_set ? strings.decisionKeySaved : strings.decisionKeyNotSet}
              </span>
              {info.key_set ? null : (
                <span className="wou-muted">
                  {' '}
                  {strings.decisionKeyWhere(strings.decisionKeyPath, info.key_name)}
                </span>
              )}
            </p>
          ) : null}
        </>
      ) : null}
      {saveError ? (
        <p className="wou-field-error" role="alert">{saveError}</p>
      ) : null}
      {provider || info.native_available ? (
        <div className="wou-decision-test">
          <button
            type="button"
            className="wou-btn-compact"
            onClick={() => void runTest()}
            disabled={testing}
            aria-busy={testing}
          >
            {testing ? strings.decisionTesting : strings.decisionTest}
          </button>
          {testResult ? (
            <span
              className={testResult.ok ? 'wou-decision-test-ok' : 'wou-decision-test-fail'}
              role="status"
            >
              {testResult.text}
            </span>
          ) : null}
        </div>
      ) : null}
      {!compact ? (
        <>
          <p className="wou-muted wou-decision-usage">
            {strings.decisionUsageToday(info.usage_today.calls, info.usage_today.input_tokens)}
          </p>
          {info.last_error ? (
            <p className="wou-muted wou-decision-usage">{strings.decisionLastError(info.last_error)}</p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
