import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import Brand from './Brand'
import SidebarNav from './SidebarNav'

/** Slide-in menu for phones and tablets, built on <dialog> for focus trapping and Escape. */
export default function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label="Menu"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="bg-reservoir text-mist m-0 h-dvh max-h-none w-72 max-w-[85vw] [animation:drawer-in_180ms_ease-out] p-0 lg:hidden"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-5 py-4">
            <Brand inverse />
            <button
              type="button"
              onClick={onClose}
              className="text-mist/80 rounded-md p-1.5 hover:bg-white/10 hover:text-white"
              aria-label="Close menu"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <SidebarNav onNavigate={onClose} />
        </div>
      )}
    </dialog>
  )
}
