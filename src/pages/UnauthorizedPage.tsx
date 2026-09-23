import { ShieldX } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <ShieldX className="text-fault size-12" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-bold">You don't have access to this page</h1>
      <p className="text-ink/70 mt-2 max-w-md">
        Your account role doesn't include this area. If you need access, ask an AquaLink
        administrator.
      </p>
      <Link
        to="/app"
        className="bg-reservoir hover:bg-reservoir-deep mt-6 rounded-md px-4 py-2.5 font-semibold text-white"
      >
        Go to my dashboard
      </Link>
    </main>
  )
}
