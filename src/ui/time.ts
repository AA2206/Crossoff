import type { Minutes } from '../scheduler'

const pad = (n: number) => String(n).padStart(2, '0')

/** Minutes → the "HH:MM" value an <input type="time"> uses. */
export const toInputTime = (m: Minutes) =>
  Number.isFinite(m) ? `${pad(Math.floor(m / 60))}:${pad(m % 60)}` : ''

/** An <input type="time"> value → minutes; NaN when blank. */
export function fromInputTime(value: string): Minutes {
  const [h, m] = value.split(':').map(Number)
  return value ? h * 60 + m : NaN
}

/** 570 → "9:30 am", 720 → "12:00 pm". */
export function formatTime(m: Minutes) {
  const h = Math.floor(m / 60) % 24
  return `${h % 12 || 12}:${pad(m % 60)} ${h < 12 ? 'am' : 'pm'}`
}

/** Hour label for the timeline: 13 → "1 pm". */
export const formatHour = (h: number) =>
  `${h % 12 || 12} ${h % 24 < 12 ? 'am' : 'pm'}`

export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function minutesNow() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}
