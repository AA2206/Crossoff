// Google Identity Services token model. The access token is held in memory
// only, never persisted.
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
].join(' ')

const GIS_SRC = 'https://accounts.google.com/gsi/client'

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () =>
      reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
}

export async function requestAccessToken(): Promise<google.accounts.oauth2.TokenResponse> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('VITE_GOOGLE_CLIENT_ID is not set')
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error)
          reject(new Error(response.error_description ?? response.error))
        else resolve(response)
      },
      error_callback: (error) => reject(new Error(error.message ?? error.type)),
    })
    client.requestAccessToken()
  })
}
