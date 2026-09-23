/**
 * AquaLink Cloud Functions entry point.
 *
 * Phase 0 contains a single health-check endpoint so the Functions
 * pipeline can be built, emulated and deployed before any features exist.
 * Privileged endpoints (assignTicket, payment, setUserRole, ...) arrive in later phases.
 *
 * Secrets (payment keys, messaging tokens) belong in Firebase secrets / env config
 * here on the server, never in the React app.
 */
import { initializeApp } from 'firebase-admin/app'
import { setGlobalOptions } from 'firebase-functions/v2'
import { onRequest } from 'firebase-functions/v2/https'

initializeApp()

// Keep in sync with FUNCTIONS_REGION in src/services/firebase.ts
setGlobalOptions({ region: 'us-central1', maxInstances: 10 })

export const health = onRequest((_req, res) => {
  res.status(200).json({
    success: true,
    message: 'AquaLink functions are running',
    data: { timestamp: new Date().toISOString() },
  })
})
