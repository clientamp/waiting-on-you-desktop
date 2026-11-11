/** Group-row pending label: clear only when animation and response finish for the same token. */

export interface GroupOp {
  token: number
  label: string
  animDone: boolean
  responseDone: boolean
}

export type GroupOpsState = Record<string, GroupOp>

export function startGroupOp(
  state: GroupOpsState,
  chatKey: string,
  label: string,
  token: number,
): GroupOpsState {
  return {
    ...state,
    [chatKey]: { token, label, animDone: false, responseDone: false },
  }
}

export function markGroupAnimDone(
  state: GroupOpsState,
  chatKey: string,
  token: number,
): GroupOpsState {
  const op = state[chatKey]
  if (!op || op.token !== token) return state
  const next = { ...op, animDone: true }
  if (next.responseDone) {
    const out = { ...state }
    delete out[chatKey]
    return out
  }
  return { ...state, [chatKey]: next }
}

export function finishGroupResponse(
  state: GroupOpsState,
  chatKey: string,
  token: number,
  label?: string,
): GroupOpsState {
  const op = state[chatKey]
  if (!op || op.token !== token) return state
  const next = { ...op, responseDone: true, label: label ?? op.label }
  if (next.animDone) {
    const out = { ...state }
    delete out[chatKey]
    return out
  }
  return { ...state, [chatKey]: next }
}

export function cancelGroupOp(
  state: GroupOpsState,
  chatKey: string,
  token: number,
): GroupOpsState {
  const op = state[chatKey]
  if (!op || op.token !== token) return state
  const out = { ...state }
  delete out[chatKey]
  return out
}

export function groupPendingLabel(state: GroupOpsState, chatKey: string): string | undefined {
  return state[chatKey]?.label
}
