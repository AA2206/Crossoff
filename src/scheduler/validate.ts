import { MIN_STRETCH, STEP } from './intervals'
import type { SetAside, Settings, Task } from './types'

export type Errors<T> = Partial<Record<keyof T, string>>

const inSteps = (n: number) => Number.isInteger(n) && n % STEP === 0

export const hasErrors = (errors: object) => Object.keys(errors).length > 0

export function validateTask(task: Task): Errors<Task> {
  const errors: Errors<Task> = {}
  if (task.name.trim() === '') errors.name = 'Give the task a name'
  if (!inSteps(task.totalMinutes) || task.totalMinutes < MIN_STRETCH)
    errors.totalMinutes = 'At least 15 minutes, in 5-minute steps'
  if (!Number.isInteger(task.sessions) || task.sessions < 1)
    errors.sessions = 'At least 1 session'
  else if (
    !errors.totalMinutes &&
    task.totalMinutes / task.sessions < MIN_STRETCH
  )
    errors.sessions = 'Sessions would be under 15 minutes each'
  return errors
}

export function validateSetAside(setAside: SetAside): Errors<SetAside> {
  const errors: Errors<SetAside> = {}
  if (setAside.label.trim() === '') errors.label = 'Give it a label'
  if (!(setAside.windowEnd > setAside.windowStart))
    errors.windowEnd = 'The window must end after it starts'
  if (!inSteps(setAside.durationMinutes) || setAside.durationMinutes < STEP)
    errors.durationMinutes = 'At least 5 minutes, in 5-minute steps'
  else if (
    !errors.windowEnd &&
    setAside.durationMinutes > setAside.windowEnd - setAside.windowStart
  )
    errors.durationMinutes = 'Longer than its window'
  return errors
}

export function validateSettings(settings: Settings): Errors<Settings> {
  const errors: Errors<Settings> = {}
  const { start, end } = settings.workingWindow
  if (!(end > start)) errors.workingWindow = 'The day must end after it starts'
  if (!inSteps(settings.bufferMinutes) || settings.bufferMinutes < 0)
    errors.bufferMinutes = '0 or more, in 5-minute steps'
  if (!inSteps(settings.minBreakMinutes) || settings.minBreakMinutes < 0)
    errors.minBreakMinutes = '0 or more, in 5-minute steps'
  if (settings.calendarIds.length === 0)
    errors.calendarIds = 'Pick at least one calendar to check'
  return errors
}
