import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import DataTable, { type Column } from '../../../components/DataTable'
import { controlClass } from '../../../components/formStyles'
import PageHeader from '../../../components/PageHeader'
import SearchBar from '../../../components/SearchBar'
import StatusBadge from '../../../components/StatusBadge'
import { useAsync } from '../../../hooks/useAsync'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { loadMeterList, type MeterRow } from '../../../services/meterService'
import { METER_STATUSES, type MeterStatus } from '../../../types/models'
import { isDueForReading, READING_OVERDUE_DAYS } from '../../../utils/consumption'
import { normalise } from '../../../utils/customerSearch'
import { friendlyError } from '../../../utils/errors'
import { formatDate, formatKl } from '../../../utils/format'
import AddMeterModal from './AddMeterModal'

const columns: Column<MeterRow>[] = [
  {
    key: 'meter',
    header: 'Meter',
    sortValue: (r) => r.meter.meterNumber,
    render: (r) => <span className="font-mono font-semibold">{r.meter.meterNumber}</span>,
  },
  {
    key: 'account',
    header: 'Account',
    sortValue: (r) => r.customerName,
    render: (r) => (
      <span>
        <span className="block">{r.customerName}</span>
        <span className="text-ink/60 block font-mono text-sm">{r.accountNumber}</span>
      </span>
    ),
  },
  { key: 'property', header: 'Property', hideOnMobile: true, render: (r) => r.propertyAddress },
  {
    key: 'status',
    header: 'Status',
    sortValue: (r) => r.meter.status,
    render: (r) => <StatusBadge status={r.meter.status} />,
  },
  {
    key: 'last',
    header: 'Last reading',
    align: 'right',
    sortValue: (r) => r.meter.lastReadingDate?.toDate() ?? null,
    render: (r) => (
      <span>
        <span className="block tabular-nums">{formatKl(r.meter.lastReading)}</span>
        <span className="text-ink/60 block text-sm">
          {r.meter.lastReadingDate ? formatDate(r.meter.lastReadingDate) : 'Never read'}
          {isDueForReading(r.meter) && (
            <span className="ml-2">
              <StatusBadge status="DUE" label="Due" tone="warning" />
            </span>
          )}
        </span>
      </span>
    ),
  },
]

/** Billing / admin: all meters, when each was last read, and which are due. */
export default function MetersPage() {
  const navigate = useNavigate()
  const list = useAsync(loadMeterList, 'meter-list')
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<MeterStatus | 'all'>('all')
  const [dueOnly, setDueOnly] = useState(false)
  const term = normalise(useDebouncedValue(search, 200))

  const all = list.data?.meters
  const filtered = useMemo(
    () =>
      (all ?? []).filter(
        (r) =>
          (!term ||
            normalise(r.meter.meterNumber).includes(term) ||
            r.accountNumber.includes(term) ||
            normalise(r.customerName).includes(term) ||
            normalise(r.propertyAddress).includes(term)) &&
          (status === 'all' || r.meter.status === status) &&
          (!dueOnly || isDueForReading(r.meter)),
      ),
    [all, term, status, dueOnly],
  )
  const dueCount = (all ?? []).filter((r) => isDueForReading(r.meter)).length
  const filtering = Boolean(term) || status !== 'all' || dueOnly

  return (
    <>
      <PageHeader
        title="Meters"
        description="Record readings and follow each meter’s consumption."
        actions={
          <Button
            onClick={() => setAdding(true)}
            icon={<Plus className="size-4" aria-hidden="true" />}
            disabled={!list.data}
          >
            Add meter
          </Button>
        }
      />
      <Card padded={false}>
        <div className="border-mist flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by meter, account, customer or address"
            className="flex-1"
          />
          <label className="sr-only" htmlFor="meter-status">
            Filter by status
          </label>
          <select
            id="meter-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as MeterStatus | 'all')}
            className={`${controlClass(false)} lg:w-44`}
          >
            <option value="all">All statuses</option>
            {METER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0] + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <label className="flex shrink-0 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={dueOnly}
              onChange={(e) => setDueOnly(e.target.checked)}
              className="border-ink/30 accent-reservoir size-4 rounded"
            />
            Due for reading{all ? ` (${dueCount})` : ''}
          </label>
        </div>
        {all && (
          <p className="border-mist text-ink/60 border-b px-4 py-2 text-sm" aria-live="polite">
            {filtering ? `${filtered.length} of ${all.length} meters` : `${all.length} meters`} ·
            “Due” means not read for over {READING_OVERDUE_DAYS} days
          </p>
        )}
        <DataTable
          caption="Meters"
          columns={columns}
          rows={filtered}
          getRowId={(r) => r.meter.id}
          loading={list.loading}
          error={list.error ? friendlyError(list.error) : null}
          onRetry={list.reload}
          onRowClick={(r) => navigate(`/staff/meters/${r.meter.id}`)}
          initialSort={{ key: 'last', direction: 'asc' }}
          pageSize={15}
          emptyTitle={filtering ? 'No matching meters' : 'No meters yet'}
          emptyDescription={
            filtering
              ? 'Try a different search or clear the filters.'
              : 'Use “Add meter” to install one on an account.'
          }
        />
      </Card>

      {list.data && (
        <AddMeterModal
          open={adding}
          onClose={() => setAdding(false)}
          accounts={list.data.accountsWithoutMeter}
          existingNumbers={list.data.meters.map((r) => r.meter.meterNumber)}
          onAdded={(meterId) => navigate(`/staff/meters/${meterId}`)}
        />
      )}
    </>
  )
}
