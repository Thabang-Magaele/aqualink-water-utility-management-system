import { collection, getDocsFromServer, limit, orderBy, query } from 'firebase/firestore'
import type { Role, UserProfile } from '../types/user'
import { apiPost } from './api'
import { db } from './firebase'

/** Admin only (enforced by Firestore rules). */
export async function listUsers(): Promise<UserProfile[]> {
  // Server only: offline must show an error, not "No users yet".
  const snap = await getDocsFromServer(
    query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(200)),
  )
  return snap.docs.map((d) => d.data() as UserProfile)
}

/** Admin only (enforced by the setUserRole Cloud Function). */
export async function setUserRole(uid: string, role: Role): Promise<void> {
  await apiPost('setUserRole', { uid, role })
}
