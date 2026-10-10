# Crossoff

Turns a prioritized task list into time blocks on your Google Calendar. See
`Day Planner — Product & Technical Spec.md` for the full spec.

## Setup

```sh
npm install
cp .env.example .env.local   # then fill in VITE_GOOGLE_CLIENT_ID
npm run dev
```

## Scripts

| Command                | What it does                          |
| ---------------------- | ------------------------------------- |
| `npm run dev`          | Start the dev server (localhost:5173) |
| `npm test`             | Run Vitest once                       |
| `npm run lint`         | Lint with oxlint                      |
| `npm run format`       | Format with Prettier                  |
| `npm run build`        | Type-check and build to `dist/`       |
