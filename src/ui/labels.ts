import type { PlacedSession, Task } from '../scheduler'

/** Event title for a session: "Essay (1/3)", or just "Email" for one session. */
export function sessionTitle(tasks: Task[], s: PlacedSession) {
  const name = tasks.find((t) => t.id === s.taskId)?.name ?? ''
  return s.rounds > 1 ? `${name} (${s.round}/${s.rounds})` : name
}
