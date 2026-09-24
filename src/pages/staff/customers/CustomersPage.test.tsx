import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { summariseCustomers, accountRows } from '../../../utils/customerSearch'
import type { Customer } from '../../../types/models'
import { formatCurrency } from '../../../utils/format'
import CustomersPage from './CustomersPage'
import { accounts, thandi } from './fixtures'

/** Expected text as the page shows it (Intl uses non-breaking spaces; Testing Library normalises them). */
const shown = (text: string) => text.replace(/\s/g, ' ')

const service = vi.hoisted(() => ({ loadCustomerDirectory: vi.fn() }))
vi.mock('../../../services/customerService', () => service)

const sipho = {
  ...thandi,
  id: 'c2',
  name: 'Sipho Dlamini',
  email: 'sipho@example.com',
  phone: '0739876543',
  area: 'White River',
  accountIds: [],
} as Customer
const anele = {
  ...thandi,
  id: 'c3',
  name: 'Anele Khumalo',
  email: 'anele@example.com',
  phone: '0614455667',
  area: 'Matsulu',
  accountIds: [],
} as Customer

function Detail() {
  return <p>Detail page for {useParams().customerId}</p>
}
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/staff/customers']}>
      <Routes>
        <Route path="/staff/customers" element={<CustomersPage />} />
        <Route path="/staff/customers/:customerId" element={<Detail />} />
      </Routes>
    </MemoryRouter>,
  )
}
const table = () => screen.getByRole('table', { name: 'Customers' })
const rowNames = () =>
  within(table())
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0].textContent)

beforeEach(() => {
  service.loadCustomerDirectory.mockReset().mockResolvedValue({
    customers: summariseCustomers([thandi, sipho, anele], accounts),
    accounts: accountRows([thandi, sipho, anele], accounts),
    truncated: false,
  })
})

describe('CustomersPage', () => {
  it('lists every customer sorted by name, with their balance', async () => {
    renderPage()
    expect(await screen.findByText('3 customers')).toBeInTheDocument()
    expect(rowNames().map((n) => n?.split('@')[0])).toEqual([
      expect.stringContaining('Anele Khumalo'),
      expect.stringContaining('Sipho Dlamini'),
      expect.stringContaining('Thandi Mokoena'),
    ])
    expect(within(table()).getByText(shown(formatCurrency(467.4)))).toBeInTheDocument()
  })

  it('finds a customer by phone number typed with spaces', async () => {
    renderPage()
    await screen.findByText('3 customers')
    await userEvent.type(screen.getByRole('searchbox'), '073 987')
    expect(await screen.findByText('1 of 3 customers')).toBeInTheDocument()
    expect(rowNames()).toEqual([expect.stringContaining('Sipho Dlamini')])
  })

  it('finds a customer by account number', async () => {
    renderPage()
    await screen.findByText('3 customers')
    await userEvent.type(screen.getByRole('searchbox'), '4100223115')
    expect(await screen.findByText('1 of 3 customers')).toBeInTheDocument()
    expect(rowNames()).toEqual([expect.stringContaining('Thandi Mokoena')])
  })

  it('filters by area and by "owes money"', async () => {
    renderPage()
    await screen.findByText('3 customers')
    await userEvent.selectOptions(screen.getByLabelText('Filter by area'), 'Matsulu')
    expect(rowNames()).toEqual([expect.stringContaining('Anele Khumalo')])
    await userEvent.selectOptions(screen.getByLabelText('Filter by area'), 'all')
    await userEvent.click(screen.getByLabelText('Owes money'))
    expect(rowNames()).toEqual([expect.stringContaining('Thandi Mokoena')])
  })

  it('says so when nothing matches', async () => {
    renderPage()
    await screen.findByText('3 customers')
    await userEvent.type(screen.getByRole('searchbox'), 'nobody at all')
    expect(
      await screen.findByRole('heading', { name: 'No matching customers' }),
    ).toBeInTheDocument()
  })

  it('opens the customer when a row is clicked', async () => {
    renderPage()
    await screen.findByText('3 customers')
    await userEvent.click(within(table()).getByText('Thandi Mokoena'))
    expect(await screen.findByText('Detail page for c1')).toBeInTheDocument()
  })

  it('shows a friendly error with retry when loading fails', async () => {
    service.loadCustomerDirectory.mockRejectedValueOnce({ code: 'unavailable' })
    renderPage()
    expect(
      await screen.findByText('Offline. Check your connection and try again.'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('3 customers')).toBeInTheDocument()
  })
})
