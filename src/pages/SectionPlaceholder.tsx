import type { NavItem } from '../routes/navigation'

/** Stand-in for sections that later phases build. Route access already applies. */
export default function SectionPlaceholder({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <section>
      <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight">
        <Icon className="text-reservoir size-6" aria-hidden="true" />
        {item.label}
      </h1>
      <p className="text-ink/70 mt-3 max-w-prose">
        You have access to this section. Its features are built in Phase {item.phase}.
      </p>
    </section>
  )
}
