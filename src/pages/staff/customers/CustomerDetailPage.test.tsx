import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../context/ToastProvider'
import type { Role } from '../../../types/user'
import { formatCurrency, formatNumber } from '../../../utils/format'
import CustomerDetailPage from './CustomerDetailPage'
import { accounts, invoices, meters, payments, thandi, tickets } from './fixtures'

/** Expected text as the page shows it (Intl uses non-breaking spaces; Testing Library normalises them). */
const shown = (text: string) => text.replace(/\s/g, ' ')

const auth = vi.hoisted(() => ({ role: 'call_centre' as Role }))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ role: auth.role }) }))

const service = vi.hoisted(() => ({
  loadCustomer: vi.fn(),
  loadCustomerInvoices: vi.fn(),
  loadCustomerPayments: vi.fn(),
  loadCustomerTickets: vi.fn(),
  updateCustomerDetails: vi.fn(),
}))
vi.mock('../../../services/customerService', () => service)

function renderAs(role: Role, path = '/staff/customers/c1') {
  auth.role = role
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/staff/customers/:customerId" element={<CustomerDetailPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
  service.loadCustomer.mockReset().mockResolvedValue({ customer: thandi, accounts, meters })
  service.loadCustomerInvoices.mockReset().mockResolvedValue(invoices)
  service.loadCustomerPayments.mockReset().mockResolvedValue(payments)
  service.loadCustomerTickets.mockReset().mockResolvedValue(tickets)
  service.updateCustomerDetails.mockReset().mockResolvedValue(undefined)
})

describe('CustomerDetailPage', () => {
  it('shows contact details, total balance, and each account with its meter', async () => {
    renderAs('call_centre')
    expect(
      await screen.findByRole('heading', { name: 'Thandi Mokoena', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByText('082 123 4567')).toBeInTheDocument()
    const summary = within(screen.getByRole('region', { name: 'Summary' }))
    expect(summary.getByText(shown(formatCurrency(467.4)))).toBeInTheDocument()
    expect(screen.getByText('MTR-223107')).toBeInTheDocument()
    expect(screen.getByText('1 meter')).toBeInTheDocument()
    expect(
      screen.getByText(shown(`Last reading ${formatNumber(1331.3)} kL`), { exact: false }),
    ).toBeInTheDocument()
    expect(screen.getByText('No meter installed')).toBeInTheDocument()
    expect(screen.getByText('Suspended')).toBeInTheDocument()
  })

  it('call centre: sees invoices and tickets, not payments, and counts open tickets', async () => {
    renderAs('call_centre')
    expect(await screen.findByRole('table', { name: 'Tickets' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Invoices' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Payments' })).not.toBeInTheDocument()
    expect(service.loadCustomerPayments).not.toHaveBeenCalled()
    const openTickets = within(screen.getByRole('region', { name: 'Summary' }))
      .getByText('Open tickets')
      .closest('div')!.parentElement!
    expect(within(openTickets).getByText('1')).toBeInTheDocument()
  })

  it('billing: sees invoices and payments, never requests tickets, cannot edit', async () => {
    renderAs('billing')
    const paymentsTable = await screen.findByRole('table', { name: 'Payments' })
    expect(within(paymentsTable).getByText('MOCK-1071X7K')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Tickets' })).not.toBeInTheDocument()
    expect(service.loadCustomerTickets).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument()
  })

  it('highlights the account opened from the Accounts list', async () => {
    renderAs('billing', '/staff/customers/c1?account=a2')
    const item = await screen.findByText('4100223115')
    expect(item.closest('li')).toHaveAttribute('aria-current', 'true')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('one failing section does not break the rest of the page', async () => {
    service.loadCustomerInvoices.mockRejectedValue({ code: 'failed-precondition' })
    renderAs('call_centre')
    expect(await screen.findByText(/index is still being built/)).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Tickets' })).toBeInTheDocument()
  })

  it('shows "not found" for an unknown customer', async () => {
    service.loadCustomer.mockResolvedValue({ customer: null, accounts: [], meters: [] })
    renderAs('call_centre', '/staff/customers/nope')
    expect(
      await screen.findByRole('heading', { name: "This customer doesn't exist" }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to customers/ })).toHaveAttribute(
      'href',
      '/staff/customers',
    )
  })

  it('call centre edits contact details: validates, saves, confirms and reloads', async () => {
    renderAs('call_centre')
    await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit customer details' })
    const save = within(dialog).getByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled() // nothing changed yet

    const phone = within(dialog).getByLabelText('Mobile number')
    await userEvent.clear(phone)
    await userEvent.type(phone, '12345')
    await userEvent.click(save)
    expect(within(dialog).getByText(/Enter a South African number/)).toBeInTheDocument()
    expect(service.updateCustomerDetails).not.toHaveBeenCalled()

    await userEvent.clear(phone)
    await userEvent.type(phone, '072 555 0101')
    await userEvent.click(save)
    expect(service.updateCustomerDetails).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ phone: '072 555 0101', name: 'Thandi Mokoena' }),
    )
    expect(await screen.findByText('Details updated')).toBeInTheDocument()
    expect(service.loadCustomer).toHaveBeenCalledTimes(2) // reloaded after saving
  })

  it('keeps the dialog open with a friendly message if saving is refused', async () => {
    service.updateCustomerDetails.mockRejectedValue({ code: 'permission-denied' })
    renderAs('admin')
    await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit customer details' })
    await userEvent.type(within(dialog).getByLabelText(/Full name/), ' Jr')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(
      await within(dialog).findByText("You don't have access to this information."),
    ).toBeInTheDocument()
  })
})
