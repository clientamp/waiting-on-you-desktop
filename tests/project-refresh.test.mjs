import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const panel = readFileSync('src/ui/TasksPanel.tsx', 'utf8')

test('a finished scan and a tasks-changed event both reload the project catalog', () => {
  const summaryStart = panel.indexOf('const handleScanSummary')
  const summaryEnd = panel.indexOf('const runScan', summaryStart)
  const summary = panel.slice(summaryStart, summaryEnd)
  assert.match(summary, /void loadProjects\(\)/)

  const tasksEffectStart = panel.indexOf('useRetryUntilSuccess(loadProjects, projectsReady)')
  assert.notEqual(tasksEffectStart, -1, 'projects retry hook')
  const tasksEffectAnchor = panel.indexOf('const onTasks = () => { void loadProjects() }', tasksEffectStart)
  assert.notEqual(tasksEffectAnchor, -1, 'tasks-changed reload callback')
  const tasksEffectEnd = panel.indexOf('}, [ctx, loadProjects])', tasksEffectAnchor)
  assert.notEqual(tasksEffectEnd, -1, 'tasks-changed effect bounds')
  const tasksChangedEffect = panel.slice(tasksEffectAnchor, tasksEffectEnd)
  assert.match(tasksChangedEffect, /void loadProjects\(\)/)
  assert.match(tasksChangedEffect, /ctx\.onEvent\(TASKS_CHANGED_EVENT, onTasks\)/)
  assert.match(tasksChangedEffect, /TASKS_CHANGED_WINDOW_EVENT, onTasks\)/)
})
