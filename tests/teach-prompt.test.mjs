import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const dir = await mkdtemp(join(tmpdir(), 'wou-teach-'))
await build({ entryPoints: ['src/ui/teachPrompt.ts'], outfile: `${dir}/logic.mjs`, bundle: true, platform: 'node', format: 'esm' })
const helpers = await import(`file://${dir}/logic.mjs`)
await rm(dir, { recursive: true, force: true })

test('Not now and Dismiss persist; only a session with saved answers resolves on exit', () => {
  const values = new Map()
  const storage = { get: (key, fallback) => values.get(key) ?? fallback, set: (key, value) => values.set(key, value) }
  for (const action of ['not-now', 'dismiss', 'session']) {
    values.clear()
    assert.equal(helpers.isTeachCardResolved(storage), false)
    assert.equal(helpers.resolveTeachCard(storage, action, 0), action !== 'session')
    assert.equal(helpers.isTeachCardResolved(storage), action !== 'session')
  }
  assert.equal(helpers.resolveTeachCard(storage, 'session', 1), true)
  assert.equal(helpers.isTeachCardResolved(storage), true)
  assert.equal(values.get('teach-card'), true)
  helpers.resolveTeachCard(storage, 'session', 0)
  assert.equal(helpers.isTeachCardResolved(storage), true)
})

import { readFile } from 'node:fs/promises'

test('panel wires readiness, local resolution, and session answer totals into the views', async () => {
  const panel = await readFile('src/ui/TasksPanel.tsx', 'utf8')
  const setup = await readFile('src/ui/FirstRunScreen.tsx', 'utf8')
  const teach = await readFile('src/ui/TeachPrioritiesView.tsx', 'utf8')
  assert.match(panel, /fetchQuiz\(ctx, 1\)/)
  assert.match(panel, /showTeachCard\(/)
  assert.match(panel, /resolveTeachCard\(ctx.storage/)
  assert.match(panel, /onBack=\{finishTeach\}/)
  assert.match(setup, /disabled=\{teachState !== 'ready'\}/)
  assert.match(setup, /strings.firstRunTeachEmpty/)
  assert.match(teach, /onBack\(sortedRef.current\)/)
  assert.match(teach, /sortedRef.current \+= 1/)
})

test('a saved answer resolves the card at once, whatever way teaching is left', async () => {
  const panel = await readFile('src/ui/TasksPanel.tsx', 'utf8')
  // A slow save can land after Done/Escape, and the Settings gear unmounts
  // the view without onBack. Resolve on the save itself, not on exit.
  assert.match(panel, /onAnswered=\{onTeachAnswerSaved\}/)
  const body = /const onTeachAnswerSaved = \(saved: boolean\) => \{([\s\S]*?)\n  \}/.exec(panel)?.[1] ?? ''
  assert.match(body, /saved && resolveTeachCard\(ctx\.storage, 'session', 1\)/)
  const teach = await readFile('src/ui/TeachPrioritiesView.tsx', 'utf8')
  // Tasks closed elsewhere refresh the list but are not answers.
  assert.match(teach, /dispatch\(\{ type: 'answered' \}\)\n\s*onAnswered\(true\)/)
  assert.match(teach, /dispatch\(\{ type: 'gone' \}\)\n\s*onAnswered\(false\)/)
  assert.match(body, /setTeachResolved\(true\)/)
  assert.match(body, /reload\(\)/)
})

const eligible = { desktop: true, consented: true, scanned: true, availability: 'ready', resolved: false, onboarding: false, settings: false, teaching: false, searching: false, closed: false }
test('card requires every eligibility condition and stays out of other views', () => {
  assert.equal(helpers.showTeachCard(eligible), true)
  for (const key of ['desktop', 'consented', 'scanned']) {
    assert.equal(helpers.showTeachCard({ ...eligible, [key]: false }), false, key)
  }
  for (const key of ['resolved', 'onboarding', 'settings', 'teaching', 'searching', 'closed']) {
    assert.equal(helpers.showTeachCard({ ...eligible, [key]: true }), false, key)
  }
  for (const availability of ['checking', 'empty', 'error']) {
    assert.equal(helpers.showTeachCard({ ...eligible, availability }), false, availability)
  }
})

test('first run waits for scan and quiz, then enables teaching only with tasks', () => {
  assert.equal(helpers.firstRunTeachState(true, 'ready'), 'waiting')
  assert.equal(helpers.firstRunTeachState(false, 'checking'), 'waiting')
  assert.equal(helpers.firstRunTeachState(false, 'ready'), 'ready')
  assert.equal(helpers.firstRunTeachState(false, 'empty'), 'empty')
  assert.equal(helpers.firstRunTeachState(false, 'error'), 'empty')
})
