import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const token = vi.hoisted(() => ({ value: 'token-123' as string | null }))
vi.mock('../auth/token', () => ({
  getToken: () => token.value,
  clearToken: () => {
    token.value = null
  },
}))

import { ApiError, AuthError, gfetch } from './gfetch'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status })
const rateLimited = (reason: string) =>
  json(403, { error: { message: 'Slow down', errors: [{ reason }] } })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  token.value = 'token-123'
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Runs gfetch while letting backoff timers fire. */
async function call(path = '/test') {
  const result = gfetch(path).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  )
  await vi.runAllTimersAsync()
  return result
}

describe('gfetch', () => {
  it('sends the token and returns the JSON body', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }))
    expect(await call('/calendars')).toEqual({ value: { ok: true } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://www.googleapis.com/calendar/v3/calendars')
    expect(init.headers.Authorization).toBe('Bearer token-123')
  })

  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    expect(await call()).toEqual({ value: undefined })
  })

  it('retries 429 and 5xx, then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(json(429, {}))
      .mockResolvedValueOnce(json(503, {}))
      .mockResolvedValueOnce(json(200, { ok: true }))
    expect(await call()).toEqual({ value: { ok: true } })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retries a 403 with a rate-limit reason', async () => {
    fetchMock
      .mockResolvedValueOnce(rateLimited('userRateLimitExceeded'))
      .mockResolvedValueOnce(json(200, { ok: true }))
    expect(await call()).toEqual({ value: { ok: true } })
  })

  it('does not retry a 403 that means no permission', async () => {
    fetchMock.mockResolvedValueOnce(rateLimited('insufficientPermissions'))
    const { error } = (await call()) as { error: ApiError }
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(403)
    expect(error.reason).toBe('insufficientPermissions')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gives up after 3 retries', async () => {
    fetchMock.mockImplementation(async () =>
      json(500, { error: { message: 'Down' } }),
    )
    const { error } = (await call()) as { error: ApiError }
    expect(error.message).toBe('Down')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('throws AuthError and forgets the token on 401', async () => {
    fetchMock.mockResolvedValueOnce(json(401, {}))
    expect((await call()) as { error: unknown }).toEqual({
      error: expect.any(AuthError),
    })
    expect(token.value).toBeNull()
  })

  it('throws AuthError without calling Google when there is no token', async () => {
    token.value = null
    expect(((await call()) as { error: unknown }).error).toBeInstanceOf(
      AuthError,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
