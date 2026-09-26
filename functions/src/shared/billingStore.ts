/**
 * Firestore side of billing (Admin SDK). The decisions live in billing.ts.
 *
 * billAccount() runs in one transaction: it reads the account, its meter's readings,
 * its last invoice and the tariff, then creates the invoice, raises the balance
 * and notifies the customer together. Either all of it happens or none of it does.
 */
import { FieldValue, getFirestore, Timestamp, type Transaction } from 'firebase-admin/firestore'
import {
  billingPeriodOf,
  DEFAULT_BILLING,
  invoiceNotification,
  isValidSettings,
  planInvoice,
  type BillableAccount,
  type BillingSettings,
  type InvoicePlan,
  type ReadingPoint,
} from './billing'
import { HttpError } from './http'

const READINGS_CONSIDERED = 24

export async function readSettings(tx?: Transaction): Promise<BillingSettings> {
  const ref = getFirestore().doc('settings/billing')
  const snap = tx ? await tx.get(ref) : await ref.get()
  const data = snap.data()
  return isValidSettings(data)
    ? { tariffRate: data.tariffRate, paymentTermsDays: data.paymentTermsDays }
    : DEFAULT_BILLING
}

export interface BillingResult {
  accountId: string
  accountNumber: string
  customerId: string
  plan: InvoicePlan
  /** True if the invoice was actually written (false for previews and skips). */
  created: boolean
}

/** Bills one account now, or with `dryRun` only reports what would be billed. */
export async function billAccount(
  accountId: string,
  { dryRun, now = new Date() }: { dryRun: boolean; now?: Date },
): Promise<BillingResult> {
  const db = getFirestore()
  const accountRef = db.doc(`accounts/${accountId}`)

  return db.runTransaction(async (tx) => {
    // ---- reads (a transaction must read everything before it writes)
    const [settings, accountSnap] = await Promise.all([readSettings(tx), tx.get(accountRef)])
    if (!accountSnap.exists) throw new HttpError(404, 'That account does not exist.')
    const a = accountSnap.data()!
    const account: BillableAccount = {
      id: accountSnap.id,
      accountNumber: a.accountNumber,
      customerId: a.customerId,
      status: a.status,
      meterId: a.meterId ?? null,
      balance: typeof a.balance === 'number' ? a.balance : 0,
    }

    const readings: ReadingPoint[] = account.meterId
      ? (
          await tx.get(
            db
              .collection('readings')
              .where('meterId', '==', account.meterId)
              .orderBy('readingDate', 'desc')
              .limit(READINGS_CONSIDERED),
          )
        ).docs.map((d) => ({
          id: d.id,
          value: d.get('readingValue'),
          date: (d.get('readingDate') as Timestamp).toDate(),
        }))
      : []

    const lastInvoice = await tx.get(
      db
        .collection('invoices')
        .where('accountId', '==', accountId)
        .orderBy('createdAt', 'desc')
        .limit(1),
    )
    const lastInvoicedReading = lastInvoice.empty
      ? null
      : (lastInvoice.docs[0].get('currentReading') as number)

    const newest = readings[0]
    const invoicesInPeriod = newest
      ? (
          await tx.get(
            db
              .collection('invoices')
              .where('accountId', '==', accountId)
              .where('billingPeriod', '==', billingPeriodOf(newest.date)),
          )
        ).size
      : 0

    const plan = planInvoice({
      account,
      readings,
      lastInvoicedReading,
      invoicesInPeriod,
      settings,
      now,
    })
    const result = {
      accountId,
      accountNumber: account.accountNumber,
      customerId: account.customerId,
      plan,
      created: false,
    }
    if (!plan.ok || dryRun) return result

    const invoiceRef = db.doc(`invoices/${plan.invoiceId}`)
    if ((await tx.get(invoiceRef)).exists) {
      return {
        ...result,
        plan: {
          ok: false,
          reason: 'NOTHING_TO_BILL',
          message: 'This reading has already been billed.',
        } as InvoicePlan,
      }
    }

    // ---- writes
    tx.create(invoiceRef, {
      invoiceNumber: plan.invoiceNumber,
      accountId,
      customerId: account.customerId,
      billingPeriod: plan.billingPeriod,
      previousReading: plan.previousReading,
      currentReading: plan.currentReading,
      consumption: plan.consumption,
      tariffRate: plan.tariffRate,
      amount: plan.amount,
      status: 'UNPAID',
      dueDate: Timestamp.fromDate(plan.dueDate),
      paidAt: null,
      createdAt: FieldValue.serverTimestamp(),
    })
    tx.update(accountRef, { balance: plan.newBalance, updatedAt: FieldValue.serverTimestamp() })
    tx.set(db.doc(`notifications/invoice-${plan.invoiceId}`), {
      ...invoiceNotification('issued', {
        id: plan.invoiceId,
        customerId: account.customerId,
        invoiceNumber: plan.invoiceNumber,
        amount: plan.amount,
        dueDate: plan.dueDate,
      }),
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    })
    return { ...result, created: true }
  })
}

/** Active accounts that have a meter: the candidates for a billing run. */
export async function billableAccountIds(limit = 500): Promise<string[]> {
  const snap = await getFirestore()
    .collection('accounts')
    .where('status', '==', 'ACTIVE')
    .limit(limit)
    .get()
  return snap.docs.filter((d) => d.get('meterId')).map((d) => d.id)
}

/** Customer names for a set of customer IDs (for billing-run previews). */
export async function customerNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()
  const db = getFirestore()
  const snaps = await db.getAll(...unique.map((id) => db.doc(`customers/${id}`)))
  return new Map(snaps.map((s) => [s.id, (s.get('name') as string) ?? 'Unknown customer']))
}
