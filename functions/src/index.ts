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
import { onRequest } from 'firebase-functions/v2/https'
import { generateInvoice, runBilling } from './routes/billing'
import { publishOutage, sendNotification } from './routes/communications'
import { payment } from './routes/payment'
import { assignTicket, updateTicketStatus } from './routes/tickets'
import { setUserRole } from './routes/setUserRole'
import { sendSuccess } from './shared/http'
import { corsOrigins } from './shared/cors'
import { createApiHandler, type Route } from './shared/router'

export { onTicketWritten } from './triggers/onTicketWritten'
export { onOutageNoticeWritten, onWaterQualityTestWritten } from './triggers/onAlertsWritten'

initializeApp()

// Keep in sync with FUNCTIONS_REGION in src/services/firebase.ts
setGlobalOptions({ region: 'us-central1', maxInstances: 10 })

/** The REST API. Add new endpoints here (and to docs/api.md). */
const routes: Record<string, Route> = {
  setUserRole: { handler: setUserRole, roles: 'admin', summary: "Change a user's role." },
  assignTicket: {
    handler: assignTicket,
    roles: 'admin, call_centre',
    summary: 'Assign or reassign a ticket to a technician.',
  },
  updateTicketStatus: {
    handler: updateTicketStatus,
    roles: 'admin, call_centre, technician (own jobs)',
    summary: 'Escalate, start, resolve or reopen a ticket.',
  },
  generateInvoice: {
    handler: generateInvoice,
    roles: 'admin, billing',
    summary: "Invoice one account's new consumption.",
  },
  runBilling: {
    handler: runBilling,
    roles: 'admin, billing',
    summary: 'Invoice every account with new consumption.',
  },
  payment: {
    handler: payment,
    roles: 'customer (own invoices), admin, billing',
    summary: 'Pay an invoice by card, or record EFT or cash.',
  },
  publishOutage: {
    handler: publishOutage,
    roles: 'admin, communications',
    summary: 'Publish an outage notice (affected customers are notified).',
  },
  sendNotification: {
    handler: sendNotification,
    roles: 'admin, communications',
    summary: 'Send an in-app message to users or to an area.',
  },
}

export const api = onRequest({ cors: corsOrigins() }, createApiHandler(routes))

export const health = onRequest((_req, res) => {
  sendSuccess(res, 'AquaLink functions are running', { timestamp: new Date().toISOString() })
})

export { markOverdueInvoices } from './scheduled/markOverdueInvoices'
