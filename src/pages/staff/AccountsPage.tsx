import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BalanceText from '../../components/BalanceText'
import Card from '../../components/Card'
import DataTable, { type Column } from '../../components/DataTable'
import { controlClass } from '../../components/formStyles'
import PageHeader from '../../components/PageHeader'
import SearchBar from '../../components/SearchBar'
import StatusBadge from '../../components/StatusBadge'
import { useAsync } from '../../hooks/useAsync'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { loadCustomerDirectory } from '../../services/customerService'
import { ACCOUNT_STATUSES, AREAS, type AccountStatus, type Area } from '../../types/models'
import { matchesAccount, type AccountRow } from '../../utils/customerSearch'
import { friendlyError } from '../../utils/errors'

const columns: Column<AccountRow>[] = [
  {
    key: 'number',
    header: 'Account',
    sortValue: (r) => r.account.accountNumber,
    render: (r) => <span className="font-mono font-semibold">{r.account.accountNumber}</span>,
  },
  {
    key: 'customer',
    header: 'Customer',
    sortValue: (r) => r.customerName,
    render: (r) => r.customerName,
  },
  {
    key: 'property',
    header: 'Property',
    hideOnMobile: true,
    render: (r) => r.account.propertyAddress,
  },
  { key: 'area', header: 'Area', sortValue: (r) => r.account.area, render: (r) => r.account.area },
  {
    key: 'status',
    header: 'Status',
    sortValue: (r) => r.account.status,
    render: (r) => <StatusBadge status={r.account.status} />,
  },
  {
    key: 'balance',
    header: 'Balance',
    align: 'right',
    sortValue: (r) => r.account.balance,
    render: (r) => <BalanceText amount={r.account.balance} />,
  },
]

/** All accounts: search by number, customer or address; filter by status and area. */
export default function AccountsPage() {
  const navigate = useNavigate()
  const directory = useAsync(loadCustomerDirectory, 'customer-directory')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AccountStatus | 'all'>('all')
  const [area, setArea] = useState<Area | 'all'>('all')
  const term = useDebouncedValue(search, 200)

  const all = directory.data?.accounts
  const filtered = useMemo(
    () =>
      (all ?? []).filter(
        (r) =>
          matchesAccount(r, term) &&
          (status === 'all' || r.account.status === status) &&
          (area === 'all' || r.account.area === area),
      ),
    [all, term, status, area],
  )
  const filtering = Boolean(term.trim()) || status !== 'all' || area !== 'all'

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Every property account. Open one to see its customer, meter and bills."
      />
      <Card padded={false}>
        <div className="border-mist flex flex-col gap-3 border-b p-4 lg:flex-row">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by account number, customer or address"
            className="flex-1"
          />
          <label className="sr-only" htmlFor="account-status">
            Filter by status
          </label>
          <select
            id="account-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AccountStatus | 'all')}
            className={`${controlClass(false)} lg:w-44`}
          >
            <option value="all">All statuses</option>
            {ACCOUNT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0] + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="account-area">
            Filter by area
          </label>
          <select
            id="account-area"
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
        </div>

        {all && (
          <p className="border-mist text-ink/60 border-b px-4 py-2 text-sm" aria-live="polite">
            {filtering ? `${filtered.length} of ${all.length} accounts` : `${all.length} accounts`}
          </p>
        )}

        <DataTable
          caption="Accounts"
          columns={columns}
          rows={filtered}
          getRowId={(r) => r.account.id}
          loading={directory.loading}
          error={directory.error ? friendlyError(directory.error) : null}
          onRetry={directory.reload}
          onRowClick={(r) =>
            navigate(`/staff/customers/${r.account.customerId}?account=${r.account.id}`)
          }
          initialSort={{ key: 'number', direction: 'asc' }}
          pageSize={15}
          emptyTitle={filtering ? 'No matching accounts' : 'No accounts yet'}
          emptyDescription={filtering ? 'Try a different number or clear the filters.' : undefined}
        />
      </Card>
    </>
  )
}
