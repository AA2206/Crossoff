import type { Dispatch } from 'react'
import { validateSetAside, type SetAside } from '../../scheduler'
import type { Action } from '../state'
import { Card } from './Card'
import {
  Errors,
  Field,
  NumberInput,
  TimeInput,
  inputClass,
  smallButtonClass,
} from './fields'

export function SetAsideList({
  setAsides,
  dispatch,
}: {
  setAsides: SetAside[]
  dispatch: Dispatch<Action>
}) {
  return (
    <Card
      title="Set aside"
      action={
        <button
          type="button"
          className={smallButtonClass}
          onClick={() => dispatch({ type: 'setAside/add' })}
        >
          + Add block
        </button>
      }
    >
      <p className="mb-3 text-sm text-gray-500">
        Time kept free somewhere in a window, like lunch. No event is created.
      </p>
      <ul className="space-y-3">
        {setAsides.map((s) => (
          <SetAsideRow key={s.id} setAside={s} dispatch={dispatch} />
        ))}
      </ul>
    </Card>
  )
}

function SetAsideRow({
  setAside,
  dispatch,
}: {
  setAside: SetAside
  dispatch: Dispatch<Action>
}) {
  const errors = validateSetAside(setAside)
  const update = (patch: Partial<SetAside>) =>
    dispatch({ type: 'setAside/update', id: setAside.id, patch })

  return (
    <li className="rounded-lg border border-dashed border-gray-300 p-3">
      <div className="flex items-center gap-2">
        <input
          className={inputClass}
          placeholder="Label, e.g. Lunch"
          aria-label="Label"
          value={setAside.label}
          autoFocus={setAside.label === ''}
          aria-invalid={!!errors.label || undefined}
          onChange={(e) => update({ label: e.target.value })}
        />
        <button
          type="button"
          className={smallButtonClass}
          aria-label={`Remove ${setAside.label || 'block'}`}
          onClick={() => dispatch({ type: 'setAside/remove', id: setAside.id })}
        >
          ✕
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Field label="From">
          <TimeInput
            value={setAside.windowStart}
            invalid={!!errors.windowEnd}
            onChange={(windowStart) => update({ windowStart })}
          />
        </Field>
        <Field label="To">
          <TimeInput
            value={setAside.windowEnd}
            invalid={!!errors.windowEnd}
            onChange={(windowEnd) => update({ windowEnd })}
          />
        </Field>
        <Field label="Minutes">
          <NumberInput
            value={setAside.durationMinutes}
            min={5}
            step={5}
            invalid={!!errors.durationMinutes}
            onChange={(durationMinutes) => update({ durationMinutes })}
          />
        </Field>
      </div>
      <Errors errors={errors} />
    </li>
  )
}
