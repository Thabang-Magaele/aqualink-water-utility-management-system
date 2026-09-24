/**
 * Firestore queries for the ticket workflow. They take `db` so the rules tests
 * run exactly these queries as each role.
 */
import { collection, doc, limit, orderBy, query, where, type Firestore } from 'firebase/firestore'

/** Tickets loaded into the call-centre queue (newest first; filtered in the browser). */
export const QUEUE_LIMIT = 200

export const ticketQueries = {
  queue: (db: Firestore) =>
    query(collection(db, 'tickets'), orderBy('createdAt', 'desc'), limit(QUEUE_LIMIT)),
  forCustomer: (db: Firestore, uid: string) =>
    query(collection(db, 'tickets'), where('customerId', '==', uid), orderBy('createdAt', 'desc')),
  forTechnician: (db: Firestore, uid: string) =>
    query(
      collection(db, 'tickets'),
      where('assignedTechnicianId', '==', uid),
      orderBy('updatedAt', 'desc'),
    ),
  ticket: (db: Firestore, id: string) => doc(db, 'tickets', id),
  history: (db: Firestore, id: string) =>
    query(collection(db, 'tickets', id, 'ticketHistory'), orderBy('createdAt', 'asc')),
  technicians: (db: Firestore) => query(collection(db, 'users'), where('role', '==', 'technician')),
  assets: (db: Firestore) => query(collection(db, 'assets'), orderBy('name', 'asc')),
  customerProfile: (db: Firestore, uid: string) => doc(db, 'customers', uid),
  customerAccounts: (db: Firestore, uid: string) =>
    query(collection(db, 'accounts'), where('customerId', '==', uid)),
}
