import type { Interval } from '../scheduler'
import { subtractIntervals } from '../scheduler'
import { DeleteError, type PlannerEvent } from './planner'
import type { BusyInterval } from './google'

/**
 * Old planner events a new plan replaces: those that haven't started by
 * `cutoff`. Past and in-progress sessions stay on the calendar.
 */
export const replaceableEvents = (events: PlannerEvent[], cutoff: number) =>
  events.filter((e) => e.start >= cutoff)

/**
 * Busy times with the replaceable planner events taken out, so the new plan
 * can reuse their time. Planner events live in the main calendar, so only its
 * busy times are trimmed.
 */
export function busyForPlanning(
  busy: BusyInterval[],
  replaceable: Interval[],
): BusyInterval[] {
  return busy.flatMap((b) =>
    b.calendarId === 'primary'
      ? subtractIntervals(b, replaceable).map((i) => ({ ...b, ...i }))
      : [b],
  )
}

export type CommitOutcome =
  | { kind: 'done'; createdIds: string[] }
  /** Creating stopped at `failedIndex`; the old plan is untouched. */
  | {
      kind: 'create-failed'
      createdIds: string[]
      failedIndex: number
      error: unknown
    }
  /** The new plan is in; these old events couldn't be removed. */
  | {
      kind: 'remove-failed'
      createdIds: string[]
      leftoverIds: string[]
      error: unknown
    }

/**
 * Creates every session, then removes the events being replaced. Creating
 * first means a failure partway leaves the old plan intact, and Undo only
 * has to delete what was just created.
 */
export async function commitPlan<S>({
  sessions,
  replaceIds,
  create,
  remove,
  onCreated,
}: {
  sessions: S[]
  replaceIds: string[]
  create: (session: S) => Promise<string>
  remove: (ids: string[]) => Promise<void>
  onCreated?: (count: number) => void
}): Promise<CommitOutcome> {
  const createdIds: string[] = []
  for (const [i, session] of sessions.entries()) {
    try {
      createdIds.push(await create(session))
      onCreated?.(createdIds.length)
    } catch (error) {
      return { kind: 'create-failed', createdIds, failedIndex: i, error }
    }
  }
  try {
    await remove(replaceIds)
  } catch (error) {
    return {
      kind: 'remove-failed',
      createdIds,
      leftoverIds:
        error instanceof DeleteError ? error.remainingIds : replaceIds,
      error: error instanceof DeleteError ? error.cause : error,
    }
  }
  return { kind: 'done', createdIds }
}
