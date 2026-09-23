import { describe, expect, it } from 'vitest'
import {
  billingPeriodOf,
  calculateConsumption,
  evaluateWaterQuality,
  generateReference,
  roundMoney,
} from './domain'

describe('roundMoney', () => {
  it('rounds to cents, including awkward floating-point cases', () => {
    expect(roundMoney(14.2 * 28.5)).toBe(404.7)
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
  })
})

describe('calculateConsumption', () => {
  it('is current minus previous, in kL', () => {
    expect(calculateConsumption(1300, 1314.2)).toBe(14.2)
  })
  it('never goes negative (meter replaced or misread)', () => {
    expect(calculateConsumption(500, 20)).toBe(0)
  })
})

describe('billingPeriodOf', () => {
  it('formats as YYYY-MM with a leading zero', () => {
    expect(billingPeriodOf(new Date(2026, 8, 23))).toBe('2026-09')
    expect(billingPeriodOf(new Date(2026, 11, 1))).toBe('2026-12')
  })
})

describe('generateReference', () => {
  it('has the prefix, date and 4 unambiguous characters', () => {
    const ref = generateReference('TKT', new Date(2026, 8, 23))
    expect(ref).toMatch(/^TKT-260923-[2-9A-HJKMNP-Z]{4}$/)
  })
  it('never uses 0, O, 1, I or L', () => {
    for (let i = 0; i < 500; i++) expect(generateReference('X').slice(-4)).not.toMatch(/[01OIL]/)
  })
})

describe('evaluateWaterQuality', () => {
  it('is NORMAL inside the range and ALERT outside it', () => {
    expect(evaluateWaterQuality(7.2, 5, 9.7)).toBe('NORMAL')
    expect(evaluateWaterQuality(4.9, 5, 9.7)).toBe('ALERT')
    expect(evaluateWaterQuality(9.8, 5, 9.7)).toBe('ALERT')
  })
  it('treats a missing bound as open-ended', () => {
    expect(evaluateWaterQuality(0, null, 1)).toBe('NORMAL')
    expect(evaluateWaterQuality(1.8, null, 1)).toBe('ALERT')
  })
  it('is NORMAL exactly on a limit', () => {
    expect(evaluateWaterQuality(1, null, 1)).toBe('NORMAL')
  })
})
