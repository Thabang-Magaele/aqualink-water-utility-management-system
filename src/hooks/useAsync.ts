import { useCallback, useEffect, useState } from 'react'

interface Settled<T> {
  key: string
  data?: T
  error?: unknown
}

/**
 * Runs an async load and tracks loading / data / error.
 *
 *   const invoices = useAsync(() => loadInvoices(id), `invoices:${id}`)
 *
 * `key` identifies the request: when it changes, the load runs again.
 * Pass `null` instead of a function to skip loading (e.g. a section this role can't see).
 */
export function useAsync<T>(load: (() => Promise<T>) | null, key: string) {
  const [settled, setSettled] = useState<Settled<T> | null>(null)
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${key}#${attempt}`
  const enabled = load !== null

  useEffect(() => {
    if (!load) return
    let active = true
    load().then(
      (data) => active && setSettled({ key: requestKey, data }),
      (error) => active && setSettled({ key: requestKey, error }),
    )
    return () => {
      active = false
    }
    // `requestKey` identifies the request; `load` is a new function on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, enabled])

  const current = settled?.key === requestKey ? settled : null
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  return {
    data: current?.data,
    error: current?.error,
    loading: enabled && !current,
    reload,
  }
}
