/**
 * Firestore queries behind the customer-management screens.
 *
 * Like dashboardQueries.ts, they take `db` as an argument so the security-rules
 * tests (tests/rules/customers.test.ts) run exactly these queries as each role.
 */
import { collection, doc, limit, orderBy, query, where, type Firestore } from 'firebase/firestore'
import type { Area } from '../types/models'
import type { Role } from '../types/user'
import { normalisePhone } from '../utils/validation'

/** The directory loads at most this many customers/accounts (client-side search). */
export const DIRECTORY_LIMIT = 500
/** Rows shown per history section on the customer page. */
export const HISTORY_LIMIT = 24

export const customerQueries = {
  allCustomers: (db: Firestore) => query(collection(db, 'customers'), limit(DIRECTORY_LIMIT)),
  allAccounts: (db: Firestore) => query(collection(db, 'accounts'), limit(DIRECTORY_LIMIT)),
  customer: (db: Firestore, customerId: string) => doc(db, 'customers', customerId),
  accounts: (db: Firestore, customerId: string) =>
    query(collection(db, 'accounts'), where('customerId', '==', customerId)),
  meters: (db: Firestore, customerId: string) =>
    query(collection(db, 'meters'), where('customerId', '==', customerId)),
  invoices: (db: Firestore, customerId: string) =>
    query(
      collection(db, 'invoices'),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc'),
      limit(HISTORY_LIMIT),
    ),
  payments: (db: Firestore, customerId: string) =>
    query(
      collection(db, 'payments'),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc'),
      limit(HISTORY_LIMIT),
    ),
  tickets: (db: Firestore, customerId: string) =>
    query(
      collection(db, 'tickets'),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc'),
      limit(HISTORY_LIMIT),
    ),
}

/** Which parts of the customer page a role sees. Mirrors firestore.rules (see docs/security.md). */
export interface CustomerSections {
  invoices: boolean
  payments: boolean
  tickets: boolean
  /** Edit name, contact details and address. */
  edit: boolean
}

export function customerSectionsFor(role: Role | null): CustomerSections {
  const is = (...roles: Role[]) => role !== null && roles.includes(role)
  return {
    invoices: is('admin', 'call_centre', 'billing'),
    payments: is('admin', 'billing'),
    tickets: is('admin', 'call_centre'),
    edit: is('admin', 'call_centre'),
  }
}

export interface CustomerDetailsInput {
  name: string
  email: string
  phone: string
  address: string
  area: Area
}

/** The exact update written to customers/{id}. `timestamp` is serverTimestamp(). */
export function customerUpdate(input: CustomerDetailsInput, timestamp: unknown) {
  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: normalisePhone(input.phone),
    address: input.address.trim(),
    area: input.area,
    updatedAt: timestamp,
  }
}
