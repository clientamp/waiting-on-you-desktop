import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function loadModel() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-model-'))
  const outfile = join(dir, 'model.mjs')
  await build({
    entryPoints: ['src/model.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'es2022',
  })
  const url = new URL(`file://${outfile}`)
  const mod = await import(url.href)
  await rm(dir, { recursive: true, force: true })
  return mod
}

test('groupByQuadrant sorts by created_at newest first within quadrant', async () => {
  const { groupByQuadrant } = await loadModel()
  const tasks = [
    { id: 1, quadrant: 1, created_at: 10 },
    { id: 2, quadrant: 1, created_at: 30 },
    { id: 3, quadrant: 2, created_at: 5 },
    { id: 4, quadrant: 1, created_at: 20 },
  ].map(t => ({ ...t, chat_key: 'a', agent: 'Main', chat_title: 'T', ask: 'x', topic: 't', status: 'open', snooze_until: null, source_msg_id: null, updated_at: 0, fingerprint: 'f', quadrant_locked: false }))
  const g = groupByQuadrant(tasks)
  assert.deepEqual(g[1].map(x => x.id), [2, 4, 1])
  assert.deepEqual(g[2].map(x => x.id), [3])
  assert.equal(g[3].length, 0)
  assert.equal(g[4].length, 0)
})

test('groupByQuadrant oldest first', async () => {
  const { groupByQuadrant } = await loadModel()
  const tasks = [
    { id: 1, quadrant: 1, created_at: 10 },
    { id: 2, quadrant: 1, created_at: 30 },
    { id: 4, quadrant: 1, created_at: 20 },
  ].map(t => ({ ...t, chat_key: 'a', agent: 'Main', chat_title: 'T', ask: 'x', topic: 't', status: 'open', snooze_until: null, source_msg_id: null, updated_at: 0, fingerprint: 'f', quadrant_locked: false }))
  const g = groupByQuadrant(tasks, 'oldest')
  assert.deepEqual(g[1].map(x => x.id), [1, 4, 2])
})

test('snoozeTimes — Sunday -> next Monday is tomorrow 8 AM', async () => {
  const { snoozeTimes } = await loadModel()
  const now = new Date(2026, 9, 25, 14, 0, 0) // Sunday Oct 25 2026
  assert.equal(now.getDay(), 0)
  const t = snoozeTimes(now)
  const monday = new Date(t.nextMonday * 1000)
  assert.equal(monday.getDay(), 1)
  assert.equal(monday.getDate(), 26)
  assert.equal(monday.getHours(), 8)
})

test('snoozeTimes — Monday -> next Monday is following week', async () => {
  const { snoozeTimes } = await loadModel()
  const now = new Date(2026, 9, 26, 10, 0, 0) // Monday Oct 26 2026
  assert.equal(now.getDay(), 1)
  const t = snoozeTimes(now)
  const monday = new Date(t.nextMonday * 1000)
  assert.equal(monday.getDate(), 2)
  assert.equal(monday.getMonth(), 10) // November
})

test('relativeTime', async () => {
  const { relativeTime } = await loadModel()
  const now = new Date(2026, 0, 15, 12, 0, 0)
  assert.equal(relativeTime(now.getTime() / 1000 - 10, now), 'just now')
  assert.equal(relativeTime(now.getTime() / 1000 - 180, now), '3 min ago')
  assert.equal(relativeTime(now.getTime() / 1000 - 7200, now), '2 h ago')
  const yesterday = new Date(2026, 0, 14, 18, 0, 0)
  assert.equal(relativeTime(yesterday.getTime() / 1000, now), 'yesterday')
  assert.equal(relativeTime(NaN, now), '')
  assert.equal(relativeTime(Infinity, now), '')
})

test('formatUpdated boundaries', async () => {
  const { formatUpdated } = await loadModel()
  const now = new Date(2026, 9, 24, 12, 0, 0) // Oct 24 2026
  const epoch = (offsetSec) => Math.floor(now.getTime() / 1000) - offsetSec
  assert.equal(formatUpdated(epoch(59), now), 'just now')
  assert.equal(formatUpdated(epoch(59 * 60), now), '59 min ago')
  assert.equal(formatUpdated(epoch(23 * 3600), now), '23 hours ago')
  assert.equal(formatUpdated(epoch(25 * 3600), now), 'Oct 23')
  const lastYear = new Date(2025, 9, 22, 12, 0, 0)
  assert.equal(formatUpdated(Math.floor(lastYear.getTime() / 1000), now), 'Oct 22, 2025')
  assert.equal(formatUpdated(epoch(3600), now), '1 hour ago')
})

test('flattenQuadrantEntries merges quadrants by sort order', async () => {
  const { flattenQuadrantEntries, buildQuadrantEntries } = await loadModel()
  const base = {
    chat_key: 'a',
    agent: 'Main',
    chat_title: 'T',
    ask: 'x',
    topic: 't',
    status: 'open',
    snooze_until: null,
    source_msg_id: null,
    fingerprint: 'f',
    quadrant_locked: false,
    project: null,
    tags: [],
  }
  const tasks = [
    { ...base, id: 1, chat_key: 'c1', quadrant: 1, created_at: 100, updated_at: 100 },
    { ...base, id: 2, chat_key: 'c2', quadrant: 4, created_at: 200, updated_at: 200 },
    { ...base, id: 3, chat_key: 'c3', quadrant: 2, created_at: 150, updated_at: 150 },
  ]
  const groups = buildQuadrantEntries(tasks, [], 'newest')
  const flat = flattenQuadrantEntries(groups, 'newest')
  assert.equal(flat.length, 3)
  assert.equal(flat[0].kind === 'task' ? flat[0].task.id : -1, 2)
  assert.equal(flat[1].kind === 'task' ? flat[1].task.id : -1, 3)
  assert.equal(flat[2].kind === 'task' ? flat[2].task.id : -1, 1)
})

test('localInputToEpoch and epochToLocalInput round-trip', async () => {
  const { localInputToEpoch, epochToLocalInput } = await loadModel()
  const d = new Date(2026, 5, 10, 14, 30, 0)
  const input = epochToLocalInput(Math.floor(d.getTime() / 1000))
  assert.match(input, /^2026-06-10T14:30$/)
  const epoch = localInputToEpoch(input)
  assert.equal(epoch, Math.floor(d.getTime() / 1000))
  assert.equal(localInputToEpoch(''), null)
  assert.equal(localInputToEpoch('not-a-date'), null)
})

test('defaultCustomSnoozeInput is tomorrow 8 AM local', async () => {
  const { defaultCustomSnoozeInput, localInputToEpoch } = await loadModel()
  const now = new Date(2026, 0, 15, 12, 0, 0)
  const input = defaultCustomSnoozeInput(now)
  const epoch = localInputToEpoch(input)
  const d = new Date(epoch * 1000)
  assert.equal(d.getDate(), 16)
  assert.equal(d.getHours(), 8)
  assert.equal(d.getMinutes(), 0)
})

test('isLocalChat', async () => {
  const { isLocalChat } = await loadModel()
  assert.equal(isLocalChat('abc-session'), true)
  assert.equal(isLocalChat('work:abc-session'), false)
})

test('agentCountsSorted and agent option labels', async () => {
  const { agentCountsSorted, formatAllAgentsLabel, formatAgentOptionLabel } = await loadModel()
  const tasks = [
    { agent: 'Bob' },
    { agent: 'Alice' },
    { agent: 'Alice' },
    { agent: 'Carol' },
    { agent: 'Alice' },
  ].map((t, i) => ({
    ...t,
    id: i,
    chat_key: 'a',
    chat_title: 'T',
    ask: 'x',
    topic: 't',
    quadrant: 1,
    status: 'open',
    snooze_until: null,
    source_msg_id: null,
    created_at: 0,
    updated_at: 0,
    fingerprint: 'f',
    quadrant_locked: false,
    project: null,
    tags: [],
  }))
  const sorted = agentCountsSorted(tasks)
  assert.deepEqual(sorted.map(x => x.agent), ['Alice', 'Bob', 'Carol'])
  assert.deepEqual(sorted.map(x => x.count), [3, 1, 1])
  assert.equal(formatAllAgentsLabel({ main: 5, sub: 0 }), 'All agents: 5 tasks')
  assert.equal(formatAgentOptionLabel('Alice', { main: 35, sub: 73 }), 'Alice: 35 tasks, 73 subtasks')
})

test('settings helpers — clamp, validate, mode copy, usage format', async () => {
  const {
    clampSettingInt,
    validateSettingInt,
    modeCheckDescription,
    formatTodayUsage,
    formatWithThousands,
    isDailyCapReached,
    firstRunCapSentence,
    settingsFieldVisible,
  } = await loadModel()
  assert.equal(clampSettingInt('debounce_seconds', 10), 30)
  assert.equal(clampSettingInt('debounce_seconds', 999), 600)
  assert.equal(validateSettingInt('sweep_minutes', 14), 'Must be between 15 and 240')
  assert.equal(validateSettingInt('daily_call_cap', 0), null)
  assert.equal(
    modeCheckDescription('auto', 30),
    'after each chat, plus a check every 30 min',
  )
  assert.equal(modeCheckDescription('hourly', 30), 'about every hour')
  assert.equal(formatTodayUsage(1200, 500, 1500), 'Today: 1,200 calls, 2,000 tokens')
  assert.equal(formatWithThousands(1000000), '1,000,000')
  assert.equal(isDailyCapReached(200, 200), true)
  assert.equal(isDailyCapReached(5, 0), false)
  assert.match(firstRunCapSentence(0), /no daily limit/)
  assert.equal(settingsFieldVisible('debounce_seconds', 'manual'), false)
  assert.equal(settingsFieldVisible('sweep_minutes', 'hourly'), true)
})

function taskFixture(overrides = {}) {
  return {
    id: 1,
    chat_key: 'a',
    agent: 'Main',
    chat_title: 'T',
    ask: 'x',
    topic: 't',
    quadrant: 1,
    status: 'open',
    snooze_until: null,
    source_msg_id: null,
    created_at: 0,
    updated_at: 0,
    fingerprint: 'f',
    quadrant_locked: false,
    project: null,
    tags: [],
    ...overrides,
  }
}

test('search — normalize, accents, tokenize', async () => {
  const { normalizeForSearch, tokenizeQuery } = await loadModel()
  assert.equal(normalizeForSearch('Café'), 'cafe')
  assert.equal(normalizeForSearch('Résumé'), 'resume')
  assert.deepEqual(tokenizeQuery('  foo   bar  '), ['foo', 'bar'])
  assert.deepEqual(tokenizeQuery(''), [])
})

test('search — taskMatches multi-word AND and empty query', async () => {
  const { taskMatches } = await loadModel()
  const task = taskFixture({
    topic: 'Tax filing',
    ask: 'Send W2',
    agent: 'Bob',
    chat_title: 'Work chat',
  })
  assert.equal(taskMatches(task, [], {}), true)
  assert.equal(taskMatches(task, ['tax', 'w2'], {}), true)
  assert.equal(taskMatches(task, ['tax', 'missing'], {}), false)
  assert.equal(taskMatches(task, ['café'], { groupTitle: 'Réunion' }), false)
  assert.equal(
    taskMatches(taskFixture({ topic: 'Café plan' }), ['cafe'], {}),
    true,
  )
})

test('search — group title match includes all children via filter', async () => {
  const { filterQuadrantEntriesForSearch, buildQuadrantEntries } = await loadModel()
  const tasks = [
    taskFixture({ id: 1, chat_key: 'g', topic: 'Alpha', ask: 'one' }),
    taskFixture({ id: 2, chat_key: 'g', topic: 'Beta', ask: 'two' }),
  ]
  const groups = [
    {
      chat_key: 'g',
      title: 'Taxes bundle',
      quadrant: 1,
      task_ids: [1, 2],
      agent: 'Main',
      chat_title: 'Chat',
    },
  ]
  const entries = buildQuadrantEntries(tasks, groups, 'newest')[1]
  const filtered = filterQuadrantEntriesForSearch(entries, ['taxes'], () => null)
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].kind, 'group')
  assert.equal(filtered[0].tasks.length, 2)
})

test('buildQuadrantEntries — name after chat uses chat title for group child', async () => {
  const { buildQuadrantEntries, taskDisplayTitle, groupDisplayTitle } = await loadModel()
  const tasks = [
    taskFixture({
      id: 1,
      chat_key: 'ck',
      topic: '90-day goal',
      chat_title: 'Master Plan',
    }),
    taskFixture({
      id: 2,
      chat_key: 'ck',
      topic: '90-day goal',
      chat_title: 'Master Plan',
    }),
  ]
  const groups = [
    {
      chat_key: 'ck',
      title: 'Master marketing plan',
      title_locked: false,
      quadrant: 2,
      task_ids: [1, 2],
      agent: 'Main',
      chat_title: 'Master Plan',
    },
  ]
  const entries = buildQuadrantEntries(tasks, groups, 'newest')[2]
  assert.equal(entries.length, 1)
  assert.equal(entries[0].kind, 'group')
  const group = entries[0].group
  const child = entries[0].tasks[0]
  assert.equal(groupDisplayTitle(group, true), 'Master Plan')
  assert.equal(groupDisplayTitle(group, false), 'Master marketing plan')
  assert.equal(taskDisplayTitle(child, true), 'Master Plan')
  assert.equal(taskDisplayTitle(child, false), '90-day goal')
})

test('formatTodayChecksLine and todayChecksProgress', async () => {
  const { formatTodayChecksLine, todayChecksProgress } = await loadModel()
  assert.equal(formatTodayChecksLine(3, 0), 'Today: 3 checks used of no limit')
  assert.equal(formatTodayChecksLine(5, 10), 'Today: 5 checks used of 10')
  assert.equal(todayChecksProgress(5, 10), 0.5)
  assert.equal(todayChecksProgress(12, 10), 1)
  assert.equal(todayChecksProgress(3, 0), 0)
})

test('taskDisplayTitle and groupDisplayTitle', async () => {
  const { taskDisplayTitle, groupDisplayTitle } = await loadModel()
  const task = taskFixture({
    topic: 'Topic',
    chat_title: 'Chat',
    title_override: 'Override',
  })
  assert.equal(taskDisplayTitle(task, false), 'Override')
  assert.equal(taskDisplayTitle(task, true), 'Override')
  assert.equal(
    taskDisplayTitle(taskFixture({ topic: 'Topic', chat_title: 'Chat' }), true),
    'Chat',
  )
  assert.equal(
    taskDisplayTitle(taskFixture({ topic: 'Topic', chat_title: 'Chat' }), false),
    'Topic',
  )
  const group = {
    chat_key: 'g',
    title: 'Stored',
    title_locked: true,
    quadrant: 1,
    task_ids: [1, 2],
    agent: 'A',
    chat_title: 'Chat',
  }
  assert.equal(groupDisplayTitle(group, true), 'Stored')
  assert.equal(
    groupDisplayTitle({ ...group, title_locked: false }, true),
    'Chat',
  )
  assert.equal(
    groupDisplayTitle({ ...group, title_locked: false }, false),
    'Stored',
  )
})

test('search — highlightRanges merge and overlap', async () => {
  const { highlightRanges } = await loadModel()
  assert.deepEqual(highlightRanges('hello world', []), [])
  assert.deepEqual(highlightRanges('foo bar foo', ['foo']), [[0, 3], [8, 11]])
  const merged = highlightRanges('foobar', ['foo', 'bar'])
  assert.deepEqual(merged, [[0, 6]])
  assert.deepEqual(highlightRanges('Café au lait', ['cafe']), [[0, 4]])
})

test('commitTaskRename — unchanged, empty clears, save', async () => {
  const { commitTaskRename } = await loadModel()
  assert.deepEqual(commitTaskRename('Same', 'Same', null), { action: 'close' })
  assert.deepEqual(commitTaskRename('  ', 'Title', 'Custom'), { action: 'save', value: null })
  assert.deepEqual(commitTaskRename('New', 'Old', 'Old'), { action: 'save', value: 'New' })
  assert.deepEqual(commitTaskRename('Title', 'Title', 'Custom'), { action: 'save', value: 'Title' })
})

test('commitGroupRename', async () => {
  const { commitGroupRename } = await loadModel()
  assert.deepEqual(
    commitGroupRename('Shown', 'Shown', { title_locked: false }),
    { action: 'close' },
  )
  assert.deepEqual(
    commitGroupRename('', 'Shown', { title_locked: true, title: 'Locked' }),
    { action: 'save', value: null },
  )
})

test('taskActivityAt prefers source_msg_at over updated_at', async () => {
  const { taskActivityAt } = await loadModel()
  const task = {
    source_msg_at: 100,
    updated_at: 999,
    created_at: 50,
  }
  assert.equal(taskActivityAt(task), 100)
  assert.equal(taskActivityAt({ ...task, source_msg_at: null }), 999)
  assert.equal(taskActivityAt({ ...task, source_msg_at: 0 }), 999)
})

test('taskSortAt and groupByQuadrant prefer source_msg_at over created_at', async () => {
  const { taskSortAt, groupByQuadrant } = await loadModel()
  const base = {
    chat_key: 'a',
    agent: 'Main',
    chat_title: 'T',
    ask: 'x',
    topic: 't',
    status: 'open',
    snooze_until: null,
    source_msg_id: null,
    updated_at: 0,
    fingerprint: 'f',
    quadrant_locked: false,
    project: null,
    tags: [],
  }
  assert.equal(taskSortAt({ ...base, created_at: 10, source_msg_at: 500 }), 500)
  assert.equal(taskSortAt({ ...base, created_at: 10, source_msg_at: null }), 10)
  const tasks = [
    { ...base, id: 1, quadrant: 1, created_at: 10, source_msg_at: 100 },
    { ...base, id: 2, quadrant: 1, created_at: 30, source_msg_at: null },
    { ...base, id: 3, quadrant: 1, created_at: 5, source_msg_at: 200 },
  ]
  const g = groupByQuadrant(tasks, 'newest')
  assert.deepEqual(g[1].map(x => x.id), [3, 1, 2])
})

test('buildQuadrantEntries keeps chat_target on groups', async () => {
  const { buildQuadrantEntries } = await loadModel()
  const target = { session_id: 's1', profile: 'bob', connection: null }
  const base = { chat_key: 'bob:s1', agent: 'Bob', chat_title: 'K', topic: 't', quadrant: 1, status: 'open', chat_target: target }
  const out = buildQuadrantEntries([{ ...base, id: 1, ask: 'a', created_at: 1 }, { ...base, id: 2, ask: 'b', created_at: 2 }], [], 'newest')
  const group = out[1].find(e => e.kind === 'group')
  assert.deepEqual(group.group.chat_target, target)
})

test('mainAndSubCounts: a chat with 2+ asks is one main task plus its subtasks', async () => {
  const { mainAndSubCounts, formatMainSubCount } = await loadModel()
  const t = (id, chat_key) => ({ id, chat_key, agent: 'A' })
  const c = mainAndSubCounts([t(1, 'a'), t(2, 'b'), t(3, 'b'), t(4, 'b'), t(5, 'c')])
  assert.deepEqual(c, { main: 3, sub: 3 })
  assert.equal(formatMainSubCount(c), '3 tasks, 3 subtasks')
  assert.equal(formatMainSubCount({ main: 2, sub: 1 }), '2 tasks, 1 subtask')
})

test('taskDisplayTitle keeps the chat name you gave over scan titles', async () => {
  const { taskDisplayTitle } = await loadModel()
  const t = taskFixture({ topic: 'Reworded topic', chat_title: 'Chat', chat_name: 'My name' })
  assert.equal(taskDisplayTitle(t, true), 'My name')
  assert.equal(taskDisplayTitle(t, false), 'My name')
  // Nested asks already sit under the group's name, so they keep their own topic.
  assert.equal(taskDisplayTitle(t, true, true), 'Chat')
  assert.equal(taskDisplayTitle(t, false, true), 'Reworded topic')
  // A per-task override still wins.
  assert.equal(taskDisplayTitle({ ...t, title_override: 'Override' }, true), 'Override')
})

const P = (key, name, color = null) => ({ key, name, color })
const T = (id, name, source = 'manual') => ({ id, name, color: 'blue', source })

test('filterOpenTasks — project filter by key, including none', async () => {
  const { filterOpenTasks } = await loadModel()
  const tasks = [
    taskFixture({ id: 1, project: P('default:10', 'A') }),
    taskFixture({ id: 2, project: P('mini:bob:20', 'B') }),
    taskFixture({ id: 3, project: null }),
    taskFixture({ id: 4 }),
  ]
  assert.deepEqual(filterOpenTasks(tasks, 'all', 'all').map(t => t.id), [1, 2, 3, 4])
  assert.deepEqual(filterOpenTasks(tasks, 'all', ['default:10']).map(t => t.id), [1])
  assert.deepEqual(filterOpenTasks(tasks, 'all', ['none']).map(t => t.id), [3, 4])
  assert.deepEqual(filterOpenTasks(tasks, 'all', ['default:10', 'none']).map(t => t.id), [1, 3, 4])
  assert.deepEqual(filterOpenTasks(tasks, 'all', ['default:10', 'mini:bob:20']).map(t => t.id), [1, 2])
  assert.deepEqual(filterOpenTasks(tasks, 'Other', 'all').map(t => t.id), [])
})

test('filterOpenTasks — tag filter needs every tag (AND)', async () => {
  const { filterOpenTasks } = await loadModel()
  const tasks = [
    taskFixture({ id: 1, tags: [T(1, 'Money'), T(2, 'Kids')] }),
    taskFixture({ id: 2, tags: [T(1, 'Money')] }),
    taskFixture({ id: 3, tags: [] }),
    taskFixture({ id: 4, tags: undefined }),
  ]
  assert.deepEqual(filterOpenTasks(tasks, 'all', 'all', []).map(t => t.id), [1, 2, 3, 4])
  assert.deepEqual(filterOpenTasks(tasks, 'all', 'all', [1]).map(t => t.id), [1, 2])
  assert.deepEqual(filterOpenTasks(tasks, 'all', 'all', [1, 2]).map(t => t.id), [1])
  assert.deepEqual(filterOpenTasks(tasks, 'all', 'all', [3]).map(t => t.id), [])
})

test('parseStoredProjectFilter keeps key strings and drops old numeric ids', async () => {
  const { parseStoredProjectFilter } = await loadModel()
  assert.equal(parseStoredProjectFilter('all'), 'all')
  assert.deepEqual(parseStoredProjectFilter('none'), ['none'])
  assert.deepEqual(parseStoredProjectFilter('default:7'), ['default:7'])
  assert.equal(parseStoredProjectFilter(42), 'all')
  assert.deepEqual(parseStoredProjectFilter([1, 'none', 'default:1', 'default:1', '']), ['none', 'default:1'])
  assert.equal(parseStoredProjectFilter([3, 5]), 'all')
  assert.equal(parseStoredProjectFilter([]), 'all')
  assert.equal(parseStoredProjectFilter(null), 'all')
})

test('pruneProjectFilter and pruneTagFilter drop stale values', async () => {
  const { pruneProjectFilter, pruneTagFilter, parseStoredTagFilter } = await loadModel()
  assert.equal(pruneProjectFilter('all', []), 'all')
  assert.deepEqual(pruneProjectFilter(['a:1', 'none', 'a:2'], ['a:2']), ['none', 'a:2'])
  assert.equal(pruneProjectFilter(['a:1'], ['a:2']), 'all')
  const same = ['a:2']
  assert.equal(pruneProjectFilter(same, ['a:2']), same)
  assert.deepEqual(pruneTagFilter([1, 2, 3], [2]), [2])
  assert.deepEqual(parseStoredTagFilter([1, '2', 1, 'x']), [1, 2])
  assert.deepEqual(parseStoredTagFilter('nope'), [])
})

test('toggleProjectSel and toggleTagSel', async () => {
  const { toggleProjectSel, toggleTagSel } = await loadModel()
  assert.deepEqual(toggleProjectSel('all', 'a:5'), ['a:5'])
  assert.equal(toggleProjectSel(['a:5'], 'a:5'), 'all')
  assert.deepEqual(toggleProjectSel(['a:5', 'none'], 'a:5'), ['none'])
  assert.deepEqual(toggleTagSel([1], 2), [1, 2])
  assert.deepEqual(toggleTagSel([1, 2], 1), [2])
})

test('showProjectChips', async () => {
  const { showProjectChips } = await loadModel()
  assert.equal(showProjectChips('all'), true)
  assert.equal(showProjectChips(['a:1']), false)
  assert.equal(showProjectChips(['none']), false)
  assert.equal(showProjectChips(['a:1', 'none']), true)
})

test('buildProjectSections — sorted by name, No project last, order kept inside', async () => {
  const { buildQuadrantEntries, flattenQuadrantEntries, buildProjectSections } = await loadModel()
  const tasks = [
    taskFixture({ id: 1, chat_key: 'c1', created_at: 50, project: P('d:2', 'zeta') }),
    taskFixture({ id: 2, chat_key: 'c2', created_at: 40, project: null }),
    taskFixture({ id: 3, chat_key: 'c3', created_at: 30, project: P('d:1', 'Alpha') }),
    taskFixture({ id: 4, chat_key: 'c4', created_at: 20, project: P('d:2', 'zeta') }),
    taskFixture({ id: 5, chat_key: 'c5', created_at: 10, project: P('d:1', 'Alpha'), quadrant: 3 }),
  ]
  const flat = flattenQuadrantEntries(buildQuadrantEntries(tasks, [], 'newest'), 'newest')
  const sections = buildProjectSections(flat, 'No project')
  assert.deepEqual(sections.map(s => s.title), ['Alpha', 'zeta', 'No project'])
  assert.deepEqual(sections.map(s => s.key), ['project:d:1', 'project:d:2', 'no-project'])
  assert.deepEqual(sections[0].entries.map(e => e.task.id), [3, 5])
  assert.deepEqual(sections[1].entries.map(e => e.task.id), [1, 4])
  assert.deepEqual(sections[2].entries.map(e => e.task.id), [2])
  assert.deepEqual(buildProjectSections([], 'No project'), [])
})

test('parseGroupBy and the priority toggle', async () => {
  const { parseGroupBy, nextGroupByForPriorityToggle } = await loadModel()
  assert.equal(parseGroupBy('project'), 'project')
  assert.equal(parseGroupBy(undefined, false), 'none')
  assert.equal(parseGroupBy(undefined, true), 'priority')
  assert.equal(parseGroupBy('bogus'), 'priority')
  assert.equal(nextGroupByForPriorityToggle('priority'), 'none')
  assert.equal(nextGroupByForPriorityToggle('none'), 'priority')
  assert.equal(nextGroupByForPriorityToggle('project'), 'priority')
})

test('search matches tag names, project name and context', async () => {
  const { taskMatches, filterQuadrantEntriesForSearch, buildQuadrantEntries } = await loadModel()
  const task = taskFixture({
    topic: 'Plain',
    tags: [T(1, 'Invoices')],
    project: P('d:1', 'Garage build'),
    context: 'The contractor is waiting',
  })
  assert.equal(taskMatches(task, ['invoices'], {}), true)
  assert.equal(taskMatches(task, ['garage'], {}), true)
  assert.equal(taskMatches(task, ['contractor'], {}), true)
  assert.equal(taskMatches(task, ['nothing'], {}), false)
  const tasks = [
    taskFixture({ id: 1, chat_key: 'g', project: P('d:9', 'Roof') }),
    taskFixture({ id: 2, chat_key: 'g' }),
  ]
  const entries = buildQuadrantEntries(tasks, [], 'newest')[1]
  const found = filterQuadrantEntriesForSearch(entries, ['roof'])
  assert.equal(found.length, 1)
  assert.equal(found[0].kind, 'group')
  assert.equal(found[0].tasks.length, 2)
})

test('Show all button counts the same way as its section heading', async () => {
  const { buildQuadrantEntries, sectionCountLabel, sectionShowAllLabel, entryMainAndSubCounts, formatMainSubCount } =
    await loadModel()
  const tasks = []
  let id = 1
  // 16 chats: every third has three asks (a group with subtasks).
  for (let c = 0; c < 16; c++) {
    const n = c % 3 === 0 ? 3 : 1
    for (let i = 0; i < n; i++) tasks.push(taskFixture({ id: id++, chat_key: `c${c}`, created_at: id }))
  }
  const entries = buildQuadrantEntries(tasks, [], 'newest')[1]
  const heading = sectionCountLabel(entries)
  assert.equal(heading, formatMainSubCount(entryMainAndSubCounts(entries)))
  assert.equal(heading, '16 tasks, 18 subtasks')
  assert.equal(sectionShowAllLabel(entries), `Show all ${heading}`)
})

test('dueChipLabel — local calendar days with an injected now', async () => {
  const { dueChipLabel } = await loadModel()
  const now = new Date(2026, 10, 4, 15, 0) // Wed Nov 4 2026, 3 PM local
  const at = (y, m, d, h = 12) => Math.floor(new Date(y, m, d, h).getTime() / 1000)
  assert.deepEqual(dueChipLabel(at(2026, 10, 3, 23), now), { label: 'Overdue', tone: 'overdue' })
  assert.deepEqual(dueChipLabel(at(2026, 10, 4, 1), now), { label: 'Due today', tone: 'today' })
  assert.deepEqual(dueChipLabel(at(2026, 10, 4, 23), now), { label: 'Due today', tone: 'today' })
  assert.deepEqual(dueChipLabel(at(2026, 10, 5, 0), now), { label: 'Due tomorrow', tone: 'soon' })
  assert.deepEqual(dueChipLabel(at(2026, 10, 6), now), { label: 'Due Fri', tone: 'soon' })
  assert.deepEqual(dueChipLabel(at(2026, 10, 10), now), { label: 'Due Tue', tone: 'soon' })
  assert.deepEqual(dueChipLabel(at(2026, 10, 14), now), { label: 'Due Nov 14', tone: 'later' })
  assert.deepEqual(dueChipLabel(at(2027, 0, 2), now), { label: 'Due Jan 2, 2027', tone: 'later' })
  assert.equal(dueChipLabel(0, now), null)
  assert.equal(dueChipLabel(Number.NaN, now), null)
})

test('tag helpers — chip overflow, group check state, union, colors', async () => {
  const { visibleTagChips, tagCheckState, unionTags, normalizeTagColor, earliestDueAt } = await loadModel()
  const tags = [T(1, 'a'), T(2, 'b'), T(3, 'c'), T(4, 'd'), T(5, 'e')]
  assert.deepEqual(visibleTagChips(tags, 3).extra, 2)
  assert.equal(visibleTagChips(tags.slice(0, 3), 3).extra, 0)
  const group = [taskFixture({ tags: [T(1, 'a')] }), taskFixture({ id: 2, tags: [T(1, 'a'), T(2, 'b')] })]
  assert.equal(tagCheckState(group, 1), 'all')
  assert.equal(tagCheckState(group, 2), 'some')
  assert.equal(tagCheckState(group, 3), 'none')
  assert.deepEqual(unionTags(group).map(t => t.id), [1, 2])
  assert.equal(normalizeTagColor('teal'), 'teal')
  assert.equal(normalizeTagColor('chartreuse'), 'gray')
  assert.equal(earliestDueAt([{ due_at: null }, { due_at: 500 }, { due_at: 200 }]), 200)
  assert.equal(earliestDueAt([{}]), null)
})
