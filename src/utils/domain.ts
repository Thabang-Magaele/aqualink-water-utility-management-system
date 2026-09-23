/**
 * Small, pure business helpers shared by pages, services and the seed script.
 * No Firebase imports here, so they are easy to unit-test (Phase 23).
 */
import type { WaterQualityStatus } from '../types/models'

/** Round to cents. Use on every money calculation before storing it. */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

/** Water used between two cumulative readings, in kL. Never negative. */
export function calculateConsumption(previousReading: number, currentReading: number): number {
  return Math.max(0, Math.round((currentReading - previousReading) * 1000) / 1000)
}

/** "YYYY-MM" for a date, e.g. "2026-09". */
export function billingPeriodOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// Letters and digits that can't be confused when read aloud over the phone (no 0/O, 1/I/L).
const REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/**
 * Human-friendly unique reference, e.g. generateReference('TKT') → "TKT-260923-7F3K".
 * Date part keeps them sortable and readable; 4 random characters give ~850,000
 * combinations per day, plenty for this MVP without a shared counter.
 */
export function generateReference(prefix: string, date = new Date(), random = Math.random): string {
  const yymmdd = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  let suffix = ''
  for (let i = 0; i < 4; i++) suffix += REF_ALPHABET[Math.floor(random() * REF_ALPHABET.length)]
  return `${prefix}-${yymmdd}-${suffix}`
}

/** NORMAL when the result is inside the acceptable range (either bound may be absent). */
export function evaluateWaterQuality(
  result: number,
  min: number | null,
  max: number | null,
): WaterQualityStatus {
  if (min !== null && result < min) return 'ALERT'
  if (max !== null && result > max) return 'ALERT'
  return 'NORMAL'
}
