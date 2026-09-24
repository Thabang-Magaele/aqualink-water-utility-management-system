/**
 * One friendly message for any failed Firestore/Firebase call.
 * Raw codes and stack traces never reach the screen (logged in development only).
 */
export function friendlyError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  switch (code) {
    case 'permission-denied':
      return "You don't have access to this information."
    case 'unavailable':
      return 'Offline. Check your connection and try again.'
    case 'failed-precondition':
      return 'The database index is still being built. Try again in a few minutes.'
    case 'not-found':
      return 'That record no longer exists.'
    case 'deadline-exceeded':
      return 'The server took too long to respond. Try again.'
  }
  if (import.meta.env.DEV) console.error(error)
  return 'Something went wrong. Try again.'
}
