/** Turn backend scan notes into short "machine offline" lines (unit-tested). */

import { strings } from './strings'

export interface OfflineMachine {
  name: string
  since: string | null
}

// Matches collect.run_remote notes:
//   "<name> unreachable (<err>); using <name> list cached <when>"
//   "<name> unreachable (<err>); no <name> cache yet"
// The scanner cuts notes at 200 characters, so only the prefix is required;
// a cut-off note still warns, just without the date.
const UNREACHABLE_RE = /^(\S+) unreachable \(/
const CACHED_RE = /; using \S+ list cached (.+)$/

export function offlineMachines(
  errors: readonly string[] | undefined,
  agentNames: Readonly<Record<string, string>> = {},
): OfflineMachine[] {
  const out: OfflineMachine[] = []
  const seen = new Set<string>()
  for (const raw of errors ?? []) {
    const text = String(raw).trim()
    const m = UNREACHABLE_RE.exec(text)
    if (!m) continue
    const cached = CACHED_RE.exec(text)
    const key = m[1].toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const display = agentNames[key] ?? m[1].charAt(0).toUpperCase() + m[1].slice(1)
    out.push({ name: display, since: cached?.[1]?.trim() || null })
  }
  return out
}

export interface StorageLabelWarning {
  /** Display name, or null for the main profile (no name needed). */
  name: string | null
  count: number
  label: string
}

// Only the stable prefix is needed when the scanner clips the note.
const STORAGE_LABEL_RE = /^(\S+): ([1-9]\d*) recent (?:chat uses|chats use) storage label "([A-Za-z0-9_.-]{1,32})"/

export function storageLabelWarnings(
  errors: readonly string[] | undefined,
  agentNames: Readonly<Record<string, string>> = {},
): StorageLabelWarning[] {
  const out: StorageLabelWarning[] = []
  const seen = new Set<string>()
  for (const raw of errors ?? []) {
    const m = STORAGE_LABEL_RE.exec(String(raw).trim())
    if (!m) continue
    const key = m[1].toLowerCase()
    const count = Number(m[2])
    if (seen.has(key) || !Number.isSafeInteger(count)) continue
    seen.add(key)
    const name = agentNames[key] ?? (key === 'default' ? null : m[1].charAt(0).toUpperCase() + m[1].slice(1))
    out.push({ name, count, label: m[3] })
  }
  return out
}

export function storageLabelWarningLine(warning: StorageLabelWarning): string {
  return strings.storageLabelWarning(warning.name, warning.count, warning.label)
}

export function scanClassificationFailureLine(
  summary: { succeeded?: number; failed?: number; model_unreachable?: boolean; errors?: readonly string[]; classification_errors?: readonly string[] },
): string | null {
  const failed = summary.failed ?? 0
  if (summary.model_unreachable || (summary.succeeded === 0 && failed > 0)) return strings.scanModelUnreachable
  if (failed <= 0) return null
  const first = (summary.classification_errors?.[0] ?? summary.errors?.[0])?.trim()
  const reason = first ? first.slice(0, 120) : 'unknown error'
  return strings.scanSomeChatsFailed(reason)
}

export function offlineLine(machine: OfflineMachine): string {
  return machine.since
    ? strings.machineOfflineCached(machine.name, machine.since)
    : strings.machineOfflineNoCache(machine.name)
}
