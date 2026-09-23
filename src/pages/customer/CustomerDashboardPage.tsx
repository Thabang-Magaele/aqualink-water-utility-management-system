import { useAuth } from '../../hooks/useAuth'

/** Phase 2 customer home. Phase 17 adds balance, bills, usage and tickets. */
export default function CustomerDashboardPage() {
  const { user, profile, profileLoading } = useAuth()
  const fallback = profileLoading ? '…' : 'Not available'

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">
        Welcome, {profile?.displayName || user?.displayName || user?.email}
      </h1>
      <p className="text-ink/70 mt-2">Your account summary, bills and usage will appear here.</p>

      <dl className="divide-mist border-mist mt-8 divide-y rounded-lg border bg-white">
        <Row label="Email" value={user?.email} />
        <Row label="Mobile" value={profile ? profile.phone || 'Not provided' : fallback} />
        <Row
          label="Member since"
          value={
            profile?.createdAt?.toDate().toLocaleDateString('en-ZA', { dateStyle: 'long' }) ??
            fallback
          }
        />
      </dl>
    </section>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:gap-6">
      <dt className="text-ink/60 w-36 shrink-0 text-sm font-semibold">{label}</dt>
      <dd>{value ?? '…'}</dd>
    </div>
  )
}
