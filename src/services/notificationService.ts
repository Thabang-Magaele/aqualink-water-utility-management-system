/** The signed-in user's in-app notifications (created server-side by Cloud Functions). */
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { Subscribe } from '../hooks/useSubscription'
import type { Notification } from '../types/models'
import { db } from './firebase'

export const BELL_LIMIT = 15

export function subscribeMyNotifications(uid: string): Subscribe<Notification[]> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(BELL_LIMIT),
  )
  return (onData, onError) =>
    onSnapshot(
      q,
      (snap) =>
        onData(
          snap.docs.map(
            (d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as Notification,
          ),
        ),
      onError,
    )
}

export function markNotificationRead(id: string): Promise<void> {
  return updateDoc(doc(db, 'notifications', id), { read: true })
}

export async function markAllNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return
  const batch = writeBatch(db)
  for (const id of ids) batch.update(doc(db, 'notifications', id), { read: true })
  await batch.commit()
}
