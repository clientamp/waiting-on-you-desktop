/** Pure helpers for Teach priorities, the decision model section, and tag suggestions. */
import { normalizeTagColor } from '../model'
import { strings } from './strings'

export type Quadrant = 1 | 2 | 3 | 4

export const QUIZ_BATCH = 10
export const PRIORITIES_NOTE_MAX = 1000

export interface QuizItem {
  id: number
  ask: string
  context: string | null
  chat_title: string
  agent: string
  project: string | null
  quadrant: Quadrant
  due_at: number | null
}

export function isQuadrant(value: unknown): value is Quadrant {
  return value === 1 || value === 2 || value === 3 || value === 4
}

/** Keep only well-formed quiz rows; the list is shown in the order the server sent it. */
export function parseQuizItems(raw: unknown): QuizItem[] {
  const list = (raw as { tasks?: unknown } | null)?.tasks
  if (!Array.isArray(list)) return []
  const out: QuizItem[] = []
  for (const row of list) {
    const r = row as Record<string, unknown>
    if (typeof r?.id !== 'number' || typeof r.ask !== 'string') continue
    out.push({
      id: r.id,
      ask: r.ask,
      context: typeof r.context === 'string' && r.context.trim() ? r.context : null,
      chat_title: typeof r.chat_title === 'string' ? r.chat_title : '',
      agent: typeof r.agent === 'string' ? r.agent : '',
      project: typeof r.project === 'string' && r.project ? r.project : null,
      quadrant: isQuadrant(r.quadrant) ? r.quadrant : 4,
      due_at: typeof r.due_at === 'number' ? r.due_at : null,
    })
  }
  return out
}

export type QuizStatus = 'loading' | 'ready' | 'error' | 'done' | 'empty'

export interface QuizState {
  status: QuizStatus
  items: QuizItem[]
  index: number
  /** Answers given in this run (skips do not count). */
  sorted: number
  /** Set while an answer or skip is being saved. */
  busy: boolean
  /** Inline error. With status 'ready' it is a save error on the current task. */
  error: string | null
  /** Whether another batch is waiting after 'done'. null = not checked yet. */
  moreAvailable: boolean | null
}

export type QuizAction =
  | { type: 'load' }
  | { type: 'loaded'; items: QuizItem[] }
  | { type: 'loadFailed'; error: string }
  | { type: 'submit' }
  | { type: 'answered' }
  | { type: 'skipped' }
  /** The task closed before the answer landed: move on without counting it. */
  | { type: 'gone' }
  | { type: 'submitFailed'; error: string }
  | { type: 'more'; available: boolean }

export const initialQuizState: QuizState = {
  status: 'loading',
  items: [],
  index: 0,
  sorted: 0,
  busy: false,
  error: null,
  moreAvailable: null,
}

function advance(state: QuizState, counted: boolean): QuizState {
  const sorted = state.sorted + (counted ? 1 : 0)
  const index = state.index + 1
  if (index >= state.items.length) {
    return { ...state, index, sorted, busy: false, error: null, status: 'done', moreAvailable: null }
  }
  return { ...state, index, sorted, busy: false, error: null }
}

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'load':
      return { ...state, status: 'loading', busy: false, error: null }
    case 'loaded':
      if (action.items.length === 0) {
        // Nothing (more) to sort. After a run, keep the summary on screen.
        return state.sorted > 0
          ? { ...state, status: 'done', items: [], index: 0, busy: false, error: null, moreAvailable: false }
          : { ...initialQuizState, status: 'empty' }
      }
      return { ...state, status: 'ready', items: action.items, index: 0, busy: false, error: null, moreAvailable: null }
    case 'loadFailed':
      return { ...state, status: 'error', busy: false, error: action.error }
    case 'submit':
      if (state.status !== 'ready' || state.busy) return state
      return { ...state, busy: true, error: null }
    case 'answered':
      return state.status === 'ready' ? advance(state, true) : state
    case 'skipped':
    case 'gone':
      return state.status === 'ready' ? advance(state, false) : state
    case 'submitFailed':
      return { ...state, busy: false, error: action.error }
    case 'more':
      return state.status === 'done' ? { ...state, moreAvailable: action.available } : state
    default:
      return state
  }
}

export function currentQuizItem(state: QuizState): QuizItem | null {
  if (state.status !== 'ready') return null
  return state.items[state.index] ?? null
}

export function quizProgressLabel(state: QuizState): string {
  return strings.teachProgress(Math.min(state.index + 1, state.items.length), state.items.length)
}

export const QUADRANT_CHOICES: { quadrant: Quadrant; label: string; hint: string }[] = [
  { quadrant: 1, label: strings.teachQuadrant1, hint: strings.teachQuadrant1Hint },
  { quadrant: 2, label: strings.teachQuadrant2, hint: strings.teachQuadrant2Hint },
  { quadrant: 3, label: strings.teachQuadrant3, hint: strings.teachQuadrant3Hint },
  { quadrant: 4, label: strings.teachQuadrant4, hint: strings.teachQuadrant4Hint },
]

export function quadrantPlainName(q: number): string {
  return QUADRANT_CHOICES.find(c => c.quadrant === q)?.label ?? strings.teachQuadrant4
}

export function filedAsLabel(q: number): string {
  return strings.teachFiledAs(quadrantPlainName(q))
}

export type QuizKey = Quadrant | 'skip' | null

/** Keyboard: 1-4 answer, S skips. Modifier combos are left alone. */
export function quizKeyAction(e: {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
}): QuizKey {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') return Number(e.key) as Quadrant
  if (e.key === 's' || e.key === 'S') return 'skip'
  return null
}

/** Line under the ask: chat title · agent · project, skipping blanks. */
export function quizMetaLine(item: Pick<QuizItem, 'chat_title' | 'agent' | 'project'>): string {
  return [item.chat_title, item.agent, item.project]
    .map(s => (s ?? '').trim())
    .filter(Boolean)
    .join(' · ')
}

// ---- Decision model ----

export interface DecisionTestResult {
  ok: boolean
  code: string | null
  latency_ms: number | null
  model: string | null
}

export function decisionTestMessage(result: DecisionTestResult): string {
  if (result.ok) {
    return result.latency_ms != null && Number.isFinite(result.latency_ms)
      ? strings.decisionTestOk(Math.round(result.latency_ms))
      : strings.decisionTestOkNoTime
  }
  return decisionErrorMessage(result.code)
}

export function decisionErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case 'http_401':
    case 'http_403':
      return strings.decisionErr401
    case 'http_429':
      return strings.decisionErr429
    case 'timeout':
      return strings.decisionErrTimeout
    case 'not_configured':
      return strings.decisionErrNotConfigured
    case null:
    case undefined:
    case '':
      return strings.decisionTestFailedPlain
    default:
      return strings.decisionTestFailed(code)
  }
}

// ---- Character counter ----

export function charCounter(text: string, max: number): { label: string; over: boolean; near: boolean } {
  const n = [...text].length
  return {
    label: strings.charCount(n, max),
    over: n > max,
    near: n >= Math.floor(max * 0.9),
  }
}

// ---- Tag suggestions ----

export interface TagSuggestion {
  name: string
  color: string
  hint: string
  example_count: number
}

export type SuggestionStatus = 'pending' | 'adding' | 'added' | 'skipped'

export interface SuggestionRow {
  key: string
  name: string
  color: string
  hint: string
  example_count: number
  status: SuggestionStatus
  error: string | null
}

function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase()
}

export function parseSuggestions(raw: unknown): TagSuggestion[] {
  const list = (raw as { suggestions?: unknown } | null)?.suggestions
  if (!Array.isArray(list)) return []
  const out: TagSuggestion[] = []
  for (const row of list) {
    const r = row as Record<string, unknown>
    if (typeof r?.name !== 'string' || !r.name.trim()) continue
    out.push({
      name: r.name.trim().slice(0, 32),
      color: normalizeTagColor(typeof r.color === 'string' ? r.color : null),
      hint: typeof r.hint === 'string' ? r.hint.trim().slice(0, 200) : '',
      example_count: typeof r.example_count === 'number' ? r.example_count : 0,
    })
  }
  return out
}

/** Rows to review: drops names you already have and repeats (case-insensitive). */
export function initSuggestionRows(
  suggestions: TagSuggestion[],
  existingNames: Iterable<string>,
): SuggestionRow[] {
  const seen = new Set<string>()
  for (const n of existingNames) seen.add(nameKey(n))
  const rows: SuggestionRow[] = []
  for (const s of suggestions) {
    const k = nameKey(s.name)
    if (!k || seen.has(k)) continue
    seen.add(k)
    rows.push({ key: `${rows.length}:${k}`, ...s, status: 'pending', error: null })
  }
  return rows
}

export function validateTagName(name: string): string | null {
  const n = name.trim().length
  return n < 1 || n > 32 ? strings.tagNameInvalid : null
}

export function editSuggestionName(rows: SuggestionRow[], key: string, name: string): SuggestionRow[] {
  return rows.map(r => (r.key === key ? { ...r, name, error: null } : r))
}

export function setSuggestionStatus(
  rows: SuggestionRow[],
  key: string,
  status: SuggestionStatus,
  error: string | null = null,
): SuggestionRow[] {
  return rows.map(r => (r.key === key ? { ...r, status, error } : r))
}

/** Rows "Add all" should create: pending, valid, and not clashing with a tag you have. */
export function rowsToAddAll(rows: SuggestionRow[], existingNames: Iterable<string>): SuggestionRow[] {
  const taken = new Set<string>()
  for (const n of existingNames) taken.add(nameKey(n))
  const out: SuggestionRow[] = []
  for (const r of rows) {
    if (r.status !== 'pending' || validateTagName(r.name)) continue
    const k = nameKey(r.name)
    if (taken.has(k)) continue
    taken.add(k)
    out.push(r)
  }
  return out
}

export function nameClashes(row: SuggestionRow, existingNames: Iterable<string>): boolean {
  const k = nameKey(row.name)
  for (const n of existingNames) if (nameKey(n) === k) return true
  return false
}

export function pendingSuggestionCount(rows: SuggestionRow[]): number {
  return rows.filter(r => r.status === 'pending' || r.status === 'adding').length
}
