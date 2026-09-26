/**
 * Single Firebase initialisation module.
 * Every other file imports `auth`, `db` and `functions` from here,
 * so Firebase is configured exactly once.
 */
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
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
