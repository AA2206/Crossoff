import { describe, expect, it } from 'vitest'
import { plan } from './plan'
import { describePlaced, hm, iv, settings, task } from './testHelpers'
import type { SetAside } from './types'

const setAside = (
  id: string,
  windowStart: string,
  windowEnd: string,
  durationMinutes: number,
): SetAside => ({
  id,
  label: id,
  windowStart: hm(windowStart),
  windowEnd: hm(windowEnd),
  durationMinutes,
})

describe('plan', () => {
  it('runs the worked example end to end from calendar events', () => {
    const result = plan({
      tasks: [
        task('Essay', 120, 2),
        task('Problem set', 90, 2),
        task('Email', 30),
      ],
      setAsides: [],
      settings: settings({ workingWindow: iv('9:00', '17:00') }),
      busy: [iv('10:40', '11:20')],
    })
    expect(describePlaced(result.placed)).toEqual([
      'Essay 1 9:00–10:00',
      'Problem set 1 11:30–12:15',
      'Email 1 12:25–12:55',
      'Essay 2 13:05–14:05',
      'Problem set 2 14:15–15:00',
    ])
    expect(result.unscheduled).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('plans a realistic day around meetings, lunch and gym', () => {
    const result = plan({
      tasks: [
        task('Essay', 180, 3),
        task('Problem set', 90, 2),
        task('Reading', 60),
        task('Email', 30),
      ],
      setAsides: [
        setAside('Lunch', '12:00', '15:00', 60),
        setAside('Gym', '17:00', '21:00', 90),
      ],
      settings: settings(),
      busy: [iv('10:00', '11:00'), iv('14:00', '15:30'), iv('19:00', '19:30')],
    })
    // Free: 9:00–9:50, 11:10–13:50, 15:40–18:50, 19:40–22:00. Lunch needs an
    // hour inside 12:00–13:50 and Gym 90 minutes inside 17:00–18:50 (the
    // 19:40–21:00 gap is too short), so both stay clear and Essay 3 is left over.
    expect(describePlaced(result.placed)).toEqual([
      'Problem set 1 9:00–9:45',
      'Essay 1 11:10–12:10',
      'Email 1 12:20–12:50',
      'Reading 1 15:40–16:40',
      'Essay 2 19:40–20:40',
      'Problem set 2 20:50–21:35',
    ])
    expect(result.unscheduled).toEqual([
      {
        taskId: 'Essay',
        name: 'Essay',
        placedSessions: 2,
        totalSessions: 3,
        unscheduledMinutes: 60,
      },
    ])
    expect(result.warnings).toEqual([])
  })

  it('reports unplaced sessions grouped by task', () => {
    const result = plan({
      tasks: [task('Essay', 120, 3), task('Email', 30)],
      setAsides: [],
      settings: settings({ workingWindow: iv('9:00', '11:10') }),
      busy: [],
    })
    expect(result.unscheduled).toEqual([
      {
        taskId: 'Essay',
        name: 'Essay',
        placedSessions: 2,
        totalSessions: 3,
        unscheduledMinutes: 40,
      },
    ])
  })

  it('reports every task when nothing fits', () => {
    const result = plan({
      tasks: [task('a', 60), task('b', 30, 2)],
      setAsides: [],
      settings: settings(),
      busy: [iv('8:00', '23:00')],
    })
    expect(result.placed).toEqual([])
    expect(
      result.unscheduled.map((u) => [u.taskId, u.unscheduledMinutes]),
    ).toEqual([
      ['a', 60],
      ['b', 30],
    ])
  })

  it('only plans after the current time when re-planning', () => {
    const result = plan({
      tasks: [task('a', 60)],
      setAsides: [],
      settings: settings(),
      busy: [],
      now: hm('15:42'),
    })
    expect(describePlaced(result.placed)).toEqual(['a 1 15:45–16:45'])
  })

  describe('set-aside warnings', () => {
    it('warns when events leave too little time in a window', () => {
      const result = plan({
        tasks: [task('a', 60)],
        setAsides: [setAside('Gym', '18:00', '21:00', 90)],
        settings: settings({ bufferMinutes: 0 }),
        busy: [iv('19:00', '20:00')],
      })
      expect(result.warnings).toEqual([
        {
          kind: 'set-aside-short',
          setAsideId: 'Gym',
          label: 'Gym',
          freeMinutes: 60,
          durationMinutes: 90,
        },
      ])
      // The squeezed window doesn't stop the rest of the day being planned.
      expect(describePlaced(result.placed)).toEqual(['a 1 9:00–10:00'])
    })

    it('does not warn about windows that have already ended', () => {
      const result = plan({
        tasks: [],
        setAsides: [setAside('Lunch', '12:00', '15:00', 60)],
        settings: settings(),
        busy: [],
        now: hm('16:00'),
      })
      expect(result.warnings).toEqual([])
    })

    it('warns about the rest of a window in progress being too short', () => {
      const result = plan({
        tasks: [],
        setAsides: [setAside('Lunch', '12:00', '15:00', 60)],
        settings: settings(),
        busy: [],
        now: hm('14:20'),
      })
      expect(result.warnings).toMatchObject([
        { kind: 'set-aside-short', freeMinutes: 40 },
      ])
    })

    it('warns when overlapping windows each fit alone but not together', () => {
      const result = plan({
        tasks: [],
        setAsides: [
          setAside('Lunch', '12:00', '14:00', 60),
          setAside('Walk', '12:30', '14:00', 75),
        ],
        settings: settings(),
        busy: [],
      })
      expect(result.warnings).toEqual([
        {
          kind: 'set-aside-conflict',
          setAsideIds: ['Lunch', 'Walk'],
          labels: ['Lunch', 'Walk'],
        },
      ])
    })

    it('does not warn when overlapping windows have room for both', () => {
      const result = plan({
        tasks: [],
        setAsides: [
          setAside('Lunch', '12:00', '15:00', 60),
          setAside('Walk', '13:00', '16:00', 60),
        ],
        settings: settings(),
        busy: [],
      })
      expect(result.warnings).toEqual([])
    })
  })
})
