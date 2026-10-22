# Washington Prep Office Hours (frontend)

React + TypeScript + Tailwind v4 + Vite + React Router. Teacher and Student sides, responsive (desktop sidebar, phone tab bar).
It runs entirely in the browser on example data: no backend, no real email, nothing deployed.

## Run it (Windows PowerShell)

```powershell
cd frontend-teacher
npm install
npm run dev          # add  -- --open  to open the browser
```

Open the URL Vite prints (usually http://localhost:5173) and pick **Teacher** (Ms. Rivera) or **Student** (Maya K.).
Whatever one side does shows up on the other: a seat Maya books appears for Ms. Rivera, and her answers reach Maya.

| Command | What it does |
| --- | --- |
| `npm run build` | Type-check and build |
| `npx vitest run` | Unit and render tests (rules, calendar, themes, contrast, every page) |
| `npm run e2e` | Playwright tests in a real browser (sidebar stays fixed). First time: `npx playwright install chromium` |
| `npm run lint` | oxlint |

To check the app on any day, run the tests with a fixed date: `$env:VITE_TEST_NOW="2026-10-17T10:00:00"; npx vitest run`.

## Routes

- Teacher: `/teacher` (Dashboard), `/teacher/calendar`, `/teacher/office-hours`, `/teacher/days-off`,
  `/teacher/requests?tab=requests|bookings`, `/teacher/settings`
- Student: `/student` (Home), `/student/teachers`, `/student/teachers/:teacherId?day=YYYY-MM-DD`,
  `/student/bookings?tab=up|past|req`, `/student/settings`
- `/login` is a placeholder sign-in (pick a side). Real login belongs to the auth team.

## Themes

Settings -> Appearance has three color themes and Light / Dark / System. They apply immediately and are remembered
(`oh-palette`, `oh-theme` in localStorage).

| Theme | Look |
| --- | --- |
| Washington Navy (default) | Deep navy sidebar |
| Shield Mint | Navy sidebar, mint accent, green buttons |
| Crest Light | Light sidebar with navy text |

The only colors are the school crest's navy, torch orange and shield mint, plus white and neutral greys.
Orange is an accent only (active-nav bar, count badges, today's ring) and text on it is navy.
Status colors never change with the theme: open seats use the theme tint, full / day off use a pale orange tint, past is grey.
All colors are CSS variables in `src/index.css`; never hard-code a hex value. `src/lib/contrast.test.ts` checks every
text/background pair in all six combinations (3 themes x light/dark).

Put the crest at `public/school-logo.png` (square PNG, 256x256 or more). Until it exists a navy "WP" badge is shown.

## How the data flows

`pages -> useTeacher() / useStudent() -> src/api/teacher.ts | student.ts -> mock store or real backend`

- The domain rules (no past or started office hours, no booking on a day off, seats, one seat per office hour, no
  overlaps, schedule changes keep bookings) are pure functions in `src/lib/rules.ts`. The mock store enforces them;
  the real backend must enforce the same ones. The UI only shows and pre-validates them.
- `VITE_USE_MOCKS=true` (default) answers from a store in localStorage (`officehours.demo.v2`) seeded from today's date.
  The Example data / Reset chip in the top bar restores the original data.
- Reminders and notifications are simulated in the app. Nothing is emailed.

## Switch to the real backend later

1. Copy `.env.example` to `.env.local`: `VITE_USE_MOCKS=false` and `VITE_API_URL=http://localhost:8000`.
2. Make the backend match `docs/api-contract.md` (the endpoints `src/api/teacher.ts` and `student.ts` call).
3. Replace the placeholder login: `src/api/auth.ts`, `src/hooks/useAuth.ts`, `src/pages/auth/Login.tsx`.

## Ownership

Everything in `frontend-teacher/` is built by Subgroup B. Shared files need a PR note and a teammate review:
`src/components/common/`, `src/api/client.ts`, `src/api/auth.ts`, `src/hooks/useAuth.ts`, `src/types/`, `src/lib/`,
`src/routes/`, `src/index.css`, `docs/api-contract.md`.
