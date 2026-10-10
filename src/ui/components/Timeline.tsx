import type { PlannerEvent } from '../../calendar'
import type { Interval, PlacedSession, SetAside, Task } from '../../scheduler'
import { taskColor } from '../colors'
import { sessionTitle } from '../labels'
import { formatHour, formatTime } from '../time'

const PX_PER_MINUTE = 1.1

export function Timeline({
  range,
  busy,
  existing,
  placed,
  setAsides,
  tasks,
  stale,
}: {
  range: Interval
  busy: Interval[]
  /** Crossoff sessions already in the calendar. */
  existing: PlannerEvent[]
  placed: PlacedSession[]
  setAsides: SetAside[]
  tasks: Task[]
  stale: boolean
}) {
  const y = (m: number) =>
    (Math.min(Math.max(m, range.start), range.end) - range.start) *
    PX_PER_MINUTE
  const box = (i: Interval) => ({
    top: y(i.start),
    height: y(i.end) - y(i.start),
  })
  const visible = (i: Interval) => i.end > range.start && i.start < range.end
  const hours = []
  for (let h = Math.ceil(range.start / 60); h * 60 <= range.end; h++)
    hours.push(h)
  const taskIndex = new Map(tasks.map((t, i) => [t.id, i]))

  return (
    <div
      className="relative ml-12"
      style={{ height: y(range.end) }}
      aria-label="Plan preview"
      role="img"
    >
      {hours.map((h) => (
        <div
          key={h}
          className="absolute inset-x-0 border-t border-gray-100"
          style={{ top: y(h * 60) }}
        >
          <span className="absolute -left-12 w-10 -translate-y-1/2 text-right text-xs text-gray-400">
            {formatHour(h)}
          </span>
        </div>
      ))}

      {setAsides
        .map((s) => ({ ...s, start: s.windowStart, end: s.windowEnd }))
        .filter((s) => s.end > s.start && visible(s))
        .map((s) => (
          <div
            key={s.id}
            className="absolute inset-x-0 rounded-md border-2 border-dashed border-gray-300 bg-gray-50/60"
            style={box(s)}
          >
            <span className="absolute top-1 right-2 text-[11px] text-gray-500">
              {s.label || 'Set aside'} · {s.durationMinutes} min
            </span>
          </div>
        ))}

      {busy.filter(visible).map((b) => (
        <div
          key={`${b.start}-${b.end}`}
          className="absolute right-24 left-1 overflow-hidden rounded bg-gray-300 px-2 text-xs text-gray-700"
          style={box(b)}
        >
          Busy · {formatTime(b.start)}–{formatTime(b.end)}
        </div>
      ))}

      {existing.filter(visible).map((e) => (
        <div
          key={e.id}
          className="absolute right-24 left-1 overflow-hidden rounded border-2 border-sky-700 bg-sky-50 px-2 text-xs leading-4 text-sky-900"
          style={box(e)}
          title={`${e.title}, ${formatTime(e.start)}–${formatTime(e.end)} (in your calendar)`}
        >
          <span className="font-medium">{e.title}</span>{' '}
          <span className="opacity-80">
            {formatTime(e.start)}–{formatTime(e.end)} · in calendar
          </span>
        </div>
      ))}

      {placed.map((s) => {
        const index = taskIndex.get(s.taskId) ?? 0
        const title = sessionTitle(tasks, s)
        return (
          <div
            key={`${s.taskId}-${s.round}`}
            className={`absolute right-24 left-1 overflow-hidden rounded px-2 text-xs leading-4 text-white shadow-sm ${taskColor(index)} ${stale ? 'opacity-40' : ''}`}
            style={box(s)}
            title={`${title}, ${formatTime(s.start)}–${formatTime(s.end)}`}
          >
            <span className="font-medium">{title}</span>{' '}
            <span className="opacity-80">
              {formatTime(s.start)}–{formatTime(s.end)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
