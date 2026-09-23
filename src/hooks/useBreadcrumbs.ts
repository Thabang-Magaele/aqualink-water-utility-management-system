import { useLocation } from 'react-router-dom'
import { navLabel } from '../routes/navigation'

export interface Crumb {
  label: string
  to?: string
}

const ROOTS: Record<string, string> = {
  staff: 'Staff console',
  customer: 'My AquaLink',
}

/**
 * Builds breadcrumbs from the URL using menu labels, e.g.
 * /staff/customers → Staff console › Customers.
 * Detail pages (e.g. /staff/customers/abc) can pass their own crumbs to PageHeader.
 */
export function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: Crumb[] = []
  let path = ''
  segments.forEach((segment, index) => {
    path += `/${segment}`
    const label =
      index === 0 ? (ROOTS[segment] ?? segment) : (navLabel(path) ?? decodeURIComponent(segment))
    crumbs.push({ label, to: path })
  })
  if (crumbs.length) delete crumbs[crumbs.length - 1].to // current page is not a link
  return crumbs
}
