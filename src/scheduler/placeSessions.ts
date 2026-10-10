import { STEP, roundUp } from './intervals'
import { requiredMinutes, setAsideFreeMinutes } from './setAsides'
import type {
  Interval,
  Minutes,
  PlacedSession,
  Session,
  SetAside,
} from './types'

export interface PlaceContext {
  stretches: Interval[]
  setAsides: SetAside[]
  /** Buffered, merged calendar events. */
  blocked: Interval[]
  cutoff: Minutes
  minBreakMinutes: number
}

/**
 * Walks through the free stretches and, at each point, places the
 * highest-ranked session that ends by the stretch's end and leaves every
 * set-aside its block. If none is allowed, steps forward 5 minutes.
 */
export function placeSessions(
  ranked: Session[],
  ctx: PlaceContext,
): { placed: PlacedSession[]; unplaced: Session[] } {
  const required = requiredMinutes(ctx.setAsides, ctx.blocked, ctx.cutoff)
  const remaining = [...ranked]
  const placed: PlacedSession[] = []

  const allowed = (candidate: Interval) =>
    ctx.setAsides.every(
      (s) =>
        setAsideFreeMinutes(
          s,
          ctx.blocked,
          [...placed, candidate],
          ctx.cutoff,
        ) >= required.get(s.id)!,
    )

  for (const stretch of ctx.stretches) {
    let t = stretch.start
    while (remaining.length > 0 && t < stretch.end) {
      const i = remaining.findIndex(
        (s) =>
          t + s.duration <= stretch.end &&
          allowed({ start: t, end: t + s.duration }),
      )
      if (i === -1) {
        t += STEP
        continue
      }
      const [session] = remaining.splice(i, 1)
      placed.push({ ...session, start: t, end: t + session.duration })
      t = roundUp(t + session.duration + ctx.minBreakMinutes)
    }
  }
  return { placed, unplaced: remaining }
}
