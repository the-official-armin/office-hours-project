# API Contract: Teacher UI

Everything below is **proposed: backend team to confirm**. It is exactly what `frontend-teacher/src/api/teacher.ts`
calls when `VITE_USE_MOCKS=false`. Types are defined in `frontend-teacher/src/types/index.ts`.

Conventions:
- Dates are `YYYY-MM-DD`, times are `HH:MM` (24h), school local time.
- All endpoints are for the logged-in teacher (JWT). The frontend sends no teacher id.
- The frontend only *shows* the booking rules. **The backend must enforce them**, answering rule violations with
  `409` and `{ "code": "<RuleCode>", "message": "<text for the teacher>" }`.
  Rule codes: `past`, `day_off`, `full`, `no_office_hour`, `duplicate_day_off`, `invalid`.

## Booking rules the backend must enforce

1. No booking in the past (a start time at or before "now" is past).
2. No booking on a teacher's day off.
3. No more students than the office hour's `maxStudents`.
4. Adding a day off is allowed even when bookings exist; the bookings are kept and the count is reported first.
5. Changing the schedule never deletes bookings. Over-capacity and no-longer-scheduled bookings are reported as warnings.
6. Accepting a request creates a booking (still subject to rules 1 and 2). Declining removes the request.

## Endpoints

| Endpoint | Method | Request | Response | Owner | Rule / notes |
| --- | --- | --- | --- | --- | --- |
| `/teacher/me` | GET | none | `TeacherProfile` `{ name, subject, email }` | Backend team (proposed: confirm) | |
| `/teacher/schedule` | GET | none | `ScheduleView` `{ schedule, warnings[] }` | Backend team (proposed: confirm) | Warnings per rule 5 |
| `/teacher/schedule` | PUT | `Schedule` `{ timings: [Timing, Timing], seatsPerOfficeHour }` | `ScheduleView` | Backend team (proposed: confirm) | Rule 5. `422/409 invalid` if end <= start, empty name, seats < 1, or timings overlap on a shared day |
| `/teacher/slots?from=&to=` | GET | query `from`, `to` (dates, inclusive) | `Slot[]` `{ id, date, timingId, name, start, end, maxStudents, booked }` | Backend team (proposed: confirm) | Derived from schedule; `booked` counts bookings |
| `/teacher/bookings` | GET | none | `Booking[]` `{ id, studentName, reason, date, start, end, slotId, timingName, createdAt }` | Backend team (proposed: confirm) | `slotId` is null for accepted requests |
| `/teacher/bookings/{id}` | DELETE | none | `204` | Backend team (proposed: confirm) | Student cancellation; creates a cancellation notification |
| `/teacher/requests` | GET | none | `BookingRequest[]` `{ id, studentName, reason, date, start, end, createdAt }` | Backend team (proposed: confirm) | |
| `/teacher/requests/{id}/accept` | POST | none | `Booking` | Backend team (proposed: confirm) | Rules 1, 2 and 6 |
| `/teacher/requests/{id}/decline` | POST | none | `204` | Backend team (proposed: confirm) | Rule 6 |
| `/teacher/days-off` | GET | none | `DayOff[]` `{ id, date, reason }` | Backend team (proposed: confirm) | |
| `/teacher/days-off/preview?date=` | GET | query `date` | `DayOffPreview` `{ date, affectedBookings }` | Backend team (proposed: confirm) | Rule 4. `409 past` / `duplicate_day_off` |
| `/teacher/days-off` | POST | `{ date, reason }` | `DayOff` | Backend team (proposed: confirm) | Rule 4. Bookings are kept |
| `/teacher/days-off/{id}` | DELETE | none | `204` | Backend team (proposed: confirm) | |
| `/teacher/reminder-prefs` | GET | none | `ReminderPrefs` `{ beforeOfficeHour, studentBooks, studentCancels, studentRequests, morningSummary, leadMinutes }` | Backend team (proposed: confirm) | `leadMinutes` is 30, 60 or 1440 |
| `/teacher/settings` | PUT | `{ profile: TeacherProfile, prefs: ReminderPrefs }` | `{ profile, prefs }` | Backend team (proposed: confirm) | A disabled preference means that email type is never sent |
| `/teacher/notifications` | GET | none | `AppNotification[]` `{ id, type, title, body, createdAt, read }` | Backend team (proposed: confirm) | Added by the UI beyond the first list. `type`: booking, cancellation, request, reminder |
| `/teacher/notifications/read-all` | POST | none | `204` | Backend team (proposed: confirm) | Added by the UI beyond the first list |

## Not in this contract

- **Student booking** (creating bookings and requests) belongs to the Student UI. In the demo, `Demo tools` fakes it
  and runs the same rules.
- **Login and logout** belong to the auth team. The Teacher UI only needs "is there a valid JWT".
- **Email sending and the reminder scheduler** are server-side. The UI only lists notifications.
- Alma integration is a stretch goal and is not part of this contract.
