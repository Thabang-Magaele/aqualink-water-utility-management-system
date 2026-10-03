/** Publishing outage notices and sending in-app messages (Admin SDK). */
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { outageRecipients, writeOnce } from './alertStore'
import { HttpError, type Caller } from './http'
import type { parseOutage } from './outageRules'

/**
 * Creates the notice; the onOutageNoticeWritten trigger then tells affected customers.
 * The idempotency key fixes the document ID, so a retried request can't publish twice.
 */
export async function publishOutage(
  notice: ReturnType<typeof parseOutage>,
  key: string,
  caller: Caller,
) {
  const ref = getFirestore().doc(`outageNotices/outage-${key}`)
  try {
    await ref.create({
      ...notice,
      startTime: Timestamp.fromDate(notice.startTime),
      expectedResolution: notice.expectedResolution
        ? Timestamp.fromDate(notice.expectedResolution)
        : null,
      createdBy: caller.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    return { noticeId: ref.id, repeated: false }
  } catch (error) {
    if ((error as { code?: number }).code === 6) return { noticeId: ref.id, repeated: true } // ALREADY_EXISTS
    throw error
  }
}

export const MAX_DIRECT_RECIPIENTS = 500

/** Sends one message to named users, or to every customer with a property in some areas. */
export async function sendNotification(
  input: {
    key: string
    title: string
    message: string
    link: string | null
    userIds: string[] | null
    areas: string[] | null
  },
  caller: Caller,
) {
  const db = getFirestore()
  let recipients: string[]
  if (input.userIds) {
    const unique = [...new Set(input.userIds)]
    const users = unique.length ? await db.getAll(...unique.map((u) => db.doc(`users/${u}`))) : []
    const missing = users.filter((u) => !u.exists).map((u) => u.id)
    if (missing.length)
      throw new HttpError(
        404,
        `No such user(s): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`,
      )
    recipients = unique
  } else {
    recipients = await outageRecipients(input.areas!)
  }
  const sent = await writeOnce(
    recipients.map((userId) => ({
      id: `msg-${input.key}-${userId}`,
      userId,
      title: input.title,
      message: input.message,
      type: 'SYSTEM' as const,
      relatedId: null as unknown as string,
      link: input.link,
    })),
  )
  return { recipients: recipients.length, sent, sentBy: caller.uid }
}
