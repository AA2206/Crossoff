import type { Interval, Minutes } from './types'

/** Scheduling granularity: every session starts and ends on a 5-minute mark. */
export const STEP = 5

/** Free time shorter than this is never used. */
export const MIN_STRETCH = 15

export const roundUp = (m: Minutes) => Math.ceil(m / STEP) * STEP
export const roundDown = (m: Minutes) => Math.floor(m / STEP) * STEP

export const length = (i: Interval) => i.end - i.start

/** Sorts and merges overlapping or touching intervals; drops empty ones. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start)
  const merged: Interval[] = []
  for (const i of sorted) {
    const last = merged.at(-1)
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end)
    else merged.push({ ...i })
  }
  return merged
}

/** The parts of `from` not covered by any of `remove`, in order. */
export function subtractIntervals(
  from: Interval,
  remove: Interval[],
): Interval[] {
  const result: Interval[] = []
  let cursor = from.start
  for (const r of mergeIntervals(remove)) {
    if (r.end <= cursor) continue
    if (r.start >= from.end) break
    if (r.start > cursor) result.push({ start: cursor, end: r.start })
    cursor = Math.max(cursor, r.end)
  }
  if (cursor < from.end) result.push({ start: cursor, end: from.end })
  return result
}

/** Length of the longest interval, or 0 if there are none. */
export const longest = (intervals: Interval[]) =>
  Math.max(0, ...intervals.map(length))
