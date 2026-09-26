/**
 * Queries and write payloads for the billing screens.
 * Take `db` as an argument so tests/rules/billing.test.ts runs exactly these as each role.
 * Invoices themselves are created by the Cloud Function (functions/src/routes/billing.ts).
 */
import { collection, doc, limit, orderBy, query, where, type Firestore } from 'firebase/firestore'

/** Used until an administrator saves settings/billing. Keep in sync with functions/src/shared/billing.ts. */
export const DEFAULT_BILLING = { tariffRate: 28.5, paymentTermsDays: 21 }

export const INVOICE_LIST_LIMIT = 500

export const billingQueries = {
  settings: (db: Firestore) => doc(db, 'settings', 'billing'),
  allInvoices: (db: Firestore) =>
    query(collection(db, 'invoices'), orderBy('createdAt', 'desc'), limit(INVOICE_LIST_LIMIT)),
  invoice: (db: Firestore, invoiceId: string) => doc(db, 'invoices', invoiceId),
  customerInvoices: (db: Firestore, customerId: string) =>
    query(
      collection(db, 'invoices'),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc'),
      limit(60),
    ),
}

export interface TariffInput {
  tariffRate: number
  paymentTermsDays: number
}

/** The exact document an administrator writes to settings/billing. */
export function settingsPayload(input: TariffInput, updatedBy: string, timestamp: unknown) {
  return {
    tariffRate: Math.round(input.tariffRate * 100) / 100,
    paymentTermsDays: Math.round(input.paymentTermsDays),
    updatedAt: timestamp,
    updatedBy,
  }
}
