import { describe, expect, it } from 'vitest'
import {
  averageMonthlyUse,
  consumptionSeries,
  daysSince,
  isDueForReading,
  measuredPeriods,
  readingDateFrom,
  toDateInput,
  usageRatio,
} from './consumption'

const d = (iso: string) => new Date(`${iso}T10:00:00`)
const readings = [
  { id: 'r3', value: 1330.4, date: d('2026-08-25') },
  { id: 'r1', value: 1300, date: d('2026-06-25') },
  { id: 'r2', value: 1315.2, date: d('2026-07-25') },
]

describe('consumptionSeries', () => {
  const series = consumptionSeries(readings)
  it('sorts oldest first and treats the first reading as the baseline', () => {
    expect(series.map((p) => p.id)).toEqual(['r1', 'r2', 'r3'])
    expect(series[0]).toMatchObject({ consumption: null, days: null, litresPerDay: null })
  })
  it('computes consumption = current − previous, without floating-point noise', () => {
    expect(series[1].consumption).toBe(15.2)
    expect(series[2].consumption).toBe(15.2)
  })
  it('computes days between readings and litres per day', () => {
    expect(series[1].days).toBe(30)
    expect(series[1].litresPerDay).toBe(507) // 15 200 L / 30 days
    expect(series[2].days).toBe(31)
  })
  it('never reports negative use (e.g. a replaced meter)', () => {
    const s = consumptionSeries([
      { id: 'a', value: 500, date: d('2026-06-01') },
      { id: 'b', value: 20, date: d('2026-07-01') },
    ])
    expect(s[1].consumption).toBe(0)
  })
})

describe('averageMonthlyUse', () => {
  it('averages over days, expressed per month', () => {
    // 30.4 kL over 61 days ≈ 0.4984 kL/day ≈ 15.2 kL/month
    expect(averageMonthlyUse(consumptionSeries(readings))).toBe(15.2)
  })
  it('is null with only a baseline reading', () => {
    expect(averageMonthlyUse(consumptionSeries([readings[0]]))).toBeNull()
    expect(measuredPeriods(consumptionSeries([]))).toEqual([])
  })
})

describe('usageRatio', () => {
  const series = consumptionSeries(readings)
  it('is about 1 for a normal next reading', () => {
    expect(usageRatio(series, 1345.6, d('2026-09-24'))).toBeCloseTo(1.05, 1)
  })
  it('flags a likely misread (an extra digit)', () => {
    expect(usageRatio(series, 1482.4, d('2026-09-24'))!).toBeGreaterThan(9)
  })
  it('needs at least two measured periods and a later date', () => {
    expect(usageRatio(consumptionSeries(readings.slice(0, 2)), 1400, d('2026-09-24'))).toBeNull()
    expect(usageRatio(series, 1400, d('2026-08-25'))).toBeNull()
  })
})

describe('reading dates', () => {
  const now = new Date(2026, 8, 24, 9, 15)
  it('uses the current time for today, so the reading is never in the future', () => {
    expect(readingDateFrom('2026-09-24', now)).toBe(now)
  })
  it('uses midday for earlier days', () => {
    expect(readingDateFrom('2026-09-20', now)).toEqual(new Date(2026, 8, 20, 12))
  })
  it('round-trips through the date input format', () => {
    expect(toDateInput(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('counts whole days since a date', () => {
    expect(daysSince(new Date(2026, 8, 14, 9, 15), now)).toBe(10)
  })
})

describe('isDueForReading', () => {
  const now = new Date(2026, 8, 24)
  const read = (daysAgo: number) => ({
    toDate: () => new Date(now.getTime() - daysAgo * 86_400_000),
  })
  it('flags active meters not read for over 35 days, or never read', () => {
    expect(isDueForReading({ status: 'ACTIVE', lastReadingDate: read(36) }, now)).toBe(true)
    expect(isDueForReading({ status: 'ACTIVE', lastReadingDate: null }, now)).toBe(true)
    expect(isDueForReading({ status: 'ACTIVE', lastReadingDate: read(30) }, now)).toBe(false)
  })
  it('ignores faulty or removed meters', () => {
    expect(isDueForReading({ status: 'FAULTY', lastReadingDate: read(90) }, now)).toBe(false)
    expect(isDueForReading({ status: 'REMOVED', lastReadingDate: null }, now)).toBe(false)
  })
})
