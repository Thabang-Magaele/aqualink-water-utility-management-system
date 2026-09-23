import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import type { NavItem } from '../routes/navigation'

/** Stand-in for sections that later phases build. Route access already applies. */
export default function SectionPlaceholder({ item }: { item: NavItem }) {
  return (
    <>
      <PageHeader title={item.label} />
      <Card>
        <EmptyState
          icon={item.icon}
          title="Coming soon"
          description={`You have access to this section. Its features are built in Phase ${item.phase}.`}
        />
      </Card>
    </>
  )
}
