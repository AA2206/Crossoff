import { describe, expect, it } from 'vitest'
import { plan } from './plan'
import { placeSessions } from './placeSessions'
import { rankSessions, splitIntoSessions } from './sessions'
import { spreadSessions, type SpreadContext } from './spreadSessions'
import { describePlaced, hm, iv, settings, task } from './testHelpers'
import type { SetAside, Task } from './types'

const spread = (tasks: Task[], overrides: Partial<SpreadContext> = {}) => {
  const ctx: SpreadContext = {
    stretches: [iv('9:00', '17:00')],
    setAsides: [],
    blocked: [],
    cutoff: 0,
    minBreakMinutes: 10,
    workingWindow: iv('9:00', '17:00'),
    ...overrides,
  }
  const { placed } = placeSessions(rankSessions(splitIntoSessions(tasks)), ctx)
  return describePlaced(spreadSessions(placed, ctx))
}

const lunch: SetAside = {
  id: 'lunch',
  label: 'Lunch',
  windowStart: hm('12:00'),
  windowEnd: hm('15:00'),
  durationMinutes: 60,
}

describe('spreadSessions', () => {
  it('spreads the worked example, adding a gap after the 10:30–11:30 event', () => {
    expect(
      spread(
        [
          task('Essay', 1, 120, 2),
          task('Problem set', 2, 90, 2),
          task('Email', 3, 30),
        ],
        {
          stretches: [iv('9:00', '10:30'), iv('11:30', '17:00')],
          blocked: [iv('10:30', '11:30')],
        },
      ),
    ).toEqual([
      'Essay 1 9:00–10:00',
      'Problem set 1 12:05–12:50',
      'Email 1 13:25–13:55',
      'Essay 2 14:30–15:30',
      'Problem set 2 16:05–16:50',
    ])
  })

  it('adds no gap at the start or end of the working window', () => {
    expect(spread([task('a', 1, 60), task('b', 2, 60)])).toEqual([
      'a 1 9:00–10:00',
      'b 1 16:00–17:00',
    ])
  })

  it('centres a lone session between two calendar events', () => {
    expect(
      spread([task('a', 1, 60)], {
        stretches: [iv('10:10', '13:50')],
        blocked: [iv('9:00', '10:10'), iv('13:50', '17:00')],
      }),
    ).toEqual(['a 1 11:30–12:30'])
  })

  it('leaves a lone session with no event edges where it is', () => {
    expect(spread([task('a', 1, 60)])).toEqual(['a 1 9:00–10:00'])
  })

  it('does not treat the re-plan cutoff as an event edge', () => {
    expect(
      spread([task('a', 1, 60), task('b', 2, 60)], {
        stretches: [iv('13:00', '17:00')],
        cutoff: hm('13:00'),
      }),
    ).toEqual(['a 1 13:00–14:00', 'b 1 16:00–17:00'])
  })

  it('leaves a stretch packed when spreading would break the minimum break', () => {
    expect(
      spread([task('a', 1, 60), task('b', 2, 60)], {
        stretches: [iv('9:00', '11:15')],
        workingWindow: iv('9:00', '11:15'),
        minBreakMinutes: 15,
      }),
    ).toEqual(['a 1 9:00–10:00', 'b 1 10:15–11:15'])
  })

  it('rounds gaps down to 5 minutes, leaving the remainder at the end', () => {
    // 480 - 3 × 60 = 300 minutes of slack over 2 gaps.
    expect(
      spread([task('a', 1, 60), task('b', 2, 60), task('c', 3, 60)], {
        stretches: [iv('9:00', '17:05')],
        workingWindow: iv('9:00', '17:05'),
      }),
    ).toEqual(['a 1 9:00–10:00', 'b 1 12:30–13:30', 'c 1 16:00–17:00'])
  })

  it('keeps a set-aside block free while spreading', () => {
    const result = spread(
      ['a', 'b', 'c', 'd', 'e'].map((id, i) => task(id, i + 1, 60)),
      { setAsides: [lunch] },
    )
    // 480 - 300 - 60 for lunch = 120 minutes over 4 gaps; lunch fits 12–1.
    expect(result).toEqual([
      'a 1 9:00–10:00',
      'b 1 10:30–11:30',
      'c 1 13:00–14:00',
      'd 1 14:30–15:30',
      'e 1 16:00–17:00',
    ])
  })

  it('is used by plan() only in Spread out mode', () => {
    const input = {
      tasks: [task('a', 1, 60), task('b', 2, 60)],
      setAsides: [],
      busy: [],
    }
    expect(
      describePlaced(
        plan({ ...input, settings: settings({ mode: 'spread' }) }).placed,
      ),
    ).toEqual(['a 1 9:00–10:00', 'b 1 21:00–22:00'])
    expect(
      describePlaced(
        plan({ ...input, settings: settings({ mode: 'finish-early' }) }).placed,
      ),
    ).toEqual(['a 1 9:00–10:00', 'b 1 10:10–11:10'])
  })
})
