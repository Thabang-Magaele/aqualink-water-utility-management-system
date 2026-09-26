/**
 * Every night, marks unpaid invoices whose due date has passed as OVERDUE and
 * tells the customer. Notification IDs are derived from the invoice, so a
 * retried run doesn't send the same message twice.
 */
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { BILLING_TIME_ZONE, invoiceNotification, overdueInvoices } from '../shared/billing'

const BATCH_LIMIT = 200 // each invoice is 2 writes; a batch allows 500

export async function markOverdue(now = new Date()): Promise<number> {
  const db = getFirestore()
  const snap = await db
    .collection('invoices')
    .where('status', '==', 'UNPAID')
    .where('dueDate', '<', Timestamp.fromDate(now))
    .limit(BATCH_LIMIT)
    .get()
  const due = overdueInvoices(
    snap.docs.map((d) => ({
      id: d.id,
      status: d.get('status'),
      dueDate: (d.get('dueDate') as Timestamp).toDate(),
      doc: d,
    })),
    now,
  )
  if (due.length === 0) return 0

  const batch = db.batch()
  for (const { id, dueDate, doc } of due) {
    batch.update(doc.ref, { status: 'OVERDUE' })
    batch.set(db.doc(`notifications/overdue-${id}`), {
      ...invoiceNotification('overdue', {
        id,
        customerId: doc.get('customerId'),
        invoiceNumber: doc.get('invoiceNumber'),
        amount: doc.get('amount'),
        dueDate,
      }),
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()
  return due.length
}

export const markOverdueInvoices = onSchedule(
  { schedule: 'every day 01:00', timeZone: BILLING_TIME_ZONE },
  async () => {
    const count = await markOverdue()
    logger.info(`Marked ${count} invoice(s) overdue`)
  },
)
