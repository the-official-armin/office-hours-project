# CLAUDE.md

## Overview
Office Hours Booking System: students book office-hour slots with teachers on a calendar (like
theater seat selection), give a short reason, and get email reminders. Roles: Student, Teacher, Admin.
**We are frontend only.** Our subgroup (Lucas, Austin, Ryan) builds the Teacher desktop UI. Another
team owns the backend. Do not write backend code.

## Tech stack
React + TypeScript (Vite, strict mode), Tailwind CSS, React Router. Git + GitHub, deploy on Vercel.
Backend (not ours): Python + FastAPI + PostgreSQL + SQLAlchemy + JWT.

## Repo layout
```
CLAUDE.md  README.md  .gitignore
.github/pull_request_template.md
docs/            git-workflow.md, api-contract.md
frontend/
  .env.example   VITE_API_URL, VITE_USE_MOCKS=true
  src/
    pages/       teacher/ (OURS), student/ admin/ auth/ (other teams, stubs)
    components/  teacher/ (OURS), common/ (shared)
    api/         client.ts (shared), teacher.ts, mocks/teacher.ts (OURS)
    hooks/  types/ (shared)  routes/ (shared)
```

## Commands (run in `frontend/`)
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build` (also type-checks)
- Type-check only: `npx tsc -b`
- Lint: `npm run lint`

## Our subgroup: Teacher desktop UI (Lucas, Austin, Ryan)
Owned: `pages/teacher/`, `components/teacher/`, `api/teacher.ts`, `api/mocks/teacher.ts`.

| Page | Purpose |
| --- | --- |
| TeacherDashboard | Upcoming office hours and booked students |
| OfficeHourSettings | Two timing options and max students per slot (with default) |
| TeacherCalendar | Availability and bookings on a calendar |
| DaysOff | Mark and remove days off |
| BookingRequests | Student bookings with each reason summary |
| TeacherSettings | Profile and email reminder preferences |

`components/teacher/TeacherLayout.tsx` provides the sidebar, header, and logout button.
Desktop only (min width 1024px): sidebar + main layout, no mobile/tablet breakpoints.

## Other subgroups (do not edit their folders)
- A: Sammy, Wan Ho, Humay
- C: Davis, Eshi, Maya, Kenzo
- D: Kai, Eric, Cyber

Student, admin and auth pages are other teams' stubs (`// Owner: other team, do not edit without coordinating`).

**Shared areas** (`components/common/`, `api/client.ts`, `types/`, `routes/`, `docs/api-contract.md`):
any change needs a PR note and a teammate review.

## Conventions
- Functional components, Tailwind only (no custom CSS unless needed).
- All backend calls go through `src/api/`. Components never call `fetch` directly.
- Types live in `src/types/` and mirror `docs/api-contract.md`.
- `VITE_USE_MOCKS` defaults to true so we never wait on the backend.
- Booking rules (no past bookings, no bookings on days off, max students per slot) are shown and
  pre-validated in the UI only. The backend is the source of truth.

## Git workflow
- Never commit to `main`. Branch names: `feature/teacher-<short-name>`.
- Small PRs. Pull before pushing. One teammate reviews each PR.
- Beginner guide: `docs/git-workflow.md`.

## Do not
- Change the tech stack.
- Add dependencies without noting it in the PR.
- Commit `.env` files or secrets.
- Edit other teams' folders.
- Build mobile layouts for Teacher pages.
- Build the Alma integration (stretch goal, docs only).
- Write backend code.

## Current status
- [ ] TeacherDashboard
- [ ] OfficeHourSettings
- [ ] TeacherCalendar
- [ ] DaysOff
- [ ] BookingRequests
- [ ] TeacherSettings
- [ ] Login/logout wiring
- [ ] Calendar view
- [ ] Mock-to-real API switch
