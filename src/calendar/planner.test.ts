import { beforeEach, describe, expect, it, vi } from 'vitest'

const gfetch = vi.hoisted(() => vi.fn())
vi.mock('./gfetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./gfetch')>()),
  gfetch,
}))

import { ApiError } from './gfetch'
import {
  DeleteError,
  createSessionEvent,
  deletePlannerEvents,
  listPlannerEvents,
} from './planner'

const NY = 'America/New_York'

beforeEach(() => gfetch.mockReset())

describe('listPlannerEvents', () => {
  it('asks only for tagged events and converts them to minutes', async () => {
    gfetch.mockResolvedValueOnce({
      items: [
        {
          id: 'b',
          summary: 'Email',
          start: { dateTime: '2026-10-12T13:00:00-04:00' },
          end: { dateTime: '2026-10-12T13:30:00-04:00' },
        },
        {
          id: 'a',
          summary: 'Essay (1/2)',
          start: { dateTime: '2026-10-12T09:00:00-04:00' },
          end: { dateTime: '2026-10-12T10:00:00-04:00' },
        },
        // The day before: outside this date once converted.
        {
          id: 'old',
          summary: 'Essay (2/2)',
          start: { dateTime: '2026-10-11T09:00:00-04:00' },
          end: { dateTime: '2026-10-11T10:00:00-04:00' },
        },
      ],
    })
    expect(await listPlannerEvents('2026-10-12', NY)).toEqual([
      { id: 'a', title: 'Essay (1/2)', start: 540, end: 600 },
      { id: 'b', title: 'Email', start: 780, end: 810 },
    ])
    const query = new URLSearchParams(gfetch.mock.calls[0][0].split('?')[1])
    expect(gfetch.mock.calls[0][0]).toMatch(/^\/calendars\/primary\/events\?/)
    expect(query.get('privateExtendedProperty')).toBe('planner=true')
    expect(query.get('singleEvents')).toBe('true')
  })
})

describe('createSessionEvent', () => {
  it('creates a tagged, colored event at local times in the time zone', async () => {
    gfetch.mockResolvedValueOnce({ id: 'new-1' })
    const id = await createSessionEvent(
      { title: 'Essay (1/3)', start: 570, end: 630 },
      '2026-10-12',
      NY,
    )
    expect(id).toBe('new-1')
    const [path, init] = gfetch.mock.calls[0]
    expect(path).toBe('/calendars/primary/events?fields=id')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toMatchObject({
      summary: 'Essay (1/3)',
      start: { dateTime: '2026-10-12T09:30:00', timeZone: NY },
      end: { dateTime: '2026-10-12T10:30:00', timeZone: NY },
      colorId: '9',
      extendedProperties: { private: { planner: 'true' } },
    })
  })
})

describe('deletePlannerEvents', () => {
  it('deletes each event in the main calendar', async () => {
    gfetch.mockResolvedValue(undefined)
    await deletePlannerEvents(['a', 'b'])
    expect(
      gfetch.mock.calls.map(([path, init]) => [path, init.method]),
    ).toEqual([
      ['/calendars/primary/events/a', 'DELETE'],
      ['/calendars/primary/events/b', 'DELETE'],
    ])
  })

  it('treats events that are already gone as deleted', async () => {
    gfetch
      .mockRejectedValueOnce(new ApiError(410, 'Gone'))
      .mockRejectedValueOnce(new ApiError(404, 'Not found'))
      .mockResolvedValueOnce(undefined)
    await expect(deletePlannerEvents(['a', 'b', 'c'])).resolves.toBeUndefined()
  })

  it('stops at the first real failure and reports what is left', async () => {
    gfetch
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ApiError(500, 'Down'))
    const error = await deletePlannerEvents(['a', 'b', 'c']).catch((e) => e)
    expect(error).toBeInstanceOf(DeleteError)
    expect(error.remainingIds).toEqual(['b', 'c'])
    expect(gfetch).toHaveBeenCalledTimes(2)
  })
})
