import { describe, expect, it } from 'vitest'
import type { Account, Customer } from '../types/models'
import { accountRows, matchesAccount, matchesCustomer, summariseCustomers } from './customerSearch'

const customer = (id: string, o: Partial<Customer> = {}) =>
  ({
    id,
    name: 'Thandi Mokoena',
    email: 'thandi@example.com',
    phone: '0821234567',
    address: '14 Mahlangu Street',
    area: 'KaNyamazane',
    accountIds: [],
    ...o,
  }) as Customer
const account = (id: string, customerId: string, o: Partial<Account> = {}) =>
  ({
    id,
    customerId,
    accountNumber: '4100223107',
    balance: 0,
    status: 'ACTIVE',
    propertyAddress: '14 Mahlangu Street',
    area: 'KaNyamazane',
    meterId: null,
    ...o,
  }) as Account

describe('summariseCustomers', () => {
  const customers = [customer('c1'), customer('c2', { name: 'Sipho Dlamini' })]
  const accounts = [
    account('a1', 'c1', { accountNumber: '4100223107', balance: 120.1 }),
    account('a2', 'c1', { accountNumber: '4100223115', balance: 0.2 }),
    account('a3', 'c2', { accountNumber: '4100231842', balance: -50 }),
    account('a4', 'ghost', { balance: 999 }),
  ]
  const [thandi, sipho] = summariseCustomers(customers, accounts)

  it('adds balances across a customer’s accounts, rounded to cents', () => {
    expect(thandi.balance).toBe(120.3)
    expect(sipho.balance).toBe(-50)
  })
  it('lists each customer’s account numbers and ignores accounts of unknown customers', () => {
    expect(thandi.accountNumbers).toEqual(['4100223107', '4100223115'])
    expect(sipho.accountNumbers).toEqual(['4100231842'])
  })
  it('gives customers without accounts a zero balance', () => {
    expect(summariseCustomers([customer('c9')], [])[0]).toMatchObject({
      balance: 0,
      accountNumbers: [],
    })
  })
})

describe('matchesCustomer', () => {
  const [s] = summariseCustomers([customer('c1')], [account('a1', 'c1')])
  it.each([
    ['', true],
    ['thandi', true],
    ['THANDI MOK', true],
    ['mokoena', true],
    ['thandi@example', true],
    ['mahlangu', true],
    ['082 123 4567', true],
    ['082-123', true],
    ['+27 82 123 4567', true],
    ['4100223107', true],
    ['410022', true],
    ['sipho', false],
    ['0839999999', false],
  ])('"%s" → %s', (term, expected) => {
    expect(matchesCustomer(s, term)).toBe(expected)
  })
  it('does not match phone numbers on one or two digits', () => {
    const [noEmail] = summariseCustomers(
      [customer('c1', { email: '', name: 'X', address: 'Y' })],
      [],
    )
    expect(matchesCustomer(noEmail, '82')).toBe(false)
  })
})

describe('matchesAccount', () => {
  const [row] = accountRows(
    [customer('c1')],
    [account('a1', 'c1', { propertyAddress: '3 Protea Close, Tekwane' })],
  )
  it('matches account number, customer name or property address', () => {
    expect(matchesAccount(row, '4100223107')).toBe(true)
    expect(matchesAccount(row, 'thandi')).toBe(true)
    expect(matchesAccount(row, 'protea close')).toBe(true)
    expect(matchesAccount(row, 'white river')).toBe(false)
  })
  it('labels accounts whose customer is missing', () => {
    expect(accountRows([], [account('a1', 'ghost')])[0].customerName).toBe('Unknown customer')
  })
})
