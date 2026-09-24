/**
 * Loads and updates customer data for the staff screens.
 * Reads come from the server only (never the offline cache), so a failed
 * connection shows an error instead of an empty list.
 */
import {
  getDocFromServer,
  getDocsFromServer,
  serverTimestamp,
  updateDoc,
  type Query,
} from 'firebase/firestore'
import type { Account, Customer, Invoice, Meter, Payment, Ticket } from '../types/models'
import {
  accountRows,
  summariseCustomers,
  type AccountRow,
  type CustomerSummary,
} from '../utils/customerSearch'
import {
  customerQueries,
  customerUpdate,
  DIRECTORY_LIMIT,
  type CustomerDetailsInput,
} from './customerQueries'
import { db } from './firebase'

async function rows<T>(q: Query): Promise<T[]> {
  const snap = await getDocsFromServer(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)
}

export interface CustomerDirectory {
  customers: CustomerSummary[]
  accounts: AccountRow[]
  /** True if the directory hit DIRECTORY_LIMIT and some records aren't shown. */
  truncated: boolean
}

/** Every customer and account (up to DIRECTORY_LIMIT), joined for searching. */
export async function loadCustomerDirectory(): Promise<CustomerDirectory> {
  const [customers, accounts] = await Promise.all([
    rows<Customer>(customerQueries.allCustomers(db)),
    rows<Account>(customerQueries.allAccounts(db)),
  ])
  return {
    customers: summariseCustomers(customers, accounts),
    accounts: accountRows(customers, accounts),
    truncated: customers.length >= DIRECTORY_LIMIT || accounts.length >= DIRECTORY_LIMIT,
  }
}

export interface CustomerDetail {
  customer: Customer | null
  accounts: Account[]
  meters: Meter[]
}

/** The customer with their accounts and meters. `customer` is null if not found. */
export async function loadCustomer(customerId: string): Promise<CustomerDetail> {
  const [snap, accounts, meters] = await Promise.all([
    getDocFromServer(customerQueries.customer(db, customerId)),
    rows<Account>(customerQueries.accounts(db, customerId)),
    rows<Meter>(customerQueries.meters(db, customerId)),
  ])
  return {
    customer: snap.exists() ? ({ id: snap.id, ...snap.data() } as Customer) : null,
    accounts: accounts.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)),
    meters,
  }
}

export const loadCustomerInvoices = (id: string) => rows<Invoice>(customerQueries.invoices(db, id))
export const loadCustomerPayments = (id: string) => rows<Payment>(customerQueries.payments(db, id))
export const loadCustomerTickets = (id: string) => rows<Ticket>(customerQueries.tickets(db, id))

/** Call centre / admin: update contact details. Validated again by the security rules. */
export async function updateCustomerDetails(
  customerId: string,
  input: CustomerDetailsInput,
): Promise<void> {
  await updateDoc(
    customerQueries.customer(db, customerId),
    customerUpdate(input, serverTimestamp()),
  )
}
