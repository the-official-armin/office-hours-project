# API contract: frontend <-> backend

This is what the React app in `frontend-teacher/` calls when `VITE_USE_MOCKS=false`. It covers every function in
`src/api/teacher.ts` and `src/api/student.ts`. Types are in `src/types/index.ts` (copied below). Every row is
**proposed: the backend team confirms or changes it**, and the frontend then follows what is agreed.

> **Paths: `backend/README.md` is the source of truth** (backend PR #13). The frontend follows it: shared resources
> (bookings, requests, notifications) take a `view` parameter (`?view=teacher`, `?view=student`, `?view=open`), and
> teacher-only things sit under `/teacher`. Where this file and the README disagree, the README wins and this file is
> wrong. The headings below use the README's paths. `src/api/realPaths.test.ts` fails if the frontend drifts from them.

> **The server is the only place the rules count.** The frontend checks the booking rules (`src/lib/rules.ts`) only to
> give people a good experience: to hide a button, grey out a day, or show a message before a request is sent. A
> browser can be edited, skipped, or raced by another student. **The server must enforce every rule listed here
> itself, on every request, and answer a violation with the error shape below.** Never trust a date, a capacity, a role or an id
> sent by the client.

The backend is `backend/app/` (FastAPI + SQLAlchemy, SQLite by default, Postgres through `DATABASE_URL`). The old
database mismatch table at the end of this file was written against the earlier stub (`backend/models.py`) and is kept
only as history; see [Backend gaps](#backend-gaps-nice-to-have) for what the frontend still wants from the current one.

## 1. Conventions

| Topic | Rule |
| --- | --- |
| Base URL | `VITE_API_URL` (default `http://localhost:8000`) |
| Format | JSON in, JSON out. `Content-Type: application/json` |
| Auth | `Authorization: Bearer <JWT>` on every request except login. The role is taken from the token, never from the body |
| Ids | JSON **strings** (`"12"`). The database may use integers; serialize them as strings |
| Dates | `YYYY-MM-DD`, **school local time** (one configured time zone) |
| Times | `HH:MM`, 24 hours, school local time |
| Weekday | integer `1` = Monday ... `5` = Friday (`Dow`). Office hours run Monday to Friday only |
| Empty answer | `204 No Content` (the client already handles it) |
| `now` | the server's clock, converted to school time. Never the client's |

### Error shape

Every failed request answers `{ "code": "<RuleCode>", "message": "<text a person can read>" }`. The client shows
`message` as it is and keeps `code` for logic. A FastAPI default `{"detail": ...}` body is **not** understood: add an
exception handler that produces this shape (including for request-validation errors).

| `code` | HTTP | Meaning |
| --- | --- | --- |
| `not_found` | 404 | The thing does not exist, is not yours, or was already answered/cancelled |
| `missing` | 422 | A required date or time was empty |
| `invalid` | 422 | A value is not allowed (bad name, email, timings, seats per office hour out of range...) |
| `reason` | 422 | Reason shorter than 10 or longer than 300 characters (after trimming) |
| `past` | 409 | The date, time or office hour has already passed or started |
| `day_off` | 409 | The teacher is out that day |
| `no_office_hour` | 409 | The teacher has no office hour at that day and time |
| `full` | 409 | Every spot in that office hour is taken (`taken >= max`). Also the answer to a race: two students book the last spot and the second one loses |
| `already_booked` | 409 | The student already has a confirmed booking in that office hour |
| `conflict` | 409 | The student has another booking that overlaps in time, with any teacher |
| `duplicate_day_off` | 409 | That date is already a day off |
| `seat_floor` | 409 | Seats per office hour cannot drop below the number of students booked in the fullest upcoming office hour |

Also: `401` when there is no valid token, `403` when the role is wrong (a student calling `/teacher/...`). These two may
use the same body with `code: "invalid"` until the frontend adds codes for them.

## 2. Limits and constants

| Constant | Value | Where it is used |
| --- | --- | --- |
| Timings per teacher | 1 to 4 (`MAX_TIMINGS`) | saving office hours |
| Seats per office hour | 1 to 30, default 4 (`MIN_SEATS`, `MAX_SEATS`, `DEFAULT_SEATS`) | saving office hours |
| Booking reason | 10 to 300 characters after trimming (`REASON_MIN`, `REASON_MAX`) | booking a spot |
| Request reason | at least 10 characters after trimming | sending a request |
| Reminder time | `"30 minutes"`, `"1 hour"`, `"1 day"` = 30, 60, 1440 minutes before (`LEAD_MINUTES`) | reminders |

## 3. Types (from `src/types/index.ts`)

```ts
type Role = 'student' | 'teacher'
type Dow = 1 | 2 | 3 | 4 | 5

interface Timing {
  id: string; name: string; start: string; end: string; days: Dow[]
  gone?: boolean            // removed by the teacher; kept with days: [] so old bookings still resolve
}
interface DayOff { date: string; reason: string }
interface Teacher {
  id: string; name: string; subject: string; group: string
  max: number               // seats per office hour, 1-30
  timings: Timing[]; daysOff: DayOff[]
}
interface Booking {
  id: string; teacherId: string; date: string; timingId: string
  studentId: string; studentName: string; reason: string; status: 'confirmed' | 'cancelled'
  createdAt?: string        // ISO 8601. Optional: the backend does not send it yet. Students are listed in booking order: createdAt, else id
}
interface BookingRequest {
  id: string; teacherId: string; studentId: string; studentName: string
  date: string; time: string; reason: string
  status: 'pending' | 'accepted' | 'declined'; note: string
}
type ReminderLead = '30 minutes' | '1 hour' | '1 day'
interface TeacherPrefs { email: string; remind: boolean; booking: boolean; cancel: boolean; request: boolean; morning: boolean; lead: ReminderLead }
interface StudentPrefs { id: string; name: string; grade: string; email: string; remind: boolean; booked: boolean; answer: boolean; out: boolean; lead: ReminderLead }
interface TeacherSettings extends TeacherPrefs { name: string; subject: string }
type StudentSettings = StudentPrefs
interface Note { id: string; text: string; at: number /* epoch ms */; read: boolean; key?: string }
interface TimingDraft { id: string; name: string; start: string; end: string; days: Dow[] }
interface HoursInput { timings: TimingDraft[]; max: number }
/** What the student calendar fetches for a date range: this student's own bookings and requests, all teachers. */
interface CalendarData { bookings: Booking[]; requests: BookingRequest[] }
```

## 4. Authentication (not in `src/api/` yet)

The frontend's sign-in is a placeholder (`src/api/auth.ts`). The auth team owns the real one. The frontend needs:

| Method | Path | Request | Response | Errors |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | `{ "email": string, "password": string }` | `{ "accessToken": string, "tokenType": "bearer", "expiresIn": number, "user": { "id": string, "name": string, "role": "student" \| "teacher" } }` | `401 invalid` |
| GET | `/auth/me` | none | `{ "id", "name", "role" }` | `401` |

Notes: hash passwords (the table already stores `hashed_password`); the token carries the user id and role; an expired
token answers `401` and the frontend sends the person to `/login`. **Todo on the frontend:** `src/api/client.ts` does not
attach the token yet; add it when this lands. `admin` exists in the database but has no screens yet.

## 5. Teacher endpoints (`src/api/teacher.ts`)

All require role `teacher`. "Me" is the teacher profile of the token's user. A teacher can only read and change their own data.

### `getTeacher`: `GET /teacher/profile`
- Response `200`: `Teacher` (own record, `timings` **including** removed ones with `gone: true`, `daysOff` sorted by date).
```json
{ "id": "3", "name": "Ms. Rivera", "subject": "Mathematics", "group": "Math", "max": 4,
  "timings": [
    { "id": "t1", "name": "Lunch", "start": "12:10", "end": "12:40", "days": [2, 4] },
    { "id": "t9", "name": "Old", "start": "07:30", "end": "08:00", "days": [], "gone": true } ],
  "daysOff": [ { "date": "2026-10-27", "reason": "Field trip" } ] }
```

### `getSettings`: `GET /teacher/settings`
- Response `200`: `TeacherSettings`.
```json
{ "name": "Ms. Rivera", "subject": "Mathematics", "email": "", "remind": true, "booking": true,
  "cancel": true, "request": true, "morning": false, "lead": "1 hour" }
```

### `saveSettings`: `PUT /teacher/settings`
- Request: `TeacherSettings` (all fields). Response `200`: the saved `TeacherSettings`.
- Errors: `invalid` if the trimmed name is empty, the email is not empty and not a valid address, or `lead` is not one of the three values.
- Side effect: `name` and `subject` change the teacher everywhere students see them.
- The frontend also calls this each time a switch or the reminder time changes, with the full object.

### `getBookings`: `GET /bookings?view=teacher`
- Response `200`: `Booking[]`, every status, this teacher only. Include `studentName` and `reason`.
- The server may limit to bookings from 90 days ago onward.

### `getRequests`: `GET /requests?view=teacher`
- Response `200`: `BookingRequest[]`, every status, this teacher only.

### `saveHours`: `PUT /teacher/schedule`
- Request: `HoursInput`
```json
{ "max": 4, "timings": [
  { "id": "t1", "name": "Lunch", "start": "12:10", "end": "12:40", "days": [2, 4] },
  { "id": "tm8f2k0", "name": "Before school", "start": "07:45", "end": "08:15", "days": [1, 3] } ] }
```
- Response `200`: `{ "orphaned": number }`: how many **upcoming confirmed** bookings no longer match an office hour
  (their timing was removed, or no longer runs that weekday) and are not on a day off.
- **Never delete bookings.** A timing missing from the list is soft-deleted: `gone: true`, `days: []`, kept in the
  database so old bookings still resolve. Timings in the list that the server does not know are created.
- Server must enforce, in this order (`checkHours`, `validateHours`):
  1. at most 4 timings, at least 1 -> `invalid`
  2. every name non-empty after trimming; names unique ignoring case -> `invalid`
  3. start and end set, `end` after `start` -> `invalid`
  4. every timing has at least one day (1 to 5) -> `invalid`
  5. no two timings overlap in time on a shared weekday (touching ends are fine) -> `invalid`
  6. `max` is a whole number from 1 to 30 -> `invalid`
  7. `max` is not below the **largest number of confirmed bookings in any one upcoming office hour** -> `seat_floor`
     (message: "3 is the lowest right now. One upcoming office hour already has 3 students booked.")
- Side effects: tell each student with an upcoming booking that was moved, no longer held or removed (see section 7).
- **Open point:** new timings arrive with client-made ids (`tm...`). Either the server accepts a client-supplied id for a
  new timing, or the response also returns the saved timings so the frontend can swap its ids. See the mismatches table.

### `addDayOff`: `POST /teacher/days-off`
- Request: `{ "date": "2026-10-27", "reason": "Field trip" }`.
- Response `200`: `{ "dayOff": { "date", "reason" }, "affected": number }`. `reason` is trimmed; an empty one is stored as `"Day off"`.
- Server must enforce (`checkDayOff`): date present -> `missing`; not before today -> `past`; not already a day off -> `duplicate_day_off`.
- A date with bookings is **allowed**. Bookings are kept. `affected` = confirmed bookings that day whose office hour has not started.
- Side effect: tell each affected student (section 7).

### `removeDayOff`: `DELETE /teacher/days-off/{date}`
- Response `204`. Error: `not_found` if that date is not a day off of this teacher.
- Side effect: tell each student with an upcoming booking that day that the booking is on again.

### `answerRequest`: `POST /requests/{id}/answer`
- Request: `{ "answer": "accepted" }` or `{ "answer": "declined" }`. Response `200`: the updated `BookingRequest` with `status` `accepted` or `declined` and `note` `"<teacher name> accepted this time."` or `"... declined this time."`.
- Error: `not_found` if the request is not this teacher's or is no longer `pending`.
- Accepting must also enforce (`checkAccept`): the requested time has not passed -> `past`; the teacher is not out that day -> `day_off`. Declining has no extra rules.
- Accepting **does not create a booking**. It only records the answer.
- Side effect: tell the student (section 7).

### `getNotes`: `GET /notifications?view=teacher`
- Response `200`: `Note[]`, newest first, this user's only.

### `markNotesRead`: `POST /notifications/read-all?view=teacher`
- Response `204`. Marks all of this user's notifications read.

## 6. Student endpoints (`src/api/student.ts`)

All require role `student`. "Me" is the token's user.

### `getTeachers`: `GET /teachers`
- Response `200`: `Teacher[]` for every teacher, same shape as `GET /teacher/profile` (including `gone` timings and `daysOff`).

### `getSpotBookings`: `GET /bookings?view=open`
- Response `200`: `Booking[]`: **every confirmed booking of every teacher**, used only to count taken spots.
  For bookings that are not the caller's, `studentName` and `reason` must be `""`. A student may learn that a spot is
  taken, never by whom or why. `studentId` of other students may be replaced by a stable anonymous token (the frontend
  only compares it with the caller's own id). The caller's own bookings are complete.
- The server may limit to dates from today to 4 months ahead.

### `getBookings`: `GET /bookings?view=student`
- Response `200`: `Booking[]`: this student's bookings, every status (history included).

### `getRequests`: `GET /requests?view=student`
- Response `200`: `BookingRequest[]`: this student's requests, every status.

### `getCalendar`: no endpoint, built from two lists
- The backend has **no date-range query**. The My calendar page shows a week, month or quarter, so the frontend calls
  `GET /bookings?view=student` and `GET /requests?view=student` together and keeps the items whose `date` is inside the
  visible range, both ends inclusive (`calendarInRange` in `src/lib/studentCalendar.ts`, tested in `src/api/realPaths.test.ts`).
- It asks again whenever the visible range changes, and keeps showing the old range until the new data arrives.
- A date-range query would let the server do this cut; it is listed under [Backend gaps](#backend-gaps-nice-to-have).
- Disruptions (day off, moved office hour) are not sent: the frontend works them out from `GET /teachers`.

### `bookSpot`: `POST /bookings`
- Students book **a spot in an office hour, not a numbered seat**. The server assigns nothing visible.
- Request: `{ "teacherId": "3", "date": "2026-10-22", "timingId": "t1", "reason": "Help with the quiz." }`
- Response `201` (or `200`): the new `Booking` (`status: "confirmed"`, `studentName` from the account).
- Server must enforce, **in this order** (`checkBookingReason`, `checkBooking`):
  1. `reason` is 10 to 300 characters after trimming -> `reason`
  2. the teacher has that timing and it runs that weekday -> `no_office_hour`
  3. the teacher is not out that day -> `day_off`
  4. the office hour has not started yet (start time after `now`), which also rejects past dates -> `past`
  5. the office hour still has room: confirmed bookings in it `< max` -> `full` ("That office hour is full. Pick another one.")
  6. this student has no other confirmed booking in that office hour -> `already_booked`
  7. this student has no other confirmed booking that **overlaps in time** that day, with any teacher (touching ends are fine) -> `conflict`
- **Capacity must be checked inside a database transaction**, not by a read followed by a write. Otherwise two students
  can both see "1 spot left" and both book it. Either lock the rows that decide it, for example
  `SELECT ... FROM appointments WHERE teacher_id = ? AND appointment_date = ? AND timing_id = ? AND status = 'CONFIRMED' FOR UPDATE`
  (or lock the `teacher_timings` row), then count and insert in the same transaction; or insert and then count, rolling back
  and answering `full` if the count went over `max`.
- Rule 5 must also be a database constraint: `UNIQUE (student_id, appointment_date, timing_id) WHERE status = 'CONFIRMED'`
  (partial unique index). A violation answers `already_booked`.
- The frontend handles `409 full` on purpose: it reloads that day, shows "That office hour just filled up." on
  the card, and keeps what the student typed.
- Side effect: tell the teacher (section 7).

### `cancelBooking`: `DELETE /bookings/{id}`
- Response `204`. Sets the booking to `cancelled`; the spot is free again.
- Errors: `not_found` if it is not this student's or is already cancelled; `past` if the office hour has already started.
- Side effect: tell the teacher.

### `sendRequest`: `POST /requests`
- Request: `{ "teacherId": "3", "date": "2026-10-23", "time": "15:45", "reason": "Need more time for proofs." }`
- Response `201` (or `200`): the new `BookingRequest` (`status: "pending"`, `note: ""`).
- Server must enforce (`checkRequest`), in order: teacher exists -> `not_found`; date present -> `missing`; time present -> `missing`;
  date and time are after `now` -> `past`; the teacher is not out that day -> `day_off`; reason at least 10 characters after trimming -> `reason`.
- Side effect: tell the teacher.

### `cancelRequest`: `DELETE /requests/{id}`
- Response `204`. The request is removed. Error: `not_found` if it is not this student's or is no longer `pending`.
- Side effect: tell the teacher.

### `getSettings`: `GET /student/settings`  /  `saveSettings`: `PUT /student/settings`
- Type `StudentSettings` (`id` is read-only: ignore it on save).
```json
{ "id": "7", "name": "Maya K.", "grade": "Grade 10", "email": "", "remind": true, "booked": true,
  "answer": true, "out": true, "lead": "1 hour" }
```
- Errors on save: `invalid` if the trimmed name is empty, the email is not empty and not a valid address, or `lead` is not one of the three values.

### `getNotes`: `GET /notifications?view=student`  /  `markNotesRead`: `POST /notifications/read-all?view=student`
- Same as the teacher versions, for this student.

## 7. What the server must create when things happen

The frontend only lists these. The server creates them and (later) sends the matching email. A person who switched that kind
off in Settings gets **nothing** for it (no notification, no email). `Note.key` is a de-duplication key for generated
reminders: never create two notifications with the same key for one person.

| Event | Goes to | Text (suggested) | Switched off by |
| --- | --- | --- | --- |
| Student books a spot | teacher | "{student} booked {timing} on {Thu, Oct 22}." | teacher `booking` |
| Student cancels a booking | teacher | "{student} cancelled their booking in {timing} on {date}. A spot is open again." | teacher `cancel` |
| Student sends a request | teacher | "{student} sent a request for {date} at {time}." | teacher `request` |
| Student cancels a request | teacher | "{student} cancelled the request for {date}." | teacher `request` |
| Teacher accepts / declines | the student | "{teacher} accepted|declined your request for {date} at {time}." | student `answer` |
| Teacher adds a day off | each student with an upcoming booking that day | "{teacher} is out on {Thursday, October 22}. Cancel your booking and pick another time." | student `out` |
| Teacher removes a day off | same students | "{teacher} is back on {Thursday, October 22}. Your booking is on again." | student `out` |
| Teacher saves office hours: time or name changed | students booked in that timing | "{teacher} moved {timing} to {12:20 - 12:50 PM}. Your booking on {date} still stands." | student `out` |
| ... that weekday no longer runs | students booked on those days | "{teacher} no longer holds {timing} on {date}. Cancel your booking and pick another time." | student `out` |
| ... timing removed | students booked in it | "{teacher} stopped holding {timing}. Your booking on {date} needs a new time." | student `out` |
| Reminder before an office hour | teacher (if it has bookings) | "{timing} starts at {time} with {n} students booked." | teacher `remind` |
| Reminder before a booked office hour | the student (if not disrupted) | "Reminder: {teacher}'s {timing} starts at {time}. You are booked." | student `remind` |
| Morning summary on days with office hours | teacher | "Today: {n} office hours still to come, {m} students booked." | teacher `morning` |

Reminders are sent `lead` minutes before the start. Only upcoming, confirmed, undisrupted bookings get a reminder.
The student switch `booked` ("my booking is confirmed") has no notification yet; send a confirmation email when it is on.

## 8. Rules the server must enforce

Each rule lives in `src/lib/rules.ts` (with tests). The server must apply the same logic.

| Rule | `rules.ts` | Endpoints | Error |
| --- | --- | --- | --- |
| No past date, and no office hour that has already started | `hasStarted`, `checkBooking`, `checkRequest`, `checkAccept`, `checkDayOff` | `bookSpot`, `sendRequest`, `answerRequest`, `addDayOff`, `cancelBooking` | `past` |
| No booking or request on a teacher's day off | `isOff` | `bookSpot`, `sendRequest`, `answerRequest(accept)` | `day_off` |
| An office hour takes at most `max` students (checked in a transaction) | `checkBooking` | `bookSpot` | `full` |
| One booking per student per office hour | `checkBooking` | `bookSpot` | `already_booked` |
| No overlapping bookings for a student, with any teacher | `conflictingBooking` | `bookSpot` | `conflict` |
| Reason 10 to 300 characters | `checkBookingReason`, `checkRequest` | `bookSpot`, `sendRequest` | `reason` |
| Timing validation (count, names, times, days, overlap) | `validateHours`, `checkHours` | `saveHours` | `invalid` |
| Seats per office hour 1 to 30, never below the most students booked in one upcoming office hour | `minSeats`, `fullestOfficeHour`, `checkHours` | `saveHours` | `invalid`, `seat_floor` |
| A day off never deletes bookings; it only counts them | `affectedOn` | `addDayOff` | none |
| A schedule change never deletes bookings; removed timings are soft-deleted | `applyTimings`, `orphanedBookings`, `hoursNotices` | `saveHours` | none |
| A booking is "disrupted" when its day is a day off, or its timing is gone or no longer runs that weekday | `disruption` | read side (the frontend computes it) | none |

## Mismatches with `backend/models.py`

> **Historical.** Written against the earlier stub backend, before PR #13 replaced it with `backend/app/`. Read it only for the
> reasoning. The current gaps are in the next section.

Read from `backend/models.py` and the one Alembic migration `e52f68b2252b` (tables: `users`, `clubs`, `user_clubs`,
`teacher_profiles`, `teacher_weekly_templates`, `teacher_schedule_overrides`, `appointments`). The backend has no API
code yet. `backend/` was not changed. Each row says what the frontend needs and what to do.

| Frontend field | Backend column | Proposed fix |
| --- | --- | --- |
| `Teacher.id` (string) | `teacher_profiles.id` (Integer). Appointments point at `teacher_profiles.id`, not `users.id` | Use `teacher_profiles.id`, serialized as a string. Same for every id in this contract |
| `Teacher.name`, `TeacherSettings.name`, `StudentPrefs.name` | `users.full_name` | OK. `PUT /.../settings` updates `users.full_name` |
| `Teacher.subject`, `TeacherSettings.subject` | none | Add `teacher_profiles.subject` (String, not null, default `''`) |
| `Teacher.group` (Math, Science...) | none | Add `teacher_profiles.subject_group` (String), or derive it from `subject` on the server |
| `StudentPrefs.grade` | none (no student profile table) | Add `student_profiles(user_id unique, grade)` or `users.grade` |
| `Teacher.max` (seats, 1-30, default 4) | `teacher_profiles.default_max_students` (Integer, default **10**, no limits) | Keep the column (API field `max`), change the default to 4, add `CHECK (default_max_students BETWEEN 1 AND 30)` |
| `Timing` (`id`, `name`, `start`, `end`, `days[]`) | `teacher_weekly_templates`: one row **per weekday** (`day_of_week`, `start_time`, `end_time`, `week_type`). No name, no grouping of days into one timing | Add `teacher_timings(id, teacher_id, name, start_time, end_time, removed_at)` and `teacher_timing_days(timing_id, day_of_week)`; replace `teacher_weekly_templates` or migrate it into them |
| `Timing.gone` (soft delete) | none | `teacher_timings.removed_at` (null = active). Never hard-delete a timing that appointments reference. API: `gone = removed_at is not null`, `days = []` |
| `Timing.days: Dow[]` (1 = Mon ... 5 = Fri) | `day_of_week` Integer (convention not defined) | Define 1 to 5 = Monday to Friday (Python `isoweekday()`) and add `CHECK (day_of_week BETWEEN 1 AND 5)` |
| none (frontend has no A/B weeks) | `teacher_weekly_templates.week_type` enum `ALL`/`BLUE_ONLY`/`ORANGE_ONLY` | **Decision needed.** The frontend shows every week the same. Either drop the column, or the frontend adds a blue/orange week setting. Until decided, the API returns only `all` |
| `DayOff.date` | `teacher_schedule_overrides.override_date` (Date) | OK. A day off is an override with `is_cancelled = true`. Add `UNIQUE (teacher_id, override_date)` |
| `DayOff.reason` | none | Add `teacher_schedule_overrides.reason` (String, not null, default `'Day off'`) |
| none (moved office hours are not modeled) | `teacher_schedule_overrides.is_cancelled` (default true), `new_start_time` | Frontend only knows days off. The API returns only rows with `is_cancelled = true` as `daysOff`. A row with a `new_start_time` is not supported yet: reject it or ignore it |
| `Booking.id` (string) | `appointments.id` (Integer) | Serialize as a string |
| `Booking.teacherId` | `appointments.teacher_id` (-> `teacher_profiles.id`) | OK (name differs only in casing) |
| `Booking.studentId` | `appointments.student_id` (-> `users.id`) | OK |
| `Booking.studentName` | `users.full_name` of `student_id` | Join. Blank it for other students on `GET /bookings?view=open` |
| `Booking.date` | `appointments.appointment_date` | Rename in the API |
| `Booking.timingId` | none (only `start_time` / `end_time`) | Add `appointments.timing_id` (FK -> `teacher_timings.id`, not null). Needed to count students per office hour and to flag "moved" bookings. Keep `start_time`/`end_time` as a snapshot; changing a timing must not rewrite them |
| none (the frontend no longer has a seat number) | `appointments.seat_number` (if the column exists or is added) | **Not needed.** Drop it, or keep it nullable and server-assigned; the API never sends or accepts it. Capacity is a count: `COUNT(*) WHERE status = 'CONFIRMED'` per teacher, date and timing against `Teacher.max`. Enforce it in a transaction (see `bookSpot`) and add `UNIQUE (student_id, appointment_date, timing_id) WHERE status = 'CONFIRMED'` (partial unique index) |
| `Booking.createdAt` | `appointments.created_at` (if present) | Add `appointments.created_at` (timestamptz, default now). The frontend lists students in booking order |
| `Booking.reason` | `appointments.summary_of_reasons` (Text) | Rename in the API; validate 10 to 300 characters in the server |
| `Booking.status` (`'confirmed' \| 'cancelled'`) | `appointments.status` enum stored as names `CONFIRMED`/`CANCELLED` | OK. Serialize the enum **value** (lowercase), not the name |
| `BookingRequest` (all fields) | **no table** | Add `booking_requests(id, teacher_id, student_id, requested_date, requested_time, reason, status enum pending/accepted/declined, note, created_at)` |
| `Note` (notifications) | **no table** | Add `notifications(id, user_id, text, created_at, read_at, dedupe_key)` with `UNIQUE (user_id, dedupe_key)`. API `at` = `created_at` as epoch ms, `read` = `read_at is not null` |
| `TeacherPrefs` / `StudentPrefs` (email, switches, `lead`) | **no table**. `users.email` is the login email, not the reminder email | Add `notification_preferences(user_id unique, reminder_email, remind, booking, cancel, request, morning, booked, answer, out, lead_minutes)`. Store `lead` as 30, 60 or 1440 |
| Role `student` or `teacher` | `users.role` enum `STUDENT`/`TEACHER`/`ADMIN` | OK. Admin has no frontend screens yet |
| none (frontend has no clubs) | `clubs`, `user_clubs` | **Decision needed.** If a club meeting should block a student from booking at that time, it becomes a rule (and a UI message). Otherwise remove the tables |
| Times as `HH:MM`, dates as `YYYY-MM-DD` in school time | `Time`, `Date` (naive); `created_at` = `DateTime` with `datetime.utcnow` (naive UTC) | Configure one school time zone for all "now" checks. Store `created_at` as timezone-aware UTC |
| `Timing.id` for a new timing is made by the browser (`tm...`) | server-made integer id | Decide: the server accepts a client-supplied id for new timings (then ids are strings, ideally UUIDs), or `PUT /teacher/office-hours` also returns the saved `Timing[]` so the frontend can replace its ids. Otherwise a second save would create duplicates |
| none | `docker-compose.yml` and `alembic.ini` contain the development database user and password | Move them to environment variables / `.env` (gitignored) before anything is deployed. Not copied here on purpose |

## Backend gaps (nice to have)

The frontend works without these today. Each one would remove a workaround.

| Wanted from the backend | Why | What the frontend does until then |
| --- | --- | --- |
| `createdAt` (ISO 8601) on every `Booking` | The teacher lists students in the order they booked | `createdAt` is optional in `Booking`. Without it, bookings are ordered by `id` (numbers compare as numbers), which is the order the backend creates them in |
| A date-range query on the student lists, for example `GET /bookings?view=student&from=&to=` and `GET /requests?view=student&from=&to=` | The My calendar page needs only a week, month or quarter | It fetches the whole `view=student` lists and cuts them to the range in the browser (`calendarInRange`). Fine for one school year, wasteful beyond that |

## Not in this contract
- Student booking is the Student screens in this same app; there is no separate student app.
- Alma integration is a stretch goal and is not part of this contract.
- Admin screens do not exist yet.
