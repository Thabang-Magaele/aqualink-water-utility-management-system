/**
 * Single Firebase initialisation module.
 * Every other file imports `auth`, `db` and `functions` from here,
 * so Firebase is configured exactly once.
 */
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { firebaseConfig, useEmulators } from '../utils/env'

/** Must match the region in functions/src/index.ts. */
export const FUNCTIONS_REGION = 'us-central1'

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, FUNCTIONS_REGION)

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}

export type ConnectionStatus =
  | { state: 'connected'; projectId: string; detail: string }
  | { state: 'error'; projectId: string; detail: string }

/**
 * Development check that the app can reach Firestore.
 * It reads a document that the locked-down Phase 0 rules deny, so a
 * "permission-denied" reply proves two things: Firestore answered, and
 * the security rules are active.
 */
export async function checkFirebaseConnection(timeoutMs = 8000): Promise<ConnectionStatus> {
  const projectId = firebaseConfig.projectId
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), timeoutMs),
  )

  try {
    await Promise.race([getDoc(doc(db, '_health', 'ping')), timeout])
    return {
      state: 'error',
      projectId,
      detail: 'Firestore allowed an unauthenticated read. Check firestore.rules.',
    }
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'permission-denied') {
      return { state: 'connected', projectId, detail: 'Firestore reachable, rules enforced' }
    }
    if ((err as Error).message === 'timeout' || code === 'unavailable') {
      return {
        state: 'error',
        projectId,
        detail: 'Firestore did not respond. Check that the database exists and you are online.',
      }
    }
    return { state: 'error', projectId, detail: code ?? 'Unknown Firebase error' }
  }
}
