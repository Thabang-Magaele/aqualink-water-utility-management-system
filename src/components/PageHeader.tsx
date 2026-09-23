import type { ReactNode } from 'react'
import { useBreadcrumbs, type Crumb } from '../hooks/useBreadcrumbs'
import Breadcrumbs from './Breadcrumbs'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  /** Primary actions for the page, e.g. a "New ticket" button. */
  actions?: ReactNode
  /** Override the automatic breadcrumbs (useful on detail pages). */
  breadcrumbs?: Crumb[]
}

/** Top of every signed-in page: breadcrumbs, title, description and actions. */
export default function PageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  const auto = useBreadcrumbs()
  return (
    <div className="mb-6 space-y-2">
      <Breadcrumbs items={breadcrumbs ?? auto} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {description && <p className="text-ink/70 mt-1.5 max-w-prose">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}
