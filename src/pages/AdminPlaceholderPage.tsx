import { Link } from 'react-router-dom'

/** Temporary admin-only page used to test role blocking. Replaced in Phase 2. */
export default function AdminPlaceholderPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Administration</h1>
      <p className="text-ink/70 mt-2">Only administrators can see this page.</p>
      <Link to="/app" className="text-channel mt-6 inline-block font-semibold hover:underline">
        Back to dashboard
      </Link>
    </main>
  )
}
