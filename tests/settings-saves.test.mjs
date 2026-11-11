import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function loadQueue() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-settings-saves-'))
  const outfile = join(dir, 'settings.mjs')
  await build({ entryPoints: ['src/ui/settingsSaves.ts'], outfile, bundle: true,
    platform: 'node', format: 'esm', target: 'es2022' })
  const mod = await import(new URL(`file://${outfile}`).href)
  await rm(dir, { recursive: true, force: true })
  return mod.createSettingsSaveQueue
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const tick = () => new Promise(resolve => setImmediate(resolve))

test('settings queue serializes actual requests and preserves newer same-key edits', async () => {
  const create = await loadQueue()
  const requests = []
  const first = deferred(), second = deferred()
  const queue = create(patch => { requests.push(patch); return requests.length === 1 ? first.promise : second.promise })
  queue.edit({ mode: 'off' })
  const a = queue.save({ mode: 'off' })
  await tick()
  queue.edit({ mode: 'hourly' })
  const b = queue.save({ mode: 'hourly' })
  await tick()
  assert.deepEqual(requests, [{ mode: 'off' }])
  first.resolve({ mode: 'off', auto_tag: false })
  assert.equal((await a).mode, 'hourly')
  await tick()
  assert.deepEqual(requests, [{ mode: 'off' }, { mode: 'hourly' }])
  second.resolve({ mode: 'hourly', auto_tag: false })
  assert.equal((await b).mode, 'hourly')
  assert.deepEqual(queue.merge({ mode: 'auto', auto_tag: true }), { mode: 'auto', auto_tag: true })
})

test('settings response preserves an unsent debounced edit and applies server normalization', async () => {
  const create = await loadQueue()
  const response = deferred()
  const queue = create(() => response.promise)
  queue.edit({ mode: 'hourly' })
  const saved = queue.save({ mode: 'hourly' })
  queue.edit({ auto_tag: true })
  response.resolve({ mode: 'hourly', auto_tag: false, daily_call_cap: 150 })
  assert.deepEqual(await saved, { mode: 'hourly', auto_tag: true, daily_call_cap: 150 })
})

test('settings failure is reported once without retry storm and queue accepts later save', async () => {
  const create = await loadQueue()
  let calls = 0
  const queue = create(async patch => { calls++; if (calls === 1) throw new Error('bad input'); return { mode: patch.mode, auto_tag: false } })
  queue.edit({ mode: 'off' })
  await assert.rejects(queue.save({ mode: 'off' }), /bad input/)
  await tick()
  assert.equal(calls, 1)
  assert.equal(queue.merge({ mode: 'auto' }).mode, 'off')
  queue.edit({ mode: 'hourly' })
  assert.equal((await queue.save({ mode: 'hourly' })).mode, 'hourly')
  assert.equal(calls, 2)
})
