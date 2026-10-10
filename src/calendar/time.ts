import type { Minutes } from '../scheduler'

const DAY = 24 * 60

/** The browser's time zone, e.g. "America/New_York". */
export const browserTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone

/**
 * A query range sure to cover `date` in any time zone (UTC−12 to UTC+14):
 * noon UTC the day before to noon UTC the day after. Anything outside the
 * local day is clipped by wallClockMinutes.
 */
export function dayQueryRange(date: string) {
  const noon = Date.parse(`${date}T12:00:00Z`)
  return {
    timeMin: new Date(noon - DAY * 60_000).toISOString(),
    timeMax: new Date(noon + DAY * 60_000).toISOString(),
  }
}

/**
 * An instant as wall-clock minutes on `date` in `timeZone`: 0 if it falls
 * before that day, 1440 if after. Wall-clock time is what the planner works
 * in, so a 9 am meeting is 540 even on a daylight-saving day.
 */
export function wallClockMinutes(
  instant: string,
  date: string,
  timeZone: string,
): Minutes {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  )
  const day = `${parts.year}-${parts.month}-${parts.day}`
  if (day < date) return 0
  if (day > date) return DAY
  return Number(parts.hour) * 60 + Number(parts.minute)
}
