/**
 * When outage notices and water-quality results should notify people, and what
 * the message says. Pure: unit-tested in tests/functions/alerts.test.ts.
 */

export interface OutageSnapshot {
  title: string
  description: string
  affectedAreas: string[]
  status: 'SCHEDULED' | 'ACTIVE' | 'RESOLVED'
  severity: string
  startTime?: { toDate(): Date } | Date | null
  expectedResolution?: { toDate(): Date } | Date | null
}

/** published = new notice; started = scheduled → active; restored = resolved. */
export type OutageEvent = 'scheduled' | 'active' | 'started' | 'restored'

/**
 * Only real changes notify: a new notice, a scheduled outage starting, or supply
 * coming back. Editing the wording of a notice does not message everyone again.
 */
export function planOutageEvent(
  before: OutageSnapshot | null,
  after: OutageSnapshot | null,
): OutageEvent | null {
  if (!after) return null
  if (!before)
    return after.status === 'SCHEDULED' ? 'scheduled' : after.status === 'ACTIVE' ? 'active' : null
  if (before.status === after.status) return null
  if (after.status === 'ACTIVE') return before.status === 'SCHEDULED' ? 'started' : 'active'
  if (after.status === 'RESOLVED') return 'restored'
  return null
}

const toDate = (v: OutageSnapshot['startTime']) => (v ? (v instanceof Date ? v : v.toDate()) : null)
const when = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat('en-ZA', {
        timeZone: 'Africa/Johannesburg',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    : null

export function outageMessage(
  event: OutageEvent,
  notice: OutageSnapshot,
): { title: string; message: string } {
  const areas = notice.affectedAreas.join(', ')
  const start = when(toDate(notice.startTime))
  const until = when(toDate(notice.expectedResolution))
  switch (event) {
    case 'scheduled':
      return {
        title: `Planned outage: ${notice.title}`,
        message: `${areas}${start ? ` from ${start}` : ''}${until ? ` until about ${until}` : ''}. ${notice.description}`,
      }
    case 'active':
    case 'started':
      return {
        title: `Water outage: ${notice.title}`,
        message: `Affecting ${areas}.${until ? ` Expected back by ${until}.` : ''} ${notice.description}`,
      }
    case 'restored':
      return {
        title: `Supply restored: ${notice.title}`,
        message: `Water supply has been restored in ${areas}. Thank you for your patience.`,
      }
  }
}

export interface WaterTestSnapshot {
  assetName: string
  parameter: string
  result: number
  unit: string
  acceptableMin: number | null
  acceptableMax: number | null
  status: 'NORMAL' | 'ALERT'
}

/** A result that has just become an alert (new ALERT, or NORMAL corrected to ALERT). */
export function isNewWaterAlert(
  before: WaterTestSnapshot | null,
  after: WaterTestSnapshot | null,
): boolean {
  return Boolean(after && after.status === 'ALERT' && before?.status !== 'ALERT')
}

const PARAMETER_LABELS: Record<string, string> = {
  PH: 'pH',
  TURBIDITY: 'Turbidity',
  FREE_CHLORINE: 'Free chlorine',
  E_COLI: 'E. coli',
  CONDUCTIVITY: 'Conductivity',
}

export function waterAlertMessage(test: WaterTestSnapshot): { title: string; message: string } {
  const label = PARAMETER_LABELS[test.parameter] ?? test.parameter
  const range =
    test.acceptableMin !== null && test.acceptableMax !== null
      ? `${test.acceptableMin}–${test.acceptableMax}`
      : test.acceptableMax !== null
        ? `at most ${test.acceptableMax}`
        : `at least ${test.acceptableMin}`
  return {
    title: `Water quality alert: ${label} at ${test.assetName}`,
    message: `${label} measured ${test.result} ${test.unit}; the acceptable range is ${range} ${test.unit}.`,
  }
}

/** Staff told about water-quality alerts ("management / relevant staff"). */
export const WATER_ALERT_ROLES = ['admin', 'water_quality', 'asset_manager'] as const
