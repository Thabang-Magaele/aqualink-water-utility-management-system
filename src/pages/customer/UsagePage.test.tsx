import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatKl } from '../../utils/format'
import { account, meter, readings } from '../staff/meters/fixtures'
import UsagePage from './UsagePage'

const shown = (text: string) => text.replace(/\s/g, ' ')
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ role: 'customer', user: { uid: 'c1' } }),
}))
const service = vi.hoisted(() => ({ loadCustomerUsage: vi.fn() }))
vi.mock('../../services/meterService', () => service)

const renderPage = () =>
  render(
    <MemoryRouter>
      <UsagePage />
    </MemoryRouter>,
  )

beforeEach(() => {
  service.loadCustomerUsage
    .mockReset()
    .mockResolvedValue({ meters: [meter], accounts: [account], readings })
})

describe('UsagePage', () => {
  it('shows each property with last period, average and history', async () => {
    renderPage()
    expect(
      await screen.findByRole('heading', { name: '14 Mahlangu Street, KaNyamazane' }),
    ).toBeInTheDocument()
    expect(service.loadCustomerUsage).toHaveBeenCalledWith('c1')
    expect(screen.getAllByText(shown(formatKl(15.2))).length).toBeGreaterThan(0)
    expect(screen.getByText(shown(`${formatKl(15.2)}/month`))).toBeInTheDocument()
    const history = within(screen.getByRole('table', { name: /Usage history/ }))
    expect(history.getAllByRole('row')).toHaveLength(3) // header + 2 periods (baseline excluded)
  })
  it('flags use well above average as a possible leak', async () => {
    service.loadCustomerUsage.mockResolvedValue({
      meters: [meter],
      accounts: [account],
      readings: [
        {
          ...readings[0],
          id: 'r4',
          readingValue: 1370.4,
          readingDate: { toDate: () => new Date('2026-09-24T10:00:00') },
        },
        ...readings,
      ],
    })
    renderPage()
    expect(await screen.findByText('Higher than usual: check for leaks')).toBeInTheDocument()
  })
  it('explains when no meter is linked yet', async () => {
    service.loadCustomerUsage.mockResolvedValue({ meters: [], accounts: [account], readings: [] })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'No meter linked yet' })).toBeInTheDocument()
  })
})
