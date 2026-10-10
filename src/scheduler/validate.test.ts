import { describe, expect, it } from 'vitest'
import { hm, iv, settings, task } from './testHelpers'
import { validateSetAside, validateSettings, validateTask } from './validate'

describe('validateTask', () => {
  it('accepts a valid task', () => {
    expect(validateTask(task('Essay', 1, 120, 3))).toEqual({})
  })

  it('requires a name', () => {
    expect(validateTask({ ...task('x', 1, 60), name: '  ' })).toHaveProperty(
      'name',
    )
  })

  it('requires priority 1 to 5', () => {
    expect(validateTask(task('x', 0, 60))).toHaveProperty('priority')
    expect(validateTask(task('x', 6, 60))).toHaveProperty('priority')
  })

  it('requires at least 15 minutes in 5-minute steps', () => {
    expect(validateTask(task('x', 1, 10))).toHaveProperty('totalMinutes')
    expect(validateTask(task('x', 1, 62))).toHaveProperty('totalMinutes')
    expect(validateTask(task('x', 1, NaN))).toHaveProperty('totalMinutes')
  })

  it('requires sessions of at least 15 minutes', () => {
    expect(validateTask(task('x', 1, 60, 0))).toHaveProperty('sessions')
    expect(validateTask(task('x', 1, 60, 5))).toEqual({
      sessions: 'Sessions would be under 15 minutes each',
    })
    expect(validateTask(task('x', 1, 60, 4))).toEqual({})
  })
})

describe('validateSetAside', () => {
  const lunch = {
    id: 'l',
    label: 'Lunch',
    windowStart: hm('12:00'),
    windowEnd: hm('15:00'),
    durationMinutes: 60,
  }

  it('accepts a valid set-aside', () => {
    expect(validateSetAside(lunch)).toEqual({})
  })

  it('requires the duration to fit in the window', () => {
    expect(validateSetAside({ ...lunch, durationMinutes: 200 })).toEqual({
      durationMinutes: 'Longer than its window',
    })
  })

  it('requires the window to end after it starts, including blank times', () => {
    expect(
      validateSetAside({ ...lunch, windowEnd: hm('11:00') }),
    ).toHaveProperty('windowEnd')
    expect(validateSetAside({ ...lunch, windowEnd: NaN })).toHaveProperty(
      'windowEnd',
    )
  })
})

describe('validateSettings', () => {
  it('accepts the defaults', () => {
    expect(validateSettings(settings())).toEqual({})
  })

  it('rejects a working window that ends before it starts', () => {
    expect(
      validateSettings(settings({ workingWindow: iv('17:00', '9:00') })),
    ).toHaveProperty('workingWindow')
  })

  it('rejects negative or off-step gaps', () => {
    expect(validateSettings(settings({ bufferMinutes: -5 }))).toHaveProperty(
      'bufferMinutes',
    )
    expect(validateSettings(settings({ minBreakMinutes: 7 }))).toHaveProperty(
      'minBreakMinutes',
    )
  })
})
