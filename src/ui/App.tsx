import { useEffect, useReducer } from 'react'
import { getBusy } from '../calendar'
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
import { DEFAULT_SETTINGS, initialState, reducer, type State } from './state'
import { minutesNow, todayISO } from './time'

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState(loadSaved()),
  )
  const { tasks, setAsides, settings, connected, busy, date } = state

  useEffect(() => {
    save({ tasks, setAsides, settings })
  }, [tasks, setAsides, settings])

  useEffect(() => {
    if (!connected || busy) return
    let cancelled = false
    getBusy(date).then((busy) => {
      if (!cancelled) dispatch({ type: 'busy/loaded', busy })
    })
    return () => {
      cancelled = true
    }
  }, [connected, busy, date])

  const invalid =
    hasErrors(validateSettings(settings)) ||
    tasks.some((t) => hasErrors(validateTask(t))) ||
    setAsides.some((s) => hasErrors(validateSetAside(s)))
  const blocker = !connected
    ? 'Connect your calendar to generate a plan.'
    : tasks.length === 0
      ? 'Add a task to generate a plan.'
      : invalid
        ? 'Fix the highlighted fields first.'
        : null

  function generate() {
    if (!busy) return
    const result = plan({
      tasks,
      setAsides,
      settings,
      busy,
      now: date === todayISO() ? minutesNow() : undefined,
    })
    dispatch({ type: 'planned', result })
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
          <DaySettings date={date} settings={settings} dispatch={dispatch} />
          <div>
            <button
              type="button"
              className="w-full rounded-lg bg-gray-900 px-4 py-2.5 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!!blocker || !busy}
              onClick={generate}
            >
              Generate plan
            </button>
            {blocker && (
              <p className="mt-2 text-center text-xs text-gray-500">
                {blocker}
              </p>
            )}
          </div>
        </div>

        <Preview
          state={state}
          onConnect={() => dispatch({ type: 'connected' })}
        />
      </div>
    </div>
  )
}

function Preview({
  state,
  onConnect,
}: {
  state: State
  onConnect: () => void
}) {
  const { connected, busy, result, stale, settings, setAsides, tasks, date } =
    state
  const dayLabel = new Date(`${date}T00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
  const range =
    settings.workingWindow.end > settings.workingWindow.start
      ? settings.workingWindow
      : DEFAULT_SETTINGS.workingWindow

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:self-start">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{dayLabel}</h2>
        {connected && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
            Sample calendar
          </span>
        )}
      </div>

      {!connected ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="max-w-xs text-sm text-gray-500">
            Connect your calendar so Crossoff can plan around what's already on
            it. You can add tasks first.
          </p>
          <button
            type="button"
            className="rounded-lg bg-gray-900 px-4 py-2.5 font-medium text-white hover:bg-gray-800"
            onClick={onConnect}
          >
            Connect Google Calendar
          </button>
          <p className="text-xs text-gray-400">
            For now this loads a sample day; Google sign-in comes next.
          </p>
        </div>
      ) : (
        <>
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
              busy={busy ?? []}
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
            className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Commit to calendar
          </button>
        </>
      )}
    </section>
  )
}
