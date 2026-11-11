import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function load(entry, name) {
  const dir = await mkdtemp(join(tmpdir(), 'wou-prio-'))
  const outfile = join(dir, `${name}.mjs`)
  await build({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'esm', target: 'es2022' })
  const mod = await import(new URL(`file://${outfile}`).href)
  await rm(dir, { recursive: true, force: true })
  return mod
}

const helpers = () => load('src/ui/priorityHelpers.ts', 'priorityHelpers')

const item = (id, quadrant = 2) => ({
  id,
  ask: `Ask ${id}`,
  context: null,
  chat_title: 'Chat',
  agent: 'Juno',
  project: null,
  quadrant,
  due_at: null,
})

test('parseQuizItems keeps well-formed rows and fills defaults', async () => {
  const { parseQuizItems } = await helpers()
  const rows = parseQuizItems({
    tasks: [
      { id: 1, ask: 'Reply to Sam', context: '  ', chat_title: 'Inbox', agent: 'Juno', project: 'Clients', quadrant: 1, due_at: 100 },
      { id: 'x', ask: 'bad id' },
      { id: 2, ask: 'No quadrant', quadrant: 9 },
    ],
  })
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    id: 1,
    ask: 'Reply to Sam',
    context: null,
    chat_title: 'Inbox',
    agent: 'Juno',
    project: 'Clients',
    quadrant: 1,
    due_at: 100,
  })
  assert.equal(rows[1].quadrant, 4)
  assert.equal(rows[1].project, null)
  assert.deepEqual(parseQuizItems(null), [])
  assert.deepEqual(parseQuizItems({ tasks: 'nope' }), [])
})

test('quizReducer walks a batch, counts answers but not skips, and ends', async () => {
  const { quizReducer, initialQuizState, currentQuizItem, quizProgressLabel } = await helpers()
  let s = quizReducer(initialQuizState, { type: 'loaded', items: [item(1), item(2), item(3)] })
  assert.equal(s.status, 'ready')
  assert.equal(currentQuizItem(s).id, 1)
  assert.equal(quizProgressLabel(s), 'Task 1 of 3')

  s = quizReducer(s, { type: 'submit' })
  assert.equal(s.busy, true)
  // A second submit while busy is ignored.
  assert.equal(quizReducer(s, { type: 'submit' }), s)
  s = quizReducer(s, { type: 'answered' })
  assert.equal(s.busy, false)
  assert.equal(s.sorted, 1)
  assert.equal(quizProgressLabel(s), 'Task 2 of 3')

  s = quizReducer(quizReducer(s, { type: 'submit' }), { type: 'skipped' })
  assert.equal(s.sorted, 1)
  assert.equal(currentQuizItem(s).id, 3)

  s = quizReducer(quizReducer(s, { type: 'submit' }), { type: 'gone' })
  assert.equal(s.status, 'done')
  assert.equal(s.sorted, 1)
  assert.equal(s.moreAvailable, null)
  assert.equal(currentQuizItem(s), null)

  s = quizReducer(s, { type: 'more', available: true })
  assert.equal(s.moreAvailable, true)

  // "Do 10 more": loading again keeps the running total.
  s = quizReducer(quizReducer(s, { type: 'load' }), { type: 'loaded', items: [item(4)] })
  assert.equal(s.status, 'ready')
  assert.equal(s.index, 0)
  s = quizReducer(quizReducer(s, { type: 'submit' }), { type: 'answered' })
  assert.equal(s.status, 'done')
  assert.equal(s.sorted, 2)
})

test('quizReducer: empty, load errors, and save errors that keep the task', async () => {
  const { quizReducer, initialQuizState, currentQuizItem } = await helpers()
  assert.equal(quizReducer(initialQuizState, { type: 'loaded', items: [] }).status, 'empty')

  const failed = quizReducer(initialQuizState, { type: 'loadFailed', error: 'Could not load' })
  assert.equal(failed.status, 'error')
  assert.equal(failed.error, 'Could not load')
  assert.equal(quizReducer(failed, { type: 'load' }).status, 'loading')

  let s = quizReducer(initialQuizState, { type: 'loaded', items: [item(1), item(2)] })
  s = quizReducer(quizReducer(s, { type: 'submit' }), { type: 'submitFailed', error: 'nope' })
  assert.equal(s.status, 'ready')
  assert.equal(s.busy, false)
  assert.equal(s.error, 'nope')
  assert.equal(currentQuizItem(s).id, 1)
  s = quizReducer(quizReducer(s, { type: 'submit' }), { type: 'answered' })
  assert.equal(s.error, null)

  // After a run, an empty next batch keeps the summary instead of the empty state.
  let run = quizReducer(initialQuizState, { type: 'loaded', items: [item(1)] })
  run = quizReducer(quizReducer(run, { type: 'submit' }), { type: 'answered' })
  run = quizReducer(quizReducer(run, { type: 'load' }), { type: 'loaded', items: [] })
  assert.equal(run.status, 'done')
  assert.equal(run.sorted, 1)
  assert.equal(run.moreAvailable, false)
})

test('quiz keys, labels, and meta line', async () => {
  const { quizKeyAction, filedAsLabel, quizMetaLine, QUADRANT_CHOICES } = await helpers()
  assert.equal(quizKeyAction({ key: '1' }), 1)
  assert.equal(quizKeyAction({ key: '4' }), 4)
  assert.equal(quizKeyAction({ key: 's' }), 'skip')
  assert.equal(quizKeyAction({ key: 'S' }), 'skip')
  assert.equal(quizKeyAction({ key: '5' }), null)
  assert.equal(quizKeyAction({ key: '1', metaKey: true }), null)
  assert.equal(quizKeyAction({ key: 's', ctrlKey: true }), null)
  assert.equal(filedAsLabel(2), 'Filed as: Important, not urgent')
  assert.equal(QUADRANT_CHOICES.length, 4)
  assert.equal(quizMetaLine({ chat_title: 'Inbox', agent: 'Juno', project: 'Clients' }), 'Inbox · Juno · Clients')
  assert.equal(quizMetaLine({ chat_title: '', agent: 'Juno', project: null }), 'Juno')
})

test('decision test results map to plain English', async () => {
  const { decisionTestMessage, decisionErrorMessage } = await helpers()
  assert.equal(decisionTestMessage({ ok: true, code: null, latency_ms: 312.4, model: 'm' }), 'Works — 312 ms')
  assert.equal(decisionTestMessage({ ok: true, code: null, latency_ms: null, model: null }), 'Works')
  assert.equal(decisionErrorMessage('http_401'), 'The key was rejected.')
  assert.equal(decisionErrorMessage('http_429'), 'Rate limited. Try again in a minute.')
  assert.equal(decisionErrorMessage('timeout'), 'No answer in time.')
  assert.equal(decisionErrorMessage('not_configured'), 'Pick a provider and add its key first.')
  assert.equal(decisionErrorMessage('http_500'), 'Test failed (http_500).')
  assert.equal(decisionErrorMessage(null), 'Test failed.')
  assert.equal(
    decisionTestMessage({ ok: false, code: 'timeout', latency_ms: 20000, model: null }),
    'No answer in time.',
  )
})

test('charCounter counts characters against the limit', async () => {
  const { charCounter, PRIORITIES_NOTE_MAX } = await helpers()
  assert.equal(PRIORITIES_NOTE_MAX, 1000)
  assert.deepEqual(charCounter('', 1000), { label: '0 / 1,000', over: false, near: false })
  assert.equal(charCounter('a'.repeat(900), 1000).near, true)
  assert.equal(charCounter('a'.repeat(1000), 1000).over, false)
  const over = charCounter('a'.repeat(1001), 1000)
  assert.equal(over.over, true)
  assert.equal(over.label, '1,001 / 1,000')
  // Emoji count as one character each.
  assert.equal(charCounter('👍👍', 10).label, '2 / 10')
})

test('tag suggestions: parse, dedupe against your tags, edit, add all', async () => {
  const {
    parseSuggestions,
    initSuggestionRows,
    editSuggestionName,
    setSuggestionStatus,
    rowsToAddAll,
    nameClashes,
    pendingSuggestionCount,
    validateTagName,
  } = await helpers()
  const parsed = parseSuggestions({
    suggestions: [
      { name: ' Clients ', color: 'blue', hint: 'Client work', example_count: 4 },
      { name: 'clients', color: 'red', hint: '', example_count: 1 },
      { name: 'Family', color: 'not-a-color', hint: 'Home', example_count: 2 },
      { name: 'Content', color: 'green', hint: 'Videos', example_count: 3 },
      { name: '', color: 'green' },
    ],
  })
  assert.equal(parsed.length, 4)
  assert.equal(parsed[0].name, 'Clients')
  assert.equal(parsed[2].color, 'gray')

  let rows = initSuggestionRows(parsed, ['content'])
  assert.deepEqual(rows.map(r => r.name), ['Clients', 'Family'])
  assert.equal(pendingSuggestionCount(rows), 2)

  rows = editSuggestionName(rows, rows[1].key, 'Home')
  assert.equal(rows[1].name, 'Home')
  assert.equal(nameClashes(rows[1], ['home']), true)
  assert.equal(nameClashes(rows[0], ['home']), false)

  rows = setSuggestionStatus(rows, rows[0].key, 'added')
  assert.equal(pendingSuggestionCount(rows), 1)
  assert.deepEqual(rowsToAddAll(rows, []).map(r => r.name), ['Home'])
  assert.deepEqual(rowsToAddAll(rows, ['Home']), [])

  rows = editSuggestionName(rows, rows[1].key, '   ')
  assert.equal(validateTagName(rows[1].name), 'Use 1 to 32 characters.')
  assert.deepEqual(rowsToAddAll(rows, []), [])

  rows = setSuggestionStatus(rows, rows[1].key, 'skipped')
  assert.equal(pendingSuggestionCount(rows), 0)
})

test('rowsToAddAll skips duplicates created by edits', async () => {
  const { initSuggestionRows, editSuggestionName, rowsToAddAll } = await helpers()
  let rows = initSuggestionRows(
    [
      { name: 'A', color: 'red', hint: '', example_count: 0 },
      { name: 'B', color: 'blue', hint: '', example_count: 0 },
    ],
    [],
  )
  rows = editSuggestionName(rows, rows[1].key, 'a')
  assert.deepEqual(rowsToAddAll(rows, []).map(r => r.name), ['A'])
})

test('requestTeach waits for the panel to register', async () => {
  const { requestTeach, registerTeachHandler } = await load('src/ui/undo.ts', 'undo')
  let calls = 0
  requestTeach()
  assert.equal(calls, 0)
  registerTeachHandler(() => calls++)
  assert.equal(calls, 1)
  requestTeach()
  assert.equal(calls, 2)
  registerTeachHandler(null)
  registerTeachHandler(() => calls++)
  // No request was waiting, so registering again does nothing.
  assert.equal(calls, 2)
})
