import type {
  Interval,
  PlanResult,
  SetAside,
  Settings,
  Task,
} from '../scheduler'
import type { CalendarInfo } from '../calendar'
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
  connection: 'disconnected' | 'connecting' | 'connected' | 'expired'
  connectError: string | null
  calendars: CalendarInfo[] | null
  /** Busy times for the date and calendars in `key`, once loaded. */
  busy: {
    key: string
    intervals: Interval[]
    failedCalendarIds: string[]
  } | null
  busyLoading: boolean
  busyError: string | null
  /** Bumped by Retry so the busy times load again. */
  busyAttempt: number
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
  | { type: 'auth/connecting' }
  | { type: 'auth/connected'; calendars: CalendarInfo[] }
  | { type: 'auth/failed'; message: string }
  | { type: 'auth/expired' }
  | { type: 'auth/disconnected' }
  | { type: 'busy/loading' }
  | {
      type: 'busy/loaded'
      key: string
      intervals: Interval[]
      failedCalendarIds: string[]
    }
  | { type: 'busy/failed'; message: string }
  | { type: 'busy/retry' }
  | { type: 'planned'; result: PlanResult }

export function initialState(saved: Partial<Saved>): State {
  return {
    date: todayISO(),
    settings: { ...DEFAULT_SETTINGS, ...saved.settings },
    tasks: saved.tasks ?? [],
    setAsides: saved.setAsides ?? [],
    connection: 'disconnected',
    connectError: null,
    calendars: null,
    busy: null,
    busyLoading: false,
    busyError: null,
    busyAttempt: 0,
    result: null,
    stale: false,
  }
}

/** Identifies which busy times the current inputs need. */
export const busyKey = (date: string, calendarIds: string[]) =>
  `${date}|${calendarIds.join(',')}`

/** Saved calendar choices that still exist, falling back to the primary. */
export function availableCalendarIds(ids: string[], calendars: CalendarInfo[]) {
  const kept = ids.filter((id) => calendars.some((c) => c.id === id))
  return kept.length > 0 ? kept : ['primary']
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
      return edited(state, { date: action.date })
    case 'auth/connecting':
      return { ...state, connection: 'connecting', connectError: null }
    case 'auth/connected':
      return {
        ...state,
        connection: 'connected',
        calendars: action.calendars,
        settings: {
          ...state.settings,
          calendarIds: availableCalendarIds(
            state.settings.calendarIds,
            action.calendars,
          ),
        },
      }
    case 'auth/failed':
      return {
        ...state,
        connection: state.busy ? 'expired' : 'disconnected',
        connectError: action.message,
      }
    case 'auth/expired':
      return { ...state, connection: 'expired', busyLoading: false }
    case 'auth/disconnected':
      return {
        ...state,
        connection: 'disconnected',
        connectError: null,
        calendars: null,
        busy: null,
        busyError: null,
        result: null,
        stale: false,
      }
    case 'busy/loading':
      return { ...state, busyLoading: true, busyError: null }
    case 'busy/loaded':
      return {
        ...state,
        busyLoading: false,
        busy: {
          key: action.key,
          intervals: action.intervals,
          failedCalendarIds: action.failedCalendarIds,
        },
      }
    case 'busy/failed':
      return { ...state, busyLoading: false, busyError: action.message }
    case 'busy/retry':
      return { ...state, busyAttempt: state.busyAttempt + 1 }
    case 'planned':
      return { ...state, result: action.result, stale: false }
  }
}
