import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Brand from './Brand'
import MobileNav from './MobileNav'
import SidebarNav from './SidebarNav'
import Topbar from './Topbar'

/**
 * Shell for every signed-in page: fixed sidebar on large screens,
 * slide-in menu on phones and tablets, sticky top bar, content area.
 */
export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-dvh lg:pl-64 print:pl-0">
      <a
        href="#main"
        className="bg-reservoir sr-only z-50 rounded-md px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <aside className="bg-reservoir text-mist fixed inset-y-0 left-0 hidden w-64 flex-col lg:flex print:hidden">
        <div className="flex h-16 items-center px-6">
          <Brand inverse />
        </div>
        <SidebarNav />
        <p className="text-mist/55 border-t border-white/10 px-6 py-4 text-xs">Silulumanzi</p>
      </aside>

      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
      <Topbar onOpenMenu={() => setMenuOpen(true)} />

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-7xl px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0"
      >
        <Outlet />
      </main>
    </div>
  )
}
