import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatCurrency } from '../../utils/format'
import { account, invoice, ts } from '../staff/billing/fixtures'
import PayInvoicePage from './PayInvoicePage'

const shown = (text: string) => text.replace(/\s/g, ' ')
const service = vi.hoisted(() => ({ loadInvoice: vi.fn() }))
vi.mock('../../services/billingService', () => service)
const pay = vi.hoisted(() => ({ payByCard: vi.fn(), newAttemptKey: vi.fn() }))
vi.mock('../../services/paymentService', () => pay)

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/customer/bills/A1/pay']}>
      <Routes>
        <Route path="/customer/bills/:invoiceId/pay" element={<PayInvoicePage />} />
      </Routes>
    </MemoryRouter>,
  )

async function fillCard(number = '4242 4242 4242 4242') {
  await userEvent.type(screen.getByLabelText(/Name on card/), 'Thandi Mokoena')
  await userEvent.clear(screen.getByLabelText(/Card number/))
  await userEvent.type(screen.getByLabelText(/Card number/), number)
  await userEvent.type(screen.getByLabelText(/Expiry/), '1228')
  await userEvent.type(screen.getByLabelText(/Security code/), '123')
}
const payButton = () => screen.getByRole('button', { name: /^Pay R/ })

let keys = 0
beforeEach(() => {
  keys = 0
  pay.newAttemptKey.mockReset().mockImplementation(() => `key-${++keys}-0000000`)
  service.loadInvoice
    .mockReset()
    .mockResolvedValue({ invoice: invoice('A1'), account, customer: null, payments: [] })
  pay.payByCard.mockReset().mockResolvedValue({
    paymentId: 'A1_key',
    status: 'SUCCESS',
    amount: 433.2,
    reference: 'MOCK-7F3K9Q2B',
    message: 'Payment received. Thank you.',
    invoiceId: 'A1',
    invoiceNumber: 'INV-202609-A1',
    repeated: false,
  })
})

describe('PayInvoicePage', () => {
  it('shows what is being paid, and formats the card as you type', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Pay INV-202609-A1' })).toBeInTheDocument()
    expect(payButton()).toHaveTextContent(shown(`Pay ${formatCurrency(433.2)}`))
    await userEvent.type(screen.getByLabelText(/Card number/), '4242424242424242')
    expect(screen.getByLabelText(/Card number/)).toHaveValue('4242 4242 4242 4242')
    await userEvent.type(screen.getByLabelText(/Expiry/), '1228')
    expect(screen.getByLabelText(/Expiry/)).toHaveValue('12/28')
  })

  it('checks the card before sending anything', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Pay INV-202609-A1' })
    await fillCard('4242 4242 4242 4241')
    await userEvent.click(payButton())
    expect(screen.getByText('Check the card number.')).toBeInTheDocument()
    expect(pay.payByCard).not.toHaveBeenCalled()
  })

  it('a test card can be filled in with one click, and a successful payment shows a receipt', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Pay INV-202609-A1' })
    await fillCard()
    await userEvent.click(screen.getByRole('button', { name: 'Use test card ending 0002' }))
    expect(screen.getByLabelText(/Card number/)).toHaveValue('4000 0000 0000 0002')
    await userEvent.click(screen.getByRole('button', { name: 'Use test card ending 4242' }))
    await userEvent.click(payButton())
    expect(pay.payByCard).toHaveBeenCalledWith(
      'A1',
      expect.objectContaining({ number: '4242 4242 4242 4242', expiry: '12/28' }),
      'key-1-0000000',
    )
    expect(await screen.findByRole('heading', { name: 'Payment received' })).toBeInTheDocument()
    expect(screen.getByText('MOCK-7F3K9Q2B')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View invoice/ })).toHaveAttribute(
      'href',
      '/customer/bills/A1',
    )
  })

  it('a declined card shows why, and the next try is a new attempt', async () => {
    pay.payByCard.mockResolvedValueOnce({
      status: 'FAILED',
      message: 'Your card was declined. Try another card or contact your bank.',
      amount: 433.2,
      reference: null,
    })
    renderPage()
    await screen.findByRole('heading', { name: 'Pay INV-202609-A1' })
    await fillCard('4000 0000 0000 0002')
    await userEvent.click(payButton())
    expect(await screen.findByText(/Your card was declined/)).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText(/Card number/))
    await userEvent.type(screen.getByLabelText(/Card number/), '4242424242424242')
    await userEvent.click(payButton())
    expect(pay.payByCard.mock.calls.map((c) => c[2])).toEqual(['key-1-0000000', 'key-2-0000000'])
  })

  it('after a network failure, pressing Pay again reuses the same attempt, so it can’t charge twice', async () => {
    pay.payByCard.mockRejectedValueOnce(
      new Error('AquaLink could not reach the server. Check your connection and try again.'),
    )
    renderPage()
    await screen.findByRole('heading', { name: 'Pay INV-202609-A1' })
    await fillCard()
    await userEvent.click(payButton())
    expect(await screen.findByText(/could not reach the server/)).toBeInTheDocument()
    await userEvent.click(payButton())
    expect(pay.payByCard.mock.calls.map((c) => c[2])).toEqual(['key-1-0000000', 'key-1-0000000'])
    expect(await screen.findByRole('heading', { name: 'Payment received' })).toBeInTheDocument()
  })

  it('does not offer payment on an invoice that is already paid', async () => {
    service.loadInvoice.mockResolvedValue({
      invoice: invoice('A1', { status: 'PAID', paidAt: ts('2026-09-20T10:00:00') }),
      account,
      customer: null,
      payments: [],
    })
    renderPage()
    expect(
      await screen.findByRole('heading', { name: 'This invoice is already paid' }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/Card number/)).not.toBeInTheDocument()
  })
})
