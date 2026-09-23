import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MetricDef } from '../../services/dashboardQueries'
import type { Role } from '../../types/user'
import StaffDashboardPage from './StaffDashboardPage'

// --- Mocks: signed-in user and the Firestore-backed service ------------------
const auth = vi.hoisted(() => ({ role: 'admin' as Role }))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    role: auth.role,
    user: { uid: 'u1', displayName: 'Nomsa Mahlangu', email: 'admin@aqualink.demo' },
    profile: { displayName: 'Nomsa Mahlangu' },
  }),
}))

const service = vi.hoisted(() => ({
  loadMetric: vi.fn(),
  loadActivity: vi.fn(),
}))
vi.mock('../../services/dashboardService', () => ({
  loadMetric: service.loadMetric,
  loadActivity: service.loadActivity,
  dashboardErrorMessage: () => "Couldn't load.",
}))

function renderAs(role: Role) {
  auth.role = role
  return render(
    <MemoryRouter>
      <StaffDashboardPage />
    </MemoryRouter>,
  )
}
const figures = () => within(screen.getByRole('region', { name: 'Key figures' }))

beforeEach(() => {
  service.loadMetric.mockReset().mockImplementation(async (def: MetricDef) => {
    if (def.id === 'unpaidInvoices')
      return { main: { count: 7, sum: 3120.5 }, secondary: { count: 2, sum: 800 } }
    if (def.id === 'openTickets') return { main: { count: 12 }, secondary: { count: 3 } }
    return { main: { count: 4 } }
  })
  service.loadActivity.mockReset().mockResolvedValue([
    {
      id: 'a1',
      kind: 'ticket',
      title: 'TKT-260923-AB7K · Leak',
      detail: 'Thandi Mokoena · KaNyamazane · Unassigned',
      at: new Date(),
      status: 'OPEN',
      to: '/staff/tickets',
    },
  ])
})

describe('StaffDashboardPage', () => {
  it('admin sees all headline figures with values and hints', async () => {
    renderAs('admin')
    expect(await figures().findByText('3 escalated')).toBeInTheDocument()
    for (const label of [
      'Total customers',
      'Open tickets',
      'In-progress jobs',
      'Unpaid invoices',
      'Active outages',
    ]) {
      expect(figures().getByText(label)).toBeInTheDocument()
    }
    expect(figures().getByText('12')).toBeInTheDocument()
    expect(figures().getByText(/R\s?3\s?120,50 outstanding · 2 overdue/)).toBeInTheDocument()
  })

  it('technician sees only their own job figures, not billing or customers', async () => {
    renderAs('technician')
    expect(await figures().findByText('Jobs waiting')).toBeInTheDocument()
    expect(figures().getByText('Resolved by you')).toBeInTheDocument()
    expect(figures().queryByText('Total customers')).not.toBeInTheDocument()
    expect(figures().queryByText('Unpaid invoices')).not.toBeInTheDocument()
  })

  it('links a figure only to pages the role can open', async () => {
    renderAs('call_centre')
    await figures().findByText('3 escalated')
    expect(figures().getByText('Open tickets').closest('a')).toHaveAttribute(
      'href',
      '/staff/tickets',
    )
    // Call centre can't open Billing, so the unpaid-invoices card is not a link
    expect(figures().getByText('Unpaid invoices').closest('a')).toBeNull()
  })

  it('one failing figure shows an error without blanking the others', async () => {
    service.loadMetric.mockImplementation(async (def: MetricDef) => {
      if (def.id === 'customers') throw new Error('boom')
      return { main: { count: 5 } }
    })
    renderAs('billing')
    expect(await figures().findByText("Couldn't load.")).toBeInTheDocument()
    expect(figures().getAllByText('5').length).toBeGreaterThan(0)
  })

  it('shows recent activity, and an empty state when there is none', async () => {
    renderAs('call_centre')
    expect(await screen.findByText('TKT-260923-AB7K · Leak')).toBeInTheDocument()

    service.loadActivity.mockResolvedValue([])
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByText('No recent activity')).toBeInTheDocument()
  })

  it('passes the signed-in uid to every query (technician filters depend on it)', async () => {
    renderAs('technician')
    await figures().findByText('Jobs waiting')
    for (const call of service.loadMetric.mock.calls) expect(call[1].uid).toBe('u1')
  })
})
