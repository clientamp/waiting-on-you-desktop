import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import test from 'node:test'

async function load() {
  const dir = await mkdtemp(join(tmpdir(), 'wou-answers-'))
  const outfile = join(dir, 'answers.mjs')
  await build({
    entryPoints: ['src/ui/answers.ts'],
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

const m = await load()

// Invented examples shaped like real yes/no and open asks (for detection regression).
const YES_NO = [
  'Say whether to check if bakery.example is set up in Bing Webmaster Tools.',
  'Say whether to clean the four bad lines in the shared config sample file.',
  'Say whether to schedule the monthly checker that pings you only on a FAIL.',
  'Tell the agent whether to send a test from your address to outside inboxes to check spam placement.',
  'Say whether to install Standard Music on the Atlas Mini for an evening trial.',
  'Say ship when you want live moved off 2.4.1.',
  'Say yes so the P-B5 clipboard fix can go on the content Mini.',
  'Say if the privacy page’s purple headings and table text should be fixed in this pass.',
  'Decide if coaches may send a welcome message before the client finishes intake.',
  'Approve adding keyword intent grouping to the monthly Scout Analytics run.',
  'Reply whether to shut down the two one-off visit links from yesterday.',
  'Say if your own Macs should switch from Retro to Paper after the next update.',
  'Say whether to close the studio admin page tonight.',
  'Confirm WhisperLocal still sends transcripts to a local Ollama model.',
  'Approve the weather lessons review as an upgrade to the existing Atlas system, not a new build.',
  'Should I push the fix to Studio now?',
  'OK to restart the gateway tonight?',
  'Reply yes or no on Monday check-in item 5.',
  'Reply yes if Gateway should reconnect the team inbox over Tailscale.',
  'Do you want this saved in Apple Notes with a daily morning reminder for which session is today?',
]

const OPEN = [
  'Sign in to ExampleBase and link LinkedIn, or say to skip ExampleBase.',
  'Press Cmd-K, reload desktop plugins on each Mac, then right-click a chat card to try Close all tasks.',
  'Choose whether to run a first security scan on scout-courses or harbor-app.',
  'Approve or rewrite the suggested thank-you for @scoutdev on the Harbor comment.',
  'Call or email the venue about the Saturday booking.',
  'Name 2–3 Atlas clients who would take a reference call.',
  'Decide whether Intensive support threads start in juno.example.com or a new Atlas space.',
  'Choose whether to nudge Sam or have the agent run the catering numbers.',
  'Say whether to start the atlas-os security scan or pick a different repo.',
  'Choose who drafts and sends Studio support replies at launch.',
  'Say whether you will mostly train together or separately.',
  'Choose whether to delete or encrypt the six plaintext config backup copies.',
  'Turn Tailscale on for your iPad so it can receive mail again.',
  'Which title do you want for the launch video?',
  'Should we ship Monday or Tuesday?',
  '',
]

test('isYesNoAsk accepts real yes-or-no asks', () => {
  for (const ask of YES_NO) assert.equal(m.isYesNoAsk(ask), true, ask)
})

test('isYesNoAsk rejects choices, open questions and to-dos', () => {
  for (const ask of OPEN) assert.equal(m.isYesNoAsk(ask), false, ask)
})

test('answerMessage quotes the ask after the answer', () => {
  const ask = 'Say whether to close the studio admin page tonight.'
  assert.equal(
    m.answerMessage('yes', ask),
    'Yes.\n\n(Answering from Waiting On You: “Say whether to close the studio admin page tonight.”)',
  )
  assert.equal(m.answerMessage('no', ask).split('\n')[0], 'No.')
  assert.equal(
    m.answerMessage('reply', ask, '  Close it after 9 PM.  '),
    'Close it after 9 PM.\n\n(Answering from Waiting On You: “Say whether to close the studio admin page tonight.”)',
  )
})

test('answerMessage refuses an empty reply and flattens the quoted ask', () => {
  assert.equal(m.answerMessage('reply', 'Pick one', '   '), null)
  assert.equal(
    m.answerMessage('yes', 'Line one\n\nline two'),
    'Yes.\n\n(Answering from Waiting On You: “Line one line two”)',
  )
})

test('answerMessage caps a long reply', () => {
  const long = 'x'.repeat(m.REPLY_MAX_CHARS + 50)
  const msg = m.answerMessage('reply', 'Ask', long)
  assert.equal(msg.split('\n')[0].length, m.REPLY_MAX_CHARS)
})

function key(k, extra = {}) {
  return { key: k, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, typing: false, ...extra }
}

test('answerKeyAction maps single keys', () => {
  assert.equal(m.answerKeyAction(key('y')), 'yes')
  assert.equal(m.answerKeyAction(key('Y')), 'yes')
  assert.equal(m.answerKeyAction(key('n')), 'no')
  assert.equal(m.answerKeyAction(key('r')), 'reply')
  assert.equal(m.answerKeyAction(key('l')), 'later')
  assert.equal(m.answerKeyAction(key('o')), 'open')
  assert.equal(m.answerKeyAction(key('j')), 'next')
  assert.equal(m.answerKeyAction(key('ArrowDown')), 'next')
  assert.equal(m.answerKeyAction(key('k')), 'prev')
  assert.equal(m.answerKeyAction(key('ArrowUp')), 'prev')
})

test('answerKeyAction ignores modifiers, typing and other keys', () => {
  assert.equal(m.answerKeyAction(key('y', { metaKey: true })), null)
  assert.equal(m.answerKeyAction(key('y', { ctrlKey: true })), null)
  assert.equal(m.answerKeyAction(key('y', { altKey: true })), null)
  assert.equal(m.answerKeyAction(key('Y', { shiftKey: true })), null)
  assert.equal(m.answerKeyAction(key('y', { typing: true })), null)
  assert.equal(m.answerKeyAction(key('ArrowDown', { typing: true })), null)
  assert.equal(m.answerKeyAction(key('x')), null)
  assert.equal(m.answerKeyAction(key('Enter')), null)
})

test('moveActive steps through the order and starts at an end', () => {
  const order = [5, 9, 2]
  assert.equal(m.moveActive(order, null, 1), 5)
  assert.equal(m.moveActive(order, null, -1), 2)
  assert.equal(m.moveActive(order, 5, 1), 9)
  assert.equal(m.moveActive(order, 2, 1), 2)
  assert.equal(m.moveActive(order, 5, -1), 5)
  assert.equal(m.moveActive(order, 77, 1), 5)
  assert.equal(m.moveActive([], 5, 1), null)
})

test('keepActive moves to the next task when the active one leaves', () => {
  assert.equal(m.keepActive([1, 2, 3], [1, 2, 3], 2), 2)
  assert.equal(m.keepActive([1, 2, 3], [1, 3], 2), 3)
  assert.equal(m.keepActive([1, 2, 3], [1, 2], 3), 2)
  assert.equal(m.keepActive([1, 2, 3], [], 2), null)
  assert.equal(m.keepActive([1, 2, 3], [4, 5], 2), 4)
  assert.equal(m.keepActive([1, 2], [1, 2], null), null)
})

/** Fake Desktop composer bus. `owner` = the chat on screen with a loaded composer. */
function fakeDesktop({ owner = null, draft = '', stash = '', openMakesOwner = 2, ignoreOpen = false, shown } = {}) {
  const state = { owner, shown: shown === undefined ? owner : shown, draft, stash, opened: [], submitted: [], polls: 0 }
  const composer = {
    getDraft: async id => {
      if (id === null) return state.owner ? state.draft : null
      return state.owner === id ? state.draft : state.stash || null
    },
    setDraft: async () => {
      throw new Error('delivery must never write the draft')
    },
    submit: (id, text) => {
      if (state.owner !== id) return false
      state.submitted.push({ id, text })
      return true
    },
  }
  const deps = {
    composer,
    shownSessionId: () => state.shown,
    openInPlace: async id => {
      state.opened.push(id)
      state.shown = id
    },
    sleep: async () => {
      state.polls++
      if (!ignoreOpen && state.opened.length && state.polls >= openMakesOwner) state.owner = state.opened.at(-1)
    },
    timeoutMs: 8000,
    pollMs: 200,
  }
  return { state, deps }
}

test('deliverToChat sends straight away when the chat is already on screen, leaving the draft alone', async () => {
  const { state, deps } = fakeDesktop({ owner: 's1', draft: 'half typed' })
  assert.equal(await m.deliverToChat(deps, 's1', 'Yes.'), true)
  assert.deepEqual(state.opened, [])
  assert.deepEqual(state.submitted, [{ id: 's1', text: 'Yes.' }])
  assert.equal(state.draft, 'half typed')
})

test('deliverToChat with an empty draft sends without a second read', async () => {
  const { state, deps } = fakeDesktop({ owner: 's1', draft: '' })
  assert.equal(await m.deliverToChat(deps, 's1', 'Yes.'), true)
  assert.deepEqual(state.submitted, [{ id: 's1', text: 'Yes.' }])
})

test('deliverToChat opens the chat and waits until its composer owns it', async () => {
  const { state, deps } = fakeDesktop({ owner: 'other', openMakesOwner: 3 })
  assert.equal(await m.deliverToChat(deps, 's1', 'No.'), true)
  assert.deepEqual(state.opened, ['s1'])
  assert.deepEqual(state.submitted, [{ id: 's1', text: 'No.' }])
})

test('deliverToChat opens the chat when only a hidden tab owns it', async () => {
  const { state, deps } = fakeDesktop({ owner: 's1' })
  let hidden = true
  const submit = deps.composer.submit
  deps.composer.submit = (id, text) => (hidden ? false : submit(id, text))
  deps.openInPlace = async id => {
    state.opened.push(id)
    hidden = false
  }
  assert.equal(await m.deliverToChat(deps, 's1', 'Yes.'), true)
  assert.deepEqual(state.opened, ['s1'])
  assert.deepEqual(state.submitted, [{ id: 's1', text: 'Yes.' }])
})

test('deliverToChat never sends into another chat and fails closed on timeout', async () => {
  const { state, deps } = fakeDesktop({ owner: 'other', ignoreOpen: true })
  assert.equal(await m.deliverToChat(deps, 's1', 'Yes.'), false)
  assert.deepEqual(state.submitted, [])
  assert.ok(state.polls <= 8000 / 200 + 1)
})

test('deliverToChat does not mistake a saved draft for a loaded chat', async () => {
  // On screen, but its composer has not loaded: the chat read falls back to the saved draft.
  const { state, deps } = fakeDesktop({ owner: null, shown: 's1', stash: 'saved words', ignoreOpen: true })
  assert.equal(await m.deliverToChat(deps, 's1', 'Yes.'), false)
  assert.deepEqual(state.submitted, [])
})

test('deliverToChat waits while the screen still shows another chat', async () => {
  const { state, deps } = fakeDesktop({ owner: 's1', shown: 'other', ignoreOpen: true })
  deps.openInPlace = async id => {
    state.opened.push(id)
  }
  assert.equal(await m.deliverToChat(deps, 's1', 'Yes.'), false)
  assert.deepEqual(state.submitted, [])
})

test('deliverToChat stops before sending once aborted', async () => {
  const { state, deps } = fakeDesktop({ owner: 'other', openMakesOwner: 3 })
  const signal = { aborted: false }
  deps.signal = signal
  const sleep = deps.sleep
  deps.sleep = async ms => {
    await sleep(ms)
    signal.aborted = true
  }
  assert.equal(await m.deliverToChat(deps, 's1', 'Yes.'), false)
  assert.deepEqual(state.submitted, [])
})

test('deliverToChat refuses empty text and a host without the composer verbs', async () => {
  const { deps } = fakeDesktop({ owner: 's1' })
  assert.equal(await m.deliverToChat(deps, 's1', '   '), false)
  assert.equal(await m.deliverToChat({ ...deps, composer: { submit: deps.composer.submit } }, 's1', 'Yes.'), false)
  assert.equal(m.hostCanSubmit({ composer: deps.composer }), true)
  assert.equal(m.hostCanSubmit({ composer: { submit() {} } }), false)
  assert.equal(m.hostCanSubmit({}), false)
})

test('canAnswerInPanel: only open chats that open in this window, on hosts that can send', () => {
  const local = { chat_key: 'local-' + 'a'.repeat(64), chat_target: null, status: 'open' }
  assert.equal(m.canAnswerInPanel(local, true), true)
  assert.equal(m.unsupportedAnswerReason(local), null)
  assert.equal(m.canAnswerInPanel(local, false), false)
  assert.equal(m.canAnswerInPanel({ ...local, status: 'done' }, true), false)
  const otherProfile = {
    chat_key: 'juno:20261101_161934_424d57',
    chat_target: { session_id: '20261101_161934_424d57', profile: 'juno', connection: null },
    status: 'open',
  }
  assert.equal(m.canAnswerInPanel(otherProfile, true), false)
  assert.equal(m.unsupportedAnswerReason(otherProfile), 'other-window')
  const remote = {
    chat_key: 'studio:abc',
    chat_target: { session_id: 'abc', profile: null, connection: 'conn-studio' },
    status: 'open',
  }
  assert.equal(m.canAnswerInPanel(remote, true), false)
  assert.equal(m.unsupportedAnswerReason(remote), 'other-window')
  const mail = { chat_key: 'mailhist:client_questions:4', chat_target: null, status: 'open' }
  assert.equal(m.canAnswerInPanel(mail, true), false)
  assert.equal(m.unsupportedAnswerReason(mail), null)
  assert.equal(m.unsupportedAnswerReason({ ...otherProfile, status: 'done' }), null)
  assert.equal(m.ANSWER_DELAY_MS, 5000)
})

test('canAnswerInPanel: main-target inline only in default window; never cross-profile', () => {
  const mainTask = {
    chat_key: '20261101_161934_424d57',
    chat_target: { session_id: '20261101_161934_424d57', profile: null, connection: null },
    status: 'open',
  }
  const defaultScope = { profile: 'default', connectionId: null }
  const studioScope = { profile: 'studio', connectionId: null }

  assert.equal(m.canAnswerInPanel(mainTask, true), true)
  assert.equal(m.canAnswerInPanel(mainTask, true, defaultScope), true)
  assert.equal(m.canAnswerInPanel(mainTask, true, studioScope), false)

  const explicitStudioTarget = {
    chat_key: 'studio:20261101_161934_424d57',
    chat_target: { session_id: '20261101_161934_424d57', profile: 'studio', connection: null },
    status: 'open',
  }
  assert.equal(m.canAnswerInPanel(explicitStudioTarget, true, studioScope), false)
})

test('deliverToChat never submits once the answer window scope is gone', async () => {
  const { state, deps } = fakeDesktop({ owner: 'other', openMakesOwner: 2 })
  let inScope = true
  deps.inScope = () => inScope
  const sleep = deps.sleep
  deps.sleep = async ms => {
    inScope = false
    await sleep(ms)
  }
  assert.equal(await m.deliverToChat(deps, 's1', 'Yes.'), false)
  assert.deepEqual(state.submitted, [])
})

test('deliverToChat with inScope false never calls openInPlace', async () => {
  const { state, deps } = fakeDesktop({ owner: 'other', openMakesOwner: 2 })
  deps.inScope = () => false
  assert.equal(await m.deliverToChat(deps, 's1', 'Yes.'), false)
  assert.deepEqual(state.opened, [])
  assert.deepEqual(state.submitted, [])
})

test('answerWindowScope treats local connection as in-window default profile', () => {
  assert.deepEqual(m.answerWindowScope('local', 'Default'), { profile: 'default', connectionId: null })
  assert.deepEqual(m.answerWindowScope('conn-b', 'Studio'), { profile: 'studio', connectionId: 'conn-b' })
  assert.equal(m.sameAnswerWindowScope({ profile: 'default', connectionId: null }, { profile: 'default', connectionId: null }), true)
  assert.equal(m.sameAnswerWindowScope({ profile: 'default', connectionId: 'a' }, { profile: 'default', connectionId: 'b' }), false)
})
