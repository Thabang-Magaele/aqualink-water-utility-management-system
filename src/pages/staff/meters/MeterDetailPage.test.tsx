import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../context/ToastProvider'
import { formatKl } from '../../../utils/format'
import MeterDetailPage from './MeterDetailPage'
import { account, meter, readings } from './fixtures'

const shown = (text: string) => text.replace(/\s/g, ' ')

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ role: 'billing', user: { uid: 'me' } }),
}))
const service = vi.hoisted(() => ({
  loadMeter: vi.fn(),
  recordReading: vi.fn(),
  setMeterStatus: vi.fn(),
}))
vi.mock('../../../services/meterService', () => service)
// The page's invoice card talks to the billing API; keep tests away from real Firebase
vi.mock('../../../services/billingService', () => ({ generateInvoice: vi.fn() }))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/staff/meters/m1']}>
      <ToastProvider>
        <Routes>
          <Route path="/staff/meters/:meterId" element={<MeterDetailPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}
const form = () =>
  within(screen.getByRole('heading', { name: 'Record a reading' }).closest('section')!)
async function enter(value: string, date?: string) {
  const f = form()
  await userEvent.clear(f.getByLabelText(/Reading on the dial/))
  await userEvent.type(f.getByLabelText(/Reading on the dial/), value)
  if (date) {
    await userEvent.clear(f.getByLabelText(/Date read/))
    await userEvent.type(f.getByLabelText(/Date read/), date)
  }
}

beforeEach(() => {
  service.loadMeter.mockReset().mockResolvedValue({ meter, account, readings })
  service.recordReading.mockReset().mockResolvedValue(undefined)
  service.setMeterStatus.mockReset().mockResolvedValue(undefined)
})

describe('MeterDetailPage', () => {
  it('shows the meter, its account, and consumption per period', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'MTR-223107', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '4100223107' })).toHaveAttribute(
      'href',
      '/staff/customers/c1?account=a1',
    )
    const summary = within(screen.getByRole('region', { name: 'Summary' }))
    expect(summary.getByText(shown(formatKl(1330.4)))).toBeInTheDocument()
    expect(summary.getByText(shown(`${formatKl(15.2)}/month`))).toBeInTheDocument()
    const table = within(screen.getByRole('table', { name: 'Readings' }))
    expect(table.getAllByText(shown(formatKl(15.2)))).toHaveLength(2)
    expect(table.getByText('Baseline')).toBeInTheDocument()
    expect(table.getByText('You')).toBeInTheDocument()
  })

  it('refuses a reading lower than the last one', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Record a reading' })
    await enter('1300')
    await userEvent.click(form().getByRole('button', { name: 'Save reading' }))
    expect(form().getByText(/Can’t be lower than the last reading/)).toBeInTheDocument()
    expect(service.recordReading).not.toHaveBeenCalled()
  })

  it('refuses a date before the last reading', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Record a reading' })
    await enter('1345.6', '2026-08-20')
    await userEvent.click(form().getByRole('button', { name: 'Save reading' }))
    expect(form().getByText(/Must be on or after the last reading/)).toBeInTheDocument()
    expect(service.recordReading).not.toHaveBeenCalled()
  })

  it('warns about unusually high use, then saves when confirmed', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Record a reading' })
    await enter('1480.4') // ~150 kL in a month: 10× normal, probably an extra digit
    await userEvent.click(form().getByRole('button', { name: 'Save reading' }))
    expect(form().getByRole('alert')).toHaveTextContent(/times this meter’s normal daily use/)
    expect(service.recordReading).not.toHaveBeenCalled()
    await userEvent.click(form().getByRole('button', { name: 'Save anyway' }))
    expect(service.recordReading).toHaveBeenCalledWith(meter, 1480.4, expect.any(Date), 'me')
  })

  it('saves a normal reading, confirms the use, and reloads', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Record a reading' })
    await enter('1345.6')
    await userEvent.click(form().getByRole('button', { name: 'Save reading' }))
    expect(service.recordReading).toHaveBeenCalledWith(meter, 1345.6, expect.any(Date), 'me')
    expect(await screen.findByText('Reading saved')).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(shown(formatKl(15.2)).replace('.', '\\.') + ' used since')),
    ).toBeInTheDocument()
    expect(service.loadMeter).toHaveBeenCalledTimes(2)
  })

  it('reports the use correctly even if the meter object is updated while saving', async () => {
    service.recordReading.mockImplementation(async (m: { lastReading: number }, value: number) => {
      m.lastReading = value // as a live listener or cache might
    })
    service.loadMeter.mockResolvedValue({ meter: { ...meter }, account, readings })
    renderPage()
    await screen.findByRole('heading', { name: 'Record a reading' })
    await enter('1345.6')
    await userEvent.click(form().getByRole('button', { name: 'Save reading' }))
    expect(
      await screen.findByText(
        new RegExp(shown(formatKl(15.2)).replace('.', '\\.') + ' used since'),
      ),
    ).toBeInTheDocument()
  })

  it('blocks readings on a faulty meter', async () => {
    service.loadMeter.mockResolvedValue({
      meter: { ...meter, status: 'FAULTY' },
      account,
      readings,
    })
    renderPage()
    expect(await screen.findByText(/marked faulty, so no new readings/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Reading on the dial/)).not.toBeInTheDocument()
  })

  it('offers billing for the meter’s account', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Invoice' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview invoice' })).toBeInTheDocument()
  })

  it('changes the meter status', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Meter status' })
    await userEvent.selectOptions(screen.getByLabelText('Meter status'), 'FAULTY')
    await userEvent.click(
      within(screen.getByRole('heading', { name: 'Meter status' }).closest('section')!).getByRole(
        'button',
        { name: 'Save' },
      ),
    )
    expect(service.setMeterStatus).toHaveBeenCalledWith('m1', 'FAULTY')
  })
})
