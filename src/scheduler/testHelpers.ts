import type { Interval, Minutes, Settings, Task } from './types'

/** '9:30' or '13:05' → minutes since midnight. */
export function hm(time: string): Minutes {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Minutes since midnight → '9:30', for readable assertions. */
export function clock(m: Minutes): string {
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

export const iv = (start: string, end: string): Interval => ({
  start: hm(start),
  end: hm(end),
})

export const settings = (overrides: Partial<Settings> = {}): Settings => ({
  workingWindow: iv('9:00', '22:00'),
  mode: 'finish-early',
  bufferMinutes: 10,
  minBreakMinutes: 10,
  calendarIds: ['primary'],
  ...overrides,
})

export const task = (id: string, totalMinutes: number, sessions = 1): Task => ({
  id,
  name: id,
  totalMinutes,
  sessions,
})

/** Placed sessions as 'Essay 1 9:00–10:00' strings. */
export const describePlaced = (
  placed: { taskId: string; round: number; start: Minutes; end: Minutes }[],
) =>
  placed.map((s) => `${s.taskId} ${s.round} ${clock(s.start)}–${clock(s.end)}`)
