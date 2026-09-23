/**
 * Reads and validates environment variables at start-up.
 * Vite only exposes variables prefixed with VITE_ to the browser.
 * Never put secrets (service-account keys, payment secrets, API tokens) in these.
 */

const REQUIRED_FIREBASE_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

type FirebaseEnvKey = (typeof REQUIRED_FIREBASE_KEYS)[number]

/** Names of required variables that are missing or empty. */
export const missingFirebaseEnv: FirebaseEnvKey[] = REQUIRED_FIREBASE_KEYS.filter(
  (key) => !import.meta.env[key]?.trim(),
)

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'

export const isDev = import.meta.env.DEV
