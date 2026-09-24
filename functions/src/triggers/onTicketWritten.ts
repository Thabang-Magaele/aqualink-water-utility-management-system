/**
 * Creates in-app notifications whenever a ticket is created or changes.
 * Runs server-side, so notifications can't be forged from the browser
 * (the security rules forbid clients from creating them).
 */
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import { defineString } from 'firebase-functions/params'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { planTicketNotifications, type TicketSnapshot } from '../shared/ticketEvents'

/**
 * Firestore triggers must run in the same region as the database.
 * Set FIRESTORE_REGION in functions/.env (see functions/.env.example).
 */
const firestoreRegion = defineString('FIRESTORE_REGION', {
  default: 'us-central1',
  description: 'Location of your Firestore database, e.g. africa-south1 or nam5→us-central1',
})

async function deskStaffIds(): Promise<string[]> {
  const snap = await getFirestore()
    .collection('users')
    .where('role', 'in', ['call_centre', 'admin'])
    .get()
  return snap.docs.map((d) => d.id)
}

export const onTicketWritten = onDocumentWritten(
  { document: 'tickets/{ticketId}', region: firestoreRegion },
  async (event) => {
    const before = event.data?.before.exists ? (event.data.before.data() as TicketSnapshot) : null
    const after = event.data?.after.exists ? (event.data.after.data() as TicketSnapshot) : null
    const deskStaff = !before && after ? await deskStaffIds() : []
    const drafts = planTicketNotifications(event.params.ticketId, before, after, deskStaff)
    if (drafts.length === 0) return

    // IDs derived from the event, so a retried event overwrites instead of duplicating.
    const db = getFirestore()
    const batch = db.batch()
    drafts.forEach((draft, i) =>
      batch.set(db.doc(`notifications/${event.id}-${i}`), {
        ...draft,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      }),
    )
    await batch.commit()
    logger.info(`Ticket ${event.params.ticketId}: ${drafts.length} notification(s)`)
  },
)
