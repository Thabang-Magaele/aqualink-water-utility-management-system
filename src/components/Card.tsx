import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  description?: string
  /** Buttons or links shown at the top right. */
  actions?: ReactNode
  /** Set false for edge-to-edge content such as tables. */
  padded?: boolean
  className?: string
  children: ReactNode
}

export default function Card({
  title,
  description,
  actions,
  padded = true,
  className = '',
  children,
}: CardProps) {
  return (
    <section className={`border-mist rounded-lg border bg-white shadow-xs ${className}`}>
      {(title || actions) && (
        <header className="border-mist flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            {title && <h2 className="font-bold">{title}</h2>}
            {description && <p className="text-ink/65 mt-0.5 text-sm">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  )
}
