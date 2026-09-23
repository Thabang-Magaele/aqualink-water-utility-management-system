import { ChevronLeft, ChevronRight } from 'lucide-react'
import Button from './Button'

interface PaginationProps {
  page: number
  pageCount: number
  onChange: (page: number) => void
  /** Optional "Showing 1–10 of 42" details from usePagination. */
  start?: number
  end?: number
  total?: number
}

export default function Pagination({
  page,
  pageCount,
  onChange,
  start,
  end,
  total,
}: PaginationProps) {
  if (pageCount <= 1 && total === undefined) return null
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p className="text-ink/65" aria-live="polite">
        {total !== undefined && total > 0 ? (
          <>
            Showing <strong className="text-ink">{start}</strong>–
            <strong className="text-ink">{end}</strong> of{' '}
            <strong className="text-ink">{total}</strong>
          </>
        ) : (
          `Page ${page} of ${pageCount}`
        )}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onChange(page - 1)}
            disabled={page <= 1}
            icon={<ChevronLeft className="size-4" aria-hidden="true" />}
          >
            Previous
          </Button>
          <span className="text-ink/65 px-1">
            {page} / {pageCount}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onChange(page + 1)}
            disabled={page >= pageCount}
          >
            Next
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </nav>
  )
}
