import { STEP, length, roundDown, roundUp } from './intervals'
import type { PlaceContext } from './placeSessions'
import { requiredMinutes, setAsideFree, setAsideFreeMinutes } from './setAsides'
import type { Interval, PlacedSession } from './types'

export interface SpreadContext extends PlaceContext {
  workingWindow: Interval
}

interface Edges {
  /** The stretch starts right after a calendar event. */
  leading: boolean
  /** The stretch ends right before a calendar event. */
  trailing: boolean
}

/**
 * Spread out mode: within each free stretch, shares the slack evenly between
 * sessions, and before or after them where the stretch meets a calendar event.
 * Sessions keep their order and stretch, so the priority order is untouched.
 * A stretch that can't be spread without breaking a set-aside stays packed.
 */
export function spreadSessions(
  placed: PlacedSession[],
  ctx: SpreadContext,
): PlacedSession[] {
  const required = requiredMinutes(ctx.setAsides, ctx.blocked, ctx.cutoff)
  const dayStart = roundUp(Math.max(ctx.workingWindow.start, ctx.cutoff))
  const dayEnd = roundDown(ctx.workingWindow.end)
  let result = [...placed]

  for (const stretch of ctx.stretches) {
    const inStretch = result.filter(
      (s) => s.start >= stretch.start && s.end <= stretch.end,
    )
    if (inStretch.length === 0) continue
    const others = result.filter((s) => !inStretch.includes(s))

    // Set-asides whose block can only be in this stretch reserve time in it.
    const reserves = ctx.setAsides
      .filter((s) => {
        const need = required.get(s.id)!
        if (need === 0) return false
        if (s.windowEnd <= stretch.start || s.windowStart >= stretch.end)
          return false
        return !setAsideFree(s, ctx.blocked, result, ctx.cutoff).some(
          (f) =>
            length(f) >= need &&
            (f.end <= stretch.start || f.start >= stretch.end),
        )
      })
      .map((s) => required.get(s.id)!)

    const keepsSetAsides = (layout: PlacedSession[]) =>
      ctx.setAsides.every(
        (s) =>
          setAsideFreeMinutes(
            s,
            ctx.blocked,
            [...others, ...layout],
            ctx.cutoff,
          ) >= required.get(s.id)!,
      )

    const spread = spreadStretch(
      inStretch,
      stretch,
      { leading: stretch.start > dayStart, trailing: stretch.end < dayEnd },
      reserves,
      ctx.minBreakMinutes,
      keepsSetAsides,
    )
    if (spread)
      result = [...others, ...spread].sort((a, b) => a.start - b.start)
  }
  return result
}

/**
 * Tries gap sizes from the widest that fits down to the minimum break, and for
 * each, every way of slotting the reserved set-aside time between sessions.
 * Returns the first layout that keeps every set-aside, or null.
 */
function spreadStretch(
  sessions: PlacedSession[],
  stretch: Interval,
  edges: Edges,
  reserves: number[],
  minBreak: number,
  isValid: (layout: PlacedSession[]) => boolean,
): PlacedSession[] | null {
  const gapCount =
    sessions.length - 1 + Number(edges.leading) + Number(edges.trailing)
  if (gapCount === 0) return null
  const work = sessions.reduce((sum, s) => sum + s.duration, 0)
  const reserved = reserves.reduce((sum, r) => sum + r, 0)
  const widest = roundDown((length(stretch) - work - reserved) / gapCount)

  for (let gap = widest; gap >= minBreak; gap -= STEP) {
    for (const extras of slottings(reserves, sessions.length + 1)) {
      const layout = layOut(sessions, stretch.start, gap, edges, extras)
      const end =
        layout.at(-1)!.end + (edges.trailing ? gap : 0) + extras.at(-1)!
      if (end <= stretch.end && isValid(layout)) return layout
    }
  }
  return null
}

/** Every way of adding each reserve to one of `slots` gaps. */
function* slottings(reserves: number[], slots: number): Generator<number[]> {
  if (reserves.length === 0) {
    yield Array<number>(slots).fill(0)
    return
  }
  const [first, ...rest] = reserves
  for (const extras of slottings(rest, slots)) {
    for (let i = 0; i < slots; i++) {
      const next = [...extras]
      next[i] += first
      yield next
    }
  }
}

function layOut(
  sessions: PlacedSession[],
  start: number,
  gap: number,
  edges: Edges,
  extras: number[],
): PlacedSession[] {
  let t = start
  return sessions.map((s, i) => {
    t += (i > 0 || edges.leading ? gap : 0) + extras[i]
    const placed = { ...s, start: t, end: t + s.duration }
    t = placed.end
    return placed
  })
}
