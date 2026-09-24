import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../context/ToastProvider'
import type { Ticket } from '../../../types/models'
import type { Role } from '../../../types/user'
import ReportIssuePage from '../../customer/ReportIssuePage'
import { accounts, history, inProgress, openTicket, resolved } from './fixtures'
import TicketDetailPage from './TicketDetailPage'
import TicketQueuePage from './TicketQueuePage'

vi.mock('firebase/firestore', () => ({ serverTimestamp: () => 'SERVER_TIME' }))

const auth = vi.hoisted(() => ({ role: 'call_centre' as Role, uid: 'cc1', name: 'Pieter Nel' }))
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    role: auth.role,
    user: { uid: auth.uid, displayName: auth.name, email: 'x@aqualink.demo' },
    profile: { displayName: auth.name },
  }),
}))

const live = vi.hoisted(() => ({ tickets: [] as Ticket[], ticket: null as Ticket | null }))
const service = vi.hoisted(() => ({
  applyTicketChange: vi.fn(),
  createTicket: vi.fn(),
  loadTechnicians: vi.fn(),
  loadAssets: vi.fn(),
  loadReporterContext: vi.fn(),
}))
vi.mock('../../../services/ticketService', () => ({
  ...service,
  subscribeQueue: (ok: (t: Ticket[]) => void) => (ok(live.tickets), () => {}),
  subscribeTechnicianJobs: () => (ok: (t: Ticket[]) => void) => (ok(live.tickets), () => {}),
  subscribeCustomerTickets: () => (ok: (t: Ticket[]) => void) => (ok(live.tickets), () => {}),
  subscribeTicket: () => (ok: (t: Ticket | null) => void) => (ok(live.ticket), () => {}),
  subscribeHistory: () => (ok: (h: typeof history) => void) => (ok(history), () => {}),
}))
vi.mock('../../../services/customerService', () => ({
  loadCustomerDirectory: vi.fn(),
  loadCustomer: vi.fn(),
}))

function as(role: Role, uid: string, name: string) {
  Object.assign(auth, { role, uid, name })
}
function renderAt(path: string) {
  function Landed() {
    return <p>Landed on {useParams().ticketId}</p>
  }
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/staff/tickets" element={<TicketQueuePage />} />
          <Route
            path="/staff/tickets/:ticketId"
            element={<TicketDetailPage section="/staff/tickets" />}
          />
          <Route
            path="/staff/field/:ticketId"
            element={<TicketDetailPage section="/staff/field" />}
          />
          <Route path="/customer/report" element={<ReportIssuePage />} />
          <Route path="/customer/tickets/:ticketId" element={<Landed />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
  live.tickets = [openTicket, inProgress, resolved]
  live.ticket = openTicket
  service.applyTicketChange.mockReset().mockResolvedValue(undefined)
  service.createTicket.mockReset().mockResolvedValue('new-ticket-id')
  service.loadTechnicians.mockReset().mockResolvedValue([
    { uid: 'tech1', name: 'Bongani Dube' },
    { uid: 'tech2', name: 'Lwazi Nkosi' },
  ])
  service.loadAssets.mockReset().mockResolvedValue([])
  service.loadReporterContext.mockReset().mockResolvedValue({ customer: null, accounts })
})

describe('Ticket queue', () => {
  it('opens on "Needs action" with counts per view, and flags unassigned tickets', async () => {
    as('call_centre', 'cc1', 'Pieter Nel')
    renderAt('/staff/tickets')
    const views = screen.getByRole('group', { name: 'Show tickets' })
    expect(within(views).getByRole('button', { name: /Needs action\s*1/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(views).getByRole('button', { name: /All\s*3/ })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Tickets' })
    expect(within(table).getByText('TKT-260924-A7K2')).toBeInTheDocument()
    expect(within(table).queryByText('TKT-260923-M3QP')).not.toBeInTheDocument()
    expect(within(table).getByText('Unassigned')).toBeInTheDocument()
  })

  it('switches views and searches by customer', async () => {
    as('call_centre', 'cc1', 'Pieter Nel')
    renderAt('/staff/tickets')
    await userEvent.click(screen.getByRole('button', { name: /^All/ }))
    await userEvent.type(screen.getByRole('searchbox'), 'sipho')
    const table = await screen.findByRole('table', { name: 'Tickets' })
    // The search waits 200 ms after typing stops, so wait for the other rows to go.
    await waitFor(() =>
      expect(within(table).queryByText('TKT-260924-A7K2')).not.toBeInTheDocument(),
    )
    expect(within(table).getByText('TKT-260923-M3QP')).toBeInTheDocument()
  })

  it('only the desk can log tickets', () => {
    as('asset_manager', 'am1', 'Sizwe')
    renderAt('/staff/tickets')
    expect(screen.queryByRole('button', { name: 'Log a ticket' })).not.toBeInTheDocument()
  })
})

describe('Ticket page: call centre', () => {
  it('assigns a technician: one change with a matching history entry', async () => {
    as('call_centre', 'cc1', 'Pieter Nel')
    renderAt('/staff/tickets/t1')
    expect(screen.getByRole('heading', { name: 'Leak: TKT-260924-A7K2' })).toBeInTheDocument()
    await userEvent.selectOptions(await screen.findByLabelText('Assign a technician'), 'tech1')
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }))
    expect(service.applyTicketChange).toHaveBeenCalledWith('t1', {
      update: {
        assignedTechnicianId: 'tech1',
        assignedTechnicianName: 'Bongani Dube',
        updatedAt: 'SERVER_TIME',
      },
      history: expect.objectContaining({
        note: 'Assigned to Bongani Dube.',
        changedBy: 'cc1',
        changedByName: 'Pieter Nel',
      }),
    })
    expect(await screen.findByText('Assigned to Bongani Dube')).toBeInTheDocument()
  })

  it('resolving requires a summary of the work', async () => {
    as('call_centre', 'cc1', 'Pieter Nel')
    renderAt('/staff/tickets/t1')
    await userEvent.click(screen.getByRole('button', { name: 'Mark as resolved' }))
    const dialog = screen.getByRole('dialog', { name: 'Mark as resolved' })
    await userEvent.type(within(dialog).getByLabelText(/What was done/), 'Fixed')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as resolved' }))
    expect(within(dialog).getByText('Write at least 10 characters.')).toBeInTheDocument()
    expect(service.applyTicketChange).not.toHaveBeenCalled()
    await userEvent.type(
      within(dialog).getByLabelText(/What was done/),
      ' the valve and the leak stopped.',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as resolved' }))
    expect(service.applyTicketChange).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        update: { status: 'RESOLVED', updatedAt: 'SERVER_TIME', resolvedAt: 'SERVER_TIME' },
        history: expect.objectContaining({
          fromStatus: 'OPEN',
          toStatus: 'RESOLVED',
          note: 'Fixed the valve and the leak stopped.',
        }),
      }),
    )
  })

  it('keeps the dialog open with a friendly message if the save is refused', async () => {
    service.applyTicketChange.mockRejectedValue({ code: 'permission-denied' })
    as('call_centre', 'cc1', 'Pieter Nel')
    renderAt('/staff/tickets/t1')
    await userEvent.click(screen.getByRole('button', { name: 'Add a note' }))
    const dialog = screen.getByRole('dialog', { name: 'Add a note' })
    await userEvent.type(within(dialog).getByLabelText(/Note/), 'Customer called again')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add note' }))
    expect(
      await within(dialog).findByText("You don't have access to this information."),
    ).toBeInTheDocument()
  })

  it('shows the history and links to the customer', () => {
    as('call_centre', 'cc1', 'Pieter Nel')
    renderAt('/staff/tickets/t1')
    expect(screen.getByText('Reported via the customer portal.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Thandi Mokoena' })).toHaveAttribute(
      'href',
      '/staff/customers/custA',
    )
  })
})

describe('Ticket page: technician', () => {
  it('on an assigned open job, offers only "Start work" and "Add a note"', async () => {
    live.ticket = {
      ...openTicket,
      assignedTechnicianId: 'tech1',
      assignedTechnicianName: 'Bongani Dube',
    }
    as('technician', 'tech1', 'Bongani Dube')
    renderAt('/staff/field/t1')
    const actions = within(screen.getByRole('heading', { name: 'Actions' }).closest('section')!)
    expect(actions.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Start work',
      'Add a note',
    ])
    await userEvent.click(actions.getByRole('button', { name: 'Start work' }))
    expect(service.applyTicketChange).toHaveBeenCalledWith('t1', {
      update: { status: 'IN_PROGRESS', updatedAt: 'SERVER_TIME', resolvedAt: null },
      history: expect.objectContaining({
        fromStatus: 'OPEN',
        toStatus: 'IN_PROGRESS',
        changedBy: 'tech1',
      }),
    })
  })

  it('in progress: can resolve; the customer is not a link (technicians can’t open customer records)', () => {
    live.ticket = inProgress
    as('technician', 'tech1', 'Bongani Dube')
    renderAt('/staff/field/t2')
    expect(screen.getByRole('button', { name: 'Mark as resolved' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start work' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sipho Dlamini' })).not.toBeInTheDocument()
  })

  it('another technician’s job has no actions at all', () => {
    live.ticket = inProgress
    as('technician', 'tech2', 'Lwazi Nkosi')
    renderAt('/staff/field/t2')
    expect(screen.queryByRole('heading', { name: 'Actions' })).not.toBeInTheDocument()
  })
})

describe('Customer: report a problem', () => {
  it('pre-fills the location from their property and submits the report', async () => {
    as('customer', 'custA', 'Thandi Mokoena')
    renderAt('/customer/report')
    const location = await screen.findByLabelText(/Exact location/)
    expect(location).toHaveValue('14 Mahlangu Street, KaNyamazane')
    await userEvent.selectOptions(screen.getByLabelText('Where is the problem?'), 'a2')
    expect(location).toHaveValue('3 Protea Close, Tekwane')
    expect(screen.getByLabelText('Area')).toHaveValue('Tekwane')

    await userEvent.click(screen.getByLabelText(/Serious/))
    await userEvent.type(
      screen.getByLabelText(/What can you see/),
      'Water running down the driveway.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }))
    expect(service.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'custA',
        accountId: 'a2',
        priority: 'HIGH',
        area: 'Tekwane',
        location: '3 Protea Close, Tekwane',
      }),
      { uid: 'custA', name: 'Thandi Mokoena', role: 'customer' },
    )
    expect(await screen.findByText('Landed on new-ticket-id')).toBeInTheDocument()
  })

  it('reports somewhere else without an account, and validates first', async () => {
    as('customer', 'custA', 'Thandi Mokoena')
    renderAt('/customer/report')
    await userEvent.selectOptions(
      await screen.findByLabelText('Where is the problem?'),
      'elsewhere',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }))
    expect(screen.getByText('Tell us where the problem is.')).toBeInTheDocument()
    expect(service.createTicket).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText(/Exact location/), 'Corner of Main and Kruger')
    await userEvent.type(
      screen.getByLabelText(/What can you see/),
      'Hydrant leaking onto the road.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }))
    expect(service.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: null, location: 'Corner of Main and Kruger' }),
      expect.anything(),
    )
  })
})

describe('Actions card layout', () => {
  it('has no separator line when only the bottom buttons are shown', () => {
    live.ticket = inProgress
    as('technician', 'tech1', 'Bongani Dube')
    renderAt('/staff/field/t2')
    const resolveButton = screen.getByRole('button', { name: 'Mark as resolved' })
    expect(resolveButton.parentElement).not.toHaveClass('border-t')
  })
})
