import { describe, expect, it } from 'vitest'
import { rankSessions, splitIntoSessions } from './sessions'
import { task } from './testHelpers'

const durations = (totalMinutes: number, sessions: number) =>
  splitIntoSessions([task('t', totalMinutes, sessions)]).map((s) => s.duration)

describe('splitIntoSessions', () => {
  it('splits evenly when it divides into 5-minute blocks', () => {
    expect(durations(120, 2)).toEqual([60, 60])
    expect(durations(45, 1)).toEqual([45])
  })

  it('gives the rounding remainder to the first session', () => {
    expect(durations(50, 3)).toEqual([20, 15, 15])
  })

  it('spreads a remainder over 5 minutes in 5-minute steps from the start', () => {
    expect(durations(100, 3)).toEqual([35, 35, 30])
    expect(durations(90, 5)).toEqual([20, 20, 20, 15, 15])
  })

  it('always preserves the total and stays on 5-minute marks', () => {
    for (let total = 15; total <= 300; total += 5) {
      for (let sessions = 1; total / sessions >= 15; sessions++) {
        const d = durations(total, sessions)
        expect(d.reduce((a, b) => a + b)).toBe(total)
        expect(d.every((m) => m % 5 === 0 && m >= 15)).toBe(true)
      }
    }
  })

  it('labels each session with its task, position and round', () => {
    expect(splitIntoSessions([task('a', 60, 2), task('b', 30)])).toEqual([
      {
        taskId: 'a',
        taskIndex: 0,
        round: 1,
        rounds: 2,
        duration: 30,
      },
      {
        taskId: 'a',
        taskIndex: 0,
        round: 2,
        rounds: 2,
        duration: 30,
      },
      {
        taskId: 'b',
        taskIndex: 1,
        round: 1,
        rounds: 1,
        duration: 30,
      },
    ])
  })
})

describe('rankSessions', () => {
  const ids = (tasks: ReturnType<typeof task>[]) =>
    rankSessions(splitIntoSessions(tasks)).map((s) => `${s.taskId}${s.round}`)

  it('gives every task its first session before any task gets a second', () => {
    expect(ids([task('a', 90, 3), task('b', 30)])).toEqual([
      'a1',
      'b1',
      'a2',
      'a3',
    ])
  })

  it('orders by list position within a round', () => {
    expect(ids([task('first', 60, 2), task('second', 60, 2)])).toEqual([
      'first1',
      'second1',
      'first2',
      'second2',
    ])
    expect(ids([task('x', 30), task('y', 30), task('w', 30)])).toEqual([
      'x1',
      'y1',
      'w1',
    ])
  })
})
