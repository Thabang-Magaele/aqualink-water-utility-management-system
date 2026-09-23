import { LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import ConnectionStatus from '../components/ConnectionStatus'
import GaugeMotif from '../components/GaugeMotif'
import { isDev } from '../utils/env'

/**
 * Landing / sign-in screen.
 * Phase 0: layout only. Phase 1 connects the form to Firebase Authentication.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice('Sign-in is connected to Firebase Authentication in Phase 1.')
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Brand panel */}
      <section className="bg-reservoir text-mist relative overflow-hidden lg:w-[46%]">
        <GaugeMotif className="pointer-events-none absolute right-0 bottom-0 hidden h-[55%] w-full sm:block" />
        <div className="relative px-6 pt-8 pb-10 sm:px-10 sm:pb-40 lg:px-14 lg:pt-14">
          <p className="text-lg font-bold tracking-tight">Silulumanzi</p>
          <div className="mt-10 max-w-sm lg:mt-24">
            <h1 className="text-5xl leading-[1.02] font-extrabold tracking-tight sm:text-6xl">
              AquaLink
            </h1>
            <p className="text-mist/85 mt-4 text-base leading-relaxed sm:text-lg">
              Pay your water account, report a leak and follow the repair until it is fixed.
            </p>
          </div>
        </div>
      </section>

      {/* Sign-in panel */}
      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
          <p className="text-ink/70 mt-2 text-sm">
            Customers and Silulumanzi staff use the same sign-in. You will see the tools for your
            role.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-ink/20 focus:border-channel focus:ring-channel/25 mt-1.5 block w-full rounded-md border bg-white px-3 py-2.5 text-base shadow-xs focus:ring-2 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-ink/20 focus:border-channel focus:ring-channel/25 mt-1.5 block w-full rounded-md border bg-white px-3 py-2.5 text-base shadow-xs focus:ring-2 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="bg-reservoir hover:bg-reservoir-deep flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 font-semibold text-white transition-colors"
            >
              <LogIn className="size-4" aria-hidden="true" />
              Sign in
            </button>

            {notice && (
              <p
                className="border-signal/30 bg-signal/10 rounded-md border px-3 py-2 text-sm"
                role="status"
              >
                {notice}
              </p>
            )}
          </form>

          <p className="text-ink/70 mt-6 text-sm">
            New customer? Account registration opens in the next release.
          </p>

          {isDev && (
            <div className="border-mist mt-10 border-t pt-4">
              <ConnectionStatus />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
