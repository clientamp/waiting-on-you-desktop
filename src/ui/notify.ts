import { host } from '@hermes/plugin-sdk'

/** Desktop's host.notify takes an object ({ kind, message }), and
 *  host.notifyError takes (error, fallback). Passing a bare string to either
 *  renders a blank toast, so every plugin message goes through here. */

type NotifyInput = { kind?: 'info' | 'success' | 'warning' | 'error'; message: string; detail?: string }

const rawNotify = (host as unknown as { notify: (input: NotifyInput) => void }).notify

export function notify(message: string): void {
  rawNotify({ kind: 'info', message })
}

export function notifyError(message: string, detail?: string): void {
  rawNotify(detail ? { kind: 'error', message, detail } : { kind: 'error', message })
}
