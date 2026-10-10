import type {
  Interval,
  PlanResult,
  SetAside,
  Settings,
  Task,
} from '../scheduler'
import type { Saved } from '../storage'
import { todayISO } from './time'

export const DEFAULT_SETTINGS: Settings = {
  workingWindow: { start: 9 * 60, end: 22 * 60 },
  mode: 'spread',
  bufferMinutes: 10,
  minBreakMinutes: 10,
  calendarIds: ['primary'],
}

export interface State {
  date: string
  settings: Settings
  tasks: Task[]
  setAsides: SetAside[]
  connected: boolean
  /** The day's calendar events, once loaded. */
  busy: Interval[] | null
  result: PlanResult | null
  /** Inputs changed since the plan was generated. */
  stale: boolean
}

export type Action =
  | { type: 'task/add' }
  | { type: 'task/update'; id: string; patch: Partial<Task> }
  | { type: 'task/remove'; id: string }
  | { type: 'task/move'; id: string; by: -1 | 1 }
  | { type: 'setAside/add' }
  | { type: 'setAside/update'; id: string; patch: Partial<SetAside> }
  | { type: 'setAside/remove'; id: string }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'date/set'; date: string }
  | { type: 'connected' }
  | { type: 'busy/loaded'; busy: Interval[] }
  | { type: 'planned'; result: PlanResult }

export function initialState(saved: Partial<Saved>): State {
  return {
    date: todayISO(),
    settings: { ...DEFAULT_SETTINGS, ...saved.settings },
    tasks: saved.tasks ?? [],
    setAsides: saved.setAsides ?? [],
    connected: false,
    busy: null,
    result: null,
    stale: false,
  }
}

const newId = () => crypto.randomUUID()

function move<T extends { id: string }>(items: T[], id: string, by: number) {
  const from = items.findIndex((i) => i.id === id)
  const to = from + by
  if (from === -1 || to < 0 || to >= items.length) return items
  const next = [...items]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

/** Any change to the inputs makes an existing plan out of date. */
const edited = (state: State, patch: Partial<State>): State => ({
  ...state,
  ...patch,
  stale: state.result !== null,
})

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'task/add':
      return edited(state, {
        tasks: [
          ...state.tasks,
          { id: newId(), name: '', totalMinutes: 60, sessions: 1 },
        ],
      })
    case 'task/update':
      return edited(state, {
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, ...action.patch } : t,
        ),
      })
    case 'task/remove':
      return edited(state, {
        tasks: state.tasks.filter((t) => t.id !== action.id),
      })
    case 'task/move':
      return edited(state, { tasks: move(state.tasks, action.id, action.by) })
    case 'setAside/add':
      return edited(state, {
        setAsides: [
          ...state.setAsides,
          {
            id: newId(),
            label: '',
            windowStart: 12 * 60,
            windowEnd: 14 * 60,
            durationMinutes: 45,
          },
        ],
      })
    case 'setAside/update':
      return edited(state, {
        setAsides: state.setAsides.map((s) =>
          s.id === action.id ? { ...s, ...action.patch } : s,
        ),
      })
    case 'setAside/remove':
      return edited(state, {
        setAsides: state.setAsides.filter((s) => s.id !== action.id),
      })
    case 'settings/update':
      return edited(state, {
        settings: { ...state.settings, ...action.patch },
      })
    case 'date/set':
      return edited(state, { date: action.date, busy: null })
    case 'connected':
      return { ...state, connected: true }
    case 'busy/loaded':
      return { ...state, busy: action.busy }
    case 'planned':
      return { ...state, result: action.result, stale: false }
  }
}
