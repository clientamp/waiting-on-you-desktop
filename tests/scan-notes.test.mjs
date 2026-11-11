import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function loadScanNotes() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-scan-notes-'))
  const outfile = join(dir, 'scanNotes.mjs')
  await build({
    entryPoints: ['src/ui/scanNotes.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'es2022',
  })
  const mod = await import(new URL(`file://${outfile}`).href)
  await rm(dir, { recursive: true, force: true })
  return mod
}

test('all failed scans give the model recovery instruction', async () => {
  const { scanClassificationFailureLine } = await loadScanNotes()
  const expected = 'Couldn’t reach your Hermes model, so no chats were checked. Make sure Hermes can chat, then press Scan now.'
  assert.equal(scanClassificationFailureLine({ succeeded: 0, failed: 3 }), expected)
  assert.equal(scanClassificationFailureLine({ model_unreachable: true }), expected)
  assert.match(scanClassificationFailureLine({ succeeded: 1, failed: 2, classification_errors: ['short reason'] }), /Some chats couldn’t be checked: short reason/)
})

test('scanClassificationFailureLine surfaces short reason', async () => {
  const { scanClassificationFailureLine } = await loadScanNotes()
  assert.match(
    scanClassificationFailureLine({ failed: 2, errors: ['HTTPError: 401'] }) ?? '',
    /401/,
  )
  assert.equal(scanClassificationFailureLine({ failed: 0 }), null)
  assert.match(scanClassificationFailureLine({ failed: 1,
    errors: ['remote unreachable'], classification_errors: ['model key rejected'] }), /model key rejected/)
})

test('offlineMachines reads cached and no-cache notes, ignores others', async () => {
  const { offlineMachines, offlineLine } = await loadScanNotes()
  const machines = offlineMachines([
    'juno unreachable (ImportError: attempted relative import with no known parent package); using juno list cached Oct 27 03:28 PM',
    'studio unreachable (ssh: connect timed out); no studio cache yet',
    'juno unreachable (again); using juno list cached Oct 28 01:00 PM',
    'some other scan error',
  ])
  assert.deepEqual(machines, [
    { name: 'Juno', since: 'Oct 27 03:28 PM' },
    { name: 'Studio', since: null },
  ])
  assert.match(offlineLine(machines[0]), /^Juno can't be reached\. Showing its chats from Oct 27 03:28 PM/)
  assert.match(offlineLine(machines[1]), /^Studio can't be reached, so its chats are not on this list\.$/)
})

test('offlineMachines still warns when the note was cut off', async () => {
  const { offlineMachines } = await loadScanNotes()
  const cut = 'juno unreachable (' + 'x'.repeat(190)
  assert.deepEqual(offlineMachines([cut]), [{ name: 'Juno', since: null }])
})

test('storage label warnings parse the exact Python note and map profiles', async () => {
  const { storageLabelWarnings, storageLabelWarningLine } = await loadScanNotes()
  const sample = 'default: 12 recent chats use storage label "owner", which this version cannot read. Update the plugin.'
  const warnings = storageLabelWarnings([sample], { default: 'Assistant' })
  assert.deepEqual(warnings, [{ name: 'Assistant', count: 12, label: 'owner' }])
  assert.equal(storageLabelWarningLine(warnings[0]), 'Can\'t read 12 recent chats from Assistant. Hermes now saves them under a new label ("owner"). Update Waiting On You.')
  assert.equal(storageLabelWarningLine({ name: 'Work', count: 1, label: 'owner' }), 'Can\'t read 1 recent chat from Work. Hermes now saves it under a new label ("owner"). Update Waiting On You.')
  // A single-profile install has no names to tell apart, so the main profile goes unnamed.
  const [main] = storageLabelWarnings([sample])
  assert.equal(main.name, null)
  assert.equal(storageLabelWarningLine(main), 'Can\'t read 12 recent chats. Hermes now saves them under a new label ("owner"). Update Waiting On You.')
})

test('storage label warnings dedupe profiles and tolerate truncated notes', async () => {
  const { storageLabelWarnings } = await loadScanNotes()
  const note = 'work: 1 recent chat uses storage label "owner" and others, ' + 'x'.repeat(200)
  assert.deepEqual(storageLabelWarnings([note.slice(0, 200), note.replace('work:', 'WORK:')]),
    [{ name: 'Work', count: 1, label: 'owner' }])
  assert.deepEqual(storageLabelWarnings(undefined), [])
  assert.deepEqual(storageLabelWarnings(['unrelated error', 'work: 0 recent chats use storage label "owner"', 'work: 1 recent chat uses storage label "unfinished']), [])
})

test('panel shows storage label warnings beside offline banners with the same guards', async () => {
  const panel = await readFile('src/ui/TasksPanel.tsx', 'utf8')
  assert.match(panel, /offline \|\| showFirstRun \? null : storageLabelWarnings\(lastScan\?\.errors\)\.map/)
  assert.match(panel, /className="wou-scan-banner wou-scan-banner-warn" role="status">\s*\{storageLabelWarningLine\(warning\)\}/)
})

test('offlineMachines handles empty input', async () => {
  const { offlineMachines } = await loadScanNotes()
  assert.deepEqual(offlineMachines(undefined), [])
  assert.deepEqual(offlineMachines([]), [])
})
