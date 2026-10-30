import type {
  AdminStatus,
  DeviceListResponse,
  SendNotificationRequest,
  SendNotificationResponse,
} from '../types/index.ts'

const DEFAULT_BASE_URL = 'http://localhost:8000'
const REQUEST_TIMEOUT_MS = 10000

export class ApiError extends Error {
  status: number
  isAuthError: boolean

  constructor(message: string, status = 0, isAuthError = false) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.isAuthError = isAuthError
  }
}

function getBaseUrl(): string {
  const url = import.meta.env.VITE_API_BASE_URL
  if (url && typeof url === 'string' && url.trim().length > 0) {
    return url.replace(/\/+$/, '')
  }
  return DEFAULT_BASE_URL
}

async function requestWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(
        'Request timed out. If sending a notification, FCM may have already accepted it; retrying may send duplicate notifications.',
        504
      )
    }
    throw new ApiError(
      'Cannot connect to backend server. Ensure FastAPI is running on port 8000.',
      0
    )
  } finally {
    clearTimeout(timer)
  }
}

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (data && typeof data.detail === 'string') {
      return data.detail
    }
  } catch {
    // Non-JSON error body fallback
  }

  switch (response.status) {
    case 400:
      return 'Bad request. Please check input parameters or device status.'
    case 401:
      return 'Admin access denied: invalid or missing admin API key.'
    case 404:
      return 'Device or endpoint not found.'
    case 410:
      return 'Device token is permanently unregistered with FCM and has been marked inactive.'
    case 502:
      return 'Firebase authentication or provider dispatch error.'
    case 503:
      return 'Service temporarily unavailable (MongoDB or FCM provider).'
    case 504:
      return 'FCM provider timed out. Warning: the notification may have been accepted; retrying manually may cause duplicates.'
    default:
      return `Server responded with error status ${response.status}.`
  }
}

/**
 * Verifies admin key by requesting GET /api/admin/status.
 * Returns the parsed status or throws ApiError.
 */
export async function verifyAdminKey(adminKey: string): Promise<AdminStatus> {
  const url = `${getBaseUrl()}/api/admin/status`

  const response = await requestWithTimeout(url, {
    method: 'GET',
    headers: {
      'X-Admin-Key': adminKey,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const detail = await parseErrorResponse(response)
    throw new ApiError(detail, response.status, response.status === 401)
  }

  const data = (await response.json()) as AdminStatus
  if (!data || typeof data.backend !== 'string' || !data.firebase_admin) {
    throw new ApiError('Unexpected response format from admin status endpoint.')
  }

  return data
}

/**
 * Fetches paginated devices list via GET /api/admin/devices.
 */
export async function fetchDevices(
  adminKey: string,
  limit = 50,
  offset = 0
): Promise<DeviceListResponse> {
  const url = `${getBaseUrl()}/api/admin/devices?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`

  const response = await requestWithTimeout(url, {
    method: 'GET',
    headers: {
      'X-Admin-Key': adminKey,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const detail = await parseErrorResponse(response)
    throw new ApiError(detail, response.status, response.status === 401)
  }

  const data = (await response.json()) as DeviceListResponse
  if (!data || !Array.isArray(data.devices) || typeof data.total !== 'number') {
    throw new ApiError('Unexpected response format from device list endpoint.')
  }

  return data
}

/**
 * Sends push notification to a single registered device via POST /api/admin/notifications/send.
 */
export async function sendNotification(
  adminKey: string,
  payload: SendNotificationRequest
): Promise<SendNotificationResponse> {
  const url = `${getBaseUrl()}/api/admin/notifications/send`

  const response = await requestWithTimeout(url, {
    method: 'POST',
    headers: {
      'X-Admin-Key': adminKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const detail = await parseErrorResponse(response)
    throw new ApiError(detail, response.status, response.status === 401)
  }

  const data = (await response.json()) as SendNotificationResponse
  if (!data || data.status !== 'accepted' || !data.message_id) {
    throw new ApiError('Invalid response received from notification dispatch.')
  }

  return data
}
