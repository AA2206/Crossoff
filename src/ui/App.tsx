import { useEffect, useReducer, useState, type Dispatch } from 'react'
import {
  ConnectError,
  connect,
  disconnect,
  getToken,
  loadGis,
} from '../auth/token'
import {
  AuthError,
  browserTimeZone,
  getBusy,
  listCalendars,
  type BusyResult,
  type CalendarInfo,
} from '../calendar'
import {
  hasErrors,
  plan,
  validateSetAside,
  validateSettings,
  validateTask,
} from '../scheduler'
import { loadSaved, save } from '../storage'
import { DaySettings } from './components/DaySettings'
import { Report } from './components/Report'
import { SetAsideList } from './components/SetAsideList'
import { TaskList } from './components/TaskList'
import { Timeline } from './components/Timeline'
import {
  DEFAULT_SETTINGS,
  availableCalendarIds,
  busyKey,
  initialState,
  reducer,
  type Action,
  type State,
} from './state'
import { minutesNow, todayISO } from './time'

const primaryButtonClass =
  'rounded-lg bg-gray-900 px-4 py-2.5 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40'

function connectErrorMessage(error: unknown) {
  if (error instanceof ConnectError) {
    switch (error.kind) {
      case 'closed':
        return 'The Google window was closed before connecting.'
      case 'blocked':
        return 'Your browser blocked the Google window. Allow pop-ups for this site and try again.'
      case 'denied':
        return 'Crossoff needs access to your calendar to plan around it.'
      case 'missing-scopes':
        return 'Crossoff needs all three calendar permissions. Connect again and tick every box.'
      case 'failed':
        return `Couldn't connect to Google: ${error.message}`
    }
  }
  return `Couldn't connect to Google: ${error instanceof Error ? error.message : String(error)}`
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

/** Opens Google's popup and loads the calendar list. Null if it failed. */
async function connectCalendar(
  dispatch: Dispatch<Action>,
): Promise<CalendarInfo[] | null> {
  dispatch({ type: 'auth/connecting' })
  try {
    await connect()
    const calendars = await listCalendars()
    dispatch({ type: 'auth/connected', calendars })
    return calendars
  } catch (error) {
    dispatch({ type: 'auth/failed', message: connectErrorMessage(error) })
    return null
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState(loadSaved()),
  )
  const [generating, setGenerating] = useState(false)
  const { tasks, setAsides, settings, connection, date } = state
  const key = busyKey(date, settings.calendarIds)

  useEffect(() => {
    save({ tasks, setAsides, settings })
  }, [tasks, setAsides, settings])

  // Load the sign-in script early so the popup can open straight from a click.
  useEffect(() => {
    loadGis().catch(() => {})
  }, [])

  // Show the day's real busy times as soon as we're connected.
  const busyIsCurrent = state.busy?.key === key
  useEffect(() => {
    if (connection !== 'connected' || busyIsCurrent) return
    if (settings.calendarIds.length === 0) return
    let cancelled = false
    dispatch({ type: 'busy/loading' })
    getBusy(date, settings.calendarIds, browserTimeZone()).then(
      (result) => {
        if (!cancelled)
          dispatch({ type: 'busy/loaded', key, ...toBusy(result) })
      },
      (error: unknown) => {
        if (cancelled) return
        if (error instanceof AuthError) dispatch({ type: 'auth/expired' })
        else dispatch({ type: 'busy/failed', message: errorMessage(error) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [
    connection,
    key,
    busyIsCurrent,
    date,
    settings.calendarIds,
    state.busyAttempt,
  ])

  const invalid =
    hasErrors(validateSettings(settings)) ||
    tasks.some((t) => hasErrors(validateTask(t))) ||
    setAsides.some((s) => hasErrors(validateSetAside(s)))
  const blocker =
    tasks.length === 0
      ? 'Add a task to generate a plan.'
      : invalid
        ? 'Fix the highlighted fields first.'
        : null

  async function generate() {
    setGenerating(true)
    try {
      // Connecting first, inside the click, keeps the popup from being blocked.
      let calendarIds = settings.calendarIds
      if (!getToken()) {
        const calendars = await connectCalendar(dispatch)
        if (!calendars) return
        calendarIds = availableCalendarIds(calendarIds, calendars)
      }
      // Fetch fresh busy times so the plan reflects the calendar right now.
      const result = toBusy(await getBusy(date, calendarIds, browserTimeZone()))
      dispatch({
        type: 'busy/loaded',
        key: busyKey(date, calendarIds),
        ...result,
      })
      dispatch({
        type: 'planned',
        result: plan({
          tasks,
          setAsides,
          settings: { ...settings, calendarIds },
          busy: result.intervals,
          now: date === todayISO() ? minutesNow() : undefined,
        }),
      })
    } catch (error) {
      if (error instanceof AuthError) dispatch({ type: 'auth/expired' })
      else dispatch({ type: 'busy/failed', message: errorMessage(error) })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Crossoff</h1>
        <p className="text-sm text-gray-500">
          Turn today's task list into time blocks on your calendar.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <TaskList tasks={tasks} dispatch={dispatch} />
          <SetAsideList setAsides={setAsides} dispatch={dispatch} />
          <DaySettings
            date={date}
            settings={settings}
            calendars={state.calendars}
            dispatch={dispatch}
          />
          <div>
            <button
              type="button"
              className={`w-full ${primaryButtonClass}`}
              disabled={!!blocker || generating || connection === 'connecting'}
              onClick={generate}
            >
              {generating ? 'Planning…' : 'Generate plan'}
            </button>
            <p className="mt-2 text-center text-xs text-gray-500">
              {blocker ??
                (connection === 'connected'
                  ? null
                  : "You'll be asked to connect Google Calendar.")}
            </p>
          </div>
        </div>

        <Preview
          state={state}
          busyIsCurrent={busyIsCurrent}
          onConnect={() => connectCalendar(dispatch)}
          onDisconnect={() => {
            disconnect()
            dispatch({ type: 'auth/disconnected' })
          }}
          onRetry={() => dispatch({ type: 'busy/retry' })}
        />
      </div>
    </div>
  )
}

const toBusy = (result: BusyResult) => ({
  intervals: result.busy,
  failedCalendarIds: result.failedCalendarIds,
})

function Preview({
  state,
  busyIsCurrent,
  onConnect,
  onDisconnect,
  onRetry,
}: {
  state: State
  busyIsCurrent: boolean
  onConnect: () => void
  onDisconnect: () => void
  onRetry: () => void
}) {
  const {
    connection,
    connectError,
    busy,
    busyLoading,
    busyError,
    calendars,
    result,
    stale,
    settings,
    setAsides,
    tasks,
    date,
  } = state
  const dayLabel = new Date(`${date}T00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
  const range =
    settings.workingWindow.end > settings.workingWindow.start
      ? settings.workingWindow
      : DEFAULT_SETTINGS.workingWindow
  const failedNames = (busyIsCurrent ? busy!.failedCalendarIds : []).map(
    (id) => calendars?.find((c) => c.id === id)?.name ?? id,
  )
  // Keep showing the day after the token expires, so nothing is lost.
  const showDay =
    connection === 'connected' || (connection === 'expired' && busy)

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:self-start">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{dayLabel}</h2>
        {connection === 'connected' && (
          <button
            type="button"
            className="text-xs text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline"
            onClick={onDisconnect}
          >
            Disconnect Google Calendar
          </button>
        )}
      </div>

      {connectError && (
        <p
          className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {connectError}
        </p>
      )}
      {connection === 'expired' && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your Google connection expired. Your tasks and plan are kept.
          <button
            type="button"
            className="rounded-md bg-amber-900 px-3 py-1 text-white hover:bg-amber-800"
            onClick={onConnect}
          >
            Reconnect
          </button>
        </div>
      )}

      {!showDay ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="max-w-xs text-sm text-gray-500">
            Connect your calendar so Crossoff can plan around what's already on
            it. You can add tasks first.
          </p>
          <button
            type="button"
            className={primaryButtonClass}
            disabled={connection === 'connecting'}
            onClick={onConnect}
          >
            {connection === 'connecting'
              ? 'Connecting…'
              : 'Connect Google Calendar'}
          </button>
          <p className="max-w-xs text-xs text-gray-400">
            Crossoff only sees when you're busy, not what your events are.
          </p>
        </div>
      ) : (
        <>
          {busyLoading && (
            <p className="mb-3 text-sm text-gray-500" role="status">
              Loading your calendar…
            </p>
          )}
          {busyError && (
            <div
              className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              Couldn't load your calendar: {busyError}
              <button
                type="button"
                className="rounded-md border border-red-300 px-3 py-1 hover:bg-red-100"
                onClick={onRetry}
              >
                Retry
              </button>
            </div>
          )}
          {failedNames.length > 0 && (
            <p className="mb-3 text-sm text-amber-800">
              Couldn't read {failedNames.join(', ')}; its events aren't
              included.
            </p>
          )}
          {result && (
            <div className="mb-4">
              {stale && (
                <p className="mb-2 rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">
                  You've changed something since this plan was made. Generate
                  again to update it.
                </p>
              )}
              <Report result={result} setAsides={setAsides} />
            </div>
          )}
          <div className="max-h-[70vh] overflow-y-auto pt-2 pr-1">
            <Timeline
              range={range}
              busy={busyIsCurrent ? busy!.intervals : []}
              placed={result?.placed ?? []}
              setAsides={setAsides}
              tasks={tasks}
              stale={stale}
            />
          </div>
          <button
            type="button"
            disabled
            title="Writing to your calendar isn't available yet"
            className={`mt-4 w-full ${primaryButtonClass}`}
          >
            Commit to calendar
          </button>
        </>
      )}
    </section>
  )
}
