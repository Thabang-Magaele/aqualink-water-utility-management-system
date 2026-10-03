/** The signed-in user's in-app notifications (created server-side by Cloud Functions). */
import {
  collection,
  doc,
  getDocFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type QuerySnapshot,
} from 'firebase/firestore'
import type { Subscribe } from '../hooks/useSubscription'
import type { Notification } from '../types/models'
import { db } from './firebase'
import { serverConfirmed } from './live'

export const BELL_LIMIT = 15
/** The Notifications page shows this many of the newest. */
export const PAGE_LIMIT = 100

export function subscribeMyNotifications(uid: string, max = BELL_LIMIT): Subscribe<Notification[]> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(max),
  )
  // Offline, an empty cache must not read as "You're all caught up".
  return serverConfirmed<QuerySnapshot, Notification[]>(
    (next, fail) => onSnapshot(q, { includeMetadataChanges: true }, next, fail),
    (snap) => snap.empty,
    (snap) =>
      snap.docs.map(
        (d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as Notification,
      ),
  )
}

export function markNotificationRead(id: string): Promise<void> {
  return updateDoc(doc(db, 'notifications', id), { read: true })
}

export function markNotificationUnread(id: string): Promise<void> {
  return updateDoc(doc(db, 'notifications', id), { read: false })
}

/** One notification (the rules only return it to its recipient). Null if it doesn't exist. */
export async function loadNotification(id: string): Promise<Notification | null> {
  const snap = await getDocFromServer(doc(db, 'notifications', id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Notification) : null
}

export async function markAllNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return
  const batch = writeBatch(db)
  for (const id of ids) batch.update(doc(db, 'notifications', id), { read: true })
  await batch.commit()
}
