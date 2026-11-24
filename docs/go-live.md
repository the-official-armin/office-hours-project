# Going live: what to change on the deployed site

A running list, updated with every step built on the branch `feature/backend-production`. Everything is built and tested
locally first (Postgres in Docker, Postmark). This file lists what has to happen on the live site when the branch is merged.

**Live today**
- Frontend: https://office-hours-project-hhbz.vercel.app (Vercel, real mode)
- Backend: https://office-hours-project.vercel.app (Vercel, FastAPI)

Never put secrets in this file. Values go in Vercel → Project → Settings → Environment Variables.

---

## Check now (before anything else)

- [ ] **`JWT_SECRET` is set** on the backend project to a long random value
      (`python3 -c "import secrets; print(secrets.token_urlsafe(48))"`). Without it the default from the public code is used,
      and anyone could sign in as anyone.
- [ ] **`DATABASE_URL` points to a hosted Postgres** (Vercel Storage, Neon or Supabase). Vercel can't keep a SQLite file,
      so without it data is lost.
- [ ] `SCHOOL_TZ=America/Los_Angeles` and `CORS_ORIGINS=https://office-hours-project-hhbz.vercel.app` on the backend.
- [ ] The demo accounts (`maya` / `demo-password` …) are live and the password is public. Fine while it's a test site;
      they go away in step 4 below.

---

## Step 1: real database (local done)

Locally: Postgres 15 in Docker (`backend/docker-compose.yml`), migrations 0001–0003, settings in `backend/.env`.

On the live site:
- [ ] Hosted Postgres exists and `DATABASE_URL` is set (see above).
- [ ] **Migrations are run against it.** Vercel does not run the Dockerfile, so `alembic upgrade head` never runs by itself.
      For now, from a developer's computer: `cd backend && DATABASE_URL=<live url> venv/bin/alembic upgrade head`.
      Decide later whether this becomes a build step.
- [ ] Back-ups turned on for the hosted database.

## Step 2–3: email through Postmark (local done)

Code: `backend/app/mailer.py` (Postmark API, no new dependency). Without a token, emails are written to the log.
Local check 2026-11-19: test email to a `@waprep.org` address accepted by Postmark.
`backend/.env` is now read automatically by the backend.

On the live site:
- [ ] Backend env vars: `POSTMARK_TOKEN` (Server API token), `EMAIL_FROM`, `APP_URL=https://office-hours-project-hhbz.vercel.app`.
- [ ] Test from a developer's computer with the live token: `venv/bin/python -m app.mailer you@waprep.org`.
- [ ] **Postmark account approval.** Until Postmark approves the account it only sends to addresses at the sender's domain
      (`@waprep.org`). Request approval before real launch.
- [ ] **Sending address and DNS (school IT).** Testing uses a personal `@waprep.org` address as the sender. Before launch:
      a shared address such as `noreply@waprep.org`, and Postmark's DKIM + Return-Path DNS records on `waprep.org`,
      so emails don't land in spam. Then change `EMAIL_FROM`.
- [ ] On Vercel, emails are sent during the request, not after it (work after the response can be cut off).

## Step 4: invite and activate (local done)

Built: migration `0004` (account status, unique sign-in email, `account_links`), `app/accounts.py`, `python -m app.invite`,
`/auth/link`, `/auth/set-password`, `/auth/forgot-password`, sign-in by email, and the `/activate`, `/reset-password`,
`/forgot-password` pages. Checked locally against Postgres: invite → link → password → signed in; the link works once.

On the live site:
- [ ] **Tell the backend team** before merging: `0004` changes their `teachers` and `students` tables, and sign-in moves from
      user ID to email (the old `{role, userId, password}` login stops working).
- [ ] Run `alembic upgrade head` against the live database. It lowercases emails, gives accounts without one
      `<id>@example.com`, and **stops if two accounts share an email**: check first.
- [ ] Backend env var `APP_URL=https://office-hours-project-hhbz.vercel.app`, or the links in invite emails point to localhost.
- [ ] Remove the demo accounts: `AUTO_SEED=false`, then empty the demo data (a fresh database, or delete the demo rows).
      Their password is public.
- [ ] Invite real people from a developer's computer with the live `DATABASE_URL` and `POSTMARK_TOKEN`:
      `venv/bin/python -m app.invite people.csv`. Teachers first, so they can set office hours before students arrive.
- [ ] **Not done yet, needed before launch:** rate limits on sign-in, set-password and forgot-password (step 7).
      On Vercel this has to be stored in the database, not in memory.

## Step 5: notification emails (local done)

Built: every in-app notification is also emailed, following each person's Settings switches (`app/outbox.py`). The emails
are queued during the request and sent in one Postmark batch only after the change is saved, so a refused booking sends
nothing. Students also get a booking confirmation. Emails to `@example.com` (demo accounts) are never sent. Every email
is listed in the backend log (sent, skipped, or refused with Postmark's reason). "Change password" in Settings now emails
a reset link.

| Who | When | Subject |
| --- | --- | --- |
| Teacher | a student books / cancels | New booking: … / Cancelled: … |
| Teacher | a request is sent / withdrawn | New request from … / Request cancelled: … |
| Student | they book | Booked: Ms. Rivera, Thu, Nov 26 |
| Student | a request is answered | Ms. Rivera accepted (declined) your request |
| Student | the teacher is out, back, or changes office hours | … is out on … / … is back on … / … changed their office hours |

On the live site: nothing new beyond step 2's env vars (`POSTMARK_TOKEN`, `EMAIL_FROM`, `APP_URL`).
- [ ] After launch, watch Postmark → Activity for bounces in the first week.

## Step 6: reminder emails (local done)

Built: `app/reminders.py` sends what is due: students before each booked office hour (their 30 minutes / 1 hour / 1 day),
teachers before each office hour with bookings (who is coming and why), and the teacher's morning summary from 7:00.
Never twice (dedupe keys), never for a cancelled booking or a day off, and only one run at a time (Postgres lock).
Locally the backend runs it every 5 minutes (`REMINDER_INTERVAL_MINUTES=5`). Deployed, a timer calls
`GET /jobs/reminders` with `Authorization: Bearer <CRON_SECRET>`.

On the live site:
- [ ] Backend env vars: `CRON_SECRET` (long random value: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`),
      and `REMINDER_INTERVAL_MINUTES=0` (or leave it unset): serverless functions don't keep a loop running.
- [ ] **A timer every 5 minutes** calling `https://office-hours-project.vercel.app/jobs/reminders` with the header
      `Authorization: Bearer <CRON_SECRET>`. Pick one:
  - **Vercel Cron** (`"crons": [{ "path": "/jobs/reminders", "schedule": "*/5 * * * *" }]` in the backend project's
    `vercel.json`; Vercel sends the `CRON_SECRET` header by itself). Check the plan first: on the free Hobby plan cron
    jobs may only run once a day, which is too slow for "1 hour before".
  - **cron-job.org** (free): a job every 5 minutes, method GET, with the Authorization header. Works on any plan.
- [ ] Check it runs: the job answers `{"sent": {...}}`; Postmark → Activity shows reminders tagged `reminder` / `morning`.
- [ ] `SCHOOL_TZ=America/Los_Angeles` must be set (step 1), or reminders are computed in UTC and arrive hours off.

## Step 7: security (local done)

Built: rate limits kept in the database (`app/ratelimit.py`): 10 failed sign-ins per email / 30 per computer in 15 minutes,
3 forgot-password emails per address per hour, 20 unusable links per computer in 15 minutes, all answering `429`.
Log out ends every session of the person at once (`POST /auth/logout`), and so do a new password and deactivation.
While the app is in use the token is refreshed before it runs out (`POST /auth/refresh`), for up to 7 days after signing in.
Migration `0005` adds `session_version` and `auth_attempts`.

On the live site:
- [ ] Run `alembic upgrade head` (0005) against the live database. Nobody is signed out by it.
- [ ] Backend env var `CLIENT_IP_HEADER=x-real-ip`. Without it every visitor looks like the same address to the rate limits,
      and 30 wrong passwords from anyone would lock sign-in for everybody for 15 minutes.
- [ ] Optional: `SESSION_MAX_DAYS` (7 by default).
- [ ] **Blocker, from the top of this file:** `JWT_SECRET` must be a long random value. Anyone who knows the secret can make
      a token for any account, and the default one is in the public code.
- [ ] Old `auth_attempts` rows are deleted by the reminder job, so the step 6 timer must be running.
- Known limit: the sign-in token is kept in the browser's storage (as before), where a script injected into the page could
  read it. An `httpOnly` cookie would be the next step if the school asks for it.

---

## Step 8: frontend polish (local done)

School crest at `frontend-teacher/public/school-logo.png` (cut from the waprep.org header; ask the school for the original
file for a sharper copy). `/admin` (an empty placeholder owned by another team) is hidden. Phone layout checked.

## Steps 9–11: rehearsal on a local copy of production (passed, 2026-11-20)

A production-like stack on one computer: a **fresh Postgres database built only by the migrations** (0001–0005, no demo
data), the backend with production settings (`AUTO_SEED=false`, `CORS_ORIGINS` = the frontend only, reminders only through
the protected timer endpoint), and a **production build** of the frontend served like Vercel serves it.

The whole journey, through the real pages in a browser (the student on a phone-sized screen), passed all 33 checks:
empty database and no demo accounts; CORS allows the frontend and refuses other sites; the timer endpoint needs its secret;
a developer invites a teacher and a student from a CSV; an invited account can't sign in; activation pages greet each
person and hide the token; the teacher sets an office hour; the student books it; "New booking" and "Booked" emails; the
booking shows in the teacher's calendar; the timer sends both reminders, and nothing twice; request, answer and cancel
emails; forgot password → reset link → new password, old password and other sessions stop working; sign-in by email on the
page; log out ends the session on the server; no errors in the browser. Then: everything survived a backend restart, and
`--deactivate` locked the student out at once.

---

## Deploying to Vercel

Two Vercel projects already exist: the **frontend** (https://office-hours-project-hhbz.vercel.app) and the **backend**
(https://office-hours-project.vercel.app). Values never go in this file or in git: Vercel → project → Settings →
Environment Variables (Production).

### A. Before merging (nothing changes for visitors yet)

1. **Database.** Create a new, empty hosted Postgres for production: Vercel → backend project → Storage → Postgres
   (Neon), or neon.tech / Supabase directly. Copy its connection URL (`postgres://…?sslmode=require` is fine). A fresh
   database is simplest: the live one only holds demo data, which must not carry over (its password is public).
2. **Build it with the migrations**, from a developer's computer:
   `cd backend && DATABASE_URL='<new url>' venv/bin/alembic upgrade head` (5 migrations, ends at `0005_sessions_and_rate_limits`).
3. **Backend environment variables** (Production):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | the new database's URL |
   | `JWT_SECRET` | new long random value (`python3 -c "import secrets; print(secrets.token_urlsafe(48))"`) |
   | `AUTO_SEED` | `false` |
   | `SCHOOL_TZ` | `America/Los_Angeles` |
   | `CORS_ORIGINS` | `https://office-hours-project-hhbz.vercel.app` |
   | `APP_URL` | `https://office-hours-project-hhbz.vercel.app` |
   | `POSTMARK_TOKEN` | the Postmark Server API token |
   | `EMAIL_FROM` | the confirmed Postmark sender |
   | `CRON_SECRET` | new long random value (`python3 -c "import secrets; print(secrets.token_urlsafe(32))"`) |
   | `CLIENT_IP_HEADER` | `x-real-ip` |
   | `REMINDER_INTERVAL_MINUTES` | `0` (or leave unset) |
   | `APP_ENV` | leave unset (`production`). The backend then **refuses to start** if `AUTO_SEED` is on or `JWT_SECRET` is weak, so a forgotten setting shows as a failed deploy, not a public demo password |

4. **Frontend environment variables**: `VITE_USE_MOCKS=false`, `VITE_API_URL=https://office-hours-project.vercel.app`
   (probably already set: the live site is in real mode).
5. **Tell the backend team** what changes for them (0004 and 0005, sign-in by email). See step 4 above.

### B. Merge and deploy

6. Merge `feature/backend-production` into `main` (after review). Vercel builds both projects. Because the backend's
   variables now point at the new database, the new code and the new database go live together.
7. **Smoke test**, in this order:
   - `https://office-hours-project.vercel.app/healthz` answers `{"status":"ok"}`; `/teachers` answers `[]`.
   - Signing in as `maya@example.com` / `demo-password` fails (no demo data).
   - `curl -H "Authorization: Bearer <CRON_SECRET>" https://office-hours-project.vercel.app/jobs/reminders`
     answers `{"sent":{}}`, and without the header `401`.
   - From a developer's computer, with the production `DATABASE_URL`, `POSTMARK_TOKEN`, `EMAIL_FROM` and `APP_URL` in the
     shell: `venv/bin/python -m app.invite people.csv` with **one** row (yourself). The email arrives, the link opens the live
     site, you choose a password and land on your home page.

### C. The timer for reminders

8. **cron-job.org** (free, any Vercel plan): new job, URL `https://office-hours-project.vercel.app/jobs/reminders`,
   every 5 minutes, method GET, header `Authorization: Bearer <CRON_SECRET>`. Its history should show `200` responses.
   (Vercel Cron also works, `"crons": [{ "path": "/jobs/reminders", "schedule": "*/5 * * * *" }]`, but on the free Hobby
   plan it may only run once a day.)

### D. Launch

9. **Postmark**: request account approval (until then it only sends to `@waprep.org`), and ask school IT for a sending
   address such as `noreply@waprep.org` with DKIM and Return-Path DNS records; then update `EMAIL_FROM`.
10. **Teachers first**: invite them (`people.csv`), and ask each to set their office hours.
11. **Then the students.** Watch Postmark → Activity and the backend's logs (Vercel → backend → Logs) for refused emails
    and errors in the first week.

### If something goes wrong

Point the backend's `DATABASE_URL` back to the old database and redeploy the previous deployment (Vercel → Deployments →
… → Promote). The old code works with the old database exactly as before.
