import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import test from 'node:test'

async function load(path) {
  const result = await build({ entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'esm' })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
}

test('expired tasks have a distinct history label and never look completed', async () => {
  const model = await load('src/model.ts')
  const { strings } = await load('src/ui/strings.ts')
  assert.equal(model.isHistoryTask({status: 'expired'}), true)
  assert.equal(model.isHistoryTask({status: 'open'}), false)
  assert.equal(model.isHistoryTask({status: 'done'}), true)
  assert.equal(strings.statusExpired, 'Cleared for age · not answered')
  assert.match(strings.closedNote, /[Aa]ge-cleared tasks can return/)
  assert.match(strings.satellitesHttpPublicWarning, /hostnames/)
  assert.match(strings.settingsRetentionHint, /Forever.*default/)
  assert.match(strings.scanDone(0, 0, 1), /1 cleared for age/)
  const panel = await readFile('src/ui/TasksPanel.tsx', 'utf8')
  assert.match(panel, /tasks\.filter\(isHistoryTask\)/)
  assert.match(panel, /summary\.expired/)
  const row = await readFile('src/ui/TaskRow.tsx', 'utf8')
  assert.match(row, /task\.status === 'expired'.*strings\.statusExpired/s)
})

test('README retention and plain HTTP rules match the product defaults', async () => {
  const readme = await readFile('README.md', 'utf8')
  assert.match(readme, /Keep unanswered tasks \(days\) \| 0 \(Forever\)/)
  assert.match(readme, /[Ee]xpiry is opt-in/)
  assert.doesNotMatch(readme, /Plain `http`[^\n]*`\.local`[^\n]*localhost/)
  assert.match(readme, /[Hh]ostnames, including `\.local`, require HTTPS/)
})
