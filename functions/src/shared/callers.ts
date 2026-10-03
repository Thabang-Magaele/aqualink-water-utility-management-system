import { getFirestore, type Transaction } from 'firebase-admin/firestore'
import type { Caller } from './http'

/** The name shown in ticket history for the person making a request. */
export async function callerName(caller: Caller, tx?: Transaction): Promise<string> {
  const ref = getFirestore().doc(`users/${caller.uid}`)
  const snap = tx ? await tx.get(ref) : await ref.get()
  return (
    (snap.get('displayName') as string) ||
    caller.token.name ||
    caller.token.email ||
    'AquaLink staff'
  )
}
