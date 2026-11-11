import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('Kanban docs describe the view-only button without promising unseen card IDs', () => {
  const view = readFileSync('src/ui/CatchUpView.tsx', 'utf8')
  assert.match(view, /host\.navigate\('\/kanban'\)/)
  assert.match(view, /Opens Kanban only, not a specific board or card\./)

  const gaps = readFileSync('docs/known-gaps.md', 'utf8').split('\n')
    .find(line => line.startsWith('What you get instead:') && line.includes('Open Kanban'))
  const readiness = readFileSync('docs/readiness-manifest.md', 'utf8').split('\n')
    .find(line => line.startsWith('- **Open Kanban deep link**'))
  for (const [name, text] of [['known gaps', gaps], ['readiness manifest', readiness]]) {
    assert.ok(text, `${name} documents the Kanban button`)
    assert.match(text, /not a specific board or card/, `${name}: navigation is view-only`)
    assert.match(text, /board cards and card IDs are not shown/, `${name}: no card IDs are promised`)
  }
})
