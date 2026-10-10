import type { Interval } from '../scheduler'
import { gfetch } from './gfetch'
import { dayQueryRange, wallClockMinutes } from './time'

export interface CalendarInfo {
  /** 'primary' for the user's main calendar, so saved settings stay portable. */
  id: string
  name: string
  primary: boolean
}

interface CalendarListResponse {
  items: { id: string; summary: string; primary?: boolean }[]
}

/** Calendars whose busy times the user can see, primary first. */
export async function listCalendars(): Promise<CalendarInfo[]> {
  const { items } = await gfetch<CalendarListResponse>(
    '/users/me/calendarList?minAccessRole=freeBusyReader&maxResults=250&fields=items(id,summary,primary)',
  )
  return items
    .map((c) => ({
      id: c.primary ? 'primary' : c.id,
      name: c.summary,
      primary: !!c.primary,
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary))
}

interface FreeBusyResponse {
  calendars: Record<
    string,
    { busy?: { start: string; end: string }[]; errors?: unknown[] }
  >
}

export interface BusyResult {
  busy: Interval[]
  /** Calendars Google couldn't read, e.g. deleted or no longer shared. */
  failedCalendarIds: string[]
}

/**
 * Busy times on `date` (YYYY-MM-DD) across the given calendars, as minutes
 * since midnight in `timeZone`. Only start and end times are returned, never
 * what the events are. Events marked Free, including most all-day events,
 * aren't busy.
 */
export async function getBusy(
  date: string,
  calendarIds: string[],
  timeZone: string,
): Promise<BusyResult> {
  const { calendars } = await gfetch<FreeBusyResponse>('/freeBusy', {
    method: 'POST',
    body: JSON.stringify({
      ...dayQueryRange(date),
      timeZone,
      items: calendarIds.map((id) => ({ id })),
    }),
  })
  const busy: Interval[] = []
  const failedCalendarIds: string[] = []
  const unrequested = Object.keys(calendars).filter(
    (key) => !calendarIds.includes(key),
  )
  for (const id of calendarIds) {
    // Google may key the primary calendar by its address instead of 'primary'.
    const calendar =
      calendars[id] ??
      (id === 'primary' && unrequested.length === 1
        ? calendars[unrequested[0]]
        : undefined)
    if (!calendar || calendar.errors?.length) {
      failedCalendarIds.push(id)
      continue
    }
    for (const b of calendar.busy ?? []) {
      const interval = {
        start: wallClockMinutes(b.start, date, timeZone),
        end: wallClockMinutes(b.end, date, timeZone),
      }
      if (interval.end > interval.start) busy.push(interval)
    }
  }
  return { busy, failedCalendarIds }
}
