import { UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Alert from '../components/Alert'
import Button from '../components/Button'
import { FormInput } from '../components/FormField'
import { useAuth } from '../hooks/useAuth'
import AuthLayout from '../layouts/AuthLayout'
import { authErrorMessage } from '../utils/authErrors'
import {
  PASSWORD_MIN_LENGTH,
  validateEmail,
  validateName,
  validatePassword,
  validatePhone,
} from '../utils/validation'

type Field = 'displayName' | 'email' | 'phone' | 'password' | 'confirm'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState<Record<Field, string>>({
    displayName: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  })
  const [errors, setErrors] = useState<Partial<Record<Field, string | null>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (field: Field) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = {
      displayName: validateName(values.displayName),
      email: validateEmail(values.email),
      phone: validatePhone(values.phone),
      password: validatePassword(values.password),
      confirm: values.confirm === values.password ? null : 'Passwords do not match.',
    }
    setErrors(next)
    setFormError(null)
    if (Object.values(next).some(Boolean)) return

    setSubmitting(true)
    try {
      await register(values)
      navigate('/app', { replace: true })
    } catch (error) {
      setFormError(authErrorMessage(error))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-bold tracking-tight">Create a customer account</h2>
      <p className="text-ink/70 mt-2 text-sm">
        Staff accounts are set up by an AquaLink administrator.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <FormInput
          label="Full name"
          autoComplete="name"
          value={values.displayName}
          onChange={update('displayName')}
          error={errors.displayName}
        />
        <FormInput
          label="Email address"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={update('email')}
          error={errors.email}
        />
        <FormInput
          label="Mobile number (optional)"
          type="tel"
          autoComplete="tel"
          hint="For SMS updates about outages and repairs."
          value={values.phone}
          onChange={update('phone')}
          error={errors.phone}
        />
        <FormInput
          label="Password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          value={values.password}
          onChange={update('password')}
          error={errors.password}
        />
        <FormInput
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={values.confirm}
          onChange={update('confirm')}
          error={errors.confirm}
        />
        <Button
          type="submit"
          loading={submitting}
          icon={<UserPlus className="size-4" aria-hidden="true" />}
          className="w-full"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="text-ink/70 mt-6 text-sm">
        Already have an account?{' '}
        <Link to="/login" className="text-channel font-semibold underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
