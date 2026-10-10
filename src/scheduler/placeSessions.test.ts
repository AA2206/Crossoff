import { describe, expect, it } from 'vitest'
import { placeSessions, type PlaceContext } from './placeSessions'
import { rankSessions, splitIntoSessions } from './sessions'
import { describePlaced, hm, iv, task } from './testHelpers'
import type { SetAside, Task } from './types'

const place = (tasks: Task[], ctx: Partial<PlaceContext>) =>
  placeSessions(rankSessions(splitIntoSessions(tasks)), {
    stretches: [iv('9:00', '17:00')],
    setAsides: [],
    blocked: [],
    cutoff: 0,
    minBreakMinutes: 10,
    ...ctx,
  })

const lunch: SetAside = {
  id: 'lunch',
  label: 'Lunch',
  windowStart: hm('12:00'),
  windowEnd: hm('15:00'),
  durationMinutes: 60,
}

describe('placeSessions', () => {
  it('reproduces the worked example from the spec', () => {
    const { placed, unplaced } = place(
      [task('Essay', 120, 2), task('Problem set', 90, 2), task('Email', 30)],
      { stretches: [iv('9:00', '10:30'), iv('11:30', '17:00')] },
    )
    expect(describePlaced(placed)).toEqual([
      'Essay 1 9:00–10:00',
      'Problem set 1 11:30–12:15',
      'Email 1 12:25–12:55',
      'Essay 2 13:05–14:05',
      'Problem set 2 14:15–15:00',
    ])
    expect(unplaced).toEqual([])
  })

  it('keeps the minimum break between sessions', () => {
    const { placed } = place([task('a', 30), task('b', 30)], {
      minBreakMinutes: 25,
    })
    expect(describePlaced(placed)).toEqual(['a 1 9:00–9:30', 'b 1 9:55–10:25'])
  })

  it('allows a session that ends exactly at the end of a stretch', () => {
    const { placed } = place([task('a', 60)], {
      stretches: [iv('9:00', '10:00')],
    })
    expect(describePlaced(placed)).toEqual(['a 1 9:00–10:00'])
  })

  it('fills a gap with a lower-ranked session that fits', () => {
    const { placed } = place([task('long', 60), task('short', 20)], {
      stretches: [iv('9:00', '9:30'), iv('10:00', '12:00')],
    })
    expect(describePlaced(placed)).toEqual([
      'short 1 9:00–9:20',
      'long 1 10:00–11:00',
    ])
  })

  it('returns sessions that do not fit as unplaced', () => {
    const { placed, unplaced } = place([task('a', 180, 3)], {
      stretches: [iv('9:00', '10:00'), iv('11:00', '12:00')],
    })
    expect(placed).toHaveLength(2)
    expect(unplaced.map((s) => s.round)).toEqual([3])
  })

  describe('set-aside blocks', () => {
    const fiveHours = ['a', 'b', 'c', 'd', 'e'].map((id) => task(id, 60))

    it('steps forward until a session leaves the block free', () => {
      const { placed } = place(fiveHours, { setAsides: [lunch] })
      expect(describePlaced(placed)).toEqual([
        'a 1 9:00–10:00',
        'b 1 10:10–11:10',
        'c 1 11:20–12:20',
        'd 1 12:30–13:30',
        'e 1 14:30–15:30',
      ])
    })

    it('leaves the block free even when the window is otherwise fully used', () => {
      const { placed } = place([task('a', 60, 8)], {
        setAsides: [lunch],
        minBreakMinutes: 0,
      })
      const taken = placed.filter(
        (s) => s.start < lunch.windowEnd && s.end > lunch.windowStart,
      )
      expect(
        taken.reduce((sum, s) => sum + (s.end - s.start), 0),
      ).toBeLessThanOrEqual(
        lunch.windowEnd - lunch.windowStart - lunch.durationMinutes,
      )
    })

    it('still protects what is left of a block events already squeeze', () => {
      // Busy 12:00–13:30 leaves only 90 continuous minutes of a 120-minute block.
      const { placed } = place([task('a', 30, 6)], {
        stretches: [iv('9:00', '12:00'), iv('13:30', '17:00')],
        blocked: [iv('12:00', '13:30')],
        setAsides: [{ ...lunch, durationMinutes: 120 }],
      })
      expect(
        placed.some((s) => s.start < lunch.windowEnd && s.end > hm('13:30')),
      ).toBe(false)
      expect(placed).toHaveLength(6)
    })

    it('ignores windows that have already ended', () => {
      const { placed } = place([task('a', 60)], {
        stretches: [iv('16:00', '17:00')],
        cutoff: hm('16:00'),
        setAsides: [lunch],
      })
      expect(describePlaced(placed)).toEqual(['a 1 16:00–17:00'])
    })

    it('counts only the remaining part of a window in progress', () => {
      // At 13:30 lunch can only be 13:30–15:00, so a 60-minute session may
      // overlap it by at most 30 minutes.
      const { placed } = place([task('a', 60)], {
        stretches: [iv('13:30', '17:00')],
        cutoff: hm('13:30'),
        setAsides: [lunch],
      })
      expect(describePlaced(placed)).toEqual(['a 1 14:30–15:30'])
    })
  })
})
