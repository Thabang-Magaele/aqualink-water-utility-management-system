import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../context/ToastProvider'
import type { Role } from '../../../types/user'
import { formatCurrency } from '../../../utils/format'
import BillingPage from './BillingPage'
import { invoices, previewRun, settings } from './fixtures'

const shown = (text: string) => text.replace(/\s/g, ' ')
const auth = vi.hoisted(() => ({ role: 'billing' as Role }))
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ role: auth.role, user: { uid: 'me' } }),
}))
const service = vi.hoisted(() => ({
  loadInvoiceList: vi.fn(),
  loadBillingSettings: vi.fn(),
  saveBillingSettings: vi.fn(),
  runBilling: vi.fn(),
}))
vi.mock('../../../services/billingService', () => service)

function renderAs(role: Role) {
  auth.role = role
  return render(
    <MemoryRouter initialEntries={['/staff/billing']}>
      <ToastProvider>
        <Routes>
          <Route path="/staff/billing" element={<BillingPage />} />
          <Route path="/staff/billing/invoices/:id" element={<p>Invoice page</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}
const rows = () =>
  within(screen.getByRole('table', { name: 'Invoices' }))
    .getAllByRole('row')
    .slice(1)

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
  service.loadInvoiceList.mockReset().mockResolvedValue(
    invoices.map((invoice, i) => ({
      invoice,
      accountNumber: ['4100223107', '4100231842', '4100223107'][i],
      customerName: ['Thandi Mokoena', 'Sipho Dlamini', 'Thandi Mokoena'][i],
    })),
  )
  service.loadBillingSettings.mockReset().mockResolvedValue(settings)
  service.saveBillingSettings.mockReset().mockResolvedValue(undefined)
  service.runBilling.mockReset().mockImplementation(async (dryRun: boolean) =>
    dryRun
      ? previewRun
      : {
          ...previewRun,
          dryRun: false,
          accounts: previewRun.accounts.map((a) => (a.ok ? { ...a, created: true } : a)),
        },
  )
})

describe('BillingPage', () => {
  it('summarises what is owed and overdue', async () => {
    renderAs('billing')
    const region = within(await screen.findByRole('region', { name: 'Summary' }))
    // Each stat card: find its label inside the summary, then look within that card
    const card = async (label: string) =>
      within((await region.findByText(label)).closest('div')!.parentElement!)
    expect(
      await (await card('Outstanding')).findByText(shown(formatCurrency(1120.3))),
    ).toBeInTheDocument() // 433.20 + 687.10
    expect((await card('Overdue')).getByText(shown(formatCurrency(687.1)))).toBeInTheDocument()
    expect(region.getByText('1 invoice past due')).toBeInTheDocument()
  })

  it('filters by status and search, and opens an invoice', async () => {
    renderAs('billing')
    await screen.findByRole('table', { name: 'Invoices' })
    await waitFor(() => expect(rows()).toHaveLength(3))
    await userEvent.click(screen.getByRole('button', { name: /^Overdue/ }))
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent('Sipho Dlamini')
    await userEvent.click(screen.getByRole('button', { name: /^All/ }))
    await userEvent.type(screen.getByRole('searchbox'), 'INV-202609-C3')
    await waitFor(() => expect(rows()).toHaveLength(1)) // the search waits briefly after typing
    expect(rows()[0]).toHaveTextContent('INV-202609-C3')
    await userEvent.click(within(rows()[0]).getAllByRole('button')[0])
    expect(await screen.findByText('Invoice page')).toBeInTheDocument()
  })

  it('previews a billing run with totals and skipped accounts, then creates the invoices', async () => {
    renderAs('billing')
    await userEvent.click(await screen.findByRole('button', { name: 'Run billing' }))
    const dialog = screen.getByRole('dialog', { name: 'Run billing' })
    expect(await within(dialog).findByText('Sipho Dlamini')).toBeInTheDocument()
    expect(within(dialog).getByText(shown(formatCurrency(1120.3)))).toBeInTheDocument()
    expect(within(dialog).getByText('1 account skipped')).toBeInTheDocument()
    expect(service.runBilling).toHaveBeenCalledWith(true)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create 2 invoices' }))
    expect(service.runBilling).toHaveBeenLastCalledWith(false)
    expect(await screen.findByText('2 invoices created')).toBeInTheDocument()
    expect(service.loadInvoiceList).toHaveBeenCalledTimes(2) // list refreshed
  })

  it('says when there is nothing to bill', async () => {
    service.runBilling.mockResolvedValue({
      ...previewRun,
      billableCount: 0,
      total: 0,
      accounts: [previewRun.accounts[2]],
    })
    renderAs('billing')
    await userEvent.click(await screen.findByRole('button', { name: 'Run billing' }))
    const dialog = screen.getByRole('dialog', { name: 'Run billing' })
    expect(await within(dialog).findByText('Nothing to bill')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Create 0 invoices' })).toBeDisabled()
  })

  it('shows the server’s message if the run fails', async () => {
    service.runBilling.mockRejectedValue(new Error('You do not have permission to do that.'))
    renderAs('billing')
    await userEvent.click(await screen.findByRole('button', { name: 'Run billing' }))
    expect(
      await within(screen.getByRole('dialog', { name: 'Run billing' })).findByText(
        'You do not have permission to do that.',
      ),
    ).toBeInTheDocument()
  })

  it('billing sees the tariff but only an admin can change it', async () => {
    renderAs('billing')
    const tariff = within(
      (await screen.findByRole('heading', { name: 'Tariff' })).closest('section')!,
    )
    expect(await tariff.findByText(shown(formatCurrency(28.5)))).toBeInTheDocument()
    expect(tariff.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument()
  })

  it('an admin changes the tariff, with validation', async () => {
    renderAs('admin')
    const tariff = within(
      (await screen.findByRole('heading', { name: 'Tariff' })).closest('section')!,
    )
    await userEvent.click(await tariff.findByRole('button', { name: 'Change' }))
    const dialog = screen.getByRole('dialog', { name: 'Change the tariff' })
    await userEvent.clear(within(dialog).getByLabelText(/Rate/))
    await userEvent.type(within(dialog).getByLabelText(/Rate/), '0')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save tariff' }))
    expect(within(dialog).getByText(/Enter a rate between/)).toBeInTheDocument()
    await userEvent.clear(within(dialog).getByLabelText(/Rate/))
    await userEvent.type(within(dialog).getByLabelText(/Rate/), '31.75')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save tariff' }))
    expect(service.saveBillingSettings).toHaveBeenCalledWith(
      { tariffRate: 31.75, paymentTermsDays: 21 },
      'me',
    )
    expect(await screen.findByText('Tariff updated')).toBeInTheDocument()
  })
})
