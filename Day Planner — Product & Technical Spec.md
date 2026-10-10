# Crossoff — Product & Technical Spec

Oct 7, 2026 · @Arpan Agarwal

## Overview

Crossoff is a website that turns a list of prioritized tasks into time blocks on your Google Calendar, scheduled around everything already on it. You list what you want to get done today, most important first, with how long you want to spend on each task and how many sessions to split it into. The site finds your free time, places the sessions, shows a preview, and writes the approved plan to your calendar.

There is no sign-up and no account. You open the site, click Connect Google Calendar, approve Google's permission popup, and start planning.

**Existing products.** Automatic task scheduling already exists. Reclaim.ai splits tasks into sessions and has flexible-window Habits for things like lunch; FlowSavvy, Motion and Morgen also auto-schedule tasks into a calendar. Crossoff differs in five ways:

- No account: open the page, connect, plan.
- One day at a time, planned once, rather than constant weekly reshuffling.
- Set-aside blocks protect time without creating calendar events.
- Spread out mode deliberately maximizes breaks instead of packing the earliest slots.
- Every planner event is tagged, so the plan can always be cleanly cleared.

## Goals and non-goals

v1 plans a single day for one person, entirely in the browser.

**Goals**

- Connect Google Calendar with one click and no account on the site.
- Read existing busy times and schedule task sessions only in free time.
- Split each task into the requested number of sessions and spread them across the day.
- Make sure every task gets one session before any task gets a second.
- Show a preview before anything is written to the calendar.
- Re-plan the rest of the day from the current time without touching real events.
- Report clearly which sessions did not fit.

**Non-goals for v1**

- Multi-day or weekly planning.
- Accounts, a backend, or a database.
- Calendars other than Google.
- Automatic background re-planning.
- Deadlines or time-of-day preferences per task (see Future features).

## User flow

A visit goes from landing to a committed plan in five steps, with a preview gate before anything touches the calendar.

&#91;embedded content: user flow · 6 steps, 1 decision, 2 loops\]

If the preview doesn't look right, you edit tasks and regenerate. Later in the day, Re-plan from now clears the planner's future events and sends you back through the same preview.

## Main screen

Everything happens on one screen: you set up the day on the left and check the plan on the right before committing.

&#91;embedded content: main screen mockup · example day with 3 tasks, 2 set-aside blocks\]

The left column holds the task list, set-aside blocks, and day settings, with the gap settings behind Advanced. Generate plan fills the preview on the right: existing events in gray, sessions colored by task, and set-aside windows outlined with dashes so you can see the protected time. The report line sits above Commit to calendar, which is the only action that writes anything.

**First visit.** When someone first lands on the site, nothing is connected and the task list is empty. The preview panel holds the Connect Google Calendar button, and Generate plan stays disabled until there's at least one task and a connected calendar. Tasks can be typed in before connecting.

&#91;embedded content: first-visit mockup · not connected, no tasks\]

## Inputs

The planner takes four groups of input: day settings, advanced settings, the task list and set-aside blocks. Only the task list is entered each day; everything else has defaults and is remembered between visits.

**Day settings**

| Setting | Type | Default | Notes |
| --- | --- | --- | --- |
| Date | date | Today | v1 plans one day at a time |
| Working window | start and end time | 9:00 am – 10:00 pm | Nothing is scheduled outside it |
| Buffer around events | minutes | 10 | Kept free before and after existing events |
| Minimum break between sessions | minutes | 10 | Kept free between any two planned sessions |
| Calendars to check | list | Primary | Which calendars count as busy |

**Mode** is a day setting with two options. Spread out (the default) maximizes breaks by distributing sessions across the working window; Finish early packs them into the earliest slots.

The buffer and minimum break are advanced settings, hidden behind an Advanced toggle since most people won't change them.

**Task fields**

| Field | Type | Validation |
| --- | --- | --- |
| Name | text | Required; becomes the event title |
| Total time | minutes | 15 or more, in 5-minute steps |
| Sessions | integer | 1 or more; total time ÷ sessions must be at least 15 minutes |

The order of the list is the priority: the most important task goes at the top, and arrows move tasks up and down.

**Set-aside blocks**

A set-aside block reserves time inside a window without fixing when it happens or creating an event. The planner guarantees that much continuous free time stays open somewhere in the window, and you decide when to actually take it.

| Field | Type | Example |
| --- | --- | --- |
| Label | text | Lunch |
| Window | start and end time | 12:00 pm – 3:00 pm |
| Duration | minutes | 60 |

For example, Lunch (12–3 pm, 60 min) and Gym (6–9 pm, 90 min). Duration must be no longer than the window.

Tasks, day settings and set-aside blocks are saved in the browser's localStorage, so the list survives a page reload.

## Scheduling algorithm

The scheduler walks through the day from the start and, at each open point, places the highest-ranked session that is allowed there. Every task gets its first session before any task gets a second.

**1. Build the free stretches**

- Start with the working window.
- If re-planning, cut off everything before the current time, rounded up to the next 5 minutes.
- Merge overlapping calendar events, expand each by the event buffer, and remove them from the window.
- Discard any leftover stretch shorter than 15 minutes.

**2. Split tasks into sessions**

- Each task becomes `sessions` blocks of `total ÷ sessions` minutes, rounded to 5. Any rounding remainder goes to the first session so the total is preserved.
- Each session is labelled with its task, its position in the list and its round (session 1, 2, 3…).

**3. Rank the sessions**

Sort by round, then the task's position in the list:

```ts
sessions.sort((a, b) =>
  a.round - b.round ||
  a.taskIndex - b.taskIndex
);
```

**4. Walk through the day and place sessions**

- Set the current time to the start of the first free stretch.
- Scan the ranked list from the top. A session is allowed at the current time only if it ends before the stretch ends and every set-aside window still has a continuous free stretch at least as long as its block.
- Place the first allowed session, remove it from the list, and move the current time to its end plus the minimum break.
- If nothing is allowed, move the current time forward 5 minutes and scan again; at the end of a stretch, jump to the next one. Stepping forward rather than jumping straight to the next stretch matters for set-aside blocks: a session that would eat into a window's protected time at one start time may be fine a little later.
- Stop when free stretches or sessions run out.

**5. Spread the sessions (Spread out mode only)**

- In each free stretch, compute the slack: stretch length minus session time minus set-aside time.
- Divide the slack evenly among the gaps between sessions, rounded to 5 minutes. A gap at the edge of a stretch is added only when that edge is a calendar event, not the start or end of the working window.
- No gap drops below the minimum break, and no session moves into a set-aside block. Each stretch spreads only its own slack, so break lengths can differ between stretches; moving sessions between stretches could undo the ranking.

**6. Report**

- Every unplaced session goes on the unscheduled report, grouped by task: "Essay: 2 of 3 sessions scheduled (40 min not scheduled)." Suggestions: lower the session count, widen the working window, or shorten the task.
- Any set-aside window where calendar events already leave too little time gets a warning: "Gym: only 60 of 90 minutes free between 6 and 9 pm."

**7. Preview, then commit**

The plan is shown on a timeline; nothing touches the calendar until it's approved.

**Example.** Ranked list: Essay 1 (60 min), Problem set 1 (45), Email (30), Essay 2 (60), Problem set 2 (45). Free stretches 9:00–10:30 and 11:30–5:00.

| Time | Placed | Why |
| --- | --- | --- |
| 9:00–10:00 | Essay 1 | Top of the list, fits |
| 10:10 | — | 20 minutes left, nothing that short; jump to 11:30 |
| 11:30–12:15 | Problem set 1 | Next on the list |
| 12:25–12:55 | Email | Next on the list |
| 1:05–2:05 | Essay 2 | Next on the list |
| 2:15–3:00 | Problem set 2 | Next on the list |

**Set-aside and re-planning details**

- Windows that have already ended are ignored; a window in progress counts only the time from now to its end.
- Overlapping windows are each checked on their own; the preview warns if both can't fit.

## Google Calendar integration

The browser talks to Google directly using Google Identity Services' token model, so the site needs no backend and no account.

**Connecting.** The Connect button calls `google.accounts.oauth2.initTokenClient(...).requestAccessToken()`. Google shows its consent popup; on approval the page receives an access token, held in memory only. Tokens last about an hour and there is no refresh token. When one expires, the next API call fails with 401 and the site shows a one-click Reconnect button, keeping the user's tasks intact.

**Scopes** — request only these:

| Scope | Used for |
| --- | --- |
| `calendar.events` | Creating, listing and deleting the planner's own events |
| `calendar.freebusy` | Reading busy times without seeing event details |
| `calendar.calendarlist.readonly` | Listing calendars for the "Calendars to check" setting |

**API calls**

| Step | Endpoint | Notes |
| --- | --- | --- |
| Load calendars | `GET calendarList` | Once after connecting |
| Read busy times | `POST freeBusy` | `timeMin`/`timeMax` = working window, `items` = selected calendars, `timeZone` = browser time zone |
| Find existing plan | `GET events` on primary | `privateExtendedProperty=planner=true`, limited to the day |
| Clear plan | `DELETE events/{id}` | Only events found by the query above |
| Write plan | `POST events` on primary | One call per session |

**Tagging planner events.** Every event the site creates carries `extendedProperties.private.planner = "true"` and a fixed `colorId`, with a title like "Essay (1/3)". Clearing and re-planning only ever touch events with that tag, so real meetings and classes can't be changed or deleted by the app.

**Freebusy returns planner events too.** When re-planning, delete the old future planner events first, then call freeBusy, so the old plan doesn't block the new one.

## Architecture and tech stack

v1 is a static single-page app: the browser holds all state and calls Google directly, with no server of its own.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | React + Vite + TypeScript | Fast to build; static output |
| Styling | Tailwind CSS | Quick, consistent UI |
| Auth | Google Identity Services token model | One-click connect, no backend |
| Calendar API | Direct `fetch` to the Calendar REST API | No SDK needed for five endpoints |
| Local state | localStorage | Tasks and settings survive reloads |
| Hosting | Vercel or Netlify (static) | Free tier, HTTPS by default |
| Tests | Vitest | Unit tests for the scheduler |

There is no backend of our own: the host only serves static files. Auth, calendar calls, scheduling and saved settings all run in the browser. The token model needs only a public client ID, not a client secret, so nothing has to be hidden on a server.

**Project structure**

```
src/
  scheduler/   pure functions, no network: the whole algorithm
  calendar/    Google API wrappers
  auth/        connect, reconnect, disconnect
  storage/     load and save settings and tasks in localStorage
  ui/          components
```

The scheduler knows nothing about Google. It takes plain data in and returns plain data out, so it can be built and fully unit-tested before any OAuth work.

**Data models**

| Type | Fields |
| --- | --- |
| `Task` | id, name, totalMinutes, sessions |
| `SetAside` | id, label, windowStart, windowEnd, durationMinutes |
| `Settings` | working window, mode, buffer, minBreak, calendarIds |
| `Interval` | start, end, as minutes since midnight |
| `Session` | taskId, taskIndex, round, duration; start and end once placed |
| `PlanResult` | placed sessions, unscheduled sessions, warnings |

Inside the scheduler, times are plain minute numbers; they're converted to real timestamps only at the edges, which avoids date bugs.

**Scheduler functions** (one per algorithm step)

- `buildFreeStretches(window, busy, settings, now)`
- `splitIntoSessions(tasks)`
- `rankSessions(sessions)`
- `placeSessions(ranked, stretches, setAsides, settings)`, with a helper `setAsideStillFits(window, placed, busy)` that finds the longest continuous free stretch in a window
- `spreadSessions(placed, stretches, setAsides, settings)`
- `plan(...)`, which runs all of the above and builds the report

**Calendar functions**

- `listCalendars()`, `getBusy(date, calendarIds)`, `listPlannerEvents(date)`, `deletePlannerEvents(ids)`, `createSessionEvents(sessions)`.
- All share one `gfetch` helper that adds the token, retries rate-limit responses (429, or 403 with a rate-limit reason) and 5xx with backoff (up to 3 times), and throws a distinct error on 401 so the UI shows Reconnect.

**UI and state**

Components: ConnectButton, TaskList and TaskRow, SetAsideList, DaySettings with an Advanced panel, Timeline preview (existing events in gray, sessions in color), UnscheduledReport, and Commit and Re-plan buttons. A single top-level `useReducer` holds state; no state library is needed.

**Testing**

Testing focuses on the scheduler: one test per rule (buffers, rounding remainders, round-robin order, minimum break, set-aside protection, spreading, unscheduled report, a daylight-saving day), plus a few full-day scenarios with known expected output. The calendar and UI layers are thin enough to test by hand.

**Time zones.** All times use the browser's time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and are sent to Google as RFC 3339 strings with offsets.

**Moving to a backend later.** If persistence across days or automatic re-planning is needed, switch to Next.js with NextAuth's Google provider and JWT sessions. That adds refresh tokens without a database. The scheduler module moves over unchanged.

**Concurrency and scale.** Many people can use the site at once with no extra work. Each browser holds its own token, calls Google with its own credentials and runs the scheduler locally, so users never share state on our side, and the static files are served from the host's CDN. The real limits are Google's: the 100-test-user cap while the app is unverified (the first limit we'd hit), per-project and per-user Calendar API quotas (a plan uses only a handful of calls), and the hosting free tier's bandwidth.

## Edge cases and error handling

| Case | Behaviour |
| --- | --- |
| All-day events | Follow the event's own Free/Busy setting: freeBusy already skips ones marked Free (the usual default) and blocks the day for ones marked Busy |
| Events marked "free" | Already excluded by freeBusy |
| Declined invitations | Not returned as busy by freeBusy |
| Overlapping busy blocks | Merged before computing free slots |
| Free slot shorter than 15 min | Discarded |
| Planning when most of the day has passed | Only schedules after the current time |
| Nothing fits | Preview is empty; report lists every task with suggestions |
| Token expired (401) | Reconnect button; tasks and preview kept |
| Rate limit or 5xx | Retry with backoff, up to 3 times; then show an error |
| Commit fails partway | Show which sessions were created; offer "Retry remaining" or "Undo" (delete the ones created) |
| User edits a planner event in Google | Treated as busy on the next re-plan only if it's untagged; tagged events are still owned by the planner |
| Commit clicked twice | Button disabled during the commit |
| Day crosses a daylight-saving change | Times computed in the user's zone; covered by a scheduler test |

## Privacy, security and Google verification

The site never sends calendar data anywhere except back to Google, because there is no server to send it to.

- The access token lives in memory only, never in localStorage or cookies, and is gone when the tab closes.
- freeBusy returns only busy intervals, not event titles or attendees, so the app never sees what your events are.
- localStorage holds only the task list and day settings.
- A Disconnect button revokes the token with `google.accounts.oauth2.revoke`.

**Google Cloud setup**

1. Create a Google Cloud project and enable the Google Calendar API.
2. Configure the OAuth consent screen (external, in testing mode) with the three scopes above.
3. Create an OAuth client ID of type Web application; add the local dev URL and the production URL as authorized JavaScript origins.
4. Add each person who will use it as a test user.

**Verification limits.** In testing mode, only listed test users (up to 100) can connect, and they see an "unverified app" warning. The calendar scopes are classed as sensitive, so opening the site to the public requires Google's app verification, including a privacy policy page and a homepage on a verified domain.

## Milestones and future features

Build the scheduler first against a mock calendar, so the core logic is tested before any OAuth work.

**v1 milestones**

- [ ] Scheduler module with unit tests (free slots, splitting, round-robin ordering, gap rule, unscheduled report)
- [ ] Task form, day settings and timeline preview using mock busy times
- [ ] Google Cloud project, OAuth client and Connect button
- [ ] freeBusy integration replacing the mock
- [ ] Commit plan to calendar with tagged events
- [ ] Re-plan from now and Disconnect
- [ ] Deploy to static hosting and add test users

**Future features**

- Deadlines per task (must finish before a set time).
- Preferred time of day per task, e.g. deep work mornings only.
- Drag to adjust sessions in the preview before committing.
- "Focus mode" toggle that schedules all of a task's sessions before moving on.
- Multi-day planning that carries unscheduled sessions to tomorrow.
- Mark sessions done, so re-planning knows what's actually finished.

## Sprint plan

Six one-week sprints, Monday to Sunday, take Crossoff from an empty repo to a working site used by test users. Sprint 0 sets up the environment; every sprint after it ends with something working and deployed.

| Sprint | Dates | Goal |
| --- | --- | --- |
| 0 | Oct 12 – 18 | Environment: repo, tooling, CI, hosting, Google Cloud |
| 1 | Oct 19 – 25 | Scheduler core with tests |
| 2 | Oct 26 – Nov 1 | Spreading, plus the full UI on mock calendar data |
| 3 | Nov 2 – 8 | Connect Google Calendar and preview real days |
| 4 | Nov 9 – 15 | Commit, re-plan and error handling |
| 5 | Nov 16 – 22 | Polish, mobile layout and launch to test users |

### Sprint 0 — Environment setup (Oct 12 – 18)

- [ ] Create the GitHub repo and a Vite + React + TypeScript project
- [ ] Add Tailwind, ESLint, Prettier and Vitest
- [ ] Create the folder structure: `scheduler/`, `calendar/`, `auth/`, `storage/`, `ui/`
- [ ] Set up GitHub Actions to run lint and tests on every push
- [ ] Connect the repo to Vercel with automatic preview deploys
- [ ] Create the Google Cloud project and enable the Google Calendar API
- [ ] Configure the OAuth consent screen in testing mode with the three scopes
- [ ] Create the OAuth web client ID; add `localhost` and the Vercel URL as authorized origins
- [ ] Add yourself as a test user and store the client ID as `VITE_GOOGLE_CLIENT_ID`
- [ ] Check domain availability for Crossoff and pick one

**Done when** a placeholder Crossoff page is live on Vercel, CI passes, and a throwaway button successfully gets an access token from Google.

### Sprint 1 — Scheduler core (Oct 19 – 25)

- [ ] Define the types: `Task`, `SetAside`, `Settings`, `Interval`, `Session`, `PlanResult`
- [ ] `buildFreeStretches`: working window, current-time cutoff, merged and buffered events, 15-minute minimum
- [ ] `splitIntoSessions` with rounding to 5 minutes and the remainder on session 1
- [ ] `rankSessions` by round, then list order
- [ ] `placeSessions`: walk the day, minimum break, step forward 5 minutes, `setAsideStillFits`
- [ ] Unscheduled report and set-aside warnings
- [ ] Unit tests for each rule, plus the worked example from this spec

**Done when** `plan()` turns hard-coded busy times and tasks into the correct placed sessions and report, with all tests green.

### Sprint 2 — Spreading and UI on mock data (Oct 26 – Nov 1)

- [ ] `spreadSessions` with tests (edge gaps only at calendar events, minimum break floor, set-aside respected)
- [ ] Finish early / Spread out toggle wired to the scheduler
- [ ] Task list, set-aside blocks, day settings and Advanced panel, with validation
- [ ] Save tasks, set-asides and settings to localStorage
- [ ] Timeline preview: events in gray, sessions colored by task, dashed set-aside windows
- [ ] Report line and the first-visit empty state
- [ ] A mock busy list standing in for Google

**Done when** you can enter a realistic day and see a correct, spread-out plan in the browser without connecting anything.

### Sprint 3 — Google Calendar connection (Nov 2 – 8)

- [ ] Connect, Reconnect and Disconnect using the GIS token client; token kept in memory only
- [ ] `gfetch` helper with retries for rate limits (429, or 403 with a rate-limit reason) and 5xx, and a distinct 401 error
- [ ] `listCalendars` feeding the Calendars to check setting
- [ ] `getBusy` via freeBusy, replacing the mock, with time-zone conversion to minutes
- [ ] Preview shows the real day's events before Generate is pressed
- [ ] Test the scheduler's daylight-saving case against real times

**Done when** you connect your own calendar and get a correct preview of a real day.

### Sprint 4 — Commit and re-plan (Nov 9 – 15)

- [ ] `createSessionEvents` with the planner tag, fixed color and "Essay (1/3)" titles
- [ ] `listPlannerEvents` and `deletePlannerEvents`
- [ ] Re-plan from now: delete future planner events, refetch busy times, plan from the current time
- [ ] Commit failures: show what was created, offer Retry remaining or Undo
- [ ] Disable Commit while a commit is running
- [ ] Preview marks itself out of date when tasks change
- [ ] Walk through the edge-case table and fix what's missing

**Done when** you plan, commit, re-plan and clear a real day without touching any non-planner event.

### Sprint 5 — Polish and launch (Nov 16 – 22)

- [ ] Stacked layout for phones
- [ ] Keyboard navigation and labels for accessibility
- [ ] Loading and error states across the app
- [ ] Privacy policy page (needed later for Google verification anyway)
- [ ] Connect the chosen domain
- [ ] Add friends as test users and collect feedback for a week of real use
- [ ] README with setup instructions

**Done when** Crossoff is live on its own domain and at least a few test users are planning their days with it.

If a sprint slips, the cut line is Sprint 5's polish items: the app is fully usable at the end of Sprint 4.
