import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { build } from 'esbuild'

// Optional browser dependencies are supplied outside the repo; never install into
// the shared node_modules symlink. Set both paths to run this gate in CI/review.
const require = createRequire(import.meta.url)
function dependency(env, name) {
  if (process.env[env]) return resolve(process.env[env])
  try { return dirname(require.resolve(`${name}/package.json`)) } catch { return null }
}
const reactDom = dependency('WOU_TEST_REACT_DOM', 'react-dom')
const playwright = dependency('WOU_TEST_PLAYWRIGHT', 'playwright')

// Adapted from t_f60784d6's mounted TasksPanel probe, extended with deferred
// responses. All catalog/tasks are fabricated; no Desktop or gateway is used.
test('mounted project catalog follows stable-context scope changes, events and Scan', {
  skip: !reactDom || !playwright ? 'set WOU_TEST_REACT_DOM and WOU_TEST_PLAYWRIGHT for the mounted browser gate' : false,
  timeout: 60_000,
}, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'wou-project-refresh-'))
  let browser
  let server
  try {
    const react = dirname(createRequire(join(reactDom, 'package.json')).resolve('react/package.json'))
    await build({
      entryPoints: ['tests/fixtures/project-refresh/harness.tsx'],
      outfile: join(dir, 'harness.js'), bundle: true, platform: 'browser', format: 'esm',
      jsx: 'automatic', target: 'es2022',
      alias: {
        '@hermes/plugin-sdk': resolve('tests/fixtures/project-refresh/hermes-stub.ts'),
        react, 'react-dom/client': join(reactDom, 'client.js'),
      },
      define: { 'process.env.NODE_ENV': '"production"' },
    })
    const js = await readFile(join(dir, 'harness.js'))
    server = createServer((req, res) => {
      res.setHeader('Content-Type', req.url === '/harness.js' ? 'text/javascript' : 'text/html')
      res.end(req.url === '/harness.js' ? js : '<div id="root"></div><script type="module" src="/harness.js"></script>')
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    browser = await require(playwright).chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 360, height: 900 } })
    page.setDefaultTimeout(2_000)
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    const url = `http://127.0.0.1:${server.address().port}`
    const picker = page.locator('.wou-settings-view .wou-select')
    const options = () => picker.locator('option').allTextContents()
    async function openCatchUp() {
      await page.goto(url)
      await page.getByRole('button', { name: 'Catch up', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('option[value="work:p_beta"]'))
    }
    async function waitCatalogWithoutBeta() {
      await page.waitForFunction(() =>
        !document.querySelector('option[value="work:p_beta"]') &&
        !!document.querySelector('option[value="default:p_alpha"]'))
      assert.deepEqual(await options(), ['No project', 'Alpha · default'])
    }

    await t.test('tasks-changed refresh still works', async () => {
      await openCatchUp()
      await picker.selectOption('')
      await page.evaluate(() => {
        window.projectProbe.requests.length = 0
        window.projectProbe.setCatalog(true)
        window.dispatchEvent(new CustomEvent('waiting-on-you:tasks-changed'))
      })
      await waitCatalogWithoutBeta()
      assert.ok(await page.evaluate(() => window.projectProbe.requests.includes('/projects')))
    })

    for (const atom of ['profile', 'focusedProfile', 'connection']) {
      await t.test(`${atom} change reloads and clears an old selected project`, async () => {
        await openCatchUp()
        assert.deepEqual(await page.evaluate(() => window.projectProbe.storage.get('projectFilter')), ['work:p_beta'],
          'initial mount preserves a saved valid filter')
        await picker.selectOption('work:p_beta')
        await page.evaluate(atom => {
          window.projectProbe.requests.length = 0
          window.projectProbe.setCatalog(true)
          window.projectProbe.setScope(atom, 'other')
        }, atom)
        await waitCatalogWithoutBeta()
        assert.equal(await picker.inputValue(), '', 'old catch-up selection is cleared')
        assert.equal(await page.evaluate(() => window.projectProbe.storage.get('projectFilter')), 'all',
          'old list filter is cleared too')
        assert.ok(await page.evaluate(() => window.projectProbe.requests.includes('/projects')))
      })
    }

    for (const fail of [false, true]) {
      await t.test(`old in-flight ${fail ? 'error' : 'success'} cannot replace the new catalog`, async () => {
        await openCatchUp()
        await picker.selectOption('work:p_beta')
        await page.evaluate(() => {
          window.projectProbe.deferProject()
          window.dispatchEvent(new CustomEvent('waiting-on-you:tasks-changed'))
        })
        await page.waitForFunction(() => window.projectProbe.hasHeldProject())
        await page.evaluate(() => {
          window.projectProbe.setCatalog(true)
          window.projectProbe.setScope('profile', 'work')
        })
        await waitCatalogWithoutBeta()
        await page.evaluate(fail => window.projectProbe.settleProject(fail), fail)
        await page.waitForTimeout(150)
        assert.deepEqual(await options(), ['No project', 'Alpha · default'])
        assert.equal(await picker.inputValue(), '')
        assert.equal(await page.getByRole('alert').count(), 0)
      })
    }

    await t.test('Scan now still reloads projects', async () => {
      await openCatchUp()
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await page.evaluate(() => { window.projectProbe.requests.length = 0 })
      await page.getByRole('button', { name: /scan now/i }).first().click()
      await page.waitForFunction(() => window.projectProbe.requests.includes('/projects'))
      assert.ok(await page.evaluate(() => window.projectProbe.requests.includes('/scan')))
    })
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    if (server) await new Promise(resolve => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  }
})
