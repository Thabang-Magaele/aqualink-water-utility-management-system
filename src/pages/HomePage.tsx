import { LogOut } from 'lucide-react'
import { useState } from 'react'
import Alert from '../components/Alert'
import Button from '../components/Button'
import { useAuth } from '../hooks/useAuth'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  call_centre: 'Call centre',
  technician: 'Technician',
  billing: 'Billing',
  asset_manager: 'Asset manager',
  water_quality: 'Water quality',
  communications: 'Communications',
  customer: 'Customer',
}

/**
 * Temporary signed-in landing page for Phase 1.
 * Phase 2 routes each role to its own area; Phase 3 adds the app shell.
 */
export default function HomePage() {
  const { user, role, profile, profileLoading, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
  }

  const name = profile?.displayName || user?.displayName || user?.email
  const fallback = profileLoading ? '…' : 'Not available'

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-reservoir text-lg font-bold">AquaLink</p>
        <Button
          variant="secondary"
          onClick={handleSignOut}
          loading={signingOut}
          icon={<LogOut className="size-4" aria-hidden="true" />}
        >
          Sign out
        </Button>
      </div>

      <h1 className="mt-10 text-3xl font-bold tracking-tight">Welcome, {name}</h1>
      <p className="text-ink/70 mt-2">
        You are signed in. Your dashboard is built in the next phases.
      </p>

      <dl className="divide-mist border-mist mt-8 divide-y rounded-lg border bg-white">
        <Row label="Email" value={user?.email} />
        <Row label="Mobile" value={profile ? profile.phone || 'Not provided' : fallback} />
        <Row label="Role" value={role ? ROLE_LABELS[role] : undefined} />
        <Row
          label="Member since"
          value={
            profile?.createdAt?.toDate().toLocaleDateString('en-ZA', { dateStyle: 'long' }) ??
            fallback
          }
        />
      </dl>

      {!profileLoading && !profile && (
        <div className="mt-6">
          <Alert tone="info">
            This account has no AquaLink profile yet. An administrator will finish setting it up.
          </Alert>
        </div>
      )}
    </main>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:gap-6">
      <dt className="text-ink/60 w-36 shrink-0 text-sm font-semibold">{label}</dt>
      <dd className="text-ink">{value ?? '…'}</dd>
    </div>
  )
}
