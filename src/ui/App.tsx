import { useState } from 'react'
import { requestAccessToken } from '../auth/token'

type Status =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ok'; scopes: string; expiresIn: number }
  | { kind: 'error'; message: string }

export default function App() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function connect() {
    setStatus({ kind: 'pending' })
    try {
      const token = await requestAccessToken()
      setStatus({
        kind: 'ok',
        scopes: token.scope,
        expiresIn: Number(token.expires_in),
      })
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4">
      <h1 className="text-4xl font-bold tracking-tight">Crossoff</h1>
      <p className="text-gray-600">
        Turn a prioritized task list into time blocks on your Google Calendar.
        Coming soon.
      </p>
      <div>
        <button
          type="button"
          onClick={connect}
          disabled={status.kind === 'pending'}
          className="rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Test Google connection
        </button>
      </div>
      {status.kind === 'ok' && (
        <p className="text-green-700">
          Got an access token (expires in {status.expiresIn}s). Scopes:{' '}
          {status.scopes}
        </p>
      )}
      {status.kind === 'error' && (
        <p className="text-red-700">Error: {status.message}</p>
      )}
    </main>
  )
}
