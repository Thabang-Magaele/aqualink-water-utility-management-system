import { useEffect, type RefObject } from 'react'

/** Calls onDismiss on Escape or a click outside `ref` while `active` is true. Used by menus and popovers. */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!active) return
    function onPointer(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss()
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, active, onDismiss])
}
