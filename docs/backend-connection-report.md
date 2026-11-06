# Frontend <-> backend: connection status

Checked on branch `feature/finish-integration` (from `main` at `8bacb05`). Paths are in `backend/README.md`, which is the source
of truth; [`api-contract.md`](api-contract.md) follows it.

## What is connected

With `VITE_USE_MOCKS=false` and `VITE_API_URL` pointing at the backend, the frontend calls exactly the backend's paths
(`src/api/teacher.ts`, `src/api/student.ts`, `src/auth/authApi.ts`). `src/api/realPaths.test.ts` checks every path, method and
body with a stubbed `fetch`, so it fails if the two drift apart.

Signing in returns a JWT that the frontend sends on every request, and **every endpoint answers for the person in the token**:
`401 unauthorized` without a valid token (the frontend sends the person back to sign in), `403 forbidden` for the other role's
endpoints or `view`.

Run live in a browser against the backend (SQLite) as `maya`, `daniel` (students) and `rivera`, `okafor` (teachers):

- Every student page (Home, My calendar, Find a teacher, Book a spot, My bookings, Settings) and every teacher page (Dashboard,
  Calendar, Office hours, Days off, Booking requests, Settings) shows the signed-in person's own data, with no failed request.
- Daniel books a spot through the UI; Ms. Rivera gets the notification and sees the booking under his name; Maya sees the spot
  as taken without his name or reason; Daniel cancels it from My bookings.
- A broken token sends the person to `/student/login?reason=expired`; a student is kept out of `/teacher` (guard) and the API
  answers `403`.
- My calendar asks for only the visible range (`from` / `to`).

## Done

- [x] **Concurrent requests broke the SQLite setup.** Fixed in `0391a7f`: `StaticPool` only for in-memory databases.
- [x] **Endpoints check the token.** `app/deps.py`: `current_user` reads `Authorization: Bearer`, `current_teacher` /
  `current_student` check the role, `check_view` checks `?view=`. `ME_TEACHER_ID` / `ME_STUDENT_ID` are gone.
- [x] **Backend tests that failed on some days.** The seed fix in `0391a7f` keeps Maya off the slot the tests book; they pass.
- [x] **Capacity check under load.** `POST /bookings` locks the office hour row (`SELECT ... FOR UPDATE` on Postgres) before
  counting, and migration `0003` adds a unique index: one confirmed booking per student per office hour.
- [x] **Secrets.** `docker-compose.yml` reads `backend/.env` (`.env.example` lists every setting). `JWT_SECRET`, `SCHOOL_TZ`,
  `CORS_ORIGINS` and `AUTO_SEED` are environment variables. CORS allows any `localhost` port when `CORS_ORIGINS` is empty.
- [x] `createdAt` on every booking, and `from` / `to` on the student lists.

## Still open

- [ ] Refresh token, `POST /auth/logout`, login rate limit: see "Authentication gaps" in `api-contract.md`.
- [ ] The row lock has only been run on SQLite here (Docker was not available). Run the app once on the docker-compose Postgres
  before deploying.
- [ ] Real accounts and passwords for the deployed site (the seed's `demo-password` is public).
- [ ] Email reminders (server side).

## Differences that are fine

- The backend's `seat_floor` message reads "That office hour already has N students booked, so capacity cannot go below N."
  The frontend shows its own wording while the teacher types and the backend's if the save is refused.
- `Booking` has no seat number on either side. An office hour takes up to `max` students; students see "N of max spots taken".
