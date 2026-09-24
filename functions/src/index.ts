/**
 * AquaLink Cloud Functions entry point.
 *
 * `api` is a single HTTPS function with a small router, reached at
 *   https://<region>-<project>.cloudfunctions.net/api/<endpoint>
 * or, once deployed with Hosting, at /api/<endpoint> on the site itself.
 *
 * Every endpoint: verifies the ID token → checks the role → validates input
 * → does the work → returns { success, message, data }.
 *
 * Secrets (payment keys, messaging tokens) belong in Firebase secrets here on
 * the server, never in the React app.
 */
import { initializeApp } from 'firebase-admin/app'
import { setGlobalOptions } from 'firebase-functions/v2'
import * as logger from 'firebase-functions/logger'
import { onRequest } from 'firebase-functions/v2/https'
import { setUserRole } from './routes/setUserRole'
import { authenticate, HttpError, sendError, sendSuccess, type Handler } from './shared/http'

export { onTicketWritten } from './triggers/onTicketWritten'

initializeApp()

// Keep in sync with FUNCTIONS_REGION in src/services/firebase.ts
setGlobalOptions({ region: 'us-central1', maxInstances: 10 })

/** Browsers allowed to call the API directly (dev server and Firebase Hosting). */
const CORS_ORIGINS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /\.web\.app$/,
  /\.firebaseapp\.com$/,
]

/** POST endpoints. Add new ones here. */
const routes: Record<string, Handler> = {
  setUserRole,
}

export const api = onRequest({ cors: CORS_ORIGINS }, async (req, res) => {
  // Works for both /setUserRole (direct URL) and /api/setUserRole (Hosting rewrite).
  const endpoint = req.path.replace(/^\/(api\/)?/, '').replace(/\/$/, '')
  const handler = routes[endpoint]

  if (!handler) return sendError(res, 404, 'Unknown endpoint.')
  if (req.method !== 'POST') return sendError(res, 405, 'Use POST for this endpoint.')

  try {
    const caller = await authenticate(req)
    await handler(req, res, caller)
  } catch (error) {
    if (error instanceof HttpError) return sendError(res, error.status, error.message)
    logger.error(`api/${endpoint} failed`, error)
    sendError(res, 500, 'Something went wrong on the server. Try again.')
  }
})

export const health = onRequest((_req, res) => {
  sendSuccess(res, 'AquaLink functions are running', { timestamp: new Date().toISOString() })
})
