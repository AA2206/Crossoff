import { describe, expect, it } from 'vitest'
import { dayQueryRange, wallClockMinutes } from './time'

const NY = 'America/New_York'

describe('wallClockMinutes', () => {
  it('converts an instant to minutes since local midnight', () => {
    // 9:30 am EDT is 13:30 UTC.
    expect(wallClockMinutes('2026-10-12T13:30:00Z', '2026-10-12', NY)).toBe(570)
  })

  it('clips instants on the day before or after', () => {
    expect(wallClockMinutes('2026-10-12T03:00:00Z', '2026-10-12', NY)).toBe(0)
    expect(wallClockMinutes('2026-10-13T05:00:00Z', '2026-10-12', NY)).toBe(
      1440,
    )
  })

  it('handles offsets other than UTC in the instant', () => {
    expect(
      wallClockMinutes('2026-10-12T09:00:00-04:00', '2026-10-12', NY),
    ).toBe(540)
  })

  describe('on daylight-saving days', () => {
    it('keeps wall-clock time on the day clocks go back (Nov 1, 2026)', () => {
      // After 2 am the offset is −5, so 9 am EST is 14:00 UTC.
      expect(wallClockMinutes('2026-11-01T14:00:00Z', '2026-11-01', NY)).toBe(
        540,
      )
      // Before the change, 12:30 am EDT is 04:30 UTC.
      expect(wallClockMinutes('2026-11-01T04:30:00Z', '2026-11-01', NY)).toBe(
        30,
      )
    })

    it('keeps wall-clock time on the day clocks go forward (Mar 14, 2027)', () => {
      // 9 am EDT is 13:00 UTC; 1 am EST, before the jump, is 06:00 UTC.
      expect(wallClockMinutes('2027-03-14T13:00:00Z', '2027-03-14', NY)).toBe(
        540,
      )
      expect(wallClockMinutes('2027-03-14T06:00:00Z', '2027-03-14', NY)).toBe(
        60,
      )
    })
  })

  it('works far from UTC', () => {
    // 9 am in Kiritimati (UTC+14) is 19:00 UTC the previous day.
    expect(
      wallClockMinutes(
        '2026-10-11T19:00:00Z',
        '2026-10-12',
        'Pacific/Kiritimati',
      ),
    ).toBe(540)
    // 9 am in Pago Pago (UTC−11) is 20:00 UTC the same day.
    expect(
      wallClockMinutes(
        '2026-10-12T20:00:00Z',
        '2026-10-12',
        'Pacific/Pago_Pago',
      ),
    ).toBe(540)
  })
})

describe('dayQueryRange', () => {
  it('spans noon UTC the day before to noon UTC the day after', () => {
    expect(dayQueryRange('2026-10-12')).toEqual({
      timeMin: '2026-10-11T12:00:00.000Z',
      timeMax: '2026-10-13T12:00:00.000Z',
    })
  })
})
