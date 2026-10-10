import type { SetAside, Settings, Task } from '../scheduler'

// Only the task list, set-asides and day settings are stored; never tokens.
const KEY = 'crossoff:v1'

export interface Saved {
  tasks: Task[]
  setAsides: SetAside[]
  settings: Settings
}

export function loadSaved(): Partial<Saved> {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (typeof data !== 'object' || data === null) return {}
    const saved = data as Record<string, unknown>
    return {
      tasks: Array.isArray(saved.tasks) ? (saved.tasks as Task[]) : undefined,
      setAsides: Array.isArray(saved.setAsides)
        ? (saved.setAsides as SetAside[])
        : undefined,
      settings:
        typeof saved.settings === 'object' && saved.settings !== null
          ? (saved.settings as Settings)
          : undefined,
    }
  } catch {
    return {}
  }
}

export function save(saved: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved))
  } catch {
    // Storage can be full or blocked (private windows); the app still works.
  }
}
