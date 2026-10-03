/**
 * Writes outage and water-quality notifications (Admin SDK).
 * Notification IDs are fixed per notice/test, event and person, so a retried
 * trigger never sends anyone the same message twice.
 */
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import {
  outageMessage,
  WATER_ALERT_ROLES,
  waterAlertMessage,
  type OutageEvent,
  type OutageSnapshot,
  type WaterTestSnapshot,
} from './alerts'

interface Draft {
  id: string
  userId: string
  title: string
  message: string
  type: 'OUTAGE' | 'WATER_QUALITY'
  relatedId: string
  link: string | null
}

/** Creates the notifications that don't exist yet; returns how many were new. */
async function writeOnce(drafts: Draft[]): Promise<number> {
  const db = getFirestore()
  let created = 0
  for (let i = 0; i < drafts.length; i += 400) {
    const chunk = drafts.slice(i, i + 400)
    const refs = chunk.map((d) => db.doc(`notifications/${d.id}`))
    const existing = chunk.length ? await db.getAll(...refs) : []
    const batch = db.batch()
    chunk.forEach(({ id: _id, ...draft }, j) => {
      if (existing[j]?.exists) return
      batch.set(refs[j], { ...draft, read: false, createdAt: FieldValue.serverTimestamp() })
      created++
    })
    await batch.commit()
  }
  return created
}

/**
 * Customers with a property account in an affected area, who have a login.
 * One notification per customer even if several of their properties are affected.
 */
export async function outageRecipients(areas: string[]): Promise<string[]> {
  if (areas.length === 0) return []
  const db = getFirestore()
  const accounts = await db.collection('accounts').where('area', 'in', areas.slice(0, 30)).get()
  const customerIds = [
    ...new Set(
      accounts.docs
        .filter((a) => a.get('status') !== 'CLOSED')
        .map((a) => a.get('customerId') as string),
    ),
  ]
  if (customerIds.length === 0) return []
  // Only people who can sign in can read a notification
  const users = await db.getAll(...customerIds.map((id) => db.doc(`users/${id}`)))
  return users.filter((u) => u.exists).map((u) => u.id)
}

export async function notifyOutage(
  noticeId: string,
  event: OutageEvent,
  notice: OutageSnapshot,
): Promise<number> {
  const { title, message } = outageMessage(event, notice)
  const recipients = await outageRecipients(notice.affectedAreas)
  return writeOnce(
    recipients.map((userId) => ({
      id: `outage-${noticeId}-${event}-${userId}`,
      userId,
      title,
      message,
      type: 'OUTAGE',
      relatedId: noticeId,
      link: '/customer',
    })),
  )
}

export async function notifyWaterAlert(testId: string, test: WaterTestSnapshot): Promise<number> {
  const { title, message } = waterAlertMessage(test)
  const staff = await getFirestore()
    .collection('users')
    .where('role', 'in', [...WATER_ALERT_ROLES])
    .get()
  return writeOnce(
    staff.docs.map((u) => ({
      id: `wq-${testId}-${u.id}`,
      userId: u.id,
      title,
      message,
      type: 'WATER_QUALITY',
      relatedId: testId,
      link: '/staff/water-quality',
    })),
  )
}
