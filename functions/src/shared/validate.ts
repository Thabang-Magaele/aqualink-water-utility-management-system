/**
 * Request-body checks for the REST endpoints. Each helper returns the clean value
 * or throws a 400 HttpError naming the field, so handlers read top to bottom.
 */
import { HttpError } from './http'

export type Body = Record<string, unknown>

export function bodyOf(raw: unknown): Body {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new HttpError(400, 'Send a JSON object in the request body.')
  return raw as Body
}

export function text(
  body: Body,
  field: string,
  opts: { min?: number; max: number; optional?: boolean },
): string {
  const value = body[field]
  if (value === undefined || value === null || value === '') {
    if (opts.optional) return ''
    throw new HttpError(400, `"${field}" is required.`)
  }
  if (typeof value !== 'string') throw new HttpError(400, `"${field}" must be text.`)
  const v = value.trim()
  if (v.length < (opts.min ?? (opts.optional ? 0 : 1)))
    throw new HttpError(400, `"${field}" must be at least ${opts.min ?? 1} characters.`)
  if (v.length > opts.max)
    throw new HttpError(400, `"${field}" must be at most ${opts.max} characters.`)
  return v
}

export function id(body: Body, field: string): string {
  const v = text(body, field, { max: 200 })
  if (v.includes('/')) throw new HttpError(400, `"${field}" is not a valid ID.`)
  return v
}

export function oneOf<T extends string>(body: Body, field: string, allowed: readonly T[]): T {
  const v = body[field]
  if (typeof v !== 'string' || !allowed.includes(v as T))
    throw new HttpError(400, `"${field}" must be one of: ${allowed.join(', ')}.`)
  return v as T
}

/** ISO date-time string, e.g. "2026-10-01T06:00:00+02:00". */
export function dateTime(body: Body, field: string, optional = false): Date | null {
  const v = body[field]
  if ((v === undefined || v === null || v === '') && optional) return null
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v)))
    throw new HttpError(400, `"${field}" must be an ISO date-time, e.g. 2026-10-01T06:00:00+02:00.`)
  return new Date(v)
}

export function idempotencyKey(body: Body): string {
  const v = body.idempotencyKey
  if (typeof v !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(v))
    throw new HttpError(
      400,
      '"idempotencyKey" is required: 8–64 letters, digits or dashes, new for each request.',
    )
  return v
}

/** An in-app path such as "/customer/bills"; external links aren't allowed in notifications. */
export function internalLink(body: Body, field: string): string | null {
  const v = text(body, field, { max: 200, optional: true })
  if (!v) return null
  if (!/^\/[A-Za-z0-9/_-]*$/.test(v))
    throw new HttpError(400, `"${field}" must be an in-app path starting with "/".`)
  return v
}
