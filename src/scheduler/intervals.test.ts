import { describe, expect, it } from 'vitest'
import { longest, mergeIntervals, subtractIntervals } from './intervals'
import { iv } from './testHelpers'

describe('mergeIntervals', () => {
  it('merges overlapping and touching intervals, in order', () => {
    expect(
      mergeIntervals([
        iv('13:00', '14:00'),
        iv('9:00', '10:00'),
        iv('9:30', '11:00'),
        iv('11:00', '11:30'),
      ]),
    ).toEqual([iv('9:00', '11:30'), iv('13:00', '14:00')])
  })

  it('drops empty intervals and does not mutate its input', () => {
    const input = [
      iv('9:00', '10:00'),
      iv('9:30', '10:30'),
      iv('12:00', '12:00'),
    ]
    expect(mergeIntervals(input)).toEqual([iv('9:00', '10:30')])
    expect(input[0]).toEqual(iv('9:00', '10:00'))
  })
})

describe('subtractIntervals', () => {
  it('returns the uncovered parts', () => {
    expect(
      subtractIntervals(iv('9:00', '17:00'), [
        iv('10:00', '11:00'),
        iv('8:00', '9:30'),
        iv('16:00', '18:00'),
      ]),
    ).toEqual([iv('9:30', '10:00'), iv('11:00', '16:00')])
  })

  it('returns nothing when fully covered', () => {
    expect(
      subtractIntervals(iv('9:00', '10:00'), [iv('8:00', '11:00')]),
    ).toEqual([])
  })
})

describe('longest', () => {
  it('is 0 for no intervals', () => {
    expect(longest([])).toBe(0)
    expect(longest([iv('9:00', '9:20'), iv('10:00', '10:45')])).toBe(45)
  })
})
