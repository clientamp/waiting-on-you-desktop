import type { PluginContext } from '@hermes/plugin-sdk'
import { useCallback, useEffect, useState } from 'react'
import {
  createPairCode,
  fetchSatellites,
  fetchSatelliteStatus,
  revokeSatellite,
  type Satellite,
  type SatelliteStatus,
} from './api'
import { strings } from './strings'
import {
  SATELLITE_NAME_RE,
  satelliteDisplayName,
  satelliteStatusText,
  shouldWarnHttpPublicHubAddress,
} from './satelliteHelpers'

const HUB_ADDRESS_KEY = 'wou.hubAddress'
const REFRESH_MS = 60_000

function readHubAddress(): string {
  try {
    return localStorage.getItem(HUB_ADDRESS_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveHubAddress(value: string): void {
  try {
    localStorage.setItem(HUB_ADDRESS_KEY, value)
  } catch {
    /* ignore */
  }
}

function pairCommand(hubAddress: string, code: string): string {
  return `hermes waiting-on-you-satellite pair ${hubAddress.trim()} ${code}`
}

function pairErrorMessage(e: unknown): string {
  const msg =
    e && typeof e === 'object' && 'message' in e
      ? String((e as { message: string }).message)
      : ''
  const lower = msg.toLowerCase()
  if (lower.includes('invalid satellite name') || lower.includes('name already in use')) {
    return strings.satellitesPairErrorName
  }
  if (lower.includes('too many active pairing codes')) {
    return strings.satellitesPairErrorTooMany
  }
  if (msg) return msg
  return strings.satellitesPairErrorGeneric
}

interface SatellitesSectionProps {
  ctx: PluginContext
}

export function SatellitesSection({ ctx }: SatellitesSectionProps) {
  const [status, setStatus] = useState<SatelliteStatus | null>(null)
  const [satellites, setSatellites] = useState<Satellite[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [agentName, setAgentName] = useState('')
  const [connectionName, setConnectionName] = useState('')
  const [hubAddress, setHubAddress] = useState(() => readHubAddress())
  const [nameError, setNameError] = useState<string | null>(null)
  const [hubError, setHubError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pairResult, setPairResult] = useState<{ command: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))

  const refresh = useCallback(async () => {
    try {
      const [st, sats] = await Promise.all([
        fetchSatelliteStatus(ctx),
        fetchSatellites(ctx),
      ])
      setStatus(st)
      setSatellites(sats.filter(s => s.revoked_at == null))
      setLoadError(null)
    } catch {
      setLoadError(strings.satellitesLoadError)
    }
  }, [ctx])

  useEffect(() => {
    void refresh()
    const refreshTimer = setInterval(() => void refresh(), REFRESH_MS)
    const clockTimer = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 30_000)
    return () => {
      clearInterval(refreshTimer)
      clearInterval(clockTimer)
    }
  }, [refresh])

  const enabled = status?.enabled ?? false
  const httpWarning = shouldWarnHttpPublicHubAddress(hubAddress)

  const openForm = () => {
    setFormOpen(true)
    setPairResult(null)
    setSubmitError(null)
    setNameError(null)
    setHubError(null)
  }

  const closeForm = () => {
    setFormOpen(false)
    setPairResult(null)
    setSubmitError(null)
    setNameError(null)
    setHubError(null)
  }

  const onSubmitPair = async () => {
    const trimmedName = name.trim().toLowerCase()
    const trimmedHub = hubAddress.trim()
    let valid = true
    if (!SATELLITE_NAME_RE.test(trimmedName)) {
      setNameError(strings.satellitesNameInvalid)
      valid = false
    } else {
      setNameError(null)
    }
    if (!trimmedHub) {
      setHubError(strings.satellitesHubRequired)
      valid = false
    } else {
      setHubError(null)
    }
    if (!valid) return

    saveHubAddress(trimmedHub)
    setSubmitting(true)
    setSubmitError(null)
    try {
      const body: {
        name: string
        agent_name?: string
        connections?: string[]
      } = { name: trimmedName }
      const agent = agentName.trim()
      if (agent) body.agent_name = agent
      const conn = connectionName.trim()
      if (conn) body.connections = [conn]
      const res = await createPairCode(ctx, body)
      setPairResult({ command: pairCommand(trimmedHub, res.code) })
      await refresh()
    } catch (e: unknown) {
      setSubmitError(pairErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const onRemove = async (sat: Satellite) => {
    const label = satelliteDisplayName(sat)
    if (!window.confirm(strings.satellitesRemoveConfirm(label))) return
    try {
      await revokeSatellite(ctx, sat.id)
      await refresh()
    } catch {
      setLoadError(strings.satellitesRevokeError)
    }
  }

  const copyCommand = async (text: string) => {
    try {
      const ok = await ctx.os.writeClipboard(text)
      if (!ok && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      }
    } catch {
      try {
        await navigator.clipboard?.writeText(text)
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <section className="wou-settings-card" aria-labelledby="wou-set-satellites">
      <h3 id="wou-set-satellites">{strings.settingsSatellitesSection}</h3>
      <p className="wou-muted wou-satellites-intro">{strings.satellitesIntro}</p>
      {status && !enabled ? (
        <p className="wou-muted wou-satellites-warn-line" role="status">
          {strings.satellitesDisabled(status.reason)}
        </p>
      ) : null}
      {loadError ? (
        <p className="wou-field-error" role="alert">{loadError}</p>
      ) : null}
      {satellites.length === 0 ? (
        <p className="wou-muted wou-settings-empty">{strings.satellitesEmpty}</p>
      ) : (
        <ul className="wou-satellite-list">
          {satellites.map(sat => {
            const line = satelliteStatusText(sat, nowSec)
            return (
              <li key={sat.id} className="wou-satellite-list-item">
                <span className="wou-satellite-list-name">{satelliteDisplayName(sat)}</span>
                <span
                  className={`wou-muted wou-satellite-list-status${line.warn ? ' wou-satellite-status-warn' : ''}`}
                >
                  {line.text}
                </span>
                <button
                  type="button"
                  className="wou-link wou-link-compact"
                  onClick={() => void onRemove(sat)}
                >
                  {strings.satellitesRemove}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {enabled && !formOpen && !pairResult ? (
        <button type="button" className="wou-btn-compact" onClick={openForm}>
          {strings.satellitesAdd}
        </button>
      ) : null}
      {enabled && formOpen ? (
        <div className="wou-satellite-form">
          {pairResult ? (
            <div className="wou-satellite-pair-result">
              <pre className="wou-satellite-command">{pairResult.command}</pre>
              <button
                type="button"
                className="wou-btn-compact"
                onClick={() => void copyCommand(pairResult.command)}
              >
                {strings.satellitesCopyCommand}
              </button>
              <p className="wou-muted">{strings.satellitesCodeExpiry}</p>
              <ol className="wou-satellite-steps">
                <li>{strings.satellitesPairStep1}</li>
                <li>
                  <code>hermes plugins enable waiting-on-you-satellite</code>
                </li>
                <li>{strings.satellitesPairStep3}</li>
                <li>{strings.satellitesPairStep4}</li>
              </ol>
              <button type="button" className="wou-link" onClick={closeForm}>
                {strings.satellitesCancel}
              </button>
            </div>
          ) : (
            <>
              <label className="wou-field">
                <span className="wou-field-label">{strings.satellitesName}</span>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={Boolean(nameError)}
                />
                <span className="wou-muted">{strings.satellitesNameHint}</span>
                {nameError ? (
                  <span className="wou-field-error" role="alert">{nameError}</span>
                ) : null}
              </label>
              <label className="wou-field">
                <span className="wou-field-label">{strings.satellitesAgentName}</span>
                <input
                  type="text"
                  value={agentName}
                  onChange={e => setAgentName(e.target.value)}
                  autoComplete="off"
                />
                <span className="wou-muted">{strings.satellitesAgentHint}</span>
              </label>
              <label className="wou-field">
                <span className="wou-field-label">{strings.satellitesConnection}</span>
                <input
                  type="text"
                  value={connectionName}
                  onChange={e => setConnectionName(e.target.value)}
                  autoComplete="off"
                />
                <span className="wou-muted">{strings.satellitesConnectionHint}</span>
              </label>
              <label className="wou-field">
                <span className="wou-field-label">{strings.satellitesHubAddress}</span>
                <input
                  type="text"
                  value={hubAddress}
                  onChange={e => setHubAddress(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={Boolean(hubError)}
                />
                <span className="wou-muted">{strings.satellitesHubAddressHint}</span>
                {httpWarning ? (
                  <span className="wou-satellite-status-warn" role="status">
                    {strings.satellitesHttpPublicWarning}
                  </span>
                ) : null}
                {hubError ? <span className="wou-field-error" role="alert">{hubError}</span> : null}
              </label>
              {submitError ? (
                <p className="wou-field-error" role="alert">{submitError}</p>
              ) : null}
              <div className="wou-satellite-form-actions">
                <button
                  type="button"
                  className="wou-btn-compact"
                  disabled={submitting}
                  onClick={() => void onSubmitPair()}
                >
                  {strings.satellitesCreateCode}
                </button>
                <button type="button" className="wou-link" onClick={closeForm}>
                  {strings.satellitesCancel}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  )
}
