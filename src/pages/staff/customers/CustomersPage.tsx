import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '../../../components/Alert'
import BalanceText from '../../../components/BalanceText'
import Card from '../../../components/Card'
import DataTable, { type Column } from '../../../components/DataTable'
import { controlClass } from '../../../components/formStyles'
import PageHeader from '../../../components/PageHeader'
import SearchBar from '../../../components/SearchBar'
import { useAsync } from '../../../hooks/useAsync'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { loadCustomerDirectory } from '../../../services/customerService'
import { AREAS, type Area } from '../../../types/models'
import { matchesCustomer, type CustomerSummary } from '../../../utils/customerSearch'
import { friendlyError } from '../../../utils/errors'
import { formatPhone } from '../../../utils/format'

const columns: Column<CustomerSummary>[] = [
  {
    key: 'name',
    header: 'Customer',
    sortValue: (c) => c.name,
    render: (c) => (
      <span>
        <span className="block font-semibold">{c.name}</span>
        {c.email && <span className="text-ink/60 block text-sm">{c.email}</span>}
      </span>
    ),
  },
  { key: 'phone', header: 'Phone', render: (c) => (c.phone ? formatPhone(c.phone) : '—') },
  { key: 'area', header: 'Area', sortValue: (c) => c.area, render: (c) => c.area },
  {
    key: 'accounts',
    header: 'Accounts',
    hideOnMobile: true,
    sortValue: (c) => c.accountNumbers.length,
    render: (c) =>
      c.accountNumbers.length ? (
        <span className="font-mono text-sm">{c.accountNumbers.join(', ')}</span>
      ) : (
        <span className="text-ink/50">None</span>
      ),
  },
  {
    key: 'balance',
    header: 'Balance',
    align: 'right',
    sortValue: (c) => c.balance,
    render: (c) => <BalanceText amount={c.balance} />,
  },
]

/** Staff directory of customers: search, filter by area and balance, open a customer. */
export default function CustomersPage() {
  const navigate = useNavigate()
  const directory = useAsync(loadCustomerDirectory, 'customer-directory')
  const [search, setSearch] = useState('')
  const [area, setArea] = useState<Area | 'all'>('all')
  const [owingOnly, setOwingOnly] = useState(false)
  const term = useDebouncedValue(search, 200)

  const all = directory.data?.customers
  const filtered = useMemo(
    () =>
      (all ?? []).filter(
        (c) =>
          matchesCustomer(c, term) &&
          (area === 'all' || c.area === area) &&
          (!owingOnly || c.balance > 0),
      ),
    [all, term, area, owingOnly],
  )
  const filtering = Boolean(term.trim()) || area !== 'all' || owingOnly

  return (
    <>
      <PageHeader
        title="Customers"
        description="Find a customer by name, account number, phone, email or address."
      />

      {directory.data?.truncated && (
        <div className="mb-4">
          <Alert tone="warning">
            Showing the first 500 records. Narrow your search, or ask an administrator about
            enabling full search.
          </Alert>
        </div>
      )}

      <Card padded={false}>
        <div className="border-mist flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by name, account number, phone or email"
            className="flex-1"
          />
          <label className="sr-only" htmlFor="customer-area">
            Filter by area
          </label>
          <select
            id="customer-area"
            value={area}
            onChange={(e) => setArea(e.target.value as Area | 'all')}
            className={`${controlClass(false)} lg:w-48`}
          >
            <option value="all">All areas</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <label className="flex shrink-0 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={owingOnly}
              onChange={(e) => setOwingOnly(e.target.checked)}
              className="border-ink/30 accent-reservoir size-4 rounded"
            />
            Owes money
          </label>
        </div>

        {all && (
          <p className="border-mist text-ink/60 border-b px-4 py-2 text-sm" aria-live="polite">
            {filtering
              ? `${filtered.length} of ${all.length} customers`
              : `${all.length} customers`}
          </p>
        )}

        <DataTable
          caption="Customers"
          columns={columns}
          rows={filtered}
          getRowId={(c) => c.id}
          loading={directory.loading}
          error={directory.error ? friendlyError(directory.error) : null}
          onRetry={directory.reload}
          onRowClick={(c) => navigate(`/staff/customers/${c.id}`)}
          initialSort={{ key: 'name', direction: 'asc' }}
          pageSize={15}
          emptyTitle={filtering ? 'No matching customers' : 'No customers yet'}
          emptyDescription={
            filtering
              ? 'Try a different name or number, or clear the filters.'
              : 'Customers appear here once they are added.'
          }
        />
      </Card>
    </>
  )
}
