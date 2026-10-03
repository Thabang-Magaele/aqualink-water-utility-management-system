import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../context/ToastProvider'
import type { Role } from '../../types/user'
import { notifications } from './fixtures'
import NotificationsPage from './NotificationsPage'

const auth = vi.hoisted(() => ({ role: 'customer' as Role }))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ role: auth.role, user: { uid: 'c1' } }),
}))
const service = vi.hoisted(() => ({
  subscribeMyNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  PAGE_LIMIT: 100,
}))
vi.mock('../../services/notificationService', () => service)

function Detail() {
  return <p>Detail {useParams().notificationId}</p>
}
function renderPage(role: Role = 'customer') {
  auth.role = role
  const base = role === 'customer' ? '/customer/notifications' : '/staff/notifications'
  return render(
    <MemoryRouter initialEntries={[base]}>
      <ToastProvider>
        <Routes>
          <Route path={base} element={<NotificationsPage />} />
          <Route path={`${base}/:notificationId`} element={<Detail />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}
const titles = () =>
  within(screen.getByRole('list', { name: 'Notifications' }))
    .getAllByRole('link')
    .map((l) => l.textContent)

beforeEach(() => {
  service.subscribeMyNotifications
    .mockReset()
    .mockImplementation(() => (onData: (d: unknown) => void) => {
      onData(notifications)
      return () => {}
    })
  service.markAllNotificationsRead.mockReset().mockResolvedValue(undefined)
})

describe('NotificationsPage', () => {
  it('lists every notification newest first, with unread ones announced as unread', async () => {
    renderPage()
    expect(await screen.findByRole('list', { name: 'Notifications' })).toBeInTheDocument()
    expect(service.subscribeMyNotifications).toHaveBeenCalledWith('c1', 100)
    expect(titles()).toHaveLength(4)
    expect(titles()[0]).toMatch(/^Unread: Ticket resolved/)
    expect(screen.getByRole('button', { name: /All/ })).toHaveTextContent('4')
    expect(screen.getByRole('button', { name: /Unread/ })).toHaveTextContent('2')
  })
  it('filters to unread, and by type', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /Unread/ }))
    expect(titles()).toHaveLength(2)
    await userEvent.selectOptions(screen.getByLabelText('Filter by type'), 'OUTAGE')
    expect(titles()).toEqual([expect.stringMatching(/^Unread: Water outage/)])
  })
  it('marks every unread notification as read', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /Mark all as read/ }))
    expect(service.markAllNotificationsRead).toHaveBeenCalledWith(['n1', 'n2'])
    expect(await screen.findByText('All caught up')).toBeInTheDocument()
  })
  it('opens a notification', async () => {
    renderPage()
    const list = await screen.findByRole('list', { name: 'Notifications' })
    await userEvent.click(within(list).getAllByRole('link')[0])
    expect(await screen.findByText('Detail n1')).toBeInTheDocument()
  })
  it('staff get the same page under /staff', async () => {
    renderPage('call_centre')
    const list = await screen.findByRole('list', { name: 'Notifications' })
    await userEvent.click(within(list).getAllByRole('link')[1])
    expect(await screen.findByText('Detail n2')).toBeInTheDocument()
  })
  it('says when there is nothing unread', async () => {
    service.subscribeMyNotifications.mockImplementation(() => (onData: (d: unknown) => void) => {
      onData(notifications.map((n) => ({ ...n, read: true })))
      return () => {}
    })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /Unread/ }))
    expect(screen.getByRole('heading', { name: 'You’re all caught up' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mark all as read/ })).toBeDisabled()
  })
})
