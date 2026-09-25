import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OFFLINE_AFTER_MS, serverConfirmed } from './live'

interface FakeSnap {
  metadata: { fromCache: boolean }
  items: string[]
}
const snap = (items: string[], fromCache: boolean): FakeSnap => ({ metadata: { fromCache }, items })

/** A controllable stand-in for onSnapshot. */
function fakeListener() {
  const handlers: { next?: (s: FakeSnap) => void; fail?: (e: unknown) => void } = {}
  const stop = vi.fn()
  const listen = (next: (s: FakeSnap) => void, fail: (e: unknown) => void) => {
    handlers.next = next
    handlers.fail = fail
    return stop
  }
  return { listen, handlers, stop }
}

function subscribeWith(listener: ReturnType<typeof fakeListener>) {
  const onData = vi.fn()
  const onError = vi.fn()
  const subscribe = serverConfirmed(
    listener.listen,
    (s: FakeSnap) => s.items.length === 0,
    (s: FakeSnap) => s.items,
  )
  const unsubscribe = subscribe(onData, onError)
  return { onData, onError, unsubscribe }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('serverConfirmed', () => {
  it('ignores an empty snapshot from the cache and waits for the server', () => {
    const l = fakeListener()
    const { onData } = subscribeWith(l)
    l.handlers.next!(snap([], true))
    expect(onData).not.toHaveBeenCalled()
    l.handlers.next!(snap(['TKT-1'], false))
    expect(onData).toHaveBeenCalledWith(['TKT-1'])
  })

  it('shows a server-confirmed empty list as empty', () => {
    const l = fakeListener()
    const { onData, onError } = subscribeWith(l)
    l.handlers.next!(snap([], false))
    expect(onData).toHaveBeenCalledWith([])
    vi.advanceTimersByTime(OFFLINE_AFTER_MS * 2)
    expect(onError).not.toHaveBeenCalled()
  })

  it('shows cached data straight away when there is some', () => {
    const l = fakeListener()
    const { onData } = subscribeWith(l)
    l.handlers.next!(snap(['TKT-1'], true))
    expect(onData).toHaveBeenCalledWith(['TKT-1'])
  })

  it('reports "unavailable" when the server stays silent, then recovers when it answers', () => {
    const l = fakeListener()
    const { onData, onError } = subscribeWith(l)
    l.handlers.next!(snap([], true))
    vi.advanceTimersByTime(OFFLINE_AFTER_MS - 1)
    expect(onError).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onError).toHaveBeenCalledWith({ code: 'unavailable' })
    l.handlers.next!(snap(['TKT-9'], false)) // connection back
    expect(onData).toHaveBeenCalledWith(['TKT-9'])
  })

  it('passes listener errors through without a later timeout error', () => {
    const l = fakeListener()
    const { onError } = subscribeWith(l)
    l.handlers.fail!({ code: 'permission-denied' })
    vi.advanceTimersByTime(OFFLINE_AFTER_MS * 2)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith({ code: 'permission-denied' })
  })

  it('stops the listener and the timer on unsubscribe', () => {
    const l = fakeListener()
    const { onError, unsubscribe } = subscribeWith(l)
    unsubscribe()
    expect(l.stop).toHaveBeenCalled()
    vi.advanceTimersByTime(OFFLINE_AFTER_MS * 2)
    expect(onError).not.toHaveBeenCalled()
  })
})
