import { HttpError, requireRole, sendSuccess, type Handler } from '../shared/http'
import { applyRole, isRole } from '../shared/roles'

/**
 * POST /api/setUserRole  { uid: string, role: Role }
 * Admin only. Changes a user's role.
 */
export const setUserRole: Handler = async (req, res, caller) => {
  requireRole(caller, ['admin'])

  const { uid, role } = (req.body ?? {}) as { uid?: unknown; role?: unknown }
  if (typeof uid !== 'string' || uid.length === 0 || uid.length > 128) {
    throw new HttpError(400, 'A valid user ID is required.')
  }
  if (!isRole(role)) {
    throw new HttpError(400, 'Choose a valid role.')
  }
  if (uid === caller.uid && role !== 'admin') {
    throw new HttpError(400, "You can't remove your own administrator role.")
  }

  try {
    await applyRole(uid, role)
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/user-not-found') {
      throw new HttpError(404, 'That user does not exist.')
    }
    throw error
  }

  sendSuccess(res, 'Role updated.', { uid, role })
}
