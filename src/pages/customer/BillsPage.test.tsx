import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatCurrency } from '../../utils/format'
import { account, invoice, invoices, ts } from '../staff/billing/fixtures'
import BillsPage from './BillsPage'

const shown = (text: string) => text.replace(/\s/g, ' ')
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ role: 'customer', user: { uid: 'c1' } }),
}))
const service = vi.hoisted(() => ({ loadMyBills: vi.fn() }))
vi.mock('../../services/billingService', () => service)

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/customer/bills']}>
      <Routes>
        <Route path="/customer/bills" element={<BillsPage />} />
        <Route path="/customer/bills/:id" element={<p>Invoice detail</p>} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  service.loadMyBills.mockReset().mockResolvedValue({
    invoices,
    accounts: [account, { ...account, id: 'a3', propertyAddress: '27 Jacaranda Avenue' }],
  })
})

describe('BillsPage', () => {
  it('shows the amount due, the next due date and an overdue warning', async () => {
    renderPage()
    expect(service.loadMyBills).toHaveBeenCalledWith('c1')
    const summary = within(await screen.findByRole('region', { name: 'Summary' }))
    expect(await summary.findByText(shown(formatCurrency(1120.3)))).toBeInTheDocument()
    expect(summary.getByText('2 unpaid invoices')).toBeInTheDocument()
    // The next *upcoming* payment; the overdue invoice (10 Sept) has its own warning
    expect(summary.getByText('16 Oct 2026')).toBeInTheDocument()
    expect(summary.queryByText('10 Sept 2026')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('1 invoice is overdue')
  })
  it('shows no "next due date" when only overdue invoices remain', async () => {
    service.loadMyBills.mockResolvedValue({
      invoices: invoices.filter((i) => i.status !== 'UNPAID'),
      accounts: [account],
    })
    renderPage()
    const summary = within(await screen.findByRole('region', { name: 'Summary' }))
    expect(await summary.findByText('Only overdue invoices remain')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('contact Silulumanzi')
  })
  it('opens an invoice', async () => {
    renderPage()
    const table = await screen.findByRole('table', { name: 'Your invoices' })
    const firstRow = within(table).getAllByRole('row')[1] // row 0 is the header, whose buttons sort columns
    await userEvent.click(within(firstRow).getAllByRole('button')[0])
    expect(await screen.findByText('Invoice detail')).toBeInTheDocument()
  })
  it('says when everything is paid', async () => {
    service.loadMyBills.mockResolvedValue({
      invoices: [invoice('P1', { status: 'PAID', paidAt: ts('2026-09-01T10:00:00') })],
      accounts: [account],
    })
    renderPage()
    expect(await screen.findByText('You’re all paid up')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
