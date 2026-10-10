import { clearToken, getToken } from '../auth/token'

const BASE = 'https://www.googleapis.com/calendar/v3'
const MAX_RETRIES = 3

/** No token, or Google rejected it (401): the UI should offer Reconnect. */
export class AuthError extends Error {
  constructor() {
    super('Your Google connection has expired.')
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly reason: string | undefined
  constructor(status: number, message: string, reason?: string) {
    super(message)
    this.status = status
    this.reason = reason
  }
}

/** 403s that mean "slow down" rather than "not allowed". */
const RATE_LIMIT_REASONS = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'quotaExceeded',
])

interface GoogleErrorBody {
  error?: { message?: string; errors?: { reason?: string }[] }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 0.5s, 1s, 2s… plus up to 250ms of jitter so retries don't line up. */
const backoff = (attempt: number) => 500 * 2 ** attempt + Math.random() * 250

/**
 * Calls the Calendar REST API with the in-memory token. Retries rate limits
 * and server errors up to 3 times with backoff; throws AuthError on 401.
 */
export async function gfetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const token = getToken()
    if (!token) throw new AuthError()
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })
    if (response.ok)
      return (response.status === 204 ? undefined : await response.json()) as T
    if (response.status === 401) {
      clearToken()
      throw new AuthError()
    }

    const body = (await response.json().catch(() => ({}))) as GoogleErrorBody
    const reason = body.error?.errors?.[0]?.reason
    const retryable =
      response.status === 429 ||
      response.status >= 500 ||
      (response.status === 403 && !!reason && RATE_LIMIT_REASONS.has(reason))
    if (!retryable || attempt >= MAX_RETRIES)
      throw new ApiError(
        response.status,
        body.error?.message ?? `Google Calendar error ${response.status}`,
        reason,
      )
    await sleep(backoff(attempt))
  }
}
