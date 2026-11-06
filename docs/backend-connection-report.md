# Frontend <-> backend: connection status

Checked against `origin/main` at `9ecb8fc` (backend PR #13, `backend/app/`). Paths are in `backend/README.md`, which is the
source of truth; [`api-contract.md`](api-contract.md) follows it.

## What is connected

With `VITE_USE_MOCKS=false` and `VITE_API_URL` pointing at the backend, the frontend now calls exactly the backend's paths
(`src/api/teacher.ts`, `src/api/student.ts`). `src/api/realPaths.test.ts` checks every path, method and body with a stubbed
`fetch`, so it runs without a backend and fails if the two drift apart.

Run live in a browser against a copy of the backend (SQLite), as the demo student and teacher:

- Student: Home, My calendar (Week, Month, Quarter), Find a teacher, Book a spot, cancel from My bookings, requests, settings.
- Teacher: Dashboard, Calendar, Office hours, Days off, Booking requests, Settings.
- No response with status 400 or higher once the connection problem below is fixed.
- A full future office hour answers `409 {"code":"full","message":"That office hour is full. Pick another one."}`, which is
  what the Book page handles ("That office hour just filled up.").

## Needs the backend team

- [ ] **Concurrent requests break the SQLite setup.** `backend/app/database.py` uses `StaticPool` for every SQLite URL, which
  shares one connection between all request threads. The frontend sends about six requests at once when a page opens, and
  the backend then answers some with `500` (`sqlite3.InterfaceError: bad parameter or other API misuse`) and some with a
  wrong `404 not_found` (`db.get(Teacher, ...)` returns nothing). One request at a time (curl, the tests) always works,
  which is why it was missed. Suggested fix: use `StaticPool` only when the URL is `:memory:`, and the default pool with
  `check_same_thread=False` for a SQLite file. Confirmed by changing exactly that line in a scratch copy: every error went away.
  Not changed in `backend/`.
- [ ] **JWT.** Every request is answered as `rivera` / `maya` (`ME_TEACHER_ID`, `ME_STUDENT_ID`). The frontend's sign-in is a
  placeholder until the auth team lands real login (`POST /auth/login`, `GET /auth/me`, `Authorization: Bearer`).
- [ ] **Backend tests use today's date.** `test_book_happy_path`, `test_book_full`, `test_book_already_booked` and
  `test_cancel_booking_flow` failed with `already_booked` on some days, because the demo data is built from the current
  date and the tests pick a slot that is already booked. A test bug, not an API bug.
- [ ] **Capacity check in a transaction.** `POST /bookings` counts and then inserts. Two students booking the last spot at the
  same moment can both pass. Lock the rows or insert then count (see `bookSpot` in the contract), and add
  `UNIQUE (student_id, date, timing_id) WHERE status = 'confirmed'` for `already_booked`.
- [ ] **Secrets.** `docker-compose.yml` and `alembic.ini` hold the development database user and password. Move them to
  environment variables / a gitignored `.env` before anything is deployed.

## Nice to have (the frontend works without them)

- [ ] `createdAt` on every booking. Until then students are listed by booking `id`.
- [ ] A date-range query on `GET /bookings?view=student` and `GET /requests?view=student` (for example `from` and `to`). Until
  then My calendar fetches both whole lists and cuts them to the visible range in the browser.

## Differences that are fine

- The backend's `seat_floor` message reads "That office hour already has N students booked, so capacity cannot go below N."
  The frontend shows its own wording while the teacher types and the backend's if the save is refused.
- `Booking` has no seat number on either side. An office hour takes up to `max` students; students see "N of max spots taken".
