import type { Dispatch } from 'react'
import { validateSettings, type Mode, type Settings } from '../../scheduler'
import type { Action } from '../state'
import { todayISO } from '../time'
import { Card } from './Card'
import { Errors, Field, NumberInput, TimeInput, inputClass } from './fields'

const MODES: { mode: Mode; label: string; hint: string }[] = [
  { mode: 'spread', label: 'Spread out', hint: 'Longest breaks' },
  { mode: 'finish-early', label: 'Finish early', hint: 'Earliest slots' },
]

export function DaySettings({
  date,
  settings,
  dispatch,
}: {
  date: string
  settings: Settings
  dispatch: Dispatch<Action>
}) {
  const errors = validateSettings(settings)
  const update = (patch: Partial<Settings>) =>
    dispatch({ type: 'settings/update', patch })
  const window = settings.workingWindow

  return (
    <Card title="Day">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Date">
            <input
              type="date"
              className={inputClass}
              value={date}
              min={todayISO()}
              onChange={(e) =>
                e.target.value &&
                dispatch({ type: 'date/set', date: e.target.value })
              }
            />
          </Field>
        </div>
        <Field label="Start">
          <TimeInput
            value={window.start}
            invalid={!!errors.workingWindow}
            onChange={(start) =>
              update({ workingWindow: { ...window, start } })
            }
          />
        </Field>
        <Field label="End">
          <TimeInput
            value={window.end}
            invalid={!!errors.workingWindow}
            onChange={(end) => update({ workingWindow: { ...window, end } })}
          />
        </Field>
      </div>

      <div
        className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1"
        role="group"
        aria-label="Mode"
      >
        {MODES.map(({ mode, label, hint }) => (
          <button
            key={mode}
            type="button"
            aria-pressed={settings.mode === mode}
            onClick={() => update({ mode })}
            className="rounded-md px-2 py-1.5 text-sm text-gray-600 aria-pressed:bg-white aria-pressed:font-medium aria-pressed:text-gray-900 aria-pressed:shadow-sm"
          >
            {label}
            <span className="block text-xs font-normal text-gray-400">
              {hint}
            </span>
          </button>
        ))}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-gray-600 select-none">
          Advanced
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Buffer around events (min)">
            <NumberInput
              value={settings.bufferMinutes}
              min={0}
              step={5}
              invalid={!!errors.bufferMinutes}
              onChange={(bufferMinutes) => update({ bufferMinutes })}
            />
          </Field>
          <Field label="Minimum break (min)">
            <NumberInput
              value={settings.minBreakMinutes}
              min={0}
              step={5}
              invalid={!!errors.minBreakMinutes}
              onChange={(minBreakMinutes) => update({ minBreakMinutes })}
            />
          </Field>
        </div>
      </details>
      <Errors errors={errors} />
    </Card>
  )
}
