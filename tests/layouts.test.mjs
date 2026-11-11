import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function loadModel() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-layouts-'))
  const outfile = join(dir, 'model.mjs')
  await build({ entryPoints: ['src/model.ts'], outfile, bundle: true, platform: 'node', format: 'esm', target: 'es2022' })
  const mod = await import(new URL(`file://${outfile}`).href)
  await rm(dir, { recursive: true, force: true })
  return mod
}

const task = (id, agent = 'Juno') => ({ id, agent, ask: `Ask ${id}`, chat_key: `c${id}`, chat_title: `Chat ${id}` })
const one = t => ({ kind: 'task', task: t, sortAt: 0 })
const grp = (title, tasks) => ({
  kind: 'group',
  group: { chat_key: 'g', title, chat_title: 'Chat title', quadrant: 1, task_ids: tasks.map(t => t.id), agent: 'Juno' },
  tasks,
  sortAt: 0,
})

test('parseLayout defaults to cards for anything unknown', async () => {
  const { parseLayout } = await loadModel()
  assert.equal(parseLayout('compact'), 'compact')
  assert.equal(parseLayout('focus'), 'focus')
  assert.equal(parseLayout('cards'), 'cards')
  for (const bad of [undefined, null, '', 'grid', 3, 'Compact']) assert.equal(parseLayout(bad), 'cards')
})

test('hasSeveralAgents is false for one agent or an empty list', async () => {
  const { hasSeveralAgents } = await loadModel()
  assert.equal(hasSeveralAgents([]), false)
  assert.equal(hasSeveralAgents([task(1), task(2)]), false)
  assert.equal(hasSeveralAgents([task(1), task(2, 'Ada')]), true)
})

test('pickNextUp takes the first entry of the first non-empty section', async () => {
  const { pickNextUp } = await loadModel()
  const sections = [{ entries: [] }, { entries: [one(task(7)), one(task(8))] }, { entries: [one(task(9))] }]
  assert.equal(pickNextUp(sections, []).task.id, 7)
  assert.equal(pickNextUp(sections, []).group, null)
})

test('pickNextUp uses the flat list when there are no sections', async () => {
  const { pickNextUp } = await loadModel()
  assert.equal(pickNextUp(null, [one(task(3))]).task.id, 3)
  assert.equal(pickNextUp(null, []), null)
  assert.equal(pickNextUp([{ entries: [] }], [one(task(3))]), null)
})

test('pickNextUp returns a group\'s first task with its group and size', async () => {
  const { pickNextUp } = await loadModel()
  const pick = pickNextUp([{ entries: [grp('Check-in', [task(4), task(5)])] }], [])
  assert.equal(pick.task.id, 4)
  assert.equal(pick.group.title, 'Check-in')
  assert.equal(pick.groupSize, 2)
  assert.equal(pickNextUp([{ entries: [grp('Empty', []), one(task(6))] }], []).task.id, 6)
})
