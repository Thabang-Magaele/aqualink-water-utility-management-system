import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  /** Buttons row at the bottom, e.g. Cancel + Save. */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  children?: ReactNode
}

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' }

/**
 * Accessible modal built on the native <dialog> element, which gives focus
 * trapping, Escape-to-close and a backdrop for free.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  children,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      document.documentElement.style.overflow = 'hidden'
    } else if (!open && dialog.open) {
      dialog.close()
    }
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault() // Escape: let the parent decide
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose() // backdrop click
      }}
      className={`m-auto w-[calc(100%-2rem)] ${SIZES[size]} text-ink rounded-lg bg-white p-0 shadow-xl`}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <header className="border-mist flex items-start justify-between gap-4 border-b px-5 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-bold">
                {title}
              </h2>
              {description && (
                <p id={descId} className="text-ink/65 mt-0.5 text-sm">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-ink/60 hover:bg-mist hover:text-ink -m-1 rounded-md p-1"
              aria-label="Close"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>
          {children && <div className="overflow-y-auto px-5 py-4">{children}</div>}
          {footer && (
            <footer className="border-mist bg-paper flex flex-wrap justify-end gap-2 border-t px-5 py-3">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  )
}
