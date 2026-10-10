import type { Interval } from '../scheduler'

/** A believable day of meetings, the same for every date. */
const SAMPLE_DAY: Interval[] = [
  { start: 10 * 60, end: 11 * 60 },
  { start: 14 * 60, end: 15 * 60 + 30 },
  { start: 19 * 60, end: 19 * 60 + 30 },
]

export async function getMockBusy(_date: string): Promise<Interval[]> {
  return SAMPLE_DAY
}
