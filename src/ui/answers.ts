/** Pure helpers for answering asks from the panel. No SDK imports, so tests can load them. */
import { planOpen, type ChatTarget } from './chatRoute'

export type AnswerKind = 'yes' | 'no' | 'reply'
export type AnswerKey = 'yes' | 'no' | 'reply' | 'later' | 'open' | 'next' | 'prev'

/** Long enough for a real answer, short enough that a stuck key can't paste a novel. */
export const REPLY_MAX_CHARS = 4000

/** Worst-case UTF-8 for that character cap. A 4,096-byte JSON body is a different limit. */
export const REPLY_MAX_UTF8_BYTES = 16_000

/** Clip on UTF-16 units, matching the reply field, without leaving a split emoji. */
export function clipText(text: string, maxChars: number): string {
  let end = Math.min(Math.max(maxChars, 0), text.length)
  if (end > 0 && text.charCodeAt(end - 1) >= 0xd800 && text.charCodeAt(end - 1) <= 0xdbff) end -= 1
  return text.slice(0, end)
}

/** True only when the text fits both the character cap and the UTF-8 byte cap. */
export function fitsPayload(text: string, maxChars: number, maxBytes: number): boolean {
  return text.length <= maxChars && new TextEncoder().encode(text).length <= maxBytes
}

/** True when the serialized JSON body fits, counting escapes, and its text fits the character cap. */
export function serializedPayloadFits(
  payload: { text?: unknown },
  maxChars: number,
  maxBytes: number,
): boolean {
  if (typeof payload.text === 'string' && payload.text.length > maxChars) return false
  return new TextEncoder().encode(JSON.stringify(payload)).length <= maxBytes
}

/** How long an answer waits before it goes, so a misclick can be undone. */
export const ANSWER_DELAY_MS = 5000

// The classifier writes asks as imperatives ("Say whether…", "Approve…").
// These openings ask for a plain yes or no.
const YES_NO_OPENINGS: RegExp[] = [
  /^(say|reply|answer|decide|confirm|check|let \w+ know)\s+(whether|if)\b/,
  /^tell(\s+[\w’'-]+){0,3}\s+(whether|if)\b/,
  /^(say|reply|answer)\s+(yes|no|ok|okay|go|ship)\b/,
  /^(approve|confirm|ok|okay|allow|authorize|authorise|green-?light|sign off on)\b/,
  /^(should|shall|can|could|may|do|does|did|is|are|was|will|would|want)\b.*\?$/,
]

/** True when the ask is a yes-or-no question. Anything offering alternatives
 *  ("…or pick a different repo", "Approve or rewrite") is not. */
export function isYesNoAsk(ask: string): boolean {
  // "yes or no" names the two answers; it isn't a choice between alternatives.
  const text = ask.trim().replace(/\s+/g, ' ').toLowerCase().replace(/\byes or no\b/g, 'yes-no')
  if (!text) return false
  if (/\bor\b/.test(text)) return false
  if (/^(which|what|who|when|where|how|why)\b/.test(text)) return false
  return YES_NO_OPENINGS.some(re => re.test(text))
}

/** The message sent to the chat: the answer, then the ask it answers, so the agent
 *  knows what "Yes" refers to even if the chat moved on. Null for an empty reply. */
export function answerMessage(kind: AnswerKind, ask: string, reply = ''): string | null {
  let answer: string
  if (kind === 'yes') answer = 'Yes.'
  else if (kind === 'no') answer = 'No.'
  else {
    answer = clipText(reply.trim(), REPLY_MAX_CHARS).trim()
    if (!answer) return null
  }
  const quoted = ask.trim().replace(/\s+/g, ' ')
  return quoted ? `${answer}\n\n(Answering from Waiting On You: “${quoted}”)` : answer
}

export interface KeyInput {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  /** Focus is in a text field, select or editable area. */
  typing: boolean
}

const KEY_ACTIONS: Record<string, AnswerKey> = {
  y: 'yes',
  n: 'no',
  r: 'reply',
  l: 'later',
  o: 'open',
  j: 'next',
  arrowdown: 'next',
  k: 'prev',
  arrowup: 'prev',
}

/** Single-key panel shortcut, or null. Never fires while typing or with a modifier. */
export function answerKeyAction(e: KeyInput): AnswerKey | null {
  if (e.typing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return null
  return KEY_ACTIONS[e.key.toLowerCase()] ?? null
}

/** Next/previous id in display order; from nothing (or a missing id) start at an end. */
export function moveActive(order: readonly number[], current: number | null, dir: 1 | -1): number | null {
  if (order.length === 0) return null
  const i = current == null ? -1 : order.indexOf(current)
  if (i < 0) return dir === 1 ? order[0] : order[order.length - 1]
  return order[Math.min(order.length - 1, Math.max(0, i + dir))]
}

/** Keep the active task when the list changes. If it left (answered, closed),
 *  move to the next task that was below it, else the one above, else the first. */
export function keepActive(
  prevOrder: readonly number[],
  nextOrder: readonly number[],
  current: number | null,
): number | null {
  if (current == null) return null
  if (nextOrder.includes(current)) return current
  if (nextOrder.length === 0) return null
  const live = new Set(nextOrder)
  const i = prevOrder.indexOf(current)
  if (i >= 0) {
    for (let j = i + 1; j < prevOrder.length; j++) if (live.has(prevOrder[j])) return prevOrder[j]
    for (let j = i - 1; j >= 0; j--) if (live.has(prevOrder[j])) return prevOrder[j]
  }
  return nextOrder[0]
}

/** The Desktop composer verbs a send needs (see Desktop `sdk/composer.ts`). */
export interface ComposerVerbs {
  /** Session id = that chat's composer (live text, else its saved draft);
   *  null = the live composer (live text only). */
  getDraft: (sessionId: string | null) => Promise<string | null>
  submit: (sessionId: string, text: string) => boolean
}

export function hostCanSubmit(host: { composer?: Partial<ComposerVerbs> | null }): boolean {
  const c = host.composer
  return Boolean(c && typeof c.getDraft === 'function' && typeof c.submit === 'function')
}

/** Profile and connection for the Desktop window where an answer was queued. */
export interface AnswerWindowScope {
  profile: string
  connectionId: string | null
}

export function answerWindowScope(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
): AnswerWindowScope {
  const conn = connectionId?.trim()
  return {
    profile: (profile?.trim() || 'default').toLowerCase(),
    connectionId: conn && conn !== 'local' ? conn : null,
  }
}

export function sameAnswerWindowScope(a: AnswerWindowScope, b: AnswerWindowScope): boolean {
  return a.profile === b.profile && a.connectionId === b.connectionId
}

export interface DeliverDeps {
  composer: Partial<ComposerVerbs> | null | undefined
  /** Stored id of the chat on screen (Desktop `host.state.focusedStoredSessionId`). */
  shownSessionId: () => string | null
  /** Open the chat in the main pane (the same door the sidebar uses). */
  openInPlace: (sessionId: string) => Promise<void>
  sleep: (ms: number) => Promise<void>
  timeoutMs: number
  pollMs: number
  /** Stops the send (panel closed). Checked right before every submit. */
  signal?: { aborted: boolean }
  /** False when this window left the profile/connection active at enqueue time. */
  inScope?: () => boolean
}

/** True only when the chat on screen is this chat and its own loaded composer
 *  answers for it. Reads only; never touches the user's draft.
 *  - An empty reply can only come from the live composer (a saved draft that is
 *    empty reads as null).
 *  - A non-empty reply could be a saved draft from storage, so it must also match
 *    the live text of the composer in use. */
async function composerOwns(deps: DeliverDeps, c: ComposerVerbs, sessionId: string): Promise<boolean> {
  if (deps.shownSessionId() !== sessionId) return false
  const forChat = await c.getDraft(sessionId)
  if (forChat == null) return false
  if (forChat === '') return true
  const live = await c.getDraft(null)
  return live === forChat && deps.shownSessionId() === sessionId
}

/** Send `text` into the chat as if the user typed it and pressed Enter. Opens the chat
 *  first when it isn't on screen, and sends only once its own composer owns it,
 *  so an answer can never land in whichever chat happened to be showing. */
export async function deliverToChat(deps: DeliverDeps, sessionId: string, text: string): Promise<boolean> {
  const c = deps.composer
  if (!text.trim() || !sessionId || !c || !hostCanSubmit({ composer: c })) return false
  const verbs = c as ComposerVerbs
  const stopped = () => deps.signal?.aborted === true
  // submit() itself refuses a composer that isn't visible (a hidden keep-alive
  // tab can own the chat but not take a send), so false just means "open it".
  const scoped = () => deps.inScope == null || deps.inScope()
  const trySend = async () => {
    if (stopped() || !scoped() || !(await composerOwns(deps, verbs, sessionId)) || stopped() || !scoped())
      return false
    return verbs.submit(sessionId, text)
  }
  if (await trySend()) return true
  if (stopped() || !scoped()) return false
  await deps.openInPlace(sessionId)
  const tries = Math.max(1, Math.ceil(deps.timeoutMs / deps.pollMs))
  for (let i = 0; i < tries; i++) {
    if (stopped() || !scoped()) return false
    await deps.sleep(deps.pollMs)
    if (stopped() || !scoped()) return false
    if (await trySend()) return true
  }
  return false
}

/** Answer buttons only for open chats that open in this window, on hosts that can
 *  send into a chat. Other profiles and remote connections open in their own
 *  window; non-chat tasks have no chat to answer. Never treat those as sendable. */
export function canAnswerInPanel(
  task: { chat_key: string; chat_target?: ChatTarget | null; status: string },
  canSubmit: boolean,
  scope: AnswerWindowScope = { profile: 'default', connectionId: null },
): boolean {
  if (!canSubmit || task.status !== 'open') return false
  if (scope.profile !== 'default') return false
  if (unsupportedAnswerReason(task)) return false
  return planOpen(task.chat_key, task.chat_target).kind === 'main'
}

/** Remote chats and other profiles open in another window. This window's composer
 *  cannot send there, and opening that window is not a send. Null for a chat this
 *  window owns, and for tasks that are not chats. */
export function unsupportedAnswerReason(
  task: { chat_key: string; chat_target?: ChatTarget | null; status: string },
): 'other-window' | null {
  if (task.status !== 'open') return null
  return planOpen(task.chat_key, task.chat_target).kind === 'profile' ? 'other-window' : null
}
