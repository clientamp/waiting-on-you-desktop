import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function loadHelpers() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-group-context-'))
  const outfile = join(dir, 'groupContextClose.mjs')
  await build({
    entryPoints: ['src/ui/groupContextClose.ts'],
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

const helpers = await loadHelpers()

function node({ parent = null, inChildren = false, interactive = false } = {}) {
  const self = { parent, inChildren, interactive }
  self.closest = sel => {
    let cur = self
    while (cur) {
      if (sel === '.wou-group-children' && cur.inChildren) return cur
      if (
        sel === 'button, a, input, textarea, select, [role="menu"], [role="alertdialog"]' &&
        cur.interactive
      ) {
        return cur
      }
      cur = cur.parent
    }
    return null
  }
  return self
}

test('isGroupContextMenuTarget allows card body, not nested rows or controls', () => {
  const body = node()
  assert.equal(helpers.isGroupContextMenuTarget(body), true)

  const nested = node({ parent: node({ inChildren: true }) })
  assert.equal(helpers.isGroupContextMenuTarget(nested), false)

  const onButton = node({ interactive: true })
  assert.equal(helpers.isGroupContextMenuTarget(onButton), false)

  assert.equal(helpers.isGroupContextMenuTarget(null), false)
})

test('canOpenGroupContextMenu mirrors checkbox guard and pending/confirm states', () => {
  const open = {
    pending: false,
    confirmClose: false,
    renameOpen: false,
    aiQuick: false,
    customSnoozeOpen: false,
    checkboxDisabled: false,
  }
  assert.equal(helpers.canOpenGroupContextMenu(open), true)
  assert.equal(helpers.canOpenGroupContextMenu({ ...open, checkboxDisabled: true }), false)
  assert.equal(helpers.canOpenGroupContextMenu({ ...open, pending: true }), false)
  assert.equal(helpers.canOpenGroupContextMenu({ ...open, confirmClose: true }), false)
  assert.equal(helpers.canOpenGroupContextMenu({ ...open, renameOpen: true }), false)
})

test('shouldHandleShiftF10 only on the focused group parent, not bubbled children', () => {
  const parent = {}
  const chevron = {}
  assert.equal(helpers.shouldHandleShiftF10('F10', true, parent, parent, parent), true)
  assert.equal(helpers.shouldHandleShiftF10('F10', true, parent, parent), true)
  assert.equal(helpers.shouldHandleShiftF10('F10', true, chevron, parent, chevron), false)
  assert.equal(helpers.shouldHandleShiftF10('F10', true, chevron, parent, parent), false)
  assert.equal(helpers.shouldHandleShiftF10('F9', true, parent, parent, parent), false)
})

test('group close choice confirms by default and skips prompt when Option is held', () => {
  const calls = []
  helpers.activateGroupCloseChoice('confirm', () => calls.push('confirm'), () => calls.push('done'))
  assert.deepEqual(calls, ['confirm'])
  calls.length = 0
  helpers.activateGroupCloseChoice('done-all', () => calls.push('confirm'), () => calls.push('done'))
  assert.deepEqual(calls, ['done'])
  assert.equal(helpers.groupCloseChoiceFromModifiers(false), 'confirm')
  assert.equal(helpers.groupCloseChoiceFromModifiers(true), 'done-all')
})

test('context menu keys: Escape and Tab dismiss; Enter keeps Option modifier', () => {
  assert.deepEqual(helpers.contextMenuItemKeyAction('Escape', false, true), { action: 'escape' })
  assert.deepEqual(helpers.contextMenuItemKeyAction('Tab', false, true), { action: 'tab-dismiss' })
  assert.deepEqual(helpers.contextMenuItemKeyAction('Enter', true, true), {
    action: 'activate',
    altKey: true,
  })
  assert.deepEqual(helpers.contextMenuItemKeyAction('Enter', false, false), null)
})
