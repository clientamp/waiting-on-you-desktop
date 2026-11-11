/** Node-test entry: snapshot + label helpers with mutable host.state mocks. */

import { buildHostPresenceSnapshot } from './buildHostPresenceSnapshot'
import { chatPresenceIndicators, type HostPresenceSnapshot } from './chatPresence'
import type { Task } from '../model'
import { strings } from './strings'

type MutableAtom<T> = {
  get(): T
  set(value: T): void
}

const copy = {
  presenceWorking: strings.presenceWorking,
  presenceWorkingAria: strings.presenceWorkingAria,
  presenceResponded: strings.presenceResponded,
  presenceRespondedAria: strings.presenceRespondedAria,
  presenceRespondedUnavailable: strings.presenceRespondedUnavailable,
  presenceRespondedUnavailableAria: strings.presenceRespondedUnavailableAria,
  presenceReadUnavailable: strings.presenceReadUnavailable,
  presenceReadUnavailableAria: strings.presenceReadUnavailableAria,
}

export function snapshotFromMock(input: {
  capsState: Record<string, unknown>
  focusedStored: MutableAtom<string | null>
  focusedRuntime: MutableAtom<string | null>
  active: MutableAtom<string | null>
  profile: MutableAtom<string | null>
  owner: MutableAtom<{ connectionId: string; profile: string } | null>
  busy: MutableAtom<boolean>
  awaiting: MutableAtom<boolean>
  busyMap: MutableAtom<Record<string, boolean>>
}): HostPresenceSnapshot {
  return buildHostPresenceSnapshot({
    capsState: input.capsState,
    focusedStored: input.focusedStored.get(),
    focusedRuntime: input.focusedRuntime.get(),
    sessionActive: input.active.get(),
    profile: input.profile.get(),
    owner: input.owner.get(),
    busy: input.busy.get(),
    awaitingResponse: input.awaiting.get(),
    busyBySession: input.busyMap.get(),
  })
}

export function labelsForHostMock(input: {
  capsState: Record<string, unknown>
  focusedStored: MutableAtom<string | null>
  focusedRuntime: MutableAtom<string | null>
  active: MutableAtom<string | null>
  profile: MutableAtom<string | null>
  owner: MutableAtom<{ connectionId: string; profile: string } | null>
  busy: MutableAtom<boolean>
  awaiting: MutableAtom<boolean>
  busyMap: MutableAtom<Record<string, boolean>>
  task: Pick<Task, 'chat_key' | 'chat_target' | 'status' | 'chat_title' | 'topic'>
}): string[] {
  const snapshot = snapshotFromMock(input)
  return chatPresenceIndicators(input.task, snapshot, copy).map(i => i.label)
}
