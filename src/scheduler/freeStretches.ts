import {
  MIN_STRETCH,
  mergeIntervals,
  roundDown,
  roundUp,
  subtractIntervals,
} from './intervals'
import type { Interval, Minutes, Settings } from './types'

/** Calendar events expanded by the buffer on both sides, then merged. */
export function blockedTime(busy: Interval[], bufferMinutes: number) {
  return mergeIntervals(
    busy.map((b) => ({
      start: b.start - bufferMinutes,
      end: b.end + bufferMinutes,
    })),
  )
}

/** The earliest minute anything can be planned: `now` rounded up, or 0. */
export const cutoffFor = (now?: Minutes) =>
  now === undefined ? 0 : roundUp(now)

/**
 * Free stretches of the working window: after `now` (when re-planning),
 * clear of buffered events, snapped to 5-minute marks, at least 15 minutes.
 */
export function buildFreeStretches(
  busy: Interval[],
  settings: Settings,
  now?: Minutes,
): Interval[] {
  const { workingWindow, bufferMinutes } = settings
  const start = Math.max(workingWindow.start, cutoffFor(now))
  if (start >= workingWindow.end) return []
  return subtractIntervals(
    { start, end: workingWindow.end },
    blockedTime(busy, bufferMinutes),
  )
    .map((i) => ({ start: roundUp(i.start), end: roundDown(i.end) }))
    .filter((i) => i.end - i.start >= MIN_STRETCH)
}
