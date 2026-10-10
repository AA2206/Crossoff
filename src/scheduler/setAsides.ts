import { length, longest, subtractIntervals } from './intervals'
import type { Interval, Minutes, SetAside } from './types'

const overlaps = (a: SetAside, b: SetAside) =>
  a.windowStart < b.windowEnd && b.windowStart < a.windowEnd

/**
 * Time a set-aside block could still use: its window from `cutoff` on, minus
 * buffered calendar events and placed sessions. Breaks between sessions count
 * as free; buffers around events don't. The working window doesn't matter,
 * since nothing is ever planned outside it.
 */
export function setAsideFree(
  setAside: SetAside,
  blocked: Interval[],
  placed: Interval[],
  cutoff: Minutes,
): Interval[] {
  const start = Math.max(setAside.windowStart, cutoff)
  if (start >= setAside.windowEnd) return []
  return subtractIntervals({ start, end: setAside.windowEnd }, [
    ...blocked,
    ...placed,
  ])
}

/** Longest continuous free time left in the set-aside's window. */
export const setAsideFreeMinutes = (
  setAside: SetAside,
  blocked: Interval[],
  placed: Interval[],
  cutoff: Minutes,
) => longest(setAsideFree(setAside, blocked, placed, cutoff))

/**
 * Minutes each set-aside must keep free, by id. A set-aside that calendar
 * events already squeeze keeps whatever it has left, so it is reported rather
 * than blocking every placement.
 */
export const requiredMinutes = (
  setAsides: SetAside[],
  blocked: Interval[],
  cutoff: Minutes,
) =>
  new Map(
    setAsides.map((s) => [
      s.id,
      Math.min(s.durationMinutes, setAsideFreeMinutes(s, blocked, [], cutoff)),
    ]),
  )

/**
 * Whether two set-asides can both be taken without overlapping. Trying each
 * order and taking the first block as early as possible is exhaustive for two.
 */
function canFitBoth(
  a: SetAside,
  b: SetAside,
  blocked: Interval[],
  placed: Interval[],
  cutoff: Minutes,
): boolean {
  const fitsInOrder = (first: SetAside, second: SetAside) => {
    const slot = setAsideFree(first, blocked, placed, cutoff).find(
      (f) => length(f) >= first.durationMinutes,
    )
    if (!slot) return false
    const block = { start: slot.start, end: slot.start + first.durationMinutes }
    return (
      setAsideFreeMinutes(second, blocked, [...placed, block], cutoff) >=
      second.durationMinutes
    )
  }
  return fitsInOrder(a, b) || fitsInOrder(b, a)
}

/** Overlapping pairs that each fit alone but not together. */
export function conflictingPairs(
  setAsides: SetAside[],
  blocked: Interval[],
  placed: Interval[],
  cutoff: Minutes,
): [SetAside, SetAside][] {
  const fitsAlone = (s: SetAside) =>
    setAsideFreeMinutes(s, blocked, placed, cutoff) >= s.durationMinutes
  const pairs: [SetAside, SetAside][] = []
  setAsides.forEach((a, i) => {
    for (const b of setAsides.slice(i + 1)) {
      if (
        overlaps(a, b) &&
        fitsAlone(a) &&
        fitsAlone(b) &&
        !canFitBoth(a, b, blocked, placed, cutoff)
      )
        pairs.push([a, b])
    }
  })
  return pairs
}
