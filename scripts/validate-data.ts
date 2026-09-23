/**
 * Referential checks for a generated dataset. Firestore doesn't enforce
 * relationships, so the seed script checks them before writing anything.
 */
import { calculateConsumption, evaluateWaterQuality, roundMoney } from '../src/utils/domain'
import type { SeedDoc } from './sample-data'

type Row = Record<string, unknown> & { _id: string }

export function validateData(docs: SeedDoc[]): string[] {
  const errors: string[] = []
  const byCollection = new Map<string, Row[]>()
  for (const d of docs) {
    const parts = d.path.split('/')
    const col = parts.length === 2 ? parts[0] : `${parts[0]}/*/${parts[2]}`
    const list = byCollection.get(col) ?? []
    list.push({ ...d.data, _id: parts[parts.length - 1] })
    byCollection.set(col, list)
  }
  const ids = (col: string) => new Set((byCollection.get(col) ?? []).map((r) => r._id))
  const rows = (col: string) => byCollection.get(col) ?? []
  const need = (ok: boolean, message: string) => {
    if (!ok) errors.push(message)
  }

  const customers = ids('customers')
  const accounts = ids('accounts')
  const meters = ids('meters')
  const invoices = ids('invoices')
  const assets = ids('assets')
  const tickets = ids('tickets')

  for (const c of rows('customers')) {
    for (const a of c.accountIds as string[])
      need(accounts.has(a), `customer ${c._id} lists missing account ${a}`)
  }
  for (const a of rows('accounts')) {
    need(customers.has(a.customerId as string), `account ${a._id} → missing customer`)
    need(a.meterId === null || meters.has(a.meterId as string), `account ${a._id} → missing meter`)
    const owed = rows('invoices')
      .filter((i) => i.accountId === a._id && i.status !== 'PAID')
      .reduce((sum, i) => roundMoney(sum + (i.amount as number)), 0)
    need(owed === a.balance, `account ${a._id} balance ${a.balance} ≠ unpaid invoices ${owed}`)
  }
  for (const m of rows('meters')) {
    need(accounts.has(m.accountId as string), `meter ${m._id} → missing account`)
  }
  for (const r of rows('readings')) {
    need(meters.has(r.meterId as string), `reading ${r._id} → missing meter`)
    const meter = rows('meters').find((m) => m._id === r.meterId)
    need(meter?.customerId === r.customerId, `reading ${r._id} customerId differs from its meter`)
  }
  for (const i of rows('invoices')) {
    need(accounts.has(i.accountId as string), `invoice ${i._id} → missing account`)
    const c = calculateConsumption(i.previousReading as number, i.currentReading as number)
    need(c === i.consumption, `invoice ${i._id} consumption ${i.consumption} ≠ ${c}`)
    need(
      roundMoney(c * (i.tariffRate as number)) === i.amount,
      `invoice ${i._id} amount doesn't match consumption × tariff`,
    )
    need(
      (i.status === 'PAID') === (i.paidAt !== null),
      `invoice ${i._id} paidAt doesn't match status`,
    )
    need(
      /^\d{4}-\d{2}$/.test(i.billingPeriod as string),
      `invoice ${i._id} billingPeriod not YYYY-MM`,
    )
  }
  for (const p of rows('payments')) {
    need(invoices.has(p.invoiceId as string), `payment ${p._id} → missing invoice`)
    const inv = rows('invoices').find((i) => i._id === p.invoiceId)
    need(inv?.status === 'PAID', `payment ${p._id} is for an invoice that isn't PAID`)
    need(inv?.amount === p.amount, `payment ${p._id} amount differs from invoice`)
  }
  for (const t of rows('tickets')) {
    need(customers.has(t.customerId as string), `ticket ${t._id} → missing customer`)
    need(
      t.accountId === null || accounts.has(t.accountId as string),
      `ticket ${t._id} → missing account`,
    )
    need(t.assetId === null || assets.has(t.assetId as string), `ticket ${t._id} → missing asset`)
    need(
      (t.status === 'RESOLVED') === (t.resolvedAt !== null),
      `ticket ${t._id} resolvedAt doesn't match status`,
    )
    need(
      t.status === 'OPEN' || t.assignedTechnicianId !== null,
      `ticket ${t._id} in progress but unassigned`,
    )
  }
  const historyTicketIds = new Set(
    docs.filter((d) => d.path.includes('/ticketHistory/')).map((d) => d.path.split('/')[1]),
  )
  for (const t of tickets) need(historyTicketIds.has(t), `ticket ${t} has no history`)
  for (const id of historyTicketIds) need(tickets.has(id), `history for missing ticket ${id}`)
  for (const w of rows('waterQualityTests')) {
    need(assets.has(w.assetId as string), `water test ${w._id} → missing asset`)
    const expected = evaluateWaterQuality(
      w.result as number,
      w.acceptableMin as number | null,
      w.acceptableMax as number | null,
    )
    need(expected === w.status, `water test ${w._id} status ${w.status} should be ${expected}`)
  }
  return errors
}

export function summarise(docs: SeedDoc[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const d of docs) {
    const parts = d.path.split('/')
    const key = parts.length === 2 ? parts[0] : `${parts[0]}/{id}/${parts[2]}`
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}
