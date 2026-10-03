import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../context/ToastProvider'
import { notifications } from './fixtures'
import NotificationDetailPage from './NotificationDetailPage'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ role: 'customer', user: { uid: 'c1' } }),
}))
const service = vi.hoisted(() => ({
  loadNotification: vi.fn(),
  markNotificationRead: vi.fn(),
  markNotificationUnread: vi.fn(),
}))
vi.mock('../../services/notificationService', () => service)

const renderPage = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/customer/notifications/${id}`]}>
      <ToastProvider>
        <Routes>
          <Route
            path="/customer/notifications/:notificationId"
            element={<NotificationDetailPage />}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )

beforeEach(() => {
  service.loadNotification
    .mockReset()
    .mockImplementation(async (id: string) => notifications.find((n) => n.id === id) ?? null)
  service.markNotificationRead.mockReset().mockResolvedValue(undefined)
  service.markNotificationUnread.mockReset().mockResolvedValue(undefined)
})

describe('NotificationDetailPage', () => {
  it('shows the full message, marks it read, and links to the ticket', async () => {
    renderPage('n1')
    expect(
      await screen.findByRole('heading', { name: 'Ticket resolved', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Replaced a cracked coupling/)).toBeInTheDocument()
    expect(service.markNotificationRead).toHaveBeenCalledWith('n1')
    expect(screen.getByRole('link', { name: /Open the ticket/ })).toHaveAttribute(
      'href',
      '/customer/tickets/t1',
    )
  })
  it('does not re-mark a notification that is already read', async () => {
    renderPage('n3')
    await screen.findByRole('heading', { name: 'Payment received', level: 1 })
    expect(service.markNotificationRead).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: /Open the invoice/ })).toHaveAttribute(
      'href',
      '/customer/bills/i1',
    )
  })
  it('a notification without a link has no "open" button', async () => {
    renderPage('n4')
    await screen.findByRole('heading', { name: 'Welcome to AquaLink', level: 1 })
    expect(screen.queryByRole('link', { name: /^Open/ })).not.toBeInTheDocument()
  })
  it('can be marked unread again', async () => {
    renderPage('n3')
    await userEvent.click(await screen.findByRole('button', { name: 'Mark as unread' }))
    expect(service.markNotificationUnread).toHaveBeenCalledWith('n3')
    expect(screen.getByRole('button', { name: 'Marked as unread' })).toBeDisabled()
  })
  it("someone else's (or a missing) notification is simply not available", async () => {
    service.loadNotification.mockRejectedValue({ code: 'permission-denied' })
    renderPage('theirs')
    expect(
      await screen.findByRole('heading', { name: 'This notification isn’t available' }),
    ).toBeInTheDocument()
    service.loadNotification.mockResolvedValue(null)
  })
})
