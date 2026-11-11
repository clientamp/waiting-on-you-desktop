/** Pure helpers for hub Settings satellite UI (unit-tested). */

import { strings } from './strings'

export interface SatelliteForStatus {
  name: string
  agent_name: string
  last_seen: number | null
}

export interface SatelliteStatusLine {
  text: string
  warn: boolean
}

const FIFTEEN_MIN = 15 * 60
const ONE_DAY = 24 * 60 * 60

export function satelliteDisplayName(sat: { name: string; agent_name: string }): string {
  const agent = (sat.agent_name || '').trim()
  return agent || sat.name
}

export function satelliteStatusText(sat: SatelliteForStatus, nowSec: number): SatelliteStatusLine {
  if (sat.last_seen == null || !Number.isFinite(sat.last_seen)) {
    return { text: strings.satellitesStatusWaiting, warn: false }
  }
  const ageSec = Math.max(0, nowSec - sat.last_seen)
  if (ageSec < FIFTEEN_MIN) {
    let updated: string
    if (ageSec < 60) {
      updated = strings.satellitesStatusUpdatedJustNow
    } else {
      const min = Math.floor(ageSec / 60)
      updated = strings.satellitesStatusUpdatedMin(min)
    }
    return { text: strings.satellitesStatusSending(updated), warn: false }
  }
  if (ageSec < ONE_DAY) {
    const hours = Math.floor(ageSec / 3600)
    const h = hours < 1 ? 1 : hours
    return { text: strings.satellitesStatusLastHours(h), warn: false }
  }
  const days = Math.floor(ageSec / ONE_DAY)
  const d = days < 1 ? 1 : days
  return { text: strings.satellitesStatusLastDays(d), warn: true }
}

function parseIpv4(host: string): number[] | null {
  const parts = host.split('.')
  if (parts.length !== 4) return null
  const nums: number[] = []
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const n = Number(p)
    if (n > 255) return null
    nums.push(n)
  }
  return nums
}

/** Host allowed for plain http (localhost, .local, private/link-local/CGNAT IPs). */
export function isPrivateOrLocalHubHost(host: string): boolean {
  const h = host.trim().toLowerCase()
  if (!h) return false
  if (h === 'localhost') return true
  if (h.endsWith('.local')) return true
  const v4 = parseIpv4(h)
  if (v4) {
    const [a, b] = v4
    if (a === 127) return true
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    return false
  }
  if (h === '::1') return true
  if (h.startsWith('fc') || h.startsWith('fd')) return true
  if (h.startsWith('fe80')) return true
  return false
}

/** True when the hub URL uses http and the host is not private/local. */
export function shouldWarnHttpPublicHubAddress(hubAddress: string): boolean {
  const trimmed = hubAddress.trim()
  if (!/^http:\/\//i.test(trimmed)) return false
  try {
    const host = new URL(trimmed).hostname
    if (!host) return true
    return !isPrivateOrLocalHubHost(host)
  } catch {
    return false
  }
}

export const SATELLITE_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/
