# Office Hours Project

Students book office-hour meetings with teachers the way you pick seats in a theater: pick a teacher, see availability on a calendar, take an open slot, and leave a short reason. Teachers set when they are available. Everyone gets an email reminder.

This repo is a school-club MVP. Roles are **Student**, **Teacher**, and **Admin**. The first working UI in this repo is the Teacher desktop app. The backend currently contains the database models, Alembic migration, and local PostgreSQL setup; the FastAPI API entrypoint is still to be added.

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
    git-workflow.md      beginner Git / PR rules
    api-contract.md      frontend ↔ backend agreement
  .github/
    pull_request_template.md
  frontend-teacher/      Teacher UI (React + Vite)
    src/pages/teacher/   Teacher pages
    src/pages/student/   stub (other team)
    src/pages/admin/     stub (other team)
    src/pages/auth/      stub (other team)
    src/api/             API client + teacher mocks
    src/types/           shared types (must match the API contract)
  backend/               Python models, Alembic migration, and PostgreSQL setup
  Student Page UI Desgin/  student UI brainstorm notes
```

The backend database layer is in this repo. The API routes and FastAPI application entrypoint are not finished yet.

## Teacher UI (current app)

Routes live in `frontend-teacher/src/routes/AppRoutes.tsx`. Desktop only (min width 1024px).

| Path | Page | Purpose |
| --- | --- | --- |
| `/login` | Login | Auth placeholder |
| `/teacher` | TeacherDashboard | Upcoming office hours and booked students |
| `/teacher/office-hours` | OfficeHourSettings | Two timing options + max students per slot |
| `/teacher/calendar` | TeacherCalendar | Availability and bookings |
| `/teacher/days-off` | DaysOff | Mark and remove days off |
| `/teacher/requests` | BookingRequests | Student bookings and reason summaries |
| `/teacher/settings` | TeacherSettings | Profile and email reminder preferences |
| `/student` | StudentDashboard | Placeholder for the student team |
| `/admin` | AdminDashboard | Placeholder for the admin team |

`VITE_USE_MOCKS` defaults to `true`, so the Teacher UI can run without a live backend.

## Run the frontend locally

You need Node.js (current LTS is fine).

```bash
cd frontend-teacher
cp .env.example .env.local
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The app redirects `/` to `/teacher`.

Useful scripts (from `frontend-teacher/`):

```bash
npm run dev      # local server
npm run build    # type-check + production build
npm run lint     # oxlint
```

Environment (see `.env.example`):

```
VITE_API_URL=http://localhost:8000
VITE_USE_MOCKS=true
```

Never commit `.env` files or secrets. Only `.env.example` with placeholder values belongs in Git.

## Backend (from zero)

### Current backend status

The `backend/` directory currently provides:

- SQLAlchemy models in `backend/models.py`
- PostgreSQL 15 configuration in `backend/docker-compose.yml`
- An initial Alembic migration in `backend/alembic/versions/`

There is not yet a `backend/main.py` (or another FastAPI application module), so the API server cannot be started successfully yet. Do not run `uvicorn main:app` until the FastAPI entrypoint is added. The steps below prepare the local database and Python environment for the backend team.

### Prerequisites

Install these tools before starting:

- Python 3.9 or newer
- Docker Desktop (including Docker Compose)
- Git

Check the installations:

```bash
python3 --version
docker --version
docker compose version
```

### 1. Create and activate the Python environment

From the repository root:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

On Windows PowerShell, activate the environment with:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Install the packages needed by the current models and migration files:

```bash
python -m pip install --upgrade pip
python -m pip install fastapi uvicorn sqlalchemy psycopg2-binary alembic
```

### 2. Start PostgreSQL

Keep the terminal in `backend/` and start only the database service:

```bash
docker compose up -d db
```

Confirm that PostgreSQL is running:

```bash
docker compose ps
```

The local database uses these values from `backend/docker-compose.yml`:

```text
Host:     localhost
Port:     5432
Database: office_hours_db
User:     postgres
Password: secretpassword
```

To stop PostgreSQL later:

```bash
docker compose down
```

To stop it and delete the local database volume, which deletes local data:

```bash
docker compose down -v
```

### 3. Run the database migration

Before running Alembic for the first time, make sure `backend/alembic.ini` has this local development URL:

```ini
sqlalchemy.url = postgresql+psycopg2://postgres:secretpassword@localhost:5432/office_hours_db
```

Then, from `backend/` with the virtual environment active:

```bash
alembic upgrade head
```

This creates the current tables (`users`, `clubs`, `teacher_profiles`, appointments, and schedule tables). Run the migration again after pulling a new migration from the backend team.

### 4. Start the backend API

The API start command will be:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Run it from `backend/`, where `main.py` must export a FastAPI object named `app`. At the moment that file and the API routes have not been added, so this command is documented for the completed backend and will currently return an import error.

Once the entrypoint exists, open:

- API: <http://localhost:8000>
- Swagger UI: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>

For frontend development, set `VITE_API_URL=http://localhost:8000` in `frontend-teacher/.env.local` and set `VITE_USE_MOCKS=false` only after the backend endpoints are available. Until then, keep `VITE_USE_MOCKS=true`.

## API contract

`docs/api-contract.md` is the agreement between frontend and backend. The backend owns booking rules. Types in `frontend-teacher/src/types/` must match whatever is agreed.

Teacher endpoints currently proposed:

- `GET/PATCH /teachers/me`
- `GET/PUT /teachers/me/office-hours`
- `GET/POST /teachers/me/days-off` and `DELETE /teachers/me/days-off/{id}`
- `GET /teachers/me/bookings`

Auth (login / logout, JWT) and Alma are not part of that contract yet.

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
| Teacher page shells + layout | In repo (placeholders filling in) |
| Student / Admin / Login pages | Stubs |
| Mock teacher API | In repo (`VITE_USE_MOCKS=true`) |
| PostgreSQL models + initial migration | In repo (`backend/`) |
| FastAPI API routes + server entrypoint | Not implemented yet |
| JWT auth wiring | Not wired |
| Email reminders | Planned |
| Alma integration | Stretch only — do not build yet |
