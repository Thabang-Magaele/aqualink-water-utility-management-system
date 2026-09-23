/**
 * Shared helpers for every REST endpoint:
 * authentication, authorisation, and one JSON response shape.
 */
import type { Response } from 'express'
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth'
import type { Request } from 'firebase-functions/v2/https'
import { roleFromClaims, type Role } from './roles'

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export interface Caller {
  uid: string
  role: Role
  token: DecodedIdToken
}

export type Handler = (req: Request, res: Response, caller: Caller) => Promise<void>

/** 1. Verify the Firebase ID token sent as "Authorization: Bearer <token>". */
export async function authenticate(req: Request): Promise<Caller> {
  const match = /^Bearer (.+)$/.exec(req.get('Authorization') ?? '')
  if (!match) throw new HttpError(401, 'Sign in to continue.')
  try {
    const token = await getAuth().verifyIdToken(match[1])
    return { uid: token.uid, role: roleFromClaims(token), token }
  } catch {
    throw new HttpError(401, 'Your session has expired. Sign in again.')
  }
}

/** 2. Check the caller's role (from verified claims, never from the request body). */
export function requireRole(caller: Caller, allowed: readonly Role[]): void {
  if (!allowed.includes(caller.role)) {
    throw new HttpError(403, 'You do not have permission to do that.')
  }
}

export function sendSuccess(res: Response, message: string, data: unknown = {}): void {
  res.status(200).json({ success: true, message, data })
}

export function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, message, data: null })
}
