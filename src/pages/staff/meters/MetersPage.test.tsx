import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../context/ToastProvider'
import MetersPage from './MetersPage'
import { at, meter } from './fixtures'

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ role: 'billing', user: { uid: 'me' } }),
}))
const service = vi.hoisted(() => ({ loadMeterList: vi.fn(), addMeter: vi.fn() }))
vi.mock('../../../services/meterService', () => service)

const daysAgo = (n: number) => at(new Date(Date.now() - n * 86_400_000).toISOString())
const rows = [
  {
    meter: { ...meter, lastReadingDate: daysAgo(10) },
    accountNumber: '4100223107',
    propertyAddress: '14 Mahlangu Street',
    customerName: 'Thandi Mokoena',
  },
  {
    meter: { ...meter, id: 'm2', meterNumber: 'MTR-231842', lastReadingDate: daysAgo(50) },
    accountNumber: '4100231842',
    propertyAddress: '27 Jacaranda Avenue',
    customerName: 'Sipho Dlamini',
  },
  {
    meter: {
      ...meter,
      id: 'm3',
      meterNumber: 'MTR-245569',
      status: 'FAULTY' as const,
      lastReadingDate: daysAgo(90),
    },
    accountNumber: '4100245569',
    propertyAddress: '9 Marula Road',
    customerName: 'Anele Khumalo',
  },
]

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
  service.loadMeterList.mockReset().mockResolvedValue({
    meters: rows,
    accountsWithoutMeter: [
      {
        id: 'a9',
        accountNumber: '4100999002',
        customerId: 'c1',
        customerName: 'Thandi Mokoena',
        propertyAddress: '8 Kiaat Street',
        meterId: null,
        status: 'ACTIVE',
      },
    ],
  })
  service.addMeter.mockReset().mockResolvedValue('new-meter')
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <MetersPage />
      </ToastProvider>
    </MemoryRouter>,
  )
const meterNumbers = () =>
  within(screen.getByRole('table', { name: 'Meters' }))
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0].textContent)

describe('MetersPage', () => {
  it('lists meters, longest-unread first, and flags overdue active meters only', async () => {
    renderPage()
    expect(await screen.findByText(/3 meters/)).toBeInTheDocument()
    expect(meterNumbers()).toEqual(['MTR-245569', 'MTR-231842', 'MTR-223107'])
    expect(screen.getByLabelText(/Due for reading \(1\)/)).toBeInTheDocument()
  })
  it('filters to meters due for a reading', async () => {
    renderPage()
    await screen.findByText(/3 meters/)
    await userEvent.click(screen.getByLabelText(/Due for reading/))
    expect(meterNumbers()).toEqual(['MTR-231842'])
  })
  it('searches by customer name', async () => {
    renderPage()
    await screen.findByText(/3 meters/)
    await userEvent.type(screen.getByRole('searchbox'), 'anele')
    expect(await screen.findByText(/1 of 3 meters/)).toBeInTheDocument()
  })
  it('adds a meter, rejecting a duplicate number first', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Add meter' }))
    const dialog = screen.getByRole('dialog', { name: 'Add a meter' })
    await userEvent.type(within(dialog).getByLabelText(/Meter number/), 'mtr-231842')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add meter' }))
    expect(within(dialog).getByText('A meter with this number already exists.')).toBeInTheDocument()
    await userEvent.clear(within(dialog).getByLabelText(/Meter number/))
    await userEvent.type(within(dialog).getByLabelText(/Meter number/), 'mtr-999002')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add meter' }))
    expect(service.addMeter).toHaveBeenCalledWith(
      expect.objectContaining({
        meterNumber: 'MTR-999002',
        accountId: 'a9',
        customerId: 'c1',
        initialReading: 0,
      }),
      'me',
    )
  })
})
