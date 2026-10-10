import { ApiError, gfetch } from './gfetch'
import { dayQueryRange, localDateTime, wallClockMinutes } from './time'
import type { Interval } from '../scheduler'

// Every event Crossoff creates carries this private tag; finding, replacing
// and clearing only ever touch events that have it.
const TAG = { planner: 'true' }
/** Google's "Blueberry" event color. */
const PLANNER_COLOR = '9'

export interface PlannerEvent extends Interval {
  id: string
  title: string
}

interface EventsResponse {
  items: {
    id: string
    summary?: string
    start: { dateTime?: string }
    end: { dateTime?: string }
  }[]
}

/** Crossoff's own events on `date` in the main calendar. */
export async function listPlannerEvents(
  date: string,
  timeZone: string,
): Promise<PlannerEvent[]> {
  const params = new URLSearchParams({
    ...dayQueryRange(date),
    privateExtendedProperty: 'planner=true',
    singleEvents: 'true',
    maxResults: '250',
    fields: 'items(id,summary,start,end)',
  })
  const { items } = await gfetch<EventsResponse>(
    `/calendars/primary/events?${params}`,
  )
  return items
    .filter((e) => e.start.dateTime && e.end.dateTime)
    .map((e) => ({
      id: e.id,
      title: e.summary ?? '',
      start: wallClockMinutes(e.start.dateTime!, date, timeZone),
      end: wallClockMinutes(e.end.dateTime!, date, timeZone),
    }))
    .filter((e) => e.end > e.start)
    .sort((a, b) => a.start - b.start)
}

/** Creates one tagged session event in the main calendar; returns its id. */
export async function createSessionEvent(
  session: Interval & { title: string },
  date: string,
  timeZone: string,
): Promise<string> {
  const { id } = await gfetch<{ id: string }>(
    '/calendars/primary/events?fields=id',
    {
      method: 'POST',
      body: JSON.stringify({
        summary: session.title,
        description: 'Planned with Crossoff.',
        start: { dateTime: localDateTime(date, session.start), timeZone },
        end: { dateTime: localDateTime(date, session.end), timeZone },
        colorId: PLANNER_COLOR,
        extendedProperties: { private: TAG },
      }),
    },
  )
  return id
}

/** Thrown when deleting stops partway; `remainingIds` were not deleted. */
export class DeleteError extends Error {
  readonly remainingIds: string[]
  readonly cause: unknown
  constructor(remainingIds: string[], cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.remainingIds = remainingIds
    this.cause = cause
  }
}

/**
 * Deletes planner events by id, one at a time. Ids must come from
 * listPlannerEvents or createSessionEvent, so only tagged events are ever
 * deleted. Events already gone count as deleted.
 */
export async function deletePlannerEvents(ids: string[]): Promise<void> {
  for (const [i, id] of ids.entries()) {
    try {
      await gfetch(`/calendars/primary/events/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
    } catch (error) {
      const gone =
        error instanceof ApiError &&
        (error.status === 404 || error.status === 410)
      if (!gone) throw new DeleteError(ids.slice(i), error)
    }
  }
}
