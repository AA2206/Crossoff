import type { ReactNode } from 'react'
import { fromInputTime, toInputTime } from '../time'

export const inputClass =
  'w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-base sm:py-1.5 sm:text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none aria-[invalid=true]:border-red-500'

export const smallButtonClass =
  'inline-flex min-h-10 min-w-10 items-center justify-center rounded-md px-2 py-1 text-sm text-gray-500 sm:min-h-0 sm:min-w-0 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent'

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
      {label}
      {children}
    </label>
  )
}

export function NumberInput({
  value,
  onChange,
  invalid,
  ...rest
}: {
  value: number
  onChange: (value: number) => void
  invalid?: boolean
  min?: number
  step?: number
  'aria-label'?: string
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className={inputClass}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onChange(e.target.valueAsNumber)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

export function TimeInput({
  value,
  onChange,
  invalid,
}: {
  value: number
  onChange: (value: number) => void
  invalid?: boolean
}) {
  return (
    <input
      type="time"
      step={300}
      className={inputClass}
      value={toInputTime(value)}
      onChange={(e) => onChange(fromInputTime(e.target.value))}
      aria-invalid={invalid || undefined}
    />
  )
}

export function Errors({ errors }: { errors: object }) {
  const messages = Object.values(errors) as string[]
  if (messages.length === 0) return null
  return (
    <ul className="mt-2 space-y-0.5 text-xs text-red-600">
      {messages.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  )
}
