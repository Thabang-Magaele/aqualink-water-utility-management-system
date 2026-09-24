import { useEffect, useState } from 'react'

export type Subscribe<T> = (
  onData: (data: T) => void,
  onError: (error: unknown) => void,
) => () => void

/**
 * Keeps a live Firestore subscription (onSnapshot) open while the component is shown.
 *
 *   const tickets = useSubscription((ok, fail) => subscribeQueue(ok, fail), 'queue')
 *
 * `key` identifies the subscription; changing it re-subscribes. Pass `null` to skip.
 */
export function useSubscription<T>(subscribe: Subscribe<T> | null, key: string) {
  const [state, setState] = useState<{ key: string; data?: T; error?: unknown } | null>(null)
  const enabled = subscribe !== null

  useEffect(() => {
    if (!subscribe) return
    return subscribe(
      (data) => setState({ key, data }),
      (error) => setState({ key, error }),
    )
    // `key` identifies the subscription; `subscribe` is a new function on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  const current = state?.key === key ? state : null
  return { data: current?.data, error: current?.error, loading: enabled && !current }
}
