import { ChevronDown, LayoutGrid, LogOut } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useDismiss } from '../hooks/useDismiss'
import { ROLE_LABELS } from '../types/user'
import { isDev } from '../utils/env'
import { initials } from '../utils/format'

export default function UserMenu() {
  const { user, profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  const name = profile?.displayName || user?.displayName || user?.email || ''

  async function handleSignOut() {
    close()
    await signOut()
    // Clean login page: don't carry this user's last page to the next person.
    navigate('/login', { replace: true, state: null })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="hover:bg-mist flex items-center gap-2 rounded-md py-1 pr-1.5 pl-1"
      >
        <span
          className="bg-reservoir flex size-8 items-center justify-center rounded-full text-xs font-bold text-white"
          aria-hidden="true"
        >
          {initials(name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-40 truncate text-sm leading-tight font-semibold">
            {name}
          </span>
          <span className="text-ink/60 block text-xs leading-tight">
            {role ? ROLE_LABELS[role] : ''}
          </span>
        </span>
        <ChevronDown className="text-ink/50 size-4" aria-hidden="true" />
        <span className="sr-only">Account menu</span>
      </button>

      {open && (
        <div className="border-mist absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-lg border bg-white py-1 shadow-lg">
          <div className="border-mist border-b px-4 py-3">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-ink/60 truncate text-xs">{user?.email}</p>
          </div>
          {isDev && (
            <Link
              to="/ui-kit"
              onClick={close}
              className="hover:bg-paper flex items-center gap-2.5 px-4 py-2.5 text-sm"
            >
              <LayoutGrid className="text-ink/60 size-4" aria-hidden="true" />
              UI kit (dev only)
            </Link>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="hover:bg-paper flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm"
          >
            <LogOut className="text-ink/60 size-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
