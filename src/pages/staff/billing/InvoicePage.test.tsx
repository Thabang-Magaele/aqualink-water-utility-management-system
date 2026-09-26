import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '../../../types/user'
import { formatCurrency, formatKl } from '../../../utils/format'
import { account, invoice, ts } from './fixtures'
import { ToastProvider } from '../../../context/ToastProvider'
import InvoicePage from './InvoicePage'

const shown = (text: string) => text.replace(/\s/g, ' ')
const auth = vi.hoisted(() => ({ role: 'billing' as Role }))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ role: auth.role }) }))
const service = vi.hoisted(() => ({ loadInvoice: vi.fn() }))
vi.mock('../../../services/billingService', () => service)
const payments = vi.hoisted(() => ({ recordPayment: vi.fn(), newAttemptKey: () => 'key-12345678' }))
vi.mock('../../../services/paymentService', () => payments)

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
function renderWithToasts(path: string, role: Role) {
  auth.role = role
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route
            path="/staff/billing/invoices/:invoiceId"
            element={<InvoicePage audience="staff" />}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  service.loadInvoice.mockReset().mockResolvedValue({
    invoice: invoice('A1'),
    account,
    customer: { id: 'c1', name: 'Thandi Mokoena' },
    payments: [],
  })
  payments.recordPayment.mockReset().mockResolvedValue({
    status: 'SUCCESS',
    amount: 433.2,
    reference: 'FNB 4100223107',
    message: 'Payment received.',
  })
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
})

describe('Paying from the invoice page', () => {
  it('customers get "Pay now" on an unpaid invoice', async () => {
    renderAt('/customer/bills/A1', 'customer', 'customer')
    expect(await screen.findByRole('link', { name: /Pay now/ })).toHaveAttribute(
      'href',
      '/customer/bills/A1/pay',
    )
    expect(screen.queryByRole('button', { name: /Record payment/ })).not.toBeInTheDocument()
  })
  it('no payment actions on a paid invoice', async () => {
    service.loadInvoice.mockResolvedValue({
      invoice: invoice('A1', { status: 'PAID', paidAt: ts('2026-09-20T10:00:00') }),
      account,
      customer: null,
      payments: [],
    })
    renderAt('/customer/bills/A1', 'customer', 'customer')
    await screen.findByRole('article', { name: /Invoice/ })
    expect(screen.queryByRole('link', { name: /Pay now/ })).not.toBeInTheDocument()
  })
  it('shows the payment history, including why a payment failed', async () => {
    service.loadInvoice.mockResolvedValue({
      invoice: invoice('A1'),
      account,
      customer: null,
      payments: [
        {
          id: 'p1',
          invoiceId: 'A1',
          amount: 433.2,
          status: 'FAILED',
          paymentMethod: 'CARD',
          cardBrand: 'Visa',
          cardLast4: '0002',
          reference: null,
          failureReason: 'Your card was declined.',
          createdAt: ts('2026-09-25T09:00:00'),
          paidAt: null,
        },
      ],
    })
    renderAt('/customer/bills/A1', 'customer', 'customer')
    const history = within(await screen.findByRole('table', { name: 'Payments for this invoice' }))
    expect(history.getByText('Visa •••• 0002')).toBeInTheDocument()
    expect(history.getByText('Your card was declined.')).toBeInTheDocument()
  })
  it('billing records an EFT payment (reference required) and the page reloads', async () => {
    renderWithToasts('/staff/billing/invoices/A1', 'billing')
    await userEvent.click(await screen.findByRole('button', { name: /Record payment/ }))
    const dialog = screen.getByRole('dialog', { name: 'Record a payment' })
    await userEvent.click(within(dialog).getByRole('button', { name: /^Record/ }))
    expect(within(dialog).getByText('Enter the bank reference from the EFT.')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText(/Bank reference/), 'FNB 4100223107')
    await userEvent.click(within(dialog).getByRole('button', { name: /^Record/ }))
    expect(payments.recordPayment).toHaveBeenCalledWith(
      'A1',
      'EFT',
      'FNB 4100223107',
      'key-12345678',
    )
    expect(await screen.findByText('Payment recorded')).toBeInTheDocument()
    expect(service.loadInvoice).toHaveBeenCalledTimes(2)
  })
  it('the call centre cannot record payments', async () => {
    renderAt('/staff/billing/invoices/A1', 'staff', 'call_centre')
    await screen.findByRole('article', { name: /Invoice/ })
    expect(screen.queryByRole('button', { name: /Record payment/ })).not.toBeInTheDocument()
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
