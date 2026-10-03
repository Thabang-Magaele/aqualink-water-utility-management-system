import {
  publishOutage as publish,
  sendNotification as send,
  MAX_DIRECT_RECIPIENTS,
} from '../shared/communicationsStore'
import { HttpError, requireRole, sendSuccess, type Handler } from '../shared/http'
import { areasOf, parseOutage } from '../shared/outageRules'
import { bodyOf, idempotencyKey, internalLink, text } from '../shared/validate'

/**
 * POST /api/publishOutage
 *   { idempotencyKey, title, description, affectedAreas[], startTime, expectedResolution?, severity, status }
 * Communications / admin. Customers in the affected areas are notified automatically.
 */
export const publishOutage: Handler = async (req, res, caller) => {
  requireRole(caller, ['admin', 'communications'])
  const body = bodyOf(req.body)
  const key = idempotencyKey(body)
  const notice = parseOutage(body)
  const result = await publish(notice, key, caller)
  sendSuccess(
    res,
    result.repeated ? 'This notice was already published.' : 'Outage notice published.',
    result,
  )
}

/**
 * POST /api/sendNotification
 *   { idempotencyKey, title, message, link?, userIds[] }   or   { …, areas[] }
 * Communications / admin. An in-app message to named users, or to every customer
 * with a property in the given areas.
 */
export const sendNotification: Handler = async (req, res, caller) => {
  requireRole(caller, ['admin', 'communications'])
  const body = bodyOf(req.body)
  const hasUsers = body.userIds !== undefined
  const hasAreas = body.areas !== undefined
  if (hasUsers === hasAreas) throw new HttpError(400, 'Send either "userIds" or "areas", not both.')
  let userIds: string[] | null = null
  if (hasUsers) {
    if (
      !Array.isArray(body.userIds) ||
      body.userIds.length === 0 ||
      body.userIds.some((u) => typeof u !== 'string' || !u || u.includes('/'))
    )
      throw new HttpError(400, '"userIds" must be a list of user IDs.')
    if (body.userIds.length > MAX_DIRECT_RECIPIENTS)
      throw new HttpError(400, `At most ${MAX_DIRECT_RECIPIENTS} users per message.`)
    userIds = body.userIds as string[]
  }
  const result = await send(
    {
      key: idempotencyKey(body),
      title: text(body, 'title', { max: 120 }),
      message: text(body, 'message', { max: 1000 }),
      link: internalLink(body, 'link'),
      userIds,
      areas: hasAreas ? areasOf(body, 'areas') : null,
    },
    caller,
  )
  sendSuccess(res, `Sent to ${result.sent} of ${result.recipients} recipient(s).`, result)
}
