import { Ticket, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import Card from '../../components/Card'
import PageHeader from '../../components/PageHeader'
import { useAuth } from '../../hooks/useAuth'
import { formatDate } from '../../utils/format'

/** Customer home. Phase 17 adds balance, bills, usage, tickets and outages. */
export default function CustomerDashboardPage() {
  const { user, profile, profileLoading } = useAuth()
  const fallback = profileLoading ? '…' : 'Not available'

  return (
    <>
      <PageHeader
        title={`Welcome, ${profile?.displayName || user?.displayName || user?.email}`}
        description="Your account summary, bills and usage will appear here."
      />
      <section aria-label="Quick actions" className="mb-6 grid max-w-2xl gap-3 sm:grid-cols-2">
        <Link
          to="/customer/report"
          className="bg-reservoir hover:bg-reservoir-deep flex items-center gap-3 rounded-lg px-5 py-4 font-semibold text-white shadow-xs"
        >
          <TriangleAlert className="size-5" aria-hidden="true" />
          <span>
            Report a problem
            <span className="text-mist/85 block text-sm font-normal">
              Leak, burst pipe or no water
            </span>
          </span>
        </Link>
        <Link
          to="/customer/tickets"
          className="border-mist hover:border-channel flex items-center gap-3 rounded-lg border bg-white px-5 py-4 font-semibold shadow-xs"
        >
          <Ticket className="text-reservoir size-5" aria-hidden="true" />
          <span>
            My tickets
            <span className="text-ink/60 block text-sm font-normal">Follow your reports</span>
          </span>
        </Link>
      </section>
      <Card title="Your details" className="max-w-2xl" padded={false}>
        <dl className="divide-mist divide-y">
          <Row label="Email" value={user?.email} />
          <Row label="Mobile" value={profile ? profile.phone || 'Not provided' : fallback} />
          <Row
            label="Member since"
            value={profile?.createdAt ? formatDate(profile.createdAt) : fallback}
          />
        </dl>
      </Card>
    </>
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
