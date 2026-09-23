import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Crumb } from '../hooks/useBreadcrumbs'

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length < 2) return null
  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-ink/60 flex flex-wrap items-center gap-1 text-sm">
        {items.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="text-ink/35 size-3.5" aria-hidden="true" />}
            {crumb.to ? (
              <Link to={crumb.to} className="hover:text-ink hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink/80 font-medium">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
