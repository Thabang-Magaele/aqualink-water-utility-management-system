import { HttpError, requireRole, sendSuccess, type Handler } from '../shared/http'
import {
  billableAccountIds,
  billAccount,
  customerNames,
  readSettings,
  type BillingResult,
} from '../shared/billingStore'

const BILLING_ROLES = ['admin', 'billing'] as const

function summary(r: BillingResult, names?: Map<string, string>) {
  const base = {
    accountId: r.accountId,
    accountNumber: r.accountNumber,
    customerName: names?.get(r.customerId) ?? null,
  }
  if (!r.plan.ok) return { ...base, ok: false, reason: r.plan.reason, message: r.plan.message }
  const {
    invoiceId,
    invoiceNumber,
    billingPeriod,
    previousReading,
    currentReading,
    consumption,
    tariffRate,
    amount,
    dueDate,
  } = r.plan
  return {
    ...base,
    ok: true,
    created: r.created,
    invoiceId,
    invoiceNumber,
    billingPeriod,
    previousReading,
    currentReading,
    consumption,
    tariffRate,
    amount,
    dueDate: dueDate.toISOString(),
  }
}

/**
 * POST /api/generateInvoice  { accountId: string, dryRun?: boolean }
 * Billing / admin. Bills one account for its use since the last invoice.
 * With dryRun: true, returns the invoice that would be created without writing anything.
 */
export const generateInvoice: Handler = async (req, res, caller) => {
  requireRole(caller, BILLING_ROLES)
  const { accountId, dryRun = false } = (req.body ?? {}) as {
    accountId?: unknown
    dryRun?: unknown
  }
  if (typeof accountId !== 'string' || !accountId || accountId.length > 128)
    throw new HttpError(400, 'A valid account ID is required.')
  if (typeof dryRun !== 'boolean') throw new HttpError(400, 'dryRun must be true or false.')

  const result = await billAccount(accountId, { dryRun })
  const data = summary(result)
  const message = !result.plan.ok
    ? result.plan.message
    : dryRun
      ? 'Invoice preview.'
      : `Invoice ${result.plan.invoiceNumber} created.`
  sendSuccess(res, message, data)
}

/**
 * POST /api/runBilling  { dryRun?: boolean }
 * Billing / admin. Bills every active metered account that has new consumption.
 * With dryRun: true, previews the whole run. Each account is billed in its own
 * transaction, so one failure doesn't stop the rest.
 */
export const runBilling: Handler = async (req, res, caller) => {
  requireRole(caller, BILLING_ROLES)
  const { dryRun = false } = (req.body ?? {}) as { dryRun?: unknown }
  if (typeof dryRun !== 'boolean') throw new HttpError(400, 'dryRun must be true or false.')

  const now = new Date()
  const results: BillingResult[] = []
  const failed: { accountId: string; message: string }[] = []
  for (const accountId of await billableAccountIds()) {
    try {
      results.push(await billAccount(accountId, { dryRun, now }))
    } catch (error) {
      failed.push({
        accountId,
        message: error instanceof HttpError ? error.message : 'Could not be billed. Try again.',
      })
    }
  }
  const names = await customerNames(results.map((r) => r.customerId))
  const accounts = results.map((r) => summary(r, names))
  const billable = accounts.filter((a) => a.ok)
  const total =
    Math.round(
      billable.reduce((sum, a) => sum + ('amount' in a ? (a.amount as number) : 0), 0) * 100,
    ) / 100
  const settings = await readSettings()

  sendSuccess(
    res,
    dryRun
      ? `${billable.length} account(s) ready to bill.`
      : `${billable.length} invoice(s) created.`,
    {
      dryRun,
      settings,
      billableCount: billable.length,
      total,
      accounts,
      failed,
    },
  )
}
