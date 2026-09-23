import { ChevronRight, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActivityFeed from '../../components/ActivityFeed'
import Button from '../../components/Button'
import Card from '../../components/Card'
import PageHeader from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import { useAuth } from '../../hooks/useAuth'
import { useStaffDashboard } from '../../hooks/useStaffDashboard'
import { metricsFor } from '../../services/dashboardQueries'
import { canOpen, navFor } from '../../routes/navigation'
import { ROLE_LABELS } from '../../types/user'
import { METRIC_DISPLAY } from './dashboard/metricDisplay'

function greeting(date: Date): string {
  const hour = date.getHours()
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

/**
 * One dashboard for every staff role. The figures and activity shown depend on
 * the role (see METRICS in services/dashboardQueries.ts); nothing is duplicated per role.
 */
export default function StaffDashboardPage() {
  const { role, user, profile } = useAuth()
  const { metrics, activity, refreshing, updatedAt, refresh } = useStaffDashboard(role, user?.uid)

  const firstName = (profile?.displayName || user?.displayName || '').split(' ')[0]
  const cards = metricsFor(role)
  const shortcuts = navFor(role).filter((item) => item.path !== '/staff')

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          <>
            {greeting(new Date())}
            {firstName && `, ${firstName}`}. Signed in as{' '}
            <strong>{role ? ROLE_LABELS[role] : ''}</strong>.
          </>
        }
        actions={
          <div className="flex items-center gap-3">
            {updatedAt && (
              <span className="text-ink/55 text-sm">
                Updated{' '}
                {updatedAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={refresh}
              loading={refreshing}
              icon={<RefreshCw className="size-4" aria-hidden="true" />}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <section aria-label="Key figures">
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((def) => {
            const display = METRIC_DISPLAY[def.id]
            const state = metrics[def.id]
            const ready = state?.status === 'ready' ? state.result : null
            return (
              <li key={def.id}>
                <StatCard
                  label={display.label}
                  icon={display.icon}
                  loading={!state || state.status === 'loading'}
                  value={ready ? display.value(ready) : '—'}
                  hint={
                    state?.status === 'error'
                      ? state.message
                      : ready && display.hint
                        ? display.hint(ready)
                        : undefined
                  }
                  tone={
                    ready ? display.tone(ready) : state?.status === 'error' ? 'neutral' : 'info'
                  }
                  to={display.to && canOpen(role, display.to) ? display.to : undefined}
                />
              </li>
            )
          })}
        </ul>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card title="Recent activity" padded={false} className="lg:col-span-2">
          <ActivityFeed
            items={activity.status === 'ready' ? activity.items : null}
            loading={activity.status === 'loading'}
            error={activity.status === 'error' ? activity.message : null}
            onRetry={refresh}
          />
        </Card>

        <Card title="Your areas" padded={false}>
          <ul className="divide-mist divide-y">
            {shortcuts.map(({ path, label, icon: Icon }) => (
              <li key={path}>
                <Link
                  to={path}
                  className="group hover:bg-paper flex items-center gap-3 px-5 py-3 font-medium"
                >
                  <Icon className="text-reservoir size-4.5" aria-hidden="true" />
                  {label}
                  <ChevronRight
                    className="text-ink/30 ml-auto size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
