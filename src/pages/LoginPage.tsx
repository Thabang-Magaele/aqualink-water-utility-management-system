import { LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Alert from '../components/Alert'
import Button from '../components/Button'
import FormInput from '../components/FormInput'
import { useAuth } from '../hooks/useAuth'
import AuthLayout from '../layouts/AuthLayout'
import { authErrorMessage } from '../utils/authErrors'
import { validateEmail } from '../utils/validation'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string | null
    password?: string | null
  }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = {
      email: validateEmail(email),
      password: password ? null : 'Enter your password.',
    }
    setFieldErrors(errors)
    setFormError(null)
    if (errors.email || errors.password) return

    setSubmitting(true)
    try {
      await signIn(email, password)
      // GuestRoute redirects once the auth state updates.
    } catch (error) {
      setFormError(authErrorMessage(error))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
      <p className="text-ink/70 mt-2 text-sm">
        Customers and Silulumanzi staff use the same sign-in. You will see the tools for your role.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <FormInput
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <FormInput
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <Button
          type="submit"
          loading={submitting}
          icon={<LogIn className="size-4" aria-hidden="true" />}
          className="w-full"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="text-ink/70 mt-6 text-sm">
        New customer?{' '}
        <Link
          to="/register"
          className="text-channel font-semibold underline-offset-2 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
