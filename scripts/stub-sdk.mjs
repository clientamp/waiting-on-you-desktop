import * as React from 'react'

const atom = value => ({ get: () => value, subscribe: () => () => {} })

export const host = {
  state: {
    connectionId: atom(null),
    profile: atom('default'),
    activeSessionId: atom(null),
    busy: atom(false),
    awaitingResponse: atom(false),
    busyBySession: atom({}),
    focusedSessionId: atom(null),
    gateway: atom(''),
    focusedStoredSessionId: atom('sess-stub'),
    focusedSessionProfile: atom('default'),
    focusedSessionOwner: atom(null),
  },
  navigate() {},
  revealPane() {},
  paneVisibility: () => atom(false),
  notify() {},
  notifyError() {},
}

export const useValue = value => value.get()
export const useTheme = () => ({ resolvedMode: 'light' })
export const captureGatewayFileDownload = () => async () => {}
export const MessageTextContent = () => null
export const SandboxedFrame = () => null

export function Dialog({ open, children }) {
  if (!open) return null
  return React.createElement('div', { 'data-wou-dialog': true }, children)
}

export function DialogContent({ children, className }) {
  return React.createElement('div', { className }, children)
}

export function DialogHeader({ children }) {
  return React.createElement('div', null, children)
}

export function DialogTitle({ children }) {
  return React.createElement('h2', null, children)
}

export function DialogDescription({ children, className }) {
  return React.createElement('p', { className }, children)
}

export function DialogFooter({ children, className }) {
  return React.createElement('div', { className }, children)
}

export function Button({ children, ...props }) {
  return React.createElement('button', props, children)
}
