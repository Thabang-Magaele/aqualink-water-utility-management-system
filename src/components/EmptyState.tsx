import { Inbox, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
}

/** Shown when a list or section has nothing in it yet. Say what will appear and how to add it. */
export default function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="bg-mist text-reservoir rounded-full p-3">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-bold">{title}</h3>
      {description && <p className="text-ink/65 mt-1 max-w-sm text-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
