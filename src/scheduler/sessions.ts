import { STEP, roundDown } from './intervals'
import type { Session, Task } from './types'

/**
 * Splits each task into `sessions` blocks on 5-minute marks. The rounding
 * remainder is handed out 5 minutes at a time from the first session on, so
 * the total is preserved and no session drops below total ÷ sessions.
 */
export function splitIntoSessions(tasks: Task[]): Session[] {
  return tasks.flatMap((task, taskIndex) => {
    const base = roundDown(task.totalMinutes / task.sessions)
    let remainder = task.totalMinutes - base * task.sessions
    return Array.from({ length: task.sessions }, (_, i) => {
      const extra = Math.min(STEP, remainder)
      remainder -= extra
      return {
        taskId: task.id,
        taskIndex,
        round: i + 1,
        rounds: task.sessions,
        priority: task.priority,
        duration: base + extra,
      }
    })
  })
}

/** Every task's first session before any task's second, then by priority. */
export function rankSessions(sessions: Session[]): Session[] {
  return [...sessions].sort(
    (a, b) =>
      a.round - b.round || a.priority - b.priority || a.taskIndex - b.taskIndex,
  )
}
