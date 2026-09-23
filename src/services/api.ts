/**
 * Client for AquaLink's REST Cloud Functions.
 * Sends the user's Firebase ID token; the server verifies it and checks the role.
 */
import { firebaseConfig, useEmulators } from '../utils/env'
import { auth, FUNCTIONS_REGION } from './firebase'

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (useEmulators
    ? `http://127.0.0.1:5001/${firebaseConfig.projectId}/${FUNCTIONS_REGION}/api`
    : `https://${FUNCTIONS_REGION}-${firebaseConfig.projectId}.cloudfunctions.net/api`)

export class ApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export async function apiPost<T = unknown>(endpoint: string, body: unknown): Promise<T> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new ApiError('Sign in to continue.', 401)

  let response: Response
  try {
    response = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError('AquaLink could not reach the server. Check your connection and try again.')
  }

  let json: ApiResponse<T>
  try {
    json = await response.json()
  } catch {
    throw new ApiError('The server sent an unexpected response. Try again.', response.status)
  }
  if (!response.ok || !json.success) {
    throw new ApiError(json.message || 'The request failed. Try again.', response.status)
  }
  return json.data
}
