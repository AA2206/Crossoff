import { blockedTime, buildFreeStretches, cutoffFor } from './freeStretches'
import { placeSessions } from './placeSessions'
import { rankSessions, splitIntoSessions } from './sessions'
import { conflictingPairs, setAsideFreeMinutes } from './setAsides'
import type {
  Interval,
  Minutes,
  PlanResult,
  Session,
  SetAside,
  Settings,
  Task,
  UnscheduledTask,
  Warning,
} from './types'

export interface PlanInput {
  tasks: Task[]
  setAsides: SetAside[]
  settings: Settings
  /** Existing calendar events for the day, unbuffered. */
  busy: Interval[]
  /** Set when re-planning: nothing is planned before this time. */
  now?: Minutes
}

export function plan({
  tasks,
  setAsides,
  settings,
  busy,
  now,
}: PlanInput): PlanResult {
  const cutoff = cutoffFor(now)
  const blocked = blockedTime(busy, settings.bufferMinutes)
  const { placed, unplaced } = placeSessions(
    rankSessions(splitIntoSessions(tasks)),
    {
      stretches: buildFreeStretches(busy, settings, now),
      setAsides,
      blocked,
      cutoff,
      minBreakMinutes: settings.minBreakMinutes,
    },
  )
  // Spread out mode (spreadSessions) arrives in Sprint 2; until then every
  // plan is packed into the earliest slots.
  return {
    placed,
    unscheduled: unscheduledReport(tasks, unplaced),
    warnings: setAsideWarnings(setAsides, blocked, placed, cutoff),
  }
}

function unscheduledReport(
  tasks: Task[],
  unplaced: Session[],
): UnscheduledTask[] {
  return tasks.flatMap((task) => {
    const missing = unplaced.filter((s) => s.taskId === task.id)
    if (missing.length === 0) return []
    return [
      {
        taskId: task.id,
        name: task.name,
        placedSessions: task.sessions - missing.length,
        totalSessions: task.sessions,
        unscheduledMinutes: missing.reduce((sum, s) => sum + s.duration, 0),
      },
    ]
  })
}

function setAsideWarnings(
  setAsides: SetAside[],
  blocked: Interval[],
  placed: Interval[],
  cutoff: Minutes,
): Warning[] {
  // Windows that have already ended are ignored.
  const live = setAsides.filter((s) => s.windowEnd > cutoff)
  const short: Warning[] = live.flatMap((s) => {
    const freeMinutes = setAsideFreeMinutes(s, blocked, [], cutoff)
    if (freeMinutes >= s.durationMinutes) return []
    return [
      {
        kind: 'set-aside-short' as const,
        setAsideId: s.id,
        label: s.label,
        freeMinutes,
        durationMinutes: s.durationMinutes,
      },
    ]
  })
  const conflicts: Warning[] = conflictingPairs(
    live,
    blocked,
    placed,
    cutoff,
  ).map(([a, b]) => ({
    kind: 'set-aside-conflict',
    setAsideIds: [a.id, b.id],
    labels: [a.label, b.label],
  }))
  return [...short, ...conflicts]
}
