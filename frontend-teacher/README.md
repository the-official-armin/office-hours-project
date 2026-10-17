# Teacher desktop UI (local MVP)

React + TypeScript + Tailwind + Vite + React Router. Desktop only (min width 1024px).
This app runs entirely in the browser on local demo data. There is no backend, no real email and no deployment.

## Run it (Windows PowerShell)

```powershell
cd frontend-teacher
npm install
Copy-Item .env.example .env.local   # optional: the defaults already use the demo data
npm run dev
```

Open http://localhost:5173 and log in with the demo account:

- Email: `teacher@demo.school`
- Password: `demo`

Other commands: `npm run build` (type-check + build), `npm run test` (booking rule tests), `npm run lint`.

## What you can do

- **Dashboard**: seats booked this week, next office hour, open requests (Accept / Decline).
- **Calendar**: any month, click a day to see its office hours and students, mark a day off.
- **Office hours**: two timings, their days, seats per office hour. Existing bookings are never deleted.
- **Days off**: add and remove; a confirmation shows how many bookings a day off affects.
- **Booking requests**: accept or decline requests, and see upcoming bookings with each reason.
- **Settings**: profile and which (simulated) email reminders you get.
- **Demo tools** (sidebar, "Demo"): act as a student to book seats and send requests, cancel bookings, reset data.
  The Student UI belongs to another team, so this page stands in for it. It is easy to remove later.

Data is stored in your browser's localStorage under `officehours.demo.v1`. Use **Demo tools > Reset demo data**
to start over.

## What is simulated

| Real thing | In this MVP |
| --- | --- |
| Backend and database | `src/api/mocks/store.ts` (localStorage, seeded relative to today's date) |
| Booking rules (no past, no day off, max students) | `src/api/mocks/bookingRules.ts`, with unit tests. The real backend must enforce these. |
| Email reminders | Notifications in the bell panel. Nothing is ever sent. |
| Login (JWT) | A placeholder flag in the store. The auth team owns the real login. |
| Latency | A 150-300 ms delay on every mock call, so loading states are real. |

## How data flows

`pages -> useTeacher() (hooks/TeacherDataProvider.tsx) -> api/teacher.ts -> mocks or real backend`.
Pages never call `fetch` or touch localStorage.

## Switch to the real backend later

1. Copy `.env.example` to `.env.local` and set:
   ```
   VITE_USE_MOCKS=false
   VITE_API_URL=http://localhost:8000
   ```
2. Make the backend match [docs/api-contract.md](../docs/api-contract.md). `src/api/teacher.ts` already calls those endpoints.
3. Replace the placeholder login: `src/api/auth.ts`, `src/hooks/useAuth.ts` and `src/pages/auth/Login.tsx` belong to the auth team.
4. Delete the Demo tools page, its route in `src/routes/AppRoutes.tsx`, and its sidebar link in `TeacherLayout.tsx`.

## Ownership

Ours (Subgroup B): `pages/teacher/`, `components/teacher/`, `api/teacher.ts`, `api/mocks/`.
Shared (PR note and teammate review): `components/common/`, `api/client.ts`, `api/auth.ts`, `hooks/useAuth.ts`,
`types/`, `lib/`, `routes/`, `src/index.css`, `docs/api-contract.md`.
Other teams: `pages/student/`, `pages/admin/`, and the real login.
