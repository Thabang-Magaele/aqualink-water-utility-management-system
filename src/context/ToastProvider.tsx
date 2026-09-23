import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastInput, type ToastTone } from './ToastContext'

interface ToastItem extends ToastInput {
  id: number
  tone: ToastTone
}

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info }
const ICON_COLOURS = { success: 'text-clear', error: 'text-fault', info: 'text-channel' }
const DURATION_MS = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-3), { tone: 'success', ...input, id }])
      // Errors stay until dismissed so they can be read.
      if (input.tone !== 'error') setTimeout(() => dismiss(id), DURATION_MS)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Live region exists before any toast so screen readers announce new ones */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.tone]
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="border-mist pointer-events-auto flex w-full max-w-sm [animation:toast-in_160ms_ease-out] items-start gap-3 rounded-lg border bg-white px-4 py-3 shadow-lg"
            >
              <Icon
                className={`mt-0.5 size-5 shrink-0 ${ICON_COLOURS[t.tone]}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">{t.title}</p>
                {t.message && <p className="text-ink/70 mt-0.5">{t.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="text-ink/50 hover:bg-mist hover:text-ink -m-1 rounded p-1"
                aria-label="Dismiss notification"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
