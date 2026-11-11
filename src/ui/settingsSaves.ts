/** One save lane for every Settings exit/debounce path, with per-field drafts.
 * An acknowledgement only clears the revision it sent; later edits always win.
 */
export function createSettingsSaveQueue<T extends object>(
  send: (patch: Partial<T>) => Promise<T>,
) {
  let tail: Promise<unknown> = Promise.resolve()
  let drafts: Partial<T> = {}
  const revisions = new Map<keyof T, number>()
  let revision = 0
  const merge = (server: T): T => ({ ...server, ...drafts })
  return {
    merge,
    edit(patch: Partial<T>) {
      drafts = { ...drafts, ...patch }
      for (const key of Object.keys(patch) as (keyof T)[]) revisions.set(key, ++revision)
    },
    save(patch: Partial<T>): Promise<T> {
      const sent = { ...patch }
      const sentRevisions = new Map(revisions)
      const result = tail.then(async () => {
        const server = await send(sent)
        for (const key of Object.keys(sent) as (keyof T)[]) {
          if (revisions.get(key) === sentRevisions.get(key)) delete drafts[key]
        }
        return merge(server)
      })
      // A failed save must not poison the lane or automatically retry forever.
      tail = result.then(() => undefined, () => undefined)
      return result
    },
  }
}
