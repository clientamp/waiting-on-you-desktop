import { host, useValue, type PluginContext } from '@hermes/plugin-sdk'
import { isHistoryTask } from '../model'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  snoozeTimes,
  buildProjectSections,
  buildQuadrantEntries,
  buildQuadrantSections,
  filterOpenTasks,
  filterQuadrantEntriesForSearch,
  flattenQuadrantEntries,
  hasSeveralAgents,
  parseGroupBy,
  parseLayout,
  pickNextUp,
  parseStoredProjectFilter,
  parseStoredTagFilter,
  pruneProjectFilter,
  pruneTagFilter,
  sectionCountLabel,
  sectionShowAllLabel,
  showProjectChips,
  taskTags,
  type QuadrantEntry,
  formatAllAgentsLabel,
  agentMainSubCounts,
  mainAndSubCounts,
  formatAgentOptionLabel,
  formatSnoozeUntil,
  headerModeLabel,
  isDailyCapReached,
  quadrantEntryTaskCount,
  quadrantTitle,
  relativeTime,
  tokenizeQuery,
  taskMatches,
  SETTINGS_CHANGED_WINDOW_EVENT,
  TASKS_CHANGED_WINDOW_EVENT,
  type AgentFilter,
  type ListSection,
  type ProjectFilter,
  type QuadrantEntryGroups,
  type SortOrder,
  type TagCheckState,
  type TagFilter,
  type Task,
  type TaskGroup,
  type TaskProject,
} from '../model'
import {
  createTag,
  deleteTag,
  fetchQuiz,
  fetchProjects,
  fetchSettings,
  fetchTags,
  fetchTasks,
  patchGroup,
  patchSettings,
  patchTag,
  patchTask,
  setTaskTags,
  triggerScan,
  type Project,
  type ScanSummary,
  type SettingsBundle,
  type Tag,
} from './api'
import { FirstRunScreen, FirstRunSteps } from './FirstRunScreen'
import { SettingsView } from './SettingsView'
import { CatchUpView } from './CatchUpView'
import {
  catchUpActiveTask,
  catchUpVisibleTaskOrderForView,
  type CatchUpViewEligibility,
} from './catchUp'
import { TeachPrioritiesView } from './TeachPrioritiesView'
import { isTeachCardResolved, resolveTeachCard, showTeachCard, type TeachAvailability } from './teachPrompt'
import { IconFilter, IconGear, IconPanelHide, IconRefresh, IconSearch } from './icons'
import { ROOT_CLASS, globalStyles } from './styles'
import { strings } from './strings'
import { offlineLine, offlineMachines, scanClassificationFailureLine, storageLabelWarningLine, storageLabelWarnings } from './scanNotes'
import {
  cancelGroupOp,
  finishGroupResponse,
  groupPendingLabel,
  markGroupAnimDone,
  startGroupOp,
  type GroupOpsState,
} from './groupPending'
import { ProjectFilterMenu } from './ProjectFilterMenu'
import { TagFilterMenu } from './TagFilterMenu'
import { HostPresenceProvider } from './HostPresenceContext'
import { TaskGroupRow } from './TaskGroupRow'
import { TaskRow } from './TaskRow'
import { NextUpCard } from './NextUpCard'
import { AnswerContext, type AnswerControls } from './answerContext'
import {
  ANSWER_DELAY_MS,
  answerKeyAction,
  answerMessage,
  answerWindowScope,
  canAnswerInPanel,
  deliverToChat,
  sameAnswerWindowScope,
  unsupportedAnswerReason,
  hostCanSubmit,
  isYesNoAsk,
  keepActive,
  moveActive,
  type AnswerKind,
  type ComposerVerbs,
} from './answers'
import { createAnswerQueue, type AnswerQueue } from './answerQueue'
import { planOpen } from './chatRoute'
import { acceptScopedPayload } from './projectSnapshot'
import { openChat as openChatTarget, openChatInPlace } from './openChat'
import {
  CHECKBOX_GUARD_MS,
  MAX_UNDO_STACK,
  PENDING_MS,
  type UndoEntry,
  UNDO_MS,
  registerUndoHandler,
  registerScanHandler,
  registerToggleAllGroupsHandler,
  registerToggleAnswerBarsHandler,
  narrowGroupUndo,
  registerTeachHandler,
} from './undo'
import { useTasks } from './useTasks'
import { useFollowSelectedChat } from './useFollowSelectedChat'
import { useEffectivePollVisible } from './useEffectivePollVisible'
import { useRetryUntilSuccess } from './useRetryUntilSuccess'
import { notify, notifyError } from './notify'
import { getBackendAvailable, isConsentMiss, noteConsentMiss, subscribeBackendAvailable } from './backendGate'
import { isAlreadyGone, restErrorFields } from './sessionApi'
import { SETTINGS_CHANGED_EVENT, TASKS_CHANGED_EVENT } from './shortcuts'

const SECTION_PREVIEW = 15
const SETTINGS_CHANGED = SETTINGS_CHANGED_EVENT
const POLL_MS = 30_000

function reportActionError(e: unknown, reload?: () => unknown) {
  if (isConsentMiss(e)) {
    if (noteConsentMiss()) notify(strings.notOnThisProfile)
    return
  }
  if (isAlreadyGone(e)) {
    // The task or group closed on the server before this click landed
    // (usually the scanner marked it resolved). Refresh instead of a raw 404.
    notify(strings.alreadyCleared)
    if (reload) void reload()
    return
  }
  notifyError(restErrorFields(e).error || strings.patchError)
}
const STORAGE_SORT = 'sortOrder'
const STORAGE_COLLAPSED = 'sectionCollapsed'
const STORAGE_AGENT_FILTER = 'agentFilter'
const STORAGE_PROJECT_FILTER = 'projectFilter'
const STORAGE_TAG_FILTER = 'tagFilter'
const STORAGE_FILTERS_OPEN = 'filtersOpen'
const STORAGE_GROUP_EXPANDED = 'groupExpanded'
const STORAGE_ANSWER_BARS_ALL = 'answerBarsAll'
/** Answers wait ANSWER_DELAY_MS, then may take up to DELIVER_TIMEOUT_MS to reach the chat. */
const DELIVER_TIMEOUT_MS = 8000
const DELIVER_POLL_MS = 200
/** How long a chat the panel opened for an answer stays "quiet" for follow-selected. */
const QUIET_CHAT_MS = DELIVER_TIMEOUT_MS + 2_000
/** Tasks with an answer pending in this window, kept across panel remounts so
 *  closing and reopening the panel can't answer the same ask twice. */
const answerClaims = new Set<number>()

/** Task rows in the order they appear (skips rows hidden by collapsed groups). */
function visibleTaskOrder(root: HTMLElement | null): number[] {
  if (!root) return []
  const ids: number[] = []
  for (const el of root.querySelectorAll<HTMLElement>('[data-wou-task-id]')) {
    if (el.offsetParent === null && el.getClientRects().length === 0) continue
    const id = Number(el.dataset.wouTaskId)
    if (Number.isFinite(id) && !ids.includes(id)) ids.push(id)
  }
  return ids
}

function taskRowEl(root: HTMLElement | null, taskId: number): HTMLElement | null {
  return root?.querySelector<HTMLElement>(`[data-wou-task-id="${taskId}"]`) ?? null
}

function clipLabel(text: string, max = 40): string {
  const flat = text.trim().replace(/\s+/g, ' ')
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

const QUADRANT_SECTION_TITLES: Record<1 | 2 | 3 | 4, string> = {
  1: strings.section1,
  2: strings.section2,
  3: strings.section3,
  4: strings.section4,
}

type TagLike = Pick<Tag, 'id' | 'name' | 'color'>

function withTag(task: Task, tag: TagLike): Task {
  if (taskTags(task).some(t => t.id === tag.id)) return task
  return {
    ...task,
    tags: [...taskTags(task), { id: tag.id, name: tag.name, color: tag.color, source: 'manual' }],
  }
}

function withoutTag(task: Task, tagId: number): Task {
  if (!taskTags(task).some(t => t.id === tagId)) return task
  return { ...task, tags: taskTags(task).filter(t => t.id !== tagId) }
}

type CollapsedMap = Record<string, boolean>

interface TasksPanelProps {
  ctx: PluginContext
  variant: 'page' | 'pane'
  hostPaneVisible?: boolean
  onHidePane?: () => void
}

export function TasksPanel({
  ctx,
  variant,
  hostPaneVisible = true,
  onHidePane,
}: TasksPanelProps) {
  const profile = useValue(host.state.profile)
  const focusedProfile = host.state.focusedSessionProfile
    ? useValue(host.state.focusedSessionProfile)
    : profile
  const connectionId = useValue(host.state.connectionId)
  const desktopPanel = variant === 'pane'
  const panelRef = useRef<HTMLDivElement>(null)
  const pollVisible = useEffectivePollVisible(
    hostPaneVisible,
    panelRef,
    desktopPanel,
  )
  const { tasks, setTasks, groups, lastScan, includeClosed, setIncludeClosed, reload, offline, fetchSucceeded } = useTasks(
    ctx,
    pollVisible,
  )
  const backendAvailable = useSyncExternalStore(
    subscribeBackendAvailable,
    getBackendAvailable,
    getBackendAvailable,
  )
  const [scanning, setScanning] = useState(false)
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const [undoBarVisible, setUndoBarVisible] = useState(false)
  const [pending, setPending] = useState<Record<number, string>>({})
  const [groupOps, setGroupOps] = useState<GroupOpsState>({})
  const [confirmCloseGroup, setConfirmCloseGroup] = useState<string | null>(null)
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>(() =>
    ctx.storage.get<Record<string, boolean>>(STORAGE_GROUP_EXPANDED, {}),
  )
  const [checkboxGuard, setCheckboxGuard] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [filtersOpen, setFiltersOpen] = useState<boolean>(() => ctx.storage.get<boolean>(STORAGE_FILTERS_OPEN, false) === true)
  const toggleFiltersOpen = () => {
    setFiltersOpen(prev => {
      ctx.storage.set(STORAGE_FILTERS_OPEN, !prev)
      return !prev
    })
  }
  const [sortOrder, setSortOrder] = useState<SortOrder>(() =>
    ctx.storage.get<SortOrder>(STORAGE_SORT, 'newest'),
  )
  const [collapsed, setCollapsed] = useState<CollapsedMap>(() =>
    ctx.storage.get<CollapsedMap>(STORAGE_COLLAPSED, {}),
  )
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [settingsBundle, setSettingsBundle] = useState<SettingsBundle | null>(null)
  const [settingsView, setSettingsView] = useState(false)
  const [catchUpView, setCatchUpView] = useState(false)
  const [catchUpProjectKey, setCatchUpProjectKey] = useState<string | null>(null)
  const [onboarding, setOnboarding] = useState(false)
  const [teachView, setTeachView] = useState(false)
  const [teachResolved, setTeachResolved] = useState(() => isTeachCardResolved(ctx.storage))
  const [teachAvailability, setTeachAvailability] = useState<TeachAvailability>('checking')
  const [scanCompleted, setScanCompleted] = useState(false)
  const consented = settingsBundle?.settings.consented === true

  // Cancel stale quiz checks when scanning starts or the panel changes view.
  // Recheck after scans/polls: a previously empty quiz may now have new tasks.
  useEffect(() => {
    if (!consented || scanning || teachView) {
      setTeachAvailability('checking')
      return
    }
    if (!lastScan && !scanCompleted && !onboarding) return
    // The card is gone for good; only setup still needs the check.
    if (teachResolved && !onboarding) return
    let live = true
    void fetchQuiz(ctx, 1)
      .then(items => { if (live) setTeachAvailability(items.length > 0 ? 'ready' : 'empty') })
      .catch(() => { if (live) setTeachAvailability('error') })
    return () => { live = false }
  }, [ctx, consented, scanning, teachView, lastScan, scanCompleted, tasks, onboarding, teachResolved])

  const dismissTeachCard = (action: 'not-now' | 'dismiss') => {
    if (resolveTeachCard(ctx.storage, action)) setTeachResolved(true)
  }
  // Resolve on each saved answer, not on exit: a slow save can land after
  // Done/Escape, and the Settings gear leaves teaching without onBack.
  const onTeachAnswerSaved = (saved: boolean) => {
    if (saved && resolveTeachCard(ctx.storage, 'session', 1)) setTeachResolved(true)
    void reload()
  }
  const finishTeach = (sorted: number) => {
    if (resolveTeachCard(ctx.storage, 'session', sorted)) setTeachResolved(true)
    setTeachView(false)
    setOnboarding(false)
    void reload()
  }
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsLoadError, setSettingsLoadError] = useState<string | null>(null)
  const [projectsReady, setProjectsReady] = useState(false)
  const [projectsFetchSucceeded, setProjectsFetchSucceeded] = useState(false)
  const [projectsLoadError, setProjectsLoadError] = useState<string | null>(null)
  const [scanNotice, setScanNotice] = useState<'capped' | 'off' | 'locked' | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [noProjectCount, setNoProjectCount] = useState(0)
  const [tags, setTags] = useState<Tag[]>([])
  const [tagsReady, setTagsReady] = useState(false)
  const [agentFilter, setAgentFilter] = useState<AgentFilter>(() =>
    ctx.storage.get<AgentFilter>(STORAGE_AGENT_FILTER, 'all'),
  )
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>(() =>
    parseStoredProjectFilter(ctx.storage.get(STORAGE_PROJECT_FILTER, 'all')),
  )
  const [tagFilter, setTagFilter] = useState<TagFilter>(() =>
    parseStoredTagFilter(ctx.storage.get(STORAGE_TAG_FILTER, [])),
  )
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [sessionSearchQuery, setSessionSearchQuery] = useState('')
  const [debouncedSearchInput, setDebouncedSearchInput] = useState('')
  const [searchIncludeClosed, setSearchIncludeClosed] = useState(false)
  const [searchClosedTasks, setSearchClosedTasks] = useState<Task[]>([])
  const searchClosedFetched = useRef(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const groupAnimTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const groupTokenRef = useRef<Map<string, number>>(new Map())

  // ---- Answering from the panel: state that handleUndo and the follow hook need ----
  const [answerBarsAll, setAnswerBarsAll] = useState<boolean>(
    () => ctx.storage.get<boolean>(STORAGE_ANSWER_BARS_ALL, false) === true,
  )
  const answerBarsAllRef = useRef(answerBarsAll)
  answerBarsAllRef.current = answerBarsAll
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [replyRequest, setReplyRequest] = useState<{ taskId: number; n: number } | null>(null)
  const [answerTick, setAnswerTick] = useState(0)
  const answerQueueRef = useRef<AnswerQueue | null>(null)
  /** Chats the panel is opening right now to send an answer (chat_key -> deadline).
   *  The selection change that opening causes is not the user's, so follow-selected
   *  skips it once; any later selection behaves as normal. */
  const quietChats = useRef<Map<string, number>>(new Map())
  const lastQuietChatRef = useRef<string | null>(null)
  const takeQuietChat = useCallback((chatKey: string) => {
    const until = quietChats.current.get(chatKey)
    if (until == null) return false
    quietChats.current.delete(chatKey)
    if (until < Date.now()) return false
    lastQuietChatRef.current = chatKey
    return true
  }, [])

  const loadSettingsBundle = useCallback(async (): Promise<boolean> => {
    setSettingsLoading(true)
    try {
      const data = await fetchSettings(ctx)
      setSettingsBundle(data)
      setSettingsLoadError(null)
      return true
    } catch {
      setSettingsLoadError(strings.settingsLoadError)
      return false
    } finally {
      setSettingsLoading(false)
    }
  }, [ctx])

  const projectLoad = useRef({ scope: 0, seq: 0 })
  const projectScope = useRef({ ctx, profile, focusedProfile, connectionId })
  const loadProjects = useCallback(async (): Promise<boolean> => {
    const scope = String(projectLoad.current.scope)
    const seq = ++projectLoad.current.seq
    const requested = { scope, seq }
    setProjectsFetchSucceeded(false)
    setProjectsLoadError(null)
    try {
      const res = await fetchProjects(ctx)
      const accepted = acceptScopedPayload(
        requested,
        { scope: String(projectLoad.current.scope), seq: projectLoad.current.seq },
        res,
      )
      if (!accepted) return false
      setProjects(accepted.projects)
      setNoProjectCount(accepted.no_project_count)
      setProjectsReady(true)
      setProjectsFetchSucceeded(true)
      setProjectsLoadError(null)
      return true
    } catch {
      if (
        requested.scope !== String(projectLoad.current.scope) ||
        requested.seq !== projectLoad.current.seq
      ) {
        return false
      }
      setProjectsFetchSucceeded(false)
      setProjectsLoadError(strings.projectsLoadError)
      return false
    }
  }, [ctx, profile, focusedProfile, connectionId])

  const loadTags = useCallback(async (): Promise<boolean> => {
    try {
      setTags(await fetchTags(ctx))
      setTagsReady(true)
      return true
    } catch {
      return false
    }
  }, [ctx])

  useEffect(() => {
    setSettingsBundle(null)
    setSettingsLoadError(null)
    setTagsReady(false)
  }, [ctx])

  // ctx.rest follows the host's backend scope even when ctx itself is stable.
  // Invalidate before passive loads, and hide old choices while the new catalog
  // is pending. A late success or error from the old scope must not win.
  useLayoutEffect(() => {
    const previous = projectScope.current
    if (previous.ctx !== ctx || previous.profile !== profile ||
        previous.focusedProfile !== focusedProfile || previous.connectionId !== connectionId) {
      setProjectFilter('all')
      ctx.storage.set(STORAGE_PROJECT_FILTER, 'all')
    }
    projectScope.current = { ctx, profile, focusedProfile, connectionId }
    projectLoad.current = { scope: projectLoad.current.scope + 1, seq: 0 }
    setProjects([])
    setNoProjectCount(0)
    setCatchUpProjectKey(null)
    setProjectsReady(false)
    setProjectsFetchSucceeded(false)
    setProjectsLoadError(null)
    return () => { projectLoad.current.scope += 1 }
  }, [ctx, profile, focusedProfile, connectionId])

  useRetryUntilSuccess(loadSettingsBundle, settingsBundle !== null)
  useRetryUntilSuccess(loadProjects, projectsReady)
  useEffect(() => {
    const onTasks = () => { void loadProjects() }
    const disposers: Array<() => void> = []
    if (ctx.onEvent) disposers.push(ctx.onEvent(TASKS_CHANGED_EVENT, onTasks))
    else if (host.onEvent) disposers.push(host.onEvent(TASKS_CHANGED_EVENT, onTasks))
    if (ctx.addEventListener && typeof window !== 'undefined') {
      disposers.push(ctx.addEventListener(window, TASKS_CHANGED_WINDOW_EVENT, onTasks))
    }
    return () => { for (const d of disposers) d() }
  }, [ctx, loadProjects])
  useRetryUntilSuccess(loadTags, tagsReady)

  // Drop saved filter values for projects or tags that no longer exist.
  useEffect(() => {
    if (!projectsReady) return
    setProjectFilter(prev => {
      const next = pruneProjectFilter(prev, projects.map(p => p.key))
      if (next !== prev) ctx.storage.set(STORAGE_PROJECT_FILTER, next)
      return next
    })
  }, [ctx, projects, projectsReady])

  useEffect(() => {
    if (!tagsReady) return
    setTagFilter(prev => {
      const next = pruneTagFilter(prev, tags.map(t => t.id))
      if (next !== prev) ctx.storage.set(STORAGE_TAG_FILTER, next)
      return next
    })
  }, [ctx, tags, tagsReady])

  const openSettings = useCallback(() => {
    setCatchUpView(false)
    setTeachView(false)
    setSettingsView(true)
    void loadSettingsBundle()
  }, [loadSettingsBundle])

  const toggleSettings = useCallback(() => {
    setCatchUpView(false)
    // Closing via the gear unmounts SettingsView, whose cleanup flushes any pending save.
    setTeachView(false)
    setSettingsView(open => !open)
    void loadSettingsBundle()
  }, [loadSettingsBundle])

  const openTeach = useCallback(() => {
    setCatchUpView(false)
    // Leaving Settings unmounts it, which flushes any pending save.
    setSettingsView(false)
    setOnboarding(false)
    setTeachView(true)
  }, [])

  useEffect(() => {
    registerTeachHandler(openTeach)
    return () => registerTeachHandler(null)
  }, [openTeach])

  useEffect(() => {
    const onSettingsChange = () => void loadSettingsBundle()
    const disposers: Array<() => void> = []
    if (ctx.onEvent) disposers.push(ctx.onEvent(SETTINGS_CHANGED, onSettingsChange))
    else if (host.onEvent) disposers.push(host.onEvent(SETTINGS_CHANGED, onSettingsChange))
    if (ctx.addEventListener && typeof window !== 'undefined') {
      disposers.push(
        ctx.addEventListener(window, SETTINGS_CHANGED_WINDOW_EVENT, onSettingsChange),
      )
    }
    return () => {
      for (const d of disposers) d()
    }
  }, [ctx, loadSettingsBundle])

  useEffect(() => {
    if (!pollVisible) return
    const id = setInterval(() => {
      void loadSettingsBundle()
      void loadProjects()
      void loadTags()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [pollVisible, loadSettingsBundle, loadProjects, loadTags])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (undoStack.length === 0) {
      setUndoBarVisible(false)
      return
    }
    setUndoBarVisible(true)
    const id = setTimeout(() => setUndoBarVisible(false), UNDO_MS)
    return () => clearTimeout(id)
  }, [undoStack])

  const [followExtraTasks, setFollowExtraTasks] = useState<Task[]>([])

  const openTasksBase = useMemo(
    () => tasks.filter(t => t.status === 'open' || t.status === 'snoozed'),
    [tasks],
  )
  const catchUpViewState = useMemo<CatchUpViewEligibility>(
    () => ({
      consented,
      projectsFetchSucceeded,
      tasksFetchSucceeded: fetchSucceeded,
      offline,
      projects,
      projectKey: catchUpProjectKey,
    }),
    [consented, projectsFetchSucceeded, fetchSucceeded, offline, projects, catchUpProjectKey],
  )
  const catchUpVisibleOrder = useMemo(
    () => (catchUpView ? catchUpVisibleTaskOrderForView(openTasksBase, catchUpViewState) : []),
    [catchUpView, openTasksBase, catchUpViewState],
  )
  const catchUpViewRef = useRef(catchUpView)
  catchUpViewRef.current = catchUpView
  const catchUpVisibleOrderRef = useRef(catchUpVisibleOrder)
  catchUpVisibleOrderRef.current = catchUpVisibleOrder
  const catchUpViewStateRef = useRef(catchUpViewState)
  catchUpViewStateRef.current = catchUpViewState
  const openTasksBaseRef = useRef(openTasksBase)
  openTasksBaseRef.current = openTasksBase

  const openTasks = useMemo(() => {
    if (followExtraTasks.length === 0) return openTasksBase
    const byId = new Map(openTasksBase.map(t => [t.id, t]))
    for (const t of followExtraTasks) byId.set(t.id, t)
    return [...byId.values()]
  }, [openTasksBase, followExtraTasks])

  const filteredOpenTasks = useMemo(
    () => filterOpenTasks(openTasks, agentFilter, projectFilter, tagFilter),
    [openTasks, agentFilter, projectFilter, tagFilter],
  )
  const closedTasks = useMemo(
    () => tasks.filter(isHistoryTask),
    [tasks],
  )
  const entryGroups = useMemo(
    () => buildQuadrantEntries(filteredOpenTasks, groups, sortOrder),
    [filteredOpenTasks, groups, sortOrder],
  )

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearchInput(searchInput)
      setSessionSearchQuery(searchInput)
    }, 150)
    return () => window.clearTimeout(id)
  }, [searchInput])

  useEffect(() => {
    if (!searchIncludeClosed) {
      searchClosedFetched.current = false
      setSearchClosedTasks([])
      return
    }
    if (searchClosedFetched.current) return
    searchClosedFetched.current = true
    void fetchTasks(ctx, true)
      .then(data => {
        setSearchClosedTasks(
          data.tasks.filter(isHistoryTask),
        )
      })
      .catch(() => {
        searchClosedFetched.current = false
      })
  }, [searchIncludeClosed, ctx])

  useEffect(() => {
    if (!searchOpen) return
    const id = window.requestAnimationFrame(() => searchInputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [searchOpen])

  const searchActive = desktopPanel && searchOpen && !catchUpView
  const searchTokens = useMemo(
    () => (searchActive ? tokenizeQuery(debouncedSearchInput) : []),
    [searchActive, debouncedSearchInput],
  )
  const highlightTokens = searchActive && searchTokens.length > 0 ? searchTokens : []

  const nameAfterChat = settingsBundle?.settings.name_after_chat ?? false
  const groupBy = parseGroupBy(
    settingsBundle?.settings.group_by,
    settingsBundle?.settings.show_priorities,
  )
  // Priorities still exist when grouping by project; only "None" hides them.
  const showPriorities = groupBy !== 'none'
  const showProjectBadges = settingsBundle?.settings.show_project_badges ?? true
  const layout = parseLayout(settingsBundle?.settings.layout)
  const showAgentChip = useMemo(() => hasSeveralAgents(openTasks), [openTasks])

  const displayEntryGroups = useMemo((): QuadrantEntryGroups => {
    if (!searchActive) return entryGroups
    const filtered: QuadrantEntryGroups = { 1: [], 2: [], 3: [], 4: [] }
    for (const q of [1, 2, 3, 4] as const) {
      filtered[q] = filterQuadrantEntriesForSearch(
        entryGroups[q],
        searchTokens,
        undefined,
        nameAfterChat,
      )
    }
    return filtered
  }, [searchActive, entryGroups, searchTokens, nameAfterChat])

  const flatDisplayEntries = useMemo(
    () => flattenQuadrantEntries(displayEntryGroups, sortOrder),
    [displayEntryGroups, sortOrder],
  )

  /** The list's sections, or null for one flat list. */
  const sections = useMemo((): ListSection[] | null => {
    if (groupBy === 'priority') return buildQuadrantSections(displayEntryGroups, QUADRANT_SECTION_TITLES)
    if (groupBy === 'project') return buildProjectSections(flatDisplayEntries, strings.sectionNoProject)
    return null
  }, [groupBy, displayEntryGroups, flatDisplayEntries])

  /** Next up layout: the first task in list order gets the big box (not while searching). */
  const nextUp = useMemo(
    () => (layout === 'focus' && !searchActive ? pickNextUp(sections, flatDisplayEntries) : null),
    [layout, searchActive, sections, flatDisplayEntries],
  )
  const nextUpId = nextUp?.task.id ?? null

  const filteredClosedForSearch = useMemo(() => {
    if (!searchActive || !searchIncludeClosed) return []
    const base = filterOpenTasks(searchClosedTasks, agentFilter, projectFilter, tagFilter)
    return base.filter(t => taskMatches(t, searchTokens, { nameAfterChat }))
  }, [
    searchActive,
    searchIncludeClosed,
    searchClosedTasks,
    agentFilter,
    projectFilter,
    tagFilter,
    searchTokens,
    nameAfterChat,
  ])

  const openSearchMatchCount = useMemo(() => {
    let n = 0
    for (const q of [1, 2, 3, 4] as const) {
      n += quadrantEntryTaskCount(displayEntryGroups[q])
    }
    return n
  }, [displayEntryGroups])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchInput('')
    setSessionSearchQuery('')
    setDebouncedSearchInput('')
  }, [])

  const openSearch = useCallback(() => {
    setSearchInput(sessionSearchQuery)
    setDebouncedSearchInput(sessionSearchQuery)
    setSearchOpen(true)
  }, [sessionSearchQuery])

  const searchFilterLabel = useMemo(() => {
    if (agentFilter === 'all' && projectFilter === 'all' && tagFilter.length === 0) return null
    const parts: string[] = []
    if (agentFilter !== 'all') parts.push(agentFilter)
    if (projectFilter !== 'all') {
      const names = projectFilter.map(sel => {
        if (sel === 'none') return strings.projectFilterNone
        return projects.find(pr => pr.key === sel)?.name ?? strings.projectFilterMany(1)
      })
      parts.push(names.join(', '))
    }
    if (tagFilter.length > 0) {
      parts.push(tagFilter.map(id => tags.find(t => t.id === id)?.name ?? '').filter(Boolean).join(' + '))
    }
    return parts.filter(Boolean).join(' · ')
  }, [agentFilter, projectFilter, tagFilter, projects, tags])
  const displayProjectChips = useMemo(
    () => showProjectBadges && showProjectChips(projectFilter),
    [showProjectBadges, projectFilter],
  )
  const agentOptions = useMemo(() => agentMainSubCounts(openTasks), [openTasks])
  const allCounts = useMemo(() => mainAndSubCounts(openTasks), [openTasks])

  const removeOptimistic = useCallback(
    (taskId: number) => setTasks(prev => prev.filter(t => t.id !== taskId)),
    [setTasks],
  )

  const removeOptimisticMany = useCallback(
    (taskIds: number[]) => {
      const drop = new Set(taskIds)
      setTasks(prev => prev.filter(t => !drop.has(t.id)))
    },
    [setTasks],
  )

  const clearGroupAnimTimer = useCallback((chatKey: string) => {
    const t = groupAnimTimers.current.get(chatKey)
    if (t) {
      clearTimeout(t)
      groupAnimTimers.current.delete(chatKey)
    }
  }, [])

  const beginGroupOp = useCallback(
    (chatKey: string, label: string) => {
      clearGroupAnimTimer(chatKey)
      const token = (groupTokenRef.current.get(chatKey) ?? 0) + 1
      groupTokenRef.current.set(chatKey, token)
      setGroupOps(prev => startGroupOp(prev, chatKey, label, token))
      const id = setTimeout(() => {
        groupAnimTimers.current.delete(chatKey)
        setGroupOps(prev => markGroupAnimDone(prev, chatKey, token))
      }, PENDING_MS)
      groupAnimTimers.current.set(chatKey, id)
      return token
    },
    [clearGroupAnimTimer],
  )

  const finishGroupOp = useCallback((chatKey: string, token: number, label?: string) => {
    setGroupOps(prev => finishGroupResponse(prev, chatKey, token, label))
  }, [])

  const abortGroupOp = useCallback(
    (chatKey: string, token: number) => {
      clearGroupAnimTimer(chatKey)
      setGroupOps(prev => cancelGroupOp(prev, chatKey, token))
    },
    [clearGroupAnimTimer],
  )

  useEffect(() => {
    return () => {
      for (const t of groupAnimTimers.current.values()) clearTimeout(t)
      groupAnimTimers.current.clear()
    }
  }, [])

  const clearPendingTimer = useCallback((taskId: number) => {
    const t = pendingTimers.current.get(taskId)
    if (t) {
      clearTimeout(t)
      pendingTimers.current.delete(taskId)
    }
  }, [])

  const clearPending = useCallback(
    (taskId: number) => {
      clearPendingTimer(taskId)
      setPending(prev => {
        if (!(taskId in prev)) return prev
        const next = { ...prev }
        delete next[taskId]
        return next
      })
    },
    [clearPendingTimer],
  )

  const startCheckboxGuard = useCallback(() => {
    setCheckboxGuard(true)
    window.setTimeout(() => setCheckboxGuard(false), CHECKBOX_GUARD_MS)
  }, [])

  const pushUndo = useCallback((entry: UndoEntry) => {
    setUndoStack(prev => [...prev.slice(-(MAX_UNDO_STACK - 1)), entry])
  }, [])

  const popUndo = useCallback(() => {
    setUndoStack(prev => (prev.length === 0 ? prev : prev.slice(0, -1)))
  }, [])

  const scheduleRemoval = useCallback(
    (taskId: number) => {
      clearPendingTimer(taskId)
      const id = setTimeout(() => {
        pendingTimers.current.delete(taskId)
        removeOptimistic(taskId)
        clearPending(taskId)
      }, PENDING_MS)
      pendingTimers.current.set(taskId, id)
    },
    [clearPendingTimer, removeOptimistic, clearPending],
  )

  const scheduleRemovalMany = useCallback(
    (taskIds: number[]) => {
      for (const taskId of taskIds) {
        clearPendingTimer(taskId)
        const id = setTimeout(() => {
          pendingTimers.current.delete(taskId)
          removeOptimisticMany(taskIds)
          clearPending(taskId)
        }, PENDING_MS)
        pendingTimers.current.set(taskId, id)
      }
    },
    [clearPendingTimer, removeOptimisticMany, clearPending],
  )

  const applyPatch = useCallback(
    async (
      task: Task,
      forwardPatch: {
        status?: string
        quadrant?: number
        snooze_until?: number | null
        title?: string | null
      },
      undoEntry: UndoEntry,
      pendingLabel: string,
      options?: { keepVisible?: boolean },
    ) => {
      if (pending[task.id]) return
      if (!options?.keepVisible) startCheckboxGuard()
      if (pendingLabel) setPending(prev => ({ ...prev, [task.id]: pendingLabel }))
      pushUndo(undoEntry)
      if (!options?.keepVisible) scheduleRemoval(task.id)
      try {
        const res = await patchTask(ctx, task.id, forwardPatch)
        if (res.chat_archived && forwardPatch.status === 'done') {
          setPending(prev => ({
            ...prev,
            [task.id]: strings.pendingDoneChatArchived,
          }))
        }
        void reload()
      } catch (e) {
        clearPendingTimer(task.id)
        clearPending(task.id)
        popUndo()
        reportActionError(e, reload)
      }
    },
    [
      ctx,
      pending,
      startCheckboxGuard,
      pushUndo,
      scheduleRemoval,
      clearPendingTimer,
      clearPending,
      popUndo,
      reload,
    ],
  )

  const onDone = (task: Task) =>
    void applyPatch(
      task,
      { status: 'done' },
      {
        scope: 'task',
        task,
        kind: 'done',
        message: strings.undoDone,
        patch: { status: 'open' },
      },
      strings.pendingDone,
    )

  const onDismiss = (task: Task) =>
    void applyPatch(
      task,
      { status: 'dismissed' },
      {
        scope: 'task',
        task,
        kind: 'dismissed',
        message: strings.undoDismissed,
        patch: { status: 'open' },
      },
      strings.pendingDismissed,
    )

  const onSnooze = (task: Task, until: number) =>
    void applyPatch(
      task,
      { snooze_until: until },
      {
        scope: 'task',
        task,
        kind: 'snooze',
        message: strings.undoSnoozed,
        patch: { snooze_until: null },
      },
      `Snoozed until ${formatSnoozeUntil(until)}`,
    )

  const onMoveQuadrant = (task: Task, quadrant: number) =>
    void applyPatch(
      task,
      { quadrant },
      {
        scope: 'task',
        task,
        kind: 'quadrant',
        message: strings.undoMoved,
        patch: { quadrant: task.quadrant, quadrant_locked: !!task.quadrant_locked, restore: true },
      },
      `Moved to ${quadrantTitle(quadrant)}`,
    )

  const onRename = (task: Task, title: string | null) => {
    // A standalone card's name lives on the chat too; undo must restore that, not clear it.
    const standalone = openTasks.filter(t => t.chat_key === task.chat_key).length < 2
    const previous = task.title_override ?? (standalone ? task.chat_name ?? null : null)
    return void applyPatch(
      task,
      { title },
      {
        scope: 'task',
        task,
        kind: 'rename',
        message: strings.undoRename,
        patch: { title: previous },
      },
      '',
      { keepVisible: true },
    )
  }

  const onRenameGroup = useCallback(
    async (group: TaskGroup, title: string | null) => {
      const chatTasks = openTasks.filter(t => t.chat_key === group.chat_key)
      const undoTitle = group.title_locked ? group.title?.trim() || null : null
      pushUndo({
        scope: 'group',
        tasks: chatTasks,
        kind: 'rename',
        message: strings.undoRename,
        patches: [],
        groupRestore: { chat_key: group.chat_key, patch: { title: undoTitle } },
      })
      try {
        await patchGroup(ctx, group.chat_key, { title })
        void reload()
      } catch (e) {
        popUndo()
        reportActionError(e, reload)
      }
    },
    [ctx, openTasks, pushUndo, popUndo, reload],
  )

  /** Show the tag change right away; the next reload brings the server's version. */
  const applyTagsLocally = useCallback(
    (taskIds: number[], tag: TagLike, add: boolean) => {
      const ids = new Set(taskIds)
      setTasks(prev =>
        prev.map(t => (ids.has(t.id) ? (add ? withTag(t, tag) : withoutTag(t, tag.id)) : t)),
      )
    },
    [setTasks],
  )

  const onToggleTaskTag = useCallback(
    async (task: Task, tag: TagLike, state: TagCheckState) => {
      const add = state !== 'all'
      applyTagsLocally([task.id], tag, add)
      pushUndo({
        scope: 'tags',
        kind: 'tags',
        message: strings.undoTags,
        restore: [{ taskId: task.id, add: add ? [] : [tag.id], remove: add ? [tag.id] : [] }],
      })
      try {
        await setTaskTags(ctx, task.id, add ? { add: [tag.id] } : { remove: [tag.id] })
        void reload()
        void loadTags()
      } catch (e) {
        popUndo()
        reportActionError(e, reload)
        void reload()
      }
    },
    [ctx, applyTagsLocally, pushUndo, popUndo, reload, loadTags],
  )

  const onToggleGroupTag = useCallback(
    async (chatTasks: Task[], tag: TagLike, state: TagCheckState) => {
      if (chatTasks.length === 0) return
      const chatKey = chatTasks[0].chat_key
      // All have it: take it off every task. Some or none: put it on every task.
      const add = state !== 'all'
      const has = (t: Task) => taskTags(t).some(x => x.id === tag.id)
      const changed = chatTasks.filter(t => (add ? !has(t) : has(t)))
      applyTagsLocally(chatTasks.map(t => t.id), tag, add)
      pushUndo({
        scope: 'tags',
        kind: 'tags',
        message: strings.undoGroupTags,
        restore: changed.map(t => ({
          taskId: t.id,
          add: add ? [] : [tag.id],
          remove: add ? [tag.id] : [],
        })),
      })
      try {
        await patchGroup(ctx, chatKey, { task_ids: changed.map(t => t.id), ...(add ? { tags_add: [tag.id] } : { tags_remove: [tag.id] }) })
        void reload()
        void loadTags()
      } catch (e) {
        popUndo()
        reportActionError(e, reload)
        void reload()
      }
    },
    [ctx, applyTagsLocally, pushUndo, popUndo, reload, loadTags],
  )

  /** Throws on failure so the dialog can show why (e.g. the name is taken). */
  const onCreateTag = useCallback(
    async (name: string, color: string): Promise<Tag | null> => {
      const created = await createTag(ctx, { name, color })
      setTags(prev => (prev.some(t => t.id === created.id) ? prev : [...prev, created]))
      void loadTags()
      return created
    },
    [ctx, loadTags],
  )

  /** For tag suggestions: creates name, color, and hint together. Throws on failure. */
  const onAddSuggestedTag = useCallback(
    async (body: { name: string; color: string; hint: string }): Promise<Tag> => {
      const created = await createTag(ctx, body.hint ? body : { name: body.name, color: body.color })
      setTags(prev => (prev.some(t => t.id === created.id) ? prev : [...prev, created]))
      void loadTags()
      return created
    },
    [ctx, loadTags],
  )

  const onPatchTag = useCallback(
    async (id: number, body: { name?: string; color?: string; hint?: string }): Promise<boolean> => {
      try {
        const updated = await patchTag(ctx, id, body)
        setTags(prev => prev.map(t => (t.id === id ? { ...t, ...updated } : t)))
        void reload()
        return true
      } catch (e) {
        notifyError(restErrorFields(e).error || strings.tagSaveError)
        return false
      }
    },
    [ctx, reload],
  )

  const onDeleteTag = useCallback(
    async (tag: Tag) => {
      if (!window.confirm(strings.tagDeleteConfirm(tag.name))) return
      try {
        await deleteTag(ctx, tag.id)
        setTags(prev => prev.filter(t => t.id !== tag.id))
        void loadTags()
        void reload()
      } catch (e) {
        notifyError(restErrorFields(e).error || strings.tagSaveError)
      }
    },
    [ctx, loadTags, reload],
  )

  const onProjectClick = useCallback(
    (project: TaskProject) => {
      const next: ProjectFilter = [project.key]
      setProjectFilter(next)
      ctx.storage.set(STORAGE_PROJECT_FILTER, next)
      scrollRef.current?.scrollTo({ top: 0 })
    },
    [ctx],
  )

  const isGroupExpanded = useCallback(
    (chatKey: string) => groupExpanded[chatKey] !== false,
    [groupExpanded],
  )

  const toggleGroupExpanded = useCallback(
    (chatKey: string, allGroups = false) => {
      const target = !isGroupExpanded(chatKey)
      // Option-click: apply the clicked group's new state to every listed group.
      // Groups not yet on the list have no key, so new ones still start open.
      const next = allGroups
        ? { ...groupExpanded, ...Object.fromEntries(groups.map(g => [g.chat_key, target])), [chatKey]: target }
        : { ...groupExpanded, [chatKey]: target }
      setGroupExpanded(next)
      ctx.storage.set(STORAGE_GROUP_EXPANDED, next)
    },
    [ctx, groupExpanded, isGroupExpanded, groups],
  )

  const toggleAllGroupsExpanded = useCallback(() => {
    const anyExpanded = groups.some(g => isGroupExpanded(g.chat_key))
    const target = !anyExpanded
    const next = {
      ...groupExpanded,
      ...Object.fromEntries(groups.map(g => [g.chat_key, target])),
    }
    setGroupExpanded(next)
    ctx.storage.set(STORAGE_GROUP_EXPANDED, next)
  }, [ctx, groupExpanded, groups, isGroupExpanded])

  const applyGroupStatus = useCallback(
    async (
      chatTasks: Task[],
      status: 'done' | 'dismissed',
      undoEntry: UndoEntry,
      pendingLabel: string,
    ) => {
      const chatKey = chatTasks[0].chat_key
      const ids = chatTasks.map(t => t.id)
      if (ids.some(id => pending[id])) return
      startCheckboxGuard()
      setPending(prev => {
        const next = { ...prev }
        for (const id of ids) next[id] = pendingLabel
        return next
      })
      const token = beginGroupOp(chatKey, pendingLabel)
      scheduleRemovalMany(ids)
      try {
        const res = await patchGroup(ctx, chatKey, { status, task_ids: ids })
        const changedUndo = narrowGroupUndo(undoEntry, res.closed_task_ids)
        if (changedUndo) pushUndo(changedUndo)
        if (res.already_closed) notify(strings.alreadyCleared)
        const doneLabel =
          res.chat_archived && status === 'done' ? strings.pendingDoneChatArchived : undefined
        finishGroupOp(chatKey, token, doneLabel)
        void reload()
      } catch (e) {
        for (const id of ids) clearPendingTimer(id)
        setPending(prev => {
          const next = { ...prev }
          for (const id of ids) delete next[id]
          return next
        })
        abortGroupOp(chatKey, token)
        reportActionError(e, reload)
      }
    },
    [
      pending,
      startCheckboxGuard,
      pushUndo,
      scheduleRemovalMany,
      ctx,
      reload,
      clearPendingTimer,
      beginGroupOp,
      finishGroupOp,
      abortGroupOp,
    ],
  )

  const applyGroupSnooze = useCallback(
    async (chatTasks: Task[], until: number) => {
      const chatKey = chatTasks[0].chat_key
      const ids = chatTasks.map(t => t.id)
      if (ids.some(id => pending[id])) return
      startCheckboxGuard()
      const label = `Snoozed until ${formatSnoozeUntil(until)}`
      setPending(prev => {
        const next = { ...prev }
        for (const id of ids) next[id] = label
        return next
      })
      const token = beginGroupOp(chatKey, label)
      pushUndo({
        scope: 'group',
        tasks: chatTasks,
        kind: 'snooze',
        message: strings.undoGroupSnoozed,
        patches: chatTasks.map(t => ({ task: t, patch: { snooze_until: null } })),
      })
      scheduleRemovalMany(ids)
      try {
        await Promise.all(
          chatTasks.map(t => patchTask(ctx, t.id, { snooze_until: until })),
        )
        finishGroupOp(chatKey, token)
        void reload()
      } catch (e) {
        for (const id of ids) clearPendingTimer(id)
        setPending(prev => {
          const next = { ...prev }
          for (const id of ids) delete next[id]
          return next
        })
        abortGroupOp(chatKey, token)
        popUndo()
        reportActionError(e, reload)
      }
    },
    [
      pending,
      startCheckboxGuard,
      pushUndo,
      scheduleRemovalMany,
      ctx,
      reload,
      clearPendingTimer,
      popUndo,
      beginGroupOp,
      finishGroupOp,
      abortGroupOp,
    ],
  )

  const applyGroupQuadrant = useCallback(
    async (chatTasks: Task[], groupQuadrant: number, quadrant: number) => {
      const chatKey = chatTasks[0].chat_key
      void groupQuadrant
      try {
        const result = await patchGroup(ctx, chatKey, { quadrant })
        if (result.priority_restore) pushUndo({
          scope: 'group', tasks: chatTasks, kind: 'quadrant',
          message: strings.undoGroupMoved, patches: [],
          groupRestore: { chat_key: chatKey, patch: { priority_restore: result.priority_restore } },
        })
        void reload()
      } catch (e) {
        reportActionError(e, reload)
      }
    },
    [ctx, reload, pushUndo, popUndo],
  )

  const onReopen = async (task: Task) => {
    try {
      await patchTask(ctx, task.id, { status: 'open' })
      setSearchClosedTasks(prev => prev.filter(t => t.id !== task.id))
      void reload()
    } catch {
      notifyError(strings.patchError)
    }
  }

  const handleUndo = useCallback(async () => {
    // A waiting answer is the newest thing the user did that can still be stopped.
    const cancelled = answerQueueRef.current?.cancelLatest()
    if (cancelled) {
      notify(strings.answerCancelled)
      return
    }
    const entry = undoStack[undoStack.length - 1]
    if (!entry) return
    setUndoStack(prev => prev.slice(0, -1))
    if (entry.scope === 'tags') {
      const byId = new Map(tags.map(t => [t.id, t]))
      setTasks(prev =>
        prev.map(t => {
          const r = entry.restore.find(x => x.taskId === t.id)
          if (!r) return t
          let next = t
          for (const id of r.remove) next = withoutTag(next, id)
          for (const id of r.add) {
            const tag = byId.get(id)
            if (tag) next = withTag(next, tag)
          }
          return next
        }),
      )
      try {
        await Promise.all(
          entry.restore.map(r => setTaskTags(ctx, r.taskId, { add: r.add, remove: r.remove })),
        )
        void reload()
        void loadTags()
      } catch {
        notifyError(strings.patchError)
        void reload()
      }
      return
    }
    if (entry.scope === 'group') {
      const chatKey = entry.tasks[0]?.chat_key
      for (const t of entry.tasks) clearPending(t.id)
      if (chatKey) {
        clearGroupAnimTimer(chatKey)
        setGroupOps(prev => {
          if (!(chatKey in prev)) return prev
          const next = { ...prev }
          delete next[chatKey]
          return next
        })
      }
      setTasks(prev => {
        const ids = new Set(prev.map(t => t.id))
        const merged = [...prev]
        for (const t of entry.tasks) {
          if (!ids.has(t.id)) merged.push(t)
        }
        return merged.sort((a, b) => a.id - b.id)
      })
      try {
        if (entry.groupRestore) {
          await patchGroup(ctx, entry.groupRestore.chat_key, entry.groupRestore.patch)
        }
        if (entry.patches.length > 0) {
          await Promise.all(
            entry.patches.map(p => patchTask(ctx, p.task.id, p.patch)),
          )
        }
        void reload()
      } catch {
        notifyError(strings.patchError)
      }
      return
    }
    clearPending(entry.task.id)
    setTasks(prev => {
      if (prev.some(t => t.id === entry.task.id)) return prev
      return [...prev, entry.task].sort((a, b) => a.id - b.id)
    })
    try {
      await patchTask(ctx, entry.task.id, entry.patch)
      void reload()
    } catch {
      notifyError(strings.patchError)
    }
  }, [undoStack, clearPending, setTasks, ctx, reload, tags, loadTags])

  useEffect(() => {
    registerUndoHandler(() => void handleUndo())
    return () => registerUndoHandler(null)
  }, [handleUndo])

  useEffect(() => {
    const el = panelRef.current
    if (!el || !desktopPanel) return
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        const target = e.target as HTMLElement | null
        if (!target || !el.contains(target)) return
        e.preventDefault()
        openSearch()
        return
      }
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'z' || e.shiftKey) return
      const target = e.target as HTMLElement | null
      if (!target || !el.contains(target)) return
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }
      e.preventDefault()
      void handleUndo()
    }
    el.addEventListener('keydown', onKeyDown)
    return () => el.removeEventListener('keydown', onKeyDown)
  }, [handleUndo, desktopPanel, openSearch])

  const handleScanSummary = useCallback(
    (summary: ScanSummary) => {
      if (summary.skipped === 'consent') {
        setScanNotice(null)
        void loadSettingsBundle()
        return
      }
      if (summary.skipped === 'off') {
        setScanNotice('off')
        return
      }
      if (summary.capped) {
        setScanNotice('capped')
        return
      }
      if (summary.skipped === 'locked') {
        // Shown in the panel, not only a toast, so a press never looks like it did nothing.
        setScanNotice('locked')
        void reload()
        void loadProjects()
        return
      }
      setScanNotice(null)
      if (!summary.skipped) {
        const failLine = scanClassificationFailureLine(summary)
        if (failLine) {
          notifyError(failLine)
        } else {
          const added = summary.added ?? 0
          const resolved = summary.resolved ?? 0
          notify(strings.scanDone(added, resolved, summary.expired ?? 0))
        }
      }
      void reload()
      void loadProjects()
      void loadSettingsBundle()
    },
    [loadSettingsBundle, loadProjects, reload],
  )

  // Raising the daily limit in Settings clears the "limit reached" banner.
  useEffect(() => {
    if (scanNotice !== 'capped' || settingsBundle == null) return
    const cap = settingsBundle.settings.daily_call_cap
    if (cap <= 0 || settingsBundle.usage.today.calls < cap) setScanNotice(null)
  }, [scanNotice, settingsBundle])

  const runScan = useCallback(
    async (force = false) => {
      if (scanning) return
      setScanning(true)
      try {
        const summary = await triggerScan(ctx, force ? { force: true } : undefined)
        if (!summary.skipped && !summary.capped) setScanCompleted(true)
        handleScanSummary(summary)
      } catch (e: unknown) {
        const err = e as { status?: number; message?: string }
        if (err?.status === 429 || String(err?.message ?? '').includes('429')) {
          notify(strings.scanRateLimited)
        } else {
          notifyError(strings.scanFailed)
        }
      } finally {
        setScanning(false)
      }
    },
    [ctx, scanning, handleScanSummary],
  )

  const onScan = () => void runScan(false)

  useEffect(() => {
    registerScanHandler(() => void runScan(false))
    return () => registerScanHandler(null)
  }, [runScan])

  useEffect(() => {
    registerToggleAllGroupsHandler(toggleAllGroupsExpanded)
    return () => registerToggleAllGroupsHandler(null)
  }, [toggleAllGroupsExpanded])

  const onFirstRunStart = async () => {
    try {
      const res = await patchSettings(ctx, { consented: true })
      setSettingsBundle(prev =>
        prev
          ? { ...prev, settings: res.settings }
          : {
              settings: res.settings,
              usage: { today: { calls: 0, prompt_tokens: 0, completion_tokens: 0 }, history: [] },
              model: { provider: null, model: null, label: 'your main Hermes model' },
            },
      )
      if (desktopPanel) setOnboarding(true)
      await runScan(false)
    } catch {
      notifyError(strings.patchError)
    }
  }

  const onSortChange = (order: SortOrder) => {
    setSortOrder(order)
    ctx.storage.set(STORAGE_SORT, order)
  }

  const toggleCollapsed = (key: string) => {
    const next = { ...collapsed, [key]: !collapsed[key] }
    setCollapsed(next)
    ctx.storage.set(STORAGE_COLLAPSED, next)
  }

  const shellClass = variant === 'page' ? 'wou-page' : 'wou-pane'
  const showFirstRun =
    desktopPanel && settingsBundle != null && !settingsBundle.settings.consented
  const settings = settingsBundle?.settings
  const capReached =
    settingsBundle != null &&
    isDailyCapReached(
      settingsBundle.usage.today.calls,
      settingsBundle.settings.daily_call_cap,
    )
  const modeLabel = settings ? headerModeLabel(settings.mode) : null
  const scanAt = lastScan?.at
  const relative = scanAt != null ? relativeTime(scanAt, now) : ''
  const updated = relative ? `${strings.updatedPrefix} ${relative}` : null
  const fullView = settingsView || teachView || onboarding || catchUpView
  const filtersActive = agentFilter !== 'all' || projectFilter !== 'all' || tagFilter.length > 0

  const clearFilters = useCallback(() => {
    setAgentFilter('all')
    setProjectFilter('all')
    setTagFilter([])
    ctx.storage.set(STORAGE_AGENT_FILTER, 'all')
    ctx.storage.set(STORAGE_PROJECT_FILTER, 'all')
    ctx.storage.set(STORAGE_TAG_FILTER, [])
  }, [ctx])

  const persistCollapsed = useCallback(
    (next: CollapsedMap) => ctx.storage.set(STORAGE_COLLAPSED, next),
    [ctx],
  )
  const persistGroupExpanded = useCallback(
    (next: Record<string, boolean>) => ctx.storage.set(STORAGE_GROUP_EXPANDED, next),
    [ctx],
  )

  const highlightedChatKey = useFollowSelectedChat({
    ctx,
    enabled: !catchUpView && (settingsBundle?.settings.follow_selected_chat ?? true),
    desktopPane: desktopPanel,
    paneVisible: pollVisible,
    tasks: openTasksBase,
    groups,
    agentFilter,
    projectFilter,
    tagFilter,
    searchActive,
    collapsed,
    expandedSections,
    groupExpanded,
    sections,
    flatDisplayEntries,
    scrollRef,
    onClearFilters: clearFilters,
    onCloseSearch: closeSearch,
    setCollapsed,
    setExpandedSections,
    setGroupExpanded,
    persistGroupExpanded,
    persistCollapsed,
    followExtraTasks,
    setFollowExtraTasks,
    takeQuietChat,
  })

  // ---- Answering from the panel ----
  const canSubmit = useMemo(
    () => hostCanSubmit(host as unknown as { composer?: Partial<ComposerVerbs> | null }),
    [],
  )
  const openTasksRef = useRef(openTasks)
  openTasksRef.current = openTasks
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const onSnoozeRef = useRef(onSnooze)
  onSnoozeRef.current = onSnooze
  const activeTaskIdRef = useRef(activeTaskId)
  activeTaskIdRef.current = activeTaskId

  const readAnswerWindowScope = useCallback(() => {
    const conn = host.state.connectionId?.get() ?? null
    const owner = host.state.focusedSessionOwner?.get()
    const profile = owner?.profile ?? host.state.focusedSessionProfile?.get() ?? null
    return answerWindowScope(conn, profile)
  }, [])

  useEffect(() => {
    const connAtom = host.state.connectionId
    if (!connAtom) return
    const ownerAtom = host.state.focusedSessionOwner
    const profileAtom = host.state.focusedSessionProfile
    let scope = readAnswerWindowScope()
    const onShift = () => {
      const next = readAnswerWindowScope()
      if (sameAnswerWindowScope(scope, next)) return
      scope = next
      setAnswerTick(n => n + 1)
      answerQueueRef.current?.cancelOutOfScope(next)
    }
    const unsubs = [connAtom, ownerAtom, profileAtom]
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .map(a => a.subscribe(onShift))
    return () => unsubs.forEach(u => u())
  }, [readAnswerWindowScope])

  useEffect(() => {
    const queue = createAnswerQueue({
      delayMs: ANSWER_DELAY_MS,
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: handle => window.clearTimeout(handle as number),
      isStillOpen: id => openTasksRef.current.some(t => t.id === id && t.status === 'open'),
      claims: answerClaims,
      deliver: async (item, signal) => {
        const panel = panelRef.current
        const before = document.activeElement as HTMLElement | null
        const panelHadFocus = Boolean(panel && before && panel.contains(before))
        // Opening the chat moves focus to its composer. Hand it back to the panel
        // so the next Y/N/J/K isn't typed into the chat, but only while the user
        // hasn't clicked or tabbed somewhere else since this send started.
        let userMovedFocus = false
        const onPointer = () => {
          userMovedFocus = true
        }
        const onKey = (e: KeyboardEvent) => {
          if (e.key === 'Tab') userMovedFocus = true
        }
        window.addEventListener('pointerdown', onPointer, true)
        window.addEventListener('keydown', onKey, true)
        const giveFocusBack = () => {
          if (!panelHadFocus || !panel || userMovedFocus || signal.aborted) return
          const now = document.activeElement
          if (now && panel.contains(now)) return
          const target = before && before.isConnected ? before : panel
          target.focus({ preventScroll: true })
        }
        const composer = (host as unknown as { composer?: Partial<ComposerVerbs> | null }).composer
        const shown = (host as unknown as { state?: { focusedStoredSessionId?: { get: () => string | null } } })
          .state?.focusedStoredSessionId
        try {
          return await deliverToChat(
            {
              composer,
              shownSessionId: () => shown?.get() ?? null,
              inScope: () => sameAnswerWindowScope(item.scope, readAnswerWindowScope()),
              openInPlace: async id => {
                quietChats.current.set(item.chatKey, Date.now() + QUIET_CHAT_MS)
                await openChatInPlace(id)
                window.requestAnimationFrame(giveFocusBack)
              },
              sleep: ms => new Promise(resolve => window.setTimeout(resolve, ms)),
              timeoutMs: DELIVER_TIMEOUT_MS,
              pollMs: DELIVER_POLL_MS,
              signal,
            },
            item.sessionId,
            item.text,
          )
        } finally {
          quietChats.current.delete(item.chatKey)
          window.removeEventListener('pointerdown', onPointer, true)
          window.removeEventListener('keydown', onKey, true)
          window.requestAnimationFrame(giveFocusBack)
        }
      },
      onSent: item => {
        notify(strings.answerSent(item.label, item.chatTitle))
        const task = openTasksRef.current.find(t => t.id === item.taskId)
        if (task && task.status === 'open') onDoneRef.current(task)
      },
      onFailed: (item, reason) => {
        if (reason === 'gone') notify(strings.answerGone(item.chatTitle))
        else notifyError(strings.answerNotSent(item.chatTitle), `answer ${reason} task=${item.taskId}`)
      },
      onChange: () => setAnswerTick(n => n + 1),
    })
    answerQueueRef.current = queue
    return () => {
      queue.dispose()
      if (answerQueueRef.current === queue) answerQueueRef.current = null
    }
  }, [readAnswerWindowScope])

  const moveActiveBy = useCallback((dir: 1 | -1, from: number | null) => {
    const root = scrollRef.current
    const order = catchUpViewRef.current
      ? catchUpVisibleOrderRef.current
      : visibleTaskOrder(root)
    const next = moveActive(order, from, dir)
    if (next == null) return
    setActiveTaskId(next)
    const el = taskRowEl(root, next)
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
      el.focus({ preventScroll: true })
    }
  }, [])

  const answerTask = useCallback(
    (task: Task, kind: AnswerKind, reply?: string) => {
      const queue = answerQueueRef.current
      if (!queue || !canAnswerInPanel(task, canSubmit, readAnswerWindowScope())) return
      // Another window (remote or other profile) is not a send target. Open only.
      if (unsupportedAnswerReason(task)) return
      if (kind !== 'reply' && !isYesNoAsk(task.ask)) return
      const plan = planOpen(task.chat_key, task.chat_target)
      if (plan.kind !== 'main') return
      const text = answerMessage(kind, task.ask, reply)
      if (!text) return
      const label =
        kind === 'yes' ? strings.answerYes : kind === 'no' ? strings.answerNo : clipLabel(reply ?? '')
      const chatTitle = task.chat_title?.trim() || task.topic?.trim() || strings.pluginName
      const queued = queue.enqueue({
        taskId: task.id,
        sessionId: plan.sessionId,
        chatKey: task.chat_key,
        scope: readAnswerWindowScope(),
        text,
        label,
        chatTitle,
      })
      if (!queued) {
        notify(strings.answerAlreadyPending)
        return
      }
      // Move on, so the next task is ready while this one waits to send.
      if (activeTaskIdRef.current === task.id) moveActiveBy(1, task.id)
    },
    [canSubmit, moveActiveBy, readAnswerWindowScope],
  )

  const answerControls = useMemo<AnswerControls>(
    () => ({
      activeId: activeTaskId,
      showAll: answerBarsAll,
      canSubmit: canSubmit && readAnswerWindowScope().profile === 'default',
      replyRequest,
      phase: id => answerQueueRef.current?.phase(id) ?? null,
      answerLabel: id => answerQueueRef.current?.get(id)?.label ?? null,
      activate: task => setActiveTaskId(task.id),
      answer: answerTask,
      cancel: task => {
        if (answerQueueRef.current?.cancel(task.id)) {
          notify(strings.answerCancelled)
        }
      },
      later: task => onSnoozeRef.current(task, snoozeTimes(new Date()).tomorrow),
      open: task => void openChatTarget(ctx, task.chat_key, task.chat_title, task.chat_target, [task]),
    }),
    // answerTick: queue phases changed, so rows must re-read them.
    [activeTaskId, answerBarsAll, canSubmit, replyRequest, answerTask, ctx, answerTick],
  )

  // Keep a valid active task: it starts on the selected chat's task (else the
  // first one) and moves to the next task when the active one leaves the list.
  const prevOrderRef = useRef<number[]>([])
  useLayoutEffect(() => {
    const root = scrollRef.current
    const order = catchUpView ? catchUpVisibleOrder : visibleTaskOrder(root)
    const prev = prevOrderRef.current
    prevOrderRef.current = order
    setActiveTaskId(current => {
      const kept = keepActive(prev, order, current)
      if (kept != null) return kept
      if (order.length === 0) return null
      if (catchUpView) return order[0]
      if (highlightedChatKey) {
        const followEl = root?.querySelector<HTMLElement>(
          `[data-wou-follow-key="${CSS.escape(highlightedChatKey)}"]`,
        )
        const rowEl = followEl?.dataset.wouTaskId ? followEl : followEl?.querySelector<HTMLElement>('[data-wou-task-id]')
        const id = rowEl ? Number(rowEl.dataset.wouTaskId) : NaN
        if (order.includes(id)) return id
      }
      return order[0]
    })
  })

  useEffect(() => {
    if (!catchUpView) return
    setActiveTaskId(current => {
      if (current != null && catchUpVisibleOrder.includes(current)) return current
      return catchUpVisibleOrder[0] ?? null
    })
  }, [catchUpView, catchUpProjectKey, catchUpVisibleOrder])

  // Selecting a chat in the sidebar selects its task here, unless the panel
  // opened that chat itself to send an answer.
  useEffect(() => {
    if (catchUpView) return
    if (!highlightedChatKey) {
      lastQuietChatRef.current = null
      return
    }
    if (lastQuietChatRef.current === highlightedChatKey) return
    lastQuietChatRef.current = null
    const root = scrollRef.current
    const followEl = root?.querySelector<HTMLElement>(
      `[data-wou-follow-key="${CSS.escape(highlightedChatKey)}"]`,
    )
    const rowEl = followEl?.dataset.wouTaskId ? followEl : followEl?.querySelector<HTMLElement>('[data-wou-task-id]')
    const id = rowEl ? Number(rowEl.dataset.wouTaskId) : NaN
    if (Number.isFinite(id)) setActiveTaskId(id)
  }, [highlightedChatKey])

  useEffect(() => {
    registerToggleAnswerBarsHandler(() => {
      const next = !answerBarsAllRef.current
      setAnswerBarsAll(next)
      ctx.storage.set(STORAGE_ANSWER_BARS_ALL, next)
      notify(next ? strings.answerBarsAllOn : strings.answerBarsAllOff)
    })
    return () => registerToggleAnswerBarsHandler(null)
  }, [ctx])

  // Single keys on the selected task: Y N R L O, J/K or arrows to move.
  const answerKeysOn = (!fullView || catchUpView) && !includeClosed && consented
  useEffect(() => {
    const el = panelRef.current
    if (!el || !answerKeysOn) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return
      const target = e.target as HTMLElement | null
      if (!target || !el.contains(target)) return
      if (target.closest('[role="menu"], [role="dialog"]')) return
      const typing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      const action = answerKeyAction({
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        typing,
      })
      if (!action) return
      const activeId = activeTaskIdRef.current
      if (action === 'next' || action === 'prev') {
        e.preventDefault()
        moveActiveBy(action === 'next' ? 1 : -1, activeId)
        return
      }
      const task = catchUpViewRef.current
        ? catchUpActiveTask(openTasksBaseRef.current, catchUpViewStateRef.current, activeId)
        : openTasksRef.current.find(t => t.id === activeId)
      if (!task || answerQueueRef.current?.phase(task.id)) return
      const canAnswer = canAnswerInPanel(task, canSubmit, readAnswerWindowScope())
      if (action === 'yes' || action === 'no') {
        if (!canAnswer || !isYesNoAsk(task.ask)) return
        e.preventDefault()
        answerTask(task, action)
      } else if (action === 'reply') {
        if (!canAnswer) return
        e.preventDefault()
        setReplyRequest(prev => ({ taskId: task.id, n: (prev?.n ?? 0) + 1 }))
      } else if (action === 'later') {
        if (task.status !== 'open') return
        e.preventDefault()
        onSnoozeRef.current(task, snoozeTimes(new Date()).tomorrow)
      } else if (action === 'open') {
        e.preventDefault()
        void openChatTarget(ctx, task.chat_key, task.chat_title, task.chat_target, [task])
      }
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [answerKeysOn, canSubmit, answerTask, moveActiveBy, ctx])

  const latestUndo = undoStack[undoStack.length - 1]
  const moreUndo = undoStack.length > 1 ? undoStack.length - 1 : 0
  const showSearchEmpty =
    searchActive &&
    searchTokens.length > 0 &&
    openSearchMatchCount === 0 &&
    filteredClosedForSearch.length === 0

  // inGroup: the Next up box shows a group's first ask; its priority belongs to the group, so hide that control.
  const renderTaskRow = (task: Task, inNextUp = false, inGroup = false) => (
        <TaskRow
          key={inNextUp ? `next-up-${task.id}` : task.id}
          defaultDetailsOpen={inNextUp}
          inNextUp={inNextUp}
          ctx={ctx}
          task={task}
          allTags={tags}
          nameAfterChat={nameAfterChat}
          pendingLabel={pending[task.id]}
          checkboxDisabled={checkboxGuard || Boolean(pending[task.id])}
          onDone={onDone}
          onDismiss={onDismiss}
          onSnooze={onSnooze}
          onMoveQuadrant={onMoveQuadrant}
          onToggleTag={(t, tag, state) => void onToggleTaskTag(t, tag, state)}
          onCreateTag={onCreateTag}
          onProjectClick={onProjectClick}
          onRename={onRename}
          onReload={() => void reload()}
          highlightTokens={highlightTokens}
          followHighlighted={highlightedChatKey === task.chat_key}
          showProjectChips={displayProjectChips}
          showPriorities={showPriorities && !inGroup}
          showAgentChip={showAgentChip}
          updatedNow={now}
        />
  )

  const renderOpenEntry = (entry: QuadrantEntry) => {
    if (entry.kind === 'task') {
      if (entry.task.id === nextUpId) return null
      return renderTaskRow(entry.task)
    }
    const { group } = entry
    // The Next up box already shows this group's first task.
    // Group-wide actions still cover every task in the chat, including that one.
    const groupTasks = entry.tasks
    const chatTasks = nextUpId == null ? entry.tasks : entry.tasks.filter(t => t.id !== nextUpId)
    if (chatTasks.length === 0) return null
    return (
      <TaskGroupRow
        key={group.chat_key}
        ctx={ctx}
        group={group}
        tasks={chatTasks}
        allTags={tags}
        nameAfterChat={nameAfterChat}
        expanded={isGroupExpanded(group.chat_key)}
        forceExpanded={searchActive && searchTokens.length > 0}
        highlightTokens={highlightTokens}
        followHighlighted={highlightedChatKey === group.chat_key}
        onToggleExpanded={(all: boolean) => toggleGroupExpanded(group.chat_key, all)}
        pendingLabels={pending}
        checkboxDisabled={checkboxGuard}
        groupPending={groupPendingLabel(groupOps, group.chat_key)}
        confirmClose={confirmCloseGroup === group.chat_key}
        actionTasks={groupTasks}
        onConfirmClose={() => setConfirmCloseGroup(group.chat_key)}
        onCancelClose={() => setConfirmCloseGroup(null)}
        onDoneAll={() => {
          setConfirmCloseGroup(null)
          void applyGroupStatus(
            groupTasks,
            'done',
            {
              scope: 'group',
              tasks: groupTasks,
              kind: 'done',
              message: strings.undoGroupDone,
              patches: groupTasks.map(t => ({
                task: t,
                patch: { status: 'open' },
              })),
            },
            strings.pendingDone,
          )
        }}
        onDismissAll={() =>
          void applyGroupStatus(
            groupTasks,
            'dismissed',
            {
              scope: 'group',
              tasks: groupTasks,
              kind: 'dismissed',
              message: strings.undoGroupDismissed,
              patches: groupTasks.map(t => ({
                task: t,
                patch: { status: 'open' },
              })),
            },
            strings.pendingDismissed,
          )
        }
        onSnoozeAll={until => void applyGroupSnooze(groupTasks, until)}
        onMoveQuadrant={quadrant => void applyGroupQuadrant(groupTasks, group.quadrant, quadrant)}
        onToggleTag={(tag, state) => void onToggleGroupTag(groupTasks, tag, state)}
        onCreateTag={onCreateTag}
        onProjectClick={onProjectClick}
        onRenameGroup={(g, title) => void onRenameGroup(g, title)}
        onChildDone={onDone}
        onChildDismiss={onDismiss}
        onChildSnooze={onSnooze}
        onChildToggleTag={(t, tag, state) => void onToggleTaskTag(t, tag, state)}
        onChildRename={onRename}
        onReload={() => void reload()}
        showProjectChips={displayProjectChips}
        showPriorities={showPriorities}
        showAgentChip={showAgentChip}
        updatedNow={now}
      />
    )
  }

  if (!backendAvailable) {
    if (variant === 'pane') return null
    return (
      <div className={ROOT_CLASS} ref={panelRef}>
        <style>{globalStyles}</style>
        <div className={shellClass}>
          <p className="wou-muted">{strings.notOnThisProfile}</p>
        </div>
      </div>
    )
  }

  return (
    <AnswerContext.Provider value={answerControls}>
    <HostPresenceProvider>
    <div className={`${ROOT_CLASS} wou-layout-${layout}`} ref={panelRef} tabIndex={-1}>
      <style>{globalStyles}</style>
      <div className={shellClass}>
        <header className="wou-header">
          <div className="wou-header-row1">
            <h1 className="wou-title">{strings.pluginName}</h1>
            {updated ? (
              <span className="wou-header-updated wou-muted">{updated}</span>
            ) : null}
            {offline ? (
              <span className="wou-header-status wou-muted" role="status">{strings.offline}</span>
            ) : null}
            {modeLabel ? (
              <span className="wou-header-status wou-muted">{modeLabel}</span>
            ) : null}
            {capReached ? (
              <span className="wou-header-status wou-muted">{strings.headerDailyLimit}</span>
            ) : null}
            <div className="wou-header-actions">
              {consented && !settingsView && !teachView && !onboarding ? (
                <button type="button" className="wou-link" aria-pressed={catchUpView}
                  onClick={() => {
                    if (!catchUpView) {
                      setCatchUpProjectKey(projectFilter === 'all' || projectFilter.length !== 1 || projectFilter[0] === 'none' ? null : projectFilter[0])
                      setIncludeClosed(false)
                      closeSearch()
                      void loadProjects()
                    }
                    setCatchUpView(open => !open)
                  }}>Catch up</button>
              ) : null}
              {desktopPanel && !catchUpView ? (
                <button
                  type="button"
                  className="wou-icon-btn"
                  onClick={() => openSearch()}
                  aria-label={strings.searchOpen}
                  title={strings.searchOpen}
                >
                  <IconSearch />
                </button>
              ) : null}
              {!includeClosed && !showFirstRun && !fullView && !searchOpen ? (
                <button
                  type="button"
                  className={`wou-icon-btn wou-filter-btn${filtersActive || sortOrder !== 'newest' ? ' wou-filter-btn-on' : ''}`}
                  onClick={toggleFiltersOpen}
                  aria-expanded={filtersOpen}
                  aria-controls="wou-filter-row"
                  aria-label={filtersActive ? strings.filtersButtonActive : strings.filtersButton}
                  title={filtersActive ? strings.filtersButtonActive : strings.filtersButton}
                >
                  <IconFilter />
                </button>
              ) : null}
              <button
                type="button"
                className="wou-icon-btn"
                onClick={() => void onScan()}
                disabled={scanning}
                aria-busy={scanning}
                aria-label={strings.scanNow}
                title={strings.scanNow}
              >
                <IconRefresh className={scanning ? 'wou-icon-spin' : undefined} />
              </button>
              <button
                type="button"
                className="wou-icon-btn"
                onClick={() => toggleSettings()}
                aria-label={strings.settings}
                aria-pressed={settingsView}
                title={strings.settings}
              >
                <IconGear />
              </button>
              {desktopPanel && onHidePane ? (
                <button
                  type="button"
                  className="wou-icon-btn"
                  onClick={onHidePane}
                  aria-label={strings.hidePaneHeader}
                  title={strings.hidePaneHeader}
                >
                  <IconPanelHide />
                </button>
              ) : null}
            </div>
          </div>
          {scanNotice === 'capped' && !scanning ? (
            <div className="wou-scan-banner" role="status">
              <span>{strings.scanCapped}</span>
              <button type="button" className="wou-link" onClick={() => void runScan(true)}>
                {strings.scanAnyway}
              </button>
            </div>
          ) : null}
          {scanNotice === 'locked' && !scanning ? (
            <div className="wou-scan-banner" role="status">
              <span>{strings.scanLocked}</span>
              <button type="button" className="wou-link" onClick={() => void runScan(true)}>
                {strings.scanTryAgain}
              </button>
            </div>
          ) : null}
          {scanNotice === 'off' ? (
            <div className="wou-scan-banner" role="status">
              <span>{strings.scanUpdatesOff}</span>
              <button type="button" className="wou-link" onClick={() => openSettings()}>
                {strings.settings}
              </button>
            </div>
          ) : null}
          {offline || showFirstRun
            ? null
            : offlineMachines(lastScan?.errors).map((machine) => (
                <div key={machine.name} className="wou-scan-banner wou-scan-banner-warn" role="status">
                  <span>{offlineLine(machine)}</span>
                  <button type="button" className="wou-link" onClick={() => openSettings()}>
                    {strings.settings}
                  </button>
                </div>
              ))}
          {offline || showFirstRun ? null : storageLabelWarnings(lastScan?.errors).map((warning) => (
            <div key={warning.name ?? 'default'} className="wou-scan-banner wou-scan-banner-warn" role="status">
              {storageLabelWarningLine(warning)}
            </div>
          ))}
          {scanning ? (
            <p className="wou-muted wou-scan-banner" role="status">{strings.scanningHint}</p>
          ) : null}
          {!showFirstRun && !fullView && searchOpen ? (
            <div className="wou-search-row">
              <div className="wou-search-row-main">
                <input
                  ref={searchInputRef}
                  type="search"
                  className="wou-search-input"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder={strings.searchPlaceholder}
                  aria-label={strings.searchAria}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      closeSearch()
                    }
                  }}
                />
                <label className="wou-search-include">
                  <input
                    type="checkbox"
                    checked={searchIncludeClosed}
                    onChange={e => setSearchIncludeClosed(e.target.checked)}
                  />
                  {strings.searchIncludeClosed}
                </label>
                <button
                  type="button"
                  className="wou-icon-btn wou-search-close"
                  onClick={() => closeSearch()}
                  aria-label={strings.searchClose}
                  title={strings.searchClose}
                >
                  ×
                </button>
              </div>
              {searchFilterLabel ? (
                <p className="wou-search-filtered wou-muted">
                  <span>
                    {strings.searchFilteredPrefix} {searchFilterLabel}
                  </span>
                  <button type="button" className="wou-link" onClick={clearFilters}>
                    {strings.clearFilters}
                  </button>
                </p>
              ) : null}
            </div>
          ) : null}
          {!includeClosed && !showFirstRun && !fullView && !searchOpen && !filtersOpen && searchFilterLabel ? (
            <p className="wou-filter-summary wou-muted">
              <button type="button" className="wou-link wou-filter-summary-text" onClick={toggleFiltersOpen} title={searchFilterLabel}>
                {strings.filtersSummary}: {searchFilterLabel}
              </button>
              <button type="button" className="wou-link wou-clear-filters" onClick={clearFilters}>
                {strings.clearFilters}
              </button>
            </p>
          ) : null}
          {!includeClosed && !showFirstRun && !fullView && !searchOpen && filtersOpen ? (
            <div className="wou-header-row2" id="wou-filter-row">
              <select
                className="wou-select"
                value={agentFilter === 'all' ? 'all' : agentFilter}
                onChange={e => {
                  const v = e.target.value
                  const next: AgentFilter = v === 'all' ? 'all' : v
                  setAgentFilter(next)
                  ctx.storage.set(STORAGE_AGENT_FILTER, next)
                }}
                aria-label={strings.agentFilterLabel}
                title={strings.agentFilterLabel}
              >
                <option value="all">{formatAllAgentsLabel(allCounts)}</option>
                {agentOptions.map(({ agent, counts }) => (
                  <option key={agent} value={agent}>
                    {formatAgentOptionLabel(agent, counts)}
                  </option>
                ))}
              </select>
              <ProjectFilterMenu
                filter={projectFilter}
                projects={projects}
                noProjectCount={noProjectCount}
                onOpen={() => void loadProjects()}
                onChange={next => {
                  setProjectFilter(next)
                  ctx.storage.set(STORAGE_PROJECT_FILTER, next)
                }}
              />
              <TagFilterMenu
                filter={tagFilter}
                tags={tags}
                onOpen={() => void loadTags()}
                onChange={next => {
                  setTagFilter(next)
                  ctx.storage.set(STORAGE_TAG_FILTER, next)
                }}
              />
              <select
                className="wou-select"
                value={sortOrder}
                onChange={e => onSortChange(e.target.value as SortOrder)}
                aria-label={strings.sortLabel}
                title={strings.sortLabel}
              >
                <option value="newest">{strings.sortNewest}</option>
                <option value="oldest">{strings.sortOldest}</option>
              </select>
              {filtersActive ? (
                <button type="button" className="wou-link wou-clear-filters" onClick={clearFilters}>
                  {strings.clearFilters}
                </button>
              ) : null}
            </div>
          ) : null}
        </header>

        <div className="wou-scroll" ref={scrollRef}>
          {showTeachCard({
            desktop: desktopPanel, consented, scanned: lastScan != null || scanCompleted,
            availability: teachAvailability, resolved: teachResolved, onboarding,
            settings: settingsView || catchUpView, teaching: teachView, searching: searchActive, closed: includeClosed,
          }) ? (
            <aside className="wou-teach-prompt" aria-labelledby="wou-teach-prompt-title">
              <button type="button" className="wou-icon-btn wou-teach-prompt-close"
                aria-label={strings.teachCardDismiss} onClick={() => dismissTeachCard('dismiss')}>×</button>
              <h2 id="wou-teach-prompt-title">{strings.teachCardTitle}</h2>
              <p className="wou-muted">{strings.teachCardIntro}</p>
              <div className="wou-teach-prompt-actions">
                <button type="button" className="wou-btn-compact" onClick={openTeach}>{strings.teachCardStart}</button>
                <button type="button" className="wou-link" onClick={() => dismissTeachCard('not-now')}>{strings.teachCardNotNow}</button>
              </div>
            </aside>
          ) : null}
          {settingsView && settingsBundle ? (
            <SettingsView
              ctx={ctx}
              bundle={settingsBundle}
              tags={tags}
              onCreateTag={onCreateTag}
              onPatchTag={onPatchTag}
              onDeleteTag={tag => void onDeleteTag(tag)}
              onAddSuggestedTag={onAddSuggestedTag}
              onBundleChange={setSettingsBundle}
              onOpenTeach={openTeach}
              onBack={() => {
                setSettingsView(false)
                void loadSettingsBundle()
              }}
            />
          ) : settingsView ? (
            <div className="wou-settings-loading" role="status">
              <p className="wou-muted">{strings.settingsLoading}</p>
              {settingsLoadError ? (
                <p>
                  {settingsLoadError}{' '}
                  <button
                    type="button"
                    className="wou-link"
                    onClick={() => void loadSettingsBundle()}
                  >
                    {strings.retry}
                  </button>
                </p>
              ) : null}
            </div>
          ) : teachView ? (
            <TeachPrioritiesView
              ctx={ctx}
              now={now}
              scanning={scanning}
              onBack={finishTeach}
              onAnswered={onTeachAnswerSaved}
            />
          ) : onboarding && !showFirstRun ? (
            <FirstRunSteps
              ctx={ctx}
              tags={tags}
              scanning={scanning}
              teachAvailability={teachAvailability}
              onAddTag={onAddSuggestedTag}
              onTeachNow={openTeach}
              onFinish={() => setOnboarding(false)}
            />
          ) : showFirstRun && settingsBundle ? (
            <FirstRunScreen
              settings={settingsBundle.settings}
              model={settingsBundle.model}
              scanning={scanning}
              onStart={() => void onFirstRunStart()}
              onChangeSettings={() => openSettings()}
            />
          ) : catchUpView && consented ? (
            <CatchUpView
              projects={projects}
              projectKey={catchUpProjectKey}
              onProjectChange={setCatchUpProjectKey}
              tasks={openTasksBase}
              ready={projectsReady && projectsFetchSucceeded && fetchSucceeded}
              offline={offline}
              consented={consented}
              projectsFetchSucceeded={projectsFetchSucceeded}
              tasksFetchSucceeded={fetchSucceeded}
              projectsError={projectsLoadError}
              onRetryProjects={() => void loadProjects()}
              renderTask={renderTaskRow}
              onBack={() => setCatchUpView(false)}
            />
          ) : !includeClosed ? (
            showSearchEmpty ? (
              <div className="wou-search-empty">
                <p>{strings.searchNoMatch(debouncedSearchInput.trim())}</p>
                <button type="button" className="wou-link" onClick={() => closeSearch()}>
                  {strings.searchClear}
                </button>
              </div>
            ) : openTasks.length === 0 && !searchActive ? (
              <div className="wou-list-empty">
                <p>{strings.listEmpty}</p>
                {relative ? (
                  <p className="wou-muted">{strings.listEmptyScan(relative)}</p>
                ) : null}
              </div>
            ) : (
            <>
              {nextUp ? (
                <NextUpCard
                  ctx={ctx}
                  task={nextUp.task}
                  pendingLabel={pending[nextUp.task.id]}
                  disabled={checkboxGuard}
                  onDone={onDone}
                  onSnooze={onSnooze}
                >
                  {renderTaskRow(nextUp.task, true, nextUp.group != null)}
                </NextUpCard>
              ) : null}
              {sections == null ? (
                <section className="wou-section wou-flat-list">
                  {flatDisplayEntries.map(entry => renderOpenEntry(entry))}
                </section>
              ) : (
                sections.map(({ key, title, entries: list }) => {
                  const count = quadrantEntryTaskCount(list)
                  if (searchActive && count === 0) return null
                  const isCollapsed = searchActive && count > 0 ? false : Boolean(collapsed[key])
                  const showAll = expandedSections[key]
                  const visible = searchActive || showAll ? list : list.slice(0, SECTION_PREVIEW)
                  const hidden = list.length - visible.length
                  const headingId = `wou-sec-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`
                  return (
                    <section key={key} className="wou-section" aria-labelledby={headingId}>
                      <button
                        type="button"
                        id={headingId}
                        className="wou-section-heading"
                        aria-expanded={!isCollapsed}
                        onClick={() => toggleCollapsed(key)}
                      >
                        <span
                          className={`wou-chevron${isCollapsed ? ' wou-chevron-collapsed' : ''}`}
                          aria-hidden="true"
                        >
                          ▼
                        </span>
                        <span>{title} ({sectionCountLabel(list)})</span>
                      </button>
                      {!isCollapsed ? (
                        count === 0 ? (
                          <p className="wou-muted">{strings.sectionEmpty}</p>
                        ) : (
                          <>
                            {visible.map(entry => renderOpenEntry(entry))}
                            {!searchActive && !showAll && hidden > 0 ? (
                              <button
                                type="button"
                                className="wou-link wou-show-all"
                                onClick={() => setExpandedSections(prev => ({ ...prev, [key]: true }))}
                              >
                                {sectionShowAllLabel(list)}
                              </button>
                            ) : null}
                          </>
                        )
                      ) : null}
                    </section>
                  )
                })
              )}
              {searchActive && searchIncludeClosed ? (
                <section className="wou-section" aria-labelledby="wou-sec-closed">
                  <div className="wou-section-heading" id="wou-sec-closed">
                    <span>
                      {strings.searchClosedSection} ({filteredClosedForSearch.length})
                    </span>
                  </div>
                  {filteredClosedForSearch.length === 0 ? (
                    <p className="wou-muted">{strings.sectionEmpty}</p>
                  ) : (
                    filteredClosedForSearch.map(task => (
                      <TaskRow
                        key={task.id}
                        ctx={ctx}
                        task={task}
                        allTags={tags}
                        nameAfterChat={nameAfterChat}
                        closed
                        highlightTokens={highlightTokens}
                        onDone={onDone}
                        onDismiss={onDismiss}
                        onSnooze={onSnooze}
                        onMoveQuadrant={onMoveQuadrant}
                        onToggleTag={(t, tag, state) => void onToggleTaskTag(t, tag, state)}
                        onCreateTag={onCreateTag}
                        onRename={onRename}
                        onReopen={onReopen}
                        onReload={() => void reload()}
                        showProjectChips={displayProjectChips}
                        showPriorities={showPriorities}
                        updatedNow={now}
                      />
                    ))
                  )}
                </section>
              ) : null}
            </>
            )
          ) : (
            <section className="wou-section">
              {closedTasks.length === 0 ? (
                <p className="wou-muted">{strings.sectionEmpty}</p>
              ) : (
                closedTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    ctx={ctx}
                    task={task}
                    allTags={tags}
                    nameAfterChat={nameAfterChat}
                    closed
                    showProjectChips={displayProjectChips}
                    showPriorities={showPriorities}
                    updatedNow={now}
                    onDone={onDone}
                    onDismiss={onDismiss}
                    onSnooze={onSnooze}
                    onMoveQuadrant={onMoveQuadrant}
                    onToggleTag={(t, tag, state) => void onToggleTaskTag(t, tag, state)}
                    onCreateTag={onCreateTag}
                    onRename={onRename}
                    onReopen={onReopen}
                    onReload={() => void reload()}
                  />
                ))
              )}
            </section>
          )}

          {!showFirstRun && !fullView ? (
            <footer className="wou-footer">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={includeClosed}
                  onChange={e => setIncludeClosed(e.target.checked)}
                  aria-label={includeClosed ? strings.hideClosed : strings.showClosed}
                />
                {includeClosed ? strings.hideClosed : strings.showClosed}
              </label>
              <p className="wou-muted" style={{ margin: '8px 0 0' }}>{strings.closedNote}</p>
            </footer>
          ) : null}

          {undoBarVisible && latestUndo ? (
            <div className="wou-undo" role="status">
              <span>
                {latestUndo.message}
                {moreUndo > 0 ? ` ${strings.undoMore(moreUndo)}` : ''}
              </span>
              <button type="button" onClick={() => void handleUndo()}>{strings.undo}</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
    </HostPresenceProvider>
    </AnswerContext.Provider>
  )
}
