# Office Hours Backend

FastAPI + SQLAlchemy backend for the Office Hours app. It serves the frontend
(`frontend-teacher`, with `VITE_USE_MOCKS=false`), enforces every booking rule from
`frontend-teacher/src/lib/rules.ts`, and stores data in PostgreSQL (deployed) or
SQLite (local development).

The API is organized as **resources shared by both roles**: bookings, requests and
notifications each live under one path, with a `view` parameter deciding whose data
you see. Teacher-only things (schedule, days off) sit under `/teacher`.

Every endpoint except `GET /healthz`, `GET /teachers` and `POST /auth/login` needs
`Authorization: Bearer <accessToken>` (from `POST /auth/login`) and answers for the person
in that token: no token or a bad one is `401 unauthorized`, the wrong role is
`403 forbidden`.

## Quick start

```bash
cd backend
python3 -m venv venv            # once
venv/bin/pip install -r requirements.txt

cp .env.example .env            # once; the defaults work locally
venv/bin/uvicorn app.main:app --reload --port 8000 --env-file .env
```

The database (`office_hours.db`, SQLite) and the demo dataset are created automatically
on first run. To re-seed at any time:

```bash
venv/bin/python -m app.seed
```

## Connect the frontend

```bash
# frontend-teacher/.env.local
VITE_API_URL=http://localhost:8000
VITE_USE_MOCKS=false
```

Sign in with any demo account, password `demo-password`: students `maya`, `daniel`,
`alex`, teachers `rivera`, `okafor` (all ids are in `app/seed.py`).

## Settings

All settings are environment variables; `.env.example` lists them with comments.

| Variable | Default | Deployed |
| --- | --- | --- |
| `DATABASE_URL` | SQLite file `office_hours.db` | The host's Postgres URL (`postgres://` is accepted) |
| `JWT_SECRET` | a development value (warns at startup on Postgres) | A long random value |
| `JWT_EXPIRE_MINUTES` | `60` | `60` |
| `SCHOOL_TZ` | the server clock | The school's zone, e.g. `America/Los_Angeles` (hosts run in UTC) |
| `CORS_ORIGINS` | any `localhost` port | The frontend's URL, e.g. `https://office-hours.vercel.app` |
| `AUTO_SEED` | `true` | `false` |

## API reference

Conventions: dates are `YYYY-MM-DD`, times are `HH:MM` (24h), both in school local
time. All endpoints answer for the signed-in user — no ids in the path except
where noted. Every rule violation answers with HTTP 409 (404 when something no longer
exists, 401 when not signed in, 403 for the wrong role) and a JSON body `{ "code": "<RuleCode>", "message": "<text>" }`, which is what
the frontend's `RuleError` expects.

Rule codes: `past`, `day_off`, `no_office_hour`, `full`, `already_booked`, `conflict`,
`reason`, `duplicate_day_off`, `seat_floor`, `not_found`, `missing`, `invalid`,
`unauthorized`, `forbidden`, `invalid_credentials`.

The `view` parameter must match the signed-in role: `view=teacher` for teachers,
`view=student` and `view=open` for students (`403 forbidden` otherwise).

### Authentication

Users are stored in the `teachers` and `students` tables. Passwords are stored as
scrypt hashes, never as plaintext. The demo seed creates every demo account with the
password `demo-password`; change these credentials before using a deployed database.

| Method & path | What it does |
| --- | --- |
| `POST /auth/login` | Accepts `{ "role": "teacher" \| "student", "userId": "<id>", "password": "<password>" }` and returns `{ accessToken, tokenType, expiresIn, user }`. |
| `GET /auth/me` | Validates a bearer token and returns the authenticated `{ id, role, name }`. |

Set `JWT_SECRET` to a long random value in deployment. Tokens expire after
`JWT_EXPIRE_MINUTES` (60 by default). Run `alembic upgrade head` before starting
against an existing database so the credential columns are present.

### Teachers & schedule

| Method & path | What it does |
| --- | --- |
| `GET /teachers` | List every teacher with their office-hour timings and days off. Used by the student's "Find a teacher" page and to count open spots. |
| `GET /teacher/profile` | The signed-in teacher's full profile (`Teacher`: id, name, subject, group, max, timings, daysOff). The teacher pages render from this. |
| `GET /teacher/settings` | The teacher's editable record: name, subject, email + the five notification toggles and reminder lead time. |
| `PUT /teacher/settings` | Save that record. Validates non-empty name and email format (`invalid`). |
| `PUT /teacher/schedule` | Save office hours: `{ timings: [{id, name, start, end, days}], max }`. Validates timing count ≤ 4, non-empty unique names, end > start, at least one day per timing, no overlaps (`invalid`), 1–30 students per office hour (`invalid`) and the booked floor (`seat_floor`). Bookings are never deleted; changed/removed timings produce student notifications. Returns `{ orphaned }` = how many upcoming bookings no longer match. |
| `POST /teacher/days-off` | Add a day off: `{ date, reason? }`. Rejects past dates (`past`) and duplicates (`duplicate_day_off`). Existing bookings are kept; affected students are notified. Returns `{ dayOff, affected }`. |
| `DELETE /teacher/days-off/{date}` | Remove a day off (204). Affected students are told their booking is on again. 404 when it doesn't exist. |

### Bookings — students book, both roles read

| Method & path | What it does |
| --- | --- |
| `GET /bookings?view=open&from=YYYY-MM-DD&to=YYYY-MM-DD` | **Anonymous occupancy**: every confirmed booking, but other students' names and reasons are blanked — a student only sees how many spots are taken. Date filters are optional and inclusive. |
| `GET /bookings?view=student&from=YYYY-MM-DD&to=YYYY-MM-DD` | The signed-in student's own bookings, every status (upcoming + history + cancelled). Date filters are optional and inclusive. |
| `GET /bookings?view=teacher&from=YYYY-MM-DD&to=YYYY-MM-DD` | Everything booked with the signed-in teacher, every status. Date filters are optional and inclusive. |
| `POST /bookings` | The student books a spot: `{ teacherId, date, timingId, reason }`. No seat to pick — each office hour takes up to `max` students. Enforces all booking rules: the office hour must exist on that date (`no_office_hour`), not be a day off (`day_off`), not have started (`past`), must not be full (`full`), not a second booking in the same hour (`already_booked`), and must not clash with another of the student's bookings (`conflict`). The reason needs 10–300 characters (`reason`). The teacher is notified. Returns the created `Booking`. |
| `DELETE /bookings/{id}` | The student cancels a confirmed booking (204); the teacher is notified. Refused once the office hour has started (`past`). 404 if already cancelled. |

### Requests — "ask for a different time"

| Method & path | What it does |
| --- | --- |
| `GET /requests?view=teacher&from=YYYY-MM-DD&to=YYYY-MM-DD` | Requests sent to the signed-in teacher, sorted by date and time. Date filters are optional and inclusive. |
| `GET /requests?view=student&from=YYYY-MM-DD&to=YYYY-MM-DD` | The signed-in student's own requests and their answers. Date filters are optional and inclusive. |
| `POST /requests` | The student asks for a time outside office hours: `{ teacherId, date, time, reason }`. Rejects past times (`past`), days off (`day_off`) and short reasons (`reason`). The teacher is notified. Returns the pending `BookingRequest`. |
| `POST /requests/{id}/answer` | The teacher answers: `{ "answer": "accepted" \| "declined" }`. Accepting is refused when the time has passed or is a day off. The student is notified, and the answer lands in the request's `note`. |
| `DELETE /requests/{id}` | The student withdraws a pending request (204); the teacher is notified. 404 once answered. |

### Notifications

| Method & path | What it does |
| --- | --- |
| `GET /notifications?view=teacher` | The signed-in teacher's inbox, newest first (`Note`: id, text, at, read, key?). |
| `GET /notifications?view=student` | The signed-in student's inbox, newest first. |
| `POST /notifications/read-all?view=teacher\|student` | Mark that inbox as read (204). The bell icon calls this. |

### Misc

| Method & path | What it does |
| --- | --- |
| `GET /healthz` | `{ "status": "ok" }` — uptime checks. |

## Data shapes

The JSON mirrors `frontend-teacher/src/types/index.ts`:

- `Teacher`: `{ id, name, subject, group, max, timings: Timing[], daysOff: [{date, reason}] }` — `max` is the capacity: how many students each office hour takes (stored as `capacity` in the DB, exposed as `max` to match the frontend type).
- `Timing`: `{ id, name, start, end, days }` — `days` are JS weekday numbers (1 = Monday … 5 = Friday); removed timings stay with `gone: true` and `days: []` so old bookings resolve.
- `Booking`: `{ id, teacherId, date, timingId, studentId, studentName, reason, status, createdAt }` — `createdAt` is an ISO 8601 timestamp; no seat number; status is `confirmed` or `cancelled`.
- `BookingRequest`: `{ id, teacherId, studentId, studentName, date, time, reason, status, note }` — status is `pending`, `accepted` or `declined`; `note` is the teacher's answer shown to the student.
- `Note` (notification): `{ id, text, at, read, key? }` — `at` is epoch milliseconds.
- Days off reject dates in the past; bookings reject anything at or before "now".

## Tests

```bash
cd backend
venv/bin/python -m pytest tests -q     # rule engine + API integration + who may call what
```

## PostgreSQL (deployment)

```bash
# backend/.env: set POSTGRES_PASSWORD and DATABASE_URL (see .env.example)
docker compose up -d db               # Postgres 15 on localhost:5432
set -a; source .env; set +a
venv/bin/alembic upgrade head
venv/bin/python -m app.seed           # demo data, local only
```

`DATABASE_URL` is read from the environment everywhere (uvicorn, alembic, tests).
Times are school local time (`SCHOOL_TZ`, else the server's clock), matching the frontend.

A database volume made before the password moved to `.env` still has the old password
`secretpassword`: put that in `.env`, or start fresh with `docker compose down -v`.

## Deploy

- **Docker image:** `Dockerfile` installs the requirements, runs `alembic upgrade head`,
  then starts uvicorn on `$PORT`. Works on Render, Railway, Fly.io and similar.
- **Environment:** `DATABASE_URL` (managed Postgres), `JWT_SECRET`, `SCHOOL_TZ`,
  `CORS_ORIGINS` (the frontend's URL), `AUTO_SEED=false`.
- **Accounts:** the demo seed is for development. Create real accounts with real
  passwords (`app.security.hash_password`) before anyone uses the deployed site.

## Layout

| File | Purpose |
| --- | --- |
| `app/main.py` | FastAPI app, CORS, rule-error handler, auto-create/auto-seed on startup |
| `app/models.py` | SQLAlchemy tables mirroring the frontend types |
| `app/rules.py` | Domain rules + date formatting, a port of `src/lib/rules.ts` + `dates.ts` |
| `app/routers/teachers.py` | teacher directory, profile, settings, schedule, days off |
| `app/routers/students.py` | student settings |
| `app/routers/bookings.py` | bookings: occupancy view + both inboxes + book/cancel |
| `app/routers/requests.py` | requests: both inboxes + send/answer/withdraw |
| `app/routers/notifications.py` | both inboxes + read-all |
| `app/views.py` | ORM ↔ rule-view loading and JSON serialization (camelCase) |
| `app/seed.py` | Demo dataset, a port of `src/api/mocks/seed.ts` (built from today) |
| `app/deps.py` | DB session, signed-in user from the token (`current_user` / `current_teacher` / `current_student`, `check_view`), school clock, notification helper |
| `app/security.py` | Password hashing (scrypt) and JWT helpers |
| `app/routers/auth.py` | `POST /auth/login`, `GET /auth/me` |
| `app/errors.py` | `RuleError` → HTTP: `not_found` 404, `unauthorized` / `invalid_credentials` 401, `forbidden` 403, every other rule 409 `{code, message}` |
| `tests/` | Rule engine unit tests + API integration tests on a seeded in-memory DB |

`docs/api-contract.md` describes the same API from the frontend's side; where the two
disagree, this README wins.
