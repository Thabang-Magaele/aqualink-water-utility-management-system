/** Shared form validation used by the auth forms (and reusable later). */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// South African numbers: 0XX XXX XXXX or +27 XX XXX XXXX (spaces optional)
const PHONE_PATTERN = /^(\+27|0)\d{9}$/

export const PASSWORD_MIN_LENGTH = 8

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address.'
  return null
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Enter a password.'
  if (password.length < PASSWORD_MIN_LENGTH)
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`
  return null
}

export function validateName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Enter your full name.'
  if (trimmed.length > 100) return 'Name must be 100 characters or fewer.'
  return null
}

/** Phone is optional; when present it must be a valid SA number. */
export function validatePhone(phone: string): string | null {
  const compact = phone.replace(/\s/g, '')
  if (!compact) return null
  if (!PHONE_PATTERN.test(compact)) return 'Enter a South African number, e.g. 082 123 4567.'
  return null
}

export function normalisePhone(phone: string): string {
  return phone.replace(/\s/g, '')
}
