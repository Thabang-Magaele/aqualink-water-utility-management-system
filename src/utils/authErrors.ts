import { FirebaseError } from 'firebase/app'

/**
 * Turns Firebase Auth error codes into messages a customer can act on.
 * Raw codes and stack traces are never shown in the UI.
 */
const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Contact Silulumanzi for help.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Choose a password with at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes, then try again.',
  'auth/network-request-failed': 'No connection to AquaLink. Check your internet and try again.',
  'auth/operation-not-allowed':
    'Email sign-in is turned off for this project. Enable Email/Password in the Firebase console.',
  'permission-denied': 'You do not have permission to do that.',
  unavailable: 'AquaLink could not reach the server. Check your connection and try again.',
}

export function authErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError && MESSAGES[error.code]) {
    return MESSAGES[error.code]
  }
  if (import.meta.env.DEV) console.error(error)
  return 'Something went wrong. Try again.'
}
