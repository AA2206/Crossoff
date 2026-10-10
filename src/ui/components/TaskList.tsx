import type { Dispatch } from 'react'
import { validateTask, type Task } from '../../scheduler'
import { taskColor } from '../colors'
import type { Action } from '../state'
import { Card } from './Card'
import {
  Errors,
  Field,
  NumberInput,
  inputClass,
  smallButtonClass,
} from './fields'

export function TaskList({
  tasks,
  dispatch,
}: {
  tasks: Task[]
  dispatch: Dispatch<Action>
}) {
  return (
    <Card
      title="Tasks"
      action={
        <button
          type="button"
          className={smallButtonClass}
          onClick={() => dispatch({ type: 'task/add' })}
        >
          + Add task
        </button>
      }
    >
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-500">
          What do you want to get done? Add a task to start.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-gray-500">
            Most important at the top. Use the arrows to reorder.
          </p>
          <ol className="space-y-3">
            {tasks.map((task, i) => (
              <TaskRow
                key={task.id}
                task={task}
                index={i}
                isFirst={i === 0}
                isLast={i === tasks.length - 1}
                dispatch={dispatch}
              />
            ))}
          </ol>
        </>
      )}
    </Card>
  )
}

function TaskRow({
  task,
  index,
  isFirst,
  isLast,
  dispatch,
}: {
  task: Task
  index: number
  isFirst: boolean
  isLast: boolean
  dispatch: Dispatch<Action>
}) {
  const errors = validateTask(task)
  const update = (patch: Partial<Task>) =>
    dispatch({ type: 'task/update', id: task.id, patch })
  const name = task.name || 'task'

  return (
    <li className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center gap-2">
        <span
          className={`size-3 shrink-0 rounded-full ${taskColor(index)}`}
          aria-hidden
        />
        <input
          className={inputClass}
          placeholder="Task name"
          aria-label="Task name"
          value={task.name}
          autoFocus={task.name === ''}
          aria-invalid={!!errors.name || undefined}
          onChange={(e) => update({ name: e.target.value })}
        />
        <div className="flex shrink-0">
          <button
            type="button"
            className={smallButtonClass}
            disabled={isFirst}
            aria-label={`Move ${name} up`}
            onClick={() => dispatch({ type: 'task/move', id: task.id, by: -1 })}
          >
            ↑
          </button>
          <button
            type="button"
            className={smallButtonClass}
            disabled={isLast}
            aria-label={`Move ${name} down`}
            onClick={() => dispatch({ type: 'task/move', id: task.id, by: 1 })}
          >
            ↓
          </button>
          <button
            type="button"
            className={smallButtonClass}
            aria-label={`Remove ${name}`}
            onClick={() => dispatch({ type: 'task/remove', id: task.id })}
          >
            ✕
          </button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label="Total min">
          <NumberInput
            value={task.totalMinutes}
            min={15}
            step={5}
            invalid={!!errors.totalMinutes}
            onChange={(totalMinutes) => update({ totalMinutes })}
          />
        </Field>
        <Field label="Sessions">
          <NumberInput
            value={task.sessions}
            min={1}
            invalid={!!errors.sessions}
            onChange={(sessions) => update({ sessions })}
          />
        </Field>
      </div>
      <Errors errors={errors} />
    </li>
  )
}
