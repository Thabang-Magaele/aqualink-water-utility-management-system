/**
 * The REST router behind the `api` function. Every endpoint goes through the same
 * steps: known endpoint → POST → verify the ID token → the handler (which checks the
 * role and validates input) → one JSON shape: { success, message, data }.
 *
 * `authenticate` is injectable so tests can exercise routing, roles and validation
 * without real Firebase ID tokens.
 */
import type { Response } from 'express'
import * as logger from 'firebase-functions/logger'
import type { Request } from 'firebase-functions/v2/https'
import {
  authenticate as verifyToken,
  HttpError,
  sendError,
  sendSuccess,
  type Caller,
  type Handler,
} from './http'

export interface Route {
  handler: Handler
  /** Who may call it, for GET /api and the docs. The handler enforces it. */
  roles: string
  summary: string
}

export function createApiHandler(
  routes: Record<string, Route>,
  authenticate: (req: Request) => Promise<Caller> = verifyToken,
) {
  return async (req: Request, res: Response) => {
    // Works for both /setUserRole (direct URL) and /api/setUserRole (Hosting rewrite).
    const endpoint = req.path.replace(/^\/(api\/?)?/, '').replace(/\/$/, '')
    const started = Date.now()
    let caller: Caller | null = null

    try {
      if (endpoint === '' && req.method === 'GET') {
        return sendSuccess(
          res,
          'AquaLink API. All endpoints take POST with a Firebase ID token: "Authorization: Bearer <token>".',
          {
            endpoints: Object.entries(routes).map(([name, r]) => ({
              method: 'POST',
              path: `/api/${name}`,
              roles: r.roles,
              summary: r.summary,
            })),
          },
        )
      }
      const route = routes[endpoint]
      if (!route) return sendError(res, 404, 'Unknown endpoint. GET /api lists them.')
      if (req.method !== 'POST') return sendError(res, 405, 'Use POST for this endpoint.')

      caller = await authenticate(req)
      await route.handler(req, res, caller)
    } catch (error) {
      if (error instanceof HttpError) return sendError(res, error.status, error.message)
      logger.error(`api/${endpoint} failed`, error)
      sendError(res, 500, 'Something went wrong on the server. Try again.')
    } finally {
      // One structured line per request: filterable in the Firebase console logs
      logger.info('api request', {
        endpoint: endpoint || '(index)',
        method: req.method,
        status: res.statusCode,
        ms: Date.now() - started,
        uid: caller?.uid ?? null,
        role: caller?.role ?? null,
      })
    }
  }
}
