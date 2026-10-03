/** Validation for publishOutage. Mirrors the outageNotices rules in firestore.rules. */
import { HttpError } from './http'
import { dateTime, oneOf, text, type Body } from './validate'

/** Keep in sync with AREAS in src/types/models.ts (a test checks this). */
export const AREAS = [
  'Mbombela CBD',
  'KaNyamazane',
  'Matsulu',
  'White River',
  'Tekwane',
  'Msogwaba',
  'Kabokweni',
  'Hazyview',
] as const
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

export function areasOf(body: Body, field = 'affectedAreas'): string[] {
  const v = body[field]
  if (!Array.isArray(v) || v.length === 0)
    throw new HttpError(400, `"${field}" must list at least one area.`)
  const unknown = v.filter(
    (a) => typeof a !== 'string' || !(AREAS as readonly string[]).includes(a),
  )
  if (unknown.length)
    throw new HttpError(400, `Unknown area(s): ${unknown.join(', ')}. Use: ${AREAS.join(', ')}.`)
  return [...new Set(v as string[])]
}

export function parseOutage(body: Body) {
  const startTime = dateTime(body, 'startTime')!
  const expectedResolution = dateTime(body, 'expectedResolution', true)
  if (expectedResolution && expectedResolution < startTime)
    throw new HttpError(400, '"expectedResolution" must be after "startTime".')
  return {
    title: text(body, 'title', { max: 120 }),
    description: text(body, 'description', { max: 2000 }),
    affectedAreas: areasOf(body),
    startTime,
    expectedResolution,
    severity: oneOf(body, 'severity', PRIORITIES),
    status: oneOf(body, 'status', ['SCHEDULED', 'ACTIVE'] as const),
  }
}
