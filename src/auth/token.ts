// Google Identity Services token model. The access token is held in this
// module's memory only, never persisted, so it is gone when the tab closes.
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
] as const

const GIS_SRC = 'https://accounts.google.com/gsi/client'

/** Treat a token as expired a minute early so it can't lapse mid-request. */
const EXPIRY_MARGIN_MS = 60_000

export type ConnectErrorKind =
  'closed' | 'blocked' | 'denied' | 'missing-scopes' | 'failed'

export class ConnectError extends Error {
  readonly kind: ConnectErrorKind
  constructor(kind: ConnectErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

let current: { token: string; expiresAt: number } | null = null
let gisLoading: Promise<void> | null = null

/**
 * Loads the Google sign-in script. Called on page load so that by the time
 * someone clicks, the popup can open straight from the click; browsers block
 * popups that open after a slow wait.
 */
export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  gisLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      gisLoading = null
      reject(new ConnectError('failed', "Couldn't load Google sign-in."))
    }
    document.head.appendChild(script)
  })
  return gisLoading
}

/** The current access token, or null if there is none or it has expired. */
export function getToken(): string | null {
  if (!current || Date.now() >= current.expiresAt - EXPIRY_MARGIN_MS)
    return null
  return current.token
}

export function clearToken() {
  current = null
}

/** Opens Google's popup and keeps the token if every scope was granted. */
export async function connect(): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId)
    throw new ConnectError('failed', 'VITE_GOOGLE_CLIENT_ID is not set')
  await loadGis()
  const { oauth2 } = window.google.accounts
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES.join(' '),
      callback: (response) => {
        if (response.error) {
          reject(
            new ConnectError(
              response.error === 'access_denied' ? 'denied' : 'failed',
              response.error_description ?? response.error,
            ),
          )
        } else if (!oauth2.hasGrantedAllScopes(response, ...SCOPES)) {
          // Someone unticked a box on Google's consent screen.
          oauth2.revoke(response.access_token, () => {})
          reject(
            new ConnectError(
              'missing-scopes',
              'Not every calendar permission was granted.',
            ),
          )
        } else {
          current = {
            token: response.access_token,
            expiresAt: Date.now() + Number(response.expires_in) * 1000,
          }
          resolve()
        }
      },
      error_callback: (error) =>
        reject(
          new ConnectError(
            error.type === 'popup_closed'
              ? 'closed'
              : error.type === 'popup_failed_to_open'
                ? 'blocked'
                : 'failed',
            error.message ?? error.type,
          ),
        ),
    })
    client.requestAccessToken()
  })
}

/** Revokes the token at Google and forgets it. */
export function disconnect() {
  if (current) window.google?.accounts.oauth2.revoke(current.token, () => {})
  current = null
}
