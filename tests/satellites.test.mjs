import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function loadSatelliteHelpers() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-sat-'))
  const outfile = join(dir, 'satelliteHelpers.mjs')
  await build({
    entryPoints: ['src/ui/satelliteHelpers.ts'],
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

test('satelliteStatusText — waiting for first update', async () => {
  const { satelliteStatusText } = await loadSatelliteHelpers()
  const line = satelliteStatusText({ name: 'studio', agent_name: 'Juno', last_seen: null }, 1000)
  assert.equal(line.text, 'Waiting for first update')
  assert.equal(line.warn, false)
})

test('satelliteStatusText — sending tasks just now', async () => {
  const { satelliteStatusText } = await loadSatelliteHelpers()
  const now = 10_000
  const line = satelliteStatusText({ name: 'a', agent_name: '', last_seen: now - 30 }, now)
  assert.equal(line.text, 'Sending tasks · updated just now')
  assert.equal(line.warn, false)
})

test('satelliteStatusText — sending tasks minutes ago', async () => {
  const { satelliteStatusText } = await loadSatelliteHelpers()
  const now = 10_000
  const line = satelliteStatusText({ name: 'a', agent_name: '', last_seen: now - 5 * 60 }, now)
  assert.equal(line.text, 'Sending tasks · updated 5 min ago')
})

test('satelliteStatusText — last update hours', async () => {
  const { satelliteStatusText } = await loadSatelliteHelpers()
  const now = 100_000
  const line = satelliteStatusText({ name: 'a', agent_name: '', last_seen: now - 2 * 3600 }, now)
  assert.equal(line.text, 'Last update 2 h ago')
  assert.equal(line.warn, false)
})

test('satelliteStatusText — last update days warns', async () => {
  const { satelliteStatusText } = await loadSatelliteHelpers()
  const now = 1_000_000
  const line = satelliteStatusText({ name: 'a', agent_name: '', last_seen: now - 3 * 86400 }, now)
  assert.equal(line.text, 'Last update 3 days ago')
  assert.equal(line.warn, true)
})

test('shouldWarnHttpPublicHubAddress — https ok', async () => {
  const { shouldWarnHttpPublicHubAddress } = await loadSatelliteHelpers()
  assert.equal(shouldWarnHttpPublicHubAddress('https://hermes.example.com'), false)
})

test('shouldWarnHttpPublicHubAddress — http private LAN', async () => {
  const { shouldWarnHttpPublicHubAddress } = await loadSatelliteHelpers()
  assert.equal(shouldWarnHttpPublicHubAddress('http://10.0.0.20:9119'), false)
  assert.equal(shouldWarnHttpPublicHubAddress('http://localhost:9119'), false)
  assert.equal(shouldWarnHttpPublicHubAddress('http://studio.local:9119'), false)
})

test('shouldWarnHttpPublicHubAddress — http public host', async () => {
  const { shouldWarnHttpPublicHubAddress } = await loadSatelliteHelpers()
  assert.equal(shouldWarnHttpPublicHubAddress('http://hermes.example.com'), true)
  assert.equal(shouldWarnHttpPublicHubAddress('http://8.8.8.8'), true)
})
