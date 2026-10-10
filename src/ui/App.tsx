import {
  useEffect,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react'
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
  busyForPlanning,
  commitPlan,
  createSessionEvent,
  deletePlannerEvents,
  getBusy,
  listCalendars,
  listPlannerEvents,
  replaceableEvents,
  type CalendarInfo,
} from '../calendar'
import {
  hasErrors,
  mergeIntervals,
  plan,
  validateSetAside,
  validateSettings,
  validateTask,
  type Minutes,
  type PlacedSession,
} from '../scheduler'
import { loadSaved, save } from '../storage'
import { CommitPanel } from './components/CommitPanel'
import { DaySettings } from './components/DaySettings'
import { Report } from './components/Report'
import { SetAsideList } from './components/SetAsideList'
import { TaskList } from './components/TaskList'
import { Timeline } from './components/Timeline'
import { sessionTitle } from './labels'
import {
  DEFAULT_SETTINGS,
  availableCalendarIds,
  busyKey,
  initialState,
  reducer,
  type Action,
  type Day,
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
  return `Couldn't connect to Google: ${errorMessage(error)}`
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

/** Busy times and Crossoff's own events for a day. */
async function loadDay(
  date: string,
  calendarIds: string[],
): Promise<Omit<Day, 'version'>> {
  const timeZone = browserTimeZone()
  const [busy, plannerEvents] = await Promise.all([
    getBusy(date, calendarIds, timeZone),
    listPlannerEvents(date, timeZone),
  ])
  return {
    key: busyKey(date, calendarIds),
    busy: busy.busy,
    failedCalendarIds: busy.failedCalendarIds,
    plannerEvents,
  }
}

/** For today, the current time: nothing is planned or replaced before it. */
const nowFor = (date: string) =>
  date === todayISO() ? minutesNow() : undefined
const cutoffOf = (now: Minutes | undefined) =>
  now === undefined ? 0 : Math.ceil(now / 5) * 5

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState(loadSaved()),
  )
  const [generating, setGenerating] = useState(false)
  const { tasks, setAsides, settings, connection, date, result, commit } = state
  const key = busyKey(date, settings.calendarIds)
  const setCommit = (c: State['commit']) =>
    dispatch({ type: 'commit/set', commit: c })

  useEffect(() => {
    save({ tasks, setAsides, settings })
  }, [tasks, setAsides, settings])

  // Load the sign-in script early so the popup can open straight from a click.
  useEffect(() => {
    loadGis().catch(() => {})
  }, [])

  // Show the day's calendar as soon as we're connected, and reload it when
  // the date or calendars change or after a commit.
  const dayIsCurrent =
    state.day?.key === key && state.day.version === state.dayVersion
  useEffect(() => {
    if (connection !== 'connected' || dayIsCurrent) return
    if (settings.calendarIds.length === 0) return
    let cancelled = false
    dispatch({ type: 'day/loading' })
    loadDay(date, settings.calendarIds).then(
      (day) => {
        if (!cancelled) dispatch({ type: 'day/loaded', day })
      },
      (error: unknown) => {
        if (cancelled) return
        if (error instanceof AuthError) dispatch({ type: 'auth/expired' })
        else dispatch({ type: 'day/failed', message: errorMessage(error) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [connection, key, dayIsCurrent, date, settings.calendarIds])

  /** A usable token, connecting first if needed. Call straight from a click. */
  async function ensureConnected(): Promise<string[] | null> {
    if (getToken()) return settings.calendarIds
    const calendars = await connectCalendar(dispatch)
    return calendars && availableCalendarIds(settings.calendarIds, calendars)
  }

  function handleCalendarError(error: unknown, fallback: string) {
    if (error instanceof AuthError) {
      dispatch({ type: 'auth/expired' })
      return `${fallback}: your Google connection expired.`
    }
    return `${fallback}: ${errorMessage(error)}`
  }

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
  const shownDay = state.day?.key === key ? state.day : null
  const committing = commit.status === 'working'
  const replanning = date === todayISO() && !!shownDay?.plannerEvents.length

  async function generate() {
    setGenerating(true)
    try {
      // Connecting first, inside the click, keeps the popup from being blocked.
      const calendarIds = await ensureConnected()
      if (!calendarIds) return
      // Load fresh so the plan reflects the calendar right now.
      const day = await loadDay(date, calendarIds)
      dispatch({ type: 'day/loaded', day })
      const now = nowFor(date)
      // Crossoff sessions that haven't started yet get replaced, so their
      // time is free for the new plan. Earlier ones stay busy.
      const replaceable = replaceableEvents(day.plannerEvents, cutoffOf(now))
      dispatch({
        type: 'planned',
        replaceIds: replaceable.map((e) => e.id),
        result: plan({
          tasks,
          setAsides,
          settings: { ...settings, calendarIds },
          busy: busyForPlanning(day.busy, replaceable),
          now,
        }),
      })
    } catch (error) {
      if (error instanceof AuthError) dispatch({ type: 'auth/expired' })
      else dispatch({ type: 'day/failed', message: errorMessage(error) })
    } finally {
      setGenerating(false)
    }
  }

  async function commitSessions(fromIndex = 0, createdSoFar: string[] = []) {
    if (!result) return
    if (!(await ensureConnected())) return
    const total = result.placed.length
    const progress = (n: number) =>
      setCommit({
        status: 'working',
        label: `Adding sessions… ${n} of ${total}`,
      })
    progress(createdSoFar.length)
    const timeZone = browserTimeZone()
    const outcome = await commitPlan<PlacedSession>({
      sessions: result.placed.slice(fromIndex),
      // A retry only needs the old plan removed once the new one is complete.
      replaceIds: state.replaceIds,
      create: (s) =>
        createSessionEvent(
          { title: sessionTitle(tasks, s), start: s.start, end: s.end },
          date,
          timeZone,
        ),
      remove: deletePlannerEvents,
      onCreated: (n) => progress(createdSoFar.length + n),
    })
    switch (outcome.kind) {
      case 'done':
        setCommit({
          status: 'done',
          created: total,
          replaced: state.replaceIds.length,
        })
        // The calendar now shows the plan; the preview is no longer needed.
        dispatch({ type: 'plan/clear' })
        break
      case 'create-failed':
        setCommit({
          status: 'create-failed',
          createdIds: [...createdSoFar, ...outcome.createdIds],
          remainingIndex: fromIndex + outcome.failedIndex,
          message: handleCalendarError(outcome.error, "Couldn't add a session"),
        })
        break
      case 'remove-failed':
        setCommit({
          status: 'remove-failed',
          created: total,
          leftoverIds: outcome.leftoverIds,
          message: handleCalendarError(outcome.error, 'Google said'),
        })
        dispatch({ type: 'plan/clear' })
        break
    }
    dispatch({ type: 'day/reload' })
  }

  /** Deletes Crossoff events by id, then shows `after` or an error. */
  async function removeEvents(
    ids: string[],
    label: string,
    after: State['commit'],
  ) {
    if (!(await ensureConnected())) return
    setCommit({ status: 'working', label })
    try {
      await deletePlannerEvents(ids)
      setCommit(after)
    } catch (error) {
      setCommit({
        status: 'error',
        message: handleCalendarError(error, "Couldn't remove sessions"),
      })
    }
    dispatch({ type: 'day/reload' })
  }

  function clearDay() {
    const events = shownDay?.plannerEvents ?? []
    const ok = window.confirm(
      `Remove Crossoff's ${events.length} session${events.length === 1 ? '' : 's'} from this day? Your other events aren't touched.`,
    )
    if (!ok) return
    dispatch({ type: 'plan/clear' })
    removeEvents(
      events.map((e) => e.id),
      'Removing sessions…',
      { status: 'cleared', count: events.length },
    )
  }

  const commitBlocker = !result
    ? 'Generate a plan to commit it.'
    : state.stale
      ? 'Generate again to commit the updated plan.'
      : result.placed.length === 0
        ? 'Nothing to add: no sessions fit.'
        : null

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
              disabled={
                !!blocker ||
                generating ||
                committing ||
                connection === 'connecting'
              }
              onClick={generate}
            >
              {generating
                ? 'Planning…'
                : replanning
                  ? 'Re-plan from now'
                  : 'Generate plan'}
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
          shownDay={shownDay}
          onConnect={() => connectCalendar(dispatch)}
          onDisconnect={() => {
            disconnect()
            dispatch({ type: 'auth/disconnected' })
          }}
          onRetry={() => dispatch({ type: 'day/reload' })}
          commitPanel={
            <CommitPanel
              commit={commit}
              canCommit={!commitBlocker && !generating}
              disabledReason={commitBlocker}
              replaceCount={state.replaceIds.length}
              sessionCount={result?.placed.length ?? 0}
              existingCount={shownDay?.plannerEvents.length ?? 0}
              onCommit={() => commitSessions()}
              onRetryRemaining={() =>
                commit.status === 'create-failed' &&
                commitSessions(commit.remainingIndex, commit.createdIds)
              }
              onUndo={() =>
                commit.status === 'create-failed' &&
                removeEvents(commit.createdIds, 'Undoing…', {
                  status: 'undone',
                })
              }
              onRetryRemove={() =>
                commit.status === 'remove-failed' &&
                removeEvents(commit.leftoverIds, 'Removing old sessions…', {
                  status: 'done',
                  created: commit.created,
                  replaced: commit.leftoverIds.length,
                })
              }
              onClear={clearDay}
            />
          }
        />
      </div>
    </div>
  )
}

function Preview({
  state,
  shownDay,
  onConnect,
  onDisconnect,
  onRetry,
  commitPanel,
}: {
  state: State
  shownDay: Day | null
  onConnect: () => void
  onDisconnect: () => void
  onRetry: () => void
  commitPanel: ReactNode
}) {
  const {
    connection,
    connectError,
    dayLoading,
    dayError,
    calendars,
    result,
    replaceIds,
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
  const failedNames = (shownDay?.failedCalendarIds ?? []).map(
    (id) => calendars?.find((c) => c.id === id)?.name ?? id,
  )
  const plannerEvents = shownDay?.plannerEvents ?? []
  // Crossoff's own sessions are drawn as themselves, not as gray busy time.
  // Ones the new plan replaces are hidden behind it.
  const existing = result
    ? plannerEvents.filter((e) => !replaceIds.includes(e.id))
    : plannerEvents
  const busy = mergeIntervals(
    busyForPlanning(shownDay?.busy ?? [], plannerEvents),
  )
  // Keep showing the day after the token expires, so nothing is lost.
  const showDay =
    connection === 'connected' || (connection === 'expired' && shownDay)

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
          {dayLoading && (
            <p className="mb-3 text-sm text-gray-500" role="status">
              Loading your calendar…
            </p>
          )}
          {dayError && (
            <div
              className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              Couldn't load your calendar: {dayError}
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
              busy={busy}
              existing={existing}
              placed={result?.placed ?? []}
              setAsides={setAsides}
              tasks={tasks}
              stale={stale}
            />
          </div>
          {commitPanel}
        </>
      )}
    </section>
  )
}
