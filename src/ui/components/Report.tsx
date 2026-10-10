import type { PlanResult, SetAside } from '../../scheduler'
import { formatTime } from '../time'

export function Report({
  result,
  setAsides,
}: {
  result: PlanResult
  setAsides: SetAside[]
}) {
  const windowOf = (id: string) => setAsides.find((s) => s.id === id)
  const { placed, unscheduled, warnings } = result

  return (
    <div className="space-y-2 text-sm" role="status">
      {unscheduled.length === 0 ? (
        <p className="text-gray-700">
          All {placed.length} session{placed.length === 1 ? '' : 's'} scheduled.
        </p>
      ) : (
        <div className="rounded-md bg-amber-50 p-3 text-amber-900">
          <ul className="space-y-0.5">
            {unscheduled.map((u) => (
              <li key={u.taskId}>
                <span className="font-medium">{u.name}</span>:{' '}
                {u.placedSessions} of {u.totalSessions} session
                {u.totalSessions === 1 ? '' : 's'} scheduled (
                {u.unscheduledMinutes} min not scheduled).
              </li>
            ))}
          </ul>
          <p className="mt-1 text-amber-800">
            Try fewer sessions, a wider working window, or shorter tasks.
          </p>
        </div>
      )}
      {warnings.map((w) => {
        if (w.kind === 'set-aside-short') {
          const s = windowOf(w.setAsideId)
          return (
            <p key={w.setAsideId} className="text-amber-800">
              {w.label}: only {w.freeMinutes} of {w.durationMinutes} minutes
              free
              {s &&
                ` between ${formatTime(s.windowStart)} and ${formatTime(s.windowEnd)}`}
              .
            </p>
          )
        }
        return (
          <p key={w.setAsideIds.join()} className="text-amber-800">
            {w.labels[0]} and {w.labels[1]} overlap and can't both fit.
          </p>
        )
      })}
    </div>
  )
}
