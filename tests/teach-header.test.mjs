import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Teach priorities stays available without a panel header icon', async () => {
  const panel = await readFile('src/ui/TasksPanel.tsx', 'utf8')
  const header = panel.slice(panel.indexOf('<div className="wou-header-actions">'), panel.indexOf("{scanNotice === 'capped'"))
  assert.doesNotMatch(header, /IconQuadrants|teachOpen|openTeach/)
  assert.match(header, /IconSearch/)
  assert.match(header, /IconRefresh/)
  assert.match(header, /IconGear/)
  assert.match(panel, /onTeachNow=\{openTeach\}/)
  assert.match(panel, /<TeachPrioritiesView/)
  const settings = await readFile('src/ui/SettingsView.tsx', 'utf8')
  assert.match(settings, /strings\.teachFromSettings/)
  const entry = await readFile('src/hermes/entry.tsx', 'utf8')
  assert.match(entry, /strings\.paletteTeach/)
})
