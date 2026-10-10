# Crossoff

Crossoff turns today's task list into time blocks on your Google Calendar,
scheduled around everything already on it.

List what you want to get done, most important first, with how long each task
should take and how many sessions to split it into. Crossoff finds your free
time, places the sessions, shows a preview, and adds the plan to your calendar
when you approve it.

- **No account and no server.** It's a static site: your browser talks to
  Google directly.
- **Every task gets a session before any task gets a second.**
- **Set-aside blocks** keep time free inside a window (like an hour for lunch
  between 12 and 3) without creating an event.
- **Two modes:** _Spread out_ leaves the longest breaks it can; _Finish early_
  packs sessions into the earliest slots.
- **Safe to re-plan or clear.** Every event Crossoff creates carries a hidden
  tag, and it only ever changes or deletes tagged events.

The full design is in
[`Day Planner — Product & Technical Spec.md`](./Day%20Planner%20%E2%80%94%20Product%20%26%20Technical%20Spec.md).

## Privacy

- Crossoff reads **only when you're busy**, using Google's free/busy lookup. It
  never sees what your events are.
- The Google access token is kept in memory only and is gone when you close the
  tab. Disconnect revokes it.
- Your tasks and settings are saved in your browser's local storage. Nothing is
  sent anywhere except to Google.

## Running your own copy

Crossoff needs a Google OAuth client ID, and each deployment needs its own: a
client ID only works on the web addresses registered with it.

### 1. Set up Google Cloud

1. In the [Google Cloud console](https://console.cloud.google.com/), create a
   project and enable the **Google Calendar API** (APIs & Services → Library).
   No billing account is needed.
2. Open **Google Auth Platform** (called _OAuth consent screen_ in older
   consoles):
   - **Branding:** set the app name, e.g. Crossoff.
   - **Audience:** choose **External** and leave it in **Testing**. Add your
     own Google account, and anyone else who will use it, under **Test users**
     (up to 100).
   - **Data access:** add these three scopes:
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/calendar.freebusy`
     - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
3. Under **Clients**, create an OAuth client ID of type **Web application**.
   Add these as **Authorized JavaScript origins** (no trailing slash):
   - `http://localhost:5173`
   - your deployed URL, e.g. `https://your-app.vercel.app`

   Leave _Authorized redirect URIs_ empty, and don't use the client secret
   anywhere: the browser-only flow doesn't need it.

While the app is in Testing, only listed test users can connect, and they'll
see a "Google hasn't verified this app" warning they can click through. Letting
anyone connect without the warning requires publishing the
app and passing Google's verification for sensitive scopes, which needs a
homepage and privacy policy on a domain you own.

### 2. Run it locally

Requires Node.js 22 or later.

```sh
npm install
cp .env.example .env.local   # then set VITE_GOOGLE_CLIENT_ID
npm run dev                  # http://localhost:5173
```

### 3. Deploy

The build is a static site in `dist/`, so any static host works. On Vercel:

1. Import the repository; the Vite defaults are right (build `npm run build`,
   output `dist`).
2. Add the environment variable `VITE_GOOGLE_CLIENT_ID` and redeploy. It's
   built into the page, so changes need a new deploy.
3. Add the deployed URL to the client ID's authorized JavaScript origins.

## Development

| Command                | What it does                                |
| ---------------------- | ------------------------------------------- |
| `npm run dev`          | Start the dev server (localhost:5173)       |
| `npm test`             | Run the tests once (`npm run test:watch` to watch) |
| `npm run lint`         | Lint with oxlint                            |
| `npm run format`       | Format with Prettier                        |
| `npm run build`        | Type-check and build to `dist/`             |

GitHub Actions runs lint, the format check, tests and the build on every push.

```
src/
  scheduler/   the planning algorithm: pure functions, no network
  calendar/    Google Calendar API calls (free/busy, calendars, events)
  auth/        Google sign-in; the token lives in memory only
  storage/     saving tasks and settings in local storage
  ui/          React components and app state
```

The scheduler works in minutes since midnight and knows nothing about Google,
so most of the logic is covered by fast unit tests.

## License

[MIT](./LICENSE)
