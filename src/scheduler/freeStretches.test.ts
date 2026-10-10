import { describe, expect, it } from 'vitest'
import { buildFreeStretches } from './freeStretches'
import { hm, iv, settings } from './testHelpers'

describe('buildFreeStretches', () => {
  it('is the whole working window on an empty day', () => {
    expect(buildFreeStretches([], settings())).toEqual([iv('9:00', '22:00')])
  })

  it('keeps the buffer free before and after events', () => {
    expect(buildFreeStretches([iv('12:00', '13:00')], settings())).toEqual([
      iv('9:00', '11:50'),
      iv('13:10', '22:00'),
    ])
  })

  it('merges overlapping events', () => {
    expect(
      buildFreeStretches(
        [iv('12:00', '13:00'), iv('12:30', '14:00')],
        settings({ bufferMinutes: 0 }),
      ),
    ).toEqual([iv('9:00', '12:00'), iv('14:00', '22:00')])
  })

  it('treats events closer than two buffers apart as one busy block', () => {
    expect(
      buildFreeStretches(
        [iv('12:00', '13:00'), iv('13:15', '14:00')],
        settings(),
      ),
    ).toEqual([iv('9:00', '11:50'), iv('14:10', '22:00')])
  })

  it('discards stretches shorter than 15 minutes', () => {
    expect(
      buildFreeStretches(
        [iv('9:00', '10:00'), iv('10:10', '11:00')],
        settings({ bufferMinutes: 0 }),
      ),
    ).toEqual([iv('11:00', '22:00')])
  })

  it('keeps a stretch of exactly 15 minutes', () => {
    expect(
      buildFreeStretches(
        [iv('9:00', '10:00'), iv('10:15', '22:00')],
        settings({ bufferMinutes: 0 }),
      ),
    ).toEqual([iv('10:00', '10:15')])
  })

  it('snaps stretches to 5-minute marks', () => {
    expect(
      buildFreeStretches(
        [iv('9:00', '10:07'), iv('12:03', '22:00')],
        settings(),
      ),
    ).toEqual([iv('10:20', '11:50')])
  })

  it('ignores events outside the working window', () => {
    expect(
      buildFreeStretches(
        [iv('7:00', '8:00'), iv('22:30', '23:00')],
        settings(),
      ),
    ).toEqual([iv('9:00', '22:00')])
  })

  describe('when re-planning', () => {
    it('starts at the current time rounded up to 5 minutes', () => {
      expect(buildFreeStretches([], settings(), hm('14:02'))).toEqual([
        iv('14:05', '22:00'),
      ])
    })

    it('uses the working window start if now is earlier', () => {
      expect(buildFreeStretches([], settings(), hm('7:00'))).toEqual([
        iv('9:00', '22:00'),
      ])
    })

    it('is empty once the working window has ended', () => {
      expect(buildFreeStretches([], settings(), hm('22:00'))).toEqual([])
    })

    it('ignores events that have already happened', () => {
      expect(
        buildFreeStretches(
          [iv('10:00', '11:00'), iv('15:00', '16:00')],
          settings(),
          hm('12:00'),
        ),
      ).toEqual([iv('12:00', '14:50'), iv('16:10', '22:00')])
    })
  })
})
