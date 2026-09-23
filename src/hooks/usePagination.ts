import { useState } from 'react'

/** Client-side pagination for lists already loaded in memory. */
export function usePagination<T>(items: readonly T[], pageSize = 10) {
  const [requestedPage, setPage] = useState(1)
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  // Clamp instead of resetting in an effect, so filtering never leaves an empty page.
  const page = Math.min(requestedPage, pageCount)
  const startIndex = (page - 1) * pageSize

  return {
    page,
    setPage,
    pageCount,
    pageSize,
    total,
    pageItems: items.slice(startIndex, startIndex + pageSize),
    /** 1-based index of first and last item shown, for "Showing 1–10 of 42". */
    start: total === 0 ? 0 : startIndex + 1,
    end: Math.min(startIndex + pageSize, total),
  }
}
