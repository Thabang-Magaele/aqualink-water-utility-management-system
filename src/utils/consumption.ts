/**
 * Consumption maths for meter readings. Pure functions (no Firebase),
 * unit-tested in consumption.test.ts and reused by billing in Phase 10.
 *
 * Readings are cumulative: a meter only counts up. The water used in a period
 * is the difference between two consecutive readings (calculateConsumption).
 */
import { calculateConsumption } from './domain'

const DAY_MS = 86_400_000
/** Average days in a month, for "kL per month" figures. */
export const DAYS_PER_MONTH = 30.44

export interface ReadingPoint {
  id: string
  value: number
  date: Date
}

export interface ConsumptionPeriod {
  /** The reading that closes this period. */
  id: string
  date: Date
  reading: number
  /** kL used since the previous reading; null for the first (baseline) reading. */
  consumption: number | null
  /** Days since the previous reading; null for the first reading. */
  days: number | null
  /** Litres per day over the period; null if unknown or zero days. */
  litresPerDay: number | null
}

/** Oldest-first periods from readings in any order. */
export function consumptionSeries(readings: ReadingPoint[]): ConsumptionPeriod[] {
  const sorted = [...readings].sort((a, b) => a.date.getTime() - b.date.getTime())
  return sorted.map((r, i) => {
    const prev = sorted[i - 1]
    if (!prev)
      return {
        id: r.id,
        date: r.date,
        reading: r.value,
        consumption: null,
        days: null,
        litresPerDay: null,
      }
    const consumption = calculateConsumption(prev.value, r.value)
    const days = Math.max(0, Math.round((r.date.getTime() - prev.date.getTime()) / DAY_MS))
    return {
      id: r.id,
      date: r.date,
      reading: r.value,
      consumption,
      days,
      litresPerDay: days > 0 ? Math.round((consumption * 1000) / days) : null,
    }
  })
}

/** Periods that have a consumption figure (everything except the baseline). */
export function measuredPeriods(series: ConsumptionPeriod[]): ConsumptionPeriod[] {
  return series.filter((p) => p.consumption !== null && p.days !== null && p.days > 0)
}

/** Average use in kL per month across all measured periods; null if there are none. */
export function averageMonthlyUse(series: ConsumptionPeriod[]): number | null {
  const periods = measuredPeriods(series)
  const days = periods.reduce((sum, p) => sum + (p.days ?? 0), 0)
  if (days === 0) return null
  const kl = periods.reduce((sum, p) => sum + (p.consumption ?? 0), 0)
  return Math.round((kl / days) * DAYS_PER_MONTH * 10) / 10
}

/**
 * How many times higher than normal a new reading's daily use would be,
 * or null when there isn't enough history (fewer than 2 measured periods).
 * Used to warn about likely misreads before saving.
 */
export function usageRatio(
  series: ConsumptionPeriod[],
  newValue: number,
  newDate: Date,
): number | null {
  const periods = measuredPeriods(series)
  const last = series[series.length - 1]
  if (periods.length < 2 || !last) return null
  const days = (newDate.getTime() - last.date.getTime()) / DAY_MS
  if (days <= 0) return null
  const totalDays = periods.reduce((s, p) => s + (p.days ?? 0), 0)
  const normalPerDay = periods.reduce((s, p) => s + (p.consumption ?? 0), 0) / totalDays
  if (normalPerDay <= 0) return null
  return calculateConsumption(last.reading, newValue) / days / normalPerDay
}

/** Readings at or above this multiple of normal use trigger a "check this reading" warning. */
export const UNUSUAL_USAGE_RATIO = 3

/**
 * Turns a date-input value ("2026-09-24") into the reading's timestamp.
 * Today → the current time (a reading can't be later than "now");
 * earlier days → midday, which avoids time-zone edge cases.
 */
export function readingDateFrom(input: string, now = new Date()): Date {
  const [y, m, d] = input.split('-').map(Number)
  const chosen = new Date(y, m - 1, d, 12, 0, 0, 0)
  const isToday = y === now.getFullYear() && m - 1 === now.getMonth() && d === now.getDate()
  return isToday ? now : chosen
}

/** "2026-09-24" for a date input (local time). */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Whole days between a date and now (for "read 12 days ago"). */
export function daysSince(date: Date, now = new Date()): number {
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS)
}

/** Meters not read for longer than this are flagged as due for a reading. */
export const READING_OVERDUE_DAYS = 35

/** Active meters never read, or not read for longer than READING_OVERDUE_DAYS. */
export function isDueForReading(
  meter: { status: string; lastReadingDate: { toDate: () => Date } | null },
  now = new Date(),
): boolean {
  const last = meter.lastReadingDate?.toDate()
  return meter.status === 'ACTIVE' && (!last || daysSince(last, now) > READING_OVERDUE_DAYS)
}
