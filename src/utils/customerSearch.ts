/**
 * Client-side search for the customer and account directories.
 * Pure functions (no Firebase), unit-tested in customerSearch.test.ts.
 */
import type { Account, Area, Customer } from '../types/models'
import { roundMoney } from './domain'

export interface CustomerSummary {
  id: string
  name: string
  email: string
  phone: string
  address: string
  area: Area
  accountNumbers: string[]
  /** Total owed across all the customer's accounts (negative = in credit). */
  balance: number
}

export interface AccountRow {
  account: Account
  customerName: string
}

/** Joins customers with their accounts. Accounts are matched by `customerId`. */
export function summariseCustomers(customers: Customer[], accounts: Account[]): CustomerSummary[] {
  const byCustomer = new Map<string, Account[]>()
  for (const a of accounts) {
    const list = byCustomer.get(a.customerId) ?? []
    list.push(a)
    byCustomer.set(a.customerId, list)
  }
  return customers.map((c) => {
    const own = byCustomer.get(c.id) ?? []
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      area: c.area,
      accountNumbers: own.map((a) => a.accountNumber),
      balance: own.reduce((sum, a) => roundMoney(sum + a.balance), 0),
    }
  })
}

export function accountRows(customers: Customer[], accounts: Account[]): AccountRow[] {
  const names = new Map(customers.map((c) => [c.id, c.name]))
  return accounts.map((account) => ({
    account,
    customerName: names.get(account.customerId) ?? 'Unknown customer',
  }))
}

/** Lower-case, no spaces or dashes: "082 123-4567" → "0821234567". */
export function normalise(value: string): string {
  return value.toLowerCase().replace(/[\s-]/g, '')
}

/** SA numbers compare in local form: "+27 82 123 4567" → "0821234567". */
function normalisePhoneForSearch(value: string): string {
  return normalise(value).replace(/^\+27/, '0')
}

/** Matches name, email, phone, address or any account number. Empty term matches everything. */
export function matchesCustomer(summary: CustomerSummary, term: string): boolean {
  const t = normalise(term)
  if (!t) return true
  const phoneTerm = normalisePhoneForSearch(term)
  return (
    normalise(summary.name).includes(t) ||
    normalise(summary.email).includes(t) ||
    normalise(summary.address).includes(t) ||
    (phoneTerm.length >= 3 && normalisePhoneForSearch(summary.phone).includes(phoneTerm)) ||
    summary.accountNumbers.some((n) => n.includes(t))
  )
}

/** Matches account number, customer name or property address. */
export function matchesAccount(row: AccountRow, term: string): boolean {
  const t = normalise(term)
  if (!t) return true
  return (
    row.account.accountNumber.includes(t) ||
    normalise(row.customerName).includes(t) ||
    normalise(row.account.propertyAddress).includes(t)
  )
}
