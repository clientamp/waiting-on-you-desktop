import { host, useValue } from '@hermes/plugin-sdk'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'
import type { Task, TaskGroup, ListSection, QuadrantEntry } from '../model'
import type { AgentFilter, ProjectFilter, TagFilter } from '../model'
import { fetchSessionTasks } from './sessionApi'
import type { PluginContext } from '@hermes/plugin-sdk'
import {
  computeFollowUnhideActions,
  entryVisibleForFollow,
  findFollowTargetInTasks,
  followSelectionKey,
  type FocusedChatSelection,
  type FollowTarget,
} from './followChat'

const SECTION_PREVIEW = 15

export interface UseFollowSelectedChatArgs {
  ctx: PluginContext
  enabled: boolean
  desktopPane: boolean
  paneVisible: boolean
  tasks: Task[]
  groups: TaskGroup[]
  agentFilter: AgentFilter
  projectFilter: ProjectFilter
  tagFilter: TagFilter
  searchActive: boolean
  collapsed: Record<string, boolean>
  expandedSections: Record<string, boolean>
  groupExpanded: Record<string, boolean>
  /** Visible sections, or null for one flat list. */
  sections: ListSection[] | null
  flatDisplayEntries: QuadrantEntry[]
  scrollRef: RefObject<HTMLDivElement | null>
  onClearFilters: () => void
  onCloseSearch: () => void
  setCollapsed: Dispatch<SetStateAction<Record<string, boolean>>>
  setExpandedSections: Dispatch<SetStateAction<Record<string, boolean>>>
  setGroupExpanded: Dispatch<SetStateAction<Record<string, boolean>>>
  persistGroupExpanded: (next: Record<string, boolean>) => void
  persistCollapsed: (next: Record<string, boolean>) => void
  followExtraTasks: Task[]
  setFollowExtraTasks: Dispatch<SetStateAction<Task[]>>
  /** True (once) when the panel itself just opened this chat to send an answer.
   *  That selection is highlighted but doesn't scroll, clear filters or expand
   *  groups, so the list stays put. Later selections follow as normal. */
  takeQuietChat?: (chatKey: string) => boolean
}

export function useFollowSelectedChat({
  ctx,
  enabled,
  desktopPane,
  paneVisible,
  tasks,
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
  onClearFilters,
  onCloseSearch,
  setCollapsed,
  setExpandedSections,
  setGroupExpanded,
  persistGroupExpanded,
  persistCollapsed,
  followExtraTasks,
  setFollowExtraTasks,
  takeQuietChat,
}: UseFollowSelectedChatArgs): string | null {
  const sessionStoredAtom = host.state.focusedStoredSessionId
  const sessionActiveAtom = host.state.activeSessionId
  const profileAtom = host.state.focusedSessionProfile
  const ownerAtom = host.state.focusedSessionOwner
  const connectionAtom = host.state.connectionId

  const sessionStored = sessionStoredAtom ? useValue(sessionStoredAtom) : null
  const sessionActive = sessionActiveAtom ? useValue(sessionActiveAtom) : null
  const profile = profileAtom ? useValue(profileAtom) : null
  const owner = ownerAtom ? useValue(ownerAtom) : null
  const activeConnectionId = connectionAtom ? useValue(connectionAtom) : null

  const selection: FocusedChatSelection = {
    sessionId: sessionStored ?? sessionActive,
    profile,
    owner,
  }

  const selectionKey = followSelectionKey(selection)
  const active =
    enabled && desktopPane && paneVisible && selectionKey != null

  // The one selection the panel caused by opening a chat for an answer. Only that
  // selection is skipped; moving to any other chat clears it.
  const quietSelectionRef = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (quietSelectionRef.current !== selectionKey) quietSelectionRef.current = null
  }, [selectionKey])
  const isQuietSelection = useCallback(
    (chatKey: string, key: string) => {
      if (quietSelectionRef.current === key) return true
      if (takeQuietChat?.(chatKey)) {
        quietSelectionRef.current = key
        return true
      }
      return false
    },
    [takeQuietChat],
  )

  const [highlightedChatKey, setHighlightedChatKey] = useState<string | null>(
    null,
  )

  const lastSelectionKeyRef = useRef<string | null>(null)
  const scrolledForKeyRef = useRef<string | null>(null)
  const unhideAppliedForKeyRef = useRef<string | null>(null)
  const prevPaneVisibleRef = useRef(paneVisible)

  useEffect(() => {
    if (paneVisible && !prevPaneVisibleRef.current) {
      scrolledForKeyRef.current = null
      unhideAppliedForKeyRef.current = null
    }
    prevPaneVisibleRef.current = paneVisible
  }, [paneVisible])

  const allCandidateTasks = useMemo(() => {
    const map = new Map<number, Task>()
    for (const t of tasks) map.set(t.id, t)
    for (const t of followExtraTasks) map.set(t.id, t)
    return [...map.values()]
  }, [tasks, followExtraTasks])

  const target = active
    ? findFollowTargetInTasks(allCandidateTasks, groups, selection)
    : null

  useEffect(() => {
    if (!active || !selectionKey) {
      setFollowExtraTasks([])
      return
    }
    const inList = findFollowTargetInTasks(tasks, groups, selection)
    if (inList) {
      setFollowExtraTasks([])
      return
    }
    const sessionId = selection.sessionId
    if (!sessionId) return
    let cancelled = false
    void fetchSessionTasks(
      ctx,
      sessionId,
      selection.owner?.profile ?? selection.profile ?? 'default',
      selection.owner,
      activeConnectionId,
    ).then(res => {
      if (cancelled) return
      if (res.kind !== 'ok' || !res.data.tracked) {
        setFollowExtraTasks([])
        return
      }
      const open = res.data.tasks.filter(
        t => t.status !== 'done' && t.status !== 'dismissed',
      )
      setFollowExtraTasks(open)
    })
    return () => {
      cancelled = true
    }
  }, [
    active,
    selectionKey,
    ctx,
    tasks,
    groups,
    selection.sessionId,
    selection.profile,
    selection.owner,
    activeConnectionId,
    setFollowExtraTasks,
  ])

  useEffect(() => {
    if (!active) {
      setHighlightedChatKey(null)
      lastSelectionKeyRef.current = null
      scrolledForKeyRef.current = null
      unhideAppliedForKeyRef.current = null
      return
    }
    if (selectionKey !== lastSelectionKeyRef.current) {
      lastSelectionKeyRef.current = selectionKey
      scrolledForKeyRef.current = null
      unhideAppliedForKeyRef.current = null
    }
    setHighlightedChatKey(target?.chatKey ?? null)
  }, [active, selectionKey, target?.chatKey])

  const applyUnhide = useCallback(
    (t: FollowTarget) => {
      if (!selectionKey || unhideAppliedForKeyRef.current === selectionKey) return
      const actions = computeFollowUnhideActions(
        t,
        sections,
        {
          agentFilter,
          projectFilter,
          tagFilter,
          searchActive,
          collapsed,
          expandedSections,
          groupExpanded,
        },
        SECTION_PREVIEW,
      )
      if (
        actions.agentFilter !== undefined ||
        actions.projectFilter !== undefined ||
        actions.tagFilter !== undefined
      ) {
        onClearFilters()
      }
      if (actions.closeSearch) onCloseSearch()
      if (actions.collapsed) {
        setCollapsed(actions.collapsed)
        persistCollapsed(actions.collapsed)
      }
      if (actions.expandedSections) {
        setExpandedSections(actions.expandedSections)
      }
      if (actions.groupExpanded) {
        setGroupExpanded(actions.groupExpanded)
        persistGroupExpanded(actions.groupExpanded)
      }
      unhideAppliedForKeyRef.current = selectionKey
    },
    [
      selectionKey,
      sections,
      flatDisplayEntries,
      agentFilter,
      projectFilter,
      tagFilter,
      searchActive,
      collapsed,
      expandedSections,
      groupExpanded,
      onClearFilters,
      onCloseSearch,
      setCollapsed,
      setExpandedSections,
      setGroupExpanded,
      persistGroupExpanded,
      persistCollapsed,
    ],
  )

  useEffect(() => {
    if (!active || !target || !selectionKey) return
    if (isQuietSelection(target.chatKey, selectionKey)) return
    if (unhideAppliedForKeyRef.current !== selectionKey) {
      applyUnhide(target)
    }
  }, [active, target, selectionKey, applyUnhide, isQuietSelection])

  useLayoutEffect(() => {
    if (!active || !target || !selectionKey || !highlightedChatKey) return
    if (scrolledForKeyRef.current === selectionKey) return
    if (isQuietSelection(target.chatKey, selectionKey)) return

    const visible = entryVisibleForFollow(
      target,
      sections,
      flatDisplayEntries,
      SECTION_PREVIEW,
      expandedSections,
      collapsed,
    )
    if (!visible) return

    const root = scrollRef.current
    if (!root) return
    const el = root.querySelector<HTMLElement>(
      `[data-wou-follow-key="${CSS.escape(highlightedChatKey)}"]`,
    )
    if (!el) return

    const scrollParent = root
    const elRect = el.getBoundingClientRect()
    const parentRect = scrollParent.getBoundingClientRect()
    const offset =
      elRect.top -
      parentRect.top -
      parentRect.height / 2 +
      elRect.height / 2
    scrollParent.scrollTop += offset
    scrolledForKeyRef.current = selectionKey
  }, [
    active,
    target,
    selectionKey,
    highlightedChatKey,
    sections,
    flatDisplayEntries,
    expandedSections,
    collapsed,
    scrollRef,
    agentFilter,
    projectFilter,
    tagFilter,
    searchActive,
    groupExpanded,
    isQuietSelection,
  ])

  return active ? highlightedChatKey : null
}
