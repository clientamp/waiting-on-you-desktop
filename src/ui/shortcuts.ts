import { strings } from './strings'

export const PLUGIN_ID = 'waiting-on-you-desktop'
export const TASKS_CHANGED_EVENT = `plugin.${PLUGIN_ID}.tasks.changed`
export const SETTINGS_CHANGED_EVENT = `plugin.${PLUGIN_ID}.settings.changed`

export interface KeybindDefinition {
  /** Hermes registration slot id (e.g. `open-keybind`). */
  registerSlotId: string
  /** Keybind id passed to Hermes (`waiting-on-you.open-keybind`). */
  keybindId: string
  /** Label in Desktop keyboard settings and keybind picker. */
  keybindLabel: string
  /** Shorter label in plugin Settings. */
  settingsLabel: string
  /** Command palette entry label, when registered. */
  paletteLabel?: string
  defaults: [string]
  category: 'view'
}

export const KEYBIND_DEFINITIONS: KeybindDefinition[] = [
  {
    registerSlotId: 'open-keybind',
    keybindId: `${PLUGIN_ID}.open-keybind`,
    keybindLabel: strings.keybindOpen,
    settingsLabel: strings.settingsShortcutOpen,
    defaults: ['mod+alt+y'],
    category: 'view',
  },
  {
    registerSlotId: 'undo-keybind',
    keybindId: `${PLUGIN_ID}.undo`,
    keybindLabel: strings.keybindUndoLabel,
    settingsLabel: strings.settingsShortcutUndo,
    paletteLabel: strings.paletteUndo,
    defaults: ['mod+z'],
    category: 'view',
  },
  {
    registerSlotId: 'toggle-priorities-keybind',
    keybindId: `${PLUGIN_ID}.toggle-priorities`,
    keybindLabel: strings.keybindTogglePriorities,
    settingsLabel: strings.settingsShortcutTogglePriorities,
    paletteLabel: strings.paletteTogglePriorities,
    defaults: ['mod+alt+p'],
    category: 'view',
  },
  {
    registerSlotId: 'toggle-project-badges-keybind',
    keybindId: `${PLUGIN_ID}.toggle-project-badges`,
    keybindLabel: strings.keybindToggleProjectBadges,
    settingsLabel: strings.settingsShortcutToggleProjectBadges,
    paletteLabel: strings.paletteToggleProjectBadges,
    defaults: ['mod+alt+b'],
    category: 'view',
  },
  {
    registerSlotId: 'toggle-groups-keybind',
    keybindId: `${PLUGIN_ID}.toggle-groups`,
    keybindLabel: strings.keybindToggleAllGroups,
    settingsLabel: strings.settingsShortcutToggleAllGroups,
    paletteLabel: strings.paletteToggleAllGroups,
    defaults: ['mod+alt+e'],
    category: 'view',
  },
  {
    registerSlotId: 'toggle-answer-bars-keybind',
    keybindId: `${PLUGIN_ID}.toggle-answer-bars`,
    keybindLabel: strings.keybindToggleAnswerBars,
    settingsLabel: strings.settingsShortcutToggleAnswerBars,
    paletteLabel: strings.paletteToggleAnswerBars,
    defaults: ['mod+alt+a'],
    category: 'view',
  },
  {
    registerSlotId: 'scan-keybind',
    keybindId: `${PLUGIN_ID}.scan`,
    keybindLabel: strings.keybindScan,
    settingsLabel: strings.settingsShortcutScan,
    paletteLabel: strings.paletteScan,
    defaults: ['mod+alt+r'],
    category: 'view',
  },
]

export interface SettingsShortcutRow {
  id: string
  label: string
  /** Hermes combo string, or plain text for non-keybind tips. */
  display: { kind: 'combo'; combo: string } | { kind: 'hint'; text: string }
}

export const SETTINGS_SHORTCUT_ROWS: SettingsShortcutRow[] = [
  ...KEYBIND_DEFINITIONS.map(def => ({
    id: def.keybindId,
    label: def.settingsLabel,
    display: { kind: 'combo' as const, combo: def.defaults[0] },
  })),
  {
    id: `${PLUGIN_ID}.answer-keys`,
    label: strings.settingsShortcutAnswerKeys,
    display: { kind: 'hint', text: strings.settingsShortcutAnswerKeysHint },
  },
  {
    id: `${PLUGIN_ID}.option-click-groups`,
    label: strings.settingsShortcutCollapseGroups,
    display: { kind: 'hint', text: strings.settingsShortcutCollapseGroupsHint },
  },
]

const MODIFIER_SYMBOLS: Record<string, string> = {
  mod: '⌘',
  alt: '⌥',
  shift: '⇧',
  ctrl: '⌃',
}

/** Split a Hermes combo into Mac-style key cap labels (e.g. mod+alt+p → ⌘, ⌥, P). */
export function comboToKeyCaps(combo: string): string[] {
  return combo
    .split('+')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const key = part.toLowerCase()
      if (key in MODIFIER_SYMBOLS) return MODIFIER_SYMBOLS[key]
      if (part.length === 1) return part.toUpperCase()
      return part.toUpperCase()
    })
}
