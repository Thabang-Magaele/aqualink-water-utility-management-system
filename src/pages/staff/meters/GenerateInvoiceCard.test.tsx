import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../context/ToastProvider'
import { formatCurrency } from '../../../utils/format'
import { previewRun } from '../billing/fixtures'
import GenerateInvoiceCard from './GenerateInvoiceCard'

const shown = (text: string) => text.replace(/\s/g, ' ')
const service = vi.hoisted(() => ({ generateInvoice: vi.fn() }))
vi.mock('../../../services/billingService', () => service)
const ok = previewRun.accounts[0]

const renderCard = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <GenerateInvoiceCard accountId="a1" />
      </ToastProvider>
    </MemoryRouter>,
  )
const card = () => within(screen.getByRole('heading', { name: 'Invoice' }).closest('section')!)

beforeEach(() => {
  service.generateInvoice
    .mockReset()
    .mockImplementation(async (_id: string, dryRun: boolean) =>
      dryRun ? ok : { ...ok, created: true },
    )
})

describe('GenerateInvoiceCard', () => {
  it('previews, then creates the invoice and links to it', async () => {
    renderCard()
    await userEvent.click(card().getByRole('button', { name: 'Preview invoice' }))
    expect(service.generateInvoice).toHaveBeenCalledWith('a1', true)
    expect(await card().findByText(shown(formatCurrency(433.2)))).toBeInTheDocument()
    await userEvent.click(card().getByRole('button', { name: 'Create invoice' }))
    expect(service.generateInvoice).toHaveBeenLastCalledWith('a1', false)
    expect(await card().findByRole('link', { name: 'View invoice' })).toHaveAttribute(
      'href',
      '/staff/billing/invoices/a1_r5',
    )
    expect(screen.getByText('Invoice created')).toBeInTheDocument()
  })
  it('explains when there is nothing to bill', async () => {
    service.generateInvoice.mockResolvedValue(previewRun.accounts[2])
    renderCard()
    await userEvent.click(card().getByRole('button', { name: 'Preview invoice' }))
    expect(await card().findByText(/No new consumption since the last invoice/)).toBeInTheDocument()
    expect(card().queryByRole('button', { name: 'Create invoice' })).not.toBeInTheDocument()
  })
  it('shows the server’s error', async () => {
    service.generateInvoice.mockRejectedValue(
      new Error('AquaLink could not reach the server. Check your connection and try again.'),
    )
    renderCard()
    await userEvent.click(card().getByRole('button', { name: 'Preview invoice' }))
    expect(await card().findByText(/could not reach the server/)).toBeInTheDocument()
  })
})
