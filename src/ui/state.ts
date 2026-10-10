import type { PlanResult, SetAside, Settings, Task } from '../scheduler'
import type { BusyInterval, CalendarInfo, PlannerEvent } from '../calendar'
import type { Saved } from '../storage'
import { todayISO } from './time'

export const DEFAULT_SETTINGS: Settings = {
  workingWindow: { start: 9 * 60, end: 22 * 60 },
  mode: 'spread',
  bufferMinutes: 10,
  minBreakMinutes: 10,
  calendarIds: ['primary'],
}

/** What the calendar holds for the chosen day. */
export interface Day {
  /** busyKey of the date and calendars this was loaded for. */
  key: string
  /** The dayVersion it was loaded at; a newer version means reload. */
  version: number
  busy: BusyInterval[]
  /** Crossoff's own events already on the day. */
  plannerEvents: PlannerEvent[]
  failedCalendarIds: string[]
}

export type CommitState =
  | { status: 'idle' }
  | { status: 'working'; label: string }
  /** Creating stopped partway; sessions from `remainingIndex` on are missing. */
  | {
      status: 'create-failed'
      createdIds: string[]
      remainingIndex: number
      message: string
    }
  /** The new plan is in, but these old events are still there. */
  | {
      status: 'remove-failed'
      created: number
      leftoverIds: string[]
      message: string
    }
  | { status: 'done'; created: number; replaced: number }
  | { status: 'undone' }
  | { status: 'cleared'; count: number }
  | { status: 'error'; message: string }

export interface State {
  date: string
  settings: Settings
  tasks: Task[]
  setAsides: SetAside[]
  connection: 'disconnected' | 'connecting' | 'connected' | 'expired'
  connectError: string | null
  calendars: CalendarInfo[] | null
  day: Day | null
  dayLoading: boolean
  dayError: string | null
  /** Bumped to reload the day, e.g. by Retry or after a commit. */
  dayVersion: number
  result: PlanResult | null
  /** Planner events the current plan replaces when committed. */
  replaceIds: string[]
  /** Inputs changed since the plan was generated. */
  stale: boolean
  commit: CommitState
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
  | { type: 'day/loading' }
  | { type: 'day/loaded'; day: Omit<Day, 'version'> }
  | { type: 'day/failed'; message: string }
  | { type: 'day/reload' }
  | { type: 'planned'; result: PlanResult; replaceIds: string[] }
  | { type: 'commit/set'; commit: CommitState }
  | { type: 'plan/clear' }

export function initialState(saved: Partial<Saved>): State {
  return {
    date: todayISO(),
    settings: { ...DEFAULT_SETTINGS, ...saved.settings },
    tasks: saved.tasks ?? [],
    setAsides: saved.setAsides ?? [],
    connection: 'disconnected',
    connectError: null,
    calendars: null,
    day: null,
    dayLoading: false,
    dayError: null,
    dayVersion: 0,
    result: null,
    replaceIds: [],
    stale: false,
    commit: { status: 'idle' },
  }
}

/** Identifies which day's calendar data the current inputs need. */
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
        connection: state.day ? 'expired' : 'disconnected',
        connectError: action.message,
      }
    case 'auth/expired':
      return { ...state, connection: 'expired', dayLoading: false }
    case 'auth/disconnected':
      return {
        ...state,
        connection: 'disconnected',
        connectError: null,
        calendars: null,
        day: null,
        dayError: null,
        result: null,
        replaceIds: [],
        stale: false,
        commit: { status: 'idle' },
      }
    case 'day/loading':
      return { ...state, dayLoading: true, dayError: null }
    case 'day/loaded':
      return {
        ...state,
        dayLoading: false,
        day: { ...action.day, version: state.dayVersion },
      }
    case 'day/failed':
      return { ...state, dayLoading: false, dayError: action.message }
    case 'day/reload':
      return { ...state, dayVersion: state.dayVersion + 1 }
    case 'planned':
      return {
        ...state,
        result: action.result,
        replaceIds: action.replaceIds,
        stale: false,
        commit: { status: 'idle' },
      }
    case 'commit/set':
      return { ...state, commit: action.commit }
    case 'plan/clear':
      return { ...state, result: null, replaceIds: [], stale: false }
  }
}
