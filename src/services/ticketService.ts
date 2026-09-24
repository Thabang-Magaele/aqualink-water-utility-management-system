/**
 * Firestore side of the ticket workflow. Lists and tickets are live
 * (onSnapshot), so the call centre sees new reports and customers see
 * status changes without refreshing.
 */
import {
  getDocFromServer,
  getDocsFromServer,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  collection,
  doc,
  type DocumentSnapshot,
  type Query,
} from 'firebase/firestore'
import type { Subscribe } from '../hooks/useSubscription'
import type { Account, Asset, Customer, Ticket, TicketHistoryEntry } from '../types/models'
import { newTicket, type Actor, type NewTicketInput, type TicketChange } from './ticketActions'
import { ticketQueries } from './ticketQueries'
import { db } from './firebase'

// Pending server timestamps read as an estimate instead of null, so new
// entries sort correctly the moment they're written.
const read = <T>(snap: DocumentSnapshot) =>
  ({ id: snap.id, ...snap.data({ serverTimestamps: 'estimate' }) }) as T

function liveList<T>(q: Query): Subscribe<T[]> {
  return (onData, onError) =>
    onSnapshot(q, (snap) => onData(snap.docs.map((d) => read<T>(d))), onError)
}

export const subscribeQueue = liveList<Ticket>(ticketQueries.queue(db))
export const subscribeCustomerTickets = (uid: string) =>
  liveList<Ticket>(ticketQueries.forCustomer(db, uid))
export const subscribeTechnicianJobs = (uid: string) =>
  liveList<Ticket>(ticketQueries.forTechnician(db, uid))
export const subscribeHistory = (ticketId: string) =>
  liveList<TicketHistoryEntry>(ticketQueries.history(db, ticketId))

/** The ticket, or null if it doesn't exist (or was deleted). */
export function subscribeTicket(ticketId: string): Subscribe<Ticket | null> {
  return (onData, onError) =>
    onSnapshot(
      ticketQueries.ticket(db, ticketId),
      (snap) => onData(snap.exists() ? read<Ticket>(snap) : null),
      onError,
    )
}

/** Creates the ticket and its first history entry together. Returns the new ticket's id. */
export async function createTicket(input: NewTicketInput, actor: Actor): Promise<string> {
  const ref = doc(collection(db, 'tickets'))
  const { ticket, history } = newTicket(input, actor, serverTimestamp())
  const batch = writeBatch(db)
  batch.set(ref, ticket)
  batch.set(doc(collection(ref, 'ticketHistory')), history)
  await batch.commit()
  return ref.id
}

/** Writes an action from ticketActions.ts: the ticket update and its history entry, atomically. */
export async function applyTicketChange(ticketId: string, change: TicketChange): Promise<void> {
  const ref = ticketQueries.ticket(db, ticketId)
  const batch = writeBatch(db)
  if (change.update) batch.update(ref, change.update)
  if (change.history) batch.set(doc(collection(ref, 'ticketHistory')), change.history)
  await batch.commit()
}

export interface Technician {
  uid: string
  name: string
}

export async function loadTechnicians(): Promise<Technician[]> {
  const snap = await getDocsFromServer(ticketQueries.technicians(db))
  return snap.docs
    .map((d) => ({
      uid: d.id,
      name: (d.data().displayName as string) || (d.data().email as string),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function loadAssets(): Promise<Asset[]> {
  const snap = await getDocsFromServer(ticketQueries.assets(db))
  return snap.docs.map((d) => read<Asset>(d))
}

export interface ReporterContext {
  customer: Customer | null
  accounts: Account[]
}

/** The signed-in customer's record and accounts, for the report form. */
export async function loadReporterContext(uid: string): Promise<ReporterContext> {
  const [customer, accounts] = await Promise.all([
    getDocFromServer(ticketQueries.customerProfile(db, uid)),
    getDocsFromServer(ticketQueries.customerAccounts(db, uid)),
  ])
  return {
    customer: customer.exists() ? read<Customer>(customer) : null,
    accounts: accounts.docs
      .map((d) => read<Account>(d))
      .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)),
  }
}
