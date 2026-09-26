import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '../../../types/user'
import { formatCurrency, formatKl } from '../../../utils/format'
import { account, invoice, ts } from './fixtures'
import InvoicePage from './InvoicePage'

const shown = (text: string) => text.replace(/\s/g, ' ')
const auth = vi.hoisted(() => ({ role: 'billing' as Role }))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ role: auth.role }) }))
const service = vi.hoisted(() => ({ loadInvoice: vi.fn() }))
vi.mock('../../../services/billingService', () => service)

function renderAt(path: string, audience: 'staff' | 'customer', role: Role) {
  auth.role = role
  const pattern =
    audience === 'staff' ? '/staff/billing/invoices/:invoiceId' : '/customer/bills/:invoiceId'
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={<InvoicePage audience={audience} />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  service.loadInvoice.mockReset().mockResolvedValue({
    invoice: invoice('A1'),
    account,
    customer: { id: 'c1', name: 'Thandi Mokoena' },
  })
})

describe('InvoicePage', () => {
  it('shows how the bill was calculated', async () => {
    renderAt('/staff/billing/invoices/A1', 'staff', 'billing')
    const bill = within(await screen.findByRole('article', { name: 'Invoice INV-202609-A1' }))
    expect(bill.getByText('September 2026')).toBeInTheDocument()
    expect(
      bill.getByText(shown(`Meter read ${formatKl(1330.4)} → ${formatKl(1345.6)}`)),
    ).toBeInTheDocument()
    expect(bill.getByText(shown(formatKl(15.2)))).toBeInTheDocument()
    expect(bill.getByText(shown(`${formatCurrency(28.5)}/kL`))).toBeInTheDocument()
    expect(bill.getAllByText(shown(formatCurrency(433.2)))).toHaveLength(2) // line and total
    expect(bill.getByText('Total due')).toBeInTheDocument()
    expect(bill.getByText('Thandi Mokoena')).toBeInTheDocument()
  })
  it('staff: links to the customer page; loads the customer', async () => {
    renderAt('/staff/billing/invoices/A1', 'staff', 'billing')
    expect(
      await screen.findByRole('link', { name: /Thandi Mokoena’s customer page/ }),
    ).toHaveAttribute('href', '/staff/customers/c1?account=a1')
    expect(service.loadInvoice).toHaveBeenCalledWith('A1', { withCustomer: true })
  })
  it('customer: their own bill, without loading customer records', async () => {
    service.loadInvoice.mockResolvedValue({
      invoice: invoice('A1', { status: 'PAID', paidAt: ts('2026-10-01T10:00:00') }),
      account,
      customer: null,
    })
    renderAt('/customer/bills/A1', 'customer', 'customer')
    expect(await screen.findByText('Total paid')).toBeInTheDocument()
    expect(screen.getByText('Paid on')).toBeInTheDocument()
    expect(service.loadInvoice).toHaveBeenCalledWith('A1', { withCustomer: false })
    expect(screen.queryByRole('link', { name: /customer page/ })).not.toBeInTheDocument()
  })
  it('says so when the invoice does not exist', async () => {
    service.loadInvoice.mockResolvedValue(null)
    renderAt('/customer/bills/nope', 'customer', 'customer')
    expect(
      await screen.findByRole('heading', { name: "This invoice doesn't exist" }),
    ).toBeInTheDocument()
  })
})
