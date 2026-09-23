import type { ReactNode } from 'react'
import ConnectionStatus from '../components/ConnectionStatus'
import GaugeMotif from '../components/GaugeMotif'
import { isDev } from '../utils/env'

/** Brand panel + form column, shared by the sign-in and registration pages. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
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

      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          {children}
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
