// Scheduler data types. All times are minutes since midnight in the user's
// time zone (9:30 am = 570); they become real timestamps only at the edges.
export type Minutes = number

export interface Interval {
  start: Minutes
  end: Minutes
}

export interface Task {
  id: string
  name: string
  /** 1 = highest, 5 = lowest. */
  priority: number
  totalMinutes: number
  sessions: number
}

export interface SetAside {
  id: string
  label: string
  windowStart: Minutes
  windowEnd: Minutes
  durationMinutes: number
}

export type Mode = 'spread' | 'finish-early'

export interface Settings {
  workingWindow: Interval
  mode: Mode
  bufferMinutes: number
  minBreakMinutes: number
  calendarIds: string[]
}

export interface Session {
  taskId: string
  /** Position of the task in the entered list, the final tie-breaker. */
  taskIndex: number
  /** 1-based: session 1, 2, 3… of the task. */
  round: number
  /** Total sessions for the task, for titles like "Essay (1/3)". */
  rounds: number
  priority: number
  duration: number
}

export interface PlacedSession extends Session, Interval {}

export interface UnscheduledTask {
  taskId: string
  name: string
  placedSessions: number
  totalSessions: number
  unscheduledMinutes: number
}

export type Warning =
  | {
      kind: 'set-aside-short'
      setAsideId: string
      label: string
      freeMinutes: number
      durationMinutes: number
    }
  | {
      kind: 'set-aside-conflict'
      setAsideIds: [string, string]
      labels: [string, string]
    }

export interface PlanResult {
  placed: PlacedSession[]
  unscheduled: UnscheduledTask[]
  warnings: Warning[]
}
