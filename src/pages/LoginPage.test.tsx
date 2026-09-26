import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage'

const auth = vi.hoisted(() => ({ signIn: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => auth }))
vi.mock('../layouts/AuthLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const renderPage = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
async function signInWith(tick: boolean) {
  await userEvent.type(screen.getByLabelText('Email address'), 'customer@aqualink.demo')
  await userEvent.type(screen.getByLabelText('Password'), 'customer@123')
  if (tick) await userEvent.click(screen.getByLabelText(/Keep me signed in/))
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

beforeEach(() => auth.signIn.mockReset().mockResolvedValue(undefined))

describe('LoginPage', () => {
  it('starts with empty fields and "Keep me signed in" unticked', () => {
    renderPage()
    expect(screen.getByLabelText('Email address')).toHaveValue('')
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(screen.getByLabelText(/Keep me signed in/)).not.toBeChecked()
  })
  it('signs in for this tab only by default', async () => {
    renderPage()
    await signInWith(false)
    expect(auth.signIn).toHaveBeenCalledWith('customer@aqualink.demo', 'customer@123', false)
  })
  it('remembers the device when ticked', async () => {
    renderPage()
    await signInWith(true)
    expect(auth.signIn).toHaveBeenCalledWith('customer@aqualink.demo', 'customer@123', true)
  })
  it('shows no developer or connection details', () => {
    renderPage()
    expect(screen.queryByText(/connected|Firestore|project/i)).not.toBeInTheDocument()
  })
})
