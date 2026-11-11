import { host, useValue, type HermesPlugin, type PluginContext } from '@hermes/plugin-sdk'
import { useSyncExternalStore } from 'react'
import { ComposerButton } from '../ui/ComposerButton'
import { TasksPanel } from '../ui/TasksPanel'
import { strings } from '../ui/strings'
import { KEYBIND_DEFINITIONS, PLUGIN_ID } from '../ui/shortcuts'
import { fetchSettings, parseGroupByFromSettings, patchSettings } from '../ui/api'
import { nextGroupByForPriorityToggle, type GroupBy } from '../model'
import { notify } from '../ui/notify'
import { IconChecklist } from '../ui/icons'
import {
  getBackendAvailable,
  probeBackend,
  subscribeBackendAvailable,
  watchRequestScope,
} from '../ui/backendGate'
import {
  decidePaneToggle,
  getPaneRegistered,
  setPaneRegistered,
  subscribePaneRegistered,
} from '../ui/paneToggle'
import {
  runRegisteredUndo,
  runRegisteredScan,
  runRegisteredToggleAllGroups,
  runRegisteredToggleAnswerBars,
  requestTeach,
} from '../ui/undo'

const ID = PLUGIN_ID
export const PANE_ID = `${ID}:tasks`
const PANE_HIDDEN_KEY = 'paneHidden'

const statusBarChipStyle: import('react').CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  padding: '0 6px',
  fontSize: '0.6875rem',
  color: 'var(--ui-text-tertiary)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
}

let paneDispose: (() => void) | null = null
let navDispose: (() => void) | null = null
let paneConcealed = false
let stopScopeWatch: (() => void) | null = null

function navItem() {
  return {
    id: 'nav',
    area: 'sidebar.nav',
    order: 40,
    data: { path: '/waiting-on-you', label: strings.pluginName, codicon: 'checklist' },
  }
}

function showNav(ctx: PluginContext) {
  if (navDispose) return
  navDispose = ctx.register(navItem())
}

function concealChrome(_ctx: PluginContext) {
  if (navDispose) {
    navDispose()
    navDispose = null
  }
  if (paneDispose) {
    paneDispose()
    paneDispose = null
    setPaneRegistered(false)
    paneConcealed = true
  }
}

function restoreChrome(ctx: PluginContext) {
  showNav(ctx)
  if (!paneConcealed) return
  paneConcealed = false
  if (!ctx.storage.get<boolean>(PANE_HIDDEN_KEY, false)) registerPaneContribution(ctx)
}

function onThisProfile(): boolean {
  if (getBackendAvailable()) return true
  notify(strings.notOnThisProfile)
  return false
}

function registerPaneContribution(ctx: PluginContext) {
  if (paneDispose) return
  paneDispose = ctx.register({
    id: 'tasks',
    area: 'panes',
    title: strings.pluginName,
    data: { placement: 'right', width: '420px', hideOnly: true },
    render: () => <TasksPane ctx={ctx} onHidePane={() => hidePane(ctx)} />,
  })
  setPaneRegistered(true)
}

function hidePane(ctx: PluginContext, withNotify = true) {
  if (!paneDispose) return
  paneDispose()
  paneDispose = null
  setPaneRegistered(false)
  ctx.storage.set(PANE_HIDDEN_KEY, true)
  if (withNotify) notify(strings.paneHiddenNotify)
}

function showPane(ctx: PluginContext) {
  registerPaneContribution(ctx)
  ctx.storage.set(PANE_HIDDEN_KEY, false)
  setTimeout(() => host.revealPane(PANE_ID), 0)
}

function togglePane(ctx: PluginContext) {
  if (!onThisProfile()) return
  const registered = getPaneRegistered()
  const visible = host.paneVisibility(PANE_ID).get()
  const hasActiveSession = host.state.activeSessionId.get() != null
  const action = decidePaneToggle({ registered, visible, hasActiveSession })
  switch (action) {
    case 'hide':
      hidePane(ctx)
      break
    case 'show':
      showPane(ctx)
      break
    case 'reveal':
      host.revealPane(PANE_ID)
      break
    case 'navigate':
      host.navigate('/waiting-on-you')
      break
  }
}

function openWaitingOnYou(ctx: PluginContext) {
  if (!onThisProfile()) return
  const registered = getPaneRegistered()
  const hasActiveSession = host.state.activeSessionId.get() != null
  if (!registered) {
    if (hasActiveSession) showPane(ctx)
    else host.navigate('/waiting-on-you')
    return
  }
  if (hasActiveSession) host.revealPane(PANE_ID)
  else host.navigate('/waiting-on-you')
}

async function changeGroupBy(ctx: PluginContext, pick: (current: GroupBy) => GroupBy) {
  if (!onThisProfile()) return
  try {
    const bundle = await fetchSettings(ctx)
    const next = pick(parseGroupByFromSettings(bundle.settings))
    await patchSettings(ctx, { group_by: next })
    notify(
      next === 'none'
        ? strings.groupedByNone
        : next === 'project'
          ? strings.groupedByProject
          : strings.groupedByPriority,
    )
  } catch {
    notify(strings.patchError)
  }
}

async function toggleSettingsBool(
  ctx: PluginContext,
  key: 'show_project_badges',
  onMsg: string,
  offMsg: string,
) {
  if (!onThisProfile()) return
  try {
    const bundle = await fetchSettings(ctx)
    const next = !bundle.settings[key]
    await patchSettings(ctx, { [key]: next })
    notify(next ? onMsg : offMsg)
  } catch {
    notify(strings.patchError)
  }
}

function keybindRunner(
  ctx: PluginContext,
  keybindId: string,
): (() => void) | undefined {
  switch (keybindId) {
    case `${ID}.open-keybind`:
      return () => togglePane(ctx)
    case `${ID}.undo`:
      return () => {
        if (!onThisProfile()) return
        runRegisteredUndo()
      }
    case `${ID}.toggle-priorities`:
      return () => void changeGroupBy(ctx, nextGroupByForPriorityToggle)
    case `${ID}.toggle-project-badges`:
      return () =>
        void toggleSettingsBool(
          ctx,
          'show_project_badges',
          strings.projectBadgesOn,
          strings.projectBadgesOff,
        )
    case `${ID}.toggle-groups`:
      return () => {
        if (!onThisProfile()) return
        runRegisteredToggleAllGroups()
      }
    case `${ID}.toggle-answer-bars`:
      return () => {
        if (!onThisProfile()) return
        runRegisteredToggleAnswerBars()
      }
    case `${ID}.scan`:
      return () => {
        if (!onThisProfile()) return
        runRegisteredScan()
      }
    default:
      return undefined
  }
}

function paletteRunner(ctx: PluginContext, keybindId: string): (() => void) | undefined {
  const run = keybindRunner(ctx, keybindId)
  return run
}

function TasksPage({ ctx }: { ctx: PluginContext }) {
  return <TasksPanel ctx={ctx} variant="page" />
}

function TasksPane({
  ctx,
  onHidePane,
}: {
  ctx: PluginContext
  onHidePane: () => void
}) {
  const hostPaneVisible = useValue(host.paneVisibility(PANE_ID))
  return (
    <TasksPanel
      ctx={ctx}
      variant="pane"
      hostPaneVisible={hostPaneVisible}
      onHidePane={onHidePane}
    />
  )
}

function StatusBarPaneToggle({ onToggle }: { onToggle: () => void }) {
  const backendAvailable = useSyncExternalStore(
    subscribeBackendAvailable,
    getBackendAvailable,
    getBackendAvailable,
  )
  const registered = useSyncExternalStore(
    subscribePaneRegistered,
    getPaneRegistered,
    getPaneRegistered,
  )
  const visible = useValue(host.paneVisibility(PANE_ID))
  const pressed = registered && visible
  const title = pressed ? strings.statusBarHidePane : strings.statusBarShowPane
  if (!backendAvailable) return null

  return (
    <button
      type="button"
      onClick={onToggle}
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      style={statusBarChipStyle}
      onMouseEnter={e => {
        e.currentTarget.style.color = 'var(--foreground)'
        e.currentTarget.style.background = 'var(--chrome-action-hover)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'var(--ui-text-tertiary)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <span style={{ display: 'inline-flex', width: 14, height: 14 }}>
        <IconChecklist />
      </span>
    </button>
  )
}

const plugin: HermesPlugin = {
  id: ID,
  name: strings.pluginName,
  defaultEnabled: false,
  register(ctx: PluginContext) {
    // A disable/enable or hot reload may reuse this module: drop any stale
    // handle from a previous ctx so the pane can register again.
    paneDispose = null
    navDispose = null
    paneConcealed = false
    stopScopeWatch?.()
    stopScopeWatch = null
    ctx.onDispose(() => {
      paneDispose = null
      navDispose = null
      paneConcealed = false
      stopScopeWatch?.()
      stopScopeWatch = null
      setPaneRegistered(false)
    })
    const paneHidden = ctx.storage.get<boolean>(PANE_HIDDEN_KEY, false)
    if (!paneHidden) {
      registerPaneContribution(ctx)
    } else {
      setPaneRegistered(false)
    }

    const keybindRegistrations = KEYBIND_DEFINITIONS.flatMap(def => {
      const run = keybindRunner(ctx, def.keybindId)
      if (!run) return []
      const items: Parameters<PluginContext['registerMany']>[0] = [
        {
          id: def.registerSlotId,
          area: 'keybinds',
          data: {
            id: def.keybindId,
            label: def.keybindLabel,
            category: def.category,
            defaults: def.defaults,
            run,
          },
        },
      ]
      if (def.paletteLabel) {
        const paletteId = def.registerSlotId.replace(/-keybind$/, '-palette')
        const actionSuffix = def.keybindId.replace(`${ID}.`, '')
        items.push({
          id: paletteId,
          area: 'palette',
          data: {
            id: `${ID}.${actionSuffix.replace(/-keybind$/, '')}-palette`,
            action: `${ID}.${actionSuffix.replace(/-keybind$/, '')}`,
            label: def.paletteLabel,
            keywords: [...strings.paletteKeywords],
            run: paletteRunner(ctx, def.keybindId)!,
          },
        })
      }
      return items
    })

    // Palette entries need extra keywords per action (preserve prior behavior).
    const paletteKeywordExtras: Record<string, string[]> = {
      [`${ID}.undo-palette`]: ['undo'],
      [`${ID}.toggle-priorities-palette`]: ['priorities', 'quadrant'],
      [`${ID}.toggle-project-badges-palette`]: ['project', 'badge'],
      [`${ID}.toggle-groups-palette`]: ['expand', 'collapse', 'groups'],
      [`${ID}.toggle-answer-bars-palette`]: ['answer', 'reply', 'yes', 'no', 'buttons'],
      [`${ID}.scan-palette`]: ['scan', 'refresh'],
    }
    for (const item of keybindRegistrations) {
      if (item.area !== 'palette' || !item.data || !('keywords' in item.data)) continue
      const extra = paletteKeywordExtras[item.data.id as string]
      if (extra) item.data.keywords = [...strings.paletteKeywords, ...extra]
    }

    ctx.registerMany([
      {
        id: 'page',
        area: 'routes',
        title: strings.pluginName,
        data: { path: '/waiting-on-you' },
        render: () => <TasksPage ctx={ctx} />,
      },
      {
        id: 'palette-open',
        area: 'palette',
        data: {
          id: `${ID}.open`,
          action: `${ID}.open`,
          label: strings.paletteOpen,
          keywords: [...strings.paletteKeywords],
          run: () => openWaitingOnYou(ctx),
        },
      },
      {
        id: 'palette-toggle-panel',
        area: 'palette',
        data: {
          id: `${ID}.open-palette`,
          action: `${ID}.open-keybind`,
          label: strings.paletteTogglePanel,
          keywords: [...strings.paletteKeywords, 'show', 'hide', 'toggle', 'panel'],
          run: () => togglePane(ctx),
        },
      },
      ...keybindRegistrations,
      {
        id: 'palette-group-by-project',
        area: 'palette',
        data: {
          id: `${ID}.group-by-project-palette`,
          action: `${ID}.group-by-project`,
          label: strings.paletteGroupByProject,
          keywords: [...strings.paletteKeywords, 'group', 'project', 'sections'],
          run: () => void changeGroupBy(ctx, () => 'project'),
        },
      },
      {
        id: 'palette-teach',
        area: 'palette',
        data: {
          id: `${ID}.teach-palette`,
          action: `${ID}.teach`,
          label: strings.paletteTeach,
          keywords: [...strings.paletteKeywords, 'teach', 'priorities', 'sort', 'quiz', 'train'],
          run: () => {
            if (!getBackendAvailable()) {
              notify(strings.notOnThisProfile)
              return
            }
            openWaitingOnYou(ctx)
            requestTeach()
          },
        },
      },
      {
        id: 'composer-button',
        area: 'composer.actions',
        order: 50,
        render: () => <ComposerButton ctx={ctx} />,
      },
    ])

    ctx.register({
      id: 'statusbar-toggle',
      area: 'statusBar.right',
      order: 90,
      render: () => <StatusBarPaneToggle onToggle={() => togglePane(ctx)} />,
    })

    showNav(ctx)
    if (!getBackendAvailable()) concealChrome(ctx)
    const applyAvailability = (next: boolean) => {
      if (next) restoreChrome(ctx)
      else concealChrome(ctx)
    }
    const stopAvailability = subscribeBackendAvailable(() => applyAvailability(getBackendAvailable()))
    const refresh = () => {
      if (typeof ctx.rest !== 'function') return
      void probeBackend((path, options) => ctx.rest(path, options))
    }
    const stopAtoms = watchRequestScope(
      [
        host.state.profile,
        host.state.connectionId,
        host.state.focusedSessionProfile,
        host.state.focusedSessionOwner,
      ],
      refresh,
    )
    stopScopeWatch = () => {
      stopAvailability()
      stopAtoms()
    }
    refresh()
  },
}

export default plugin
