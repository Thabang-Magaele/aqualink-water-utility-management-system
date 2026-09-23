/**
 * Typed access to every Firestore collection.
 *
 *   import { collections } from './firestore'
 *   const snap = await getDocs(query(collections.tickets, where('status', '==', 'OPEN')))
 *   snap.docs.map((d) => d.data())   // Ticket[] with `id` filled in
 *
 * Feature services (ticketService, billingService…) build on these in later phases.
 */
import {
  collection,
  doc,
  type CollectionReference,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import type {
  Account,
  Asset,
  AuditLog,
  Customer,
  Invoice,
  Meter,
  Notification,
  OutageNotice,
  Payment,
  Reading,
  Ticket,
  TicketHistoryEntry,
  WaterQualityTest,
} from '../types/models'
import type { UserProfile } from '../types/user'
import { db } from './firebase'

/** Adds the document ID as `id` on read and removes it on write. */
function converter<T extends { id: string }>(): FirestoreDataConverter<T, DocumentData> {
  return {
    toFirestore(model) {
      const { id, ...data } = model as T
      return data
    },
    fromFirestore(snapshot: QueryDocumentSnapshot) {
      return { id: snapshot.id, ...snapshot.data() } as T
    },
  }
}

function typed<T extends { id: string }>(path: string): CollectionReference<T> {
  return collection(db, path).withConverter(converter<T>())
}

export const collections = {
  customers: typed<Customer>('customers'),
  accounts: typed<Account>('accounts'),
  meters: typed<Meter>('meters'),
  readings: typed<Reading>('readings'),
  invoices: typed<Invoice>('invoices'),
  payments: typed<Payment>('payments'),
  tickets: typed<Ticket>('tickets'),
  assets: typed<Asset>('assets'),
  waterQualityTests: typed<WaterQualityTest>('waterQualityTests'),
  notifications: typed<Notification>('notifications'),
  outageNotices: typed<OutageNotice>('outageNotices'),
  auditLogs: typed<AuditLog>('auditLogs'),
}

/** users/{uid} profiles are keyed by uid and don't carry an `id` field. */
export const usersCollection = collection(db, 'users') as CollectionReference<UserProfile>

/** tickets/{ticketId}/ticketHistory */
export function ticketHistory(ticketId: string): CollectionReference<TicketHistoryEntry> {
  return typed<TicketHistoryEntry>(`tickets/${ticketId}/ticketHistory`)
}

/** Typed reference to one document, e.g. docRef(collections.tickets, id). */
export function docRef<T>(col: CollectionReference<T>, id: string) {
  return doc(col, id)
}

/** Shape for creating a document: everything except the generated `id`. */
export type NewDoc<T extends { id: string }> = Omit<T, 'id'>
