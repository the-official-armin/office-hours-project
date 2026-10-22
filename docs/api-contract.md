# API Contract

This is the agreement between the frontend and the backend team. Rows below are **proposed** by the
Teacher UI subgroup (Subgroup B). The backend team confirms or changes them, and `frontend/src/types/`
must match whatever is agreed.

The backend is the source of truth for booking rules (no past bookings, no bookings on days off,
max students per slot). The frontend only displays and pre-validates them.

| Endpoint | Method | Request | Response | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| `/teachers/me` | GET | none | `TeacherProfile` | Backend team | Proposed |
| `/teachers/me` | PATCH | `Partial<TeacherProfile>` (reminder preferences, default max students) | `TeacherProfile` | Backend team | Proposed |
| `/teachers/me/office-hours` | GET | none | `OfficeHourSlot[]` | Backend team | Proposed |
| `/teachers/me/office-hours` | PUT | `OfficeHourSlot[]` (without `id` for new slots) | `OfficeHourSlot[]` | Backend team | Proposed |
| `/teachers/me/days-off` | GET | none | `DayOff[]` | Backend team | Proposed |
| `/teachers/me/days-off` | POST | `{ date, note? }` | `DayOff` | Backend team | Proposed |
| `/teachers/me/days-off/{id}` | DELETE | none | `204 No Content` | Backend team | Proposed |
| `/teachers/me/bookings` | GET | optional `?from=YYYY-MM-DD&to=YYYY-MM-DD` | `TeacherBooking[]` | Backend team | Proposed |

Type definitions live in `frontend/src/types/teacher.ts`.

## Notes

- Auth (login/logout, JWT) belongs to another subgroup and is not listed here yet.
- Alma integration is a stretch goal and is **not** part of this contract.
