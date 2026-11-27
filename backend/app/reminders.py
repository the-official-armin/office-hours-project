"""Reminder emails, sent by a job that runs every few minutes. Each run sends whatever is due now:

- Students: before each office hour they booked, as long before as they chose in Settings (30 minutes, 1 hour, 1 day).
- Teachers: before each of their office hours that has bookings, with who is coming and why.
- Teachers who turned on the morning summary: once a day from 7:00, if office hours with bookings are still to come today.

Each reminder is also an in-app notification with a dedupe key, so running the job again (or twice at once) never sends
the same reminder twice. A reminder that was missed while the job wasn't running still goes out, as long as the office hour
hasn't started. Nothing is sent for a cancelled booking, a teacher's day off, or an office hour that no longer runs that day.

How it runs:
- Deployed: a timer calls GET /jobs/reminders with "Authorization: Bearer <CRON_SECRET>" (app/routers/jobs.py).
- Locally: REMINDER_INTERVAL_MINUTES=5 in backend/.env makes the backend run it by itself (app/main.py).
- By hand: venv/bin/python -m app.reminders
"""
import logging
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from . import outbox, rules
from .deps import now_local, push_note
from .models import STATUS_ACTIVE, Booking, DayOff, Teacher

log = logging.getLogger("office_hours.reminders")

MORNING_HOUR = 7
_LOCK_ID = 7_401_202  # any fixed number: the Postgres advisory lock this job holds while it runs


def _lock(db: Session) -> bool:
    """Only one run at a time on Postgres (SQLite already allows one writer at a time)."""
    if db.get_bind().dialect.name != "postgresql":
        return True
    return bool(db.execute(text("SELECT pg_try_advisory_xact_lock(:id)"), {"id": _LOCK_ID}).scalar())


def _students(n: int) -> str:
    return "%d student%s" % (n, "" if n == 1 else "s")


def run(db: Session, now: Optional[datetime] = None) -> Dict[str, int]:
    """Sends every reminder that is due. Returns how many of each kind were sent."""
    now = now or now_local()
    sent: Counter = Counter()
    if not _lock(db):
        log.info("Reminders: another run is in progress, skipping.")
        return dict(sent)

    today = now.date()
    teachers = {t.id: t for t in db.query(Teacher).all()}
    days_off = defaultdict(set)  # read from the table, not a teacher's cached list, so a day off added this second counts
    for d in db.query(DayOff).filter(DayOff.date >= today, DayOff.date <= today + timedelta(days=2)):
        days_off[d.teacher_id].add(d.date)
    bookings = (
        db.query(Booking)
        .options(joinedload(Booking.timing), joinedload(Booking.student))
        .filter(Booking.status == "confirmed", Booking.date >= today, Booking.date <= today + timedelta(days=2))
        .order_by(Booking.date, Booking.id)
        .all()
    )

    # Office hours that will really happen and haven't started yet.
    upcoming: List[Booking] = []
    for b in bookings:
        x = b.timing
        if x is None or x.gone or rules.js_dow(b.date) not in (x.days or []) or b.date in days_off.get(b.teacher_id, ()):
            continue
        if datetime.combine(b.date, x.start_time) > now:
            upcoming.append(b)

    def minutes_until(b: Booking) -> float:
        return (datetime.combine(b.date, b.timing.start_time) - now).total_seconds() / 60

    # ------------------------------------------------------------------ students
    for b in upcoming:
        student, teacher, x = b.student, teachers.get(b.teacher_id), b.timing
        if student is None or teacher is None or student.status != STATUS_ACTIVE:
            continue
        if minutes_until(b) > rules.LEAD_MINUTES.get(student.lead, 60):
            continue
        start = rules.format_time(rules.hhmm(x.start_time))
        note = "Reminder: %s's %s starts at %s. You are booked." % (teacher.name, x.name, start)
        if push_note(db, note, student_id=student.id, enabled=student.remind, key="reminder:%s:%s" % (b.id, student.lead)):
            outbox.email_person(
                db,
                "Reminder: %s office hour at %s" % (teacher.subject_group or teacher.name, start),
                ["Your %s office hour with %s starts at %s, %s." % (
                    x.name.lower(), teacher.name, start, rules.format_date_long(b.date)),
                 "You're booked: %s" % b.reason,
                 "Can't make it? Cancel in My bookings so someone else can have the spot."],
                student_id=student.id, link="/student/bookings", tag="reminder",
            )
            sent["student"] += 1

    # ------------------------------------------------------------------ teachers
    by_hour = defaultdict(list)  # (teacher id, date, timing id) -> bookings
    for b in upcoming:
        by_hour[(b.teacher_id, b.date, b.timing_id)].append(b)

    for (teacher_id, day, _), group in by_hour.items():
        teacher, x = teachers.get(teacher_id), group[0].timing
        if teacher is None or teacher.status != STATUS_ACTIVE:
            continue
        if minutes_until(group[0]) > rules.LEAD_MINUTES.get(teacher.lead, 60):
            continue
        start = rules.format_time(rules.hhmm(x.start_time))
        note = "%s starts at %s with %s booked." % (x.name, start, _students(len(group)))
        key = "reminder:%s:%s:%s:%s" % (teacher.id, day.isoformat(), x.key, teacher.lead)
        if push_note(db, note, teacher_id=teacher.id, enabled=teacher.remind, key=key):
            who = ["%s: %s" % (b.student.name if b.student else b.student_id, b.reason) for b in group]
            outbox.email_person(
                db,
                "Office hours at %s, %s booked" % (start, _students(len(group))),
                ["Your %s office hour starts at %s, %s." % (x.name.lower(), start, rules.format_date_long(day))] + who,
                teacher_id=teacher.id, link="/teacher/calendar", tag="reminder",
            )
            sent["teacher"] += 1

    # ------------------------------------------------------------------ morning summary
    if now.hour >= MORNING_HOUR:
        todays: Dict[str, List[list]] = defaultdict(list)
        for (teacher_id, day, _), group in by_hour.items():
            if day == today:
                todays[teacher_id].append(group)
        for teacher_id, groups in todays.items():
            teacher = teachers.get(teacher_id)
            if teacher is None or teacher.status != STATUS_ACTIVE:
                continue
            groups.sort(key=lambda g: g[0].timing.start_time)
            hours, seats = len(groups), sum(len(g) for g in groups)
            note = "Today: %d office hour%s still to come, %s booked." % (hours, "" if hours == 1 else "s", _students(seats))
            if push_note(db, note, teacher_id=teacher.id, enabled=teacher.morning, key="morning:%s" % today.isoformat()):
                lines = ["%s at %s: %s booked" % (g[0].timing.name, rules.format_time(rules.hhmm(g[0].timing.start_time)),
                                                  _students(len(g))) for g in groups]
                outbox.email_person(db, "Office hours today: %s booked" % _students(seats), [note] + lines,
                                    teacher_id=teacher.id, link="/teacher/calendar", tag="morning")
                sent["morning"] += 1

    db.commit()  # the queued emails go out here (app/outbox.py)
    if sent:
        log.info("Reminders sent: %s", ", ".join("%s %d" % kv for kv in sorted(sent.items())))
    return dict(sent)


def run_once() -> Dict[str, int]:
    """One run with its own database session (the timer endpoint, the local loop, the command)."""
    from .database import SessionLocal

    from . import ratelimit

    db = SessionLocal()
    try:
        result = run(db)
        ratelimit.cleanup(db)  # old rate-limit rows go with each run
        return result
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    print(run_once() or "Nothing due.")
