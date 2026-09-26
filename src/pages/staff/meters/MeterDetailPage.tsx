import { ArrowLeft, Droplets, Gauge, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import ConsumptionChart from '../../../components/ConsumptionChart'
import DataTable, { type Column } from '../../../components/DataTable'
import EmptyState from '../../../components/EmptyState'
import ErrorState from '../../../components/ErrorState'
import { controlClass } from '../../../components/formStyles'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import PageHeader from '../../../components/PageHeader'
import StatCard from '../../../components/StatCard'
import StatusBadge from '../../../components/StatusBadge'
import { useAsync } from '../../../hooks/useAsync'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../hooks/useToast'
import { canOpen } from '../../../routes/navigation'
import { loadMeter, setMeterStatus } from '../../../services/meterService'
import { METER_STATUSES, type MeterStatus } from '../../../types/models'
import {
  averageMonthlyUse,
  consumptionSeries,
  type ConsumptionPeriod,
} from '../../../utils/consumption'
import { friendlyError } from '../../../utils/errors'
import { formatDate, formatKl, formatNumber } from '../../../utils/format'
import GenerateInvoiceCard from './GenerateInvoiceCard'
import RecordReadingCard from './RecordReadingCard'

const CRUMBS = [
  { label: 'Staff console', to: '/staff' },
  { label: 'Meters', to: '/staff/meters' },
]

/** One meter: record readings, see consumption per period, change status. */
export default function MeterDetailPage() {
  const { meterId = '' } = useParams()
  const { user, role } = useAuth()
  const { toast } = useToast()
  const detail = useAsync(() => loadMeter(meterId), `meter:${meterId}`)
  const [status, setStatus] = useState<MeterStatus | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)

  const series = useMemo(
    () =>
      consumptionSeries(
        (detail.data?.readings ?? []).map((r) => ({
          id: r.id,
          value: r.readingValue,
          date: r.readingDate.toDate(),
        })),
      ),
    [detail.data],
  )
  const recordedBy = useMemo(
    () => new Map((detail.data?.readings ?? []).map((r) => [r.id, r.recordedBy])),
    [detail.data],
  )

  if (detail.loading) {
    return (
      <>
        <PageHeader title="Meter" breadcrumbs={[...CRUMBS, { label: 'Loading…' }]} />
        <Card>
          <LoadingSkeleton lines={5} label="Loading meter…" />
        </Card>
      </>
    )
  }
  if (detail.error || !detail.data) {
    return (
      <>
        <PageHeader
          title={detail.error ? 'Meter' : 'Meter not found'}
          breadcrumbs={[...CRUMBS, { label: detail.error ? 'Error' : 'Not found' }]}
        />
        <Card>
          {detail.error ? (
            <ErrorState message={friendlyError(detail.error)} onRetry={detail.reload} />
          ) : (
            <EmptyState
              title="This meter doesn't exist"
              action={
                <Link
                  to="/staff/meters"
                  className="text-channel inline-flex items-center gap-1 font-semibold hover:underline"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" /> Back to meters
                </Link>
              }
            />
          )}
        </Card>
      </>
    )
  }

  const { meter, account } = detail.data
  const periods = series.filter((p) => p.consumption !== null)
  const lastPeriod = periods[periods.length - 1]
  const average = averageMonthlyUse(series)
  const selectedStatus = status ?? meter.status

  async function saveStatus() {
    setSavingStatus(true)
    try {
      await setMeterStatus(meter.id, selectedStatus)
      toast({
        title: 'Status updated',
        message: `${meter.meterNumber} is now ${selectedStatus.toLowerCase()}.`,
      })
      setStatus(null)
      detail.reload()
    } catch (error) {
      toast({ tone: 'error', title: 'Status not changed', message: friendlyError(error) })
    } finally {
      setSavingStatus(false)
    }
  }

  const columns: Column<ConsumptionPeriod>[] = [
    { key: 'date', header: 'Date read', render: (p) => formatDate(p.date) },
    { key: 'reading', header: 'Reading', align: 'right', render: (p) => formatKl(p.reading) },
    {
      key: 'used',
      header: 'Used',
      align: 'right',
      render: (p) =>
        p.consumption === null ? (
          <span className="text-ink/50">Baseline</span>
        ) : (
          formatKl(p.consumption)
        ),
    },
    {
      key: 'days',
      header: 'Days',
      align: 'right',
      hideOnMobile: true,
      render: (p) => p.days ?? '—',
    },
    {
      key: 'perDay',
      header: 'Per day',
      align: 'right',
      hideOnMobile: true,
      render: (p) => (p.litresPerDay === null ? '—' : `${formatNumber(p.litresPerDay)} L`),
    },
    {
      key: 'by',
      header: 'Recorded by',
      hideOnMobile: true,
      render: (p) => (recordedBy.get(p.id) === user?.uid ? 'You' : 'Staff'),
    },
  ]

  return (
    <>
      <PageHeader
        title={meter.meterNumber}
        breadcrumbs={[...CRUMBS, { label: meter.meterNumber }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={meter.status} />
            {account ? (
              <span>
                Account{' '}
                {canOpen(role, `/staff/customers/${account.customerId}`) ? (
                  <Link
                    className="text-channel font-mono font-semibold hover:underline"
                    to={`/staff/customers/${account.customerId}?account=${account.id}`}
                  >
                    {account.accountNumber}
                  </Link>
                ) : (
                  <span className="font-mono">{account.accountNumber}</span>
                )}{' '}
                · {account.propertyAddress}
              </span>
            ) : (
              <span>Account not found</span>
            )}
          </span>
        }
      />

      <section aria-label="Summary" className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Last reading"
          value={formatKl(meter.lastReading)}
          icon={Gauge}
          hint={meter.lastReadingDate ? formatDate(meter.lastReadingDate) : 'Never read'}
        />
        <StatCard
          label="Last period"
          value={lastPeriod ? formatKl(lastPeriod.consumption!) : '—'}
          icon={Droplets}
          hint={
            lastPeriod
              ? `${lastPeriod.days} days to ${formatDate(lastPeriod.date)}`
              : 'Needs two readings'
          }
        />
        <StatCard
          label="Average use"
          value={average === null ? '—' : `${formatKl(average)}/month`}
          icon={TrendingUp}
          hint={`Over ${periods.length} period${periods.length === 1 ? '' : 's'}`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Consumption (kL)" description="Water used between readings">
            <ConsumptionChart
              series={series}
              label={`Water used per reading period for meter ${meter.meterNumber}`}
            />
          </Card>
          <Card title="Readings" description="Newest first" padded={false}>
            <DataTable
              caption="Readings"
              columns={columns}
              rows={[...series].reverse()}
              getRowId={(p) => p.id}
              pageSize={8}
              emptyTitle="No readings yet"
            />
          </Card>
        </div>
        <div className="space-y-6">
          <RecordReadingCard meter={meter} series={series} onSaved={detail.reload} />
          {account && (
            <GenerateInvoiceCard
              key={`${account.id}:${meter.lastReading}`}
              accountId={account.id}
            />
          )}
          <Card title="Meter status">
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="meter-status-select">
                Meter status
              </label>
              <select
                id="meter-status-select"
                value={selectedStatus}
                onChange={(e) => setStatus(e.target.value as MeterStatus)}
                className={controlClass(false)}
              >
                {METER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s[0] + s.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                onClick={saveStatus}
                loading={savingStatus}
                disabled={selectedStatus === meter.status}
              >
                Save
              </Button>
            </div>
            <p className="text-ink/60 mt-2 text-sm">
              Installed {formatDate(meter.installationDate)}.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}
