import { ChartColumn, Droplets, TrendingDown, TrendingUp } from 'lucide-react'
import Card from '../../components/Card'
import ConsumptionChart from '../../components/ConsumptionChart'
import DataTable, { type Column } from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import ErrorState from '../../components/ErrorState'
import LoadingSkeleton from '../../components/LoadingSkeleton'
import PageHeader from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { loadCustomerUsage } from '../../services/meterService'
import type { Account, Meter, Reading } from '../../types/models'
import {
  averageMonthlyUse,
  consumptionSeries,
  DAYS_PER_MONTH,
  type ConsumptionPeriod,
} from '../../utils/consumption'
import { friendlyError } from '../../utils/errors'
import { formatDate, formatKl, formatMonth, formatNumber } from '../../utils/format'

/** The customer's water use, per property meter. */
export default function UsagePage() {
  const { user } = useAuth()
  const uid = user?.uid ?? ''
  const usage = useAsync(uid ? () => loadCustomerUsage(uid) : null, `usage:${uid}`)

  return (
    <>
      <PageHeader
        title="Your water usage"
        description="How much water each of your properties uses, from your meter readings."
      />
      {usage.loading && (
        <Card>
          <LoadingSkeleton lines={5} label="Loading your usage…" />
        </Card>
      )}
      {usage.error && (
        <Card>
          <ErrorState message={friendlyError(usage.error)} onRetry={usage.reload} />
        </Card>
      )}
      {usage.data && usage.data.meters.length === 0 && (
        <Card>
          <EmptyState
            icon={ChartColumn}
            title="No meter linked yet"
            description="Your usage appears here once a meter is installed on your account."
          />
        </Card>
      )}
      {usage.data && (
        <div className="space-y-8">
          {[...usage.data.meters]
            .sort((a, b) => a.meterNumber.localeCompare(b.meterNumber))
            .map((meter) => (
              <MeterUsage
                key={meter.id}
                meter={meter}
                account={usage.data!.accounts.find((a) => a.id === meter.accountId)}
                readings={usage.data!.readings.filter((r) => r.meterId === meter.id)}
              />
            ))}
        </div>
      )}
    </>
  )
}

function MeterUsage({
  meter,
  account,
  readings,
}: {
  meter: Meter
  account?: Account
  readings: Reading[]
}) {
  const series = consumptionSeries(
    readings.map((r) => ({ id: r.id, value: r.readingValue, date: r.readingDate.toDate() })),
  )
  const periods = series.filter((p) => p.consumption !== null && p.days)
  const last = periods[periods.length - 1]
  const average = averageMonthlyUse(series)
  // Compare like with like: the last period scaled to a month vs the average month
  const lastMonthly = last ? (last.consumption! / last.days!) * DAYS_PER_MONTH : null
  const change =
    lastMonthly !== null && average ? Math.round(((lastMonthly - average) / average) * 100) : null

  const columns: Column<ConsumptionPeriod>[] = [
    { key: 'period', header: 'Period to', render: (p) => formatMonth(p.date) },
    { key: 'used', header: 'Water used', align: 'right', render: (p) => formatKl(p.consumption!) },
    {
      key: 'perDay',
      header: 'Per day',
      align: 'right',
      render: (p) => (p.litresPerDay === null ? '—' : `${formatNumber(p.litresPerDay)} litres`),
    },
    {
      key: 'reading',
      header: 'Meter read',
      align: 'right',
      hideOnMobile: true,
      render: (p) => formatKl(p.reading),
    },
  ]

  return (
    <section aria-labelledby={`meter-${meter.id}`}>
      <h2 id={`meter-${meter.id}`} className="text-lg font-bold">
        {account?.propertyAddress ?? 'Property'}
      </h2>
      <p className="text-ink/60 mb-4 text-sm">
        Account <span className="font-mono">{account?.accountNumber ?? '—'}</span> · meter{' '}
        <span className="font-mono">{meter.meterNumber}</span>
        {meter.lastReadingDate && ` · last read ${formatDate(meter.lastReadingDate)}`}
      </p>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Last period"
          value={last ? formatKl(last.consumption!) : '—'}
          icon={Droplets}
          hint={
            last ? `${last.days} days to ${formatDate(last.date)}` : 'After your second reading'
          }
        />
        <StatCard
          label="Your average"
          value={average === null ? '—' : `${formatKl(average)}/month`}
          icon={ChartColumn}
        />
        <StatCard
          label="Compared with average"
          value={change === null ? '—' : `${change > 0 ? '+' : ''}${change}%`}
          icon={change !== null && change > 0 ? TrendingUp : TrendingDown}
          tone={change === null ? 'neutral' : change > 15 ? 'warning' : 'success'}
          hint={
            change === null
              ? 'Needs more readings'
              : change > 15
                ? 'Higher than usual: check for leaks'
                : 'About your usual use'
          }
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Water used per period (kL)" className="lg:col-span-3">
          <ConsumptionChart
            series={series}
            label={`Water used per reading period at ${account?.propertyAddress ?? 'your property'}`}
          />
        </Card>
        <Card title="History" padded={false} className="lg:col-span-2">
          <DataTable
            caption={`Usage history, meter ${meter.meterNumber}`}
            columns={columns}
            rows={[...periods].reverse()}
            getRowId={(p) => p.id}
            pageSize={6}
            emptyTitle="No usage yet"
            emptyDescription="Your first figure appears after your second reading."
          />
        </Card>
      </div>
    </section>
  )
}
