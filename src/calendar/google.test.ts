import { beforeEach, describe, expect, it, vi } from 'vitest'

const gfetch = vi.hoisted(() => vi.fn())
vi.mock('./gfetch', () => ({ gfetch }))

import { getBusy, listCalendars } from './google'

beforeEach(() => gfetch.mockReset())

describe('listCalendars', () => {
  it("names the main calendar 'primary' and lists it first", async () => {
    gfetch.mockResolvedValueOnce({
      items: [
        { id: 'team@group.calendar.google.com', summary: 'Team' },
        { id: 'me@gmail.com', summary: 'Me', primary: true },
      ],
    })
    expect(await listCalendars()).toEqual([
      { id: 'primary', name: 'Me', primary: true },
      { id: 'team@group.calendar.google.com', name: 'Team', primary: false },
    ])
  })
})

describe('getBusy', () => {
  const NY = 'America/New_York'

  it('asks freeBusy about the day and converts busy times to minutes', async () => {
    gfetch.mockResolvedValueOnce({
      calendars: {
        primary: {
          busy: [
            { start: '2026-10-12T14:00:00Z', end: '2026-10-12T15:00:00Z' },
          ],
        },
        team: {
          busy: [
            // 11 pm the night before to 1 am: only the last hour counts.
            { start: '2026-10-12T03:00:00Z', end: '2026-10-12T05:00:00Z' },
            // Entirely the day before: dropped.
            { start: '2026-10-11T14:00:00Z', end: '2026-10-11T15:00:00Z' },
          ],
        },
      },
    })
    const result = await getBusy('2026-10-12', ['primary', 'team'], NY)
    expect(result).toEqual({
      busy: [
        { start: 600, end: 660 },
        { start: 0, end: 60 },
      ],
      failedCalendarIds: [],
    })
    const [path, init] = gfetch.mock.calls[0]
    expect(path).toBe('/freeBusy')
    expect(JSON.parse(init.body)).toEqual({
      timeMin: '2026-10-11T12:00:00.000Z',
      timeMax: '2026-10-13T12:00:00.000Z',
      timeZone: NY,
      items: [{ id: 'primary' }, { id: 'team' }],
    })
  })

  it('reports calendars Google could not read', async () => {
    gfetch.mockResolvedValueOnce({
      calendars: {
        primary: { busy: [] },
        gone: { errors: [{ domain: 'global', reason: 'notFound' }] },
      },
    })
    expect(await getBusy('2026-10-12', ['primary', 'gone'], NY)).toEqual({
      busy: [],
      failedCalendarIds: ['gone'],
    })
  })

  it('accepts the primary calendar keyed by its address', async () => {
    gfetch.mockResolvedValueOnce({
      calendars: {
        'me@gmail.com': {
          busy: [
            { start: '2026-10-12T13:00:00Z', end: '2026-10-12T13:30:00Z' },
          ],
        },
      },
    })
    expect(await getBusy('2026-10-12', ['primary'], NY)).toEqual({
      busy: [{ start: 540, end: 570 }],
      failedCalendarIds: [],
    })
  })
})
