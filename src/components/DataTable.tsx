import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import EmptyState from './EmptyState'
import ErrorState from './ErrorState'
import { Skeleton } from './LoadingSkeleton'
import Pagination from './Pagination'
import { usePagination } from '../hooks/usePagination'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number | Date | null | undefined
  align?: 'left' | 'right'
  /** Hide this column in the mobile card view (e.g. secondary details). */
  hideOnMobile?: boolean
  /** Keep the header for screen readers only (e.g. an "Actions" column). */
  srOnlyHeader?: boolean
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: readonly T[] | null | undefined
  getRowId: (row: T) => string
  /** Describes the table for screen readers, e.g. "Customers". */
  caption: string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  onRowClick?: (row: T) => void
  initialSort?: { key: string; direction: 'asc' | 'desc' }
  /** Rows per page. Sorting applies to all rows first, then pages are cut. Omit to show all. */
  pageSize?: number
}

type SortState = { key: string; direction: 'asc' | 'desc' } | null

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'en-ZA', { numeric: true, sensitivity: 'base' })
}

/**
 * The one table in AquaLink. Handles loading, error, empty, sorting, row clicks,
 * and switches to stacked cards on small screens.
 */
export default function DataTable<T>({
  columns,
  rows,
  getRowId,
  caption,
  loading = false,
  error,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  onRowClick,
  initialSort,
  pageSize,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(initialSort ?? null)

  const sorted = useMemo(() => {
    if (!rows) return []
    const column = sort && columns.find((c) => c.key === sort.key)
    if (!sort || !column?.sortValue) return rows
    const factor = sort.direction === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => factor * compare(column.sortValue!(a), column.sortValue!(b)))
  }, [rows, sort, columns])

  const pagination = usePagination(sorted, pageSize ?? Math.max(sorted.length, 1))
  const visible = pageSize ? pagination.pageItems : sorted

  function toggleSort(key: string) {
    setSort((s) =>
      s?.key === key
        ? { key, direction: s.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (!loading && sorted.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
  }

  const clickable = Boolean(onRowClick)
  const rowProps = (row: T) =>
    clickable
      ? {
          onClick: () => onRowClick!(row),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onRowClick!(row)
            }
          },
          tabIndex: 0,
          role: 'link' as const,
        }
      : {}

  const [primary, ...rest] = columns

  return (
    <>
      {/* Desktop and tablet: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-mist bg-paper text-ink/70 border-b">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key
                const SortIcon = !active
                  ? ArrowUpDown
                  : sort.direction === 'asc'
                    ? ArrowUp
                    : ArrowDown
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={
                      active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={`px-4 py-3 font-semibold whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className="hover:text-ink inline-flex items-center gap-1 rounded"
                      >
                        {c.header}
                        <SortIcon
                          className={`size-3.5 ${active ? '' : 'opacity-40'}`}
                          aria-hidden="true"
                        />
                      </button>
                    ) : c.srOnlyHeader ? (
                      <span className="sr-only">{c.header}</span>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-mist divide-y">
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3.5">
                        <Skeleton className="h-4 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              : visible.map((row) => (
                  <tr
                    key={getRowId(row)}
                    {...rowProps(row)}
                    className={
                      clickable ? 'hover:bg-paper focus-visible:bg-paper cursor-pointer' : ''
                    }
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={`px-4 py-3 align-middle ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c.className ?? ''}`}
                      >
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="divide-mist divide-y md:hidden" aria-label={caption}>
        {loading
          ? Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="space-y-2 px-4 py-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </li>
            ))
          : visible.map((row) => (
              <li
                key={getRowId(row)}
                {...rowProps(row)}
                className={`px-4 py-3.5 ${clickable ? 'active:bg-paper cursor-pointer' : ''}`}
              >
                <div className="font-semibold">{primary.render(row)}</div>
                <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {rest
                    .filter((c) => !c.hideOnMobile)
                    .map((c) => (
                      <div key={c.key} className="contents">
                        <dt className={c.srOnlyHeader ? 'sr-only' : 'text-ink/60'}>{c.header}</dt>
                        <dd className="min-w-0">{c.render(row)}</dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
      </ul>

      {pageSize && !loading && pagination.pageCount > 1 && (
        <div className="border-mist border-t px-4 py-3">
          <Pagination
            page={pagination.page}
            pageCount={pagination.pageCount}
            onChange={pagination.setPage}
            start={pagination.start}
            end={pagination.end}
            total={pagination.total}
          />
        </div>
      )}
    </>
  )
}
