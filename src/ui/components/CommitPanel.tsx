import type { CommitState } from '../state'

const buttonClass =
  'rounded-lg bg-gray-900 px-4 py-2.5 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40'
const smallButtonClass =
  'rounded-md border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function CommitPanel({
  commit,
  canCommit,
  disabledReason,
  replaceCount,
  sessionCount,
  existingCount,
  onCommit,
  onRetryRemaining,
  onUndo,
  onRetryRemove,
  onClear,
}: {
  commit: CommitState
  canCommit: boolean
  disabledReason: string | null
  /** Crossoff sessions already on the day that committing replaces. */
  replaceCount: number
  sessionCount: number
  /** Crossoff sessions on the day, for Clear. */
  existingCount: number
  onCommit: () => void
  onRetryRemaining: () => void
  onUndo: () => void
  onRetryRemove: () => void
  onClear: () => void
}) {
  const working = commit.status === 'working'

  return (
    <div className="mt-4 space-y-2">
      {commit.status === 'create-failed' && (
        <div
          className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
          role="alert"
        >
          <p>
            Added {plural(commit.createdIds.length, 'session')} of{' '}
            {sessionCount} before an error: {commit.message}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className={`${smallButtonClass} border-amber-900 bg-amber-900 text-white hover:bg-amber-800`}
              onClick={onRetryRemaining}
            >
              Retry remaining
            </button>
            <button
              type="button"
              className={`${smallButtonClass} border-amber-300 hover:bg-amber-100`}
              onClick={onUndo}
            >
              Undo
            </button>
          </div>
        </div>
      )}
      {commit.status === 'remove-failed' && (
        <div
          className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
          role="alert"
        >
          <p>
            Your new plan is in your calendar, but{' '}
            {plural(commit.leftoverIds.length, 'old session')} couldn't be
            removed: {commit.message}
          </p>
          <button
            type="button"
            className={`mt-2 ${smallButtonClass} border-amber-900 bg-amber-900 text-white hover:bg-amber-800`}
            onClick={onRetryRemove}
          >
            Try again
          </button>
        </div>
      )}
      {commit.status === 'error' && (
        <p
          className="rounded-md bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {commit.message}
        </p>
      )}
      {commit.status === 'done' && (
        <p
          className="rounded-md bg-green-50 p-3 text-sm text-green-800"
          role="status"
        >
          Added {plural(commit.created, 'session')} to your calendar
          {commit.replaced > 0 &&
            `, replacing ${plural(commit.replaced, 'earlier one')}`}
          .
        </p>
      )}
      {commit.status === 'undone' && (
        <p
          className="rounded-md bg-gray-100 p-3 text-sm text-gray-700"
          role="status"
        >
          Undone. Your calendar is back to how it was.
        </p>
      )}
      {commit.status === 'cleared' && (
        <p
          className="rounded-md bg-gray-100 p-3 text-sm text-gray-700"
          role="status"
        >
          Removed {plural(commit.count, 'Crossoff session')} from this day.
        </p>
      )}

      {replaceCount > 0 && commit.status === 'idle' && canCommit && (
        <p className="text-sm text-gray-600">
          Committing replaces {plural(replaceCount, 'Crossoff session')} on this
          day that haven't started yet.
        </p>
      )}

      <button
        type="button"
        className={`w-full ${buttonClass}`}
        disabled={!canCommit || working}
        title={disabledReason ?? undefined}
        onClick={onCommit}
      >
        {working ? commit.label : 'Commit to calendar'}
      </button>
      {disabledReason && !working && (
        <p className="text-center text-xs text-gray-500">{disabledReason}</p>
      )}

      {existingCount > 0 && !working && (
        <button
          type="button"
          className="block w-full text-center text-xs text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline"
          onClick={onClear}
        >
          Remove Crossoff's {plural(existingCount, 'session')} from this day
        </button>
      )}
    </div>
  )
}
