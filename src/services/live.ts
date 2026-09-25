/**
 * Live Firestore data that never mistakes "no connection" for "no data".
 *
 * When the server can't be reached, onSnapshot first answers from the local
 * cache, which is empty on a fresh page. Shown as-is, the ticket queue would
 * say "No tickets" and a ticket would look deleted. This wrapper:
 *   - ignores EMPTY snapshots that came only from the cache,
 *   - reports `unavailable` if the server hasn't answered within OFFLINE_AFTER_MS,
 *     while staying subscribed, so data appears as soon as the connection returns,
 *   - passes everything else straight through (including a server-confirmed empty list).
 *
 * No Firebase imports: unit-tested with fake timers in live.test.ts.
 */
import type { Subscribe } from '../hooks/useSubscription'

export const OFFLINE_AFTER_MS = 10_000

interface Snapshot {
  metadata: { fromCache: boolean }
}

/**
 * @param listen   starts the real listener, e.g.
 *                 (next, fail) => onSnapshot(q, { includeMetadataChanges: true }, next, fail)
 * @param isEmpty  true if the snapshot has no data (empty list, missing document)
 * @param toData   turns a snapshot into what the page shows
 */
export function serverConfirmed<S extends Snapshot, T>(
  listen: (next: (snapshot: S) => void, fail: (error: unknown) => void) => () => void,
  isEmpty: (snapshot: S) => boolean,
  toData: (snapshot: S) => T,
  offlineAfterMs = OFFLINE_AFTER_MS,
): Subscribe<T> {
  return (onData, onError) => {
    let answered = false
    const timer = setTimeout(() => {
      if (!answered) onError({ code: 'unavailable' })
    }, offlineAfterMs)

    const stop = listen(
      (snapshot) => {
        if (snapshot.metadata.fromCache && isEmpty(snapshot)) return // "nothing cached yet", not "nothing exists"
        answered = true
        clearTimeout(timer)
        onData(toData(snapshot))
      },
      (error) => {
        answered = true
        clearTimeout(timer)
        onError(error)
      },
    )

    return () => {
      clearTimeout(timer)
      stop()
    }
  }
}
