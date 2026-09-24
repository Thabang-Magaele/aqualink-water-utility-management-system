import { describe, expect, it } from 'vitest'
import { STAFF_ROLES } from '../types/user'
import { customerSectionsFor, customerUpdate } from './customerQueries'

describe('customerSectionsFor', () => {
  it('matches the security rules for every role', () => {
    expect(customerSectionsFor('admin')).toEqual({
      invoices: true,
      payments: true,
      tickets: true,
      edit: true,
    })
    expect(customerSectionsFor('call_centre')).toEqual({
      invoices: true,
      payments: false,
      tickets: true,
      edit: true,
    })
    expect(customerSectionsFor('billing')).toEqual({
      invoices: true,
      payments: true,
      tickets: false,
      edit: false,
    })
  })
  it('gives other roles and signed-out users nothing', () => {
    for (const role of STAFF_ROLES.filter(
      (r) => !['admin', 'call_centre', 'billing'].includes(r),
    )) {
      expect(Object.values(customerSectionsFor(role)).some(Boolean)).toBe(false)
    }
    expect(Object.values(customerSectionsFor(null)).some(Boolean)).toBe(false)
    expect(Object.values(customerSectionsFor('customer')).some(Boolean)).toBe(false)
  })
})

describe('customerUpdate', () => {
  it('trims, lower-cases email, strips phone spaces and adds the timestamp', () => {
    const ts = { server: true }
    expect(
      customerUpdate(
        {
          name: '  Thandi Mokoena ',
          email: ' Thandi@Example.COM ',
          phone: '082 123 4567',
          address: ' 14 Mahlangu St ',
          area: 'Tekwane',
        },
        ts,
      ),
    ).toEqual({
      name: 'Thandi Mokoena',
      email: 'thandi@example.com',
      phone: '0821234567',
      address: '14 Mahlangu St',
      area: 'Tekwane',
      updatedAt: ts,
    })
  })
  it('only writes fields the security rules allow staff to change', () => {
    const keys = Object.keys(
      customerUpdate({ name: 'a', email: '', phone: '', address: 'b', area: 'Matsulu' }, 0),
    )
    expect(keys.sort()).toEqual(['address', 'area', 'email', 'name', 'phone', 'updatedAt'])
  })
})
