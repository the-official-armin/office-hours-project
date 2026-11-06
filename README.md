# Office Hours Project

Students book office-hour meetings with teachers the way you pick seats in a theater: pick a teacher, see availability on a calendar, take an open slot, and leave a short reason. Teachers set when they are available. Everyone gets an email reminder.

This repo is a school-club MVP. Roles are **Student**, **Teacher**, and **Admin**. Students and teachers each have a working web app (`frontend-teacher/`) backed by a FastAPI + PostgreSQL API (`backend/`) with sign-in; admin is planned.

## What we are building

### Core

- People book meetings with their teachers
- Theater-seat style booking (a slot is taken or it is free)
- Calendar that shows availability
- List of teachers

### Teachers

- Choose office-hour times (two timing columns)
- Set a max number of students per slot (there is a default)
- Authorization (log in)
- Email reminders
- Days off (slots cannot be booked on those days)

### Students

- Pick a teacher
- Pick a time
- Write a short summary of why they are coming
- Authorization (log in)
- Email reminders

### Booking rules (backend is the source of truth)

- Do not book before the current date
- Do not book on a teacher’s day off
- Do not exceed the max number of students for that slot

The frontend may pre-validate these rules in the UI. The API still enforces them.

### Stretch (not required for MVP)

- Alma integration

## MVP features

From the project brief:

- UI split by role: Student, Teacher, Admin
- Notification system (email reminders)
- User database
- Frontend design
- Authentication (log in / log out)
- Calendar view
- Function buttons
- Booking
- Office-hour requests

## Tech stack

Agreed in the project document:

| Area | Choice |
| --- | --- |
| Frontend | React + TypeScript (Vite) |
| Styling | Tailwind CSS |
| Routing | React Router |
| Backend | Python + FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Auth | FastAPI + JWT |
| Version control | Git + GitHub |
| Project tracking | GitHub Projects |
| Deploy | Vercel (frontend) + FastAPI hosting (backend) |

AI tools (Cursor, GitHub Copilot, Claude Code, Codex) are optional. No paid tool is required.

## Team

| Group | Lead | People | Focus |
| --- | --- | --- | --- |
| Frontend | Sammy | Wan Ho, Humay | Student / related UI |
| Frontend | Lucas | Austin, Ryan | Teacher desktop UI |
| Backend | Davis | Eshi, Maya, Kenzo | API, auth, infrastructure |
| Backend | Kai | Eric, Cyber | API, data, booking rules |

Do not edit another subgroup’s folders without coordinating. Shared files (`api/client.ts`, `types/`, `routes/`, `docs/api-contract.md`) need a note on the PR and a teammate review.

## Repo layout

```
office-hours-project/
  README.md
  docs/
    git-workflow.md                beginner Git / PR rules
    api-contract.md                frontend <-> backend agreement (backend/README.md wins on paths)
    backend-connection-report.md   what is connected and what is still open
  .github/
    pull_request_template.md
    workflows/ci.yml               tests on every pull request
  frontend-teacher/                the web app for students and teachers (React + Vite)
    src/pages/student|teacher|auth/
    src/api/                       the only place that talks to the backend (+ mocks)
    src/auth/                      sign-in, token, route guards
    src/types/                     shared types (match the API)
  backend/                         FastAPI + SQLAlchemy API, Alembic migrations, Dockerfile
```

## The app

One React app serves both roles. Routes live in `frontend-teacher/src/routes/AppRoutes.tsx`.

| Path | Who | Page |
| --- | --- | --- |
| `/login`, `/student/login`, `/teacher/login` | everyone | Pick a side, then sign in with user ID and password |
| `/student` | student | Home, My calendar, Find a teacher, Book a spot, My bookings, Settings |
| `/teacher` | teacher | Dashboard, Calendar, Office hours, Days off, Booking requests, Settings |

`VITE_USE_MOCKS` defaults to `true`, so the app runs without a backend (data lives in the browser).
Demo accounts in both modes: students `maya`, `daniel`, teachers `rivera`, `okafor`, password `demo-password`.

## Run it locally

You need Node.js (current LTS) and Python 3.9 or newer.

**Frontend only (mock data):**

```bash
cd frontend-teacher
npm install
npm run dev            # http://localhost:5173
```

**Frontend + backend:**

```bash
# terminal 1
cd backend
python3 -m venv venv && venv/bin/pip install -r requirements.txt   # once
cp .env.example .env                                               # once
venv/bin/uvicorn app.main:app --reload --port 8000 --env-file .env

# terminal 2
cd frontend-teacher
cp .env.example .env.local     # once; then set VITE_USE_MOCKS=false
npm run dev
```

The backend creates a SQLite database with demo data on first run. API docs: <http://localhost:8000/docs>.
PostgreSQL, settings and deployment: [`backend/README.md`](backend/README.md).

Useful scripts (from `frontend-teacher/`): `npm run build`, `npx vitest run`, `npm run lint`, `npm run e2e`
(run `npx playwright install` once first). Backend tests: `cd backend && venv/bin/python -m pytest tests -q`.

Never commit `.env` files or secrets. Only `.env.example` with placeholder values belongs in Git.

## Deploy

| Part | Where | Settings |
| --- | --- | --- |
| Frontend | Vercel, project root `frontend-teacher` (`vercel.json` makes page refreshes work) | `VITE_API_URL=<backend URL>`, `VITE_USE_MOCKS=false` |
| Backend | Any Docker host with Postgres (Render, Railway, Fly.io): `backend/Dockerfile` | `DATABASE_URL`, `JWT_SECRET`, `SCHOOL_TZ`, `CORS_ORIGINS=<frontend URL>`, `AUTO_SEED=false` |

Before real people use it: create real accounts (the demo password is public) and set `JWT_SECRET`.

## API contract

[`backend/README.md`](backend/README.md) lists every endpoint and is the source of truth.
[`docs/api-contract.md`](docs/api-contract.md) describes the same API from the frontend's side, and
`frontend-teacher/src/api/realPaths.test.ts` fails if the frontend's paths drift from it.
The backend enforces every booking rule; the frontend only shows them early.

## Git workflow

**Never commit to `main`.** Work on a branch, keep PRs small, get a teammate review, then merge on GitHub.

```bash
git checkout main
git pull
git checkout -b feature/teacher-<short-name>
# ... commit your work ...
git pull origin main
git push -u origin HEAD
```

Full beginner steps: [`docs/git-workflow.md`](docs/git-workflow.md). Use the PR template in `.github/pull_request_template.md`.

## Status

| Area | Status |
| --- | --- |
| Student and teacher pages | Done |
| Sign-in (JWT), route guards, each user sees their own data | Done |
| FastAPI API, booking rules, migrations | Done |
| Frontend connected to the backend (`VITE_USE_MOCKS=false`) | Done |
| CI (backend tests, frontend lint/build/tests/e2e) | Done |
| Deploy (Vercel + Docker host + Postgres) | Ready to set up |
| Refresh token, logout on the server, login rate limit | Open (see `docs/api-contract.md`) |
| Email reminders | Planned |
| Admin pages | Planned |
| Alma integration | Stretch only — do not build yet |
