import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

const dir = await mkdtemp(join(tmpdir(), 'wou-catch-up-'))
let m
try {
  const outfile = join(dir, 'catch-up.mjs')
  await build({ entryPoints: ['src/ui/catchUp.ts'], outfile, bundle: true, platform: 'node', format: 'esm' })
  m = await import(new URL(`file://${outfile}`).href)
} finally { await rm(dir, { recursive: true, force: true }) }

const task = (id, key, status = 'open') => ({
  id, chat_key: `chat-${id}`, status, project: key == null ? null : { key, name: 'Same name' },
  tags: [{ id: 4, name: 'Keep', color: 'blue', source: 'manual' }],
})

test('catch-up uses opaque native keys, not project names, numeric ids or human prefixes', () => {
  const tasks = [task(1, 'default:p_a'), task(2, 'work:p_a'), task(3, null), task(4, 'default:p_a', 'done')]
  assert.deepEqual(m.catchUpChats(tasks, 'default:p_a').open.map(t => t.id), [1])
  assert.deepEqual(m.catchUpChats(tasks, 'work:p_a').open.map(t => t.id), [2])
  assert.deepEqual(m.catchUpChats(tasks, null).open.map(t => t.id), [3])
  assert.deepEqual(m.catchUpChats(tasks, '1').open, [])
  assert.equal(m.catchUpChats(tasks, 'default:p_a').open[0], tasks[0])
  assert.equal(m.catchUpChats(tasks, 'default:p_a').open[0].tags, tasks[0].tags)
})

test('snoozed asks are counted separately; closed/resolved/expired asks stay out', () => {
  const tasks = ['open', 'snoozed', 'done', 'dismissed', 'resolved', 'expired'].map((s, i) => task(i, 'default:p', s))
  assert.deepEqual(m.catchUpChats(tasks, 'default:p'), { open: [tasks[0]], snoozed: 1 })
})

test('chat grouping preserves every ask and uses the supplied title without identity assumptions', () => {
  const tasks = [task(1, 'default:p'), { ...task(2, 'default:p'), chat_key: 'chat-1' }]
  assert.deepEqual(m.catchUpGroups(tasks).map(g => [g.chatKey, g.tasks.map(t => t.id)]), [['chat-1', [1, 2]]])
})

test('catch-up visible order scopes keyboard targets to the selected native project', () => {
  const tasks = [
    task(1, 'default:p_a'),
    task(2, 'work:p_b'),
    task(3, 'default:p_a', 'snoozed'),
    { ...task(4, 'work:p_b'), chat_key: 'chat-2' },
  ]
  assert.deepEqual(m.catchUpVisibleTaskOrder(tasks, 'default:p_a'), [1])
  assert.deepEqual(m.catchUpVisibleTaskOrder(tasks, 'work:p_b'), [2, 4])
  assert.equal(m.catchUpVisibleTask(tasks, 'default:p_a', 2), null)
  assert.equal(m.catchUpVisibleTask(tasks, 'work:p_b', 2)?.id, 2)
  assert.equal(m.catchUpVisibleTask(tasks, 'default:p_a', 3), null)
})

const viewOk = (overrides = {}) => ({
  consented: true,
  projectsFetchSucceeded: true,
  tasksFetchSucceeded: true,
  offline: false,
  projects: [{ key: 'default:p_a' }, { key: 'work:p_b' }],
  projectKey: 'default:p_a',
  ...overrides,
})

test('catch-up eligibility hides tasks and blocks keyboard while offline, loading, or unknown project', () => {
  const tasks = [task(1, 'default:p_a'), task(2, 'work:p_b')]
  assert.equal(m.catchUpViewEligible(viewOk()), true)
  assert.deepEqual(m.catchUpVisibleTaskOrderForView(tasks, viewOk()), [1])
  assert.equal(m.catchUpActiveTask(tasks, viewOk(), 1)?.id, 1)
  assert.equal(m.catchUpViewEligible(viewOk({ offline: true })), false)
  assert.deepEqual(m.catchUpVisibleTaskOrderForView(tasks, viewOk({ offline: true })), [])
  assert.equal(m.catchUpActiveTask(tasks, viewOk({ offline: true }), 1), null)
  assert.equal(m.catchUpViewEligible(viewOk({ tasksFetchSucceeded: false })), false)
  assert.deepEqual(m.catchUpVisibleTaskOrderForView(tasks, viewOk({ tasksFetchSucceeded: false })), [])
  assert.equal(m.catchUpActiveTask(tasks, viewOk({ tasksFetchSucceeded: false }), 1), null)
  assert.equal(m.catchUpViewEligible(viewOk({ projectsFetchSucceeded: false })), false)
  assert.equal(m.catchUpViewEligible(viewOk({ projectKey: 'missing:proj' })), false)
  assert.deepEqual(m.catchUpVisibleTaskOrderForView(tasks, viewOk({ projectKey: 'missing:proj' })), [])
  assert.equal(m.catchUpActiveTask(tasks, viewOk({ projectKey: 'missing:proj' }), 1), null)
  assert.deepEqual(m.catchUpVisibleTaskOrderForView(tasks, viewOk({ projectKey: 'work:p_b' })), [2])
  assert.equal(m.catchUpActiveTask(tasks, viewOk({ projectKey: 'work:p_b' }), 2)?.id, 2)
  assert.equal(m.catchUpViewEligible(viewOk({ consented: false })), false)
})

test('catch-up reuses real task controls and does not invent board reads or answers', async () => {
  const view = await readFile('src/ui/CatchUpView.tsx', 'utf8')
  const panel = await readFile('src/ui/TasksPanel.tsx', 'utf8')
  assert.match(view, /Human-blocked cards/)
  assert.match(view, /Review cards/)
  assert.match(view, /not available/)
  assert.match(view, /renderTask\(task\)/)
  assert.match(view, /catchUpViewEligible/)
  assert.doesNotMatch(view, /DAVE:|fetchProjectCards|answerCard|kanban_db|\.rest\(|All clear/)
  assert.match(panel, /catchUpView && consented/)
  assert.match(panel, /renderTask=\{renderTaskRow\}/)
  assert.match(panel, /catchUpVisibleTaskOrderForView/)
  assert.match(panel, /catchUpActiveTask\(/)
  assert.match(panel, /ready=\{projectsReady && projectsFetchSucceeded && fetchSucceeded\}/)
  assert.match(panel, /setProjectsFetchSucceeded\(false\)/)
  assert.match(panel, /projectsLoadError/)
})

test('loadProjects guards stale failures the same way as acceptScopedPayload successes', async () => {
  const panel = await readFile('src/ui/TasksPanel.tsx', 'utf8')
  const start = panel.indexOf('const loadProjects = useCallback')
  assert.notEqual(start, -1)
  const end = panel.indexOf('}, [ctx])', start)
  const block = panel.slice(start, end)
  assert.match(block, /acceptScopedPayload/)
  assert.match(
    block,
    /catch \{[\s\S]*requested\.scope !== String\(projectLoad\.current\.scope\)[\s\S]*requested\.seq !== projectLoad\.current\.seq/,
  )
  assert.doesNotMatch(panel, /catchUpEligibleRef/)
})
