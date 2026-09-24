import { describe, expect, it } from 'vitest'
import { canOpen } from './navigation'

describe('canOpen', () => {
  it('allows menu pages for permitted roles only', () => {
    expect(canOpen('call_centre', '/staff/customers')).toBe(true)
    expect(canOpen('technician', '/staff/customers')).toBe(false)
  })
  it('treats detail pages like their parent menu item', () => {
    expect(canOpen('billing', '/staff/customers/abc123')).toBe(true)
    expect(canOpen('technician', '/staff/customers/abc123')).toBe(false)
  })
  it("doesn't let the dashboard root cover everything beneath it", () => {
    expect(canOpen('technician', '/staff/unknown-page')).toBe(false)
    expect(canOpen(null, '/staff')).toBe(false)
  })
})
