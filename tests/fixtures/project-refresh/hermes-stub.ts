import { useSyncExternalStore, type ReactNode } from 'react'
import type { Task } from '../../../src/model'
import type { Project, SettingsBundle, Tag } from '../../../src/ui/api'

/** Subset of @hermes/plugin-sdk for TasksPanel browser harness (fixture only; no live Hermes). */
export interface PluginContext {
  register(item: unknown): () => void
  registerMany(items: unknown[]): () => void
  onDispose(fn: () => void): void
  onEvent?(type: string, listener: () => void): () => void
  addEventListener(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions | boolean,
  ): () => void
  rest<T>(
    path: string,
    options?: { method?: string; body?: unknown; timeoutMs?: number },
  ): Promise<T>
  storage: {
    get<T>(key: string, fallback: T): T
    set(key: string, value: unknown): void
    remove(key: string): void
  }
  os: { writeClipboard(text: string): Promise<boolean>; openExternal(url: string): Promise<boolean> }
}

const memory = new Map<string, unknown>([['projectFilter', ['work:p_beta']]])

type MutableAtom<T> = {
  get(): T
  set(value: T): void
  subscribe(listener: () => void): () => void
}

function mutableAtom<T>(initial: T): MutableAtom<T> {
  let value = initial
  const subs = new Set<() => void>()
  return {
    get: () => value,
    set(next) {
      value = next
      for (const fn of subs) fn()
    },
    subscribe(listener) {
      subs.add(listener)
      return () => subs.delete(listener)
    },
  }
}

const constantAtom = <T,>(value: T) => ({
  get: () => value,
  subscribe: () => () => {},
})

const focusedSessionStore = { id: null as string | null }

const hostProfileAtom = mutableAtom('default')
const focusedSessionProfileAtom = mutableAtom('default')
const connectionAtom = mutableAtom('local')

// Reviewer-derived mounted fixture. Requests use one stable PluginContext.
const requests: string[] = []
let deferNextProject = false
let heldProject: { resolve(value: unknown): void; reject(error: Error): void; value: unknown } | null = null
export const probe = {
  requests,
  setScope(atom: 'profile' | 'focusedProfile' | 'connection', value: string) {
    const atoms = { profile: hostProfileAtom, focusedProfile: focusedSessionProfileAtom, connection: connectionAtom }
    atoms[atom].set(value)
  },
  setCatalog(hideBeta: boolean) { fixtureFlags.hideBetaProject = hideBeta },
  deferProject() { deferNextProject = true },
  hasHeldProject() { return heldProject !== null },
  settleProject(fail = false) {
    const held = heldProject
    heldProject = null
    if (!held) throw new Error('no deferred project request')
    if (fail) held.reject(new Error('old profile failed'))
    else held.resolve(held.value)
  },
  storage: memory,
}

export type AnswerSubmit = { sessionId: string; text: string }

export type HarnessFixtureFlags = {
  projectsFail: boolean
  tasksFail: boolean
  /** Drop the second project from catalog responses (unknown selected key). */
  hideBetaProject: boolean
}

const FIXTURE_STORAGE_KEY = 'wou-catch-up-harness-fixture'

const defaultFlags = (): HarnessFixtureFlags => ({
  projectsFail: false,
  tasksFail: false,
  hideBetaProject: false,
})

function readPersistedFixtureFlags(): HarnessFixtureFlags | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(FIXTURE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<HarnessFixtureFlags>
    return { ...defaultFlags(), ...parsed }
  } catch {
    return null
  }
}

function persistFixtureFlags(flags: HarnessFixtureFlags) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(FIXTURE_STORAGE_KEY, JSON.stringify(flags))
}

let fixtureFlags: HarnessFixtureFlags = readPersistedFixtureFlags() ?? defaultFlags()

export const CHAT_ALPHA = `local-${'a'.repeat(64)}`
export const CHAT_BETA = `local-${'b'.repeat(64)}`

const PROJECT_ALPHA: Project = {
  key: 'default:p_alpha',
  name: 'Alpha',
  profile: 'default',
  color: null,
  open_count: 1,
}

const PROJECT_BETA: Project = {
  key: 'work:p_beta',
  name: 'Beta',
  profile: 'work',
  color: 'blue',
  open_count: 1,
}

const yesNoAsk = 'Say whether we should continue.'

const harnessTasks: Task[] = [
  {
    id: 101,
    chat_key: CHAT_ALPHA,
    agent: 'Harness',
    chat_title: 'Alpha session',
    ask: yesNoAsk,
    topic: 'Alpha',
    quadrant: 2,
    status: 'open',
    snooze_until: null,
    source_msg_id: null,
    created_at: 1,
    updated_at: 1,
    fingerprint: 'fp-101',
    quadrant_locked: false,
    project: { key: PROJECT_ALPHA.key, name: PROJECT_ALPHA.name, color: null },
    tags: [],
    chat_target: null,
  },
  {
    id: 102,
    chat_key: CHAT_BETA,
    agent: 'Harness',
    chat_title: 'Beta session',
    ask: yesNoAsk,
    topic: 'Beta',
    quadrant: 2,
    status: 'open',
    snooze_until: null,
    source_msg_id: null,
    created_at: 1,
    updated_at: 1,
    fingerprint: 'fp-102',
    quadrant_locked: false,
    project: { key: PROJECT_BETA.key, name: PROJECT_BETA.name, color: 'blue' },
    tags: [],
    chat_target: null,
  },
]

const answerSubmits: AnswerSubmit[] = []

const settingsBundle: SettingsBundle = {
  settings: {
    mode: 'manual',
    debounce_seconds: 30,
    sweep_minutes: 30,
    max_chats_per_scan: 50,
    daily_call_cap: 500,
    lookback_days: 14,
    retention_days: 90,
    consented: true,
    archive_chat_on_done: false,
    auto_tag: false,
    name_after_chat: false,
    group_by: 'none',
    layout: 'compact',
    show_priorities: false,
    show_project_badges: true,
    follow_selected_chat: false,
  },
  usage: {
    today: { calls: 0, prompt_tokens: 0, completion_tokens: 0 },
    history: [],
  },
  model: { provider: 'harness', model: 'fixture', label: 'Harness fixture' },
}

const tagsFixture: Tag[] = []

const events = new Map<string, Set<() => void>>()

function emitEvent(type: string) {
  for (const fn of events.get(type) ?? []) fn()
}

const composer = {
  async getDraft(sessionId: string | null): Promise<string | null> {
    if (sessionId == null) {
      return focusedSessionStore.id ? '' : null
    }
    if (focusedSessionStore.id === sessionId) return ''
    return null
  },
  submit(sessionId: string, text: string): boolean {
    if (focusedSessionStore.id !== sessionId) return false
    answerSubmits.push({ sessionId, text })
    return true
  },
  async setDraft(): Promise<boolean> {
    return false
  },
}

export const host = {
  state: {
    profile: hostProfileAtom,
    connectionId: connectionAtom,
    activeSessionId: constantAtom(null),
    gateway: constantAtom('harness'),
    focusedStoredSessionId: {
      get: () => focusedSessionStore.id,
      subscribe: () => () => {},
    },
    focusedSessionProfile: focusedSessionProfileAtom,
    focusedSessionOwner: constantAtom(null),
  },
  onEvent(type: string, listener: () => void) {
    let set = events.get(type)
    if (!set) {
      set = new Set()
      events.set(type, set)
    }
    set.add(listener)
    return () => set?.delete(listener)
  },
  navigate: (path: string) => {
    const id = path.replace(/^\//, '')
    if (id && id !== '') focusedSessionStore.id = id
  },
  openSession: async (sessionId: string) => {
    focusedSessionStore.id = sessionId
  },
  revealPane: () => {},
  paneVisibility: () => constantAtom(true),
  notify: () => {},
  notifyError: () => {},
  composer,
}

type Subscribable<T> = { get(): T; subscribe?(listener: () => void): () => void }

export function useValue<T>(a: Subscribable<T>): T {
  if (!a.subscribe) return a.get()
  return useSyncExternalStore(
    onStoreChange => a.subscribe!(onStoreChange),
    () => a.get(),
    () => a.get(),
  )
}

export function useTheme() {
  return { resolvedMode: 'light', themeName: 'harness', theme: {} }
}

const passthrough = ({ children }: { children?: ReactNode }) => children ?? null

export function Dialog({
  open = true,
  children,
}: {
  open?: boolean
  children?: ReactNode
}) {
  if (!open) return null
  return children ?? null
}

export const DialogContent = passthrough
export const DialogDescription = passthrough
export const DialogFooter = passthrough
export const DialogHeader = passthrough
export const DialogTitle = passthrough
export const Button = passthrough

export function resetHarnessFixture() {
  fixtureFlags = defaultFlags()
  answerSubmits.length = 0
  focusedSessionStore.id = null
  hostProfileAtom.set('default')
  focusedSessionProfileAtom.set('default')
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(FIXTURE_STORAGE_KEY)
}

/** Drive answer-window scope for browser cases (profile + focused session profile). */
export function setHarnessAnswerWindowProfile(profile: string) {
  hostProfileAtom.set(profile)
  focusedSessionProfileAtom.set(profile)
}

export function getHarnessAnswerWindowProfile(): string {
  return focusedSessionProfileAtom.get()
}

export function getHarnessFixture(): HarnessFixtureFlags {
  return { ...fixtureFlags }
}

export function setHarnessFixture(partial: Partial<HarnessFixtureFlags>) {
  fixtureFlags = { ...fixtureFlags, ...partial }
  persistFixtureFlags(fixtureFlags)
}

export function getAnswerSubmits(): AnswerSubmit[] {
  return answerSubmits.map(s => ({ ...s }))
}

export function makeHarnessCtx(): PluginContext {
  return {
    register: () => () => {},
    registerMany: () => () => {},
    onDispose: () => {},
    onEvent: (type, listener) => host.onEvent(type, listener),
    addEventListener: (target, type, listener) => {
      target.addEventListener(type, listener)
      return () => target.removeEventListener(type, listener)
    },
    rest: (async (path: string, options?: { method?: string; body?: unknown; timeoutMs?: number }) => {
      requests.push(path)
      const method = options?.method ?? 'GET'
      if (fixtureFlags.projectsFail && path === '/projects') {
        throw new Error('503: harness projects failure')
      }
      if (fixtureFlags.tasksFail && path.startsWith('/tasks')) {
        throw new Error('503: harness tasks failure')
      }
      if (path === '/settings' && method === 'GET') return settingsBundle
      if (path === '/settings' && method === 'PATCH') {
        return { settings: settingsBundle.settings }
      }
      if (path === '/projects') {
        const projects = fixtureFlags.hideBetaProject ? [PROJECT_ALPHA] : [PROJECT_ALPHA, PROJECT_BETA]
        if (deferNextProject) {
          deferNextProject = false
          return new Promise((resolve, reject) => { heldProject = { resolve, reject, value: { projects, no_project_count: 99 } } })
        }
        return { projects, no_project_count: 0 }
      }
      if (path === '/scan') return { chats_seen: 2, succeeded: 2, failed: 0 }
      if (path === '/tags') return { tags: tagsFixture }
      if (path.startsWith('/quiz')) return { items: [] }
      if (path.startsWith('/tasks') && method === 'GET') {
        return {
          tasks: harnessTasks,
          groups: [],
          counts: { open: harnessTasks.length },
          last_scan: { at: Date.now(), chats_seen: 2, succeeded: 2 },
        }
      }
      if (path.match(/^\/tasks\/\d+$/) && method === 'PATCH') {
        return { task: harnessTasks[0], chat_archived: false }
      }
      if (path.includes('/actions/')) return { ok: true }
      throw new Error(`harness rest not stubbed: ${method} ${path}`)
    }) as PluginContext['rest'],
    storage: {
      get<T>(key: string, fallback: T): T {
        return (memory.has(key) ? memory.get(key) : fallback) as T
      },
      set(key: string, value: unknown) {
        memory.set(key, value)
      },
      remove(key: string) {
        memory.delete(key)
      },
    },
    os: {
      writeClipboard: async () => false,
      openExternal: async () => false,
    },
  }
}
