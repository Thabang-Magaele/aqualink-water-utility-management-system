/**
 * Billing data for the staff Billing page, invoice pages and the customer's Bills page.
 * Reads are server-only; invoice generation goes through the api Cloud Function.
 */
import {
  doc,
  getDocFromServer,
  getDocsFromServer,
  serverTimestamp,
  setDoc,
  type Query,
} from 'firebase/firestore'
import type { Account, BillingSettings, Customer, Invoice } from '../types/models'
import { apiPost } from './api'
import {
  billingQueries,
  DEFAULT_BILLING,
  settingsPayload,
  type TariffInput,
} from './billingQueries'
import { customerQueries } from './customerQueries'
import { db } from './firebase'

async function rows<T>(q: Query): Promise<T[]> {
  const snap = await getDocsFromServer(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)
}

/** The current tariff, or the defaults if none has been saved yet. */
export async function loadBillingSettings(): Promise<BillingSettings> {
  const snap = await getDocFromServer(billingQueries.settings(db))
  return snap.exists()
    ? (snap.data() as BillingSettings)
    : { ...DEFAULT_BILLING, updatedAt: null, updatedBy: null }
}

export async function saveBillingSettings(input: TariffInput, uid: string): Promise<void> {
  await setDoc(billingQueries.settings(db), settingsPayload(input, uid, serverTimestamp()))
}

export interface InvoiceRow {
  invoice: Invoice
  accountNumber: string
  customerName: string
}

/** Every invoice (newest first) with its account number and customer name. */
export async function loadInvoiceList(): Promise<InvoiceRow[]> {
  const [invoices, accounts, customers] = await Promise.all([
    rows<Invoice>(billingQueries.allInvoices(db)),
    rows<Account>(customerQueries.allAccounts(db)),
    rows<Customer>(customerQueries.allCustomers(db)),
  ])
  const accountNumber = new Map(accounts.map((a) => [a.id, a.accountNumber]))
  const name = new Map(customers.map((c) => [c.id, c.name]))
  return invoices.map((invoice) => ({
    invoice,
    accountNumber: accountNumber.get(invoice.accountId) ?? '—',
    customerName: name.get(invoice.customerId) ?? 'Unknown customer',
  }))
}

export interface InvoiceDetail {
  invoice: Invoice
  account: Account | null
  /** Null for customers viewing their own bill (they know who they are). */
  customer: Customer | null
}

/** One invoice with its account (and customer, for staff). Null if it doesn't exist. */
export async function loadInvoice(
  invoiceId: string,
  { withCustomer }: { withCustomer: boolean },
): Promise<InvoiceDetail | null> {
  const snap = await getDocFromServer(billingQueries.invoice(db, invoiceId))
  if (!snap.exists()) return null
  const invoice = { id: snap.id, ...snap.data() } as Invoice
  const [accountSnap, customerSnap] = await Promise.all([
    getDocFromServer(doc(db, 'accounts', invoice.accountId)),
    withCustomer
      ? getDocFromServer(customerQueries.customer(db, invoice.customerId))
      : Promise.resolve(null),
  ])
  return {
    invoice,
    account: accountSnap.exists()
      ? ({ id: accountSnap.id, ...accountSnap.data() } as Account)
      : null,
    customer: customerSnap?.exists()
      ? ({ id: customerSnap.id, ...customerSnap.data() } as Customer)
      : null,
  }
}

/** The signed-in customer's invoices and accounts. */
export async function loadMyBills(
  customerId: string,
): Promise<{ invoices: Invoice[]; accounts: Account[] }> {
  const [invoices, accounts] = await Promise.all([
    rows<Invoice>(billingQueries.customerInvoices(db, customerId)),
    rows<Account>(customerQueries.accounts(db, customerId)),
  ])
  return { invoices, accounts }
}

// ---------------------------------------------------------------- Cloud Function calls

export type SkipReason = 'ACCOUNT_NOT_ACTIVE' | 'NO_METER' | 'NO_READINGS' | 'NOTHING_TO_BILL'

export type BillingPreview =
  | {
      ok: true
      created: boolean
      accountId: string
      accountNumber: string
      customerName: string | null
      invoiceId: string
      invoiceNumber: string
      billingPeriod: string
      previousReading: number
      currentReading: number
      consumption: number
      tariffRate: number
      amount: number
      /** ISO date string */
      dueDate: string
    }
  | {
      ok: false
      accountId: string
      accountNumber: string
      customerName: string | null
      reason: SkipReason
      message: string
    }

export interface BillingRun {
  dryRun: boolean
  settings: { tariffRate: number; paymentTermsDays: number }
  billableCount: number
  total: number
  accounts: BillingPreview[]
  failed: { accountId: string; message: string }[]
}

/** Preview (dryRun) or create one account's invoice. */
export function generateInvoice(accountId: string, dryRun: boolean): Promise<BillingPreview> {
  return apiPost<BillingPreview>('generateInvoice', { accountId, dryRun })
}

/** Preview (dryRun) or run billing for every active metered account. */
export function runBilling(dryRun: boolean): Promise<BillingRun> {
  return apiPost<BillingRun>('runBilling', { dryRun })
}
