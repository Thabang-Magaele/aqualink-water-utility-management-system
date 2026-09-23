import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-reservoir text-6xl font-extrabold">404</p>
      <h1 className="mt-4 text-2xl font-bold">This page doesn't exist</h1>
      <p className="text-ink/70 mt-2">Check the address, or go back to AquaLink.</p>
      <Link
        to="/app"
        className="bg-reservoir hover:bg-reservoir-deep mt-6 rounded-md px-4 py-2.5 font-semibold text-white"
      >
        Go to AquaLink
      </Link>
    </main>
  )
}
