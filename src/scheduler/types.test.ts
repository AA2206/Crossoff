import { describe, expect, it } from 'vitest'
import type { Interval } from './types'

describe('scheduler scaffold', () => {
  it('represents times as minutes since midnight', () => {
    const morning: Interval = { start: 9 * 60, end: 10 * 60 + 30 }
    expect(morning.end - morning.start).toBe(90)
  })
})
